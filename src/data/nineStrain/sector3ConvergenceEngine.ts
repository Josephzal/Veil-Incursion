import { AFTERIMAGE_CORE_IDS } from '../../types/afterimage';
import { CONVERGENCE_IDS } from '../../types/convergence';
import type { Sector3ConvergenceRuntimeState } from '../../types/convergence';
import type {
  CombatDepthBand,
  CounterfateRuntimeState,
  HostileIntentSnapshot,
  ReversalReleaseResult,
} from '../../types/counterfate';
import type {
  FaultAdditionRecord,
  FaultlineRuntimeState,
  RuptureResult,
} from '../../types/faultline';
import type { CanonicalRootActionContext, UniversalBoonDefinition } from '../../types/nineStrain';
import type { RitualCadenceRuntimeState } from '../../types/ritualCadence';
import type { SoulwakeRuntimeState } from '../../types/soulwake';
import type {
  PlayerTurnEndReason,
  StillnessChargeSource,
  StillpointRuntimeState,
} from '../../types/stillpoint';
import { SELF_LINK_STRENGTH } from '../../types/woundweave';
import type { WoundweaveRuntimeState } from '../../types/woundweave';
import { isCanonicalPlayerCounteredRelease } from './convergenceEngine';
import { storeReversal } from './counterfateEngine';
import { roundCounterfateAmount } from './counterfateMath';
import { addFault } from './faultlineEngine';
import { directlyAffectedTargetIds } from './rootAction';
import { advanceMeasureWithoutFinale } from './ritualCadenceEngine';
import {
  injectImmediateResidualWake,
  requestResidualCarry,
} from './soulwakeEngine';
import { grantFleetingStillness } from './stillpointEngine';
import { isPrimaryEndpoint } from './woundweaveEngine';

type ResidualCarryFn = typeof requestResidualCarry;
type ImmediateResidualFn = typeof injectImmediateResidualWake;
type GrantFleetingFn = typeof grantFleetingStillness;

function legalHostile(
  intents: readonly HostileIntentSnapshot[],
  unitId: string | null | undefined,
): HostileIntentSnapshot | null {
  if (!unitId) return null;
  return intents.find((row) => row.unitId === unitId && row.alive && !row.phased) ?? null;
}

function woundlinkPartner(ww: WoundweaveRuntimeState, unitId: string): string | null {
  if (!isPrimaryEndpoint(ww, unitId)) return null;
  if (ww.selfLink) return unitId;
  if (ww.endpointA === unitId) return ww.endpointB;
  if (ww.endpointB === unitId) return ww.endpointA;
  return null;
}

function selfLinkScaledFault(amount: number, selfLink: boolean): number {
  if (!selfLink) return Math.max(0, amount);
  return roundCounterfateAmount(amount * SELF_LINK_STRENGTH);
}

function lockedPrimaryId(ctx: CanonicalRootActionContext): string | null {
  return ctx.lockedTargetIds[0] ?? null;
}

function affectedIds(ctx: CanonicalRootActionContext): string[] {
  return [...(ctx.directlyAffectedTargetIds ?? directlyAffectedTargetIds(ctx))];
}

function applyConvergenceFaultMap(args: {
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  depth: CombatDepthBand;
  primaryId: string | null;
  primaryAmount: number;
  otherAmount: number;
  sourceDefinitionId: string;
  sourceEventId: string;
}): {
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  additions: FaultAdditionRecord[];
  ruptures: RuptureResult[];
} {
  let fl = args.fl;
  let intents = args.intents;
  const additions: FaultAdditionRecord[] = [];
  const ruptures: RuptureResult[] = [];
  const seen = new Set<string>();
  const order: { targetId: string; amount: number }[] = [];
  if (args.primaryId && args.primaryAmount > 0) {
    order.push({ targetId: args.primaryId, amount: args.primaryAmount });
    seen.add(args.primaryId);
  }
  for (const targetId of affectedIds(args.ctx)) {
    if (seen.has(targetId) || args.otherAmount <= 0) continue;
    seen.add(targetId);
    order.push({ targetId, amount: args.otherAmount });
  }
  for (const row of order) {
    if (!legalHostile(intents, row.targetId)) continue;
    const applied = addFault({
      state: fl,
      intents,
      ctx: args.ctx,
      targetId: row.targetId,
      amount: row.amount,
      origin: 'CONVERGENCE',
      classificationIfRupture: 'CONVERGENCE',
      sourceDefinitionId: args.sourceDefinitionId,
      sourceEventId: args.sourceEventId,
      depth: args.depth,
      allowRupture: true,
    });
    fl = applied.state;
    intents = applied.intents;
    additions.push(applied.addition);
    if (applied.rupture) ruptures.push(applied.rupture);
  }
  return { fl, intents, additions, ruptures };
}

/** Offer eligibility: loadout can mint a hostile ordinary Core Trace (not Recurrent Charge alone). */
export function loadoutCanProduceHostileOrdinaryTrace(
  ownedIds: readonly string[],
  definitions: readonly UniversalBoonDefinition[],
): boolean {
  const owned = new Set(ownedIds);
  const liveIds = new Set(
    definitions
      .filter((def) => owned.has(def.id))
      .map((def) => def.id),
  );
  return liveIds.has(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT)
    || liveIds.has(AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION)
    || liveIds.has(AFTERIMAGE_CORE_IDS.REFLEX_REMNANT)
    || owned.has(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT)
    || owned.has(AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION)
    || owned.has(AFTERIMAGE_CORE_IDS.REFLEX_REMNANT);
}

export function applyBrokenOutcomeOnRupture(
  cv: Sector3ConvergenceRuntimeState,
  cf: CounterfateRuntimeState,
  rupture: RuptureResult,
  enemyCycleIndex: number,
): { cv: Sector3ConvergenceRuntimeState; cf: CounterfateRuntimeState; stored: boolean } {
  if (!cf.fateboundInstanceId || !cf.fateboundUnitId) {
    return { cv, cf, stored: false };
  }
  if (rupture.targetId !== cf.fateboundUnitId) return { cv, cf, stored: false };
  if (rupture.sourceDefinitionId === CONVERGENCE_IDS.BROKEN_OUTCOME) {
    return { cv, cf, stored: false };
  }
  const windowKey = `${cf.fateboundInstanceId}:${enemyCycleIndex}`;
  let nextCv = cv;
  if (cv.brokenOutcomeWindowKey !== windowKey) {
    nextCv = {
      ...cv,
      brokenOutcomeWindowKey: windowKey,
      brokenOutcomeStoredThisWindow: false,
    };
  }
  if (nextCv.brokenOutcomeStoredThisWindow) return { cv: nextCv, cf, stored: false };
  const stored = storeReversal(cf, 10);
  if (stored.result.accepted <= 0 && stored.result.attempted <= 0) {
    return { cv: nextCv, cf: stored.cf, stored: false };
  }
  return {
    cf: stored.cf,
    stored: stored.result.accepted > 0 || stored.result.attempted > 0,
    cv: {
      ...nextCv,
      brokenOutcomeWindowKey: windowKey,
      brokenOutcomeStoredThisWindow: true,
    },
  };
}

export function applyBrokenOutcomeOnRelease(
  cv: Sector3ConvergenceRuntimeState,
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  release: ReversalReleaseResult,
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
): {
  cv: Sector3ConvergenceRuntimeState;
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  addition: FaultAdditionRecord | null;
  rupture: RuptureResult | null;
} {
  const lineageId = release.targetInstanceId
    ?? release.targetUnitId
    ?? ctx.rootActionId;
  if (cv.brokenOutcomeReleaseFaultApplied && cv.brokenOutcomeReleaseLineageId === lineageId) {
    return { cv, fl, intents, addition: null, rupture: null };
  }
  if (release.lineage.includes(CONVERGENCE_IDS.BROKEN_OUTCOME)) {
    return { cv, fl, intents, addition: null, rupture: null };
  }
  const targetId = release.targetUnitId;
  if (!legalHostile(intents, targetId)) {
    return {
      cv: {
        ...cv,
        brokenOutcomeReleaseLineageId: lineageId,
        brokenOutcomeReleaseFaultApplied: true,
      },
      fl,
      intents,
      addition: null,
      rupture: null,
    };
  }
  const amount = isCanonicalPlayerCounteredRelease(release) ? 3 : 2;
  const applied = addFault({
    state: fl,
    intents,
    ctx: {
      ...ctx,
      procDepth: Math.max(0, ctx.procDepth) + 1,
    },
    targetId: targetId!,
    amount,
    origin: 'CONVERGENCE',
    classificationIfRupture: 'CONVERGENCE',
    sourceDefinitionId: CONVERGENCE_IDS.BROKEN_OUTCOME,
    sourceEventId: `${lineageId}:${CONVERGENCE_IDS.BROKEN_OUTCOME}`,
    depth,
    allowRupture: true,
  });
  return {
    cv: {
      ...cv,
      brokenOutcomeReleaseLineageId: lineageId,
      brokenOutcomeReleaseFaultApplied: true,
    },
    fl: applied.state,
    intents: applied.intents,
    addition: applied.addition,
    rupture: applied.rupture,
  };
}

export function applyBreakingMeasureFinaleFault(
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
): {
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  additions: FaultAdditionRecord[];
  ruptures: RuptureResult[];
} {
  const primaryId = lockedPrimaryId(ctx);
  return applyConvergenceFaultMap({
    fl,
    intents,
    ctx,
    depth,
    primaryId: legalHostile(intents, primaryId) ? primaryId : null,
    primaryAmount: 2,
    otherAmount: 1,
    sourceDefinitionId: CONVERGENCE_IDS.BREAKING_MEASURE,
    sourceEventId: `${ctx.rootActionId}:${CONVERGENCE_IDS.BREAKING_MEASURE}`,
  });
}

export function noteBreakingMeasureRupture(
  cv: Sector3ConvergenceRuntimeState,
  rc: RitualCadenceRuntimeState,
  fromFinaleRoot: boolean,
): { cv: Sector3ConvergenceRuntimeState; rc: RitualCadenceRuntimeState } {
  if (cv.breakingMeasureRuptureAdvancedThisPlayerTurn) {
    return { cv, rc };
  }
  if (fromFinaleRoot) {
    return {
      rc,
      cv: {
        ...cv,
        breakingMeasureDeferredBeat: true,
        breakingMeasureRuptureAdvancedThisPlayerTurn: true,
      },
    };
  }
  return {
    rc: advanceMeasureWithoutFinale(rc),
    cv: {
      ...cv,
      breakingMeasureRuptureAdvancedThisPlayerTurn: true,
    },
  };
}

export function applyDeferredBreakingMeasureBeat(
  cv: Sector3ConvergenceRuntimeState,
  rc: RitualCadenceRuntimeState,
): { cv: Sector3ConvergenceRuntimeState; rc: RitualCadenceRuntimeState } {
  if (!cv.breakingMeasureDeferredBeat) return { cv, rc };
  return {
    rc: advanceMeasureWithoutFinale(rc),
    cv: {
      ...cv,
      breakingMeasureDeferredBeat: false,
    },
  };
}

export function applyEchoedFaultAfterTrace(
  cv: Sector3ConvergenceRuntimeState,
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
  targetIds: readonly string[],
  traceId: string,
): {
  cv: Sector3ConvergenceRuntimeState;
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  additions: FaultAdditionRecord[];
  ruptures: RuptureResult[];
} {
  let nextCv = cv;
  let nextFl = fl;
  let nextIntents = intents;
  const additions: FaultAdditionRecord[] = [];
  const ruptures: RuptureResult[] = [];
  const seen = new Set(cv.echoedFaultTraceTargetsThisPlayerTurn);
  for (const targetId of targetIds) {
    if (seen.has(targetId)) continue;
    if (!legalHostile(nextIntents, targetId)) continue;
    seen.add(targetId);
    const applied = addFault({
      state: nextFl,
      intents: nextIntents,
      ctx,
      targetId,
      amount: 1,
      origin: 'CONVERGENCE',
      classificationIfRupture: 'CONVERGENCE',
      sourceDefinitionId: CONVERGENCE_IDS.ECHOED_FAULT,
      sourceEventId: `${traceId}:${targetId}:${CONVERGENCE_IDS.ECHOED_FAULT}`,
      depth,
      allowRupture: true,
    });
    nextFl = applied.state;
    nextIntents = applied.intents;
    additions.push(applied.addition);
    if (applied.rupture) ruptures.push(applied.rupture);
  }
  nextCv = {
    ...nextCv,
    echoedFaultTraceTargetsThisPlayerTurn: [...seen],
  };
  return { cv: nextCv, fl: nextFl, intents: nextIntents, additions, ruptures };
}

export function echoedFaultTraceMultiplier(
  cv: Sector3ConvergenceRuntimeState,
  targetIds: readonly string[],
  currentTraceId: string,
): number {
  for (const targetId of targetIds) {
    const emp = cv.echoedFaultEmpowerments.find((row) => row.targetId === targetId);
    if (!emp) continue;
    if (emp.armedAfterTraceId !== null && emp.armedAfterTraceId === currentTraceId) continue;
    return 1.5;
  }
  return 1;
}

export function armEchoedFaultFromRupture(
  cv: Sector3ConvergenceRuntimeState,
  targetId: string,
  currentTraceId: string | null,
): Sector3ConvergenceRuntimeState {
  const rest = cv.echoedFaultEmpowerments.filter((row) => row.targetId !== targetId);
  return {
    ...cv,
    echoedFaultEmpowerments: [
      ...rest,
      { targetId, armedAfterTraceId: currentTraceId },
    ],
  };
}

export function applyCriticalPressureFault(
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
): {
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  addition: FaultAdditionRecord | null;
  rupture: RuptureResult | null;
} {
  const primaryId = lockedPrimaryId(ctx);
  if (!legalHostile(intents, primaryId)) {
    return { fl, intents, addition: null, rupture: null };
  }
  const applied = addFault({
    state: fl,
    intents,
    ctx,
    targetId: primaryId!,
    amount: 2,
    origin: 'CONVERGENCE',
    classificationIfRupture: 'CONVERGENCE',
    sourceDefinitionId: CONVERGENCE_IDS.CRITICAL_PRESSURE,
    sourceEventId: `${ctx.rootActionId}:${CONVERGENCE_IDS.CRITICAL_PRESSURE}`,
    depth,
    allowRupture: true,
  });
  return {
    fl: applied.state,
    intents: applied.intents,
    addition: applied.addition,
    rupture: applied.rupture,
  };
}

export function tryCriticalPressureFleetingRestore(
  cv: Sector3ConvergenceRuntimeState,
  sp: StillpointRuntimeState,
  grantFleeting: GrantFleetingFn,
  args: {
    rootActionId: string;
    causedRupture: boolean;
    chargeSource: StillnessChargeSource | null | undefined;
  },
): {
  cv: Sector3ConvergenceRuntimeState;
  sp: StillpointRuntimeState;
  restored: boolean;
} {
  if (cv.criticalPressureRestoreUsedThisPlayerTurn) {
    return { cv, sp, restored: false };
  }
  if (!args.causedRupture) return { cv, sp, restored: false };
  if (args.chargeSource !== 'NATIVE') return { cv, sp, restored: false };
  const granted = grantFleeting(sp, CONVERGENCE_IDS.CRITICAL_PRESSURE, {
    phase: sp.playerTurnOpen ? 'PLAYER_CONTROL' : 'ENEMY_CYCLE',
    sourceRootId: args.rootActionId,
    sourceLineage: [args.rootActionId, CONVERGENCE_IDS.CRITICAL_PRESSURE],
  });
  if (!granted.granted && !granted.refreshed) {
    return { cv, sp: granted.state, restored: false };
  }
  return {
    sp: granted.state,
    restored: true,
    cv: {
      ...cv,
      criticalPressureRestoreUsedThisPlayerTurn: true,
    },
  };
}

export function applySplitSeamNativeTransfer(
  cv: Sector3ConvergenceRuntimeState,
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ww: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
  addition: FaultAdditionRecord,
): {
  cv: Sector3ConvergenceRuntimeState;
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  transfer: FaultAdditionRecord | null;
  rupture: RuptureResult | null;
} {
  if (cv.splitSeamTransferRootId === ctx.rootActionId) {
    return { cv, fl, intents, transfer: null, rupture: null };
  }
  if (addition.origin !== 'CORE') {
    return { cv, fl, intents, transfer: null, rupture: null };
  }
  if (addition.sourceDefinitionId === CONVERGENCE_IDS.SPLIT_SEAM) {
    return { cv, fl, intents, transfer: null, rupture: null };
  }
  if (!isPrimaryEndpoint(ww, addition.targetId)) {
    return { cv, fl, intents, transfer: null, rupture: null };
  }
  const partner = woundlinkPartner(ww, addition.targetId);
  if (!partner) return { cv, fl, intents, transfer: null, rupture: null };
  const amount = selfLinkScaledFault(1, ww.selfLink);
  const nextCv = {
    ...cv,
    splitSeamTransferRootId: ctx.rootActionId,
  };
  if (amount <= 0) {
    return { cv: nextCv, fl, intents, transfer: null, rupture: null };
  }
  if (!legalHostile(intents, partner)) {
    return { cv: nextCv, fl, intents, transfer: null, rupture: null };
  }
  const applied = addFault({
    state: fl,
    intents,
    ctx,
    targetId: partner,
    amount,
    origin: 'CONVERGENCE',
    classificationIfRupture: 'CONVERGENCE',
    sourceDefinitionId: CONVERGENCE_IDS.SPLIT_SEAM,
    sourceEventId: `${ctx.rootActionId}:${addition.targetId}:${CONVERGENCE_IDS.SPLIT_SEAM}`,
    depth,
    allowRupture: true,
  });
  return {
    cv: nextCv,
    fl: applied.state,
    intents: applied.intents,
    transfer: applied.addition,
    rupture: applied.rupture,
  };
}

export function applySplitSeamRupture(
  cv: Sector3ConvergenceRuntimeState,
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ww: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
  rupture: RuptureResult,
  partnerSnapshot: string | null,
): {
  cv: Sector3ConvergenceRuntimeState;
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  ww: WoundweaveRuntimeState;
  transfer: FaultAdditionRecord | null;
  rupture: RuptureResult | null;
} {
  if (rupture.sourceDefinitionId === CONVERGENCE_IDS.SPLIT_SEAM) {
    return { cv, fl, intents, ww, transfer: null, rupture: null };
  }
  if (!isPrimaryEndpoint(ww, rupture.targetId) && !partnerSnapshot) {
    return { cv, fl, intents, ww, transfer: null, rupture: null };
  }
  const partner = partnerSnapshot
    ?? woundlinkPartner(ww, rupture.targetId);
  const extensionThrough = ww.playerTurnIndex + 1;
  let nextCv: Sector3ConvergenceRuntimeState = {
    ...cv,
    splitSeamExtensionThroughPlayerTurn: cv.splitSeamExtensionThroughPlayerTurn == null
      ? extensionThrough
      : Math.max(cv.splitSeamExtensionThroughPlayerTurn, extensionThrough),
  };
  let nextWw = ww;
  const stillLinked = partner != null && (
    ww.selfLink
      ? ww.endpointA === partner || ww.endpointA === rupture.targetId
      : isPrimaryEndpoint(ww, partner) || partner === woundlinkPartner(ww, rupture.targetId)
  );
  if (stillLinked || partnerSnapshot) {
    const expiresAt = Math.max(ww.expiresAtPlayerTurnStart, ww.playerTurnIndex + 2);
    nextWw = { ...ww, expiresAtPlayerTurnStart: expiresAt };
  }
  if (!partner) {
    return { cv: nextCv, fl, intents, ww: nextWw, transfer: null, rupture: null };
  }
  const amount = selfLinkScaledFault(2, ww.selfLink);
  if (amount <= 0 || !legalHostile(intents, partner)) {
    return { cv: nextCv, fl, intents, ww: nextWw, transfer: null, rupture: null };
  }
  const applied = addFault({
    state: fl,
    intents,
    ctx,
    targetId: partner,
    amount,
    origin: 'CONVERGENCE',
    classificationIfRupture: 'CONVERGENCE',
    sourceDefinitionId: CONVERGENCE_IDS.SPLIT_SEAM,
    sourceEventId: `${rupture.sourceEventId}:${partner}:${CONVERGENCE_IDS.SPLIT_SEAM}`,
    depth,
    allowRupture: true,
  });
  return {
    cv: nextCv,
    fl: applied.state,
    intents: applied.intents,
    ww: nextWw,
    transfer: applied.addition,
    rupture: applied.rupture,
  };
}

export function applyPainForetoldWakeStore(
  cv: Sector3ConvergenceRuntimeState,
  cf: CounterfateRuntimeState,
  wakeValue: number,
): { cv: Sector3ConvergenceRuntimeState; cf: CounterfateRuntimeState; stored: number } {
  if (cv.painForetoldWakeStoreUsedThisPlayerTurn) {
    return { cv, cf, stored: 0 };
  }
  const amount = Math.min(10, Math.floor(wakeValue * 0.5));
  if (amount <= 0) return { cv, cf, stored: 0 };
  const stored = storeReversal(cf, amount);
  if (stored.result.accepted <= 0) {
    return { cv, cf: stored.cf, stored: 0 };
  }
  return {
    cf: stored.cf,
    stored: stored.result.accepted,
    cv: {
      ...cv,
      painForetoldWakeStoreUsedThisPlayerTurn: true,
    },
  };
}

export function painForetoldHostileWakeMultiplier(
  cv: Sector3ConvergenceRuntimeState,
  lossRootId: string,
  fatebound: boolean,
): { cv: Sector3ConvergenceRuntimeState; factor: number; replace: boolean } {
  if (!fatebound) return { cv, factor: 1, replace: false };
  if (cv.painForetoldHostileRootIds.includes(lossRootId)) {
    return { cv, factor: 1, replace: false };
  }
  return {
    factor: 1.5,
    replace: true,
    cv: {
      ...cv,
      painForetoldHostileRootIds: [...cv.painForetoldHostileRootIds, lossRootId],
    },
  };
}

export function applyPulseRiteOverdraw(
  cv: Sector3ConvergenceRuntimeState,
  rc: RitualCadenceRuntimeState,
): { cv: Sector3ConvergenceRuntimeState; rc: RitualCadenceRuntimeState; advanced: boolean } {
  if (cv.pulseRiteOverdrawUsedThisPlayerTurn) {
    return { cv, rc, advanced: false };
  }
  return {
    rc: advanceMeasureWithoutFinale(rc),
    advanced: true,
    cv: {
      ...cv,
      pulseRiteOverdrawUsedThisPlayerTurn: true,
    },
  };
}

export function applyPulseRiteFinaleCarry(
  cv: Sector3ConvergenceRuntimeState,
  sw: SoulwakeRuntimeState,
  requestCarry: ResidualCarryFn,
): {
  cv: Sector3ConvergenceRuntimeState;
  sw: SoulwakeRuntimeState;
  accepted: boolean;
  amount: number;
} {
  if (cv.pulseRiteFinaleCarryUsedThisPlayerTurn) {
    return { cv, sw, accepted: false, amount: 0 };
  }
  if (sw.activeWake <= 0 || sw.activeWakeKind === 'NONE') {
    return { cv, sw, accepted: false, amount: 0 };
  }
  const requested = Math.floor(sw.activeWake * 0.5);
  const result = requestCarry(sw, {
    sourceId: CONVERGENCE_IDS.PULSE_RITE,
    amount: requested,
    triggerId: CONVERGENCE_IDS.PULSE_RITE,
    sourceWakeKind: sw.activeWakeKind,
  });
  if (!result.accepted) {
    return { cv, sw: result.state, accepted: false, amount: 0 };
  }
  return {
    sw: result.state,
    accepted: true,
    amount: result.amount,
    cv: {
      ...cv,
      pulseRiteFinaleCarryUsedThisPlayerTurn: true,
    },
  };
}

export function notePhantomPainMint(
  cv: Sector3ConvergenceRuntimeState,
  traceId: string,
  wakeMeta: {
    wakeValueAtCommit: number;
    wakeGenerationId: number;
    sourceRootId: string;
  },
): { cv: Sector3ConvergenceRuntimeState; minted: boolean; powerMultiplier: number } {
  if (cv.phantomPainMintUsedThisPlayerTurn) {
    return { cv, minted: false, powerMultiplier: 1 };
  }
  return {
    minted: true,
    powerMultiplier: 1.5,
    cv: {
      ...cv,
      phantomPainMintUsedThisPlayerTurn: true,
      phantomPainTraces: [
        ...cv.phantomPainTraces,
        {
          traceId,
          wakeValueAtCommit: wakeMeta.wakeValueAtCommit,
          wakeGenerationId: wakeMeta.wakeGenerationId,
          sourceRootId: wakeMeta.sourceRootId,
          restored: false,
        },
      ],
    },
  };
}

export function resolvePhantomPain(
  cv: Sector3ConvergenceRuntimeState,
  sw: SoulwakeRuntimeState,
  traceId: string,
  injectWake: ImmediateResidualFn,
): { cv: Sector3ConvergenceRuntimeState; sw: SoulwakeRuntimeState; injected: number } {
  const meta = cv.phantomPainTraces.find((row) => row.traceId === traceId && !row.restored);
  if (!meta) return { cv, sw, injected: 0 };
  const amount = Math.min(10, Math.floor(meta.wakeValueAtCommit * 0.5));
  const nextSw = amount > 0
    ? injectWake(sw, amount, CONVERGENCE_IDS.PHANTOM_PAIN)
    : sw;
  return {
    sw: nextSw,
    injected: amount,
    cv: {
      ...cv,
      phantomPainTraces: cv.phantomPainTraces.map((row) => (
        row.traceId === traceId ? { ...row, restored: true } : row
      )),
    },
  };
}

export function applyHeldBreathOverdraw(
  cv: Sector3ConvergenceRuntimeState,
  sp: StillpointRuntimeState,
  grantFleeting: GrantFleetingFn,
): {
  cv: Sector3ConvergenceRuntimeState;
  sp: StillpointRuntimeState;
  granted: boolean;
} {
  if (cv.heldBreathOverdrawUsedThisPlayerTurn) {
    return { cv, sp, granted: false };
  }
  const result = grantFleeting(sp, CONVERGENCE_IDS.HELD_BREATH, {
    phase: sp.playerTurnOpen ? 'PLAYER_CONTROL' : 'ENEMY_CYCLE',
    sourceLineage: [CONVERGENCE_IDS.HELD_BREATH],
  });
  const granted = result.granted || result.refreshed;
  return {
    sp: result.state,
    granted,
    cv: {
      ...cv,
      heldBreathOverdrawUsedThisPlayerTurn: true,
    },
  };
}

export function applyHeldBreathEndTurnCarry(
  cv: Sector3ConvergenceRuntimeState,
  sw: SoulwakeRuntimeState,
  requestCarry: ResidualCarryFn,
  args: { reason: PlayerTurnEndReason; usableAp: number },
): {
  cv: Sector3ConvergenceRuntimeState;
  sw: SoulwakeRuntimeState;
  accepted: boolean;
  amount: number;
} {
  if (cv.heldBreathEndTurnCarryUsedThisPlayerTurn) {
    return { cv, sw, accepted: false, amount: 0 };
  }
  if (args.reason !== 'VOLUNTARY') return { cv, sw, accepted: false, amount: 0 };
  if (args.usableAp < 1) return { cv, sw, accepted: false, amount: 0 };
  if (sw.activeWake <= 0 || sw.activeWakeKind === 'NONE') {
    return { cv, sw, accepted: false, amount: 0 };
  }
  const requested = Math.floor(sw.activeWake * 0.5);
  const result = requestCarry(sw, {
    sourceId: CONVERGENCE_IDS.HELD_BREATH,
    amount: requested,
    triggerId: CONVERGENCE_IDS.HELD_BREATH,
    sourceWakeKind: sw.activeWakeKind,
  });
  if (!result.accepted) {
    return { cv, sw: result.state, accepted: false, amount: 0 };
  }
  return {
    sw: result.state,
    accepted: true,
    amount: result.amount,
    cv: {
      ...cv,
      heldBreathEndTurnCarryUsedThisPlayerTurn: true,
    },
  };
}

export function applySympatheticWoundPacket(
  cv: Sector3ConvergenceRuntimeState,
  ww: WoundweaveRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  wakeValueAtCommit: number,
): {
  cv: Sector3ConvergenceRuntimeState;
  partnerId: string | null;
  occultDamage: number;
} {
  if (cv.sympatheticWoundPacketUsedThisPlayerTurn) {
    return { cv, partnerId: null, occultDamage: 0 };
  }
  const affected = affectedIds(ctx);
  const primaryLocked = lockedPrimaryId(ctx);
  const source = (
    primaryLocked && isPrimaryEndpoint(ww, primaryLocked) && affected.includes(primaryLocked)
      ? primaryLocked
      : affected.find((id) => isPrimaryEndpoint(ww, id))
  ) ?? null;
  if (!source) return { cv, partnerId: null, occultDamage: 0 };
  const partner = woundlinkPartner(ww, source);
  if (!partner || !legalHostile(intents, partner)) {
    return { cv, partnerId: null, occultDamage: 0 };
  }
  const base = Math.floor(wakeValueAtCommit * 0.5);
  const occultDamage = selfLinkScaledFault(base, ww.selfLink);
  if (occultDamage <= 0) {
    return {
      partnerId: partner,
      occultDamage: 0,
      cv: {
        ...cv,
        sympatheticWoundPacketUsedThisPlayerTurn: true,
      },
    };
  }
  return {
    partnerId: partner,
    occultDamage,
    cv: {
      ...cv,
      sympatheticWoundPacketUsedThisPlayerTurn: true,
    },
  };
}

export function applySympatheticWoundCarry(
  cv: Sector3ConvergenceRuntimeState,
  sw: SoulwakeRuntimeState,
  requestCarry: ResidualCarryFn,
): {
  cv: Sector3ConvergenceRuntimeState;
  sw: SoulwakeRuntimeState;
  accepted: boolean;
  amount: number;
} {
  if (cv.sympatheticWoundCarryUsedThisPlayerTurn) {
    return { cv, sw, accepted: false, amount: 0 };
  }
  if (sw.activeWake <= 0 || sw.activeWakeKind === 'NONE') {
    return { cv, sw, accepted: false, amount: 0 };
  }
  const requested = Math.floor(sw.activeWake * 0.5);
  const result = requestCarry(sw, {
    sourceId: CONVERGENCE_IDS.SYMPATHETIC_WOUND,
    amount: requested,
    triggerId: CONVERGENCE_IDS.SYMPATHETIC_WOUND,
    sourceWakeKind: sw.activeWakeKind,
  });
  if (!result.accepted) {
    return { cv, sw: result.state, accepted: false, amount: 0 };
  }
  return {
    sw: result.state,
    accepted: true,
    amount: result.amount,
    cv: {
      ...cv,
      sympatheticWoundCarryUsedThisPlayerTurn: true,
    },
  };
}

export function applyLivingFault(
  cv: Sector3ConvergenceRuntimeState,
  fl: FaultlineRuntimeState,
  intents: HostileIntentSnapshot[],
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
): {
  cv: Sector3ConvergenceRuntimeState;
  fl: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  additions: FaultAdditionRecord[];
  ruptures: RuptureResult[];
} {
  if (cv.livingFaultApplyUsedThisPlayerTurn) {
    return { cv, fl, intents, additions: [], ruptures: [] };
  }
  const primaryId = lockedPrimaryId(ctx);
  if (!legalHostile(intents, primaryId) && affectedIds(ctx).every((id) => !legalHostile(intents, id))) {
    return { cv, fl, intents, additions: [], ruptures: [] };
  }
  const applied = applyConvergenceFaultMap({
    fl,
    intents,
    ctx,
    depth,
    primaryId: legalHostile(intents, primaryId) ? primaryId : null,
    primaryAmount: 2,
    otherAmount: 1,
    sourceDefinitionId: CONVERGENCE_IDS.LIVING_FAULT,
    sourceEventId: `${ctx.rootActionId}:${CONVERGENCE_IDS.LIVING_FAULT}`,
  });
  return {
    ...applied,
    cv: {
      ...cv,
      livingFaultApplyUsedThisPlayerTurn: true,
    },
  };
}

export function applyLivingFaultCarryOnRupture(
  cv: Sector3ConvergenceRuntimeState,
  sw: SoulwakeRuntimeState,
  requestCarry: ResidualCarryFn,
): {
  cv: Sector3ConvergenceRuntimeState;
  sw: SoulwakeRuntimeState;
  accepted: boolean;
  amount: number;
} {
  if (cv.livingFaultCarryUsedThisPlayerTurn) {
    return { cv, sw, accepted: false, amount: 0 };
  }
  if (sw.activeWake <= 0 || sw.activeWakeKind === 'NONE') {
    return { cv, sw, accepted: false, amount: 0 };
  }
  const requested = Math.floor(sw.activeWake * 0.5);
  const result = requestCarry(sw, {
    sourceId: CONVERGENCE_IDS.LIVING_FAULT,
    amount: requested,
    triggerId: CONVERGENCE_IDS.LIVING_FAULT,
    sourceWakeKind: sw.activeWakeKind,
  });
  if (!result.accepted) {
    return { cv, sw: result.state, accepted: false, amount: 0 };
  }
  return {
    sw: result.state,
    accepted: true,
    amount: result.amount,
    cv: {
      ...cv,
      livingFaultCarryUsedThisPlayerTurn: true,
    },
  };
}
