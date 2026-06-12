import { DISTRICT_GATE_DEPTHS, LEVELS_PER_DISTRICT, MAX_RUN_GRAPH_DEPTH } from '../types/sectorPacing';

export type DistrictId = 1 | 2 | 3;

export const DISTRICT_NAMES: Record<DistrictId, string> = {
  1: 'Surface Streets',
  2: 'The Sub-Grid',
  3: 'The Deep Veil',
};

/** Player-facing depth (1–45) from cleared encounter count. */
export function depthFromNodesCleared(nodesCleared: number): number {
  return nodesCleared + 1;
}

export function getDistrictFromDepth(depth: number): DistrictId {
  if (depth <= LEVELS_PER_DISTRICT) return 1;
  if (depth <= LEVELS_PER_DISTRICT * 2) return 2;
  return 3;
}

/** Local level within the active district (1–15). */
export function localLevelFromDepth(depth: number): number {
  const district = getDistrictFromDepth(depth);
  if (district === 1) return depth;
  if (district === 2) return depth - LEVELS_PER_DISTRICT;
  return depth - LEVELS_PER_DISTRICT * 2;
}

export function localLevelFromNodesCleared(nodesCleared: number): number {
  return localLevelFromDepth(depthFromNodesCleared(nodesCleared));
}

export function districtMultiplier(district: DistrictId): number {
  switch (district) {
    case 1:
      return 1.0;
    case 2:
      return 1.2;
    case 3:
      return 1.5;
    default:
      return 1.0;
  }
}

export function formatDistrictTag(district: DistrictId): string {
  return `D${district}`;
}

export function isDistrictGateDepth(depth: number): boolean {
  return (DISTRICT_GATE_DEPTHS as readonly number[]).includes(depth);
}

export function isPrimeBossDepth(depth: number): boolean {
  return depth === MAX_RUN_GRAPH_DEPTH;
}

export function districtGateLabel(depth: number): string {
  if (depth === 15) return 'DISTRICT GATE // SURFACE BREACH';
  if (depth === 30) return 'DISTRICT GATE // SUB-GRID SEAL';
  if (depth === 45) return 'PRIME ANOMALY NEST // DEEP VEIL CORE';
  return 'DISTRICT GATE';
}

export interface DistrictIntelBrief {
  district: DistrictId;
  districtName: string;
  dominantFaction: string;
  factionTag: string;
  hazardSummary: string;
  tacticHint: string;
}

const UPCOMING_DISTRICT_INTEL: Record<DistrictId, DistrictIntelBrief> = {
  1: {
    district: 1,
    districtName: DISTRICT_NAMES[1],
    dominantFaction: 'Terran Grid',
    factionTag: 'TERRAN_GRID',
    hazardSummary: 'Baseline veil signatures. Standard patrol response.',
    tacticHint: 'Aegis shielding recommended for street-level breaches.',
  },
  2: {
    district: 2,
    districtName: DISTRICT_NAMES[2],
    dominantFaction: 'Solaris Cabal',
    factionTag: 'SOLARIS',
    hazardSummary: 'Advanced hostile tactics. Resonance scan gain elevated.',
    tacticHint: 'Solaris phalanx units punish rushed breaches — focus perception first.',
  },
  3: {
    district: 3,
    districtName: DISTRICT_NAMES[3],
    dominantFaction: 'Legion Remnant',
    factionTag: 'LEGION',
    hazardSummary: 'Elite hazards and prime boss vectors. Critical heat likely.',
    tacticHint: 'Legion elites armor-plate — counter modules before engaging.',
  },
};

/** Intel for the district the player is about to enter after unsealing the safehouse door. */
export function getUpcomingDistrictIntel(nextDistrict: DistrictId): DistrictIntelBrief {
  return UPCOMING_DISTRICT_INTEL[nextDistrict];
}
