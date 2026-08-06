import type { ClassType } from './game';
import type { ResourceItemId } from './resourceItem';
import type { ResolvedWeaponCombatStats } from '../data/inventory';

export type WeaponFamilyId =
  | 'aegis-runed-longsword'
  | 'aegis-claymore-blade'
  | 'aegis-rift-edge'
  | 'hex-silver-core-sidearm'
  | 'hex-pulse-rifle'
  | 'hex-void-cannon'
  | 'envoy-null-conduit'
  | 'envoy-sanguine-prism'
  | 'envoy-echo-lantern';

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

export type WeaponOncePerCombatPassiveId =
  | 'FIRST_MELEE_RESERVE_BONUS'
  /**
   * Unmaker Tier III — +Abyssal Reserve when an authored WA causes a Fracture break.
   * Once per committed action (not once-per-combat). Graft-added hits excluded.
   */
  | 'FRACTURE_BREAK_RESERVE'
  /** @deprecated E.1b — alias of FRACTURE_BREAK_RESERVE; no Stamina grant. */
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
  tiers: readonly [WeaponTierDefinition, WeaponTierDefinition, WeaponTierDefinition];
  uiSummary: string;
  masterworkUnlocked: boolean;
  masterworkRecipeId: string | null;
  requiresAnomalousCore: boolean;
  masterworkEffectSummary: string;
}

export interface WeaponRuntimeState {
  firstMeleeHitUsed: boolean;
  firstFractureUsed: boolean;
  firstReloadUsed: boolean;
  firstOccultAbilityUsed: boolean;
  firstDebuffApplied: boolean;
  sacrificeHpBonusUsed: boolean;
  firstArmoredHitUsed: boolean;
  postReloadBallisticBonus: boolean;
  /** Veil Edge — armed by evade/parry success; consumed by Occult rider basic. */
  riftEdgeTempoArmed: boolean;
  /** Claymore — first Fracture-break cashout per encounter. */
  claymoreBreakCashoutUsed: boolean;
  /** Hex shotgun / mag loop — emptied at least once this combat. */
  magazineEmptiedThisCombat: boolean;
}

export interface ResolvedWeaponState {
  familyId: WeaponFamilyId;
  tier: WeaponTierNumber;
  displayName: string;
  statModifiers: WeaponStatModifiers;
  oncePerCombatPassive?: WeaponOncePerCombatPassiveId;
  passiveBonusPct?: number;
  effectSummary: string;
  tags: readonly WeaponTag[];
  classId: ClassType;
}

export interface WeaponProgressionState {
  weaponUnlocks: WeaponFamilyId[];
  weaponTiers: Partial<Record<WeaponFamilyId, WeaponTierNumber>>;
  equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>>;
}

export interface WeaponDebriefLine {
  kind: 'NEWLY_UNLOCKABLE' | 'UPGRADE_AVAILABLE' | 'NEARLY_READY' | 'EQUIPPED';
  label: string;
  detail: string;
}

export interface WeaponDebriefSummary {
  equippedFamilyId: WeaponFamilyId | null;
  equippedDisplayName: string | null;
  equippedTier: WeaponTierNumber | null;
  effectSummary: string | null;
  lines: WeaponDebriefLine[];
}

export type WeaponCombatStats = ResolvedWeaponCombatStats;

export interface WeaponValidationIssue {
  severity: 'error' | 'warn';
  weaponId?: WeaponFamilyId | string;
  message: string;
}
