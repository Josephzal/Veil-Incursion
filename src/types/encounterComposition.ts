/** Encounter Composition Phase A — shared types. */

export type CompositionEnemyRole =
  | 'BRUISER'
  | 'DISRUPTOR'
  | 'ASSASSIN'
  | 'SUPPORT'
  | 'ARTILLERY'
  | 'SWARM'
  | 'ANCHOR_LINKED'
  | 'ECHO_SPECIAL'
  | 'RIVAL_MERC'
  | 'BOSS';

export const ALL_COMPOSITION_ENEMY_ROLES: readonly CompositionEnemyRole[] = [
  'BRUISER',
  'DISRUPTOR',
  'ASSASSIN',
  'SUPPORT',
  'ARTILLERY',
  'SWARM',
  'ANCHOR_LINKED',
  'ECHO_SPECIAL',
  'RIVAL_MERC',
  'BOSS',
] as const;

export type EncounterCompositionTemplateId =
  | 'SIMPLE_PATROL'
  | 'RESOURCE_GUARD'
  | 'ANCHOR_PATROL'
  | 'ECHO_CONTAMINATED'
  | 'ELITE_NEST'
  | 'ARTILLERY_KILLBOX'
  | 'SUPPORT_CORE'
  | 'SWARM_PRESSURE'
  | 'BOSS_FORESHADOWING'
  | 'HIGH_RISK_CARGO_GUARD';

export type EncounterRiskLabel =
  | 'LOW_RISK'
  | 'STANDARD'
  | 'ELEVATED'
  | 'HIGH_RISK'
  | 'ELITE'
  | 'APEX_WARNING';

export type EncounterRewardTier =
  | 'BASELINE'
  | 'IMPROVED'
  | 'HIGH_VALUE'
  | 'RARE'
  | 'APEX_CHANCE';

export interface CompositionRoleSlot {
  roles: readonly CompositionEnemyRole[];
  required?: boolean;
  preferVariant?: boolean;
  elite?: boolean;
  count?: number;
}

export interface EncounterCompositionTemplate {
  id: EncounterCompositionTemplateId;
  name: string;
  description: string;
  allowedDepths: readonly (1 | 2 | 3)[];
  allowedBiomes?: readonly import('./encounterSpawn').VeilBiome[];
  requiresAnchorSignal?: boolean;
  requiresEchoSignal?: boolean;
  requiresHighValue?: boolean;
  requiresHighRisk?: boolean;
  elitePreferred?: boolean;
  compatibleOperations?: readonly import('./worldState').OperationObjectiveKind[];
  roleSlotsByDepth: Partial<Record<1 | 2 | 3, readonly CompositionRoleSlot[]>>;
  maxEnemiesByDepth: Partial<Record<1 | 2 | 3, number>>;
  defaultRewardTier: EncounterRewardTier;
  warningSummary: string;
  requiresWarningCard: boolean;
  weight: number;
}

export interface EncounterCompositionPickMeta {
  templateId: EncounterCompositionTemplateId;
  rolesUsed: CompositionEnemyRole[];
  rewardTier: EncounterRewardTier;
}

export interface EncounterWarningCard {
  templateId: EncounterCompositionTemplateId | null;
  encounterName: string;
  riskLabel: EncounterRiskLabel;
  depth: 1 | 2 | 3;
  sectorLabel: string | null;
  modifierLabel: string | null;
  twistedLabel: string | null;
  overlays: string[];
  enemyRoles: CompositionEnemyRole[];
  rewardPreview: string;
  operationRelevance: string | null;
  warningText: string;
  optionalBack: boolean;
}

/** Phase D — run telemetry for Encounter Highlights + audit. */
export interface CompositionRunState {
  templatesSeen: EncounterCompositionTemplateId[];
  templatesCleared: EncounterCompositionTemplateId[];
  riskLabelsCleared: EncounterRiskLabel[];
  rewardTiersCleared: EncounterRewardTier[];
  hardestRiskCleared: EncounterRiskLabel | null;
  warningCardsShown: number;
  highRiskClears: number;
  eliteClears: number;
  anchorSignalClears: number;
  echoSignalClears: number;
  highValueClears: number;
  bossForeshadowClears: number;
  falseExtractionSurvived: number;
}

export function createDefaultCompositionRunState(): CompositionRunState {
  return {
    templatesSeen: [],
    templatesCleared: [],
    riskLabelsCleared: [],
    rewardTiersCleared: [],
    hardestRiskCleared: null,
    warningCardsShown: 0,
    highRiskClears: 0,
    eliteClears: 0,
    anchorSignalClears: 0,
    echoSignalClears: 0,
    highValueClears: 0,
    bossForeshadowClears: 0,
    falseExtractionSurvived: 0,
  };
}
