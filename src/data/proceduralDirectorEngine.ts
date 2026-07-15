import type { RunWorldBrief } from '../types/runWorldBrief';
import type {
  DirectedRunWorldBriefResult,
  ProceduralDirectorContext,
  ProceduralDirectorIssue,
  ProceduralDirectorResult,
  ProceduralDirectorSeverity,
} from '../types/proceduralDirector';
import { MAX_DIRECTOR_PASSES } from '../types/proceduralDirector';
import { validateRunWorldBrief } from './runWorldBriefValidationEngine';
import { scoreRunPressure } from './proceduralDirectorPressureEngine';
import {
  applyManifestationFixes,
  ensureCrisisManifestation,
} from './proceduralDirectorManifestationEngine';
import { applyProceduralSafetyCaps } from './proceduralDirectorSafetyEngine';
import {
  applyAchievabilityFixes,
  validateContractAchievability,
  validateOperationAchievability,
} from './proceduralDirectorAchievabilityEngine';
import {
  buildProceduralRepeatReport,
  repeatIssuesFromReport,
} from './proceduralDirectorRepeatEngine';
import { buildProceduralExplainabilityText } from './proceduralDirectorExplainabilityEngine';
import { applySectorAftermathToBrief } from './proceduralDirectorAftermathEngine';
import { buildRunWorldBrief } from './runWorldBriefEngine';

function resolveSeverity(issues: ProceduralDirectorIssue[]): ProceduralDirectorSeverity {
  if (issues.some((i) => i.severity === 'ERROR')) return 'ERROR';
  if (issues.some((i) => i.severity === 'WARNING')) return 'WARNING';
  return 'OK';
}

export function validateRunWorldBriefDirector(
  brief: RunWorldBrief | null | undefined,
  context: ProceduralDirectorContext,
): ProceduralDirectorResult {
  const baseIssues: ProceduralDirectorIssue[] = validateRunWorldBrief(brief).map((i) => ({
    id: i.code,
    severity: i.level === 'error' ? 'ERROR' : i.level === 'warn' ? 'WARNING' : 'INFO',
    category: 'INVALID_CONTEXT' as const,
    message: i.message,
  }));

  if (!brief) {
    return {
      ok: false,
      severity: 'ERROR',
      pressureScore: scoreRunPressure(null),
      validationIssues: baseIssues,
      appliedAdjustments: [],
      manifestation: {
        crisisTheme: 'RESOURCE_BLOOM',
        requiredManifestations: 2,
        actualManifestations: [],
        passed: false,
        missingManifestations: ['No brief'],
        appliedFixes: [],
      },
      repeatReport: buildProceduralRepeatReport(context),
      explainability: {
        title: 'Unknown Crisis',
        cause: 'Sector briefing unavailable.',
        pressureChips: [],
        expectedSignals: [],
        expectedRewards: [],
      },
    };
  }

  const pressureScore = scoreRunPressure(brief, context);
  const manifestation = ensureCrisisManifestation(brief);
  const repeatReport = buildProceduralRepeatReport(context);
  const explainability = buildProceduralExplainabilityText(
    brief,
    pressureScore,
    context.aftermathModifiers,
  );

  const issues: ProceduralDirectorIssue[] = [
    ...baseIssues,
    ...validateOperationAchievability(brief, context),
    ...validateContractAchievability(brief, context),
    ...repeatIssuesFromReport(repeatReport),
  ];

  if (!manifestation.passed) {
    issues.push({
      id: 'UNDER_MANIFESTED_CRISIS',
      severity: 'WARNING',
      category: 'UNDER_MANIFESTED_CRISIS',
      message: manifestation.missingManifestations.join('; '),
    });
  }

  if (pressureScore.label === 'CRITICAL') {
    issues.push({
      id: 'PRESSURE_CRITICAL',
      severity: 'WARNING',
      category: 'OVERLOADED_PRESSURE',
      message: `Run pressure is CRITICAL (${pressureScore.total}).`,
    });
    if (!explainability.warning) {
      issues.push({
        id: 'CRITICAL_NO_WARNING',
        severity: 'WARNING',
        category: 'FAIRNESS',
        message: 'Critical pressure without player warning text.',
      });
    }
  }

  if (pressureScore.label === 'CRITICAL' && brief.rewardBias.rareLootMultiplier <= 1.05) {
    issues.push({
      id: 'CRITICAL_REWARD_LOW',
      severity: 'WARNING',
      category: 'REWARD_MISMATCH',
      message: 'Critical pressure without elevated rewards.',
    });
  }

  const severity = resolveSeverity(issues);
  const ok = severity !== 'ERROR' && manifestation.passed;

  return {
    ok,
    severity,
    pressureScore,
    validationIssues: issues,
    appliedAdjustments: [],
    manifestation,
    repeatReport,
    explainability,
  };
}

function buildSafeFallbackBrief(context: ProceduralDirectorContext): RunWorldBrief {
  return buildRunWorldBrief({
    persisted: context.persisted,
    sectorState: context.sectorState,
    contractBoard: context.contractBoard,
    selectedContractId: context.selectedContractId,
    compatibilityBrief: true,
  });
}

export function directRunWorldBrief(
  brief: RunWorldBrief,
  context: ProceduralDirectorContext,
): DirectedRunWorldBriefResult {
  let working = applySectorAftermathToBrief(brief, context.aftermathModifiers ?? []);
  const allAdjustments: ProceduralDirectorResult['appliedAdjustments'] = [];
  let fallbackUsed = false;

  for (let pass = 0; pass < MAX_DIRECTOR_PASSES; pass += 1) {
    let director = validateRunWorldBriefDirector(working, context);
    const manifestation = ensureCrisisManifestation(working);

    if (!manifestation.passed) {
      const fix = applyManifestationFixes(working, manifestation);
      working = fix.brief;
      allAdjustments.push(...fix.adjustments);
    }

    const safety = applyProceduralSafetyCaps(working, director.pressureScore, context);
    working = safety.brief;
    allAdjustments.push(...safety.adjustments);

    const achieve = applyAchievabilityFixes(working);
    if (achieve.applied) {
      working = achieve.brief;
      allAdjustments.push({
        id: 'FIX_ACHIEVABILITY',
        reason: 'Adjusted resource stress to spawnable sector resources',
        applied: true,
      });
    }

    director = validateRunWorldBriefDirector(working, { ...context });
    if (director.ok || director.severity === 'OK') {
      const finalDirector: ProceduralDirectorResult = {
        ...director,
        appliedAdjustments: allAdjustments,
        manifestation: ensureCrisisManifestation(working),
      };
      return {
        brief: { ...working, directorMeta: finalDirector },
        director: finalDirector,
        fallbackUsed,
      };
    }
  }

  const finalCheck = validateRunWorldBriefDirector(working, context);
  if (!finalCheck.ok && finalCheck.severity === 'ERROR') {
    working = buildSafeFallbackBrief(context);
    fallbackUsed = true;
    allAdjustments.push({
      id: 'SAFE_FALLBACK_BRIEF',
      reason: 'Director max passes exceeded — compatibility brief fallback',
      applied: true,
    });
  }

  const director: ProceduralDirectorResult = {
    ...validateRunWorldBriefDirector(working, context),
    appliedAdjustments: allAdjustments,
    manifestation: ensureCrisisManifestation(working),
  };

  return {
    brief: { ...working, directorMeta: director },
    director,
    fallbackUsed,
  };
}

export { scoreRunPressure } from './proceduralDirectorPressureEngine';
export { ensureCrisisManifestation } from './proceduralDirectorManifestationEngine';
export { applyProceduralSafetyCaps } from './proceduralDirectorSafetyEngine';
export { buildProceduralExplainabilityText } from './proceduralDirectorExplainabilityEngine';
export {
  generateSectorAftermath,
  generateAftermathFromRun,
  mergeSectorAftermath,
  tickSectorAftermathForSector,
  tickSectorAftermathModifiers,
  applySectorAftermathToBrief,
  getSectorAftermathModifiers,
  applyAftermathFromRun,
  applyAftermathFromDebrief,
  expireAllSectorAftermath,
  buildAftermathDebriefLines,
  formatAftermathDebriefStrings,
  formatActiveAftermathChips,
} from './proceduralDirectorAftermathEngine';
