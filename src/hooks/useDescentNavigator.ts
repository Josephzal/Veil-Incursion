import { useCallback, useRef } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useWorldState } from '../context/WorldStateContext';
import { resolveExtractionVeilResidueDeposit } from '../data/extractionPersistenceEngine';
import { resolveRunExtractionResourceState } from '../data/runResourceLedgerEngine';
import { resolveContractExtractionKind } from '../data/contractExtractionKind';
import {
  resolveContractPendingDelivery,
  resolveContractResult,
} from '../data/contractResolver';
import { computeRunOperationContribution, buildOperationDebriefPayload } from '../data/runDebriefEngine';
import { recordPendingRoutingAtExtract } from '../data/postRunCargoRoutingRunState';
import { buildExtractedResourceSections } from '../data/runDebriefResourceEngine';
import {
  buildPostRunRoutingDebriefState,
  collectPendingRoutingResourceIds,
} from '../data/postRunCargoRoutingEngine';
import { transitionActions } from '../stores/transitionStore';
import type { ActiveIncursionState } from '../types/game';
import { RunNodeType } from '../types/game';

export type DescentRoute =
  | 'NARRATIVE'
  | 'SCANNING'
  | 'SAFEHOUSE'
  | 'COMBAT'
  | 'REST'
  | 'BLACK_MARKET'
  | 'RESOURCE_HARVEST'
  | 'VEIL_BLEED_BOON'
  | 'HUB_VICTORY'
  | 'EXTRACT_SUCCESS';

function routeForNodeType(type: RunNodeType | null): DescentRoute {
  switch (type) {
    case 'ANOMALY':
    case 'NARRATIVE_EVENT':
      return 'NARRATIVE';
    case 'STANDARD_COMBAT':
    case 'ELITE_COMBAT':
    case 'BOSS_COMBAT':
      return 'COMBAT';
    case 'SANCTUARY':
      return 'REST';
    case 'BLACK_MARKET':
      return 'BLACK_MARKET';
    case 'RESOURCE_HARVEST':
      return 'RESOURCE_HARVEST';
    case 'VEIL_BLEED_BOON':
      return 'VEIL_BLEED_BOON';
    case 'EMERGENCY_EXTRACTION':
      return 'EXTRACT_SUCCESS';
    case 'SAFE_ANCHOR_EXTRACTION':
    case 'MASTER_EXTRACTION_LINK':
      return 'SCANNING';
    default:
      return 'SCANNING';
  }
}

export function useDescentNavigator() {
  const {
    activeIncursion,
    appendRunLog,
    stageEncounterClear,
    continueFromProgressCheckpoint,
    commitNodeEncounter,
    endRun,
    calculateSectorExtractionPayout,
  } = useRun();
  const {
    startNarrative,
    startScanning,
    startSafehouse,
    startCombat,
    startRest,
    startBlackMarket,
    startResourceHarvest,
    startPostCombatBoon,
    goToHub,
    startOperationDebrief,
  } = useGameFlow();
  const { addCredits, addRiftIron, grantContractRewards, persistRunExtraction, account } = usePlayerAccount();
  const {
    applyOperationContribution,
    tickAfterRunComplete,
    setPendingDebrief,
  } = useWorldState();

  const incursionRef = useRef(activeIncursion);
  incursionRef.current = activeIncursion;

  const deploySelectedVector = useCallback((nodeId: string): DescentRoute => {
    const nodeType = commitNodeEncounter(nodeId);
    const route = routeForNodeType(nodeType);

    switch (route) {
      case 'NARRATIVE':
        startNarrative();
        break;
      case 'COMBAT':
        startCombat();
        break;
      case 'REST':
        startRest();
        break;
      case 'BLACK_MARKET':
        startBlackMarket();
        break;
      case 'RESOURCE_HARVEST':
        startResourceHarvest();
        break;
      case 'VEIL_BLEED_BOON':
        startPostCombatBoon();
        break;
      case 'EXTRACT_SUCCESS':
        break;
      default:
        break;
    }

    return route;
  }, [commitNodeEncounter, startBlackMarket, startNarrative, startCombat, startRest, startResourceHarvest, startPostCombatBoon]);

  const finalizeSectorExtraction = useCallback(() => {
    transitionActions.startExtracting(() => {
      void (async () => {
        const inc = incursionRef.current;
        const extractionResources = resolveRunExtractionResourceState(
          inc.cargo,
          inc.runBankedSnapshot,
          inc.runResourceLedger,
        );
        const extractionKind = resolveContractExtractionKind(inc);
        const operation = inc.runGenerationContext?.activeOperation;
        const routingState = buildPostRunRoutingDebriefState({
          ledger: extractionResources.ledger,
          contract: inc.activeContract,
          operationObjectiveKind: operation?.objectiveKind ?? null,
          operationTargetResourceNames: operation?.rewardEmphasis.targetResources,
          operationId: operation?.id ?? null,
          contractProgress: inc.contractRunProgress,
          extractionKind,
        });
        const pendingStackCount = routingState.pendingItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const cargoRoutingRunState = recordPendingRoutingAtExtract(
          inc.cargoRoutingRunState,
          pendingStackCount,
        );
        const incWithLedger = {
          ...inc,
          runResourceLedger: extractionResources.ledger,
          cargoRoutingRunState,
        };

        const contractResult = routingState.requiresRouting
          ? resolveContractPendingDelivery({
            contract: inc.activeContract,
            ledger: extractionResources.ledger,
            progress: inc.contractRunProgress,
            extractionKind,
          })
          : resolveContractResult({
            contract: inc.activeContract,
            ledger: extractionResources.ledger,
            progress: inc.contractRunProgress,
            extractedSuccessfully: true,
            extractionKind,
          });
        const resourceSections = buildExtractedResourceSections(extractionResources.ledger);

        const { totalDeposit: residueVaulted } = resolveExtractionVeilResidueDeposit(
          extractionResources.mergedCargo,
          inc.sessionVeilResidueCollected,
        );
        persistRunExtraction({
          cargo: extractionResources.mergedCargo,
          aegisLoadout: inc.aegisLoadout,
          hexShotLoadout: inc.hexShotLoadout,
          envoyLoadout: inc.envoyLoadout,
          sessionVeilResidueCollected: inc.sessionVeilResidueCollected,
          excludeResourceIds: routingState.requiresRouting
            ? collectPendingRoutingResourceIds(routingState.pendingItems)
            : undefined,
        });
        const credits = calculateSectorExtractionPayout();
        const riftIron = Math.max(5, Math.floor(credits / 40));
        addCredits(credits);
        addRiftIron(riftIron);

        if (contractResult.status === 'SUCCESS') {
          grantContractRewards(contractResult);
          appendRunLog(
            `>> CONTRACT COMPLETE — ${contractResult.title.toUpperCase()} // +${contractResult.creditsAwarded + contractResult.bonusCreditsAwarded} CR // +${contractResult.reputationAwarded + contractResult.bonusReputationAwarded} REP`,
          );
          if (contractResult.bonusObjectiveMet && contractResult.bonusObjectiveText) {
            appendRunLog(`>> BONUS OBJECTIVE — ${contractResult.bonusObjectiveText.toUpperCase()}`);
          }
        } else if (contractResult.status === 'PENDING_DELIVERY') {
          appendRunLog(`>> CONTRACT PENDING — ${contractResult.title.toUpperCase()} // ${contractResult.progressText}`);
        } else if (contractResult.status === 'FAILED') {
          appendRunLog(`>> CONTRACT FAILED — ${contractResult.title.toUpperCase()} // ${contractResult.progressText}`);
        }

        const residueLine = residueVaulted > 0
          ? ` +${residueVaulted} VEIL RESIDUE VAULTED`
          : '';
        const lootLine = routingState.requiresRouting
          ? 'SPECIAL CARGO AWAITING ROUTING'
          : 'LOOT ROUTED TO HOME STASH';
        appendRunLog(`>> SECTOR EXTRACTION COMPLETE — +${credits} CREDITS, ${lootLine}, +${riftIron} RIFT IRON${residueLine}.`);

        const contribution = computeRunOperationContribution(incWithLedger, {
          extractedSuccessfully: true,
          deferTargetResourceCredit: routingState.requiresRouting,
        });
        let contributionResult: Awaited<ReturnType<typeof applyOperationContribution>> | null = null;
        if (contribution.operationId && contribution.total > 0) {
          contributionResult = await applyOperationContribution(contribution.operationId, contribution.total);
          contributionResult.logLines.forEach((line) => appendRunLog(line));
        }

        if (!routingState.requiresRouting) {
          tickAfterRunComplete();
        }
        endRun('SECTOR EXTRACTION SECURED');

        const debrief = buildOperationDebriefPayload(incWithLedger, {
          progressBefore: contributionResult?.progressBefore ?? inc.runGenerationContext?.activeOperation.progressCurrent ?? 0,
          progressAfter: contributionResult?.progressAfter ?? inc.runGenerationContext?.activeOperation.progressCurrent ?? 0,
          progressRequired: contributionResult?.progressRequired ?? inc.runGenerationContext?.activeOperation.progressRequired ?? 100,
          completed: contributionResult?.completed ?? false,
          completionLogLines: contributionResult?.logLines ?? [],
          credits,
          riftIron,
          residueVaulted,
          nextOperationTitle: contributionResult?.nextOperationTitle,
          extractedSuccessfully: true,
          contractResult,
          extractionKind,
          resourceSections,
          midRunContributionTransmitted: inc.operationContributionTransmitted,
          routingState,
          deferredWorldTick: routingState.requiresRouting,
          runResourceLedger: extractionResources.ledger,
          account,
        });

        if (debrief) {
          setPendingDebrief(debrief);
          startOperationDebrief();
        } else {
          goToHub();
        }
      })();
    });
    return { route: 'EXTRACT_SUCCESS' as const };
  }, [
    addCredits,
    addRiftIron,
    appendRunLog,
    applyOperationContribution,
    calculateSectorExtractionPayout,
    endRun,
    goToHub,
    grantContractRewards,
    persistRunExtraction,
    setPendingDebrief,
    startOperationDebrief,
    tickAfterRunComplete,
    account,
  ]);

  const finalizeIncursionAdvance = useCallback(
    (message: string) => {
      const result = stageEncounterClear(message);
      if (result.route === 'SAFEHOUSE') {
        startSafehouse();
        return result;
      }
      startScanning();
      return result;
    },
    [stageEncounterClear, startScanning, startSafehouse],
  );

  const continueOperation = useCallback(() => {
    const result = continueFromProgressCheckpoint();
    startScanning();
    return result;
  }, [continueFromProgressCheckpoint, startScanning]);

  const getCurrentEncounterNode = useCallback(() => {
    const inc = incursionRef.current;
    return inc.encounterPath[inc.nodesCleared] ?? null;
  }, []);

  return {
    deploySelectedVector,
    finalizeIncursionAdvance,
    finalizeSectorExtraction,
    continueOperation,
    getCurrentEncounterNode,
    isScanningHub: activeIncursion.mapMode === 'SCANNING_HUB',
  };
}
