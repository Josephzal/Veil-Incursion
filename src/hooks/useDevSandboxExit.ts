import { useCallback } from 'react';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminalNav } from '../context/TerminalNavContext';

/** Exit an isolated dev sandbox node and return to the TEST hub tab. */
export function useDevSandboxExit() {
  const { devSandboxPreset, finishDevSandbox } = useRun();
  const { goToHub } = useGameFlow();
  const { setTerminalView } = useTerminalNav();

  const isDevSandboxActive = devSandboxPreset != null;

  const exitToDevTestHub = useCallback(() => {
    if (!devSandboxPreset) return false;
    finishDevSandbox();
    goToHub();
    setTerminalView('TEST');
    return true;
  }, [devSandboxPreset, finishDevSandbox, goToHub, setTerminalView]);

  return { isDevSandboxActive, exitToDevTestHub };
}
