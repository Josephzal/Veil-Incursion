import type { CanonicalRootActionContext, InstinctGrade, TargetNativeResult } from '../../types/nineStrain';
import type { CombatDepthBand, HostileIntentSnapshot } from '../../types/counterfate';
import { distributeOccultBudget } from './afterimageEngine';
import { directlyAffectedTargetIds, isDirectlyAffectedNative } from './rootAction';
import {
  HOLLOW_EDGE_DEPTH_CAPS,
  OPEN_CONDUIT_GAIN_CAP,
  OPEN_CONDUIT_HEX_RELOAD_CAP,
  OPEN_CONDUIT_SPEND_CAP,
  SOULWAKE_CORE_IDS,
  SOULWAKE_MANIFESTATION_ID,
  SOULWAKE_PERCENTS,
  SOULWAKE_SUPPORT_IDS,
  SOULWAKE_VERDICT_ID,
  type HpLossProvenance,
  type OverdrawKind,
  type QualifyingHpLossEvent,
  type SoulwakePacketResult,
  type SoulwakePreviewDelta,
  type SoulwakeRuntimeState,
  type WakeKind,
} from '../../types/soulwake';

const QUALIFYING: readonly HpLossProvenance[] = [
  'HOSTILE',
  'OVERDRAW',
  'VERDICT_OVERDRAW',
  'NATIVE_ACTION',
  'PRISM_SACRIFICE',
];

export function createDefaultSoulwakeState(): SoulwakeRuntimeState {
  return {
    playerHp: 100,
    playerMaxHp: 100,
    recordedWake: 0,
    activeWake: 0,
    activeWakeKind: 'NONE',
    generationId: 0,
    activationEnemyCycleIndex: 0,
    expireAtEnemyCycleIndex: 0,
    residualCarrySourceGenerationId: null,
    freshLossSinceResidualCarry: false,
    painDividendPaidGenerationId: null,
    overdrawUsedThisPlayerTurn: false,
    nativeHpCostUsedThisPlayerTurn: false,
    hollowEdgeUsedThisPlayerTurn: false,
    borrowedNerveUsedThisPlayerTurn: false,
    painReflexUsedThisCombatCycle: false,
    openConduitUsedThisPlayerTurn: false,
    openConduitGainResolvedThisRoot: false,
    openConduitSpendResolvedThisRoot: false,
    openConduitRootId: null,
    playerTurnIndex: 0,
    enemyCycleIndex: 0,
    playerTurnOpen: false,
    enemyCycleOpen: false,
    cycleRecorded: 0,
    processedLossIds: [],
    lastHeartbeatSelected: false,
    lastHeartbeatRootId: null,
    lastHeartbeatPacketRootId: null,
    lastOverdrawPaid: 0,
    lastOverdrawRequested: 0,
    lastDividendHealed: 0,
    lastBarrierGranted: 0,
    lastApRefund: 0,
    lastCooldownAdvanced: false,
    lastPackets: [],
    lastLog: null,
    hpPaidThisEncounter: 0,
    hpRestoredThisEncounter: 0,
  };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export function hydrateSoulwakeState(raw: unknown): SoulwakeRuntimeState {
  const base = createDefaultSoulwakeState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const kind = row.activeWakeKind;
  return {
    ...base,
    playerHp: num(row.playerHp) || base.playerHp,
    playerMaxHp: num(row.playerMaxHp) || base.playerMaxHp,
    recordedWake: num(row.recordedWake),
    activeWake: num(row.activeWake),
    activeWakeKind: kind === 'NORMAL' || kind === 'RESIDUAL' ? kind : 'NONE',
    generationId: num(row.generationId),
    activationEnemyCycleIndex: num(row.activationEnemyCycleIndex),
    expireAtEnemyCycleIndex: num(row.expireAtEnemyCycleIndex),
    residualCarrySourceGenerationId: typeof row.residualCarrySourceGenerationId === 'number'
      ? row.residualCarrySourceGenerationId
      : null,
    freshLossSinceResidualCarry: row.freshLossSinceResidualCarry === true,
    painDividendPaidGenerationId: typeof row.painDividendPaidGenerationId === 'number'
      ? row.painDividendPaidGenerationId
      : null,
    overdrawUsedThisPlayerTurn: row.overdrawUsedThisPlayerTurn === true,
    nativeHpCostUsedThisPlayerTurn: row.nativeHpCostUsedThisPlayerTurn === true,
    hollowEdgeUsedThisPlayerTurn: row.hollowEdgeUsedThisPlayerTurn === true,
    borrowedNerveUsedThisPlayerTurn: row.borrowedNerveUsedThisPlayerTurn === true,
    painReflexUsedThisCombatCycle: row.painReflexUsedThisCombatCycle === true,
    openConduitUsedThisPlayerTurn: row.openConduitUsedThisPlayerTurn === true,
    openConduitGainResolvedThisRoot: row.openConduitGainResolvedThisRoot === true,
    openConduitSpendResolvedThisRoot: row.openConduitSpendResolvedThisRoot === true,
    openConduitRootId: typeof row.openConduitRootId === 'string' ? row.openConduitRootId : null,
    playerTurnIndex: num(row.playerTurnIndex),
    enemyCycleIndex: num(row.enemyCycleIndex),
    playerTurnOpen: row.playerTurnOpen === true,
    enemyCycleOpen: row.enemyCycleOpen === true,
    cycleRecorded: num(row.cycleRecorded),
    processedLossIds: asIds(row.processedLossIds),
    lastHeartbeatSelected: row.lastHeartbeatSelected === true,
    lastHeartbeatRootId: typeof row.lastHeartbeatRootId === 'string' ? row.lastHeartbeatRootId : null,
    lastHeartbeatPacketRootId: typeof row.lastHeartbeatPacketRootId === 'string' ? row.lastHeartbeatPacketRootId : null,
    lastOverdrawPaid: num(row.lastOverdrawPaid),
    lastOverdrawRequested: num(row.lastOverdrawRequested),
    lastDividendHealed: num(row.lastDividendHealed),
    lastBarrierGranted: num(row.lastBarrierGranted),
    lastApRefund: num(row.lastApRefund),
    lastCooldownAdvanced: row.lastCooldownAdvanced === true,
    lastPackets: Array.isArray(row.lastPackets)
      ? (row.lastPackets as SoulwakePacketResult[]).filter((item) => item && typeof item === 'object' && typeof item.targetId === 'string')
      : [],
    lastLog: typeof row.lastLog === 'string' ? row.lastLog : null,
    hpPaidThisEncounter: num(row.hpPaidThisEncounter),
    hpRestoredThisEncounter: num(row.hpRestoredThisEncounter),
  };
}

export function percentRequest(maxHp: number, percent: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(1, Math.floor(maxHp * percent));
}

export function wakeCapFor(maxHp: number): number {
  return Math.floor(maxHp * SOULWAKE_PERCENTS.WAKE_CAP);
}

export function nonlethalPayment(requested: number, currentHp: number): number {
  if (requested <= 0 || currentHp <= 1) return 0;
  return Math.min(requested, currentHp - 1);
}

export function nerveThresholdMet(activeWake: number, maxHp: number): boolean {
  return activeWake * 10 >= maxHp;
}

function owns(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

function ownsSoulwake(ownedIds: readonly string[]): boolean {
  return ownedIds.some((id) => id.startsWith('SW_'));
}

function clampWake(value: number, maxHp: number): number {
  return Math.max(0, Math.min(wakeCapFor(maxHp), Math.floor(value)));
}

function rememberLoss(state: SoulwakeRuntimeState, id: string): SoulwakeRuntimeState {
  const next = [...state.processedLossIds, id];
  return { ...state, processedLossIds: next.slice(-64) };
}

export function syncSoulwakeVitals(
  state: SoulwakeRuntimeState,
  vitals: { hp?: number; maxHp?: number },
): SoulwakeRuntimeState {
  const prevMax = state.playerMaxHp;
  const maxHp = vitals.maxHp ?? state.playerMaxHp;
  let next: SoulwakeRuntimeState = {
    ...state,
    playerHp: vitals.hp ?? state.playerHp,
    playerMaxHp: maxHp,
  };
  if (maxHp !== prevMax) {
    next = {
      ...next,
      recordedWake: clampWake(next.recordedWake, maxHp),
      activeWake: clampWake(next.activeWake, maxHp),
    };
  }
  return next;
}

export function beginSoulwakePlayerTurn(state: SoulwakeRuntimeState): SoulwakeRuntimeState {
  return {
    ...state,
    playerTurnIndex: state.playerTurnIndex + 1,
    playerTurnOpen: true,
    overdrawUsedThisPlayerTurn: false,
    nativeHpCostUsedThisPlayerTurn: false,
    hollowEdgeUsedThisPlayerTurn: false,
    borrowedNerveUsedThisPlayerTurn: false,
    painReflexUsedThisCombatCycle: false,
    openConduitUsedThisPlayerTurn: false,
    openConduitGainResolvedThisRoot: false,
    openConduitSpendResolvedThisRoot: false,
    openConduitRootId: null,
    cycleRecorded: 0,
  };
}

export function beginSoulwakeEnemyCycle(state: SoulwakeRuntimeState): SoulwakeRuntimeState {
  return {
    ...state,
    enemyCycleIndex: state.enemyCycleIndex + 1,
    enemyCycleOpen: true,
    playerTurnOpen: false,
  };
}

function scheduleExpiry(state: SoulwakeRuntimeState): number {
  return state.enemyCycleIndex + 1;
}

export function activateRecordedWake(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
): SoulwakeRuntimeState {
  if (!ownsSoulwake(ownedIds) || state.recordedWake <= 0) {
    return { ...state, lastLog: state.recordedWake > 0 ? state.lastLog : state.lastLog };
  }
  const value = clampWake(state.recordedWake, state.playerMaxHp);
  return {
    ...state,
    recordedWake: 0,
    activeWake: value,
    activeWakeKind: 'NORMAL',
    generationId: state.generationId + 1,
    activationEnemyCycleIndex: state.enemyCycleIndex,
    expireAtEnemyCycleIndex: scheduleExpiry(state),
    residualCarrySourceGenerationId: null,
    lastLog: `WAKE ${value}`,
  };
}

function payDividend(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
  endingWake: number,
  generationId: number,
): SoulwakeRuntimeState {
  if (!owns(ownedIds, SOULWAKE_SUPPORT_IDS.PAIN_DIVIDEND)) return state;
  if (state.painDividendPaidGenerationId === generationId) return state;
  const missing = Math.max(0, state.playerMaxHp - state.playerHp);
  const heal = Math.min(
    Math.floor(endingWake * SOULWAKE_PERCENTS.PAIN_DIVIDEND_RATIO),
    percentRequest(state.playerMaxHp, SOULWAKE_PERCENTS.PAIN_DIVIDEND_HEAL_CAP),
    missing,
  );
  if (heal <= 0) {
    return { ...state, painDividendPaidGenerationId: generationId };
  }
  return {
    ...state,
    playerHp: state.playerHp + heal,
    lastDividendHealed: heal,
    hpRestoredThisEncounter: state.hpRestoredThisEncounter + heal,
    painDividendPaidGenerationId: generationId,
    lastLog: `DIVIDEND +${heal}`,
  };
}

export function expireSoulwakeAtEnemyCycleEnd(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
): SoulwakeRuntimeState {
  let next = { ...state, enemyCycleOpen: false };
  if (next.activeWakeKind === 'NONE' || next.expireAtEnemyCycleIndex !== next.enemyCycleIndex) {
    return next;
  }
  const endingKind = next.activeWakeKind;
  const endingWake = next.activeWake;
  const generation = next.generationId;
  if (endingKind === 'NORMAL') {
    next = payDividend(next, ownedIds, endingWake, generation);
    if (owns(ownedIds, SOULWAKE_MANIFESTATION_ID)) {
      const residual = Math.floor(endingWake * SOULWAKE_PERCENTS.LIVING_BREACH_RESIDUAL);
      if (residual > 0) {
        return {
          ...next,
          activeWake: residual,
          activeWakeKind: 'RESIDUAL',
          residualCarrySourceGenerationId: generation,
          freshLossSinceResidualCarry: false,
          expireAtEnemyCycleIndex: scheduleExpiry(next),
          lastLog: `RESIDUAL ${residual}`,
        };
      }
    }
  }
  return {
    ...next,
    activeWake: 0,
    activeWakeKind: 'NONE',
    residualCarrySourceGenerationId: endingKind === 'RESIDUAL' ? next.residualCarrySourceGenerationId : null,
    lastLog: endingKind === 'RESIDUAL' ? 'WAKE CLEAR' : next.lastLog,
  };
}

function addToActive(
  state: SoulwakeRuntimeState,
  amount: number,
  kind: WakeKind,
  extendExpiry: boolean,
): SoulwakeRuntimeState {
  const before = state.activeWake;
  const cap = wakeCapFor(state.playerMaxHp);
  const after = clampWake(before + amount, state.playerMaxHp);
  const overflow = Math.max(0, before + amount - cap);
  const converting = kind === 'NORMAL' && state.activeWakeKind !== 'NORMAL';
  const scheduled = scheduleExpiry(state);
  let expireAt = state.expireAtEnemyCycleIndex;
  if (state.activeWakeKind === 'NONE' || converting) {
    expireAt = Math.max(expireAt, scheduled);
  } else if (extendExpiry && scheduled > expireAt) {
    expireAt = scheduled;
  }
  return {
    ...state,
    activeWake: after,
    activeWakeKind: kind,
    generationId: converting || state.activeWakeKind === 'NONE' ? state.generationId + 1 : state.generationId,
    activationEnemyCycleIndex: converting || state.activeWakeKind === 'NONE'
      ? state.enemyCycleIndex
      : state.activationEnemyCycleIndex,
    residualCarrySourceGenerationId: kind === 'NORMAL' ? null : state.residualCarrySourceGenerationId,
    freshLossSinceResidualCarry: true,
    expireAtEnemyCycleIndex: expireAt,
    lastLog: overflow > 0 ? `WAKE ${after} // CAP` : `WAKE ${after}`,
  };
}

export function applyQualifyingLoss(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
  event: Omit<QualifyingHpLossEvent, 'classifiedForWake' | 'playerTurnIndex' | 'enemyCycleIndex' | 'phase'> & {
    classifiedForWake?: boolean;
    playerTurnIndex?: number;
    enemyCycleIndex?: number;
    phase?: QualifyingHpLossEvent['phase'];
  },
): { state: SoulwakeRuntimeState; applied: number; classified: boolean } {
  if (!ownsSoulwake(ownedIds)) return { state, applied: 0, classified: false };
  if (state.processedLossIds.includes(event.lossEventId)) {
    return { state, applied: 0, classified: false };
  }
  let next = rememberLoss(syncSoulwakeVitals(state, {
    hp: event.currentHpAfter,
    maxHp: event.maxHpAfter,
  }), event.lossEventId);
  if (event.maxHpAfter < event.maxHpBefore) {
    return { state: next, applied: 0, classified: false };
  }
  if (!QUALIFYING.includes(event.provenance) || event.actualHpRemoved <= 0) {
    return { state: next, applied: 0, classified: false };
  }
  let amount = event.actualHpRemoved;
  if (event.provenance === 'NATIVE_ACTION') {
    if (next.nativeHpCostUsedThisPlayerTurn) return { state: next, applied: 0, classified: false };
    amount = Math.min(amount, percentRequest(next.playerMaxHp, SOULWAKE_PERCENTS.NATIVE_HP_CAP));
    next = { ...next, nativeHpCostUsedThisPlayerTurn: true };
  }
  if (event.provenance === 'PRISM_SACRIFICE') {
    next = { ...next, nativeHpCostUsedThisPlayerTurn: true };
  }
  const remainingCycle = Math.max(0, wakeCapFor(next.playerMaxHp) - next.cycleRecorded);
  amount = Math.min(amount, remainingCycle);
  if (amount <= 0) return { state: next, applied: 0, classified: false };
  const paidForTelemetry = event.provenance === 'OVERDRAW' || event.provenance === 'VERDICT_OVERDRAW'
    ? 0
    : amount;
  next = {
    ...next,
    cycleRecorded: next.cycleRecorded + amount,
    hpPaidThisEncounter: next.hpPaidThisEncounter + paidForTelemetry,
  };
  const livingBreach = owns(ownedIds, SOULWAKE_MANIFESTATION_ID);
  const phase: QualifyingHpLossEvent['phase'] = event.phase
    ?? (next.enemyCycleOpen ? 'ENEMY_CYCLE' : next.playerTurnOpen ? 'PLAYER_TURN' : 'TURN_INIT');
  if (livingBreach) {
    next = addToActive(next, amount, 'NORMAL', true);
  } else {
    const recorded = clampWake(next.recordedWake + amount, next.playerMaxHp);
    next = {
      ...next,
      recordedWake: recorded,
      lastLog: `WAKE +${amount}`,
    };
  }
  void phase;
  return { state: next, applied: amount, classified: true };
}

export function ordinaryOverdrawAvailable(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
): boolean {
  if (!ownsSoulwake(ownedIds) || state.overdrawUsedThisPlayerTurn) return false;
  if (state.playerHp <= 1) return false;
  if (state.activeWake > 0 && !owns(ownedIds, SOULWAKE_SUPPORT_IDS.OPEN_NERVE)) return false;
  return true;
}

export function previewOrdinaryOverdraw(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
): SoulwakePreviewDelta {
  const requested = percentRequest(state.playerMaxHp, SOULWAKE_PERCENTS.OVERDRAW);
  const actual = ordinaryOverdrawAvailable(state, ownedIds) ? nonlethalPayment(requested, state.playerHp) : 0;
  const cap = wakeCapFor(state.playerMaxHp);
  const openNerve = owns(ownedIds, SOULWAKE_SUPPORT_IDS.OPEN_NERVE) && state.activeWake > 0;
  const living = owns(ownedIds, SOULWAKE_MANIFESTATION_ID);
  const immediate = openNerve || living;
  const activeAfter = immediate ? clampWake(state.activeWake + actual, state.playerMaxHp) : state.activeWake;
  const recordedAfter = immediate ? state.recordedWake : clampWake(state.recordedWake + actual, state.playerMaxHp);
  const overflow = immediate
    ? Math.max(0, state.activeWake + actual - cap)
    : Math.max(0, state.recordedWake + actual - cap);
  return {
    requestedHp: requested,
    actualHp: actual,
    hpBefore: state.playerHp,
    hpAfter: state.playerHp - actual,
    recordedBefore: state.recordedWake,
    recordedAfter,
    activeBefore: state.activeWake,
    activeAfter,
    wakeCap: cap,
    kind: immediate ? (state.activeWakeKind === 'NONE' ? 'NORMAL' : 'NORMAL') : state.activeWakeKind,
    overflowLost: overflow,
    hollowEdgeDamage: 0,
    borrowedNerveRefund: 0,
    borrowedNerveAdvanceCooldown: false,
    painReflexBarrier: 0,
    openConduitGain: 0,
    openConduitPreserved: 0,
    lastHeartbeatBudget: Math.floor(activeAfter * SOULWAKE_PERCENTS.LAST_HEARTBEAT_BUDGET),
    painDividendProjected: Math.min(
      Math.floor(activeAfter * SOULWAKE_PERCENTS.PAIN_DIVIDEND_RATIO),
      percentRequest(state.playerMaxHp, SOULWAKE_PERCENTS.PAIN_DIVIDEND_HEAL_CAP),
    ),
  };
}

export function commitOrdinaryOverdraw(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
  lossEventId: string,
): { state: SoulwakeRuntimeState; paid: number; invalid: boolean } {
  if (!ordinaryOverdrawAvailable(state, ownedIds)) {
    return { state, paid: 0, invalid: true };
  }
  const requested = percentRequest(state.playerMaxHp, SOULWAKE_PERCENTS.OVERDRAW);
  const paid = nonlethalPayment(requested, state.playerHp);
  if (paid <= 0) return { state, paid: 0, invalid: true };
  const hpAfter = state.playerHp - paid;
  let next: SoulwakeRuntimeState = {
    ...state,
    playerHp: hpAfter,
    overdrawUsedThisPlayerTurn: true,
    lastOverdrawPaid: paid,
    lastOverdrawRequested: requested,
    hpPaidThisEncounter: state.hpPaidThisEncounter + paid,
    lastLog: `OVERDRAW ${paid}`,
  };
  const openNerve = owns(ownedIds, SOULWAKE_SUPPORT_IDS.OPEN_NERVE) && state.activeWake > 0;
  const living = owns(ownedIds, SOULWAKE_MANIFESTATION_ID);
  if (openNerve) {
    next = addToActive(next, paid, 'NORMAL', false);
    next = rememberLoss(next, lossEventId);
  } else {
    const applied = applyQualifyingLoss(next, ownedIds, {
      lossEventId,
      rootActionId: null,
      actualHpRemoved: paid,
      currentHpBefore: state.playerHp,
      currentHpAfter: hpAfter,
      maxHpBefore: state.playerMaxHp,
      maxHpAfter: state.playerMaxHp,
      provenance: 'OVERDRAW',
      overdrawKind: 'NORMAL',
    });
    next = applied.state;
  }
  return { state: next, paid, invalid: false };
}

export function setLastHeartbeatSelected(
  state: SoulwakeRuntimeState,
  selected: boolean,
): SoulwakeRuntimeState {
  return { ...state, lastHeartbeatSelected: selected };
}

export function snapshotWakePowered(
  state: SoulwakeRuntimeState,
  ctx: CanonicalRootActionContext,
  paidQualifyingHp: boolean,
): CanonicalRootActionContext {
  const wake = state.activeWake;
  const powered = wake > 0 || (paidQualifyingHp && wake > 0);
  return {
    ...ctx,
    wakePowered: wake > 0,
    wakeValueAtCommit: wake,
    wakeGenerationId: state.generationId,
    wakeKindAtCommit: state.activeWakeKind,
    wakePaidQualifyingHp: paidQualifyingHp,
  };
}

function legalHostile(
  intents: readonly HostileIntentSnapshot[],
  unitId: string,
): HostileIntentSnapshot | null {
  return intents.find((row) => row.unitId === unitId && row.alive && !row.phased) ?? null;
}

function applyOccultToTarget(
  intents: HostileIntentSnapshot[],
  targetId: string,
  damage: number,
): { intents: HostileIntentSnapshot[]; packet: SoulwakePacketResult } {
  const target = legalHostile(intents, targetId);
  if (!target) {
    return {
      intents,
      packet: {
        targetId,
        damage: 0,
        killed: false,
        fizzled: true,
        fizzleReason: 'NO_LEGAL_TARGET',
        playerFacingLog: 'PACKET // NO TARGET',
      },
    };
  }
  if (target.invulnerable) {
    return {
      intents,
      packet: {
        targetId,
        damage: 0,
        killed: false,
        fizzled: true,
        fizzleReason: 'INVULNERABLE',
        playerFacingLog: 'PACKET // INVULNERABLE',
      },
    };
  }
  if (target.protectedPhase) {
    if (target.authoredCounter) {
      return {
        intents,
        packet: {
          targetId,
          damage: 0,
          killed: false,
          fizzled: false,
          fizzleReason: null,
          playerFacingLog: 'PACKET // PHASE PRESSURE',
        },
      };
    }
    return {
      intents,
      packet: {
        targetId,
        damage: 0,
        killed: false,
        fizzled: true,
        fizzleReason: 'PROTECTED_PHASE',
        playerFacingLog: 'PACKET // PROTECTED',
      },
    };
  }
  const next = intents.map((row) => {
    if (row.unitId !== targetId) return row;
    const hp = Math.max(0, row.hp - damage);
    return { ...row, hp, alive: hp > 0 && row.alive };
  });
  const after = next.find((row) => row.unitId === targetId);
  return {
    intents: next,
    packet: {
      targetId,
      damage,
      killed: Boolean(after && !after.alive),
      fizzled: false,
      fizzleReason: null,
      playerFacingLog: `PACKET ${damage} OCCULT`,
    },
  };
}

export function hollowEdgeDamage(wakeAtCommit: number, depth: CombatDepthBand): number {
  const cap = HOLLOW_EDGE_DEPTH_CAPS[depth] ?? HOLLOW_EDGE_DEPTH_CAPS[1];
  return Math.min(cap, 4 + wakeAtCommit);
}

export function painReflexBarrier(grade: InstinctGrade, wake: number): number {
  if (grade === 'FAILED') return 0;
  if (grade === 'STANDARD') return 4 + Math.floor(wake * SOULWAKE_PERCENTS.PAIN_REFLEX_STANDARD);
  if (grade === 'CLEAN') return 4 + Math.floor(wake * SOULWAKE_PERCENTS.PAIN_REFLEX_CLEAN);
  return 4 + wake;
}

export interface SoulwakeProcessResult {
  state: SoulwakeRuntimeState;
  intents: HostileIntentSnapshot[];
  nativeByTarget: TargetNativeResult[];
  ctx: CanonicalRootActionContext;
  packets: SoulwakePacketResult[];
  apRefund: number;
  cooldownAdvanced: boolean;
}

function mergeKill(
  rows: readonly TargetNativeResult[],
  packet: SoulwakePacketResult,
): TargetNativeResult[] {
  if (packet.fizzled || packet.damage <= 0 && !packet.killed) {
    if (!packet.killed) return rows.slice();
  }
  const existing = rows.find((row) => row.targetId === packet.targetId);
  if (!existing) {
    return [...rows, {
      targetId: packet.targetId,
      hits: packet.fizzled ? 0 : 1,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 0,
      defenseDamage: 0,
      defenseBreaks: 0,
      fractures: 0,
      statusesApplied: 0,
      killed: packet.killed,
      healingDealt: 0,
      movement: 0,
      occultNativeDamage: packet.damage,
    }];
  }
  return rows.map((row) => row.targetId === packet.targetId
    ? { ...row, killed: row.killed || packet.killed, occultNativeDamage: (row.occultNativeDamage ?? 0) + packet.damage }
    : row);
}

export function applyNativeHpCost(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
  ctx: CanonicalRootActionContext,
): { state: SoulwakeRuntimeState; paidQualifying: boolean } {
  const hp = ctx.actualCostsPaid.hp ?? 0;
  const kind = ctx.hpLossKind ?? (hp > 0 ? 'NATIVE_ACTION' : null);
  if (!hp || !kind) return { state, paidQualifying: false };
  if (kind === 'BOON' || kind === 'GRAFT') return { state, paidQualifying: false };
  const provenance: HpLossProvenance = kind === 'PRISM_SACRIFICE' ? 'PRISM_SACRIFICE' : 'NATIVE_ACTION';
  const after = Math.max(1, state.playerHp - hp);
  const paid = state.playerHp - after;
  const applied = applyQualifyingLoss({
    ...state,
    playerHp: after,
  }, ownedIds, {
    lossEventId: `${ctx.rootActionId}:hp`,
    rootActionId: ctx.rootActionId,
    actualHpRemoved: paid,
    currentHpBefore: state.playerHp,
    currentHpAfter: after,
    maxHpBefore: state.playerMaxHp,
    maxHpAfter: state.playerMaxHp,
    provenance,
    overdrawKind: 'NONE',
  });
  return { state: applied.state, paidQualifying: applied.classified };
}

export function applyLastHeartbeatOverdraw(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
  ctx: CanonicalRootActionContext,
): SoulwakeRuntimeState {
  if (!owns(ownedIds, SOULWAKE_VERDICT_ID)) return state;
  if (!state.lastHeartbeatSelected) return state;
  if (ctx.sourceKind !== 'ULTIMATE' && ctx.actionSurface !== 'ULTIMATE') return state;
  if (state.lastHeartbeatRootId === ctx.rootActionId) return state;
  const requested = percentRequest(state.playerMaxHp, SOULWAKE_PERCENTS.LAST_HEARTBEAT);
  const paid = nonlethalPayment(requested, state.playerHp);
  if (paid <= 0) return { ...state, lastHeartbeatRootId: ctx.rootActionId };
  const hpAfter = state.playerHp - paid;
  let next: SoulwakeRuntimeState = {
    ...state,
    playerHp: hpAfter,
    lastHeartbeatRootId: ctx.rootActionId,
    lastOverdrawPaid: paid,
    lastOverdrawRequested: requested,
    hpPaidThisEncounter: state.hpPaidThisEncounter + paid,
    lastLog: `HEARTBEAT ${paid}`,
  };
  next = addToActive(next, paid, 'NORMAL', true);
  next = rememberLoss(next, `${ctx.rootActionId}:verdict-overdraw`);
  return next;
}

export function processSoulwakeRoot(args: {
  state: SoulwakeRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  depth: CombatDepthBand;
  skipPayment?: boolean;
}): SoulwakeProcessResult {
  let state = args.state;
  let ctx = args.ctx;
  let intents = args.intents.slice();
  const packets: SoulwakePacketResult[] = [];
  let apRefund = 0;
  let cooldownAdvanced = false;
  state = { ...state, lastApRefund: 0, lastCooldownAdvanced: false };
  if (!ownsSoulwake(args.ownedIds) || !ctx.committed || ctx.classification !== 'NATIVE_DIRECT') {
    return { state, intents, nativeByTarget: ctx.nativeByTarget.slice(), ctx, packets, apRefund, cooldownAdvanced };
  }

  let paidQualifying = ctx.wakePaidQualifyingHp === true;
  if (!args.skipPayment) {
    const nativeHp = applyNativeHpCost(state, args.ownedIds, ctx);
    state = nativeHp.state;
    paidQualifying = nativeHp.paidQualifying;
    if (ctx.sourceKind === 'ULTIMATE' || ctx.actionSurface === 'ULTIMATE') {
      state = applyLastHeartbeatOverdraw(state, args.ownedIds, ctx);
    }
    ctx = snapshotWakePowered(state, ctx, paidQualifying);
  }

  const weaponSurface = ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC'
    || (ctx.actionSurface == null && ctx.sourceKind === 'PLAYER_ACTION');
  if (
    owns(args.ownedIds, SOULWAKE_CORE_IDS.HOLLOW_EDGE)
    && weaponSurface
    && ctx.sourceKind === 'PLAYER_ACTION'
    && ctx.wakePowered
    && !state.hollowEdgeUsedThisPlayerTurn
  ) {
    state = { ...state, hollowEdgeUsedThisPlayerTurn: true };
    const primary = ctx.lockedTargetIds[0];
    const row = ctx.nativeByTarget.find((item) => item.targetId === primary);
    const missOnly = Boolean(row && row.hits === 0 && row.misses > 0 && row.nativeDirectDamage <= 0);
    if (primary && row && !missOnly && (row.hits > 0 || isDirectlyAffectedNative(row))) {
      const damage = hollowEdgeDamage(ctx.wakeValueAtCommit ?? 0, args.depth);
      const resolved = applyOccultToTarget(intents, primary, damage);
      intents = resolved.intents;
      packets.push(resolved.packet);
    }
  }

  const discipline = ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX';
  if (
    owns(args.ownedIds, SOULWAKE_CORE_IDS.BORROWED_NERVE)
    && discipline
    && ctx.sourceKind === 'PLAYER_ACTION'
    && ctx.wakePowered
    && !state.borrowedNerveUsedThisPlayerTurn
  ) {
    const paidAp = ctx.actualCostsPaid.ap ?? 0;
    if (paidAp > 0) {
      state = { ...state, borrowedNerveUsedThisPlayerTurn: true };
      apRefund = Math.min(1, paidAp);
      cooldownAdvanced = Boolean(ctx.startsCooldown && nerveThresholdMet(ctx.wakeValueAtCommit ?? 0, state.playerMaxHp));
      state = {
        ...state,
        lastApRefund: apRefund,
        lastCooldownAdvanced: cooldownAdvanced,
      };
    }
  }

  let nativeByTarget = ctx.nativeByTarget.slice();
  for (const packet of packets) nativeByTarget = mergeKill(nativeByTarget, packet);
  state = { ...state, lastPackets: packets, lastLog: packets[0]?.playerFacingLog ?? state.lastLog };
  return { state, intents, nativeByTarget, ctx, packets, apRefund, cooldownAdvanced };
}

export function resolveLastHeartbeatPackets(args: {
  state: SoulwakeRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
}): SoulwakeProcessResult {
  let state = args.state;
  let intents = args.intents.slice();
  const packets: SoulwakePacketResult[] = [];
  if (!owns(args.ownedIds, SOULWAKE_VERDICT_ID)) {
    return { state, intents, nativeByTarget: args.ctx.nativeByTarget.slice(), ctx: args.ctx, packets, apRefund: 0, cooldownAdvanced: false };
  }
  if (args.ctx.sourceKind !== 'ULTIMATE' && args.ctx.actionSurface !== 'ULTIMATE') {
    return { state, intents, nativeByTarget: args.ctx.nativeByTarget.slice(), ctx: args.ctx, packets, apRefund: 0, cooldownAdvanced: false };
  }
  if (state.lastHeartbeatPacketRootId === args.ctx.rootActionId) {
    return { state, intents, nativeByTarget: args.ctx.nativeByTarget.slice(), ctx: args.ctx, packets, apRefund: 0, cooldownAdvanced: false };
  }
  const budget = Math.floor(state.activeWake * SOULWAKE_PERCENTS.LAST_HEARTBEAT_BUDGET);
  const locked = args.ctx.lockedTargetIds.length > 0
    ? args.ctx.lockedTargetIds
    : args.ctx.nativeByTarget.map((row) => row.targetId);
  const affected = (args.ctx.directlyAffectedTargetIds ?? directlyAffectedTargetIds(args.ctx))
    .filter((id, index, all) => all.indexOf(id) === index);
  const ordered = locked.filter((id) => affected.includes(id) && legalHostile(intents, id));
  const livingAffected = ordered.length > 0
    ? ordered
    : affected.filter((id) => legalHostile(intents, id));
  if (budget <= 0 || livingAffected.length === 0) {
    state = {
      ...state,
      lastPackets: packets,
      lastHeartbeatSelected: false,
      lastHeartbeatPacketRootId: args.ctx.rootActionId,
    };
    return { state, intents, nativeByTarget: args.ctx.nativeByTarget.slice(), ctx: args.ctx, packets, apRefund: 0, cooldownAdvanced: false };
  }
  const shares = distributeOccultBudget(budget, livingAffected.map((id) => ({ targetId: id, weight: 1 })));
  let nativeByTarget = args.ctx.nativeByTarget.slice();
  for (const share of shares) {
    const targetId = share.assignedTargetId ?? share.originalTargetId;
    if (!targetId) continue;
    const resolved = applyOccultToTarget(intents, targetId, share.nativeDirectDamage);
    intents = resolved.intents;
    packets.push(resolved.packet);
    nativeByTarget = mergeKill(nativeByTarget, resolved.packet);
  }
  state = {
    ...state,
    lastPackets: packets,
    lastHeartbeatSelected: false,
    lastHeartbeatPacketRootId: args.ctx.rootActionId,
    lastLog: packets[0]?.playerFacingLog ?? `HEARTBEAT ${budget}`,
  };
  return { state, intents, nativeByTarget, ctx: args.ctx, packets, apRefund: 0, cooldownAdvanced: false };
}

export function processSoulwakeInstinct(args: {
  state: SoulwakeRuntimeState;
  ownedIds: readonly string[];
  grade: InstinctGrade;
}): { state: SoulwakeRuntimeState; barrier: number } {
  if (!owns(args.ownedIds, SOULWAKE_CORE_IDS.PAIN_REFLEX)) {
    return { state: args.state, barrier: 0 };
  }
  if (args.grade === 'FAILED' || args.state.painReflexUsedThisCombatCycle || args.state.activeWake <= 0) {
    return { state: args.state, barrier: 0 };
  }
  const barrier = painReflexBarrier(args.grade, args.state.activeWake);
  return {
    state: {
      ...args.state,
      painReflexUsedThisCombatCycle: true,
      lastBarrierGranted: barrier,
      lastLog: `BARRIER ${barrier}`,
    },
    barrier,
  };
}

export function processSoulwakeCurrent(args: {
  state: SoulwakeRuntimeState;
  ctx: CanonicalRootActionContext | null;
  ownedIds: readonly string[];
  input: {
    classId: string;
    actualGained?: number;
    actualSpent?: number;
    reloadRestoredCount?: number;
    magazineSpace?: number;
    ordinaryGain?: boolean;
    ordinarySpend?: boolean;
    ammoSpent?: boolean;
    reloadRestoredRounds?: boolean;
    delayedRestore?: boolean;
    ultimateOwnedRefill?: boolean;
    preserved?: boolean;
  };
}): { state: SoulwakeRuntimeState; gained: number; preserved: number } {
  const empty = { state: args.state, gained: 0, preserved: 0 };
  if (!owns(args.ownedIds, SOULWAKE_CORE_IDS.OPEN_CONDUIT) || !args.ctx) return empty;
  if (!args.ctx.wakePowered) return empty;
  if (args.input.delayedRestore || args.input.ultimateOwnedRefill || args.input.preserved) return empty;
  let state = args.state;
  if (state.openConduitUsedThisPlayerTurn && state.openConduitRootId !== args.ctx.rootActionId) return empty;
  if (!state.openConduitUsedThisPlayerTurn) {
    state = {
      ...state,
      openConduitUsedThisPlayerTurn: true,
      openConduitRootId: args.ctx.rootActionId,
      openConduitGainResolvedThisRoot: false,
      openConduitSpendResolvedThisRoot: false,
    };
  }
  let gained = 0;
  let preserved = 0;
  if (args.input.classId === 'HEX_SHOT') {
    if ((args.input.reloadRestoredRounds || (args.input.reloadRestoredCount ?? 0) > 0) && !state.openConduitGainResolvedThisRoot) {
      const restored = args.input.reloadRestoredCount ?? (args.input.reloadRestoredRounds ? 1 : 0);
      const space = args.input.magazineSpace ?? restored;
      gained = Math.min(OPEN_CONDUIT_HEX_RELOAD_CAP, Math.floor(restored * SOULWAKE_PERCENTS.OPEN_CONDUIT_GAIN), space);
      state = { ...state, openConduitGainResolvedThisRoot: true };
    }
    if ((args.input.ammoSpent || (args.input.actualSpent ?? 0) > 0) && !state.openConduitSpendResolvedThisRoot) {
      const spent = args.input.actualSpent ?? (args.input.ammoSpent ? 1 : 0);
      preserved = spent > 0 ? 1 : 0;
      state = { ...state, openConduitSpendResolvedThisRoot: true };
    }
  } else {
    if ((args.input.ordinaryGain || (args.input.actualGained ?? 0) > 0) && !state.openConduitGainResolvedThisRoot) {
      const gain = args.input.actualGained ?? 0;
      gained = Math.min(OPEN_CONDUIT_GAIN_CAP, Math.floor(gain * SOULWAKE_PERCENTS.OPEN_CONDUIT_GAIN));
      state = { ...state, openConduitGainResolvedThisRoot: true };
    }
    if ((args.input.ordinarySpend || (args.input.actualSpent ?? 0) > 0) && !state.openConduitSpendResolvedThisRoot) {
      const spend = args.input.actualSpent ?? (args.input.ordinarySpend ? 0 : 0);
      const actualSpend = args.input.actualSpent ?? 0;
      preserved = Math.min(OPEN_CONDUIT_SPEND_CAP, Math.floor(actualSpend * SOULWAKE_PERCENTS.OPEN_CONDUIT_SPEND));
      state = { ...state, openConduitSpendResolvedThisRoot: true };
    }
  }
  return { state, gained, preserved };
}

export function completeSoulwakeEncounter(
  state: SoulwakeRuntimeState,
  ownedIds: readonly string[],
  outcome: 'VICTORY' | 'ESCAPE' | 'FAILURE',
): SoulwakeRuntimeState {
  let next = state;
  if ((outcome === 'VICTORY' || outcome === 'ESCAPE') && next.activeWakeKind === 'NORMAL') {
    next = payDividend(next, ownedIds, next.activeWake, next.generationId);
  }
  const vitals = { hp: next.playerHp, maxHp: next.playerMaxHp };
  const hpPaid = next.hpPaidThisEncounter;
  const hpRestored = next.hpRestoredThisEncounter;
  return {
    ...createDefaultSoulwakeState(),
    playerHp: vitals.hp,
    playerMaxHp: vitals.maxHp,
    hpPaidThisEncounter: hpPaid,
    hpRestoredThisEncounter: hpRestored,
    lastDividendHealed: next.lastDividendHealed,
    lastLog: next.lastLog,
  };
}

export function soulwakePresentation(state: SoulwakeRuntimeState): {
  active: boolean;
  recorded: number;
  wake: number;
  cap: number;
  kindLabel: string;
  lastLog: string | null;
  overdrawAvailableHint: boolean;
  netRisk: number;
  percents: typeof SOULWAKE_PERCENTS;
  hpPaid: number;
  hpRestored: number;
  expireAtEnemyCycleIndex: number;
  enemyCycleIndex: number;
} {
  const kindLabel = state.activeWakeKind === 'RESIDUAL'
    ? 'RESIDUAL'
    : state.activeWakeKind === 'NORMAL'
      ? 'WAKE'
      : 'CLEAR';
  return {
    active: ownsPresentation(state),
    recorded: state.recordedWake,
    wake: state.activeWake,
    cap: wakeCapFor(state.playerMaxHp),
    kindLabel,
    lastLog: state.lastLog,
    overdrawAvailableHint: !state.overdrawUsedThisPlayerTurn,
    netRisk: state.hpPaidThisEncounter - state.hpRestoredThisEncounter,
    percents: SOULWAKE_PERCENTS,
    hpPaid: state.hpPaidThisEncounter,
    hpRestored: state.hpRestoredThisEncounter,
    expireAtEnemyCycleIndex: state.expireAtEnemyCycleIndex,
    enemyCycleIndex: state.enemyCycleIndex,
  };
}

function ownsPresentation(state: SoulwakeRuntimeState): boolean {
  return state.activeWake > 0 || state.recordedWake > 0 || Boolean(state.lastLog);
}

export function previewSoulwakeRoot(args: {
  state: SoulwakeRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  depth: CombatDepthBand;
}): SoulwakePreviewDelta {
  const cloned = hydrateSoulwakeState(JSON.parse(JSON.stringify(args.state)));
  const result = processSoulwakeRoot({
    state: cloned,
    ctx: args.ctx,
    ownedIds: args.ownedIds,
    intents: args.intents.map((row) => ({ ...row })),
    depth: args.depth,
  });
  const heartbeat = resolveLastHeartbeatPackets({
    state: result.state,
    ctx: result.ctx,
    ownedIds: args.ownedIds,
    intents: result.intents,
  });
  return {
    requestedHp: args.ctx.actualCostsPaid.hp ?? 0,
    actualHp: Math.max(0, cloned.playerHp - result.state.playerHp),
    hpBefore: args.state.playerHp,
    hpAfter: result.state.playerHp,
    recordedBefore: args.state.recordedWake,
    recordedAfter: result.state.recordedWake,
    activeBefore: args.state.activeWake,
    activeAfter: result.state.activeWake,
    wakeCap: wakeCapFor(args.state.playerMaxHp),
    kind: result.state.activeWakeKind,
    overflowLost: 0,
    hollowEdgeDamage: result.packets.reduce((sum, row) => sum + row.damage, 0),
    borrowedNerveRefund: result.apRefund,
    borrowedNerveAdvanceCooldown: result.cooldownAdvanced,
    painReflexBarrier: 0,
    openConduitGain: 0,
    openConduitPreserved: 0,
    lastHeartbeatBudget: heartbeat.packets.reduce((sum, row) => sum + row.damage, 0),
    painDividendProjected: Math.min(
      Math.floor(result.state.activeWake * SOULWAKE_PERCENTS.PAIN_DIVIDEND_RATIO),
      percentRequest(args.state.playerMaxHp, SOULWAKE_PERCENTS.PAIN_DIVIDEND_HEAL_CAP),
    ),
  };
}
