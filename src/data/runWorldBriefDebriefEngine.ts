import type { ActiveIncursionState } from '../types/game';
import type { RunWorldBrief } from '../types/runWorldBrief';
import { getCrisisThemeDefinition } from './crisisThemeCatalog';
import { getResourceDefinition } from './resourceRegistry';
import { sponsorDisplayName } from '../utils/contractUi';

export interface RunWorldBriefDebriefSummary {
  crisisDisplayName: string;
  crisisSummary: string;
  anchorDisplayName: string | null;
  operationTitle: string;
  pressureTags: string[];
  highDemandResources: string[];
  matchedResourcesExtracted: string[];
  flavorLine: string | null;
  compatibilityBrief: boolean;
  contractLine: string | null;
  echoSignalsResolved: number;
  encounterModifiersCleared: string[];
  twistedTemplatesCleared: string[];
  manifestationsEncountered: string[];
  crisisUnresolved: boolean;
  aftermathCreated: string[];
  pressureLabel: string | null;
}

export function buildRunWorldBriefDebriefSummary(
  incursion: ActiveIncursionState,
  brief: RunWorldBrief | null | undefined,
  aftermathPreview: string[] = [],
): RunWorldBriefDebriefSummary | null {
  if (!brief) return null;

  const ledger = incursion.runResourceLedger;
  const extractedIds = new Set<string>();
  if (ledger?.extracted) {
    Object.keys(ledger.extracted).forEach((id) => extractedIds.add(id));
  }
  if (ledger?.bankedAtSafehouse) {
    Object.keys(ledger.bankedAtSafehouse).forEach((id) => extractedIds.add(id));
  }

  const stressIds = new Set([
    ...brief.resourceStress.primaryResourceIds,
    ...brief.resourceStress.highDemandResourceIds,
  ]);
  const matchedResourcesExtracted = [...stressIds]
    .filter((id) => extractedIds.has(id))
    .map((id) => {
      try {
        return getResourceDefinition(id).shortName;
      } catch {
        return id;
      }
    });

  const flavorLine = getCrisisThemeDefinition(brief.crisisTheme).flavorLine;
  const contract = incursion.activeContract;
  let contractLine: string | null = null;
  if (contract?.sponsorId && contract.title) {
    contractLine = `${sponsorDisplayName(contract.sponsorId)} contract: ${contract.title}`;
  }

  const echoSignalsResolved = incursion.echoRunState?.echoSignalsResolved ?? 0;
  const encounterModifiersCleared = incursion.depthIdentity?.encounterModifiersCleared ?? [];
  const twistedTemplatesCleared = incursion.depthIdentity?.twistedTemplatesCleared ?? [];

  const manifestationsEncountered: string[] = [];
  if (echoSignalsResolved > 0) manifestationsEncountered.push(`Cleared ${echoSignalsResolved} echo signal(s)`);
  encounterModifiersCleared.forEach((m) => manifestationsEncountered.push(`Cleared ${m}`));
  twistedTemplatesCleared.forEach((t) => manifestationsEncountered.push(`Cleared ${t}`));
  if (matchedResourcesExtracted.length) {
    manifestationsEncountered.push(`Extracted stress-aligned: ${matchedResourcesExtracted.join(', ')}`);
  }

  const directorMeta = brief.directorMeta;
  const crisisUnresolved = manifestationsEncountered.length < 2
    && (directorMeta?.manifestation.requiredManifestations ?? 2) > manifestationsEncountered.length;

  return {
    crisisDisplayName: brief.crisisDisplayName,
    crisisSummary: brief.crisisSummary,
    anchorDisplayName: brief.anchorInstance?.displayName
      ?? incursion.runGenerationContext?.activeAnchor?.displayName
      ?? null,
    operationTitle: brief.operationInstance.title,
    pressureTags: brief.threatProfile.pressureTags,
    highDemandResources: brief.resourceStress.highDemandResourceIds.map((id) => {
      try {
        return getResourceDefinition(id).shortName;
      } catch {
        return id;
      }
    }),
    matchedResourcesExtracted,
    flavorLine,
    compatibilityBrief: brief.generationDebug?.compatibilityBrief ?? false,
    contractLine,
    echoSignalsResolved,
    encounterModifiersCleared,
    twistedTemplatesCleared,
    manifestationsEncountered,
    crisisUnresolved,
    aftermathCreated: aftermathPreview,
    pressureLabel: directorMeta?.pressureScore.label ?? null,
  };
}

export function formatRunWorldBriefDebriefLines(summary: RunWorldBriefDebriefSummary): string[] {
  const lines = [
    `Crisis: ${summary.crisisDisplayName}`,
    `Cause: ${summary.anchorDisplayName ?? 'Sector instability'}`,
    `Operation: ${summary.operationTitle}`,
  ];
  if (summary.pressureTags.length) {
    lines.push(`Pressure: ${summary.pressureTags.join(', ')}`);
  }
  if (summary.contractLine) {
    lines.push(summary.contractLine);
  }
  if (summary.matchedResourcesExtracted.length) {
    lines.push(`Stress-aligned extracts: ${summary.matchedResourcesExtracted.join(', ')}`);
  }
  if (summary.echoSignalsResolved > 0) {
    lines.push(`Echo signals resolved: ${summary.echoSignalsResolved}`);
  }
  if (summary.encounterModifiersCleared.length) {
    lines.push(`Modifiers cleared: ${summary.encounterModifiersCleared.join(', ')}`);
  }
  if (summary.twistedTemplatesCleared.length) {
    lines.push(`Twisted cleared: ${summary.twistedTemplatesCleared.join(', ')}`);
  }
  if (summary.manifestationsEncountered.length) {
    lines.push('Manifestations:');
    summary.manifestationsEncountered.forEach((m) => lines.push(`  • ${m}`));
  }
  if (summary.crisisUnresolved) {
    lines.push('The sector crisis remained largely unresolved.');
  }
  if (summary.aftermathCreated.length) {
    lines.push(`Aftermath: ${summary.aftermathCreated.join('; ')}`);
  }
  if (summary.pressureLabel) {
    lines.push(`Pressure at deploy: ${summary.pressureLabel}`);
  }
  return lines;
}
