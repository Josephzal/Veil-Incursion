import { useCallback } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { TOTAL_RUN_NODES } from '../types/run';

export function useNodeProgression() {
  const { runState, advanceNode, appendRunLog, endRun, generatePathDeck } = useRun();
  const { startPathChoice, startRunComplete, goToWelcome } = useGameFlow();

  const completeCurrentNode = useCallback(
    (clearMessage: string, remainingHp?: number) => {
      const clearedNodeNum = runState.currentNode + 1;
      appendRunLog(`>> Node ${clearedNodeNum} Clear. ${clearMessage}`);

      const hp = remainingHp ?? runState.soulAnchorIntegrity;
      if (hp <= 0) {
        endRun('SOUL ANCHOR DESTROYED');
        goToWelcome();
        return;
      }

      const { hasNext, completedCount } = advanceNode();

      if (!hasNext || completedCount >= TOTAL_RUN_NODES) {
        appendRunLog('>> ALL NODES SECURED — RUN COMPLETE.');
        startRunComplete();
        return;
      }

      generatePathDeck(completedCount, runState.combatNodesCleared);
      appendRunLog(`>> Regional path matrix unlocked — select route to Node ${completedCount + 1}.`);
      startPathChoice();
    },
    [
      runState.currentNode,
      runState.soulAnchorIntegrity,
      runState.combatNodesCleared,
      appendRunLog,
      advanceNode,
      generatePathDeck,
      endRun,
      goToWelcome,
      startPathChoice,
      startRunComplete,
    ],
  );

  return { completeCurrentNode };
}
