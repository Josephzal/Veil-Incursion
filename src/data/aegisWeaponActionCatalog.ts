/**
 * Phase B — authored Aegis weapon-action definitions.
 * AP-only. No Stamina. Brands only from mastery conditions.
 */
import type { AbilityTag, AegisWeaponActionId } from '../types/aegisCombat';
import type { AbilityTargetMode } from './combatTargeting';
import {
  ALL_AEGIS_WEAPON_FAMILY_IDS,
  deriveAegisWeaponActions,
  type AegisWeaponFamilyId,
} from './aegisWeaponActionRegistry';

export type AegisWeaponActionTargetMode =
  | AbilityTargetMode
  | 'DUAL'
  | 'ROW';

export interface AegisWeaponActionDefinition {
  id: AegisWeaponActionId;
  familyId: AegisWeaponFamilyId;
  label: string;
  /** Alternate label when Doomfall is in Release form. */
  releaseLabel?: string;
  description: string;
  apCost: number;
  /** Release stage AP (Doomfall). */
  releaseApCost?: number;
  targetMode: AegisWeaponActionTargetMode;
  tags: readonly AbilityTag[];
  /** Charge stage is not a STRIKE; Release is. */
  chargeTags?: readonly AbilityTag[];
  category: 'MELEE' | 'CONTROL' | 'BURST' | 'POSTURE';
}

const LONGSWORD: Record<
  'WARDENS_STRIKE' | 'RUPTURE' | 'DREADBIND' | 'NO_RESPITE',
  AegisWeaponActionDefinition
> = {
  WARDENS_STRIKE: {
    id: 'WARDENS_STRIKE',
    familyId: 'aegis-longsword',
    label: "[ WARDEN'S STRIKE ]",
    description: '1 AP kinetic strike — 14 Kinetic, 20 Fracture, strip 1 Armor, +8 Reserve on hit.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'BASIC', 'KINETIC', 'MELEE', 'FRACTURE', 'ARMOR_BREAK'],
    category: 'MELEE',
  },
  RUPTURE: {
    id: 'RUPTURE',
    familyId: 'aegis-longsword',
    label: '[ RUPTURE ]',
    description: 'Precise rupture — +15 accuracy, 8 Kinetic, 40 Fracture, strip up to 2 Armor. Brand on armor break or Fracture entry.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'KINETIC', 'MELEE', 'FRACTURE', 'ARMOR_BREAK'],
    category: 'MELEE',
  },
  DREADBIND: {
    id: 'DREADBIND',
    familyId: 'aegis-longsword',
    label: '[ DREADBIND ]',
    description: '10 Kinetic, 18 Fracture. On hit, bind the target — Perfect Parry of their next attack awards Brand +22 Fracture.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'KINETIC', 'MELEE', 'FRACTURE', 'CONTROL', 'DEBUFF'],
    category: 'CONTROL',
  },
  NO_RESPITE: {
    id: 'NO_RESPITE',
    familyId: 'aegis-longsword',
    label: '[ NO RESPITE ]',
    description: '2 AP finisher — 24 Kinetic. Against already-Fractured: refund 1 AP +10 Reserve (once per turn).',
    apCost: 2,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'KINETIC', 'MELEE', 'EXECUTE'],
    category: 'BURST',
  },
};

const PAIRED: Record<
  'PAIRED_BLADES_STRIKE' | 'DIVERGENCE' | 'ECLIPSE' | 'SEVERANCE',
  AegisWeaponActionDefinition
> = {
  PAIRED_BLADES_STRIKE: {
    id: 'PAIRED_BLADES_STRIKE',
    familyId: 'aegis-paired-blades',
    label: '[ PAIRED STRIKE ]',
    description: '11 Kinetic, 12 Fracture, +6 Reserve. If Tempo armed: +4 Occult rider and consume Tempo.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'BASIC', 'KINETIC', 'MELEE', 'FRACTURE'],
    category: 'MELEE',
  },
  DIVERGENCE: {
    id: 'DIVERGENCE',
    familyId: 'aegis-paired-blades',
    label: '[ DIVERGENCE ]',
    description: 'Two blades — 5 Kinetic / 8 Fracture / +2 Reserve each. Brand if both hit. TARGET ×2.',
    apCost: 1,
    targetMode: 'DUAL',
    tags: ['STRIKE', 'MULTI_HIT', 'KINETIC', 'MELEE', 'FRACTURE'],
    category: 'BURST',
  },
  ECLIPSE: {
    id: 'ECLIPSE',
    familyId: 'aegis-paired-blades',
    label: '[ ECLIPSE ]',
    description: '10 Kinetic, 12 Fracture. Enter Eclipse posture — Evade/Perfect Parry arms Tempo + Brand.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'KINETIC', 'MELEE', 'FRACTURE', 'DEFENSIVE'],
    category: 'POSTURE',
  },
  SEVERANCE: {
    id: 'SEVERANCE',
    familyId: 'aegis-paired-blades',
    label: '[ SEVERANCE ]',
    description: 'Two blades — 12 Kinetic each. With Tempo: Blade Two becomes 20 Occult + bonus Reserve.',
    apCost: 2,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'MULTI_HIT', 'KINETIC', 'MELEE', 'FRACTURE'],
    category: 'BURST',
  },
};

const UNMAKER: Record<
  'UNMAKER_STRIKE' | 'DREAD_HORIZON' | 'UNBOWED' | 'DOOMFALL',
  AegisWeaponActionDefinition
> = {
  UNMAKER_STRIKE: {
    id: 'UNMAKER_STRIKE',
    familyId: 'aegis-claymore',
    label: '[ UNMAKER STRIKE ]',
    description: '15 Kinetic, 26 Fracture, +4 Reserve. Does not consume Fractured.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'BASIC', 'KINETIC', 'MELEE', 'FRACTURE'],
    category: 'MELEE',
  },
  DREAD_HORIZON: {
    id: 'DREAD_HORIZON',
    familyId: 'aegis-claymore',
    label: '[ DREAD HORIZON ]',
    description: 'Row sweep — 12 Kinetic / 30 Fracture / +3 Reserve per hit. Brand if both targets hit.',
    apCost: 2,
    targetMode: 'ROW',
    tags: ['STRIKE', 'AREA_ROW', 'KINETIC', 'MELEE', 'FRACTURE', 'AOE'],
    category: 'BURST',
  },
  UNBOWED: {
    id: 'UNBOWED',
    familyId: 'aegis-claymore',
    label: '[ UNBOWED ]',
    description: '10 Kinetic, 20 Fracture. Establish Poise — reduce next eligible attack 35%. Brand if Poise triggers while Committed.',
    apCost: 1,
    targetMode: 'SINGLE',
    tags: ['STRIKE', 'KINETIC', 'MELEE', 'FRACTURE', 'DEFENSIVE'],
    category: 'POSTURE',
  },
  DOOMFALL: {
    id: 'DOOMFALL',
    familyId: 'aegis-claymore',
    label: '[ DOOMFALL — CHARGE ]',
    releaseLabel: '[ DOOMFALL — RELEASE ]',
    description: 'Charge: enter Committed. Next turn Release for heavy Fracture cashout.',
    apCost: 1,
    releaseApCost: 0,
    targetMode: 'NONE',
    tags: ['KINETIC', 'MELEE', 'FRACTURE', 'EXECUTE'],
    chargeTags: ['KINETIC', 'MELEE'],
    category: 'BURST',
  },
};

export const AEGIS_WEAPON_ACTION_CATALOG: Record<AegisWeaponActionId, AegisWeaponActionDefinition> = {
  ...LONGSWORD,
  ...PAIRED,
  ...UNMAKER,
};

export function getAegisWeaponActionDefinition(
  id: AegisWeaponActionId,
): AegisWeaponActionDefinition {
  return AEGIS_WEAPON_ACTION_CATALOG[id];
}

export function listAegisWeaponActionsForFamily(
  familyId: AegisWeaponFamilyId,
): readonly AegisWeaponActionDefinition[] {
  const ids = deriveAegisWeaponActions(familyId);
  if (!ids) return [];
  return ids.map((id) => AEGIS_WEAPON_ACTION_CATALOG[id]);
}

export function isAegisWeaponActionCatalogId(id: string): id is AegisWeaponActionId {
  return Object.prototype.hasOwnProperty.call(AEGIS_WEAPON_ACTION_CATALOG, id);
}

/** Display label — Doomfall Release uses releaseLabel when charged. */
export function formatAegisWeaponActionLabel(
  id: AegisWeaponActionId,
  opts?: { doomfallReleaseAvailable?: boolean },
): string {
  const def = AEGIS_WEAPON_ACTION_CATALOG[id];
  if (id === 'DOOMFALL' && opts?.doomfallReleaseAvailable && def.releaseLabel) {
    return def.releaseLabel;
  }
  return def.label;
}

export function aegisWeaponActionApCost(
  id: AegisWeaponActionId,
  opts?: { doomfallReleaseAvailable?: boolean },
): number {
  const def = AEGIS_WEAPON_ACTION_CATALOG[id];
  if (id === 'DOOMFALL' && opts?.doomfallReleaseAvailable) {
    return def.releaseApCost ?? 0;
  }
  return def.apCost;
}

export function aegisWeaponActionTags(
  id: AegisWeaponActionId,
  opts?: { doomfallReleaseAvailable?: boolean },
): readonly AbilityTag[] {
  const def = AEGIS_WEAPON_ACTION_CATALOG[id];
  if (id === 'DOOMFALL' && !opts?.doomfallReleaseAvailable && def.chargeTags) {
    return def.chargeTags;
  }
  if (id === 'DOOMFALL' && opts?.doomfallReleaseAvailable) {
    return ['STRIKE', 'KINETIC', 'MELEE', 'FRACTURE', 'EXECUTE'];
  }
  return def.tags;
}

export function aegisWeaponActionTargetMode(
  id: AegisWeaponActionId,
  opts?: { doomfallReleaseAvailable?: boolean },
): AegisWeaponActionTargetMode {
  if (id === 'DOOMFALL' && opts?.doomfallReleaseAvailable) return 'SINGLE';
  return AEGIS_WEAPON_ACTION_CATALOG[id].targetMode;
}

/** Sanity: every family exposes exactly four catalogued actions. */
export function assertAegisWeaponActionCatalogComplete(): string[] {
  const issues: string[] = [];
  for (const familyId of ALL_AEGIS_WEAPON_FAMILY_IDS) {
    const ids = deriveAegisWeaponActions(familyId);
    if (!ids || ids.length !== 4) {
      issues.push(`${familyId}: expected 4 actions`);
      continue;
    }
    for (const id of ids) {
      if (!AEGIS_WEAPON_ACTION_CATALOG[id]) {
        issues.push(`${familyId}: missing catalog entry ${id}`);
      } else if (AEGIS_WEAPON_ACTION_CATALOG[id].familyId !== familyId) {
        issues.push(`${id}: family mismatch`);
      }
    }
  }
  return issues;
}
