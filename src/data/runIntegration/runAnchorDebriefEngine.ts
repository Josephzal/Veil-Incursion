import type { ActiveIncursionState } from '../../types/game';
import { getAnchorDefinition } from '../anchorRegistry';

export interface AnchorDebriefSummary {
  anchorType: string;
  anchorTheme: string;
  signalsCleared: number;
  operationTargetsCleared: number;
  pressureLines: string[];
  contributionNote: string | null;
}

export function buildAnchorDebriefSummary(incursion: ActiveIncursionState): AnchorDebriefSummary | null {
  const context = incursion.runGenerationContext;
  const anchor = context?.activeAnchor ?? context?.sectorState.activeAnchor;
  if (!anchor) return null;
  if (!anchor) return null;

  const def = getAnchorDefinition(anchor.type);
  const progress = incursion.contractRunProgress;
  const signalsCleared = progress.anchorSignalsCleared;
  const operationTargetsCleared = progress.operationTargetsCleared;

  let contributionNote: string | null = null;
  if (signalsCleared > 0) {
    contributionNote = `${signalsCleared} anchor signal(s) cleared this run.`;
  } else if (operationTargetsCleared > 0) {
    contributionNote = `${operationTargetsCleared} operation target(s) cleared under anchor pressure.`;
  } else {
    contributionNote = 'Anchor was active — no anchor signals cleared this run.';
  }

  return {
    anchorType: anchor.type.replace(/_/g, ' '),
    anchorTheme: def?.theme ?? anchor.type,
    signalsCleared,
    operationTargetsCleared,
    pressureLines: [...(def?.pressureLines ?? [])].slice(0, 2),
    contributionNote,
  };
}
