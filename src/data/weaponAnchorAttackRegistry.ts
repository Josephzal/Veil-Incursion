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
  'aegis-runed-longsword': {
    id: 'WARDENS_STRIKE',
    displayName: "WARDEN'S STRIKE",
    weaponFamilyId: 'aegis-runed-longsword',
    weaponDisplayName: 'Longsword',
    classId: 'AEGIS',
    classCompatId: 'STRIKE',
    targetPattern: 'SINGLE',
    definingEffects: ['KINETIC', 'FRACTURE'],
  },
  'aegis-rift-edge': {
    id: 'VEILSTEP_SLASH',
    displayName: 'VEILSTEP SLASH',
    weaponFamilyId: 'aegis-rift-edge',
    weaponDisplayName: 'Paired Blades',
    classId: 'AEGIS',
    classCompatId: 'STRIKE',
    targetPattern: 'SINGLE',
    definingEffects: ['KINETIC', 'OCCULT RIDER'],
  },
  'aegis-claymore-blade': {
    id: 'BREAKING_HEW',
    displayName: 'BREAKING HEW',
    weaponFamilyId: 'aegis-claymore-blade',
    weaponDisplayName: 'Unmaker',
    classId: 'AEGIS',
    classCompatId: 'STRIKE',
    targetPattern: 'SINGLE',
    definingEffects: ['HEAVY FRACTURE', 'STAMINA'],
  },
  'hex-silver-core-sidearm': {
    id: 'SILVER_VERDICT',
    displayName: 'SILVER VERDICT',
    weaponFamilyId: 'hex-silver-core-sidearm',
    weaponDisplayName: 'Revolver',
    classId: 'HEX_SHOT',
    classCompatId: 'SILVER_CORE_SIDEARM',
    targetPattern: 'SINGLE',
    definingEffects: ['BALLISTIC', 'PRECISION'],
  },
  'hex-void-cannon': {
    id: 'BREACH_ROUND',
    displayName: 'BREACH ROUND',
    weaponFamilyId: 'hex-void-cannon',
    weaponDisplayName: 'Black Door',
    classId: 'HEX_SHOT',
    classCompatId: 'SILVER_CORE_SIDEARM',
    targetPattern: 'SINGLE',
    definingEffects: ['BREACH', 'ARMOR PRESSURE'],
  },
  'hex-pulse-rifle': {
    id: 'CINDER_SWEEP',
    displayName: 'CINDER SWEEP',
    weaponFamilyId: 'hex-pulse-rifle',
    weaponDisplayName: 'Carbine',
    classId: 'HEX_SHOT',
    classCompatId: 'SILVER_CORE_SIDEARM',
    targetPattern: 'SPREAD',
    definingEffects: ['SPREAD', 'PRIMARY'],
  },
  'envoy-null-conduit': {
    id: 'NULL_ARC',
    displayName: 'NULL ARC',
    weaponFamilyId: 'envoy-null-conduit',
    weaponDisplayName: 'Scythe',
    classId: 'ENVOY',
    classCompatId: 'VEIL_SPLINTER',
    targetPattern: 'SINGLE',
    definingEffects: ['OCCULT', 'CLEAN CYCLE'],
  },
  'envoy-echo-lantern': {
    id: 'GRAVEWEAVE',
    displayName: 'GRAVEWEAVE',
    weaponFamilyId: 'envoy-echo-lantern',
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
    weaponDisplayName: "Heart's Due",
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
  STRIKE: 'aegis-runed-longsword',
  SILVER_CORE_SIDEARM: 'hex-silver-core-sidearm',
  VEIL_SPLINTER: 'envoy-echo-lantern',
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

/** Retired player-facing strings — must never appear on active surfaces. */
export const RETIRED_WEAPON_DISPLAY_NAMES = [
  'Rift Edge',
  'Veil Edge',
  'Nullbreach Carbine',
  'Nullbreach Shotgun',
  'Runed Longsword',
  'Claymore Blade',
  'Silver-Core Sidearm',
  'Pulse Rifle',
  'Null Conduit',
  'Echo Lantern',
  'Sanguine Prism',
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
