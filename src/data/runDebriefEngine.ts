import type { ActiveIncursionState } from '../types/game';
import type { ActiveRunContract, ContractExtractionKind, ContractResult } from '../types/contract';
import type { ResourceItemId } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import { resolveContractResult } from './contractResolver';
import {
  buildExtractedResourceSections,
  type DebriefResourceSection,
} from './runDebriefResourceEngine';
import type { UnstableCargoDebriefSummary } from './runDebriefUnstableCargoEngine';
import { buildUnstableCargoDebriefSummary } from './runDebriefUnstableCargoEngine';
import type { EchoDebriefSummary } from './runDebriefEchoEngine';
import { buildEchoDebriefSummary } from './runDebriefEchoEngine';
import type { ExtractCargoRoutingDebriefSummary } from './runDebriefCargoRoutingEngine';
import { buildExtractCargoRoutingDebriefSummary } from './runDebriefCargoRoutingEngine';
import { buildKeepsakeDebriefSummary } from './runDebriefKeepsakeEngine';
import { buildRunItemDebriefSummary } from './runDebriefRunItemEngine';
import { resolveKeepsakeBankedResourceMultiplier } from './expeditionKeepsakeSafehouseEngine';
import { buildAnchorDebriefSummary } from './runIntegration/runAnchorDebriefEngine';
import type { AnchorDebriefSummary } from './runIntegration/runAnchorDebriefEngine';
import {
  buildRunBalanceTelemetry,
  applyTelemetryContractOutcome,
  type RunBalanceTelemetry,
} from './runIntegration/runBalanceTelemetryEngine';
import {
  resolveRunOutcomeDetail,
  type RunOutcomeDetail,
} from './runIntegration/runOutcomeDetailEngine';
import {
  buildCraftingOpportunitySummary,
  type CraftingOpportunitySummary,
} from './runIntegration/runCraftingOpportunityEngine';
import { sumLedgerCategoryTotals } from './runIntegration/runIntegrationHelpers';
import type { PlayerAccount } from '../types/game';
import type { KeepsakeDebriefSummary } from '../types/expeditionKeepsake';
import type { RunItemDebriefSummary } from '../types/runItem';
import type { PostRunRoutingDebriefState, CargoRoutingResult } from '../types/postRunCargoRouting';
import { createDefaultEchoRunState, ECHO_OPERATION_PROGRESS } from './echoRunState';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from './resourceRegistry';
import {
  MAX_OPERATION_TARGET_RESOURCE_STACKS_PER_RUN,
  MAX_SAFEHOUSE_BANK_CONTRIBUTION_ACTIONS,
  OPERATION_CONTRIBUTION_VALUES,
  operationProgressPercent,
} from './worldStateHelpers';
import { computeTotalContributionThisRun } from '../utils/operationDebriefUi';
import { resolveContractExtractionKind } from './contractExtractionKind';

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
  progressDelta: number;
  totalContributionThisRun: number;
  completed: boolean;
  completionLogLines: string[];
  credits: number;
  riftIron: number;
  residueVaulted: number;
  nextOperationTitle?: string;
  contractResult: ContractResult;
  activeContract: ActiveRunContract | null;
  resourceSections: DebriefResourceSection[];
  unstableCargoSummary: UnstableCargoDebriefSummary | null;
  echoSummary: EchoDebriefSummary | null;
  cargoRoutingSummary: ExtractCargoRoutingDebriefSummary | null;
  extractionKind: ContractExtractionKind;
  deathStats?: RunDebriefDeathStats;
  midRunContributionTransmitted?: number;
  routingState?: PostRunRoutingDebriefState | null;
  cargoRoutingResult?: CargoRoutingResult | null;
  deferredWorldTick?: boolean;
  runResourceLedger?: RunResourceLedger;
  cargoRoutingRunState?: import('./postRunCargoRoutingRunState').CargoRoutingRunState | null;
  keepsakeSummary: KeepsakeDebriefSummary | null;
  keepsakeRuntime: import('../types/expeditionKeepsake').KeepsakeRuntime | null;
  runItemSummary: RunItemDebriefSummary | null;
  runOutcomeDetail: RunOutcomeDetail;
  anchorSummary: AnchorDebriefSummary | null;
  balanceTelemetry: RunBalanceTelemetry;
  craftingOpportunities: CraftingOpportunitySummary;
}

export function computeRunOperationContribution(
  incursion: ActiveIncursionState,
  opts?: {
    extractedSuccessfully?: boolean;
    extractionKind?: ContractExtractionKind;
    /** When true, target-resource stack credit waits for post-run cargo routing. */
    deferTargetResourceCredit?: boolean;
  },
): RunDebriefContribution {
  const context = incursion.runGenerationContext;
  if (!context) {
    return { operationId: null, total: 0, breakdown: [] };
  }

  const extractedSuccessfully = opts?.extractedSuccessfully ?? true;
  const extractionKind = opts?.extractionKind
    ?? (incursion.contractRunProgress.emergencyRecallCompleted
      ? 'EMERGENCY_RECALL'
      : incursion.masterLinkUsed
        ? 'MASTER_LINK'
        : incursion.clearedSafeAnchors.length > 0
          ? 'SAFE_ANCHOR'
          : 'STANDARD');

  const operation = context.activeOperation;
  const rules = operation.contributionRules;
  const breakdown: string[] = [];
  let total = 0;

  const add = (label: string, amount: number | undefined) => {
    if (!amount || amount <= 0) return;
    total += amount;
    breakdown.push(`${label}: +${amount}`);
  };

  if (extractedSuccessfully) {
    if (
      extractionKind === 'EMERGENCY_RECALL'
      && rules.emergencyRecallExtraction
    ) {
      add(
        'Emergency recall extraction',
        rules.emergencyRecallExtraction
          ?? OPERATION_CONTRIBUTION_VALUES.emergencyRecallExtraction,
      );
    } else if (rules.successfulExtraction) {
      add(
        'Successful extraction',
        rules.successfulExtraction ?? OPERATION_CONTRIBUTION_VALUES.successfulExtraction,
      );
    }
  }

  if (rules.bankAtSafehouse && extractedSuccessfully) {
    const bankActions = incursion.runResourceLedger.safehouseBankActions ?? 0;
    const creditedActions = Math.min(bankActions, MAX_SAFEHOUSE_BANK_CONTRIBUTION_ACTIONS);
    if (creditedActions > 0) {
      const perAction = rules.bankAtSafehouse ?? OPERATION_CONTRIBUTION_VALUES.bankAtSafehouse;
      add(
        `Cargo banked at safehouse (${creditedActions})`,
        perAction * creditedActions,
      );
    }
  }

  if (incursion.bossDefeated && extractedSuccessfully) {
    add('Depth boss suppressed', rules.defeatDepthBoss ?? OPERATION_CONTRIBUTION_VALUES.defeatDepthBoss);
  }

  if (rules.defeatElite && extractedSuccessfully) {
    const eliteKills = incursion.contractRunProgress.eliteKills;
    if (eliteKills > 0) {
      const perElite = rules.defeatElite ?? OPERATION_CONTRIBUTION_VALUES.defeatElite;
      add(
        `Elite${eliteKills > 1 ? 's' : ''} suppressed (${eliteKills})`,
        perElite * eliteKills,
      );
    }
  }

  const anchorProgress = incursion.anchorAssaultProgress;
  if (rules.defeatAnchorElite && anchorProgress.elitesDefeated > 0) {
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
  const echoState = incursion.echoRunState ?? createDefaultEchoRunState();
  const isEchoRecovery = operation.objectiveKind === 'ECHO_RECOVERY';

  if (isEchoRecovery && extractedSuccessfully) {
    const addEchoEvent = (label: string, count: number, perEvent: number) => {
      if (count <= 0 || perEvent <= 0) return;
      add(label, perEvent * count);
    };
    addEchoEvent(
      'Fallen runner imprint looted',
      echoState.fallenEchoesLooted,
      ECHO_OPERATION_PROGRESS.resolveFallenRunner,
    );
    addEchoEvent(
      'Fallen runner stabilized',
      echoState.echoesStabilized,
      ECHO_OPERATION_PROGRESS.stabilizeEcho,
    );
    addEchoEvent(
      'Hostile echo defeated',
      echoState.hostileEchoesDefeated,
      ECHO_OPERATION_PROGRESS.defeatHostileEcho,
    );
    addEchoEvent(
      'Echo cargo recovered',
      echoState.cargoEchoesRecovered,
      ECHO_OPERATION_PROGRESS.recoverEchoCargo,
    );
    addEchoEvent(
      'Extraction echo used',
      echoState.extractionEchoesUsed,
      ECHO_OPERATION_PROGRESS.extractionEchoUsed,
    );
  } else if (rules.defeatEcho && echoProgress.echoesDefeated > 0 && extractedSuccessfully) {
    const perEcho = rules.defeatEcho;
    add(
      `Echo${echoProgress.echoesDefeated > 1 ? 'es' : ''} neutralized (${echoProgress.echoesDefeated})`,
      perEcho * echoProgress.echoesDefeated,
    );
  }

  const targetResourceStacks = countExtractedTargetResourceStacks(
    incursion.runResourceLedger,
    operation.rewardEmphasis.targetResources,
  );
  if (
    targetResourceStacks > 0
    && extractedSuccessfully
    && rules.extractTargetResource
    && !opts?.deferTargetResourceCredit
  ) {
    const creditedStacks = Math.min(
      targetResourceStacks,
      MAX_OPERATION_TARGET_RESOURCE_STACKS_PER_RUN,
    );
    const perStack = rules.extractTargetResource ?? OPERATION_CONTRIBUTION_VALUES.extractTargetResourceStack;
    const targetLabel = operation.rewardEmphasis.targetResources?.join(', ') ?? 'target resource';
    add(
      `${targetLabel} extracted (${creditedStacks}${creditedStacks < targetResourceStacks ? ` of ${targetResourceStacks}` : ''})`,
      perStack * creditedStacks,
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
    routingState?: PostRunRoutingDebriefState | null;
    deferredWorldTick?: boolean;
    runResourceLedger?: RunResourceLedger;
    account?: PlayerAccount;
  },
): OperationDebriefPayload | null {
  const context = incursion.runGenerationContext;
  if (!context) return null;

  const extractedSuccessfully = opts.extractedSuccessfully ?? true;
  const extractionKind = opts.extractionKind ?? resolveContractExtractionKind(incursion);
  const contribution = computeRunOperationContribution(incursion, {
    extractedSuccessfully,
    extractionKind,
    deferTargetResourceCredit: Boolean(opts.routingState?.requiresRouting),
  });
  const contractResult = opts.contractResult ?? resolveContractResult({
    contract: incursion.activeContract,
    ledger: incursion.runResourceLedger,
    progress: incursion.contractRunProgress,
    extractedSuccessfully,
    extractionKind,
    cargo: incursion.cargo,
    bankedMultiplier: resolveKeepsakeBankedResourceMultiplier(incursion.keepsakeRuntime),
  });
  const resourceSections = opts.resourceSections
    ?? buildExtractedResourceSections(incursion.runResourceLedger);
  const unstableCargoSummary = buildUnstableCargoDebriefSummary(
    incursion.runResourceLedger,
    incursion.unstableCargoEffectsSeen,
  );
  const echoSummary = buildEchoDebriefSummary(incursion);
  const cargoRoutingSummary = buildExtractCargoRoutingDebriefSummary(
    opts.routingState ?? null,
    incursion.cargoRoutingRunState,
  );
  const keepsakeSummary = buildKeepsakeDebriefSummary(incursion.keepsakeRuntime);
  const runItemSummary = buildRunItemDebriefSummary(
    incursion.itemRuntime,
    incursion.runItems,
    incursion.runItemsAtRunStart,
  );
  const progressDelta = Math.max(0, opts.progressAfter - opts.progressBefore);
  const totalContributionThisRun = computeTotalContributionThisRun(
    contribution.total,
    opts.midRunContributionTransmitted,
    extractedSuccessfully,
  );

  const bankedStacks = sumLedgerCategoryTotals(incursion.runResourceLedger.bankedAtSafehouse);
  const lostStacks = sumLedgerCategoryTotals(incursion.runResourceLedger.lostOnDeath);
  const runOutcomeDetail = resolveRunOutcomeDetail(incursion, {
    extractedSuccessfully,
    extractionKind,
    bankedCargoStacks: bankedStacks,
    lostCargoStacks: lostStacks,
  });
  const anchorSummary = buildAnchorDebriefSummary(incursion);
  let balanceTelemetry = buildRunBalanceTelemetry(incursion, {
    extractedSuccessfully,
    operationProgressGained: progressDelta,
    timeAliveMs: opts.deathStats?.timeAliveMs ?? null,
  });
  balanceTelemetry = applyTelemetryContractOutcome(balanceTelemetry, contractResult.status);

  const extractedResourceIds = ALL_RESOURCE_ITEM_IDS.filter(
    (id) => (incursion.runResourceLedger.extracted[id] ?? 0) > 0,
  );
  const craftingOpportunities = opts.account
    ? buildCraftingOpportunitySummary(opts.account, extractedResourceIds, incursion)
    : {
      newlyCraftable: [],
      nearlyCraftable: [],
      highlightResources: extractedResourceIds,
      note: null,
    };

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
    progressDelta,
    totalContributionThisRun,
    completed: opts.completed,
    completionLogLines: opts.completionLogLines,
    credits: opts.credits,
    riftIron: opts.riftIron,
    residueVaulted: opts.residueVaulted,
    nextOperationTitle: opts.nextOperationTitle,
    contractResult,
    activeContract: incursion.activeContract,
    resourceSections,
    unstableCargoSummary,
    echoSummary,
    cargoRoutingSummary,
    extractionKind,
    deathStats: opts.deathStats,
    midRunContributionTransmitted: opts.midRunContributionTransmitted,
    routingState: opts.routingState ?? null,
    deferredWorldTick: opts.deferredWorldTick ?? false,
    runResourceLedger: opts.runResourceLedger ?? incursion.runResourceLedger,
    cargoRoutingRunState: incursion.cargoRoutingRunState,
    keepsakeSummary,
    keepsakeRuntime: incursion.keepsakeRuntime,
    runItemSummary,
    runOutcomeDetail,
    anchorSummary,
    balanceTelemetry,
    craftingOpportunities,
  };
}
