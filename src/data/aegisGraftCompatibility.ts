/**
 * Phase D — mechanic-aware Aegis graft eligibility (not “any non-Ultimate”).
 */
import type { AegisTechniqueId, AegisWeaponActionId } from '../types/aegisCombat';
import { AEGIS_AP_UTILITY_TECHNIQUES } from '../types/aegisCombat';
import type { VeilGraftId } from '../types/veilGraft';
import { getVeilGraftDefinition } from './veilGraftDatabase';
import {
  isAegisFixedBasicStrike,
  isAegisGraftableUltimateId,
  type AegisGraftTarget,
} from './aegisGraftTarget';
import { isAegisTechniqueId } from './aegisTechniqueCatalog';
import { isAegisWeaponActionCatalogId } from './aegisWeaponActionCatalog';
const AP_ONLY = new Set<string>(AEGIS_AP_UTILITY_TECHNIQUES);

/** Hard-ban: undeclared non-AP activation costs on AP-only utilities. */
export const AP_UTILITY_COST_BANNED_GRAFTS = new Set<VeilGraftId>([
  'DENSITY_GRAFT',
  'SANGUINE_GRAFT',
  'NEUTRON_GRAFT',
  'CONDUIT_GRAFT',
]);

/** Echo / Splinter — weapon-action direct-damage only during Phase D. */
export const ECHO_SPLINTER_GRAFTS = new Set<VeilGraftId>([
  'ECHO_GRAFT',
  'SPLINTER_GRAFT',
]);

/**
 * Setup / stance weapon actions — ineligible for Echo / Splinter / damage-hit grafts.
 * They may still author incidental Kinetic (ECLIPSE / UNBOWED each deal 10), but that
 * damage does not qualify them for hit-replacement grafts. Eligibility is this authored
 * classification, not “any kinetic > 0”.
 */
const SETUP_STANCE_WEAPON_ACTIONS = new Set<AegisWeaponActionId>([
  'ECLIPSE',
  'UNBOWED',
]);

/** @deprecated alias — use SETUP_STANCE_WEAPON_ACTIONS semantics. */
const NON_DAMAGE_WEAPON_ACTIONS = SETUP_STANCE_WEAPON_ACTIONS;

/** Weapon actions with authored direct damage (eligible for damage/kill/echo grafts). */
const DIRECT_DAMAGE_WEAPON_ACTIONS = new Set<AegisWeaponActionId>([
  'WARDENS_STRIKE',
  'RUPTURE',
  'DREADBIND',
  'NO_RESPITE',
  'PAIRED_BLADES_STRIKE',
  'DIVERGENCE',
  'SEVERANCE',
  'UNMAKER_STRIKE',
  'DREAD_HORIZON',
  'DOOMFALL',
]);

const DAMAGE_BRAND_TECHNIQUES = new Set<AegisTechniqueId>([
  'RUIN',
  'VEIL_PIERCER',
  'DEVASTATE',
  'FINAL_MERCY',
  'REAVE',
  'SHADOW_STEP',
]);

export type AegisGraftIncompatibility =
  | 'NOT_GRAFTABLE_SURFACE'
  | 'ULTIMATE_OR_PARRY'
  | 'FIXED_BASIC_LOCKED'
  | 'AP_UTILITY_COST_BAN'
  | 'CONDUIT_RUIN_BAN'
  | 'ECHO_SPLINTER_WEAPON_ONLY'
  | 'REQUIRES_DIRECT_DAMAGE'
  | 'REQUIRES_KILLABLE_HIT'
  | 'DEFENSIVE_NO_OUTGOING_HIT'
  | 'NO_SUPPORTED_EFFECT'
  | 'UNKNOWN_TARGET';

export function isApOnlyUtilityTechnique(id: string): boolean {
  return AP_ONLY.has(id);
}

export function weaponActionHasDirectDamage(actionId: AegisWeaponActionId): boolean {
  return DIRECT_DAMAGE_WEAPON_ACTIONS.has(actionId);
}

export function evaluateAegisGraftCompatibility(args: {
  target: AegisGraftTarget;
  graftId: VeilGraftId;
  allowFixedBasic: boolean;
}): { ok: true } | { ok: false; reason: AegisGraftIncompatibility; message: string } {
  const { target, graftId, allowFixedBasic } = args;
  const graft = getVeilGraftDefinition(graftId);

  if (target.kind === 'WEAPON_ACTION') {
    const actionId = target.actionId;
    if (isAegisGraftableUltimateId(actionId)) {
      return {
        ok: false,
        reason: 'ULTIMATE_OR_PARRY',
        message: 'Parry and Ultimates are not graftable.',
      };
    }
    if (isAegisFixedBasicStrike(actionId) && !allowFixedBasic) {
      return {
        ok: false,
        reason: 'FIXED_BASIC_LOCKED',
        message: 'Family Strike grafting requires class rank 7.',
      };
    }
    if (ECHO_SPLINTER_GRAFTS.has(graftId)) {
      if (!weaponActionHasDirectDamage(actionId) || NON_DAMAGE_WEAPON_ACTIONS.has(actionId)) {
        return {
          ok: false,
          reason: 'ECHO_SPLINTER_WEAPON_ONLY',
          message: 'Echo/Splinter require a direct-damage weapon action.',
        };
      }
      return { ok: true };
    }
    if (NON_DAMAGE_WEAPON_ACTIONS.has(actionId)) {
      if (requiresOutgoingDamageHit(graftId)) {
        return {
          ok: false,
          reason: 'DEFENSIVE_NO_OUTGOING_HIT',
          message: 'This graft requires an outgoing damage hit.',
        };
      }
      // Stance/defensive: only non-damage supportive grafts.
      if (isSupportiveNonDamageGraft(graftId)) return { ok: true };
      return {
        ok: false,
        reason: 'NO_SUPPORTED_EFFECT',
        message: 'Graft has no supported effect on this stance action.',
      };
    }
    if (requiresOutgoingDamageHit(graftId) && !weaponActionHasDirectDamage(actionId)) {
      return {
        ok: false,
        reason: 'REQUIRES_DIRECT_DAMAGE',
        message: 'Graft requires authored direct damage.',
      };
    }
    return { ok: true };
  }

  // TECHNIQUE
  const techniqueId = target.techniqueId;
  if (ECHO_SPLINTER_GRAFTS.has(graftId)) {
    return {
      ok: false,
      reason: 'ECHO_SPLINTER_WEAPON_ONLY',
      message: 'Echo/Splinter cannot target techniques.',
    };
  }
  if (isApOnlyUtilityTechnique(techniqueId) && AP_UTILITY_COST_BANNED_GRAFTS.has(graftId)) {
    return {
      ok: false,
      reason: 'AP_UTILITY_COST_BAN',
      message: 'AP-only utilities cannot take Brand/Reserve/HP activation grafts.',
    };
  }
  if (graftId === 'CONDUIT_GRAFT' && techniqueId === 'RUIN') {
    return {
      ok: false,
      reason: 'CONDUIT_RUIN_BAN',
      message: 'Conduit Brand tax conflicts with Ruin spending all Brands.',
    };
  }
  if (requiresOutgoingDamageHit(graftId)) {
    if (
      techniqueId === 'ASHEN_MANTLE'
      || techniqueId === 'RUNEBOUND_CARAPACE'
      || techniqueId === 'DEMONS_LUNG'
      || techniqueId === 'CRIMSON_PACT'
    ) {
      return {
        ok: false,
        reason: 'REQUIRES_DIRECT_DAMAGE',
        message: 'Graft requires an action with authored direct damage.',
      };
    }
    if (techniqueId === 'GRAVE_BIND' || techniqueId === 'NAIL_TO_GRID') {
      // Control utilities — kill/damage grafts that need a hit are no-ops unless boon adds damage.
      if (graft.refundApOnKill || graft.damageMultiplier != null || graft.hitCount != null) {
        return {
          ok: false,
          reason: 'NO_SUPPORTED_EFFECT',
          message: 'Graft requires a damage hit this technique does not author.',
        };
      }
    }
  }
  if (
    (graft.refundApOnKill || graft.dropLootOnKill)
    && !DAMAGE_BRAND_TECHNIQUES.has(techniqueId)
    && techniqueId !== 'GRAVE_BIND'
  ) {
    if (
      techniqueId === 'ASHEN_MANTLE'
      || techniqueId === 'RUNEBOUND_CARAPACE'
      || techniqueId === 'DEMONS_LUNG'
      || techniqueId === 'CRIMSON_PACT'
      || techniqueId === 'NAIL_TO_GRID'
    ) {
      return {
        ok: false,
        reason: 'REQUIRES_KILLABLE_HIT',
        message: 'Kill-triggered graft needs a killable damage action.',
      };
    }
  }
  // Cooldown graft (Iron-Lung) — explicitly introduces cooldown; always coherent.
  return { ok: true };
}

function requiresOutgoingDamageHit(graftId: VeilGraftId): boolean {
  const g = getVeilGraftDefinition(graftId);
  return (
    g.damageMultiplier != null
    || g.hitCount != null
    || g.duplicateCast != null
    || g.convertToTrueDamage === true
    || g.consumeAllReserve === true
    || g.damageScale != null
    || g.addOccultDamage != null
    || g.healPercentageOfDamage != null
    || g.executeThreshold != null
    || g.applyDebuffToTarget != null
    || g.bossDamageMultiplier != null
  );
}

function isSupportiveNonDamageGraft(graftId: VeilGraftId): boolean {
  const g = getVeilGraftDefinition(graftId);
  return (
    g.grantShieldHits != null
    || g.addBuff != null
    || g.addReserveGeneration != null
    || g.reduceReserveGeneration != null
    || g.addCooldown != null
    || g.reduceMaxHp != null
    || (g.setApCost != null && !requiresOutgoingDamageHit(graftId) && g.consumeAllReserve !== true)
  );
}

export function resolveAegisGraftTargetFromAbilityId(abilityId: string): AegisGraftTarget | null {
  if (isAegisGraftableUltimateId(abilityId) || abilityId === 'STRIKE') return null;
  if (isAegisWeaponActionCatalogId(abilityId)) {
    return { kind: 'WEAPON_ACTION', actionId: abilityId };
  }
  if (isAegisTechniqueId(abilityId)) {
    return { kind: 'TECHNIQUE', techniqueId: abilityId };
  }
  return null;
}
