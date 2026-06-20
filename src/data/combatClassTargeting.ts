import type { ClassType } from '../types/game';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import {
  abilityRequiresTarget as aegisRequiresTarget,
  abilityTargetMode as aegisTargetMode,
  canTargetWithAbility as aegisCanTarget,
  isUnitBlockedForAbility as aegisIsBlocked,
  isUnitHookValid as aegisIsHookValid,
  validTargetsForAbility as aegisValidTargets,
  type AbilityTargetMode,
} from './combatTargeting';
import type { EnemyCombatProfile } from '../types/run';

const HEX_TARGET_MODE: Partial<Record<HexShotAbilityId, AbilityTargetMode>> = {
  SILVER_CORE_SIDEARM: 'SINGLE',
  ASH_JACKET_SALVO: 'SINGLE',
  SINGULARITY_SLUG: 'SINGLE',
  REVENANTS_ECHO: 'SINGLE',
  RIFT_SNARE: 'SINGLE',
  PHOSPHORUS_HEX: 'SINGLE',
  ASTRAL_TARGET_LOCK: 'SINGLE',
  BRIMSTONE_PAYLOAD: 'SINGLE',
  WRAITH_PIERCER_ROUND: 'SINGLE',
  BLOOD_TRACER_ROUND: 'SINGLE',
  STASIS_LOCK_SLUG: 'SINGLE',
  ZERO_PROTOCOL: 'SINGLE',
  PANOPTICON_PROTOCOL: 'NONE',
  NULL_SPACE_CLOAK: 'NONE',
  GHOST_GRID_CAMO: 'NONE',
  PHASE_SHIFT_RELOAD: 'NONE',
};

const ENVOY_TARGET_MODE: Partial<Record<EnvoyAbilityId, AbilityTargetMode>> = {
  VEIL_SPLINTER: 'SINGLE',
  ASTRAL_LANCE: 'SINGLE',
  SPATIAL_COLLAPSE: 'SINGLE',
  FLUX_PURGE: 'SINGLE',
  DIMENSIONAL_SHEAR: 'SINGLE',
  ENTROPY_HEX: 'SINGLE',
  FLESH_WARP: 'SINGLE',
  MIND_SUNDER: 'SINGLE',
  SOUL_TETHER: 'SINGLE',
  CATACLYSM_SIGIL: 'ALL',
  GRAVITY_WELL: 'ALL',
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
): AbilityTargetMode {
  if (classId === 'HEX_SHOT') {
    return HEX_TARGET_MODE[abilityId as HexShotAbilityId] ?? 'SINGLE';
  }
  if (classId === 'ENVOY') {
    return ENVOY_TARGET_MODE[abilityId as EnvoyAbilityId] ?? 'SINGLE';
  }
  return aegisTargetMode(abilityId as AegisAbilityId);
}

export function classAbilityRequiresTarget(classId: ClassType, abilityId: string): boolean {
  return classAbilityTargetMode(classId, abilityId) === 'SINGLE';
}

export function canTargetWithClassAbility(
  classId: ClassType,
  squad: EnemyCombatProfile[],
  abilityId: string,
  unitId: string,
): boolean {
  if (classId === 'AEGIS') {
    return aegisCanTarget(squad, abilityId as AegisAbilityId, unitId);
  }
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || unit.currentHp <= 0) return false;
  const mode = classAbilityTargetMode(classId, abilityId);
  if (mode === 'NONE' || mode === 'ALL') return false;
  if (classId === 'HEX_SHOT' && hexOccultBackline(abilityId as HexShotAbilityId)) {
    return unit.gridSlot?.startsWith('BL') === true || true;
  }
  if (unit.isUntargetable) return false;
  if (unit.gridSlot?.startsWith('BL')) {
    const guardSlot = unit.gridSlot === 'BL_0' ? 'FL_0' : 'FL_1';
    const guard = squad.find((u) => u.gridSlot === guardSlot && u.currentHp > 0);
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
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || unit.currentHp <= 0) return false;
  if (!unit.gridSlot?.startsWith('BL')) return false;
  const guardSlot = unit.gridSlot === 'BL_0' ? 'FL_0' : 'FL_1';
  return squad.some((u) => u.gridSlot === guardSlot && u.currentHp > 0);
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
): EnemyCombatProfile[] {
  if (classId === 'AEGIS') {
    return aegisValidTargets(squad, abilityId as AegisAbilityId);
  }
  const mode = classAbilityTargetMode(classId, abilityId);
  if (mode === 'ALL') return squad.filter((u) => u.currentHp > 0);
  if (mode === 'NONE') return [];
  return squad.filter((u) => u.unitId && canTargetWithClassAbility(classId, squad, abilityId, u.unitId));
}

export function classAbilityRequiresTargetLegacy(classId: ClassType, abilityId: string): boolean {
  if (classId === 'AEGIS') return aegisRequiresTarget(abilityId as AegisAbilityId);
  return classAbilityRequiresTarget(classId, abilityId);
}
