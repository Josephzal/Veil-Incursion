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
  storeReversal,
  syncIntentIdentities,
  retireUnitIntentIdentity,
  withCounterfate,
} from './counterfateEngine';
import { reversalCapForDepth, roundCounterfateAmount } from './counterfateMath';
import {
  applyMeasureStep,
  applyNativeDamageModifier,
  applyScheduledBeatII,
  advanceMeasureWithoutFinale,
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
import {
  AFTERIMAGE_CORE_IDS,
  AFTERIMAGE_VERDICT_ID,
} from '../../types/afterimage';
import type { ScheduledTrace, TraceProvenance } from '../../types/afterimage';
import {
  applyDeferredDelay,
  armCrossfade,
  beginPlayerTurn,
  clearEncounterAfterimage,
  consumeCrossfade,
  createDefaultAfterimageState,
  deferredExposureOptions,
  dueActionTraces,
  dueTurnStartTraces,
  effectiveTracePower,
  expireUnusedCrossfade,
  legalHostileFallback,
  markActionTracesReady,
  markTraceResolved,
  retargetPortions,
  schedulePersistentSecondary,
  tryMintLingering,
  tryMintPhantom,
  tryMintRecurrent,
  tryMintReflex,
  tryMintSecondEnding,
  tryMintConvergenceReleaseTrace,
} from './afterimageEngine';
import { CONVERGENCE_IDS } from '../../types/convergence';
import {
  createDefaultConvergenceState,
  isCanonicalPlayerCounteredRelease,
  resetConvergenceCombatCycle,
  resetConvergenceEnemyCycle,
  resetConvergencePlayerTurn,
} from './convergenceEngine';
import {
  applyQueuedTurnStartRefund,
  applyReturnStroke,
  applyStillpointEndTurn,
  applyZeroHour,
  beginStillpointEnemyCycle,
  beginStillpointPlayerTurn,
  clearEncounterStillpoint,
  condensedImpactFromRoot,
  consumeFocusForRoot,
  createDefaultStillpointState,
  endStillpointEnemyCycle,
  grantFleetingStillness as mintFleetingStillness,
  matchingStillpointSurfaces,
  previewNativeStillnessGain,
  previewPatientInvocationAp,
  promoteQuietReflexGrade,
  resolveCondensedImpactTarget,
  returnStrokeQualifies,
  scalePerfectNumeric,
  silentReservoirGainBonus,
  silentReservoirReloadBonus,
  silentReservoirSpendPreserve,
  stillpointPresentation as composeStillpointPresentation,
  stillnessProducerBlocked,
  tickIntentCountdowns,
  usablePlayerAp,
  noteHostileApDisruption,
} from './stillpointEngine';
import type { PlayerTurnEndReason } from '../../types/stillpoint';
import { STILLPOINT_CORE_IDS } from '../../types/stillpoint';
import { SELF_LINK_STRENGTH } from '../../types/woundweave';
import {
  armTightenedThread,
  applyWoundweavePacketsToIntents,
  beginWoundweavePlayerTurn,
  clearEncounterWoundweave,
  createDefaultWoundweaveState,
  emitReflexiveAgony,
  endpointBadgeForUnit,
  hasPrimaryPair,
  isLinkedWoundweaveEndpoint,
  isPrimaryEndpoint,
  processWoundweaveRoot,
  reformWoundlinkPair,
  seedEntangledFateEndpoint,
  setWoundweavePhaseSuccessor,
  woundweavePartnerOf,
  woundweavePresentation as composeWoundweavePresentation,
} from './woundweaveEngine';
import {
  beginFaultlineCombatCycle,
  beginFaultlinePlayerTurn,
  clearEncounterFaultline,
  createDefaultFaultlineState,
  faultlinePresentation as composeFaultlinePresentation,
  faultPipsForUnit,
  previewFaultlineRoot,
  processFaultlineCurrent,
  processFaultlineInstinct,
  processFaultlineRoot,
  pruneFaultlineTargets,
  setFaultlinePhaseSuccessor,
} from './faultlineEngine';
import {
  activateRecordedWake,
  applyLastHeartbeatOverdraw,
  applyNativeHpCost,
  applyQualifyingLoss,
  beginSoulwakeEnemyCycle,
  beginSoulwakePlayerTurn,
  clearSoulwakeHubFlags,
  commitOrdinaryOverdraw,
  completeSoulwakeEncounter,
  createDefaultSoulwakeState,
  expireSoulwakeAtEnemyCycleEnd,
  injectImmediateResidualWake,
  ordinaryOverdrawAvailable,
  previewOrdinaryOverdraw,
  previewSoulwakeRoot,
  processSoulwakeCurrent,
  processSoulwakeInstinct,
  processSoulwakeRoot,
  requestResidualCarry,
  resolveLastHeartbeatPackets,
  setLastHeartbeatSelected,
  snapshotWakePowered,
  soulwakePresentation as composeSoulwakePresentation,
  syncSoulwakeVitals,
} from './soulwakeEngine';
import {
  applyBreakingMeasureFinaleFault,
  applyBrokenOutcomeOnRelease,
  applyBrokenOutcomeOnRupture,
  applyCriticalPressureFault,
  applyDeferredBreakingMeasureBeat,
  applyEchoedFaultAfterTrace,
  applyHeldBreathEndTurnCarry,
  applyHeldBreathOverdraw,
  applyLivingFault,
  applyLivingFaultCarryOnRupture,
  applyPainForetoldWakeStore,
  applyPulseRiteFinaleCarry,
  applyPulseRiteOverdraw,
  applySplitSeamNativeTransfer,
  applySplitSeamRupture,
  applySympatheticWoundCarry,
  applySympatheticWoundPacket,
  armEchoedFaultFromRupture,
  echoedFaultTraceMultiplier,
  noteBreakingMeasureRupture,
  notePhantomPainMint,
  painForetoldHostileWakeMultiplier,
  resolvePhantomPain,
  tryCriticalPressureFleetingRestore,
} from './sector3ConvergenceEngine';
import type { Sector3ConvergenceRuntimeState, Sector4ConvergenceRuntimeState } from '../../types/convergence';
import type { FaultAdditionRecord, RuptureResult } from '../../types/faultline';
import { SOULWAKE_CORE_IDS, SOULWAKE_VERDICT_ID } from '../../types/soulwake';
import { directlyAffectedTargetIds } from './rootAction';
import {
  beginGravemarkCombatCycle,
  beginGravemarkPlayerTurn,
  clearEncounterGravemark,
  consumeGravemarkApRefund as drainGravemarkApRefund,
  consumeGravemarkPendingMovement as drainGravemarkPendingMovement,
  createDefaultGravemarkState,
  falsePositionEligibleForLane,
  gravemarkPresentation as composeGravemarkPresentation,
  hasLiveGravemarkIds,
  applyWorldTurnedSidewaysUltimateDamage,
  previewGravemarkRoot,
  processGravemarkCurrent,
  processGravemarkInstinct,
  processGravemarkRoot,
  processWorldTurnedSidewaysPostNative,
  processWorldTurnedSidewaysPreNative,
  pruneGravemarkTargets,
  setGravemarkPhaseSuccessor,
} from './gravemarkEngine';
import {
  applyShardskinCoreGeneration,
  beginCathedralBreakUltimate,
  beginShardskinCombatCycle,
  beginShardskinPlayerTurn,
  clearEncounterShardskin,
  consumeEdgeForRoot,
  createDefaultShardskinState,
  expireShardskinEdgeAtPlayerTurnEnd,
  finishCathedralBreakUltimate,
  hasLiveShardskinIds,
  previewCathedralBreak,
  processShardskinCurrent,
  processShardskinInstinct,
  resolveShardDefense,
  setCathedralBreakSelected,
  shardskinPresentation as composeShardskinPresentation,
} from './shardskinEngine';
import { SHARDSKIN_SUPPORT_IDS, SHARDSKIN_VERDICT_ID } from '../../types/shardskin';
import {
  applyCrystalLigatureFormationShards,
  applyFatedFacetAbsorption,
  applyFateOutOfPlaceReleaseBonus,
  applyFateOutOfPlaceStore,
  applyFaultglassEdgeFault,
  applyFaultglassRuptureShards,
  applyImpactLatticeDisplacementShards,
  applyImpactLatticeEdgeClause,
  applyParallaxEchoTraceMovement,
  applyPhantomFacetGeneration,
  applyPrismaticRiteDeferredBeat,
  applyPrismaticRiteFinaleShards,
  applySector4Collisions,
  applySoulglassGeneration,
  applySoulglassResidualCarry,
  applyStillglassNativeStillnessShards,
  applyStoredVectorBonusDisplacement,
  applyTectonicShiftFault,
  applyTectonicShiftRuptureBonus,
  applyTetheredOrbitArmedBonus,
  applyTetheredOrbitFormationPolarity,
  applyTraumaVectorForcedDisplacement,
  applyTraumaVectorResidualCarry,
  applyTurningRiteAdvance,
  applyTurningRiteDeferredBeat,
  applyTurningRiteFinaleBonus,
  armParallaxEchoFromDisplacement,
  armPhantomFacetFromEdge,
  armPrismaticRiteCathedralPending,
  armPrismaticRiteDeferredBeat,
  armStillglassPendingFleeting,
  armTetheredOrbitPartnerOnDisplacement,
  clearTetheredOrbitArmIfInvalid,
  consumeParallaxEchoArm,
  consumePhantomFacetArm,
  consumeStillglassPendingFleeting,
  crystalLigatureMirrorAmount,
  resolvePrismaticRiteCathedralPending,
  tectonicShiftFaultEligible,
  tryStoredVectorFleetingRequest,
} from './sector4ConvergenceEngine';

export interface NineStrainRuntimeOptions {
  definitions: readonly UniversalBoonDefinition[];
  allowTestOffers?: boolean;
  allowSector2Wave?: boolean;
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

  function ai() {
    return state.afterimage ?? createDefaultAfterimageState();
  }

  function setAi(next: ReturnType<typeof ai>): void {
    state = { ...state, afterimage: next };
  }

  function cv() {
    return state.convergence ?? createDefaultConvergenceState();
  }

  function setCv(next: ReturnType<typeof cv>): void {
    state = { ...state, convergence: next };
  }

  function s3(): Sector3ConvergenceRuntimeState {
    return cv().sector3;
  }

  function setS3(next: Sector3ConvergenceRuntimeState): void {
    setCv({ ...cv(), sector3: next });
  }

  function s4(): Sector4ConvergenceRuntimeState {
    return cv().sector4;
  }

  function setS4(next: Sector4ConvergenceRuntimeState): void {
    setCv({ ...cv(), sector4: next });
  }

  function sp() {
    return state.stillpoint ?? createDefaultStillpointState();
  }

  function setSp(next: ReturnType<typeof sp>): void {
    state = { ...state, stillpoint: next };
  }

  function ww() {
    return state.woundweave ?? createDefaultWoundweaveState();
  }

  function setWw(next: ReturnType<typeof ww>): void {
    state = { ...state, woundweave: next };
  }

  function fl() {
    return state.faultline ?? createDefaultFaultlineState();
  }

  function setFl(next: ReturnType<typeof fl>): void {
    state = { ...state, faultline: next };
  }

  function sw() {
    return state.soulwake ?? createDefaultSoulwakeState();
  }

  function setSw(next: ReturnType<typeof sw>): void {
    state = { ...state, soulwake: next };
  }

  function gm() {
    return state.gravemark ?? createDefaultGravemarkState();
  }

  function setGm(next: ReturnType<typeof gm>): void {
    state = { ...state, gravemark: next };
  }

  function hasLiveGravemark(): boolean {
    return hasLiveGravemarkIds(ownedDefinitionIds());
  }

  function ss() {
    return state.shardskin ?? createDefaultShardskinState();
  }

  function setSs(next: ReturnType<typeof ss>): void {
    state = { ...state, shardskin: next };
  }

  function hasLiveShardskin(): boolean {
    return hasLiveShardskinIds(ownedDefinitionIds());
  }

  function hasLiveSoulwake(): boolean {
    return ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'SOULWAKE' && !def.testOnly;
    }) || ownedDefinitionIds().some((id) => id.startsWith('SW_'));
  }

  function applySoulwakePackets(
    result: ReturnType<typeof processSoulwakeRoot>,
    prepared: CanonicalRootActionContext,
    sourceId: string,
  ): CanonicalRootActionContext {
    setSw(result.state);
    hostileIntents = result.intents;
    for (const packet of result.packets) {
      dispatch({
        type: 'DERIVATIVE_RESOLVED',
        sourceId,
        lineage: [prepared.rootActionId, sourceId, 'SOULWAKE'],
        rootActionId: prepared.rootActionId,
        targetId: packet.targetId,
        payload: {
          damage: packet.damage,
          killed: packet.killed,
          fizzled: packet.fizzled,
          classification: 'DERIVATIVE',
        },
      }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth) });
    }
    if (result.apRefund > 0) {
      state.metrics.ap_refund = (state.metrics.ap_refund ?? 0) + result.apRefund;
    }
    if (result.cooldownAdvanced) {
      state.metrics.cooldown_advanced = (state.metrics.cooldown_advanced ?? 0) + 1;
    }
    return {
      ...result.ctx,
      nativeByTarget: result.nativeByTarget,
      kills: prepared.kills + result.nativeByTarget.filter((row) => row.killed).length - prepared.nativeByTarget.filter((row) => row.killed).length,
    };
  }

  function hasLiveFaultline(): boolean {
    return ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'FAULTLINE' && !def.testOnly;
    }) || ownedDefinitionIds().some((id) => id.startsWith('FL_'));
  }

  function applyFaultlineResult(
    result: ReturnType<typeof processFaultlineRoot>,
    prepared: CanonicalRootActionContext,
  ): CanonicalRootActionContext {
    setFl(result.state);
    hostileIntents = result.intents;
    for (const addition of result.additions) {
      dispatch({
        type: 'FAULT_APPLIED',
        sourceId: addition.sourceDefinitionId,
        lineage: [prepared.rootActionId, addition.sourceDefinitionId],
        rootActionId: prepared.rootActionId,
        targetId: addition.targetId,
        payload: {
          amount: addition.amountApplied,
          before: addition.amountBefore,
          after: addition.amountAfter,
          origin: addition.origin,
          classification: 'DERIVATIVE',
        },
      }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth) });
    }
    for (const rupture of result.ruptures) {
      dispatch({
        type: 'RUPTURE_RESOLVED',
        sourceId: rupture.sourceDefinitionId,
        lineage: [prepared.rootActionId, rupture.sourceDefinitionId, 'RUPTURE'],
        rootActionId: prepared.rootActionId,
        targetId: rupture.targetId,
        payload: {
          route: rupture.route,
          damage: rupture.damage,
          fullBreak: rupture.fullBreak,
          killed: rupture.killed,
          classification: 'DERIVATIVE',
        },
      }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth) });
    }
    if (result.ruptures.length > 0) {
      state.metrics.faultline_ruptures = (state.metrics.faultline_ruptures ?? 0) + result.ruptures.length;
    }
    return {
      ...prepared,
      nativeByTarget: result.nativeByTarget,
      intentCountered: result.intentCountered,
      objectiveProgress: result.objectiveProgress,
      kills: prepared.kills + result.nativeByTarget.filter((row) => row.killed).length - prepared.nativeByTarget.filter((row) => row.killed).length,
    };
  }

  function dispatchFaultEffects(
    additions: readonly FaultAdditionRecord[],
    ruptures: readonly RuptureResult[],
    prepared: CanonicalRootActionContext,
  ): void {
    for (const addition of additions) {
      dispatch({
        type: 'FAULT_APPLIED',
        sourceId: addition.sourceDefinitionId,
        lineage: [prepared.rootActionId, addition.sourceDefinitionId],
        rootActionId: prepared.rootActionId,
        targetId: addition.targetId,
        payload: {
          amount: addition.amountApplied,
          before: addition.amountBefore,
          after: addition.amountAfter,
          origin: addition.origin,
          classification: 'DERIVATIVE',
        },
      }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth) });
    }
    for (const rupture of ruptures) {
      dispatch({
        type: 'RUPTURE_RESOLVED',
        sourceId: rupture.sourceDefinitionId,
        lineage: [prepared.rootActionId, rupture.sourceDefinitionId, 'RUPTURE'],
        rootActionId: prepared.rootActionId,
        targetId: rupture.targetId,
        payload: {
          route: rupture.route,
          damage: rupture.damage,
          fullBreak: rupture.fullBreak,
          killed: rupture.killed,
          classification: 'DERIVATIVE',
        },
      }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth) });
    }
    if (ruptures.length > 0) {
      state.metrics.faultline_ruptures = (state.metrics.faultline_ruptures ?? 0) + ruptures.length;
    }
  }

  function woundlinkPartnerId(unitId: string): string | null {
    const current = ww();
    if (!isPrimaryEndpoint(current, unitId)) return null;
    if (current.selfLink) return unitId;
    if (current.endpointA === unitId) return current.endpointB;
    if (current.endpointB === unitId) return current.endpointA;
    return null;
  }

  function applySector3PostFaultline(
    prepared: CanonicalRootActionContext,
    previewFinale: boolean,
  ): void {
    const depth = cf().combatDepth;
    const focused = sp().focusedRoot;

    if (
      ownedHasKind('CRITICAL_PRESSURE')
      && focused?.rootActionId === prepared.rootActionId
    ) {
      const applied = applyCriticalPressureFault(fl(), hostileIntents, prepared, depth);
      setFl(applied.fl);
      hostileIntents = applied.intents;
      dispatchFaultEffects(
        applied.addition ? [applied.addition] : [],
        applied.rupture ? [applied.rupture] : [],
        prepared,
      );
    }

    if (ownedHasKind('LIVING_FAULT') && prepared.wakePowered) {
      const applied = applyLivingFault(s3(), fl(), hostileIntents, prepared, depth);
      setS3(applied.cv);
      setFl(applied.fl);
      hostileIntents = applied.intents;
      dispatchFaultEffects(applied.additions, applied.ruptures, prepared);
    }

    if (ownedHasKind('BREAKING_MEASURE') && previewFinale) {
      const applied = applyBreakingMeasureFinaleFault(fl(), hostileIntents, prepared, depth);
      setFl(applied.fl);
      hostileIntents = applied.intents;
      dispatchFaultEffects(applied.additions, applied.ruptures, prepared);
    }

    if (ownedHasKind('SPLIT_SEAM')) {
      for (const addition of fl().lastAdditions) {
        if (addition.origin !== 'CORE') continue;
        if (!isPrimaryEndpoint(ww(), addition.targetId)) continue;
        const transferred = applySplitSeamNativeTransfer(
          s3(),
          fl(),
          hostileIntents,
          ww(),
          prepared,
          depth,
          addition,
        );
        setS3(transferred.cv);
        setFl(transferred.fl);
        hostileIntents = transferred.intents;
        dispatchFaultEffects(
          transferred.transfer ? [transferred.transfer] : [],
          transferred.rupture ? [transferred.rupture] : [],
          prepared,
        );
        break;
      }
    }

    for (const rupture of fl().lastRuptures) {
      if (rupture.rootActionId !== prepared.rootActionId) continue;

      if (ownedHasKind('BROKEN_OUTCOME') && rupture.sourceDefinitionId !== CONVERGENCE_IDS.BROKEN_OUTCOME) {
        const broken = applyBrokenOutcomeOnRupture(
          s3(),
          cf(),
          rupture,
          sw().enemyCycleIndex || sp().enemyCycleIndex,
        );
        setS3(broken.cv);
        setCf(broken.cf);
      }

      if (ownedHasKind('BREAKING_MEASURE')) {
        const noted = noteBreakingMeasureRupture(s3(), rc(), previewFinale);
        setS3(noted.cv);
        setRc(noted.rc);
      }

      if (ownedHasKind('ECHOED_FAULT')) {
        setS3(armEchoedFaultFromRupture(s3(), rupture.targetId, null));
      }

      if (ownedHasKind('CRITICAL_PRESSURE')) {
        const restored = tryCriticalPressureFleetingRestore(s3(), sp(), mintFleetingStillness, {
          rootActionId: prepared.rootActionId,
          causedRupture: true,
          chargeSource: focused?.rootActionId === prepared.rootActionId ? focused.chargeSource : null,
        });
        setS3(restored.cv);
        setSp(restored.sp);
      }

      if (ownedHasKind('SPLIT_SEAM')) {
        const partnerSnap = woundlinkPartnerId(rupture.targetId);
        const split = applySplitSeamRupture(
          s3(),
          fl(),
          hostileIntents,
          ww(),
          prepared,
          depth,
          rupture,
          partnerSnap,
        );
        setS3(split.cv);
        setFl(split.fl);
        hostileIntents = split.intents;
        setWw(split.ww);
        dispatchFaultEffects(
          split.transfer ? [split.transfer] : [],
          split.rupture ? [split.rupture] : [],
          prepared,
        );
      }

      if (ownedHasKind('LIVING_FAULT')) {
        const carry = applyLivingFaultCarryOnRupture(s3(), sw(), requestResidualCarry);
        setS3(carry.cv);
        setSw(carry.sw);
      }

      if (ownedHasKind('TECTONIC_SHIFT')) {
        const bonus = applyTectonicShiftRuptureBonus({
          cv: s4(), gm: gm(), intents: hostileIntents, rupture, depth,
          collisionCourseOwned: ownedDefinitionIds().includes('GM_SUPPORT_COLLISION_COURSE'),
        });
        setS4(bonus.cv);
        applySector4DisplacementOutcome(bonus, prepared);
      }

      if (ownedHasKind('FAULTGLASS')) {
        const granted = applyFaultglassRuptureShards(s4(), ss(), depth);
        setS4(granted.cv);
        setSs(granted.ss);
      }
    }
  }

  function hasLiveWoundweave(): boolean {
    return ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'WOUNDWEAVE' && !def.testOnly;
    }) || ownedDefinitionIds().some((id) => id.startsWith('WW_'));
  }

  function emitWoundweavePackets(
    packets: ReturnType<typeof processWoundweaveRoot>['packets'],
    prepared: CanonicalRootActionContext,
  ): void {
    for (const packet of packets) {
      if (packet.fizzled || packet.occultDamage <= 0) continue;
      dispatch({
        type: 'DERIVATIVE_RESOLVED',
        sourceId: packet.lineage[1] ?? 'WOUNDWEAVE',
        lineage: [...packet.lineage, 'WOUNDWEAVE'],
        rootActionId: prepared.rootActionId,
        targetId: packet.targetId,
        payload: {
          damage: packet.occultDamage,
          occult: packet.occultDamage,
          kind: packet.kind,
          classification: 'DERIVATIVE',
        },
      }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth + 1) });
    }
  }

  function hasLiveStillpoint(): boolean {
    return ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'STILLPOINT' && !def.testOnly;
    }) || ownedDefinitionIds().some((id) => id.startsWith('SP_'));
  }

  let holdFateboundRelease = false;

  function hasLiveAfterimage(): boolean {
    return ownedDefinitionIds().some((id) => {
      const def = definitions.get(id);
      return def?.strainId === 'AFTERIMAGE' && !def.testOnly;
    });
  }

  function delayedLineage(extra: readonly string[] = []): string[] {
    return ['AFTERIMAGE_TRACE', ...extra];
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
    if (ctx.delayedOrigin === true) return false;
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

  function applyFatedRefrainFinaleStore(): void {
    if (!ownedHasKind('FATED_REFRAIN') || cv().fatedRefrainStoreUsedThisCombatCycle) return;
    const stored = storeReversal(cf(), 8);
    setCf(stored.cf);
    setCv({ ...cv(), fatedRefrainStoreUsedThisCombatCycle: true });
  }

  function armEchoedRite(rootActionId: string): void {
    if (!ownedHasKind('ECHOED_RITE')) return;
    setCv({
      ...cv(),
      echoedEmpowerment: {
        sourceFinaleRootId: rootActionId,
        armedPlayerTurn: ai().playerTurnIndex,
        expireOnPlayerTurnIndex: ai().playerTurnIndex + 1,
      },
    });
  }

  function expireEchoedIfDue(): void {
    const emp = cv().echoedEmpowerment;
    if (!emp) return;
    if (ai().playerTurnIndex >= emp.expireOnPlayerTurnIndex) {
      setCv({ ...cv(), echoedEmpowerment: null });
    }
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
    if (ownedHasKind('TURNING_RITE')) {
      const bonus = applyTurningRiteFinaleBonus({
        cv: s4(), gm: gm(), intents: hostileIntents, ctx,
        collisionCourseOwned: ownedDefinitionIds().includes('GM_SUPPORT_COLLISION_COURSE'),
        depth: cf().combatDepth,
      });
      setS4(bonus.cv);
      applySector4DisplacementOutcome(bonus, ctx);
      // The Finale's own close reopens the Measure; a deferred Beat from this same root begins it.
      const deferred = applyTurningRiteDeferredBeat(s4(), rc());
      setS4(deferred.cv);
      setRc(deferred.rc);
    }
    if (ownedHasKind('PRISMATIC_RITE')) {
      const shards = applyPrismaticRiteFinaleShards(s4(), ss(), cf().combatDepth, ctx.rootActionId);
      setS4(shards.cv);
      setSs(shards.ss);
      const deferred = applyPrismaticRiteDeferredBeat(s4(), rc());
      setS4(deferred.cv);
      setRc(deferred.rc);
    }
  }

  function noteOrdinaryTraceResolved(trace: ScheduledTrace): void {
    if (trace.provenance !== 'CORE') return;
    if (trace.originImprint === 'VERDICT') return;
    if (ownedHasKind('CROSSFADE')) {
      setAi(armCrossfade(ai(), trace.originImprint, true));
    }
    if (ownedHasKind('PERSISTENT_FORM')) {
      setAi(schedulePersistentSecondary(ai(), trace, true));
    }
  }

  function resolveOneTrace(trace: ScheduledTrace, hostRoot: CanonicalRootActionContext | null): void {
    let resolving = trace;
    let restoredOutcome = false;
    if (trace.provenance === 'CORE' && cv().echoedEmpowerment) {
      resolving = { ...trace, powerMultiplier: trace.powerMultiplier * 1.5 };
      setCv({ ...cv(), echoedEmpowerment: null });
    }
    let echoedMul = resolving.powerMultiplier !== trace.powerMultiplier ? 1.5 : 1;
    if (ownedHasKind('ECHOED_FAULT') && trace.provenance === 'CORE') {
      const targetIds = resolving.targetAndDamageMap.map((row) => row.originalTargetId);
      const faultMul = echoedFaultTraceMultiplier(s3(), targetIds, trace.traceId);
      if (faultMul > 1) {
        echoedMul *= faultMul;
        setS3({
          ...s3(),
          echoedFaultEmpowerments: s3().echoedFaultEmpowerments.filter(
            (row) => !targetIds.includes(row.targetId),
          ),
        });
      }
    }
    const retargeted = retargetPortions(resolving.targetAndDamageMap, hostileIntents, jammed);
    const power = Math.floor(effectiveTracePower(resolving) * (echoedMul > 1 && resolving.payloadKind === 'FLAT_OCCULT' ? echoedMul : 1));
    const lineage = delayedLineage([
      trace.traceId,
      trace.originRootActionId ?? 'none',
      ...(trace.provenance === 'CONVERGENCE' ? [CONVERGENCE_IDS.SECOND_OUTCOME] : []),
    ]);
    if (ownedHasKind('SECOND_OUTCOME') && trace.provenance === 'CORE' && !cv().secondOutcomeStoreUsedThisCombatCycle) {
      const stored = storeReversal(cf(), 8);
      setCf(stored.cf);
      setCv({ ...cv(), secondOutcomeStoreUsedThisCombatCycle: true });
    }
    if (trace.payloadKind === 'PER_TARGET_DAMAGE' || trace.payloadKind === 'OCCULT_ACTION_BUDGET') {
      for (const portion of retargeted) {
        const amount = portion.fizzled ? 0 : roundTrace(
          (trace.delayCount > 0 && trace.payloadKind === 'PER_TARGET_DAMAGE'
            ? portion.nativeDirectDamage * 1.5
            : portion.nativeDirectDamage) * echoedMul,
        );
        if (amount <= 0 || !portion.assignedTargetId) {
          emit({
            type: 'DERIVATIVE_RESOLVED',
            sourceId: trace.originDefinitionId,
            lineage,
            rootActionId: hostRoot?.rootActionId ?? trace.originRootActionId,
            targetId: portion.assignedTargetId,
            payload: { damage: 0, delayedOrigin: true, fizzled: true, classification: 'DERIVATIVE' },
          });
          continue;
        }
        const target = hostileIntents.find((row) => row.unitId === portion.assignedTargetId);
        emit({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: trace.originDefinitionId,
          lineage,
          rootActionId: hostRoot?.rootActionId ?? trace.originRootActionId,
          targetId: portion.assignedTargetId,
          payload: {
            damage: amount,
            delayedOrigin: true,
            classification: 'DERIVATIVE',
            kinetic: portion.kineticNativeDamage,
            occult: portion.occultNativeDamage,
          },
        });
        if (target && amount >= target.hp && target.alive) {
          const bound = cf().fateboundUnitId === target.unitId;
          hostileIntents = hostileIntents.map((row) => (
            row.unitId === target.unitId ? { ...row, hp: 0, alive: false } : row
          ));
          restoredOutcome = true;
          if (bound && !holdFateboundRelease) {
            const released = releaseFatebound(cf(), hostileIntents, 'PLAYER_PREVENTED', lineage, {
              ownsNoFuture: ownedHasKind('NO_FUTURE_CHAIN'),
            });
            setCf(released.cf);
            if (released.release.countered) restoredOutcome = true;
            emitRelease(released.release, hostRoot);
          }
        }
      }
    } else if (trace.payloadKind === 'FLAT_OCCULT') {
      const primary = hostRoot?.lockedTargetIds[0]
        ?? hostRoot?.nativeByTarget.find((row) => row.nativeDirectDamage > 0 || row.hits > 0)?.targetId
        ?? legalHostileFallback(hostileIntents, jammed)?.unitId
        ?? null;
      if (!primary) {
        emit({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: trace.originDefinitionId,
          lineage,
          rootActionId: hostRoot?.rootActionId ?? null,
          targetId: null,
          payload: { damage: 0, delayedOrigin: true, fizzled: true, classification: 'DERIVATIVE' },
        });
      } else {
        emit({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: trace.originDefinitionId,
          lineage,
          rootActionId: hostRoot?.rootActionId ?? null,
          targetId: primary,
          payload: { damage: power, delayedOrigin: true, classification: 'DERIVATIVE', channel: 'OCCULT' },
        });
        const target = hostileIntents.find((row) => row.unitId === primary);
        if (target && power >= target.hp && target.alive) {
          const bound = cf().fateboundUnitId === target.unitId;
          hostileIntents = hostileIntents.map((row) => (
            row.unitId === target.unitId ? { ...row, hp: 0, alive: false } : row
          ));
          restoredOutcome = true;
          if (bound && !holdFateboundRelease) {
            const released = releaseFatebound(cf(), hostileIntents, 'PLAYER_PREVENTED', lineage, {
              ownsNoFuture: ownedHasKind('NO_FUTURE_CHAIN'),
            });
            setCf(released.cf);
            if (released.release.countered) restoredOutcome = true;
            emitRelease(released.release, hostRoot);
          }
        }
      }
    } else if (trace.payloadKind === 'BARRIER') {
      emit({
        type: 'DERIVATIVE_RESOLVED',
        sourceId: trace.originDefinitionId,
        lineage,
        rootActionId: trace.originRootActionId,
        targetId: 'runner',
        payload: { barrier: power, delayedOrigin: true, classification: 'DERIVATIVE' },
      });
    } else if (trace.payloadKind === 'RESERVE_RESTORE' || trace.payloadKind === 'FLUX_RESTORE') {
      const cap = trace.payloadKind === 'FLUX_RESTORE' ? ai().capacity.flux : ai().capacity.reserve;
      const restored = Math.min(power, cap);
      emit({
        type: 'DERIVATIVE_RESOLVED',
        sourceId: trace.originDefinitionId,
        lineage,
        rootActionId: trace.originRootActionId,
        targetId: null,
        payload: {
          restored,
          delayedOrigin: true,
          delayedRestore: true,
          kind: 'PRESERVED',
          classification: 'DERIVATIVE',
        },
      });
    } else if (trace.payloadKind === 'MATCHING_AMMO') {
      const restored = ai().capacity.ammo > 0 ? 1 : 0;
      if (restored > 0) {
        setAi({ ...ai(), capacity: { ...ai().capacity, ammo: ai().capacity.ammo - 1 } });
      }
      emit({
        type: 'DERIVATIVE_RESOLVED',
        sourceId: trace.originDefinitionId,
        lineage,
        rootActionId: trace.originRootActionId,
        targetId: null,
        payload: {
          restored,
          ammoType: trace.ammoType,
          delayedOrigin: true,
          delayedRestore: true,
          classification: 'DERIVATIVE',
        },
      });
    }
    setAi(markTraceResolved(ai(), trace.traceId));
    if (trace.provenance === 'CORE') {
      applySuspendedEchoRestore(trace, restoredOutcome);
      applyGhostThreadResolution(trace);
      if (ownedHasKind('ECHOED_FAULT') && hostRoot) {
        const targetIds = retargeted
          .map((row) => row.assignedTargetId)
          .filter((id): id is string => Boolean(id));
        const echoed = applyEchoedFaultAfterTrace(
          s3(),
          fl(),
          hostileIntents,
          hostRoot,
          cf().combatDepth,
          targetIds,
          trace.traceId,
        );
        setS3(echoed.cv);
        setFl(echoed.fl);
        hostileIntents = echoed.intents;
        dispatchFaultEffects(echoed.additions, echoed.ruptures, hostRoot);
      }
      if (ownedHasKind('PHANTOM_PAIN')) {
        const phantom = resolvePhantomPain(s3(), sw(), trace.traceId, injectImmediateResidualWake);
        setS3(phantom.cv);
        setSw(phantom.sw);
      }
    }
    if (ownedHasKind('ECHOED_RITE') && trace.provenance === 'CORE' && !cv().echoedMeasureUsedThisPlayerTurn) {
      setRc(advanceMeasureWithoutFinale(rc()));
      setCv({ ...cv(), echoedMeasureUsedThisPlayerTurn: true });
    }
    noteOrdinaryTraceResolved(trace);
  }

  function roundTrace(value: number): number {
    return value > 0 ? Math.floor(value) : 0;
  }

  function resolveDueTurnStartTraces(): void {
    const due = dueTurnStartTraces(ai());
    for (const trace of due) {
      resolveOneTrace(trace, null);
    }
    setAi(markActionTracesReady(ai()));
  }

  function mintOrdinaryFromRoot(ctx: CanonicalRootActionContext, provenance: TraceProvenance, multiplier: number): boolean {
    let composed = multiplier;
    const targetIds = ctx.nativeByTarget.map((row) => row.targetId);
    if (ownedHasKind('ECHOED_FAULT') && provenance === 'CORE') {
      const faultMul = echoedFaultTraceMultiplier(s3(), targetIds, '');
      if (faultMul > 1) {
        composed *= faultMul;
        setS3({
          ...s3(),
          echoedFaultEmpowerments: s3().echoedFaultEmpowerments.filter(
            (row) => !targetIds.includes(row.targetId),
          ),
        });
      }
    }
    const applyPhantom = ownedHasKind('PHANTOM_PAIN')
      && provenance === 'CORE'
      && Boolean(ctx.wakePowered)
      && !s3().phantomPainMintUsedThisPlayerTurn;
    if (applyPhantom) composed *= 1.5;
    const beforeSeq = ai().nextTraceSequence;
    let created = false;
    if (ownedHasKind('TRACE_PHANTOM_IMPACT') && (ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC')) {
      const result = tryMintPhantom(ai(), ctx, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, provenance, composed);
      setAi(result.state);
      created = created || result.created;
    }
    if (ownedHasKind('TRACE_LINGERING_INVOCATION') && (ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX')) {
      const result = tryMintLingering(ai(), ctx, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, provenance, composed);
      setAi(result.state);
      created = created || result.created;
    }
    if (ownedHasKind('TRACE_RECURRENT_CHARGE') && ctx.primaryResource.gained > 0) {
      const result = tryMintRecurrent(ai(), {
        classId: ctx.classId,
        actualGained: ctx.primaryResource.gained,
        reloadRestoredCount: 0,
        selectedAmmoType: ctx.selectedAmmoType ?? null,
        ultimateOwnedRefill: ctx.ultimateOwnedRefill,
        delayedRestore: false,
        definitionId: AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE,
        provenance,
        powerMultiplier: composed,
        originRootActionId: ctx.rootActionId,
      });
      setAi(result.state);
      created = created || result.created;
    }
    if (applyPhantom && created) {
      const first = ai().pending
        .filter((row) => (
          row.provenance === 'CORE'
          && row.originImprint !== 'VERDICT'
          && row.originRootActionId === ctx.rootActionId
          && row.creationSequence >= beforeSeq
        ))
        .sort((a, b) => a.creationSequence - b.creationSequence)[0];
      if (first) {
        const noted = notePhantomPainMint(s3(), first.traceId, {
          wakeValueAtCommit: ctx.wakeValueAtCommit ?? sw().activeWake,
          wakeGenerationId: ctx.wakeGenerationId ?? sw().generationId,
          sourceRootId: ctx.rootActionId,
        });
        setS3(noted.cv);
      }
    }
    return created;
  }

  function mintCrossfadeFromRoot(ctx: CanonicalRootActionContext, originImprint: Exclude<ScheduledTrace['originImprint'], 'VERDICT'>): void {
    if (!ownedHasKind('CROSSFADE') || ai().crossfadeUsedThisPlayerTurn) return;
    const surface = classifyQualifyingSurface({
      actionSurface: ctx.actionSurface,
      sourceKind: ctx.sourceKind,
      classification: ctx.classification,
      grandCadenceOwned: false,
      measure: 'EMPTY',
    });
    const trySurface = (imprint: typeof originImprint) => {
      if (imprint === originImprint) return false;
      if (imprint === 'ARMAMENT') {
        const result = tryMintPhantom(ai(), ctx, AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT, 'CROSSFADE_BONUS', 0.5);
        setAi(result.state);
        return result.created;
      }
      if (imprint === 'DISCIPLINE') {
        const result = tryMintLingering(ai(), ctx, AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION, 'CROSSFADE_BONUS', 0.5);
        setAi(result.state);
        return result.created;
      }
      if (imprint === 'CURRENT' && ctx.primaryResource.gained > 0) {
        const result = tryMintRecurrent(ai(), {
          classId: ctx.classId,
          actualGained: ctx.primaryResource.gained,
          reloadRestoredCount: 0,
          selectedAmmoType: ctx.selectedAmmoType ?? null,
          ultimateOwnedRefill: ctx.ultimateOwnedRefill,
          delayedRestore: false,
          definitionId: AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE,
          provenance: 'CROSSFADE_BONUS',
          powerMultiplier: 0.5,
          originRootActionId: ctx.rootActionId,
        });
        setAi(result.state);
        return result.created;
      }
      return false;
    };
    const primary: typeof originImprint | null = surface === 'ARMAMENT' || surface === 'DISCIPLINE' || surface === 'INSTINCT'
      ? surface
      : null;
    if (primary && trySurface(primary)) {
      setAi(consumeCrossfade(ai()));
      return;
    }
    if (trySurface('CURRENT')) {
      setAi(consumeCrossfade(ai()));
    }
  }

  /**
   * Emits normalized POLARITY_CHANGED / POSITION_CHANGED / UNMOORED_CHANGED / DISPLACEMENT_CHANGED
   * events with stable lineage for every Gravemark record produced by one processing call. Uses
   * emit() (not dispatch()) so these never re-enter runOwned and cannot feed other Strains —
   * Gravemark outcomes must not store Reversal, create Traces, advance Measure, etc.
   */
  function emitGravemarkRecords(
    result: { polarityEvents: readonly import('../../types/gravemark').GravemarkPolarityRecord[]; displacementEvents: readonly import('../../types/gravemark').GravemarkDisplacementRecord[] },
    ctx: CanonicalRootActionContext | null,
  ): void {
    for (const record of result.polarityEvents) {
      emit({
        type: 'POLARITY_CHANGED',
        sourceId: record.sourceDefinitionId,
        lineage: ctx ? [ctx.rootActionId, record.sourceDefinitionId] : [record.sourceDefinitionId],
        rootActionId: ctx?.rootActionId ?? null,
        targetId: record.targetId,
        payload: { previous: record.previous ?? 'NONE', next: record.next, changed: record.changed },
      });
    }
    for (const record of result.displacementEvents) {
      emit({
        type: 'DISPLACEMENT_CHANGED',
        sourceId: record.sourceDefinitionId,
        lineage: ctx ? [ctx.rootActionId, record.sourceDefinitionId] : [record.sourceDefinitionId],
        rootActionId: ctx?.rootActionId ?? null,
        targetId: record.triggerUnitId,
        payload: {
          kind: record.kind,
          bonus: record.bonus,
          fromSlot: record.fromSlot ?? 'NONE',
          toSlot: record.toSlot ?? 'NONE',
          passengerUnitId: record.passengerUnitId ?? 'NONE',
        },
      });
      if (record.fromSlot && record.toSlot && record.fromSlot !== record.toSlot) {
        emit({
          type: 'POSITION_CHANGED',
          sourceId: record.sourceDefinitionId,
          lineage: ctx ? [ctx.rootActionId, record.sourceDefinitionId] : [record.sourceDefinitionId],
          rootActionId: ctx?.rootActionId ?? null,
          targetId: record.triggerUnitId,
          payload: { fromSlot: record.fromSlot, toSlot: record.toSlot },
        });
      }
      if (record.kind !== 'IMMOVABLE' || record.fizzleReason === null) {
        emit({
          type: 'UNMOORED_CHANGED',
          sourceId: record.sourceDefinitionId,
          lineage: ctx ? [ctx.rootActionId, record.sourceDefinitionId] : [record.sourceDefinitionId],
          rootActionId: ctx?.rootActionId ?? null,
          targetId: record.triggerUnitId,
          payload: { unmoored: true },
        });
      }
    }
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
    if (ownedHasKind('FATED_REFRAIN') && isCanonicalPlayerCounteredRelease(release) && !cv().fatedRefrainBeatIiUsedThisCombatCycle) {
      setCv({ ...cv(), pendingBeatII: true, fatedRefrainBeatIiUsedThisCombatCycle: true });
    }
    if (
      ownedHasKind('SECOND_OUTCOME')
      && release.packet > 0
      && !release.lineage.includes(CONVERGENCE_IDS.SECOND_OUTCOME)
    ) {
      const minted = tryMintConvergenceReleaseTrace(ai(), {
        definitionId: CONVERGENCE_IDS.SECOND_OUTCOME,
        packet: release.packet,
        originalTargetId: release.targetUnitId,
        originRootActionId: ctx?.rootActionId ?? null,
      });
      setAi(minted.state);
    }
    applyStayedSentenceInstinct(release, ctx);
    applyEntangledFateMirror(release);
    if (ownedHasKind('BROKEN_OUTCOME') && ctx) {
      const broken = applyBrokenOutcomeOnRelease(s3(), fl(), hostileIntents, release, ctx, cf().combatDepth);
      setS3(broken.cv);
      setFl(broken.fl);
      hostileIntents = broken.intents;
      dispatchFaultEffects(
        broken.addition ? [broken.addition] : [],
        broken.rupture ? [broken.rupture] : [],
        ctx,
      );
    }
    if (ownedHasKind('FATE_OUT_OF_PLACE')) {
      const bonus = applyFateOutOfPlaceReleaseBonus({
        cv: s4(), gm: gm(), intents: hostileIntents, release,
        rootActionId: ctx?.rootActionId ?? null,
        sourceEventId: `${ctx?.rootActionId ?? 'release'}:${CONVERGENCE_IDS.FATE_OUT_OF_PLACE}:${release.targetInstanceId ?? 'none'}`,
        procDepth: ctx?.procDepth ?? 0,
        collisionCourseOwned: ownedDefinitionIds().includes('GM_SUPPORT_COLLISION_COURSE'),
        depth: cf().combatDepth,
      });
      setS4(bonus.cv);
      applySector4DisplacementOutcome(bonus, ctx);
    }
  }

  function applyStayedSentenceInstinct(release: ReversalReleaseResult, ctx: CanonicalRootActionContext | null): void {
    if (!ownedHasKind('STAYED_SENTENCE')) return;
    if (cv().stayedSentenceInstinctUsedThisEnemyCycle) return;
    if (!isCanonicalPlayerCounteredRelease(release)) return;
    if (ctx?.classId === 'HEX_SHOT' && ctx.actionSurface === 'INSTINCT' && ctx.intentCountered !== true) return;
    if (sp().focusedRoot?.chargeSource === 'STAYED_SENTENCE_FREE') return;
    setSp({ ...sp(), stayedSentenceFreeFocus: true });
    setCv({ ...cv(), stayedSentenceInstinctUsedThisEnemyCycle: true });
  }

  function applyEntangledFateMirror(release: ReversalReleaseResult): void {
    if (!ownedHasKind('ENTANGLED_FATE')) return;
    if (release.packet <= 0) return;
    if (release.lineage.includes(CONVERGENCE_IDS.ENTANGLED_FATE)) return;
    const current = ww();
    if (!hasPrimaryPair(current)) return;
    const source = release.targetUnitId;
    if (!source || !isPrimaryEndpoint(current, source)) return;
    const partner = current.selfLink ? source : (current.endpointA === source ? current.endpointB : current.endpointA);
    if (!partner || (!current.selfLink && partner === source)) return;
    const live = hostileIntents.find((row) => row.unitId === partner);
    if (!live || !live.alive || live.phased || live.invulnerable) return;
    let amount = roundCounterfateAmount(release.packet * 0.3);
    if (current.selfLink) amount = roundCounterfateAmount(amount * SELF_LINK_STRENGTH);
    if (amount <= 0) return;
    hostileIntents = hostileIntents.map((row) => (
      row.unitId === partner
        ? { ...row, hp: Math.max(0, row.hp - amount), alive: row.hp - amount > 0 && row.alive }
        : row
    ));
    emit({
      type: 'DERIVATIVE_RESOLVED',
      sourceId: CONVERGENCE_IDS.ENTANGLED_FATE,
      lineage: [...release.lineage, CONVERGENCE_IDS.ENTANGLED_FATE],
      rootActionId: lastRootContext?.rootActionId ?? null,
      targetId: partner,
      payload: {
        damage: amount,
        occult: amount,
        classification: 'DERIVATIVE',
        channel: 'OCCULT',
        convergence: CONVERGENCE_IDS.ENTANGLED_FATE,
      },
    });
  }

  function tryGrantFleeting(
    sourceDefinitionId: string,
    extra: {
      blocked?: boolean;
      phase?: import('../../types/stillpoint').FleetingCreationPhase;
      sourceRootId?: string | null;
    } = {},
  ): boolean {
    if (extra.blocked) return false;
    const result = mintFleetingStillness(sp(), sourceDefinitionId, extra);
    setSp(result.state);
    return result.granted || result.refreshed;
  }

  function applyStayedSentenceNativeGain(): void {
    if (!ownedHasKind('STAYED_SENTENCE')) return;
    if (cv().stayedSentenceNativeUsedThisCombatCycle) return;
    const stored = storeReversal(cf(), 10);
    setCf(stored.cf);
    setCv({ ...cv(), stayedSentenceNativeUsedThisCombatCycle: true });
  }

  function applyMeasuredSilenceAdvance(): void {
    if (!ownedHasKind('MEASURED_SILENCE')) return;
    if (cv().measuredSilenceAdvanceUsedThisPlayerTurn) return;
    if (!hasLiveRitual()) return;
    setRc(advanceMeasureWithoutFinale(rc()));
    setCv({ ...cv(), measuredSilenceAdvanceUsedThisPlayerTurn: true });
  }

  function applyMeasuredSilenceRetain(ctx: CanonicalRootActionContext): void {
    if (!ownedHasKind('MEASURED_SILENCE')) return;
    if (cv().measuredSilenceRetainUsedThisPlayerTurn) return;
    const focused = sp().focusedRoot;
    const source = focused?.rootActionId === ctx.rootActionId
      ? focused?.chargeSource
      : sp().lastSpendSource;
    setCv({ ...cv(), measuredSilenceRetainUsedThisPlayerTurn: true });
    if (source !== 'NATIVE') return;
    tryGrantFleeting(CONVERGENCE_IDS.MEASURED_SILENCE, {
      phase: 'PLAYER_CONTROL',
      sourceRootId: ctx.rootActionId,
    });
  }

  function applyTwofoldFormation(): void {
    if (!ownedHasKind('TWOFOLD_RITE')) return;
    if (cv().twofoldFormationUsedThisPlayerTurn) return;
    if (!ww().lastTwofoldFormation) return;
    if (rc().pendingFinaleRootId) return;
    setRc(advanceMeasureWithoutFinale(rc()));
    setCv({ ...cv(), twofoldFormationUsedThisPlayerTurn: true });
  }

  function applyTwofoldFinaleArm(ctx: CanonicalRootActionContext): void {
    if (!ownedHasKind('TWOFOLD_RITE')) return;
    const affected = ctx.directlyAffectedTargetIds ?? directlyAffectedTargetIds(ctx);
    const hit = affected.some((id) => isLinkedWoundweaveEndpoint(ww(), id));
    if (!hit) return;
    setCv({
      ...cv(),
      twofoldEmpowerment: { sourceFinaleRootId: ctx.rootActionId, armed: true },
    });
  }

  function applySuspendedEchoAndGhostCapture(ctx: CanonicalRootActionContext, beforeSeq: number): void {
    const created = ai().pending
      .filter((row) => (
        row.provenance === 'CORE'
        && row.originImprint !== 'VERDICT'
        && row.originRootActionId === ctx.rootActionId
        && row.creationSequence >= beforeSeq
      ))
      .sort((a, b) => a.creationSequence - b.creationSequence);
    if (ownedHasKind('SUSPENDED_ECHO') && !cv().suspendedEchoUsedThisCombatCycle) {
      const focused = sp().focusedRoot;
      const first = created.find((row) => (
        row.payloadKind === 'PER_TARGET_DAMAGE'
        || row.payloadKind === 'OCCULT_ACTION_BUDGET'
        || row.payloadKind === 'FLAT_OCCULT'
      ));
      if (focused?.rootActionId === ctx.rootActionId && first) {
        const scaled = {
          ...first,
          basePayload: roundCounterfateAmount(first.basePayload * 1.5),
          targetAndDamageMap: first.targetAndDamageMap.map((portion) => ({
            ...portion,
            nativeDirectDamage: roundCounterfateAmount(portion.nativeDirectDamage * 1.5),
            kineticNativeDamage: roundCounterfateAmount(portion.kineticNativeDamage * 1.5),
            occultNativeDamage: roundCounterfateAmount(portion.occultNativeDamage * 1.5),
          })),
        };
        setAi({
          ...ai(),
          pending: ai().pending.map((row) => (row.traceId === first.traceId ? scaled : row)),
        });
        setCv({
          ...cv(),
          suspendedEchoUsedThisCombatCycle: true,
          suspendedEchoLineages: [
            ...cv().suspendedEchoLineages,
            {
              traceId: first.traceId,
              sourceCycle: sp().combatCycleIndex,
              chargeSource: focused.chargeSource,
              restored: false,
            },
          ],
        });
      }
    }
    if (!ownedHasKind('GHOST_THREAD') || cv().ghostThreadUsedThisPlayerTurn) return;
    if (!hasPrimaryPair(ww())) return;
    const firstHostile = created.find((row) => (
      row.payloadKind === 'PER_TARGET_DAMAGE' || row.payloadKind === 'OCCULT_ACTION_BUDGET' || row.payloadKind === 'FLAT_OCCULT'
    ));
    if (!firstHostile) return;
    const current = ww();
    const portions = firstHostile.targetAndDamageMap.flatMap((portion) => {
      const origin = portion.originalTargetId;
      if (current.selfLink) {
        if (!isPrimaryEndpoint(current, origin)) return [];
        return [{ originalTargetId: origin, partnerId: origin, amount: portion.nativeDirectDamage }];
      }
      const partner = origin === current.endpointA ? current.endpointB : origin === current.endpointB ? current.endpointA : null;
      if (!partner) return [];
      return [{ originalTargetId: origin, partnerId: partner, amount: portion.nativeDirectDamage }];
    });
    if (portions.length === 0) return;
    setCv({
      ...cv(),
      ghostThreadUsedThisPlayerTurn: true,
      ghostThreadCapture: {
        traceId: firstHostile.traceId,
        linkGeneration: current.linkGeneration,
        endpointA: current.endpointA,
        endpointB: current.endpointB,
        selfLink: current.selfLink,
        portions,
      },
    });
  }

  function applySuspendedEchoRestore(trace: ScheduledTrace, restoredOutcome: boolean): void {
    if (!restoredOutcome) return;
    const lineage = cv().suspendedEchoLineages.find((row) => row.traceId === trace.traceId);
    if (!lineage || lineage.restored) return;
    setCv({
      ...cv(),
      suspendedEchoLineages: cv().suspendedEchoLineages.map((row) => (
        row.traceId === trace.traceId ? { ...row, restored: true } : row
      )),
    });
    if (lineage.chargeSource !== 'NATIVE') return;
    tryGrantFleeting(CONVERGENCE_IDS.SUSPENDED_ECHO, {
      phase: sp().playerTurnOpen ? 'PLAYER_CONTROL' : 'ENEMY_CYCLE',
      sourceRootId: trace.originRootActionId,
    });
  }

  function applyGhostThreadResolution(trace: ScheduledTrace): void {
    const capture = cv().ghostThreadCapture;
    if (!ownedHasKind('GHOST_THREAD') || !capture || capture.traceId !== trace.traceId) return;
    const seen = new Set<string>();
    for (const portion of capture.portions) {
      if (capture.selfLink && seen.has(portion.partnerId)) continue;
      seen.add(portion.partnerId);
      const partner = hostileIntents.find((row) => row.unitId === portion.partnerId);
      if (!partner || !partner.alive || partner.phased) continue;
      const amount = roundCounterfateAmount((
        trace.targetAndDamageMap.find((row) => row.originalTargetId === portion.originalTargetId)?.nativeDirectDamage
        ?? portion.amount
      ) * 0.4);
      if (amount <= 0) continue;
      hostileIntents = hostileIntents.map((row) => (
        row.unitId === partner.unitId
          ? { ...row, hp: Math.max(0, row.hp - amount), alive: row.hp - amount > 0 && row.alive }
          : row
      ));
      emit({
        type: 'DERIVATIVE_RESOLVED',
        sourceId: CONVERGENCE_IDS.GHOST_THREAD,
        lineage: [trace.originRootActionId ?? 'none', CONVERGENCE_IDS.GHOST_THREAD],
        rootActionId: trace.originRootActionId,
        targetId: partner.unitId,
        payload: {
          damage: amount,
          occult: amount,
          classification: 'DERIVATIVE',
          channel: 'OCCULT',
          convergence: CONVERGENCE_IDS.GHOST_THREAD,
        },
      });
    }
    const aLive = capture.endpointA && hostileIntents.some((row) => row.unitId === capture.endpointA && row.alive && !row.phased);
    const bLive = capture.endpointB && hostileIntents.some((row) => row.unitId === capture.endpointB && row.alive && !row.phased);
    if (capture.selfLink) {
      setWw(reformWoundlinkPair(
        ww(),
        ownedDefinitionIds(),
        hostileIntents,
        aLive ? capture.endpointA : null,
        null,
        Boolean(aLive),
      ));
    } else {
      setWw(reformWoundlinkPair(
        ww(),
        ownedDefinitionIds(),
        hostileIntents,
        aLive ? capture.endpointA : (bLive ? capture.endpointB : null),
        aLive && bLive ? capture.endpointB : null,
        false,
      ));
    }
    applyTwofoldFormation();
    setCv({ ...cv(), ghostThreadCapture: null });
  }

  function applyDrawnTensionFleeting(
    ctx: CanonicalRootActionContext,
    before: readonly import('../../types/counterfate').HostileIntentSnapshot[],
    after: readonly import('../../types/counterfate').HostileIntentSnapshot[],
    linkedBefore: ReadonlySet<string>,
  ): void {
    if (!ownedHasKind('DRAWN_TENSION')) return;
    if (cv().drawnTensionFleetingUsedThisPlayerTurn) return;
    if (stillnessProducerBlocked(sp().focusedRoot?.rootActionId === ctx.rootActionId ? sp().focusedRoot?.chargeSource : null)) return;
    const linked = new Set([
      ...linkedBefore,
      ww().endpointA,
      ww().endpointB,
      ...ww().secondaryEndpointIds,
    ].filter((id): id is string => Boolean(id)));
    const triggered = [...linked].some((id) => {
      const prev = before.find((row) => row.unitId === id);
      const next = after.find((row) => row.unitId === id);
      const native = ctx.nativeByTarget.find((row) => row.targetId === id);
      const died = Boolean(prev?.alive) && next && !next.alive;
      const broke = (native?.defenseBreaks ?? 0) > 0;
      return died || broke;
    });
    if (!triggered) return;
    setCv({ ...cv(), drawnTensionFleetingUsedThisPlayerTurn: true });
    tryGrantFleeting(CONVERGENCE_IDS.DRAWN_TENSION, {
      phase: sp().playerTurnOpen ? 'PLAYER_CONTROL' : 'ENEMY_CYCLE',
      sourceRootId: ctx.rootActionId,
    });
  }

  function applyEntangledFateStore(ctx: CanonicalRootActionContext): void {
    if (!ownedHasKind('ENTANGLED_FATE')) return;
    if (cv().entangledFateStoredRootId === ctx.rootActionId) return;
    if (!hasPrimaryPair(ww())) return;
    const current = ww();
    const ids = current.selfLink
      ? [current.endpointA]
      : [current.endpointA, current.endpointB];
    let total = 0;
    for (const id of ids) {
      if (!id) continue;
      const native = ctx.nativeByTarget.find((row) => row.targetId === id)?.nativeDirectDamage ?? 0;
      if (native > 0) total += 6;
    }
    if (total <= 0) return;
    const stored = storeReversal(cf(), total);
    setCf(stored.cf);
    setCv({ ...cv(), entangledFateStoredRootId: ctx.rootActionId });
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
      // Shard-to-Edge conversion runs at the very start, before Wake activation, Fatebound
      // selection, Deferred Exposure, or Trace resolution.
      setSs(beginShardskinPlayerTurn({ state: ss(), ownedIds: ownedDefinitionIds(), depth: cf().combatDepth }));
      // Stillglass: Shard->Edge conversion above runs first, then the pending Fleeting (armed by
      // absorption last enemy cycle) is created here, before Wake activation/Fatebound/Traces.
      if (ownedHasKind('STILLGLASS')) {
        const pending = consumeStillglassPendingFleeting(s4());
        setS4(pending.cv);
        if (pending.shouldCreate) {
          const granted = mintFleetingStillness(sp(), CONVERGENCE_IDS.STILLGLASS, {
            phase: 'PLAYER_TURN_INIT',
            sourceLineage: [CONVERGENCE_IDS.STILLGLASS],
          });
          setSp(granted.state);
        }
      }
      setWw(beginWoundweavePlayerTurn(ww()));
      setFl(beginFaultlinePlayerTurn(fl()));
      // Unmoored must expire before Wake activation, Fatebound selection, Deferred Exposure, or Trace resolution.
      setGm(beginGravemarkPlayerTurn(gm()));
      setSw(beginSoulwakePlayerTurn(sw()));
      if (hasLiveSoulwake()) {
        const before = sw();
        setSw(activateRecordedWake(sw(), ownedDefinitionIds()));
        if (sw().activeWake > 0 && sw().recordedWake === 0 && before.recordedWake > 0) {
          dispatch({
            type: 'WAKE_ACTIVATED',
            sourceId: 'soulwake',
            lineage: [],
            rootActionId: null,
            targetId: null,
            payload: { wake: sw().activeWake, kind: sw().activeWakeKind },
          });
        }
      }
      if (hasLiveRitual()) {
        setRc(resetCombatCycleRitualCadence(resetPlayerTurnRitualCadence(rc())));
      }
      setCv(resetConvergencePlayerTurn(resetConvergenceCombatCycle(cv())));
      if (hasLiveRitual() && cv().pendingBeatII) {
        setRc(applyScheduledBeatII(rc()));
        setCv({ ...cv(), pendingBeatII: false });
      }
      if (hasLiveAfterimage()) {
        setAi(beginPlayerTurn(ai()));
      }
      if (hasLiveStillpoint()) {
        setSp(beginStillpointPlayerTurn(sp(), ownedDefinitionIds()));
        const refunded = applyQueuedTurnStartRefund(sp());
        setSp(refunded.state);
        if (refunded.refund > 0) {
          state.metrics.ap_refund = (state.metrics.ap_refund ?? 0) + refunded.refund;
        }
      }
    }
    if (full.type === 'PLAYER_TURN_ENDED') {
      if (hasLiveAfterimage()) setAi(expireUnusedCrossfade(ai()));
      expireEchoedIfDue();
      // Edge expires at PLAYER_TURN_ENDED if unused, whether the ending was voluntary or forced.
      setSs(expireShardskinEdgeAtPlayerTurnEnd(ss()));
    }
    if (full.type === 'ENEMY_CYCLE_STARTED') {
      resetWindow('ENEMY_CYCLE');
      setFl(beginFaultlineCombatCycle(fl()));
      setGm(beginGravemarkCombatCycle(gm()));
      setSs(beginShardskinCombatCycle(ss()));
      setSw(beginSoulwakeEnemyCycle(sw()));
      if (hasLiveAfterimage()) setAi(expireUnusedCrossfade(ai()));
      expireEchoedIfDue();
      const liveCounterfate = ownedDefinitionIds().some((id) => {
        const def = definitions.get(id);
        return def?.strainId === 'COUNTERFATE' && !def.testOnly;
      });
      if (liveCounterfate) setCf(resetEnemyCycleCounterfate(cf()));
      if (hasLiveStillpoint()) {
        setSp(beginStillpointEnemyCycle(sp()));
        hostileIntents = tickIntentCountdowns(hostileIntents, sp().zeroHourPause, sp().enemyCycleIndex);
      }
      setCv(resetConvergenceEnemyCycle(cv()));
    }
    if (full.type === 'ENEMY_CYCLE_ENDED') {
      if (hasLiveStillpoint()) setSp(endStillpointEnemyCycle(sp()));
      if (hasLiveSoulwake()) {
        const before = sw();
        setSw(expireSoulwakeAtEnemyCycleEnd(sw(), ownedDefinitionIds()));
        if (before.activeWakeKind === 'NORMAL' && sw().activeWakeKind === 'RESIDUAL') {
          dispatch({
            type: 'WAKE_RESIDUAL',
            sourceId: 'soulwake',
            lineage: [],
            rootActionId: null,
            targetId: null,
            payload: { wake: sw().activeWake },
          });
        }
      }
    }
    runOwned(full, ctx);
    return full;
  }

  /**
   * Applies every returned bonus-Displacement outcome's HP collisions and Gravemark record
   * emission exactly once — the shared tail every Sector 4 helper that calls attemptDisplacement
   * directly (bypassing processGravemarkRoot) must run through.
   */
  function applySector4DisplacementOutcome(
    outcome: { gm: import('../../types/gravemark').GravemarkRuntimeState; intents: HostileIntentSnapshot[]; displacement: import('../../types/gravemark').GravemarkDisplacementRecord | null; collisions: readonly import('../../types/gravemark').GravemarkCollisionRecord[] },
    ctx: CanonicalRootActionContext | null,
    collisionScale = 1,
  ): void {
    setGm(outcome.gm);
    const scaledCollisions = collisionScale === 1
      ? outcome.collisions
      : outcome.collisions.map((row) => ({ ...row, amount: Math.floor(row.amount * collisionScale) }));
    const applied = applySector4Collisions(outcome.intents, scaledCollisions);
    hostileIntents = applied.intents;
    if (outcome.displacement) {
      emitGravemarkRecords({ polarityEvents: [], displacementEvents: [outcome.displacement] }, ctx);
    }
    for (const row of scaledCollisions) {
      if (row.amount <= 0) continue;
      dispatch({
        type: 'DERIVATIVE_RESOLVED',
        sourceId: row.sourceDefinitionId,
        lineage: ctx ? [ctx.rootActionId, row.sourceDefinitionId] : [row.sourceDefinitionId],
        rootActionId: ctx?.rootActionId ?? null,
        targetId: row.targetId,
        payload: {
          damage: row.amount,
          kinetic: row.kinetic,
          occult: row.occult,
          classification: 'DERIVATIVE',
        },
      }, ctx ? { ...ctx, classification: 'DERIVATIVE', procDepth: Math.max(1, ctx.procDepth + 1) } : null);
    }
  }

  /**
   * Sector 4 observers keyed on completed Gravemark Displacement records for this root: Fate Out
   * of Place's 8-Reversal store, Tectonic Shift's 2-Fault (first normal Displacement/target/combat
   * cycle), Impact Lattice's 5-Shard generation (first non-self Displacement/combat cycle),
   * Parallax Echo's arm (first non-self Displacement/player turn), Turning Rite's Beat advance
   * (first trigger-owner Displacement/player turn, deferred if this root is also closing a
   * Finale), and Tethered Orbit's arm-on-displacement for a Woundlink endpoint's partner.
   */
  function applySector4GravemarkDisplacementObservers(
    prepared: CanonicalRootActionContext,
    displacementEvents: readonly import('../../types/gravemark').GravemarkDisplacementRecord[],
    rootIsFinale: boolean,
  ): void {
    for (const record of displacementEvents) {
      if (ownedHasKind('FATE_OUT_OF_PLACE')) {
        const translated = record.kind !== 'IMMOVABLE' || gm().lastBossTranslation?.targetId === record.triggerUnitId && gm().lastBossTranslation?.translated === true;
        const stored = applyFateOutOfPlaceStore(s4(), cf(), record, translated);
        setS4(stored.cv);
        setCf(stored.cf);
      }
      if (ownedHasKind('TECTONIC_SHIFT')) {
        const eligible = tectonicShiftFaultEligible(s4(), record);
        setS4(eligible.cv);
        if (eligible.eligible) {
          const applied = applyTectonicShiftFault(fl(), hostileIntents, prepared, record.triggerUnitId, cf().combatDepth);
          setFl(applied.fl);
          hostileIntents = applied.intents;
          dispatchFaultEffects([applied.addition], applied.rupture ? [applied.rupture] : [], prepared);
        }
      }
      if (ownedHasKind('IMPACT_LATTICE')) {
        const granted = applyImpactLatticeDisplacementShards(s4(), ss(), cf().combatDepth, record);
        setS4(granted.cv);
        setSs(granted.ss);
      }
      if (ownedHasKind('PARALLAX_ECHO')) {
        setS4(armParallaxEchoFromDisplacement(s4(), record));
      }
      if (ownedHasKind('TURNING_RITE') && record.fizzleReason == null && record.passengerUnitId !== record.triggerUnitId) {
        const advanced = applyTurningRiteAdvance(s4(), rc(), record, rootIsFinale);
        setS4(advanced.cv);
        setRc(advanced.rc);
      }
      if (ownedHasKind('TETHERED_ORBIT') && hasLiveWoundweave()) {
        const partner = woundweavePartnerOf(ww(), record.triggerUnitId);
        if (partner && isPrimaryEndpoint(ww(), record.triggerUnitId)) {
          const armed = armTetheredOrbitPartnerOnDisplacement(s4(), gm(), record, partner);
          setS4(armed.cv);
          setGm(armed.gm);
        }
      }
    }
  }

  /**
   * Sector 4 Displacement-producing observers that run independent of hasLiveGravemark() — the
   * Convergence itself grants access to the opposing half's bonus/forced movement even when no
   * other Gravemark Core is owned. Runs once per NATIVE_DIRECT root, after Gravemark's own root
   * pass so the normal-cap/Unmoored/Polarity state it reacts to is current.
   */
  function applySector4ForcedGravemarkMovements(prepared: CanonicalRootActionContext): void {
    const depth = cf().combatDepth;
    const collisionCourseOwned = ownedDefinitionIds().includes('GM_SUPPORT_COLLISION_COURSE');
    if (ownedHasKind('TRAUMA_VECTOR') && prepared.wakePowered) {
      const fallback = fallbackHostileForContext(prepared);
      const outcome = applyTraumaVectorForcedDisplacement({
        cv: s4(), gm: gm(), intents: hostileIntents, ctx: prepared,
        fallbackHostileId: fallback, collisionCourseOwned, depth,
      });
      setS4(outcome.cv);
      applySector4DisplacementOutcome(outcome, prepared);
    }
    if (ownedHasKind('STORED_VECTOR')) {
      const focused = sp().focusedRoot;
      if (focused?.rootActionId === prepared.rootActionId) {
        const outcome = applyStoredVectorBonusDisplacement({
          cv: s4(), gm: gm(), intents: hostileIntents, ctx: prepared, collisionCourseOwned, depth,
        });
        setS4(outcome.cv);
        applySector4DisplacementOutcome(outcome, prepared, 1.5);
      }
    }
    if (ownedHasKind('TETHERED_ORBIT')) {
      setS4(clearTetheredOrbitArmIfInvalid(s4(), hostileIntents));
      const outcome = applyTetheredOrbitArmedBonus({
        cv: s4(), gm: gm(), intents: hostileIntents, ctx: prepared, collisionCourseOwned, depth,
      });
      setS4(outcome.cv);
      applySector4DisplacementOutcome(outcome, prepared);
    }
  }

  /**
   * Shared "qualifying root outcome" gate for Stored Vector's Fleeting request and Trauma
   * Vector/Soulglass's Residual carry request: swap, kill, full KA/OW break, intent counter, or a
   * successful authored immovable translation this same root. Becoming Unmoored alone (a fizzled
   * or non-immovable Displacement) does not qualify.
   */
  function sector4RootOutcomeQualifies(ctx: CanonicalRootActionContext): boolean {
    const killed = ctx.nativeByTarget.some((row) => row.killed) || ctx.kills > 0;
    const fullBreak = ctx.nativeByTarget.some((row) => row.kineticArmorBroken === true || row.occultWardBroken === true);
    const countered = ctx.intentCountered === true;
    const swapped = gm().lastSwap?.rootActionId === ctx.rootActionId;
    const immovableTranslation = (
      gm().lastDisplacement?.rootActionId === ctx.rootActionId
      && gm().lastDisplacement?.kind === 'IMMOVABLE'
      && gm().lastDisplacement?.fizzleReason == null
    );
    return killed || fullBreak || countered || swapped || immovableTranslation;
  }

  function fallbackHostileForContext(ctx: CanonicalRootActionContext): string | null {
    const primary = ctx.lockedTargetIds[0];
    if (primary && legalGravemarkHostileLocal(primary)) return primary;
    const anyAlive = hostileIntents.find((row) => row.alive && !row.phased);
    return anyAlive?.unitId ?? null;
  }

  function legalGravemarkHostileLocal(unitId: string): boolean {
    const row = hostileIntents.find((intent) => intent.unitId === unitId);
    return Boolean(row && row.alive && !row.phased);
  }

  function routineImprintForContext(ctx: CanonicalRootActionContext): import('../../types/gravemark').GravemarkPolarityId | null {
    if (ctx.actionSurface === 'WEAPON' || ctx.actionSurface === 'BASIC') return 'ARMAMENT';
    if (ctx.actionSurface === 'TECHNIQUE' || ctx.actionSurface === 'FLEX') return 'DISCIPLINE';
    if (ctx.actionSurface === 'INSTINCT') return 'INSTINCT';
    return null;
  }

  /**
   * Sector 4 observers keyed on positive Edge consumption for a NATIVE_DIRECT root: Prismatic
   * Rite's deferred Beat arm, Phantom Facet's next-Trace-mint arm, Crystal Ligature's post-packet
   * mirror to a Woundlink partner, Faultglass's Fault application (before Edge/Scatterglass
   * packet event dispatch), Soulglass's Residual Wake request, and Impact Lattice's
   * Polarize-or-bonus-Displacement clause. Called once the primary Edge packet amount is known.
   */
  function applySector4EdgeConsumptionObservers(
    prepared: CanonicalRootActionContext,
    primaryTargetId: string | null,
    primaryPacketAmount: number,
  ): void {
    if (ownedHasKind('PRISMATIC_RITE')) {
      setS4(armPrismaticRiteDeferredBeat(s4()));
    }
    if (ownedHasKind('PHANTOM_FACET')) {
      setS4(armPhantomFacetFromEdge(s4(), prepared.rootActionId));
    }
    if (ownedHasKind('CRYSTAL_LIGATURE') && primaryTargetId && primaryPacketAmount > 0 && hasLiveWoundweave()) {
      if (isPrimaryEndpoint(ww(), primaryTargetId)) {
        setWw({ ...ww(), expiresAtPlayerTurnStart: Math.max(ww().expiresAtPlayerTurnStart, ww().playerTurnIndex + 2) });
        const partner = ww().selfLink ? primaryTargetId : woundweavePartnerOf(ww(), primaryTargetId);
        const mirror = crystalLigatureMirrorAmount(primaryPacketAmount, ww().selfLink);
        if (partner && mirror > 0 && legalGravemarkHostileLocal(partner)) {
          hostileIntents = hostileIntents.map((row) => (
            row.unitId === partner ? { ...row, hp: Math.max(0, row.hp - mirror), alive: row.hp - mirror > 0 && row.alive } : row
          ));
          dispatch({
            type: 'DERIVATIVE_RESOLVED',
            sourceId: CONVERGENCE_IDS.CRYSTAL_LIGATURE,
            lineage: [prepared.rootActionId, CONVERGENCE_IDS.CRYSTAL_LIGATURE],
            rootActionId: prepared.rootActionId,
            targetId: partner,
            payload: { damage: mirror, occult: mirror, classification: 'DERIVATIVE', channel: 'OCCULT' },
          }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth + 1) });
        }
      }
    }
    if (ownedHasKind('FAULTGLASS') && hasLiveFaultline()) {
      const applied = applyFaultglassEdgeFault(fl(), hostileIntents, prepared, primaryTargetId, cf().combatDepth);
      setFl(applied.fl);
      hostileIntents = applied.intents;
      dispatchFaultEffects(applied.additions, applied.ruptures, prepared);
    }
    if (ownedHasKind('SOULGLASS') && hasLiveSoulwake() && prepared.wakePowered) {
      const carry = applySoulglassResidualCarry(sw(), prepared.wakeValueAtCommit ?? sw().activeWake);
      setSw(carry.sw);
    }
    if (ownedHasKind('IMPACT_LATTICE')) {
      const outcome = applyImpactLatticeEdgeClause({
        gm: gm(),
        intents: hostileIntents,
        primaryTargetId,
        routineImprint: routineImprintForContext(prepared),
        rootActionId: prepared.rootActionId,
        procDepth: prepared.procDepth,
        collisionCourseOwned: ownedDefinitionIds().includes('GM_SUPPORT_COLLISION_COURSE'),
        depth: cf().combatDepth,
      });
      applySector4DisplacementOutcome(
        { gm: outcome.gm, intents: outcome.intents, displacement: outcome.displacement, collisions: outcome.collisions },
        prepared,
      );
    }
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
    if (hasLiveStillpoint() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const authored = prepared.authoredCosts.ap ?? prepared.actualCostsPaid.ap ?? 0;
      const discounted = previewPatientInvocationAp(authored, prepared, ownedDefinitionIds(), sp());
      if (discounted !== (prepared.actualCostsPaid.ap ?? authored)) {
        prepared = {
          ...prepared,
          actualCostsPaid: { ...prepared.actualCostsPaid, ap: discounted },
        };
      }
      if (prepared.sourceKind === 'ULTIMATE' || prepared.actionSurface === 'ULTIMATE') {
        const zero = applyZeroHour(sp(), ownedDefinitionIds(), hostileIntents, prepared.nativeByTarget);
        setSp(zero.state);
        if (zero.consumed > 0) {
          prepared = {
            ...prepared,
            nativeByTarget: zero.modified,
            totalNativeDirectDamage: zero.modified.reduce((sum, row) => sum + row.nativeDirectDamage, 0),
          };
          state.metrics.zero_hour_charges = zero.consumed;
          state.metrics.zero_hour_bonus_percent = roundTrace(zero.bonusPercent * 100);
        }
      }
    }
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
    if (hasLiveSoulwake() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const nativeHp = applyNativeHpCost(sw(), ownedDefinitionIds(), prepared);
      setSw(nativeHp.state);
      if (prepared.sourceKind === 'ULTIMATE' || prepared.actionSurface === 'ULTIMATE') {
        setSw(applyLastHeartbeatOverdraw(sw(), ownedDefinitionIds(), prepared));
      }
      prepared = snapshotWakePowered(sw(), prepared, nativeHp.paidQualifying);
    }
    lastRootContext = prepared;
    if (hasLiveStillpoint() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const surfaces = matchingStillpointSurfaces(prepared, ownedDefinitionIds(), false);
      if (surfaces.length > 0) {
        const focused = consumeFocusForRoot(sp(), prepared, ownedDefinitionIds(), false);
        setSp(focused.state);
      } else if (ownedHasKind('STILLPOINT_SILENT_RESERVOIR')) {
        setSp({ ...sp(), pendingCurrentFocusRootId: prepared.rootActionId });
      }
    }
    consumeHeldResonance(prepared);
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
    if (hasLiveFaultline() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      prepared = applyFaultlineResult(processFaultlineRoot({
        state: fl(),
        ctx: prepared,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        sourceEventId: prepared.rootActionId,
      }), prepared);
      applySector3PostFaultline(prepared, Boolean(preview?.finale));
    }
    if (hasLiveSoulwake() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      prepared = applySoulwakePackets(processSoulwakeRoot({
        state: sw(),
        ctx: prepared,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        depth: cf().combatDepth,
        skipPayment: true,
      }), prepared, SOULWAKE_CORE_IDS.HOLLOW_EDGE);
      if (prepared.sourceKind === 'ULTIMATE' || prepared.actionSurface === 'ULTIMATE') {
        prepared = applySoulwakePackets(resolveLastHeartbeatPackets({
          state: sw(),
          ctx: prepared,
          ownedIds: ownedDefinitionIds(),
          intents: hostileIntents,
        }), prepared, SOULWAKE_VERDICT_ID);
      }
      if (ownedHasKind('PAIN_FORETOLD') && prepared.wakePowered) {
        const stored = applyPainForetoldWakeStore(
          s3(),
          cf(),
          prepared.wakeValueAtCommit ?? sw().activeWake,
        );
        setS3(stored.cv);
        setCf(stored.cf);
      }
    }
    if (hasLiveStillpoint() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const focused = sp().focusedRoot;
      if (focused?.rootActionId === prepared.rootActionId && focused.surfaces.includes('ARMAMENT')) {
        const packet = condensedImpactFromRoot(prepared, cf().combatDepth);
        if (packet) {
          const resolved = resolveCondensedImpactTarget(packet, hostileIntents);
          setSp({ ...sp(), lastCondensedImpact: resolved.damage });
          state.metrics.condensed_impact = (state.metrics.condensed_impact ?? 0) + resolved.damage;
          if (!resolved.fizzled && resolved.damage > 0) {
            dispatch({
              type: 'DERIVATIVE_RESOLVED',
              sourceId: STILLPOINT_CORE_IDS.STORED_FORCE,
              lineage: [prepared.rootActionId, 'CONDENSED_IMPACT'],
              rootActionId: prepared.rootActionId,
              targetId: resolved.targetId,
              payload: {
                damage: resolved.damage,
                kinetic: resolved.kinetic,
                occult: resolved.occult,
                classification: 'DERIVATIVE',
              },
            }, { ...prepared, classification: 'DERIVATIVE', procDepth: 1 });
          }
          prepared = {
            ...prepared,
            nativeByTarget: prepared.nativeByTarget.map((row) => (
              row.targetId === resolved.targetId && !resolved.fizzled
                ? { ...row, killed: row.killed || resolved.damage >= (hostileIntents.find((intent) => intent.unitId === row.targetId)?.hp ?? 9999) }
                : row
            )),
          };
        }
      }
      if (focused?.rootActionId === prepared.rootActionId && focused.surfaces.includes('DISCIPLINE') && prepared.startsCooldown) {
        setSp({ ...sp(), lastCooldownAdvanced: true });
        state.metrics.stillpoint_cooldown_advance = (state.metrics.stillpoint_cooldown_advance ?? 0) + 1;
      }
      const condensedKilled = (sp().lastCondensedImpact ?? 0) > 0 && prepared.nativeByTarget.some((row) => row.killed);
      if (focused?.rootActionId === prepared.rootActionId && returnStrokeQualifies(prepared, condensedKilled)) {
        const refund = applyReturnStroke(sp(), ownedDefinitionIds(), sp().playerTurnOpen);
        setSp(refund.state);
        if (refund.refundNow > 0) state.metrics.ap_refund = (state.metrics.ap_refund ?? 0) + refund.refundNow;
        if (refund.queued > 0) state.metrics.ap_refund_queued = (state.metrics.ap_refund_queued ?? 0) + refund.queued;
      }
    }
    if (hasLiveWoundweave() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const withAffected = {
        ...prepared,
        directlyAffectedTargetIds: prepared.directlyAffectedTargetIds ?? directlyAffectedTargetIds(prepared),
      };
      const focused = sp().focusedRoot;
      const affected = withAffected.directlyAffectedTargetIds ?? [];
      const linkedHit = affected.some((id) => (
        isLinkedWoundweaveEndpoint(ww(), id)
        || ww().pendingEndpoint === id
        || ww().entangledSeededUnitId === id
      ));
      const willPair = !hasPrimaryPair(ww()) && affected.length >= 2;
      const familyScale = ownedHasKind('DRAWN_TENSION')
        && focused?.rootActionId === prepared.rootActionId
        && (linkedHit || willPair)
        ? 1.5
        : 1;
      const emp = cv().twofoldEmpowerment;
      const twofoldScale = emp?.armed && emp.sourceFinaleRootId !== prepared.rootActionId ? 1.5 : 1;
      const beforeIntents = hostileIntents.slice();
      const linkedBefore = new Set(
        beforeIntents
          .map((row) => row.unitId)
          .filter((id) => isLinkedWoundweaveEndpoint(ww(), id) || isPrimaryEndpoint(ww(), id) || ww().pendingEndpoint === id),
      );
      const resolved = processWoundweaveRoot({
        state: ww(),
        ctx: withAffected,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        depth: cf().combatDepth,
        jammed,
        familyScale,
        twofoldScale,
      });
      setWw(resolved.state);
      hostileIntents = resolved.intents;
      if (resolved.consumedTwofold) {
        setCv({ ...cv(), twofoldEmpowerment: null });
      }
      emitWoundweavePackets(resolved.packets, prepared);
      applyTwofoldFormation();
      if (resolved.state.lastTwofoldFormation) {
        if (ownedHasKind('TETHERED_ORBIT')) {
          const establishingImprint: import('../../types/gravemark').GravemarkPolarityId =
            withAffected.actionSurface === 'TECHNIQUE' || withAffected.actionSurface === 'FLEX'
              ? 'DISCIPLINE'
              : withAffected.actionSurface === 'INSTINCT'
                ? 'INSTINCT'
                : 'ARMAMENT';
          setGm(applyTetheredOrbitFormationPolarity(
            gm(),
            { rootActionId: prepared.rootActionId },
            resolved.state.endpointA,
            resolved.state.endpointB,
            resolved.state.selfLink,
            establishingImprint,
          ));
        }
        if (ownedHasKind('CRYSTAL_LIGATURE')) {
          const granted = applyCrystalLigatureFormationShards(s4(), ss(), cf().combatDepth);
          setS4(granted.cv);
          setSs(granted.ss);
        }
      }
      applyEntangledFateStore(withAffected);
      applyDrawnTensionFleeting(withAffected, beforeIntents, hostileIntents, linkedBefore);
      const occult = resolved.packets.reduce((sum, row) => sum + (row.fizzled ? 0 : row.occultDamage), 0);
      if (occult > 0) state.metrics.woundweave_occult = (state.metrics.woundweave_occult ?? 0) + occult;
      const wwKilled = resolved.packets.some((packet) => {
        const row = hostileIntents.find((intent) => intent.unitId === packet.targetId);
        return Boolean(row && !row.alive);
      });
      const familyKillOrBreak = ownedHasKind('SYMPATHETIC_WOUND') && ([...linkedBefore].some((id) => {
        const prev = beforeIntents.find((row) => row.unitId === id);
        const next = hostileIntents.find((row) => row.unitId === id);
        const native = prepared.nativeByTarget.find((row) => row.targetId === id);
        const died = Boolean(prev?.alive) && next && !next.alive;
        const broke = (native?.defenseBreaks ?? 0) > 0;
        return died || broke;
      }) || resolved.packets.some((packet) => {
        const prev = beforeIntents.find((row) => row.unitId === packet.targetId);
        const next = hostileIntents.find((row) => row.unitId === packet.targetId);
        return Boolean(prev?.alive) && next && !next.alive;
      }));
      if (ownedHasKind('SYMPATHETIC_WOUND') && prepared.wakePowered) {
        const packet = applySympatheticWoundPacket(
          s3(),
          ww(),
          hostileIntents,
          withAffected,
          prepared.wakeValueAtCommit ?? sw().activeWake,
        );
        setS3(packet.cv);
        if (packet.partnerId && packet.occultDamage > 0) {
          hostileIntents = hostileIntents.map((row) => (
            row.unitId === packet.partnerId
              ? {
                ...row,
                hp: Math.max(0, row.hp - packet.occultDamage),
                alive: row.hp - packet.occultDamage > 0 && row.alive,
              }
              : row
          ));
          dispatch({
            type: 'DERIVATIVE_RESOLVED',
            sourceId: CONVERGENCE_IDS.SYMPATHETIC_WOUND,
            lineage: [prepared.rootActionId, CONVERGENCE_IDS.SYMPATHETIC_WOUND],
            rootActionId: prepared.rootActionId,
            targetId: packet.partnerId,
            payload: {
              damage: packet.occultDamage,
              occult: packet.occultDamage,
              classification: 'DERIVATIVE',
              channel: 'OCCULT',
              convergence: CONVERGENCE_IDS.SYMPATHETIC_WOUND,
            },
          }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth + 1) });
        }
      }
      if (familyKillOrBreak) {
        const carry = applySympatheticWoundCarry(s3(), sw(), requestResidualCarry);
        setS3(carry.cv);
        setSw(carry.sw);
      }
      if (hasLiveStillpoint()) {
        const focused = sp().focusedRoot;
        if (focused?.rootActionId === prepared.rootActionId && !sp().returnStrokeUsedThisPlayerTurn
          && returnStrokeQualifies(prepared, wwKilled)) {
          const refund = applyReturnStroke(sp(), ownedDefinitionIds(), sp().playerTurnOpen);
          setSp(refund.state);
          if (refund.refundNow > 0) state.metrics.ap_refund = (state.metrics.ap_refund ?? 0) + refund.refundNow;
          if (refund.queued > 0) state.metrics.ap_refund_queued = (state.metrics.ap_refund_queued ?? 0) + refund.queued;
        }
      }
    }
    if (hasLiveGravemark() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const gmResult = processGravemarkRoot({
        state: gm(),
        ctx: prepared,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        sourceEventId: prepared.rootActionId,
      });
      setGm(gmResult.state);
      hostileIntents = gmResult.intents;
      emitGravemarkRecords(gmResult, prepared);
      if (gmResult.apRefundGranted > 0) {
        state.metrics.ap_refund = (state.metrics.ap_refund ?? 0) + gmResult.apRefundGranted;
      }
      prepared = { ...prepared, nativeByTarget: gmResult.nativeByTarget };
      applySector4GravemarkDisplacementObservers(prepared, gmResult.displacementEvents, Boolean(preview?.finale));
      // Sole exception to "commitment/payment before Gravemark writes": World Turned Sideways'
      // pre-native pass already ran via beginWorldTurnedSidewaysUltimate before native resolution.
      // This just replays the stored locked targets for the post-native 20% packet.
      const wts = processWorldTurnedSidewaysPostNative({
        state: gm(),
        intents: hostileIntents,
        ownedIds: ownedDefinitionIds(),
        nativeByTarget: prepared.nativeByTarget,
        damageChannels: prepared.damageChannels,
        rootActionId: prepared.rootActionId,
      });
      setGm(wts.state);
      hostileIntents = wts.intents;
      prepared = { ...prepared, nativeByTarget: wts.nativeByTarget };
      if (wts.state.lastCollision && wts.state.lastCollision.kind === 'WORLD_TURNED_SIDEWAYS') {
        dispatch({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: wts.state.lastCollision.sourceDefinitionId,
          lineage: [prepared.rootActionId, wts.state.lastCollision.sourceDefinitionId],
          rootActionId: prepared.rootActionId,
          targetId: wts.state.lastCollision.targetId,
          payload: {
            damage: wts.state.lastCollision.amount,
            kinetic: wts.state.lastCollision.kinetic,
            occult: wts.state.lastCollision.occult,
            classification: 'DERIVATIVE',
          },
        }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth + 1) });
      }
    }
    if (prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      applySector4ForcedGravemarkMovements(prepared);
    }
    if (hasLiveShardskin() && prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      // Edge consumption + Scatterglass require the root to have actually dealt native direct
      // damage (the central law in section 6). Core generation is evaluated separately below —
      // Ritual Pane explicitly does not require damage, only a valid paid Technique/Flex.
      if (prepared.totalNativeDirectDamage > 0) {
        const primaryTargetId = prepared.lockedTargetIds[0] ?? null;
        const otherAffected = prepared.nativeByTarget
          .filter((row) => row.targetId !== primaryTargetId && row.nativeDirectDamage > 0)
          .map((row) => row.targetId);
        const edgeResult = consumeEdgeForRoot({
          state: ss(),
          ownedIds: ownedDefinitionIds(),
          intents: hostileIntents,
          primaryTargetId,
          otherAffectedTargetIds: otherAffected,
          depth: cf().combatDepth,
        });
        setSs({ ...edgeResult.state, lastEdgeConsumption: edgeResult.state.lastEdgeConsumption ? { ...edgeResult.state.lastEdgeConsumption, rootActionId: prepared.rootActionId } : null });
        hostileIntents = edgeResult.intents;
        if (edgeResult.consumedEdge > 0) {
          applySector4EdgeConsumptionObservers(prepared, primaryTargetId, edgeResult.primaryPacket?.amount ?? 0);
        }
        if (edgeResult.primaryPacket && edgeResult.primaryPacket.amount > 0) {
          dispatch({
            type: 'DERIVATIVE_RESOLVED',
            sourceId: 'SHARDSKIN_EDGE',
            lineage: [prepared.rootActionId, 'SHARDSKIN_EDGE'],
            rootActionId: prepared.rootActionId,
            targetId: edgeResult.primaryPacket.targetId,
            payload: {
              damage: edgeResult.primaryPacket.amount,
              occult: edgeResult.primaryPacket.amount,
              classification: 'DERIVATIVE',
              channel: 'OCCULT',
            },
          }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth + 1) });
        }
        for (const spread of edgeResult.scatterglassPackets) {
          setSs({ ...ss(), lastSpread: { rootActionId: prepared.rootActionId, targetId: spread.targetId, amount: spread.amount } });
          dispatch({
            type: 'DERIVATIVE_RESOLVED',
            sourceId: SHARDSKIN_SUPPORT_IDS.SCATTERGLASS,
            lineage: [prepared.rootActionId, SHARDSKIN_SUPPORT_IDS.SCATTERGLASS],
            rootActionId: prepared.rootActionId,
            targetId: spread.targetId,
            payload: {
              damage: spread.amount,
              occult: spread.amount,
              classification: 'DERIVATIVE',
              channel: 'OCCULT',
            },
          }, { ...prepared, classification: 'DERIVATIVE', procDepth: Math.max(1, prepared.procDepth + 1) });
        }
      }
      const coreResult = applyShardskinCoreGeneration({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        ctx: prepared,
        depth: cf().combatDepth,
      });
      setSs(coreResult.state);
      if (ownedHasKind('SOULGLASS') && prepared.wakePowered && hasLiveSoulwake()) {
        const generated = applySoulglassGeneration(s4(), ss(), cf().combatDepth, prepared.wakeValueAtCommit ?? 0);
        setS4(generated.cv);
        setSs(generated.ss);
      }
    }
    holdFateboundRelease = Boolean(preview?.finale);
    if (!holdFateboundRelease) maybeReleaseAfterRoot(prepared);
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
    const crossfadeOrigin = ai().crossfadeArmedImprint;
    if (hasLiveAfterimage() && prepared.classification === 'NATIVE_DIRECT') {
      const beforeSeq = ai().nextTraceSequence;
      mintOrdinaryFromRoot(prepared, 'CORE', 1);
      applySuspendedEchoAndGhostCapture(prepared, beforeSeq);
      if (ownedHasKind('SECOND_ENDING') && prepared.sourceKind === 'ULTIMATE') {
        const minted = tryMintSecondEnding(ai(), prepared, AFTERIMAGE_VERDICT_ID);
        setAi(minted.state);
      }
      const ready = dueActionTraces(ai()).filter((row) => row.status === 'READY');
      const parallaxResolvedTargets: { targetId: string; amount: number }[] = [];
      for (const trace of ready) {
        const beforeSeq = emitted.length;
        resolveOneTrace(trace, prepared);
        if (
          trace.provenance === 'CORE'
          && (ownedHasKind('PARALLAX_ECHO') || ownedHasKind('PHANTOM_FACET'))
        ) {
          for (const evt of emitted.slice(beforeSeq)) {
            if (evt.type === 'DERIVATIVE_RESOLVED' && evt.sourceId === trace.traceId) {
              const dmg = typeof evt.payload.damage === 'number' ? evt.payload.damage : 0;
              if (evt.targetId && dmg > 0) parallaxResolvedTargets.push({ targetId: evt.targetId, amount: dmg });
            }
          }
          if (ownedHasKind('PHANTOM_FACET')) {
            const power = Math.floor(effectiveTracePower(trace));
            const generated = applyPhantomFacetGeneration(s4(), ss(), cf().combatDepth, power);
            setS4(generated.cv);
            setSs(generated.ss);
          }
        }
      }
      if (ownedHasKind('PARALLAX_ECHO') && parallaxResolvedTargets.length > 0) {
        const movement = applyParallaxEchoTraceMovement({
          cv: s4(), gm: gm(), intents: hostileIntents,
          resolvedTargets: parallaxResolvedTargets,
          rootActionId: prepared.rootActionId,
          sourceEventId: `${prepared.rootActionId}:${CONVERGENCE_IDS.PARALLAX_ECHO}`,
          procDepth: prepared.procDepth,
          collisionCourseOwned: ownedDefinitionIds().includes('GM_SUPPORT_COLLISION_COURSE'),
          depth: cf().combatDepth,
        });
        setS4(movement.cv);
        applySector4DisplacementOutcome(movement, prepared);
      }
      if (crossfadeOrigin) {
        mintCrossfadeFromRoot(prepared, crossfadeOrigin);
      }
    }
    if (preview?.finale && preview.surface) {
      const originalBound = cf().fateboundUnitId;
      applyFatedRefrainFinaleStore();
      holdFateboundRelease = false;
      maybeReleaseAfterRoot(prepared);
      if (
        originalBound
        && cf().fateboundUnitId === originalBound
        && hostileIntents.some((row) => row.unitId === originalBound && !row.alive)
        && !skipOrdinaryRelease()
      ) {
        maybeReleaseAfterRoot({
          ...prepared,
          nativeByTarget: prepared.nativeByTarget.map((row) => (
            row.targetId === originalBound ? { ...row, killed: true } : row
          )),
        });
      }
      const release = cf().lastRelease;
      const delayedRelease = Boolean(release?.lineage?.includes('AFTERIMAGE_TRACE'));
      const targetHp = hostileIntents.find((row) => row.unitId === release?.targetUnitId)?.hp ?? 0;
      const descendantKill = !delayedRelease && Boolean(release && release.packet > 0 && targetHp > 0 && release.packet >= targetHp);
      completePendingFinale({
        ...prepared,
        kills: prepared.kills + (descendantKill ? 1 : 0),
        intentCountered: !delayedRelease && (prepared.intentCountered === true || release?.countered === true),
      }, preview.surface);
      {
        const deferred = applyDeferredBreakingMeasureBeat(s3(), rc());
        setS3(deferred.cv);
        setRc(deferred.rc);
      }
      if (ownedHasKind('PULSE_RITE') && hasLiveSoulwake()) {
        const carry = applyPulseRiteFinaleCarry(s3(), sw(), requestResidualCarry);
        setS3(carry.cv);
        setSw(carry.sw);
      }
      applyMeasuredSilenceRetain(prepared);
      applyTwofoldFinaleArm(prepared);
      armEchoedRite(prepared.rootActionId);
    }
    // Prismatic Rite: a root that armed a deferred Beat via Edge consumption but did not itself
    // close a Finale advances it here, once the root fully resolves. If the root DID close a
    // Finale, completePendingFinale() already consumed it against the post-Finale Measure state.
    if (ownedHasKind('PRISMATIC_RITE') && s4().prismaticRiteDeferredBeat) {
      const deferred = applyPrismaticRiteDeferredBeat(s4(), rc());
      setS4(deferred.cv);
      setRc(deferred.rc);
    }
    if (prepared.committed && prepared.classification === 'NATIVE_DIRECT') {
      const qualifies = sector4RootOutcomeQualifies(prepared);
      if (ownedHasKind('STORED_VECTOR') && hasLiveStillpoint()) {
        const focused = sp().focusedRoot;
        if (focused?.rootActionId === prepared.rootActionId) {
          const requested = tryStoredVectorFleetingRequest(sp(), { rootActionId: prepared.rootActionId, qualifies });
          setSp(requested.sp);
        }
      }
      if (ownedHasKind('TRAUMA_VECTOR') && prepared.wakePowered && hasLiveSoulwake()) {
        const carry = applyTraumaVectorResidualCarry(sw(), qualifies ? (prepared.wakeValueAtCommit ?? 0) : 0);
        setSw(carry.sw);
      }
    }
    holdFateboundRelease = false;
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
    afterimage: ReturnType<typeof ai>;
    stillpoint: ReturnType<typeof sp>;
    woundweave: ReturnType<typeof ww>;
    faultline: ReturnType<typeof fl>;
    soulwake: ReturnType<typeof sw>;
  } {
    const snapshot = cloneNineStrainRuntimeState(state);
    const orderSnapshot = eventOrder;
    const emittedLen = emitted.length;
    const releaseLen = pendingReleases.length;
    const contextSnapshot = lastRootContext;
    const intentSnapshot = hostileIntents.slice();
    commitRootAction(ctx);
    const metrics = { ...state.metrics };
    const events = emitted.slice(emittedLen);
    const counterfate = cloneNineStrainRuntimeState({ ...state, counterfate: cf() }).counterfate;
    const ritualCadence = structuredClone(rc());
    const afterimage = structuredClone(ai());
    const stillpoint = structuredClone(sp());
    const woundweave = structuredClone(ww());
    const faultline = structuredClone(fl());
    const soulwake = structuredClone(sw());
    state = snapshot;
    lastRootContext = contextSnapshot;
    eventOrder = orderSnapshot;
    emitted.length = emittedLen;
    pendingReleases.length = releaseLen;
    hostileIntents = intentSnapshot;
    return { metrics, events, counterfate, ritualCadence, afterimage, stillpoint, woundweave, faultline, soulwake };
  }

  function resolveInstinct(input: InstinctAdapterInput): InstinctGradeWrap {
    let grade = resolveInstinctGrade(input);
    const rootActionId = `instinct:${input.classId}:${eventOrder + 1}`;
    let instinctCtx: CanonicalRootActionContext = {
      ...weaponFamilyExecutionContext(lastRootContext?.weaponFamilyId ?? 'aegis-longsword', {
        actionId: `instinct:${input.classId}`,
        sourceKind: 'INSTINCT' as const,
        actionSurface: 'INSTINCT' as const,
        rootActionId,
        committed: true,
        classId: input.classId,
        nativeByTarget: [],
        totalNativeDirectDamage: 0,
      }),
      classId: input.classId,
      intentCountered: input.preventedFateboundIntentDamage === true,
    };
    let focused = false;
    if (hasLiveStillpoint() && ownedHasKind('STILLPOINT_QUIET_REFLEX')) {
      const result = consumeFocusForRoot(sp(), instinctCtx, ownedDefinitionIds(), false);
      setSp(result.state);
      focused = Boolean(result.focused);
    }
    const originalGrade = grade;
    if (focused && ownedHasKind('STILLPOINT_QUIET_REFLEX')) {
      const allowPositive = !sp().quietReflexSuccessUsedThisCombatCycle;
      if (allowPositive && grade !== 'FAILED') {
        grade = promoteQuietReflexGrade(grade);
        if (originalGrade === 'PERFECT') {
          const numeric = input.primaryNumeric ?? input.riftPreventedDamage ?? 0;
          if (numeric > 0) {
            state.metrics.quiet_reflex_numeric = scalePerfectNumeric(numeric);
          }
        }
        setSp({
          ...sp(),
          quietReflexSuccessUsedThisCombatCycle: true,
          lastQuietReflexGrade: grade,
        });
      } else {
        setSp({ ...sp(), lastQuietReflexGrade: grade });
      }
    }
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
    if (hasLiveFaultline()) {
      instinctCtx = applyFaultlineResult(processFaultlineInstinct({
        state: fl(),
        ctx: instinctCtx,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        grade,
        associatedHostileUnitId: input.associatedHostileUnitId,
        sourceEventId: rootActionId,
      }), instinctCtx);
    }
    if (hasLiveSoulwake()) {
      const reflex = processSoulwakeInstinct({
        state: sw(),
        ownedIds: ownedDefinitionIds(),
        grade,
      });
      setSw(reflex.state);
      if (reflex.barrier > 0) {
        state.metrics.soulwake_barrier = (state.metrics.soulwake_barrier ?? 0) + reflex.barrier;
      }
    }
    if (hasLiveGravemark()) {
      const gmResult = processGravemarkInstinct({
        state: gm(),
        ctx: instinctCtx,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        grade,
        associatedHostileUnitId: input.associatedHostileUnitId,
        sourceEventId: rootActionId,
      });
      setGm(gmResult.state);
      hostileIntents = gmResult.intents;
      emitGravemarkRecords(gmResult, instinctCtx);
      instinctCtx = { ...instinctCtx, nativeByTarget: gmResult.nativeByTarget };
    }
    if (hasLiveShardskin()) {
      const facet = processShardskinInstinct({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        grade,
        depth: cf().combatDepth,
      });
      setSs(facet.state);
    }
    if (hasLiveWoundweave() && ownedHasKind('WOUNDWEAVE_REFLEXIVE_AGONY')) {
      const pulse = emitReflexiveAgony(ww(), ownedDefinitionIds(), hostileIntents, grade, rootActionId);
      setWw(pulse.state);
      if (pulse.packets.length > 0) {
        hostileIntents = applyWoundweavePacketsToIntents(hostileIntents, pulse.packets);
        emitWoundweavePackets(pulse.packets, instinctCtx);
        const occult = pulse.packets.reduce((sum, row) => sum + row.occultDamage, 0);
        state.metrics.woundweave_occult = (state.metrics.woundweave_occult ?? 0) + occult;
      }
    }
    if (hasLiveRitual() && !rc().instinctCommitmentUsedThisCombatCycle) {
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
      if (ownedHasKind('MEASURE_INSTINCT') && instinctBonusEligible(grade, different, finale) && preview.surface) {
        const bonus = forceAdvance(next, preview.surface);
        next = bonus.state;
        finale = finale || bonus.finale;
      }
      setRc(next);
      if (finale && preview.surface) {
        applyFatedRefrainFinaleStore();
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
        applyMeasuredSilenceRetain({
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
        });
        armEchoedRite(rootActionId);
      }
    }
    if (ownedHasKind('TRACE_REFLEX_REMNANT')) {
      const beforeSeq = ai().nextTraceSequence;
      const result = tryMintReflex(ai(), {
        grade,
        rootActionId,
        definitionId: AFTERIMAGE_CORE_IDS.REFLEX_REMNANT,
        provenance: 'CORE',
        powerMultiplier: 1,
      });
      setAi(result.state);
      applySuspendedEchoAndGhostCapture(instinctCtx, beforeSeq);
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
      payload: {
        signal: resolved.signal,
        kind: resolved.kind,
        classId: input.classId,
        actualGained: input.actualGained ?? 0,
        reloadRestoredCount: input.reloadRestoredCount ?? 0,
        ammoType: input.selectedAmmoType ?? null,
      },
    });
    if (hasLiveFaultline() && lastRootContext) {
      applyFaultlineResult(processFaultlineCurrent({
        state: fl(),
        ctx: lastRootContext,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        signal: resolved.signal,
        associatedHostileUnitId: input.associatedHostileUnitId,
        sourceEventId: lastRootContext.rootActionId,
      }), lastRootContext);
    }
    if (hasLiveGravemark()) {
      const gmResult = processGravemarkCurrent({
        state: gm(),
        ctx: lastRootContext,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        signal: resolved.signal,
        associatedHostileUnitId: input.associatedHostileUnitId,
        sourceEventId: lastRootContext?.rootActionId ?? `current:${input.classId}:${eventOrder}`,
      });
      setGm(gmResult.state);
      hostileIntents = gmResult.intents;
      emitGravemarkRecords(gmResult, lastRootContext);
    }
    if (hasLiveShardskin() && !input.ultimateOwnedRefill && !input.delayedRestore && !input.preserved) {
      const pressure = processShardskinCurrent({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        signal: resolved.signal,
        depth: cf().combatDepth,
      });
      setSs(pressure.state);
    }
    if (hasLiveSoulwake() && lastRootContext) {
      const conduit = processSoulwakeCurrent({
        state: sw(),
        ctx: lastRootContext,
        ownedIds: ownedDefinitionIds(),
        input,
      });
      setSw(conduit.state);
      if (conduit.gained > 0) {
        state.metrics.soulwake_current_gain = (state.metrics.soulwake_current_gain ?? 0) + conduit.gained;
      }
      if (conduit.preserved > 0) {
        state.metrics.soulwake_current_preserved = (state.metrics.soulwake_current_preserved ?? 0) + conduit.preserved;
        dispatch({
          type: 'CURRENT_PRESERVED',
          sourceId: SOULWAKE_CORE_IDS.OPEN_CONDUIT,
          lineage: [lastRootContext.rootActionId, SOULWAKE_CORE_IDS.OPEN_CONDUIT],
          rootActionId: lastRootContext.rootActionId,
          targetId: null,
          payload: { preserved: conduit.preserved, classification: 'DERIVATIVE' },
        });
      }
    }
    if (hasLiveStillpoint() && ownedHasKind('STILLPOINT_SILENT_RESERVOIR') && !sp().silentReservoirUsedThisPlayerTurn && lastRootContext) {
      let focused = sp().focusedRoot?.rootActionId === lastRootContext.rootActionId
        && sp().focusedRoot?.consumed;
      if (!focused && sp().pendingCurrentFocusRootId === lastRootContext.rootActionId) {
        const result = consumeFocusForRoot(sp(), lastRootContext, ownedDefinitionIds(), true);
        setSp(result.state);
        focused = Boolean(result.focused);
      }
      if (focused) {
        let preserved = 0;
        let gainBonus = 0;
        let reloadBonus = 0;
        if (input.ammoSpent) {
          preserved = 1;
        } else if (input.ordinarySpend || resolved.kind === 'SPENT') {
          preserved = silentReservoirSpendPreserve(input.actualSpent ?? 1);
        } else if (input.reloadRestoredRounds || (input.reloadRestoredCount ?? 0) > 0) {
          reloadBonus = silentReservoirReloadBonus(
            input.reloadRestoredCount ?? 3,
            input.magazineSpace ?? 99,
          );
        } else if (input.ordinaryGain || resolved.kind === 'GAINED') {
          gainBonus = silentReservoirGainBonus(input.actualGained ?? 0);
        }
        setSp({
          ...sp(),
          silentReservoirUsedThisPlayerTurn: true,
          pendingCurrentFocusRootId: null,
          lastPreserved: preserved,
          lastReloadBonus: reloadBonus,
        });
        if (preserved > 0) {
          state.metrics.current_preserved = (state.metrics.current_preserved ?? 0) + preserved;
          dispatch({
            type: 'CURRENT_PRESERVED',
            sourceId: STILLPOINT_CORE_IDS.SILENT_RESERVOIR,
            lineage: [lastRootContext.rootActionId],
            rootActionId: lastRootContext.rootActionId,
            targetId: null,
            payload: { preserved, ammoType: input.selectedAmmoType ?? null },
          });
        }
        if (gainBonus > 0) {
          state.metrics.silent_reservoir_gain = gainBonus;
        }
        if (reloadBonus > 0) {
          state.metrics.silent_reservoir_reload = reloadBonus;
        }
      }
    }
    if (hasLiveWoundweave() && ownedHasKind('WOUNDWEAVE_TIGHTENED_THREAD') && lastRootContext && !resolved.excluded) {
      setWw(armTightenedThread(
        ww(),
        ownedDefinitionIds(),
        lastRootContext.rootActionId,
        resolved.signal === 'MAJOR' ? 'MAJOR' : 'ORDINARY',
      ));
    }
    if (ownedHasKind('TRACE_RECURRENT_CHARGE') && resolved.kind === 'GAINED') {
      const result = tryMintRecurrent(ai(), {
        classId: input.classId,
        actualGained: input.actualGained ?? 0,
        reloadRestoredCount: input.reloadRestoredCount ?? (input.reloadRestoredRounds ? 3 : 0),
        selectedAmmoType: input.selectedAmmoType ?? lastRootContext?.selectedAmmoType ?? null,
        ultimateOwnedRefill: input.ultimateOwnedRefill === true,
        delayedRestore: input.delayedRestore === true,
        definitionId: AFTERIMAGE_CORE_IDS.RECURRENT_CHARGE,
        provenance: 'CORE',
        powerMultiplier: 1,
        originRootActionId: lastRootContext?.rootActionId ?? null,
      });
      setAi(result.state);
    }
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
    if (ownedHasKind('ENTANGLED_FATE') && hasLiveWoundweave()) {
      setWw(seedEntangledFateEndpoint(ww(), cf().fateboundUnitId, hostileIntents, ownedDefinitionIds()));
    }
    if (hasLiveAfterimage() && ownedHasKind('DEFERRED_EXPOSURE')) {
      const options = deferredExposureOptions(ai(), true);
      if (options.length > 0) {
        setAi({ ...ai(), deferredChoicePending: true });
        const orderedEarly = orderPendingTurnStartEffects(state.pendingEffects);
        state.pendingEffects = [];
        for (const pending of orderedEarly) {
          const key = pending.kind === 'TRACE' ? 'traces_resolved' : 'other_queued_resolved';
          state.metrics[key] = (state.metrics[key] ?? 0) + 1;
        }
        return TURN_START_PHASES.slice();
      }
    }
    if (hasLiveAfterimage()) resolveDueTurnStartTraces();
    const ordered = orderPendingTurnStartEffects(state.pendingEffects);
    state.pendingEffects = [];
    for (const pending of ordered) {
      const key = pending.kind === 'TRACE' ? 'traces_resolved' : 'other_queued_resolved';
      state.metrics[key] = (state.metrics[key] ?? 0) + 1;
    }
    return TURN_START_PHASES.slice();
  }

  function     preview(definitionId: string, extra: { premiumVerdictSource?: boolean; allowVerdictReplace?: boolean; exceptionalSourceId?: string; combatDepth?: number; equippedWeaponFamilyId?: string; allowSector2Wave?: boolean; maxAcquisitionWave?: 1 | 2 | 3 | 4 } = {}): OwnershipPreview {
    return previewAcquire(state, definitions, definitionId, {
      allowTestOffers: options.allowTestOffers,
      allowSector2Wave: extra.allowSector2Wave ?? options.allowSector2Wave,
      combatDepth: extra.combatDepth ?? cf().combatDepth,
      ...extra,
    });
  }

  function commit(definitionId: string, extra: { premiumVerdictSource?: boolean; allowVerdictReplace?: boolean; exceptionalSourceId?: string; combatDepth?: number; equippedWeaponFamilyId?: string; allowSector2Wave?: boolean; maxAcquisitionWave?: 1 | 2 | 3 | 4 } = {}): OwnershipPreview {
    const result = applyAcquire(state, definitions, definitionId, {
      allowTestOffers: options.allowTestOffers,
      allowSector2Wave: extra.allowSector2Wave ?? options.allowSector2Wave,
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
      setFl(pruneFaultlineTargets(fl(), hostileIntents));
      setGm(pruneGravemarkTargets(gm(), hostileIntents));
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
    completeCombat(outcome: 'VICTORY' | 'ESCAPE' | 'FAILURE' = 'VICTORY') {
      if (hasLiveSoulwake()) setSw(completeSoulwakeEncounter(sw(), ownedDefinitionIds(), outcome));
      setRc(resetEncounterRitualCadence());
      setAi(clearEncounterAfterimage());
      setCv(createDefaultConvergenceState());
      setSp(clearEncounterStillpoint());
      setWw(clearEncounterWoundweave());
      setGm(clearEncounterGravemark());
      setFl(clearEncounterFaultline());
      setSs(clearEncounterShardskin());
    },
    endPlayerTurn(input: { reason?: PlayerTurnEndReason; usableAp?: number; apDisabledByEnemy?: boolean; apRemovedByEnemy?: boolean } = {}) {
      const reason = input.reason ?? 'VOLUNTARY';
      if (hasLiveStillpoint() && (input.apDisabledByEnemy || input.apRemovedByEnemy)) {
        setSp(noteHostileApDisruption(sp()));
      }
      const usable = input.usableAp ?? usablePlayerAp({
        remainingAp: 0,
        apDisabledByEnemy: input.apDisabledByEnemy,
        apRemovedByEnemy: input.apRemovedByEnemy,
      });
      if (hasLiveStillpoint()) {
        const ended = applyStillpointEndTurn(sp(), ownedDefinitionIds(), { reason, usableAp: usable });
        setSp(ended.state);
        if (ended.nativeEvent) {
          state.metrics.native_stillness_gained = (state.metrics.native_stillness_gained ?? 0) + 1;
          dispatch({
            type: 'NATIVE_STILLNESS_GAINED',
            sourceId: 'stillpoint',
            lineage: [],
            rootActionId: null,
            targetId: null,
            payload: { usableAp: usable, reason },
          });
          applyStayedSentenceNativeGain();
          applyMeasuredSilenceAdvance();
          if (ownedHasKind('STILLGLASS')) {
            const granted = applyStillglassNativeStillnessShards(ss(), cf().combatDepth);
            setSs(granted.ss);
          }
        }
        if (ended.barrier > 0) {
          state.metrics.sheltered_pause_barrier = ended.barrier;
        }
      }
      if (ownedHasKind('HELD_BREATH') && hasLiveSoulwake()) {
        const carry = applyHeldBreathEndTurnCarry(s3(), sw(), requestResidualCarry, {
          reason,
          usableAp: usable,
        });
        setS3(carry.cv);
        setSw(carry.sw);
      }
      dispatch({
        type: 'PLAYER_TURN_ENDED',
        sourceId: 'turn',
        lineage: [],
        rootActionId: null,
        targetId: null,
        payload: { reason, usableAp: usable },
      });
    },
    deferredExposureOptions: () => deferredExposureOptions(ai(), ownedHasKind('DEFERRED_EXPOSURE')),
    confirmDeferredExposure(traceId: string | null) {
      setAi(applyDeferredDelay(ai(), traceId));
      resolveDueTurnStartTraces();
      return ai();
    },
    setAfterimageCapacity(capacity: Partial<ReturnType<typeof ai>['capacity']>) {
      setAi({ ...ai(), capacity: { ...ai().capacity, ...capacity } });
    },
    afterimagePresentation() {
      const current = ai();
      const pending = current.pending.filter((row) => row.status === 'PENDING' || row.status === 'READY');
      return {
        pendingCount: pending.length,
        queue: pending.map((row) => ({
          origin: row.originImprint === 'ARMAMENT'
            ? 'Weapon echo'
            : row.originImprint === 'DISCIPLINE'
              ? 'Discipline echo'
              : row.originImprint === 'INSTINCT'
                ? 'Instinct echo'
                : row.originImprint === 'CURRENT'
                  ? 'Current echo'
                  : 'Ultimate echo',
          due: row.duePlayerTurn,
          payload: row.payloadKind === 'MATCHING_AMMO' ? 1 : effectiveTracePower(row),
          provenance: row.provenance === 'CORE'
            ? 'Core'
            : row.provenance === 'CROSSFADE_BONUS'
              ? 'Crossfade'
              : row.provenance === 'PERSISTENT_SECONDARY'
                ? 'Persistent'
                : row.provenance === 'VERDICT'
                  ? 'Verdict'
                  : 'Convergence',
          ammoType: row.ammoType,
        })),
        deferredAvailable: current.deferredChoicePending,
        deferredOptions: deferredExposureOptions(current, ownedHasKind('DEFERRED_EXPOSURE')),
        crossfadeArmed: current.crossfadeArmedImprint != null && !current.crossfadeUsedThisPlayerTurn,
        reflexReady: pending.some((row) => row.resolutionMode === 'NEXT_COMMITTED_ACTION' && row.status === 'READY'),
      };
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
    stillpointPresentation() {
      return composeStillpointPresentation(sp(), ownedDefinitionIds());
    },
    woundweavePresentation() {
      return {
        ...composeWoundweavePresentation(ww(), hostileIntents),
        endpointAId: ww().endpointA,
        endpointBId: ww().endpointB,
        pendingId: ww().pendingEndpoint,
        badgeFor: (unitId: string) => endpointBadgeForUnit(ww(), unitId),
      };
    },
    faultlinePresentation() {
      return {
        ...composeFaultlinePresentation(fl()),
        pipsFor: (unitId: string) => faultPipsForUnit(fl(), unitId),
      };
    },
    soulwakePresentation() {
      return {
        ...composeSoulwakePresentation(sw()),
        overdrawAvailable: ordinaryOverdrawAvailable(sw(), ownedDefinitionIds()),
        lastHeartbeatSelected: sw().lastHeartbeatSelected,
      };
    },
    gravemarkPresentation() {
      return composeGravemarkPresentation(gm());
    },
    /** Consume-once: the Hub must apply every returned effect to the live grid exactly once, then this queue is empty until the next Displacement. */
    consumeGravemarkPendingMovement() {
      const result = drainGravemarkPendingMovement(gm());
      setGm(result.state);
      return result.effects;
    },
    /** Consume-once: returns the pending Folded Space AP refund (0 if none) and clears it. */
    consumeGravemarkApRefund() {
      const result = drainGravemarkApRefund(gm());
      setGm(result.state);
      return result.refund;
    },
    falsePositionEligible(unitId: string, requestedLane: 'FRONTLINE' | 'BACKLINE', actualLane: 'FRONTLINE' | 'BACKLINE') {
      return falsePositionEligibleForLane(gm(), ownedDefinitionIds(), unitId, requestedLane, actualLane);
    },
    /**
     * World Turned Sideways, pre-native pass. Call once per ultimate commitment, before the
     * ultimate's own native damage is computed, with the locked target set. Forces one normal
     * (capped) Displacement per legal target and queues the movement for the Hub to apply via
     * consumeGravemarkPendingMovement. The post-native 20% packet auto-fires from commitRootAction
     * for this same rootActionId once native damage is known — no separate post-native call needed.
     */
    beginWorldTurnedSidewaysUltimate(rootActionId: string, lockedTargetIds: readonly string[]) {
      const result = processWorldTurnedSidewaysPreNative({
        state: gm(),
        intents: hostileIntents,
        ownedIds: ownedDefinitionIds(),
        lockedTargetIds,
        rootActionId,
        sourceEventId: rootActionId,
        depth: cf().combatDepth,
      });
      setGm(result.state);
      hostileIntents = result.intents;
      emitGravemarkRecords({ polarityEvents: [], displacementEvents: result.displacementEvents }, lastRootContext);
      return {
        movedTargetIds: result.movedTargetIds,
        pendingMovementQueued: gm().pendingMovementEffects.length > 0,
      };
    },
    /**
     * World Turned Sideways, post-native pass for ultimate paths that never build a
     * CanonicalRootActionContext (the Hub applies ultimate damage directly, not via
     * recordNativeHit/commitRootAction). Caller supplies actual native direct damage received
     * per locked target for this exact rootActionId (e.g. a live-squad HP diff around the
     * ultimate's own resolution). One-shot: call exactly once per ultimate commit.
     */
    applyWorldTurnedSidewaysUltimateDamage(
      rootActionId: string,
      hits: readonly { targetId: string; damage: number }[],
      damageChannels: readonly string[],
    ) {
      const result = applyWorldTurnedSidewaysUltimateDamage({
        state: gm(),
        intents: hostileIntents,
        ownedIds: ownedDefinitionIds(),
        hits,
        damageChannels,
        rootActionId,
      });
      setGm(result.state);
      hostileIntents = result.intents;
      // No CanonicalRootActionContext exists for these ultimate paths (no recordNativeHit/
      // commitRootAction ever ran) — dispatch with ctx=null so other Strains, which all key
      // their capped observers off a real ctx, cannot misattribute this against a stale root.
      for (const packet of result.packets) {
        dispatch({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: packet.sourceDefinitionId,
          lineage: [rootActionId, packet.sourceDefinitionId],
          rootActionId,
          targetId: packet.targetId,
          payload: {
            damage: packet.amount,
            kinetic: packet.kinetic,
            occult: packet.occult,
            classification: 'DERIVATIVE',
          },
        }, null);
      }
      return { killedIds: result.killedIds };
    },
    shardskinPresentation() {
      return composeShardskinPresentation(ss(), cf().combatDepth);
    },
    /**
     * Central Shard-prevention law. Call once, with a stable eventId, after ordinary mitigation,
     * Barrier, Parry, and Rift Ward have already reduced the incoming amount, and before any HP
     * mutation. Idempotent on eventId — a duplicate call (rerender, retry) replays the stored
     * result instead of spending Shards twice. Returns the residual damage Soulwake should record.
     */
    recordShardDefense(eventId: string, incomingAfterMitigation: number, attackerUnitId?: string | null) {
      const result = resolveShardDefense({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        eventId,
        incomingAfterMitigation,
      });
      setSs(result.state);
      // Required incoming order: Barrier/Instinct -> Shards absorb -> Fated Facet stores
      // Reversal/threshold -> HP/Soulwake -> intent release. Only a fresh event (not a replay)
      // may store Reversal or arm Stillglass's Fleeting.
      if (result.freshEvent && result.shardsSpent > 0) {
        if (ownedHasKind('FATED_FACET')) {
          const applied = applyFatedFacetAbsorption({
            cv: s4(),
            cf: cf(),
            ss: ss(),
            attackerUnitId,
            shardsAbsorbed: result.shardsSpent,
            depth: cf().combatDepth,
          });
          setS4(applied.cv);
          setCf(applied.cf);
          setSs(applied.ss);
        }
        if (ownedHasKind('STILLGLASS')) {
          setS4(armStillglassPendingFleeting(s4()));
        }
      }
      return { shardsSpent: result.shardsSpent, hpDamage: result.hpDamage };
    },
    /**
     * Edge consumption for ultimate paths that never build a CanonicalRootActionContext (the Hub
     * applies ultimate damage directly, not via recordNativeHit/commitRootAction). Call once per
     * ultimate commit, after native damage is known, only when Cathedral Break was not selected.
     */
    consumeEdgeForUltimate(
      rootActionId: string,
      primaryTargetId: string | null,
      otherAffectedTargetIds: readonly string[],
    ) {
      if (!hasLiveShardskin() || ss().currentEdge <= 0) return { consumedEdge: 0, killedIds: [] };
      const result = consumeEdgeForRoot({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        primaryTargetId,
        otherAffectedTargetIds,
        depth: cf().combatDepth,
      });
      setSs({ ...result.state, lastEdgeConsumption: result.state.lastEdgeConsumption ? { ...result.state.lastEdgeConsumption, rootActionId } : null });
      hostileIntents = result.intents;
      if (result.primaryPacket && result.primaryPacket.amount > 0) {
        dispatch({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: 'SHARDSKIN_EDGE',
          lineage: [rootActionId, 'SHARDSKIN_EDGE'],
          rootActionId,
          targetId: result.primaryPacket.targetId,
          payload: { damage: result.primaryPacket.amount, occult: result.primaryPacket.amount, classification: 'DERIVATIVE', channel: 'OCCULT' },
        }, null);
      }
      for (const spread of result.scatterglassPackets) {
        dispatch({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: SHARDSKIN_SUPPORT_IDS.SCATTERGLASS,
          lineage: [rootActionId, SHARDSKIN_SUPPORT_IDS.SCATTERGLASS],
          rootActionId,
          targetId: spread.targetId,
          payload: { damage: spread.amount, occult: spread.amount, classification: 'DERIVATIVE', channel: 'OCCULT' },
        }, null);
      }
      // No CanonicalRootActionContext exists here, so the frozen-native-target-map clauses
      // (Faultglass/Impact Lattice/Soulglass) are out of scope for this ctx-less ultimate path —
      // only the primary-packet-shaped observers apply.
      if (result.consumedEdge > 0) {
        if (ownedHasKind('PRISMATIC_RITE')) setS4(armPrismaticRiteDeferredBeat(s4()));
        if (ownedHasKind('PHANTOM_FACET')) setS4(armPhantomFacetFromEdge(s4(), rootActionId));
        if (
          ownedHasKind('CRYSTAL_LIGATURE') && primaryTargetId
          && result.primaryPacket && result.primaryPacket.amount > 0 && hasLiveWoundweave()
          && isPrimaryEndpoint(ww(), primaryTargetId)
        ) {
          setWw({ ...ww(), expiresAtPlayerTurnStart: Math.max(ww().expiresAtPlayerTurnStart, ww().playerTurnIndex + 2) });
          const partner = ww().selfLink ? primaryTargetId : woundweavePartnerOf(ww(), primaryTargetId);
          const mirror = crystalLigatureMirrorAmount(result.primaryPacket.amount, ww().selfLink);
          if (partner && mirror > 0 && legalGravemarkHostileLocal(partner)) {
            hostileIntents = hostileIntents.map((row) => (
              row.unitId === partner ? { ...row, hp: Math.max(0, row.hp - mirror), alive: row.hp - mirror > 0 && row.alive } : row
            ));
            dispatch({
              type: 'DERIVATIVE_RESOLVED',
              sourceId: CONVERGENCE_IDS.CRYSTAL_LIGATURE,
              lineage: [rootActionId, CONVERGENCE_IDS.CRYSTAL_LIGATURE],
              rootActionId,
              targetId: partner,
              payload: { damage: mirror, occult: mirror, classification: 'DERIVATIVE', channel: 'OCCULT' },
            }, null);
          }
        }
        if (ownedHasKind('PRISMATIC_RITE')) {
          const deferred = applyPrismaticRiteDeferredBeat(s4(), rc());
          setS4(deferred.cv);
          setRc(deferred.rc);
        }
      }
      return { consumedEdge: result.consumedEdge, killedIds: result.killedIds };
    },
    setCathedralBreakSelected(selected: boolean) {
      setSs(setCathedralBreakSelected(ss(), selected));
    },
    previewCathedralBreak(lockedTargetIds: readonly string[]) {
      return previewCathedralBreak({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        lockedTargetIds,
        depth: cf().combatDepth,
      });
    },
    /**
     * Cathedral Break, pre-native pass. Call once per ultimate commitment when the Verdict toggle
     * is selected, before the ultimate's own native damage is computed. Snapshots and consumes all
     * current Shards + Edge, processes Endless Facet's Edge-only reform once, and stores the locked
     * target set for the post-native budget split. Idempotent per rootActionId.
     */
    beginCathedralBreakUltimate(rootActionId: string, lockedTargetIds: readonly string[]) {
      const result = beginCathedralBreakUltimate({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        rootActionId,
        lockedTargetIds,
        selected: ss().cathedralBreakSelected,
        depth: cf().combatDepth,
      });
      setSs(result.state);
      if (result.consumedEdge > 0 && ownedHasKind('PRISMATIC_RITE')) {
        setS4(armPrismaticRiteCathedralPending(s4(), rootActionId));
      }
      return {
        active: result.active,
        consumedShards: result.consumedShards,
        consumedEdge: result.consumedEdge,
      };
    },
    /**
     * Cathedral Break, post-native pass. Divides the Occult budget once across the distinct locked
     * native target set and grants the flat post-resolution Shard gain. Caller (Hub) must apply
     * every returned packet to the live squad exactly once. One-shot per rootActionId.
     */
    finishCathedralBreakUltimate(rootActionId: string) {
      const result = finishCathedralBreakUltimate({
        state: ss(),
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        rootActionId,
        depth: cf().combatDepth,
      });
      setSs(result.state);
      hostileIntents = result.intents;
      if (ownedHasKind('PRISMATIC_RITE') && s4().prismaticRiteCathedralPendingRootId === rootActionId) {
        const resolved = resolvePrismaticRiteCathedralPending(s4(), rootActionId);
        const deferred = applyPrismaticRiteDeferredBeat(resolved, rc());
        setS4(deferred.cv);
        setRc(deferred.rc);
      }
      for (const packet of result.packets) {
        if (packet.fizzled || packet.amount <= 0) continue;
        dispatch({
          type: 'DERIVATIVE_RESOLVED',
          sourceId: SHARDSKIN_VERDICT_ID,
          lineage: [rootActionId, SHARDSKIN_VERDICT_ID],
          rootActionId,
          targetId: packet.targetId,
          payload: { damage: packet.amount, occult: packet.amount, classification: 'DERIVATIVE', channel: 'OCCULT' },
        }, null);
      }
      return { budget: result.budget, packets: result.packets, killedIds: result.killedIds, gained: result.gained };
    },
    previewFaultline(ctx: CanonicalRootActionContext) {
      const snapshot = cloneNineStrainRuntimeState(state);
      const intents = hostileIntents.slice();
      const preview = previewFaultlineRoot({
        state: fl(),
        ctx,
        ownedIds: ownedDefinitionIds(),
        intents,
        jammed,
        depth: cf().combatDepth,
        sourceEventId: ctx.rootActionId,
      });
      state = snapshot;
      hostileIntents = intents;
      return preview;
    },
    previewSoulwake(ctx: CanonicalRootActionContext) {
      return previewSoulwakeRoot({
        state: sw(),
        ctx,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        depth: cf().combatDepth,
      });
    },
    /**
     * Preview-only: runs the same pure Gravemark root processor used by commitRootAction but
     * never persists the result — live gm() state and hostileIntents are left untouched.
     */
    previewGravemark(ctx: CanonicalRootActionContext) {
      if (!hasLiveGravemark()) return { deltas: [], apRefund: 0, killedIds: [] };
      return previewGravemarkRoot({
        state: gm(),
        ctx,
        ownedIds: ownedDefinitionIds(),
        intents: hostileIntents,
        jammed,
        depth: cf().combatDepth,
        sourceEventId: ctx.rootActionId,
      });
    },
    previewOverdraw() {
      return previewOrdinaryOverdraw(sw(), ownedDefinitionIds());
    },
    commitOverdraw(lossEventId = `overdraw:${sw().playerTurnIndex}`) {
      const result = commitOrdinaryOverdraw(sw(), ownedDefinitionIds(), lossEventId);
      setSw(result.state);
      if (!result.invalid && result.paid > 0) {
        dispatch({
          type: 'OVERDRAW_COMMITTED',
          sourceId: 'soulwake',
          lineage: [],
          rootActionId: null,
          targetId: null,
          payload: { paid: result.paid, requested: result.state.lastOverdrawRequested },
        });
        if (ownedHasKind('PULSE_RITE')) {
          const pulse = applyPulseRiteOverdraw(s3(), rc());
          setS3(pulse.cv);
          setRc(pulse.rc);
        }
        if (ownedHasKind('HELD_BREATH')) {
          const held = applyHeldBreathOverdraw(s3(), sp(), mintFleetingStillness);
          setS3(held.cv);
          setSp(held.sp);
        }
      }
      return result;
    },
    setLastHeartbeatOverdraw(selected: boolean) {
      setSw(setLastHeartbeatSelected(sw(), selected));
    },
    syncPlayerVitals(vitals: { hp?: number; maxHp?: number }) {
      setSw(syncSoulwakeVitals(sw(), vitals));
    },
    recordHpLoss(event: Parameters<typeof applyQualifyingLoss>[2]) {
      let nextEvent = event;
      if (
        ownedHasKind('PAIN_FORETOLD')
        && event.provenance === 'HOSTILE'
        && event.rootActionId
      ) {
        const fatebound = Boolean(cf().fateboundUnitId);
        const scaled = painForetoldHostileWakeMultiplier(s3(), event.rootActionId, fatebound);
        setS3(scaled.cv);
        if (scaled.replace && scaled.factor === 1.5) {
          nextEvent = {
            ...event,
            actualHpRemoved: Math.floor(event.actualHpRemoved * 1.5),
          };
        }
      }
      const result = applyQualifyingLoss(sw(), ownedDefinitionIds(), nextEvent);
      setSw(result.state);
      dispatch({
        type: event.provenance === 'HOSTILE' ? 'HP_LOSS_HOSTILE' : 'HP_LOSS_VOLUNTARY',
        sourceId: event.rootActionId ?? 'hp',
        lineage: event.rootActionId ? [event.rootActionId] : [],
        rootActionId: event.rootActionId,
        targetId: null,
        payload: {
          paid: nextEvent.actualHpRemoved,
          provenance: event.provenance,
          classified: result.classified,
        },
      });
      if (result.classified && result.applied > 0) {
        dispatch({
          type: 'WAKE_RECORDED',
          sourceId: 'soulwake',
          lineage: event.rootActionId ? [event.rootActionId] : [],
          rootActionId: event.rootActionId ?? null,
          targetId: null,
          payload: { applied: result.applied, provenance: event.provenance },
        });
      }
      return result;
    },
    consumeSoulwakeHubEffects() {
      const flags = {
        lastApRefund: sw().lastApRefund,
        lastCooldownAdvanced: sw().lastCooldownAdvanced,
        lastBarrierGranted: sw().lastBarrierGranted,
        playerHp: sw().playerHp,
        openConduitGain: sw().lastOpenConduitGain,
        openConduitPreserved: sw().lastOpenConduitPreserved,
      };
      setSw(clearSoulwakeHubFlags(sw()));
      return flags;
    },
    noteHostileApDisruption() {
      setSp(noteHostileApDisruption(sp()));
    },
    setWoundweavePhaseSuccessor(fromUnitId: string, toUnitId: string) {
      setWw(setWoundweavePhaseSuccessor(ww(), fromUnitId, toUnitId));
      setFl(setFaultlinePhaseSuccessor(fl(), fromUnitId, toUnitId));
      setGm(setGravemarkPhaseSuccessor(gm(), fromUnitId, toUnitId));
    },
    grantFleetingStillness(sourceDefinitionId: string | null = 'TEST_FLEETING') {
      return tryGrantFleeting(sourceDefinitionId ?? 'TEST_FLEETING');
    },
    previewEndTurn(input: { reason: PlayerTurnEndReason; usableAp: number }) {
      return previewNativeStillnessGain(sp(), {
        reason: input.reason,
        usableAp: input.usableAp,
        stillpointOwned: hasLiveStillpoint(),
      });
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
    lingeringRole: extras.lingeringRole,
    delayedOrigin: extras.delayedOrigin,
    instinctGrade: extras.instinctGrade,
    hpLossKind: extras.hpLossKind,
    wakePowered: extras.wakePowered,
    wakeValueAtCommit: extras.wakeValueAtCommit,
    wakeGenerationId: extras.wakeGenerationId,
    wakeKindAtCommit: extras.wakeKindAtCommit,
    wakePaidQualifyingHp: extras.wakePaidQualifyingHp,
    directlyAffectedTargetIds: extras.directlyAffectedTargetIds ?? directlyAffectedTargetIds({
      ...extras,
      nativeByTarget,
      lockedTargetIds: extras.lockedTargetIds ?? nativeByTarget.map((row) => row.targetId),
    } as CanonicalRootActionContext),
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
