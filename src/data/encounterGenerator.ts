import type { FactionType } from '../types/game';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { EncounterLayout } from './levelEncounterData';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import { buildOriginDeck, peekEncounterOrigin, type EncounterOrigin } from './originDeckEngine';
import { rollFactionControl } from './factionTraitEngine';
import {
  loadAlphaDuelElite,
  loadEliteEncounter,
  verifyEliteDatabase,
} from './eliteSpawnEngine';
import {
  loadCombatEncounter,
  macroFamilyToSynergyBiome,
  verifySynergyDatabase,
  ALL_SYNERGY_ENEMY_KEYS,
} from './synergySpawnEngine';
import type { EncounterGridPos, EncounterUnitSpec, SynergySquadSpec } from './synergyEncounterTypes';
import { rosterHasMixedAlpha } from './rosterSpawnSlots';

export type { EncounterGridPos, EncounterUnitSpec, EncounterSquadSpec, SynergySquadSpec } from './synergyEncounterTypes';

export interface RunSegmentState {
  depth: DistrictId;
  alphaNodeIndex: number;
  lastEncounterId: string | null;
  history: string[];
  currentFactionControl: FactionType;
  originDeck: EncounterOrigin[];
  originDeckIndex: number;
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
  cabalFaction?: FactionType;
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

export function createRunSegment(
  district: DistrictId,
  seed: string,
  playerFaction?: FactionType | null,
): RunSegmentState {
  return {
    depth: district,
    alphaNodeIndex: rollAlphaNodeIndex(`${seed}:alpha:${district}`),
    lastEncounterId: null,
    history: [],
    currentFactionControl: rollFactionControl(district, playerFaction, seed),
    originDeck: buildOriginDeck(district, seed),
    originDeckIndex: 0,
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

function resolveEncounterOrigin(segment: RunSegmentState, seed: string, district: DistrictId): EncounterOrigin {
  if (segment.originDeckIndex < segment.originDeck.length) {
    return segment.originDeck[segment.originDeckIndex];
  }
  return peekEncounterOrigin(
    segment.originDeck,
    segment.originDeckIndex,
    district,
    segment.lastEncounterOrigin,
    seed,
  );
}

export interface GenerateNodeEncounterOptions {
  macroBiome?: MacroBiomeFamily | null;
}

export function generateNodeEncounter(
  globalDepth: number,
  segment: RunSegmentState,
  seed: string,
  options: GenerateNodeEncounterOptions = {},
): GeneratedEncounter {
  const district = getDistrictFromDepth(globalDepth);
  const localLevel = localLevelFromDepth(globalDepth);
  const rand = seededRandom(`${seed}:enc:${globalDepth}:${segment.alphaNodeIndex}:${segment.originDeckIndex}`);
  const synergyBiome = macroFamilyToSynergyBiome(options.macroBiome);

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

  const encounterOrigin = resolveEncounterOrigin(segment, seed, district);
  const isAlphaDuel = localLevel === segment.alphaNodeIndex;

  if (isAlphaDuel) {
    let squad = loadAlphaDuelElite(district, synergyBiome, rand, {
      lastEncounterId: segment.lastEncounterId,
    });
    if (!squad) {
      squad = loadAlphaDuelElite(district, synergyBiome, rand, {
        lastEncounterId: null,
        interloper: true,
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
      cabalFaction: encounterOrigin === 'CABAL' ? segment.currentFactionControl : undefined,
    };
  }

  let squad = loadCombatEncounter(district, synergyBiome, rand, {
    lastEncounterId: segment.lastEncounterId,
  });

  if (!squad) {
    squad = loadCombatEncounter(district, synergyBiome, rand, {
      lastEncounterId: null,
      interloper: true,
    });
  }

  if (!squad) {
    return {
      layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null },
      isAlpha: false,
      encounterId: 'fallback-hound',
      poolTier: 'SYNERGY',
      encounterOrigin: 'VEIL',
    };
  }

  const { layout, isAlpha: squadAlpha } = squadToLayout(squad);
  const useRoster = rosterHasMixedAlpha(squad.roster) || squad.roster.some((u) => u.isAlpha);

  return {
    layout,
    roster: useRoster ? squad.roster : undefined,
    isAlpha: squadAlpha,
    encounterId: squad.id,
    poolTier: 'SYNERGY',
    encounterOrigin,
    cabalFaction: encounterOrigin === 'CABAL' ? segment.currentFactionControl : undefined,
  };
}

export function applyEncounterToSegment(
  segment: RunSegmentState,
  encounterId: string,
  encounterOrigin?: EncounterOrigin | null,
): RunSegmentState {
  const consumedOrigin = encounterOrigin === 'CABAL' || encounterOrigin === 'VEIL';
  return {
    ...segment,
    lastEncounterId: encounterId,
    history: [...segment.history, encounterId],
    originDeckIndex: consumedOrigin ? segment.originDeckIndex + 1 : segment.originDeckIndex,
    lastEncounterOrigin: encounterOrigin ?? segment.lastEncounterOrigin,
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
  verifySynergyDatabase();
  verifyEliteDatabase();
}
