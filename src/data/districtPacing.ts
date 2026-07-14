import { DISTRICT_GATE_DEPTHS, getLevelsPerDistrict, getMaxRunGraphDepth } from '../types/sectorPacing';
import type { RunGenerationContext } from '../types/worldState';
import type { DepthIdentityState } from '../types/depthIdentity';
import { getDeepVeilLawDefinition, getVeilDistortionDefinition } from './depthIdentityCatalog';

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
  const levels = getLevelsPerDistrict();
  if (depth <= levels) return 1;
  if (depth <= levels * 2) return 2;
  return 3;
}

/** Local level within the active district (1–15). */
export function localLevelFromDepth(depth: number): number {
  const levels = getLevelsPerDistrict();
  const district = getDistrictFromDepth(depth);
  if (district === 1) return depth;
  if (district === 2) return depth - levels;
  return depth - levels * 2;
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
  return depth === getMaxRunGraphDepth();
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
  depthStageLabel: string;
  anchorStageLabel: string;
  pressureProfile: string;
  hazardSummary: string;
  tacticHint: string;
  operationTitle?: string;
  activeAnchorName?: string;
  /** Depth 2 Veil Distortion display name when active. */
  veilDistortionName?: string;
  veilDistortionSummary?: string;
  /** Depth 3 Deep Veil Law display name when active. */
  deepVeilLawName?: string;
  deepVeilLawSummary?: string;
  deepVeilLawIntensified?: boolean;
}

const UPCOMING_DISTRICT_INTEL: Record<DistrictId, Omit<DistrictIntelBrief, 'operationTitle' | 'activeAnchorName'>> = {
  1: {
    district: 1,
    districtName: DISTRICT_NAMES[1],
    depthStageLabel: 'Threshold',
    anchorStageLabel: 'Trace',
    pressureProfile: 'Light Veil signature — foreshadow only',
    hazardSummary: 'Baseline veil signatures. Standard patrol response.',
    tacticHint: 'Aegis shielding recommended for street-level breaches.',
  },
  2: {
    district: 2,
    districtName: DISTRICT_NAMES[2],
    depthStageLabel: 'Breach',
    anchorStageLabel: 'Breach',
    pressureProfile: 'Unstable reality bleed — anchor interference likely',
    hazardSummary: 'Advanced hostile tactics. Resonance scan gain elevated.',
    tacticHint: 'Expect anomaly distortion and first serious Echo residue.',
  },
  3: {
    district: 3,
    districtName: DISTRICT_NAMES[3],
    depthStageLabel: 'Deep Veil',
    anchorStageLabel: 'Core',
    pressureProfile: 'Critical anchor proximity — elite and Core vectors',
    hazardSummary: 'Elite hazards and prime boss vectors. Critical heat likely.',
    tacticHint: 'Anchor Core possible — counter modules before engaging elites.',
  },
};

/** Intel for the district the player is about to enter after unsealing the safehouse door. */
export function getUpcomingDistrictIntel(nextDistrict: DistrictId): DistrictIntelBrief {
  return { ...UPCOMING_DISTRICT_INTEL[nextDistrict] };
}

/** Merge run-level Veil Front context into district intel for mid-run safehouse readouts. */
export function buildDistrictIntelForRun(
  district: DistrictId,
  runContext?: RunGenerationContext | null,
  depthIdentity?: DepthIdentityState | null,
): DistrictIntelBrief {
  const base = getUpcomingDistrictIntel(district);
  let distortionName: string | undefined;
  let distortionSummary: string | undefined;
  let lawName: string | undefined;
  let lawSummary: string | undefined;
  let lawIntensified: boolean | undefined;

  if (depthIdentity?.activeVeilDistortion && district >= 2) {
    const def = getVeilDistortionDefinition(depthIdentity.activeVeilDistortion);
    distortionName = def.displayName;
    distortionSummary = def.effectSummary;
  }
  if (depthIdentity?.activeDeepVeilLaw && district >= 3) {
    const def = getDeepVeilLawDefinition(depthIdentity.activeDeepVeilLaw);
    lawName = def.displayName;
    lawSummary = def.effectSummary;
    lawIntensified = depthIdentity.intensifiedFromDistortion;
  }

  if (!runContext) {
    return {
      ...base,
      veilDistortionName: distortionName,
      veilDistortionSummary: distortionSummary,
      deepVeilLawName: lawName,
      deepVeilLawSummary: lawSummary,
      deepVeilLawIntensified: lawIntensified,
    };
  }

  return {
    ...base,
    operationTitle: runContext.activeOperation.title,
    activeAnchorName: runContext.activeAnchor?.displayName,
    veilDistortionName: distortionName,
    veilDistortionSummary: distortionSummary,
    deepVeilLawName: lawName,
    deepVeilLawSummary: lawSummary,
    deepVeilLawIntensified: lawIntensified,
  };
}
