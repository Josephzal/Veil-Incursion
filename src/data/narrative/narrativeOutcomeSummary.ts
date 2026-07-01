import type { CheckStatus, NarrativeChoiceKey, NarrativeEventNode } from '../../types/game';
import type { NarrativePenalty } from '../../types/narrativeAssembly';
import type { NarrativeBonusReward } from '../../types/narrativeBonusReward';
import { NARRATIVE_BOON_CATALOG } from '../../types/narrativeBonusReward';
import {
  defaultNarrativeResolverCredits,
  resolveNarrativeCreditPayout,
} from '../combatCredits';
import { formatNarrativeBonusRewardLabel } from './narrativeBonusLoot';

export interface NarrativeOutcomeSummary {
  headline: string;
  status: 'SUCCESS' | 'FAILURE';
  outcomeLines: string[];
  rewardLines: string[];
  penaltyLines: string[];
  ambushPending: boolean;
  continueLabel: string;
}

function stripOutcomePrefix(text: string): string {
  return text.replace(/^>>\s*(?:MECHANIC SUCCESS|MECHANIC FAILURE|CABAL BYPASS|ITEM BYPASS|BRUTE FORCE)\s*—\s*/i, '').trim();
}

function triggersAmbush(text: string): boolean {
  return /ambush|combat encounter|start combat/i.test(text);
}

function formatPenalty(penalty: NarrativePenalty): string {
  if (penalty.type === 'HP') return `−${penalty.amount} Soul Anchor Integrity`;
  return `+${penalty.amount}% Veil Resonance`;
}

function hpAmountMentionedInText(text: string, amount: number): boolean {
  return new RegExp(
    `(?:cost:|[-−]?\\s*|\\+\\s*)${amount}\\s*(?:%\\s*)?(?:current\\s+|max\\s+)?hp\\b`,
    'i',
  ).test(text);
}

function resonanceAmountMentionedInText(text: string, amount: number): boolean {
  return new RegExp(
    `(?:cost:|\\+|[-−]?\\s*)${amount}\\s*(?:%\\s*)?(?:veil\\s*)?resonance\\b`,
    'i',
  ).test(text);
}

function penaltyAlreadyReflectedInOutcome(outcomeText: string, penalty: NarrativePenalty): boolean {
  if (penalty.type === 'HP') {
    return hpAmountMentionedInText(outcomeText, penalty.amount);
  }
  return resonanceAmountMentionedInText(outcomeText, penalty.amount);
}

function failurePreviewReflectedInOutcome(outcomeText: string, previewText: string): boolean {
  const normalizedOutcome = outcomeText.trim().toLowerCase();
  const normalizedPreview = previewText.trim().toLowerCase();
  if (normalizedOutcome.includes(normalizedPreview)) return true;

  const hpMatch = previewText.match(/(\d+)\s*(?:%\s*(?:current|max)\s+)?hp/i);
  if (hpMatch) {
    return hpAmountMentionedInText(outcomeText, Number(hpMatch[1]));
  }

  const resonanceMatch = previewText.match(/(\d+)\s*(?:%\s*)?(?:veil\s*)?resonance/i);
  if (resonanceMatch) {
    return resonanceAmountMentionedInText(outcomeText, Number(resonanceMatch[1]));
  }

  return false;
}

function buildSuccessRewards(
  node: NarrativeEventNode,
  choice: NarrativeChoiceKey,
  tensionBonusCredits: number,
): string[] {
  const lines: string[] = [];
  const bonusReward = node.proceduralMeta?.bonusReward;
  const baselineCredits = resolveNarrativeCreditPayout(0, 'SUCCESS');
  const totalCredits = baselineCredits + tensionBonusCredits
    + (bonusReward?.kind === 'CREDITS' ? bonusReward.amount : 0);

  if (totalCredits > 0) {
    lines.push(`+${totalCredits} Run Credits`);
    if (tensionBonusCredits > 0) {
      lines.push(`Includes +${tensionBonusCredits} salvage from tension protocol`);
    }
  }

  if (bonusReward?.kind === 'VEIL_RESIDUE') {
    lines.push(`+${bonusReward.amount} Veil Residue (containment)`);
  }
  if (bonusReward?.kind === 'BOON') {
    lines.push(`${NARRATIVE_BOON_CATALOG[bonusReward.boonId].statusLabel} — next combat`);
  }

  if (lines.length === 0 && choice !== 'D') {
    lines.push('Safe passage — node cleared');
  }

  return lines;
}

function buildFailurePenalties(
  node: NarrativeEventNode,
  failureText: string,
  outcomeText: string,
): string[] {
  const lines: string[] = [];
  const penalty = node.proceduralMeta?.defaultPenalty;
  const penaltyReflectedInOutcome = penalty
    ? penaltyAlreadyReflectedInOutcome(outcomeText, penalty)
    : false;

  if (penalty && !penaltyReflectedInOutcome) {
    lines.push(formatPenalty(penalty));
  }
  if (triggersAmbush(failureText)) {
    lines.push('Hostile ambush inbound');
  }
  if (lines.length === 0 && !penaltyReflectedInOutcome) {
    lines.push('Resolver failed — hazard applied');
  }
  return lines;
}

export function buildProceduralOutcomeSummary(
  node: NarrativeEventNode,
  choice: NarrativeChoiceKey,
  status: CheckStatus,
  options?: { tensionBonusCredits?: number },
): NarrativeOutcomeSummary {
  const tensionBonusCredits = options?.tensionBonusCredits ?? 0;
  const isSuccess = status === 'SUCCESS';
  const choiceOption = choice === 'A' ? node.choiceA
    : choice === 'B' ? node.choiceB
      : choice === 'C' ? node.choiceC
        : node.choiceD;
  const resultText = isSuccess
    ? (choiceOption?.successText ?? '>> RESOLVER SUCCESS')
    : (choiceOption?.failureText ?? '>> RESOLVER FAILURE');
  const outcomeLine = stripOutcomePrefix(resultText);
  const ambushPending = !isSuccess && choice === 'A' && triggersAmbush(node.choiceA.failureText);

  return {
    headline: isSuccess ? 'EXPEDITION RESOLVED' : 'EXPEDITION COMPROMISED',
    status: isSuccess ? 'SUCCESS' : 'FAILURE',
    outcomeLines: [outcomeLine],
    rewardLines: isSuccess && choice !== 'D'
      ? buildSuccessRewards(node, choice, tensionBonusCredits)
      : [],
    penaltyLines: isSuccess ? [] : buildFailurePenalties(node, node.choiceA.failureText, outcomeLine),
    ambushPending,
    continueLabel: ambushPending ? '[ CONTINUE — ENGAGE HOSTILES ]' : '[ CONTINUE ]',
  };
}

export function buildLegacyOutcomeSummary(
  node: NarrativeEventNode,
  choice: 'A' | 'B',
  status: CheckStatus,
): NarrativeOutcomeSummary {
  const isSuccess = status === 'SUCCESS';
  const choiceDef = choice === 'A' ? node.choiceA : node.choiceB;
  const resultText = isSuccess ? choiceDef.successText : choiceDef.failureText;
  const outcomeLine = stripOutcomePrefix(resultText);
  const ambushPending = triggersAmbush(resultText);

  const rewardLines: string[] = [];
  const penaltyLines: string[] = [];

  if (isSuccess) {
    const preview = choiceDef.effectPreview;
    if (preview?.onSuccess) rewardLines.push(preview.onSuccess);
    else if (preview?.guaranteed) rewardLines.push(preview.guaranteed);
    else rewardLines.push(`+${defaultNarrativeResolverCredits()} Run Credits`);
  } else {
    const preview = choiceDef.effectPreview;
    const failurePreviewReflected = preview?.onFailure
      ? failurePreviewReflectedInOutcome(outcomeLine, preview.onFailure)
      : false;
    if (preview?.onFailure && !failurePreviewReflected) {
      penaltyLines.push(preview.onFailure);
    }
    if (ambushPending) penaltyLines.push('Hostile ambush inbound');
    if (penaltyLines.length === 0 && !failurePreviewReflected) {
      penaltyLines.push('Calibration failed — field hazard applied');
    }
  }

  return {
    headline: isSuccess ? 'CALIBRATION SUCCESS' : 'CALIBRATION FAILURE',
    status: isSuccess ? 'SUCCESS' : 'FAILURE',
    outcomeLines: [outcomeLine],
    rewardLines,
    penaltyLines,
    ambushPending,
    continueLabel: ambushPending ? '[ CONTINUE — ENGAGE HOSTILES ]' : '[ CONTINUE ]',
  };
}

export function formatBonusLine(reward: NarrativeBonusReward | undefined): string | null {
  if (!reward) return null;
  return `[Bonus: ${formatNarrativeBonusRewardLabel(reward)}]`;
}
