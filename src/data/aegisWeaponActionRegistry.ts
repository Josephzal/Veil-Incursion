/**
 * Aegis weapon actions + ultimates — always derived from equipped family.
 * Never persist these IDs on PlayerAccount or ActiveIncursion.
 */
import type {
  AegisWeaponActionId,
  AegisWeaponUltimateId,
} from '../types/aegisCombat';
import type { WeaponFamilyId } from '../types/weapon';

export type AegisWeaponFamilyId =
  | 'aegis-longsword'
  | 'aegis-paired-blades'
  | 'aegis-claymore';

export interface AegisWeaponActionSet {
  familyId: AegisWeaponFamilyId;
  displayName: string;
  actions: readonly [
    AegisWeaponActionId,
    AegisWeaponActionId,
    AegisWeaponActionId,
    AegisWeaponActionId,
  ];
  ultimateId: AegisWeaponUltimateId;
  /** Player-facing ultimate label. */
  ultimateDisplayName: string;
}

const AEGIS_WEAPON_ACTION_BY_FAMILY: Record<AegisWeaponFamilyId, AegisWeaponActionSet> = {
  'aegis-longsword': {
    familyId: 'aegis-longsword',
    displayName: 'Longsword',
    actions: ['WARDENS_STRIKE', 'RUPTURE', 'DREADBIND', 'NO_RESPITE'],
    ultimateId: 'ABYSSAL_VERDICT',
    ultimateDisplayName: 'ABYSSAL VERDICT',
  },
  'aegis-paired-blades': {
    familyId: 'aegis-paired-blades',
    displayName: 'Paired Blades',
    actions: ['PAIRED_BLADES_STRIKE', 'DIVERGENCE', 'ECLIPSE', 'SEVERANCE'],
    ultimateId: 'REND_THE_VEIL',
    ultimateDisplayName: 'REND THE VEIL',
  },
  'aegis-claymore': {
    familyId: 'aegis-claymore',
    displayName: 'Claymore',
    actions: ['UNMAKER_STRIKE', 'DREAD_HORIZON', 'UNBOWED', 'DOOMFALL'],
    ultimateId: 'GRAVEFALL',
    ultimateDisplayName: 'GRAVEFALL',
  },
};

export const ALL_AEGIS_WEAPON_FAMILY_IDS: readonly AegisWeaponFamilyId[] = [
  'aegis-longsword',
  'aegis-paired-blades',
  'aegis-claymore',
];

export function isAegisWeaponFamilyId(id: string | null | undefined): id is AegisWeaponFamilyId {
  return id === 'aegis-longsword'
    || id === 'aegis-paired-blades'
    || id === 'aegis-claymore';
}

export function getAegisWeaponActionSet(
  familyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined,
): AegisWeaponActionSet | null {
  if (!isAegisWeaponFamilyId(familyId)) return null;
  return AEGIS_WEAPON_ACTION_BY_FAMILY[familyId];
}

/** Exactly four action IDs owned by the equipped Aegis family. */
export function deriveAegisWeaponActions(
  familyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined,
): readonly [
  AegisWeaponActionId,
  AegisWeaponActionId,
  AegisWeaponActionId,
  AegisWeaponActionId,
] | null {
  return getAegisWeaponActionSet(familyId)?.actions ?? null;
}

export function deriveAegisWeaponUltimateId(
  familyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined,
): AegisWeaponUltimateId | null {
  return getAegisWeaponActionSet(familyId)?.ultimateId ?? null;
}

export function getAegisWeaponUltimateDisplayName(
  familyId: WeaponFamilyId | AegisWeaponFamilyId | null | undefined,
): string | null {
  return getAegisWeaponActionSet(familyId)?.ultimateDisplayName ?? null;
}

/** True when an ID is one of the twelve authored weapon actions (any family). */
export function isAegisWeaponActionId(id: string): id is AegisWeaponActionId {
  for (const familyId of ALL_AEGIS_WEAPON_FAMILY_IDS) {
    if ((AEGIS_WEAPON_ACTION_BY_FAMILY[familyId].actions as readonly string[]).includes(id)) {
      return true;
    }
  }
  return false;
}

export function isAegisWeaponUltimateId(id: string): id is AegisWeaponUltimateId {
  return id === 'ABYSSAL_VERDICT' || id === 'REND_THE_VEIL' || id === 'GRAVEFALL';
}
