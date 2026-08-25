import type {
  Sector1ConvergenceRuntimeState,
  Sector3ConvergenceRuntimeState,
  Sector4ConvergenceRuntimeState,
} from '../../types/convergence';
import type { ReversalReleaseResult } from '../../types/counterfate';
import { roundCounterfateAmount } from './counterfateMath';

export function createDefaultSector3ConvergenceState(): Sector3ConvergenceRuntimeState {
  return {
    brokenOutcomeWindowKey: null,
    brokenOutcomeStoredThisWindow: false,
    brokenOutcomeReleaseLineageId: null,
    brokenOutcomeReleaseFaultApplied: false,
    breakingMeasureDeferredBeat: false,
    breakingMeasureRuptureAdvancedThisPlayerTurn: false,
    echoedFaultTraceTargetsThisPlayerTurn: [],
    echoedFaultEmpowerments: [],
    criticalPressureRestoreUsedThisPlayerTurn: false,
    splitSeamTransferRootId: null,
    splitSeamExtensionThroughPlayerTurn: null,
    painForetoldWakeStoreUsedThisPlayerTurn: false,
    painForetoldHostileRootIds: [],
    pulseRiteOverdrawUsedThisPlayerTurn: false,
    pulseRiteFinaleCarryUsedThisPlayerTurn: false,
    phantomPainMintUsedThisPlayerTurn: false,
    phantomPainTraces: [],
    heldBreathOverdrawUsedThisPlayerTurn: false,
    heldBreathEndTurnCarryUsedThisPlayerTurn: false,
    sympatheticWoundPacketUsedThisPlayerTurn: false,
    sympatheticWoundCarryUsedThisPlayerTurn: false,
    livingFaultApplyUsedThisPlayerTurn: false,
    livingFaultCarryUsedThisPlayerTurn: false,
  };
}

export function createDefaultSector4ConvergenceState(): Sector4ConvergenceRuntimeState {
  return {
    fateOutOfPlaceStoreEventId: null,
    fateOutOfPlaceReleaseBonusUsedThisEnemyCycle: false,
    turningRiteAdvanceUsedThisPlayerTurn: false,
    turningRiteDeferredBeat: false,
    turningRiteFinaleBonusAppliedRootId: null,
    parallaxEchoMovementUsedThisPlayerTurn: false,
    parallaxEchoArmUsedThisPlayerTurn: false,
    parallaxEchoArmed: false,
    storedVectorProcessedRootId: null,
    tetheredOrbitArmedPartnerId: null,
    tetheredOrbitArmedAfterRootId: null,
    tetheredOrbitBonusUsedThisPlayerTurn: false,
    tectonicShiftFaultAppliedTargetIds: [],
    tectonicShiftRuptureBonusUsedThisCombatCycle: false,
    traumaVectorUsedThisCombatCycle: false,
    fatedFacetThresholdWindowKey: null,
    fatedFacetThresholdCrossedThisWindow: false,
    fatedFacetAbsorptionLineageId: null,
    fatedFacetAbsorptionStoredThisLineage: 0,
    prismaticRiteFinaleShardsRootId: null,
    prismaticRiteDeferredBeat: false,
    prismaticRiteCathedralPendingRootId: null,
    phantomFacetGenerationUsedThisPlayerTurn: false,
    phantomFacetArmed: false,
    phantomFacetArmedRootId: null,
    stillglassAbsorptionArmedThisEnemyCycle: false,
    stillglassPendingFleeting: false,
    crystalLigatureFormationUsedThisPlayerTurn: false,
    faultglassRuptureUsedThisPlayerTurn: false,
    soulglassGenerationUsedThisPlayerTurn: false,
    impactLatticeGenerationUsedThisCombatCycle: false,
  };
}

export function createDefaultConvergenceState(): Sector1ConvergenceRuntimeState {
  return {
    fatedRefrainStoreUsedThisCombatCycle: false,
    fatedRefrainBeatIiUsedThisCombatCycle: false,
    pendingBeatII: false,
    secondOutcomeStoreUsedThisCombatCycle: false,
    echoedMeasureUsedThisPlayerTurn: false,
    echoedEmpowerment: null,
    stayedSentenceNativeUsedThisCombatCycle: false,
    stayedSentenceInstinctUsedThisEnemyCycle: false,
    measuredSilenceAdvanceUsedThisPlayerTurn: false,
    measuredSilenceRetainUsedThisPlayerTurn: false,
    suspendedEchoUsedThisCombatCycle: false,
    suspendedEchoLineages: [],
    entangledFateStoredRootId: null,
    twofoldFormationUsedThisPlayerTurn: false,
    twofoldEmpowerment: null,
    ghostThreadUsedThisPlayerTurn: false,
    ghostThreadCapture: null,
    drawnTensionFleetingUsedThisPlayerTurn: false,
    sector3: createDefaultSector3ConvergenceState(),
    sector4: createDefaultSector4ConvergenceState(),
  };
}

export function resetConvergenceCombatCycle(
  state: Sector1ConvergenceRuntimeState,
): Sector1ConvergenceRuntimeState {
  return {
    ...state,
    fatedRefrainStoreUsedThisCombatCycle: false,
    fatedRefrainBeatIiUsedThisCombatCycle: false,
    secondOutcomeStoreUsedThisCombatCycle: false,
    stayedSentenceNativeUsedThisCombatCycle: false,
    suspendedEchoUsedThisCombatCycle: false,
  };
}

export function resetConvergencePlayerTurn(
  state: Sector1ConvergenceRuntimeState,
): Sector1ConvergenceRuntimeState {
  return {
    ...state,
    echoedMeasureUsedThisPlayerTurn: false,
    measuredSilenceAdvanceUsedThisPlayerTurn: false,
    measuredSilenceRetainUsedThisPlayerTurn: false,
    twofoldFormationUsedThisPlayerTurn: false,
    ghostThreadUsedThisPlayerTurn: false,
    drawnTensionFleetingUsedThisPlayerTurn: false,
    sector3: {
      ...state.sector3,
      breakingMeasureRuptureAdvancedThisPlayerTurn: false,
      echoedFaultTraceTargetsThisPlayerTurn: [],
      criticalPressureRestoreUsedThisPlayerTurn: false,
      splitSeamTransferRootId: null,
      painForetoldWakeStoreUsedThisPlayerTurn: false,
      pulseRiteOverdrawUsedThisPlayerTurn: false,
      pulseRiteFinaleCarryUsedThisPlayerTurn: false,
      phantomPainMintUsedThisPlayerTurn: false,
      heldBreathOverdrawUsedThisPlayerTurn: false,
      heldBreathEndTurnCarryUsedThisPlayerTurn: false,
      sympatheticWoundPacketUsedThisPlayerTurn: false,
      sympatheticWoundCarryUsedThisPlayerTurn: false,
      livingFaultApplyUsedThisPlayerTurn: false,
      livingFaultCarryUsedThisPlayerTurn: false,
    },
    sector4: {
      ...state.sector4,
      turningRiteAdvanceUsedThisPlayerTurn: false,
      parallaxEchoMovementUsedThisPlayerTurn: false,
      parallaxEchoArmUsedThisPlayerTurn: false,
      tetheredOrbitBonusUsedThisPlayerTurn: false,
      phantomFacetGenerationUsedThisPlayerTurn: false,
      phantomFacetArmed: false,
      phantomFacetArmedRootId: null,
      crystalLigatureFormationUsedThisPlayerTurn: false,
      faultglassRuptureUsedThisPlayerTurn: false,
      soulglassGenerationUsedThisPlayerTurn: false,
    },
  };
}

export function isCanonicalPlayerCounteredRelease(release: ReversalReleaseResult | null | undefined): boolean {
  if (!release) return false;
  if (release.packet <= 0) return false;
  if (roundCounterfateAmount(release.multiplier * 100) !== 150) return false;
  return release.reason === 'PLAYER_PREVENTED' || release.countered === true;
}

export function hydrateConvergenceState(raw: unknown): Sector1ConvergenceRuntimeState {
  const base = createDefaultConvergenceState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  const emp = row.echoedEmpowerment && typeof row.echoedEmpowerment === 'object'
    ? row.echoedEmpowerment as Record<string, unknown>
    : null;
  return {
    fatedRefrainStoreUsedThisCombatCycle: row.fatedRefrainStoreUsedThisCombatCycle === true,
    fatedRefrainBeatIiUsedThisCombatCycle: row.fatedRefrainBeatIiUsedThisCombatCycle === true,
    pendingBeatII: row.pendingBeatII === true,
    secondOutcomeStoreUsedThisCombatCycle: row.secondOutcomeStoreUsedThisCombatCycle === true,
    echoedMeasureUsedThisPlayerTurn: row.echoedMeasureUsedThisPlayerTurn === true,
    echoedEmpowerment: emp
      ? {
        sourceFinaleRootId: typeof emp.sourceFinaleRootId === 'string' ? emp.sourceFinaleRootId : null,
        armedPlayerTurn: typeof emp.armedPlayerTurn === 'number' ? emp.armedPlayerTurn : 0,
        expireOnPlayerTurnIndex: typeof emp.expireOnPlayerTurnIndex === 'number' ? emp.expireOnPlayerTurnIndex : 0,
      }
      : null,
    stayedSentenceNativeUsedThisCombatCycle: row.stayedSentenceNativeUsedThisCombatCycle === true,
    stayedSentenceInstinctUsedThisEnemyCycle: row.stayedSentenceInstinctUsedThisEnemyCycle === true,
    measuredSilenceAdvanceUsedThisPlayerTurn: row.measuredSilenceAdvanceUsedThisPlayerTurn === true,
    measuredSilenceRetainUsedThisPlayerTurn: row.measuredSilenceRetainUsedThisPlayerTurn === true,
    suspendedEchoUsedThisCombatCycle: row.suspendedEchoUsedThisCombatCycle === true,
    suspendedEchoLineages: Array.isArray(row.suspendedEchoLineages)
      ? row.suspendedEchoLineages.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const rec = entry as Record<string, unknown>;
        if (typeof rec.traceId !== 'string') return [];
        const charge = rec.chargeSource;
        return [{
          traceId: rec.traceId,
          sourceCycle: typeof rec.sourceCycle === 'number' ? rec.sourceCycle : 0,
          chargeSource: charge === 'FLEETING' || charge === 'STORM_FREE' || charge === 'STAYED_SENTENCE_FREE'
            ? charge
            : 'NATIVE',
          restored: rec.restored === true,
        }];
      })
      : [],
    entangledFateStoredRootId: typeof row.entangledFateStoredRootId === 'string' ? row.entangledFateStoredRootId : null,
    twofoldFormationUsedThisPlayerTurn: row.twofoldFormationUsedThisPlayerTurn === true,
    twofoldEmpowerment: row.twofoldEmpowerment && typeof row.twofoldEmpowerment === 'object'
      ? {
        sourceFinaleRootId: typeof (row.twofoldEmpowerment as Record<string, unknown>).sourceFinaleRootId === 'string'
          ? (row.twofoldEmpowerment as Record<string, unknown>).sourceFinaleRootId as string
          : '',
        armed: (row.twofoldEmpowerment as Record<string, unknown>).armed === true,
      }
      : null,
    ghostThreadUsedThisPlayerTurn: row.ghostThreadUsedThisPlayerTurn === true,
    ghostThreadCapture: row.ghostThreadCapture && typeof row.ghostThreadCapture === 'object'
      ? (() => {
        const cap = row.ghostThreadCapture as Record<string, unknown>;
        return {
          traceId: typeof cap.traceId === 'string' ? cap.traceId : '',
          linkGeneration: typeof cap.linkGeneration === 'number' ? cap.linkGeneration : 0,
          endpointA: typeof cap.endpointA === 'string' ? cap.endpointA : null,
          endpointB: typeof cap.endpointB === 'string' ? cap.endpointB : null,
          selfLink: cap.selfLink === true,
          portions: Array.isArray(cap.portions)
            ? cap.portions.flatMap((portion) => {
              if (!portion || typeof portion !== 'object') return [];
              const rec = portion as Record<string, unknown>;
              if (typeof rec.originalTargetId !== 'string' || typeof rec.partnerId !== 'string') return [];
              return [{
                originalTargetId: rec.originalTargetId,
                partnerId: rec.partnerId,
                amount: typeof rec.amount === 'number' ? rec.amount : 0,
              }];
            })
            : [],
        };
      })()
      : null,
    drawnTensionFleetingUsedThisPlayerTurn: row.drawnTensionFleetingUsedThisPlayerTurn === true,
    sector3: hydrateSector3(row.sector3),
    sector4: hydrateSector4(row.sector4),
  };
}

function hydrateSector4(raw: unknown): Sector4ConvergenceRuntimeState {
  const base = createDefaultSector4ConvergenceState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  return {
    fateOutOfPlaceStoreEventId: typeof row.fateOutOfPlaceStoreEventId === 'string' ? row.fateOutOfPlaceStoreEventId : null,
    fateOutOfPlaceReleaseBonusUsedThisEnemyCycle: row.fateOutOfPlaceReleaseBonusUsedThisEnemyCycle === true,
    turningRiteAdvanceUsedThisPlayerTurn: row.turningRiteAdvanceUsedThisPlayerTurn === true,
    turningRiteDeferredBeat: row.turningRiteDeferredBeat === true,
    turningRiteFinaleBonusAppliedRootId: typeof row.turningRiteFinaleBonusAppliedRootId === 'string' ? row.turningRiteFinaleBonusAppliedRootId : null,
    parallaxEchoMovementUsedThisPlayerTurn: row.parallaxEchoMovementUsedThisPlayerTurn === true,
    parallaxEchoArmUsedThisPlayerTurn: row.parallaxEchoArmUsedThisPlayerTurn === true,
    parallaxEchoArmed: row.parallaxEchoArmed === true,
    storedVectorProcessedRootId: typeof row.storedVectorProcessedRootId === 'string' ? row.storedVectorProcessedRootId : null,
    tetheredOrbitArmedPartnerId: typeof row.tetheredOrbitArmedPartnerId === 'string' ? row.tetheredOrbitArmedPartnerId : null,
    tetheredOrbitArmedAfterRootId: typeof row.tetheredOrbitArmedAfterRootId === 'string' ? row.tetheredOrbitArmedAfterRootId : null,
    tetheredOrbitBonusUsedThisPlayerTurn: row.tetheredOrbitBonusUsedThisPlayerTurn === true,
    tectonicShiftFaultAppliedTargetIds: Array.isArray(row.tectonicShiftFaultAppliedTargetIds)
      ? row.tectonicShiftFaultAppliedTargetIds.filter((id): id is string => typeof id === 'string')
      : [],
    tectonicShiftRuptureBonusUsedThisCombatCycle: row.tectonicShiftRuptureBonusUsedThisCombatCycle === true,
    traumaVectorUsedThisCombatCycle: row.traumaVectorUsedThisCombatCycle === true,
    fatedFacetThresholdWindowKey: typeof row.fatedFacetThresholdWindowKey === 'string' ? row.fatedFacetThresholdWindowKey : null,
    fatedFacetThresholdCrossedThisWindow: row.fatedFacetThresholdCrossedThisWindow === true,
    fatedFacetAbsorptionLineageId: typeof row.fatedFacetAbsorptionLineageId === 'string' ? row.fatedFacetAbsorptionLineageId : null,
    fatedFacetAbsorptionStoredThisLineage: typeof row.fatedFacetAbsorptionStoredThisLineage === 'number' ? row.fatedFacetAbsorptionStoredThisLineage : 0,
    prismaticRiteFinaleShardsRootId: typeof row.prismaticRiteFinaleShardsRootId === 'string' ? row.prismaticRiteFinaleShardsRootId : null,
    prismaticRiteDeferredBeat: row.prismaticRiteDeferredBeat === true,
    prismaticRiteCathedralPendingRootId: typeof row.prismaticRiteCathedralPendingRootId === 'string' ? row.prismaticRiteCathedralPendingRootId : null,
    phantomFacetGenerationUsedThisPlayerTurn: row.phantomFacetGenerationUsedThisPlayerTurn === true,
    phantomFacetArmed: row.phantomFacetArmed === true,
    phantomFacetArmedRootId: typeof row.phantomFacetArmedRootId === 'string' ? row.phantomFacetArmedRootId : null,
    stillglassAbsorptionArmedThisEnemyCycle: row.stillglassAbsorptionArmedThisEnemyCycle === true,
    stillglassPendingFleeting: row.stillglassPendingFleeting === true,
    crystalLigatureFormationUsedThisPlayerTurn: row.crystalLigatureFormationUsedThisPlayerTurn === true,
    faultglassRuptureUsedThisPlayerTurn: row.faultglassRuptureUsedThisPlayerTurn === true,
    soulglassGenerationUsedThisPlayerTurn: row.soulglassGenerationUsedThisPlayerTurn === true,
    impactLatticeGenerationUsedThisCombatCycle: row.impactLatticeGenerationUsedThisCombatCycle === true,
  };
}

function hydrateSector3(raw: unknown): Sector3ConvergenceRuntimeState {
  const base = createDefaultSector3ConvergenceState();
  if (!raw || typeof raw !== 'object') return base;
  const row = raw as Record<string, unknown>;
  return {
    ...base,
    brokenOutcomeWindowKey: typeof row.brokenOutcomeWindowKey === 'string' ? row.brokenOutcomeWindowKey : null,
    brokenOutcomeStoredThisWindow: row.brokenOutcomeStoredThisWindow === true,
    brokenOutcomeReleaseLineageId: typeof row.brokenOutcomeReleaseLineageId === 'string' ? row.brokenOutcomeReleaseLineageId : null,
    brokenOutcomeReleaseFaultApplied: row.brokenOutcomeReleaseFaultApplied === true,
    breakingMeasureDeferredBeat: row.breakingMeasureDeferredBeat === true,
    breakingMeasureRuptureAdvancedThisPlayerTurn: row.breakingMeasureRuptureAdvancedThisPlayerTurn === true,
    echoedFaultTraceTargetsThisPlayerTurn: Array.isArray(row.echoedFaultTraceTargetsThisPlayerTurn)
      ? row.echoedFaultTraceTargetsThisPlayerTurn.filter((id): id is string => typeof id === 'string')
      : [],
    echoedFaultEmpowerments: Array.isArray(row.echoedFaultEmpowerments)
      ? row.echoedFaultEmpowerments.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const rec = entry as Record<string, unknown>;
        if (typeof rec.targetId !== 'string') return [];
        return [{
          targetId: rec.targetId,
          armedAfterTraceId: typeof rec.armedAfterTraceId === 'string' ? rec.armedAfterTraceId : null,
        }];
      })
      : [],
    criticalPressureRestoreUsedThisPlayerTurn: row.criticalPressureRestoreUsedThisPlayerTurn === true,
    splitSeamTransferRootId: typeof row.splitSeamTransferRootId === 'string' ? row.splitSeamTransferRootId : null,
    splitSeamExtensionThroughPlayerTurn: typeof row.splitSeamExtensionThroughPlayerTurn === 'number'
      ? row.splitSeamExtensionThroughPlayerTurn
      : null,
    painForetoldWakeStoreUsedThisPlayerTurn: row.painForetoldWakeStoreUsedThisPlayerTurn === true,
    painForetoldHostileRootIds: Array.isArray(row.painForetoldHostileRootIds)
      ? row.painForetoldHostileRootIds.filter((id): id is string => typeof id === 'string')
      : [],
    pulseRiteOverdrawUsedThisPlayerTurn: row.pulseRiteOverdrawUsedThisPlayerTurn === true,
    pulseRiteFinaleCarryUsedThisPlayerTurn: row.pulseRiteFinaleCarryUsedThisPlayerTurn === true,
    phantomPainMintUsedThisPlayerTurn: row.phantomPainMintUsedThisPlayerTurn === true,
    phantomPainTraces: Array.isArray(row.phantomPainTraces)
      ? row.phantomPainTraces.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const rec = entry as Record<string, unknown>;
        if (typeof rec.traceId !== 'string') return [];
        return [{
          traceId: rec.traceId,
          wakeValueAtCommit: typeof rec.wakeValueAtCommit === 'number' ? rec.wakeValueAtCommit : 0,
          wakeGenerationId: typeof rec.wakeGenerationId === 'number' ? rec.wakeGenerationId : 0,
          sourceRootId: typeof rec.sourceRootId === 'string' ? rec.sourceRootId : '',
          restored: rec.restored === true,
        }];
      })
      : [],
    heldBreathOverdrawUsedThisPlayerTurn: row.heldBreathOverdrawUsedThisPlayerTurn === true,
    heldBreathEndTurnCarryUsedThisPlayerTurn: row.heldBreathEndTurnCarryUsedThisPlayerTurn === true,
    sympatheticWoundPacketUsedThisPlayerTurn: row.sympatheticWoundPacketUsedThisPlayerTurn === true,
    sympatheticWoundCarryUsedThisPlayerTurn: row.sympatheticWoundCarryUsedThisPlayerTurn === true,
    livingFaultApplyUsedThisPlayerTurn: row.livingFaultApplyUsedThisPlayerTurn === true,
    livingFaultCarryUsedThisPlayerTurn: row.livingFaultCarryUsedThisPlayerTurn === true,
  };
}

export function resetConvergenceEnemyCycle(
  state: Sector1ConvergenceRuntimeState,
): Sector1ConvergenceRuntimeState {
  return {
    ...state,
    stayedSentenceInstinctUsedThisEnemyCycle: false,
    sector4: {
      ...state.sector4,
      fateOutOfPlaceReleaseBonusUsedThisEnemyCycle: false,
      fatedFacetThresholdWindowKey: null,
      fatedFacetThresholdCrossedThisWindow: false,
      stillglassAbsorptionArmedThisEnemyCycle: false,
      // NOTE: "combat cycle" for Tectonic Shift / Trauma Vector / Impact Lattice matches
      // Gravemark's and Faultline's own combatCycleIndex — the real once-per-round boundary,
      // which this codebase resets at ENEMY_CYCLE_STARTED (see beginGravemarkCombatCycle /
      // beginFaultlineCombatCycle) — NOT resetConvergenceCombatCycle, which despite its name
      // fires at PLAYER_TURN_STARTED alongside the generic ONCE_PER_COMBAT_CYCLE trigger window.
      tectonicShiftFaultAppliedTargetIds: [],
      tectonicShiftRuptureBonusUsedThisCombatCycle: false,
      traumaVectorUsedThisCombatCycle: false,
      impactLatticeGenerationUsedThisCombatCycle: false,
    },
  };
}
