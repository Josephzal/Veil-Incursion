import { useCallback, useRef } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { RunNodeType } from '../types/game';

export type DescentRoute =
  | 'NARRATIVE'
  | 'SCANNING'
  | 'COMBAT'
  | 'REST'
  | 'BLACK_MARKET'
  | 'HUB_VICTORY'
  | 'DEPTH_ADVANCE'

function routeForNodeType(type: RunNodeType | null): DescentRoute {
  switch (type) {
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
  } = useRun();
  const { startNarrative, startScanning, startCombat, startRest, startBlackMarket, goToHub } =
    useGameFlow();
  const { addCredits, addRiftIron } = usePlayerAccount();

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
      default:
        break;
    }

    return route;
  }, [commitNodeEncounter, startBlackMarket, startNarrative, startCombat, startRest]);

  const finalizeIncursionAdvance = useCallback(
    (message: string) => {
      const result = stageEncounterClear(message);

      if (result.route === 'HUB_VICTORY') {
        addCredits(500);
        addRiftIron(10);
        appendRunLog('>> VEIL DESCENT COMPLETE — +500 CREDITS, +10 RIFT IRON AWARDED.');
        endRun('THREE-DEPTH INCURSION SECURED');
        goToHub();
        return result;
      }

      startScanning();
      return result;
    },
    [
      stageEncounterClear,
      addCredits,
      addRiftIron,
      appendRunLog,
      endRun,
      goToHub,
      startScanning,
    ],
  );

  const continueOperation = useCallback(() => {
    const result = continueFromProgressCheckpoint();

    if (result.route === 'HUB_VICTORY') {
      addCredits(500);
      addRiftIron(10);
      appendRunLog('>> VEIL DESCENT COMPLETE — +500 CREDITS, +10 RIFT IRON AWARDED.');
      endRun('THREE-DEPTH INCURSION SECURED');
      goToHub();
      return result;
    }

    startScanning();
    return result;
  }, [
    continueFromProgressCheckpoint,
    addCredits,
    addRiftIron,
    appendRunLog,
    endRun,
    goToHub,
    startScanning,
  ]);

  const getCurrentEncounterNode = useCallback(() => {
    const inc = incursionRef.current;
    return inc.encounterPath[inc.currentEncounterIndex] ?? null;
  }, []);

  return {
    deploySelectedVector,
    finalizeIncursionAdvance,
    continueOperation,
    getCurrentEncounterNode,
    isScanningHub: activeIncursion.mapMode === 'SCANNING_HUB',
  };
}
