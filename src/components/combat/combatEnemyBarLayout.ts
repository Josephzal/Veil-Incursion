import type { CombatGridSlotId } from '../../types/combatGrid';
import { FRONTLINE_SLOTS } from '../../types/combatGrid';

/** Matches CombatArenaStage playerSpriteSlot height. */
export const ARENA_SPRITE_HEIGHT = '72%';
export const ARENA_SPRITE_BOTTOM = '2%';

/** Matches CombatPlayerViewport.spriteFrame width. */
export const ARENA_SPRITE_FRAME_WIDTH = '92%';

export {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT as ARENA_GAUGE_BLOCK_HEIGHT,
  COMBAT_GAUGE_ROW_GAP_COMPACT as ARENA_GAUGE_ROW_GAP,
  COMBAT_GAUGE_TRACK_HEIGHT_COMPACT as ARENA_GAUGE_TRACK_HEIGHT,
} from './combatGaugeMetrics';

export interface EnemyBarAnchor {
  left: `${number}%`;
  width: `${number}%`;
  top?: `${number}%`;
  bottom?: `${number}%`;
}

/** Bar anchor positions — width is the sprite slot; bars center inside at deck gauge width. */
export const ENEMY_COLUMN_BAR_LAYOUT: Record<CombatGridSlotId, EnemyBarAnchor> = {
  FL_0: { left: '0%', bottom: '74%', width: '50%' },
  FL_1: { left: '50%', bottom: '74%', width: '50%' },
  BL_0: { left: '4%', top: '3%', width: '44%' },
  BL_1: { left: '54%', top: '5%', width: '44%' },
};

export interface EnemySlotLayout {
  left: `${number}%`;
  top?: `${number}%`;
  bottom?: `${number}%`;
  width: `${number}%`;
  height: `${number}%`;
  scale: number;
  zIndex: number;
}

export const ENEMY_ARENA_SLOT_LAYOUT: Record<CombatGridSlotId, EnemySlotLayout> = {
  FL_0: { left: '0%', bottom: ARENA_SPRITE_BOTTOM, width: '50%', height: ARENA_SPRITE_HEIGHT, scale: 1, zIndex: 4 },
  FL_1: { left: '50%', bottom: ARENA_SPRITE_BOTTOM, width: '50%', height: ARENA_SPRITE_HEIGHT, scale: 1, zIndex: 3 },
  BL_0: { left: '4%', top: '2%', width: '44%', height: '50%', scale: 0.75, zIndex: 1 },
  BL_1: { left: '54%', top: '4%', width: '44%', height: '50%', scale: 0.75, zIndex: 2 },
};

function occupiedFrontlineSlots(units: readonly { slot: CombatGridSlotId; isDead?: boolean }[]): CombatGridSlotId[] {
  return FRONTLINE_SLOTS.filter((slot) =>
    units.some((unit) => !unit.isDead && unit.slot === slot),
  );
}

/** Widen a lone frontline hostile to the full enemy column (player-sized footprint). */
export function resolveArenaSlotLayout(
  slot: CombatGridSlotId,
  units: readonly { slot: CombatGridSlotId; isDead?: boolean }[],
): EnemySlotLayout {
  const base = ENEMY_ARENA_SLOT_LAYOUT[slot];
  const frontline = occupiedFrontlineSlots(units);
  if (frontline.length === 1 && frontline[0] === slot) {
    return { ...base, left: '0%', width: '100%' };
  }
  return base;
}

export function resolveArenaBarLayout(
  slot: CombatGridSlotId,
  units: readonly { slot: CombatGridSlotId; isDead?: boolean }[],
): EnemyBarAnchor {
  const base = ENEMY_COLUMN_BAR_LAYOUT[slot];
  const frontline = occupiedFrontlineSlots(units);
  if (frontline.length === 1 && frontline[0] === slot) {
    return { left: '0%', bottom: '74%', width: '100%' };
  }
  return base;
}
