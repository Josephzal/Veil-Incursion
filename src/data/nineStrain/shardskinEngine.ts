import type { CanonicalRootActionContext, InstinctGrade } from '../../types/nineStrain';
import type { CombatDepthBand, HostileIntentSnapshot } from '../../types/counterfate';
import {
  CATHEDRAL_BREAK_BUDGET_MULTIPLIER,
  CATHEDRAL_BREAK_POST_GAIN,
  CRYSTAL_EDGE_PER_ROOT_CAP,
  CRYSTAL_EDGE_RATIO,
  ENDLESS_FACET_RATIO,
  PERFECT_FACET_SHARDS,
  PRESSURE_CRYSTAL_SHARDS,
  RITUAL_PANE_BASE,
  RITUAL_PANE_PER_AP,
  RITUAL_PANE_PER_ROOT_CAP,
  SCATTERGLASS_RATIO,
  SHARDSKIN_CORE_IDS,
  SHARDSKIN_DAMAGE_LEDGER_CAP,
  SHARDSKIN_MANIFESTATION_ID,
  SHARDSKIN_RESOURCE_CAP,
  SHARDSKIN_SUPPORT_IDS,
  SHARDSKIN_VERDICT_ID,
  TEMPERED_REMNANT_RATIO,
  TEMPERED_REMNANT_RETURN_CAP,
  type ShardskinCathedralPending,
  type ShardskinDamageEventRecord,
  type ShardskinRuntimeState,
  type ShardskinPresentation,
  type ShardskinVerdictPacketRecord,
} from '../../types/shardskin';
import { distributeOccultBudget } from './afterimageEngine';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function createDefaultShardskinState(): ShardskinRuntimeState {
  return {
    currentShards: 0,
    currentEdge: 0,
    shardsSpentPreventingDamage: 0,
    pendingTemperedRemnantReturn: 0,
    playerTurnIndex: 0,
    combatCycleIndex: 0,
    crystalEdgeUsedThisPlayerTurn: false,
    ritualPaneUsedThisPlayerTurn: false,
    perfectFacetUsedThisCombatCycle: false,
    pressureCrystalUsedThisPlayerTurn: false,
    endlessFacetUsedThisPlayerTurn: false,
    cathedralBreakSelected: false,
    pendingCathedralBreak: null,
    recentDamageEvents: [],
    lastGeneration: null,
    lastPrevention: null,
    lastConversion: null,
    lastEdgeConsumption: null,
    lastSpread: null,
    lastVerdict: null,
    lastLog: null,
  };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function hydrateDamageLedger(value: unknown): ShardskinDamageEventRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.eventId !== 'string') return [];
    return [{
      eventId: row.eventId,
      incoming: num(row.incoming),
      shardsSpent: num(row.shardsSpent),
      hpDamage: num(row.hpDamage),
    }];
  }).slice(-SHARDSKIN_DAMAGE_LEDGER_CAP);
}

export function hydrateShardskinState(raw: unknown): ShardskinRuntimeState {
  const base = createDefaultShardskinState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const pending = row.pendingCathedralBreak;
  let pendingCathedralBreak: ShardskinCathedralPending | null = null;
  if (pending && typeof pending === 'object') {
    const p = pending as Record<string, unknown>;
    if (typeof p.rootActionId === 'string') {
      pendingCathedralBreak = {
        rootActionId: p.rootActionId,
        lockedTargetIds: Array.isArray(p.lockedTargetIds)
          ? p.lockedTargetIds.filter((id): id is string => typeof id === 'string')
          : [],
        consumedShards: num(p.consumedShards),
        consumedEdge: num(p.consumedEdge),
      };
    }
  }
  return {
    ...base,
    currentShards: Math.max(0, num(row.currentShards)),
    currentEdge: Math.max(0, num(row.currentEdge)),
    shardsSpentPreventingDamage: Math.max(0, num(row.shardsSpentPreventingDamage)),
    pendingTemperedRemnantReturn: Math.max(0, num(row.pendingTemperedRemnantReturn)),
    playerTurnIndex: num(row.playerTurnIndex),
    combatCycleIndex: num(row.combatCycleIndex),
    crystalEdgeUsedThisPlayerTurn: row.crystalEdgeUsedThisPlayerTurn === true,
    ritualPaneUsedThisPlayerTurn: row.ritualPaneUsedThisPlayerTurn === true,
    perfectFacetUsedThisCombatCycle: row.perfectFacetUsedThisCombatCycle === true,
    pressureCrystalUsedThisPlayerTurn: row.pressureCrystalUsedThisPlayerTurn === true,
    endlessFacetUsedThisPlayerTurn: row.endlessFacetUsedThisPlayerTurn === true,
    cathedralBreakSelected: row.cathedralBreakSelected === true,
    pendingCathedralBreak,
    recentDamageEvents: hydrateDamageLedger(row.recentDamageEvents),
    lastGeneration: row.lastGeneration && typeof row.lastGeneration === 'object'
      ? row.lastGeneration as ShardskinRuntimeState['lastGeneration']
      : null,
    lastPrevention: row.lastPrevention && typeof row.lastPrevention === 'object'
      ? row.lastPrevention as ShardskinRuntimeState['lastPrevention']
      : null,
    lastConversion: row.lastConversion && typeof row.lastConversion === 'object'
      ? row.lastConversion as ShardskinRuntimeState['lastConversion']
      : null,
    lastEdgeConsumption: row.lastEdgeConsumption && typeof row.lastEdgeConsumption === 'object'
      ? row.lastEdgeConsumption as ShardskinRuntimeState['lastEdgeConsumption']
      : null,
    lastSpread: row.lastSpread && typeof row.lastSpread === 'object'
      ? row.lastSpread as ShardskinRuntimeState['lastSpread']
      : null,
    lastVerdict: row.lastVerdict && typeof row.lastVerdict === 'object'
      ? row.lastVerdict as ShardskinRuntimeState['lastVerdict']
      : null,
    lastLog: typeof row.lastLog === 'string' ? row.lastLog : null,
  };
}

export function clearEncounterShardskin(): ShardskinRuntimeState {
  return createDefaultShardskinState();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function owns(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

export function hasLiveShardskinIds(ownedIds: readonly string[]): boolean {
  return ownedIds.some((id) => id.startsWith('SS_'));
}

export function shardskinDepthCap(depth: CombatDepthBand): number {
  return SHARDSKIN_RESOURCE_CAP[depth] ?? SHARDSKIN_RESOURCE_CAP[1];
}

function legalShardskinHostile(
  intents: readonly HostileIntentSnapshot[],
  unitId: string | null | undefined,
): HostileIntentSnapshot | null {
  if (!unitId) return null;
  const row = intents.find((intent) => intent.unitId === unitId);
  if (!row || !row.alive || row.phased) return null;
  return row;
}

interface OccultApplyResult {
  intents: HostileIntentSnapshot[];
  amount: number;
  killed: boolean;
  fizzled: boolean;
}

/** Never bypasses invulnerability or an un-countered protected phase. */
function applyShardskinOccult(
  intents: readonly HostileIntentSnapshot[],
  targetId: string,
  amount: number,
): OccultApplyResult {
  const target = legalShardskinHostile(intents, targetId);
  if (!target || amount <= 0) {
    return { intents: intents.slice(), amount: 0, killed: false, fizzled: true };
  }
  if (target.invulnerable) {
    return { intents: intents.slice(), amount: 0, killed: false, fizzled: true };
  }
  if (target.protectedPhase && !target.authoredCounter) {
    return { intents: intents.slice(), amount: 0, killed: false, fizzled: true };
  }
  let killed = false;
  const next = intents.map((row) => {
    if (row.unitId !== targetId) return row;
    const hp = Math.max(0, row.hp - amount);
    killed = hp <= 0 && row.alive;
    return { ...row, hp, alive: hp > 0 && row.alive };
  });
  return { intents: next, amount, killed, fizzled: false };
}

// ---------------------------------------------------------------------------
// Defensive resolution — Shard prevention (before HP mutation)
// ---------------------------------------------------------------------------

export interface ShardskinDefenseArgs {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  eventId: string;
  /** Damage remaining after ordinary mitigation, Barrier, Parry, and Rift Ward. */
  incomingAfterMitigation: number;
}

export interface ShardskinDefenseResult {
  state: ShardskinRuntimeState;
  shardsSpent: number;
  hpDamage: number;
  /** False when this call replayed an already-recorded eventId instead of spending Shards. */
  freshEvent: boolean;
}

/**
 * Central law for Shard prevention. One Shard prevents one damage; Shards decrement before any
 * HP mutation happens. Idempotent on `eventId` — a duplicate call (rerender, retry) with the
 * same id replays the stored result instead of spending Shards a second time.
 */
export function resolveShardDefense(args: ShardskinDefenseArgs): ShardskinDefenseResult {
  let state = args.state;
  const incoming = Math.max(0, Math.floor(args.incomingAfterMitigation));
  const existing = state.recentDamageEvents.find((row) => row.eventId === args.eventId);
  if (existing) {
    return { state, shardsSpent: existing.shardsSpent, hpDamage: existing.hpDamage, freshEvent: false };
  }
  if (!hasLiveShardskinIds(args.ownedIds) || incoming <= 0) {
    const record: ShardskinDamageEventRecord = { eventId: args.eventId, incoming, shardsSpent: 0, hpDamage: incoming };
    state = {
      ...state,
      recentDamageEvents: [...state.recentDamageEvents, record].slice(-SHARDSKIN_DAMAGE_LEDGER_CAP),
    };
    return { state, shardsSpent: 0, hpDamage: incoming, freshEvent: true };
  }
  const shardsSpent = Math.min(state.currentShards, incoming);
  const hpDamage = incoming - shardsSpent;
  const record: ShardskinDamageEventRecord = { eventId: args.eventId, incoming, shardsSpent, hpDamage };
  state = {
    ...state,
    currentShards: state.currentShards - shardsSpent,
    shardsSpentPreventingDamage: state.shardsSpentPreventingDamage + shardsSpent,
    recentDamageEvents: [...state.recentDamageEvents, record].slice(-SHARDSKIN_DAMAGE_LEDGER_CAP),
    lastPrevention: record,
    lastLog: shardsSpent > 0 ? `SHARD PREVENT // ${shardsSpent}` : state.lastLog,
  };
  return { state, shardsSpent, hpDamage, freshEvent: true };
}

// ---------------------------------------------------------------------------
// Turn / cycle lifecycle
// ---------------------------------------------------------------------------

/**
 * Player-turn conversion. Must run before Wake activation, Fatebound selection, Deferred
 * Exposure, and Trace resolution. Snapshots remaining Shards, folds in the Tempered Remnant
 * return computed from Shards consumed preventing damage since the previous conversion, sets
 * Edge to the capped sum, then clears Shards and the prevention ledger.
 */
export function beginShardskinPlayerTurn(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  depth: CombatDepthBand;
}): ShardskinRuntimeState {
  const state = args.state;
  const remainingShards = state.currentShards;
  const remnantReturn = owns(args.ownedIds, SHARDSKIN_SUPPORT_IDS.TEMPERED_REMNANT)
    ? Math.min(TEMPERED_REMNANT_RETURN_CAP, Math.floor(state.shardsSpentPreventingDamage * TEMPERED_REMNANT_RATIO))
    : 0;
  const cap = shardskinDepthCap(args.depth);
  const nextEdge = Math.min(cap, remainingShards + remnantReturn);
  return {
    ...state,
    playerTurnIndex: state.playerTurnIndex + 1,
    currentEdge: nextEdge,
    currentShards: 0,
    shardsSpentPreventingDamage: 0,
    pendingTemperedRemnantReturn: remnantReturn,
    crystalEdgeUsedThisPlayerTurn: false,
    ritualPaneUsedThisPlayerTurn: false,
    pressureCrystalUsedThisPlayerTurn: false,
    endlessFacetUsedThisPlayerTurn: false,
    lastConversion: { remainingShardsBefore: remainingShards, remnantReturn, edgeSet: nextEdge },
    lastLog: `CONVERSION // EDGE ${nextEdge}`,
  };
}

/** Edge expires at PLAYER_TURN_ENDED if unused, whether voluntary or forced. */
export function expireShardskinEdgeAtPlayerTurnEnd(state: ShardskinRuntimeState): ShardskinRuntimeState {
  if (state.currentEdge <= 0) return state;
  return { ...state, currentEdge: 0 };
}

export function beginShardskinCombatCycle(state: ShardskinRuntimeState): ShardskinRuntimeState {
  return {
    ...state,
    combatCycleIndex: state.combatCycleIndex + 1,
    perfectFacetUsedThisCombatCycle: false,
  };
}

// ---------------------------------------------------------------------------
// Edge consumption + Scatterglass + Endless Facet reform (shared central law)
// ---------------------------------------------------------------------------

export interface ShardskinEdgeConsumptionOutcome {
  state: ShardskinRuntimeState;
  intents: HostileIntentSnapshot[];
  consumedEdge: number;
  primaryPacket: { targetId: string; amount: number } | null;
  scatterglassPackets: readonly { targetId: string; amount: number }[];
  killedIds: string[];
  endlessFacetReform: number;
}

/**
 * The first successful committed native root during the player turn that deals native direct
 * damage consumes all current Edge (natural once-per-turn gate: Edge cannot regenerate mid-turn
 * except via Endless Facet reforming Shards, never Edge itself). Snapshots + clears Edge before
 * anything else resolves, runs Endless Facet's Edge-only reform immediately after, then resolves
 * the primary Occult packet and any Scatterglass secondaries against frozen native results.
 */
export function consumeEdgeForRoot(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  primaryTargetId: string | null;
  otherAffectedTargetIds: readonly string[];
  depth: CombatDepthBand;
}): ShardskinEdgeConsumptionOutcome {
  let state = args.state;
  let intents = args.intents.slice();
  if (!hasLiveShardskinIds(args.ownedIds) || state.currentEdge <= 0) {
    return { state, intents, consumedEdge: 0, primaryPacket: null, scatterglassPackets: [], killedIds: [], endlessFacetReform: 0 };
  }
  const consumedEdge = state.currentEdge;
  state = { ...state, currentEdge: 0 };

  let endlessFacetReform = 0;
  if (
    owns(args.ownedIds, SHARDSKIN_MANIFESTATION_ID)
    && !state.endlessFacetUsedThisPlayerTurn
  ) {
    state = { ...state, endlessFacetUsedThisPlayerTurn: true };
    const cap = shardskinDepthCap(args.depth);
    const reform = Math.floor(consumedEdge * ENDLESS_FACET_RATIO);
    const gained = Math.max(0, Math.min(reform, cap - state.currentShards));
    if (gained > 0) state = { ...state, currentShards: state.currentShards + gained };
    endlessFacetReform = reform;
  }

  const killedIds: string[] = [];
  let primaryPacket: { targetId: string; amount: number } | null = null;
  const primaryLegal = legalShardskinHostile(intents, args.primaryTargetId);
  if (primaryLegal) {
    const applied = applyShardskinOccult(intents, primaryLegal.unitId, consumedEdge);
    intents = applied.intents;
    if (!applied.fizzled) {
      primaryPacket = { targetId: primaryLegal.unitId, amount: applied.amount };
      if (applied.killed) killedIds.push(primaryLegal.unitId);
    }
  }

  const scatterglassPackets: { targetId: string; amount: number }[] = [];
  if (owns(args.ownedIds, SHARDSKIN_SUPPORT_IDS.SCATTERGLASS)) {
    const spread = Math.floor(consumedEdge * SCATTERGLASS_RATIO);
    if (spread > 0) {
      const secondaries = [...new Set(args.otherAffectedTargetIds)].filter((id) => id !== args.primaryTargetId);
      for (const targetId of secondaries) {
        const applied = applyShardskinOccult(intents, targetId, spread);
        intents = applied.intents;
        if (applied.fizzled) continue;
        scatterglassPackets.push({ targetId, amount: applied.amount });
        if (applied.killed) killedIds.push(targetId);
      }
    }
  }

  state = {
    ...state,
    lastEdgeConsumption: {
      rootActionId: null,
      consumedEdge,
      primaryTargetId: primaryPacket?.targetId ?? null,
      fizzled: primaryPacket === null,
    },
    lastSpread: scatterglassPackets.length > 0
      ? { rootActionId: null, targetId: scatterglassPackets[scatterglassPackets.length - 1].targetId, amount: scatterglassPackets[scatterglassPackets.length - 1].amount }
      : state.lastSpread,
    lastLog: primaryPacket ? `EDGE // ${consumedEdge} OCCULT` : 'EDGE // FIZZLE',
  };

  return { state, intents, consumedEdge, primaryPacket, scatterglassPackets, killedIds, endlessFacetReform };
}

// ---------------------------------------------------------------------------
// Core Imbuements — Crystal Edge (weapon/basic) + Ritual Pane (technique/flex)
// ---------------------------------------------------------------------------

export interface ShardskinCoreGenerationResult {
  state: ShardskinRuntimeState;
  generated: number;
  source: 'CRYSTAL_EDGE' | 'RITUAL_PANE' | null;
}

/**
 * Resolves from the native root, after Edge/Scatterglass derivative packets — Core generation
 * never reads derivative Edge damage, only `ctx.totalNativeDirectDamage` / actual paid AP.
 */
export function applyShardskinCoreGeneration(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  ctx: CanonicalRootActionContext;
  depth: CombatDepthBand;
}): ShardskinCoreGenerationResult {
  let state = args.state;
  const { ctx, ownedIds, depth } = args;
  if (!hasLiveShardskinIds(ownedIds) || !ctx.committed || ctx.classification !== 'NATIVE_DIRECT') {
    return { state, generated: 0, source: null };
  }
  const cap = shardskinDepthCap(depth);
  const isUltimate = ctx.sourceKind === 'ULTIMATE' || ctx.actionSurface === 'ULTIMATE';
  const weaponSurface = !isUltimate
    && (ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC'
      || (ctx.actionSurface == null && ctx.sourceKind === 'PLAYER_ACTION'));
  const disciplineSurface = !isUltimate && (ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX');

  if (
    owns(ownedIds, SHARDSKIN_CORE_IDS.CRYSTAL_EDGE)
    && weaponSurface
    && ctx.sourceKind === 'PLAYER_ACTION'
    && !state.crystalEdgeUsedThisPlayerTurn
  ) {
    const totalNative = ctx.totalNativeDirectDamage;
    // Miss-only / setup-only roots (zero native direct damage) never consume the guard.
    if (totalNative > 0) {
      state = { ...state, crystalEdgeUsedThisPlayerTurn: true };
      const raw = Math.min(CRYSTAL_EDGE_PER_ROOT_CAP, Math.floor(totalNative * CRYSTAL_EDGE_RATIO));
      const gained = Math.max(0, Math.min(raw, cap - state.currentShards));
      if (gained > 0) {
        state = {
          ...state,
          currentShards: state.currentShards + gained,
          lastGeneration: { source: SHARDSKIN_CORE_IDS.CRYSTAL_EDGE, amount: gained },
          lastLog: `CRYSTAL EDGE // +${gained} SHARDS`,
        };
      }
      return { state, generated: gained, source: 'CRYSTAL_EDGE' };
    }
  }

  if (
    owns(ownedIds, SHARDSKIN_CORE_IDS.RITUAL_PANE)
    && disciplineSurface
    && ctx.sourceKind === 'PLAYER_ACTION'
    && !state.ritualPaneUsedThisPlayerTurn
  ) {
    state = { ...state, ritualPaneUsedThisPlayerTurn: true };
    const apPaid = Math.max(0, ctx.actualCostsPaid.ap ?? 0);
    const raw = Math.min(RITUAL_PANE_PER_ROOT_CAP, RITUAL_PANE_BASE + RITUAL_PANE_PER_AP * apPaid);
    const gained = Math.max(0, Math.min(raw, cap - state.currentShards));
    if (gained > 0) {
      state = {
        ...state,
        currentShards: state.currentShards + gained,
        lastGeneration: { source: SHARDSKIN_CORE_IDS.RITUAL_PANE, amount: gained },
        lastLog: `RITUAL PANE // +${gained} SHARDS`,
      };
    }
    return { state, generated: gained, source: 'RITUAL_PANE' };
  }

  return { state, generated: 0, source: null };
}

// ---------------------------------------------------------------------------
// Perfect Facet (Instinct)
// ---------------------------------------------------------------------------

export function processShardskinInstinct(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  grade: InstinctGrade;
  depth: CombatDepthBand;
}): { state: ShardskinRuntimeState; generated: number } {
  let state = args.state;
  if (!owns(args.ownedIds, SHARDSKIN_CORE_IDS.PERFECT_FACET) || args.grade === 'FAILED') {
    return { state, generated: 0 };
  }
  if (state.perfectFacetUsedThisCombatCycle) return { state, generated: 0 };
  state = { ...state, perfectFacetUsedThisCombatCycle: true };
  const raw = PERFECT_FACET_SHARDS[args.grade];
  const cap = shardskinDepthCap(args.depth);
  const gained = Math.max(0, Math.min(raw, cap - state.currentShards));
  if (gained > 0) {
    state = {
      ...state,
      currentShards: state.currentShards + gained,
      lastGeneration: { source: SHARDSKIN_CORE_IDS.PERFECT_FACET, amount: gained },
      lastLog: `PERFECT FACET // +${gained} SHARDS`,
    };
  }
  return { state, generated: gained };
}

// ---------------------------------------------------------------------------
// Pressure Crystal (Current)
// ---------------------------------------------------------------------------

export function processShardskinCurrent(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  signal: 'ORDINARY' | 'MAJOR';
  depth: CombatDepthBand;
}): { state: ShardskinRuntimeState; generated: number } {
  let state = args.state;
  if (!owns(args.ownedIds, SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL)) return { state, generated: 0 };
  if (state.pressureCrystalUsedThisPlayerTurn) return { state, generated: 0 };
  state = { ...state, pressureCrystalUsedThisPlayerTurn: true };
  const raw = args.signal === 'MAJOR' ? PRESSURE_CRYSTAL_SHARDS.MAJOR : PRESSURE_CRYSTAL_SHARDS.ORDINARY;
  const cap = shardskinDepthCap(args.depth);
  const gained = Math.max(0, Math.min(raw, cap - state.currentShards));
  if (gained > 0) {
    state = {
      ...state,
      currentShards: state.currentShards + gained,
      lastGeneration: { source: SHARDSKIN_CORE_IDS.PRESSURE_CRYSTAL, amount: gained },
      lastLog: `PRESSURE CRYSTAL // +${gained} SHARDS`,
    };
  }
  return { state, generated: gained };
}

// ---------------------------------------------------------------------------
// Verdict — Cathedral Break
// ---------------------------------------------------------------------------

export interface CathedralBreakBeginResult {
  state: ShardskinRuntimeState;
  active: boolean;
  consumedShards: number;
  consumedEdge: number;
  endlessFacetReform: number;
}

/**
 * Pre-native pass. Requires a positive combined Shards + Edge value; snapshots and consumes both
 * pools, then processes Endless Facet's Edge-only reform once. Idempotent per rootActionId — a
 * duplicate call for the same root replays the stored snapshot instead of consuming twice.
 */
export function beginCathedralBreakUltimate(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  rootActionId: string;
  lockedTargetIds: readonly string[];
  selected: boolean;
  depth: CombatDepthBand;
}): CathedralBreakBeginResult {
  let state = args.state;
  if (!owns(args.ownedIds, SHARDSKIN_VERDICT_ID) || !args.selected) {
    return { state, active: false, consumedShards: 0, consumedEdge: 0, endlessFacetReform: 0 };
  }
  if (state.pendingCathedralBreak?.rootActionId === args.rootActionId) {
    const pending = state.pendingCathedralBreak;
    return { state, active: true, consumedShards: pending.consumedShards, consumedEdge: pending.consumedEdge, endlessFacetReform: 0 };
  }
  const combined = state.currentShards + state.currentEdge;
  if (combined <= 0) {
    return { state, active: false, consumedShards: 0, consumedEdge: 0, endlessFacetReform: 0 };
  }
  const consumedShards = state.currentShards;
  const consumedEdge = state.currentEdge;
  state = { ...state, currentShards: 0, currentEdge: 0 };

  let endlessFacetReform = 0;
  if (
    owns(args.ownedIds, SHARDSKIN_MANIFESTATION_ID)
    && !state.endlessFacetUsedThisPlayerTurn
    && consumedEdge > 0
  ) {
    state = { ...state, endlessFacetUsedThisPlayerTurn: true };
    const cap = shardskinDepthCap(args.depth);
    const reform = Math.floor(consumedEdge * ENDLESS_FACET_RATIO);
    const gained = Math.max(0, Math.min(reform, cap - state.currentShards));
    if (gained > 0) state = { ...state, currentShards: state.currentShards + gained };
    endlessFacetReform = reform;
  }

  state = {
    ...state,
    pendingCathedralBreak: {
      rootActionId: args.rootActionId,
      lockedTargetIds: [...new Set(args.lockedTargetIds)],
      consumedShards,
      consumedEdge,
    },
    lastLog: `CATHEDRAL BREAK // ARMED ${consumedShards + consumedEdge}`,
  };
  return { state, active: true, consumedShards, consumedEdge, endlessFacetReform };
}

export interface CathedralBreakFinishResult {
  state: ShardskinRuntimeState;
  intents: HostileIntentSnapshot[];
  budget: number;
  packets: readonly ShardskinVerdictPacketRecord[];
  killedIds: string[];
  gained: number;
}

/**
 * Post-native pass. Divides `floor((consumedShards + consumedEdge) * 1.5)` once across the
 * distinct locked native target set via the existing deterministic budget splitter; illegal
 * portions (dead/removed/phased/invulnerable/protected) fizzle rather than redistribute. Then
 * grants the flat 10-Shard post-resolution gain, subject to the global depth cap.
 */
export function finishCathedralBreakUltimate(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  rootActionId: string;
  depth: CombatDepthBand;
}): CathedralBreakFinishResult {
  let state = args.state;
  let intents = args.intents.slice();
  if (!owns(args.ownedIds, SHARDSKIN_VERDICT_ID) || state.pendingCathedralBreak?.rootActionId !== args.rootActionId) {
    return { state, intents, budget: 0, packets: [], killedIds: [], gained: 0 };
  }
  const pending = state.pendingCathedralBreak;
  state = { ...state, pendingCathedralBreak: null };
  const budget = Math.floor((pending.consumedShards + pending.consumedEdge) * CATHEDRAL_BREAK_BUDGET_MULTIPLIER);
  const packets: ShardskinVerdictPacketRecord[] = [];
  const killedIds: string[] = [];
  if (budget > 0 && pending.lockedTargetIds.length > 0) {
    const shares = distributeOccultBudget(
      budget,
      pending.lockedTargetIds.map((id) => ({ targetId: id, weight: 1 })),
    );
    for (const share of shares) {
      const targetId = share.assignedTargetId ?? share.originalTargetId;
      const applied = applyShardskinOccult(intents, targetId, share.nativeDirectDamage);
      intents = applied.intents;
      if (applied.fizzled) {
        packets.push({ targetId, amount: 0, fizzled: true });
        continue;
      }
      packets.push({ targetId, amount: applied.amount, fizzled: false });
      if (applied.killed) killedIds.push(targetId);
    }
  }
  const cap = shardskinDepthCap(args.depth);
  const gained = Math.max(0, Math.min(CATHEDRAL_BREAK_POST_GAIN, cap - state.currentShards));
  if (gained > 0) state = { ...state, currentShards: state.currentShards + gained };
  state = {
    ...state,
    lastVerdict: {
      rootActionId: args.rootActionId,
      consumedShards: pending.consumedShards,
      consumedEdge: pending.consumedEdge,
      budget,
      packets,
      gained,
    },
    lastLog: `CATHEDRAL BREAK // ${budget} OCCULT`,
  };
  return { state, intents, budget, packets, killedIds, gained };
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export function shardskinPresentation(state: ShardskinRuntimeState, depth: CombatDepthBand): ShardskinPresentation {
  const cap = shardskinDepthCap(depth);
  return {
    active: state.currentShards > 0 || state.currentEdge > 0 || Boolean(state.lastLog),
    currentShards: state.currentShards,
    shardCap: cap,
    currentEdge: state.currentEdge,
    edgeCap: cap,
    pendingTemperedRemnantReturn: state.pendingTemperedRemnantReturn,
    cathedralBreakSelected: state.cathedralBreakSelected,
    lastLog: state.lastLog,
  };
}

export function setCathedralBreakSelected(state: ShardskinRuntimeState, selected: boolean): ShardskinRuntimeState {
  return { ...state, cathedralBreakSelected: selected };
}

/**
 * Pure preview of a Cathedral Break commitment — never mutates the passed state. Used by the
 * ultimate toggle UI to show the projected budget/target split before commitment.
 */
export function previewCathedralBreak(args: {
  state: ShardskinRuntimeState;
  ownedIds: readonly string[];
  lockedTargetIds: readonly string[];
  depth: CombatDepthBand;
}): {
  eligible: boolean;
  currentShards: number;
  currentEdge: number;
  combined: number;
  budget: number;
  postGain: number;
  targetSplit: readonly { targetId: string; amount: number }[];
} {
  const { state } = args;
  const combined = state.currentShards + state.currentEdge;
  const eligible = owns(args.ownedIds, SHARDSKIN_VERDICT_ID) && combined > 0;
  const budget = Math.floor(combined * CATHEDRAL_BREAK_BUDGET_MULTIPLIER);
  const unique = [...new Set(args.lockedTargetIds)];
  const targetSplit = eligible && budget > 0 && unique.length > 0
    ? distributeOccultBudget(budget, unique.map((id) => ({ targetId: id, weight: 1 })))
      .map((share) => ({ targetId: share.assignedTargetId ?? share.originalTargetId, amount: share.nativeDirectDamage }))
    : [];
  return {
    eligible,
    currentShards: state.currentShards,
    currentEdge: state.currentEdge,
    combined,
    budget,
    postGain: CATHEDRAL_BREAK_POST_GAIN,
    targetSplit,
  };
}
