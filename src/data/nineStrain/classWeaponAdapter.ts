import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import { CANONICAL_WEAPON_FAMILY_IDS } from '../weaponFamilyIdNormalize';

/** Canonical family ID → class adapter. Never keyed by display names. */
export function classIdForWeaponFamily(familyId: WeaponFamilyId): ClassType {
  if (familyId.startsWith('hex-')) return 'HEX_SHOT';
  if (familyId.startsWith('envoy-')) return 'ENVOY';
  return 'AEGIS';
}

export const NINE_PERMANENT_WEAPON_FAMILIES = CANONICAL_WEAPON_FAMILY_IDS;
