import type { CanonicalRootActionContext, CoreImprintId, InstinctGrade, TargetNativeResult } from '../../types/nineStrain';
import type { HostileIntentSnapshot } from '../../types/counterfate';
import type {
  AfterimageRuntimeState,
  DeferredExposureOption,
  ScheduledTrace,
  TraceDamagePortion,
  TracePayloadKind,
  TraceProvenance,
  TraceResolutionMode,
} from '../../types/afterimage';
import { compareTraceFallback } from './intentIdentity';
import { roundCounterfateAmount } from './counterfateMath';

export function createDefaultAfterimageState(): AfterimageRuntimeState {
  return {
    playerTurnIndex: 0,
    nextTraceSequence: 1,
    pending: [],
    ordinaryQuotaUsed: {},
    recurrentUsedThisPlayerTurn: false,
    crossfadeArmedImprint: null,
    crossfadeUsedThisPlayerTurn: false,
    playerTurnOpen: false,
    deferredChoicePending: false,
    capacity: { reserve: 99, flux: 99, ammo: 99 },
  };
}

export function lingeringInvocationPower(actualApPaid: number): number {
  return Math.min(17, 5 + (3 * Math.max(0, actualApPaid)));
}

export function phantomPortionDamage(native: number): number {
  return roundCounterfateAmount(native * 0.35);
}

export function secondEndingPortionDamage(native: number): number {
  return roundCounterfateAmount(native * 0.5);
}

export function reflexRemnantPower(grade: InstinctGrade): number | null {
  if (grade === 'FAILED') return null;
  if (grade === 'PERFECT') return 15;
  if (grade === 'CLEAN') return 10;
  return 6;
}

export function recurrentStoredAmount(actualGain: number): number {
  if (actualGain <= 0) return 0;
  return Math.min(10, roundCounterfateAmount(actualGain * 0.4));
}

export function effectiveTracePower(trace: ScheduledTrace): number {
  if (trace.payloadKind === 'MATCHING_AMMO') return 1;
  const delayed = trace.delayCount > 0 ? 1.5 : 1;
  return roundCounterfateAmount(trace.basePayload * delayed * (trace.powerMultiplier === 1 ? 1 : trace.powerMultiplier));
}

export function persistentSecondaryPower(trace: ScheduledTrace): number {
  if (trace.payloadKind === 'MATCHING_AMMO') return 1;
  return roundCounterfateAmount(trace.basePayload * 0.5);
}

export function recordDamagePortions(
  rows: readonly TargetNativeResult[],
  percent: number,
): TraceDamagePortion[] {
  return rows.flatMap((row) => {
    if (row.nativeDirectDamage <= 0 || (row.misses > 0 && row.hits === 0)) return [];
    const stored = roundCounterfateAmount(row.nativeDirectDamage * percent);
    if (stored <= 0) return [];
    const kinetic = row.kineticNativeDamage ?? 0;
    const occult = row.occultNativeDamage ?? 0;
    const total = kinetic + occult;
    let nextK = 0;
    let nextO = stored;
    if (total > 0) {
      nextK = roundCounterfateAmount(stored * (kinetic / total));
      nextO = stored - nextK;
    }
    return [{
      originalTargetId: row.targetId,
      assignedTargetId: row.targetId,
      nativeDirectDamage: stored,
      kineticNativeDamage: nextK,
      occultNativeDamage: nextO,
      remainderAssigned: 0,
      fizzled: false,
    }];
  });
}

function channelSplitFromPortions(portions: readonly TraceDamagePortion[]): { kinetic: number; occult: number } {
  const kinetic = portions.reduce((sum, row) => sum + row.kineticNativeDamage, 0);
  const occult = portions.reduce((sum, row) => sum + row.occultNativeDamage, 0);
  return { kinetic, occult };
}

export function distributeOccultBudget(
  total: number,
  targets: readonly { targetId: string; weight: number }[],
): TraceDamagePortion[] {
  if (targets.length === 0 || total <= 0) return [];
  const weightSum = targets.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  const shares = targets.map((row) => {
    const ratio = weightSum > 0 ? Math.max(0, row.weight) / weightSum : 1 / targets.length;
    return { targetId: row.targetId, amount: roundCounterfateAmount(total * ratio) };
  });
  let assigned = shares.reduce((sum, row) => sum + row.amount, 0);
  let remainder = total - assigned;
  const extra = new Set<number>();
  for (let i = 0; i < shares.length && remainder > 0; i += 1) {
    shares[i].amount += 1;
    extra.add(i);
    remainder -= 1;
  }
  return shares.filter((row) => row.amount > 0).map((row, index) => ({
    originalTargetId: row.targetId,
    assignedTargetId: row.targetId,
    nativeDirectDamage: row.amount,
    kineticNativeDamage: 0,
    occultNativeDamage: row.amount,
    remainderAssigned: extra.has(index) ? 1 : 0,
    fizzled: false,
  }));
}

export function legalHostileFallback(
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
): HostileIntentSnapshot | null {
  const eligible = intents.filter((row) => row.alive && !row.phased);
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => compareTraceFallback(a, b, jammed))[0] ?? null;
}

export function retargetPortions(
  portions: readonly TraceDamagePortion[],
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
): TraceDamagePortion[] {
  return portions.map((portion) => {
    const current = intents.find((row) => row.unitId === portion.originalTargetId)
      ?? intents.find((row) => row.unitId === portion.assignedTargetId);
    if (current && current.alive && !current.phased) {
      return { ...portion, assignedTargetId: current.unitId, fizzled: false };
    }
    const fallback = legalHostileFallback(intents, jammed);
    if (!fallback) {
      return { ...portion, assignedTargetId: null, fizzled: true };
    }
    return { ...portion, assignedTargetId: fallback.unitId, fizzled: false };
  });
}

function mintTrace(
  state: AfterimageRuntimeState,
  args: {
    originDefinitionId: string;
    originImprint: CoreImprintId | 'VERDICT';
    provenance: TraceProvenance;
    originRootActionId: string | null;
    resolutionMode: TraceResolutionMode;
    payloadKind: TracePayloadKind;
    basePayload: number;
    targetAndDamageMap: TraceDamagePortion[];
    targetPattern: string;
    ammoType?: string | null;
    powerMultiplier?: number;
  },
): { state: AfterimageRuntimeState; trace: ScheduledTrace } {
  const ordinary = args.provenance === 'CORE';
  const trace: ScheduledTrace = {
    traceId: `trace:${state.nextTraceSequence}`,
    originDefinitionId: args.originDefinitionId,
    originImprint: args.originImprint,
    provenance: args.provenance,
    originRootActionId: args.originRootActionId,
    creationSequence: state.nextTraceSequence,
    createdPlayerTurn: state.playerTurnIndex,
    duePlayerTurn: state.playerTurnIndex + 1,
    resolutionMode: args.resolutionMode,
    payloadKind: args.payloadKind,
    basePayload: args.basePayload,
    delayCount: 0,
    powerMultiplier: args.powerMultiplier ?? 1,
    targetAndDamageMap: args.targetAndDamageMap,
    targetPattern: args.targetPattern,
    channelSplit: channelSplitFromPortions(args.targetAndDamageMap),
    ammoType: args.ammoType ?? null,
    crossfadeEligible: ordinary,
    persistentEligible: ordinary,
    status: 'PENDING',
    delayedOriginLineage: ['AFTERIMAGE_TRACE', args.originRootActionId ?? 'none'],
  };
  return {
    trace,
    state: {
      ...state,
      nextTraceSequence: state.nextTraceSequence + 1,
      pending: [...state.pending, trace],
    },
  };
}

export function beginPlayerTurn(state: AfterimageRuntimeState): AfterimageRuntimeState {
  return {
    ...state,
    playerTurnIndex: state.playerTurnIndex + 1,
    ordinaryQuotaUsed: {},
    recurrentUsedThisPlayerTurn: false,
    deferredChoicePending: false,
    playerTurnOpen: true,
  };
}

export function expireUnusedCrossfade(state: AfterimageRuntimeState): AfterimageRuntimeState {
  return {
    ...state,
    crossfadeArmedImprint: null,
    crossfadeUsedThisPlayerTurn: false,
    playerTurnOpen: false,
  };
}

export function dueTurnStartTraces(state: AfterimageRuntimeState): ScheduledTrace[] {
  return state.pending
    .filter((row) => row.status === 'PENDING' && row.duePlayerTurn <= state.playerTurnIndex && row.resolutionMode === 'TURN_START')
    .sort((a, b) => a.creationSequence - b.creationSequence);
}

export function dueActionTraces(state: AfterimageRuntimeState): ScheduledTrace[] {
  return state.pending
    .filter((row) => (
      (row.status === 'PENDING' || row.status === 'READY')
      && row.duePlayerTurn <= state.playerTurnIndex
      && row.resolutionMode === 'NEXT_COMMITTED_ACTION'
    ))
    .sort((a, b) => a.creationSequence - b.creationSequence);
}

export function markActionTracesReady(state: AfterimageRuntimeState): AfterimageRuntimeState {
  return {
    ...state,
    pending: state.pending.map((row) => (
      row.status === 'PENDING'
        && row.resolutionMode === 'NEXT_COMMITTED_ACTION'
        && row.duePlayerTurn <= state.playerTurnIndex
        ? { ...row, status: 'READY' as const }
        : row
    )),
  };
}

export function deferredExposureOptions(state: AfterimageRuntimeState, owned: boolean): DeferredExposureOption[] {
  if (!owned) return [];
  return dueTurnStartTraces(state)
    .filter((row) => row.provenance === 'CORE' && row.delayCount === 0)
    .map((row) => ({
      traceId: row.traceId,
      originLabel: row.originImprint === 'ARMAMENT'
        ? 'Weapon echo'
        : row.originImprint === 'DISCIPLINE'
          ? 'Discipline echo'
          : row.originImprint === 'INSTINCT'
            ? 'Instinct echo'
            : 'Current echo',
      payloadKind: row.payloadKind,
      originalDue: row.duePlayerTurn,
      delayedDue: row.duePlayerTurn + 1,
      basePayload: row.basePayload,
      delayedPayload: row.payloadKind === 'MATCHING_AMMO' ? 1 : roundCounterfateAmount(row.basePayload * 1.5),
      ammoType: row.ammoType,
      targetSummary: row.targetAndDamageMap.map((portion) => portion.originalTargetId).join(', ') || 'self',
    }));
}

export function applyDeferredDelay(state: AfterimageRuntimeState, traceId: string | null): AfterimageRuntimeState {
  if (!traceId) return { ...state, deferredChoicePending: false };
  return {
    ...state,
    deferredChoicePending: false,
    pending: state.pending.map((row) => (
      row.traceId === traceId && row.provenance === 'CORE' && row.delayCount === 0
        ? { ...row, duePlayerTurn: row.duePlayerTurn + 1, delayCount: 1 }
        : row
    )),
  };
}

export function markTraceResolved(state: AfterimageRuntimeState, traceId: string): AfterimageRuntimeState {
  return {
    ...state,
    pending: state.pending.map((row) => (row.traceId === traceId ? { ...row, status: 'RESOLVED' as const } : row)),
  };
}

export function armCrossfade(state: AfterimageRuntimeState, originImprint: CoreImprintId, owned: boolean): AfterimageRuntimeState {
  if (!owned || state.crossfadeUsedThisPlayerTurn) return state;
  return { ...state, crossfadeArmedImprint: originImprint };
}

export function consumeCrossfade(state: AfterimageRuntimeState): AfterimageRuntimeState {
  return { ...state, crossfadeArmedImprint: null, crossfadeUsedThisPlayerTurn: true };
}

export function clearEncounterAfterimage(): AfterimageRuntimeState {
  return createDefaultAfterimageState();
}

export function quotaAvailable(state: AfterimageRuntimeState, imprint: CoreImprintId): boolean {
  return state.ordinaryQuotaUsed[imprint] !== true;
}

export function consumeQuota(state: AfterimageRuntimeState, imprint: CoreImprintId): AfterimageRuntimeState {
  return { ...state, ordinaryQuotaUsed: { ...state.ordinaryQuotaUsed, [imprint]: true } };
}

export function tryMintPhantom(
  state: AfterimageRuntimeState,
  ctx: CanonicalRootActionContext,
  definitionId: string,
  provenance: TraceProvenance,
  powerMultiplier: number,
): { state: AfterimageRuntimeState; created: boolean } {
  if (ctx.classification !== 'NATIVE_DIRECT' || ctx.sourceKind === 'ULTIMATE') {
    return { state, created: false };
  }
  if (ctx.actionSurface !== 'WEAPON' && ctx.actionSurface !== 'BASIC' && ctx.sourceKind !== 'PLAYER_ACTION') {
    return { state, created: false };
  }
  if (ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX' || ctx.actionSurface === 'INSTINCT' || ctx.actionSurface === 'ULTIMATE') {
    return { state, created: false };
  }
  const ordinary = provenance === 'CORE';
  if (ordinary && !quotaAvailable(state, 'ARMAMENT')) return { state, created: false };
  let next = ordinary ? consumeQuota(state, 'ARMAMENT') : state;
  const portions = recordDamagePortions(ctx.nativeByTarget, 0.35 * powerMultiplier);
  const total = portions.reduce((sum, row) => sum + row.nativeDirectDamage, 0);
  if (total <= 0) return { state: next, created: false };
  const minted = mintTrace(next, {
    originDefinitionId: definitionId,
    originImprint: 'ARMAMENT',
    provenance,
    originRootActionId: ctx.rootActionId,
    resolutionMode: 'TURN_START',
    payloadKind: 'PER_TARGET_DAMAGE',
    basePayload: total,
    targetAndDamageMap: portions,
    targetPattern: ctx.targetPattern,
    powerMultiplier: 1,
  });
  return { state: minted.state, created: true };
}

export function tryMintLingering(
  state: AfterimageRuntimeState,
  ctx: CanonicalRootActionContext,
  definitionId: string,
  provenance: TraceProvenance,
  powerMultiplier: number,
): { state: AfterimageRuntimeState; created: boolean } {
  if (ctx.classification !== 'NATIVE_DIRECT') return { state, created: false };
  if (ctx.actionSurface !== 'TECHNIQUE' && ctx.actionSurface !== 'FLEX') return { state, created: false };
  const ordinary = provenance === 'CORE';
  if (ordinary && !quotaAvailable(state, 'DISCIPLINE')) return { state, created: false };
  let next = ordinary ? consumeQuota(state, 'DISCIPLINE') : state;
  const power = roundCounterfateAmount(lingeringInvocationPower(ctx.actualCostsPaid.ap ?? 0) * powerMultiplier);
  if (power <= 0) return { state: next, created: false };
  const utility = ctx.lingeringRole === 'UTILITY'
    || ctx.targetPattern === 'SELF'
    || (ctx.totalNativeDirectDamage <= 0 && ctx.lockedTargetIds.length === 0);
  if (utility) {
    const minted = mintTrace(next, {
      originDefinitionId: definitionId,
      originImprint: 'DISCIPLINE',
      provenance,
      originRootActionId: ctx.rootActionId,
      resolutionMode: 'TURN_START',
      payloadKind: 'BARRIER',
      basePayload: power,
      targetAndDamageMap: [],
      targetPattern: 'SELF',
    });
    return { state: minted.state, created: true };
  }
  const weights = ctx.nativeByTarget
    .filter((row) => row.nativeDirectDamage > 0 || row.hits > 0)
    .map((row) => ({ targetId: row.targetId, weight: Math.max(1, row.nativeDirectDamage) }));
  const targets = weights.length > 0
    ? weights
    : ctx.lockedTargetIds.map((id) => ({ targetId: id, weight: 1 }));
  const portions = distributeOccultBudget(power, targets);
  const minted = mintTrace(next, {
    originDefinitionId: definitionId,
    originImprint: 'DISCIPLINE',
    provenance,
    originRootActionId: ctx.rootActionId,
    resolutionMode: 'TURN_START',
    payloadKind: 'OCCULT_ACTION_BUDGET',
    basePayload: power,
    targetAndDamageMap: portions,
    targetPattern: ctx.targetPattern,
  });
  return { state: minted.state, created: true };
}

export function tryMintReflex(
  state: AfterimageRuntimeState,
  args: {
    grade: InstinctGrade;
    rootActionId: string;
    definitionId: string;
    provenance: TraceProvenance;
    powerMultiplier: number;
  },
): { state: AfterimageRuntimeState; created: boolean } {
  const ordinary = args.provenance === 'CORE';
  if (ordinary && !quotaAvailable(state, 'INSTINCT')) return { state, created: false };
  const power = reflexRemnantPower(args.grade);
  if (power == null) return { state, created: false };
  let next = ordinary ? consumeQuota(state, 'INSTINCT') : state;
  const stored = roundCounterfateAmount(power * args.powerMultiplier);
  if (stored <= 0) return { state: next, created: false };
  const minted = mintTrace(next, {
    originDefinitionId: args.definitionId,
    originImprint: 'INSTINCT',
    provenance: args.provenance,
    originRootActionId: args.rootActionId,
    resolutionMode: 'NEXT_COMMITTED_ACTION',
    payloadKind: 'FLAT_OCCULT',
    basePayload: stored,
    targetAndDamageMap: [],
    targetPattern: 'SINGLE',
  });
  return { state: minted.state, created: true };
}

export function tryMintRecurrent(
  state: AfterimageRuntimeState,
  args: {
    classId: 'AEGIS' | 'HEX_SHOT' | 'ENVOY';
    actualGained: number;
    reloadRestoredCount: number;
    selectedAmmoType: string | null;
    ultimateOwnedRefill: boolean;
    delayedRestore: boolean;
    definitionId: string;
    provenance: TraceProvenance;
    powerMultiplier: number;
    originRootActionId: string | null;
  },
): { state: AfterimageRuntimeState; created: boolean } {
  if (args.ultimateOwnedRefill || args.delayedRestore) return { state, created: false };
  const ordinary = args.provenance === 'CORE';
  if (ordinary && !quotaAvailable(state, 'CURRENT')) return { state, created: false };
  if (ordinary && state.recurrentUsedThisPlayerTurn && args.classId !== 'HEX_SHOT') {
    return { state, created: false };
  }
  if (args.classId === 'HEX_SHOT') {
    if (args.reloadRestoredCount < 3) return { state, created: false };
    let next = ordinary ? consumeQuota({ ...state, recurrentUsedThisPlayerTurn: true }, 'CURRENT') : state;
    const minted = mintTrace(next, {
      originDefinitionId: args.definitionId,
      originImprint: 'CURRENT',
      provenance: args.provenance,
      originRootActionId: args.originRootActionId,
      resolutionMode: 'TURN_START',
      payloadKind: 'MATCHING_AMMO',
      basePayload: 1,
      targetAndDamageMap: [],
      targetPattern: 'SELF',
      ammoType: args.selectedAmmoType,
    });
    return { state: minted.state, created: true };
  }
  const stored = roundCounterfateAmount(recurrentStoredAmount(args.actualGained) * args.powerMultiplier);
  if (stored <= 0) return { state, created: false };
  let next = ordinary ? consumeQuota({ ...state, recurrentUsedThisPlayerTurn: true }, 'CURRENT') : state;
  const minted = mintTrace(next, {
    originDefinitionId: args.definitionId,
    originImprint: 'CURRENT',
    provenance: args.provenance,
    originRootActionId: args.originRootActionId,
    resolutionMode: 'TURN_START',
    payloadKind: args.classId === 'ENVOY' ? 'FLUX_RESTORE' : 'RESERVE_RESTORE',
    basePayload: stored,
    targetAndDamageMap: [],
    targetPattern: 'SELF',
  });
  return { state: minted.state, created: true };
}

export function tryMintSecondEnding(
  state: AfterimageRuntimeState,
  ctx: CanonicalRootActionContext,
  definitionId: string,
): { state: AfterimageRuntimeState; created: boolean } {
  if (ctx.sourceKind !== 'ULTIMATE' || ctx.classification !== 'NATIVE_DIRECT') return { state, created: false };
  const portions = recordDamagePortions(ctx.nativeByTarget, 0.5);
  const total = portions.reduce((sum, row) => sum + row.nativeDirectDamage, 0);
  if (total <= 0) return { state, created: false };
  const minted = mintTrace(state, {
    originDefinitionId: definitionId,
    originImprint: 'VERDICT',
    provenance: 'VERDICT',
    originRootActionId: ctx.rootActionId,
    resolutionMode: 'TURN_START',
    payloadKind: 'PER_TARGET_DAMAGE',
    basePayload: total,
    targetAndDamageMap: portions,
    targetPattern: ctx.targetPattern,
  });
  return { state: minted.state, created: true };
}

export function schedulePersistentSecondary(
  state: AfterimageRuntimeState,
  resolved: ScheduledTrace,
  owned: boolean,
): AfterimageRuntimeState {
  if (!owned || resolved.provenance !== 'CORE' || !resolved.persistentEligible) return state;
  const power = persistentSecondaryPower(resolved);
  const portions = resolved.payloadKind === 'MATCHING_AMMO' || resolved.payloadKind === 'BARRIER' || resolved.payloadKind === 'FLAT_OCCULT'
    ? resolved.targetAndDamageMap
    : resolved.targetAndDamageMap.map((row) => ({
      ...row,
      nativeDirectDamage: roundCounterfateAmount(row.nativeDirectDamage * 0.5),
      kineticNativeDamage: roundCounterfateAmount(row.kineticNativeDamage * 0.5),
      occultNativeDamage: roundCounterfateAmount(row.occultNativeDamage * 0.5),
    }));
  const minted = mintTrace(state, {
    originDefinitionId: resolved.originDefinitionId,
    originImprint: resolved.originImprint,
    provenance: 'PERSISTENT_SECONDARY',
    originRootActionId: resolved.originRootActionId,
    resolutionMode: resolved.resolutionMode,
    payloadKind: resolved.payloadKind,
    basePayload: power,
    targetAndDamageMap: portions,
    targetPattern: resolved.targetPattern,
    ammoType: resolved.ammoType,
  });
  return minted.state;
}

export function tryMintConvergenceReleaseTrace(
  state: AfterimageRuntimeState,
  args: {
    definitionId: string;
    packet: number;
    originalTargetId: string | null;
    originRootActionId: string | null;
  },
): { state: AfterimageRuntimeState; created: boolean; trace: ScheduledTrace | null } {
  const power = roundCounterfateAmount(args.packet * 0.4);
  if (power <= 0) {
    return { state, created: false, trace: null };
  }
  const portions: TraceDamagePortion[] = args.originalTargetId
    ? [{
      originalTargetId: args.originalTargetId,
      assignedTargetId: args.originalTargetId,
      nativeDirectDamage: power,
      kineticNativeDamage: 0,
      occultNativeDamage: power,
      remainderAssigned: 0,
      fizzled: false,
    }]
    : [];
  const minted = mintTrace(state, {
    originDefinitionId: args.definitionId,
    originImprint: 'ARMAMENT',
    provenance: 'CONVERGENCE',
    originRootActionId: args.originRootActionId,
    resolutionMode: 'TURN_START',
    payloadKind: 'PER_TARGET_DAMAGE',
    basePayload: power,
    targetAndDamageMap: portions,
    targetPattern: 'SINGLE',
  });
  return { state: minted.state, created: true, trace: minted.trace };
}

export function hydrateAfterimageState(raw: unknown): AfterimageRuntimeState {
  const base = createDefaultAfterimageState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const pending = Array.isArray(row.pending) ? row.pending.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const rec = entry as Record<string, unknown>;
    if (typeof rec.traceId !== 'string' || typeof rec.originDefinitionId !== 'string') return [];
    const provenance: TraceProvenance = rec.provenance === 'CROSSFADE_BONUS'
      || rec.provenance === 'PERSISTENT_SECONDARY'
      || rec.provenance === 'CONVERGENCE'
      || rec.provenance === 'VERDICT'
      ? rec.provenance
      : 'CORE';
    const payloadKind: TracePayloadKind = rec.payloadKind === 'OCCULT_ACTION_BUDGET'
      || rec.payloadKind === 'BARRIER'
      || rec.payloadKind === 'RESERVE_RESTORE'
      || rec.payloadKind === 'FLUX_RESTORE'
      || rec.payloadKind === 'MATCHING_AMMO'
      || rec.payloadKind === 'FLAT_OCCULT'
      ? rec.payloadKind
      : 'PER_TARGET_DAMAGE';
    return [{
      traceId: rec.traceId,
      originDefinitionId: rec.originDefinitionId,
      originImprint: rec.originImprint === 'DISCIPLINE' || rec.originImprint === 'INSTINCT' || rec.originImprint === 'CURRENT' || rec.originImprint === 'VERDICT'
        ? rec.originImprint
        : 'ARMAMENT',
      provenance,
      originRootActionId: typeof rec.originRootActionId === 'string' ? rec.originRootActionId : null,
      creationSequence: typeof rec.creationSequence === 'number' ? rec.creationSequence : 0,
      createdPlayerTurn: typeof rec.createdPlayerTurn === 'number' ? rec.createdPlayerTurn : 0,
      duePlayerTurn: typeof rec.duePlayerTurn === 'number' ? rec.duePlayerTurn : 1,
      resolutionMode: rec.resolutionMode === 'NEXT_COMMITTED_ACTION' ? 'NEXT_COMMITTED_ACTION' as const : 'TURN_START' as const,
      payloadKind,
      basePayload: typeof rec.basePayload === 'number' ? rec.basePayload : 0,
      delayCount: typeof rec.delayCount === 'number' ? rec.delayCount : 0,
      powerMultiplier: typeof rec.powerMultiplier === 'number' ? rec.powerMultiplier : 1,
      targetAndDamageMap: Array.isArray(rec.targetAndDamageMap) ? rec.targetAndDamageMap as TraceDamagePortion[] : [],
      targetPattern: typeof rec.targetPattern === 'string' ? rec.targetPattern : 'SINGLE',
      channelSplit: rec.channelSplit && typeof rec.channelSplit === 'object'
        ? rec.channelSplit as { kinetic: number; occult: number }
        : { kinetic: 0, occult: 0 },
      ammoType: typeof rec.ammoType === 'string' ? rec.ammoType : null,
      crossfadeEligible: rec.crossfadeEligible === true,
      persistentEligible: rec.persistentEligible === true,
      status: rec.status === 'READY' || rec.status === 'RESOLVED' || rec.status === 'EXPIRED' || rec.status === 'FIZZLED'
        ? rec.status
        : 'PENDING',
      delayedOriginLineage: Array.isArray(rec.delayedOriginLineage)
        ? rec.delayedOriginLineage.filter((item): item is string => typeof item === 'string')
        : ['AFTERIMAGE_TRACE'],
    } satisfies ScheduledTrace];
  }) : [];
  const quotaRaw = row.ordinaryQuotaUsed && typeof row.ordinaryQuotaUsed === 'object'
    ? row.ordinaryQuotaUsed as AfterimageRuntimeState['ordinaryQuotaUsed']
    : {};
  return {
    ...base,
    playerTurnIndex: typeof row.playerTurnIndex === 'number' ? row.playerTurnIndex : 0,
    nextTraceSequence: typeof row.nextTraceSequence === 'number' ? row.nextTraceSequence : pending.length + 1,
    pending,
    ordinaryQuotaUsed: quotaRaw,
    recurrentUsedThisPlayerTurn: row.recurrentUsedThisPlayerTurn === true,
    crossfadeArmedImprint: row.crossfadeArmedImprint === 'ARMAMENT'
      || row.crossfadeArmedImprint === 'DISCIPLINE'
      || row.crossfadeArmedImprint === 'INSTINCT'
      || row.crossfadeArmedImprint === 'CURRENT'
      ? row.crossfadeArmedImprint
      : null,
    crossfadeUsedThisPlayerTurn: row.crossfadeUsedThisPlayerTurn === true,
    playerTurnOpen: row.playerTurnOpen === true,
    deferredChoicePending: row.deferredChoicePending === true,
    capacity: {
      reserve: typeof (row.capacity as { reserve?: number } | undefined)?.reserve === 'number'
        ? (row.capacity as { reserve: number }).reserve
        : 99,
      flux: typeof (row.capacity as { flux?: number } | undefined)?.flux === 'number'
        ? (row.capacity as { flux: number }).flux
        : 99,
      ammo: typeof (row.capacity as { ammo?: number } | undefined)?.ammo === 'number'
        ? (row.capacity as { ammo: number }).ammo
        : 99,
    },
  };
}
