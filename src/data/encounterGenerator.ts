import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { EncounterLayout } from './levelEncounterData';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  ENCOUNTER_POOLS,
  filterSquadForDepth,
  type EncounterGridPos,
  type EncounterPoolTier,
  type EncounterSquadSpec,
} from './encounterPools';

export interface RunSegmentState {
  depth: DistrictId;
  alphaNodeIndex: number;
  lastEncounterId: string | null;
  history: string[];
}

export type BreathingRoomKind = 'BLACK_MARKET' | 'VEIL_BLEED_BOON' | 'RESOURCE_HARVEST';

export interface GeneratedEncounter {
  layout: EncounterLayout;
  isAlpha: boolean;
  encounterId: string;
  poolTier: EncounterPoolTier | 'BOSS' | 'BREATHING_ROOM';
  breathingRoomKind?: BreathingRoomKind;
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

export function createRunSegment(district: DistrictId, seed: string): RunSegmentState {
  return {
    depth: district,
    alphaNodeIndex: rollAlphaNodeIndex(`${seed}:alpha:${district}`),
    lastEncounterId: null,
    history: [],
  };
}

function emptyLayout(): EncounterLayout {
  return { frontLeft: null, frontRight: null, backLeft: null, backRight: null };
}

function squadToLayout(squad: EncounterSquadSpec): { layout: EncounterLayout; isAlpha: boolean } {
  const layout = emptyLayout();
  let isAlpha = false;
  for (const unit of squad.units) {
    const key = POS_TO_LAYOUT[unit.pos];
    if (layout[key] == null) {
      layout[key] = unit.type;
    } else if (unit.pos === 'FRONT_CENTER' && layout.frontRight == null) {
      layout.frontRight = unit.type;
    } else if (unit.pos === 'BACK_CENTER' && layout.backRight == null) {
      layout.backRight = unit.type;
    }
    if (unit.isAlpha) isAlpha = true;
  }
  return { layout, isAlpha };
}

function pickFromPool(
  pool: EncounterSquadSpec[],
  lastEncounterId: string | null,
  rand: () => number,
  district: DistrictId,
): EncounterSquadSpec | null {
  const eligible = pool
    .map((s) => filterSquadForDepth(s, district))
    .filter((s): s is EncounterSquadSpec => s != null);
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
  const roll = rand();
  if (roll < 0.4) return 'BLACK_MARKET';
  if (roll < 0.8) return 'VEIL_BLEED_BOON';
  return 'RESOURCE_HARVEST';
}

export function generateNodeEncounter(
  globalDepth: number,
  segment: RunSegmentState,
  seed: string,
): GeneratedEncounter {
  const district = getDistrictFromDepth(globalDepth);
  const localLevel = localLevelFromDepth(globalDepth);
  const rand = seededRandom(`${seed}:enc:${globalDepth}:${segment.alphaNodeIndex}`);

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

  const pools = ENCOUNTER_POOLS[district];
  let poolTier: EncounterPoolTier;
  let pool: EncounterSquadSpec[];

  if (localLevel <= 3) {
    poolTier = 'INTRO';
    pool = pools.INTRO;
  } else if (localLevel === segment.alphaNodeIndex) {
    poolTier = 'SOLO_ALPHA';
    pool = pools.SOLO_ALPHA;
  } else if (localLevel >= 9) {
    poolTier = 'ADVANCED_SYNERGY';
    pool = pools.ADVANCED_SYNERGY;
  } else {
    poolTier = 'BASIC_SYNERGY';
    pool = pools.BASIC_SYNERGY;
  }

  const squad = pickFromPool(pool, segment.lastEncounterId, rand, district);
  if (!squad) {
    return {
      layout: { frontLeft: 'FRACTURE_HOUND', frontRight: null, backLeft: null, backRight: null },
      isAlpha: false,
      encounterId: 'fallback-hound',
      poolTier,
    };
  }

  const { layout, isAlpha } = squadToLayout(squad);
  return {
    layout,
    isAlpha,
    encounterId: squad.id,
    poolTier,
  };
}

export function applyEncounterToSegment(
  segment: RunSegmentState,
  encounterId: string,
): RunSegmentState {
  return {
    ...segment,
    lastEncounterId: encounterId,
    history: [...segment.history, encounterId],
  };
}

export function isBreathingRoomLevel(segment: RunSegmentState, localLevel: number): boolean {
  return localLevel === segment.alphaNodeIndex + 1;
}

export function isAlphaDuelLevel(segment: RunSegmentState, localLevel: number): boolean {
  return localLevel === segment.alphaNodeIndex;
}

/** Keys referenced in pools — used for type completeness checks. */
export const ALL_POOL_ENEMY_KEYS: EncounterEnemyKey[] = [
  'FRACTURE_HOUND', 'ECHOING_BRUTE', 'MIASMA_SWARM', 'LEY_SIREN', 'SPALL', 'TAR_SPITTER',
  'CONCRETE_GARGOYLE', 'IRON_MAIDEN', 'ASH_WEEPER', 'NULL_SHADE', 'SPATIAL_GLITCH',
  'SCUTTLER', 'RESONANCE_CASTER', 'SAPPER', 'GUTTER_GOLIATH', 'GOLEM', 'SLAG_BLOOD',
  'HOOK_WEAVER', 'MEMORY_LEECH', 'SMOG_CALLER', 'THRALL', 'COIL_SPIKE_SNIPER', 'CHURN', 'SPLINTER',
];
