import type { OperationObjectiveKind, VeilAnchorType } from '../types/worldState';

export interface OperationTemplateDefinition {
  objectiveKind: OperationObjectiveKind;
  titlePattern: string;
  descriptionPattern: string;
  rewardEmphasis: import('../types/worldState').RewardEmphasis;
}

export const OPERATION_TEMPLATE_CATALOG: readonly OperationTemplateDefinition[] = [
  {
    objectiveKind: 'ANCHOR_ASSAULT',
    titlePattern: 'Collapse the {anchor}',
    descriptionPattern: 'Trace the harmonic bleed and breach the {anchor} core before it stabilizes.',
    rewardEmphasis: { rareLoot: 0.15, echoCores: 1 },
  },
  {
    objectiveKind: 'ECHO_RECOVERY',
    titlePattern: 'Echo Recovery Sweep',
    descriptionPattern: 'Recover echo signatures before the {anchor} dissolves them entirely.',
    rewardEmphasis: { echoCores: 2, credits: 0.1 },
  },
  {
    objectiveKind: 'EXTRACTION_SURGE',
    titlePattern: 'Extraction Surge Protocol',
    descriptionPattern: 'Maximize extraction throughput while the {anchor} amplifies resource density.',
    rewardEmphasis: { credits: 0.15, rareLoot: 0.1 },
  },
  {
    objectiveKind: 'RESOURCE_SURVEY',
    titlePattern: 'Survey the {sector} Veins',
    descriptionPattern: 'Map sector resource bleed before the {anchor} re-harmonizes.',
    rewardEmphasis: { targetResources: ['Ley Slag'], rareLoot: 0.1 },
  },
  {
    objectiveKind: 'BOSS_SUPPRESSION',
    titlePattern: 'Suppress the {anchor}',
    descriptionPattern: 'Break elite nests feeding the {anchor} before the sector fully awakens.',
    rewardEmphasis: { rareLoot: 0.25, echoCores: 1 },
  },
];

export const ANCHOR_OPERATION_WEIGHTS: Record<
  VeilAnchorType,
  Partial<Record<OperationObjectiveKind, number>>
> = {
  CHOIR_SPIRE: { ANCHOR_ASSAULT: 4, ECHO_RECOVERY: 2, RESOURCE_SURVEY: 1 },
  LEY_NEXUS: { EXTRACTION_SURGE: 4, RESOURCE_SURVEY: 3, ANCHOR_ASSAULT: 1 },
  NULL_MONOLITH: { ECHO_RECOVERY: 4, BOSS_SUPPRESSION: 2, ANCHOR_ASSAULT: 1 },
  RIFT_ENGINE: { ANCHOR_ASSAULT: 3, BOSS_SUPPRESSION: 3, EXTRACTION_SURGE: 1 },
  ASHEN_HEART: { BOSS_SUPPRESSION: 4, ECHO_RECOVERY: 2, ANCHOR_ASSAULT: 1 },
};

export function fillOperationTemplate(
  template: OperationTemplateDefinition,
  anchorName: string,
  sectorName: string,
): { title: string; description: string } {
  const replace = (text: string) =>
    text.replace(/\{anchor\}/g, anchorName).replace(/\{sector\}/g, sectorName);
  return {
    title: replace(template.titlePattern),
    description: replace(template.descriptionPattern),
  };
}
