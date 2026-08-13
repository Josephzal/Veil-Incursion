/**
 * Phase 3L — weapon-specific anchor (slot-0) attacks.
 * Each permanent weapon has one unique canonical anchor ID + player-facing name.
 * Class slot tokens (STRIKE / SILVER_CORE_SIDEARM / VEIL_SPLINTER) are compatibility
 * inputs only — never player-facing canonical names for equipped weapons.
 */
import type { ClassType } from '../types/game';
import type { WeaponFamilyId } from '../types/weapon';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';

export type WeaponAnchorAttackId =
  | 'WARDENS_STRIKE'
  | 'VEILSTEP_SLASH'
  | 'BREAKING_HEW'
  | 'SILVER_VERDICT'
  | 'BREACH_ROUND'
  | 'CINDER_SWEEP'
  | 'NULL_ARC'
  | 'GRAVEWEAVE'
  | 'BLOOD_REFRACTION';

export interface WeaponAnchorAttackRecord {
  id: WeaponAnchorAttackId;
  /** Exact player-facing card / log name. */
  displayName: string;
  weaponFamilyId: WeaponFamilyId;
  weaponDisplayName: string;
  classId: ClassType;
  /** Class loadout slot token for older saves / decks. */
  classCompatId: 'STRIKE' | 'SILVER_CORE_SIDEARM' | 'VEIL_SPLINTER';
  targetPattern: string;
  definingEffects: readonly string[];
}

export const WEAPON_ANCHOR_ATTACK_BY_FAMILY: Record<WeaponFamilyId, WeaponAnchorAttackRecord> = {
  'aegis-longsword': {
    id: 'WARDENS_STRIKE',
    displayName: "WARDEN'S STRIKE",
    weaponFamilyId: 'aegis-longsword',
    weaponDisplayName: 'Longsword',
    classId: 'AEGIS',
    classCompatId: 'STRIKE',
    targetPattern: 'SINGLE',
    definingEffects: ['KINETIC', 'FRACTURE'],
  },
  'aegis-paired-blades': {
    id: 'VEILSTEP_SLASH',
    displayName: 'VEILSTEP SLASH',
    weaponFamilyId: 'aegis-paired-blades',
    weaponDisplayName: 'Paired Blades',
    classId: 'AEGIS',
    classCompatId: 'STRIKE',
    targetPattern: 'SINGLE',
    definingEffects: ['KINETIC', 'OCCULT RIDER'],
  },
  'aegis-claymore': {
    id: 'BREAKING_HEW',
    displayName: 'BREAKING HEW',
    weaponFamilyId: 'aegis-claymore',
    weaponDisplayName: 'Claymore',
    classId: 'AEGIS',
    classCompatId: 'STRIKE',
    targetPattern: 'SINGLE',
    definingEffects: ['HEAVY FRACTURE', 'STAMINA'],
  },
  'hex-revolver': {
    id: 'SILVER_VERDICT',
    displayName: 'SILVER VERDICT',
    weaponFamilyId: 'hex-revolver',
    weaponDisplayName: 'Revolver',
    classId: 'HEX_SHOT',
    classCompatId: 'SILVER_CORE_SIDEARM',
    targetPattern: 'SINGLE',
    definingEffects: ['BALLISTIC', 'PRECISION'],
  },
  'hex-shotgun': {
    id: 'BREACH_ROUND',
    displayName: 'BREACH ROUND',
    weaponFamilyId: 'hex-shotgun',
    weaponDisplayName: 'Shotgun',
    classId: 'HEX_SHOT',
    classCompatId: 'SILVER_CORE_SIDEARM',
    targetPattern: 'SINGLE',
    definingEffects: ['BREACH', 'ARMOR PRESSURE'],
  },
  'hex-carbine': {
    id: 'CINDER_SWEEP',
    displayName: 'CINDER SWEEP',
    weaponFamilyId: 'hex-carbine',
    weaponDisplayName: 'Carbine',
    classId: 'HEX_SHOT',
    classCompatId: 'SILVER_CORE_SIDEARM',
    targetPattern: 'SPREAD',
    definingEffects: ['SPREAD', 'PRIMARY'],
  },
  'envoy-scythe': {
    id: 'NULL_ARC',
    displayName: 'NULL ARC',
    weaponFamilyId: 'envoy-scythe',
    weaponDisplayName: 'Scythe',
    classId: 'ENVOY',
    classCompatId: 'VEIL_SPLINTER',
    targetPattern: 'SINGLE',
    definingEffects: ['OCCULT', 'CLEAN CYCLE'],
  },
  'envoy-vambrace': {
    id: 'GRAVEWEAVE',
    displayName: 'GRAVEWEAVE',
    weaponFamilyId: 'envoy-vambrace',
    weaponDisplayName: 'Vambrace',
    classId: 'ENVOY',
    classCompatId: 'VEIL_SPLINTER',
    targetPattern: 'SINGLE',
    definingEffects: ['VEIL ROT', 'DETONATION'],
  },
  'envoy-sanguine-prism': {
    id: 'BLOOD_REFRACTION',
    displayName: 'BLOOD REFRACTION',
    weaponFamilyId: 'envoy-sanguine-prism',
    weaponDisplayName: 'Sanguine Prism',
    classId: 'ENVOY',
    classCompatId: 'VEIL_SPLINTER',
    targetPattern: 'SINGLE',
    definingEffects: ['SACRIFICE', 'BRINK'],
  },
};

const ANCHOR_BY_ID: Record<WeaponAnchorAttackId, WeaponAnchorAttackRecord> = (() => {
  const map = {} as Record<WeaponAnchorAttackId, WeaponAnchorAttackRecord>;
  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    const record = WEAPON_ANCHOR_ATTACK_BY_FAMILY[familyId];
    map[record.id] = record;
  }
  return map;
})();

const LEGACY_ANCHOR_ALIAS: Record<string, WeaponAnchorAttackId> = {
  WARDENS_CUT: 'WARDENS_STRIKE',
  RIFTSTEP_CUT: 'VEILSTEP_SLASH',
  CLEAN_DISCHARGE: 'NULL_ARC',
  BLACK_WICK: 'GRAVEWEAVE',
};

const CLASS_COMPAT_TO_STARTER_FAMILY: Record<string, WeaponFamilyId> = {
  STRIKE: 'aegis-longsword',
  SILVER_CORE_SIDEARM: 'hex-revolver',
  VEIL_SPLINTER: 'envoy-vambrace',
};

export function getWeaponAnchorAttack(
  familyId: WeaponFamilyId,
): WeaponAnchorAttackRecord {
  return WEAPON_ANCHOR_ATTACK_BY_FAMILY[familyId];
}

export function listWeaponAnchorAttacks(): readonly WeaponAnchorAttackRecord[] {
  return ALL_WEAPON_FAMILY_IDS.map((id) => WEAPON_ANCHOR_ATTACK_BY_FAMILY[id]);
}

export function isWeaponAnchorAttackId(value: string): value is WeaponAnchorAttackId {
  return Object.prototype.hasOwnProperty.call(ANCHOR_BY_ID, value);
}

export function canonicalizeWeaponAnchorAttackId(
  raw: string,
  equippedFamilyId?: WeaponFamilyId | null,
): WeaponAnchorAttackId | null {
  const key = raw.trim().toUpperCase().replace(/'/g, '').replace(/\s+/g, '_');
  if (isWeaponAnchorAttackId(key)) return key;
  if (LEGACY_ANCHOR_ALIAS[key]) return LEGACY_ANCHOR_ALIAS[key]!;
  if (equippedFamilyId && CLASS_COMPAT_TO_STARTER_FAMILY[key]) {
    const compatClass = WEAPON_ANCHOR_ATTACK_BY_FAMILY[equippedFamilyId].classCompatId;
    if (compatClass === key) {
      return WEAPON_ANCHOR_ATTACK_BY_FAMILY[equippedFamilyId].id;
    }
  }
  if (CLASS_COMPAT_TO_STARTER_FAMILY[key] && !equippedFamilyId) {
    return WEAPON_ANCHOR_ATTACK_BY_FAMILY[CLASS_COMPAT_TO_STARTER_FAMILY[key]!].id;
  }
  return null;
}

/** Runtime executor / cost resolver still branches on class compat IDs. */
export function toRuntimeClassBasicId(
  abilityId: string,
  equippedFamilyId?: WeaponFamilyId | null,
): 'STRIKE' | 'SILVER_CORE_SIDEARM' | 'VEIL_SPLINTER' | string {
  const canonical = canonicalizeWeaponAnchorAttackId(abilityId, equippedFamilyId);
  if (canonical) return ANCHOR_BY_ID[canonical].classCompatId;
  if (abilityId === 'QUICKDRAW' || abilityId === 'CENTER_MASS') return 'SILVER_CORE_SIDEARM';
  if (
    abilityId === 'STRIKE'
    || abilityId === 'SILVER_CORE_SIDEARM'
    || abilityId === 'VEIL_SPLINTER'
  ) {
    return abilityId;
  }
  return abilityId;
}

export function isWeaponBasicAbilityId(
  abilityId: string,
  equippedFamilyId?: WeaponFamilyId | null,
): boolean {
  return canonicalizeWeaponAnchorAttackId(abilityId, equippedFamilyId) != null
    || abilityId === 'STRIKE'
    || abilityId === 'SILVER_CORE_SIDEARM'
    || abilityId === 'QUICKDRAW'
    || abilityId === 'CENTER_MASS'
    || abilityId === 'VEIL_SPLINTER';
}

export function formatWeaponAnchorLabel(
  familyId: WeaponFamilyId,
): string {
  return `[ ${WEAPON_ANCHOR_ATTACK_BY_FAMILY[familyId].displayName} ]`;
}

export function resolveWeaponAnchorForAbility(
  abilityId: string,
  equippedFamilyId: WeaponFamilyId | null | undefined,
  classId?: ClassType,
): WeaponAnchorAttackRecord | null {
  if (equippedFamilyId && isWeaponBasicAbilityId(abilityId, equippedFamilyId)) {
    const record = WEAPON_ANCHOR_ATTACK_BY_FAMILY[equippedFamilyId];
    if (!classId || record.classId === classId) return record;
  }
  const canonical = canonicalizeWeaponAnchorAttackId(abilityId, equippedFamilyId);
  if (canonical) return ANCHOR_BY_ID[canonical];
  return null;
}

/**
 * Retired player-facing strings — must never appear on active surfaces.
 * Stage II-C — old H.1a / branded live names are retired; canonical short names are live.
 */
export const RETIRED_WEAPON_DISPLAY_NAMES = [
  'Unmaker',
  "Heart's Due",
  'Silver-Core Sidearm',
  'Nullbreach',
  'Ash Shotgun',
  'Black Door',
  'Runed Longsword',
  'Rift Edge',
  'Echo Lantern',
  'Null Conduit',
  'Pulse Rifle',
  'Void Cannon',
  'Veil Edge',
  'Nullbreach Carbine',
  'Nullbreach Shotgun',
  'Claymore Blade',
] as const;

export const RETIRED_ANCHOR_DISPLAY_NAMES = [
  "WARDEN'S CUT",
  'RIFTSTEP CUT',
  'CLEAN DISCHARGE',
  'BLACK WICK',
] as const;

export function assertNoRetiredWeaponDisplayName(text: string): boolean {
  return !RETIRED_WEAPON_DISPLAY_NAMES.some((name) => text.includes(name));
}

export function getCanonicalWeaponDisplayName(familyId: WeaponFamilyId): string {
  return getWeaponFamily(familyId).name;
}
