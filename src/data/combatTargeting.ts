import type { AegisAbilityId } from '../types/aegisCombat';
import type { CombatGridSlotId } from '../types/combatGrid';
import { BACKLINE_SLOTS, FRONTLINE_SLOTS } from '../types/combatGrid';
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
};

export function abilityTargetMode(abilityId: AegisAbilityId): AbilityTargetMode {
  return ABILITY_TARGET_MODE[abilityId] ?? 'SINGLE';
}

export function abilityRequiresTarget(abilityId: AegisAbilityId): boolean {
  return abilityTargetMode(abilityId) === 'SINGLE';
}

function frontlineAlive(squad: EnemyCombatProfile[]): boolean {
  return FRONTLINE_SLOTS.some((slot) => unitAtSlot(squad, slot) != null);
}

/** Kinetic melee blocked on backline while any frontline unit lives. Occult bypasses. */
export function canTargetWithAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
  unitId: string,
): boolean {
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;

  const mode = abilityTargetMode(abilityId);
  if (mode === 'NONE' || mode === 'ALL') return false;

  if (abilityId === 'GRAVE_BIND') {
    return unit.gridSlot?.startsWith('BL') === true;
  }

  const isOccult = abilityId === 'VEIL_PIERCER' || abilityId === 'BLOOD_TITHE';
  if (isOccult) return true;

  const onBackline = unit.gridSlot?.startsWith('BL') === true;
  if (onBackline && frontlineAlive(squad)) return false;
  return true;
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

export function isBacklineSlot(slot: CombatGridSlotId): boolean {
  return BACKLINE_SLOTS.includes(slot);
}
