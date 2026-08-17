export const FAULTLINE_CORE_IDS = {
  STRESS_PATTERN: 'FL_CORE_STRESS_PATTERN',
  APPLIED_FRACTURE: 'FL_CORE_APPLIED_FRACTURE',
  COUNTERPRESSURE: 'FL_CORE_COUNTERPRESSURE',
  LOAD_LIMIT: 'FL_CORE_LOAD_LIMIT',
} as const;

export const FAULTLINE_SUPPORT_IDS = {
  HAIRLINE_CASCADE: 'FL_SUPPORT_HAIRLINE_CASCADE',
  RESIDUAL_STRESS: 'FL_SUPPORT_RESIDUAL_STRESS',
} as const;

export const FAULTLINE_MANIFESTATION_ID = 'FL_MANIFESTATION_CHAIN_FAILURE';
export const FAULTLINE_VERDICT_ID = 'FL_VERDICT_TERMINAL_FAILURE';

export const FAULT_MAX_STORED = 3;
export const FAULT_RUPTURE_THRESHOLD = 4;

export const UNARMORED_RUPTURE_DAMAGE = {
  1: 12,
  2: 18,
  3: 24,
} as const;

export type FaultOriginKind =
  | 'CORE'
  | 'HAIRLINE'
  | 'CHAIN'
  | 'RESIDUAL'
  | 'VERDICT'
  | 'CONVERGENCE';

export type RuptureClass =
  | 'NORMAL'
  | 'TRANSFERRED'
  | 'BONUS'
  | 'VERDICT'
  | 'CONVERGENCE';

export type RuptureRoute = 'KINETIC_ARMOR' | 'OCCULT_WARD' | 'UNARMORED';

export type FaultlineFizzleReason =
  | 'PROTECTED_PHASE'
  | 'INVULNERABLE'
  | 'NO_LEGAL_TARGET'
  | 'NO_DAMAGE_OR_PRESSURE';

export interface FaultAdditionRecord {
  rootActionId: string;
  sourceEventId: string;
  targetId: string;
  amountBefore: number;
  amountApplied: number;
  amountAfter: number;
  origin: FaultOriginKind;
  sourceDefinitionId: string;
  ruptured: boolean;
  procDepth: number;
}

export interface RuptureResult {
  rootActionId: string;
  sourceEventId: string;
  targetId: string;
  amountBefore: number;
  amountApplied: number;
  amountAfter: number;
  origin: FaultOriginKind;
  classification: RuptureClass;
  route: RuptureRoute | null;
  stacksRemoved: number;
  fullBreak: boolean;
  appliedFracture: boolean;
  damage: number;
  killed: boolean;
  countered: boolean;
  objectivePressure: boolean;
  fizzleReason: FaultlineFizzleReason | null;
  playerFacingLog: string;
  procDepth: number;
  sourceDefinitionId: string;
}

export interface FaultlinePreviewDelta {
  targetId: string;
  faultBefore: number;
  faultAfter: number;
  ruptures: boolean;
  route: RuptureRoute | null;
  residual: boolean;
  unarmoredDamage: number;
}

export interface FaultlineRuntimeState {
  faultByUnitId: Record<string, number>;
  phaseSuccessorByUnitId: Record<string, string>;
  playerTurnIndex: number;
  combatCycleIndex: number;
  stressPatternUsedThisPlayerTurn: boolean;
  appliedFractureUsedThisPlayerTurn: boolean;
  counterpressureSuccessUsedThisCombatCycle: boolean;
  loadLimitUsedThisPlayerTurn: boolean;
  hairlineUsedThisPlayerTurn: boolean;
  chainUsedThisPlayerTurn: boolean;
  chainBonusRuptureRootId: string | null;
  normalRuptureTargetsThisRoot: readonly string[];
  activeRootId: string | null;
  terminalRootId: string | null;
  lastAdditions: readonly FaultAdditionRecord[];
  lastRuptures: readonly RuptureResult[];
  lastLog: string | null;
}

export const FAULTLINE_IDS = [
  FAULTLINE_CORE_IDS.STRESS_PATTERN,
  FAULTLINE_CORE_IDS.APPLIED_FRACTURE,
  FAULTLINE_CORE_IDS.COUNTERPRESSURE,
  FAULTLINE_CORE_IDS.LOAD_LIMIT,
  FAULTLINE_SUPPORT_IDS.HAIRLINE_CASCADE,
  FAULTLINE_SUPPORT_IDS.RESIDUAL_STRESS,
  FAULTLINE_MANIFESTATION_ID,
  FAULTLINE_VERDICT_ID,
] as const;
