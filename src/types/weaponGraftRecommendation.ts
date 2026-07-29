import type { ClassType } from './game';
import type { WeaponFamilyId } from './weapon';

export type WeaponGraftRecommendationRole =
  | 'IDENTITY_ANCHOR'
  | 'METER_SUPPORT'
  | 'TARGETING_VARIANT'
  | 'RESOURCE_VARIANT'
  | 'DEFENSIVE_FLEX'
  | 'WEAKNESS_COMPENSATION'
  | 'ALTERNATE_EXPRESSION'
  | 'CONDITIONAL'
  | 'ANTI_SYNERGY';

export type GraftRecommendationValidation = 'VALIDATED' | 'NEEDS_REVIEW';

export interface WeaponGraftApplication {
  weaponFamilyId: WeaponFamilyId;
  abilityId: string;
  graftId: string;
  role: WeaponGraftRecommendationRole;
  exactRuntimeInteraction: string;
  tagsAdded: readonly string[];
  tagsRemoved: readonly string[];
  tagsReplaced: readonly { from: string; to: string }[];
  eventsAdded: readonly string[];
  eventsRemoved: readonly string[];
  meterEffect: string;
  resourceEffect: string;
  targetingEffect: string;
  meaningfulUpside: string;
  meaningfulDownside: string;
  phase3GDrawbackGuard: string;
  requiredClassRank: number;
  availableWhenWeaponUnlocks: boolean;
  abilityInPhase3HSample: boolean;
  validationState: GraftRecommendationValidation;
  playerFacingReason: string;
}

export interface WeaponGraftConfigurationAssignment {
  abilityId: string;
  graftId: string;
  job: string;
  tradeoff: string;
}

export interface WeaponGraftConfiguration {
  kind: 'EARLY_IDENTITY' | 'MATURE_ALTERNATE';
  label: string;
  requiredClassRank: number;
  /** Referenced Phase 3H sample kind. */
  loadoutRef: 'IDENTITY_FORWARD' | 'ALTERNATE_COVERAGE' | 'EARLY_VARIANT';
  assignments: readonly WeaponGraftConfigurationAssignment[];
  preservesDrawback: string;
  playerFacingSummary: string;
}

export interface WeaponGraftRecommendationProfile {
  weaponFamilyId: WeaponFamilyId;
  classId: ClassType;
  validationState: GraftRecommendationValidation;
  identitySummary: string;
  applications: readonly WeaponGraftApplication[];
  antiSynergies: readonly WeaponGraftApplication[];
  configurations: readonly [WeaponGraftConfiguration, WeaponGraftConfiguration];
  unresolvedGaps: readonly string[];
}
