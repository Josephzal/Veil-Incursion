import type { CombatGridSlotId } from '../types/combatGrid';
import { ADJACENT_SLOTS, FRONTLINE_SLOTS } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';

export function isUnitAlive(unit: EnemyCombatProfile): boolean {
  if (unit.isSlumped && (unit.slumpTurnsRemaining ?? 0) > 0) return true;
  return unit.currentHp > 0;
}

export function aliveUnits(squad: EnemyCombatProfile[]): EnemyCombatProfile[] {
  return squad.filter(isUnitAlive);
}

export function allUnitsDefeated(squad: EnemyCombatProfile[]): boolean {
  return aliveUnits(squad).length === 0;
}

export function getUnitById(
  squad: EnemyCombatProfile[],
  unitId: string,
): EnemyCombatProfile | undefined {
  return squad.find((u) => u.unitId === unitId);
}

export function updateUnit(
  squad: EnemyCombatProfile[],
  unitId: string,
  patch: Partial<EnemyCombatProfile>,
): EnemyCombatProfile[] {
  return squad.map((u) => (u.unitId === unitId ? { ...u, ...patch } : u));
}

export function primaryAliveUnit(squad: EnemyCombatProfile[]): EnemyCombatProfile | null {
  const alive = aliveUnits(squad);
  if (alive.length === 0) return null;
  const front = alive.filter((u) => u.gridSlot?.startsWith('FL'));
  return front[0] ?? alive[0];
}

export function unitAtSlot(
  squad: EnemyCombatProfile[],
  slot: CombatGridSlotId,
): EnemyCombatProfile | undefined {
  const direct = squad.find((u) => u.gridSlot === slot && isUnitAlive(u));
  if (direct) return direct;
  return squad.find((u) => {
    if (!isUnitAlive(u)) return false;
    if (u.occupiedSlots?.includes(slot)) return true;
    if ((u.gridWidth ?? 1) >= 2 && u.gridSlot === 'FL_0' && (slot === 'FL_0' || slot === 'FL_1')) {
      return true;
    }
    return false;
  });
}

export function nextDefaultTarget(squad: EnemyCombatProfile[]): string | null {
  const primary = primaryAliveUnit(squad);
  return primary?.unitId ?? null;
}

export function firstOpenFrontlineSlot(squad: EnemyCombatProfile[]): CombatGridSlotId | null {
  for (const slot of FRONTLINE_SLOTS) {
    if (!unitAtSlot(squad, slot)) return slot;
  }
  return null;
}

/** Pull a backline unit to frontline — swaps with occupant if frontline is full. */
export function pullBacklineToFrontline(
  squad: EnemyCombatProfile[],
  unitId: string,
): EnemyCombatProfile[] {
  const unit = getUnitById(squad, unitId);
  if (!unit?.gridSlot?.startsWith('BL')) return squad;

  const open = firstOpenFrontlineSlot(squad);
  const targetSlot = open ?? FRONTLINE_SLOTS[0];
  const occupant = unitAtSlot(squad, targetSlot);
  const fromSlot = unit.gridSlot as CombatGridSlotId;

  return squad.map((u) => {
    if (u.unitId === unitId) {
      return { ...u, gridSlot: targetSlot, lane: 'FRONTLINE' as const };
    }
    if (occupant && u.unitId === occupant.unitId) {
      return { ...u, gridSlot: fromSlot, lane: 'BACKLINE' as const };
    }
    return u;
  });
}

export function adjacentAliveUnits(
  squad: EnemyCombatProfile[],
  unitId: string,
): EnemyCombatProfile[] {
  const unit = getUnitById(squad, unitId);
  if (!unit?.gridSlot) return [];
  const adj = ADJACENT_SLOTS[unit.gridSlot as CombatGridSlotId] ?? [];
  return adj
    .map((slot) => unitAtSlot(squad, slot))
    .filter((u): u is EnemyCombatProfile => u != null);
}
