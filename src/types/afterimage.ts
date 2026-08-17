import type { CoreImprintId } from './nineStrain';

export const AFTERIMAGE_CORE_IDS = {
  PHANTOM_IMPACT: 'AI_CORE_PHANTOM_IMPACT',
  LINGERING_INVOCATION: 'AI_CORE_LINGERING_INVOCATION',
  REFLEX_REMNANT: 'AI_CORE_REFLEX_REMNANT',
  RECURRENT_CHARGE: 'AI_CORE_RECURRENT_CHARGE',
} as const;

export const AFTERIMAGE_SUPPORT_IDS = {
  DEFERRED_EXPOSURE: 'AI_SUPPORT_DEFERRED_EXPOSURE',
  CROSSFADE: 'AI_SUPPORT_CROSSFADE',
} as const;

export const AFTERIMAGE_MANIFESTATION_ID = 'AI_MANIFESTATION_PERSISTENT_FORM';
export const AFTERIMAGE_VERDICT_ID = 'AI_VERDICT_SECOND_ENDING';

export type TraceProvenance =
  | 'CORE'
  | 'CROSSFADE_BONUS'
  | 'PERSISTENT_SECONDARY'
  | 'CONVERGENCE'
  | 'VERDICT';

export type TraceResolutionMode = 'TURN_START' | 'NEXT_COMMITTED_ACTION';

export type TracePayloadKind =
  | 'PER_TARGET_DAMAGE'
  | 'OCCULT_ACTION_BUDGET'
  | 'BARRIER'
  | 'RESERVE_RESTORE'
  | 'FLUX_RESTORE'
  | 'MATCHING_AMMO'
  | 'FLAT_OCCULT';

export type TraceStatus = 'PENDING' | 'READY' | 'RESOLVED' | 'EXPIRED' | 'FIZZLED';

export interface TraceDamagePortion {
  originalTargetId: string;
  assignedTargetId: string | null;
  nativeDirectDamage: number;
  kineticNativeDamage: number;
  occultNativeDamage: number;
  remainderAssigned: number;
  fizzled: boolean;
}

export interface ScheduledTrace {
  traceId: string;
  originDefinitionId: string;
  originImprint: CoreImprintId | 'VERDICT';
  provenance: TraceProvenance;
  originRootActionId: string | null;
  creationSequence: number;
  createdPlayerTurn: number;
  duePlayerTurn: number;
  resolutionMode: TraceResolutionMode;
  payloadKind: TracePayloadKind;
  basePayload: number;
  delayCount: number;
  powerMultiplier: number;
  targetAndDamageMap: TraceDamagePortion[];
  targetPattern: string;
  channelSplit: { kinetic: number; occult: number };
  ammoType: string | null;
  crossfadeEligible: boolean;
  persistentEligible: boolean;
  status: TraceStatus;
  delayedOriginLineage: readonly string[];
}

export interface AfterimageRuntimeState {
  playerTurnIndex: number;
  nextTraceSequence: number;
  pending: ScheduledTrace[];
  ordinaryQuotaUsed: Partial<Record<CoreImprintId, boolean>>;
  recurrentUsedThisPlayerTurn: boolean;
  crossfadeArmedImprint: CoreImprintId | null;
  crossfadeUsedThisPlayerTurn: boolean;
  playerTurnOpen: boolean;
  deferredChoicePending: boolean;
  capacity: { reserve: number; flux: number; ammo: number };
}

export interface TracePreview {
  created: boolean;
  provenance: TraceProvenance | null;
  payloadKind: TracePayloadKind | null;
  basePayload: number;
  delayedPayload: number;
  duePlayerTurn: number;
  perTarget: readonly TraceDamagePortion[];
  ammoType: string | null;
  crossfadeEligible: boolean;
  persistentEligible: boolean;
}

export interface DeferredExposureOption {
  traceId: string;
  originLabel: string;
  payloadKind: TracePayloadKind;
  originalDue: number;
  delayedDue: number;
  basePayload: number;
  delayedPayload: number;
  ammoType: string | null;
  targetSummary: string;
}
