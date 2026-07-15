import type { SectorId, SectorState, WorldStatePersistedState } from '../types/worldState';
import type { ProceduralDirectorContext } from '../types/proceduralDirector';
import {
  buildRunWorldBrief,
} from './runWorldBriefEngine';
import {
  directRunWorldBrief,
  expireAllSectorAftermath,
} from './proceduralDirectorEngine';
import { buildSectorState } from './worldStateEngine';
import { formatRunWorldBriefValidationReport, validateRunWorldBrief } from './runWorldBriefValidationEngine';

function buildDirectorContext(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationProgress: Record<string, number> = {},
): ProceduralDirectorContext {
  const sectorState = buildSectorState(sectorId, persisted, operationProgress);
  return {
    persisted,
    sectorState,
    contractBoard: persisted.contractBoard.contracts,
    selectedContractId: persisted.contractBoard.selectedContract.kind === 'SPONSOR'
      ? persisted.contractBoard.selectedContract.contract?.id ?? null
      : null,
    memory: persisted.proceduralWorldMemory,
    aftermathModifiers: persisted.sectorAftermathModifiersBySector?.[sectorId],
  };
}

export function devRunProceduralDirectorReport(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationProgress: Record<string, number> = {},
): string {
  const ctx = buildDirectorContext(persisted, sectorId, operationProgress);
  const raw = buildRunWorldBrief({
    persisted,
    sectorState: ctx.sectorState,
    contractBoard: ctx.contractBoard,
    selectedContractId: ctx.selectedContractId,
  });
  const directed = directRunWorldBrief(raw, ctx);
  const d = directed.director;

  return [
    'PROCEDURAL DIRECTOR REPORT',
    `Sector: ${sectorId}`,
    `Severity: ${d.severity} (ok=${d.ok})`,
    `Fallback used: ${directed.fallbackUsed}`,
    '',
    'PRESSURE SCORE',
    `Total: ${d.pressureScore.total} (${d.pressureScore.label})`,
    `Combat: ${d.pressureScore.combatPressure} | Elite: ${d.pressureScore.elitePressure}`,
    `Scanner: ${d.pressureScore.scannerUncertainty} | Extraction: ${d.pressureScore.extractionPressure}`,
    `Echo: ${d.pressureScore.echoPressure} | Anchor: ${d.pressureScore.anchorPressure} | Rival: ${d.pressureScore.rivalPressure}`,
    '',
    'MANIFESTATION',
    `Passed: ${d.manifestation.passed} (${d.manifestation.actualManifestations.length}/${d.manifestation.requiredManifestations})`,
    ...d.manifestation.actualManifestations.map((m) => `  • [${m.type}] ${m.description}`),
    ...(d.manifestation.missingManifestations.length
      ? [`Missing: ${d.manifestation.missingManifestations.join('; ')}`]
      : []),
    '',
    'EXPLAINABILITY',
    `Title: ${d.explainability.title}`,
    `Cause: ${d.explainability.cause}`,
    `Signals: ${d.explainability.expectedSignals.join(', ')}`,
    `Rewards: ${d.explainability.expectedRewards.join(', ')}`,
    ...(d.explainability.warning ? [`Warning: ${d.explainability.warning}`] : []),
    '',
    'REPEAT WARNINGS',
    ...(d.repeatReport.warnings.length ? d.repeatReport.warnings.map((w) => `  • ${w}`) : ['  (none)']),
    '',
    'ADJUSTMENTS',
    ...(d.appliedAdjustments.length
      ? d.appliedAdjustments.map((a) => `  • [${a.id}] ${a.reason}`)
      : ['  (none)']),
    '',
    'VALIDATION ISSUES',
    ...(d.validationIssues.length
      ? d.validationIssues.map((i) => `  [${i.severity}] ${i.id}: ${i.message}`)
      : ['  (none)']),
    '',
    formatRunWorldBriefValidationReport(validateRunWorldBrief(directed.brief)),
  ].join('\n');
}

export function devSimulateDirectedBriefs(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  count = 100,
): string {
  const ctx = buildDirectorContext(persisted, sectorId);
  let adjusted = 0;
  let fallback = 0;
  let critical = 0;
  let underManifested = 0;
  let pressureSum = 0;

  for (let i = 0; i < count; i += 1) {
    const raw = buildRunWorldBrief({
      persisted: { ...persisted, deployRunIndex: persisted.deployRunIndex + i },
      sectorState: ctx.sectorState,
      contractBoard: ctx.contractBoard,
      selectedContractId: ctx.selectedContractId,
    });
    const result = directRunWorldBrief(raw, ctx);
    pressureSum += result.director.pressureScore.total;
    if (result.director.appliedAdjustments.length) adjusted += 1;
    if (result.fallbackUsed) fallback += 1;
    if (result.director.pressureScore.label === 'CRITICAL') critical += 1;
    if (!result.director.manifestation.passed) underManifested += 1;
  }

  return [
    `SIMULATE ${count} DIRECTED BRIEFS — ${sectorId}`,
    `Average pressure: ${(pressureSum / count).toFixed(1)}`,
    `Adjusted: ${adjusted}`,
    `Fallback: ${fallback}`,
    `Critical pressure: ${critical}`,
    `Under-manifested: ${underManifested}`,
  ].join('\n');
}

export function devExpireAllAftermathReport(persisted: WorldStatePersistedState): string {
  const next = expireAllSectorAftermath(persisted);
  const count = Object.values(next.sectorAftermathModifiersBySector ?? {}).flat().length;
  return `Expired all sector aftermath modifiers (remaining: ${count}).`;
}

export function devProceduralMemoryReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const memory = persisted.proceduralWorldMemory;
  const lines = ['PROCEDURAL MEMORY REPORT', ''];
  sectors.forEach((sector) => {
    lines.push(`— ${sector.displayName} (${sector.id})`);
    lines.push(`  Crisis themes: ${(memory?.recentCrisisThemesBySector[sector.id] ?? []).join(' → ') || 'none'}`);
    lines.push(`  Operation kinds: ${(memory?.recentOperationKindsBySector?.[sector.id] ?? []).join(' → ') || 'none'}`);
    lines.push(`  Resource stress: ${(memory?.recentResourceStressBySector[sector.id] ?? []).join(' → ') || 'none'}`);
    const aftermath = persisted.sectorAftermathModifiersBySector?.[sector.id] ?? [];
    lines.push(`  Active aftermath: ${aftermath.length ? aftermath.map((m) => `${m.displayName}(${m.remainingRuns})`).join(', ') : 'none'}`);
    lines.push('');
  });
  return lines.join('\n');
}
