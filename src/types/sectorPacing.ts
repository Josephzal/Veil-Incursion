/** Player-facing node when choosing next vector = nodesCleared + 1. */

export type SectorZoneId = 'OUTSKIRTS' | 'DEEP_TRANSIT' | 'BREACH_PERIMETER' | 'INNER_SANCTUM' | 'COLLAPSE';

export type SafeAnchorIndex = 1 | 2 | 3;

export const SAFE_ANCHOR_GRAPH_DEPTHS: readonly [5, 10, 15] = [5, 10, 15];
export const BOSS_GRAPH_DEPTH = 30;
/** District gate boss encounters at depths 10, 20, and 30. */
export const DISTRICT_GATE_DEPTHS: readonly [10, 20, 30] = [10, 20, 30];

/** Max scanner vectors per hub (graph children + optional anchor). */
export const SCANNER_MAX_VECTORS = 3;

/** Emergency recall available while choosing nodes 5–15 (nodesCleared 4–14). */
export const EMERGENCY_RECALL_MIN_CLEARED = 4;
export const EMERGENCY_RECALL_MAX_CLEARED = 14;

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
