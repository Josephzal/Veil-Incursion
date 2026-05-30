import { useCallback } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { TOTAL_RUN_NODES } from '../types/run';

export function useNodeProgression() {
  const { runState, advanceNode, appendRunLog, endRun, beginScanSession } = useRun();
  const { startScanning, startRunComplete, startGameOver } = useGameFlow();

  const completeCurrentNode = useCallback(
    (clearMessage: string, remainingHp?: number) => {
      const clearedNodeNum = runState.currentNode + 1;
      appendRunLog(`>> Node ${clearedNodeNum} Clear. ${clearMessage}`);

      const hp = remainingHp ?? runState.soulAnchorIntegrity;
      if (hp <= 0) {
        endRun('SOUL ANCHOR DESTROYED');
        startGameOver();
        return;
      }

      const { hasNext, completedCount } = advanceNode();

      if (!hasNext || completedCount >= TOTAL_RUN_NODES) {
        appendRunLog('>> ALL NODES SECURED — RUN COMPLETE.');
        startRunComplete();
        return;
      }

      appendRunLog(`>> Anomaly sweep authorized — select route to Node ${completedCount + 1}.`);
      beginScanSession();
      startScanning();
    },
    [
      runState.currentNode,
      runState.soulAnchorIntegrity,
      appendRunLog,
      advanceNode,
      endRun,
      beginScanSession,
      startScanning,
      startRunComplete,
      startGameOver,
    ],
  );

  return { completeCurrentNode };
}
