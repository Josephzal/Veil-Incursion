import type { CanonicalRootActionContext, InstinctGrade } from '../../types/nineStrain';
import type { CombatDepthBand, HostileIntentSnapshot } from '../../types/counterfate';
import type {
  TightenedThreadCharge,
  WoundweavePacket,
  WoundweavePresentation,
  WoundweaveRuntimeState,
} from '../../types/woundweave';
import {
  CASCADING_TEAR_BY_DEPTH,
  COMMON_GRAVE_GROUP_SHARE,
  COMMON_GRAVE_LONE_SHARE,
  ONE_BODY_SECONDARY_STRENGTH,
  SELF_LINK_STRENGTH,
  SHARED_WOUND_MIRROR,
  WOUNDWEAVE_CORE_IDS,
  WOUNDWEAVE_MANIFESTATION_ID,
  WOUNDWEAVE_SUPPORT_IDS,
  WOUNDWEAVE_VERDICT_ID,
} from '../../types/woundweave';
import { roundCounterfateAmount } from './counterfateMath';
import { compareTraceFallback } from './intentIdentity';
import { distributeOccultBudget } from './afterimageEngine';
import { isDirectlyAffectedNative } from './rootAction';

export { isDirectlyAffectedNative };

export function createDefaultWoundweaveState(): WoundweaveRuntimeState {
  return {
    playerTurnIndex: 0,
    playerTurnOpen: false,
    nextAffectSequence: 1,
    linkGeneration: 0,
    endpointA: null,
    endpointB: null,
    selfLink: false,
    pendingEndpoint: null,
    selfLinkCandidateUnitId: null,
    selfLinkCandidateRootId: null,
    emptySlotAwaitingRefill: false,
    recencyA: 0,
    recencyB: 0,
    formedPlayerTurn: 0,
    expiresAtPlayerTurnStart: 0,
    persistent: false,
    secondaryEndpointIds: [],
    tightenedCharge: null,
    cascadingUsedThisPlayerTurn: false,
    crossedHexUsedThisPlayerTurn: false,
    currentGuardUsedThisPlayerTurn: false,
    reflexiveUsedThisCombatCycle: false,
    phaseSuccessorByUnitId: {},
    lastLog: null,
    lastPackets: [],
    lastTwofoldFormation: false,
    entangledSeededUnitId: null,
  };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function hydrateWoundweaveState(raw: unknown): WoundweaveRuntimeState {
  const base = createDefaultWoundweaveState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const chargeRaw = row.tightenedCharge && typeof row.tightenedCharge === 'object'
    ? row.tightenedCharge as Record<string, unknown>
    : null;
  const successors = row.phaseSuccessorByUnitId && typeof row.phaseSuccessorByUnitId === 'object'
    ? Object.fromEntries(
      Object.entries(row.phaseSuccessorByUnitId as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
    : {};
  return {
    ...base,
    playerTurnIndex: num(row.playerTurnIndex),
    playerTurnOpen: row.playerTurnOpen === true,
    nextAffectSequence: Math.max(1, num(row.nextAffectSequence)),
    linkGeneration: num(row.linkGeneration),
    endpointA: typeof row.endpointA === 'string' ? row.endpointA : null,
    endpointB: typeof row.endpointB === 'string' ? row.endpointB : null,
    selfLink: row.selfLink === true,
    pendingEndpoint: typeof row.pendingEndpoint === 'string' ? row.pendingEndpoint : null,
    selfLinkCandidateUnitId: typeof row.selfLinkCandidateUnitId === 'string' ? row.selfLinkCandidateUnitId : null,
    selfLinkCandidateRootId: typeof row.selfLinkCandidateRootId === 'string' ? row.selfLinkCandidateRootId : null,
    emptySlotAwaitingRefill: row.emptySlotAwaitingRefill === true,
    recencyA: num(row.recencyA),
    recencyB: num(row.recencyB),
    formedPlayerTurn: num(row.formedPlayerTurn),
    expiresAtPlayerTurnStart: num(row.expiresAtPlayerTurnStart),
    persistent: row.persistent === true,
    secondaryEndpointIds: Array.isArray(row.secondaryEndpointIds)
      ? row.secondaryEndpointIds.filter((id): id is string => typeof id === 'string')
      : [],
    tightenedCharge: chargeRaw && typeof chargeRaw.sourceRootId === 'string' ? {
      power: num(chargeRaw.power),
      signal: chargeRaw.signal === 'MAJOR' ? 'MAJOR' : 'ORDINARY',
      sourceRootId: chargeRaw.sourceRootId,
      linkGeneration: num(chargeRaw.linkGeneration),
      armedAfterRootId: typeof chargeRaw.armedAfterRootId === 'string' ? chargeRaw.armedAfterRootId : chargeRaw.sourceRootId,
    } : null,
    cascadingUsedThisPlayerTurn: row.cascadingUsedThisPlayerTurn === true,
    crossedHexUsedThisPlayerTurn: row.crossedHexUsedThisPlayerTurn === true,
    currentGuardUsedThisPlayerTurn: row.currentGuardUsedThisPlayerTurn === true,
    reflexiveUsedThisCombatCycle: row.reflexiveUsedThisCombatCycle === true,
    phaseSuccessorByUnitId: successors,
    lastLog: typeof row.lastLog === 'string' ? row.lastLog : null,
    lastPackets: Array.isArray(row.lastPackets)
      ? row.lastPackets.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const rec = entry as Record<string, unknown>;
        if (typeof rec.targetId !== 'string' || typeof rec.occultDamage !== 'number') return [];
        const kind = rec.kind;
        if (kind !== 'MIRROR' && kind !== 'PULSE' && kind !== 'THREAD' && kind !== 'TEAR' && kind !== 'GRAVE') return [];
        return [{
          targetId: rec.targetId,
          occultDamage: rec.occultDamage,
          kind,
          lineage: Array.isArray(rec.lineage) ? rec.lineage.filter((id): id is string => typeof id === 'string') : [],
          fizzled: rec.fizzled === true,
        }];
      })
      : [],
    lastTwofoldFormation: row.lastTwofoldFormation === true,
    entangledSeededUnitId: typeof row.entangledSeededUnitId === 'string' ? row.entangledSeededUnitId : null,
  };
}

export function clearEncounterWoundweave(): WoundweaveRuntimeState {
  return createDefaultWoundweaveState();
}

export function ownsWoundweaveId(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

export function legalHostile(intents: readonly HostileIntentSnapshot[], unitId: string | null): HostileIntentSnapshot | null {
  if (!unitId) return null;
  const row = intents.find((intent) => intent.unitId === unitId);
  if (!row || !row.alive || row.phased || row.invulnerable) return null;
  return row;
}

export function livingLegalHostiles(intents: readonly HostileIntentSnapshot[]): HostileIntentSnapshot[] {
  return intents.filter((row) => row.alive && !row.phased && !row.invulnerable);
}

export function orderDirectlyAffected(
  ctx: CanonicalRootActionContext,
  intents: readonly HostileIntentSnapshot[],
): string[] {
  const fromField = ctx.directlyAffectedTargetIds;
  const unique = [...new Set((fromField && fromField.length > 0
    ? fromField
    : ctx.nativeByTarget.filter(isDirectlyAffectedNative).map((row) => row.targetId)
  ))].filter((id) => legalHostile(intents, id));
  const locked = ctx.lockedTargetIds;
  const primary = locked[0];
  return unique.slice().sort((a, b) => {
    if (a === primary && b !== primary) return -1;
    if (b === primary && a !== primary) return 1;
    const ai = locked.indexOf(a);
    const bi = locked.indexOf(b);
    if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi;
    if (ai >= 0 && bi < 0) return -1;
    if (bi >= 0 && ai < 0) return 1;
    const ha = intents.find((row) => row.unitId === a);
    const hb = intents.find((row) => row.unitId === b);
    const pos = (ha?.positionRank ?? 99) - (hb?.positionRank ?? 99);
    if (pos !== 0) return pos;
    return a.localeCompare(b);
  });
}

function mapPhase(state: WoundweaveRuntimeState, unitId: string | null): string | null {
  if (!unitId) return null;
  return state.phaseSuccessorByUnitId[unitId] ?? unitId;
}

function remapEndpoints(state: WoundweaveRuntimeState): WoundweaveRuntimeState {
  return {
    ...state,
    endpointA: mapPhase(state, state.endpointA),
    endpointB: mapPhase(state, state.endpointB),
    pendingEndpoint: mapPhase(state, state.pendingEndpoint),
    selfLinkCandidateUnitId: mapPhase(state, state.selfLinkCandidateUnitId),
    secondaryEndpointIds: state.secondaryEndpointIds.map((id) => mapPhase(state, id) ?? id),
  };
}

export function hasPrimaryPair(state: WoundweaveRuntimeState): boolean {
  if (state.selfLink) return Boolean(state.endpointA);
  return Boolean(state.endpointA && state.endpointB);
}

export function isPrimaryEndpoint(state: WoundweaveRuntimeState, unitId: string): boolean {
  if (state.selfLink) return state.endpointA === unitId;
  return state.endpointA === unitId || state.endpointB === unitId;
}

export function isLinkedWoundweaveEndpoint(state: WoundweaveRuntimeState, unitId: string): boolean {
  return isPrimaryEndpoint(state, unitId) || state.secondaryEndpointIds.includes(unitId);
}

export function seedEntangledFateEndpoint(
  state: WoundweaveRuntimeState,
  fateboundUnitId: string | null,
  intents: readonly HostileIntentSnapshot[],
  ownedIds: readonly string[],
): WoundweaveRuntimeState {
  if (!fateboundUnitId || !legalHostile(intents, fateboundUnitId)) return state;
  if (state.selfLink && state.endpointA === fateboundUnitId) {
    return { ...state, entangledSeededUnitId: fateboundUnitId };
  }
  if (hasPrimaryPair(state) && !state.selfLink) {
    if (state.endpointA === fateboundUnitId || state.endpointB === fateboundUnitId) {
      return { ...state, entangledSeededUnitId: fateboundUnitId };
    }
    const partner = state.endpointA !== fateboundUnitId ? state.endpointA : state.endpointB;
    if (partner && partner !== fateboundUnitId && legalHostile(intents, partner)) {
      return {
        ...formPair(state, ownedIds, intents, fateboundUnitId, partner, false, true, false),
        lastLog: 'Entangled Fate reseat',
        entangledSeededUnitId: fateboundUnitId,
        lastTwofoldFormation: false,
      };
    }
  }
  return {
    ...state,
    pendingEndpoint: fateboundUnitId,
    entangledSeededUnitId: fateboundUnitId,
    lastLog: 'Entangled Fate seed',
  };
}

export function reformWoundlinkPair(
  state: WoundweaveRuntimeState,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  a: string | null,
  b: string | null,
  selfLink: boolean,
): WoundweaveRuntimeState {
  if (selfLink && a) {
    return {
      ...formPair(state, ownedIds, intents, a, null, true, true, true),
      lastLog: 'Ghost Thread re-link',
    };
  }
  if (a && b && a !== b) {
    return {
      ...formPair(state, ownedIds, intents, a, b, false, true, true),
      lastLog: 'Ghost Thread re-link',
    };
  }
  if (a && legalHostile(intents, a)) {
    return {
      ...clearLink(state, 'Ghost Thread pending'),
      pendingEndpoint: a,
      lastLog: 'Ghost Thread pending',
    };
  }
  return clearLink(state, 'Ghost Thread cleared');
}

function clearLink(state: WoundweaveRuntimeState, log: string | null): WoundweaveRuntimeState {
  return {
    ...state,
    linkGeneration: state.linkGeneration + 1,
    endpointA: null,
    endpointB: null,
    selfLink: false,
    pendingEndpoint: null,
    selfLinkCandidateUnitId: null,
    selfLinkCandidateRootId: null,
    emptySlotAwaitingRefill: false,
    recencyA: 0,
    recencyB: 0,
    secondaryEndpointIds: [],
    tightenedCharge: null,
    lastLog: log,
  };
}

export function beginWoundweavePlayerTurn(state: WoundweaveRuntimeState): WoundweaveRuntimeState {
  const nextIndex = state.playerTurnIndex + 1;
  let next: WoundweaveRuntimeState = {
    ...state,
    playerTurnIndex: nextIndex,
    playerTurnOpen: true,
    cascadingUsedThisPlayerTurn: false,
    crossedHexUsedThisPlayerTurn: false,
    currentGuardUsedThisPlayerTurn: false,
    reflexiveUsedThisCombatCycle: false,
    secondaryEndpointIds: [],
    lastPackets: [],
  };
  const live = hasPrimaryPair(next) || next.emptySlotAwaitingRefill || Boolean(next.pendingEndpoint);
  if (live && next.expiresAtPlayerTurnStart > 0 && next.expiresAtPlayerTurnStart <= nextIndex) {
    next = clearLink(next, 'Woundlink expired');
  }
  return next;
}

function snapshotSecondaries(
  state: WoundweaveRuntimeState,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
): WoundweaveRuntimeState {
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_MANIFESTATION_ID)) return { ...state, secondaryEndpointIds: [] };
  if (!hasPrimaryPair(state)) return state;
  const primaries = new Set([state.endpointA, state.endpointB].filter(Boolean));
  return {
    ...state,
    secondaryEndpointIds: livingLegalHostiles(intents)
      .map((row) => row.unitId)
      .filter((id) => !primaries.has(id)),
  };
}

function formPair(
  state: WoundweaveRuntimeState,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  a: string,
  b: string | null,
  selfLink: boolean,
  snapshot = true,
  twofoldQualifies = true,
): WoundweaveRuntimeState {
  const persistent = ownsWoundweaveId(ownedIds, WOUNDWEAVE_SUPPORT_IDS.PERSISTENT_STITCH);
  const formed = state.playerTurnIndex;
  let next: WoundweaveRuntimeState = {
    ...state,
    linkGeneration: state.linkGeneration + 1,
    endpointA: a,
    endpointB: selfLink ? null : b,
    selfLink,
    pendingEndpoint: null,
    emptySlotAwaitingRefill: false,
    selfLinkCandidateUnitId: null,
    selfLinkCandidateRootId: null,
    recencyA: state.nextAffectSequence,
    recencyB: b && !selfLink ? state.nextAffectSequence + 1 : 0,
    nextAffectSequence: state.nextAffectSequence + 2,
    formedPlayerTurn: formed,
    expiresAtPlayerTurnStart: formed + (persistent ? 2 : 1),
    persistent,
    tightenedCharge: null,
    lastTwofoldFormation: twofoldQualifies,
    entangledSeededUnitId: null,
    lastLog: selfLink ? 'Self-Link formed' : 'Woundlink formed',
  };
  if (snapshot) next = snapshotSecondaries(next, ownedIds, intents);
  else {
    const primaries = new Set([next.endpointA, next.endpointB].filter(Boolean));
    next = {
      ...next,
      secondaryEndpointIds: next.secondaryEndpointIds.filter((id) => !primaries.has(id) && legalHostile(intents, id)),
    };
  }
  return next;
}

function translateAmount(base: number, selfLink: boolean): number {
  if (base <= 0) return 0;
  return roundCounterfateAmount(base * (selfLink ? SELF_LINK_STRENGTH : 1));
}

function pushPacket(
  packets: WoundweavePacket[],
  secondaryAcc: Map<string, number>,
  targetId: string,
  amount: number,
  kind: WoundweavePacket['kind'],
  lineage: readonly string[],
  asSecondary: boolean,
): void {
  if (amount <= 0) return;
  if (asSecondary) {
    secondaryAcc.set(targetId, (secondaryAcc.get(targetId) ?? 0) + amount);
    return;
  }
  packets.push({ targetId, occultDamage: amount, kind, lineage, fizzled: false });
}

function flushSecondaries(
  packets: WoundweavePacket[],
  secondaryAcc: Map<string, number>,
  kind: WoundweavePacket['kind'],
  lineage: readonly string[],
): void {
  for (const [targetId, raw] of secondaryAcc) {
    const occultDamage = roundCounterfateAmount(raw * ONE_BODY_SECONDARY_STRENGTH);
    if (occultDamage > 0) {
      packets.push({ targetId, occultDamage, kind, lineage, fizzled: false });
    }
  }
  secondaryAcc.clear();
}

function partnerOf(state: WoundweaveRuntimeState, unitId: string): string | null {
  if (state.selfLink) return null;
  if (state.endpointA === unitId) return state.endpointB;
  if (state.endpointB === unitId) return state.endpointA;
  return null;
}

function isWeaponRoot(ctx: CanonicalRootActionContext): boolean {
  if (ctx.sourceKind === 'INSTINCT' || ctx.sourceKind === 'ULTIMATE') return false;
  const surface = ctx.actionSurface;
  return surface !== 'TECHNIQUE' && surface !== 'FLEX' && surface !== 'INSTINCT' && surface !== 'ULTIMATE';
}

export function applyWoundweavePacketsToIntents(
  intents: readonly HostileIntentSnapshot[],
  packets: readonly WoundweavePacket[],
): HostileIntentSnapshot[] {
  return intents.map((row) => {
    if (row.protectedPhase || row.invulnerable) return row;
    const damage = packets
      .filter((packet) => packet.targetId === row.unitId && !packet.fizzled)
      .reduce((sum, packet) => sum + packet.occultDamage, 0);
    if (damage <= 0) return row;
    const hp = Math.max(0, row.hp - damage);
    return { ...row, hp, alive: hp > 0 && row.alive };
  });
}

export function processWoundweaveRoot(args: {
  state: WoundweaveRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  depth: CombatDepthBand;
  jammed: boolean;
  familyScale?: number;
  twofoldScale?: number;
}): { state: WoundweaveRuntimeState; packets: WoundweavePacket[]; intents: HostileIntentSnapshot[]; consumedTwofold: boolean } {
  const { ctx, ownedIds, jammed, depth } = args;
  let intents = args.intents.slice();
  let state = remapEndpoints({ ...args.state, lastTwofoldFormation: false });
  const packets: WoundweavePacket[] = [];
  if (!ctx.committed || ctx.classification !== 'NATIVE_DIRECT' || ctx.procDepth > 0) {
    return { state, packets, intents, consumedTwofold: false };
  }
  intents = intents.map((row) => {
    const native = ctx.nativeByTarget.find((hit) => hit.targetId === row.unitId);
    if (!native) return row;
    if (native.killed) return { ...row, alive: false, hp: 0 };
    return row;
  });

  const affected = orderDirectlyAffected(ctx, intents);
  const isUltimate = ctx.sourceKind === 'ULTIMATE' || ctx.actionSurface === 'ULTIMATE';

  if (isUltimate && ownsWoundweaveId(ownedIds, WOUNDWEAVE_VERDICT_ID)) {
    const grave = resolveCommonGrave(state, ctx, ownedIds, intents, jammed, affected);
    intents = applyWoundweavePacketsToIntents(intents, grave.packets);
    return { state: { ...grave.state, lastPackets: grave.packets }, packets: grave.packets, intents, consumedTwofold: false };
  }

  let emptiedThisRoot = false;
  const released = releaseTightenedThread(state, ctx, ownedIds, intents, affected, packets);
  state = released;

  const tear = processCascadingTear(state, ctx, ownedIds, intents, depth, packets, true);
  state = tear.state;
  emptiedThisRoot = tear.emptied;
  intents = intents.slice();

  state = formOrReplace(state, ctx, ownedIds, intents, affected, emptiedThisRoot);

  if (hasPrimaryPair(state)) {
    emitSharedWound(state, ctx, ownedIds, intents, affected, packets);
    state = emitCrossedHex(state, ctx, ownedIds, intents, packets);
    if ((ctx.sourceKind === 'INSTINCT' || ctx.actionSurface === 'INSTINCT') && ctx.instinctGrade) {
      const pulse = emitReflexiveAgony(state, ownedIds, intents, ctx.instinctGrade, ctx.rootActionId);
      state = pulse.state;
      packets.push(...pulse.packets);
    }
  }

  const familyScale = args.familyScale ?? 1;
  const twofoldScale = args.twofoldScale ?? 1;
  const scaled = scaleWoundweaveFamilyPackets(packets, familyScale, twofoldScale);
  packets.length = 0;
  packets.push(...scaled.packets);
  let consumedTwofold = scaled.consumedTwofold;

  intents = applyWoundweavePacketsToIntents(intents, packets);
  if (!state.cascadingUsedThisPlayerTurn && ownsWoundweaveId(ownedIds, WOUNDWEAVE_SUPPORT_IDS.CASCADING_TEAR)) {
    const synthetic: CanonicalRootActionContext = {
      ...ctx,
      nativeByTarget: intents.filter((row) => isPrimaryEndpoint(state, row.unitId) && !row.alive).map((row) => ({
        targetId: row.unitId,
        hits: 0,
        misses: 0,
        crits: 0,
        nativeDirectDamage: 0,
        defenseDamage: 0,
        defenseBreaks: 0,
        fractures: 0,
        statusesApplied: 0,
        killed: true,
        healingDealt: 0,
        movement: 0,
      })),
    };
    const beforeTear = packets.length;
    const late = processCascadingTear(state, synthetic, ownedIds, intents, depth, packets, false);
    state = late.state;
    const lateOnly = packets.slice(beforeTear);
    const lateScaled = scaleWoundweaveFamilyPackets(lateOnly, familyScale, 1);
    packets.splice(beforeTear, lateOnly.length, ...lateScaled.packets);
  }

  state = applyIllegalEndpoints(state, intents);
  return { state: { ...state, lastPackets: packets }, packets, intents, consumedTwofold };
}

function scaleWoundweaveFamilyPackets(
  packets: readonly WoundweavePacket[],
  familyScale: number,
  twofoldScale: number,
): { packets: WoundweavePacket[]; consumedTwofold: boolean } {
  let consumedTwofold = false;
  const next = packets.map((packet) => {
    let mul = 1;
    if (packet.kind === 'MIRROR' || packet.kind === 'PULSE' || packet.kind === 'THREAD' || packet.kind === 'TEAR') {
      mul *= familyScale;
    }
    if (packet.kind === 'MIRROR' || packet.kind === 'PULSE' || packet.kind === 'THREAD') {
      if (twofoldScale !== 1) {
        mul *= twofoldScale;
        consumedTwofold = true;
      }
    }
    if (mul === 1) return packet;
    return { ...packet, occultDamage: roundCounterfateAmount(packet.occultDamage * mul) };
  });
  return { packets: next, consumedTwofold };
}

function releaseTightenedThread(
  state: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  affected: readonly string[],
  packets: WoundweavePacket[],
): WoundweaveRuntimeState {
  const charge = state.tightenedCharge;
  if (!charge) return state;
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD)) return state;
  if (charge.armedAfterRootId === ctx.rootActionId || charge.sourceRootId === ctx.rootActionId) return state;
  if (charge.linkGeneration !== state.linkGeneration) {
    return { ...state, tightenedCharge: null };
  }
  if (!affected.some((id) => isPrimaryEndpoint(state, id))) return state;
  const secondaryAcc = new Map<string, number>();
  const amount = translateAmount(charge.power, state.selfLink);
  const lineage = [ctx.rootActionId, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD];
  const targets = state.selfLink ? [state.endpointA] : [state.endpointA, state.endpointB];
  for (const id of targets) {
    if (id && legalHostile(intents, id)) {
      pushPacket(packets, secondaryAcc, id, amount, 'THREAD', lineage, false);
    }
  }
  for (const id of state.secondaryEndpointIds) {
    if (legalHostile(intents, id)) {
      pushPacket(packets, secondaryAcc, id, charge.power, 'THREAD', lineage, true);
    }
  }
  flushSecondaries(packets, secondaryAcc, 'THREAD', lineage);
  return { ...state, tightenedCharge: null, lastLog: 'Tightened Thread released' };
}

function processCascadingTear(
  state: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  depth: CombatDepthBand,
  packets: WoundweavePacket[],
  fromNative: boolean,
): { state: WoundweaveRuntimeState; emptied: boolean } {
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_SUPPORT_IDS.CASCADING_TEAR) || state.cascadingUsedThisPlayerTurn) {
    return { state, emptied: false };
  }
  if (!hasPrimaryPair(state)) return { state, emptied: false };
  const triggered = ctx.nativeByTarget.filter((row) => {
    if (!isPrimaryEndpoint(state, row.targetId)) return false;
    return row.killed || row.kineticArmorBroken === true || row.occultWardBroken === true
      || (fromNative && (ctx.bossThresholdReached === true || ctx.objectiveProgress === true));
  });
  if (triggered.length === 0) return { state, emptied: false };
  const power = CASCADING_TEAR_BY_DEPTH[depth];
  const lineage = [ctx.rootActionId, WOUNDWEAVE_SUPPORT_IDS.CASCADING_TEAR];
  let next: WoundweaveRuntimeState = { ...state, cascadingUsedThisPlayerTurn: true, lastLog: 'Cascading Tear' };
  if (state.selfLink) {
    const dead = triggered.some((row) => row.killed);
    if (!dead && state.endpointA && legalHostile(intents, state.endpointA)) {
      packets.push({
        targetId: state.endpointA,
        occultDamage: translateAmount(power, true),
        kind: 'TEAR',
        lineage,
        fizzled: false,
      });
    }
    return { state: next, emptied: false };
  }
  const source = triggered[0];
  const partner = partnerOf(state, source.targetId);
  if (partner && legalHostile(intents, partner)) {
    packets.push({
      targetId: partner,
      occultDamage: power,
      kind: 'TEAR',
      lineage,
      fizzled: false,
    });
  }
  const died = triggered.some((row) => row.killed);
  if (died) {
    const emptied = applyIllegalEndpoints(next, intents.map((row) => (
      triggered.some((hit) => hit.targetId === row.unitId && hit.killed)
        ? { ...row, alive: false, hp: 0 }
        : row
    )));
    return { state: emptied, emptied: emptied.emptySlotAwaitingRefill };
  }
  return { state: next, emptied: false };
}

function applyIllegalEndpoints(
  state: WoundweaveRuntimeState,
  intents: readonly HostileIntentSnapshot[],
): WoundweaveRuntimeState {
  const secondaries = state.secondaryEndpointIds.filter((id) => legalHostile(intents, id));
  if (!state.endpointA && !state.endpointB) {
    return { ...state, secondaryEndpointIds: secondaries };
  }
  const aLegal = legalHostile(intents, state.endpointA);
  const bLegal = legalHostile(intents, state.endpointB);
  if (state.selfLink) {
    if (!aLegal) return { ...clearLink(state, 'Self-Link broken'), secondaryEndpointIds: [] };
    return { ...state, secondaryEndpointIds: secondaries };
  }
  if (aLegal && bLegal) return { ...state, secondaryEndpointIds: secondaries };
  if (!aLegal && !bLegal) return clearLink(state, 'Woundlink broken');
  if (!aLegal && bLegal) {
    return {
      ...state,
      endpointA: state.endpointB,
      endpointB: null,
      emptySlotAwaitingRefill: true,
      tightenedCharge: null,
      secondaryEndpointIds: secondaries,
      lastLog: 'Endpoint emptied',
    };
  }
  return {
    ...state,
    endpointB: null,
    emptySlotAwaitingRefill: true,
    tightenedCharge: null,
    secondaryEndpointIds: secondaries,
    lastLog: 'Endpoint emptied',
  };
}

function formOrReplace(
  state: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  affected: readonly string[],
  skipRefill: boolean,
): WoundweaveRuntimeState {
  if (affected.length === 0) return state;
  const living = livingLegalHostiles(intents);

  if (!skipRefill && state.emptySlotAwaitingRefill && state.endpointA) {
    const fill = affected.find((id) => id !== state.endpointA && legalHostile(intents, id));
    if (fill) {
      return formPair(state, ownedIds, intents, state.endpointA, fill, false, true);
    }
  }

  if (hasPrimaryPair(state) && ownsWoundweaveId(ownedIds, WOUNDWEAVE_SUPPORT_IDS.PERSISTENT_STITCH) && !state.selfLink) {
    const unlinked = affected.find((id) => !isPrimaryEndpoint(state, id) && legalHostile(intents, id));
    if (unlinked) {
      const replaceA = state.recencyA <= state.recencyB;
      const nextA = replaceA ? unlinked : state.endpointA;
      const nextB = replaceA ? state.endpointB : unlinked;
      if (nextA && nextB) return formPair(state, ownedIds, intents, nextA, nextB, false, false, false);
    }
    let recency = state;
    if (state.endpointA && affected.includes(state.endpointA)) {
      recency = { ...recency, recencyA: recency.nextAffectSequence, nextAffectSequence: recency.nextAffectSequence + 1 };
    }
    if (state.endpointB && affected.includes(state.endpointB)) {
      recency = { ...recency, recencyB: recency.nextAffectSequence, nextAffectSequence: recency.nextAffectSequence + 1 };
    }
    return recency;
  }

  if (hasPrimaryPair(state)) return state;

  if (living.length === 1) {
    const only = living[0].unitId;
    if (!affected.includes(only)) return state;
    if (state.entangledSeededUnitId === only && state.pendingEndpoint === only) {
      return formPair(state, ownedIds, intents, only, null, true, true, true);
    }
    if (!state.selfLinkCandidateRootId) {
      return {
        ...state,
        pendingEndpoint: only,
        selfLinkCandidateUnitId: only,
        selfLinkCandidateRootId: ctx.rootActionId,
        lastLog: 'Self-Link candidate',
      };
    }
    if (state.selfLinkCandidateRootId !== ctx.rootActionId && state.selfLinkCandidateUnitId === only) {
      return formPair(state, ownedIds, intents, only, null, true, true);
    }
    return state;
  }

  if (state.selfLinkCandidateUnitId && living.length > 1) {
    state = {
      ...state,
      selfLinkCandidateUnitId: null,
      selfLinkCandidateRootId: null,
    };
  }

  if (affected.length >= 2) {
    return formPair(state, ownedIds, intents, affected[0], affected[1], false, true);
  }

  if (state.pendingEndpoint && affected[0] !== state.pendingEndpoint) {
    return formPair(state, ownedIds, intents, state.pendingEndpoint, affected[0], false, true);
  }

  return {
    ...state,
    pendingEndpoint: affected[0],
    selfLinkCandidateUnitId: living.length === 1 ? affected[0] : null,
    selfLinkCandidateRootId: living.length === 1 ? ctx.rootActionId : null,
  };
}

function emitSharedWound(
  state: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  affected: readonly string[],
  packets: WoundweavePacket[],
): void {
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_CORE_IDS.SHARED_WOUND)) return;
  if (!isWeaponRoot(ctx)) return;
  const lineage = [ctx.rootActionId, WOUNDWEAVE_CORE_IDS.SHARED_WOUND];
  const secondaryAcc = new Map<string, number>();
  const endpoints = state.selfLink ? [state.endpointA] : [state.endpointA, state.endpointB];
  for (const sourceId of endpoints) {
    if (!sourceId || !affected.includes(sourceId)) continue;
    const native = ctx.nativeByTarget
      .filter((row) => row.targetId === sourceId)
      .reduce((sum, row) => sum + row.nativeDirectDamage, 0);
    const base = roundCounterfateAmount(native * SHARED_WOUND_MIRROR);
    if (base <= 0) continue;
    if (state.selfLink) {
      pushPacket(packets, secondaryAcc, sourceId, translateAmount(base, true), 'MIRROR', lineage, false);
    } else {
      const partner = partnerOf(state, sourceId);
      if (!partner || !legalHostile(intents, partner)) continue;
      pushPacket(packets, secondaryAcc, partner, base, 'MIRROR', lineage, false);
    }
    for (const id of state.secondaryEndpointIds) {
      if (legalHostile(intents, id)) {
        pushPacket(packets, secondaryAcc, id, base, 'MIRROR', lineage, true);
      }
    }
  }
  flushSecondaries(packets, secondaryAcc, 'MIRROR', lineage);
}

function emitCrossedHex(
  state: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  packets: WoundweavePacket[],
): WoundweaveRuntimeState {
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_CORE_IDS.CROSSED_HEX)) return state;
  if (state.crossedHexUsedThisPlayerTurn) return state;
  if (ctx.actionSurface !== 'TECHNIQUE' && ctx.actionSurface !== 'FLEX') return state;
  const ap = ctx.actualCostsPaid.ap ?? 0;
  const power = 4 + (2 * ap);
  const lineage = [ctx.rootActionId, WOUNDWEAVE_CORE_IDS.CROSSED_HEX];
  const secondaryAcc = new Map<string, number>();
  const amount = translateAmount(power, state.selfLink);
  const targets = state.selfLink ? [state.endpointA] : [state.endpointA, state.endpointB];
  for (const id of targets) {
    if (id && legalHostile(intents, id)) {
      pushPacket(packets, secondaryAcc, id, amount, 'PULSE', lineage, false);
    }
  }
  for (const id of state.secondaryEndpointIds) {
    if (legalHostile(intents, id)) {
      pushPacket(packets, secondaryAcc, id, power, 'PULSE', lineage, true);
    }
  }
  flushSecondaries(packets, secondaryAcc, 'PULSE', lineage);
  return { ...state, crossedHexUsedThisPlayerTurn: true, lastLog: 'Crossed Hex' };
}

export function emitReflexiveAgony(
  state: WoundweaveRuntimeState,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  grade: InstinctGrade,
  rootActionId: string,
): { state: WoundweaveRuntimeState; packets: WoundweavePacket[] } {
  const packets: WoundweavePacket[] = [];
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY)) return { state, packets };
  if (state.reflexiveUsedThisCombatCycle) return { state, packets };
  if (grade === 'FAILED') return { state, packets };
  if (!hasPrimaryPair(state)) return { state, packets };
  const power = grade === 'PERFECT' ? 12 : grade === 'CLEAN' ? 8 : 5;
  const lineage = [rootActionId, WOUNDWEAVE_CORE_IDS.REFLEXIVE_AGONY];
  const secondaryAcc = new Map<string, number>();
  const amount = translateAmount(power, state.selfLink);
  let delivered = false;
  const targets = state.selfLink ? [state.endpointA] : [state.endpointA, state.endpointB];
  for (const id of targets) {
    if (id && legalHostile(intents, id)) {
      pushPacket(packets, secondaryAcc, id, amount, 'PULSE', lineage, false);
      delivered = true;
    }
  }
  for (const id of state.secondaryEndpointIds) {
    if (legalHostile(intents, id)) {
      pushPacket(packets, secondaryAcc, id, power, 'PULSE', lineage, true);
      delivered = true;
    }
  }
  flushSecondaries(packets, secondaryAcc, 'PULSE', lineage);
  if (!delivered) return { state, packets };
  return {
    packets,
    state: {
      ...state,
      reflexiveUsedThisCombatCycle: true,
      lastLog: 'Reflexive Agony',
      lastPackets: [...state.lastPackets, ...packets],
    },
  };
}

export function armTightenedThread(
  state: WoundweaveRuntimeState,
  ownedIds: readonly string[],
  rootActionId: string,
  signal: 'ORDINARY' | 'MAJOR',
): WoundweaveRuntimeState {
  if (!ownsWoundweaveId(ownedIds, WOUNDWEAVE_CORE_IDS.TIGHTENED_THREAD)) return state;
  if (!hasPrimaryPair(state)) return state;
  if (state.currentGuardUsedThisPlayerTurn) return state;
  const power = signal === 'MAJOR' ? 12 : 8;
  const charge: TightenedThreadCharge = {
    power,
    signal,
    sourceRootId: rootActionId,
    linkGeneration: state.linkGeneration,
    armedAfterRootId: rootActionId,
  };
  return {
    ...state,
    currentGuardUsedThisPlayerTurn: true,
    tightenedCharge: charge,
    lastLog: 'Tightened Thread charged',
  };
}

function resolveCommonGrave(
  state: WoundweaveRuntimeState,
  ctx: CanonicalRootActionContext,
  ownedIds: readonly string[],
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
  affected: readonly string[],
): { state: WoundweaveRuntimeState; packets: WoundweavePacket[] } {
  const packets: WoundweavePacket[] = [];
  const livingAffected = affected.filter((id) => legalHostile(intents, id));
  const lineage = [ctx.rootActionId, WOUNDWEAVE_VERDICT_ID];
  if (livingAffected.length >= 2) {
    const total = ctx.nativeByTarget.reduce((sum, row) => sum + row.nativeDirectDamage, 0);
    const budget = roundCounterfateAmount(total * COMMON_GRAVE_GROUP_SHARE);
    const split = distributeOccultBudget(budget, livingAffected.map((id) => ({ targetId: id, weight: 1 })));
    for (const row of split) {
      packets.push({
        targetId: row.assignedTargetId ?? row.originalTargetId,
        occultDamage: row.occultNativeDamage,
        kind: 'GRAVE',
        lineage,
        fizzled: row.fizzled,
      });
    }
  } else if (livingAffected.length === 1) {
    const native = ctx.nativeByTarget.find((row) => row.targetId === livingAffected[0]);
    const amount = roundCounterfateAmount((native?.nativeDirectDamage ?? 0) * COMMON_GRAVE_LONE_SHARE);
    if (amount > 0) {
      packets.push({
        targetId: livingAffected[0],
        occultDamage: amount,
        kind: 'GRAVE',
        lineage,
        fizzled: false,
      });
    }
  }
  const after = applyWoundweavePacketsToIntents(intents, packets);
  const survivors = livingAffected
    .map((id) => after.find((row) => row.unitId === id))
    .filter((row): row is HostileIntentSnapshot => Boolean(row && row.alive && !row.phased && !row.invulnerable));
  const ranked = [...survivors].sort((a, b) => compareTraceFallback(a, b, jammed));
  let next: WoundweaveRuntimeState = { ...state, lastLog: 'Common Grave', lastPackets: packets };
  if (ranked.length >= 2) {
    next = formPair(next, ownedIds, after, ranked[0].unitId, ranked[1].unitId, false, true);
    next = { ...next, lastLog: 'Common Grave', lastPackets: packets };
  } else if (ranked.length === 1) {
    next = {
      ...clearLink(next, 'Common Grave pending'),
      pendingEndpoint: ranked[0].unitId,
      lastPackets: packets,
      lastLog: 'Common Grave',
    };
  } else {
    next = { ...clearLink(next, 'Common Grave cleared'), lastPackets: packets };
  }
  return { state: next, packets };
}

export function woundweavePresentation(
  state: WoundweaveRuntimeState,
  intents: readonly HostileIntentSnapshot[],
): WoundweavePresentation {
  const label = (id: string | null) => {
    if (!id) return null;
    return intents.find((row) => row.unitId === id)?.designation ?? id;
  };
  const remaining = Math.max(0, state.expiresAtPlayerTurnStart - state.playerTurnIndex);
  return {
    endpointALabel: label(state.endpointA ?? state.pendingEndpoint),
    endpointBLabel: state.selfLink ? 'Self-Link' : label(state.endpointB),
    selfLink: state.selfLink,
    durationLabel: hasPrimaryPair(state) || state.emptySlotAwaitingRefill
      ? (state.persistent ? `STITCH T+${remaining}` : `BASE T+${remaining}`)
      : 'NONE',
    persistent: state.persistent,
    threadCharge: state.tightenedCharge?.power ?? null,
    emptySlot: state.emptySlotAwaitingRefill,
    secondaryCount: state.secondaryEndpointIds.length,
    lastLog: state.lastLog,
  };
}

export function setWoundweavePhaseSuccessor(
  state: WoundweaveRuntimeState,
  fromUnitId: string,
  toUnitId: string,
): WoundweaveRuntimeState {
  return {
    ...state,
    phaseSuccessorByUnitId: { ...state.phaseSuccessorByUnitId, [fromUnitId]: toUnitId },
  };
}

export function endpointBadgeForUnit(
  state: WoundweaveRuntimeState,
  unitId: string,
): 'PRIMARY' | 'SECONDARY' | 'SELF' | null {
  if (state.selfLink && state.endpointA === unitId) return 'SELF';
  if (state.endpointA === unitId || state.endpointB === unitId) return 'PRIMARY';
  if (state.secondaryEndpointIds.includes(unitId)) return 'SECONDARY';
  return null;
}
