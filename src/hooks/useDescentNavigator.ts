import { useCallback, useRef } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { resolveExtractionVeilResidueDeposit } from '../data/extractionPersistenceEngine';
import { transitionActions } from '../stores/transitionStore';
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
  | 'EXTRACT_SUCCESS'

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
  } = useGameFlow();
  const { addCredits, addRiftIron, persistRunExtraction } = usePlayerAccount();

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
      const inc = incursionRef.current;
      const { totalDeposit: residueVaulted } = resolveExtractionVeilResidueDeposit(
        inc.cargo,
        inc.sessionVeilResidueCollected,
      );
      persistRunExtraction({
        cargo: inc.cargo,
        aegisLoadout: inc.aegisLoadout,
        hexShotLoadout: inc.hexShotLoadout,
        envoyLoadout: inc.envoyLoadout,
        sessionVeilResidueCollected: inc.sessionVeilResidueCollected,
      });
      const credits = calculateSectorExtractionPayout();
      const riftIron = Math.max(5, Math.floor(credits / 40));
      addCredits(credits);
      addRiftIron(riftIron);
      const residueLine = residueVaulted > 0
        ? ` +${residueVaulted} VEIL RESIDUE VAULTED`
        : '';
      appendRunLog(`>> SECTOR EXTRACTION COMPLETE — +${credits} CREDITS, LOOT ROUTED TO HOME STASH, +${riftIron} RIFT IRON${residueLine}.`);
      endRun('SECTOR EXTRACTION SECURED');
      goToHub();
    });
    return { route: 'EXTRACT_SUCCESS' as const };
  }, [addCredits, addRiftIron, appendRunLog, calculateSectorExtractionPayout, endRun, goToHub, persistRunExtraction]);

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
