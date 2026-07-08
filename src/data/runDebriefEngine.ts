import type { ActiveIncursionState } from '../types/game';
import type { ContractExtractionKind, ContractResult } from '../types/contract';
import type { ResourceItemId } from '../types/resourceItem';
import { resolveContractResult } from './contractResolver';
import { buildExtractedResourceSections, type DebriefResourceSection } from './runDebriefResourceEngine';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from './resourceRegistry';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';
import { operationProgressPercent } from './worldStateHelpers';

function normalizeResourceLabel(label: string): string {
  return label.toLowerCase().replace(/[\s-]/g, '');
}

function resolveTargetResourceIds(targetNames: string[] | undefined): ResourceItemId[] {
  if (!targetNames || targetNames.length === 0) return [];
  const normalizedTargets = new Set(targetNames.map(normalizeResourceLabel));
  return ALL_RESOURCE_ITEM_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    return normalizedTargets.has(normalizeResourceLabel(def.name))
      || normalizedTargets.has(normalizeResourceLabel(def.shortName));
  });
}

function countExtractedTargetResourceStacks(
  ledger: ActiveIncursionState['runResourceLedger'],
  targetNames: string[] | undefined,
): number {
  const targetIds = resolveTargetResourceIds(targetNames);
  if (targetIds.length === 0) return 0;
  return targetIds.reduce((sum, id) => sum + (ledger.extracted[id] ?? 0), 0);
}

export type RunDebriefOutcome = 'EXTRACTED' | 'FAILED';

export interface RunDebriefContribution {
  operationId: string | null;
  total: number;
  breakdown: string[];
}

export interface RunDebriefDeathStats {
  timeAliveMs: number;
  causeOfDeath: string;
  sectorLevel: number;
  depthLayer: 1 | 2 | 3;
}

export interface OperationDebriefPayload {
  runOutcome: RunDebriefOutcome;
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
  contractResult: ContractResult;
  resourceSections: DebriefResourceSection[];
  extractionKind: ContractExtractionKind;
  deathStats?: RunDebriefDeathStats;
  midRunContributionTransmitted?: number;
}

export function computeRunOperationContribution(
  incursion: ActiveIncursionState,
  opts?: { extractedSuccessfully?: boolean },
): RunDebriefContribution {
  const context = incursion.runGenerationContext;
  if (!context) {
    return { operationId: null, total: 0, breakdown: [] };
  }

  const extractedSuccessfully = opts?.extractedSuccessfully ?? true;

  const operation = context.activeOperation;
  const rules = operation.contributionRules;
  const breakdown: string[] = [];
  let total = 0;

  const add = (label: string, amount: number | undefined) => {
    if (!amount || amount <= 0) return;
    total += amount;
    breakdown.push(`${label}: +${amount}`);
  };

  add('Successful extraction', extractedSuccessfully
    ? (rules.successfulExtraction ?? OPERATION_CONTRIBUTION_VALUES.successfulExtraction)
    : undefined);

  if (incursion.bossDefeated && extractedSuccessfully) {
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

  const targetResourceStacks = countExtractedTargetResourceStacks(
    incursion.runResourceLedger,
    operation.rewardEmphasis.targetResources,
  );
  if (targetResourceStacks > 0 && extractedSuccessfully) {
    const perStack = rules.extractTargetResource ?? OPERATION_CONTRIBUTION_VALUES.extractTargetResourceStack;
    const targetLabel = operation.rewardEmphasis.targetResources?.join(', ') ?? 'target resource';
    add(
      `${targetLabel} extracted (${targetResourceStacks})`,
      perStack * targetResourceStacks,
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
    extractedSuccessfully?: boolean;
    contractResult?: ContractResult;
    extractionKind?: ContractExtractionKind;
    resourceSections?: DebriefResourceSection[];
    deathStats?: RunDebriefDeathStats;
    midRunContributionTransmitted?: number;
  },
): OperationDebriefPayload | null {
  const context = incursion.runGenerationContext;
  if (!context) return null;

  const extractedSuccessfully = opts.extractedSuccessfully ?? true;
  const contribution = computeRunOperationContribution(incursion, { extractedSuccessfully });
  const contractResult = opts.contractResult ?? resolveContractResult({
    contract: incursion.activeContract,
    ledger: incursion.runResourceLedger,
    progress: incursion.contractRunProgress,
    extractedSuccessfully,
    extractionKind: opts.extractionKind,
  });
  const resourceSections = opts.resourceSections
    ?? buildExtractedResourceSections(incursion.runResourceLedger);
  const extractionKind = opts.extractionKind
    ?? (incursion.contractRunProgress.emergencyRecallCompleted
      ? 'EMERGENCY_RECALL'
      : incursion.masterLinkUsed
        ? 'MASTER_LINK'
        : incursion.clearedSafeAnchors.length > 0
          ? 'SAFE_ANCHOR'
          : 'STANDARD');

  return {
    runOutcome: extractedSuccessfully ? 'EXTRACTED' : 'FAILED',
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
    contractResult,
    resourceSections,
    extractionKind,
    deathStats: opts.deathStats,
    midRunContributionTransmitted: opts.midRunContributionTransmitted,
  };
}
