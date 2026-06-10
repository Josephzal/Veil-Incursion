export type DistrictId = 1 | 2 | 3;

export const DISTRICT_NAMES: Record<DistrictId, string> = {
  1: 'Surface Streets',
  2: 'The Sub-Grid',
  3: 'The Deep Veil',
};

/** Player-facing depth (1–30) from cleared encounter count. */
export function depthFromNodesCleared(nodesCleared: number): number {
  return nodesCleared + 1;
}

export function getDistrictFromDepth(depth: number): DistrictId {
  if (depth <= 10) return 1;
  if (depth <= 20) return 2;
  return 3;
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
  return depth === 10 || depth === 20;
}

export function isPrimeBossDepth(depth: number): boolean {
  return depth === 30;
}

export function districtGateLabel(depth: number): string {
  if (depth === 10) return 'DISTRICT GATE // SURFACE BREACH';
  if (depth === 20) return 'DISTRICT GATE // SUB-GRID SEAL';
  if (depth === 30) return 'PRIME ANOMALY NEST // DEEP VEIL CORE';
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
    tacticHint: 'Solaris phalanx units punish blind breaches — focus perception first.',
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
