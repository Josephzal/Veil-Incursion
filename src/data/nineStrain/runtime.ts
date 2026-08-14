import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type {
  CanonicalRootActionContext,
  CurrentAdapterInput,
  InstinctAdapterInput,
  NineStrainRuntimeState,
  NormalizedBoonEvent,
  OwnershipPreview,
  UniversalBoonDefinition,
} from '../../types/nineStrain';
import type {
  CombatDepthBand,
  HostileIntentSnapshot,
  ReversalReleaseResult,
} from '../../types/counterfate';
import { classIdForWeaponFamily } from './classWeaponAdapter';
import { currentEventType, resolveCurrentEvent } from './currentAdapter';
import { indexDefinitions } from './definitionCatalog';
import { executeEffectPrimitive } from './effectPrimitives';
import { isPositiveInstinctGrade, resolveInstinctGrade } from './instinctAdapter';
import { applyAcquire, previewAcquire } from './ownership';
import {
  cloneNineStrainRuntimeState,
  createDefaultNineStrainRuntimeState,
  hydrateNineStrainRuntimeState,
} from './persistence';
import { PROC_DEPTH_CEILING } from './strainRegistry';
import { isTestOnlyBoonId } from './testDefinitions';
import { orderPendingTurnStartEffects, TURN_START_PHASES } from './turnStart';
import {
  captureFinalRevision,
  chosenFateAlternatives,
  confirmChosenFate,
  counterfateOf,
  bindFateboundIfMissing,
  previewChosenFate,
  releaseFatebound,
  resetEnemyCycleCounterfate,
  resolveFinalRevision,
  selectFateboundAtPlayerTurn,
  storeBorrowedEnding,
  storeRefusalPattern,
  storeSecondReflex,
  storeSeveredOutcome,
  syncIntentIdentities,
  retireUnitIntentIdentity,
  withCounterfate,
} from './counterfateEngine';
import { reversalCapForDepth } from './counterfateMath';
import {
  applyMeasureStep,
  applyNativeDamageModifier,
  classifyQualifyingSurface,
  createDefaultRitualCadenceState,
  evaluateDownbeat,
  forceAdvance,
  instinctBonusEligible,
  measuredInvocationPaidAp,
  previewMeasureStep,
  requestClearMeasure as applyAuthoredMeasureClear,
  resetCombatCycleRitualCadence,
  resetEncounterRitualCadence,
  resetPlayerTurnRitualCadence,
  resolvePostFinale,
} from './ritualCadenceEngine';
import type { QualifyingSurface } from '../../types/ritualCadence';

export interface NineStrainRuntimeOptions {
  definitions: readonly UniversalBoonDefinition[];
  allowTestOffers?: boolean;
}

function slotOwnedDefinitionIds(state: NineStrainRuntimeState): string[] {
  return [
    ...Object.values(state.cores).filter((id): id is string => typeof id === 'string'),
    ...state.supports,
    ...state.manifestations,
    ...state.convergences,
    ...(state.boundVerdict ? [state.boundVerdict] : []),
  ];
}

function guardKey(definitionId: string, extra = ''): string {
  return extra ? `${definitionId}::${extra}` : definitionId;
}

export function createNineStrainRuntime(options: NineStrainRuntimeOptions) {
  const definitions = indexDefinitions(options.definitions);
  let state = createDefaultNineStrainRuntimeState();
  let eventOrder = 0;
  const emitted: NormalizedBoonEvent[] = [];
  let lastRootContext: CanonicalRootActionContext | null = null;
  let hostileIntents: HostileIntentSnapshot[] = [];
  let jammed = false;
  const pendingReleases: ReversalReleaseResult[] = [];
  const fixtureOwnedIds = new Set<string>();

  function ownedDefinitionIds(): string[] {
    return [...new Set([...slotOwnedDefinitionIds(state), ...fixtureOwnedIds])];
  }

  function ownedHasKind(kind: UniversalBoonDefinition['effectPrimitives'][number]['kind']): boolean {
    return ownedDefinitionIds().some((id) => (
      definitions.get(id)?.effectPrimitives.some((primitive) => primitive.kind === kind)
    ));
  }

  function cf() {
    return counterfateOf(state);
  }

  function setCf(next: ReturnType<typeof cf>): void {
    state = withCounterfate(state, next);
  }

  function rc() {
    return state.ritualCadence ?? createDefaultRitualCadenceState();
  }

  function setRc(next: ReturnType<typeof rc>): void {
    state = { ...state, ritualCadence: next };
  }

  function hasLiveRitual(): boolean {
    return ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'RITUAL_CADENCE' && !def.testOnly;
    });
  }

  function measurePreviewFor(ctx: Pick<CanonicalRootActionContext, 'actionSurface' | 'sourceKind' | 'classification'>): ReturnType<typeof previewMeasureStep> {
    const surface = classifyQualifyingSurface({
      actionSurface: ctx.actionSurface,
      sourceKind: ctx.sourceKind,
      classification: ctx.classification,
      grandCadenceOwned: ownedHasKind('GRAND_CADENCE'),
      measure: rc().measure,
    });
    return previewMeasureStep({
      state: rc(),
      surface,
      improvisedOwned: ownedHasKind('IMPROVISED_MEASURE'),
    });
  }

  function downbeatFrom(ctx: CanonicalRootActionContext): boolean {
    const killed = ctx.nativeByTarget.some((row) => row.killed) || ctx.kills > 0;
    return evaluateDownbeat({
      killed,
      kineticArmorBroken: ctx.nativeByTarget.some((row) => row.kineticArmorBroken || row.defenseBreaks > 0),
      occultWardBroken: ctx.nativeByTarget.some((row) => row.occultWardBroken === true),
      intentCountered: ctx.intentCountered === true,
      bossThreshold: ctx.bossThresholdReached === true,
      objectiveProgress: ctx.objectiveProgress === true,
    });
  }

  function consumeHeldResonance(ctx: CanonicalRootActionContext): void {
    const current = rc();
    if (!ownedHasKind('MEASURE_HELD_RESONANCE') || !current.heldResonance.armed) return;
    const spent = ctx.primaryResource.spent
      || (ctx.actualCostsPaid.reserve ?? 0)
      || (ctx.actualCostsPaid.flux ?? 0)
      || (ctx.actualCostsPaid.ammo ?? 0);
    if (spent <= 0) return;
    const preserved = ctx.classId === 'HEX_SHOT' ? 1 : Math.min(spent, 10);
    current.heldResonance.armed = false;
    setRc({ ...current, heldResonance: { armed: false, ammoType: current.heldResonance.ammoType } });
    dispatch({
      type: 'CURRENT_PRESERVED',
      sourceId: `held-resonance:${ctx.classId}`,
      lineage: [ctx.rootActionId, 'HELD_RESONANCE'],
      rootActionId: ctx.rootActionId,
      targetId: null,
      payload: {
        signal: 'ORDINARY',
        kind: 'PRESERVED',
        preserved,
        ammoType: ctx.selectedAmmoType ?? current.heldResonance.ammoType,
        classId: ctx.classId,
      },
    });
  }

  function completePendingFinale(ctx: CanonicalRootActionContext, surface: QualifyingSurface): void {
    if (ownedHasKind('MEASURE_DISCIPLINE_FINALE') && surface === 'DISCIPLINE' && ctx.startsCooldown) {
      setRc({ ...rc(), cooldownAdvanced: true });
      state.metrics.ritual_cooldown_advance = (state.metrics.ritual_cooldown_advance ?? 0) + 1;
    }
    setRc(resolvePostFinale(rc(), {
      surface,
      rootActionId: ctx.rootActionId,
      unbrokenOwned: ownedHasKind('UNBROKEN_RITE'),
      downbeatOwned: ownedHasKind('DOWNBEAT'),
      downbeatSuccess: downbeatFrom(ctx),
      heldResonanceOwned: ownedHasKind('MEASURE_HELD_RESONANCE'),
      ammoType: ctx.selectedAmmoType ?? null,
    }));
  }

  function emitRelease(release: ReversalReleaseResult, ctx: CanonicalRootActionContext | null): void {
    pendingReleases.push(release);
    if (release.packet <= 0 && release.interruptProgress <= 0) return;
    const depth = ctx?.procDepth ?? 0;
    const event = emit({
      type: 'DERIVATIVE_RESOLVED',
      sourceId: 'COUNTERFATE',
      lineage: [...release.lineage, 'COUNTERFATE_REVERSAL'],
      rootActionId: ctx?.rootActionId ?? null,
      targetId: release.targetUnitId,
      payload: {
        damage: release.packet,
        procDepth: depth + 1,
        classification: 'DERIVATIVE',
        channel: 'OCCULT',
        multiplier: release.multiplier,
        reason: release.reason,
        interruptProgress: release.interruptProgress,
        countered: release.countered,
      },
    });
    runOwned(event, ctx);
  }

  function skipOrdinaryRelease(): boolean {
    const current = cf();
    if (current.finalRevisionCapture && !current.finalRevisionCapture.consumed) return true;
    if (current.preemptiveConsumedInstanceId && current.preemptiveConsumedInstanceId === current.fateboundInstanceId) {
      return true;
    }
    return false;
  }

  function nextOrder(): number {
    eventOrder += 1;
    state.orderingSeed = eventOrder;
    return eventOrder;
  }

  function emit(event: Omit<NormalizedBoonEvent, 'order'>): NormalizedBoonEvent {
    const full: NormalizedBoonEvent = { ...event, order: nextOrder() };
    emitted.push(full);
    return full;
  }

  function resetWindow(kind: 'PLAYER_TURN' | 'ENEMY_CYCLE' | 'COMBAT_CYCLE' | 'ENCOUNTER'): void {
    if (kind === 'PLAYER_TURN') state.triggerGuards.perPlayerTurn = [];
    if (kind === 'ENEMY_CYCLE') state.triggerGuards.perEnemyCycle = [];
    if (kind === 'COMBAT_CYCLE') {
      state.triggerGuards.perCombatCycle = [];
      state.triggerGuards.instinctPositiveUsedThisCombatCycle = false;
    }
    if (kind === 'ENCOUNTER') state.triggerGuards.perEncounter = [];
  }

  function granularityAllowed(
    def: UniversalBoonDefinition,
    event: NormalizedBoonEvent,
    ctx: CanonicalRootActionContext | null,
  ): boolean {
    const guards = state.triggerGuards;
    const id = def.id;
    switch (def.triggerGranularity) {
      case 'ONCE_PER_ROOT_ACTION': {
        const root = event.rootActionId ?? '';
        const used = guards.perRootAction[root] ?? [];
        if (used.includes(id)) return false;
        guards.perRootAction[root] = [...used, id];
        return true;
      }
      case 'ONCE_PER_TARGET_PER_ROOT_ACTION': {
        const key = `${event.rootActionId ?? ''}::${event.targetId ?? ''}`;
        const used = guards.perTargetPerRoot[key] ?? [];
        if (used.includes(id)) return false;
        guards.perTargetPerRoot[key] = [...used, id];
        return true;
      }
      case 'PER_NATIVE_DIRECT_HIT': {
        const root = event.rootActionId ?? '';
        const used = guards.perNativeHit[guardKey(id, root)] ?? 0;
        const cap = def.procGuards.maxNativeHits ?? 1;
        if (used >= cap) return false;
        guards.perNativeHit[guardKey(id, root)] = used + 1;
        return true;
      }
      case 'ONCE_PER_PLAYER_TURN': {
        if (guards.perPlayerTurn.includes(id)) return false;
        guards.perPlayerTurn = [...guards.perPlayerTurn, id];
        return true;
      }
      case 'ONCE_PER_ENEMY_CYCLE': {
        if (guards.perEnemyCycle.includes(id)) return false;
        guards.perEnemyCycle = [...guards.perEnemyCycle, id];
        return true;
      }
      case 'ONCE_PER_COMBAT_CYCLE': {
        if (guards.perCombatCycle.includes(id)) return false;
        guards.perCombatCycle = [...guards.perCombatCycle, id];
        return true;
      }
      case 'ONCE_PER_ENCOUNTER': {
        if (guards.perEncounter.includes(id)) return false;
        guards.perEncounter = [...guards.perEncounter, id];
        return true;
      }
      case 'THRESHOLD_TRANSITION':
        return true;
      default:
        return true;
    }
  }

  function applyCounterfatePrimitive(
    kind: UniversalBoonDefinition['effectPrimitives'][number]['kind'],
    event: NormalizedBoonEvent,
    ctx: CanonicalRootActionContext | null,
  ): void {
    if (event.type === 'DERIVATIVE_RESOLVED') return;
    if (kind === 'STORE_REVERSAL_NATIVE_SOURCE') {
      if (!ctx || ctx.classification !== 'NATIVE_DIRECT' || ctx.sourceKind === 'INSTINCT') return;
      const sourceId = cf().fateboundUnitId;
      if (!sourceId) return;
      const native = ctx.nativeByTarget.find((row) => row.targetId === sourceId)?.nativeDirectDamage ?? 0;
      const stored = storeSeveredOutcome(cf(), native);
      setCf(stored.cf);
      return;
    }
    if (kind === 'STORE_REVERSAL_DISCIPLINE_AP') {
      const surface = ctx?.actionSurface;
      if (surface !== 'TECHNIQUE' && surface !== 'FLEX') return;
      if (!ctx?.committed) return;
      const ap = ctx.actualCostsPaid.ap ?? 0;
      const stored = storeRefusalPattern(cf(), ap);
      setCf(stored.cf);
      return;
    }
    if (kind === 'STORE_REVERSAL_INSTINCT_GRADE') {
      const grade = event.payload.grade;
      if (typeof grade !== 'string') return;
      const stored = storeSecondReflex(cf(), grade as import('../../types/nineStrain').InstinctGrade);
      setCf(stored.cf);
      if (
        event.payload.preventedFateboundIntentDamage === true
        && stored.result.accepted >= 0
        && cf().rawReversal > 0
      ) {
        const released = releaseFatebound(cf(), hostileIntents, 'PLAYER_PREVENTED', event.lineage, {
          ownsNoFuture: ownedHasKind('NO_FUTURE_CHAIN'),
        });
        setCf(released.cf);
        emitRelease(released.release, ctx);
      }
      return;
    }
    if (kind === 'STORE_REVERSAL_CURRENT_SIGNAL') {
      if (event.payload.kind === 'PRESERVED') return;
      const major = event.payload.signal === 'MAJOR';
      const stored = storeBorrowedEnding(cf(), event.rootActionId ?? lastRootContext?.rootActionId ?? null, major);
      setCf(stored.cf);
      return;
    }
    if (kind === 'FINAL_REVISION' && event.type === 'ULTIMATE_COMMITTED' && event.rootActionId) {
      setCf(captureFinalRevision(cf(), event.rootActionId));
    }
  }

  function runOwned(event: NormalizedBoonEvent, ctx: CanonicalRootActionContext | null): void {
    const depth = typeof event.payload.procDepth === 'number' ? event.payload.procDepth : 0;
    if (depth > PROC_DEPTH_CEILING) return;
    const owned = ownedDefinitionIds()
      .map((id) => definitions.get(id))
      .filter((def): def is UniversalBoonDefinition => Boolean(def))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (const def of owned) {
      if (!def.eventSubscriptions.includes(event.type)) continue;
      if (def.procGuards.blockSelfRecursion && event.lineage.includes(def.id)) continue;
      if (event.type === 'INSTINCT_RESOLVED' && def.imprint === 'INSTINCT') {
        if (event.payload.grade === 'FAILED') continue;
        if (state.triggerGuards.instinctPositiveUsedThisCombatCycle) continue;
      }
      if (!granularityAllowed(def, event, ctx)) continue;
      if (event.type === 'INSTINCT_RESOLVED' && def.imprint === 'INSTINCT' && event.payload.grade !== 'FAILED') {
        state.triggerGuards.instinctPositiveUsedThisCombatCycle = true;
      }
      let derivative = 0;
      for (const primitive of def.effectPrimitives) {
        const result = executeEffectPrimitive(primitive, state, {
          definitionId: def.id,
          rootActionId: event.rootActionId,
          targetId: event.targetId,
          totalNativeDirectDamage: ctx?.totalNativeDirectDamage ?? 0,
          lineage: event.lineage,
        });
        if (primitive.kind === 'RECORD_METRIC' || primitive.kind === 'CAP_SELF_BENEFIT_ONCE') {
          state.metrics = result.metrics;
        }
        derivative += result.derivativeDamage;
        applyCounterfatePrimitive(primitive.kind, event, ctx);
      }
      if (derivative > 0) {
        const derivativeEvent = emit({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: def.id,
          lineage: [...event.lineage, def.id],
          rootActionId: event.rootActionId,
          targetId: event.targetId,
          payload: {
            damage: derivative,
            procDepth: depth + 1,
            classification: 'DERIVATIVE',
          },
        });
        runOwned(derivativeEvent, ctx);
      }
    }
  }

  function dispatch(event: Omit<NormalizedBoonEvent, 'order'>, ctx: CanonicalRootActionContext | null = null): NormalizedBoonEvent {
    const full = emit(event);
    if (
      full.type === 'ROOT_ACTION_CANCELED'
      || full.type === 'ROOT_ACTION_INVALIDATED'
      || full.type === 'ULTIMATE_OPENED'
      || full.type === 'ULTIMATE_CANCELED'
    ) {
      return full;
    }
    if (full.type === 'PLAYER_TURN_STARTED') {
      resetWindow('PLAYER_TURN');
      resetWindow('COMBAT_CYCLE');
      if (hasLiveRitual()) {
        setRc(resetCombatCycleRitualCadence(resetPlayerTurnRitualCadence(rc())));
      }
    }
    if (full.type === 'ENEMY_CYCLE_STARTED') {
      resetWindow('ENEMY_CYCLE');
      const liveCounterfate = ownedDefinitionIds().some((id) => {
        const def = definitions.get(id);
        return def?.strainId === 'COUNTERFATE' && !def.testOnly;
      });
      if (liveCounterfate) setCf(resetEnemyCycleCounterfate(cf()));
    }
    runOwned(full, ctx);
    return full;
  }

  function commitRootAction(ctx: CanonicalRootActionContext): NormalizedBoonEvent[] {
    if (!ctx.committed) {
      lastRootContext = ctx;
      dispatch({
        type: ctx.classification === 'DERIVATIVE' ? 'ROOT_ACTION_INVALIDATED' : 'ROOT_ACTION_CANCELED',
        sourceId: ctx.actionId,
        lineage: [],
        rootActionId: null,
        targetId: null,
        payload: { committed: false },
      });
      return [...emitted];
    }
    let prepared = ctx;
    const ritualActive = hasLiveRitual() && ctx.classification === 'NATIVE_DIRECT';
    const preview = ritualActive ? measurePreviewFor(ctx) : null;
    if (preview?.finale && preview.surface === 'ARMAMENT' && ownedHasKind('MEASURE_ARMAMENT_FINALE')) {
      const native = applyNativeDamageModifier(ctx.nativeByTarget, 0.3);
      prepared = {
        ...prepared,
        nativeByTarget: native,
        totalNativeDirectDamage: native.reduce((sum, row) => sum + row.nativeDirectDamage, 0),
      };
    }
    if (preview?.finale && preview.surface === 'VERDICT' && ownedHasKind('GRAND_CADENCE')) {
      const native = applyNativeDamageModifier(prepared.nativeByTarget, 0.35);
      prepared = {
        ...prepared,
        nativeByTarget: native,
        totalNativeDirectDamage: native.reduce((sum, row) => sum + row.nativeDirectDamage, 0),
      };
    }
    if (preview && preview.surface === 'DISCIPLINE' && ownedHasKind('MEASURE_DISCIPLINE_FINALE')) {
      const authored = ctx.authoredCosts.ap ?? ctx.actualCostsPaid.ap ?? 0;
      prepared = {
        ...prepared,
        actualCostsPaid: {
          ...prepared.actualCostsPaid,
          ap: measuredInvocationPaidAp(authored, preview.finale, true),
        },
      };
    }
    lastRootContext = prepared;
    if (ritualActive && preview && preview.surface && preview.surface !== 'INSTINCT') {
      let next = applyMeasureStep(rc(), preview);
      if (preview.finale) {
        next = {
          ...next,
          pendingFinaleRootId: prepared.rootActionId,
          pendingFinaleSurface: preview.surface,
        };
      }
      setRc(next);
    }
    if (prepared.sourceKind === 'ULTIMATE') {
      dispatch({
        type: 'ULTIMATE_COMMITTED',
        sourceId: prepared.actionId,
        lineage: [prepared.rootActionId],
        rootActionId: prepared.rootActionId,
        targetId: null,
        payload: { sourceKind: prepared.sourceKind, ultimateOwnedRefill: prepared.ultimateOwnedRefill },
      }, prepared);
    }
    dispatch({
      type: 'ROOT_ACTION_COMMITTED',
      sourceId: prepared.actionId,
      lineage: [prepared.rootActionId],
      rootActionId: prepared.rootActionId,
      targetId: null,
      payload: {
        sourceKind: prepared.sourceKind,
        procDepth: prepared.procDepth,
        classification: prepared.classification,
        tagCount: prepared.finalMechanicalTags.length,
        ultimateOwnedRefill: prepared.ultimateOwnedRefill,
      },
    }, prepared);
    for (const row of prepared.nativeByTarget) {
      dispatch({
        type: 'PER_TARGET_RESULT',
        sourceId: prepared.actionId,
        lineage: [prepared.rootActionId],
        rootActionId: prepared.rootActionId,
        targetId: row.targetId,
        payload: {
          nativeDirectDamage: row.nativeDirectDamage,
          hits: row.hits,
          misses: row.misses,
        },
      }, prepared);
    }
    dispatch({
      type: 'ROOT_ACTION_RESOLVED',
      sourceId: prepared.actionId,
      lineage: [prepared.rootActionId],
      rootActionId: prepared.rootActionId,
      targetId: null,
      payload: {
        totalNativeDirectDamage: prepared.totalNativeDirectDamage,
        classification: prepared.classification,
        procDepth: prepared.procDepth,
      },
    }, prepared);
    maybeReleaseAfterRoot(prepared);
    if (prepared.sourceKind === 'ULTIMATE') {
      dispatch({
        type: 'ULTIMATE_RESOLVED',
        sourceId: prepared.actionId,
        lineage: [prepared.rootActionId],
        rootActionId: prepared.rootActionId,
        targetId: null,
        payload: {},
      }, prepared);
      const revision = resolveFinalRevision(cf(), hostileIntents, prepared.rootActionId, [prepared.rootActionId]);
      setCf(revision.cf);
      if (revision.release) emitRelease(revision.release, prepared);
    }
    consumeHeldResonance(prepared);
    if (preview?.finale && preview.surface) {
      const release = cf().lastRelease;
      const targetHp = hostileIntents.find((row) => row.unitId === release?.targetUnitId)?.hp ?? 0;
      const descendantKill = Boolean(release && release.packet > 0 && targetHp > 0 && release.packet >= targetHp);
      completePendingFinale({
        ...prepared,
        kills: prepared.kills + (descendantKill ? 1 : 0),
        intentCountered: prepared.intentCountered === true || release?.countered === true,
      }, preview.surface);
    }
    return [...emitted];
  }

  function maybeReleaseAfterRoot(ctx: CanonicalRootActionContext): void {
    if (skipOrdinaryRelease()) return;
    const boundUnit = cf().fateboundUnitId;
    if (!boundUnit) return;
    const killed = ctx.nativeByTarget.some((row) => row.targetId === boundUnit && row.killed);
    if (!killed) return;
    const released = releaseFatebound(cf(), hostileIntents, 'PLAYER_PREVENTED', [ctx.rootActionId], {
      ownsNoFuture: ownedHasKind('NO_FUTURE_CHAIN'),
    });
    setCf(released.cf);
    emitRelease(released.release, ctx);
  }

  function previewRootAction(ctx: CanonicalRootActionContext): {
    metrics: Record<string, number>;
    events: NormalizedBoonEvent[];
    counterfate: ReturnType<typeof cf>;
    ritualCadence: ReturnType<typeof rc>;
  } {
    const snapshot = cloneNineStrainRuntimeState(state);
    const orderSnapshot = eventOrder;
    const emittedLen = emitted.length;
    const releaseLen = pendingReleases.length;
    const contextSnapshot = lastRootContext;
    commitRootAction(ctx);
    const metrics = { ...state.metrics };
    const events = emitted.slice(emittedLen);
    const counterfate = cloneNineStrainRuntimeState({ ...state, counterfate: cf() }).counterfate;
    const ritualCadence = structuredClone(rc());
    state = snapshot;
    lastRootContext = contextSnapshot;
    eventOrder = orderSnapshot;
    emitted.length = emittedLen;
    pendingReleases.length = releaseLen;
    return { metrics, events, counterfate, ritualCadence };
  }

  function resolveInstinct(input: InstinctAdapterInput): InstinctGradeWrap {
    const grade = resolveInstinctGrade(input);
    const rootActionId = `instinct:${input.classId}:${eventOrder + 1}`;
    dispatch({
      type: grade === 'FAILED' ? 'INSTINCT_FAILED' : 'INSTINCT_COMMITTED',
      sourceId: `instinct:${input.classId}`,
      lineage: [rootActionId],
      rootActionId,
      targetId: null,
      payload: { grade, classId: input.classId },
    });
    dispatch({
      type: 'INSTINCT_RESOLVED',
      sourceId: `instinct:${input.classId}`,
      lineage: [rootActionId],
      rootActionId,
      targetId: null,
      payload: {
        grade,
        classId: input.classId,
        positive: isPositiveInstinctGrade(grade),
        preventedFateboundIntentDamage: input.preventedFateboundIntentDamage === true,
      },
    });
    if (hasLiveRitual() && ownedHasKind('MEASURE_INSTINCT') && !rc().instinctCommitmentUsedThisCombatCycle) {
      const before = rc();
      const preview = measurePreviewFor({
        actionSurface: 'INSTINCT',
        sourceKind: 'INSTINCT',
        classification: 'NATIVE_DIRECT',
      });
      const different = preview.surface !== before.previousSurface;
      let next = applyMeasureStep(before, preview);
      next = {
        ...next,
        instinctCommitmentUsedThisCombatCycle: true,
        instinctCommitmentRootId: rootActionId,
      };
      let finale = preview.finale;
      if (instinctBonusEligible(grade, different, finale) && preview.surface) {
        const bonus = forceAdvance(next, preview.surface);
        next = bonus.state;
        finale = finale || bonus.finale;
      }
      setRc(next);
      if (finale && preview.surface) {
        completePendingFinale({
          actionId: `instinct:${input.classId}`,
          sourceKind: 'INSTINCT',
          finalMechanicalTags: [],
          damageChannels: [],
          defenseRoutingTags: [],
          lockedTargetIds: [],
          targetPattern: 'SELF',
          authoredCosts: {},
          actualCostsPaid: {},
          nativeByTarget: [],
          totalNativeDirectDamage: 0,
          kills: 0,
          healing: 0,
          movement: 0,
          primaryResource: { gained: 0, spent: 0, preserved: 0, converted: 0 },
          rootActionId,
          triggerSourceId: null,
          procDepth: 0,
          classification: 'NATIVE_DIRECT',
          classId: input.classId,
          weaponFamilyId: 'aegis-longsword',
          committed: true,
          ultimateOwnedRefill: false,
          actionSurface: 'INSTINCT',
          intentCountered: input.preventedFateboundIntentDamage === true,
        }, preview.surface);
      }
    }
    return { grade, positiveActivated: isPositiveInstinctGrade(grade) && state.triggerGuards.instinctPositiveUsedThisCombatCycle };
  }

  function resolveCurrent(input: CurrentAdapterInput) {
    const resolved = resolveCurrentEvent(input);
    if (!resolved || resolved.excluded) {
      return resolved;
    }
    dispatch({
      type: currentEventType(resolved.kind),
      sourceId: `current:${input.classId}`,
      lineage: lastRootContext ? [lastRootContext.rootActionId] : [],
      rootActionId: lastRootContext?.rootActionId ?? null,
      targetId: null,
      payload: { signal: resolved.signal, kind: resolved.kind, classId: input.classId },
    });
    return resolved;
  }

  function runTurnStart(): readonly string[] {
    dispatch({
      type: 'PLAYER_TURN_STARTED',
      sourceId: 'turn',
      lineage: [],
      rootActionId: null,
      targetId: null,
      payload: {},
    });
    const liveCounterfate = ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'COUNTERFATE' && !def.testOnly;
    });
    if (liveCounterfate) {
      setCf(selectFateboundAtPlayerTurn(cf(), hostileIntents, jammed, cf().combatDepth));
    }
    const ordered = orderPendingTurnStartEffects(state.pendingEffects);
    state.pendingEffects = [];
    for (const pending of ordered) {
      const key = pending.kind === 'TRACE' ? 'traces_resolved' : 'other_queued_resolved';
      state.metrics[key] = (state.metrics[key] ?? 0) + 1;
    }
    return TURN_START_PHASES.slice();
  }

  function preview(definitionId: string, extra: { premiumVerdictSource?: boolean; exceptionalSourceId?: string; combatDepth?: number; equippedWeaponFamilyId?: string } = {}): OwnershipPreview {
    return previewAcquire(state, definitions, definitionId, {
      allowTestOffers: options.allowTestOffers,
      combatDepth: extra.combatDepth ?? cf().combatDepth,
      ...extra,
    });
  }

  function commit(definitionId: string, extra: { premiumVerdictSource?: boolean; exceptionalSourceId?: string; combatDepth?: number; equippedWeaponFamilyId?: string } = {}): OwnershipPreview {
    const result = applyAcquire(state, definitions, definitionId, {
      allowTestOffers: options.allowTestOffers,
      combatDepth: extra.combatDepth ?? cf().combatDepth,
      ...extra,
    });
    if (result.eligible) state = cloneNineStrainRuntimeState(result.after);
    return result;
  }

  function grantFixture(definitionId: string): void {
    const def = definitions.get(definitionId);
    if (!def) return;
    fixtureOwnedIds.add(definitionId);
    if (!state.contactedStrains.some((row) => row.strainId === def.strainId)) {
      state = {
        ...state,
        contactedStrains: [
          ...state.contactedStrains,
          { strainId: def.strainId, order: state.contactedStrains.length, exceptional: false },
        ],
      };
    }
  }

  return {
    definitions,
    getState: () => cloneNineStrainRuntimeState(state),
    hydrate(raw: unknown) {
      state = hydrateNineStrainRuntimeState(raw);
      eventOrder = state.orderingSeed;
    },
    serialize: () => cloneNineStrainRuntimeState(state),
    preview,
    commit,
    grantFixture,
    dispatch,
    commitRootAction,
    previewRootAction,
    resolveInstinct,
    resolveCurrent,
    runTurnStart,
    events: () => emitted.slice(),
    lastRootContext: () => lastRootContext,
    classIdForWeaponFamily,
    isTestOnlyBoonId,
    metric: (key: string) => state.metrics[key] ?? 0,
    syncHostileIntents(rows: readonly Omit<HostileIntentSnapshot, 'intentInstanceId'>[], nextJammed = false) {
      jammed = nextJammed;
      const synced = syncIntentIdentities(cf(), rows);
      setCf(synced.cf);
      hostileIntents = synced.snapshots;
      const liveCounterfate = ownedDefinitionIds().some((id) => {
        const def = definitions.get(id);
        return def?.strainId === 'COUNTERFATE' && !def.testOnly;
      });
      if (liveCounterfate && !cf().fateboundInstanceId) {
        setCf(bindFateboundIfMissing(cf(), hostileIntents, jammed, cf().combatDepth));
      }
      return hostileIntents;
    },
    hostileIntents: () => hostileIntents.slice(),
    setCombatDepth(depth: CombatDepthBand) {
      setCf({ ...cf(), combatDepth: depth, depthCap: reversalCapForDepth(depth) });
    },
    confirmChosenFate(targetInstanceId: string) {
      const result = confirmChosenFate(cf(), hostileIntents, targetInstanceId);
      setCf(result.cf);
      return result;
    },
    previewChosenFate(targetInstanceId: string) {
      return previewChosenFate(cf(), hostileIntents, targetInstanceId);
    },
    chosenFateAlternatives: () => chosenFateAlternatives(cf(), hostileIntents),
    beginFateboundResolution(options: { protectedPhase?: boolean } = {}) {
      if (!ownedHasKind('PREEMPTIVE_RUPTURE') || !cf().fateboundInstanceId) return null;
      if (cf().preemptiveConsumedInstanceId === cf().fateboundInstanceId) return cf().lastRelease;
      const released = releaseFatebound(cf(), hostileIntents, 'RESOLVED', ['PREEMPTIVE_RUPTURE'], {
        preemptive: true,
        ownsPreemptive: true,
        ownsNoFuture: ownedHasKind('NO_FUTURE_CHAIN'),
        protectedPhase: options.protectedPhase,
      });
      setCf(released.cf);
      emitRelease(released.release, lastRootContext);
      return released.release;
    },
    completeFateboundIntent(reason: 'RESOLVED' | 'PLAYER_PREVENTED' | 'ENEMY_REMOVED') {
      const current = cf();
      const unitId = current.fateboundUnitId;
      if (current.preemptiveConsumedInstanceId) {
        setCf(retireUnitIntentIdentity({ ...current, preemptiveConsumedInstanceId: null }, unitId));
        return current.lastRelease;
      }
      if (skipOrdinaryRelease()) {
        setCf(retireUnitIntentIdentity(current, unitId));
        return current.lastRelease;
      }
      if (!current.fateboundInstanceId) return current.lastRelease;
      const released = releaseFatebound(current, hostileIntents, reason, [reason], {
        ownsNoFuture: ownedHasKind('NO_FUTURE_CHAIN'),
      });
      setCf(retireUnitIntentIdentity(released.cf, unitId));
      emitRelease(released.release, lastRootContext);
      return released.release;
    },
    noteIntentEnded(unitId: string) {
      setCf(retireUnitIntentIdentity(cf(), unitId));
    },
    lastReleases: () => pendingReleases.slice(),
    previewMeasure: (ctx: Pick<CanonicalRootActionContext, 'actionSurface' | 'sourceKind' | 'classification'>) => measurePreviewFor(ctx),
    requestClearMeasure() {
      setRc(applyAuthoredMeasureClear(rc()));
      return rc();
    },
    resetEncounterCadence() {
      setRc(resetEncounterRitualCadence());
    },
    ritualPresentation() {
      const current = rc();
      const beatLabel = current.measure === 'BEAT_I' ? 'BEAT I' : current.measure === 'BEAT_II' ? 'BEAT II' : 'EMPTY';
      const previous = current.previousSurface === 'ARMAMENT'
        ? 'Weapon'
        : current.previousSurface === 'DISCIPLINE'
          ? 'Discipline'
          : current.previousSurface === 'INSTINCT'
            ? 'Instinct'
            : current.previousSurface === 'VERDICT'
              ? 'Ultimate'
              : 'None';
      return {
        beatLabel,
        previousSurfaceLabel: previous,
        finale: current.lastOutcome === 'FINALE',
        heldResonanceArmed: current.heldResonance.armed,
        improvisedAvailable: ownedHasKind('IMPROVISED_MEASURE') && !current.improvisedUsedThisTurn,
        grandCadenceReady: ownedHasKind('GRAND_CADENCE') && current.measure === 'BEAT_II',
        measure: current.measure,
      };
    },
    presentation() {
      const current = cf();
      const bound = hostileIntents.find((row) => row.intentInstanceId === current.fateboundInstanceId) ?? null;
      return {
        reversal: current.rawReversal,
        cap: current.depthCap,
        fateboundInstanceId: current.fateboundInstanceId,
        fateboundUnitId: current.fateboundUnitId,
        concealed: jammed || current.concealed,
        lastRelease: current.lastRelease,
        chosenFateAvailable: ownedHasKind('CHOSEN_FATE_REBIND')
          && !current.chosenFateUsedThisTurn
          && chosenFateAlternatives(current, hostileIntents).length > 0,
        alternatives: chosenFateAlternatives(current, hostileIntents).filter((row) => !row.concealed),
        boundLabel: jammed || current.concealed || bound?.concealed
          ? 'Obscured future'
          : (bound?.designation ?? null),
      };
    },
  };
}

interface InstinctGradeWrap {
  grade: import('../../types/nineStrain').InstinctGrade;
  positiveActivated: boolean;
}

export type NineStrainRuntime = ReturnType<typeof createNineStrainRuntime>;

export function weaponFamilyExecutionContext(
  familyId: WeaponFamilyId,
  extras: Partial<CanonicalRootActionContext> = {},
): CanonicalRootActionContext {
  const classId = classIdForWeaponFamily(familyId);
  const nativeByTarget = extras.nativeByTarget ?? [{
    targetId: 'enemy-a',
    hits: 2,
    misses: 0,
    crits: 0,
    nativeDirectDamage: 10,
    defenseDamage: 0,
    defenseBreaks: 0,
    fractures: 0,
    statusesApplied: 0,
    killed: false,
    healingDealt: 0,
    movement: 0,
  }];
  return {
    actionId: extras.actionId ?? `basic:${familyId}`,
    sourceKind: extras.sourceKind ?? 'PLAYER_ACTION',
    finalMechanicalTags: extras.finalMechanicalTags ?? ['STRIKE'],
    damageChannels: extras.damageChannels ?? ['KINETIC'],
    defenseRoutingTags: extras.defenseRoutingTags ?? ['KINETIC_ARMOR'],
    lockedTargetIds: extras.lockedTargetIds ?? nativeByTarget.map((row) => row.targetId),
    targetPattern: extras.targetPattern ?? 'SINGLE',
    authoredCosts: extras.authoredCosts ?? { ap: 1 },
    actualCostsPaid: extras.actualCostsPaid ?? { ap: 1 },
    nativeByTarget,
    totalNativeDirectDamage: extras.totalNativeDirectDamage
      ?? nativeByTarget.reduce((sum, row) => sum + row.nativeDirectDamage, 0),
    kills: extras.kills ?? 0,
    healing: extras.healing ?? 0,
    movement: extras.movement ?? 0,
    primaryResource: extras.primaryResource ?? { gained: 0, spent: 0, preserved: 0, converted: 0 },
    rootActionId: extras.rootActionId ?? `root:${familyId}:${extras.sourceKind === 'ULTIMATE' ? 'ult' : '1'}`,
    triggerSourceId: extras.triggerSourceId ?? null,
    procDepth: extras.procDepth ?? 0,
    classification: extras.classification ?? 'NATIVE_DIRECT',
    classId: extras.classId ?? classId,
    weaponFamilyId: extras.weaponFamilyId ?? familyId,
    committed: extras.committed ?? true,
    ultimateOwnedRefill: extras.ultimateOwnedRefill ?? false,
    actionSurface: extras.actionSurface,
    startsCooldown: extras.startsCooldown,
    selectedAmmoType: extras.selectedAmmoType ?? null,
    intentCountered: extras.intentCountered,
    bossThresholdReached: extras.bossThresholdReached,
    objectiveProgress: extras.objectiveProgress,
  };
}

export function instinctInputForClass(classId: ClassType): InstinctAdapterInput {
  if (classId === 'AEGIS') {
    return { classId, perfectParry: true, parryAttempted: true };
  }
  if (classId === 'HEX_SHOT') {
    return { classId, reloadQuality: 'PERFECT' };
  }
  return { classId, riftPreventedDamage: 10, riftWouldReachHp: 10 };
}

export function ordinaryCurrentInput(classId: ClassType): CurrentAdapterInput {
  if (classId === 'HEX_SHOT') return { classId, ammoSpent: true };
  return { classId, ordinarySpend: true };
}

export function majorCurrentInput(classId: ClassType): CurrentAdapterInput {
  if (classId === 'AEGIS') return { classId, ordinarySpend: true, reserveEntered50: true };
  if (classId === 'HEX_SHOT') return { classId, ammoSpent: true, perfectReload: true };
  return { classId, ordinarySpend: true, brinkEntered: true };
}
