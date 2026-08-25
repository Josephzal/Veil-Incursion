import type { CanonicalRootActionContext, InstinctGrade, TargetNativeResult } from '../../types/nineStrain';
import type { CombatDepthBand, HostileIntentSnapshot } from '../../types/counterfate';
import type { EnemyCombatProfile } from '../../types/run';
import type { CombatUnitTag } from '../../types/aegisCombat';
import {
  FAULTLINE_CORE_IDS,
  FAULTLINE_MANIFESTATION_ID,
  FAULTLINE_SUPPORT_IDS,
  FAULTLINE_VERDICT_ID,
  FAULT_MAX_STORED,
  FAULT_RUPTURE_THRESHOLD,
  UNARMORED_RUPTURE_DAMAGE,
  type FaultAdditionRecord,
  type FaultOriginKind,
  type FaultlineFizzleReason,
  type FaultlinePreviewDelta,
  type FaultlineRuntimeState,
  type RuptureClass,
  type RuptureResult,
  type RuptureRoute,
} from '../../types/faultline';
import { stripKineticArmor, stripOccultWards } from '../combatDefenseLayerEngine';
import { compareTraceFallback, selectFateboundCandidate } from './intentIdentity';
import { directlyAffectedTargetIds, isDirectlyAffectedNative } from './rootAction';

export function createDefaultFaultlineState(): FaultlineRuntimeState {
  return {
    faultByUnitId: {},
    phaseSuccessorByUnitId: {},
    playerTurnIndex: 0,
    combatCycleIndex: 0,
    stressPatternUsedThisPlayerTurn: false,
    appliedFractureUsedThisPlayerTurn: false,
    counterpressureSuccessUsedThisCombatCycle: false,
    loadLimitUsedThisPlayerTurn: false,
    hairlineUsedThisPlayerTurn: false,
    chainUsedThisPlayerTurn: false,
    chainBonusRuptureRootId: null,
    normalRuptureTargetsThisRoot: [],
    activeRootId: null,
    terminalRootId: null,
    lastAdditions: [],
    lastRuptures: [],
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

function strMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export function hydrateFaultlineState(raw: unknown): FaultlineRuntimeState {
  const base = createDefaultFaultlineState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  return {
    ...base,
    faultByUnitId: strRecord(row.faultByUnitId),
    phaseSuccessorByUnitId: strMap(row.phaseSuccessorByUnitId),
    playerTurnIndex: num(row.playerTurnIndex),
    combatCycleIndex: num(row.combatCycleIndex),
    stressPatternUsedThisPlayerTurn: row.stressPatternUsedThisPlayerTurn === true,
    appliedFractureUsedThisPlayerTurn: row.appliedFractureUsedThisPlayerTurn === true,
    counterpressureSuccessUsedThisCombatCycle: row.counterpressureSuccessUsedThisCombatCycle === true,
    loadLimitUsedThisPlayerTurn: row.loadLimitUsedThisPlayerTurn === true,
    hairlineUsedThisPlayerTurn: row.hairlineUsedThisPlayerTurn === true,
    chainUsedThisPlayerTurn: row.chainUsedThisPlayerTurn === true,
    chainBonusRuptureRootId: typeof row.chainBonusRuptureRootId === 'string' ? row.chainBonusRuptureRootId : null,
    normalRuptureTargetsThisRoot: Array.isArray(row.normalRuptureTargetsThisRoot)
      ? row.normalRuptureTargetsThisRoot.filter((id): id is string => typeof id === 'string')
      : [],
    activeRootId: typeof row.activeRootId === 'string' ? row.activeRootId : null,
    terminalRootId: typeof row.terminalRootId === 'string' ? row.terminalRootId : null,
    lastLog: typeof row.lastLog === 'string' ? row.lastLog : null,
    lastAdditions: Array.isArray(row.lastAdditions) ? row.lastAdditions as FaultlineRuntimeState['lastAdditions'] : [],
    lastRuptures: Array.isArray(row.lastRuptures) ? row.lastRuptures as FaultlineRuntimeState['lastRuptures'] : [],
  };
}

export function beginFaultlinePlayerTurn(state: FaultlineRuntimeState): FaultlineRuntimeState {
  return {
    ...state,
    playerTurnIndex: state.playerTurnIndex + 1,
    stressPatternUsedThisPlayerTurn: false,
    appliedFractureUsedThisPlayerTurn: false,
    loadLimitUsedThisPlayerTurn: false,
    hairlineUsedThisPlayerTurn: false,
    chainUsedThisPlayerTurn: false,
    chainBonusRuptureRootId: null,
  };
}

export function beginFaultlineCombatCycle(state: FaultlineRuntimeState): FaultlineRuntimeState {
  return {
    ...state,
    combatCycleIndex: state.combatCycleIndex + 1,
    counterpressureSuccessUsedThisCombatCycle: false,
  };
}

export function clearEncounterFaultline(): FaultlineRuntimeState {
  return createDefaultFaultlineState();
}

export function setFaultlinePhaseSuccessor(
  state: FaultlineRuntimeState,
  fromUnitId: string,
  toUnitId: string,
): FaultlineRuntimeState {
  const current = state.faultByUnitId[fromUnitId] ?? 0;
  const nextFault = { ...state.faultByUnitId };
  delete nextFault[fromUnitId];
  if (current > 0) {
    nextFault[toUnitId] = Math.min(FAULT_MAX_STORED, Math.max(nextFault[toUnitId] ?? 0, current));
  }
  return {
    ...state,
    faultByUnitId: nextFault,
    phaseSuccessorByUnitId: { ...state.phaseSuccessorByUnitId, [fromUnitId]: toUnitId },
  };
}

export function pruneFaultlineTargets(
  state: FaultlineRuntimeState,
  intents: readonly HostileIntentSnapshot[],
): FaultlineRuntimeState {
  const live = new Set(intents.filter((row) => row.alive).map((row) => mapUnit(state, row.unitId)));
  const next: Record<string, number> = {};
  for (const [id, amount] of Object.entries(state.faultByUnitId)) {
    const mapped = mapUnit(state, id);
    if (!live.has(mapped) || amount <= 0) continue;
    next[mapped] = Math.min(FAULT_MAX_STORED, Math.max(next[mapped] ?? 0, amount));
  }
  return { ...state, faultByUnitId: next };
}

export function mapUnit(state: FaultlineRuntimeState, unitId: string): string {
  return state.phaseSuccessorByUnitId[unitId] ?? unitId;
}

export function appliedFractureAmount(actualPaidAp: number): number {
  return Math.min(3, 1 + Math.floor(Math.max(0, actualPaidAp) / 2));
}

export function counterpressureAmount(grade: InstinctGrade): number {
  if (grade === 'PERFECT') return 3;
  if (grade === 'CLEAN') return 2;
  if (grade === 'STANDARD') return 1;
  return 0;
}

export function unarmoredRuptureDamage(depth: CombatDepthBand): number {
  return UNARMORED_RUPTURE_DAMAGE[depth];
}

function tagSet(values: readonly string[]): Set<string> {
  return new Set(values.map((row) => row.toUpperCase()));
}

export function resolveRuptureRoute(args: {
  defenseRoutingTags: readonly string[];
  damageChannels: readonly string[];
  kineticNativeDamage: number;
  occultNativeDamage: number;
  kineticArmor: number;
  occultWards: number;
}): RuptureRoute {
  const tags = tagSet(args.defenseRoutingTags);
  const channels = tagSet(args.damageChannels);
  const armorBreak = tags.has('ARMOR_BREAK') || tags.has('KINETIC_ARMOR');
  const wardBreak = tags.has('WARD_BREAK') || tags.has('OCCULT_WARD');
  const kineticTag = tags.has('KINETIC') || channels.has('KINETIC');
  const occultTag = tags.has('OCCULT') || channels.has('OCCULT');

  let preferred: RuptureRoute | null = null;
  if (armorBreak && !wardBreak) preferred = 'KINETIC_ARMOR';
  else if (wardBreak && !armorBreak) preferred = 'OCCULT_WARD';
  else if (kineticTag && !occultTag && !wardBreak) preferred = 'KINETIC_ARMOR';
  else if (occultTag && !kineticTag && !armorBreak) preferred = 'OCCULT_WARD';
  else {
    const k = args.kineticNativeDamage;
    const o = args.occultNativeDamage;
    if (k > 0 && o <= 0) preferred = 'KINETIC_ARMOR';
    else if (o > 0 && k <= 0) preferred = 'OCCULT_WARD';
    else if (k > 0 && o > 0) preferred = k >= o ? 'KINETIC_ARMOR' : 'OCCULT_WARD';
    else if (channels.has('KINETIC') && !channels.has('OCCULT')) preferred = 'KINETIC_ARMOR';
    else if (channels.has('OCCULT') && !channels.has('KINETIC')) preferred = 'OCCULT_WARD';
    else preferred = 'KINETIC_ARMOR';
  }

  if (preferred === 'KINETIC_ARMOR' && args.kineticArmor <= 0 && args.occultWards > 0) return 'OCCULT_WARD';
  if (preferred === 'OCCULT_WARD' && args.occultWards <= 0 && args.kineticArmor > 0) return 'KINETIC_ARMOR';
  if (args.kineticArmor <= 0 && args.occultWards <= 0) return 'UNARMORED';
  return preferred;
}

function owns(ownedIds: readonly string[], id: string): boolean {
  return ownedIds.includes(id);
}

function legalHostile(
  intents: readonly HostileIntentSnapshot[],
  unitId: string,
): HostileIntentSnapshot | null {
  return intents.find((row) => row.unitId === unitId && row.alive && !row.phased) ?? null;
}

export function fallbackHostile(
  intents: readonly HostileIntentSnapshot[],
  jammed: boolean,
  excludeId?: string | null,
): HostileIntentSnapshot | null {
  const pool = intents.filter((row) => row.alive && !row.phased && row.unitId !== excludeId);
  if (pool.length === 0) return null;
  const ranked = pool.slice().sort((a, b) => compareTraceFallback(a, b, jammed));
  return ranked[0] ?? selectFateboundCandidate(pool, jammed);
}

function defenseProfile(intent: HostileIntentSnapshot): EnemyCombatProfile {
  return {
    class: 'GREMLIN',
    designation: intent.designation ?? intent.unitId,
    unitId: intent.unitId,
    maxHp: intent.maxHp,
    currentHp: intent.hp,
    baseDamage: 0,
    intent: 'STRIKE',
    chargeTurns: 0,
    evadeActive: false,
    nodeIndex: 0,
    scale: 1,
    kineticArmor: intent.kineticArmor ?? 0,
    occultWards: intent.occultWards ?? 0,
    kineticArmorBrokenThisCombat: intent.kineticArmorBrokenThisCombat === true,
    occultWardsBrokenThisCombat: intent.occultWardsBrokenThisCombat === true,
    combatTags: (intent.combatTags ?? []) as CombatUnitTag[],
    isUntargetable: intent.phased === true || intent.invulnerable === true,
    isBoss: intent.protectedPhase === true,
  };
}

function writeDefense(intent: HostileIntentSnapshot, profile: EnemyCombatProfile): HostileIntentSnapshot {
  return {
    ...intent,
    kineticArmor: profile.kineticArmor ?? 0,
    occultWards: profile.occultWards ?? 0,
    kineticArmorBrokenThisCombat: profile.kineticArmorBrokenThisCombat === true,
    occultWardsBrokenThisCombat: profile.occultWardsBrokenThisCombat === true,
    combatTags: profile.combatTags,
    hp: profile.currentHp,
    alive: profile.currentHp > 0 && intent.alive,
  };
}

function nativeRow(ctx: CanonicalRootActionContext, targetId: string): TargetNativeResult | undefined {
  return ctx.nativeByTarget.find((row) => row.targetId === targetId);
}

function beginRoot(state: FaultlineRuntimeState, rootActionId: string): FaultlineRuntimeState {
  if (state.activeRootId === rootActionId) return state;
  return {
    ...state,
    activeRootId: rootActionId,
    normalRuptureTargetsThisRoot: [],
    chainBonusRuptureRootId: null,
    lastAdditions: [],
    lastRuptures: [],
    lastLog: null,
  };
}

function currentFault(state: FaultlineRuntimeState, unitId: string): number {
  return state.faultByUnitId[mapUnit(state, unitId)] ?? 0;
}

function setFault(state: FaultlineRuntimeState, unitId: string, amount: number): FaultlineRuntimeState {
  const id = mapUnit(state, unitId);
  const next = { ...state.faultByUnitId };
  if (amount <= 0) delete next[id];
  else next[id] = Math.min(FAULT_MAX_STORED, amount);
  return { ...state, faultByUnitId: next };
}

export interface FaultlineProcessArgs {
  state: FaultlineRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  jammed: boolean;
  depth: CombatDepthBand;
  sourceEventId: string;
  extraApplications?: readonly { targetId: string; amount: number; definitionId: string }[];
  skipWeaponCores?: boolean;
}

export interface FaultlineProcessResult {
  state: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  nativeByTarget: TargetNativeResult[];
  intentCountered: boolean;
  objectiveProgress: boolean;
  additions: FaultAdditionRecord[];
  ruptures: RuptureResult[];
}

function mergeNative(
  rows: readonly TargetNativeResult[],
  rupture: RuptureResult,
): TargetNativeResult[] {
  let found = false;
  const next = rows.map((row) => {
    if (row.targetId !== rupture.targetId) return row;
    found = true;
    return {
      ...row,
      killed: row.killed || rupture.killed,
      defenseBreaks: row.defenseBreaks + (rupture.stacksRemoved > 0 ? 1 : 0),
      fractures: row.fractures + (rupture.appliedFracture ? 1 : 0),
      kineticArmorBroken: row.kineticArmorBroken || (rupture.fullBreak && rupture.route === 'KINETIC_ARMOR'),
      occultWardBroken: row.occultWardBroken || (rupture.fullBreak && rupture.route === 'OCCULT_WARD'),
      nativeDirectDamage: row.nativeDirectDamage,
    };
  });
  if (found) return next;
  return [
    ...next,
    {
      targetId: rupture.targetId,
      hits: 0,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 0,
      defenseDamage: rupture.stacksRemoved,
      defenseBreaks: rupture.stacksRemoved > 0 ? 1 : 0,
      fractures: rupture.appliedFracture ? 1 : 0,
      statusesApplied: 0,
      killed: rupture.killed,
      healingDealt: 0,
      movement: 0,
      kineticArmorBroken: rupture.fullBreak && rupture.route === 'KINETIC_ARMOR',
      occultWardBroken: rupture.fullBreak && rupture.route === 'OCCULT_WARD',
    },
  ];
}

function resolveRupture(args: {
  state: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  targetId: string;
  amountBefore: number;
  classification: RuptureClass;
  origin: FaultOriginKind;
  sourceDefinitionId: string;
  sourceEventId: string;
  depth: CombatDepthBand;
}): { state: FaultlineRuntimeState; intents: HostileIntentSnapshot[]; rupture: RuptureResult } {
  const target = legalHostile(args.intents, mapUnit(args.state, args.targetId));
  const afterClear = setFault(args.state, args.targetId, 0);
  const base: RuptureResult = {
    rootActionId: args.ctx.rootActionId,
    sourceEventId: args.sourceEventId,
    targetId: args.targetId,
    amountBefore: args.amountBefore,
    amountApplied: 0,
    amountAfter: 0,
    origin: args.origin,
    classification: args.classification,
    route: null,
    stacksRemoved: 0,
    fullBreak: false,
    appliedFracture: false,
    damage: 0,
    killed: false,
    countered: false,
    objectivePressure: false,
    fizzleReason: null,
    playerFacingLog: 'RUPTURE',
    procDepth: Math.max(1, args.ctx.procDepth),
    sourceDefinitionId: args.sourceDefinitionId,
  };
  if (!target) {
    const rupture = { ...base, fizzleReason: 'NO_LEGAL_TARGET' as FaultlineFizzleReason, playerFacingLog: 'RUPTURE // NO TARGET' };
    return { state: afterClear, intents: args.intents, rupture };
  }
  if (target.invulnerable) {
    const rupture = { ...base, fizzleReason: 'INVULNERABLE' as const, playerFacingLog: 'RUPTURE // INVULNERABLE' };
    return { state: afterClear, intents: args.intents, rupture };
  }
  if (target.protectedPhase) {
    if (target.authoredCounter || args.ctx.objectiveProgress) {
      const rupture = {
        ...base,
        objectivePressure: true,
        playerFacingLog: 'RUPTURE // PHASE PRESSURE',
      };
      return { state: afterClear, intents: args.intents, rupture };
    }
    const rupture = { ...base, fizzleReason: 'PROTECTED_PHASE' as const, playerFacingLog: 'RUPTURE // PROTECTED' };
    return { state: afterClear, intents: args.intents, rupture };
  }

  const native = nativeRow(args.ctx, target.unitId);
  const route = resolveRuptureRoute({
    defenseRoutingTags: args.ctx.defenseRoutingTags,
    damageChannels: args.ctx.damageChannels,
    kineticNativeDamage: native?.kineticNativeDamage ?? (args.ctx.damageChannels.includes('OCCULT') && !args.ctx.damageChannels.includes('KINETIC') ? 0 : native?.nativeDirectDamage ?? 0),
    occultNativeDamage: native?.occultNativeDamage ?? (args.ctx.damageChannels.includes('OCCULT') && !args.ctx.damageChannels.includes('KINETIC') ? native?.nativeDirectDamage ?? 0 : 0),
    kineticArmor: target.kineticArmor ?? 0,
    occultWards: target.occultWards ?? 0,
  });

  let intents = args.intents.slice();
  let rupture: RuptureResult = { ...base, route };
  if (route === 'UNARMORED') {
    const damage = unarmoredRuptureDamage(args.depth);
    intents = intents.map((row) => {
      if (row.unitId !== target.unitId) return row;
      const hp = Math.max(0, row.hp - damage);
      return { ...row, hp, alive: hp > 0 && row.alive };
    });
    const after = intents.find((row) => row.unitId === target.unitId);
    rupture = {
      ...rupture,
      damage,
      killed: Boolean(after && !after.alive),
      playerFacingLog: `RUPTURE // ${damage} OCCULT`,
    };
  } else {
    const index = intents.findIndex((row) => row.unitId === target.unitId);
    const profile = defenseProfile(intents[index]);
    const stripped = route === 'KINETIC_ARMOR'
      ? stripKineticArmor(profile, 1)
      : stripOccultWards(profile, 1);
    intents[index] = writeDefense(intents[index], stripped.enemy);
    rupture = {
      ...rupture,
      stacksRemoved: stripped.stacksRemoved,
      fullBreak: stripped.broke,
      appliedFracture: stripped.appliedFracture,
      playerFacingLog: stripped.broke
        ? (route === 'KINETIC_ARMOR' ? 'RUPTURE // KINETIC ARMOR BROKEN' : 'RUPTURE // OCCULT WARD BROKEN')
        : (route === 'KINETIC_ARMOR' ? 'RUPTURE // KINETIC ARMOR' : 'RUPTURE // OCCULT WARD'),
    };
  }
  return { state: afterClear, intents, rupture };
}

export function addFault(args: {
  state: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  ctx: CanonicalRootActionContext;
  targetId: string;
  amount: number;
  origin: FaultOriginKind;
  classificationIfRupture: RuptureClass;
  sourceDefinitionId: string;
  sourceEventId: string;
  depth: CombatDepthBand;
  allowRupture: boolean;
}): {
  state: FaultlineRuntimeState;
  intents: HostileIntentSnapshot[];
  addition: FaultAdditionRecord;
  rupture: RuptureResult | null;
} {
  const mapped = mapUnit(args.state, args.targetId);
  const before = currentFault(args.state, mapped);
  const already = args.state.normalRuptureTargetsThisRoot.includes(mapped)
    && args.classificationIfRupture === 'NORMAL';
  const applied = Math.max(0, args.amount);
  let after = before + applied;
  let rupture: RuptureResult | null = null;
  let state = args.state;
  let intents = args.intents;
  if (after >= FAULT_RUPTURE_THRESHOLD && args.allowRupture && !already) {
    const resolved = resolveRupture({
      state,
      intents,
      ctx: args.ctx,
      targetId: mapped,
      amountBefore: before,
      classification: args.classificationIfRupture,
      origin: args.origin,
      sourceDefinitionId: args.sourceDefinitionId,
      sourceEventId: args.sourceEventId,
      depth: args.depth,
    });
    state = resolved.state;
    intents = resolved.intents;
    rupture = resolved.rupture;
    after = 0;
    if (args.classificationIfRupture === 'NORMAL') {
      state = {
        ...state,
        normalRuptureTargetsThisRoot: [...state.normalRuptureTargetsThisRoot, mapped],
      };
    }
  } else if (after >= FAULT_RUPTURE_THRESHOLD && already) {
    after = FAULT_MAX_STORED;
    state = setFault(state, mapped, after);
  } else {
    state = setFault(state, mapped, Math.min(FAULT_MAX_STORED, after));
    after = currentFault(state, mapped);
  }
  const addition: FaultAdditionRecord = {
    rootActionId: args.ctx.rootActionId,
    sourceEventId: args.sourceEventId,
    targetId: mapped,
    amountBefore: before,
    amountApplied: applied,
    amountAfter: after,
    origin: args.origin,
    sourceDefinitionId: args.sourceDefinitionId,
    ruptured: rupture != null,
    procDepth: Math.max(0, args.ctx.procDepth),
  };
  state = {
    ...state,
    lastAdditions: [...state.lastAdditions, addition],
    lastRuptures: rupture ? [...state.lastRuptures, rupture] : state.lastRuptures,
    lastLog: rupture?.playerFacingLog ?? `FAULT +${applied}`,
  };
  return { state, intents, addition, rupture };
}

function applyResidual(
  state: FaultlineRuntimeState,
  intents: readonly HostileIntentSnapshot[],
  rupture: RuptureResult,
  ownedIds: readonly string[],
): FaultlineRuntimeState {
  if (!owns(ownedIds, FAULTLINE_SUPPORT_IDS.RESIDUAL_STRESS)) return state;
  if (rupture.classification !== 'NORMAL') return state;
  const target = legalHostile(intents, rupture.targetId);
  if (!target) return state;
  return setFault(state, rupture.targetId, 1);
}

function hairlineTargets(ctx: CanonicalRootActionContext, excludeId: string): string[] {
  return (ctx.directlyAffectedTargetIds ?? directlyAffectedTargetIds(ctx))
    .filter((id) => id !== excludeId);
}

export function processFaultlineRoot(args: FaultlineProcessArgs): FaultlineProcessResult {
  let { ctx, ownedIds, jammed, depth } = args;
  let state = pruneFaultlineTargets(beginRoot(args.state, ctx.rootActionId), args.intents);
  let intents = args.intents.map((row) => ({ ...row, unitId: mapUnit(state, row.unitId) }));
  let nativeByTarget = ctx.nativeByTarget.slice();
  let intentCountered = ctx.intentCountered === true;
  let objectiveProgress = ctx.objectiveProgress === true;
  const additions: FaultAdditionRecord[] = [];
  const ruptures: RuptureResult[] = [];

  const liveFaultline = ownedIds.some((id) => id.startsWith('FL_'));
  if (!liveFaultline || !ctx.committed || ctx.classification !== 'NATIVE_DIRECT') {
    return { state, intents, nativeByTarget, intentCountered, objectiveProgress, additions, ruptures };
  }

  const pushRupture = (rupture: RuptureResult | null) => {
    if (!rupture) return;
    ruptures.push(rupture);
    nativeByTarget = mergeNative(nativeByTarget, rupture);
    if (rupture.objectivePressure) objectiveProgress = true;
    if (rupture.killed && intents.some((row) => row.unitId === rupture.targetId && row.authoredCounter)) {
      intentCountered = true;
    }
  };

  let terminalPass = false;
  if (owns(ownedIds, FAULTLINE_VERDICT_ID) && (ctx.sourceKind === 'ULTIMATE' || ctx.actionSurface === 'ULTIMATE')) {
    if (state.terminalRootId !== ctx.rootActionId) {
      terminalPass = true;
      state = { ...state, terminalRootId: ctx.rootActionId };
      const locked = (ctx.lockedTargetIds.length > 0 ? ctx.lockedTargetIds : ctx.nativeByTarget.map((row) => row.targetId))
        .map((id) => mapUnit(state, id));
      const unique: string[] = [];
      for (const id of locked) {
        if (!unique.includes(id)) unique.push(id);
      }
      for (const targetId of unique) {
        const target = legalHostile(intents, targetId);
        if (!target) continue;
        const before = currentFault(state, targetId);
        const resolved = resolveRupture({
          state,
          intents,
          ctx,
          targetId,
          amountBefore: before,
          classification: 'VERDICT',
          origin: 'VERDICT',
          sourceDefinitionId: FAULTLINE_VERDICT_ID,
          sourceEventId: args.sourceEventId,
          depth,
        });
        state = resolved.state;
        intents = resolved.intents;
        pushRupture(resolved.rupture);
        state = {
          ...state,
          lastRuptures: [...state.lastRuptures, resolved.rupture],
          lastLog: resolved.rupture.playerFacingLog,
        };
      }
    }
  }

  type Pending = { targetId: string; amount: number; definitionId: string };
  const pending: Pending[] = [...(args.extraApplications ?? [])];

  const weaponSurface = ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC'
    || (ctx.actionSurface == null && ctx.sourceKind === 'PLAYER_ACTION');
  if (!args.skipWeaponCores && owns(ownedIds, FAULTLINE_CORE_IDS.STRESS_PATTERN) && weaponSurface && ctx.sourceKind === 'PLAYER_ACTION') {
    if (!state.stressPatternUsedThisPlayerTurn) {
      state = { ...state, stressPatternUsedThisPlayerTurn: true };
      const primary = ctx.lockedTargetIds[0] ? mapUnit(state, ctx.lockedTargetIds[0]) : null;
      const affected = (ctx.directlyAffectedTargetIds ?? directlyAffectedTargetIds(ctx)).map((id) => mapUnit(state, id));
      if (primary) pending.push({ targetId: primary, amount: 2, definitionId: FAULTLINE_CORE_IDS.STRESS_PATTERN });
      const rest = affected.filter((id) => id !== primary);
      const ordered = [
        ...(primary ? [primary] : []),
        ...rest.filter((id) => ctx.lockedTargetIds.map((row) => mapUnit(state, row)).includes(id) && id !== primary),
        ...rest.filter((id) => !ctx.lockedTargetIds.map((row) => mapUnit(state, row)).includes(id)),
      ];
      const seen = new Set<string>();
      for (const id of ordered) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (id === primary) continue;
        const row = nativeRow(ctx, id);
        if (!row || !isDirectlyAffectedNative(row)) continue;
        pending.push({ targetId: id, amount: 1, definitionId: FAULTLINE_CORE_IDS.STRESS_PATTERN });
      }
    }
  }

  const disciplineSurface = ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX';
  if (!args.skipWeaponCores && owns(ownedIds, FAULTLINE_CORE_IDS.APPLIED_FRACTURE) && disciplineSurface && ctx.sourceKind === 'PLAYER_ACTION') {
    if (!state.appliedFractureUsedThisPlayerTurn) {
      state = { ...state, appliedFractureUsedThisPlayerTurn: true };
      const amount = appliedFractureAmount(ctx.actualCostsPaid.ap ?? 0);
      const primary = ctx.lockedTargetIds[0] ? legalHostile(intents, mapUnit(state, ctx.lockedTargetIds[0])) : null;
      const target = primary ?? fallbackHostile(intents, jammed);
      if (target) pending.push({ targetId: target.unitId, amount, definitionId: FAULTLINE_CORE_IDS.APPLIED_FRACTURE });
    }
  }

  const seenTarget = new Set<string>();
  const coreRuptures: RuptureResult[] = [];
  for (const row of pending) {
    const key = `${row.definitionId}:${row.targetId}`;
    if (seenTarget.has(key)) continue;
    seenTarget.add(key);
    if (!legalHostile(intents, row.targetId) && row.definitionId === FAULTLINE_CORE_IDS.STRESS_PATTERN) continue;
    const added = addFault({
      state,
      intents,
      ctx,
      targetId: row.targetId,
      amount: row.amount,
      origin: 'CORE',
      classificationIfRupture: 'NORMAL',
      sourceDefinitionId: row.definitionId,
      sourceEventId: args.sourceEventId,
      depth,
      allowRupture: true,
    });
    state = added.state;
    intents = added.intents;
    additions.push(added.addition);
    if (added.rupture) {
      pushRupture(added.rupture);
      coreRuptures.push(added.rupture);
    }
  }

  for (const rupture of coreRuptures) {
    state = applyResidual(state, intents, rupture, ownedIds);
  }

  const firstRupture = [...state.lastRuptures, ...ruptures].find((row, index, all) => all.indexOf(row) === index) ?? ruptures[0];
  const firstAny = state.lastRuptures[0] ?? firstRupture;
  if (firstAny && owns(ownedIds, FAULTLINE_SUPPORT_IDS.HAIRLINE_CASCADE) && !state.hairlineUsedThisPlayerTurn) {
    state = { ...state, hairlineUsedThisPlayerTurn: true };
    for (const id of hairlineTargets({ ...ctx, nativeByTarget }, firstAny.targetId)) {
      const added = addFault({
        state,
        intents,
        ctx,
        targetId: id,
        amount: 1,
        origin: 'HAIRLINE',
        classificationIfRupture: 'TRANSFERRED',
        sourceDefinitionId: FAULTLINE_SUPPORT_IDS.HAIRLINE_CASCADE,
        sourceEventId: args.sourceEventId,
        depth,
        allowRupture: true,
      });
      state = added.state;
      intents = added.intents;
      additions.push(added.addition);
      pushRupture(added.rupture);
    }
  }

  const firstNormal = coreRuptures.find((row) => row.classification === 'NORMAL');
  if (firstNormal && owns(ownedIds, FAULTLINE_MANIFESTATION_ID) && !state.chainUsedThisPlayerTurn) {
    state = { ...state, chainUsedThisPlayerTurn: true };
    const others = intents.filter((row) => row.alive && row.unitId !== firstNormal.targetId && currentFault(state, row.unitId) > 0);
    let target: HostileIntentSnapshot | null = null;
    let amount = 2;
    if (others.length > 0) {
      others.sort((a, b) => {
        const fault = currentFault(state, b.unitId) - currentFault(state, a.unitId);
        if (fault !== 0) return fault;
        return compareTraceFallback(a, b, jammed);
      });
      target = others[0];
    } else {
      target = fallbackHostile(intents, jammed) ?? legalHostile(intents, firstNormal.targetId);
      amount = 1;
    }
    if (target) {
      const added = addFault({
        state,
        intents,
        ctx,
        targetId: target.unitId,
        amount,
        origin: 'CHAIN',
        classificationIfRupture: 'BONUS',
        sourceDefinitionId: FAULTLINE_MANIFESTATION_ID,
        sourceEventId: args.sourceEventId,
        depth,
        allowRupture: state.chainBonusRuptureRootId !== ctx.rootActionId,
      });
      state = added.state;
      intents = added.intents;
      additions.push(added.addition);
      if (added.rupture) {
        state = { ...state, chainBonusRuptureRootId: ctx.rootActionId };
        pushRupture(added.rupture);
      }
    }
  }

  if (terminalPass) {
    const locked = (ctx.lockedTargetIds.length > 0 ? ctx.lockedTargetIds : ctx.nativeByTarget.map((row) => row.targetId))
      .map((id) => mapUnit(state, id));
    const unique: string[] = [];
    for (const id of locked) {
      if (!unique.includes(id)) unique.push(id);
    }
    for (const targetId of unique) {
      const target = legalHostile(intents, targetId);
      if (!target) continue;
      const added = addFault({
        state,
        intents,
        ctx,
        targetId,
        amount: 2,
        origin: 'VERDICT',
        classificationIfRupture: 'VERDICT',
        sourceDefinitionId: FAULTLINE_VERDICT_ID,
        sourceEventId: args.sourceEventId,
        depth,
        allowRupture: false,
      });
      state = added.state;
      intents = added.intents;
      additions.push(added.addition);
    }
  }

  return { state, intents, nativeByTarget, intentCountered, objectiveProgress, additions, ruptures };
}

export function processFaultlineInstinct(args: {
  state: FaultlineRuntimeState;
  ctx: CanonicalRootActionContext;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  jammed: boolean;
  depth: CombatDepthBand;
  grade: InstinctGrade;
  associatedHostileUnitId?: string | null;
  sourceEventId: string;
}): FaultlineProcessResult {
  let state = pruneFaultlineTargets(beginRoot(args.state, args.ctx.rootActionId), args.intents);
  if (!owns(args.ownedIds, FAULTLINE_CORE_IDS.COUNTERPRESSURE) || args.grade === 'FAILED') {
    return {
      state,
      intents: args.intents.slice(),
      nativeByTarget: args.ctx.nativeByTarget.slice(),
      intentCountered: args.ctx.intentCountered === true,
      objectiveProgress: args.ctx.objectiveProgress === true,
      additions: [],
      ruptures: [],
    };
  }
  if (state.counterpressureSuccessUsedThisCombatCycle) {
    return {
      state,
      intents: args.intents.slice(),
      nativeByTarget: args.ctx.nativeByTarget.slice(),
      intentCountered: args.ctx.intentCountered === true,
      objectiveProgress: args.ctx.objectiveProgress === true,
      additions: [],
      ruptures: [],
    };
  }
  state = { ...state, counterpressureSuccessUsedThisCombatCycle: true };
  const amount = counterpressureAmount(args.grade);
  const associated = args.associatedHostileUnitId
    ? legalHostile(args.intents, mapUnit(state, args.associatedHostileUnitId))
    : null;
  const target = associated ?? fallbackHostile(args.intents, args.jammed);
  if (!target || amount <= 0) {
    return {
      state,
      intents: args.intents.slice(),
      nativeByTarget: args.ctx.nativeByTarget.slice(),
      intentCountered: false,
      objectiveProgress: false,
      additions: [],
      ruptures: [],
    };
  }
  const ctx = {
    ...args.ctx,
    lockedTargetIds: [target.unitId],
    nativeByTarget: args.ctx.nativeByTarget.length > 0 ? args.ctx.nativeByTarget : [{
      targetId: target.unitId,
      hits: 1,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 0,
      defenseDamage: 0,
      defenseBreaks: 0,
      fractures: 0,
      statusesApplied: 1,
      killed: false,
      healingDealt: 0,
      movement: 0,
    }],
    directlyAffectedTargetIds: [target.unitId],
  };
  return processFaultlineRoot({
    state,
    ctx,
    ownedIds: args.ownedIds,
    intents: args.intents,
    jammed: args.jammed,
    depth: args.depth,
    sourceEventId: args.sourceEventId,
    extraApplications: [{ targetId: target.unitId, amount, definitionId: FAULTLINE_CORE_IDS.COUNTERPRESSURE }],
    skipWeaponCores: true,
  });
}

export function processFaultlineCurrent(args: {
  state: FaultlineRuntimeState;
  ctx: CanonicalRootActionContext | null;
  ownedIds: readonly string[];
  intents: readonly HostileIntentSnapshot[];
  jammed: boolean;
  depth: CombatDepthBand;
  signal: 'ORDINARY' | 'MAJOR';
  associatedHostileUnitId?: string | null;
  sourceEventId: string;
}): FaultlineProcessResult {
  const empty: FaultlineProcessResult = {
    state: args.state,
    intents: args.intents.slice(),
    nativeByTarget: args.ctx?.nativeByTarget.slice() ?? [],
    intentCountered: false,
    objectiveProgress: false,
    additions: [],
    ruptures: [],
  };
  if (!owns(args.ownedIds, FAULTLINE_CORE_IDS.LOAD_LIMIT) || !args.ctx) return empty;
  let state = pruneFaultlineTargets(beginRoot(args.state, args.ctx.rootActionId), args.intents);
  if (state.loadLimitUsedThisPlayerTurn) return { ...empty, state };
  state = { ...state, loadLimitUsedThisPlayerTurn: true };
  const amount = args.signal === 'MAJOR' ? 2 : 1;
  const associated = args.associatedHostileUnitId
    ? legalHostile(args.intents, mapUnit(state, args.associatedHostileUnitId))
    : (args.ctx.lockedTargetIds[0] ? legalHostile(args.intents, mapUnit(state, args.ctx.lockedTargetIds[0])) : null);
  const target = associated ?? fallbackHostile(args.intents, args.jammed);
  if (!target) return { ...empty, state };
  const ctx = {
    ...args.ctx,
    lockedTargetIds: args.ctx.lockedTargetIds.length > 0 ? args.ctx.lockedTargetIds : [target.unitId],
    nativeByTarget: args.ctx.nativeByTarget.length > 0 ? args.ctx.nativeByTarget : [{
      targetId: target.unitId,
      hits: 1,
      misses: 0,
      crits: 0,
      nativeDirectDamage: 0,
      defenseDamage: 0,
      defenseBreaks: 0,
      fractures: 0,
      statusesApplied: 0,
      killed: false,
      healingDealt: 0,
      movement: 0,
    }],
    directlyAffectedTargetIds: args.ctx.directlyAffectedTargetIds ?? [target.unitId],
  };
  return processFaultlineRoot({
    state,
    ctx,
    ownedIds: args.ownedIds,
    intents: args.intents,
    jammed: args.jammed,
    depth: args.depth,
    sourceEventId: args.sourceEventId,
    extraApplications: [{ targetId: target.unitId, amount, definitionId: FAULTLINE_CORE_IDS.LOAD_LIMIT }],
    skipWeaponCores: true,
  });
}

export function previewFaultlineRoot(args: FaultlineProcessArgs): {
  deltas: FaultlinePreviewDelta[];
  ruptures: RuptureResult[];
  residual: boolean;
  hairline: boolean;
  chain: boolean;
} {
  const result = processFaultlineRoot(args);
  const deltas: FaultlinePreviewDelta[] = result.additions.map((row) => ({
    targetId: row.targetId,
    faultBefore: row.amountBefore,
    faultAfter: row.amountAfter,
    ruptures: row.ruptured,
    route: result.ruptures.find((rupture) => rupture.targetId === row.targetId)?.route ?? null,
    residual: result.state.faultByUnitId[row.targetId] === 1 && row.ruptured,
    unarmoredDamage: result.ruptures.find((rupture) => rupture.targetId === row.targetId && rupture.route === 'UNARMORED')?.damage ?? 0,
  }));
  return {
    deltas,
    ruptures: result.ruptures,
    residual: result.ruptures.some((row) => row.classification === 'NORMAL') && args.ownedIds.includes(FAULTLINE_SUPPORT_IDS.RESIDUAL_STRESS),
    hairline: result.additions.some((row) => row.origin === 'HAIRLINE'),
    chain: result.additions.some((row) => row.origin === 'CHAIN'),
  };
}

export function faultlinePresentation(state: FaultlineRuntimeState): {
  active: boolean;
  lastLog: string | null;
  pips: Record<string, number>;
} {
  return {
    active: Object.values(state.faultByUnitId).some((value) => value > 0) || Boolean(state.lastLog),
    lastLog: state.lastLog,
    pips: { ...state.faultByUnitId },
  };
}

export function faultPipsForUnit(state: FaultlineRuntimeState, unitId: string): number {
  return currentFault(state, unitId);
}
