/**
 * Weapon ultimates — resolve from equipped weapon family.
 * Class ultimate IDs are compatibility aliases only.
 * WU-2 wired Longsword / Ash Shotgun / Scythe; WU-4 wires the remaining six.
 */
import type { ClassType } from '../types/game';
import type { WeaponFamilyId } from '../types/weapon';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';

export type WeaponUltimateId =
  | 'THREEFOLD_BRAND'
  | 'REND_THE_VEIL'
  | 'GRAVEFALL'
  | 'SIXTH_SEAL'
  | 'ZERO_PROTOCOL'
  | 'LAST_KNOCK'
  | 'FUNERAL_KNOT'
  | 'NULL_CIRCUIT'
  | 'CRIMSON_REFRACTION';

export type WeaponUltimateWireStatus = 'REGISTERED' | 'WIRED' | 'LIVE';

export interface WeaponUltimateRecord {
  id: WeaponUltimateId;
  /** Exact player-facing ultimate name. */
  displayName: string;
  weaponFamilyId: WeaponFamilyId;
  weaponDisplayName: string;
  classId: ClassType;
  /**
   * Class / legacy ultimate tokens this weapon ultimate migrates from.
   * Never show these as the equipped weapon's live ultimate label.
   */
  legacyClassUltimateIds: readonly string[];
  status: WeaponUltimateWireStatus;
  /** One-line fantasy / interaction intent (not live HUD copy yet). */
  interactionSummary: string;
}

export const WEAPON_ULTIMATE_BY_FAMILY: Record<WeaponFamilyId, WeaponUltimateRecord> = {
  'aegis-longsword': {
    id: 'THREEFOLD_BRAND',
    displayName: 'ABYSSAL VERDICT',
    weaponFamilyId: 'aegis-longsword',
    weaponDisplayName: 'Longsword',
    classId: 'AEGIS',
    legacyClassUltimateIds: ['EVISCERATE'],
    status: 'WIRED',
    interactionSummary: 'Aegis Longsword ultimate cinematic (ABYSSAL VERDICT) — stable id THREEFOLD_BRAND / EVISCERATE.',
  },
  'aegis-paired-blades': {
    id: 'REND_THE_VEIL',
    displayName: 'REND THE VEIL',
    weaponFamilyId: 'aegis-paired-blades',
    weaponDisplayName: 'Paired Blades',
    classId: 'AEGIS',
    legacyClassUltimateIds: [],
    status: 'WIRED',
    interactionSummary: 'Paired Blades — dual diagonal traces + central rupture (Tempo cashout if armed).',
  },
  'aegis-claymore': {
    id: 'GRAVEFALL',
    displayName: 'GRAVEFALL',
    weaponFamilyId: 'aegis-claymore',
    weaponDisplayName: 'Claymore',
    classId: 'AEGIS',
    legacyClassUltimateIds: [],
    status: 'WIRED',
    interactionSummary: 'Claymore — raise / strain / slam; cash existing Fracture; PERFECT narrow shockwave.',
  },
  'hex-revolver': {
    id: 'SIXTH_SEAL',
    displayName: 'SIXTH SEAL',
    weaponFamilyId: 'hex-revolver',
    weaponDisplayName: 'Revolver',
    classId: 'HEX_SHOT',
    legacyClassUltimateIds: [],
    status: 'WIRED',
    interactionSummary: 'Revolver — cylinder ritual performs an ultimate-owned refill, then precision sequence. Does not grant ordinary Perfect Reload rewards.',
  },
  'hex-carbine': {
    id: 'ZERO_PROTOCOL',
    displayName: 'ZERO PROTOCOL',
    weaponFamilyId: 'hex-carbine',
    weaponDisplayName: 'Carbine',
    classId: 'HEX_SHOT',
    legacyClassUltimateIds: ['ZERO_PROTOCOL'],
    status: 'WIRED',
    interactionSummary: 'Carbine exclusive — Zero Protocol interaction. Protocol ≥3; not full-magazine gated.',
  },
  'hex-shotgun': {
    id: 'LAST_KNOCK',
    displayName: 'LAST KNOCK',
    weaponFamilyId: 'hex-shotgun',
    weaponDisplayName: 'Shotgun',
    classId: 'HEX_SHOT',
    legacyClassUltimateIds: [],
    status: 'WIRED',
    interactionSummary: 'Shotgun — pump / hold / slam; commit loaded rounds. Never titled "The Black Door".',
  },
  'envoy-vambrace': {
    id: 'FUNERAL_KNOT',
    displayName: 'FUNERAL KNOT',
    weaponFamilyId: 'envoy-vambrace',
    weaponDisplayName: 'Vambrace',
    classId: 'ENVOY',
    legacyClassUltimateIds: [],
    status: 'WIRED',
    interactionSummary: 'Vambrace — wind / tighten / tear; Rot-weighted detonation via lantern formula.',
  },
  'envoy-scythe': {
    id: 'NULL_CIRCUIT',
    displayName: 'NULL CIRCUIT',
    weaponFamilyId: 'envoy-scythe',
    weaponDisplayName: 'Scythe',
    classId: 'ENVOY',
    legacyClassUltimateIds: ['CATACLYSM_SIGIL'],
    status: 'WIRED',
    interactionSummary: 'Envoy Cataclysm / line-circuit ultimate rebound onto Scythe only.',
  },
  'envoy-sanguine-prism': {
    id: 'CRIMSON_REFRACTION',
    displayName: 'CRIMSON REFRACTION',
    weaponFamilyId: 'envoy-sanguine-prism',
    weaponDisplayName: 'Sanguine Prism',
    classId: 'ENVOY',
    legacyClassUltimateIds: [],
    status: 'WIRED',
    interactionSummary: 'Sanguine Prism — align / offer / commit; brink + full-pay HP sacrifice.',
  },
};

const ULTIMATE_BY_ID: Record<WeaponUltimateId, WeaponUltimateRecord> = (() => {
  const map = {} as Record<WeaponUltimateId, WeaponUltimateRecord>;
  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    const record = WEAPON_ULTIMATE_BY_FAMILY[familyId];
    map[record.id] = record;
  }
  return map;
})();

/** Class ultimates that must not remain the live label for sibling weapons. */
export const RETIRED_CLASS_ULTIMATE_DISPLAY_NAMES = [
  'EVISCERATE',
  'CATACLYSM SIGIL',
  'ZERO-PROTOCOL',
] as const;

export function getWeaponUltimate(familyId: WeaponFamilyId): WeaponUltimateRecord {
  return WEAPON_ULTIMATE_BY_FAMILY[familyId];
}

export function listWeaponUltimates(): readonly WeaponUltimateRecord[] {
  return ALL_WEAPON_FAMILY_IDS.map((id) => WEAPON_ULTIMATE_BY_FAMILY[id]);
}

export function isWeaponUltimateId(value: string): value is WeaponUltimateId {
  return Object.prototype.hasOwnProperty.call(ULTIMATE_BY_ID, value);
}

export function getWeaponUltimateById(id: WeaponUltimateId): WeaponUltimateRecord {
  return ULTIMATE_BY_ID[id];
}

/**
 * Resolve the ultimate for the equipped weapon.
 * Never fall back to "class default" when a family is known.
 */
export function resolveWeaponUltimateForEquipped(
  familyId: WeaponFamilyId | null | undefined,
  classId?: ClassType,
): WeaponUltimateRecord | null {
  if (!familyId) return null;
  const record = WEAPON_ULTIMATE_BY_FAMILY[familyId];
  if (!record) return null;
  if (classId && record.classId !== classId) return null;
  return record;
}

/**
 * Map a legacy class ultimate token to the weapon ultimate when the equipped
 * weapon owns that migration. Returns null if the token is not valid for this weapon.
 */
export function resolveUltimateFromLegacyClassId(
  legacyId: string,
  equippedFamilyId: WeaponFamilyId | null | undefined,
): WeaponUltimateRecord | null {
  if (!equippedFamilyId) return null;
  const record = WEAPON_ULTIMATE_BY_FAMILY[equippedFamilyId];
  if (record.legacyClassUltimateIds.includes(legacyId) || record.id === legacyId) {
    return record;
  }
  return null;
}

/**
 * WU-2 fire gate — legacy class ultimate may only fire when the equipped weapon owns it.
 * Sibling weapons keep class charge UI but cannot open the rebound interaction.
 */
export function canFireLegacyClassUltimate(
  legacyId: string,
  equippedFamilyId: WeaponFamilyId | null | undefined,
): boolean {
  const record = resolveUltimateFromLegacyClassId(legacyId, equippedFamilyId);
  return record != null && (record.status === 'WIRED' || record.status === 'LIVE');
}

/**
 * WU-4 fire gate — equipped weapon's own ultimate is WIRED or LIVE.
 */
export function canFireWeaponUltimate(
  equippedFamilyId: WeaponFamilyId | null | undefined,
): boolean {
  if (!equippedFamilyId) return false;
  const record = WEAPON_ULTIMATE_BY_FAMILY[equippedFamilyId];
  return record.status === 'WIRED' || record.status === 'LIVE';
}

export function formatWeaponUltimateLogTag(familyId: WeaponFamilyId): string {
  return `[${WEAPON_ULTIMATE_BY_FAMILY[familyId].displayName}]`;
}

export function formatWeaponUltimateLabel(familyId: WeaponFamilyId): string {
  return `[ ${WEAPON_ULTIMATE_BY_FAMILY[familyId].displayName} ]`;
}

export function getCanonicalWeaponUltimateDisplayName(familyId: WeaponFamilyId): string {
  return WEAPON_ULTIMATE_BY_FAMILY[familyId].displayName;
}

export function assertWeaponUltimateNamesMatchRegistry(): string[] {
  const issues: string[] = [];
  for (const familyId of ALL_WEAPON_FAMILY_IDS) {
    const ultimate = WEAPON_ULTIMATE_BY_FAMILY[familyId];
    const weaponName = getWeaponFamily(familyId).name;
    if (ultimate.weaponDisplayName !== weaponName) {
      issues.push(
        `${familyId}: ultimate.weaponDisplayName "${ultimate.weaponDisplayName}" ≠ registry "${weaponName}"`,
      );
    }
  }
  const ids = listWeaponUltimates().map((u) => u.id);
  if (new Set(ids).size !== 9) {
    issues.push('Weapon ultimates must be unique across all nine families');
  }
  const wired = listWeaponUltimates().filter((u) => u.status === 'WIRED' || u.status === 'LIVE');
  if (wired.length !== 9) {
    issues.push(`WU-4 expects all nine ultimates WIRED or LIVE (got ${wired.length})`);
  }
  return issues;
}
