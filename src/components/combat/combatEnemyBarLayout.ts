import { Dimensions } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';

const ARENA_HORIZONTAL_INSET = 16;

/** Matches CombatArenaStage playerSpriteSlot height (% of enemy column). */
export const ARENA_SPRITE_HEIGHT = '57%';
export const ARENA_SPRITE_BOTTOM = '2%';

/** Portrait frame height as a share of its slot (leaves headroom for health gauges). */
export const ARENA_ENEMY_SPRITE_HEIGHT_SHARE = 0.82;

/** Backline depth — raised above frontline, scaled down, tucked under frontline overlap. */
export const BACKLINE_SLOT_BOTTOM = '30%';
export const BACKLINE_SLOT_WIDTH = '54%';
export const BACKLINE_UNIT_SCALE = 0.84;
/** Negative = up-screen; lifts heads above frontline while feet stay near the floor. */
export const BACKLINE_UNIT_TRANSLATE_Y = -34;

/** Pivot for bottom-anchored depth scale (≈ half frontline sprite frame height). */
const DEPTH_SCALE_PIVOT_Y = 76;

/** Lone hostile — centered column, lifted, slightly smaller than a frontline pair tile. */
export const SOLO_SLOT_BOTTOM = '10%';
export const SOLO_UNIT_SCALE = 0.88;
export const SOLO_UNIT_TRANSLATE_Y = -14;

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
    unitScale: 1.5,
    unitTranslateY: 0,
    zIndex: 8,
  },
  FL_1: {
    left: '50%',
    bottom: ARENA_SPRITE_BOTTOM,
    width: '50%',
    height: ARENA_SPRITE_HEIGHT,
    unitScale: 1.5,
    unitTranslateY: 0,
    zIndex: 7,
  },
  BL_0: {
    left: '-1%',
    bottom: BACKLINE_SLOT_BOTTOM,
    width: BACKLINE_SLOT_WIDTH,
    height: ARENA_SPRITE_HEIGHT,
    unitScale: BACKLINE_UNIT_SCALE,
    unitTranslateY: BACKLINE_UNIT_TRANSLATE_Y,
    zIndex: 2,
  },
  BL_1: {
    left: '47%',
    bottom: BACKLINE_SLOT_BOTTOM,
    width: BACKLINE_SLOT_WIDTH,
    height: ARENA_SPRITE_HEIGHT,
    unitScale: BACKLINE_UNIT_SCALE,
    unitTranslateY: BACKLINE_UNIT_TRANSLATE_Y,
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
  const { unitScale, unitTranslateY } = layout;
  if (unitScale === 1 && unitTranslateY === 0) return [];

  // Scale from the floor so backline torsos sit under frontline overlap.
  if (unitScale < 1) {
    return [
      { translateY: DEPTH_SCALE_PIVOT_Y },
      { scale: unitScale },
      { translateY: -DEPTH_SCALE_PIVOT_Y + unitTranslateY },
    ];
  }

  return [
    { translateY: unitTranslateY },
    { scale: unitScale },
  ];
}

function soloLiveUnitSlot(
  units: readonly { slot: CombatGridSlotId; isDead?: boolean }[],
): CombatGridSlotId | null {
  const live = units.filter((unit) => !unit.isDead);
  if (live.length !== 1) return null;
  return live[0]!.slot;
}

/** Solo hostile: full column width, raised floor, slightly smaller scale. */
export function resolveArenaSlotLayout(
  slot: CombatGridSlotId,
  units: readonly { slot: CombatGridSlotId; isDead?: boolean }[],
): EnemySlotLayout {
  const base = ENEMY_ARENA_SLOT_LAYOUT[slot];
  const soloSlot = soloLiveUnitSlot(units);
  if (soloSlot !== slot) return base;

  return {
    ...base,
    left: '0%',
    width: '100%',
    bottom: SOLO_SLOT_BOTTOM,
    unitScale: SOLO_UNIT_SCALE,
    unitTranslateY: SOLO_UNIT_TRANSLATE_Y,
  };
}
