import { useCallback } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useDescentNavigator } from './useDescentNavigator';
import { useDevSandboxExit } from './useDevSandboxExit';

export function useNodeProgression() {
  const { runState, appendRunLog, endRun } = useRun();
  const { startGameOver } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const { exitToDevTestHub } = useDevSandboxExit();

  const completeCurrentNode = useCallback(
    (clearMessage: string, remainingHp?: number) => {
      if (exitToDevTestHub()) {
        return;
      }

      const hp = remainingHp ?? runState.soulAnchorIntegrity;
      if (hp <= 0) {
        endRun('SOUL ANCHOR DESTROYED');
        startGameOver();
        return;
      }

      finalizeIncursionAdvance(clearMessage);
    },
    [
      exitToDevTestHub,
      runState.soulAnchorIntegrity,
      appendRunLog,
      endRun,
      startGameOver,
      finalizeIncursionAdvance,
    ],
  );

  return { completeCurrentNode };
}
