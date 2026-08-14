import type { EnemyIntentSeverity } from './enemyIntentMeta';

export type CombatDepthBand = 1 | 2 | 3;

export type ReversalReleaseReason =
  | 'RESOLVED'
  | 'PLAYER_PREVENTED'
  | 'ENEMY_REMOVED';

export type CounterfateActionSurface =
  | 'WEAPON'
  | 'BASIC'
  | 'TECHNIQUE'
  | 'FLEX'
  | 'INSTINCT'
  | 'ULTIMATE';

export interface HostileIntentSnapshot {
  intentInstanceId: string;
  unitId: string;
  intentKind: string;
  severity: EnemyIntentSeverity;
  countdown: number;
  hostileTurnOrder: number;
  positionRank: number;
  concealed: boolean;
  hp: number;
  maxHp: number;
  alive: boolean;
  protectedPhase?: boolean;
  authoredCounter?: boolean;
  designation?: string;
}

export interface ReversalStoreResult {
  attempted: number;
  accepted: number;
  wastedOverCap: number;
  rawAfter: number;
}

export interface ReversalReleaseResult {
  reason: ReversalReleaseReason;
  multiplier: number;
  raw: number;
  packet: number;
  targetInstanceId: string | null;
  targetUnitId: string | null;
  lineage: readonly string[];
  countered: boolean;
  interruptProgress: number;
  supplementalPacket: number;
}

export interface ChosenFatePreview {
  eligible: boolean;
  currentRaw: number;
  transferred: number;
  lost: number;
  cappedTransferred: number;
  rejection: string | null;
}

export interface FinalRevisionCapture {
  rootActionId: string;
  instanceId: string;
  unitId: string;
  raw: number;
  consumed: boolean;
}

export interface IntentGenerationRecord {
  intentKind: string;
  generation: number;
  retired?: boolean;
}

export interface CounterfateRuntimeState {
  combatDepth: CombatDepthBand;
  fateboundInstanceId: string | null;
  fateboundUnitId: string | null;
  concealed: boolean;
  rawReversal: number;
  depthCap: number;
  chosenFateUsedThisTurn: boolean;
  noFutureJumpsThisEnemyCycle: number;
  preemptiveConsumedInstanceId: string | null;
  finalRevisionCapture: FinalRevisionCapture | null;
  lastRelease: ReversalReleaseResult | null;
  refusalUsedThisTurn: boolean;
  borrowedEndingRootId: string | null;
  borrowedEndingAmount: number;
  borrowedEndingMajor: boolean;
  secondReflexUsedThisCombatCycle: boolean;
  intentGenerationByUnit: Record<string, IntentGenerationRecord>;
}

export const COUNTERFATE_CORE_IDS = {
  SEVERED_OUTCOME: 'CF_CORE_SEVERED_OUTCOME',
  REFUSAL_PATTERN: 'CF_CORE_REFUSAL_PATTERN',
  SECOND_REFLEX: 'CF_CORE_SECOND_REFLEX',
  BORROWED_ENDING: 'CF_CORE_BORROWED_ENDING',
} as const;

export const COUNTERFATE_SUPPORT_IDS = {
  CHOSEN_FATE: 'CF_SUPPORT_CHOSEN_FATE',
  PREEMPTIVE_RUPTURE: 'CF_SUPPORT_PREEMPTIVE_RUPTURE',
} as const;

export const COUNTERFATE_MANIFESTATION_ID = 'CF_MANIFESTATION_NO_FUTURE';
export const COUNTERFATE_VERDICT_ID = 'CF_VERDICT_FINAL_REVISION';
