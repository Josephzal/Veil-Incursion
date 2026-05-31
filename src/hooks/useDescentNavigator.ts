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
  | 'HUB_VICTORY'
  | 'TIER_ADVANCE'
  | 'CHECKPOINT';

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
  const { startNarrative, startScanning, startCombat, startRest, startRunProgress, goToHub } =
    useGameFlow();
  const { addCredits, addRiftIron } = usePlayerAccount();

  const incursionRef = useRef(activeIncursion);
  incursionRef.current = activeIncursion;

  const deploySelectedVector = useCallback((): DescentRoute => {
    const nodeType = commitNodeEncounter();
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
      default:
        break;
    }

    return route;
  }, [commitNodeEncounter, startNarrative, startCombat, startRest]);

  const finalizeIncursionAdvance = useCallback(
    (message: string) => {
      stageEncounterClear(message);
      startRunProgress();
      return { route: 'CHECKPOINT' as const };
    },
    [stageEncounterClear, startRunProgress],
  );

  const continueOperation = useCallback(() => {
    const result = continueFromProgressCheckpoint();

    if (result.route === 'HUB_VICTORY') {
      addCredits(500);
      addRiftIron(10);
      appendRunLog('>> VEIL DESCENT COMPLETE — +500 CREDITS, +10 RIFT IRON AWARDED.');
      endRun('THREE-TIER INCURSION SECURED');
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

  const getCurrentTierNode = useCallback(() => {
    const inc = incursionRef.current;
    return inc.tierNodes[inc.currentNodeIndex] ?? null;
  }, []);

  return {
    deploySelectedVector,
    finalizeIncursionAdvance,
    continueOperation,
    getCurrentTierNode,
    isScanningHub: activeIncursion.mapMode === 'SCANNING_HUB',
  };
}
