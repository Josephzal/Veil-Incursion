import type { HexShotAbilityId } from '../types/operativeClass';
import type { HexShotAbilityTag } from '../types/classCombatAbility';
import type { AbilityUnlockCost } from '../types/aegisCombat';

export interface HexShotAbilityDefinition {
  id: HexShotAbilityId;
  classId: 'HEX_SHOT';
  label: string;
  description: string;
  apCost: number;
  ammoCost: number;
  staminaCost: number;
  staminaCostPct?: number;
  baseDamage: number;
  requiresFullMag?: boolean;
  tags: readonly HexShotAbilityTag[];
  unlockCost: AbilityUnlockCost;
}

import { migrateHexShotAbilityId } from './hexShotMigration';
import { getHexWeaponActionDefinition } from './hexWeaponActionCatalog';

export const HEX_SHOT_ABILITY_CATALOG: Record<HexShotAbilityId, HexShotAbilityDefinition> = {
  SILVER_CORE_SIDEARM: {
    id: 'SILVER_CORE_SIDEARM',
    classId: 'HEX_SHOT',
    label: '[ SILVER-CORE SIDEARM ]',
    description: 'Anchor sidearm — baseline ballistic damage. Inherits current ammo type. Counters: Guard / armored Heavy Attack. Cannot be removed or grafted.',
    apCost: 1,
    ammoCost: 1,
    staminaCost: 0,
    baseDamage: 10,
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'ARMOR_BREAK', 'GUARD_BREAK'],
    unlockCost: {},
  },
  ZERO_PROTOCOL: {
    id: 'ZERO_PROTOCOL',
    classId: 'HEX_SHOT',
    label: '[ ZERO PROTOCOL ]',
    description: 'Ash Shotgun ultimate — true-damage execution using calibrated ammo. Requires 3 Protocol Charges from Perfect reloads.',
    apCost: 0,
    ammoCost: 0,
    staminaCost: 0,
    baseDamage: 25,
    tags: ['ULTIMATE', 'TRUE_DAMAGE', 'BALLISTIC'],
    unlockCost: { 'ley-slag': 30 },
  },
  PHASE_SHIFT_RELOAD: {
    id: 'PHASE_SHIFT_RELOAD',
    classId: 'HEX_SHOT',
    label: '[ PHASE-SHIFT RELOAD ]',
    description: 'Intrinsic reload — use [ COMBAT RELOAD ] on the action bar.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 0,
    baseDamage: 0,
    tags: ['TACTICAL', 'RELOAD', 'RESTORE'],
    unlockCost: {},
  },
  ASH_JACKET_SALVO: {
    id: 'ASH_JACKET_SALVO',
    classId: 'HEX_SHOT',
    label: '[ ASH-JACKET SALVO ]',
    description: '3-round burst (7 + 7 + 8 Kinetic) — inherits current ammo type on each hit. Applies CONCUSSED once. Counters: Guard / Heavy.',
    apCost: 2,
    ammoCost: 3,
    staminaCost: 0,
    baseDamage: 22,
    tags: ['BALLISTIC', 'RANGED', 'FRACTURE', 'KINETIC', 'GUARD_BREAK'],
    unlockCost: { 'ley-slag': 12 },
  },
  SINGULARITY_SLUG: {
    id: 'SINGULARITY_SLUG',
    classId: 'HEX_SHOT',
    label: '[ SINGULARITY SLUG ]',
    description: 'Heavy shot — ignores kinetic armor and amplifies current ammo effect; permanently reduces target max HP by 10%.',
    apCost: 1,
    ammoCost: 1,
    staminaCost: 0,
    baseDamage: 16,
    tags: ['BALLISTIC', 'RANGED', 'ARMOR_PIERCE', 'KINETIC'],
    unlockCost: { 'ley-slag': 18 },
  },
  PANOPTICON_PROTOCOL: {
    id: 'PANOPTICON_PROTOCOL',
    classId: 'HEX_SHOT',
    label: '[ PANOPTICON WATCH ]',
    description: 'Overwatch — auto-interrupt and Concuss the next acting hostile with a fixed Kinetic interrupt shot. Does not consume magazine ammunition. Counters: Lock-On, Channel, Heavy Attack.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 30,
    baseDamage: 8,
    tags: ['TACTICAL', 'DEFENSIVE', 'TRAP', 'INTERRUPT'],
    unlockCost: { 'ley-slag': 14 },
  },
  REVENANTS_ECHO: {
    id: 'REVENANTS_ECHO',
    classId: 'HEX_SHOT',
    label: "[ REVENANT'S ECHO ]",
    description: 'Twin shots — inherits current ammo type; second hit crits for 300% if target is below 30% HP.',
    apCost: 1,
    ammoCost: 2,
    staminaCost: 0,
    baseDamage: 9,
    tags: ['BALLISTIC', 'RANGED', 'EXECUTION', 'KINETIC'],
    unlockCost: { 'ley-slag': 16 },
  },
  RIFT_SNARE: {
    id: 'RIFT_SNARE',
    classId: 'HEX_SHOT',
    label: '[ RIFT-SNARE ]',
    description: 'Places a mine under a target — detonates on their turn for AoE damage.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 25,
    baseDamage: 14,
    tags: ['TACTICAL', 'TRAP', 'AOE', 'KINETIC'],
    unlockCost: { 'ley-slag': 10 },
  },
  PHOSPHORUS_HEX: {
    id: 'PHOSPHORUS_HEX',
    classId: 'HEX_SHOT',
    label: '[ PHOSPHORUS HEX ]',
    description: 'Blinds a 2×2 grid — zero evade and −50% hit chance on follow-up attacks. Counters: Lock-On.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 20,
    baseDamage: 0,
    tags: ['TACTICAL', 'AOE', 'DEBUFF', 'BLIND'],
    unlockCost: { 'ley-slag': 12 },
  },
  NULL_SPACE_CLOAK: {
    id: 'NULL_SPACE_CLOAK',
    classId: 'HEX_SHOT',
    label: '[ NULL-SPACE CLOAK ]',
    description: '100% evade against the next incoming attack.',
    apCost: 0,
    ammoCost: 0,
    staminaCost: 40,
    baseDamage: 0,
    tags: ['TACTICAL', 'DEFENSIVE', 'BUFF'],
    unlockCost: { 'ley-slag': 10 },
  },
  GHOST_GRID_CAMO: {
    id: 'GHOST_GRID_CAMO',
    classId: 'HEX_SHOT',
    label: '[ GHOST-GRID CAMO ]',
    description: 'Phases operative — untargetable for 1 turn.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 40,
    baseDamage: 0,
    tags: ['TACTICAL', 'DEFENSIVE', 'BUFF'],
    unlockCost: { 'ley-slag': 20 },
  },
  ASTRAL_TARGET_LOCK: {
    id: 'ASTRAL_TARGET_LOCK',
    classId: 'HEX_SHOT',
    label: '[ ASTRAL TARGET-LOCK ]',
    description: 'Setup — target becomes EXPOSED. Next BALLISTIC attack is a guaranteed crit. Does not fire or consume ammunition.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 25,
    baseDamage: 0,
    tags: ['TACTICAL', 'DEBUFF'],
    unlockCost: { 'ley-slag': 12 },
  },
  CINDERLINE_SATURATION: {
    id: 'CINDERLINE_SATURATION',
    classId: 'HEX_SHOT',
    label: '[ CINDERLINE SATURATION ]',
    description: 'Seeds a two-round positional burn hazard on the target\'s grid slot — 5 Occult at affected enemy turn start. No ammunition. Same-slot recast refreshes; does not stack.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 30,
    baseDamage: 0,
    tags: ['TACTICAL', 'AOE', 'OCCULT', 'TRAP'],
    unlockCost: { 'ley-slag': 14 },
  },
  BLACKSITE_TRIAGE: {
    id: 'BLACKSITE_TRIAGE',
    classId: 'HEX_SHOT',
    label: '[ BLACKSITE TRIAGE ]',
    description: 'Once per encounter — restore 20% maximum HP (capped at missing HP). Costs 1 AP and 35 Stamina. Cannot cast at full HP. No ammunition.',
    apCost: 1,
    ammoCost: 0,
    staminaCost: 35,
    baseDamage: 0,
    tags: ['TACTICAL', 'RESTORE'],
    unlockCost: { 'ley-slag': 14 },
  },
  BLEEDING_PAYLOAD: {
    id: 'BLEEDING_PAYLOAD',
    classId: 'HEX_SHOT',
    label: '[ BLEEDING PAYLOAD ]',
    description: '[DEPRECATED — ammo now chosen at reload] Void-ammo burst on a 2×2 grid — leaves burning bleed hazard.',
    apCost: 2,
    ammoCost: 2,
    staminaCost: 0,
    baseDamage: 12,
    tags: ['VOID_AMMO', 'AOE', 'DEBUFF', 'OCCULT'],
    unlockCost: { 'ley-slag': 14 },
  },
  WRAITH_PIERCER_ROUND: {
    id: 'WRAITH_PIERCER_ROUND',
    classId: 'HEX_SHOT',
    label: '[ WRAITH-PIERCER ROUND ]',
    description: '[DEPRECATED — load Wraithglass instead] Backline occult strike — ignores physical shields; strips 1 Occult Ward. Counters: Channel / Ritual.',
    apCost: 1,
    ammoCost: 1,
    staminaCost: 0,
    baseDamage: 14,
    tags: ['VOID_AMMO', 'RANGED', 'OCCULT', 'WARD_BREAK', 'INTERRUPT', 'SILENCE'],
    unlockCost: { 'ley-slag': 12 },
  },
  BLOOD_TRACER_ROUND: {
    id: 'BLOOD_TRACER_ROUND',
    classId: 'HEX_SHOT',
    label: '[ BLOOD-TRACER ROUND ]',
    description: '[DEPRECATED — ammo now chosen at reload] Heals the operative for 50% of damage dealt.',
    apCost: 1,
    ammoCost: 1,
    staminaCost: 0,
    baseDamage: 12,
    tags: ['VOID_AMMO', 'RANGED', 'RESTORE', 'OCCULT'],
    unlockCost: { 'ley-slag': 14 },
  },
  STASIS_LOCK_SLUG: {
    id: 'STASIS_LOCK_SLUG',
    classId: 'HEX_SHOT',
    label: '[ STASIS-LOCK SLUG ]',
    description: '[DEPRECATED — load Stasis-Lock instead] Pins shadow — reduces target AP by 2. Counters: Lock-On (blind/disrupt).',
    apCost: 1,
    ammoCost: 1,
    staminaCost: 0,
    baseDamage: 8,
    tags: ['VOID_AMMO', 'CONTROL', 'DEBUFF', 'OCCULT', 'BLIND', 'INTERRUPT'],
    unlockCost: { 'ley-slag': 10 },
  },
};

export function getHexShotAbilityDefinition(id: HexShotAbilityId): HexShotAbilityDefinition {
  return HEX_SHOT_ABILITY_CATALOG[migrateHexShotAbilityId(id)];
}

export function getHexShotAbilityTags(id: HexShotAbilityId | string): readonly HexShotAbilityTag[] {
  // W.2 — weapon-action IDs are not in HEX_SHOT_ABILITY_CATALOG.
  const wa = getHexWeaponActionDefinition(id as import('../types/hexWeaponAction').HexWeaponActionId);
  if (wa) return wa.tags;
  return HEX_SHOT_ABILITY_CATALOG[migrateHexShotAbilityId(id as HexShotAbilityId)].tags;
}
