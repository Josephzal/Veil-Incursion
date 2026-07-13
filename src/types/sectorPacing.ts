/** Player-facing node when choosing next vector = nodesCleared + 1. */

export type SectorZoneId = 'OUTSKIRTS' | 'DEEP_TRANSIT' | 'BREACH_PERIMETER' | 'INNER_SANCTUM' | 'COLLAPSE';

export type SafeAnchorIndex = 1 | 2 | 3;

/** Levels per district chapter — config-driven via runPacingConfig (default 15). */
export { getNodesPerDistrict as getLevelsPerDistrict } from '../data/runIntegration/runPacingConfig';
export {
  getMaxRunGraphDepth,
  getDistrictGateDepths,
  getSafeAnchorGraphDepths,
  getNodesPerDistrict,
  setNodesPerDistrictForTesting,
  resetNodesPerDistrictForTesting,
} from '../data/runIntegration/runPacingConfig';

import { getNodesPerDistrict, getMaxRunGraphDepth, getDistrictGateDepths, getSafeAnchorGraphDepths } from '../data/runIntegration/runPacingConfig';

/** @deprecated Prefer getLevelsPerDistrict() — kept for legacy imports; reflects default at module load. */
export const LEVELS_PER_DISTRICT = 15;

export const MAX_RUN_GRAPH_DEPTH = getMaxRunGraphDepth();

export const SAFE_ANCHOR_GRAPH_DEPTHS = getSafeAnchorGraphDepths();

export const BOSS_GRAPH_DEPTH = getMaxRunGraphDepth();

export const DISTRICT_GATE_DEPTHS = getDistrictGateDepths();

/** Max scanner vectors per hub — L7 open grid allows 4. */
export const SCANNER_MAX_VECTORS = 4;

/** Emergency recall available mid-first-district through late second district. */
export const EMERGENCY_RECALL_MIN_CLEARED = 4;
export const EMERGENCY_RECALL_MAX_CLEARED = 28;

export const ZONE_RESONANCE_BASE: Record<SectorZoneId, number> = {
  OUTSKIRTS: 3,
  DEEP_TRANSIT: 5,
  BREACH_PERIMETER: 7,
  INNER_SANCTUM: 8,
  COLLAPSE: 8,
};

export const HARVEST_RESONANCE_SPIKE_COMMON = 3;
export const HARVEST_RESONANCE_SPIKE_RARE = 8;

export const VOLATILE_CARGO_RESONANCE_PER_ITEM = 1.5;

export const NARRATIVE_RESONANCE_SPIKE = 20;
export const NARRATIVE_RESONANCE_PURGE = -25;

/** Emergency recall cargo value bleed on successful Defend-the-Rift extract. */
export const EMERGENCY_EXTRACT_CARGO_BLEED_PCT = 20;

/** Enemy turn cycles the operative must survive during Defend-the-Rift. */
export const DEFEND_RIFT_SURVIVAL_TURNS = 3;

/** Resonance soft-cap removed once pocket dimension collapse is active. */
export const COLLAPSE_RESONANCE_SOFT_CAP = 200;

/** Master extraction link payout multiplier (on top of prime bonus). */
export const MASTER_EXTRACTION_PAYOUT_MULTIPLIER = 2;
