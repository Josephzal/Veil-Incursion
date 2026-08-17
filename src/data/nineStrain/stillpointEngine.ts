import type { CanonicalRootActionContext, InstinctGrade, TargetNativeResult } from '../../types/nineStrain';
import type { CombatDepthBand, HostileIntentSnapshot } from '../../types/counterfate';
import type {
  CondensedImpactPacket,
  FleetingStillnessRecord,
  FocusedRootRecord,
  PlayerTurnEndReason,
  StillnessChargeSource,
  StillpointRuntimeState,
  UsableApInput,
} from '../../types/stillpoint';
import {
  MOTIONLESS_STORM_FOCUSED_CAP,
  NATIVE_STILLNESS_CAP,
  SHELTERED_PAUSE_BARRIER,
  STORED_FORCE_DEPTH_CAPS,
  STILLPOINT_CORE_IDS,
  STILLPOINT_MANIFESTATION_ID,
  STILLPOINT_SUPPORT_IDS,
  STILLPOINT_VERDICT_ID,
} from '../../types/stillpoint';
import { roundCounterfateAmount } from './counterfateMath';
import { discountApByOneMinOne } from './ritualCadenceEngine';

export function createDefaultStillpointState(): StillpointRuntimeState {
  return {
    nativeStillness: 0,
    fleeting: null,
    fleetingCreatedThisCombatCycle: false,
    combatCycleIndex: 0,
    enemyCycleIndex: 0,
    playerTurnIndex: 0,
    playerTurnOpen: false,
    focusedRoot: null,
    pendingCurrentFocusRootId: null,
    stormActiveThisTurn: false,
    stormFreeFocusAvailable: false,
    stormFocusedCount: 0,
    quietReflexSuccessUsedThisCombatCycle: false,
    silentReservoirUsedThisPlayerTurn: false,
    returnStrokeUsedThisPlayerTurn: false,
    queuedTurnStartApRefund: 0,
    lastApRefund: 0,
    lastBarrierGranted: 0,
    lastCooldownAdvanced: false,
    lastPreserved: 0,
    lastReloadBonus: 0,
    lastCondensedImpact: 0,
    lastQuietReflexGrade: null,
    zeroHourPause: null,
    lastEndTurn: null,
    lastSpendSource: null,
    lastFleetingProvenance: null,
    hostileApDisruptionThisPlayerTurn: false,
    stayedSentenceFreeFocus: false,
  };
}

export function hydrateStillpointState(raw: unknown): StillpointRuntimeState {
  const base = createDefaultStillpointState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const fleetingRaw = row.fleeting && typeof row.fleeting === 'object' ? row.fleeting as Record<string, unknown> : null;
  const focusedRaw = row.focusedRoot && typeof row.focusedRoot === 'object' ? row.focusedRoot as Record<string, unknown> : null;
  const pauseRaw = row.zeroHourPause && typeof row.zeroHourPause === 'object' ? row.zeroHourPause as Record<string, unknown> : null;
  const endRaw = row.lastEndTurn && typeof row.lastEndTurn === 'object' ? row.lastEndTurn as Record<string, unknown> : null;
  return {
    nativeStillness: clampNative(row.nativeStillness),
    fleeting: fleetingRaw ? {
      sourceDefinitionId: typeof fleetingRaw.sourceDefinitionId === 'string' ? fleetingRaw.sourceDefinitionId : null,
      createdCombatCycle: num(fleetingRaw.createdCombatCycle),
      createdPlayerTurn: num(fleetingRaw.createdPlayerTurn),
      eligiblePlayerTurn: num(fleetingRaw.eligiblePlayerTurn),
      expiresAtPlayerTurnEnd: num(fleetingRaw.expiresAtPlayerTurnEnd),
      spent: fleetingRaw.spent === true,
      creationPhase: fleetingRaw.creationPhase === 'ENEMY_CYCLE' || fleetingRaw.creationPhase === 'PLAYER_TURN_INIT'
        ? fleetingRaw.creationPhase
        : 'PLAYER_CONTROL',
      sourceRootId: typeof fleetingRaw.sourceRootId === 'string' ? fleetingRaw.sourceRootId : null,
      sourceLineage: Array.isArray(fleetingRaw.sourceLineage)
        ? fleetingRaw.sourceLineage.filter((id): id is string => typeof id === 'string')
        : [],
    } : null,
    fleetingCreatedThisCombatCycle: row.fleetingCreatedThisCombatCycle === true,
    combatCycleIndex: num(row.combatCycleIndex),
    enemyCycleIndex: num(row.enemyCycleIndex),
    playerTurnIndex: num(row.playerTurnIndex),
    playerTurnOpen: row.playerTurnOpen === true,
    focusedRoot: focusedRaw && typeof focusedRaw.rootActionId === 'string' ? {
      rootActionId: focusedRaw.rootActionId,
      surfaces: Array.isArray(focusedRaw.surfaces)
        ? focusedRaw.surfaces.filter((id): id is FocusedRootRecord['surfaces'][number] =>
          id === 'ARMAMENT' || id === 'DISCIPLINE' || id === 'INSTINCT' || id === 'CURRENT')
        : [],
      chargeSource: focusedRaw.chargeSource === 'FLEETING'
        || focusedRaw.chargeSource === 'STORM_FREE'
        || focusedRaw.chargeSource === 'STAYED_SENTENCE_FREE'
        ? focusedRaw.chargeSource
        : 'NATIVE',
      consumed: focusedRaw.consumed !== false,
    } : null,
    pendingCurrentFocusRootId: typeof row.pendingCurrentFocusRootId === 'string' ? row.pendingCurrentFocusRootId : null,
    stormActiveThisTurn: row.stormActiveThisTurn === true,
    stormFreeFocusAvailable: row.stormFreeFocusAvailable === true,
    stormFocusedCount: num(row.stormFocusedCount),
    quietReflexSuccessUsedThisCombatCycle: row.quietReflexSuccessUsedThisCombatCycle === true,
    silentReservoirUsedThisPlayerTurn: row.silentReservoirUsedThisPlayerTurn === true,
    returnStrokeUsedThisPlayerTurn: row.returnStrokeUsedThisPlayerTurn === true,
    queuedTurnStartApRefund: Math.max(0, num(row.queuedTurnStartApRefund)),
    lastApRefund: num(row.lastApRefund),
    lastBarrierGranted: num(row.lastBarrierGranted),
    lastCooldownAdvanced: row.lastCooldownAdvanced === true,
    lastPreserved: num(row.lastPreserved),
    lastReloadBonus: num(row.lastReloadBonus),
    lastCondensedImpact: num(row.lastCondensedImpact),
    lastQuietReflexGrade: parseGrade(row.lastQuietReflexGrade),
    zeroHourPause: pauseRaw ? {
      intentInstanceIds: Array.isArray(pauseRaw.intentInstanceIds)
        ? pauseRaw.intentInstanceIds.filter((id): id is string => typeof id === 'string')
        : [],
      targetEnemyCycle: num(pauseRaw.targetEnemyCycle),
      applied: pauseRaw.applied === true,
    } : null,
    lastEndTurn: endRaw && typeof endRaw.reason === 'string' ? {
      reason: endRaw.reason as PlayerTurnEndReason,
      usableAp: num(endRaw.usableAp),
      gainedNative: endRaw.gainedNative === true,
    } : null,
    lastSpendSource: parseSource(row.lastSpendSource),
    lastFleetingProvenance: typeof row.lastFleetingProvenance === 'string' ? row.lastFleetingProvenance : null,
    hostileApDisruptionThisPlayerTurn: row.hostileApDisruptionThisPlayerTurn === true,
    stayedSentenceFreeFocus: row.stayedSentenceFreeFocus === true,
  };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clampNative(value: unknown): number {
  return Math.max(0, Math.min(NATIVE_STILLNESS_CAP, Math.trunc(num(value))));
}

function parseGrade(value: unknown): InstinctGrade | null {
  if (value === 'FAILED' || value === 'STANDARD' || value === 'CLEAN' || value === 'PERFECT') return value;
  return null;
}

function parseSource(value: unknown): StillnessChargeSource | null {
  if (value === 'NATIVE' || value === 'FLEETING' || value === 'STORM_FREE' || value === 'STAYED_SENTENCE_FREE') return value;
  return null;
}

export function usablePlayerAp(input: UsableApInput): number {
  if (input.apDisabledByEnemy || input.apRemovedByEnemy) return 0;
  const remaining = Math.max(0, Math.trunc(input.remainingAp));
  const reserved = Math.max(0, Math.trunc(input.reservedAp ?? 0));
  return Math.max(0, remaining - reserved);
}

export function isVoluntaryStillnessEnd(reason: PlayerTurnEndReason): boolean {
  return reason === 'VOLUNTARY';
}

export function noteHostileApDisruption(state: StillpointRuntimeState): StillpointRuntimeState {
  return { ...state, hostileApDisruptionThisPlayerTurn: true };
}

export function previewNativeStillnessGain(
  state: StillpointRuntimeState,
  args: { reason: PlayerTurnEndReason; usableAp: number; stillpointOwned: boolean },
): { gain: boolean; atCap: boolean } {
  if (!args.stillpointOwned) return { gain: false, atCap: false };
  const atCap = state.nativeStillness >= NATIVE_STILLNESS_CAP;
  if (state.hostileApDisruptionThisPlayerTurn) return { gain: false, atCap };
  if (!isVoluntaryStillnessEnd(args.reason) || args.usableAp < 1) return { gain: false, atCap };
  if (atCap) return { gain: false, atCap: true };
  return { gain: true, atCap: false };
}

export function stillpointOwnedIds(ownedIds: readonly string[]): string[] {
  return ownedIds.filter((id) => id.startsWith('SP_'));
}

export function ownsStillpoint(ownedIds: readonly string[]): boolean {
  return stillpointOwnedIds(ownedIds).length > 0;
}

export function ownsStillpointId(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

export function beginStillpointPlayerTurn(
  state: StillpointRuntimeState,
  ownedIds: readonly string[],
): StillpointRuntimeState {
  const nextIndex = state.playerTurnIndex + 1;
  const stormLegal = ownsStillpointId(ownedIds, STILLPOINT_MANIFESTATION_ID)
    && stillpointOwnedIds(ownedIds).length >= 2
    && ownedIds.some((id) => id.startsWith('SP_CORE_'));
  const storm = stormLegal && state.nativeStillness >= 2;
  return {
    ...state,
    playerTurnIndex: nextIndex,
    playerTurnOpen: true,
    combatCycleIndex: state.combatCycleIndex + 1,
    focusedRoot: null,
    pendingCurrentFocusRootId: null,
    stormActiveThisTurn: storm,
    stormFreeFocusAvailable: storm,
    stormFocusedCount: 0,
    silentReservoirUsedThisPlayerTurn: false,
    returnStrokeUsedThisPlayerTurn: false,
    fleetingCreatedThisCombatCycle: false,
    quietReflexSuccessUsedThisCombatCycle: false,
    lastBarrierGranted: 0,
    lastCooldownAdvanced: false,
    lastPreserved: 0,
    lastReloadBonus: 0,
    lastCondensedImpact: 0,
    lastApRefund: 0,
    hostileApDisruptionThisPlayerTurn: false,
  };
}

export function applyQueuedTurnStartRefund(state: StillpointRuntimeState): {
  state: StillpointRuntimeState;
  refund: number;
} {
  const refund = Math.min(1, Math.max(0, state.queuedTurnStartApRefund));
  return {
    refund,
    state: {
      ...state,
      queuedTurnStartApRefund: 0,
      lastApRefund: refund,
    },
  };
}

export function beginStillpointEnemyCycle(state: StillpointRuntimeState): StillpointRuntimeState {
  const nextCycle = state.enemyCycleIndex + 1;
  let pause = state.zeroHourPause;
  if (pause && pause.targetEnemyCycle === nextCycle) {
    pause = { ...pause, applied: true };
  } else if (pause && pause.applied) {
    pause = null;
  }
  return {
    ...state,
    enemyCycleIndex: nextCycle,
    playerTurnOpen: false,
    zeroHourPause: pause,
  };
}

export function endStillpointEnemyCycle(state: StillpointRuntimeState): StillpointRuntimeState {
  if (!state.zeroHourPause?.applied) return state;
  return { ...state, zeroHourPause: null };
}

export function tickIntentCountdowns(
  intents: readonly HostileIntentSnapshot[],
  pause: StillpointRuntimeState['zeroHourPause'],
  enemyCycleIndex: number,
): HostileIntentSnapshot[] {
  const paused = new Set(
    pause && pause.targetEnemyCycle === enemyCycleIndex
      ? pause.intentInstanceIds
      : [],
  );
  return intents.map((row) => {
    if (row.protectedPhase) {
      return { ...row, countdown: Math.max(0, row.countdown - (row.countdown > 0 ? 1 : 0)) };
    }
    if (row.countdown <= 0) return row;
    if (paused.has(row.intentInstanceId)) return row;
    return { ...row, countdown: row.countdown - 1 };
  });
}

export function matchingStillpointSurfaces(
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  currentQualifies?: boolean,
): FocusedRootRecord['surfaces'] {
  if (ctx.classification === 'DERIVATIVE') return [];
  if (ctx.procDepth > 0) return [];
  if (!ctx.committed) return [];
  const surfaces: Array<FocusedRootRecord['surfaces'][number]> = [];
  const isUltimate = ctx.sourceKind === 'ULTIMATE' || ctx.actionSurface === 'ULTIMATE';
  if (isUltimate) return [];
  if (
    ownsStillpointId(ownedIds, STILLPOINT_CORE_IDS.STORED_FORCE)
    && (ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC' || (!ctx.actionSurface && ctx.sourceKind === 'PLAYER_ACTION'))
  ) {
    surfaces.push('ARMAMENT');
  }
  if (
    ownsStillpointId(ownedIds, STILLPOINT_CORE_IDS.PATIENT_INVOCATION)
    && (ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX')
  ) {
    surfaces.push('DISCIPLINE');
  }
  if (
    ownsStillpointId(ownedIds, STILLPOINT_CORE_IDS.QUIET_REFLEX)
    && (ctx.sourceKind === 'INSTINCT' || ctx.actionSurface === 'INSTINCT')
  ) {
    surfaces.push('INSTINCT');
  }
  if (ownsStillpointId(ownedIds, STILLPOINT_CORE_IDS.SILENT_RESERVOIR) && currentQualifies) {
    surfaces.push('CURRENT');
  }
  return surfaces;
}

export function previewPatientInvocationAp(
  authored: number,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  stillpoint: StillpointRuntimeState,
): number {
  const surfaces = matchingStillpointSurfaces(ctx, ownedIds, false);
  if (!surfaces.includes('DISCIPLINE')) return authored;
  if (!wouldFocus(stillpoint, surfaces.length > 0)) return authored;
  return discountApByOneMinOne(authored);
}

function wouldFocus(state: StillpointRuntimeState, eligible: boolean): boolean {
  if (!eligible) return false;
  if (state.focusedRoot?.consumed) return false;
  if (state.stormActiveThisTurn && state.stormFocusedCount >= MOTIONLESS_STORM_FOCUSED_CAP) return false;
  if (state.stormActiveThisTurn && state.stormFreeFocusAvailable) return true;
  if (state.stayedSentenceFreeFocus) return true;
  return availableCharge(state) != null;
}

function availableCharge(state: StillpointRuntimeState): StillnessChargeSource | null {
  if (state.fleeting && !state.fleeting.spent && fleetingLive(state, state.fleeting)) return 'FLEETING';
  if (state.nativeStillness > 0) return 'NATIVE';
  return null;
}

function fleetingLive(state: StillpointRuntimeState, fleeting: FleetingStillnessRecord): boolean {
  if (fleeting.spent) return false;
  if (state.playerTurnIndex < fleeting.eligiblePlayerTurn) return false;
  return state.playerTurnIndex <= fleeting.expiresAtPlayerTurnEnd;
}

export function consumeFocusForRoot(
  state: StillpointRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  currentQualifies = false,
): { state: StillpointRuntimeState; focused: FocusedRootRecord | null } {
  const surfaces = matchingStillpointSurfaces(ctx, ownedIds, currentQualifies);
  if (surfaces.length === 0) return { state, focused: null };
  if (state.focusedRoot?.rootActionId === ctx.rootActionId && state.focusedRoot.consumed) {
    return { state, focused: state.focusedRoot };
  }
  if (state.stormActiveThisTurn && state.stormFocusedCount >= MOTIONLESS_STORM_FOCUSED_CAP) {
    return { state, focused: null };
  }
  let source: StillnessChargeSource | null = null;
  let next = { ...state };
  if (state.stormActiveThisTurn && state.stormFreeFocusAvailable) {
    source = 'STORM_FREE';
    next = { ...next, stormFreeFocusAvailable: false };
  } else if (state.stayedSentenceFreeFocus) {
    source = 'STAYED_SENTENCE_FREE';
    next = { ...next, stayedSentenceFreeFocus: false, lastSpendSource: 'STAYED_SENTENCE_FREE' };
  } else {
    source = availableCharge(state);
    if (!source) return { state, focused: null };
    if (source === 'FLEETING' && next.fleeting) {
      next = {
        ...next,
        fleeting: { ...next.fleeting, spent: true },
        lastFleetingProvenance: next.fleeting.sourceDefinitionId,
        lastSpendSource: 'FLEETING',
      };
    } else if (source === 'NATIVE') {
      next = {
        ...next,
        nativeStillness: next.nativeStillness - 1,
        lastSpendSource: 'NATIVE',
      };
    }
  }
  const focused: FocusedRootRecord = {
    rootActionId: ctx.rootActionId,
    surfaces,
    chargeSource: source,
    consumed: true,
  };
  next = {
    ...next,
    focusedRoot: focused,
    stormFocusedCount: next.stormActiveThisTurn ? next.stormFocusedCount + 1 : next.stormFocusedCount,
  };
  return { state: next, focused };
}

export function stillnessProducerBlocked(source: StillnessChargeSource | null | undefined): boolean {
  return source === 'FLEETING' || source === 'STAYED_SENTENCE_FREE';
}

export function grantFleetingStillness(
  state: StillpointRuntimeState,
  sourceDefinitionId: string | null,
  extra: {
    phase?: import('../../types/stillpoint').FleetingCreationPhase;
    sourceRootId?: string | null;
    sourceLineage?: readonly string[];
  } = {},
): { state: StillpointRuntimeState; granted: boolean; refreshed: boolean } {
  const phase = extra.phase ?? (
    !state.playerTurnOpen
      ? 'ENEMY_CYCLE'
      : 'PLAYER_CONTROL'
  );
  const turn = state.playerTurnIndex;
  const eligible = phase === 'ENEMY_CYCLE' ? turn + 1 : turn;
  const expires = phase === 'PLAYER_TURN_INIT'
    ? turn
    : phase === 'ENEMY_CYCLE'
      ? turn + 1
      : turn + 1;
  const record: FleetingStillnessRecord = {
    sourceDefinitionId,
    createdCombatCycle: state.combatCycleIndex,
    createdPlayerTurn: turn,
    eligiblePlayerTurn: eligible,
    expiresAtPlayerTurnEnd: expires,
    spent: false,
    creationPhase: phase,
    sourceRootId: extra.sourceRootId ?? null,
    sourceLineage: extra.sourceLineage ?? [],
  };
  if (state.fleeting && !state.fleeting.spent) {
    if (state.fleetingCreatedThisCombatCycle) {
      return {
        granted: true,
        refreshed: true,
        state: {
          ...state,
          fleeting: {
            ...state.fleeting,
            expiresAtPlayerTurnEnd: Math.max(state.fleeting.expiresAtPlayerTurnEnd, expires),
            eligiblePlayerTurn: Math.min(state.fleeting.eligiblePlayerTurn, eligible),
            sourceDefinitionId: sourceDefinitionId ?? state.fleeting.sourceDefinitionId,
          },
        },
      };
    }
  }
  if (state.fleetingCreatedThisCombatCycle) {
    return { state, granted: false, refreshed: false };
  }
  return {
    granted: true,
    refreshed: false,
    state: {
      ...state,
      fleeting: record,
      fleetingCreatedThisCombatCycle: true,
    },
  };
}

export function applyStillpointEndTurn(
  state: StillpointRuntimeState,
  ownedIds: readonly string[],
  args: { reason: PlayerTurnEndReason; usableAp: number },
): {
  state: StillpointRuntimeState;
  gainedNative: boolean;
  barrier: number;
  nativeEvent: boolean;
} {
  let next = { ...state, playerTurnOpen: false };
  if (next.fleeting && next.playerTurnIndex >= next.fleeting.expiresAtPlayerTurnEnd) {
    next = { ...next, fleeting: null };
  }
  if (next.stormActiveThisTurn) {
    next = {
      ...next,
      nativeStillness: 0,
      stormActiveThisTurn: false,
      stormFreeFocusAvailable: false,
      stormFocusedCount: 0,
    };
  }
  const preview = previewNativeStillnessGain(next, {
    reason: args.reason,
    usableAp: args.usableAp,
    stillpointOwned: ownsStillpoint(ownedIds),
  });
  let gainedNative = false;
  let barrier = 0;
  if (preview.gain) {
    next = { ...next, nativeStillness: next.nativeStillness + 1 };
    gainedNative = true;
    if (ownsStillpointId(ownedIds, STILLPOINT_SUPPORT_IDS.SHELTERED_PAUSE)) {
      barrier = SHELTERED_PAUSE_BARRIER;
      next = { ...next, lastBarrierGranted: barrier };
    }
  }
  next = {
    ...next,
    lastEndTurn: { reason: args.reason, usableAp: args.usableAp, gainedNative },
  };
  return { state: next, gainedNative, barrier, nativeEvent: gainedNative };
}

export function condensedImpactFromRoot(
  ctx: CanonicalRootActionContext,
  depth: CombatDepthBand,
): CondensedImpactPacket | null {
  const primary = ctx.lockedTargetIds[0] ?? ctx.nativeByTarget[0]?.targetId;
  if (!primary) return null;
  const total = ctx.nativeByTarget.reduce((sum, row) => sum + row.nativeDirectDamage, 0);
  const kinetic = ctx.nativeByTarget.reduce((sum, row) => sum + (row.kineticNativeDamage ?? 0), 0);
  const occult = ctx.nativeByTarget.reduce((sum, row) => sum + (row.occultNativeDamage ?? 0), 0);
  const raw = roundCounterfateAmount(total * 0.25);
  const cap = STORED_FORCE_DEPTH_CAPS[depth];
  const damage = Math.min(cap, raw);
  const channels = kinetic + occult;
  let k = 0;
  let o = 0;
  if (channels > 0 && damage > 0) {
    k = roundCounterfateAmount(damage * (kinetic / channels));
    o = damage - k;
  } else if (ctx.damageChannels.includes('OCCULT') && !ctx.damageChannels.includes('KINETIC')) {
    o = damage;
  } else {
    k = damage;
  }
  return {
    damage,
    kinetic: k,
    occult: o,
    targetId: primary,
    fizzled: false,
  };
}

export function resolveCondensedImpactTarget(
  packet: CondensedImpactPacket,
  intents: readonly HostileIntentSnapshot[],
): CondensedImpactPacket {
  const target = intents.find((row) => row.unitId === packet.targetId);
  if (!target || !target.alive || target.phased) {
    return { ...packet, fizzled: true, damage: 0, kinetic: 0, occult: 0 };
  }
  return packet;
}

export function promoteQuietReflexGrade(grade: InstinctGrade): InstinctGrade {
  if (grade === 'STANDARD') return 'CLEAN';
  if (grade === 'CLEAN') return 'PERFECT';
  return grade;
}

export function scalePerfectNumeric(value: number): number {
  return value + roundCounterfateAmount(value * 0.5);
}

export function silentReservoirGainBonus(actual: number): number {
  return Math.min(10, roundCounterfateAmount(actual * 0.5));
}

export function silentReservoirSpendPreserve(actual: number): number {
  return Math.min(10, roundCounterfateAmount(actual * 0.5));
}

export function silentReservoirReloadBonus(restored: number, magazineRoom: number): number {
  const bonus = Math.min(2, roundCounterfateAmount(restored * 0.5));
  return Math.min(bonus, Math.max(0, magazineRoom));
}

export function returnStrokeQualifies(ctx: CanonicalRootActionContext, condensedKilled = false): boolean {
  if (ctx.kills > 0 || condensedKilled) return true;
  if (ctx.intentCountered) return true;
  if (ctx.bossThresholdReached || ctx.objectiveProgress) return true;
  return ctx.nativeByTarget.some((row) => row.kineticArmorBroken || row.occultWardBroken || row.killed);
}

export function applyReturnStroke(
  state: StillpointRuntimeState,
  ownedIds: readonly string[],
  duringPlayerTurn: boolean,
): { state: StillpointRuntimeState; refundNow: number; queued: number } {
  if (!ownsStillpointId(ownedIds, STILLPOINT_SUPPORT_IDS.RETURN_STROKE)) {
    return { state, refundNow: 0, queued: 0 };
  }
  if (state.returnStrokeUsedThisPlayerTurn) return { state, refundNow: 0, queued: 0 };
  if (duringPlayerTurn) {
    return {
      refundNow: 1,
      queued: 0,
      state: {
        ...state,
        returnStrokeUsedThisPlayerTurn: true,
        lastApRefund: 1,
      },
    };
  }
  return {
    refundNow: 0,
    queued: 1,
    state: {
      ...state,
      returnStrokeUsedThisPlayerTurn: true,
      queuedTurnStartApRefund: 1,
      lastApRefund: 1,
    },
  };
}

export function applyZeroHour(
  state: StillpointRuntimeState,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  nativeRows: readonly TargetNativeResult[],
): {
  state: StillpointRuntimeState;
  consumed: number;
  bonusPercent: number;
  modified: TargetNativeResult[];
} {
  if (!ownsStillpointId(ownedIds, STILLPOINT_VERDICT_ID)) {
    return { state, consumed: 0, bonusPercent: 0, modified: nativeRows.slice() };
  }
  const consumed = state.nativeStillness;
  const bonusPercent = consumed * 0.2;
  let next = { ...state, nativeStillness: 0, lastSpendSource: consumed > 0 ? 'NATIVE' as const : state.lastSpendSource };
  if (consumed === 2) {
    next = {
      ...next,
      zeroHourPause: {
        intentInstanceIds: intents
          .filter((row) => row.countdown > 0 && !row.protectedPhase)
          .map((row) => row.intentInstanceId),
        targetEnemyCycle: state.enemyCycleIndex + 1,
        applied: false,
      },
    };
  }
  const modified = bonusPercent > 0
    ? scaleNativeOnce(nativeRows, bonusPercent)
    : nativeRows.slice();
  return { state: next, consumed, bonusPercent, modified };
}

function scaleNativeOnce(rows: readonly TargetNativeResult[], percent: number): TargetNativeResult[] {
  const total = rows.reduce((sum, row) => sum + row.nativeDirectDamage, 0);
  const bonus = roundCounterfateAmount(total * percent);
  if (bonus <= 0 || total <= 0) return rows.slice();
  let remaining = bonus;
  return rows.map((row, index) => {
    const share = index === rows.length - 1
      ? remaining
      : roundCounterfateAmount(bonus * (row.nativeDirectDamage / total));
    remaining -= share;
    const kinetic = row.kineticNativeDamage ?? 0;
    const occult = row.occultNativeDamage ?? 0;
    const channels = kinetic + occult;
    let nextK = row.kineticNativeDamage;
    let nextO = row.occultNativeDamage;
    if (channels > 0) {
      const kShare = roundCounterfateAmount(share * (kinetic / channels));
      nextK = kinetic + kShare;
      nextO = occult + (share - kShare);
    }
    return {
      ...row,
      nativeDirectDamage: row.nativeDirectDamage + share,
      kineticNativeDamage: nextK,
      occultNativeDamage: nextO,
    };
  });
}

export function clearEncounterStillpoint(): StillpointRuntimeState {
  return createDefaultStillpointState();
}

export function stillpointPresentation(state: StillpointRuntimeState, ownedIds: readonly string[]): {
  nativeLabel: string;
  fleetingLabel: string | null;
    stormFree: boolean;
  stayedSentenceFree: boolean;
  stormRemaining: number;
  zeroHourPausePending: boolean;
  lastDiscountPreview: string | null;
  lastApRefund: number;
  lastBarrier: number;
  lastPreservation: number;
  lastCondensedImpact: number;
  chargeSource: StillnessChargeSource | null;
} {
  return {
    nativeLabel: `${state.nativeStillness} / ${NATIVE_STILLNESS_CAP}`,
    fleetingLabel: state.fleeting && !state.fleeting.spent
      ? `Fleeting · expires T${state.fleeting.expiresAtPlayerTurnEnd}`
      : null,
    stormFree: state.stormFreeFocusAvailable,
    stayedSentenceFree: state.stayedSentenceFreeFocus,
    stormRemaining: state.stormActiveThisTurn
      ? Math.max(0, MOTIONLESS_STORM_FOCUSED_CAP - state.stormFocusedCount)
      : 0,
    zeroHourPausePending: Boolean(state.zeroHourPause && !state.zeroHourPause.applied),
    lastDiscountPreview: ownsStillpointId(ownedIds, STILLPOINT_CORE_IDS.PATIENT_INVOCATION)
      ? 'Focused Technique/Flex −1 AP (min 1)'
      : null,
    lastApRefund: state.lastApRefund,
    lastBarrier: state.lastBarrierGranted,
    lastPreservation: state.lastPreserved,
    lastCondensedImpact: state.lastCondensedImpact,
    chargeSource: state.focusedRoot?.chargeSource ?? state.lastSpendSource,
  };
}
