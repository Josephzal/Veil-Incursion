import { Dimensions } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { FRONTLINE_SLOTS } from '../../types/combatGrid';

const ARENA_HORIZONTAL_INSET = 16;

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

/** Bar anchor positions — kept inside the enemy arena column per slot. */
export const ENEMY_COLUMN_BAR_LAYOUT: Record<CombatGridSlotId, EnemyBarAnchor> = {
  FL_0: { left: '0%', bottom: '70%', width: '50%' },
  FL_1: { left: '50%', bottom: '70%', width: '50%' },
  BL_0: { left: '0%', top: '1%', width: '50%' },
  BL_1: { left: '50%', top: '1%', width: '50%' },
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
  FL_0: { left: '0%', bottom: ARENA_SPRITE_BOTTOM, width: '50%', height: ARENA_SPRITE_HEIGHT, scale: 1, zIndex: 6 },
  FL_1: { left: '50%', bottom: ARENA_SPRITE_BOTTOM, width: '50%', height: ARENA_SPRITE_HEIGHT, scale: 1, zIndex: 5 },
  BL_0: { left: '0%', bottom: '26%', width: '52%', height: '80%', scale: 1.1, zIndex: 2 },
  BL_1: { left: '48%', bottom: '28%', width: '52%', height: '80%', scale: 1.1, zIndex: 1 },
};

/** Gauge track width that fits inside an enemy arena slot. */
export function arenaSlotGaugeWidth(slotWidthPercent: number): number {
  const screenWidth = Dimensions.get('window').width;
  const enemyColumnWidth = (screenWidth - ARENA_HORIZONTAL_INSET) / 2;
  return Math.max(28, Math.floor(enemyColumnWidth * (slotWidthPercent / 100) * 0.84));
}

export function slotWidthPercent(width: `${number}%`): number {
  return Number.parseFloat(width);
}

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
