/**
 * Authored Hex weapon-action definitions (W.2–W.4 — all three kits).
 */
import type { HexShotAbilityTag } from '../types/classCombatAbility';
import type { HexWeaponActionId } from '../types/hexWeaponAction';
import type { AbilityTargetMode } from './combatTargeting';
import type { HexWeaponFamilyId } from './hexWeaponActionRegistry';

export interface HexWeaponActionDefinition {
  id: HexWeaponActionId;
  familyId: HexWeaponFamilyId;
  label: string;
  description: string;
  apCost: number;
  staminaCost: number;
  ammoCost: number;
  /** Authored base before family ballistic scaling (basics may ignore and use resolveHexBasicShot). */
  baseDamage: number;
  targetMode: AbilityTargetMode;
  tags: readonly HexShotAbilityTag[];
}

const REVOLVER: Record<
  'QUICKDRAW' | 'SLIPSHOT' | 'SIX_BELLS' | 'LAST_WORD',
  HexWeaponActionDefinition
> = {
  QUICKDRAW: {
    id: 'QUICKDRAW',
    familyId: 'hex-revolver',
    label: '[ QUICKDRAW ]',
    description: 'Accurate Sidearm basic — Tier ladder 10/11/12 Kinetic. Inherits ammo. Execute window ≤30% HP.',
    apCost: 1,
    staminaCost: 0,
    ammoCost: 1,
    baseDamage: 10,
    targetMode: 'SINGLE',
    // Parity with legacy SILVER_CORE_SIDEARM heavy-shot / armor tags.
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'ARMOR_BREAK', 'GUARD_BREAK', 'RELOAD'],
  },
  SLIPSHOT: {
    id: 'SLIPSHOT',
    familyId: 'hex-revolver',
    label: '[ SLIPSHOT ]',
    description: '8 Kinetic poke — grants Elusive (next eligible direct attack forcibly evaded). Elusive even on miss.',
    apCost: 1,
    staminaCost: 0,
    ammoCost: 1,
    baseDamage: 8,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'DEFENSIVE'],
  },
  SIX_BELLS: {
    id: 'SIX_BELLS',
    familyId: 'hex-revolver',
    label: '[ SIX BELLS ]',
    description: 'Dump remaining rounds (min 2) into one target — 5 Kinetic per round, independent checks.',
    apCost: 2,
    staminaCost: 0,
    ammoCost: 0,
    baseDamage: 5,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC'],
  },
  LAST_WORD: {
    id: 'LAST_WORD',
    familyId: 'hex-revolver',
    label: '[ LAST WORD ]',
    description: '14 Kinetic execute vs ≤30% HP — refund 1 AP on synchronous lethal (once per player turn).',
    apCost: 1,
    staminaCost: 0,
    ammoCost: 1,
    baseDamage: 14,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'EXECUTION'],
  },
};

const CARBINE: Record<
  'CENTER_MASS' | 'CONTROLLED_BURST' | 'SUPPRESSIVE_BARRAGE' | 'CONTACT_FRONT',
  HexWeaponActionDefinition
> = {
  CENTER_MASS: {
    id: 'CENTER_MASS',
    familyId: 'hex-carbine',
    label: '[ CENTER MASS ]',
    description: '9 Kinetic Carbine basic — establishes Firing Solution on hit (+15 accuracy). Inherits ammo. No splash.',
    apCost: 1,
    staminaCost: 0,
    ammoCost: 1,
    baseDamage: 9,
    targetMode: 'SINGLE',
    // Historical Ash fixed-basic heavy-shot parity (SILVER_CORE_SIDEARM tags).
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'ARMOR_BREAK', 'GUARD_BREAK'],
  },
  CONTROLLED_BURST: {
    id: 'CONTROLLED_BURST',
    familyId: 'hex-carbine',
    label: '[ CONTROLLED BURST ]',
    description: 'Three 6 Kinetic packets — commits 3 rounds. Independent checks. FS accuracy only.',
    apCost: 2,
    staminaCost: 0,
    ammoCost: 3,
    baseDamage: 6,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC'],
  },
  SUPPRESSIVE_BARRAGE: {
    id: 'SUPPRESSIVE_BARRAGE',
    familyId: 'hex-carbine',
    label: '[ SUPPRESSIVE FIRE ]',
    description: 'Two 4 Kinetic packets — commits 2 rounds. Applies Suppressed (×0.70 next direct) on hit threshold.',
    apCost: 1,
    staminaCost: 0,
    ammoCost: 2,
    baseDamage: 4,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'DEBUFF'],
  },
  CONTACT_FRONT: {
    id: 'CONTACT_FRONT',
    familyId: 'hex-carbine',
    label: '[ CONTACT FRONT ]',
    description: 'Four 5 Kinetic packets — 4+0 or 2+2 allocation. Commits 4 rounds. No retarget on death.',
    apCost: 2,
    staminaCost: 0,
    ammoCost: 4,
    baseDamage: 5,
    targetMode: 'ONE_OR_TWO',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC'],
  },
};

const BLACK_DOOR: Record<
  'DOOR_KNOCKER' | 'FATAL_FUNNEL' | 'THRESHOLD' | 'DEADBOLT',
  HexWeaponActionDefinition
> = {
  DOOR_KNOCKER: {
    id: 'DOOR_KNOCKER',
    familyId: 'hex-shotgun',
    label: '[ DOOR KNOCKER ]',
    description: 'Nullbreach basic — Tier-I 19 Kinetic via family scaling. Armor pressure + backline ×0.75. Live stamina.',
    apCost: 1,
    // Display floor; runtime uses resolveHexBasicShot stamina pipeline.
    staminaCost: 11,
    ammoCost: 1,
    baseDamage: 16,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'HEAVY', 'ARMOR_BREAK', 'GUARD_BREAK'],
  },
  FATAL_FUNNEL: {
    id: 'FATAL_FUNNEL',
    familyId: 'hex-shotgun',
    label: '[ FATAL FUNNEL ]',
    description: 'Column blast — primary 16 / rear 11 Kinetic. One shell. No lateral spill.',
    apCost: 2,
    staminaCost: 12,
    ammoCost: 1,
    baseDamage: 16,
    targetMode: 'COLUMN',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'HEAVY'],
  },
  THRESHOLD: {
    id: 'THRESHOLD',
    familyId: 'hex-shotgun',
    label: '[ THRESHOLD ]',
    description: 'Arm a pre-attack reaction — reserves 1 shell now. 14 Kinetic vs the attacker. Expires next player turn.',
    apCost: 1,
    staminaCost: 15,
    ammoCost: 1,
    baseDamage: 14,
    targetMode: 'NONE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'HEAVY', 'DEFENSIVE'],
  },
  DEADBOLT: {
    id: 'DEADBOLT',
    familyId: 'hex-shotgun',
    label: '[ DEADBOLT ]',
    description: 'Heavy 22 Kinetic (28 after qualifying reload opportunity). Consumes opportunity on valid cast.',
    apCost: 2,
    staminaCost: 14,
    ammoCost: 1,
    baseDamage: 22,
    targetMode: 'SINGLE',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'HEAVY'],
  },
};

const HEX_WEAPON_ACTION_CATALOG: Record<HexWeaponActionId, HexWeaponActionDefinition | undefined> = {
  ...REVOLVER,
  ...CARBINE,
  ...BLACK_DOOR,
};

export function getHexWeaponActionDefinition(
  id: HexWeaponActionId,
): HexWeaponActionDefinition | null {
  return HEX_WEAPON_ACTION_CATALOG[id] ?? null;
}

export function hexWeaponActionTags(id: HexWeaponActionId): readonly HexShotAbilityTag[] {
  return getHexWeaponActionDefinition(id)?.tags ?? [];
}

export function formatHexWeaponActionLabel(id: string): string {
  if (id in REVOLVER) return REVOLVER[id as keyof typeof REVOLVER].label;
  if (id in CARBINE) return CARBINE[id as keyof typeof CARBINE].label;
  if (id in BLACK_DOOR) return BLACK_DOOR[id as keyof typeof BLACK_DOOR].label;
  return `[ ${id.replace(/_/g, ' ')} ]`;
}

/** True when the ID has a live authored catalog definition (executable kit actions). */
export function isDefinedHexWeaponActionId(id: string): id is HexWeaponActionId {
  return getHexWeaponActionDefinition(id as HexWeaponActionId) != null;
}

/** @deprecated Prefer isDefinedHexWeaponActionId */
export function isHexWeaponActionCatalogId(id: string): id is HexWeaponActionId {
  return isDefinedHexWeaponActionId(id);
}

/** Maps legacy fixed-basic graft/telemetry signature to the family basic WA. */
export function mapHexFixedBasicSignatureToWeaponAction(
  familyId: HexWeaponFamilyId | null | undefined,
): HexWeaponActionId | 'SILVER_CORE_SIDEARM' {
  if (familyId === 'hex-revolver') return 'QUICKDRAW';
  if (familyId === 'hex-carbine') return 'CENTER_MASS';
  if (familyId === 'hex-shotgun') return 'DOOR_KNOCKER';
  return 'SILVER_CORE_SIDEARM';
}

export const HEX_REVOLVER_CATALOG = REVOLVER;
export const HEX_BLACK_DOOR_CATALOG = BLACK_DOOR;
export const HEX_CARBINE_CATALOG = CARBINE;
