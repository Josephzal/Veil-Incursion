import type { VeilBiome } from '../types/encounterSpawn';
import type { ResourceItemId } from '../types/resourceItem';
import type { OperationBonusObjective } from '../types/operationProcedural';
import type { RunDepth } from '../types/narrativeProcedural';
import type {
  EchoActivityLevel,
  OperationContributionRules,
  OperationObjectiveKind,
  SectorId,
  SectorState,
  VeilAnchorState,
} from '../types/worldState';
import {
  formatTargetDepthLabel,
  formatTargetResourceLabels,
} from '../data/operationProceduralEngine';
import { getAnchorPressureLines } from '../data/anchorRegistry';
import { getResourceDefinition } from '../data/resourceRegistry';
import { formatEchoOperationContributionHints, formatEchoSectorIntelLines } from '../data/echoIntelEngine';
import {
  formatCargoRoutingOperationContributionHints,
  formatCargoRoutingSectorIntelLines,
} from '../data/cargoRoutingIntelEngine';
import type { SelectedContractState } from '../types/contract';
import { formatOperationObjectiveKind } from './veilFrontBriefingUi';

export interface BiomeVisualTheme {
  fill: string;
  stroke: string;
  glow: string;
  icon: string;
  label: string;
}

export const VEIL_BIOME_VISUALS: Record<VeilBiome, BiomeVisualTheme> = {
  ABYSSAL_SINK: {
    fill: '#14532d',
    stroke: '#4ade80',
    glow: '#22c55e',
    icon: '◆',
    label: 'Organic / Overgrown',
  },
  NULL_ZONE: {
    fill: '#0c4a6e',
    stroke: '#38bdf8',
    glow: '#0ea5e9',
    icon: '▣',
    label: 'Urban Grid',
  },
  ASHEN_WASTE: {
    fill: '#78350f',
    stroke: '#fbbf24',
    glow: '#d97706',
    icon: '▤',
    label: 'Barren Wastes',
  },
  SLAG_WORKS: {
    fill: '#7c2d12',
    stroke: '#fb923c',
    glow: '#ea580c',
    icon: '⚙',
    label: 'Industrial Slag',
  },
  BLACKLINE_TERMINUS: {
    fill: '#1e293b',
    stroke: '#e2e8f0',
    glow: '#ef4444',
    icon: '⬡',
    label: 'Military Compound',
  },
};

export const SECTOR_FLAVOR_LINES: Record<SectorId, string> = {
  THE_SLAG_WORKS: 'Collapsed transit arteries and machinery fused with Veil resonance.',
  THE_ABYSSAL_SINK: 'Submerged caverns where null fields swallow signal and memory.',
  THE_NULL_ZONE: 'Dead urban grid where ley veins fracture and loot density spikes.',
  THE_BLACKLINE_TERMINUS: 'Military transit compounds warped by churning Veil engines.',
  THE_ASHEN_WASTES: 'Barren backroads calcified by recursive ash.',
};

/** UI-only short labels for compact map intel chips. */
const RESOURCE_FOCUS_SHORT_NAMES: Record<string, string> = {
  'Encrypted Grid Drive': 'Encrypted Drive',
  'Echo Glass Shard': 'Echo Glass',
  'Anomalous Core': 'Anomalous Core',
  'Echo Cores': 'Echo Cores',
  'Null Filament': 'Null Filament',
  'Ley Slag': 'Ley Slag',
  'Transit Scrap': 'Transit Scrap',
};

export function compactResourceDisplayName(name: string): string {
  return RESOURCE_FOCUS_SHORT_NAMES[name] ?? name;
}

export function hazardLabel(level: number): 'Low' | 'Medium' | 'High' | 'Extreme' {
  if (level <= 1) return 'Low';
  if (level <= 2) return 'Medium';
  if (level <= 3) return 'High';
  return 'Extreme';
}

export function rewardLabel(level: number): 'Low' | 'Medium' | 'High' | 'Exceptional' {
  if (level <= 1) return 'Low';
  if (level <= 2) return 'Medium';
  if (level <= 3) return 'High';
  return 'Exceptional';
}

export function hazardPipCount(level: number): number {
  if (level <= 1) return 1;
  if (level <= 2) return 2;
  if (level <= 3) return 3;
  return 4;
}

export function rewardPipCount(level: number): number {
  if (level <= 1) return 1;
  if (level <= 2) return 2;
  if (level <= 3) return 3;
  return 4;
}

export function echoPipCount(level: EchoActivityLevel): number {
  switch (level) {
    case 'LOW':
      return 1;
    case 'ELEVATED':
      return 2;
    case 'CRITICAL':
      return 4;
    default:
      return 1;
  }
}

export function anchorStatusLabel(sector: SectorState): { label: string; pips: number } {
  if (sector.activeAnchor) return { label: 'Active', pips: 4 };
  return { label: 'None', pips: 0 };
}

export function describeAnchorInRunPressure(anchor: VeilAnchorState): string[] {
  const lines: string[] = [];
  if (anchor.modifier) {
    const modLabel = anchor.modifier.charAt(0) + anchor.modifier.slice(1).toLowerCase().replace(/_/g, ' ');
    lines.push(`${modLabel} anchor signature`);
  }
  const registryLines = [...getAnchorPressureLines(anchor.type)];
  lines.push(...registryLines.slice(0, 2));
  if (anchor.resourceBias?.length) {
    const names = anchor.resourceBias.slice(0, 3).map((id) => {
      try {
        return getResourceDefinition(id).shortName;
      } catch {
        return id;
      }
    });
    lines.push(`Likely rewards: ${names.join(', ')}`);
  }
  if (lines.length > 0) return lines;

  const { realityRules: r, type } = anchor;

  if (type === 'CHOIR_SPIRE' || r.echoBias >= 0.15) {
    lines.push('Increased Anchor Signal chance');
  }
  if (r.echoBias >= 0.1) {
    lines.push('Elevated Echo Activity');
  }
  if (r.lootBias >= 0.1) {
    lines.push('Higher rare resource potential');
  }
  if (r.eliteBias >= 0.15) {
    lines.push('Increased elite encounter pressure');
  }
  if (r.extractionRiskBias >= 0.15) {
    lines.push('Higher extraction risk near anchor bleed');
  }
  if (lines.length === 0) {
    lines.push('Sector instability elevated near anchor signature');
  }
  return lines;
}

export function formatOperationContributes(rules: OperationContributionRules): string[] {
  const lines: string[] = [];
  if (rules.defeatAnchorElite) lines.push('Neutralize anchor elites');
  if (rules.clearAnchorCore) lines.push('Defeat anchor core');
  if (rules.defeatEcho) lines.push('Defeat echo signatures');
  if (rules.clearOperationTarget) lines.push('Clear operation target / anchor signal nodes');
  if (rules.extractTargetResource) lines.push('Extract with recovered anchor matter');
  if (rules.defeatDepthBoss) lines.push('Suppress region-prime anomalies');
  if (rules.successfulExtraction) lines.push('Successful extraction runs');
  if (rules.emergencyRecallExtraction) lines.push('Emergency recall extraction');
  if (rules.bankAtSafehouse) lines.push('Bank cargo at safehouse');
  if (rules.defeatElite) lines.push('Suppress elite encounters');
  return lines;
}

export function formatOperationContributesForObjective(
  objectiveKind: OperationObjectiveKind,
  rules: OperationContributionRules,
  operationTargetResourceNames?: string[],
): string[] {
  const base = formatOperationContributes(rules);
  const echoHints = formatEchoOperationContributionHints(objectiveKind);
  const cargoHints = formatCargoRoutingOperationContributionHints(
    rules,
    operationTargetResourceNames,
  );
  if (echoHints.length === 0 && cargoHints.length === 0) return base;
  return [...base, ...echoHints, ...cargoHints];
}

export function formatEchoBriefingIntel(sector: SectorState): string[] {
  return formatEchoSectorIntelLines(sector);
}

export function formatCargoRoutingBriefingIntel(
  sector: SectorState,
  selectedContract: SelectedContractState,
): string[] {
  return formatCargoRoutingSectorIntelLines(sector, selectedContract);
}

export function formatOperationLifecycleStatus(
  lifecycleStatus: import('../types/worldState').OperationLifecycleStatus,
  runsRemaining: number,
): string {
  if (lifecycleStatus === 'COMPLETED') {
    return 'COMPLETED — aftermath begins next run';
  }
  if (lifecycleStatus === 'AFTERMATH') {
    return `AFTERMATH — ${runsRemaining} run${runsRemaining === 1 ? '' : 's'} remaining`;
  }
  if (lifecycleStatus === 'EXPIRED') {
    return 'EXPIRED — rotating soon';
  }
  return `ACTIVE — expires in ${runsRemaining} run${runsRemaining === 1 ? '' : 's'}`;
}

export function operationLifecycleAccentColor(
  lifecycleStatus: import('../types/worldState').OperationLifecycleStatus,
  statusColor: string,
): string {
  switch (lifecycleStatus) {
    case 'COMPLETED':
      return '#34d399';
    case 'AFTERMATH':
      return '#fbbf24';
    case 'EXPIRED':
      return '#f87171';
    default:
      return statusColor;
  }
}

export function isOperationProgressLocked(
  lifecycleStatus: import('../types/worldState').OperationLifecycleStatus,
): boolean {
  return lifecycleStatus === 'COMPLETED' || lifecycleStatus === 'AFTERMATH';
}

export function formatOperationProgressLockMessage(
  lifecycleStatus: import('../types/worldState').OperationLifecycleStatus,
): string | null {
  if (lifecycleStatus === 'COMPLETED') {
    return 'Community progress locked — operation complete.';
  }
  if (lifecycleStatus === 'AFTERMATH') {
    return 'Community progress frozen — new operation incoming.';
  }
  return null;
}

export function resolveRecommendedFor(sector: SectorState): string[] {
  const recs: string[] = [];
  const { activeOperation: op, echoActivity, hazardLevel, rewardLevel } = sector;

  if (op.objectiveKind === 'ANCHOR_ASSAULT') {
    recs.push('Anchor assault attempts');
    recs.push('Rare materials');
    recs.push('High-risk runs');
  }
  if (op.objectiveKind === 'ECHO_RECOVERY' || echoActivity === 'ELEVATED' || echoActivity === 'CRITICAL') {
    recs.push('Echo hunting');
    recs.push('Relic chances');
  }
  if (op.objectiveKind === 'EXTRACTION_SURGE' || op.objectiveKind === 'RESOURCE_SURVEY') {
    recs.push('Resource extraction');
  }
  if (op.contributionRules.extractTargetResource) {
    recs.push('Post-run cargo contribution');
    recs.push('Fence-value intel');
  }
  if (rewardLevel >= 4) {
    recs.push('High-value material extraction');
  }
  if (hazardLevel <= 2) {
    recs.push('Safer breach / recovery runs');
  }
  if (recs.length === 0) {
    recs.push('Standard breach operations');
  }
  return [...new Set(recs)].slice(0, 4);
}

export function sectorPriorityScore(sector: SectorState): number {
  let score = 0;
  if (sector.activeAnchor) score += 1000;
  if (sector.activeOperation.objectiveKind === 'ANCHOR_ASSAULT') score += 500;
  score += sector.rewardLevel * 10;
  score += sector.hazardLevel;
  return score;
}

export function resolvePrioritySectorId(sectors: SectorState[]): SectorId {
  const sorted = [...sectors].sort((a, b) => sectorPriorityScore(b) - sectorPriorityScore(a));
  return sorted[0]?.id ?? 'THE_SLAG_WORKS';
}

export function operationTypeChip(kind: OperationObjectiveKind): string {
  return formatOperationObjectiveKind(kind).toUpperCase();
}

export function sectorAbbreviation(displayName: string): string {
  return displayName.replace(/^The\s+/i, '').toUpperCase();
}

export function threatMeterColor(level: number): string {
  if (level <= 1) return '#22d3ee';
  if (level <= 2) return '#fbbf24';
  if (level <= 3) return '#f97316';
  return '#ef4444';
}

export function echoMeterColor(level: EchoActivityLevel): string {
  switch (level) {
    case 'LOW':
      return '#22d3ee';
    case 'ELEVATED':
      return '#a78bfa';
    case 'CRITICAL':
      return '#c084fc';
    default:
      return '#64748b';
  }
}

export function formatOperationProgressLabel(
  progressCurrent: number,
  progressRequired: number,
  progressPct: number,
): string {
  return `${progressCurrent}/${progressRequired} (${progressPct}%)`;
}

export function formatOperationTargetResourceLine(
  targetResourceIds: ResourceItemId[] | undefined,
  fallbackTargetNames: string[] | undefined,
): string | null {
  if (targetResourceIds?.length) {
    return `Target resources: ${formatTargetResourceLabels(targetResourceIds).join(', ')}`;
  }
  if (fallbackTargetNames?.length) {
    return `Target resources: ${fallbackTargetNames.join(', ')}`;
  }
  return null;
}

export function formatOperationTargetDepthLine(
  targetDepths: RunDepth[] | undefined,
): string | null {
  if (!targetDepths?.length) return null;
  return `Priority depths: ${formatTargetDepthLabel(targetDepths)}`;
}

export function formatOperationBonusObjectiveLines(
  bonusObjectives: OperationBonusObjective[] | undefined,
): string[] {
  if (!bonusObjectives?.length) return [];
  return bonusObjectives.map((bonus) =>
    `${bonus.completed ? '✓' : '○'} ${bonus.description}`,
  );
}

export function formatOperationCompletionSummaryLine(
  completionEffectSummary: string | undefined,
): string | null {
  if (!completionEffectSummary?.trim()) return null;
  return `On completion: ${completionEffectSummary}`;
}
