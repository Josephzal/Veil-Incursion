import type { ClassType } from './game';
import type { WeaponFamilyId } from './weapon';
import type { AegisAbilityId } from './aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from './operativeClass';

/** Recommendation roles for Phase 3H loadout mapping (not equip restrictions). */
export type WeaponLoadoutRecommendationRole =
  | 'IDENTITY_ANCHOR'
  | 'METER_SUPPORT'
  | 'DAMAGE_COMPLEMENT'
  | 'CONTROL_COMPLEMENT'
  | 'DEFENSIVE_FLEX'
  | 'MATCHUP_COVERAGE'
  | 'CONDITIONAL'
  | 'ANTI_SYNERGY';

export type RecommendationCoreTier = 'CORE' | 'FLEX' | 'CONDITIONAL';

export type SampleLoadoutKind = 'IDENTITY_FORWARD' | 'ALTERNATE_COVERAGE';

export type SampleAvailabilityBand = 'EARLY' | 'STANDARD' | 'LATE';

export type RecommendationValidationState = 'VALIDATED' | 'NEEDS_REVIEW';

export type OperativeAbilityId = AegisAbilityId | HexShotAbilityId | EnvoyAbilityId;

/** Machine-readable hooks reused by later UI / 3I affinity (no new combat statuses). */
export type WeaponAbilityInteractionHook =
  | 'WEAPON_BASIC'
  | 'FRACTURE_SETUP'
  | 'FRACTURE_BREAK'
  | 'RESERVE_FLOW'
  | 'RUNIC_BRAND'
  | 'RIFT_EDGE_TEMPO'
  | 'PARRY_EVADE_TEMPO'
  | 'STAMINA_PRESSURE'
  | 'RELOAD_PROTOCOL'
  | 'PROTOCOL_CHARGE'
  | 'ARMOR_PRESSURE'
  | 'SPREAD_CLUSTER'
  | 'ASH_SALVO_BURST'
  | 'CLEAN_CATALYST_CYCLE'
  | 'FLUX_CYCLE'
  | 'ROT_SETUP'
  | 'ROT_DETONATION'
  | 'FLUX_PURGE_ROUTE'
  | 'BRINK_FLUX'
  | 'HP_SACRIFICE'
  | 'DEFENSIVE_TEMPO'
  | 'EXECUTE_WINDOW'
  | 'CROWD_CONTROL'
  | 'PRIORITY_TARGET';

export interface WeaponAbilityRecommendation {
  abilityId: OperativeAbilityId;
  role: WeaponLoadoutRecommendationRole;
  coreTier: RecommendationCoreTier;
  playerFacingReason: string;
  exactMechanicalInteraction: string;
  dependsOnEvent: WeaponAbilityInteractionHook;
  tagsInvolved: readonly string[];
  meterInteraction: string;
  addresses: string;
  importantTradeoff: string;
  /** True when the ability is obtainable under realistic unlock pacing for this weapon band. */
  availableWhenWeaponUnlocks: boolean;
  interactionHooks: readonly WeaponAbilityInteractionHook[];
}

export interface WeaponAbilityAntiSynergy {
  abilityId: OperativeAbilityId;
  conflictKind: 'METER_COMPETITION' | 'REDUNDANT_BASIC' | 'WORSENS_WEAKNESS';
  playerFacingReason: string;
  exactMechanicalConflict: string;
  interactionHooks: readonly WeaponAbilityInteractionHook[];
}

export interface WeaponSampleLoadoutAbilityJob {
  abilityId: OperativeAbilityId;
  job: string;
}

export interface WeaponSampleLoadout {
  kind: SampleLoadoutKind;
  label: string;
  /** Exact live 4-slot loadout (fixed weapon basic in slot 0 + 3 flex). */
  slots: readonly [OperativeAbilityId, OperativeAbilityId, OperativeAbilityId, OperativeAbilityId];
  abilityJobs: readonly WeaponSampleLoadoutAbilityJob[];
  availability: SampleAvailabilityBand;
  /** When LATE, a legal earlier substitute loadout. */
  earlyAlternativeSlots?: readonly [
    OperativeAbilityId,
    OperativeAbilityId,
    OperativeAbilityId,
    OperativeAbilityId,
  ];
  earlyAlternativeNote?: string;
  preservesDrawback: string;
  playerFacingSummary: string;
}

export interface WeaponLoadoutRecommendationProfile {
  weaponFamilyId: WeaponFamilyId;
  classId: ClassType;
  validationState: RecommendationValidationState;
  identitySummary: string;
  recommendations: readonly WeaponAbilityRecommendation[];
  antiSynergies: readonly WeaponAbilityAntiSynergy[];
  sampleLoadouts: readonly [WeaponSampleLoadout, WeaponSampleLoadout];
}

export type AbilityCoverageCategory =
  | 'IDENTITY_ANCHOR'
  | 'SUPPORTING'
  | 'FLEX_UNIVERSAL'
  | 'CONDITIONAL_MATCHUP'
  | 'ANTI_SYNERGY'
  | 'INTENTIONALLY_UNMAPPED_SELECTABLE'
  | 'FIXED_WEAPON_BASIC'
  | 'ULTIMATE'
  | 'INTRINSIC'
  | 'DEPRECATED_RETIRED';

export type OrphanExplanation =
  | 'INTENTIONALLY_UNIVERSAL'
  | 'TOO_NICHE'
  | 'MECHANICALLY_OUTDATED'
  | 'UNSUPPORTED_BY_ROSTER'
  | 'APPARENTLY_UNDERPOWERED_OR_REDUNDANT'
  | 'DEPENDENT_ON_LATER_PHASE';

export type AbilityStructuralKind =
  | 'LIVE_SELECTABLE_FLEX'
  | 'FIXED_WEAPON_BASIC'
  | 'ULTIMATE'
  | 'INTRINSIC'
  | 'DEPRECATED_RETIRED';

export interface AbilityCoverageEntry {
  abilityId: OperativeAbilityId;
  classId: ClassType;
  structuralKind: AbilityStructuralKind;
  /** True only for live flex-selectable abilities (excludes fixed basics). */
  selectableFlex: boolean;
  categories: readonly AbilityCoverageCategory[];
  weaponIds: readonly WeaponFamilyId[];
  /** Only for INTENTIONALLY_UNMAPPED_SELECTABLE flex abilities. */
  unmappedExplanation?: OrphanExplanation;
  notes: string;
}
