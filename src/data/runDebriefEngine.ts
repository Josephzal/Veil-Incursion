import type { ActiveIncursionState } from '../types/game';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';
import { operationProgressPercent } from './worldStateHelpers';

export interface RunDebriefContribution {
  operationId: string | null;
  total: number;
  breakdown: string[];
}

export interface OperationDebriefPayload {
  sectorName: string;
  operationTitle: string;
  contribution: RunDebriefContribution;
  progressBefore: number;
  progressAfter: number;
  progressRequired: number;
  progressBeforePct: number;
  progressAfterPct: number;
  completed: boolean;
  completionLogLines: string[];
  credits: number;
  riftIron: number;
  residueVaulted: number;
  nextOperationTitle?: string;
}

export function computeRunOperationContribution(
  incursion: ActiveIncursionState,
): RunDebriefContribution {
  const context = incursion.runGenerationContext;
  if (!context) {
    return { operationId: null, total: 0, breakdown: [] };
  }

  const operation = context.activeOperation;
  const rules = operation.contributionRules;
  const breakdown: string[] = [];
  let total = 0;

  const add = (label: string, amount: number | undefined) => {
    if (!amount || amount <= 0) return;
    total += amount;
    breakdown.push(`${label}: +${amount}`);
  };

  add('Successful extraction', rules.successfulExtraction ?? OPERATION_CONTRIBUTION_VALUES.successfulExtraction);

  if (incursion.bossDefeated) {
    add('Depth boss suppressed', rules.defeatDepthBoss ?? OPERATION_CONTRIBUTION_VALUES.defeatDepthBoss);
  }

  const anchorProgress = incursion.anchorAssaultProgress;
  if (anchorProgress.elitesDefeated > 0) {
    const perElite = rules.defeatAnchorElite ?? OPERATION_CONTRIBUTION_VALUES.defeatAnchorElite;
    add(
      `Anchor elite${anchorProgress.elitesDefeated > 1 ? 's' : ''} neutralized (${anchorProgress.elitesDefeated})`,
      perElite * anchorProgress.elitesDefeated,
    );
  }

  if (anchorProgress.coreCleared) {
    add('Anchor core suppressed', rules.clearAnchorCore ?? OPERATION_CONTRIBUTION_VALUES.clearAnchorCore);
  }

  const echoProgress = incursion.echoRecoveryProgress;
  if (echoProgress.echoesDefeated > 0) {
    const perEcho = rules.defeatEcho ?? OPERATION_CONTRIBUTION_VALUES.defeatEcho;
    add(
      `Echo${echoProgress.echoesDefeated > 1 ? 'es' : ''} neutralized (${echoProgress.echoesDefeated})`,
      perEcho * echoProgress.echoesDefeated,
    );
  }

  return {
    operationId: operation.id,
    total,
    breakdown,
  };
}

export function buildOperationDebriefPayload(
  incursion: ActiveIncursionState,
  opts: {
    progressBefore: number;
    progressAfter: number;
    progressRequired: number;
    completed: boolean;
    completionLogLines: string[];
    credits: number;
    riftIron: number;
    residueVaulted: number;
    nextOperationTitle?: string;
  },
): OperationDebriefPayload | null {
  const context = incursion.runGenerationContext;
  if (!context) return null;

  const contribution = computeRunOperationContribution(incursion);

  return {
    sectorName: context.sectorState.displayName,
    operationTitle: context.activeOperation.title,
    contribution,
    progressBefore: opts.progressBefore,
    progressAfter: opts.progressAfter,
    progressRequired: opts.progressRequired,
    progressBeforePct: operationProgressPercent(opts.progressBefore, opts.progressRequired),
    progressAfterPct: operationProgressPercent(opts.progressAfter, opts.progressRequired),
    completed: opts.completed,
    completionLogLines: opts.completionLogLines,
    credits: opts.credits,
    riftIron: opts.riftIron,
    residueVaulted: opts.residueVaulted,
    nextOperationTitle: opts.nextOperationTitle,
  };
}
