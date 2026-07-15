import type { ActiveIncursionState } from '../../types/game';
import { MODIFIER_ADJECTIVES } from '../anchorTypeMetadata';
import { getAnchorDefinition } from '../anchorRegistry';
import { getResourceDefinition } from '../resourceRegistry';

export interface AnchorDebriefSummary {
  anchorType: string;
  anchorDisplayName: string;
  anchorModifier: string | null;
  anchorTheme: string;
  signalsCleared: number;
  operationTargetsCleared: number;
  pressureLines: string[];
  contributionNote: string | null;
  suppressedAnchorName: string | null;
  suppressedRunsRemaining: number | null;
  newAnchorName: string | null;
}

export function buildAnchorDebriefSummary(incursion: ActiveIncursionState): AnchorDebriefSummary | null {
  const context = incursion.runGenerationContext;
  const anchor = context?.activeAnchor ?? context?.sectorState.activeAnchor;
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

  const modifierLabel = anchor.modifier ? MODIFIER_ADJECTIVES[anchor.modifier] : null;
  const resourceHint = anchor.resourceBias?.length
    ? anchor.resourceBias.slice(0, 3).map((id) => getResourceDefinition(id).shortName).join(', ')
    : null;

  const pressureLines = [...(def?.pressureLines ?? [])].slice(0, 2);
  if (modifierLabel) {
    pressureLines.unshift(`${modifierLabel} anchor pressure`);
  }
  if (resourceHint) {
    pressureLines.push(`Likely rewards: ${resourceHint}`);
  }

  return {
    anchorType: anchor.type.replace(/_/g, ' '),
    anchorDisplayName: anchor.displayName,
    anchorModifier: modifierLabel,
    anchorTheme: def?.theme ?? anchor.type,
    signalsCleared,
    operationTargetsCleared,
    pressureLines,
    contributionNote,
    suppressedAnchorName: null,
    suppressedRunsRemaining: null,
    newAnchorName: null,
  };
}

export function enrichAnchorDebriefWithRotation(
  summary: AnchorDebriefSummary,
  opts: {
    suppressedAnchorName?: string | null;
    suppressedRunsRemaining?: number | null;
    newAnchorName?: string | null;
  },
): AnchorDebriefSummary {
  return {
    ...summary,
    suppressedAnchorName: opts.suppressedAnchorName ?? summary.suppressedAnchorName,
    suppressedRunsRemaining: opts.suppressedRunsRemaining ?? summary.suppressedRunsRemaining,
    newAnchorName: opts.newAnchorName ?? summary.newAnchorName,
  };
}
