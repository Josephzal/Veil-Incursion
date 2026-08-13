import { resolveWeaponCombatStats, type ResolvedWeaponCombatStats } from './inventory';
import type { ClassType } from '../types/game';
import type { CombatHookContext, CombatHookResult, CombatSessionExtras } from '../types/combatHooks';
import type { EnemyCombatProfile } from '../types/run';
import { COMBAT_ACTION } from '../types/run';
import type {
  ResolvedWeaponState,
  WeaponRuntimeState,
  WeaponStatModifiers,
} from '../types/weapon';
import { resolveWeaponState } from './weaponProgressionEngine';
import type { WeaponFamilyId } from '../types/weapon';
import { getWeaponFamily } from './weaponRegistry';
import { isEnemyFractured } from './combatFractureEngine';
import { stripKineticArmor } from './combatDefenseLayerEngine';
import { resolveAegisTechniqueStrikePower } from './aegisTechniquePowerEngine';
import { resolveAegisUltimateStrikePower } from './aegisUltimatePowerEngine';

export function resolveWeaponCombatStatsFromState(
  weapon: ResolvedWeaponState,
): ResolvedWeaponCombatStats {
  const baseDamage = COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE;
  const baseStamina = COMBAT_ACTION.ABYSSAL_STRIKE_STAMINA;
  const mods = weapon.statModifiers;

  const damageMult = 1 + (mods.strikeDamagePct ?? 0) / 100;
  const staminaMult = 1 + (mods.strikeStaminaCostPct ?? 0) / 100;
  const reserveMult = 1 + (mods.reserveGainPct ?? 0) / 100;
  const reserveFlat = mods.reserveGainFlat ?? 0;

  const strikeDamage = Math.max(1, Math.floor(baseDamage * damageMult));
  const strikeStaminaCost = Math.max(1, Math.floor(baseStamina * staminaMult));
  const baseReserve = COMBAT_ACTION.ABYSSAL_RESERVE_CHARGE;
  const abyssalChargePerStrike = Math.round(baseReserve * reserveMult) + reserveFlat;

  const resolved = resolveWeaponCombatStats(
    {
      baseDamageOverride: strikeDamage,
      staminaCostModifier: strikeStaminaCost - baseStamina,
      abyssalGainModifier: reserveFlat > 0 ? reserveFlat / baseReserve : (mods.reserveGainPct ?? 0) / 100,
    },
    weapon.displayName,
  );
  if (weapon.classId === 'AEGIS') {
    return {
      ...resolved,
      aegisTechniqueStrikePower: resolveAegisTechniqueStrikePower(mods),
      aegisUltimateStrikePower: resolveAegisUltimateStrikePower(mods),
    };
  }
  return resolved;
}

export function resolveWeaponMagazineBonus(mods: WeaponStatModifiers): number {
  return mods.magazineSizeBonus ?? 0;
}

export function applyWeaponBallisticDamageMultiplier(
  damage: number,
  mods: WeaponStatModifiers,
  _postReloadBonus = false,
  _passiveBonusPct = 0,
  /**
   * H.2a — when true, skip family ballisticDamagePct (already applied in
   * resolveHexBasicShot).
   */
  options?: { skipFamilyBallisticPct?: boolean },
): number {
  const mult = options?.skipFamilyBallisticPct
    ? 1
    : 1 + (mods.ballisticDamagePct ?? 0) / 100;
  if (mult === 1) return Math.max(0, damage);
  return Math.max(0, Math.floor(damage * mult));
}

export function applyWeaponOccultDamageMultiplier(
  damage: number,
  mods: WeaponStatModifiers,
): number {
  const mult = 1 + (mods.occultDamagePct ?? 0) / 100;
  return Math.max(0, Math.floor(damage * mult));
}

export function scaleFractureGain(baseGain: number, mods: WeaponStatModifiers): number {
  const mult = 1 + (mods.fractureFromMeleePct ?? 0) / 100;
  return Math.max(0, Math.floor(baseGain * mult));
}

export function weaponCritChanceBonus(mods: WeaponStatModifiers): number {
  return mods.critChancePct ?? 0;
}

export function weaponArmorPierceLayers(mods: WeaponStatModifiers): number {
  return Math.max(0, mods.armorPierceLayers ?? 0);
}

/** Shotgun floors pierce at innate pressure so armor identity is never graft-only. */
export function resolveWeaponArmorPressureLayers(
  familyId: WeaponFamilyId,
  mods: WeaponStatModifiers,
  innateFloor = 0,
): number {
  const fromMods = weaponArmorPierceLayers(mods);
  if (familyId === 'hex-shotgun') {
    return Math.max(fromMods, innateFloor, 1);
  }
  return Math.max(fromMods, innateFloor);
}

export function weaponHealReceivedMultiplier(mods: WeaponStatModifiers): number {
  const pct = mods.healReceivedPct ?? 0;
  return Math.max(0.1, 1 + pct / 100);
}

export interface WeaponHookContext extends CombatHookContext {
  weapon: ResolvedWeaponState;
  runtime: WeaponRuntimeState;
}

export interface WeaponHookResult extends CombatHookResult {
  runtimePatch?: Partial<WeaponRuntimeState>;
  staminaDelta?: number;
  reserveDelta?: number;
  veilFluxDelta?: number;
  enemyArmorStrip?: number;
}

/** Stage II-C — Tier III once-per-combat melee passives removed. */
export function runWeaponOnMeleeHitHooks(
  _ctx: WeaponHookContext,
  _isCrit: boolean,
): WeaponHookResult {
  return { logLines: [], runtimePatch: {} };
}

/** Stage II-C — Tier III fracture passives removed (family claymore cashout is separate). */
export function runWeaponOnFractureHooks(_ctx: WeaponHookContext): WeaponHookResult {
  return { logLines: [], runtimePatch: {} };
}

/** Stage II-C — Tier III reload passives removed. */
export function runWeaponOnReloadHooks(_ctx: WeaponHookContext): WeaponHookResult {
  return { logLines: [], runtimePatch: {} };
}

/** Stage II-C — Tier III armored-hit passives removed (baseline pierce remains on mods). */
export function runWeaponOnBallisticHitHooks(
  _ctx: WeaponHookContext,
  _target: EnemyCombatProfile,
): WeaponHookResult {
  return { logLines: [], runtimePatch: {} };
}

/** Stage II-C — Tier III first-occult passives removed. */
export function runWeaponOnOccultCastHooks(_ctx: WeaponHookContext): WeaponHookResult {
  return { logLines: [], runtimePatch: {} };
}

/**
 * Baseline sacrificeResourceBonus from family profile still applies.
 * Tier III once-per-combat sacrifice bonus removed.
 */
export function runWeaponOnSacrificeHpHooks(ctx: WeaponHookContext): WeaponHookResult {
  const veilFluxDelta = ctx.weapon.statModifiers.sacrificeResourceBonus ?? 0;
  return { logLines: [], runtimePatch: {}, veilFluxDelta };
}

/** Stage II-C — Tier III first-debuff ward passive removed. */
export function runWeaponOnDebuffAppliedHooks(
  _ctx: WeaponHookContext,
  _extras: CombatSessionExtras,
): WeaponHookResult {
  return { logLines: [], runtimePatch: {} };
}

export function buildResolvedWeaponForRun(familyId: WeaponFamilyId): ResolvedWeaponState {
  return resolveWeaponState(familyId);
}

export function formatWeaponStatLines(weapon: ResolvedWeaponState): string[] {
  const lines: string[] = [];
  const mods = weapon.statModifiers;
  const aegisWaSurface = weapon.classId === 'AEGIS';
  if (mods.strikeDamagePct && !aegisWaSurface) {
    lines.push(`${mods.strikeDamagePct > 0 ? '+' : ''}${mods.strikeDamagePct}% Strike Damage`);
  }
  if (mods.fractureFromMeleePct) lines.push(`+${mods.fractureFromMeleePct}% Fracture from melee`);
  if (mods.strikeStaminaCostPct && !aegisWaSurface) {
    lines.push(`${mods.strikeStaminaCostPct > 0 ? '+' : ''}${mods.strikeStaminaCostPct}% Stamina Cost`);
  }
  if (mods.magazineSizeBonus) lines.push(`${mods.magazineSizeBonus > 0 ? '+' : ''}${mods.magazineSizeBonus} Magazine`);
  if (mods.ballisticDamagePct) lines.push(`${mods.ballisticDamagePct > 0 ? '+' : ''}${mods.ballisticDamagePct}% Ballistic Damage`);
  if (mods.occultDamagePct) lines.push(`${mods.occultDamagePct > 0 ? '+' : ''}${mods.occultDamagePct}% Occult Damage`);
  if (mods.critChancePct) lines.push(`+${mods.critChancePct}% Crit Chance`);
  if (mods.armorPierceLayers) lines.push(`Pierce ${mods.armorPierceLayers} armor layer(s)`);
  if (weapon.effectSummary) lines.push(weapon.effectSummary);
  return lines;
}

export function getWeaponUiSummary(familyId: WeaponFamilyId): string {
  return getWeaponFamily(familyId).uiSummary;
}

export function targetHasArmor(target: EnemyCombatProfile | undefined): boolean {
  if (!target) return false;
  return (target.kineticArmor ?? 0) > 0;
}

export function applyWeaponArmorPierceToTarget(
  target: EnemyCombatProfile,
  pierceLayers: number,
): EnemyCombatProfile {
  if (pierceLayers <= 0) return target;
  return stripKineticArmor(target, pierceLayers).enemy;
}

export function stripExtraArmorFromTarget(
  target: EnemyCombatProfile,
  layers: number,
): EnemyCombatProfile {
  return stripKineticArmor(target, layers).enemy;
}

/** @deprecated Stage II-C — post-reload Tier III bonus removed. */
export function didWeaponPostReloadBonus(_runtime: WeaponRuntimeState): boolean {
  return false;
}

/** @deprecated Stage II-C — post-reload Tier III bonus removed. */
export function consumeWeaponPostReloadBonus(runtime: WeaponRuntimeState): WeaponRuntimeState {
  return runtime;
}

export function isFractureEvent(target: EnemyCombatProfile, wasFractured: boolean): boolean {
  return !wasFractured && (isEnemyFractured(target) || target.fracturedThisRound === true);
}

export function resolveWeaponForClassAccount(
  classId: ClassType,
  familyId: WeaponFamilyId,
): ResolvedWeaponState {
  const weapon = resolveWeaponState(familyId);
  if (weapon.classId !== classId) {
    throw new Error(`Weapon ${familyId} does not belong to class ${classId}`);
  }
  return weapon;
}
