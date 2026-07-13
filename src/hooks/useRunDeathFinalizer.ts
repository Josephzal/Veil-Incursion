import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useCallback, useRef } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useWorldState } from '../context/WorldStateContext';
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
    activeIncursion,
    endRun,
    getRunElapsedMs,
    getLastKillingEnemyDesignation,
  } = useRun();
  const { setPendingDebrief, tickAfterRunComplete, sectors } = useWorldState();
  const { account } = usePlayerAccount();
  const { startOperationDebrief, goToHub } = useGameFlow();
  const incursionRef = useRef(activeIncursion);
  incursionRef.current = activeIncursion;

  const finalizeRunDeath = useCallback((reason: string, causeOfDeath?: string) => {
    const inc = incursionRef.current;
    const deathResources = resolveRunDeathResourceState(
      inc.cargo,
      inc.runBankedSnapshot,
      inc.runResourceLedger,
    );
    const incWithLedger: ActiveIncursionState = {
      ...inc,
      runResourceLedger: deathResources.ledger,
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
    const depth = depthFromNodesCleared(inc.nodesCleared);

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
        causeOfDeath: causeOfDeath ?? getLastKillingEnemyDesignation() ?? reason,
        sectorLevel: localLevelFromDepth(depth),
        depthLayer: getDistrictFromDepth(depth),
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
    endRun,
    getLastKillingEnemyDesignation,
    getRunElapsedMs,
    goToHub,
    setPendingDebrief,
    startOperationDebrief,
    tickAfterRunComplete,
    sectors,
    account,
  ]);

  return { finalizeRunDeath };
}
