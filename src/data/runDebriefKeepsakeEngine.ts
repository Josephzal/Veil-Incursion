import type { KeepsakeDebriefSummary, KeepsakeRuntime, KeepsakeRuntimeStats } from '../types/expeditionKeepsake';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';

function buildKeepsakeStatLines(stats: KeepsakeRuntimeStats): string[] {
  const lines: string[] = [];
  if (stats.nodeDetailsRevealed > 0) lines.push(`Nodes fully interpreted: ${stats.nodeDetailsRevealed}`);
  if (stats.futureNodesPreviewed > 0) lines.push(`Future routes previewed: ${stats.futureNodesPreviewed}`);
  if (stats.bonusResourcesGenerated > 0) lines.push(`Bonus resources generated: ${stats.bonusResourcesGenerated}`);
  if (stats.unstablePenaltiesReduced > 0) lines.push(`Unstable penalties reduced: ${stats.unstablePenaltiesReduced}`);
  if (stats.creditsSaved > 0) lines.push(`Credits saved: ${stats.creditsSaved}`);
  if (stats.creditsDeferred > 0) lines.push(`Credits deferred: ${stats.creditsDeferred}`);
  if (stats.extractionDebtPaid > 0) lines.push(`Extraction debt paid: ${stats.extractionDebtPaid}`);
  if (stats.cargoValueBonus > 0) lines.push(`Cargo value bonus: ${stats.cargoValueBonus}`);
  if (stats.cargoPreserved > 0) lines.push(`Cargo preserved: ${stats.cargoPreserved}`);
  if (stats.operationProgressAdded > 0) lines.push(`Operation progress added: ${stats.operationProgressAdded}`);
  if (stats.sponsorRepBonus > 0) lines.push(`Sponsor rep bonus: ${stats.sponsorRepBonus}`);
  if (stats.echoSignalsGenerated > 0) lines.push(`Echo signals generated: ${stats.echoSignalsGenerated}`);
  if (stats.echoGlassBonus > 0) lines.push(`Echo-glass bonus: ${stats.echoGlassBonus}`);
  if (stats.staminaPreserved > 0) lines.push(`Stamina preserved: ${stats.staminaPreserved}`);
  if (stats.safehouseServiceUsed) lines.push(`Safehouse service: ${stats.safehouseServiceUsed}`);
  if (stats.harmonicNodesGenerated > 0) lines.push(`Harmonic nodes generated: ${stats.harmonicNodesGenerated}`);
  if (stats.narrativeResolversSpoofed > 0) lines.push(`Narrative resolvers spoofed: ${stats.narrativeResolversSpoofed}`);
  return lines;
}

export function buildKeepsakeDebriefSummary(
  runtime: KeepsakeRuntime | null | undefined,
): KeepsakeDebriefSummary | null {
  if (!runtime) return null;
  const def = getKeepsakeDefinition(runtime.keepsakeId);
  const statLines = buildKeepsakeStatLines(runtime.stats);
  const triggered = runtime.stats.triggerCount > 0;
  return {
    keepsakeId: runtime.keepsakeId,
    name: def.name,
    shortName: def.shortName,
    effectSummary: def.effectSummary,
    triggered,
    triggerCount: runtime.stats.triggerCount,
    messages: [...runtime.messages],
    statLines,
    note: triggered
      ? null
      : 'Keepsake effect did not trigger this run.',
  };
}

export function formatKeepsakeDebriefPreview(runtime: KeepsakeRuntime | null | undefined): string {
  const summary = buildKeepsakeDebriefSummary(runtime);
  if (!summary) return 'KEEPSAKE DEBRIEF — none equipped.';
  const lines = [
    'KEEPSAKE DEBRIEF',
    `equipped: ${summary.name}`,
    `triggered: ${summary.triggered ? 'yes' : 'no'}`,
    `trigger count: ${summary.triggerCount}`,
    ...summary.statLines.map((line) => `- ${line}`),
    ...(summary.note ? [summary.note] : []),
  ];
  return lines.join('\n');
}
