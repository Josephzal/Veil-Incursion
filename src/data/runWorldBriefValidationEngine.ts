import type { RunWorldBrief } from '../types/runWorldBrief';
import { ALL_CRISIS_THEMES } from './crisisThemeCatalog';
import { RESOURCE_REGISTRY } from './resourceRegistry';

export type RunWorldBriefValidationLevel = 'error' | 'warn' | 'info';

export interface RunWorldBriefValidationIssue {
  level: RunWorldBriefValidationLevel;
  code: string;
  message: string;
}

export function validateRunWorldBrief(brief: RunWorldBrief | null | undefined): RunWorldBriefValidationIssue[] {
  const issues: RunWorldBriefValidationIssue[] = [];
  if (!brief) {
    issues.push({ level: 'warn', code: 'MISSING_BRIEF', message: 'RunWorldBrief is null.' });
    return issues;
  }

  if (!brief.id) issues.push({ level: 'error', code: 'MISSING_ID', message: 'Brief missing id.' });
  if (!brief.seed) issues.push({ level: 'error', code: 'MISSING_SEED', message: 'Brief missing seed.' });
  if (!brief.sectorId) issues.push({ level: 'error', code: 'MISSING_SECTOR', message: 'Brief missing sectorId.' });
  if (!brief.crisisTheme) issues.push({ level: 'error', code: 'MISSING_THEME', message: 'Brief missing crisisTheme.' });
  if (!brief.crisisDisplayName) issues.push({ level: 'warn', code: 'MISSING_DISPLAY_NAME', message: 'Brief missing crisisDisplayName.' });
  if (!brief.crisisSummary) issues.push({ level: 'warn', code: 'MISSING_SUMMARY', message: 'Brief missing crisisSummary.' });
  if (!brief.resourceStress) issues.push({ level: 'error', code: 'MISSING_RESOURCE_STRESS', message: 'Brief missing resourceStress.' });
  if (!brief.threatProfile) issues.push({ level: 'error', code: 'MISSING_THREAT', message: 'Brief missing threatProfile.' });
  if (!brief.scannerBias) issues.push({ level: 'error', code: 'MISSING_SCANNER_BIAS', message: 'Brief missing scannerBias.' });
  if (!brief.encounterBias) issues.push({ level: 'error', code: 'MISSING_ENCOUNTER_BIAS', message: 'Brief missing encounterBias.' });
  if (!brief.depthBias) issues.push({ level: 'warn', code: 'MISSING_DEPTH_BIAS', message: 'Brief missing depthBias.' });
  if (!brief.sponsorInterest?.length) issues.push({ level: 'warn', code: 'MISSING_SPONSOR_INTEREST', message: 'Brief missing sponsorInterest.' });
  if (!brief.operationInstance) issues.push({ level: 'warn', code: 'MISSING_OPERATION', message: 'Brief missing operationInstance.' });
  if (!brief.anchorInstance) {
    issues.push({ level: 'warn', code: 'MISSING_ANCHOR', message: 'Brief missing anchorInstance (fallback may apply).' });
  }

  if (!ALL_CRISIS_THEMES.includes(brief.crisisTheme)) {
    issues.push({ level: 'error', code: 'INVALID_THEME', message: `Invalid crisisTheme: ${brief.crisisTheme}` });
  }

  brief.resourceStress.primaryResourceIds.forEach((id) => {
    if (!RESOURCE_REGISTRY[id]) {
      issues.push({ level: 'warn', code: 'INVALID_RESOURCE', message: `resourceStress references missing resource ${id}.` });
    }
  });

  if (brief.crisisSummary.includes('{sector}') || brief.crisisSummary.includes('{anchor}')) {
    issues.push({ level: 'warn', code: 'UNRESOLVED_PLACEHOLDER', message: 'crisisSummary has unresolved placeholders.' });
  }

  const pressures = [
    brief.threatProfile.rivalPressure,
    brief.threatProfile.echoPressure,
    brief.threatProfile.anchorPressure,
  ];
  if (pressures.some((p) => p > 100 || p < 0)) {
    issues.push({ level: 'warn', code: 'PRESSURE_OUT_OF_RANGE', message: 'Threat profile pressure out of 0-100 range.' });
  }

  return issues;
}

export function formatRunWorldBriefValidationReport(issues: RunWorldBriefValidationIssue[]): string {
  if (issues.length === 0) return 'RunWorldBrief validation: OK.';
  return [
    'RUN WORLD BRIEF VALIDATION',
    '',
    ...issues.map((i) => `[${i.level.toUpperCase()}] ${i.code}: ${i.message}`),
  ].join('\n');
}
