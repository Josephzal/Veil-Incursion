import type { CombatGridSlotId } from '../types/combatGrid';
import { ADJACENT_SLOTS, ALL_GRID_SLOTS, FRONTLINE_SLOTS, laneForSlot } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';

export function isUnitAlive(unit: EnemyCombatProfile): boolean {
  if (unit.isSlumped && (unit.slumpTurnsRemaining ?? 0) > 0) return true;
  return unit.currentHp > 0;
}

/** Arena grid visibility — alive/slumped units stay mounted; dead units only during dissolve VFX. */
export interface ArenaGridUnitPresence {
  isDead?: boolean;
  dissolveHidden?: boolean;
  dissolveSeq?: number;
}

export function shouldShowUnitInArenaGrid(unit: ArenaGridUnitPresence): boolean {
  if (unit.dissolveHidden) return false;
  if (!unit.isDead) return true;
  return (unit.dissolveSeq ?? 0) > 0;
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

/** Single-slot placement after a grid swap — clears wide-unit occupancy ghosts. */
export function unitPlacedAtSlot(
  unit: EnemyCombatProfile,
  slot: CombatGridSlotId,
): EnemyCombatProfile {
  return {
    ...unit,
    gridSlot: slot,
    lane: laneForSlot(slot),
    gridWidth: 1,
    occupiedSlots: undefined,
  };
}

/**
 * Ensures each living unit occupies a unique grid slot.
 * Duplicate assignments hide units in the arena (slot → unit map keeps first match only).
 */
export function reconcileSquadGridSlots(
  squad: EnemyCombatProfile[],
): EnemyCombatProfile[] {
  const used = new Set<CombatGridSlotId>();
  let changed = false;

  const reconciled = squad.map((unit) => {
    if (!isUnitAlive(unit)) return unit;

    let slot = unit.gridSlot as CombatGridSlotId | undefined;
    const width = unit.gridWidth ?? 1;
    const occupied = unit.occupiedSlots ?? [];

    if (width >= 2 && slot && occupied.length > 0) {
      const slotsClaimed = [slot, ...occupied] as CombatGridSlotId[];
      const collision = slotsClaimed.some((s) => used.has(s));
      if (!collision) {
        for (const s of slotsClaimed) used.add(s);
        return unit;
      }
    }

    if (slot && !used.has(slot)) {
      used.add(slot);
      if (width >= 2) {
        for (const s of occupied) used.add(s as CombatGridSlotId);
      }
      return unit;
    }

    const open = ALL_GRID_SLOTS.find((candidate) => !used.has(candidate));
    if (!open) return unit;

    changed = true;
    used.add(open);
    return unitPlacedAtSlot(unit, open);
  });

  return changed ? reconciled : squad;
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
