import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { WeaponAffinityTag } from '../../types/weaponIdentity';
import type { WeaponAbilityInteractionHook } from '../../types/weaponLoadoutRecommendation';

export type BoonOfferPool = 'AEGIS' | 'HEX_SHOT' | 'ENVOY' | 'UNIVERSAL';

export type BoonSynergyClass =
  | 'DIRECT_IDENTITY'
  | 'CLASS_METER_SUPPORT'
  | 'LOADOUT_SUPPORT'
  | 'STRENGTH_AMPLIFICATION'
  | 'WEAKNESS_COMPENSATION'
  | 'GENERAL_FLEX'
  | 'CONDITIONAL'
  | 'EXPLICIT_CONFLICT'
  | 'UNSUPPORTED_OBSOLETE';

export type BoonCategoryKind =
  | 'COMMON'
  | 'ENGINE'
  | 'KEYSTONE'
  | 'CORRUPTED'
  | 'SPONSOR'
  | 'DUO'
  | 'TIER_EQUIVALENT';

export type TagLayerSnapshot = {
  baseActionTags: readonly string[];
  runtimeBasicTags: readonly string[];
  graftAddedTags: readonly string[];
  graftRemovedTags: readonly string[];
  finalTransformedTags: readonly string[];
};

export type BoonOfferContext = {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId;
  equippedAbilityIds: readonly string[];
  /** Final resolved tag union across equipped abilities + weapon basic (after grafts). */
  tagLayers: TagLayerSnapshot;
  /** Reachable frozen interaction hooks from weapon basic + equipped loadout + class mechanics. */
  reachableHooks: readonly WeaponAbilityInteractionHook[];
  weaponAffinityTags: readonly WeaponAffinityTag[];
  ownedBoonIds: readonly string[];
  /** Acquired engine/family keys already chosen this run. */
  acquiredEngineFamilies: readonly string[];
  depthBand: 1 | 2 | 3;
  /** True for the first boon offer of the run. */
  isFirstOffer: boolean;
  /** Deterministic seed (e.g. runId + nodeId + offerIndex). */
  seed: string;
  offerCount?: number;
};

export type HardEligibilityRejection =
  | 'WRONG_CLASS_POOL'
  | 'ALREADY_OWNED'
  | 'NOT_LIVE'
  | 'RUNTIME_UNIMPLEMENTED'
  | 'REQUIRED_ABILITY_MISSING'
  | 'REQUIRED_TAG_MISSING'
  | 'REQUIRED_HOOK_UNREACHABLE'
  | 'REQUIRED_PRIOR_BOON_MISSING'
  | 'EXCLUSIVE_DUPLICATE_BLOCKED'
  | 'WEAPON_FAMILY_EXCLUSIVE_MISMATCH'
  | 'RETIRED_OR_DEAD'
  | 'LEGACY_DEPENDENCY';

export type HardEligibilityResult = {
  eligible: boolean;
  rejections: readonly HardEligibilityRejection[];
};

export type SoftWeightBreakdown = {
  baseWeight: number;
  categoryWeight: number;
  directLoadoutContribution: number;
  acquiredEngineContribution: number;
  weaponAffinityContribution: number;
  conflictPenalty: number;
  synergyMultiplierRaw: number;
  synergyMultiplierClamped: number;
  finalWeight: number;
};

export type BoonWeightInspect = {
  boonId: string;
  hard: HardEligibilityResult;
  soft: SoftWeightBreakdown | null;
  finalTransformedTags: readonly string[];
  reachableHooks: readonly WeaponAbilityInteractionHook[];
  weaponFamilyExclusive: WeaponFamilyId | null;
};
