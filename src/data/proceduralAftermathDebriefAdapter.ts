import type { OperationDebriefPayload } from './runDebriefEngine';
import type { ActiveIncursionState } from '../types/game';
import type { RunAftermathInput } from '../types/proceduralAftermath';
import type { ResourceItemId } from '../types/resourceItem';
import type { SectorId } from '../types/worldState';
import { getResourceCategory, getResourceDefinition } from './resourceRegistry';

function sumExtractedByCategory(
  ledger: OperationDebriefPayload['runResourceLedger'],
  category: import('../types/resourceItem').ResourceCategory,
): number {
  if (!ledger?.extracted) return 0;
  return Object.entries(ledger.extracted).reduce((sum, [id, qty]) => {
    if ((qty ?? 0) <= 0) return sum;
    return getResourceCategory(id as ResourceItemId) === category ? sum + (qty ?? 0) : sum;
  }, 0);
}

function sumExtractedWithTag(
  ledger: OperationDebriefPayload['runResourceLedger'],
  tag: string,
): number {
  if (!ledger?.extracted) return 0;
  return Object.entries(ledger.extracted).reduce((sum, [id, qty]) => {
    if ((qty ?? 0) <= 0) return sum;
    try {
      return getResourceDefinition(id as ResourceItemId).usageTags.includes(tag as never)
        ? sum + (qty ?? 0)
        : sum;
    } catch {
      return sum;
    }
  }, 0);
}

function countUnstableExtracted(payload: OperationDebriefPayload): number {
  const res = payload.unstableCargoSummary?.resolution;
  if (!res) return 0;
  return res.extracted.reduce((sum, line) => sum + line.quantity, 0)
    + res.banked.reduce((sum, line) => sum + line.quantity, 0);
}

/** Prefer payload.aftermathInput (built at debrief time); fall back to reconstructing from debrief fields. */
export function buildRunAftermathInputFromDebrief(
  payload: OperationDebriefPayload,
  persisted: { deployRunIndex: number; selectedSectorId: SectorId },
  incursion?: ActiveIncursionState | null,
): RunAftermathInput {
  if (payload.aftermathInput) return payload.aftermathInput;

  const sectorId = persisted.selectedSectorId;
  const deployRunIndex = persisted.deployRunIndex;
  const runId = incursion?.runGenerationContext?.runWorldBrief?.id
    ?? `run-${sectorId}-${deployRunIndex}`;
  const extracted = payload.runOutcome === 'EXTRACTED';
  const emergencyRecall = payload.extractionKind === 'EMERGENCY_RECALL';
  const echo = payload.echoSummary;
  const anchor = payload.anchorSummary;
  const depth = payload.depthIdentitySummary;
  const worldBrief = payload.worldBriefSummary;
  const operationKind = incursion?.runGenerationContext?.activeOperation?.objectiveKind;

  return {
    sectorId,
    deployRunIndex,
    runId,
    runCompleted: true,
    extracted,
    died: !extracted,
    activeRunWorldBrief: incursion?.runGenerationContext?.runWorldBrief ?? null,
    activeAnchor: incursion?.runGenerationContext?.activeAnchor ?? null,
    completedOperationKind: payload.completed ? operationKind : undefined,
    operationCompleted: payload.completed,
    operationProgressGained: payload.progressDelta,
    anchorSuppressed: Boolean(anchor?.suppressedAnchorName)
      || (incursion?.anchorAssaultProgress?.coreCleared ?? false),
    anchorSignalsCleared: anchor?.signalsCleared ?? incursion?.contractRunProgress?.anchorSignalsCleared ?? 0,
    anchorCoreBreachesCleared: incursion?.anchorAssaultProgress?.coreCleared ? 1 : 0,
    anchorMarrowExtracted: payload.runResourceLedger?.extracted?.['anchor-marrow'] ?? 0,
    echoNodesResolved: echo?.signalsResolved ?? worldBrief?.echoSignalsResolved ?? 0,
    hostileEchoesDefeated: echo?.hostileEchoesDefeated ?? 0,
    mirrorCombatsCleared: (depth?.modifiersCleared ?? []).filter((m) => m.includes('MIRROR')).length,
    resonantFilamentExtracted: payload.runResourceLedger?.extracted?.['resonant-filament'] ?? 0,
    resourceBloomsCleared: worldBrief?.matchedResourcesExtracted.length ?? 0,
    resourceBloomsOverharvested: 0,
    resourceBloomsStabilized: payload.completed && operationKind === 'RESOURCE_SURVEY' ? 1 : 0,
    falseExtractionsStabilized: (worldBrief?.twistedTemplatesCleared ?? []).filter(
      (t) => t.includes('FALSE_EXTRACTION'),
    ).length,
    falseExtractionsSurvived: (depth?.twistedCleared ?? []).filter(
      (t) => t.includes('FALSE_EXTRACTION'),
    ).length,
    dirtyExtractionsUsed: emergencyRecall ? 1 : 0,
    safeExtractionsUsed: extracted && !emergencyRecall ? 1 : 0,
    emergencyRecallUsed: emergencyRecall,
    unstableCargoExtracted: countUnstableExtracted(payload),
    contrabandExtracted: sumExtractedByCategory(payload.runResourceLedger, 'CONTRABAND'),
    appraisableCargoExtracted: sumExtractedWithTag(payload.runResourceLedger, 'APPRAISABLE'),
    elitesDefeated: incursion?.contractRunProgress?.eliteKills ?? 0,
    bossesDefeated: incursion?.bossDefeated ? 1 : 0,
    highRiskNodesCleared: incursion?.compositionRunState?.highRiskClears ?? 0,
    contractCompleted: payload.contractResult.status === 'SUCCESS',
    resourceStressMatched: (worldBrief?.matchedResourcesExtracted.length ?? 0) > 0,
  };
}

export function buildRunAftermathInputFromIncursion(
  incursion: ActiveIncursionState,
  opts: {
    extractedSuccessfully: boolean;
    extractionKind: OperationDebriefPayload['extractionKind'];
    progressDelta: number;
    completed: boolean;
    contractCompleted?: boolean;
  },
): RunAftermathInput | null {
  const context = incursion.runGenerationContext;
  if (!context) return null;

  const brief = incursion.runWorldBrief ?? context.runWorldBrief ?? null;
  const operationKind = context.activeOperation.objectiveKind;
  const emergencyRecall = opts.extractionKind === 'EMERGENCY_RECALL';
  const echoState = incursion.echoRunState;
  const depth = incursion.depthIdentity;
  const composition = incursion.compositionRunState;
  const ledger = incursion.runResourceLedger;
  const progress = incursion.contractRunProgress;
  const anchorProgress = incursion.anchorAssaultProgress;

  const stressIds = new Set([
    ...(brief?.resourceStress.primaryResourceIds ?? []),
    ...(brief?.resourceStress.highDemandResourceIds ?? []),
  ]);
  const extractedIds = new Set(
    Object.entries(ledger.extracted).filter(([, q]) => (q ?? 0) > 0).map(([id]) => id),
  );
  const matchedStress = [...stressIds].filter((id) => extractedIds.has(id)).length;

  return {
    sectorId: context.sectorState.id,
    deployRunIndex: brief?.deployRunIndex ?? context.runWorldBrief?.deployRunIndex ?? 0,
    runId: brief?.id ?? `run-${context.sectorState.id}-${brief?.deployRunIndex ?? 0}`,

    runCompleted: true,
    extracted: opts.extractedSuccessfully,
    died: !opts.extractedSuccessfully,

    activeRunWorldBrief: brief,
    activeAnchor: context.activeAnchor ?? null,
    completedOperationKind: opts.completed ? operationKind : undefined,

    operationCompleted: opts.completed,
    operationProgressGained: opts.progressDelta,

    anchorSuppressed: anchorProgress.coreCleared,
    anchorSignalsCleared: progress.anchorSignalsCleared,
    anchorCoreBreachesCleared: anchorProgress.coreCleared ? 1 : 0,
    anchorMarrowExtracted: ledger.extracted['anchor-marrow'] ?? 0,

    echoNodesResolved: echoState?.echoSignalsResolved ?? 0,
    hostileEchoesDefeated: echoState?.hostileEchoesDefeated ?? 0,
    mirrorCombatsCleared: (depth?.encounterModifiersCleared ?? []).filter((m) => m.includes('MIRROR')).length,
    resonantFilamentExtracted: ledger.extracted['resonant-filament'] ?? 0,

    resourceBloomsCleared: matchedStress,
    resourceBloomsOverharvested: 0,
    resourceBloomsStabilized: opts.completed && operationKind === 'RESOURCE_SURVEY' ? 1 : 0,

    falseExtractionsStabilized: (depth?.twistedTemplatesCleared ?? []).filter(
      (t) => t.includes('FALSE_EXTRACTION'),
    ).length,
    falseExtractionsSurvived: composition?.falseExtractionSurvived ? 1 : 0,

    dirtyExtractionsUsed: emergencyRecall ? 1 : 0,
    safeExtractionsUsed: opts.extractedSuccessfully && !emergencyRecall ? 1 : 0,
    emergencyRecallUsed: emergencyRecall,

    unstableCargoExtracted: Object.entries(ledger.extracted).reduce((sum, [id, qty]) => {
      if ((qty ?? 0) <= 0) return sum;
      return getResourceCategory(id as ResourceItemId) === 'UNSTABLE' ? sum + (qty ?? 0) : sum;
    }, 0),
    contrabandExtracted: sumExtractedByCategory(ledger, 'CONTRABAND'),
    appraisableCargoExtracted: sumExtractedWithTag(ledger, 'APPRAISABLE'),

    elitesDefeated: progress.eliteKills,
    bossesDefeated: incursion.bossDefeated ? 1 : 0,
    highRiskNodesCleared: composition?.highRiskClears ?? 0,

    contractCompleted: opts.contractCompleted ?? false,
    resourceStressMatched: matchedStress > 0,
  };
}
