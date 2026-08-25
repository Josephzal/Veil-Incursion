export const SHARDSKIN_CORE_IDS = {
  CRYSTAL_EDGE: 'SS_CORE_CRYSTAL_EDGE',
  RITUAL_PANE: 'SS_CORE_RITUAL_PANE',
  PERFECT_FACET: 'SS_CORE_PERFECT_FACET',
  PRESSURE_CRYSTAL: 'SS_CORE_PRESSURE_CRYSTAL',
} as const;

export const SHARDSKIN_SUPPORT_IDS = {
  TEMPERED_REMNANT: 'SS_SUPPORT_TEMPERED_REMNANT',
  SCATTERGLASS: 'SS_SUPPORT_SCATTERGLASS',
} as const;

export const SHARDSKIN_MANIFESTATION_ID = 'SS_MANIFESTATION_ENDLESS_FACET';
export const SHARDSKIN_VERDICT_ID = 'SS_VERDICT_CATHEDRAL_BREAK';

export const SHARDSKIN_IDS = [
  SHARDSKIN_CORE_IDS.CRYSTAL_EDGE,
  SHARDSKIN_CORE_IDS.RITUAL_PANE,
  SHARDSKIN_CORE_IDS.PERFECT_FACET,
  SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL,
  SHARDSKIN_SUPPORT_IDS.TEMPERED_REMNANT,
  SHARDSKIN_SUPPORT_IDS.SCATTERGLASS,
  SHARDSKIN_MANIFESTATION_ID,
  SHARDSKIN_VERDICT_ID,
] as const;

/** Shards/Edge cap by combat depth. Centralized provisional value. */
export const SHARDSKIN_RESOURCE_CAP = {
  1: 12,
  2: 18,
  3: 24,
} as const;

export const CRYSTAL_EDGE_PER_ROOT_CAP = 8;
export const CRYSTAL_EDGE_RATIO = 0.2;

export const RITUAL_PANE_PER_ROOT_CAP = 9;
export const RITUAL_PANE_BASE = 3;
export const RITUAL_PANE_PER_AP = 2;

export const PERFECT_FACET_SHARDS = {
  STANDARD: 4,
  CLEAN: 7,
  PERFECT: 10,
} as const;

export const PRESSURE_CRYSTAL_SHARDS = {
  ORDINARY: 4,
  MAJOR: 8,
} as const;

export const TEMPERED_REMNANT_RETURN_CAP = 8;
export const TEMPERED_REMNANT_RATIO = 0.5;

export const SCATTERGLASS_RATIO = 0.5;

export const ENDLESS_FACET_RATIO = 0.5;

export const CATHEDRAL_BREAK_BUDGET_MULTIPLIER = 1.5;
export const CATHEDRAL_BREAK_POST_GAIN = 10;

/** Ledger of the most recent damage events resolved through Shard prevention, capped for memory. */
export const SHARDSKIN_DAMAGE_LEDGER_CAP = 64;

export interface ShardskinDamageEventRecord {
  eventId: string;
  incoming: number;
  shardsSpent: number;
  hpDamage: number;
}

export interface ShardskinGenerationRecord {
  source: string;
  amount: number;
}

export interface ShardskinConversionRecord {
  remainingShardsBefore: number;
  remnantReturn: number;
  edgeSet: number;
}

export interface ShardskinEdgeConsumptionRecord {
  rootActionId: string | null;
  consumedEdge: number;
  primaryTargetId: string | null;
  fizzled: boolean;
}

export interface ShardskinSpreadRecord {
  rootActionId: string | null;
  targetId: string;
  amount: number;
}

export interface ShardskinVerdictPacketRecord {
  targetId: string;
  amount: number;
  fizzled: boolean;
}

export interface ShardskinVerdictRecord {
  rootActionId: string | null;
  consumedShards: number;
  consumedEdge: number;
  budget: number;
  packets: readonly ShardskinVerdictPacketRecord[];
  gained: number;
}

export interface ShardskinCathedralPending {
  rootActionId: string;
  lockedTargetIds: readonly string[];
  consumedShards: number;
  consumedEdge: number;
}

export interface ShardskinRuntimeState {
  currentShards: number;
  currentEdge: number;
  /** Shards actually consumed preventing damage since the last player-turn conversion. */
  shardsSpentPreventingDamage: number;
  /** Last computed Tempered Remnant return — telemetry/HUD only, already folded into currentEdge. */
  pendingTemperedRemnantReturn: number;
  playerTurnIndex: number;
  combatCycleIndex: number;
  crystalEdgeUsedThisPlayerTurn: boolean;
  ritualPaneUsedThisPlayerTurn: boolean;
  perfectFacetUsedThisCombatCycle: boolean;
  pressureCrystalUsedThisPlayerTurn: boolean;
  endlessFacetUsedThisPlayerTurn: boolean;
  /** UI toggle — Cathedral Break selected for the currently staged/open ultimate. */
  cathedralBreakSelected: boolean;
  pendingCathedralBreak: ShardskinCathedralPending | null;
  recentDamageEvents: readonly ShardskinDamageEventRecord[];
  lastGeneration: ShardskinGenerationRecord | null;
  lastPrevention: ShardskinDamageEventRecord | null;
  lastConversion: ShardskinConversionRecord | null;
  lastEdgeConsumption: ShardskinEdgeConsumptionRecord | null;
  lastSpread: ShardskinSpreadRecord | null;
  lastVerdict: ShardskinVerdictRecord | null;
  lastLog: string | null;
}

export interface ShardskinPresentation {
  active: boolean;
  currentShards: number;
  shardCap: number;
  currentEdge: number;
  edgeCap: number;
  pendingTemperedRemnantReturn: number;
  cathedralBreakSelected: boolean;
  lastLog: string | null;
}
