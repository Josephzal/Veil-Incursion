import type { AegisAbilityId } from '../types/aegisCombat';
import type { CombatGridSlotId } from '../types/combatGrid';
import { BACKLINE_SLOTS } from '../types/combatGrid';
import { aliveUnits, isUnitAlive, unitAtSlot } from './combatSquadEngine';
import type { EnemyCombatProfile } from '../types/run';

export type AbilityTargetMode = 'NONE' | 'SINGLE' | 'ALL';

const ABILITY_TARGET_MODE: Partial<Record<AegisAbilityId, AbilityTargetMode>> = {
  STRIKE: 'SINGLE',
  VEIL_PIERCER: 'SINGLE',
  RUIN: 'ALL',
  GRAVE_BIND: 'SINGLE',
  NAIL_TO_GRID: 'SINGLE',
  BLOOD_TITHE: 'SINGLE',
  CRIMSON_PACT: 'NONE',
  WRAITH_PARRY: 'NONE',
  ASHEN_MANTLE: 'NONE',
  SHADOW_STEP: 'SINGLE',
  DEMONS_LUNG: 'NONE',
  EVISCERATE: 'SINGLE',
  DEVASTATE: 'SINGLE',
  ABYSSAL_FAULT: 'ALL',
  BLOOD_BOUND_CARAPACE: 'NONE',
  REAVE: 'SINGLE',
};

/** Column-pair line of sight: back-top guarded by front-top, back-bottom by front-bottom. */
const COLUMN_GUARD: Partial<Record<CombatGridSlotId, CombatGridSlotId>> = {
  BL_0: 'FL_0',
  BL_1: 'FL_1',
};

export function abilityTargetMode(abilityId: AegisAbilityId): AbilityTargetMode {
  return ABILITY_TARGET_MODE[abilityId] ?? 'SINGLE';
}

export function abilityRequiresTarget(abilityId: AegisAbilityId): boolean {
  return abilityTargetMode(abilityId) === 'SINGLE';
}

function isOccultAbility(abilityId: AegisAbilityId): boolean {
  return abilityId === 'VEIL_PIERCER' || abilityId === 'BLOOD_TITHE';
}

function isHookAbility(abilityId: AegisAbilityId): boolean {
  return abilityId === 'GRAVE_BIND';
}

export function columnGuardSlot(backSlot: CombatGridSlotId): CombatGridSlotId | null {
  return COLUMN_GUARD[backSlot] ?? null;
}

export function isColumnBlocked(
  squad: EnemyCombatProfile[],
  backSlot: CombatGridSlotId,
): boolean {
  const guardSlot = columnGuardSlot(backSlot);
  if (!guardSlot) return false;
  return unitAtSlot(squad, guardSlot) != null;
}

export function isUnitColumnBlocked(
  squad: EnemyCombatProfile[],
  unit: EnemyCombatProfile,
): boolean {
  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (!slot || !slot.startsWith('BL')) return false;
  return isColumnBlocked(squad, slot);
}

export function canTargetWithAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
  unitId: string,
): boolean {
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;

  const mode = abilityTargetMode(abilityId);
  if (mode === 'NONE' || mode === 'ALL') return false;

  if (isHookAbility(abilityId)) {
    return unit.gridSlot?.startsWith('BL') === true;
  }

  if (isOccultAbility(abilityId)) return true;

  if (unit.isUntargetable) return false;

  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (slot?.startsWith('BL') && isColumnBlocked(squad, slot)) return false;
  return true;
}

export function isUnitBlockedForAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
  unitId: string,
): boolean {
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;
  if (isHookAbility(abilityId)) return false;
  if (isOccultAbility(abilityId)) return false;
  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (!slot?.startsWith('BL')) return false;
  return isColumnBlocked(squad, slot);
}

export function isUnitHookValid(
  abilityId: AegisAbilityId | null,
  unit: EnemyCombatProfile,
): boolean {
  if (!abilityId || !isHookAbility(abilityId)) return false;
  if (!isUnitAlive(unit)) return false;
  return unit.gridSlot?.startsWith('BL') === true;
}

export function validTargetsForAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
): EnemyCombatProfile[] {
  const mode = abilityTargetMode(abilityId);
  if (mode === 'ALL') return aliveUnits(squad);
  if (mode === 'NONE') return [];
  return aliveUnits(squad).filter((u) => canTargetWithAbility(squad, abilityId, u.unitId!));
}

export function resolveUnitAtGridSlot(
  squad: EnemyCombatProfile[],
  slot: CombatGridSlotId,
): EnemyCombatProfile | undefined {
  return unitAtSlot(squad, slot);
}

export function findLivingWarden(squad: EnemyCombatProfile[]): EnemyCombatProfile | null {
  return aliveUnits(squad).find(
    (u) => u.rosterId === 'warden' && u.gridSlot?.startsWith('FL'),
  ) ?? null;
}

/** Hard redirect — backline single-target kinetic attacks hit a living frontline Warden. */
export function resolveWardenInterceptTarget(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
  unitId: string,
): string {
  const mode = abilityTargetMode(abilityId);
  if (mode !== 'SINGLE') return unitId;
  if (isHookAbility(abilityId) || isOccultAbility(abilityId)) return unitId;

  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit?.gridSlot?.startsWith('BL')) return unitId;

  const warden = findLivingWarden(squad);
  if (warden?.unitId) return warden.unitId;
  return unitId;
}

export function isBacklineSlot(slot: CombatGridSlotId): boolean {
  return BACKLINE_SLOTS.includes(slot);
}
