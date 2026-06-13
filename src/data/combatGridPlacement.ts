import type { CombatGridSlotId } from '../types/combatGrid';
import { laneForSlot } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import type { EnemyRosterEntry } from './enemyRoster';

function columnIndex(slot: CombatGridSlotId): 0 | 1 {
  return slot.endsWith('_1') ? 1 : 0;
}

function slotForLaneColumn(lane: 'FRONTLINE' | 'BACKLINE', col: 0 | 1): CombatGridSlotId {
  if (lane === 'FRONTLINE') return col === 0 ? 'FL_0' : 'FL_1';
  return col === 0 ? 'BL_0' : 'BL_1';
}

/** True when exactly one frontline and one backline occupy the same column (visual occlusion). */
export function isTwoUnitSameColumnOcclusion(
  units: ReadonlyArray<Pick<EnemyCombatProfile, 'gridSlot' | 'lane'>>,
): boolean {
  if (units.length !== 2) return false;
  const front = units.find(
    (u) => u.lane === 'FRONTLINE' || u.gridSlot?.startsWith('FL') === true,
  );
  const back = units.find(
    (u) => u.lane === 'BACKLINE' || u.gridSlot?.startsWith('BL') === true,
  );
  if (!front?.gridSlot || !back?.gridSlot) return false;
  return columnIndex(front.gridSlot) === columnIndex(back.gridSlot);
}

/**
 * When a fight has exactly one frontline and one backline hostiles, stagger columns diagonally.
 * Front column is randomized 50/50; backline takes the opposite column.
 */
export function assignDiagonalStaggerSlots(entries: readonly EnemyRosterEntry[]): CombatGridSlotId[] | null {
  if (entries.length !== 2) return null;

  const frontIndex = entries.findIndex((e) => e.role === 'FRONTLINE');
  const backIndex = entries.findIndex((e) => e.role === 'BACKLINE');
  if (frontIndex < 0 || backIndex < 0) return null;

  const frontCol: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
  const backCol: 0 | 1 = frontCol === 0 ? 1 : 0;
  const slots: CombatGridSlotId[] = new Array(entries.length) as CombatGridSlotId[];
  slots[frontIndex] = slotForLaneColumn('FRONTLINE', frontCol);
  slots[backIndex] = slotForLaneColumn('BACKLINE', backCol);
  return slots;
}

export function applyDiagonalStaggerToProfiles(
  profiles: EnemyCombatProfile[],
): EnemyCombatProfile[] {
  if (!isTwoUnitSameColumnOcclusion(profiles)) return profiles;

  const frontIndex = profiles.findIndex(
    (u) => u.lane === 'FRONTLINE' || u.gridSlot?.startsWith('FL') === true,
  );
  const backIndex = profiles.findIndex(
    (u) => u.lane === 'BACKLINE' || u.gridSlot?.startsWith('BL') === true,
  );
  if (frontIndex < 0 || backIndex < 0) return profiles;

  const frontCol: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
  const backCol: 0 | 1 = frontCol === 0 ? 1 : 0;

  return profiles.map((unit, index) => {
    if (index === frontIndex) {
      const gridSlot = slotForLaneColumn('FRONTLINE', frontCol);
      return { ...unit, gridSlot, lane: laneForSlot(gridSlot) };
    }
    if (index === backIndex) {
      const gridSlot = slotForLaneColumn('BACKLINE', backCol);
      return { ...unit, gridSlot, lane: laneForSlot(gridSlot) };
    }
    return unit;
  });
}
