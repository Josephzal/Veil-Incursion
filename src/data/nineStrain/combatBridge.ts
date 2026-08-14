import type { CanonicalWeaponFamilyId } from '../weaponFamilyIdNormalize';
import type {
  CanonicalRootActionContext,
  CurrentAdapterInput,
  InstinctAdapterInput,
  NineStrainClassId,
  NineStrainRuntimeState,
  NormalizedBoonEvent,
  NormalizedBoonEventType,
  TargetNativeResult,
} from '../../types/nineStrain';
import { getLiveUniversalBoonDefinitions } from './definitionCatalog';
import { createNineStrainRuntime, type NineStrainRuntime } from './runtime';
import { aggregateNativeByTarget, totalNativeDirectDamage } from './rootAction';
import { classIdForWeaponFamily } from './classWeaponAdapter';
import { inspectWeaponBasicTagLayers } from '../weaponTagResolutionEngine';
import { getWeaponIdentityProfile } from '../weaponIdentityProfiles';

export interface RootAttemptMeta {
  actionId: string;
  classId: NineStrainClassId;
  weaponFamilyId: CanonicalWeaponFamilyId;
  sourceKind?: CanonicalRootActionContext['sourceKind'];
  finalMechanicalTags?: readonly string[];
  authoredCosts?: Readonly<Record<string, number>>;
  actualCostsPaid?: Readonly<Record<string, number>>;
  targetPattern?: string;
  lockedTargetIds?: readonly string[];
  ultimateOwnedRefill?: boolean;
  actionSurface?: CanonicalRootActionContext['actionSurface'];
}

interface OpenAttempt extends RootAttemptMeta {
  rootActionId: string;
  committed: boolean;
  nativeHits: { targetId: string; damage: number; miss?: boolean; crit?: boolean }[];
  procDepth: number;
}

export interface NineStrainCombatBridge {
  runtime: NineStrainRuntime;
  beginRootAttempt(meta: RootAttemptMeta): void;
  markCommitted(patch?: Partial<RootAttemptMeta>): void;
  recordNativeHit(hit: { targetId: string; damage: number; miss?: boolean; crit?: boolean }): void;
  finishRootAttempt(): CanonicalRootActionContext | null;
  cancelOpenAttempt(): void;
  noteInstinct(input: InstinctAdapterInput): void;
  noteCurrent(input: CurrentAdapterInput): void;
  noteEvent(
    type: NormalizedBoonEventType,
    payload?: Readonly<Record<string, number | string | boolean | null>>,
    extra?: { targetId?: string | null; sourceId?: string },
  ): NormalizedBoonEvent;
  markUltimateOwnedRefill(): void;
  serialize(): NineStrainRuntimeState;
  hydrate(raw: unknown): void;
  events(): NormalizedBoonEvent[];
  lastRootContext(): CanonicalRootActionContext | null;
  syncHostileIntents: NineStrainRuntime['syncHostileIntents'];
  runPlayerTurnStart: () => readonly string[];
  beginFateboundResolution: NineStrainRuntime['beginFateboundResolution'];
  completeFateboundIntent: NineStrainRuntime['completeFateboundIntent'];
  confirmChosenFate: NineStrainRuntime['confirmChosenFate'];
  previewChosenFate: NineStrainRuntime['previewChosenFate'];
  presentation: NineStrainRuntime['presentation'];
  ritualPresentation: NineStrainRuntime['ritualPresentation'];
  noteIntentEnded: NineStrainRuntime['noteIntentEnded'];
}

let rootSeq = 0;

export function createNineStrainCombatBridge(args: {
  definitions?: Parameters<typeof createNineStrainRuntime>[0]['definitions'];
  allowTestOffers?: boolean;
  initialState?: unknown;
} = {}): NineStrainCombatBridge {
  const runtime = createNineStrainRuntime({
    definitions: args.definitions ?? getLiveUniversalBoonDefinitions(),
    allowTestOffers: args.allowTestOffers,
  });
  if (args.initialState) runtime.hydrate(args.initialState);

  let attempt: OpenAttempt | null = null;

  function beginRootAttempt(meta: RootAttemptMeta): void {
    if (attempt) finishRootAttempt();
    rootSeq += 1;
    const profile = getWeaponIdentityProfile(meta.weaponFamilyId);
    const tags = meta.finalMechanicalTags ?? inspectWeaponBasicTagLayers({
      familyId: meta.weaponFamilyId,
      basicActionRuntimeTags: profile.mechanicalTags,
      graft: null,
    }).finalTransformedTags;
    attempt = {
      ...meta,
      classId: meta.classId ?? classIdForWeaponFamily(meta.weaponFamilyId),
      sourceKind: meta.sourceKind ?? 'PLAYER_ACTION',
      finalMechanicalTags: tags,
      authoredCosts: meta.authoredCosts ?? {},
      actualCostsPaid: meta.actualCostsPaid ?? {},
      rootActionId: `root:${meta.weaponFamilyId}:${rootSeq}`,
      committed: false,
      nativeHits: [],
      procDepth: 0,
      ultimateOwnedRefill: meta.ultimateOwnedRefill ?? false,
    };
  }

  function markCommitted(patch: Partial<RootAttemptMeta> = {}): void {
    if (!attempt) return;
    attempt.committed = true;
    if (patch.finalMechanicalTags) attempt.finalMechanicalTags = patch.finalMechanicalTags;
    if (patch.actualCostsPaid) attempt.actualCostsPaid = patch.actualCostsPaid;
    if (patch.authoredCosts) attempt.authoredCosts = patch.authoredCosts;
    if (patch.lockedTargetIds) attempt.lockedTargetIds = patch.lockedTargetIds;
    if (patch.targetPattern) attempt.targetPattern = patch.targetPattern;
    if (patch.sourceKind) attempt.sourceKind = patch.sourceKind;
    if (patch.ultimateOwnedRefill) attempt.ultimateOwnedRefill = true;
    if (patch.actionSurface) attempt.actionSurface = patch.actionSurface;
  }

  function recordNativeHit(hit: { targetId: string; damage: number; miss?: boolean; crit?: boolean }): void {
    if (!attempt?.committed) return;
    attempt.nativeHits.push(hit);
  }

  function buildContext(committed: boolean): CanonicalRootActionContext | null {
    if (!attempt) return null;
    const nativeByTarget: TargetNativeResult[] = aggregateNativeByTarget(attempt.nativeHits);
    const locked = attempt.lockedTargetIds ?? nativeByTarget.map((row) => row.targetId);
    return {
      actionId: attempt.actionId,
      sourceKind: attempt.sourceKind ?? 'PLAYER_ACTION',
      finalMechanicalTags: attempt.finalMechanicalTags ?? [],
      damageChannels: attempt.finalMechanicalTags?.includes('OCCULT') ? ['OCCULT'] : ['KINETIC'],
      defenseRoutingTags: attempt.finalMechanicalTags ?? [],
      lockedTargetIds: locked,
      targetPattern: attempt.targetPattern ?? (locked.length > 1 ? 'SPREAD' : 'SINGLE'),
      authoredCosts: attempt.authoredCosts ?? {},
      actualCostsPaid: attempt.actualCostsPaid ?? {},
      nativeByTarget,
      totalNativeDirectDamage: totalNativeDirectDamage(nativeByTarget),
      kills: nativeByTarget.filter((row) => row.killed).length,
      healing: 0,
      movement: 0,
      primaryResource: { gained: 0, spent: 0, preserved: 0, converted: 0 },
      rootActionId: attempt.rootActionId,
      triggerSourceId: null,
      procDepth: attempt.procDepth,
      classification: 'NATIVE_DIRECT',
      classId: attempt.classId,
      weaponFamilyId: attempt.weaponFamilyId,
      committed,
      ultimateOwnedRefill: attempt.ultimateOwnedRefill ?? false,
      actionSurface: attempt.actionSurface,
    };
  }

  function finishRootAttempt(): CanonicalRootActionContext | null {
    if (!attempt) return null;
    const ctx = buildContext(attempt.committed);
    if (ctx) runtime.commitRootAction(ctx);
    attempt = null;
    return ctx;
  }

  function cancelOpenAttempt(): void {
    if (!attempt) return;
    attempt.committed = false;
    finishRootAttempt();
  }

  return {
    runtime,
    beginRootAttempt,
    markCommitted,
    recordNativeHit,
    finishRootAttempt,
    cancelOpenAttempt,
    noteInstinct(input) {
      runtime.resolveInstinct(input);
    },
    noteCurrent(input) {
      runtime.resolveCurrent(input);
    },
    noteEvent(type, payload = {}, extra = {}) {
      return runtime.dispatch({
        type,
        sourceId: extra.sourceId ?? 'hub',
        lineage: attempt ? [attempt.rootActionId] : [],
        rootActionId: attempt?.rootActionId ?? null,
        targetId: extra.targetId ?? null,
        payload,
      });
    },
    markUltimateOwnedRefill() {
      if (attempt) attempt.ultimateOwnedRefill = true;
    },
    serialize: () => runtime.serialize(),
    hydrate(raw) {
      runtime.hydrate(raw);
    },
    events: () => runtime.events(),
    lastRootContext: () => runtime.lastRootContext(),
    syncHostileIntents: (...args) => runtime.syncHostileIntents(...args),
    runPlayerTurnStart: () => runtime.runTurnStart(),
    beginFateboundResolution: (...args) => runtime.beginFateboundResolution(...args),
    completeFateboundIntent: (...args) => runtime.completeFateboundIntent(...args),
    confirmChosenFate: (...args) => runtime.confirmChosenFate(...args),
    previewChosenFate: (...args) => runtime.previewChosenFate(...args),
    presentation: () => runtime.presentation(),
    ritualPresentation: () => runtime.ritualPresentation(),
    noteIntentEnded: (unitId: string) => runtime.noteIntentEnded(unitId),
  };
}
