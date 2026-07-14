import type { EncounterOrigin, EncounterNodeTier, EncounterSpawnOverride, VeilBiome } from '../types/encounterSpawn';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { EncounterLayout } from './levelEncounterData';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  loadAlphaDuelElite,
  verifyEliteDecks,
} from './eliteSpawnEngine';
import { rollEncounterOrigin } from './originRollEngine';
import { pickProceduralSynergySquad, verifyEncounterSpawnPipeline } from './encounterSpawnEngine';
import {
  macroFamilyToSynergyBiome,
  verifySynergyDatabase,
  ALL_SYNERGY_ENEMY_KEYS,
} from './synergySpawnEngine';
import { verifyEncounterDecks } from './synergyDatabase';
import { verifyEncounterCatalog } from './encounterCatalogAuditEngine';
import { verifyEnemyDefinitions } from './encounterSpawnGateEngine';
import { echoEncounterId, resolveEchoSpawnOverride, verifyEchoSpawnPipeline } from './encounterEchoOverride';
import { verifyEncounterSpawnValidation } from './encounterSpawnValidationEngine';
import { verifyDepthEnemyVariants } from './depthEnemyVariantValidationEngine';
import { verifyScannerLabelCertainty } from './scannerLabelCertaintyValidationEngine';
import { verifyPhaseGHardRules } from './depthIdentityPhaseGDebugEngine';
import { verifyEncounterComposition } from './encounterCompositionValidationEngine';
import type { EncounterCompositionPickMeta } from '../types/encounterComposition';
import type { EchoEliteTemplate } from '../types/echoElite';
import type { NodeContextModifiers } from '../types/worldState';
import type { EncounterGridPos, EncounterUnitSpec, SynergySquadSpec } from './synergyEncounterTypes';
import { rosterHasMixedAlpha } from './rosterSpawnSlots';
import { veilBiomeToLegacyMacroBiome } from './sectorBiomeBridge';
import { prefersAnchorNodeTier } from './depthEnemyVariantSpawnEngine';

export type { EncounterOrigin } from '../types/encounterSpawn';
export type { EncounterGridPos, EncounterUnitSpec, EncounterSquadSpec, SynergySquadSpec } from './synergyEncounterTypes';

export interface RunSegmentState {
  depth: DistrictId;
  alphaNodeIndex: number;
  lastEncounterId: string | null;
  history: string[];
  lastEncounterOrigin: EncounterOrigin | null;
}

export type BreathingRoomKind = 'BLACK_MARKET' | 'RESOURCE_HARVEST';

export type EncounterPoolTier = 'SYNERGY' | 'ELITE' | 'ALPHA_DUEL' | 'BOSS' | 'BREATHING_ROOM';

export interface GeneratedEncounter {
  layout: EncounterLayout;
  isAlpha: boolean;
  encounterId: string;
  poolTier: EncounterPoolTier;
  /** When present, spawn uses per-unit isAlpha instead of layout-wide flattening. */
  roster?: readonly EncounterUnitSpec[];
  breathingRoomKind?: BreathingRoomKind;
  encounterOrigin?: EncounterOrigin;
  /** Echo node override — not a rolled origin. */
  spawnOverride?: EncounterSpawnOverride;
  echoTemplateId?: string;
  /** Phase A composition metadata when role-template fill succeeded. */
  composition?: EncounterCompositionPickMeta;
}

const POS_TO_LAYOUT: Record<EncounterGridPos, keyof EncounterLayout> = {
  FRONT_LEFT: 'frontLeft',
  FRONT_RIGHT: 'frontRight',
  BACK_LEFT: 'backLeft',
  BACK_RIGHT: 'backRight',
  FRONT_CENTER: 'frontLeft',
  BACK_CENTER: 'backLeft',
};

export function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

export function rollAlphaNodeIndex(seed: string): number {
  const rand = seededRandom(seed);
  return 6 + Math.floor(rand() * 5);
}

export function createRunSegment(district: DistrictId, seed: string): RunSegmentState {
  return {
    depth: district,
    alphaNodeIndex: rollAlphaNodeIndex(`${seed}:alpha:${district}`),
    lastEncounterId: null,
    history: [],
    lastEncounterOrigin: null,
  };
}

function emptyLayout(): EncounterLayout {
  return { frontLeft: null, frontRight: null, backLeft: null, backRight: null };
}

function squadToLayout(squad: SynergySquadSpec): { layout: EncounterLayout; isAlpha: boolean } {
  const layout = emptyLayout();
  let isAlpha = false;
  for (const unit of squad.roster) {
    if (unit.type === 'AMALGAM') {
      layout.frontLeft = 'AMALGAM';
      layout.frontRight = 'AMALGAM';
    } else {
      const key = POS_TO_LAYOUT[unit.pos];
      if (layout[key] == null) {
        layout[key] = unit.type;
      } else if (unit.pos === 'FRONT_CENTER' && layout.frontRight == null) {
        layout.frontRight = unit.type;
      } else if (unit.pos === 'BACK_CENTER' && layout.backRight == null) {
        layout.backRight = unit.type;
      }
    }
    if (unit.isAlpha) isAlpha = true;
  }
  return { layout, isAlpha };
}

function rollBreathingRoomKind(rand: () => number): BreathingRoomKind {
  return rand() < 0.5 ? 'BLACK_MARKET' : 'RESOURCE_HARVEST';
}

export interface GenerateNodeEncounterOptions {
  macroBiome?: MacroBiomeFamily | null;
  veilBiome?: VeilBiome | null;
  isElite?: boolean;
  contextModifiers?: NodeContextModifiers | null;
}

function buildEchoGeneratedEncounter(template: EchoEliteTemplate): GeneratedEncounter {
  const pseudoSquad = { roster: template.roster } as SynergySquadSpec;
  const { layout, isAlpha: squadAlpha } = squadToLayout(pseudoSquad);
  const useRoster = rosterHasMixedAlpha(template.roster) || template.roster.some((u) => u.isAlpha);

  return {
    layout,
    roster: useRoster ? template.roster : undefined,
    isAlpha: squadAlpha,
    encounterId: echoEncounterId(template.id),
    poolTier: 'ELITE',
    spawnOverride: 'ECHO',
    echoTemplateId: template.id,
  };
}

export function generateNodeEncounter(
  globalDepth: number,
  segment: RunSegmentState,
  seed: string,
  options: GenerateNodeEncounterOptions = {},
): GeneratedEncounter {
  const district = getDistrictFromDepth(globalDepth);
  const localLevel = localLevelFromDepth(globalDepth);
  const rand = seededRandom(`${seed}:enc:${globalDepth}:${segment.alphaNodeIndex}`);
  const veilBiome = options.veilBiome ?? null;
  const macroBiome = options.macroBiome
    ?? (veilBiome ? veilBiomeToLegacyMacroBiome(veilBiome) : null);
  const synergyBiome = macroFamilyToSynergyBiome(macroBiome);
  const squadTier = options.isElite ? 'ELITE' : 'NORMAL';
  const nodeTier: EncounterNodeTier = options.isElite
    ? 'ELITE'
    : prefersAnchorNodeTier(options.contextModifiers)
      ? 'ANCHOR'
      : 'NORMAL';

  if (isDistrictGateDepth(globalDepth)) {
    return {
      layout: emptyLayout(),
      isAlpha: false,
      encounterId: `boss-d${district}`,
      poolTier: 'BOSS',
    };
  }

  if (localLevel === segment.alphaNodeIndex + 1) {
    return {
      layout: emptyLayout(),
      isAlpha: false,
      encounterId: `breathing-d${district}-l${localLevel}`,
      poolTier: 'BREATHING_ROOM',
      breathingRoomKind: rollBreathingRoomKind(rand),
    };
  }

  const echoTemplate = resolveEchoSpawnOverride(options.contextModifiers);
  if (echoTemplate) {
    return buildEchoGeneratedEncounter(echoTemplate);
  }

  const isAlphaDuel = localLevel === segment.alphaNodeIndex;

  if (isAlphaDuel) {
    const encounterOrigin = rollEncounterOrigin(
      district,
      'ELITE',
      `${seed}:alpha-origin:${globalDepth}`,
      segment.lastEncounterOrigin,
    );
    let squad = loadAlphaDuelElite(district, synergyBiome, rand, {
      lastEncounterId: segment.lastEncounterId,
      encounterOrigin,
    });
    if (!squad) {
      squad = loadAlphaDuelElite(district, synergyBiome, rand, {
        lastEncounterId: null,
        interloper: true,
        encounterOrigin,
      });
    }
    if (!squad) {
      return {
        layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null },
        roster: [{ type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT', isAlpha: true }],
        isAlpha: true,
        encounterId: 'fallback-alpha-hound',
        poolTier: 'ALPHA_DUEL',
        encounterOrigin: 'VEIL',
      };
    }
    const { layout } = squadToLayout(squad);
    return {
      layout,
      roster: squad.roster,
      isAlpha: true,
      encounterId: squad.id,
      poolTier: 'ALPHA_DUEL',
      encounterOrigin,
    };
  }

  const mods = options.contextModifiers;
  const picked = pickProceduralSynergySquad({
    globalDepth,
    district,
    seed,
    veilBiome,
    macroBiome,
    squadTier,
    nodeTier,
    lastEncounterId: segment.lastEncounterId,
    lastEncounterOrigin: segment.lastEncounterOrigin,
    highValue: mods?.highValueResource === true,
    highRisk: mods?.highRisk === true,
    anchorSignal: mods?.anchorSignal === true,
    echoSignal: mods?.echoSignal === true,
    operationKind: mods?.operationTag ?? null,
    foreshadowBias: localLevel >= 10,
  });

  if (!picked) {
    return {
      layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null },
      isAlpha: false,
      encounterId: 'fallback-hound',
      poolTier: 'SYNERGY',
      encounterOrigin: 'VEIL',
    };
  }

  const { squad, encounterOrigin, composition } = picked;
  const { layout, isAlpha: squadAlpha } = squadToLayout(squad);
  const useRoster = rosterHasMixedAlpha(squad.roster) || squad.roster.some((u) => u.isAlpha);

  return {
    layout,
    roster: useRoster ? squad.roster : undefined,
    isAlpha: squadAlpha,
    encounterId: squad.id,
    poolTier: 'SYNERGY',
    encounterOrigin,
    composition,
  };
}

export function applyEncounterToSegment(
  segment: RunSegmentState,
  encounterId: string,
  encounterOrigin?: EncounterOrigin | null,
  spawnOverride?: EncounterSpawnOverride | null,
): RunSegmentState {
  const preserveOrigin = spawnOverride === 'ECHO';
  return {
    ...segment,
    lastEncounterId: encounterId,
    history: [...segment.history, encounterId],
    lastEncounterOrigin: preserveOrigin
      ? segment.lastEncounterOrigin
      : (encounterOrigin ?? segment.lastEncounterOrigin),
  };
}

export function isBreathingRoomLevel(segment: RunSegmentState, localLevel: number): boolean {
  return localLevel === segment.alphaNodeIndex + 1;
}

export function isAlphaDuelLevel(segment: RunSegmentState, localLevel: number): boolean {
  return localLevel === segment.alphaNodeIndex;
}

export const ALL_POOL_ENEMY_KEYS: EncounterEnemyKey[] = ALL_SYNERGY_ENEMY_KEYS;

export function verifyEncounterGenerator(): void {
  verifyEnemyDefinitions();
  verifyEncounterDecks();
  verifyEncounterCatalog();
  verifySynergyDatabase();
  verifyEliteDecks();
  verifyEncounterSpawnPipeline();
  verifyEchoSpawnPipeline();
  verifyEncounterSpawnValidation();
  verifyDepthEnemyVariants();
  verifyScannerLabelCertainty();
  verifyPhaseGHardRules();
  verifyEncounterComposition();
}
