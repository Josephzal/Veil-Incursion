import type { CrisisTheme } from '../types/runWorldBrief';
import type { SectorId, SectorState, WorldStatePersistedState } from '../types/worldState';
import { SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import {
  buildPreliminaryRunWorldContext,
  buildRunWorldBrief,
} from './runWorldBriefEngine';
import { getActiveAnchorInstance } from './anchorLifecycleEngine';
import { validateRunWorldBrief, formatRunWorldBriefValidationReport } from './runWorldBriefValidationEngine';
import { buildSectorState } from './worldStateEngine';

export function devGenerateRunWorldBriefReport(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationProgress: Record<string, number> = {},
): string {
  const sectorState = buildSectorState(sectorId, persisted, operationProgress);
  const brief = buildRunWorldBrief({
    persisted,
    sectorState,
    contractBoard: persisted.contractBoard.contracts,
    selectedContractId: persisted.contractBoard.selectedContract.kind === 'SPONSOR'
      ? persisted.contractBoard.selectedContract.contract?.id ?? null
      : null,
  });
  const issues = validateRunWorldBrief(brief);
  return [
    `RUN WORLD BRIEF — ${sectorId}`,
    `ID: ${brief.id}`,
    `Theme: ${brief.crisisDisplayName} (${brief.crisisTheme})`,
    `Summary: ${brief.crisisSummary}`,
    `Anchor: ${brief.anchorInstance?.displayName ?? 'none'}`,
    `Operation: ${brief.operationInstance.title}`,
    `Pressure: ${brief.threatProfile.pressureTags.join(', ')}`,
    `Resources: ${brief.resourceStress.highDemandResourceIds.join(', ') || 'none'}`,
    `Scanner overlays: anchor=${brief.scannerBias.overlayBias.anchorSignal.toFixed(2)} echo=${brief.scannerBias.overlayBias.echoSignal.toFixed(2)}`,
    '',
    formatRunWorldBriefValidationReport(issues),
  ].join('\n');
}

export function devSimulateRunWorldBriefs(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  count = 20,
): string {
  const themes = new Map<string, number>();
  const lines: string[] = [`SIMULATE ${count} BRIEFS — ${sectorId}`, ''];
  let backToBack = 0;
  let lastTheme: CrisisTheme | null = null;

  for (let i = 0; i < count; i += 1) {
    const sectorState = buildSectorState(sectorId, persisted, {});
    const anchor = getActiveAnchorInstance(persisted, sectorId);
    const prelim = buildPreliminaryRunWorldContext({
      persisted: { ...persisted, deployRunIndex: persisted.deployRunIndex + i },
      sectorState,
      operation: sectorState.activeOperation,
      anchor,
    });
    if (lastTheme === prelim.crisisTheme) backToBack += 1;
    lastTheme = prelim.crisisTheme;
    themes.set(prelim.crisisTheme, (themes.get(prelim.crisisTheme) ?? 0) + 1);
    lines.push(`${i + 1}. ${prelim.crisisDisplayName} — ${prelim.threatProfile.pressureTags.join('/')}`);
  }

  lines.push('');
  lines.push(`Theme distribution: ${[...themes.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push(`Back-to-back themes: ${backToBack}`);
  return lines.join('\n');
}

export function formatRunWorldBriefProceduralReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const lines = ['RUN WORLD BRIEF PROCEDURAL REPORT', '', 'Active sectors:'];
  let invalid = 0;

  sectors.forEach((sector) => {
    const brief = buildRunWorldBrief({
      persisted,
      sectorState: sector,
      contractBoard: persisted.contractBoard.contracts,
      selectedContractId: null,
    });
    const issues = validateRunWorldBrief(brief);
    invalid += issues.filter((i) => i.level === 'error').length;
    lines.push(`  ${sector.displayName}: ${brief.crisisDisplayName} — ${brief.anchorInstance?.displayName ?? 'no anchor'}`);
  });

  lines.push('');
  lines.push(`Invalid brief errors: ${invalid}`);
  lines.push('');
  lines.push(devSimulateRunWorldBriefs(persisted, persisted.selectedSectorId, 10));

  return lines.join('\n');
}

export function devSimulateAllSectorBriefs(
  persisted: WorldStatePersistedState,
): string {
  return SECTOR_WORLD_TEMPLATES.map((s) =>
    devSimulateRunWorldBriefs(persisted, s.id, 5),
  ).join('\n\n');
}

export function devForceCrisisThemeBrief(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  theme: CrisisTheme,
  operationProgress: Record<string, number> = {},
): string {
  const sectorState = buildSectorState(sectorId, persisted, operationProgress);
  const brief = buildRunWorldBrief({
    persisted,
    sectorState,
    contractBoard: persisted.contractBoard.contracts,
    selectedContractId: null,
    preliminary: buildPreliminaryRunWorldContext({
      persisted,
      sectorState,
      operation: sectorState.activeOperation,
      anchor: getActiveAnchorInstance(persisted, sectorId),
      forceTheme: theme,
    }),
  });
  const issues = validateRunWorldBrief(brief);
  return [
    `FORCED CRISIS BRIEF — ${theme}`,
    `Theme: ${brief.crisisDisplayName}`,
    `Summary: ${brief.crisisSummary}`,
    `Scanner echo overlay: ${brief.scannerBias.overlayBias.echoSignal.toFixed(2)}`,
    `Rival merc weight: ${brief.encounterBias.rivalMercWeight.toFixed(2)}`,
  ].join('\n') + `\n\n${formatRunWorldBriefValidationReport(issues)}`;
}
