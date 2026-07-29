/**
 * Phase 3L — canonical player-facing weapon presentation (read-only UI model).
 * Does not alter combat, boons, grafts, matchups, or unlocks.
 */
import type { ClassType } from './game';
import type { WeaponFamilyId } from './weapon';
import type { SectorId } from './worldState';
import type { OperativeAbilityId } from './weaponLoadoutRecommendation';
import type { ResourceItemId } from './resourceItem';

export type WeaponAbilityGuidanceLabel =
  | 'REINFORCES LOOP'
  | 'COVERS PRESSURE'
  | 'ALTERNATE PATH';

export type WeaponUnlockRequirementLine = {
  resourceId: ResourceItemId;
  quantity: number;
  displayName: string;
};

export interface WeaponStrengthOrPressure {
  phrase: string;
  reason?: string;
  /** Stable mechanical source id for tests (drawback / identity / basic). */
  mechanicalSource: string;
}

export interface WeaponAbilityGuidance {
  abilityId: OperativeAbilityId;
  label: WeaponAbilityGuidanceLabel;
  reason: string;
}

export interface WeaponSanctuaryPathNote {
  abilityId: string;
  graftId: string;
  reason: string;
}

export interface WeaponFirstUseBrief {
  coreLoop: string;
  doThis: string;
  avoidThis: string;
  watchThis: string;
  buildToward: string;
}

export interface WeaponSectorPressureNote {
  sectorId: SectorId;
  depth: 1 | 2 | 3;
  advantage: string | null;
  pressure: string | null;
  preparation: string | null;
  /** Neutral when no usable Phase 3K signal. */
  fallbackNeutral: string;
}

/**
 * One canonical UI presentation per permanent weapon family.
 */
export interface WeaponPlayerFacingSummary {
  id: WeaponFamilyId;
  displayName: string;
  classId: ClassType;
  /** ~2–5 words */
  roleLabel: string;
  /** One short sentence for selection cards */
  selectionSummary: string;
  /** ≤2 compact sentences */
  playstyleExplanation: string;
  basicExplanation: string;
  meterBehavior: string;
  strengths: readonly [WeaponStrengthOrPressure, WeaponStrengthOrPressure, ...WeaponStrengthOrPressure[]];
  pressures: readonly [WeaponStrengthOrPressure, WeaponStrengthOrPressure];
  /** 3–5 live taxonomy build-direction tags (display form) */
  buildDirectionTags: readonly string[];
  recommendedAbilityIds: readonly OperativeAbilityId[];
  alternateLoadoutNote: string | null;
  firstUseBrief: WeaponFirstUseBrief;
  unlockRequirements: readonly WeaponUnlockRequirementLine[];
  isStarter: boolean;
  starterFraming: string | null;
  phase3GDrawback: string;
  tutorialCompletionKey: string;
  sanctuaryPaths: readonly WeaponSanctuaryPathNote[];
  loopCueTag: string;
}

export type WeaponCombatCalloutTone = 'info' | 'ready' | 'warn' | 'risk';

export interface WeaponCombatCallout {
  id: string;
  label: string;
  tone: WeaponCombatCalloutTone;
}

export interface WeaponCombatCalloutInput {
  weaponFamilyId: WeaponFamilyId;
  operativeClass: ClassType;
  abyssalReserve?: number;
  stamina?: number;
  maxStamina?: number;
  riftEdgeTempoArmed?: boolean;
  claymoreStaminaCommitted?: boolean;
  currentAmmo?: number;
  maxAmmo?: number;
  hexProtocolCharges?: number;
  hexMaxProtocolCharges?: number;
  zeroProtocolReady?: boolean;
  /** Equipped weapon ultimate ready — preferred over zeroProtocolReady for callouts. */
  weaponUltimateReady?: boolean;
  weaponUltimateDisplayName?: string;
  hexNextShotOvercharged?: boolean;
  perfectReloadWindow?: boolean;
  pulseSpreadSecondaryCount?: number;
  veilFlux?: number;
  fluxMaxCap?: number;
  previousCatalyst?: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  cleanCatalystCycleReady?: boolean;
  veilRotStacksTotal?: number;
  lanternDetonationReady?: boolean;
  prismBrinkActive?: boolean;
  prismSacrificePreview?: number;
  prismCanPayFullSacrifice?: boolean;
}
