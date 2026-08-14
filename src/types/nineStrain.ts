import type { CanonicalWeaponFamilyId } from '../data/weaponFamilyIdNormalize';

/** Live Strain identities. Display names are presentation-only. */
export type StrainId =
  | 'COUNTERFATE'
  | 'RITUAL_CADENCE'
  | 'AFTERIMAGE'
  | 'STILLPOINT'
  | 'WOUNDWEAVE'
  | 'FAULTLINE'
  | 'SOULWAKE'
  | 'GRAVEMARK'
  | 'SHARDSKIN';

export type NineStrainClassId = 'AEGIS' | 'HEX_SHOT' | 'ENVOY';

export type CoreImprintId = 'ARMAMENT' | 'DISCIPLINE' | 'INSTINCT' | 'CURRENT';

export type UniversalBoonRole =
  | 'CORE'
  | 'SUPPORT'
  | 'MANIFESTATION'
  | 'VERDICT'
  | 'CONVERGENCE';

export type TriggerGranularity =
  | 'ONCE_PER_ROOT_ACTION'
  | 'ONCE_PER_TARGET_PER_ROOT_ACTION'
  | 'PER_NATIVE_DIRECT_HIT'
  | 'ONCE_PER_PLAYER_TURN'
  | 'ONCE_PER_ENEMY_CYCLE'
  | 'ONCE_PER_COMBAT_CYCLE'
  | 'ONCE_PER_ENCOUNTER'
  | 'THRESHOLD_TRANSITION';

export type NormalizedBoonEventType =
  | 'PLAYER_TURN_STARTED'
  | 'PLAYER_TURN_ENDED'
  | 'ENEMY_CYCLE_STARTED'
  | 'ENEMY_CYCLE_ENDED'
  | 'ROOT_ACTION_COMMITTED'
  | 'ROOT_ACTION_RESOLVED'
  | 'ROOT_ACTION_CANCELED'
  | 'ROOT_ACTION_INVALIDATED'
  | 'NATIVE_DIRECT_HIT'
  | 'PER_TARGET_RESULT'
  | 'INSTINCT_COMMITTED'
  | 'INSTINCT_FAILED'
  | 'INSTINCT_RESOLVED'
  | 'CURRENT_GAINED'
  | 'CURRENT_SPENT'
  | 'CURRENT_PRESERVED'
  | 'CURRENT_CONVERTED'
  | 'CURRENT_EMPTIED'
  | 'CURRENT_THRESHOLD_ENTERED'
  | 'CURRENT_CYCLE_COMPLETED'
  | 'ENEMY_INTENT_REVEALED'
  | 'ENEMY_INTENT_SELECTED'
  | 'ENEMY_INTENT_COUNTERED'
  | 'ENEMY_INTENT_INTERRUPTED'
  | 'ENEMY_INTENT_CHANGED'
  | 'ENEMY_INTENT_RESOLVED'
  | 'ENEMY_INTENT_REMOVED'
  | 'KINETIC_ARMOR_DAMAGED'
  | 'KINETIC_ARMOR_STRIPPED'
  | 'KINETIC_ARMOR_BROKEN'
  | 'KINETIC_ARMOR_RESTORED'
  | 'OCCULT_WARD_DAMAGED'
  | 'OCCULT_WARD_STRIPPED'
  | 'OCCULT_WARD_BROKEN'
  | 'OCCULT_WARD_RESTORED'
  | 'POSITION_CHANGED'
  | 'LANE_CHANGED'
  | 'POLARITY_CHANGED'
  | 'UNMOORED_CHANGED'
  | 'DISPLACEMENT_CHANGED'
  | 'HP_LOSS_VOLUNTARY'
  | 'HP_LOSS_HOSTILE'
  | 'ULTIMATE_OPENED'
  | 'ULTIMATE_CANCELED'
  | 'ULTIMATE_COMMITTED'
  | 'ULTIMATE_RESOLVED'
  | 'OBJECTIVE_PROGRESS'
  | 'PROTECTED_PHASE_THRESHOLD'
  | 'DERIVATIVE_RESOLVED';

export type InstinctGrade = 'FAILED' | 'STANDARD' | 'CLEAN' | 'PERFECT';

export type CurrentSignalKind = 'ORDINARY' | 'MAJOR';

export type CurrentChangeKind =
  | 'GAINED'
  | 'SPENT'
  | 'PRESERVED'
  | 'CONVERTED'
  | 'EMPTIED'
  | 'THRESHOLD_ENTERED'
  | 'CYCLE_COMPLETED';

export type ActionSourceKind = 'PLAYER_ACTION' | 'INSTINCT' | 'ULTIMATE';

export type EffectPrimitiveKind =
  | 'RECORD_METRIC'
  | 'QUEUE_PENDING'
  | 'DERIVATIVE_DAMAGE'
  | 'CAP_SELF_BENEFIT_ONCE'
  | 'STORE_REVERSAL_NATIVE_SOURCE'
  | 'STORE_REVERSAL_DISCIPLINE_AP'
  | 'STORE_REVERSAL_INSTINCT_GRADE'
  | 'STORE_REVERSAL_CURRENT_SIGNAL'
  | 'CHOSEN_FATE_REBIND'
  | 'PREEMPTIVE_RUPTURE'
  | 'NO_FUTURE_CHAIN'
  | 'FINAL_REVISION'
  | 'MEASURE_ARMAMENT_FINALE'
  | 'MEASURE_DISCIPLINE_FINALE'
  | 'MEASURE_INSTINCT'
  | 'MEASURE_HELD_RESONANCE'
  | 'IMPROVISED_MEASURE'
  | 'DOWNBEAT'
  | 'UNBROKEN_RITE'
  | 'GRAND_CADENCE';

export interface EffectPrimitive {
  kind: EffectPrimitiveKind;
  metricKey?: string;
  pendingId?: string;
  derivativeDamage?: number;
  selfBenefitCap?: number;
}

export interface UniversalBoonPrerequisites {
  parentCoreIds?: readonly string[];
  parentStrainIds?: readonly StrainId[];
  minDepth?: number;
  producerRoles?: readonly UniversalBoonRole[];
  minOwnedFromStrain?: number;
  requireCorePlusExtraFromStrain?: boolean;
}

export interface UniversalBoonDefinition {
  id: string;
  displayName: string;
  strainId: StrainId;
  secondaryStrainId?: StrainId;
  role: UniversalBoonRole;
  imprint?: CoreImprintId;
  prerequisites: UniversalBoonPrerequisites;
  exclusions: readonly string[];
  triggerGranularity: TriggerGranularity;
  eventSubscriptions: readonly NormalizedBoonEventType[];
  effectPrimitives: readonly EffectPrimitive[];
  adapterNeeds: readonly ('INSTINCT' | 'CURRENT' | 'GRAFT_TAGS')[];
  procGuards: {
    maxNativeHits?: number;
    blockSelfRecursion: boolean;
  };
  bossTranslation: 'NONE' | 'BOUNDED';
  previewModel: 'OWNERSHIP' | 'COMBAT_DELTA';
  persistenceSchema: string;
  refinementHooks: readonly string[];
  playerFacingSummary: string;
  /** Test-only definitions never enter live offers. */
  testOnly?: boolean;
}

export interface ContactedStrainRecord {
  strainId: StrainId;
  order: number;
  exceptional?: boolean;
}

export interface ExceptionalStrainOverride {
  sourceId: string;
  strainId: StrainId;
}

export interface OverwriteHistoryEntry {
  imprint: CoreImprintId;
  outgoingId: string;
  incomingId: string;
  preservedDependents: readonly string[];
  transmutedDependents: readonly string[];
}

export interface PendingQueuedEffect {
  id: string;
  definitionId: string;
  createdOrder: number;
  kind: 'TRACE' | 'OTHER';
}

export interface TriggerGuardState {
  perRootAction: Record<string, readonly string[]>;
  perTargetPerRoot: Record<string, readonly string[]>;
  perNativeHit: Record<string, number>;
  perPlayerTurn: readonly string[];
  perEnemyCycle: readonly string[];
  perCombatCycle: readonly string[];
  perEncounter: readonly string[];
  instinctPositiveUsedThisCombatCycle: boolean;
}

export type BoonSystemMode = 'LEGACY_CLASS_CATALOG' | 'NINE_STRAIN';

export interface NineStrainRuntimeState {
  schemaVersion: number;
  boonSystemMode: BoonSystemMode;
  /** Visible conflict when a save owns both systems. Never auto-resolved. */
  boonSystemConflict: string | null;
  contactedStrains: ContactedStrainRecord[];
  exceptionalOverride: ExceptionalStrainOverride | null;
  cores: Record<CoreImprintId, string | null>;
  supports: string[];
  manifestations: string[];
  convergences: string[];
  boundVerdict: string | null;
  overwriteHistory: OverwriteHistoryEntry[];
  definitionOwnedState: Record<string, Record<string, number | string | boolean>>;
  pendingEffects: PendingQueuedEffect[];
  triggerGuards: TriggerGuardState;
  metrics: Record<string, number>;
  orderingSeed: number;
  nextPendingOrder: number;
  counterfate: import('./counterfate').CounterfateRuntimeState;
  ritualCadence: import('./ritualCadence').RitualCadenceRuntimeState;
}

export interface TargetNativeResult {
  targetId: string;
  hits: number;
  misses: number;
  crits: number;
  nativeDirectDamage: number;
  defenseDamage: number;
  defenseBreaks: number;
  fractures: number;
  statusesApplied: number;
  killed: boolean;
  healingDealt: number;
  movement: number;
  kineticNativeDamage?: number;
  occultNativeDamage?: number;
  kineticArmorBroken?: boolean;
  occultWardBroken?: boolean;
}

export interface RootActionResourceDelta {
  gained: number;
  spent: number;
  preserved: number;
  converted: number;
}

export interface CanonicalRootActionContext {
  actionId: string;
  sourceKind: ActionSourceKind;
  finalMechanicalTags: readonly string[];
  damageChannels: readonly string[];
  defenseRoutingTags: readonly string[];
  lockedTargetIds: readonly string[];
  targetPattern: string;
  authoredCosts: Readonly<Record<string, number>>;
  actualCostsPaid: Readonly<Record<string, number>>;
  nativeByTarget: readonly TargetNativeResult[];
  totalNativeDirectDamage: number;
  kills: number;
  healing: number;
  movement: number;
  primaryResource: RootActionResourceDelta;
  rootActionId: string;
  triggerSourceId: string | null;
  procDepth: number;
  classification: 'NATIVE_DIRECT' | 'DERIVATIVE';
  classId: NineStrainClassId;
  weaponFamilyId: CanonicalWeaponFamilyId;
  committed: boolean;
  ultimateOwnedRefill: boolean;
  actionSurface?: import('./counterfate').CounterfateActionSurface;
  startsCooldown?: boolean;
  selectedAmmoType?: string | null;
  intentCountered?: boolean;
  bossThresholdReached?: boolean;
  objectiveProgress?: boolean;
}

export interface NormalizedBoonEvent {
  type: NormalizedBoonEventType;
  order: number;
  sourceId: string;
  lineage: readonly string[];
  rootActionId: string | null;
  targetId: string | null;
  payload: Readonly<Record<string, number | string | boolean | null>>;
}

export interface InstinctAdapterInput {
  classId: NineStrainClassId;
  voidWardPrevented?: boolean;
  wraithParrySuccess?: boolean;
  perfectParry?: boolean;
  parryAttempted?: boolean;
  reloadQuality?: 'FAILED' | 'CLEAN' | 'PERFECT' | null;
  riftPreventedDamage?: number;
  riftWouldReachHp?: number;
  preventedFateboundIntentDamage?: boolean;
}

export interface CurrentAdapterInput {
  classId: NineStrainClassId;
  ordinaryGain?: boolean;
  ordinarySpend?: boolean;
  preserved?: boolean;
  delayedRestore?: boolean;
  ultimateOwnedRefill?: boolean;
  reserveEntered50?: boolean;
  reserveEmptied?: boolean;
  brandCycleCompleted?: boolean;
  ammoSpent?: boolean;
  reloadRestoredRounds?: boolean;
  magazineEmptyOrFull?: boolean;
  ammoCycleCompleted?: boolean;
  perfectReload?: boolean;
  protocolChanged?: boolean;
  brinkEntered?: boolean;
  catalystResolved?: boolean;
  cleanCycleCompleted?: boolean;
}

export type EligibilityRejection =
  | 'UNKNOWN_DEFINITION'
  | 'TEST_ONLY_BLOCKED'
  | 'ALREADY_OWNED'
  | 'IMPRINT_BLOCKED'
  | 'MISSING_PARENT'
  | 'STRAIN_CAP'
  | 'VERDICT_OCCUPIED'
  | 'CONVERGENCE_PARENTS'
  | 'DEPENDENCY_PROTECTION'
  | 'WRONG_ROLE'
  | 'BOON_SYSTEM_INACTIVE'
  | 'BOON_SYSTEM_CONFLICT'
  | 'DEPTH_GATE'
  | 'MISSING_PRODUCER'
  | 'ULTIMATE_INCOMPATIBLE';

export interface OwnershipPreview {
  before: NineStrainRuntimeState;
  after: NineStrainRuntimeState;
  overwrittenCoreId: string | null;
  dependentEffects: readonly string[];
  rejectionReasons: readonly EligibilityRejection[];
  eligible: boolean;
}

export type TurnStartPhase =
  | 'RESOURCE_CONVERSION_WAKE'
  | 'FATEBOUND_VALIDATION'
  | 'AFTERIMAGE_DELAY_CHOICE'
  | 'PENDING_TRACE_RESOLUTION'
  | 'OTHER_QUEUED_EFFECTS'
  | 'PLAYER_CONTROL';
