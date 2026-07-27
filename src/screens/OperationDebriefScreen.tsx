import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import RunDebriefPopup from '../components/debrief/RunDebriefPopup';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useWorldState } from '../context/WorldStateContext';
import { ensureEconomyRunTelemetry } from '../data/economyRunTelemetryEngine';
import { createEmptyRunResourceLedger } from '../types/runResourceLedger';
import {
  buildDefaultRoutingDecisions,
  resolveFinalContractResultAfterRouting,
} from '../data/postRunCargoRoutingEngine';
import { claimRunSettlement, hasSettledRunResults } from '../data/finalizeRunResults';
import {
  buildRunDebriefKey,
  buildSettledRunResult,
} from '../data/settledRunResultEngine';
import { normalizeBreachGradeId } from '../data/breachGradeEngine';
import { operationProgressPercent } from '../data/worldStateHelpers';
import type { ContractResult } from '../types/contract';
import type { SettledRunResult } from '../types/settledRunResult';
import type { SectorId } from '../types/worldState';
import { RUN_FIELD } from '../theme/runFieldTokens';
import type { OperationDebriefPayload } from '../data/runDebriefEngine';
import { transitionActions } from '../stores/transitionStore';

/**
 * Single-page Run Debrief host.
 *
 * Settlement (routing defaults, aftermath, world tick, progression) runs exactly
 * once when the screen mounts. RETURN TO VEIL FRONT only clears state and navigates.
 */
export default function OperationDebriefScreen(): React.JSX.Element | null {
  const {
    pendingDebrief,
    setPendingDebrief,
    clearPendingDebrief,
    tickAfterRunComplete,
    applyOperationContribution,
    applyPostRunAftermath,
  } = useWorldState();
  const {
    appendHubLog,
    applyPostRunCargoRouting,
    applyBetrayalConsequences,
    grantContractRewards,
    account,
    recordCareerBalanceTelemetry,
    applyRunnerClearanceFromRun,
    applySectorAccessFromRun,
    applyBreachGradeClearFromRun,
    syncPinnedGoalsFromRun,
    applyClassRankFromRun,
    applyCabalRepFromRun,
    syncRecipeVisibilityFromStash,
  } = usePlayerAccount();
  const { goToHub } = useGameFlow();

  const [settled, setSettled] = useState<SettledRunResult | null>(null);
  const settlingRef = useRef(false);

  const applyRemainingSettlement = useCallback(async (
    payload: OperationDebriefPayload,
  ): Promise<{
    nextPayload: OperationDebriefPayload;
    contractResult: ContractResult;
  }> => {
    let nextPayload: OperationDebriefPayload = { ...payload };
    let contractResult = payload.contractResult;
    const routingState = payload.routingState ?? null;
    let routingApplied = Boolean(payload.cargoRoutingResult);
    let cargoOperationProgress = 0;

    if (routingState?.requiresRouting && !routingApplied) {
      const decisions = buildDefaultRoutingDecisions(routingState.pendingItems);
      try {
        const result = applyPostRunCargoRouting({
          decisions,
          routingState,
          autoStashAlreadyDeposited: true,
          keepsakeRuntime: payload.keepsakeRuntime,
          routingAppraisalCount: 0,
        });
        const finalContract = resolveFinalContractResultAfterRouting(
          routingState,
          result,
          decisions,
          routingState.pendingItems,
          true,
          payload.runResourceLedger,
          payload.keepsakeRuntime,
        );
        applyBetrayalConsequences({
          contractResult: finalContract,
          routingResult: result,
          routingState,
          decisions,
          playerClass: account.activeClass,
          depthReached: routingState.contractProgress.highestDepthReached,
        });
        if (finalContract.status === 'SUCCESS') {
          grantContractRewards(finalContract);
          appendHubLog(
            `>> CONTRACT PAID — ${finalContract.title.toUpperCase()} // +${finalContract.creditsAwarded + finalContract.bonusCreditsAwarded} CR`,
          );
        } else if (finalContract.betrayalSummary) {
          appendHubLog(`>> CONTRACT BETRAYAL — ${finalContract.betrayalSummary.toUpperCase()}`);
        } else if (finalContract.status === 'PENDING_DELIVERY') {
          appendHubLog(
            `>> CONTRACT AWAITING DELIVERY — ${finalContract.title.toUpperCase()} // ${finalContract.progressText}`,
          );
        }
        result.outcomeLines.forEach((line) => {
          appendHubLog(`>> CARGO ROUTING — ${line.label.toUpperCase()}`);
        });

        let nextProgressAfter = payload.progressAfter;
        let nextProgressAfterPct = payload.progressAfterPct;
        if (result.operationProgressFromCargo > 0 && routingState.operationId) {
          const contributionResult = await applyOperationContribution(
            routingState.operationId,
            result.operationProgressFromCargo,
          );
          cargoOperationProgress = result.operationProgressFromCargo;
          nextProgressAfter = contributionResult.progressAfter;
          nextProgressAfterPct = operationProgressPercent(
            contributionResult.progressAfter,
            contributionResult.progressRequired,
          );
        }

        contractResult = finalContract;
        routingApplied = true;
        nextPayload = {
          ...nextPayload,
          cargoRoutingResult: result,
          contractResult: finalContract,
          progressAfter: nextProgressAfter,
          progressAfterPct: nextProgressAfterPct,
          progressDelta: nextProgressAfter - payload.progressBefore,
          totalContributionThisRun:
            payload.totalContributionThisRun + cargoOperationProgress,
        };
      } catch (error) {
        appendHubLog(
          `>> CARGO ROUTING FAILED — ${(error instanceof Error ? error.message : 'Unknown error').toUpperCase()}`,
        );
      }
    }

    const runOutcome = nextPayload.runOutcome;
    const isFailure = runOutcome === 'FAILED';
    const sectorName = nextPayload.sectorName;
    const totalContributionThisRun = nextPayload.totalContributionThisRun;
    const completed = nextPayload.completed;
    const completionLogLines = nextPayload.completionLogLines;
    const nextOperationTitle = nextPayload.nextOperationTitle;
    const aftermathInput = nextPayload.aftermathInput;
    const deferredWorldTick = nextPayload.deferredWorldTick;
    const extractionKind = nextPayload.extractionKind;
    const runResourceLedger = nextPayload.runResourceLedger;
    const balanceTelemetry = nextPayload.balanceTelemetry;
    const breachGrade = normalizeBreachGradeId(nextPayload.breachGrade);

    appendHubLog(
      `>> RUN DEBRIEF — ${sectorName.toUpperCase()} // ${runOutcome} // +${totalContributionThisRun} OPERATION`,
    );
    if (contractResult.status === 'SUCCESS' && !routingApplied) {
      appendHubLog(
        `>> CONTRACT PAID — ${contractResult.title.toUpperCase()} // +${contractResult.creditsAwarded + contractResult.bonusCreditsAwarded} CR`,
      );
    } else if (contractResult.status === 'FAILED') {
      appendHubLog(
        `>> CONTRACT UNPAID — ${contractResult.title.toUpperCase()} // ${contractResult.progressText}`,
      );
    }
    if (completed) {
      completionLogLines.forEach((line) => appendHubLog(line));
      if (nextOperationTitle) {
        appendHubLog(`>> NEW OPERATION ACTIVE: ${nextOperationTitle.toUpperCase()}`);
      }
    }
    if (aftermathInput) {
      const aftermathLines = applyPostRunAftermath(aftermathInput);
      aftermathLines.forEach((line) => appendHubLog(`>> SECTOR AFTERMATH — ${line.toUpperCase()}`));
    }
    if (isFailure || deferredWorldTick) {
      tickAfterRunComplete();
    }

    const depthReached = Math.max(
      1,
      nextPayload.balanceTelemetry?.maxDepthReached
        ?? nextPayload.routingState?.contractProgress.highestDepthReached
        ?? 1,
    );

    const clearanceResult = applyRunnerClearanceFromRun({
      runOutcome,
      extractionKind,
      depthReached,
      contractSucceeded: contractResult.status === 'SUCCESS',
      breachGrade,
    });
    if (clearanceResult.ranksGained > 0) {
      appendHubLog(`>> RUNNER CLEARANCE — NOW RANK ${clearanceResult.newRank}`);
    }

    applySectorAccessFromRun({
      extractedSuccessfully: runOutcome === 'EXTRACTED',
      extracted: runResourceLedger?.extracted ?? {},
      lostOnDeath: runResourceLedger?.lostOnDeath ?? {},
      runSectorId: (balanceTelemetry?.sectorId as SectorId | null | undefined) ?? null,
    });

    applyBreachGradeClearFromRun({
      extractedSuccessfully: runOutcome === 'EXTRACTED',
      sectorId: (balanceTelemetry?.sectorId as SectorId | null | undefined) ?? null,
      breachGrade,
    });

    applyClassRankFromRun({
      runOutcome,
      depthReached,
      contractSucceeded: contractResult.status === 'SUCCESS',
      breachGrade,
    });

    if (contractResult.status === 'SUCCESS' && contractResult.sponsorId) {
      applyCabalRepFromRun({
        contractSucceeded: true,
        reputationAwarded:
          contractResult.reputationAwarded + contractResult.bonusReputationAwarded,
        sponsorId: contractResult.sponsorId,
        breachGrade,
      });
    }

    syncRecipeVisibilityFromStash();
    syncPinnedGoalsFromRun();

    if (balanceTelemetry) {
      recordCareerBalanceTelemetry(balanceTelemetry, {
        run: {
          ...ensureEconomyRunTelemetry(nextPayload.economyRunTelemetry),
          recipesNewlyCraftable:
            nextPayload.craftingOpportunities?.newlyCraftable?.length ?? 0,
        },
        ledger: nextPayload.runResourceLedger ?? createEmptyRunResourceLedger(),
      });
    }

    nextPayload = {
      ...nextPayload,
      settlementComplete: true,
    };

    return { nextPayload, contractResult };
  }, [
    account.activeClass,
    appendHubLog,
    applyBetrayalConsequences,
    applyBreachGradeClearFromRun,
    applyCabalRepFromRun,
    applyClassRankFromRun,
    applyOperationContribution,
    applyPostRunAftermath,
    applyPostRunCargoRouting,
    applyRunnerClearanceFromRun,
    applySectorAccessFromRun,
    grantContractRewards,
    recordCareerBalanceTelemetry,
    syncPinnedGoalsFromRun,
    syncRecipeVisibilityFromStash,
    tickAfterRunComplete,
  ]);

  useEffect(() => {
    if (!pendingDebrief || settlingRef.current) return;

    const runKey = buildRunDebriefKey(pendingDebrief);

    const finishWithPayload = (
      payload: OperationDebriefPayload,
      contractResult?: ContractResult,
    ) => {
      setSettled(buildSettledRunResult(payload, { contractResult }));
    };

    if (pendingDebrief.settlementComplete || hasSettledRunResults(runKey)) {
      finishWithPayload(pendingDebrief);
      return;
    }

    if (!claimRunSettlement(runKey)) {
      finishWithPayload(pendingDebrief);
      return;
    }

    settlingRef.current = true;
    void (async () => {
      try {
        const { nextPayload, contractResult } = await applyRemainingSettlement(pendingDebrief);
        setPendingDebrief(nextPayload);
        finishWithPayload(nextPayload, contractResult);
      } catch (error) {
        appendHubLog(
          `>> DEBRIEF SETTLEMENT ERROR — ${(error instanceof Error ? error.message : 'Unknown').toUpperCase()}`,
        );
        const fallback = { ...pendingDebrief, settlementComplete: true };
        setPendingDebrief(fallback);
        finishWithPayload(fallback);
      } finally {
        settlingRef.current = false;
      }
    })();
  }, [pendingDebrief, applyRemainingSettlement, setPendingDebrief, appendHubLog]);

  const handleReturn = useCallback(() => {
    const navigateHome = () => {
      clearPendingDebrief();
      goToHub();
    };
    const started = transitionActions.startExtracting(navigateHome, { x: 0.5, y: 0.5 });
    if (!started) {
      navigateHome();
    }
  }, [clearPendingDebrief, goToHub]);

  if (!pendingDebrief) {
    return null;
  }

  if (!settled) {
    return (
      <View
        style={styles.loading}
        {...({ [RUN_FIELD.scopeAttr]: RUN_FIELD.scopeValue } as object)}
      >
        <ActivityIndicator color={RUN_FIELD.mint} />
      </View>
    );
  }

  return (
    <RunDebriefPopup
      result={settled}
      onReturnToVeilFront={handleReturn}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: `rgba(5, 9, 10, ${RUN_FIELD.environmentScrim})`,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
