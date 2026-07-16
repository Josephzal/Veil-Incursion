/**
 * Combat Refactor Phase 5 — Combat Director types.
 */

export type CombatDirectorSeverity = 'OK' | 'WARNING' | 'ERROR';

export type EncounterPressureLabel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type CombatDirectorIssueCategory =
  | 'OVERLOADED_PRESSURE'
  | 'MECHANIC_DENSITY'
  | 'HARD_COUNTER_STACK'
  | 'CLASS_FAIRNESS'
  | 'EARLY_DEPTH_SAFETY'
  | 'REWARD_MISMATCH'
  | 'PACING'
  | 'READABILITY'
  | 'INVALID_CONTEXT';

export interface CombatDirectorIssue {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  category: CombatDirectorIssueCategory;
  message: string;
  suggestedFix?: string;
}

export interface CombatDirectorAdjustment {
  id: string;
  reason: string;
  before?: unknown;
  after?: unknown;
  applied: boolean;
}

export interface EncounterPressureScore {
  total: number;
  damagePressure: number;
  hpPressure: number;
  enemyCountPressure: number;
  elitePressure: number;
  armorPressure: number;
  wardPressure: number;
  fracturePressure: number;
  intentPressure: number;
  criticalIntentPressure: number;
  objectivePressure: number;
  timelinePressure: number;
  cargoPressure: number;
  extractionPressure: number;
  echoPressure: number;
  anchorPressure: number;
  rivalPressure: number;
  unstablePressure: number;
  complexityPressure: number;
  rewardScore: number;
  label: EncounterPressureLabel;
}

export type HardCounterKind =
  | 'ARMOR'
  | 'WARD'
  | 'ABILITY_DISABLE'
  | 'RESOURCE_DENIAL'
  | 'HEALING_REDUCTION'
  | 'TRUE_DAMAGE'
  | 'DOT'
  | 'HEAVY_DEBUFF'
  | 'EVASION_PHASE'
  | 'GUARD_INTERCEPT'
  | 'SUMMON'
  | 'CARGO_ATTACK'
  | 'FORCED_TIMER'
  | 'CRITICAL_LOCK_ON'
  | 'MAJOR_CHANNEL';

export interface MechanicDensitySnapshot {
  layeredEnemyCount: number;
  bothArmorAndWardCount: number;
  highIntentCount: number;
  criticalIntentCount: number;
  objectiveCount: number;
  timelineEventCount: number;
  hardCounterKinds: HardCounterKind[];
  hardCounterCount: number;
  hasCargoThreat: boolean;
  hasExtractionThreat: boolean;
  hasEliteModifier: boolean;
  hasEcho: boolean;
  hasAnchor: boolean;
}

export interface CombatRewardRiskResult {
  pressureLabel: EncounterPressureLabel;
  rewardMultiplier: number;
  rareLootBonusPct: number;
  creditsBonusPct: number;
  debriefCallout: string | null;
  allowedInContext: boolean;
}

export interface CombatDirectorContext {
  runId?: string;
  sectorId?: string;
  depth: 1 | 2 | 3;
  nodeIndex?: number;
  nodesCleared?: number;

  playerClassId: string;
  playerMaxHp: number;
  playerCurrentHp: number;

  enemies: import('./run').EnemyCombatProfile[];

  encounterKind?: string;
  isEliteEncounter?: boolean;
  isBossEncounter?: boolean;
  isDirtyExtraction?: boolean;
  isEcho?: boolean;
  isAnchor?: boolean;
  isHighRiskNode?: boolean;

  hasObjective?: boolean;
  objectiveKind?: string | null;
  survivalTurnsRequired?: number;

  hasUnstableCargo?: boolean;
  hasHighValueCargo?: boolean;

  eliteModifier?: string | null;
  crisisTheme?: string | null;
}

/** Lightweight metadata stamped on EnvironmentalModifiers for combat + rewards. */
export interface CombatDirectorMeta {
  pressureTotal: number;
  pressureLabel: EncounterPressureLabel;
  rewardMultiplier: number;
  rareLootBonusPct: number;
  creditsBonusPct: number;
  debriefCallout: string | null;
  adjustmentsApplied: number;
  issueCount: number;
  severity: CombatDirectorSeverity;
  debugSummary: string;
}

export interface CombatDirectorResult {
  ok: boolean;
  severity: CombatDirectorSeverity;
  pressureScore: EncounterPressureScore;
  density: MechanicDensitySnapshot;
  issues: CombatDirectorIssue[];
  appliedAdjustments: CombatDirectorAdjustment[];
  rewardRiskAdjustment: CombatRewardRiskResult;
  /** Mutated enemy squad after safety caps (same refs if unchanged). */
  enemies: import('./run').EnemyCombatProfile[];
  /** Optional survival timer lengthen. */
  survivalTurnsRequired?: number;
  /** Incoming damage mitigation added by safety. */
  incomingDamageMitigationPct?: number;
  debugSummary: string;
  meta: CombatDirectorMeta;
}

export const EMPTY_ENCOUNTER_PRESSURE_SCORE: EncounterPressureScore = {
  total: 0,
  damagePressure: 0,
  hpPressure: 0,
  enemyCountPressure: 0,
  elitePressure: 0,
  armorPressure: 0,
  wardPressure: 0,
  fracturePressure: 0,
  intentPressure: 0,
  criticalIntentPressure: 0,
  objectivePressure: 0,
  timelinePressure: 0,
  cargoPressure: 0,
  extractionPressure: 0,
  echoPressure: 0,
  anchorPressure: 0,
  rivalPressure: 0,
  unstablePressure: 0,
  complexityPressure: 0,
  rewardScore: 50,
  label: 'LOW',
};
