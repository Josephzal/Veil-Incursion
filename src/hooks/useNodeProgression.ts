import { useCallback } from 'react';
import { useRun } from '../context/RunContext';
import { useDescentNavigator } from './useDescentNavigator';
import { useDevSandboxExit } from './useDevSandboxExit';
import { useRunDeathFinalizer } from './useRunDeathFinalizer';

export function useNodeProgression() {
  const { runState, endRun } = useRun();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const { exitToDevTestHub } = useDevSandboxExit();
  const { finalizeRunDeath } = useRunDeathFinalizer();

  const completeCurrentNode = useCallback(
    (clearMessage: string, remainingHp?: number) => {
      if (exitToDevTestHub()) {
        return;
      }

      const hp = remainingHp ?? runState.soulAnchorIntegrity;
      if (hp <= 0) {
        finalizeRunDeath('SOUL ANCHOR DESTROYED');
        return;
      }

      finalizeIncursionAdvance(clearMessage);
    },
    [
      exitToDevTestHub,
      runState.soulAnchorIntegrity,
      finalizeRunDeath,
      finalizeIncursionAdvance,
    ],
  );

  return { completeCurrentNode };
}
