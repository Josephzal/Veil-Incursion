import type { OperationObjectiveKind, VeilAnchorType } from '../types/worldState';
import { getAnchorOperationWeights } from './anchorRegistry';

export interface OperationTemplateDefinition {
  objectiveKind: OperationObjectiveKind;
  titlePattern: string;
  descriptionPattern: string;
  /** Procedural rolls pick from these when present. */
  titleVariants?: readonly string[];
  descriptionVariants?: readonly string[];
  rewardEmphasis: import('../types/worldState').RewardEmphasis;
}

export const OPERATION_TEMPLATE_CATALOG: readonly OperationTemplateDefinition[] = [
  {
    objectiveKind: 'ANCHOR_ASSAULT',
    titlePattern: 'Collapse the {anchor}',
    descriptionPattern: 'Trace the harmonic bleed and breach the {anchor} core before it stabilizes.',
    titleVariants: [
      'Collapse the {anchor}',
      'Breach the {anchor} Core',
      'Silence the {anchor} Signal',
    ],
    descriptionVariants: [
      'Trace the harmonic bleed and breach the {anchor} core before it stabilizes.',
      'Push through anchor pressure and suppress the {anchor} before the sector locks.',
      'Coordinate assault vectors against the {anchor} harmonic lattice.',
    ],
    rewardEmphasis: { rareLoot: 0.15, echoCores: 1 },
  },
  {
    objectiveKind: 'ECHO_RECOVERY',
    titlePattern: 'Echo Recovery Sweep',
    descriptionPattern: 'Recover echo signatures before the {anchor} dissolves them entirely.',
    titleVariants: [
      'Echo Recovery Sweep',
      'Trace Residual Echoes',
      'Recover Lost Echo Signatures',
    ],
    descriptionVariants: [
      'Recover echo signatures before the {anchor} dissolves them entirely.',
      'Harvest unstable echo residue bleeding from the {anchor}.',
      'Intercept echo fragments before they collapse into the {anchor}.',
    ],
    rewardEmphasis: { echoCores: 2, credits: 0.1 },
  },
  {
    objectiveKind: 'EXTRACTION_SURGE',
    titlePattern: 'Extraction Surge Protocol',
    descriptionPattern: 'Maximize extraction throughput while the {anchor} amplifies resource density.',
    titleVariants: [
      'Extraction Surge Protocol',
      'High-Volume Extraction Push',
      'Throughput Surge Directive',
    ],
    descriptionVariants: [
      'Maximize extraction throughput while the {anchor} amplifies resource density.',
      'Run high-yield extraction routes while anchor bleed spikes loot density.',
      'Bank and extract aggressively before the {anchor} rebalances the sector.',
    ],
    rewardEmphasis: { credits: 0.15, rareLoot: 0.1 },
  },
  {
    objectiveKind: 'RESOURCE_SURVEY',
    titlePattern: 'Survey the {sector} Veins',
    descriptionPattern: 'Map sector resource bleed before the {anchor} re-harmonizes.',
    titleVariants: [
      'Survey the {sector} Veins',
      'Map {sector} Resource Bleed',
      'Vein Reconnaissance — {sector}',
    ],
    descriptionVariants: [
      'Map sector resource bleed before the {anchor} re-harmonizes.',
      'Chart high-value resource corridors while anchor distortion is elevated.',
      'Log recoverable material concentrations across {sector}.',
    ],
    rewardEmphasis: { targetResources: ['Ley Slag'], rareLoot: 0.1 },
  },
  {
    objectiveKind: 'BOSS_SUPPRESSION',
    titlePattern: 'Suppress the {anchor}',
    descriptionPattern: 'Break elite nests feeding the {anchor} before the sector fully awakens.',
    titleVariants: [
      'Suppress the {anchor}',
      'Elite Nest Suppression',
      'Break the {anchor} Feed Line',
    ],
    descriptionVariants: [
      'Break elite nests feeding the {anchor} before the sector fully awakens.',
      'Cull apex predators amplifying {anchor} pressure across the sector.',
      'Disrupt elite relay nodes sustaining the {anchor}.',
    ],
    rewardEmphasis: { rareLoot: 0.25, echoCores: 1 },
  },
];

/** @deprecated Use getAnchorOperationWeights from anchorRegistry */
export const ANCHOR_OPERATION_WEIGHTS: Record<
  VeilAnchorType,
  Partial<Record<OperationObjectiveKind, number>>
> = {
  CHOIR_SPIRE: getAnchorOperationWeights('CHOIR_SPIRE'),
  LEY_NEXUS: getAnchorOperationWeights('LEY_NEXUS'),
  NULL_MONOLITH: getAnchorOperationWeights('NULL_MONOLITH'),
  RIFT_ENGINE: getAnchorOperationWeights('RIFT_ENGINE'),
  ASHEN_HEART: getAnchorOperationWeights('ASHEN_HEART'),
};

function resolveVariantPattern(
  primary: string,
  variants: readonly string[] | undefined,
  variantIndex: number,
): string {
  if (!variants || variants.length === 0) return primary;
  return variants[variantIndex % variants.length];
}

export function fillOperationTemplate(
  template: OperationTemplateDefinition,
  anchorName: string,
  sectorName: string,
  variantIndex = 0,
): { title: string; description: string } {
  const titlePattern = resolveVariantPattern(
    template.titlePattern,
    template.titleVariants,
    variantIndex,
  );
  const descriptionPattern = resolveVariantPattern(
    template.descriptionPattern,
    template.descriptionVariants,
    variantIndex,
  );
  const replace = (text: string) =>
    text.replace(/\{anchor\}/g, anchorName).replace(/\{sector\}/g, sectorName);
  return {
    title: replace(titlePattern),
    description: replace(descriptionPattern),
  };
}

export function pickProceduralVariantIndex(
  rand: () => number,
  template: OperationTemplateDefinition,
): number {
  const poolSize = Math.max(
    template.titleVariants?.length ?? 1,
    template.descriptionVariants?.length ?? 1,
  );
  return Math.floor(rand() * poolSize);
}
