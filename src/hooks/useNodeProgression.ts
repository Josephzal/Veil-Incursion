import { useCallback } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useDescentNavigator } from './useDescentNavigator';

export function useNodeProgression() {
  const { runState, appendRunLog, endRun } = useRun();
  const { startGameOver } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();

  const completeCurrentNode = useCallback(
    (clearMessage: string, remainingHp?: number) => {
      const hp = remainingHp ?? runState.soulAnchorIntegrity;
      if (hp <= 0) {
        endRun('SOUL ANCHOR DESTROYED');
        startGameOver();
        return;
      }

      finalizeIncursionAdvance(clearMessage);
    },
    [
      runState.soulAnchorIntegrity,
      appendRunLog,
      endRun,
      startGameOver,
      finalizeIncursionAdvance,
    ],
  );

  return { completeCurrentNode };
}
