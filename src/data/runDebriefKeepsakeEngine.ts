import type {
  KeepsakeDebriefSummary,
  KeepsakeRuntime,
  KeepsakeRuntimeStats,
} from '../types/expeditionKeepsake';
import { buildKeepsakeRiskLines } from './expeditionKeepsakeRunUiEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';

function buildKeepsakeStatLines(stats: KeepsakeRuntimeStats): string[] {
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
  if (stats.cargoBankedByTrinket > 0) lines.push(`Cargo banked by relic: ${stats.cargoBankedByTrinket}`);
  if (stats.operationProgressAdded > 0) lines.push(`Operation progress added: ${stats.operationProgressAdded}`);
  if (stats.sponsorRepBonus > 0) lines.push(`Sponsor rep bonus: ${stats.sponsorRepBonus}`);
  if (stats.echoSignalsGenerated > 0) lines.push(`Echo signals generated: ${stats.echoSignalsGenerated}`);
  if (stats.echoThreadGenerated > 0) lines.push(`Echo thread generated: ${stats.echoThreadGenerated}`);
  if (stats.echoIntelRevealed > 0) lines.push(`Echo intel revealed: ${stats.echoIntelRevealed}`);
  if (stats.echoGlassBonus > 0) lines.push(`Echo-glass bonus: ${stats.echoGlassBonus}`);
  if (stats.anchorSignalsGenerated > 0) lines.push(`Anchor signals generated: ${stats.anchorSignalsGenerated}`);
  if (stats.anchorTrailCleared > 0) lines.push(`Anchor trail stages cleared: ${stats.anchorTrailCleared}`);
  if (stats.contaminationAdded > 0) lines.push(`Contamination added: ${stats.contaminationAdded}`);
  if (stats.contaminationPurged > 0) lines.push(`Contamination purged: ${stats.contaminationPurged}`);
  if (stats.matchesLit > 0) lines.push(`Matches lit: ${stats.matchesLit}`);
  if (stats.safeExtractionsSkipped > 0) lines.push(`Safe extractions skipped: ${stats.safeExtractionsSkipped}`);
  if (stats.contrabandWrapped > 0) lines.push(`Contraband wrapped: ${stats.contrabandWrapped}`);
  if (stats.markedShelfPurchases > 0) lines.push(`Marked shelf purchases: ${stats.markedShelfPurchases}`);
  if (stats.debtWarningsTriggered > 0) lines.push(`Debt warnings: ${stats.debtWarningsTriggered}`);
  if (stats.rivalQuarriesCleared > 0) lines.push(`Rival quarries cleared: ${stats.rivalQuarriesCleared}`);
  if (stats.falseBeaconsPlanted > 0) lines.push(`False beacons planted: ${stats.falseBeaconsPlanted}`);
  if (stats.keysUsed > 0) lines.push(`Hollow keys used: ${stats.keysUsed}`);
  if (stats.outsideCargoNodesCarried > 0) lines.push(`Outside cargo carried: ${stats.outsideCargoNodesCarried}`);
  if (stats.safehouseServiceUsed) lines.push(`Safehouse service: ${stats.safehouseServiceUsed}`);
  return lines;
}

function buildKeepsakeDecisionLines(runtime: KeepsakeRuntime): string[] {
  const lines: string[] = [];
  const { attunement, routeDoctrine, mirrorCategory } = runtime.deployment;
  if (attunement) lines.push(`Attunement: ${attunement.replace(/_/g, ' ')}`);
  if (routeDoctrine) lines.push(`Route doctrine: ${routeDoctrine}`);
  if (mirrorCategory) lines.push(`Mirrored category: ${mirrorCategory.replace(/_/g, ' ')}`);
  runtime.decisions.forEach((decision) => {
    const depthTag = decision.depth != null ? ` (D${decision.depth})` : '';
    lines.push(`${decision.label}: ${decision.value}${depthTag}`);
  });
  return lines;
}

export function buildKeepsakeDebriefSummary(
  runtime: KeepsakeRuntime | null | undefined,
): KeepsakeDebriefSummary | null {
  if (!runtime) return null;
  const def = getKeepsakeDefinition(runtime.keepsakeId);
  const statLines = buildKeepsakeStatLines(runtime.stats);
  const decisionLines = buildKeepsakeDecisionLines(runtime);
  const riskLines = buildKeepsakeRiskLines(runtime);
  const triggered = runtime.stats.triggerCount > 0;
  return {
    keepsakeId: runtime.keepsakeId,
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
      : 'Expedition relic effect did not trigger this run.',
  };
}

export function formatKeepsakeDebriefPreview(runtime: KeepsakeRuntime | null | undefined): string {
  return simulateKeepsakeDebriefReport(runtime);
}

/** Full debrief simulation for dev debug and mid-run inspection. */
export function simulateKeepsakeDebriefReport(
  runtime: KeepsakeRuntime | null | undefined,
): string {
  const summary = buildKeepsakeDebriefSummary(runtime);
  if (!summary) return 'EXPEDITION RELIC DEBRIEF — none equipped.';
  const lines = [
    'EXPEDITION RELIC DEBRIEF SIMULATION',
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
