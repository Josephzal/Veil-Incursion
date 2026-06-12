import { Dimensions } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';

const ARENA_HORIZONTAL_INSET = 16;

/** Arena column split — enemy grid uses the wider share, shifted toward center. */
export const ARENA_PLAYER_COLUMN_FLEX = 2;
export const ARENA_ENEMY_COLUMN_FLEX = 3;
export const ARENA_ENEMY_COLUMN_RATIO =
  ARENA_ENEMY_COLUMN_FLEX / (ARENA_PLAYER_COLUMN_FLEX + ARENA_ENEMY_COLUMN_FLEX);
/** Pull enemy grid away from the right screen edge (horizontal only). */
export const ARENA_ENEMY_GRID_INSET_RIGHT = 24;

/** Matches CombatArenaStage playerSpriteSlot height (% of enemy column). */
export const ARENA_SPRITE_HEIGHT = '57%';
export const ARENA_SPRITE_BOTTOM = '25%';
export const ARENA_STAGE_PADDING_BOTTOM = 20;

/** Portrait frame height as a share of its slot (health gauges live in intel panel). */
export const ARENA_ENEMY_SPRITE_HEIGHT_SHARE = 0.94;

/** Backline depth — raised above frontline, scaled down, tucked under frontline overlap. */
export const BACKLINE_SLOT_BOTTOM = '35%';
export const BACKLINE_SLOT_WIDTH = '54%';
export const BACKLINE_UNIT_SCALE = .9;
/** Negative = up-screen; lifts heads above frontline while feet stay near the floor. */
export const BACKLINE_UNIT_TRANSLATE_Y = -34;

/** Toggle red hitbox overlay — set false once overlap is verified. */
export const ENEMY_HITBOX_DEBUG = true;

/** Torso-only tap targets decoupled from portrait image bounds. */
export const FRONTLINE_HITBOX = {
  width: '80%' as const,
  height: '40%' as const,
  bottom: '15%' as const,
};

export const BACKLINE_HITBOX = {
  width: '80%' as const,
  height: '50%' as const,
  top: '25%' as const,
};

/** Visible sprite footprint — bottom-anchored, excludes empty cell space above the art. */
export const ENEMY_SPRITE_FRAME_HEIGHT = '78%' as const;

export function critLabelAnchorAboveHitbox(
  hitbox: typeof FRONTLINE_HITBOX | typeof BACKLINE_HITBOX,
): { bottom?: `${number}%`; top?: `${number}%` } {
  if ('bottom' in hitbox) {
    const bottomPct = Number.parseFloat(hitbox.bottom);
    const heightPct = Number.parseFloat(hitbox.height);
    return { bottom: `${bottomPct + heightPct + 1}%` };
  }
  const topPct = Number.parseFloat(hitbox.top);
  return { top: `${Math.max(2, topPct - 5)}%` };
}

/** Pivot for bottom-anchored depth scale (≈ half frontline sprite frame height). */
const DEPTH_SCALE_PIVOT_Y = 76;

/** Lone hostile — centered column, lifted, slightly smaller than a frontline pair tile. */
export const SOLO_SLOT_BOTTOM = '10%';
export const SOLO_UNIT_SCALE = 0.88;
export const SOLO_UNIT_TRANSLATE_Y = -14;

/** Matches CombatPlayerViewport.spriteFrame width. */
export const ARENA_SPRITE_FRAME_WIDTH = '92%';

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
    unitScale: 1.7,
    unitTranslateY: 0,
    zIndex: 8,
  },
  FL_1: {
    left: '50%',
    bottom: ARENA_SPRITE_BOTTOM,
    width: '50%',
    height: ARENA_SPRITE_HEIGHT,
    unitScale: 1.7,
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
  const enemyColumnWidth = screenWidth * ARENA_ENEMY_COLUMN_RATIO - ARENA_HORIZONTAL_INSET / 2;
  return Math.max(28, Math.floor(enemyColumnWidth * (slotWidthPercent / 100) * unitScale * 0.84));
}

/** Intel panel gauge track — spans the enemy-column overlay width. */
export function arenaIntelGaugeTrackWidth(screenWidth = Dimensions.get('window').width): number {
  const enemyColumnWidth = screenWidth * ARENA_ENEMY_COLUMN_RATIO;
  return Math.max(120, Math.floor(enemyColumnWidth - 24));
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

export type ArenaLayoutUnit = {
  slot: CombatGridSlotId;
  isDead?: boolean;
  dissolveSeq?: number;
  dissolveHidden?: boolean;
};

/** Units still occupying a slot — alive, or mid-dissolve before removal. */
export function unitOccupiesArenaSlot(unit: ArenaLayoutUnit): boolean {
  if (unit.dissolveHidden) return false;
  if (!unit.isDead) return true;
  return (unit.dissolveSeq ?? 0) > 0;
}

function soloLiveUnitSlot(units: readonly ArenaLayoutUnit[]): CombatGridSlotId | null {
  const occupying = units.filter(unitOccupiesArenaSlot);
  if (occupying.length !== 1) return null;
  const only = occupying[0]!;
  // Mid-dissolve corpses keep their formation slot — never solo-reflow while fading.
  if (only.isDead && (only.dissolveSeq ?? 0) > 0 && !only.dissolveHidden) return null;
  return only.slot;
}

/** Solo hostile: full column width, raised floor, slightly smaller scale. */
export function resolveArenaSlotLayout(
  slot: CombatGridSlotId,
  units: readonly ArenaLayoutUnit[],
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
