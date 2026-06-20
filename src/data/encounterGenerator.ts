import type { FactionType } from '../types/game';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { EncounterLayout } from './levelEncounterData';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  ENCOUNTER_POOLS,
  filterSquadForDepth,
  resolvePoolForTier,
  type EncounterGridPos,
  type EncounterPoolTier,
  type EncounterSquadSpec,
} from './encounterPools';
import { buildOriginDeck, peekEncounterOrigin, type EncounterOrigin } from './originDeckEngine';
import { rollFactionControl } from './factionTraitEngine';

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

export interface GeneratedEncounter {
  layout: EncounterLayout;
  isAlpha: boolean;
  encounterId: string;
  poolTier: EncounterPoolTier | 'BOSS' | 'BREATHING_ROOM';
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

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
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

function squadToLayout(squad: EncounterSquadSpec): { layout: EncounterLayout; isAlpha: boolean } {
  const layout = emptyLayout();
  let isAlpha = false;
  for (const unit of squad.units) {
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

function validateAmalgamPlacement(squad: EncounterSquadSpec): boolean {
  const hasAmalgam = squad.units.some((u) => u.type === 'AMALGAM');
  if (!hasAmalgam) return true;
  const frontOccupiers = squad.units.filter(
    (u) => u.type !== 'AMALGAM' && (u.pos === 'FRONT_LEFT' || u.pos === 'FRONT_RIGHT' || u.pos === 'FRONT_CENTER'),
  );
  return frontOccupiers.length === 0;
}

function pickFromPool(
  pool: EncounterSquadSpec[],
  lastEncounterId: string | null,
  rand: () => number,
  district: DistrictId,
  origin: EncounterOrigin,
): EncounterSquadSpec | null {
  const eligible = pool
    .map((s) => filterSquadForDepth(s, district, origin))
    .filter((s): s is EncounterSquadSpec => s != null && validateAmalgamPlacement(s));
  if (eligible.length === 0) return null;

  let attempts = 0;
  while (attempts < 8) {
    const idx = Math.floor(rand() * eligible.length);
    const pick = eligible[idx];
    if (pick.id !== lastEncounterId || eligible.length === 1) return pick;
    attempts += 1;
  }
  return eligible[0];
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

export function generateNodeEncounter(
  globalDepth: number,
  segment: RunSegmentState,
  seed: string,
): GeneratedEncounter {
  const district = getDistrictFromDepth(globalDepth);
  const localLevel = localLevelFromDepth(globalDepth);
  const rand = seededRandom(`${seed}:enc:${globalDepth}:${segment.alphaNodeIndex}:${segment.originDeckIndex}`);

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
  const originPools = ENCOUNTER_POOLS[district][encounterOrigin];

  let poolTier: EncounterPoolTier;
  if (localLevel <= 3) {
    poolTier = 'INTRO';
  } else if (localLevel === segment.alphaNodeIndex) {
    poolTier = 'SOLO_ALPHA';
  } else if (localLevel >= 9) {
    poolTier = 'ADVANCED_SYNERGY';
  } else {
    poolTier = 'BASIC_SYNERGY';
  }

  const pool = resolvePoolForTier(originPools, poolTier, encounterOrigin);
  const squad = pickFromPool(pool, segment.lastEncounterId, rand, district, encounterOrigin);

  if (!squad) {
    const fallbackOrigin: EncounterOrigin = encounterOrigin === 'CABAL' ? 'VEIL' : 'CABAL';
    const fallbackPool = resolvePoolForTier(ENCOUNTER_POOLS[district][fallbackOrigin], poolTier, fallbackOrigin);
    const fallbackSquad = pickFromPool(fallbackPool, segment.lastEncounterId, rand, district, fallbackOrigin);
    if (fallbackSquad) {
      const { layout, isAlpha } = squadToLayout(fallbackSquad);
      return {
        layout,
        isAlpha,
        encounterId: fallbackSquad.id,
        poolTier,
        encounterOrigin: fallbackOrigin,
        cabalFaction: fallbackOrigin === 'CABAL' ? segment.currentFactionControl : undefined,
      };
    }
    return {
      layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null },
      isAlpha: false,
      encounterId: 'fallback-hound',
      poolTier,
      encounterOrigin: 'VEIL',
    };
  }

  const { layout, isAlpha } = squadToLayout(squad);
  return {
    layout,
    isAlpha,
    encounterId: squad.id,
    poolTier,
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

export const ALL_POOL_ENEMY_KEYS: EncounterEnemyKey[] = [
  'FRACTURE_HOUND', 'ECHOING_BRUTE', 'MIASMA_SWARM', 'LEY_SIREN', 'SPALL', 'TAR_SPITTER',
  'CONCRETE_GARGOYLE', 'IRON_MAIDEN', 'ASH_WEEPER', 'NULL_SHADE', 'SPATIAL_GLITCH',
  'SCUTTLER', 'RESONANCE_CASTER', 'SAPPER', 'GUTTER_GOLIATH', 'GOLEM', 'SLAG_BLOOD',
  'HOOK_WEAVER', 'MEMORY_LEECH', 'SMOG_CALLER', 'THRALL', 'COIL_SPIKE_SNIPER', 'CHURN', 'SPLINTER',
  'BREACHER', 'CUTTER', 'WARDEN', 'FIXER', 'SPOTTER', 'BURNER',
  'AMALGAM', 'WIRE_GHOUL', 'HOLLOW_LUNG', 'GRAVE_ROBBER',
];
