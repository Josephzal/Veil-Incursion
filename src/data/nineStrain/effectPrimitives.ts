import type { EffectPrimitive, NineStrainRuntimeState } from '../../types/nineStrain';

export interface PrimitiveExecutionContext {
  definitionId: string;
  rootActionId: string | null;
  targetId: string | null;
  totalNativeDirectDamage: number;
  lineage: readonly string[];
}

export interface PrimitiveHandlerResult {
  metrics: Record<string, number>;
  pendingQueued: boolean;
  derivativeDamage: number;
}

type PrimitiveHandler = (
  primitive: EffectPrimitive,
  state: NineStrainRuntimeState,
  ctx: PrimitiveExecutionContext,
) => PrimitiveHandlerResult;

const recordMetric: PrimitiveHandler = (primitive, state) => {
  const key = primitive.metricKey ?? 'unnamed';
  const next = { ...state.metrics, [key]: (state.metrics[key] ?? 0) + 1 };
  return { metrics: next, pendingQueued: false, derivativeDamage: 0 };
};

const queuePending: PrimitiveHandler = (primitive, state, ctx) => {
  const id = `${primitive.pendingId ?? 'pending'}:${state.nextPendingOrder}`;
  state.pendingEffects = [
    ...state.pendingEffects,
    {
      id,
      definitionId: ctx.definitionId,
      createdOrder: state.nextPendingOrder,
      kind: 'TRACE',
    },
  ];
  state.nextPendingOrder += 1;
  return { metrics: state.metrics, pendingQueued: true, derivativeDamage: 0 };
};

const derivativeDamage: PrimitiveHandler = (primitive) => ({
  metrics: {},
  pendingQueued: false,
  derivativeDamage: primitive.derivativeDamage ?? 0,
});

const capSelfBenefit: PrimitiveHandler = (primitive, state) => {
  const key = primitive.metricKey ?? 'self_benefit';
  if ((state.metrics[key] ?? 0) >= (primitive.selfBenefitCap ?? 1)) {
    return { metrics: state.metrics, pendingQueued: false, derivativeDamage: 0 };
  }
  return {
    metrics: { ...state.metrics, [key]: (state.metrics[key] ?? 0) + 1 },
    pendingQueued: false,
    derivativeDamage: 0,
  };
};

const chosenFateMarker: PrimitiveHandler = (_primitive, state) => ({
  metrics: state.metrics,
  pendingQueued: false,
  derivativeDamage: 0,
});

const PRIMITIVE_HANDLERS: Record<EffectPrimitive['kind'], PrimitiveHandler> = {
  RECORD_METRIC: recordMetric,
  QUEUE_PENDING: queuePending,
  DERIVATIVE_DAMAGE: derivativeDamage,
  CAP_SELF_BENEFIT_ONCE: capSelfBenefit,
  STORE_REVERSAL_NATIVE_SOURCE: chosenFateMarker,
  STORE_REVERSAL_DISCIPLINE_AP: chosenFateMarker,
  STORE_REVERSAL_INSTINCT_GRADE: chosenFateMarker,
  STORE_REVERSAL_CURRENT_SIGNAL: chosenFateMarker,
  CHOSEN_FATE_REBIND: chosenFateMarker,
  PREEMPTIVE_RUPTURE: chosenFateMarker,
  NO_FUTURE_CHAIN: chosenFateMarker,
  FINAL_REVISION: chosenFateMarker,
  MEASURE_ARMAMENT_FINALE: chosenFateMarker,
  MEASURE_DISCIPLINE_FINALE: chosenFateMarker,
  MEASURE_INSTINCT: chosenFateMarker,
  MEASURE_HELD_RESONANCE: chosenFateMarker,
  IMPROVISED_MEASURE: chosenFateMarker,
  DOWNBEAT: chosenFateMarker,
  UNBROKEN_RITE: chosenFateMarker,
  GRAND_CADENCE: chosenFateMarker,
  TRACE_PHANTOM_IMPACT: chosenFateMarker,
  TRACE_LINGERING_INVOCATION: chosenFateMarker,
  TRACE_REFLEX_REMNANT: chosenFateMarker,
  TRACE_RECURRENT_CHARGE: chosenFateMarker,
  DEFERRED_EXPOSURE: chosenFateMarker,
  CROSSFADE: chosenFateMarker,
  PERSISTENT_FORM: chosenFateMarker,
  SECOND_ENDING: chosenFateMarker,
  FATED_REFRAIN: chosenFateMarker,
  SECOND_OUTCOME: chosenFateMarker,
  ECHOED_RITE: chosenFateMarker,
  STILLPOINT_STORED_FORCE: chosenFateMarker,
  STILLPOINT_PATIENT_INVOCATION: chosenFateMarker,
  STILLPOINT_QUIET_REFLEX: chosenFateMarker,
  STILLPOINT_SILENT_RESERVOIR: chosenFateMarker,
  STILLPOINT_SHELTERED_PAUSE: chosenFateMarker,
  STILLPOINT_RETURN_STROKE: chosenFateMarker,
  STILLPOINT_MOTIONLESS_STORM: chosenFateMarker,
  STILLPOINT_ZERO_HOUR: chosenFateMarker,
  WOUNDWEAVE_SHARED_WOUND: chosenFateMarker,
  WOUNDWEAVE_CROSSED_HEX: chosenFateMarker,
  WOUNDWEAVE_REFLEXIVE_AGONY: chosenFateMarker,
  WOUNDWEAVE_TIGHTENED_THREAD: chosenFateMarker,
  WOUNDWEAVE_PERSISTENT_STITCH: chosenFateMarker,
  WOUNDWEAVE_CASCADING_TEAR: chosenFateMarker,
  WOUNDWEAVE_ONE_BODY: chosenFateMarker,
  WOUNDWEAVE_COMMON_GRAVE: chosenFateMarker,
  STAYED_SENTENCE: chosenFateMarker,
  MEASURED_SILENCE: chosenFateMarker,
  SUSPENDED_ECHO: chosenFateMarker,
  ENTANGLED_FATE: chosenFateMarker,
  TWOFOLD_RITE: chosenFateMarker,
  GHOST_THREAD: chosenFateMarker,
  DRAWN_TENSION: chosenFateMarker,
  FAULTLINE_STRESS_PATTERN: chosenFateMarker,
  FAULTLINE_APPLIED_FRACTURE: chosenFateMarker,
  FAULTLINE_COUNTERPRESSURE: chosenFateMarker,
  FAULTLINE_LOAD_LIMIT: chosenFateMarker,
  FAULTLINE_HAIRLINE_CASCADE: chosenFateMarker,
  FAULTLINE_RESIDUAL_STRESS: chosenFateMarker,
  FAULTLINE_CHAIN_FAILURE: chosenFateMarker,
  FAULTLINE_TERMINAL_FAILURE: chosenFateMarker,
  SOULWAKE_HOLLOW_EDGE: chosenFateMarker,
  SOULWAKE_BORROWED_NERVE: chosenFateMarker,
  SOULWAKE_PAIN_REFLEX: chosenFateMarker,
  SOULWAKE_OPEN_CONDUIT: chosenFateMarker,
  SOULWAKE_OPEN_NERVE: chosenFateMarker,
  SOULWAKE_PAIN_DIVIDEND: chosenFateMarker,
  SOULWAKE_LIVING_BREACH: chosenFateMarker,
  SOULWAKE_LAST_HEARTBEAT: chosenFateMarker,
};

export function executeEffectPrimitive(
  primitive: EffectPrimitive,
  state: NineStrainRuntimeState,
  ctx: PrimitiveExecutionContext,
): PrimitiveHandlerResult {
  return PRIMITIVE_HANDLERS[primitive.kind](primitive, state, ctx);
}
