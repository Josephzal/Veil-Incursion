import { useCallback, useMemo } from 'react';
import { useRun } from '../context/RunContext';
import {
  ConditionalBranchPreview,
  hasCollectedFlag,
  resolveConditionalBranchPreview,
} from '../data/macroStoryPipeline';
import type { IncursionProgressState } from '../types/game';

export interface IncursionProgressSelectors {
  progress: IncursionProgressState;
  collectedFlags: readonly string[];
  flagCount: number;
  macroStoryId: string | null;
  runMode: IncursionProgressState['macroStory']['runMode'];
  hasFlag: (flag: string) => boolean;
  getConditionalPreview: (matrixEventId: string) => ConditionalBranchPreview | null;
}

/**
 * Narrow subscription to incursion progress — avoids spreading full ActiveIncursionState
 * into narrative UI trees and keeps flag checks referentially stable between flag writes.
 */
export function useIncursionProgress(): IncursionProgressSelectors {
  const { activeIncursion } = useRun();
  const progress = activeIncursion.progress;

  const flagKey = progress.collectedFlags.join('\u0001');

  const collectedFlags = useMemo(
    () => progress.collectedFlags,
    [flagKey],
  );

  const flagSet = useMemo(() => new Set(collectedFlags), [flagKey]);

  const hasFlag = useCallback((flag: string) => flagSet.has(flag), [flagSet]);

  const getConditionalPreview = useCallback(
    (matrixEventId: string) => resolveConditionalBranchPreview(matrixEventId, collectedFlags),
    [flagKey],
  );

  return useMemo(
    () => ({
      progress,
      collectedFlags,
      flagCount: collectedFlags.length,
      macroStoryId: progress.macroStory.macroStoryId,
      runMode: progress.macroStory.runMode,
      hasFlag,
      getConditionalPreview,
    }),
    [
      progress,
      collectedFlags,
      flagKey,
      progress.macroStory.runMode,
      progress.macroStory.macroStoryId,
      hasFlag,
      getConditionalPreview,
    ],
  );
}

export { hasCollectedFlag };
