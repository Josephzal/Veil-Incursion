import type { InstinctGrade, NineStrainRuntimeState } from '../../types/nineStrain';
import type {
  ChosenFatePreview,
  CombatDepthBand,
  CounterfateRuntimeState,
  HostileIntentSnapshot,
  ReversalReleaseReason,
  ReversalReleaseResult,
  ReversalStoreResult,
} from '../../types/counterfate';
import {
  COUNTERFATE_CORE_IDS,
  COUNTERFATE_MANIFESTATION_ID,
  COUNTERFATE_SUPPORT_IDS,
  COUNTERFATE_VERDICT_ID,
} from '../../types/counterfate';
import {
  applyReversalStore,
  reversalCapForDepth,
  reversalPacket,
  roundCounterfateAmount,
} from './counterfateMath';
import { mintIntentInstanceId, nextHighestRevealed, nextIntentGeneration, retireIntentGeneration, selectFateboundCandidate } from './intentIdentity';

export function createDefaultCounterfateState(depth: CombatDepthBand = 1): CounterfateRuntimeState {
  return {
    combatDepth: depth,
    fateboundInstanceId: null,
    fateboundUnitId: null,
    concealed: false,
    rawReversal: 0,
    depthCap: reversalCapForDepth(depth),
    chosenFateUsedThisTurn: false,
    noFutureJumpsThisEnemyCycle: 0,
    preemptiveConsumedInstanceId: null,
    finalRevisionCapture: null,
    lastRelease: null,
    refusalUsedThisTurn: false,
    borrowedEndingRootId: null,
    borrowedEndingAmount: 0,
    borrowedEndingMajor: false,
    secondReflexUsedThisCombatCycle: false,
    intentGenerationByUnit: {},
  };
}

export function counterfateOf(state: NineStrainRuntimeState): CounterfateRuntimeState {
  return state.counterfate ?? createDefaultCounterfateState();
}

export function withCounterfate(
  state: NineStrainRuntimeState,
  next: CounterfateRuntimeState,
): NineStrainRuntimeState {
  return { ...state, counterfate: next };
}

export function ownedCounterfateIds(state: NineStrainRuntimeState): string[] {
  return [
    ...Object.values(state.cores).filter((id): id is string => typeof id === 'string'),
    ...state.supports,
    ...state.manifestations,
    ...(state.boundVerdict ? [state.boundVerdict] : []),
  ].filter((id) => id.startsWith('CF_'));
}

export function hasReversalProducer(state: NineStrainRuntimeState): boolean {
  const cores = Object.values(state.cores);
  return cores.some((id) => id && Object.values(COUNTERFATE_CORE_IDS).includes(id as typeof COUNTERFATE_CORE_IDS[keyof typeof COUNTERFATE_CORE_IDS]));
}

export function syncIntentIdentities(
  cf: CounterfateRuntimeState,
  intents: readonly Omit<HostileIntentSnapshot, 'intentInstanceId'>[],
): { cf: CounterfateRuntimeState; snapshots: HostileIntentSnapshot[] } {
  const generations = { ...cf.intentGenerationByUnit };
  const present = new Set(intents.map((row) => row.unitId));
  for (const unitId of Object.keys(generations)) {
    if (!present.has(unitId)) {
      const retired = retireIntentGeneration(generations[unitId]);
      if (retired) generations[unitId] = retired;
    }
  }
  const snapshots = intents.map((row) => {
    const next = nextIntentGeneration(generations[row.unitId], row.intentKind);
    generations[row.unitId] = next;
    return {
      ...row,
      intentInstanceId: mintIntentInstanceId(row.unitId, row.intentKind, next.generation),
    };
  });
  return { cf: { ...cf, intentGenerationByUnit: generations }, snapshots };
}

export function retireUnitIntentIdentity(
  cf: CounterfateRuntimeState,
  unitId: string | null,
): CounterfateRuntimeState {
  if (!unitId) return cf;
  const retired = retireIntentGeneration(cf.intentGenerationByUnit[unitId]);
  if (!retired) return cf;
  return {
    ...cf,
    intentGenerationByUnit: { ...cf.intentGenerationByUnit, [unitId]: retired },
  };
}

function findBound(
  intents: readonly HostileIntentSnapshot[],
  instanceId: string | null,
): HostileIntentSnapshot | null {
  if (!instanceId) return null;
  return intents.find((row) => row.intentInstanceId === instanceId) ?? null;
}

export function bindFateboundIfMissing(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
  depth: CombatDepthBand,
): CounterfateRuntimeState {
  const current = findBound(intents, cf.fateboundInstanceId);
  if (current?.alive) {
    return {
      ...cf,
      combatDepth: depth,
      depthCap: reversalCapForDepth(depth),
      fateboundUnitId: current.unitId,
      concealed: jammed || current.concealed,
    };
  }
  const pick = selectFateboundCandidate(intents, jammed);
  if (!pick) {
    return { ...cf, fateboundInstanceId: null, fateboundUnitId: null, concealed: false };
  }
  return {
    ...cf,
    combatDepth: depth,
    depthCap: reversalCapForDepth(depth),
    fateboundInstanceId: pick.intentInstanceId,
    fateboundUnitId: pick.unitId,
    concealed: jammed || pick.concealed,
  };
}

export function selectFateboundAtPlayerTurn(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
  depth: CombatDepthBand,
  alreadySelectedReplacement = false,
): CounterfateRuntimeState {
  const next = {
    ...cf,
    combatDepth: depth,
    depthCap: reversalCapForDepth(depth),
    chosenFateUsedThisTurn: false,
    refusalUsedThisTurn: false,
    borrowedEndingRootId: null,
    borrowedEndingAmount: 0,
    borrowedEndingMajor: false,
  };
  const current = findBound(intents, next.fateboundInstanceId);
  if (current?.alive) {
    return {
      ...next,
      fateboundUnitId: current.unitId,
      concealed: jammed || current.concealed,
    };
  }
  if (alreadySelectedReplacement) {
    return { ...next, fateboundInstanceId: null, fateboundUnitId: null, concealed: false };
  }
  const pick = selectFateboundCandidate(intents, jammed);
  if (!pick) {
    return { ...next, fateboundInstanceId: null, fateboundUnitId: null, concealed: false, rawReversal: 0 };
  }
  return {
    ...next,
    fateboundInstanceId: pick.intentInstanceId,
    fateboundUnitId: pick.unitId,
    concealed: jammed || pick.concealed,
  };
}

export function resetEnemyCycleCounterfate(cf: CounterfateRuntimeState): CounterfateRuntimeState {
  return {
    ...cf,
    noFutureJumpsThisEnemyCycle: 0,
    secondReflexUsedThisCombatCycle: false,
  };
}

export function storeReversal(
  cf: CounterfateRuntimeState,
  attempted: number,
): { cf: CounterfateRuntimeState; result: ReversalStoreResult } {
  if (!cf.fateboundInstanceId) {
    return {
      cf,
      result: { attempted: roundCounterfateAmount(attempted), accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal },
    };
  }
  const result = applyReversalStore(cf.rawReversal, attempted, cf.depthCap);
  return { cf: { ...cf, rawReversal: result.rawAfter }, result };
}

function bindNext(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  excludeId: string | null,
  seedRaw: number,
): CounterfateRuntimeState {
  const next = nextHighestRevealed(intents, excludeId);
  if (!next) {
    return {
      ...cf,
      fateboundInstanceId: null,
      fateboundUnitId: null,
      concealed: false,
      rawReversal: 0,
    };
  }
  const seeded = applyReversalStore(0, seedRaw, cf.depthCap);
  return {
    ...cf,
    fateboundInstanceId: next.intentInstanceId,
    fateboundUnitId: next.unitId,
    concealed: next.concealed,
    rawReversal: seeded.rawAfter,
  };
}

export function releaseFatebound(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  reason: ReversalReleaseReason,
  lineage: readonly string[],
  options: {
    preemptive?: boolean;
    skipNoFuture?: boolean;
    ownsNoFuture?: boolean;
    ownsPreemptive?: boolean;
    protectedPhase?: boolean;
  } = {},
): { cf: CounterfateRuntimeState; release: ReversalReleaseResult } {
  const bound = findBound(intents, cf.fateboundInstanceId);
  const raw = cf.rawReversal;
  if (raw <= 0 || !cf.fateboundInstanceId) {
    const empty: ReversalReleaseResult = {
      reason,
      multiplier: reason === 'PLAYER_PREVENTED' ? 1.5 : 1,
      raw: 0,
      packet: 0,
      targetInstanceId: cf.fateboundInstanceId,
      targetUnitId: cf.fateboundUnitId,
      lineage,
      countered: false,
      interruptProgress: 0,
      supplementalPacket: 0,
    };
    return { cf: { ...cf, lastRelease: empty }, release: empty };
  }

  if (options.preemptive && options.ownsPreemptive) {
    const base = reversalPacket(raw, 1);
    const protectedPhase = Boolean(options.protectedPhase || bound?.protectedPhase);
    const killed = !protectedPhase && (bound?.hp ?? 0) > 0 && base >= (bound?.hp ?? 0);
    const authored = bound?.authoredCounter === true;
    const countered = !protectedPhase && (killed || authored);
    let supplemental = 0;
    const packet = base + (countered ? (supplemental = reversalPacket(raw, 0.5)) : 0);
    const interruptProgress = protectedPhase ? 1 : 0;
    const release: ReversalReleaseResult = {
      reason: countered ? 'PLAYER_PREVENTED' : reason,
      multiplier: countered ? 1.5 : 1,
      raw,
      packet,
      targetInstanceId: cf.fateboundInstanceId,
      targetUnitId: cf.fateboundUnitId,
      lineage,
      countered,
      interruptProgress,
      supplementalPacket: supplemental,
    };
    let next: CounterfateRuntimeState = {
      ...cf,
      rawReversal: 0,
      preemptiveConsumedInstanceId: cf.fateboundInstanceId,
      lastRelease: release,
    };
    if (countered && options.ownsNoFuture && !options.skipNoFuture && next.noFutureJumpsThisEnemyCycle < 2) {
      const carry = roundCounterfateAmount(raw * 0.5);
      next = bindNext(next, intents, cf.fateboundInstanceId, carry);
      next = { ...next, noFutureJumpsThisEnemyCycle: next.noFutureJumpsThisEnemyCycle + 1 };
    } else if (countered) {
      next = bindNext(next, intents, cf.fateboundInstanceId, 0);
    }
    return { cf: next, release };
  }

  const multiplier = reason === 'PLAYER_PREVENTED' ? 1.5 : 1;
  const packet = options.protectedPhase ? 0 : reversalPacket(raw, multiplier);
  const release: ReversalReleaseResult = {
    reason,
    multiplier,
    raw,
    packet,
    targetInstanceId: cf.fateboundInstanceId,
    targetUnitId: cf.fateboundUnitId,
    lineage,
    countered: false,
    interruptProgress: options.protectedPhase ? 1 : 0,
    supplementalPacket: 0,
  };
  let next: CounterfateRuntimeState = {
    ...cf,
    rawReversal: 0,
    lastRelease: release,
    fateboundInstanceId: null,
    fateboundUnitId: null,
    concealed: false,
  };
  if (reason === 'RESOLVED') {
    next = { ...next, noFutureJumpsThisEnemyCycle: next.noFutureJumpsThisEnemyCycle };
  }
  return { cf: next, release };
}

export function previewChosenFate(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  targetInstanceId: string,
): ChosenFatePreview {
  if (cf.chosenFateUsedThisTurn) {
    return { eligible: false, currentRaw: cf.rawReversal, transferred: 0, lost: 0, cappedTransferred: 0, rejection: 'already-used' };
  }
  const target = intents.find((row) => row.intentInstanceId === targetInstanceId);
  if (!target?.alive) {
    return { eligible: false, currentRaw: cf.rawReversal, transferred: 0, lost: 0, cappedTransferred: 0, rejection: 'missing-target' };
  }
  if (target.concealed) {
    return { eligible: false, currentRaw: cf.rawReversal, transferred: 0, lost: 0, cappedTransferred: 0, rejection: 'concealed' };
  }
  if (target.intentInstanceId === cf.fateboundInstanceId) {
    return { eligible: false, currentRaw: cf.rawReversal, transferred: 0, lost: 0, cappedTransferred: 0, rejection: 'same-intent' };
  }
  const transferred = roundCounterfateAmount(cf.rawReversal * 0.75);
  const lost = cf.rawReversal - transferred;
  const capped = applyReversalStore(0, transferred, cf.depthCap);
  return {
    eligible: true,
    currentRaw: cf.rawReversal,
    transferred,
    lost,
    cappedTransferred: capped.rawAfter,
    rejection: null,
  };
}

export function confirmChosenFate(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  targetInstanceId: string,
): { cf: CounterfateRuntimeState; preview: ChosenFatePreview } {
  const preview = previewChosenFate(cf, intents, targetInstanceId);
  if (!preview.eligible) return { cf, preview };
  const target = intents.find((row) => row.intentInstanceId === targetInstanceId)!;
  return {
    preview,
    cf: {
      ...cf,
      fateboundInstanceId: target.intentInstanceId,
      fateboundUnitId: target.unitId,
      concealed: target.concealed,
      rawReversal: preview.cappedTransferred,
      chosenFateUsedThisTurn: true,
    },
  };
}

export function storeSeveredOutcome(
  cf: CounterfateRuntimeState,
  nativeDirectToSource: number,
): { cf: CounterfateRuntimeState; result: ReversalStoreResult } {
  const attempted = Math.min(12, roundCounterfateAmount(nativeDirectToSource * 0.3));
  if (attempted <= 0) {
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal } };
  }
  return storeReversal(cf, attempted);
}

export function storeRefusalPattern(
  cf: CounterfateRuntimeState,
  actualApPaid: number,
): { cf: CounterfateRuntimeState; result: ReversalStoreResult; consumedGuard: boolean } {
  if (cf.refusalUsedThisTurn) {
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal }, consumedGuard: false };
  }
  if (!cf.fateboundInstanceId) {
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal }, consumedGuard: false };
  }
  const stored = storeReversal(cf, 5 + (3 * actualApPaid));
  return { ...stored, cf: { ...stored.cf, refusalUsedThisTurn: true }, consumedGuard: true };
}

export function storeSecondReflex(
  cf: CounterfateRuntimeState,
  grade: InstinctGrade,
): { cf: CounterfateRuntimeState; result: ReversalStoreResult } {
  if (grade === 'FAILED' || cf.secondReflexUsedThisCombatCycle) {
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal } };
  }
  const amount = grade === 'PERFECT' ? 15 : grade === 'CLEAN' ? 10 : 6;
  const stored = storeReversal(cf, amount);
  return { ...stored, cf: { ...stored.cf, secondReflexUsedThisCombatCycle: true } };
}

export function storeBorrowedEnding(
  cf: CounterfateRuntimeState,
  rootActionId: string | null,
  major: boolean,
): { cf: CounterfateRuntimeState; result: ReversalStoreResult } {
  const amount = major ? 14 : 8;
  if (cf.borrowedEndingRootId && cf.borrowedEndingRootId !== rootActionId && cf.borrowedEndingAmount > 0) {
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal } };
  }
  if (cf.borrowedEndingRootId === rootActionId && cf.borrowedEndingAmount > 0) {
    if (major && !cf.borrowedEndingMajor) {
      const extra = storeReversal(cf, amount - cf.borrowedEndingAmount);
      return {
        ...extra,
        cf: { ...extra.cf, borrowedEndingAmount: amount, borrowedEndingMajor: true },
      };
    }
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal } };
  }
  if (cf.borrowedEndingAmount > 0 && cf.borrowedEndingRootId !== rootActionId) {
    return { cf, result: { attempted: 0, accepted: 0, wastedOverCap: 0, rawAfter: cf.rawReversal } };
  }
  const stored = storeReversal(cf, amount);
  return {
    ...stored,
    cf: {
      ...stored.cf,
      borrowedEndingRootId: rootActionId,
      borrowedEndingAmount: amount,
      borrowedEndingMajor: major,
    },
  };
}

export function captureFinalRevision(
  cf: CounterfateRuntimeState,
  rootActionId: string,
): CounterfateRuntimeState {
  if (!cf.fateboundInstanceId || cf.finalRevisionCapture?.rootActionId === rootActionId) return cf;
  return {
    ...cf,
    finalRevisionCapture: {
      rootActionId,
      instanceId: cf.fateboundInstanceId,
      unitId: cf.fateboundUnitId ?? '',
      raw: cf.rawReversal,
      consumed: false,
    },
  };
}

export function resolveFinalRevision(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  rootActionId: string,
  lineage: readonly string[],
): { cf: CounterfateRuntimeState; release: ReversalReleaseResult | null } {
  const capture = cf.finalRevisionCapture;
  if (!capture || capture.rootActionId !== rootActionId || capture.consumed) {
    return { cf, release: null };
  }
  const raw = capture.raw;
  const packet = reversalPacket(raw, 2);
  const release: ReversalReleaseResult = {
    reason: 'PLAYER_PREVENTED',
    multiplier: 2,
    raw,
    packet,
    targetInstanceId: capture.instanceId,
    targetUnitId: capture.unitId,
    lineage: [...lineage, COUNTERFATE_VERDICT_ID],
    countered: false,
    interruptProgress: 0,
    supplementalPacket: 0,
  };
  const carry = roundCounterfateAmount(raw * 0.5);
  let next = bindNext({
    ...cf,
    rawReversal: 0,
    lastRelease: release,
    finalRevisionCapture: { ...capture, consumed: true },
  }, intents, capture.instanceId, carry);
  return { cf: next, release };
}

export function chosenFateAlternatives(
  cf: CounterfateRuntimeState,
  intents: readonly HostileIntentSnapshot[],
): HostileIntentSnapshot[] {
  return intents.filter((row) => (
    row.alive
    && !row.concealed
    && row.intentInstanceId !== cf.fateboundInstanceId
  ));
}

export function hydrateCounterfateState(raw: unknown, depth: CombatDepthBand = 1): CounterfateRuntimeState {
  const base = createDefaultCounterfateState(depth);
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  return {
    ...base,
    combatDepth: row.combatDepth === 2 || row.combatDepth === 3 ? row.combatDepth : 1,
    fateboundInstanceId: typeof row.fateboundInstanceId === 'string' ? row.fateboundInstanceId : null,
    fateboundUnitId: typeof row.fateboundUnitId === 'string' ? row.fateboundUnitId : null,
    concealed: row.concealed === true,
    rawReversal: typeof row.rawReversal === 'number' ? Math.max(0, row.rawReversal) : 0,
    depthCap: typeof row.depthCap === 'number' ? row.depthCap : base.depthCap,
    chosenFateUsedThisTurn: row.chosenFateUsedThisTurn === true,
    noFutureJumpsThisEnemyCycle: typeof row.noFutureJumpsThisEnemyCycle === 'number' ? row.noFutureJumpsThisEnemyCycle : 0,
    preemptiveConsumedInstanceId: typeof row.preemptiveConsumedInstanceId === 'string' ? row.preemptiveConsumedInstanceId : null,
    finalRevisionCapture: row.finalRevisionCapture && typeof row.finalRevisionCapture === 'object'
      ? row.finalRevisionCapture as CounterfateRuntimeState['finalRevisionCapture']
      : null,
    lastRelease: row.lastRelease && typeof row.lastRelease === 'object'
      ? row.lastRelease as CounterfateRuntimeState['lastRelease']
      : null,
    refusalUsedThisTurn: row.refusalUsedThisTurn === true,
    borrowedEndingRootId: typeof row.borrowedEndingRootId === 'string' ? row.borrowedEndingRootId : null,
    borrowedEndingAmount: typeof row.borrowedEndingAmount === 'number' ? row.borrowedEndingAmount : 0,
    borrowedEndingMajor: row.borrowedEndingMajor === true,
    secondReflexUsedThisCombatCycle: row.secondReflexUsedThisCombatCycle === true,
    intentGenerationByUnit: row.intentGenerationByUnit && typeof row.intentGenerationByUnit === 'object'
      ? row.intentGenerationByUnit as CounterfateRuntimeState['intentGenerationByUnit']
      : {},
  };
}

export {
  COUNTERFATE_CORE_IDS,
  COUNTERFATE_MANIFESTATION_ID,
  COUNTERFATE_SUPPORT_IDS,
  COUNTERFATE_VERDICT_ID,
};
