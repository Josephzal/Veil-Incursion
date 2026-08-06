import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import {
  abilityRequiresTarget as aegisRequiresTarget,
  abilityTargetMode as aegisTargetMode,
  canTargetWithAbility as aegisCanTarget,
  findLivingWarden,
  isUnitBlockedForAbility as aegisIsBlocked,
  isUnitHookValid as aegisIsHookValid,
  resolveWardenInterceptTarget,
  validTargetsForAbility as aegisValidTargets,
  type AbilityTargetMode,
} from './combatTargeting';
import type { EnemyCombatProfile } from '../types/run';
import { isUnitAlive } from './combatSquadEngine';
import { migrateHexShotAbilityId } from './hexShotMigration';
import { migrateEnvoyAbilityId } from './envoyMigration';

const HEX_TARGET_MODE: Partial<Record<HexShotAbilityId, AbilityTargetMode>> = {
  SILVER_CORE_SIDEARM: 'SINGLE',
  ASH_JACKET_SALVO: 'SINGLE',
  SINGULARITY_SLUG: 'SINGLE',
  REVENANTS_ECHO: 'SINGLE',
  RIFT_SNARE: 'SINGLE',
  PHOSPHORUS_HEX: 'SINGLE',
  ASTRAL_TARGET_LOCK: 'SINGLE',
  CINDERLINE_SATURATION: 'SINGLE',
  BLACKSITE_TRIAGE: 'NONE',
  BLEEDING_PAYLOAD: 'SINGLE',
  WRAITH_PIERCER_ROUND: 'SINGLE',
  BLOOD_TRACER_ROUND: 'SINGLE',
  STASIS_LOCK_SLUG: 'SINGLE',
  ZERO_PROTOCOL: 'SINGLE',
  PANOPTICON_PROTOCOL: 'NONE',
  NULL_SPACE_CLOAK: 'NONE',
  GHOST_GRID_CAMO: 'NONE',
  PHASE_SHIFT_RELOAD: 'NONE',
};

const HEX_WEAPON_ACTION_TARGET_MODE: Partial<Record<string, AbilityTargetMode>> = {
  QUICKDRAW: 'SINGLE',
  SLIPSHOT: 'SINGLE',
  SIX_BELLS: 'SINGLE',
  LAST_WORD: 'SINGLE',
  CENTER_MASS: 'SINGLE',
  CONTROLLED_BURST: 'SINGLE',
  SUPPRESSIVE_BARRAGE: 'SINGLE',
  CONTACT_FRONT: 'ONE_OR_TWO',
  DOOR_KNOCKER: 'SINGLE',
  FATAL_FUNNEL: 'COLUMN',
  THRESHOLD: 'NONE',
  DEADBOLT: 'SINGLE',
};

const ENVOY_TARGET_MODE: Partial<Record<EnvoyAbilityId, AbilityTargetMode>> = {
  VEIL_SPLINTER: 'SINGLE',
  ASTRAL_LANCE: 'SINGLE',
  NECROTIC_BLOOM: 'ALL',
  FLUX_PURGE: 'SINGLE',
  DIMENSIONAL_SHEAR: 'SINGLE',
  ENTROPY_HEX: 'SINGLE',
  FLESH_WARP: 'SINGLE',
  MIND_SUNDER: 'SINGLE',
  SOUL_TETHER: 'SINGLE',
  CATACLYSM_SIGIL: 'ALL',
  PARALYTIC_MIASMA: 'SINGLE',
  PHASE_STEP: 'NONE',
  AETHERIC_TRANSFUSION: 'NONE',
  RIFT_WARD: 'NONE',
};

function hexOccultBackline(id: HexShotAbilityId): boolean {
  return id === 'WRAITH_PIERCER_ROUND';
}

export function classAbilityTargetMode(
  classId: ClassType,
  abilityId: string,
  opts?: { doomfallReleaseAvailable?: boolean },
): AbilityTargetMode {
  if (classId === 'HEX_SHOT') {
    if (HEX_WEAPON_ACTION_TARGET_MODE[abilityId]) {
      return HEX_WEAPON_ACTION_TARGET_MODE[abilityId]!;
    }
    return HEX_TARGET_MODE[migrateHexShotAbilityId(abilityId)] ?? 'SINGLE';
  }
  if (classId === 'ENVOY') {
    return ENVOY_TARGET_MODE[migrateEnvoyAbilityId(abilityId)] ?? 'SINGLE';
  }
  return aegisTargetMode(abilityId as AegisAbilityId, opts);
}

export function classAbilityRequiresTarget(
  classId: ClassType,
  abilityId: string,
  opts?: { doomfallReleaseAvailable?: boolean },
): boolean {
  const mode = classAbilityTargetMode(classId, abilityId, opts);
  return mode === 'SINGLE'
    || mode === 'DUAL'
    || mode === 'ROW'
    || mode === 'ONE_OR_TWO'
    || mode === 'COLUMN';
}

export function classAbilityRequiresTargetLegacy(classId: ClassType, abilityId: string): boolean {
  return classAbilityRequiresTarget(classId, abilityId);
}

export function canTargetWithClassAbility(
  classId: ClassType,
  squad: EnemyCombatProfile[],
  abilityId: string,
  unitId: string,
  opts?: { doomfallReleaseAvailable?: boolean },
): boolean {
  if (classId === 'AEGIS') {
    return aegisCanTarget(squad, abilityId as AegisAbilityId, unitId, opts);
  }
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;
  const mode = classAbilityTargetMode(classId, abilityId);
  if (mode === 'NONE' || mode === 'ALL') return false;
  if (classId === 'HEX_SHOT' && abilityId === 'LAST_WORD') {
    if (!unit.maxHp || unit.currentHp / unit.maxHp > 0.3) return false;
  }
  if (classId === 'HEX_SHOT' && hexOccultBackline(abilityId as HexShotAbilityId)) {
    return unit.gridSlot?.startsWith('BL') === true || true;
  }
  if (unit.isUntargetable) return false;
  // Fatal Funnel column pick may anchor on either cell in the lane.
  if (classId === 'HEX_SHOT' && abilityId === 'FATAL_FUNNEL') return true;
  if (unit.gridSlot?.startsWith('BL')) {
    const guardSlot = unit.gridSlot === 'BL_0' ? 'FL_0' : 'FL_1';
    const guard = squad.find((u) => u.gridSlot === guardSlot && isUnitAlive(u));
    if (guard && abilityId !== 'WRAITH_PIERCER_ROUND') return false;
  }
  return true;
}

export function isUnitBlockedForClassAbility(
  classId: ClassType,
  squad: EnemyCombatProfile[],
  abilityId: string,
  unitId: string,
): boolean {
  if (classId === 'AEGIS') {
    return aegisIsBlocked(squad, abilityId as AegisAbilityId, unitId);
  }
  if (classId === 'HEX_SHOT' && abilityId === 'WRAITH_PIERCER_ROUND') return false;
  if (classId === 'HEX_SHOT' && abilityId === 'FATAL_FUNNEL') return false;
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;
  if (!unit.gridSlot?.startsWith('BL')) return false;
  const guardSlot = unit.gridSlot === 'BL_0' ? 'FL_0' : 'FL_1';
  return squad.some((u) => u.gridSlot === guardSlot && isUnitAlive(u));
}

export function isUnitHookValidForClass(
  classId: ClassType,
  abilityId: string | null,
  unit: EnemyCombatProfile,
): boolean {
  if (classId === 'AEGIS') {
    return aegisIsHookValid(abilityId as AegisAbilityId | null, unit);
  }
  return false;
}

export function validTargetsForClassAbility(
  classId: ClassType,
  squad: EnemyCombatProfile[],
  abilityId: string,
  opts?: { doomfallReleaseAvailable?: boolean },
): EnemyCombatProfile[] {
  if (classId === 'AEGIS') {
    return aegisValidTargets(squad, abilityId as AegisAbilityId, opts);
  }
  const mode = classAbilityTargetMode(classId, abilityId);
  if (mode === 'ALL') return squad.filter(isUnitAlive);
  if (mode === 'NONE') return [];
  return squad.filter((u) => u.unitId && canTargetWithClassAbility(classId, squad, abilityId, u.unitId));
}

function bypassesWardenIntercept(classId: ClassType, abilityId: string): boolean {
  if (classId === 'AEGIS') {
    const aegisId = abilityId as AegisAbilityId;
    return aegisId === 'GRAVE_BIND' || aegisId === 'VEIL_PIERCER';
  }
  if (classId === 'HEX_SHOT') {
    return migrateHexShotAbilityId(abilityId) === 'WRAITH_PIERCER_ROUND';
  }
  return false;
}

/** Redirect backline single-target player abilities to a living frontline Warden when applicable. */
export function resolveClassWardenInterceptTarget(
  squad: EnemyCombatProfile[],
  classId: ClassType,
  abilityId: string,
  unitId: string,
): string {
  if (classId === 'AEGIS') {
    return resolveWardenInterceptTarget(squad, abilityId as AegisAbilityId, unitId);
  }

  const unit = squad.find((u) => u.unitId === unitId);
  const warden = findLivingWarden(squad);
  if (!warden?.unitId) return unitId;

  const mode = classAbilityTargetMode(classId, abilityId);
  if (mode === 'ALL') {
    if (warden.wardenInterceptsAoE && unit?.gridSlot?.startsWith('BL')) {
      return warden.unitId;
    }
    return unitId;
  }
  if (mode !== 'SINGLE') return unitId;
  if (bypassesWardenIntercept(classId, abilityId)) return unitId;
  if (!unit?.gridSlot?.startsWith('BL')) return unitId;

  return warden.unitId;
}
