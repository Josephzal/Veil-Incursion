import type { Sector1ConvergenceRuntimeState } from '../../types/convergence';
import type { ReversalReleaseResult } from '../../types/counterfate';
import { roundCounterfateAmount } from './counterfateMath';

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
  };
}

export function resetConvergenceEnemyCycle(
  state: Sector1ConvergenceRuntimeState,
): Sector1ConvergenceRuntimeState {
  return {
    ...state,
    stayedSentenceInstinctUsedThisEnemyCycle: false,
  };
}
