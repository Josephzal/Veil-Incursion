/**
 * Economy Spine Phase 2K — live economy event telemetry.
 * Complements offline sims (2H): answers what actually happened in runs.
 */

export interface EconomyRunTelemetry {
  /** Loot offered into containment / harvest staging (before pack decision). */
  resourcesGenerated: number;
  /** Loot abandoned at packing / leave-behind confirm. */
  resourcesLeftBehind: number;
  /** REPLACE actions (jettison occupant to place another). */
  cargoSwaps: number;
  /** Manual jettison / discard from cargo. */
  cargoJettisons: number;
  /** Grid occupancy samples (0–1) taken at pack/swap/advance. */
  cargoOccupancySamples: number[];
  /** Nodes advanced while carrying ≥1 unstable/contraband stack. */
  nodesWithUnstableCargo: number;
  /** Wall-clock start when unstable first entered cargo this run. */
  unstableCarryStartedAtMs: number | null;
  /** Accumulated ms carrying unstable (finalized at extract/death). */
  unstableCarryMs: number;
  /** Count of recipes that became craftable at debrief. */
  recipesNewlyCraftable: number;
}

/** Hub / career aggregates across runs (craft + fence live outside the run). */
export interface CareerEconomyTelemetry {
  resourcesCraftSpent: number;
  craftActions: number;
  resourcesFenced: number;
  fenceActions: number;
  fenceCreditsEarned: number;
  contractsCompleted: number;
  recipesNewlyCraftable: number;
  runsSampled: number;
  /** Last finalized run one-liner for DevTest. */
  lastRunSummary: string | null;
}

export function createDefaultEconomyRunTelemetry(): EconomyRunTelemetry {
  return {
    resourcesGenerated: 0,
    resourcesLeftBehind: 0,
    cargoSwaps: 0,
    cargoJettisons: 0,
    cargoOccupancySamples: [],
    nodesWithUnstableCargo: 0,
    unstableCarryStartedAtMs: null,
    unstableCarryMs: 0,
    recipesNewlyCraftable: 0,
  };
}

export function createDefaultCareerEconomyTelemetry(): CareerEconomyTelemetry {
  return {
    resourcesCraftSpent: 0,
    craftActions: 0,
    resourcesFenced: 0,
    fenceActions: 0,
    fenceCreditsEarned: 0,
    contractsCompleted: 0,
    recipesNewlyCraftable: 0,
    runsSampled: 0,
    lastRunSummary: null,
  };
}
