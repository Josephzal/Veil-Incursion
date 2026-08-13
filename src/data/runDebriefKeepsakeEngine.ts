import type {
  RequisitionDebriefSummary,
  RequisitionRuntime,
  RequisitionRuntimeStats,
} from '../types/expeditionRequisition';
import { EXPEDITION_REQUISITION_REGISTRY } from './expeditionRequisitionRegistry';

function buildKeepsakeStatLines(stats: RequisitionRuntimeStats): string[] {
  const lines: string[] = [];
  if (stats.nodeDetailsRevealed > 0) lines.push(`Nodes fully interpreted: ${stats.nodeDetailsRevealed}`);
  if (stats.futureNodesPreviewed > 0) lines.push(`Future routes previewed: ${stats.futureNodesPreviewed}`);
  if (stats.routeNodesLocked > 0) lines.push(`Route nodes locked: ${stats.routeNodesLocked}`);
  if (stats.bonusResourcesGenerated > 0) lines.push(`Bonus resources generated: ${stats.bonusResourcesGenerated}`);
  if (stats.unstablePenaltiesReduced > 0) lines.push(`Unstable penalties reduced: ${stats.unstablePenaltiesReduced}`);
  if (stats.creditsSaved > 0) lines.push(`Credits saved: ${stats.creditsSaved}`);
  if (stats.creditsDeferred > 0) lines.push(`Credits deferred: ${stats.creditsDeferred}`);
  if (stats.extractionDebtPaid > 0) lines.push(`Extraction debt paid: ${stats.extractionDebtPaid}`);
  if (stats.cargoValueBonus > 0) lines.push(`Cargo value bonus: ${stats.cargoValueBonus}`);
  if (stats.cargoPreserved > 0) lines.push(`Cargo preserved: ${stats.cargoPreserved}`);
  if (stats.cargoBankedByRequisition > 0) {
    lines.push(`Cargo banked by Requisition: ${stats.cargoBankedByRequisition}`);
  }
  if (stats.sponsorRepBonus > 0) lines.push(`Sponsor rep bonus: ${stats.sponsorRepBonus}`);
  if (stats.contrabandWrapped > 0) lines.push(`Contraband wrapped: ${stats.contrabandWrapped}`);
  if (stats.markedShelfPurchases > 0) lines.push(`Marked shelf purchases: ${stats.markedShelfPurchases}`);
  if (stats.debtWarningsTriggered > 0) lines.push(`Debt warnings: ${stats.debtWarningsTriggered}`);
  if (stats.startingCreditsGranted > 0) lines.push(`Starting Credits granted: ${stats.startingCreditsGranted}`);
  if (stats.eligibleCombatEncountersConsumed > 0) {
    lines.push(`Eligible combat encounters consumed: ${stats.eligibleCombatEncountersConsumed}`);
  }
  if (stats.temporaryApGranted > 0) lines.push(`Temporary AP granted: ${stats.temporaryApGranted}`);
  if (stats.directHostileDamagePrevented > 0) {
    lines.push(`Direct hostile damage prevented: ${stats.directHostileDamagePrevented}`);
  }
  if (stats.attributableCriticalHits > 0) {
    lines.push(`Additional attributable critical hits: ${stats.attributableCriticalHits}`);
  }
  if (stats.empoweredPiercingActions > 0) {
    lines.push(`Piercing actions empowered: ${stats.empoweredPiercingActions}`);
  }
  if (stats.armorLayersBypassed > 0) lines.push(`Armor layers bypassed: ${stats.armorLayersBypassed}`);
  if (stats.wardLayersBypassed > 0) lines.push(`Ward layers bypassed: ${stats.wardLayersBypassed}`);
  if (stats.hostileEffectsPrevented > 0) {
    lines.push(`Hostile effects prevented: ${stats.hostileEffectsPrevented}`);
  }
  return lines;
}

function buildKeepsakeDecisionLines(runtime: RequisitionRuntime): string[] {
  const lines: string[] = [];
  const { attunement, routeDoctrine } = runtime.deployment;
  if (attunement) lines.push(`Attunement: ${attunement.replace(/_/g, ' ')}`);
  if (routeDoctrine) lines.push(`Route doctrine: ${routeDoctrine}`);
  runtime.decisions.forEach((decision) => {
    const depthTag = decision.depth != null ? ` (D${decision.depth})` : '';
    lines.push(`${decision.label}: ${decision.value}${depthTag}`);
  });
  return lines;
}

export function buildKeepsakeDebriefSummary(
  runtime: RequisitionRuntime | null | undefined,
): RequisitionDebriefSummary | null {
  if (!runtime) return null;
  const def = EXPEDITION_REQUISITION_REGISTRY[runtime.requisitionId];
  const statLines = buildKeepsakeStatLines(runtime.stats);
  const decisionLines = buildKeepsakeDecisionLines(runtime);
  const riskLines = def.riskSummary ? [def.riskSummary] : [];
  const triggered = runtime.stats.triggerCount > 0;
  return {
    requisitionId: runtime.requisitionId,
    name: def.name,
    shortName: def.shortName,
    effectSummary: def.effectSummary,
    triggered,
    triggerCount: runtime.stats.triggerCount,
    messages: [...runtime.messages],
    decisionLines,
    riskLines,
    statLines,
    note: triggered
      ? null
      : 'Expedition Requisition effect did not trigger this run.',
  };
}

export function formatKeepsakeDebriefPreview(
  runtime: RequisitionRuntime | null | undefined,
): string {
  return simulateKeepsakeDebriefReport(runtime);
}

/** Full debrief simulation for dev debug and mid-run inspection. */
export function simulateKeepsakeDebriefReport(
  runtime: RequisitionRuntime | null | undefined,
): string {
  const summary = buildKeepsakeDebriefSummary(runtime);
  if (!summary) return 'EXPEDITION REQUISITION DEBRIEF — none equipped.';
  const lines = [
    'EXPEDITION REQUISITION DEBRIEF SIMULATION',
    `equipped: ${summary.name}`,
    `effect: ${summary.effectSummary}`,
    `triggered: ${summary.triggered ? 'yes' : 'no'}`,
    `trigger count: ${summary.triggerCount}`,
  ];
  if (summary.decisionLines.length > 0) {
    lines.push('decisions:');
    summary.decisionLines.forEach((line) => lines.push(`- ${line}`));
  }
  if (summary.riskLines.length > 0) {
    lines.push('risks:');
    summary.riskLines.forEach((line) => lines.push(`- ${line}`));
  }
  if (summary.statLines.length > 0) {
    lines.push('stats:');
    summary.statLines.forEach((line) => lines.push(`- ${line}`));
  }
  if (summary.messages.length > 0) {
    lines.push('trigger log:');
    summary.messages.forEach((message) => lines.push(`- ${message}`));
  }
  if (summary.note) lines.push(summary.note);
  return lines.join('\n');
}
