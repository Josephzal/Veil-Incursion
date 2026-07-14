import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useCallback, useRef } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useWorldState } from '../context/WorldStateContext';
import { createDefaultBalanceRunStats } from '../data/balance/balanceRunStats';
import { resolveContractExtractionKind } from '../data/contractExtractionKind';
import { resolveContractResult } from '../data/contractResolver';
import { buildOperationDebriefPayload } from '../data/runDebriefEngine';
import { buildDeathResourceSections } from '../data/runDebriefResourceEngine';
import { resolveRunDeathResourceState } from '../data/runResourceLedgerEngine';
import {
  depthFromNodesCleared,
  getDistrictFromDepth,
  localLevelFromDepth,
} from '../data/districtPacing';
import type { ActiveIncursionState } from '../types/game';

export function useRunDeathFinalizer() {
  const {
    peekActiveIncursion,
    endRun,
    getRunElapsedMs,
    getLastKillingEnemyDesignation,
  } = useRun();
  const { setPendingDebrief, tickAfterRunComplete, sectors } = useWorldState();
  const { account } = usePlayerAccount();
  const { startOperationDebrief, goToHub } = useGameFlow();

  const finalizeRunDeath = useCallback((reason: string, causeOfDeath?: string) => {
    const inc = peekActiveIncursion();
    const deathResources = resolveRunDeathResourceState(
      inc.cargo,
      inc.runBankedSnapshot,
      inc.runResourceLedger,
    );
    const depth = depthFromNodesCleared(inc.nodesCleared);
    const deathDistrict = getDistrictFromDepth(depth);
    const resolvedCause = causeOfDeath ?? getLastKillingEnemyDesignation() ?? reason;
    const balanceStats = inc.balanceRunStats ?? createDefaultBalanceRunStats();
    const incWithLedger: ActiveIncursionState = {
      ...inc,
      runResourceLedger: deathResources.ledger,
      balanceRunStats: {
        ...balanceStats,
        deathCause: resolvedCause,
        deathDistrict,
      },
    };
    const extractionKind = resolveContractExtractionKind(inc);
    const contractResult = resolveContractResult({
      contract: inc.activeContract,
      ledger: deathResources.ledger,
      progress: inc.contractRunProgress,
      extractedSuccessfully: false,
      extractionKind,
    });
    const operation = inc.runGenerationContext?.activeOperation;
    const sectorId = inc.runGenerationContext?.sectorState.id;
    const liveSector = sectorId ? sectors.find((sector) => sector.id === sectorId) : undefined;
    const progressCurrent = liveSector?.activeOperation.progressCurrent
      ?? operation?.progressCurrent
      ?? 0;
    const progressRequired = operation?.progressRequired ?? 100;

    const debrief = buildOperationDebriefPayload(incWithLedger, {
      progressBefore: progressCurrent,
      progressAfter: progressCurrent,
      progressRequired,
      completed: false,
      completionLogLines: [],
      credits: 0,
      riftIron: 0,
      residueVaulted: 0,
      extractedSuccessfully: false,
      contractResult,
      extractionKind,
      resourceSections: buildDeathResourceSections(deathResources.ledger),
      midRunContributionTransmitted: inc.operationContributionTransmitted,
      deathStats: {
        timeAliveMs: getRunElapsedMs() ?? 0,
        causeOfDeath: resolvedCause,
        sectorLevel: localLevelFromDepth(depth),
        depthLayer: deathDistrict,
      },
      account,
    });

    endRun(reason);

    if (debrief) {
      setPendingDebrief(debrief);
      startOperationDebrief();
      return;
    }

    tickAfterRunComplete();
    goToHub();
  }, [
    account,
    endRun,
    getLastKillingEnemyDesignation,
    getRunElapsedMs,
    goToHub,
    peekActiveIncursion,
    sectors,
    setPendingDebrief,
    startOperationDebrief,
    tickAfterRunComplete,
  ]);

  return { finalizeRunDeath };
}
