import { Dimensions } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { FRONTLINE_SLOTS } from '../../types/combatGrid';

const ARENA_HORIZONTAL_INSET = 16;

/** Matches CombatArenaStage playerSpriteSlot height. */
export const ARENA_SPRITE_HEIGHT = '72%';
export const ARENA_SPRITE_BOTTOM = '2%';

/** Matches CombatPlayerViewport.spriteFrame width. */
export const ARENA_SPRITE_FRAME_WIDTH = '92%';

/** Gap between health gauges and sprite head. */
export const ENEMY_HEALTH_BAR_SPRITE_GAP = 8;

export {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT as ARENA_GAUGE_BLOCK_HEIGHT,
  COMBAT_GAUGE_ROW_GAP_COMPACT as ARENA_GAUGE_ROW_GAP,
  COMBAT_GAUGE_TRACK_HEIGHT_COMPACT as ARENA_GAUGE_TRACK_HEIGHT,
} from './combatGaugeMetrics';

export interface EnemySlotLayout {
  left: `${number}%`;
  top?: `${number}%`;
  bottom?: `${number}%`;
  width: `${number}%`;
  height: `${number}%`;
  /** Applied to the EnemyUnit wrapper (sprite + bars together). */
  unitScale: number;
  /** Applied to the EnemyUnit wrapper — negative moves up-screen (backline depth). */
  unitTranslateY: number;
  zIndex: number;
}

export const ENEMY_ARENA_SLOT_LAYOUT: Record<CombatGridSlotId, EnemySlotLayout> = {
  FL_0: {
    left: '0%',
    bottom: ARENA_SPRITE_BOTTOM,
    width: '50%',
    height: ARENA_SPRITE_HEIGHT,
    unitScale: 1,
    unitTranslateY: 0,
    zIndex: 6,
  },
  FL_1: {
    left: '50%',
    bottom: ARENA_SPRITE_BOTTOM,
    width: '50%',
    height: ARENA_SPRITE_HEIGHT,
    unitScale: 1,
    unitTranslateY: 0,
    zIndex: 5,
  },
  BL_0: {
    left: '0%',
    bottom: '26%',
    width: '52%',
    height: '80%',
    unitScale: 0.75,
    unitTranslateY: -24,
    zIndex: 2,
  },
  BL_1: {
    left: '48%',
    bottom: '28%',
    width: '52%',
    height: '80%',
    unitScale: 0.75,
    unitTranslateY: -24,
    zIndex: 1,
  },
};

/** Gauge track width sized to the scaled EnemyUnit footprint. */
export function arenaSlotGaugeWidth(slotWidthPercent: number, unitScale = 1): number {
  const screenWidth = Dimensions.get('window').width;
  const enemyColumnWidth = (screenWidth - ARENA_HORIZONTAL_INSET) / 2;
  return Math.max(28, Math.floor(enemyColumnWidth * (slotWidthPercent / 100) * unitScale * 0.84));
}

export function slotWidthPercent(width: `${number}%`): number {
  return Number.parseFloat(width);
}

export function enemyUnitDepthTransform(
  layout: Pick<EnemySlotLayout, 'unitScale' | 'unitTranslateY'>,
): Array<{ translateY: number } | { scale: number }> {
  return [
    { translateY: layout.unitTranslateY },
    { scale: layout.unitScale },
  ];
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
