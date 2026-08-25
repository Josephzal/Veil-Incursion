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
  | 'DERIVATIVE_RESOLVED'
  | 'NATIVE_STILLNESS_GAINED'
  | 'FAULT_APPLIED'
  | 'RUPTURE_RESOLVED'
  | 'OVERDRAW_COMMITTED'
  | 'WAKE_RECORDED'
  | 'WAKE_ACTIVATED'
  | 'WAKE_RESIDUAL';

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
  | 'GRAND_CADENCE'
  | 'TRACE_PHANTOM_IMPACT'
  | 'TRACE_LINGERING_INVOCATION'
  | 'TRACE_REFLEX_REMNANT'
  | 'TRACE_RECURRENT_CHARGE'
  | 'DEFERRED_EXPOSURE'
  | 'CROSSFADE'
  | 'PERSISTENT_FORM'
  | 'SECOND_ENDING'
  | 'FATED_REFRAIN'
  | 'SECOND_OUTCOME'
  | 'ECHOED_RITE'
  | 'STAYED_SENTENCE'
  | 'MEASURED_SILENCE'
  | 'SUSPENDED_ECHO'
  | 'ENTANGLED_FATE'
  | 'TWOFOLD_RITE'
  | 'GHOST_THREAD'
  | 'DRAWN_TENSION'
  | 'STILLPOINT_STORED_FORCE'
  | 'STILLPOINT_PATIENT_INVOCATION'
  | 'STILLPOINT_QUIET_REFLEX'
  | 'STILLPOINT_SILENT_RESERVOIR'
  | 'STILLPOINT_SHELTERED_PAUSE'
  | 'STILLPOINT_RETURN_STROKE'
  | 'STILLPOINT_MOTIONLESS_STORM'
  | 'STILLPOINT_ZERO_HOUR'
  | 'WOUNDWEAVE_SHARED_WOUND'
  | 'WOUNDWEAVE_CROSSED_HEX'
  | 'WOUNDWEAVE_REFLEXIVE_AGONY'
  | 'WOUNDWEAVE_TIGHTENED_THREAD'
  | 'WOUNDWEAVE_PERSISTENT_STITCH'
  | 'WOUNDWEAVE_CASCADING_TEAR'
  | 'WOUNDWEAVE_ONE_BODY'
  | 'WOUNDWEAVE_COMMON_GRAVE'
  | 'FAULTLINE_STRESS_PATTERN'
  | 'FAULTLINE_APPLIED_FRACTURE'
  | 'FAULTLINE_COUNTERPRESSURE'
  | 'FAULTLINE_LOAD_LIMIT'
  | 'FAULTLINE_HAIRLINE_CASCADE'
  | 'FAULTLINE_RESIDUAL_STRESS'
  | 'FAULTLINE_CHAIN_FAILURE'
  | 'FAULTLINE_TERMINAL_FAILURE'
  | 'SOULWAKE_HOLLOW_EDGE'
  | 'SOULWAKE_BORROWED_NERVE'
  | 'SOULWAKE_PAIN_REFLEX'
  | 'SOULWAKE_OPEN_CONDUIT'
  | 'SOULWAKE_OPEN_NERVE'
  | 'SOULWAKE_PAIN_DIVIDEND'
  | 'SOULWAKE_LIVING_BREACH'
  | 'SOULWAKE_LAST_HEARTBEAT'
  | 'BROKEN_OUTCOME'
  | 'BREAKING_MEASURE'
  | 'ECHOED_FAULT'
  | 'CRITICAL_PRESSURE'
  | 'SPLIT_SEAM'
  | 'PAIN_FORETOLD'
  | 'PULSE_RITE'
  | 'PHANTOM_PAIN'
  | 'HELD_BREATH'
  | 'SYMPATHETIC_WOUND'
  | 'LIVING_FAULT'
  | 'GRAVEMARK_IMPACT_VECTOR'
  | 'GRAVEMARK_FOLDED_SPACE'
  | 'GRAVEMARK_REVERSAL_FIELD'
  | 'GRAVEMARK_MASS_TRANSFER'
  | 'GRAVEMARK_COLLISION_COURSE'
  | 'GRAVEMARK_FALSE_POSITION'
  | 'GRAVEMARK_EVENT_HORIZON'
  | 'GRAVEMARK_WORLD_TURNED_SIDEWAYS'
  | 'SHARDSKIN_CRYSTAL_EDGE'
  | 'SHARDSKIN_RITUAL_PANE'
  | 'SHARDSKIN_PERFECT_FACET'
  | 'SHARDSKIN_PRESSURE_CRYSTAL'
  | 'SHARDSKIN_TEMPERED_REMNANT'
  | 'SHARDSKIN_SCATTERGLASS'
  | 'SHARDSKIN_ENDLESS_FACET'
  | 'SHARDSKIN_CATHEDRAL_BREAK'
  | 'FATE_OUT_OF_PLACE'
  | 'TURNING_RITE'
  | 'PARALLAX_ECHO'
  | 'STORED_VECTOR'
  | 'TETHERED_ORBIT'
  | 'TECTONIC_SHIFT'
  | 'TRAUMA_VECTOR'
  | 'FATED_FACET'
  | 'PRISMATIC_RITE'
  | 'PHANTOM_FACET'
  | 'STILLGLASS'
  | 'CRYSTAL_LIGATURE'
  | 'FAULTGLASS'
  | 'SOULGLASS'
  | 'IMPACT_LATTICE';

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
  minOwnedCoresFromStrain?: number;
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
  /** Production acquisition wave. Sector 1 remains 1; Stillpoint is 2. Gravemark is 4. */
  acquisitionWave?: 1 | 2 | 3 | 4;
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
  afterimage: import('./afterimage').AfterimageRuntimeState;
  convergence: import('./convergence').Sector1ConvergenceRuntimeState;
  stillpoint: import('./stillpoint').StillpointRuntimeState;
  woundweave: import('./woundweave').WoundweaveRuntimeState;
  faultline: import('./faultline').FaultlineRuntimeState;
  soulwake: import('./soulwake').SoulwakeRuntimeState;
  gravemark: import('./gravemark').GravemarkRuntimeState;
  shardskin: import('./shardskin').ShardskinRuntimeState;
  acquisition: import('./convergence').NineStrainAcquisitionState;
  /** Fixed for the incursion. Schema 8 and earlier hydrate as 1. Wave 4 is direct-grant/test only. */
  maxAcquisitionWave: 1 | 2 | 3 | 4;
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
  lingeringRole?: 'HOSTILE' | 'UTILITY';
  delayedOrigin?: boolean;
  instinctGrade?: InstinctGrade;
  directlyAffectedTargetIds?: readonly string[];
  hpLossKind?: 'NATIVE_ACTION' | 'PRISM_SACRIFICE' | 'BOON' | 'GRAFT';
  wakePowered?: boolean;
  wakeValueAtCommit?: number;
  wakeGenerationId?: number;
  wakeKindAtCommit?: 'NONE' | 'NORMAL' | 'RESIDUAL';
  wakePaidQualifyingHp?: boolean;
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
  primaryNumeric?: number;
  associatedHostileUnitId?: string | null;
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
  actualGained?: number;
  actualSpent?: number;
  reloadRestoredCount?: number;
  selectedAmmoType?: string;
  magazineSpace?: number;
  magazineEmptyOrFull?: boolean;
  ammoCycleCompleted?: boolean;
  perfectReload?: boolean;
  protocolChanged?: boolean;
  brinkEntered?: boolean;
  catalystResolved?: boolean;
  cleanCycleCompleted?: boolean;
  associatedHostileUnitId?: string | null;
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
  | 'ULTIMATE_INCOMPATIBLE'
  | 'WAVE_LOCKED';

export interface OwnershipPreview {
  before: NineStrainRuntimeState;
  after: NineStrainRuntimeState;
  overwrittenCoreId: string | null;
  overwrittenVerdictId: string | null;
  dependentEffects: readonly string[];
  dependentDisplayNames: readonly string[];
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
