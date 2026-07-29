import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState, WeaponFamilyId, WeaponRuntimeState } from '../types/weapon';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import { adjacentAliveUnits, isUnitAlive } from './combatSquadEngine';
import { isEnemyFractured } from './combatFractureEngine';
import type { EnvoyCatalystType } from './envoyCatalystEngine';

/** Brink Flux threshold for Sanguine Prism amp (live Void-Siphoned is at 0). */
export const PRISM_BRINK_FLUX_THRESHOLD = 25;
/** Max HP% sacrificed on Prism basic (telegraphed, capped). */
export const PRISM_BASIC_HP_SACRIFICE_PCT = 0.05;
export const PRISM_BASIC_HP_SACRIFICE_MAX = 8;
export const PRISM_BRINK_DAMAGE_MULT = 1.2;
/** Extra occult mult when the full intended HP sacrifice was actually paid. */
export const PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT = 1.15;
/** Null Conduit Clean Catalyst cycle — Flux refund + damage amp after NULL/BLOOD. */
export const CONDUIT_CLEAN_CYCLE_FLUX_BONUS = 4;
export const CONDUIT_CLEAN_CYCLE_DAMAGE_MULT = 1.12;
/** Echo Lantern Flux-Purge Rot detonation bonus per extra stack consumed. */
export const LANTERN_FLUX_PURGE_EXTRA_ROT_CONSUME = 1;
export const LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT = 8;
/** Nullbreach innate Kinetic Armor layer pressure on basic (reuse strip hook). */
export const NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS = 1;
export const NULLBREACH_ARMORED_DAMAGE_MULT = 1.1;

export interface AegisStrikeBasicPlan {
  familyId: WeaponFamilyId;
  kineticDamage: number;
  occultRiderDamage: number;
  fractureGain: number;
  reserveGain: number;
  staminaCost: number;
  consumeTempo: boolean;
  logLines: string[];
  mechanicalTags: readonly string[];
}

export interface HexBasicHitPlan {
  targetId: string;
  damage: number;
  fractureGain: number;
  isPrimary: boolean;
}

export interface HexBasicShotPlan {
  familyId: WeaponFamilyId;
  hits: HexBasicHitPlan[];
  ammoCost: number;
  staminaCost: number;
  logLines: string[];
  mechanicalTags: readonly string[];
  delivery: 'PRECISION' | 'SPREAD' | 'BREACH';
  /** Kinetic Armor layers stripped via existing stripKineticArmor before damage. */
  innateArmorPressureLayers: number;
}

export interface EnvoySplinterBasicPlan {
  familyId: WeaponFamilyId;
  occultDamage: number;
  fluxCost: number;
  /** Bonus Flux after cast (Conduit efficiency / wired veilFluxGainPct). */
  fluxBonus: number;
  rotStacks: number;
  hpSacrifice: number;
  /** Intended sacrifice before min-HP clamp — full payoff only when equal to hpSacrifice. */
  intendedHpSacrifice: number;
  sacrificePaidFully: boolean;
  brinkAmplified: boolean;
  cleanCatalystCycle: boolean;
  logLines: string[];
  mechanicalTags: readonly string[];
  invokeOccultCastHook: boolean;
  invokeSacrificeHook: boolean;
  invokeDebuffHook: boolean;
}

function scalePct(base: number, pct: number | undefined): number {
  if (!pct) return base;
  return Math.max(1, Math.floor(base * (1 + pct / 100)));
}

/**
 * Aegis unique STRIKE basic (Phase 3D/3E).
 * Baseline remains Kinetic; Veil Edge may add Occult rider when tempo is armed.
 */
export function resolveAegisStrikeBasic(args: {
  weapon: ResolvedWeaponState;
  runtime: WeaponRuntimeState;
  riposte: boolean;
  targetFractured: boolean;
}): AegisStrikeBasicPlan {
  const { weapon, runtime, riposte, targetFractured } = args;
  const profile = getWeaponIdentityProfile(weapon.familyId);
  const mods = weapon.statModifiers;
  const logLines: string[] = [];
  let kinetic = 10;
  let fractureGain = riposte ? 40 : 25;
  let reserveGain = 15;
  let staminaCost = 0;
  let occultRiderDamage = 0;
  let consumeTempo = false;

  switch (weapon.familyId) {
    case 'aegis-runed-longsword':
      kinetic = scalePct(12, mods.strikeDamagePct);
      fractureGain = riposte ? 42 : scalePct(28, mods.fractureFromMeleePct);
      reserveGain = 15 + (mods.reserveGainFlat ?? 0);
      logLines.push('[RUNED LONGSWORD] >> Steady Fracture strike.');
      break;
    case 'aegis-claymore-blade':
      kinetic = scalePct(11, mods.strikeDamagePct);
      fractureGain = riposte ? 48 : scalePct(38, mods.fractureFromMeleePct);
      staminaCost = Math.max(8, Math.floor(18 * (1 + (mods.strikeStaminaCostPct ?? 0) / 100)));
      reserveGain = 6 + (mods.reserveGainFlat ?? 0);
      logLines.push('[CLAYMORE] >> Heavy Fracture commitment.');
      break;
    case 'aegis-rift-edge':
      kinetic = scalePct(9, mods.strikeDamagePct ?? -5);
      fractureGain = riposte ? 30 : 14;
      reserveGain = 8 + (mods.reserveGainFlat ?? 0);
      if (runtime.riftEdgeTempoArmed) {
        occultRiderDamage = Math.max(4, Math.floor(kinetic * 0.45));
        reserveGain += 6;
        consumeTempo = true;
        logLines.push("[VEIL EDGE] >> Tempo payoff — Occult rider armed.");
      } else {
        logLines.push('[VEIL EDGE] >> Fast kinetic cut — bank evade/parry tempo for Occult rider.');
      }
      if (targetFractured) {
        kinetic = Math.floor(kinetic * 1.1);
      }
      break;
    default:
      kinetic = scalePct(10, mods.strikeDamagePct);
      break;
  }

  if (riposte) {
    const fracturedBonus = targetFractured ? 1.3 : 1.15;
    kinetic = Math.floor(kinetic * fracturedBonus);
  }

  return {
    familyId: weapon.familyId,
    kineticDamage: kinetic,
    occultRiderDamage,
    fractureGain,
    reserveGain,
    staminaCost,
    consumeTempo,
    logLines,
    mechanicalTags: profile.mechanicalTags,
  };
}

/**
 * Hex unique SILVER_CORE_SIDEARM basic — all weapons share ammo payload via hurtEnemy ammo effects.
 * Delivery pattern differs by family (3D). Does not duplicate Ash-Jacket Salvo.
 */
export function resolveHexBasicShot(args: {
  weapon: ResolvedWeaponState;
  squad: EnemyCombatProfile[];
  primaryTargetId: string;
  catalogBaseDamage: number;
  /** When true (e.g. Widow-Choke), suppress spread. */
  forceSingleTarget?: boolean;
}): HexBasicShotPlan {
  const { weapon, squad, primaryTargetId, catalogBaseDamage, forceSingleTarget } = args;
  const profile = getWeaponIdentityProfile(weapon.familyId);
  const mods = weapon.statModifiers;
  const primary = squad.find((u) => u.unitId === primaryTargetId && isUnitAlive(u));
  const logLines: string[] = [];

  if (!primary?.unitId) {
    return {
      familyId: weapon.familyId,
      hits: [],
      ammoCost: 1,
      staminaCost: 0,
      logLines: ['[REJECTED] >> Basic shot requires a target.'],
      mechanicalTags: profile.mechanicalTags,
      delivery: 'PRECISION',
      innateArmorPressureLayers: 0,
    };
  }

  switch (weapon.familyId) {
    case 'hex-silver-core-sidearm': {
      let dmg = scalePct(catalogBaseDamage || 10, mods.ballisticDamagePct);
      let fractureGain = 15;
      const hpRatio = primary.maxHp > 0 ? primary.currentHp / primary.maxHp : 1;
      if (hpRatio <= 0.3) {
        dmg = Math.floor(dmg * 1.15);
        fractureGain = 20;
        logLines.push('[SIDEARM] >> Execution window — precise finish.');
      } else {
        logLines.push('[SIDEARM] >> Efficient ballistic shot.');
      }
      return {
        familyId: weapon.familyId,
        hits: [{ targetId: primary.unitId, damage: dmg, fractureGain, isPrimary: true }],
        ammoCost: 1,
        staminaCost: 0,
        logLines,
        mechanicalTags: profile.mechanicalTags,
        delivery: 'PRECISION',
        innateArmorPressureLayers: 0,
      };
    }
    case 'hex-void-cannon': {
      let dmg = scalePct(16, mods.ballisticDamagePct);
      const staminaCost = Math.max(4, Math.floor(10 * (1 + (mods.strikeStaminaCostPct ?? 0) / 100)));
      const armored = (primary.kineticArmor ?? 0) > 0;
      if (armored) {
        dmg = Math.floor(dmg * NULLBREACH_ARMORED_DAMAGE_MULT);
        logLines.push('[NULLBREACH] >> Breach round — Kinetic Armor layer pressure.');
      } else {
        logLines.push('[NULLBREACH] >> Breach round — no Kinetic Armor to peel (overcommit risk).');
      }
      return {
        familyId: weapon.familyId,
        hits: [{ targetId: primary.unitId, damage: dmg, fractureGain: 12, isPrimary: true }],
        ammoCost: 1,
        staminaCost,
        logLines,
        mechanicalTags: profile.mechanicalTags,
        delivery: 'BREACH',
        // Innate KA pressure — not dependent on an external pierce mod graft.
        innateArmorPressureLayers: NULLBREACH_INNATE_ARMOR_PRESSURE_LAYERS,
      };
    }
    case 'hex-pulse-rifle': {
      // Ash Shotgun fantasy — repeatable spread, weaker than Ash-Jacket Salvo burst.
      // Missing secondary contacts are NEVER redirected onto the primary.
      const primaryDmg = scalePct(8, mods.ballisticDamagePct);
      const splashDmg = Math.max(3, Math.floor(primaryDmg * 0.55));
      const hits: HexBasicHitPlan[] = [
        { targetId: primary.unitId, damage: primaryDmg, fractureGain: 18, isPrimary: true },
      ];
      if (!forceSingleTarget) {
        const adjacent = adjacentAliveUnits(squad, primary.unitId)
          .filter((u) => u.unitId && u.unitId !== primary.unitId)
          .slice(0, 2);
        adjacent.forEach((u) => {
          if (!u.unitId) return;
          hits.push({
            targetId: u.unitId,
            damage: splashDmg,
            fractureGain: 10,
            isPrimary: false,
          });
        });
      }
      logLines.push(
        hits.length > 1
          ? `[ASH PATTERN] >> Spread — ${hits.length} contacts (basic, not Ash-Jacket Salvo).`
          : forceSingleTarget
            ? '[ASH PATTERN] >> Spread choked to single target.'
            : '[ASH PATTERN] >> Spread finds only the primary — poor isolated precision.',
      );
      return {
        familyId: weapon.familyId,
        hits,
        ammoCost: 1,
        staminaCost: 0,
        logLines,
        mechanicalTags: profile.mechanicalTags,
        delivery: 'SPREAD',
        innateArmorPressureLayers: 0,
      };
    }
    default:
      return {
        familyId: weapon.familyId,
        hits: [{
          targetId: primary.unitId,
          damage: catalogBaseDamage || 10,
          fractureGain: 15,
          isPrimary: true,
        }],
        ammoCost: 1,
        staminaCost: 0,
        logLines,
        mechanicalTags: profile.mechanicalTags,
        delivery: 'PRECISION',
        innateArmorPressureLayers: 0,
      };
  }
}

/**
 * Envoy unique VEIL_SPLINTER basic (3D/3E). Changes Flux/Rot/sacrifice decisions.
 *
 * Prism order of operations (once per basic resolution):
 * 1. Scale occult base by occultDamagePct
 * 2. Compute intended HP sacrifice = min(MAX, floor(maxHp * PCT)), never kill (cap to hp-1)
 * 3. If Flux ≤ BRINK threshold → apply Brink damage mult
 * 4. If intended sacrifice was fully paid → apply sacrifice-payoff damage mult + enable sacrifice hooks
 * 5. Charge HP sacrifice exactly once (caller applies via applyHpSacrifice)
 */
export function resolveEnvoySplinterBasic(args: {
  weapon: ResolvedWeaponState;
  catalogDamage: number;
  catalogFluxCost: number;
  veilFlux: number;
  operativeHp: number;
  maxHp: number;
  /** Prior catalyst for Null Conduit Clean Cycle (NULL/BLOOD reward sequencing). */
  previousCatalyst?: EnvoyCatalystType | null;
}): EnvoySplinterBasicPlan {
  const {
    weapon,
    catalogDamage,
    catalogFluxCost,
    veilFlux,
    operativeHp,
    maxHp,
    previousCatalyst = null,
  } = args;
  const profile = getWeaponIdentityProfile(weapon.familyId);
  const mods = weapon.statModifiers;
  const logLines: string[] = [];
  let occultDamage = scalePct(catalogDamage || 10, mods.occultDamagePct);
  let fluxCost = catalogFluxCost || 5;
  let fluxBonus = 0;
  let rotStacks = 1;
  let hpSacrifice = 0;
  let intendedHpSacrifice = 0;
  let sacrificePaidFully = false;
  let brinkAmplified = false;
  let cleanCatalystCycle = false;
  let invokeOccultCastHook = true;
  let invokeSacrificeHook = false;
  let invokeDebuffHook = false;

  switch (weapon.familyId) {
    case 'envoy-null-conduit':
      fluxCost = Math.max(3, fluxCost - 1);
      occultDamage = scalePct(catalogDamage || 10, mods.occultDamagePct);
      rotStacks = 1;
      if (mods.veilFluxGainPct) {
        fluxBonus = Math.max(1, Math.floor(fluxCost * (mods.veilFluxGainPct / 100)));
      }
      // Clean Catalyst cycle: reward using Splinter after NULL (prior Splinter) or BLOOD (Flux dump).
      if (previousCatalyst === 'NULL' || previousCatalyst === 'BLOOD') {
        cleanCatalystCycle = true;
        fluxBonus += CONDUIT_CLEAN_CYCLE_FLUX_BONUS;
        occultDamage = Math.floor(occultDamage * CONDUIT_CLEAN_CYCLE_DAMAGE_MULT);
        logLines.push(
          `[NULL CONDUIT] >> Clean Catalyst cycle (${previousCatalyst}→NULL) — Flux + damage.`,
        );
      } else {
        logLines.push('[NULL CONDUIT] >> Clean Flux cycle — sequence Catalyst for payoff.');
      }
      break;
    case 'envoy-echo-lantern':
      occultDamage = Math.max(4, Math.floor(scalePct(catalogDamage || 10, mods.occultDamagePct) * 0.7));
      fluxCost = catalogFluxCost || 5;
      rotStacks = 2;
      invokeDebuffHook = true;
      logLines.push('[ECHO LANTERN] >> Echo brand — extra Veil Rot for later detonation.');
      break;
    case 'envoy-sanguine-prism': {
      occultDamage = scalePct(Math.max(catalogDamage || 10, 12), mods.occultDamagePct);
      fluxCost = (catalogFluxCost || 5) + 2;
      intendedHpSacrifice = Math.min(
        PRISM_BASIC_HP_SACRIFICE_MAX,
        Math.max(1, Math.floor(maxHp * PRISM_BASIC_HP_SACRIFICE_PCT)),
      );
      hpSacrifice = Math.min(intendedHpSacrifice, Math.max(0, operativeHp - 1));
      sacrificePaidFully = hpSacrifice > 0 && hpSacrifice === intendedHpSacrifice;
      invokeSacrificeHook = sacrificePaidFully;

      if (veilFlux <= PRISM_BRINK_FLUX_THRESHOLD) {
        occultDamage = Math.floor(occultDamage * PRISM_BRINK_DAMAGE_MULT);
        brinkAmplified = true;
        logLines.push(`[SANGUINE PRISM] >> Brink amp (Flux ≤${PRISM_BRINK_FLUX_THRESHOLD}%).`);
      }
      if (sacrificePaidFully) {
        occultDamage = Math.floor(occultDamage * PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT);
        logLines.push(
          `[SANGUINE PRISM] >> Blood price paid in full — ${hpSacrifice} HP (cap ${PRISM_BASIC_HP_SACRIFICE_MAX}).`,
        );
      } else if (hpSacrifice > 0) {
        logLines.push(
          `[SANGUINE PRISM] >> Partial blood price ${hpSacrifice}/${intendedHpSacrifice} HP — sacrifice payoff withheld.`,
        );
      } else {
        logLines.push('[SANGUINE PRISM] >> No HP to sacrifice — sacrifice payoff withheld.');
      }
      break;
    }
    default:
      break;
  }

  return {
    familyId: weapon.familyId,
    occultDamage,
    fluxCost,
    fluxBonus,
    rotStacks,
    hpSacrifice,
    intendedHpSacrifice,
    sacrificePaidFully,
    brinkAmplified,
    cleanCatalystCycle,
    logLines,
    mechanicalTags: profile.mechanicalTags,
    invokeOccultCastHook,
    invokeSacrificeHook,
    invokeDebuffHook,
  };
}

/** Deterministic Prism basic simulation for closeout reporting (no combat side effects). */
export function simulatePrismBasicSequence(
  steps: readonly { hp: number; maxHp: number; flux: number }[],
  catalogDamage = 12,
  catalogFluxCost = 5,
): readonly {
  step: number;
  hpIn: number;
  fluxIn: number;
  intendedSacrifice: number;
  paidSacrifice: number;
  sacrificePaidFully: boolean;
  brinkAmplified: boolean;
  occultDamage: number;
  hpOut: number;
}[] {
  const weapon = {
    familyId: 'envoy-sanguine-prism' as const,
    statModifiers: { occultDamagePct: 10 },
  };
  return steps.map((s, i) => {
    const plan = resolveEnvoySplinterBasic({
      weapon: weapon as unknown as ResolvedWeaponState,
      catalogDamage,
      catalogFluxCost,
      veilFlux: s.flux,
      operativeHp: s.hp,
      maxHp: s.maxHp,
    });
    return {
      step: i + 1,
      hpIn: s.hp,
      fluxIn: s.flux,
      intendedSacrifice: plan.intendedHpSacrifice,
      paidSacrifice: plan.hpSacrifice,
      sacrificePaidFully: plan.sacrificePaidFully,
      brinkAmplified: plan.brinkAmplified,
      occultDamage: plan.occultDamage,
      hpOut: Math.max(1, s.hp - plan.hpSacrifice),
    };
  });
}

/** Claymore 3E — Reserve cashout when Fracture breaks. */
export function resolveClaymoreFractureBreakReserve(
  familyId: WeaponFamilyId,
  runtime: WeaponRuntimeState,
): { reserveGain: number; runtimePatch?: Partial<WeaponRuntimeState>; log?: string } {
  if (familyId !== 'aegis-claymore-blade') return { reserveGain: 0 };
  if (runtime.claymoreBreakCashoutUsed) {
    return { reserveGain: 8, log: '[CLAYMORE] >> Fracture break — Reserve pulse.' };
  }
  return {
    reserveGain: 22,
    runtimePatch: { claymoreBreakCashoutUsed: true },
    log: '[CLAYMORE] >> First Fracture break cashout — major Reserve.',
  };
}

export function armRiftEdgeTempo(runtime: WeaponRuntimeState): WeaponRuntimeState {
  return { ...runtime, riftEdgeTempoArmed: true };
}

export function consumeRiftEdgeTempo(runtime: WeaponRuntimeState): WeaponRuntimeState {
  return { ...runtime, riftEdgeTempoArmed: false };
}

export function noteMagazineEmptied(runtime: WeaponRuntimeState): WeaponRuntimeState {
  return { ...runtime, magazineEmptiedThisCombat: true };
}

export function isTargetUsefulForWeaponBasic(
  familyId: WeaponFamilyId,
  target: EnemyCombatProfile | null | undefined,
): boolean {
  if (!target) return false;
  if (familyId === 'hex-void-cannon') {
    return (target.kineticArmor ?? 0) > 0 || isEnemyFractured(target);
  }
  return true;
}
