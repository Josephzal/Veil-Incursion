import { resolveWeaponCombatStats, type ResolvedWeaponCombatStats } from './inventory';
import type { ClassType } from '../types/game';
import type { CombatHookContext, CombatHookResult, CombatSessionExtras } from '../types/combatHooks';
import type { EnemyCombatProfile } from '../types/run';
import { COMBAT_ACTION } from '../types/run';
import { DEFAULT_MAGAZINE_SIZE } from '../types/classCombatResources';
import type {
  ResolvedWeaponState,
  WeaponOncePerCombatPassiveId,
  WeaponRuntimeState,
  WeaponStatModifiers,
} from '../types/weapon';
import { resolveWeaponState } from './weaponProgressionEngine';
import type { WeaponFamilyId, WeaponTierNumber } from '../types/weapon';
import { getWeaponFamily } from './weaponRegistry';
import { isEnemyFractured } from './combatFractureEngine';

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

  return resolveWeaponCombatStats(
    {
      baseDamageOverride: strikeDamage,
      staminaCostModifier: strikeStaminaCost - baseStamina,
      abyssalGainModifier: reserveFlat > 0 ? reserveFlat / baseReserve : (mods.reserveGainPct ?? 0) / 100,
    },
    weapon.displayName,
  );
}

export function resolveWeaponMagazineBonus(mods: WeaponStatModifiers): number {
  return mods.magazineSizeBonus ?? 0;
}

export function applyWeaponBallisticDamageMultiplier(
  damage: number,
  mods: WeaponStatModifiers,
  postReloadBonus: boolean,
  passiveBonusPct = 0,
): number {
  let mult = 1 + (mods.ballisticDamagePct ?? 0) / 100;
  if (postReloadBonus) {
    mult *= 1 + passiveBonusPct / 100;
  }
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

function passiveLabel(passive: WeaponOncePerCombatPassiveId): string {
  switch (passive) {
    case 'FIRST_MELEE_RESERVE_BONUS': return 'WEAPON';
    case 'FIRST_FRACTURE_STAMINA_REFUND': return 'CLAYMORE';
    case 'MELEE_CRIT_RESERVE_BONUS': return 'RIFT EDGE';
    case 'FIRST_RELOAD_STAMINA': return 'SIDEARM';
    case 'POST_RELOAD_BALLISTIC_DAMAGE': return 'PULSE RIFLE';
    case 'FIRST_ARMORED_HIT_EXTRA_ARMOR_STRIP': return 'VOID CANNON';
    case 'FIRST_OCCULT_RESOURCE_BONUS': return 'NULL CONDUIT';
    case 'SACRIFICE_HP_RESOURCE_BONUS': return 'SANGUINE PRISM';
    case 'FIRST_DEBUFF_WARD': return 'ECHO LANTERN';
    default: return 'WEAPON';
  }
}

export function runWeaponOnMeleeHitHooks(
  ctx: WeaponHookContext,
  isCrit: boolean,
): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  let reserveDelta = 0;
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;

  if (passive === 'FIRST_MELEE_RESERVE_BONUS' && !ctx.runtime.firstMeleeHitUsed) {
    runtimePatch.firstMeleeHitUsed = true;
    reserveDelta = bonus;
    logLines.push(`[${passiveLabel(passive)}] >> First melee hit — +${bonus} Abyssal Reserve.`);
  }
  if (passive === 'MELEE_CRIT_RESERVE_BONUS' && isCrit) {
    reserveDelta += bonus;
    logLines.push(`[${passiveLabel(passive)}] >> Melee crit — +${bonus} Abyssal Reserve.`);
  }

  return { logLines, runtimePatch, reserveDelta };
}

export function runWeaponOnFractureHooks(ctx: WeaponHookContext): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  let staminaDelta = 0;
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;

  if (passive === 'FIRST_FRACTURE_STAMINA_REFUND' && !ctx.runtime.firstFractureUsed) {
    runtimePatch.firstFractureUsed = true;
    staminaDelta = bonus;
    logLines.push(`[${passiveLabel(passive)}] >> First Fracture — +${bonus} Stamina restored.`);
  }

  return { logLines, runtimePatch, staminaDelta };
}

export function runWeaponOnReloadHooks(ctx: WeaponHookContext): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  let staminaDelta = 0;
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;

  if (passive === 'FIRST_RELOAD_STAMINA' && !ctx.runtime.firstReloadUsed) {
    runtimePatch.firstReloadUsed = true;
    staminaDelta = bonus;
    logLines.push(`[${passiveLabel(passive)}] >> First reload — +${bonus} Stamina restored.`);
  }
  if (passive === 'POST_RELOAD_BALLISTIC_DAMAGE') {
    runtimePatch.postReloadBallisticBonus = true;
    logLines.push(`[${passiveLabel(passive)}] >> Next Ballistic attack deals +${bonus}% damage.`);
  }

  return { logLines, runtimePatch, staminaDelta };
}

export function runWeaponOnBallisticHitHooks(
  ctx: WeaponHookContext,
  target: EnemyCombatProfile,
): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;
  const armorLayers = target.kineticArmor ?? 0;

  if (
    passive === 'FIRST_ARMORED_HIT_EXTRA_ARMOR_STRIP'
    && !ctx.runtime.firstArmoredHitUsed
    && armorLayers > 0
  ) {
    runtimePatch.firstArmoredHitUsed = true;
    logLines.push(`[${passiveLabel(passive)}] >> First armored hit — ${bonus} additional armor stripped.`);
    return {
      logLines,
      runtimePatch,
      enemyArmorStrip: bonus,
    };
  }

  return { logLines, runtimePatch };
}

export function runWeaponOnOccultCastHooks(ctx: WeaponHookContext): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  let veilFluxDelta = 0;
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;

  if (passive === 'FIRST_OCCULT_RESOURCE_BONUS' && !ctx.runtime.firstOccultAbilityUsed) {
    runtimePatch.firstOccultAbilityUsed = true;
    veilFluxDelta = bonus;
    logLines.push(`[${passiveLabel(passive)}] >> First Occult ability — +${bonus} Veil-Flux.`);
  }

  return { logLines, runtimePatch, veilFluxDelta };
}

export function runWeaponOnSacrificeHpHooks(ctx: WeaponHookContext): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  let veilFluxDelta = 0;
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;

  if (passive === 'SACRIFICE_HP_RESOURCE_BONUS' && !ctx.runtime.sacrificeHpBonusUsed) {
    runtimePatch.sacrificeHpBonusUsed = true;
    veilFluxDelta = bonus;
    logLines.push(`[${passiveLabel(passive)}] >> HP sacrifice — +${bonus} Veil-Flux.`);
  } else if (ctx.weapon.statModifiers.sacrificeResourceBonus) {
    veilFluxDelta = ctx.weapon.statModifiers.sacrificeResourceBonus;
  }

  return { logLines, runtimePatch, veilFluxDelta };
}

export function runWeaponOnDebuffAppliedHooks(ctx: WeaponHookContext, extras: CombatSessionExtras): WeaponHookResult {
  const logLines: string[] = [];
  const runtimePatch: Partial<WeaponRuntimeState> = {};
  const passive = ctx.weapon.oncePerCombatPassive;
  const bonus = ctx.weapon.passiveBonusPct ?? 0;

  if (passive === 'FIRST_DEBUFF_WARD' && !ctx.runtime.firstDebuffApplied) {
    runtimePatch.firstDebuffApplied = true;
    extras.playerShield = (extras.playerShield ?? 0) + bonus;
    extras.playerShieldTurnsRemaining = Math.max(extras.playerShieldTurnsRemaining ?? 0, 1);
    logLines.push(`[${passiveLabel(passive)}] >> First debuff — +${bonus} temporary ward.`);
    return {
      logLines,
      runtimePatch,
      playerShieldDelta: bonus,
      playerShieldTurns: 1,
    };
  }

  return { logLines, runtimePatch };
}

export function buildResolvedWeaponForRun(
  familyId: WeaponFamilyId,
  tier: WeaponTierNumber,
): ResolvedWeaponState {
  return resolveWeaponState(familyId, tier);
}

export function formatWeaponStatLines(weapon: ResolvedWeaponState): string[] {
  const lines: string[] = [];
  const mods = weapon.statModifiers;
  if (mods.strikeDamagePct) lines.push(`${mods.strikeDamagePct > 0 ? '+' : ''}${mods.strikeDamagePct}% Strike Damage`);
  if (mods.fractureFromMeleePct) lines.push(`+${mods.fractureFromMeleePct}% Fracture from melee`);
  if (mods.strikeStaminaCostPct) lines.push(`${mods.strikeStaminaCostPct > 0 ? '+' : ''}${mods.strikeStaminaCostPct}% Stamina Cost`);
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
  return {
    ...target,
    kineticArmor: Math.max(0, (target.kineticArmor ?? 0) - pierceLayers),
  };
}

export function stripExtraArmorFromTarget(
  target: EnemyCombatProfile,
  layers: number,
): EnemyCombatProfile {
  return {
    ...target,
    kineticArmor: Math.max(0, (target.kineticArmor ?? 0) - layers),
  };
}

export function didWeaponPostReloadBonus(runtime: WeaponRuntimeState): boolean {
  return runtime.postReloadBallisticBonus;
}

export function consumeWeaponPostReloadBonus(runtime: WeaponRuntimeState): WeaponRuntimeState {
  return { ...runtime, postReloadBallisticBonus: false };
}

export function isFractureEvent(target: EnemyCombatProfile, wasFractured: boolean): boolean {
  return !wasFractured && (isEnemyFractured(target) || target.fracturedThisRound === true);
}

export function resolveWeaponForClassAccount(
  classId: ClassType,
  familyId: WeaponFamilyId,
  tier: WeaponTierNumber,
): ResolvedWeaponState {
  const weapon = resolveWeaponState(familyId, tier);
  if (weapon.classId !== classId) {
    throw new Error(`Weapon ${familyId} does not belong to class ${classId}`);
  }
  return weapon;
}
