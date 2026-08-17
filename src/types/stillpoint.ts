import type { CoreImprintId, InstinctGrade } from './nineStrain';

export const STILLPOINT_CORE_IDS = {
  STORED_FORCE: 'SP_CORE_STORED_FORCE',
  PATIENT_INVOCATION: 'SP_CORE_PATIENT_INVOCATION',
  QUIET_REFLEX: 'SP_CORE_QUIET_REFLEX',
  SILENT_RESERVOIR: 'SP_CORE_SILENT_RESERVOIR',
} as const;

export const STILLPOINT_SUPPORT_IDS = {
  SHELTERED_PAUSE: 'SP_SUPPORT_SHELTERED_PAUSE',
  RETURN_STROKE: 'SP_SUPPORT_RETURN_STROKE',
} as const;

export const STILLPOINT_MANIFESTATION_ID = 'SP_MANIFESTATION_MOTIONLESS_STORM';
export const STILLPOINT_VERDICT_ID = 'SP_VERDICT_ZERO_HOUR';

export const NATIVE_STILLNESS_CAP = 2;
export const MOTIONLESS_STORM_FOCUSED_CAP = 3;
export const SHELTERED_PAUSE_BARRIER = 8;
export const STORED_FORCE_DEPTH_CAPS = { 1: 12, 2: 18, 3: 24 } as const;

export type PlayerTurnEndReason =
  | 'VOLUNTARY'
  | 'FORCED'
  | 'STUN'
  | 'TIMEOUT'
  | 'DEFEAT'
  | 'INVALIDATION'
  | 'SCRIPT'
  | 'ENCOUNTER_COMPLETE'
  | 'UI_OPEN';

export type StillnessChargeSource = 'NATIVE' | 'FLEETING' | 'STORM_FREE' | 'STAYED_SENTENCE_FREE';

export type FleetingCreationPhase = 'PLAYER_TURN_INIT' | 'ENEMY_CYCLE' | 'PLAYER_CONTROL';

export interface FleetingStillnessRecord {
  sourceDefinitionId: string | null;
  createdCombatCycle: number;
  createdPlayerTurn: number;
  eligiblePlayerTurn: number;
  expiresAtPlayerTurnEnd: number;
  spent: boolean;
  creationPhase: FleetingCreationPhase;
  sourceRootId: string | null;
  sourceLineage: readonly string[];
}

export interface FocusedRootRecord {
  rootActionId: string;
  surfaces: readonly CoreImprintId[];
  chargeSource: StillnessChargeSource;
  consumed: boolean;
}

export interface ZeroHourPauseSnapshot {
  intentInstanceIds: readonly string[];
  targetEnemyCycle: number;
  applied: boolean;
}

export interface StillpointEndTurnRecord {
  reason: PlayerTurnEndReason;
  usableAp: number;
  gainedNative: boolean;
}

export interface StillpointRuntimeState {
  nativeStillness: number;
  fleeting: FleetingStillnessRecord | null;
  fleetingCreatedThisCombatCycle: boolean;
  combatCycleIndex: number;
  enemyCycleIndex: number;
  playerTurnIndex: number;
  playerTurnOpen: boolean;
  focusedRoot: FocusedRootRecord | null;
  pendingCurrentFocusRootId: string | null;
  stormActiveThisTurn: boolean;
  stormFreeFocusAvailable: boolean;
  stormFocusedCount: number;
  quietReflexSuccessUsedThisCombatCycle: boolean;
  silentReservoirUsedThisPlayerTurn: boolean;
  returnStrokeUsedThisPlayerTurn: boolean;
  queuedTurnStartApRefund: number;
  lastApRefund: number;
  lastBarrierGranted: number;
  lastCooldownAdvanced: boolean;
  lastPreserved: number;
  lastReloadBonus: number;
  lastCondensedImpact: number;
  lastQuietReflexGrade: InstinctGrade | null;
  zeroHourPause: ZeroHourPauseSnapshot | null;
  lastEndTurn: StillpointEndTurnRecord | null;
  lastSpendSource: StillnessChargeSource | null;
  lastFleetingProvenance: string | null;
  /** Hostile AP disable/removal during this player-turn window. */
  hostileApDisruptionThisPlayerTurn: boolean;
  stayedSentenceFreeFocus: boolean;
}

export interface UsableApInput {
  remainingAp: number;
  apDisabledByEnemy?: boolean;
  apRemovedByEnemy?: boolean;
  reservedAp?: number;
}

export interface CondensedImpactPacket {
  damage: number;
  kinetic: number;
  occult: number;
  targetId: string;
  fizzled: boolean;
}
