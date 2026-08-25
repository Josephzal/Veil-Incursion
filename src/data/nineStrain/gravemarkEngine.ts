import type { CanonicalRootActionContext, InstinctGrade, TargetNativeResult } from '../../types/nineStrain';
import type { CombatDepthBand, HostileIntentSnapshot } from '../../types/counterfate';
import { columnPartnerSlot, type CombatGridSlotId } from '../../types/combatGrid';
import {
  GRAVEMARK_COLLISION_COURSE_DAMAGE,
  GRAVEMARK_CORE_IDS,
  GRAVEMARK_MANIFESTATION_ID,
  GRAVEMARK_NORMAL_DISPLACEMENT_CAP,
  GRAVEMARK_SUPPORT_IDS,
  GRAVEMARK_VERDICT_ID,
  type DisplacementFizzleReason,
  type DisplacementKind,
  type GravemarkCollisionRecord,
  type GravemarkDisplacementRecord,
  type GravemarkPendingMovementEffect,
  type GravemarkPolarityId,
  type GravemarkPolarityRecord,
  type GravemarkPresentation,
  type GravemarkRuntimeState,
} from '../../types/gravemark';
import { fallbackHostile } from './faultlineEngine';
import { isDirectlyAffectedNative } from './rootAction';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function createDefaultGravemarkState(): GravemarkRuntimeState {
  return {
    polarityByUnitId: {},
    unmooredExpiryByUnitId: {},
    displacementCountByUnitId: {},
    eventHorizonUsedByUnitId: {},
    eventHorizonSnapshotRootId: null,
    eventHorizonSnapshotUnitIds: [],
    foldedSpaceUsedThisPlayerTurn: false,
    massTransferUsedThisPlayerTurn: false,
    reversalFieldUsedThisCombatCycle: false,
    worldTurnedSidewaysRootId: null,
    worldTurnedSidewaysLockedTargetIds: [],
    phaseSuccessorByUnitId: {},
    playerTurnIndex: 0,
    combatCycleIndex: 0,
    activeRootId: null,
    pendingMovementEffects: [],
    nextPendingMovementOrder: 1,
    lastApRefund: 0,
    lastPolarity: null,
    lastDisplacement: null,
    lastSwap: null,
    lastCollision: null,
    lastCapBlock: null,
    lastBossTranslation: null,
    lastLog: null,
  };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function strRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
}

function boolRecord(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

function strMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function polarityRecord(value: unknown): Record<string, GravemarkPolarityId> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, GravemarkPolarityId> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === 'ARMAMENT' || raw === 'DISCIPLINE' || raw === 'INSTINCT' || raw === 'CURRENT') out[id] = raw;
  }
  return out;
}

function hydratePendingMovement(value: unknown): GravemarkPendingMovementEffect[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.triggerUnitId !== 'string') return [];
    if (typeof row.fromSlot !== 'string' || typeof row.toSlot !== 'string') return [];
    if (row.kind !== 'MOVE' && row.kind !== 'SWAP') return [];
    return [{
      id: row.id,
      triggerUnitId: row.triggerUnitId,
      passengerUnitId: typeof row.passengerUnitId === 'string' ? row.passengerUnitId : null,
      fromSlot: row.fromSlot as CombatGridSlotId,
      toSlot: row.toSlot as CombatGridSlotId,
      kind: row.kind,
      createdOrder: num(row.createdOrder),
    }];
  });
}

export function hydrateGravemarkState(raw: unknown): GravemarkRuntimeState {
  const base = createDefaultGravemarkState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  return {
    ...base,
    polarityByUnitId: polarityRecord(row.polarityByUnitId),
    unmooredExpiryByUnitId: strRecord(row.unmooredExpiryByUnitId),
    displacementCountByUnitId: strRecord(row.displacementCountByUnitId),
    eventHorizonUsedByUnitId: boolRecord(row.eventHorizonUsedByUnitId),
    eventHorizonSnapshotRootId: typeof row.eventHorizonSnapshotRootId === 'string' ? row.eventHorizonSnapshotRootId : null,
    eventHorizonSnapshotUnitIds: Array.isArray(row.eventHorizonSnapshotUnitIds)
      ? row.eventHorizonSnapshotUnitIds.filter((id): id is string => typeof id === 'string')
      : [],
    foldedSpaceUsedThisPlayerTurn: row.foldedSpaceUsedThisPlayerTurn === true,
    massTransferUsedThisPlayerTurn: row.massTransferUsedThisPlayerTurn === true,
    reversalFieldUsedThisCombatCycle: row.reversalFieldUsedThisCombatCycle === true,
    worldTurnedSidewaysRootId: typeof row.worldTurnedSidewaysRootId === 'string' ? row.worldTurnedSidewaysRootId : null,
    worldTurnedSidewaysLockedTargetIds: Array.isArray(row.worldTurnedSidewaysLockedTargetIds)
      ? row.worldTurnedSidewaysLockedTargetIds.filter((id): id is string => typeof id === 'string')
      : [],
    phaseSuccessorByUnitId: strMap(row.phaseSuccessorByUnitId),
    playerTurnIndex: num(row.playerTurnIndex),
    combatCycleIndex: num(row.combatCycleIndex),
    activeRootId: typeof row.activeRootId === 'string' ? row.activeRootId : null,
    pendingMovementEffects: hydratePendingMovement(row.pendingMovementEffects),
    nextPendingMovementOrder: Math.max(1, num(row.nextPendingMovementOrder)),
    lastApRefund: num(row.lastApRefund),
    lastLog: typeof row.lastLog === 'string' ? row.lastLog : null,
    lastPolarity: row.lastPolarity && typeof row.lastPolarity === 'object'
      ? row.lastPolarity as GravemarkRuntimeState['lastPolarity']
      : null,
    lastDisplacement: row.lastDisplacement && typeof row.lastDisplacement === 'object'
      ? row.lastDisplacement as GravemarkRuntimeState['lastDisplacement']
      : null,
    lastSwap: row.lastSwap && typeof row.lastSwap === 'object'
      ? row.lastSwap as GravemarkRuntimeState['lastSwap']
      : null,
    lastCollision: row.lastCollision && typeof row.lastCollision === 'object'
      ? row.lastCollision as GravemarkRuntimeState['lastCollision']
      : null,
    lastCapBlock: row.lastCapBlock && typeof row.lastCapBlock === 'object'
      ? row.lastCapBlock as GravemarkRuntimeState['lastCapBlock']
      : null,
    lastBossTranslation: row.lastBossTranslation && typeof row.lastBossTranslation === 'object'
      ? row.lastBossTranslation as GravemarkRuntimeState['lastBossTranslation']
      : null,
  };
}

export function clearEncounterGravemark(): GravemarkRuntimeState {
  return createDefaultGravemarkState();
}

// ---------------------------------------------------------------------------
// Turn / cycle lifecycle
// ---------------------------------------------------------------------------

/** Expires Unmoored before Wake activation, Fatebound selection, Deferred Exposure, or Trace resolution. */
export function beginGravemarkPlayerTurn(state: GravemarkRuntimeState): GravemarkRuntimeState {
  const nextIndex = state.playerTurnIndex + 1;
  const nextExpiry: Record<string, number> = {};
  for (const [unitId, expiresAt] of Object.entries(state.unmooredExpiryByUnitId)) {
    if (expiresAt > nextIndex) nextExpiry[unitId] = expiresAt;
  }
  return {
    ...state,
    playerTurnIndex: nextIndex,
    unmooredExpiryByUnitId: nextExpiry,
    foldedSpaceUsedThisPlayerTurn: false,
    massTransferUsedThisPlayerTurn: false,
  };
}

/** "Combat cycle" here matches Faultline's convention — resets at ENEMY_CYCLE_STARTED. */
export function beginGravemarkCombatCycle(state: GravemarkRuntimeState): GravemarkRuntimeState {
  return {
    ...state,
    combatCycleIndex: state.combatCycleIndex + 1,
    displacementCountByUnitId: {},
    eventHorizonUsedByUnitId: {},
    reversalFieldUsedThisCombatCycle: false,
    worldTurnedSidewaysRootId: null,
    worldTurnedSidewaysLockedTargetIds: [],
  };
}

export function mapGravemarkUnit(state: GravemarkRuntimeState, unitId: string): string {
  return state.phaseSuccessorByUnitId[unitId] ?? unitId;
}

/** Transfers Polarity, Unmoored expiry, and relevant cycle guards once to the authored successor. */
export function setGravemarkPhaseSuccessor(
  state: GravemarkRuntimeState,
  fromUnitId: string,
  toUnitId: string,
): GravemarkRuntimeState {
  const polarity = state.polarityByUnitId[fromUnitId];
  const nextPolarity = { ...state.polarityByUnitId };
  delete nextPolarity[fromUnitId];
  if (polarity) nextPolarity[toUnitId] = polarity;

  const expiry = state.unmooredExpiryByUnitId[fromUnitId];
  const nextExpiry = { ...state.unmooredExpiryByUnitId };
  delete nextExpiry[fromUnitId];
  if (typeof expiry === 'number') nextExpiry[toUnitId] = Math.max(nextExpiry[toUnitId] ?? 0, expiry);

  const count = state.displacementCountByUnitId[fromUnitId];
  const nextCount = { ...state.displacementCountByUnitId };
  delete nextCount[fromUnitId];
  if (typeof count === 'number') nextCount[toUnitId] = Math.max(nextCount[toUnitId] ?? 0, count);

  const eh = state.eventHorizonUsedByUnitId[fromUnitId];
  const nextEh = { ...state.eventHorizonUsedByUnitId };
  delete nextEh[fromUnitId];
  if (eh) nextEh[toUnitId] = true;

  return {
    ...state,
    polarityByUnitId: nextPolarity,
    unmooredExpiryByUnitId: nextExpiry,
    displacementCountByUnitId: nextCount,
    eventHorizonUsedByUnitId: nextEh,
    phaseSuccessorByUnitId: { ...state.phaseSuccessorByUnitId, [fromUnitId]: toUnitId },
  };
}

/** Prunes unmapped retired IDs. Dead/removed/phased-out targets cannot receive new Polarity or movement. */
export function pruneGravemarkTargets(
  state: GravemarkRuntimeState,
  intents: readonly HostileIntentSnapshot[],
): GravemarkRuntimeState {
  const live = new Set(intents.filter((row) => row.alive && !row.phased).map((row) => mapGravemarkUnit(state, row.unitId)));
  const polarity: Record<string, GravemarkPolarityId> = {};
  for (const [id, value] of Object.entries(state.polarityByUnitId)) {
    const mapped = mapGravemarkUnit(state, id);
    if (live.has(mapped)) polarity[mapped] = value;
  }
  const expiry: Record<string, number> = {};
  for (const [id, value] of Object.entries(state.unmooredExpiryByUnitId)) {
    const mapped = mapGravemarkUnit(state, id);
    if (live.has(mapped)) expiry[mapped] = Math.max(expiry[mapped] ?? 0, value);
  }
  return { ...state, polarityByUnitId: polarity, unmooredExpiryByUnitId: expiry };
}

function beginRoot(state: GravemarkRuntimeState, rootActionId: string): GravemarkRuntimeState {
  if (state.activeRootId === rootActionId) return state;
  return { ...state, activeRootId: rootActionId, lastLog: null };
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Legal Gravemark target: alive and not phased-out. Invulnerable / protected-phase remain legal (immovable handling applies separately). */
export function legalGravemarkHostile(
  intents: readonly HostileIntentSnapshot[],
  unitId: string | null | undefined,
): HostileIntentSnapshot | null {
  if (!unitId) return null;
  const row = intents.find((intent) => intent.unitId === unitId);
  if (!row || !row.alive || row.phased) return null;
  return row;
}

export function isUnmoored(state: GravemarkRuntimeState, unitId: string): boolean {
  return (state.unmooredExpiryByUnitId[mapGravemarkUnit(state, unitId)] ?? 0) > state.playerTurnIndex;
}

/**
 * Deterministic affected order for Gravemark: locked primary -> remaining locked pattern ->
 * position rank -> unit id. Mirrors Woundweave's orderDirectlyAffected but keeps invulnerable /
 * protected-phase hostiles legal, since Polarity must still be able to reach them.
 */
export function gravemarkOrderAffected(
  ctx: CanonicalRootActionContext,
  intents: readonly HostileIntentSnapshot[],
): string[] {
  const fromField = ctx.directlyAffectedTargetIds;
  const unique = [...new Set((fromField && fromField.length > 0
    ? fromField
    : ctx.nativeByTarget.filter(isDirectlyAffectedNative).map((row) => row.targetId)
  ))].filter((id) => legalGravemarkHostile(intents, id));
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

export { fallbackHostile as gravemarkFallbackHostile };

// ---------------------------------------------------------------------------
// Polarity
// ---------------------------------------------------------------------------

export interface PolarityOutcome {
  state: GravemarkRuntimeState;
  previous: GravemarkPolarityId | null;
  /** True only when a Polarity already existed and differed from the new one. */
  changed: boolean;
}

export function setGravemarkPolarity(
  state: GravemarkRuntimeState,
  targetId: string,
  polarity: GravemarkPolarityId,
  rootActionId: string | null,
  sourceDefinitionId: string,
): PolarityOutcome {
  const mapped = mapGravemarkUnit(state, targetId);
  const previous = state.polarityByUnitId[mapped] ?? null;
  const changed = previous !== null && previous !== polarity;
  const record: GravemarkPolarityRecord = {
    rootActionId,
    targetId: mapped,
    previous,
    next: polarity,
    changed,
    sourceDefinitionId,
  };
  return {
    state: {
      ...state,
      polarityByUnitId: { ...state.polarityByUnitId, [mapped]: polarity },
      lastPolarity: record,
      lastLog: `POLARITY // ${polarity}`,
    },
    previous,
    changed,
  };
}

// ---------------------------------------------------------------------------
// Displacement
// ---------------------------------------------------------------------------

export interface DisplacementArgs {
  state: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  triggerUnitId: string;
  /** Only Event Horizon may set this true — ignores Polarity gating upstream and bypasses the cap. */
  bonus: boolean;
  rootActionId: string | null;
  sourceEventId: string;
  sourceDefinitionId: string;
  procDepth: number;
  collisionCourseOwned: boolean;
  combatDepth: CombatDepthBand;
}

export interface DisplacementOutcome {
  state: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  record: GravemarkDisplacementRecord;
  collisions: GravemarkCollisionRecord[];
  /** False when fizzled before consuming anything (dead target, missing slot, or cap already spent). */
  attempted: boolean;
}

function baseRecord(args: DisplacementArgs): GravemarkDisplacementRecord {
  return {
    rootActionId: args.rootActionId,
    sourceEventId: args.sourceEventId,
    triggerUnitId: args.triggerUnitId,
    passengerUnitId: null,
    fromSlot: null,
    toSlot: null,
    kind: 'MOVE',
    bonus: args.bonus,
    fizzleReason: null,
    sourceDefinitionId: args.sourceDefinitionId,
    procDepth: args.procDepth,
  };
}

function fizzle(
  args: DisplacementArgs,
  reason: DisplacementFizzleReason,
  extraLog: string,
): DisplacementOutcome {
  const record: GravemarkDisplacementRecord = { ...baseRecord(args), fizzleReason: reason };
  const stateWithBlock = reason === 'CAP_REACHED'
    ? {
      ...args.state,
      lastCapBlock: { targetId: args.triggerUnitId, reason, sourceDefinitionId: args.sourceDefinitionId },
    }
    : args.state;
  return {
    state: { ...stateWithBlock, lastDisplacement: record, lastLog: extraLog },
    intents: args.intents.slice(),
    record,
    collisions: [],
    attempted: false,
  };
}

/**
 * Attempts one Displacement for the trigger owner using the explicit corresponding-slot map
 * (columnPartnerSlot). Fails closed (logged, cap untouched) when no legal slot exists.
 */
export function attemptDisplacement(args: DisplacementArgs): DisplacementOutcome {
  const target = legalGravemarkHostile(args.intents, mapGravemarkUnit(args.state, args.triggerUnitId));
  if (!target) return fizzle(args, 'DEAD_OR_REMOVED', 'DISPLACEMENT // NO TARGET');

  const spent = args.state.displacementCountByUnitId[target.unitId] ?? 0;
  if (!args.bonus && spent >= GRAVEMARK_NORMAL_DISPLACEMENT_CAP) {
    return fizzle(args, 'CAP_REACHED', 'DISPLACEMENT // CAP');
  }

  const consumeCap = (state: GravemarkRuntimeState): GravemarkRuntimeState => (
    args.bonus
      ? state
      : {
        ...state,
        displacementCountByUnitId: { ...state.displacementCountByUnitId, [target.unitId]: spent + 1 },
      }
  );
  const markUnmoored = (state: GravemarkRuntimeState, unitId: string): GravemarkRuntimeState => ({
    ...state,
    unmooredExpiryByUnitId: { ...state.unmooredExpiryByUnitId, [unitId]: state.playerTurnIndex + 1 },
  });

  if (target.immovable) {
    let state = consumeCap(args.state);
    state = markUnmoored(state, target.unitId);
    const translated = target.authoredCounter === true;
    const record: GravemarkDisplacementRecord = {
      ...baseRecord(args),
      kind: 'IMMOVABLE',
      fromSlot: target.gridSlot ?? null,
      toSlot: target.gridSlot ?? null,
    };
    state = {
      ...state,
      lastDisplacement: record,
      lastBossTranslation: {
        targetId: target.unitId,
        translated,
        reason: translated ? null : 'NO_AUTHORED_TRANSLATION',
      },
      lastLog: translated ? 'DISPLACEMENT // BOSS PRESSURE' : 'DISPLACEMENT // IMMOVABLE FIZZLE',
    };
    return { state, intents: args.intents.slice(), record, collisions: [], attempted: true };
  }

  const fromSlot = target.gridSlot ?? null;
  if (!fromSlot) return fizzle(args, 'NO_LEGAL_SLOT', 'DISPLACEMENT // NO SLOT');
  const toSlot = columnPartnerSlot(fromSlot) ?? null;
  if (!toSlot) return fizzle(args, 'NO_LEGAL_SLOT', 'DISPLACEMENT // NO SLOT');

  const occupant = args.intents.find((row) => (
    row.unitId !== target.unitId && row.alive && !row.phased && row.gridSlot === toSlot
  ));
  const kind: DisplacementKind = occupant ? 'SWAP' : 'MOVE';
  let intents = args.intents.map((row) => {
    if (row.unitId === target.unitId) return { ...row, gridSlot: toSlot };
    if (occupant && row.unitId === occupant.unitId) return { ...row, gridSlot: fromSlot };
    return row;
  });

  let state = consumeCap(args.state);
  state = markUnmoored(state, target.unitId);

  // NOTE: intentionally does not mutate `intents` hp here — every caller applies each returned
  // collision record exactly once via applyCollisionToIntents/pushCollisions (which also owns
  // kill detection for nativeByTarget/killedIds). Mutating hp here too would double the damage.
  const collisions: GravemarkCollisionRecord[] = [];
  if (kind === 'SWAP' && occupant && args.collisionCourseOwned) {
    state = markUnmoored(state, occupant.unitId);
    const damage = GRAVEMARK_COLLISION_COURSE_DAMAGE[args.combatDepth];
    for (const id of [target.unitId, occupant.unitId]) {
      const row = intents.find((r) => r.unitId === id);
      if (!row || !collisionLegalForTarget(row)) continue;
      collisions.push({
        rootActionId: args.rootActionId,
        targetId: id,
        amount: damage,
        kinetic: 0,
        occult: damage,
        sourceDefinitionId: GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE,
        kind: 'COLLISION_COURSE',
        killed: row.hp - damage <= 0,
      });
    }
  }

  const pendingId = `gm:${state.nextPendingMovementOrder}`;
  state = {
    ...state,
    pendingMovementEffects: [
      ...state.pendingMovementEffects,
      {
        id: pendingId,
        triggerUnitId: target.unitId,
        passengerUnitId: occupant?.unitId ?? null,
        fromSlot,
        toSlot,
        kind,
        createdOrder: state.nextPendingMovementOrder,
      },
    ],
    nextPendingMovementOrder: state.nextPendingMovementOrder + 1,
  };

  const record: GravemarkDisplacementRecord = {
    ...baseRecord(args),
    passengerUnitId: occupant?.unitId ?? null,
    fromSlot,
    toSlot,
    kind,
  };
  state = {
    ...state,
    lastDisplacement: record,
    lastSwap: kind === 'SWAP' ? record : state.lastSwap,
    lastCollision: collisions.length > 0 ? collisions[collisions.length - 1] : state.lastCollision,
    lastLog: kind === 'SWAP' ? 'DISPLACEMENT // SWAP' : 'DISPLACEMENT // MOVE',
  };

  return { state, intents, record, collisions, attempted: true };
}

// ---------------------------------------------------------------------------
// Collision packet math (Impact Vector / World Turned Sideways)
// ---------------------------------------------------------------------------

export function splitCollisionChannels(
  packet: number,
  nativeRow: TargetNativeResult | undefined,
  damageChannels: readonly string[],
): { kinetic: number; occult: number } {
  const kineticNative = nativeRow?.kineticNativeDamage;
  const occultNative = nativeRow?.occultNativeDamage;
  if (typeof kineticNative === 'number' && typeof occultNative === 'number' && kineticNative + occultNative > 0) {
    const ratio = kineticNative / (kineticNative + occultNative);
    const kinetic = Math.floor(packet * ratio);
    return { kinetic, occult: packet - kinetic };
  }
  const upper = damageChannels.map((row) => row.toUpperCase());
  if (upper.includes('OCCULT') && !upper.includes('KINETIC')) return { kinetic: 0, occult: packet };
  return { kinetic: packet, occult: 0 };
}

/** Never skip an invulnerable or protected phase — mirrors Faultline/Soulwake's own gate. */
function collisionLegalForTarget(row: HostileIntentSnapshot): boolean {
  if (row.invulnerable) return false;
  if (row.protectedPhase) return row.authoredCounter === true;
  return true;
}

function applyCollisionToIntents(
  intents: HostileIntentSnapshot[],
  targetId: string,
  amount: number,
): { intents: HostileIntentSnapshot[]; killed: boolean; blocked: boolean } {
  const row = intents.find((r) => r.unitId === targetId);
  if (!row || !collisionLegalForTarget(row)) return { intents, killed: false, blocked: Boolean(row) };
  let killed = false;
  const next = intents.map((r) => {
    if (r.unitId !== targetId) return r;
    const hp = Math.max(0, r.hp - amount);
    killed = hp <= 0 && r.alive;
    return { ...r, hp, alive: hp > 0 && r.alive };
  });
  return { intents: next, killed, blocked: false };
}

function mergeKillIntoNative(rows: readonly TargetNativeResult[], targetId: string): TargetNativeResult[] {
  let found = false;
  const next = rows.map((row) => {
    if (row.targetId !== targetId) return row;
    found = true;
    return { ...row, killed: true };
  });
  if (found) return next;
  return rows.slice();
}

// ---------------------------------------------------------------------------
// Root processing (native committed roots — the central law + Core imbuements)
// ---------------------------------------------------------------------------

export interface GravemarkProcessArgs {
  state: GravemarkRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  jammed: boolean;
  depth: CombatDepthBand;
  sourceEventId: string;
}

export interface GravemarkProcessResult {
  state: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  nativeByTarget: TargetNativeResult[];
  apRefundGranted: number;
  killedIds: string[];
  /** For POLARITY_CHANGED emission — one entry per hostile whose Polarity actually changed. */
  polarityEvents: GravemarkPolarityRecord[];
  /** For POSITION_CHANGED/UNMOORED_CHANGED/DISPLACEMENT_CHANGED emission — one per attempted Displacement. */
  displacementEvents: GravemarkDisplacementRecord[];
}

function owns(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

export function hasLiveGravemarkIds(ownedIds: readonly string[]): boolean {
  return ownedIds.some((id) => id.startsWith('GM_'));
}

export function processGravemarkRoot(args: GravemarkProcessArgs): GravemarkProcessResult {
  const { ctx, ownedIds, depth } = args;
  let state = pruneGravemarkTargets(beginRoot(args.state, ctx.rootActionId), args.intents);
  let intents = args.intents.slice();
  let nativeByTarget = ctx.nativeByTarget.slice();
  let apRefundGranted = 0;
  const killedIds: string[] = [];
  const polarityEvents: GravemarkPolarityRecord[] = [];
  const displacementEvents: GravemarkDisplacementRecord[] = [];

  if (!hasLiveGravemarkIds(ownedIds) || !ctx.committed || ctx.classification !== 'NATIVE_DIRECT') {
    return { state, intents, nativeByTarget, apRefundGranted, killedIds, polarityEvents, displacementEvents };
  }

  const collisionCourseOwned = owns(ownedIds, GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  const isUltimate = ctx.sourceKind === 'ULTIMATE' || ctx.actionSurface === 'ULTIMATE';
  const weaponSurface = !isUltimate
    && (ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC'
      || (ctx.actionSurface == null && ctx.sourceKind === 'PLAYER_ACTION'));
  const disciplineSurface = !isUltimate && (ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX');

  // Event Horizon eligibility must snapshot Unmoored status *before* this root moves anyone.
  const unmooredAtCommit = new Set(
    ctx.lockedTargetIds.filter((id) => isUnmoored(state, mapGravemarkUnit(state, id))),
  );

  const displacedTriggerTargets: string[] = [];
  const pushCollisions = (rows: readonly GravemarkCollisionRecord[]) => {
    for (const row of rows) {
      const applied = applyCollisionToIntents(intents, row.targetId, row.amount);
      intents = applied.intents;
      if (applied.killed) {
        nativeByTarget = mergeKillIntoNative(nativeByTarget, row.targetId);
        if (!killedIds.includes(row.targetId)) killedIds.push(row.targetId);
      }
    }
  };

  // --- ARMAMENT central law + Impact Vector ---
  if (owns(ownedIds, GRAVEMARK_CORE_IDS.IMPACT_VECTOR) && weaponSurface && ctx.sourceKind === 'PLAYER_ACTION') {
    const order = gravemarkOrderAffected(ctx, intents);
    for (const targetId of order) {
      const target = legalGravemarkHostile(intents, targetId);
      if (!target) continue;
      const polarity = setGravemarkPolarity(state, target.unitId, 'ARMAMENT', ctx.rootActionId, GRAVEMARK_CORE_IDS.IMPACT_VECTOR);
      state = polarity.state;
      polarityEvents.push(polarity.state.lastPolarity as GravemarkPolarityRecord);
      if (polarity.changed) {
        const outcome = attemptDisplacement({
          state, intents, triggerUnitId: target.unitId, bonus: false,
          rootActionId: ctx.rootActionId, sourceEventId: args.sourceEventId,
          sourceDefinitionId: GRAVEMARK_CORE_IDS.IMPACT_VECTOR, procDepth: ctx.procDepth,
          collisionCourseOwned, combatDepth: depth,
        });
        state = outcome.state;
        intents = outcome.intents;
        pushCollisions(outcome.collisions);
        if (outcome.attempted) {
          displacedTriggerTargets.push(target.unitId);
          displacementEvents.push(outcome.record);
        }
      }
    }
  }

  // --- DISCIPLINE central law + Folded Space ---
  if (owns(ownedIds, GRAVEMARK_CORE_IDS.FOLDED_SPACE) && disciplineSurface && ctx.sourceKind === 'PLAYER_ACTION') {
    if (!state.foldedSpaceUsedThisPlayerTurn) {
      const order = gravemarkOrderAffected(ctx, intents);
      let primary = order[0] ? legalGravemarkHostile(intents, order[0]) : null;
      let usedFallback = false;
      if (!primary) {
        primary = fallbackHostile(intents, args.jammed);
        usedFallback = true;
      }
      if (primary) {
        const polarity = setGravemarkPolarity(state, primary.unitId, 'DISCIPLINE', ctx.rootActionId, GRAVEMARK_CORE_IDS.FOLDED_SPACE);
        state = polarity.state;
        polarityEvents.push(polarity.state.lastPolarity as GravemarkPolarityRecord);
        // Non-hostile fallback: applies Discipline Polarity and attempts Displacement only on a Polarity change.
        const shouldAttempt = usedFallback ? polarity.changed : polarity.changed;
        let displaced = false;
        if (shouldAttempt) {
          const outcome = attemptDisplacement({
            state, intents, triggerUnitId: primary.unitId, bonus: false,
            rootActionId: ctx.rootActionId, sourceEventId: args.sourceEventId,
            sourceDefinitionId: GRAVEMARK_CORE_IDS.FOLDED_SPACE, procDepth: ctx.procDepth,
            collisionCourseOwned, combatDepth: depth,
          });
          state = outcome.state;
          intents = outcome.intents;
          pushCollisions(outcome.collisions);
          displaced = outcome.attempted;
          if (displaced) {
            displacedTriggerTargets.push(primary.unitId);
            displacementEvents.push(outcome.record);
          }
        }
        const apPaid = ctx.actualCostsPaid.ap ?? 0;
        if (displaced && apPaid > 0) {
          state = { ...state, foldedSpaceUsedThisPlayerTurn: true, lastApRefund: state.lastApRefund + Math.min(1, apPaid) };
          apRefundGranted = Math.min(1, apPaid);
        } else if (usedFallback) {
          // Mark the guard used even without displacement so a single non-hostile Technique/Flex
          // per turn cannot retry for a refund after a same-Polarity retain.
          state = { ...state, foldedSpaceUsedThisPlayerTurn: true };
        } else if (!displaced) {
          // Weapon/basic-style hostile path with no displacement this attempt still guards the turn
          // only once a Displacement was actually attempted and failed to qualify for refund (cap-blocked/fizzled).
          state = { ...state, foldedSpaceUsedThisPlayerTurn: shouldAttempt ? true : state.foldedSpaceUsedThisPlayerTurn };
        }
      }
    }
  }

  // --- Event Horizon (Manifestation, post-native movement pass) ---
  if (owns(ownedIds, GRAVEMARK_MANIFESTATION_ID) && ctx.sourceKind === 'PLAYER_ACTION' && !isUltimate) {
    for (const targetId of ctx.lockedTargetIds) {
      const mapped = mapGravemarkUnit(state, targetId);
      if (!unmooredAtCommit.has(mapped)) continue;
      if (state.eventHorizonUsedByUnitId[mapped]) continue;
      const target = legalGravemarkHostile(intents, mapped);
      if (!target) continue;
      state = { ...state, eventHorizonUsedByUnitId: { ...state.eventHorizonUsedByUnitId, [mapped]: true } };
      const outcome = attemptDisplacement({
        state, intents, triggerUnitId: mapped, bonus: true,
        rootActionId: ctx.rootActionId, sourceEventId: args.sourceEventId,
        sourceDefinitionId: GRAVEMARK_MANIFESTATION_ID, procDepth: ctx.procDepth,
        collisionCourseOwned, combatDepth: depth,
      });
      state = outcome.state;
      intents = outcome.intents;
      pushCollisions(outcome.collisions);
      if (outcome.attempted) {
        displacementEvents.push(outcome.record);
        if (weaponSurface) displacedTriggerTargets.push(mapped);
      }
    }
  }

  // --- Impact Vector packets: one per displaced trigger target for this weapon/basic root ---
  if (owns(ownedIds, GRAVEMARK_CORE_IDS.IMPACT_VECTOR) && weaponSurface) {
    const seen = new Set<string>();
    for (const targetId of displacedTriggerTargets) {
      if (seen.has(targetId)) continue;
      seen.add(targetId);
      const row = ctx.nativeByTarget.find((r) => r.targetId === targetId);
      const native = row?.nativeDirectDamage ?? 0;
      if (native <= 0) continue;
      const packet = Math.floor(native * 0.25);
      if (packet <= 0) continue;
      const { kinetic, occult } = splitCollisionChannels(packet, row, ctx.damageChannels);
      const applied = applyCollisionToIntents(intents, targetId, packet);
      intents = applied.intents;
      if (applied.killed) {
        nativeByTarget = mergeKillIntoNative(nativeByTarget, targetId);
        if (!killedIds.includes(targetId)) killedIds.push(targetId);
      }
      state = applied.blocked
        ? { ...state, lastLog: 'IMPACT VECTOR // PROTECTED FIZZLE' }
        : {
          ...state,
          lastCollision: {
            rootActionId: ctx.rootActionId, targetId, amount: packet, kinetic, occult,
            sourceDefinitionId: GRAVEMARK_CORE_IDS.IMPACT_VECTOR, kind: 'IMPACT_VECTOR', killed: applied.killed,
          },
          lastLog: 'IMPACT VECTOR // COLLISION',
        };
    }
  }

  return { state, intents, nativeByTarget, apRefundGranted, killedIds, polarityEvents, displacementEvents };
}

export interface GravemarkPreviewDelta {
  targetId: string;
  polarityBefore: GravemarkPolarityId | null;
  polarityAfter: GravemarkPolarityId;
  displaced: boolean;
  fromSlot: CombatGridSlotId | null;
  toSlot: CombatGridSlotId | null;
  swapUnitId: string | null;
}

/**
 * Preview-only projection of processGravemarkRoot: runs the exact same pure processor and
 * summarizes target IDs / from-to slots / swaps / AP refund without persisting the returned
 * state or intents anywhere. Callers must discard result.state and result.intents.
 */
export function previewGravemarkRoot(args: GravemarkProcessArgs): {
  deltas: GravemarkPreviewDelta[];
  apRefund: number;
  killedIds: string[];
} {
  const result = processGravemarkRoot(args);
  const deltas: GravemarkPreviewDelta[] = result.polarityEvents.map((polarity) => {
    const displacement = result.displacementEvents.find((row) => row.triggerUnitId === polarity.targetId);
    return {
      targetId: polarity.targetId,
      polarityBefore: polarity.previous,
      polarityAfter: polarity.next,
      displaced: Boolean(displacement && displacement.fizzleReason == null),
      fromSlot: displacement?.fromSlot ?? null,
      toSlot: displacement?.toSlot ?? null,
      swapUnitId: displacement?.passengerUnitId ?? null,
    };
  });
  return { deltas, apRefund: result.apRefundGranted, killedIds: result.killedIds };
}

// ---------------------------------------------------------------------------
// Instinct (Reversal Field)
// ---------------------------------------------------------------------------

export interface GravemarkInstinctArgs {
  state: GravemarkRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  jammed: boolean;
  depth: CombatDepthBand;
  grade: InstinctGrade;
  associatedHostileUnitId?: string | null;
  sourceEventId: string;
}

export function processGravemarkInstinct(args: GravemarkInstinctArgs): GravemarkProcessResult {
  let state = pruneGravemarkTargets(beginRoot(args.state, args.ctx.rootActionId), args.intents);
  let intents = args.intents.slice();
  const empty: GravemarkProcessResult = {
    state, intents, nativeByTarget: args.ctx.nativeByTarget.slice(), apRefundGranted: 0,
    killedIds: [], polarityEvents: [], displacementEvents: [],
  };
  if (!owns(args.ownedIds, GRAVEMARK_CORE_IDS.REVERSAL_FIELD) || args.grade === 'FAILED') return empty;
  if (state.reversalFieldUsedThisCombatCycle) return empty;

  const associated = args.associatedHostileUnitId
    ? legalGravemarkHostile(args.intents, mapGravemarkUnit(state, args.associatedHostileUnitId))
    : null;
  const target = associated ?? fallbackHostile(args.intents, args.jammed);
  if (!target) return empty;

  state = { ...state, reversalFieldUsedThisCombatCycle: true };
  const collisionCourseOwned = owns(args.ownedIds, GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  const polarity = setGravemarkPolarity(state, target.unitId, 'INSTINCT', args.ctx.rootActionId, GRAVEMARK_CORE_IDS.REVERSAL_FIELD);
  state = polarity.state;
  const polarityEvents: GravemarkPolarityRecord[] = [polarity.state.lastPolarity as GravemarkPolarityRecord];
  const displacementEvents: GravemarkDisplacementRecord[] = [];

  let intentsOut = intents;
  const collisions: GravemarkCollisionRecord[] = [];
  const killedIds: string[] = [];
  const attempt = (bonus: boolean) => {
    const outcome = attemptDisplacement({
      state, intents: intentsOut, triggerUnitId: target.unitId, bonus,
      rootActionId: args.ctx.rootActionId, sourceEventId: args.sourceEventId,
      sourceDefinitionId: GRAVEMARK_CORE_IDS.REVERSAL_FIELD, procDepth: args.ctx.procDepth,
      collisionCourseOwned, combatDepth: args.depth,
    });
    state = outcome.state;
    intentsOut = outcome.intents;
    collisions.push(...outcome.collisions);
    if (outcome.attempted) displacementEvents.push(outcome.record);
  };

  if (args.grade === 'CLEAN' && polarity.changed) attempt(false);
  if (args.grade === 'PERFECT') attempt(false);

  let nativeByTarget = args.ctx.nativeByTarget.slice();
  for (const row of collisions) {
    const applied = applyCollisionToIntents(intentsOut, row.targetId, row.amount);
    intentsOut = applied.intents;
    if (applied.killed) {
      nativeByTarget = mergeKillIntoNative(nativeByTarget, row.targetId);
      killedIds.push(row.targetId);
    }
  }

  return { state, intents: intentsOut, nativeByTarget, apRefundGranted: 0, killedIds, polarityEvents, displacementEvents };
}

// ---------------------------------------------------------------------------
// Current (Mass Transfer)
// ---------------------------------------------------------------------------

export interface GravemarkCurrentArgs {
  state: GravemarkRuntimeState;
  ctx: CanonicalRootActionContext | null;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  jammed: boolean;
  depth: CombatDepthBand;
  signal: 'ORDINARY' | 'MAJOR';
  associatedHostileUnitId?: string | null;
  sourceEventId: string;
}

export function processGravemarkCurrent(args: GravemarkCurrentArgs): GravemarkProcessResult {
  const empty: GravemarkProcessResult = {
    state: args.state,
    intents: args.intents.slice(),
    nativeByTarget: args.ctx?.nativeByTarget.slice() ?? [],
    apRefundGranted: 0,
    killedIds: [],
    polarityEvents: [],
    displacementEvents: [],
  };
  if (!owns(args.ownedIds, GRAVEMARK_CORE_IDS.MASS_TRANSFER) || !args.ctx) return empty;
  let state = pruneGravemarkTargets(beginRoot(args.state, args.ctx.rootActionId), args.intents);
  if (state.massTransferUsedThisPlayerTurn) return { ...empty, state };
  state = { ...state, massTransferUsedThisPlayerTurn: true };

  const associated = args.associatedHostileUnitId
    ? legalGravemarkHostile(args.intents, mapGravemarkUnit(state, args.associatedHostileUnitId))
    : (args.ctx.lockedTargetIds[0] ? legalGravemarkHostile(args.intents, mapGravemarkUnit(state, args.ctx.lockedTargetIds[0])) : null);
  const target = associated ?? fallbackHostile(args.intents, args.jammed);
  if (!target) return { ...empty, state };

  const polarity = setGravemarkPolarity(state, target.unitId, 'CURRENT', args.ctx.rootActionId, GRAVEMARK_CORE_IDS.MASS_TRANSFER);
  state = polarity.state;
  const polarityEvents: GravemarkPolarityRecord[] = [polarity.state.lastPolarity as GravemarkPolarityRecord];
  const displacementEvents: GravemarkDisplacementRecord[] = [];

  const collisionCourseOwned = owns(args.ownedIds, GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  const forceMajor = args.signal === 'MAJOR';
  let intents = args.intents.slice();
  const collisions: GravemarkCollisionRecord[] = [];
  if (forceMajor || polarity.changed) {
    const outcome = attemptDisplacement({
      state, intents, triggerUnitId: target.unitId, bonus: false,
      rootActionId: args.ctx.rootActionId, sourceEventId: args.sourceEventId,
      sourceDefinitionId: GRAVEMARK_CORE_IDS.MASS_TRANSFER, procDepth: args.ctx.procDepth,
      collisionCourseOwned, combatDepth: args.depth,
    });
    state = outcome.state;
    intents = outcome.intents;
    collisions.push(...outcome.collisions);
    if (outcome.attempted) displacementEvents.push(outcome.record);
  }

  let nativeByTarget = args.ctx.nativeByTarget.slice();
  const killedIds: string[] = [];
  for (const row of collisions) {
    const applied = applyCollisionToIntents(intents, row.targetId, row.amount);
    intents = applied.intents;
    if (applied.killed) {
      nativeByTarget = mergeKillIntoNative(nativeByTarget, row.targetId);
      killedIds.push(row.targetId);
    }
  }

  return { state, intents, nativeByTarget, apRefundGranted: 0, killedIds, polarityEvents, displacementEvents };
}

// ---------------------------------------------------------------------------
// Verdict — World Turned Sideways
// ---------------------------------------------------------------------------

export interface VerdictPreNativeArgs {
  state: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ownedIds: readonly string[];
  lockedTargetIds: readonly string[];
  rootActionId: string;
  sourceEventId: string;
  depth: CombatDepthBand;
}

export interface VerdictPreNativeResult {
  state: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  movedTargetIds: string[];
  displacementEvents: GravemarkDisplacementRecord[];
}

/** Forces one normal (capped) Displacement per legal locked target before native ultimate resolution. */
export function processWorldTurnedSidewaysPreNative(args: VerdictPreNativeArgs): VerdictPreNativeResult {
  let state = args.state;
  let intents = args.intents.slice();
  const movedTargetIds: string[] = [];
  const displacementEvents: GravemarkDisplacementRecord[] = [];
  if (!owns(args.ownedIds, GRAVEMARK_VERDICT_ID)) return { state, intents, movedTargetIds, displacementEvents };
  if (state.worldTurnedSidewaysRootId === args.rootActionId) return { state, intents, movedTargetIds, displacementEvents };
  const unique = [...new Set(args.lockedTargetIds)];
  state = {
    ...state,
    worldTurnedSidewaysRootId: args.rootActionId,
    worldTurnedSidewaysLockedTargetIds: unique,
  };
  const collisionCourseOwned = owns(args.ownedIds, GRAVEMARK_SUPPORT_IDS.COLLISION_COURSE);
  for (const targetId of unique) {
    const mapped = mapGravemarkUnit(state, targetId);
    const target = legalGravemarkHostile(intents, mapped);
    if (!target) continue;
    const outcome = attemptDisplacement({
      state, intents, triggerUnitId: mapped, bonus: false,
      rootActionId: args.rootActionId, sourceEventId: args.sourceEventId,
      sourceDefinitionId: GRAVEMARK_VERDICT_ID, procDepth: 0,
      collisionCourseOwned, combatDepth: args.depth,
    });
    state = outcome.state;
    intents = outcome.intents;
    if (outcome.attempted) {
      movedTargetIds.push(mapped);
      displacementEvents.push(outcome.record);
    }
    for (const row of outcome.collisions) {
      const applied = applyCollisionToIntents(intents, row.targetId, row.amount);
      intents = applied.intents;
    }
  }
  return { state, intents, movedTargetIds, displacementEvents };
}

export interface VerdictPostNativeArgs {
  state: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ownedIds: readonly string[];
  nativeByTarget: readonly TargetNativeResult[];
  damageChannels: readonly string[];
  rootActionId: string;
}

export interface VerdictPostNativeResult {
  state: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  nativeByTarget: TargetNativeResult[];
  killedIds: string[];
}

/**
 * One collision packet per target equal to 20% of the ultimate-owned native direct damage it
 * received. Reads the locked target set captured by processWorldTurnedSidewaysPreNative for this
 * exact rootActionId — a root with no matching pre-native pass (or already-consumed) is a no-op,
 * which also makes this consume-once per root.
 */
export function processWorldTurnedSidewaysPostNative(args: VerdictPostNativeArgs): VerdictPostNativeResult {
  let state = args.state;
  let intents = args.intents.slice();
  let nativeByTarget = args.nativeByTarget.slice();
  const killedIds: string[] = [];
  if (!owns(args.ownedIds, GRAVEMARK_VERDICT_ID)) return { state, intents, nativeByTarget, killedIds };
  if (state.worldTurnedSidewaysRootId !== args.rootActionId) return { state, intents, nativeByTarget, killedIds };
  const unique = state.worldTurnedSidewaysLockedTargetIds;
  state = { ...state, worldTurnedSidewaysLockedTargetIds: [] };
  for (const targetId of unique) {
    const mapped = mapGravemarkUnit(state, targetId);
    const row = args.nativeByTarget.find((r) => r.targetId === mapped);
    const native = row?.nativeDirectDamage ?? 0;
    if (native <= 0) continue;
    const packet = Math.floor(native * 0.2);
    if (packet <= 0) continue;
    const { kinetic, occult } = splitCollisionChannels(packet, row, args.damageChannels);
    const applied = applyCollisionToIntents(intents, mapped, packet);
    intents = applied.intents;
    if (applied.killed) {
      nativeByTarget = mergeKillIntoNative(nativeByTarget, mapped);
      killedIds.push(mapped);
    }
    state = applied.blocked
      ? { ...state, lastLog: 'WORLD TURNED SIDEWAYS // PROTECTED FIZZLE' }
      : {
        ...state,
        lastCollision: {
          rootActionId: args.rootActionId, targetId: mapped, amount: packet, kinetic, occult,
          sourceDefinitionId: GRAVEMARK_VERDICT_ID, kind: 'WORLD_TURNED_SIDEWAYS', killed: applied.killed,
        },
        lastLog: 'WORLD TURNED SIDEWAYS // COLLISION',
      };
  }
  return { state, intents, nativeByTarget, killedIds };
}

export interface WorldTurnedSidewaysDamageHit {
  targetId: string;
  /** Ultimate-owned native direct damage this target actually received, already summed for this root. */
  damage: number;
}

export interface WorldTurnedSidewaysDamageResult {
  state: GravemarkRuntimeState;
  intents: HostileIntentSnapshot[];
  packets: GravemarkCollisionRecord[];
  killedIds: string[];
}

/**
 * Standalone Verdict post-native packet application for ultimate execution paths that do not
 * route through commitRootAction's NATIVE_DIRECT pipeline (the Hub's nine canonical equipped
 * ultimates apply their own damage directly via hurtEnemy/patchUnit rather than recordNativeHit,
 * so no CanonicalRootActionContext is ever built for them). The caller supplies the actual
 * native direct damage each locked target received from this exact ultimate's own resolution
 * (e.g. via a live-squad HP diff); this is a one-shot, per-call application — the Hub is
 * responsible for invoking it exactly once per ultimate commit, so no stored root guard is
 * needed here the way processWorldTurnedSidewaysPostNative needs one for the commitRootAction path.
 */
export function applyWorldTurnedSidewaysUltimateDamage(args: {
  state: GravemarkRuntimeState;
  intents: readonly HostileIntentSnapshot[];
  ownedIds: readonly string[];
  hits: readonly WorldTurnedSidewaysDamageHit[];
  damageChannels: readonly string[];
  rootActionId: string;
}): WorldTurnedSidewaysDamageResult {
  let state = args.state;
  let intents = args.intents.slice();
  const packets: GravemarkCollisionRecord[] = [];
  const killedIds: string[] = [];
  if (!owns(args.ownedIds, GRAVEMARK_VERDICT_ID)) return { state, intents, packets, killedIds };
  for (const hit of args.hits) {
    if (hit.damage <= 0) continue;
    const packet = Math.floor(hit.damage * 0.2);
    if (packet <= 0) continue;
    const { kinetic, occult } = splitCollisionChannels(packet, undefined, args.damageChannels);
    const applied = applyCollisionToIntents(intents, hit.targetId, packet);
    intents = applied.intents;
    if (applied.killed) killedIds.push(hit.targetId);
    if (applied.blocked) {
      state = { ...state, lastLog: 'WORLD TURNED SIDEWAYS // PROTECTED FIZZLE' };
      continue;
    }
    const record: GravemarkCollisionRecord = {
      rootActionId: args.rootActionId,
      targetId: hit.targetId,
      amount: packet,
      kinetic,
      occult,
      sourceDefinitionId: GRAVEMARK_VERDICT_ID,
      kind: 'WORLD_TURNED_SIDEWAYS',
      killed: applied.killed,
    };
    packets.push(record);
    state = { ...state, lastCollision: record, lastLog: 'WORLD TURNED SIDEWAYS // COLLISION' };
  }
  return { state, intents, packets, killedIds };
}

// ---------------------------------------------------------------------------
// False Position — pure targeting predicate
// ---------------------------------------------------------------------------

/**
 * While Unmoored, a hostile counts as both frontline and backline for target eligibility only.
 * Its authoritative lane still governs damage modifiers, cover, committed patterns, position
 * order, movement destination, and intent — callers must keep using the real lane for those.
 */
export function falsePositionEligibleForLane(
  state: GravemarkRuntimeState,
  ownedIds: readonly string[],
  unitId: string,
  requestedLane: 'FRONTLINE' | 'BACKLINE',
  actualLane: 'FRONTLINE' | 'BACKLINE',
): boolean {
  if (requestedLane === actualLane) return true;
  if (!owns(ownedIds, GRAVEMARK_SUPPORT_IDS.FALSE_POSITION)) return false;
  return isUnmoored(state, mapGravemarkUnit(state, unitId));
}

// ---------------------------------------------------------------------------
// Presentation / pending movement consumption
// ---------------------------------------------------------------------------

export function gravemarkPresentation(state: GravemarkRuntimeState): GravemarkPresentation {
  const unmoored = Object.entries(state.unmooredExpiryByUnitId)
    .filter(([, expiresAt]) => expiresAt > state.playerTurnIndex)
    .map(([unitId]) => unitId);
  return {
    active: Object.keys(state.polarityByUnitId).length > 0 || unmoored.length > 0 || Boolean(state.lastLog),
    polarityByUnitId: { ...state.polarityByUnitId },
    unmooredUnitIds: unmoored,
    displacementSpentByUnitId: { ...state.displacementCountByUnitId },
    displacementCap: GRAVEMARK_NORMAL_DISPLACEMENT_CAP,
    eventHorizonUnitIds: Object.keys(state.eventHorizonUsedByUnitId).filter((id) => state.eventHorizonUsedByUnitId[id]),
    lastLog: state.lastLog,
  };
}

/** Consume-once: returns queued movement and clears the queue so the Hub cannot replay it. */
export function consumeGravemarkPendingMovement(
  state: GravemarkRuntimeState,
): { state: GravemarkRuntimeState; effects: GravemarkPendingMovementEffect[] } {
  if (state.pendingMovementEffects.length === 0) return { state, effects: [] };
  const effects = state.pendingMovementEffects.slice();
  return { state: { ...state, pendingMovementEffects: [] }, effects };
}

/** Consume-once: returns the pending Folded Space AP refund and clears it. */
export function consumeGravemarkApRefund(state: GravemarkRuntimeState): { state: GravemarkRuntimeState; refund: number } {
  if (state.lastApRefund <= 0) return { state, refund: 0 };
  return { state: { ...state, lastApRefund: 0 }, refund: state.lastApRefund };
}
