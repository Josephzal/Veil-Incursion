import type {
  CompositionRunState,
  EncounterCompositionTemplateId,
  EncounterRewardTier,
  EncounterRiskLabel,
} from '../types/encounterComposition';
import { createDefaultCompositionRunState } from '../types/encounterComposition';

const RISK_RANK: Record<EncounterRiskLabel, number> = {
  LOW_RISK: 0,
  STANDARD: 1,
  ELEVATED: 2,
  HIGH_RISK: 3,
  ELITE: 4,
  APEX_WARNING: 5,
};

function pushUnique<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value];
}

export function normalizeCompositionRunState(
  state: CompositionRunState | null | undefined,
): CompositionRunState {
  return state ?? createDefaultCompositionRunState();
}

export function recordCompositionEngagement(
  state: CompositionRunState | null | undefined,
  args: {
    templateId?: EncounterCompositionTemplateId | null;
    warningShown?: boolean;
  },
): CompositionRunState {
  let next = normalizeCompositionRunState(state);
  if (args.templateId) {
    next = {
      ...next,
      templatesSeen: pushUnique(next.templatesSeen, args.templateId),
    };
  }
  if (args.warningShown) {
    next = { ...next, warningCardsShown: next.warningCardsShown + 1 };
  }
  return next;
}

export function recordCompositionCombatVictory(
  state: CompositionRunState | null | undefined,
  args: {
    templateId?: EncounterCompositionTemplateId | null;
    riskLabel?: EncounterRiskLabel | null;
    rewardTier?: EncounterRewardTier | null;
    isElite?: boolean;
    highRisk?: boolean;
    anchorSignal?: boolean;
    echoSignal?: boolean;
    highValue?: boolean;
    twistedTemplateId?: string | null;
  },
): CompositionRunState {
  let next = normalizeCompositionRunState(state);

  if (args.templateId) {
    next = {
      ...next,
      templatesSeen: pushUnique(next.templatesSeen, args.templateId),
      templatesCleared: pushUnique(next.templatesCleared, args.templateId),
    };
    if (args.templateId === 'BOSS_FORESHADOWING') {
      next = { ...next, bossForeshadowClears: next.bossForeshadowClears + 1 };
    }
  }

  if (args.riskLabel) {
    next = {
      ...next,
      riskLabelsCleared: pushUnique(next.riskLabelsCleared, args.riskLabel),
      hardestRiskCleared:
        !next.hardestRiskCleared
        || RISK_RANK[args.riskLabel] > RISK_RANK[next.hardestRiskCleared]
          ? args.riskLabel
          : next.hardestRiskCleared,
    };
    if (args.riskLabel === 'HIGH_RISK' || args.riskLabel === 'APEX_WARNING') {
      next = { ...next, highRiskClears: next.highRiskClears + 1 };
    }
    if (args.riskLabel === 'ELITE') {
      next = { ...next, eliteClears: next.eliteClears + 1 };
    }
  }

  if (args.rewardTier) {
    next = {
      ...next,
      rewardTiersCleared: pushUnique(next.rewardTiersCleared, args.rewardTier),
    };
  }

  if (args.isElite) {
    next = { ...next, eliteClears: next.eliteClears + 1 };
  }
  if (args.highRisk) {
    next = { ...next, highRiskClears: next.highRiskClears + 1 };
  }
  if (args.anchorSignal) {
    next = { ...next, anchorSignalClears: next.anchorSignalClears + 1 };
  }
  if (args.echoSignal) {
    next = { ...next, echoSignalClears: next.echoSignalClears + 1 };
  }
  if (args.highValue) {
    next = { ...next, highValueClears: next.highValueClears + 1 };
  }
  if (args.twistedTemplateId === 'FALSE_EXTRACTION_SIGNAL') {
    next = { ...next, falseExtractionSurvived: next.falseExtractionSurvived + 1 };
  }

  return next;
}
