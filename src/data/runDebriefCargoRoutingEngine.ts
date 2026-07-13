import type { ActiveIncursionState } from '../types/game';
import type { ResourceItemId } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import { buildDeathResourceSections, formatDebriefResourceLine } from './runDebriefResourceEngine';
import type { CargoRoutingResult, PostRunRoutingDebriefState } from '../types/postRunCargoRouting';
import { buildPostRunRoutingDebriefState, formatAutoStashedSummary } from './postRunCargoRoutingEngine';
import { getAppraisalBandLabel } from './sealedCasketAppraisalEngine';
import { resolveContractExtractionKind } from './contractExtractionKind';
import {
  createDefaultCargoRoutingRunState,
  type CargoRoutingRunState,
} from './postRunCargoRoutingRunState';
import { getResourceDisplayName } from './resourceRegistry';

export interface DeathCargoRoutingSummary {
  headline: string;
  bankedSummary: string;
  lostSummary: string;
  bankedTotal: number;
  lostTotal: number;
  detailLines: string[];
  runTelemetryLines: string[];
  extractRoutingNote: string | null;
}

export function buildDeathCargoRoutingSummary(
  ledger: RunResourceLedger,
  cargoRoutingRunState?: CargoRoutingRunState | null,
): DeathCargoRoutingSummary {
  const sections = buildDeathResourceSections(ledger);
  const banked = sections.find((section) => section.group === 'BANKED_AT_SAFEHOUSE');
  const lost = sections.find((section) => section.group === 'LOST_IN_THE_VEIL');
  const bankedTotal = banked?.totalItems ?? 0;
  const lostTotal = lost?.totalItems ?? 0;

  const bankedSummary = banked && banked.lines.length > 0
    ? banked.lines.map((line) => formatDebriefResourceLine(line)).join(', ')
    : 'None — no cargo banked at safehouse.';
  const lostSummary = lost && lost.lines.length > 0
    ? lost.lines.map((line) => formatDebriefResourceLine(line)).join(', ')
    : 'None.';

  const headline = bankedTotal > 0 && lostTotal > 0
    ? 'Banked safehouse cargo routed to hub stash. Unbanked cargo was lost in the Veil.'
    : bankedTotal > 0
      ? 'All recovered cargo was banked at the safehouse and routed to hub stash.'
      : lostTotal > 0
        ? 'No cargo was banked — all carried resources were lost in the Veil.'
        : 'No physical cargo was recovered this run.';

  const detailLines = [
    `Banked at safehouse (${bankedTotal}): ${bankedSummary}`,
    `Lost in the Veil (${lostTotal}): ${lostSummary}`,
  ];

  const runState = cargoRoutingRunState ?? createDefaultCargoRoutingRunState();
  const runTelemetryLines: string[] = [];
  if (runState.specialCargoStacksAcquired > 0) {
    runTelemetryLines.push(`Special cargo acquired this run: ${runState.specialCargoStacksAcquired}`);
  }
  if (runState.specialCargoStacksBanked > 0) {
    runTelemetryLines.push(`Special cargo banked at safehouse: ${runState.specialCargoStacksBanked}`);
  }
  if (runState.contractTargetStacksAcquired > 0) {
    runTelemetryLines.push(`Contract target stacks held: ${runState.contractTargetStacksAcquired}`);
  }

  const extractRoutingNote = runState.specialCargoStacksAcquired > runState.specialCargoStacksBanked
    ? 'Unbanked special cargo was lost — post-run routing only applies on successful extraction.'
    : runState.specialCargoStacksAcquired > 0
      ? 'Banked special cargo auto-deposited to hub stash. Post-run routing applies on extract only.'
      : null;

  return {
    headline,
    bankedSummary,
    lostSummary,
    bankedTotal,
    lostTotal,
    detailLines,
    runTelemetryLines,
    extractRoutingNote,
  };
}

export function formatCasketOpenRewardsSummary(result: CargoRoutingResult): string {
  const openLines = result.casketOpenResults.map((entry) => {
    const band = entry.valueBand ? getAppraisalBandLabel(entry.valueBand) : null;
    const bandPrefix = band ? `${band} — ` : '';
    const dud = entry.dudFlavor ? ` (${entry.dudFlavor})` : '';
    return `${bandPrefix}${entry.summaryLabel}${dud}`;
  });
  const resourceLines = (Object.entries(result.casketOpenRewards) as Array<[string, number | undefined]>)
    .filter(([, quantity]) => (quantity ?? 0) > 0)
    .map(([resourceId, quantity]) => `${getResourceDisplayName(resourceId as ResourceItemId, true)} x${quantity ?? 0}`);
  if (openLines.length === 0 && resourceLines.length === 0 && result.creditsFromCasketOpen <= 0) {
    return 'None';
  }
  const parts = openLines.length > 0 ? openLines : resourceLines;
  if (result.creditsFromCasketOpen > 0) {
    parts.push(`+${result.creditsFromCasketOpen} CR`);
  }
  return parts.join(', ');
}

export function formatSealedCargoRoutingDebriefLines(result: CargoRoutingResult): string[] {
  const lines: string[] = [];
  result.casketAppraisalResults.forEach((entry) => {
    lines.push(`Appraised sealed cargo: ${getAppraisalBandLabel(entry.valueBand)} (−${entry.feePaid} CR)`);
  });
  result.casketOpenResults.forEach((entry) => {
    const band = entry.valueBand ? getAppraisalBandLabel(entry.valueBand) : 'Unappraised';
    const dud = entry.dudFlavor ? ` — ${entry.dudFlavor}` : '';
    lines.push(`Opened casket (${band}): ${entry.summaryLabel}${dud}`);
  });
  const soldSealed = result.fenced['sealed-containment-casket'] ?? 0;
  if (soldSealed > 0) {
    const sellCredits = result.outcomeLines
      .filter((line) => line.resourceId === 'sealed-containment-casket' && line.action === 'SELL_FENCE')
      .reduce((sum, line) => sum + (line.creditsGained ?? 0), 0);
    lines.push(`Sold ${soldSealed} sealed casket(s) for +${sellCredits} CR`);
  }
  if (result.appraisalFeesPaid > 0) {
    lines.push(`Appraisal fees paid: ${result.appraisalFeesPaid} CR`);
  }
  if (result.openingFeesPaid > 0) {
    lines.push(`Opening fees paid: ${result.openingFeesPaid} CR`);
  }
  return lines;
}

export function formatCargoRoutingOutcomeSummary(result: CargoRoutingResult): string[] {
  return result.outcomeLines.map((line) => line.label);
}

export interface CargoRoutingDebriefContributionLine {
  label: string;
  progress: number;
}

export interface ExtractCargoRoutingDebriefSummary {
  requiresRouting: boolean;
  pendingItemKinds: number;
  pendingStackCount: number;
  autoStashedStackCount: number;
  autoStashedSummary: string;
  pendingItemLines: string[];
  contractAwaitingDelivery: boolean;
  deferredContributionLines: CargoRoutingDebriefContributionLine[];
  specialCargoStacksAcquired: number;
  specialCargoStacksBanked: number;
}

function countResourceQuantityEntries(resources: Partial<Record<ResourceItemId, number>>): number {
  return Object.values(resources).reduce((sum, quantity) => sum + (quantity ?? 0), 0);
}

export function buildExtractCargoRoutingDebriefSummary(
  routingState: PostRunRoutingDebriefState | null | undefined,
  cargoRoutingRunState?: CargoRoutingRunState | null,
): ExtractCargoRoutingDebriefSummary | null {
  if (!routingState?.requiresRouting) return null;

  const runState = cargoRoutingRunState ?? createDefaultCargoRoutingRunState();
  const pendingStackCount = routingState.pendingItems.reduce((sum, item) => sum + item.quantity, 0);
  const autoStashedStackCount = countResourceQuantityEntries(routingState.autoStashed);

  const deferredContributionLines: CargoRoutingDebriefContributionLine[] = routingState.pendingItems
    .filter((item) => item.isOperationTarget)
    .map((item) => ({
      label: `${item.quantity}× ${getResourceDisplayName(item.resourceId, true)}`,
      progress: item.quantity * routingState.operationContributionPerStack,
    }));

  return {
    requiresRouting: true,
    pendingItemKinds: routingState.pendingItems.length,
    pendingStackCount,
    autoStashedStackCount,
    autoStashedSummary: formatAutoStashedSummary(routingState.autoStashed),
    pendingItemLines: routingState.pendingItems.map(
      (item) => `${getResourceDisplayName(item.resourceId, true)} x${item.quantity} (${item.source})`,
    ),
    contractAwaitingDelivery: routingState.initialContractPendingDelivery,
    deferredContributionLines,
    specialCargoStacksAcquired: runState.specialCargoStacksAcquired,
    specialCargoStacksBanked: runState.specialCargoStacksBanked,
  };
}

export function buildExtractCargoRoutingDebriefSummaryFromIncursion(
  incursion: ActiveIncursionState,
  ledgerOverride?: RunResourceLedger,
): ExtractCargoRoutingDebriefSummary | null {
  const context = incursion.runGenerationContext;
  if (!context) return null;

  const ledger = ledgerOverride ?? incursion.runResourceLedger;
  const routingState = buildPostRunRoutingDebriefState({
    ledger,
    contract: incursion.activeContract,
    operationObjectiveKind: context.activeOperation.objectiveKind,
    operationTargetResourceNames: context.activeOperation.rewardEmphasis.targetResources,
    operationId: context.activeOperation.id,
    contractProgress: incursion.contractRunProgress,
    extractionKind: resolveContractExtractionKind(incursion),
  });

  return buildExtractCargoRoutingDebriefSummary(
    routingState,
    incursion.cargoRoutingRunState,
  );
}

export function formatCargoRoutingDebriefContributionLine(
  line: CargoRoutingDebriefContributionLine,
): string {
  return `${line.label}: +${line.progress} if contributed at routing`;
}

export function formatCargoRoutingDebriefPreview(incursion: ActiveIncursionState): string {
  const summary = buildExtractCargoRoutingDebriefSummaryFromIncursion(incursion);
  if (!summary) return 'CARGO ROUTING DEBRIEF — no special cargo pending routing.';

  const lines = [
    'CARGO ROUTING DEBRIEF PREVIEW',
    `pending stacks: ${summary.pendingStackCount} (${summary.pendingItemKinds} kinds)`,
    `auto-stashed: ${summary.autoStashedSummary}`,
    `contract awaiting delivery: ${summary.contractAwaitingDelivery ? 'yes' : 'no'}`,
    `special acquired this run: ${summary.specialCargoStacksAcquired}`,
    `special banked this run: ${summary.specialCargoStacksBanked}`,
  ];

  summary.pendingItemLines.forEach((line) => lines.push(`- ${line}`));
  summary.deferredContributionLines.forEach((line) => {
    lines.push(formatCargoRoutingDebriefContributionLine(line));
  });

  return lines.join('\n');
}

export function formatSessionCargoRoutingDebriefLines(
  result: CargoRoutingResult | null | undefined,
  runState?: CargoRoutingRunState | null,
): string[] {
  const state = runState ?? createDefaultCargoRoutingRunState();
  const lines: string[] = [];

  if (state.specialCargoStacksAcquired > 0) {
    lines.push(`Special acquired this run: ${state.specialCargoStacksAcquired}`);
  }
  if (state.specialCargoStacksBanked > 0) {
    lines.push(`Special banked at safehouse: ${state.specialCargoStacksBanked}`);
  }
  if (state.contractTargetStacksAcquired > 0) {
    lines.push(`Contract targets acquired: ${state.contractTargetStacksAcquired}`);
  }
  if (state.operationTargetStacksAcquired > 0) {
    lines.push(`Operation targets acquired: ${state.operationTargetStacksAcquired}`);
  }
  if (state.pendingRoutingStacksAtExtract > 0) {
    lines.push(`Pending routing at extract: ${state.pendingRoutingStacksAtExtract}`);
  }

  if (result) {
    lines.push(...formatSealedCargoRoutingDebriefLines(result));
    lines.push(...formatCargoRoutingOutcomeSummary(result));
  }

  return lines;
}
