/** 2×2 hostile formation — frontline blocks melee on backline until cleared. */

export type CombatGridLane = 'FRONTLINE' | 'BACKLINE';

export type CombatGridSlotId = 'FL_0' | 'FL_1' | 'BL_0' | 'BL_1';

export const FRONTLINE_SLOTS: readonly CombatGridSlotId[] = ['FL_0', 'FL_1'];
export const BACKLINE_SLOTS: readonly CombatGridSlotId[] = ['BL_0', 'BL_1'];
export const ALL_GRID_SLOTS: readonly CombatGridSlotId[] = [
  'FL_0',
  'FL_1',
  'BL_0',
  'BL_1',
];

export type CombatSpawnPattern =
  | 'STATIC_BREACH'
  | 'VOID_TEAR'
  | 'SUMMONER'
  | 'PATROL_AMBUSH';

export function laneForSlot(slot: CombatGridSlotId): CombatGridLane {
  return slot.startsWith('FL') ? 'FRONTLINE' : 'BACKLINE';
}

export const ADJACENT_SLOTS: Record<CombatGridSlotId, readonly CombatGridSlotId[]> = {
  FL_0: ['FL_1', 'BL_0'],
  FL_1: ['FL_0', 'BL_1'],
  BL_0: ['FL_0', 'BL_1'],
  BL_1: ['FL_1', 'BL_0'],
};

/** Vertical column pair (front + back) sharing the same lateral index. */
export function columnPartnerSlot(slot: CombatGridSlotId): CombatGridSlotId | null {
  switch (slot) {
    case 'FL_0':
      return 'BL_0';
    case 'BL_0':
      return 'FL_0';
    case 'FL_1':
      return 'BL_1';
    case 'BL_1':
      return 'FL_1';
    default:
      return null;
  }
}

export function columnSlotsFor(slot: CombatGridSlotId): readonly CombatGridSlotId[] {
  const partner = columnPartnerSlot(slot);
  if (!partner) return [slot];
  return slot.startsWith('FL') ? [slot, partner] : [partner, slot];
}

export function slotLabel(slot: CombatGridSlotId): string {
  switch (slot) {
    case 'FL_0':
      return 'FRONT-L';
    case 'FL_1':
      return 'FRONT-R';
    case 'BL_0':
      return 'BACK-L';
    case 'BL_1':
      return 'BACK-R';
    default:
      return slot;
  }
}

export function isCombatGridSlotId(value: string | null | undefined): value is CombatGridSlotId {
  return value === 'FL_0' || value === 'FL_1' || value === 'BL_0' || value === 'BL_1';
}
