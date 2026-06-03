import type { IncursionBiome } from './game';

/** Macro-story run format — rolled once at incursion initialization. */
export type MacroStoryRunMode = 'STANDALONE' | 'CONTINUOUS_THREAD' | 'FACTION_OVERLAY';

/** Outcome delta stored as a unit fraction (e.g. 0.05 = +5%). Clamped to ±0.10. */
export const OUTCOME_MODIFIER_MIN = -0.1;
export const OUTCOME_MODIFIER_MAX = 0.1;

export interface OutcomeModifierMetric {
  key: string;
  /** Securely bounded modifier in [-0.10, +0.10]. */
  value: number;
  appliedAtDepth?: number;
}

export interface MacroStoryRunConfiguration {
  runMode: MacroStoryRunMode;
  /** Present for CONTINUOUS_THREAD and FACTION_OVERLAY profiles. */
  macroStoryId: string | null;
}

export interface SectorBlockSpec {
  depthStart: number;
  depthEnd: number;
  biome: IncursionBiome;
  label: string;
}

export function createDefaultMacroStoryConfiguration(): MacroStoryRunConfiguration {
  return { runMode: 'STANDALONE', macroStoryId: null };
}
