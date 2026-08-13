import type { ClassType } from './game';
import type { ResourceItemId } from './resourceItem';
import type { ResolvedWeaponCombatStats } from '../data/inventory';
import type { CanonicalWeaponFamilyId } from '../data/weaponFamilyIdNormalize';

/** Live permanent weapon-family identity (Stage II-C — tierless). */
export type WeaponFamilyId = CanonicalWeaponFamilyId;

/**
 * @deprecated Stage II-C — weapon tiers removed. Retained only for stored-input
 * migration typing; never used as live progression.
 */
export type WeaponTierNumber = 1 | 2 | 3;

export type WeaponTag =
  | 'MELEE'
  | 'BALLISTIC'
  | 'RANGED'
  | 'OCCULT'
  | 'KINETIC'
  | 'HEAVY'
  | 'FAST'
  | 'DEFENSIVE'
  | 'FRACTURE'
  | 'CRIT'
  | 'CONTROL'
  | 'RESOURCE'
  | 'SACRIFICE'
  | 'RELOAD'
  | 'AMMO'
  | 'RITUAL'
  | 'ANCHOR'
  | 'ECHO'
  | 'BALANCED'
  | 'SUSTAINED'
  | 'VOID_AMMO'
  | 'ARMOR_PIERCE'
  | 'HIGH_RISK'
  | 'DEBUFF';

/**
 * @deprecated Stage II-C — Tier III once-per-combat passives retired.
 * Kept for migration/retirement tests only.
 */
export type WeaponOncePerCombatPassiveId =
  | 'FIRST_MELEE_RESERVE_BONUS'
  | 'FRACTURE_BREAK_RESERVE'
  | 'FIRST_FRACTURE_STAMINA_REFUND'
  | 'MELEE_CRIT_RESERVE_BONUS'
  | 'FIRST_RELOAD_STAMINA'
  | 'POST_RELOAD_BALLISTIC_DAMAGE'
  | 'FIRST_ARMORED_HIT_EXTRA_ARMOR_STRIP'
  | 'FIRST_OCCULT_RESOURCE_BONUS'
  | 'SACRIFICE_HP_RESOURCE_BONUS'
  | 'FIRST_DEBUFF_WARD';

export interface WeaponResourceCost {
  resourceId: ResourceItemId;
  quantity: number;
}

export interface WeaponStatModifiers {
  /**
   * Legacy / migration scaling for non-Aegis STRIKE basics and dormant Aegis basic engine.
   * Not applied to the canonical Aegis 4+3 weapon-action surface (Phase E.1b).
   * Not the live authority for Aegis VEIL_PIERCER / REAVE (use aegisTechniquePowerPct).
   */
  strikeDamagePct?: number;
  /**
   * Aegis technique strike-power % for VEIL_PIERCER / REAVE only (Phase E.1c.1).
   * Does not scale canonical weapon-action kinetic damage.
   * When absent, `resolveAegisTechniqueStrikePower` falls back to strikeDamagePct for migration.
   */
  aegisTechniquePowerPct?: number;
  /**
   * Aegis ultimate strike-power % for REND_THE_VEIL / GRAVEFALL only (Phase E.1d.1).
   * Does not scale canonical weapon-action kinetic damage or techniques.
   * When absent, `resolveAegisUltimateStrikePower` falls back to strikeDamagePct for migration.
   * ABYSSAL_VERDICT uses a fixed True matrix and does not read this field.
   */
  aegisUltimatePowerPct?: number;
  /** Legacy stamina cost scaling — Aegis has no Stamina on the combat surface. */
  strikeStaminaCostPct?: number;
  fractureFromMeleePct?: number;
  reserveGainFlat?: number;
  reserveGainPct?: number;
  critChancePct?: number;
  magazineSizeBonus?: number;
  ballisticDamagePct?: number;
  occultDamagePct?: number;
  veilFluxGainFlat?: number;
  veilFluxGainPct?: number;
  debuffDurationPct?: number;
  sacrificeResourceBonus?: number;
  healReceivedPct?: number;
  armorPierceLayers?: number;
  maxHpPct?: number;
}

/**
 * @deprecated Stage II-C — tier rows removed. Stored-input / historical only.
 */
export interface WeaponTierDefinition {
  tierNumber: WeaponTierNumber;
  displayName: string;
  statModifiers: WeaponStatModifiers;
  oncePerCombatPassive?: WeaponOncePerCombatPassiveId;
  passiveBonusPct?: number;
  effectSummary: string;
  upgradeCost: readonly WeaponResourceCost[];
}

export interface WeaponFamilyDefinition {
  id: WeaponFamilyId;
  classId: ClassType;
  name: string;
  shortName: string;
  description: string;
  flavorText: string;
  role: string;
  tags: readonly WeaponTag[];
  startingUnlocked: boolean;
  unlockRequirement: readonly WeaponResourceCost[];
  /** Exact former effective Tier I combat profile (tierless baseline). */
  baselineStatModifiers: WeaponStatModifiers;
  baselineEffectSummary: string;
  uiSummary: string;
  /**
   * Deferred Masterwork content — inert; grants no live power (Stage II-C).
   */
  masterworkUnlocked: boolean;
  masterworkRecipeId: string | null;
  requiresAnomalousCore: boolean;
  masterworkEffectSummary: string;
}

/**
 * Encounter-scoped weapon kit flags that are NOT tier passives.
 * Tier III once-per-combat counters were removed in Stage II-C.
 */
export interface WeaponRuntimeState {
  /** Paired Blades — armed by evade/parry success; consumed by Occult rider basic. */
  riftEdgeTempoArmed: boolean;
  /** Claymore — first Fracture-break cashout per encounter (family kit). */
  claymoreBreakCashoutUsed: boolean;
  /** Hex mag loop — emptied at least once this combat. */
  magazineEmptiedThisCombat: boolean;
}

export interface ResolvedWeaponState {
  familyId: WeaponFamilyId;
  displayName: string;
  statModifiers: WeaponStatModifiers;
  effectSummary: string;
  tags: readonly WeaponTag[];
  classId: ClassType;
}

export interface WeaponProgressionState {
  weaponUnlocks: WeaponFamilyId[];
  equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>>;
}

/** Stored-input shape that may still carry retired tier maps / legacy IDs. */
export type StoredWeaponProgressionInput = {
  weaponUnlocks?: readonly unknown[];
  weaponTiers?: Partial<Record<string, unknown>>;
  equippedWeaponByClass?: Partial<Record<string, unknown>>;
};

export interface WeaponDebriefLine {
  kind: 'NEWLY_UNLOCKABLE' | 'NEARLY_READY' | 'EQUIPPED';
  label: string;
  detail: string;
}

export interface WeaponDebriefSummary {
  equippedFamilyId: WeaponFamilyId | null;
  equippedDisplayName: string | null;
  effectSummary: string | null;
  lines: WeaponDebriefLine[];
}

export type WeaponCombatStats = ResolvedWeaponCombatStats;

export interface WeaponValidationIssue {
  severity: 'error' | 'warn';
  weaponId?: WeaponFamilyId | string;
  message: string;
}
