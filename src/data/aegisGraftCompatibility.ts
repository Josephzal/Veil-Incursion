import type { AegisTechniqueId, AegisWeaponActionId } from '../types/aegisCombat';
import type { VeilGraftId } from '../types/veilGraft';
import { isAegisTechniqueId } from './aegisTechniqueCatalog';
import { isAegisWeaponActionCatalogId } from './aegisWeaponActionCatalog';
import type { AegisGraftTarget } from './aegisGraftTarget';
import { universalGraftMatchesTarget } from './universalGraftRegistry';

/** Retained adapter export; universal definitions never activate these old bans. */
export const AP_UTILITY_COST_BANNED_GRAFTS = new Set<VeilGraftId>();

const DIRECT_DAMAGE_WEAPON_ACTIONS = new Set<AegisWeaponActionId>([
  'WARDENS_STRIKE',
  'RUPTURE',
  'DREADBIND',
  'NO_RESPITE',
  'PAIRED_BLADES_STRIKE',
  'DIVERGENCE',
  'ECLIPSE',
  'SEVERANCE',
  'UNMAKER_STRIKE',
  'DREAD_HORIZON',
  'UNBOWED',
  'DOOMFALL',
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

export function isApOnlyUtilityTechnique(_id: string): boolean {
  return false;
}

export function weaponActionHasDirectDamage(actionId: AegisWeaponActionId): boolean {
  return DIRECT_DAMAGE_WEAPON_ACTIONS.has(actionId);
}

export function evaluateAegisGraftCompatibility(args: {
  target: AegisGraftTarget;
  graftId: VeilGraftId;
  /** @deprecated Fixed basics are canonical and always graftable. */
  allowFixedBasic: boolean;
}): { ok: true } | { ok: false; reason: AegisGraftIncompatibility; message: string } {
  const actionId = args.target.kind === 'WEAPON_ACTION'
    ? args.target.actionId
    : args.target.techniqueId;
  if (!universalGraftMatchesTarget('AEGIS', actionId, args.graftId)) {
    return {
      ok: false,
      reason: 'NO_SUPPORTED_EFFECT',
      message: 'Graft class and canonical action must match the target.',
    };
  }
  return { ok: true };
}

export function resolveAegisGraftTargetFromAbilityId(abilityId: string): AegisGraftTarget | null {
  if (isAegisWeaponActionCatalogId(abilityId)) {
    return { kind: 'WEAPON_ACTION', actionId: abilityId };
  }
  if (isAegisTechniqueId(abilityId)) {
    return { kind: 'TECHNIQUE', techniqueId: abilityId as AegisTechniqueId };
  }
  return null;
}
