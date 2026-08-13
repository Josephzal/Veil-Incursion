/**
 * Account equipment normalization — strips retired hub fields on load.
 * Legacy `equipment.trinketId` is ignored (not remapped to Expedition Relics).
 */

export interface LivePlayerAccountEquipment {
  weaponId: string | null;
  armorId: string | null;
}

/** Raw stored equipment may still carry retired keys from older saves. */
export type StoredPlayerAccountEquipment = Partial<LivePlayerAccountEquipment> & {
  trinketId?: string | null;
};

export function createDefaultPlayerAccountEquipment(): LivePlayerAccountEquipment {
  return {
    weaponId: null,
    armorId: null,
  };
}

/**
 * Normalize equipment for the live account shape.
 * Always drops `trinketId`; does not reinterpret it as a keepsake/relic ID.
 */
export function normalizePlayerAccountEquipment(
  stored?: StoredPlayerAccountEquipment | null,
  options?: { preserveWeaponId?: boolean },
): LivePlayerAccountEquipment {
  const defaults = createDefaultPlayerAccountEquipment();
  if (!stored || typeof stored !== 'object') {
    return defaults;
  }
  return {
    weaponId: options?.preserveWeaponId ? (stored.weaponId ?? null) : null,
    armorId: stored.armorId ?? null,
  };
}

/** True when a stored blob still declares the retired combat-trinket socket. */
export function storedEquipmentHasRetiredTrinketId(
  stored?: StoredPlayerAccountEquipment | null,
): boolean {
  if (!stored || typeof stored !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(stored, 'trinketId');
}
