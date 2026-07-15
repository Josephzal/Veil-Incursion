import type {
  AftermathStackMode,
  RunAftermathInput,
  SectorAftermathModifier,
  SectorAftermathSource,
  SectorAftermathType,
} from '../types/proceduralAftermath';
import type { RunScannerOverlayBias } from '../types/runWorldBrief';

export interface AftermathRuleSpec {
  type: SectorAftermathType;
  stackKey: string;
  stackMode: AftermathStackMode;
  displayName: string;
  description: string;
  source: SectorAftermathSource;
  match: (input: RunAftermathInput) => boolean;
  intensity: (input: RunAftermathInput) => 1 | 2 | 3;
  durationRuns: (input: RunAftermathInput, intensity: 1 | 2 | 3) => number;
  tags: SectorAftermathModifier['tags'];
  triggeringEvents: (input: RunAftermathInput) => string[];
  deltas: (
    input: RunAftermathInput,
    intensity: 1 | 2 | 3,
  ) => Pick<
    SectorAftermathModifier,
    | 'scannerBiasDelta'
    | 'encounterBiasDelta'
    | 'rewardBiasDelta'
    | 'contractBiasDelta'
    | 'operationBiasDelta'
    | 'threatProfileDelta'
    | 'affectedResourceIds'
    | 'affectedOperationKind'
    | 'affectedCrisisThemes'
  >;
}

function overlay(partial: Partial<RunScannerOverlayBias>): Partial<RunScannerOverlayBias> {
  return partial;
}

function intensityScale(base: number, intensity: 1 | 2 | 3): number {
  return base + (intensity - 1) * 0.04;
}

export const AFTERMATH_RULES: AftermathRuleSpec[] = [
  {
    type: 'ANCHOR_PRESSURE_REDUCED',
    stackKey: 'anchor_pressure_reduced',
    stackMode: 'refresh',
    displayName: 'Anchor Pressure Reduced',
    description: 'Recent Anchor suppression has weakened the sector\'s Anchor signals. Anchor pressure is temporarily lower.',
    source: 'ANCHOR_SUPPRESSED',
    match: (i) => Boolean(i.anchorSuppressed)
      || (i.anchorSignalsCleared ?? 0) >= 2
      || i.completedOperationKind === 'ANCHOR_ASSAULT',
    intensity: (i) => {
      if (i.anchorSuppressed) return 3;
      if (i.completedOperationKind === 'ANCHOR_ASSAULT') return 2;
      return 1;
    },
    durationRuns: (i, intensity) => (i.anchorSuppressed ? 3 : intensity >= 2 ? 2 : 2),
    tags: ['ANCHOR'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if (i.anchorSuppressed) e.push('anchor_suppressed');
      if ((i.anchorSignalsCleared ?? 0) > 0) e.push(`anchor_signals_${i.anchorSignalsCleared}`);
      if (i.completedOperationKind === 'ANCHOR_ASSAULT') e.push('anchor_assault_completed');
      return e;
    },
    deltas: (_i, intensity) => ({
      scannerBiasDelta: {
        overlayBias: overlay({
          anchorSignal: Math.max(0.85, 1 - 0.06 * intensity),
          highRisk: Math.max(0.88, 1 - 0.04 * intensity),
        }),
      },
      encounterBiasDelta: { eliteWeight: Math.max(0.9, 1 - 0.03 * intensity) },
      threatProfileDelta: { anchorPressure: -intensity * 8 },
    }),
  },
  {
    type: 'ECHO_ACTIVITY_QUIETED',
    stackKey: 'echo_activity_quieted',
    stackMode: 'refresh',
    displayName: 'Echo Activity Quieted',
    description: 'Resolved Echo signals are fading from the route. Echo threats are temporarily less aggressive.',
    source: 'ECHO_NODE_RESOLVED',
    match: (i) => (i.echoNodesResolved ?? 0) >= 1
      || i.completedOperationKind === 'ECHO_RECOVERY'
      || (i.hostileEchoesDefeated ?? 0) >= 1
      || (i.mirrorCombatsCleared ?? 0) >= 1,
    intensity: (i) => {
      if (i.completedOperationKind === 'ECHO_RECOVERY') return 3;
      const total = (i.echoNodesResolved ?? 0) + (i.hostileEchoesDefeated ?? 0) + (i.mirrorCombatsCleared ?? 0);
      if (total >= 3) return 2;
      return 1;
    },
    durationRuns: () => 2,
    tags: ['ECHO'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if ((i.echoNodesResolved ?? 0) > 0) e.push(`echo_nodes_${i.echoNodesResolved}`);
      if ((i.hostileEchoesDefeated ?? 0) > 0) e.push(`hostile_echoes_${i.hostileEchoesDefeated}`);
      if ((i.mirrorCombatsCleared ?? 0) > 0) e.push(`mirror_combats_${i.mirrorCombatsCleared}`);
      if (i.completedOperationKind === 'ECHO_RECOVERY') e.push('echo_recovery_completed');
      return e;
    },
    deltas: (_i, intensity) => ({
      scannerBiasDelta: { overlayBias: overlay({ echoSignal: Math.max(0.82, 1 - 0.08 * intensity) }) },
      encounterBiasDelta: {
        favoredModifiers: { MIRRORED: Math.max(0.85, 1 - 0.06 * intensity) },
      },
      threatProfileDelta: { echoPressure: -intensity * 10, mirrorPressure: -intensity * 8 },
      rewardBiasDelta: { resonantMaterialMultiplier: 1 + 0.04 * intensity },
    }),
  },
  {
    type: 'RESOURCE_VEINS_EXPOSED',
    stackKey: 'resource_veins_exposed',
    stackMode: 'refresh',
    displayName: 'Resource Veins Exposed',
    description: 'Survey work exposed stable resource routes. Sector material rewards are temporarily easier to locate.',
    source: 'RESOURCE_BLOOM_STABILIZED',
    match: (i) => i.completedOperationKind === 'RESOURCE_SURVEY'
      || (i.resourceBloomsStabilized ?? 0) >= 1
      || (i.resourceBloomsCleared ?? 0) >= 2
      || Boolean(i.resourceStressMatched),
    intensity: (i) => {
      if (i.completedOperationKind === 'RESOURCE_SURVEY') return 2;
      if ((i.resourceBloomsStabilized ?? 0) >= 2) return 3;
      return 1;
    },
    durationRuns: () => 2,
    tags: ['RESOURCE'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if (i.completedOperationKind === 'RESOURCE_SURVEY') e.push('resource_survey_completed');
      if ((i.resourceBloomsCleared ?? 0) > 0) e.push(`blooms_cleared_${i.resourceBloomsCleared}`);
      if (i.resourceStressMatched) e.push('stress_resources_extracted');
      return e;
    },
    deltas: (i, intensity) => ({
      scannerBiasDelta: { overlayBias: overlay({ highValueResource: 1 + 0.05 * intensity }) },
      rewardBiasDelta: { sectorResourceMultiplier: 1 + 0.06 * intensity },
      affectedResourceIds: i.activeRunWorldBrief?.resourceStress.primaryResourceIds.slice(0, 3),
    }),
  },
  {
    type: 'ROUTES_STABILIZED',
    stackKey: 'routes_stabilized',
    stackMode: 'refresh',
    displayName: 'Routes Stabilized',
    description: 'Extraction routes have been temporarily stabilized. Evac signals are easier to read.',
    source: 'FALSE_EXTRACTION_STABILIZED',
    match: (i) => (i.falseExtractionsStabilized ?? 0) >= 1
      || i.completedOperationKind === 'EXTRACTION_SURGE'
      || (i.falseExtractionsSurvived ?? 0) >= 1
      || (i.extracted && (i.safeExtractionsUsed ?? 0) > 0),
    intensity: (i) => {
      if (i.completedOperationKind === 'EXTRACTION_SURGE') return 2;
      if ((i.falseExtractionsStabilized ?? 0) >= 2) return 3;
      return 1;
    },
    durationRuns: (_i, intensity) => (intensity >= 3 ? 3 : 2),
    tags: ['EXTRACTION'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if ((i.falseExtractionsStabilized ?? 0) > 0) e.push(`false_extraction_stabilized_${i.falseExtractionsStabilized}`);
      if (i.completedOperationKind === 'EXTRACTION_SURGE') e.push('extraction_surge_completed');
      if (i.extracted) e.push('clean_extraction');
      return e;
    },
    deltas: (_i, intensity) => ({
      scannerBiasDelta: {
        overlayBias: overlay({
          extraction: Math.max(0.85, 1 - 0.05 * intensity),
          extractionUncertainty: Math.max(-0.12, -0.04 * intensity),
        }),
      },
      threatProfileDelta: { extractionPressure: -intensity * 10 },
    }),
  },
  {
    type: 'DIRTY_WAKE',
    stackKey: 'dirty_wake',
    stackMode: 'intensify',
    displayName: 'Dirty Wake',
    description: 'Emergency recall left a trail through the Veil. Future routes may draw additional attention.',
    source: 'DIRTY_EXTRACTION_USED',
    match: (i) => (i.dirtyExtractionsUsed ?? 0) >= 1 || Boolean(i.emergencyRecallUsed),
    intensity: (i) => {
      const count = (i.dirtyExtractionsUsed ?? 0) + (i.emergencyRecallUsed ? 1 : 0);
      if (count >= 3) return 3;
      if (count >= 2) return 2;
      return 1;
    },
    durationRuns: (_i, intensity) => (intensity >= 2 ? 2 : 1),
    tags: ['EXTRACTION', 'RIVAL'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if (i.emergencyRecallUsed) e.push('emergency_recall');
      if ((i.dirtyExtractionsUsed ?? 0) > 0) e.push(`dirty_extractions_${i.dirtyExtractionsUsed}`);
      return e;
    },
    deltas: (_i, intensity) => ({
      encounterBiasDelta: { rivalMercWeight: intensityScale(1.06, intensity) },
      scannerBiasDelta: intensity >= 2
        ? { overlayBias: overlay({ highRisk: 1 + 0.04 * (intensity - 1) }) }
        : undefined,
      threatProfileDelta: { rivalPressure: intensity * 12 },
    }),
  },
  {
    type: 'UNSTABLE_SCENT',
    stackKey: 'unstable_scent',
    stackMode: 'intensify',
    displayName: 'Unstable Scent',
    description: 'Extracted unstable material left a scent in the route. Dangerous resources may surface more often.',
    source: 'UNSTABLE_CARGO_EXTRACTED',
    match: (i) => (i.unstableCargoExtracted ?? 0) >= 1
      || (i.resourceBloomsOverharvested ?? 0) >= 1
      || (i.anchorMarrowExtracted ?? 0) >= 1,
    intensity: (i) => {
      const score = (i.unstableCargoExtracted ?? 0) + (i.resourceBloomsOverharvested ?? 0) * 2 + (i.anchorMarrowExtracted ?? 0);
      if (score >= 3) return 3;
      if (score >= 2) return 2;
      return 1;
    },
    durationRuns: (_i, intensity) => (intensity >= 3 ? 2 : 1),
    tags: ['UNSTABLE', 'RESOURCE'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if ((i.unstableCargoExtracted ?? 0) > 0) e.push(`unstable_cargo_${i.unstableCargoExtracted}`);
      if ((i.resourceBloomsOverharvested ?? 0) > 0) e.push(`overharvest_${i.resourceBloomsOverharvested}`);
      if ((i.anchorMarrowExtracted ?? 0) > 0) e.push(`anchor_marrow_${i.anchorMarrowExtracted}`);
      return e;
    },
    deltas: (_i, intensity) => ({
      encounterBiasDelta: { unstableCargoWeight: intensityScale(1.08, intensity) },
      scannerBiasDelta: {
        overlayBias: overlay({
          highRisk: 1 + 0.04 * intensity,
          highValueResource: 1 + 0.03 * intensity,
        }),
      },
      rewardBiasDelta: { unstableCargoMultiplier: 1 + 0.05 * intensity },
    }),
  },
  {
    type: 'CONTAINMENT_LEAK',
    stackKey: 'containment_leak',
    stackMode: 'refresh',
    displayName: 'Containment Leak',
    description: 'Recovered sealed cargo destabilized containment routes. Blackline-style signals may surface again.',
    source: 'CONTRABAND_EXTRACTED',
    match: (i) => (i.appraisableCargoExtracted ?? 0) >= 1
      || (i.contrabandExtracted ?? 0) >= 1
      || i.activeRunWorldBrief?.crisisTheme === 'CONTAINMENT_FAILURE',
    intensity: (i) => {
      if ((i.appraisableCargoExtracted ?? 0) >= 2) return 3;
      if ((i.appraisableCargoExtracted ?? 0) >= 1 || (i.contrabandExtracted ?? 0) >= 2) return 2;
      return 1;
    },
    durationRuns: () => 2,
    tags: ['CONTAINMENT'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if ((i.appraisableCargoExtracted ?? 0) > 0) e.push(`appraisable_${i.appraisableCargoExtracted}`);
      if ((i.contrabandExtracted ?? 0) > 0) e.push(`contraband_${i.contrabandExtracted}`);
      return e;
    },
    deltas: (_i, intensity) => ({
      rewardBiasDelta: { rareLootMultiplier: 1 + 0.05 * intensity },
      scannerBiasDelta: { overlayBias: overlay({ highRisk: 1 + 0.03 * intensity }) },
      threatProfileDelta: { containmentPressure: intensity * 10 },
    }),
  },
  {
    type: 'RIVAL_ATTENTION',
    stackKey: 'rival_attention',
    stackMode: 'intensify',
    displayName: 'Rival Attention',
    description: 'Other runners noticed the haul. Rival pressure may increase near the sector\'s outer layers.',
    source: 'CONTRABAND_EXTRACTED',
    match: (i) => (i.contrabandExtracted ?? 0) >= 1
      || (i.dirtyExtractionsUsed ?? 0) >= 2
      || Boolean(i.contractCompleted),
    intensity: (i) => {
      if ((i.contrabandExtracted ?? 0) >= 2) return 3;
      if ((i.contrabandExtracted ?? 0) >= 1 || i.contractCompleted) return 2;
      return 1;
    },
    durationRuns: () => 2,
    tags: ['RIVAL', 'MARKET'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if ((i.contrabandExtracted ?? 0) > 0) e.push(`contraband_${i.contrabandExtracted}`);
      if (i.contractCompleted) e.push('contract_completed');
      return e;
    },
    deltas: (_i, intensity) => ({
      encounterBiasDelta: { rivalMercWeight: intensityScale(1.1, intensity) },
      rewardBiasDelta: { rareLootMultiplier: 1 + 0.04 * intensity },
      threatProfileDelta: { rivalPressure: intensity * 14 },
    }),
  },
  {
    type: 'ELITE_SUPPRESSION',
    stackKey: 'elite_suppression',
    stackMode: 'refresh',
    displayName: 'Elite Suppression',
    description: 'Major hostile signatures have thinned. Elite pressure is temporarily reduced.',
    source: 'ELITE_SUPPRESSED',
    match: (i) => i.completedOperationKind === 'BOSS_SUPPRESSION'
      || (i.bossesDefeated ?? 0) >= 1
      || (i.elitesDefeated ?? 0) >= 2,
    intensity: (i) => {
      if (i.completedOperationKind === 'BOSS_SUPPRESSION') return 3;
      if ((i.bossesDefeated ?? 0) >= 1) return 2;
      return 1;
    },
    durationRuns: () => 2,
    tags: ['ELITE'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if ((i.bossesDefeated ?? 0) > 0) e.push(`bosses_${i.bossesDefeated}`);
      if ((i.elitesDefeated ?? 0) > 0) e.push(`elites_${i.elitesDefeated}`);
      if (i.completedOperationKind === 'BOSS_SUPPRESSION') e.push('boss_suppression_completed');
      return e;
    },
    deltas: (_i, intensity) => ({
      encounterBiasDelta: { eliteWeight: Math.max(0.88, 1 - 0.05 * intensity) },
      threatProfileDelta: { unstablePressure: -intensity * 8 },
    }),
  },
  {
    type: 'OPERATION_MOMENTUM',
    stackKey: 'operation_momentum',
    stackMode: 'refresh',
    displayName: 'Operation Momentum',
    description: 'Recent operational success has improved sector intelligence. Future objectives may be clearer.',
    source: 'OPERATION_COMPLETED',
    match: (i) => Boolean(i.operationCompleted) || (i.operationProgressGained ?? 0) >= 25,
    intensity: (i) => {
      if (i.operationCompleted && (i.operationProgressGained ?? 0) >= 40) return 3;
      if (i.operationCompleted) return 2;
      return 1;
    },
    durationRuns: (_i, intensity) => (intensity >= 2 ? 2 : 1),
    tags: ['OPERATION'],
    triggeringEvents: (i) => {
      const e: string[] = [];
      if (i.operationCompleted) e.push('operation_completed');
      if ((i.operationProgressGained ?? 0) > 0) e.push(`progress_${i.operationProgressGained}`);
      return e;
    },
    deltas: (i, intensity) => ({
      operationBiasDelta: i.completedOperationKind
        ? { preferredObjectiveKinds: [i.completedOperationKind] }
        : undefined,
      rewardBiasDelta: { rareLootMultiplier: 1 + 0.03 * intensity },
      scannerBiasDelta: { overlayBias: overlay({ operationTarget: 1 + 0.04 * intensity }) },
    }),
  },
];

export function buildModifierFromRule(
  rule: AftermathRuleSpec,
  input: RunAftermathInput,
): SectorAftermathModifier | null {
  if (!rule.match(input)) return null;
  const intensity = rule.intensity(input);
  const durationRuns = rule.durationRuns(input, intensity);
  const deltas = rule.deltas(input, intensity);
  const events = rule.triggeringEvents(input);

  return {
    id: `${input.runId}::${rule.stackKey}`,
    sectorId: input.sectorId,
    type: rule.type,
    source: rule.source,
    displayName: rule.displayName,
    description: rule.description,
    createdAtRunIndex: input.deployRunIndex,
    durationRuns,
    remainingRuns: durationRuns,
    intensity,
    tags: rule.tags,
    stackKey: rule.stackKey,
    stackMode: rule.stackMode,
    ...deltas,
    generationDebug: { triggeringEvents: events, appliedRules: [rule.type] },
  };
}

export function forceAftermathModifier(
  sectorId: import('../types/worldState').SectorId,
  type: SectorAftermathType,
  deployRunIndex: number,
): SectorAftermathModifier | null {
  const rule = AFTERMATH_RULES.find((r) => r.type === type);
  if (!rule) return null;
  const stub: RunAftermathInput = {
    sectorId,
    deployRunIndex,
    runId: `force-${type}`,
    runCompleted: true,
    extracted: true,
    died: false,
    anchorSuppressed: type === 'ANCHOR_PRESSURE_REDUCED',
    echoNodesResolved: type === 'ECHO_ACTIVITY_QUIETED' ? 2 : 0,
    dirtyExtractionsUsed: type === 'DIRTY_WAKE' ? 2 : 0,
    unstableCargoExtracted: type === 'UNSTABLE_SCENT' ? 1 : 0,
    contrabandExtracted: type === 'RIVAL_ATTENTION' || type === 'CONTAINMENT_LEAK' ? 1 : 0,
    operationCompleted: type === 'OPERATION_MOMENTUM',
    completedOperationKind: type === 'RESOURCE_VEINS_EXPOSED' ? 'RESOURCE_SURVEY'
      : type === 'ROUTES_STABILIZED' ? 'EXTRACTION_SURGE'
      : type === 'ECHO_ACTIVITY_QUIETED' ? 'ECHO_RECOVERY'
      : type === 'ELITE_SUPPRESSION' ? 'BOSS_SUPPRESSION'
      : type === 'ANCHOR_PRESSURE_REDUCED' ? 'ANCHOR_ASSAULT'
      : undefined,
    elitesDefeated: type === 'ELITE_SUPPRESSION' ? 3 : 0,
    bossesDefeated: type === 'ELITE_SUPPRESSION' ? 1 : 0,
    falseExtractionsStabilized: type === 'ROUTES_STABILIZED' ? 1 : 0,
    resourceStressMatched: type === 'RESOURCE_VEINS_EXPOSED',
    appraisableCargoExtracted: type === 'CONTAINMENT_LEAK' ? 1 : 0,
  };
  return buildModifierFromRule(rule, stub);
}
