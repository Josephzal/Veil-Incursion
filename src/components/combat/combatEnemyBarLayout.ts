import { Dimensions, type ViewStyle } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { laneForSlot } from '../../types/combatGrid';
import { ALL_GRID_SLOTS } from '../../types/combatGrid';

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
export const ENEMY_HITBOX_DEBUG = false;

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
export const SOLO_SLOT_BOTTOM = '20%';
export const SOLO_UNIT_SCALE = 0.95;
export const SOLO_UNIT_TRANSLATE_Y = -14;

/** Matches CombatPlayerViewport.spriteFrame width. */
export const ARENA_SPRITE_FRAME_WIDTH = '92%';

export {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT as ARENA_GAUGE_BLOCK_HEIGHT,
  COMBAT_GAUGE_ROW_GAP_COMPACT as ARENA_GAUGE_ROW_GAP,
  COMBAT_GAUGE_TRACK_HEIGHT_COMPACT as ARENA_GAUGE_TRACK_HEIGHT,
} from './combatGaugeMetrics';

export const COMBAT_ARENA_FRONTLINE_SLOT_COUNT = 2;
export const COMBAT_ARENA_BACKLINE_SLOT_COUNT = 2;

/** Locked at encounter start — never reflow mid-fight when the squad shrinks. */
export type ArenaLayoutMode = 'solo' | 'group';

/** Slot id used for dedicated single-hostile encounters. */
export const SOLO_ARENA_SLOT: CombatGridSlotId = 'FL_0';

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

/** Fixed 2×2 group formation — coordinates never change when slots empty. */
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

/** Dedicated solo encounter — one centered anchor only. */
export const SOLO_ENEMY_ARENA_SLOT_LAYOUT: EnemySlotLayout = {
  left: '0%',
  bottom: SOLO_SLOT_BOTTOM,
  width: '100%',
  height: ARENA_SPRITE_HEIGHT,
  unitScale: SOLO_UNIT_SCALE,
  unitTranslateY: SOLO_UNIT_TRANSLATE_Y,
  zIndex: 8,
};

export interface SlotAnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Resolve layout mode once from the encounter's initial squad size. */
export function resolveArenaLayoutMode(initialUnitCount: number): ArenaLayoutMode {
  return initialUnitCount <= 1 ? 'solo' : 'group';
}

/** Slots that receive permanent anchors for the given layout mode. */
export function arenaSlotsForMode(mode: ArenaLayoutMode): readonly CombatGridSlotId[] {
  return mode === 'solo' ? [SOLO_ARENA_SLOT] : ALL_GRID_SLOTS;
}

/** Fixed slot coordinates — mode only, never live squad size. */
export function resolveArenaSlotLayout(
  slot: CombatGridSlotId,
  mode: ArenaLayoutMode,
): EnemySlotLayout {
  if (mode === 'solo' && slot === SOLO_ARENA_SLOT) {
    return SOLO_ENEMY_ARENA_SLOT_LAYOUT;
  }
  return ENEMY_ARENA_SLOT_LAYOUT[slot];
}

/** Percentage-based anchor style — min dimensions prevent collapse when empty. */
export function slotAnchorStyle(layout: EnemySlotLayout): ViewStyle {
  return {
    position: 'absolute',
    left: layout.left,
    ...(layout.top != null ? { top: layout.top } : null),
    ...(layout.bottom != null ? { bottom: layout.bottom } : null),
    width: layout.width,
    height: layout.height,
    minWidth: layout.width,
    minHeight: layout.height,
    zIndex: layout.zIndex,
    flexShrink: 0,
  };
}

/** Convert a slot schema entry to pixel bounds inside the arena container. */
export function slotLayoutToAnchorRect(
  layout: EnemySlotLayout,
  containerWidth: number,
  containerHeight: number,
): SlotAnchorRect {
  const leftPct = Number.parseFloat(layout.left) / 100;
  const widthPct = Number.parseFloat(layout.width) / 100;
  const heightPct = Number.parseFloat(layout.height) / 100;
  const bottomPct = layout.bottom ? Number.parseFloat(layout.bottom) / 100 : 0;
  const topPct = layout.top ? Number.parseFloat(layout.top) / 100 : undefined;

  const width = containerWidth * widthPct;
  const height = containerHeight * heightPct;
  const left = containerWidth * leftPct;
  const top = topPct != null
    ? containerHeight * topPct
    : containerHeight - containerHeight * bottomPct - height;

  return { left, top, width, height };
}

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

/** Duration for slot-to-slot position tweens (ms). */
export const ARENA_SLOT_TRANSITION_MS = 300;

/** Backline melee dash-and-return timing (ms). */
export const BACKLINE_MELEE_DASH_WINDUP_MS = 150;
export const BACKLINE_MELEE_DASH_WINDUP_X = 10;
export const BACKLINE_MELEE_DASH_MS = 200;
export const BACKLINE_MELEE_DASH_HOLD_MS = 100;
export const BACKLINE_MELEE_DASH_RETURN_MS = 400;

/** Impact frame — windup complete + dash arrival. */
export const BACKLINE_MELEE_DASH_IMPACT_MS =
  BACKLINE_MELEE_DASH_WINDUP_MS + BACKLINE_MELEE_DASH_MS;

export const BACKLINE_MELEE_DASH_TOTAL_MS =
  BACKLINE_MELEE_DASH_IMPACT_MS + BACKLINE_MELEE_DASH_HOLD_MS + BACKLINE_MELEE_DASH_RETURN_MS;

/** Viewport distance for a backline hostile to overlap the operative sprite. */
export function backlineMeleeDashTranslateX(screenWidth = Dimensions.get('window').width): number {
  const columnHalf = screenWidth * 0.5;
  return -(columnHalf * 1.42);
}

/** Diagonal dash target from a backline slot toward the operative sprite plane. */
export function backlineMeleeDashDelta(
  slot: CombatGridSlotId,
  layoutMode: ArenaLayoutMode,
  arenaWidth: number,
  arenaHeight: number,
): { x: number; y: number } {
  const effectiveSlot = layoutMode === 'solo' ? SOLO_ARENA_SLOT : slot;
  const layout = resolveArenaSlotLayout(effectiveSlot, layoutMode);
  const rect = slotLayoutToAnchorRect(layout, arenaWidth, arenaHeight);
  const slotCenterX = rect.left + rect.width / 2;
  const slotFootY = rect.top + rect.height;

  const playerFootY = arenaHeight * (1 - Number.parseFloat(ARENA_SPRITE_BOTTOM) / 100);
  const x = -(slotCenterX + arenaWidth * 0.42);
  const y = Math.max(16, playerFootY - slotFootY + Math.abs(layout.unitTranslateY) * 0.2);

  return { x, y };
}

/** Forward lunge from the operative sprite toward a targeted hostile slot. */
export function playerAttackLungeDelta(
  slot: CombatGridSlotId,
  layoutMode: ArenaLayoutMode,
  arenaWidth: number,
  arenaHeight: number,
): { x: number; y: number } {
  const effectiveSlot = layoutMode === 'solo' ? SOLO_ARENA_SLOT : slot;
  const layout = resolveArenaSlotLayout(effectiveSlot, layoutMode);
  const enemyColumnWidth = arenaWidth * 0.5;
  const rect = slotLayoutToAnchorRect(layout, enemyColumnWidth, arenaHeight);
  const enemyColumnLeft = arenaWidth * 0.5;
  const slotCenterX = enemyColumnLeft + rect.left + rect.width / 2;

  const playerColumnWidth = arenaWidth * 0.5;
  const playerAnchorX = playerColumnWidth * 0.58;
  const rawGap = slotCenterX - playerAnchorX;
  const x = Math.round(Math.min(88, Math.max(28, rawGap * 0.42)));

  const playerFootY = arenaHeight * 0.98;
  const slotTorsoY = rect.top + rect.height * (laneForSlot(effectiveSlot) === 'BACKLINE' ? 0.62 : 0.72);
  const y = Math.round(Math.min(0, Math.max(-32, (slotTorsoY - playerFootY) * 0.3)));

  return { x, y };
}

/** Frontline melee attack choreography (ms) — idle, stand, attack are distinct coordinates. */
export const FRONTLINE_STAND_X = -20;
export const FRONTLINE_MELEE_ATTACK_X = -52;
export const FRONTLINE_STAND_MS = 220;
export const FRONTLINE_MELEE_SNAP_MS = 120;
export const FRONTLINE_MELEE_RETURN_IDLE_MS = 110;
export const FRONTLINE_MELEE_HOLD_MS = 40;
export const FRONTLINE_RANGED_RETURN_IDLE_MS = 140;
export const STATUS_FLOAT_DURATION_MS = 1000;

/** @deprecated Use FRONTLINE_STAND_X */
export const FRONTLINE_STEP_OUT_X = FRONTLINE_STAND_X;
/** @deprecated Melee snap target is FRONTLINE_MELEE_ATTACK_X */
export const FRONTLINE_IMPACT_SNAP_X = FRONTLINE_MELEE_ATTACK_X - FRONTLINE_STAND_X;
export const FRONTLINE_STEP_OUT_MS = FRONTLINE_STAND_MS;
export const FRONTLINE_IMPACT_HOLD_MS = 500;
export const FRONTLINE_IMPACT_SNAP_MS = FRONTLINE_MELEE_SNAP_MS;
export const FRONTLINE_RETURN_MS = FRONTLINE_RANGED_RETURN_IDLE_MS;

export const FRONTLINE_MELEE_IMPACT_MS = Math.floor(FRONTLINE_MELEE_SNAP_MS * 0.72);

export const ENEMY_BUFF_ANIM_MS = STATUS_FLOAT_DURATION_MS + FRONTLINE_MELEE_RETURN_IDLE_MS;
export const ENEMY_MELEE_ANIM_MS =
  FRONTLINE_MELEE_SNAP_MS + FRONTLINE_MELEE_HOLD_MS + FRONTLINE_MELEE_RETURN_IDLE_MS;
export const ENEMY_RANGED_ANIM_MS = 880;
export const ENEMY_BACKLINE_MELEE_ANIM_MS = BACKLINE_MELEE_DASH_TOTAL_MS;

/** Attack sprite crossfade — locked to CombatEnemyAnchorMotion choreography. */
export const FRONTLINE_MELEE_SPRITE_IN_MS = FRONTLINE_MELEE_SNAP_MS;
export const FRONTLINE_MELEE_SPRITE_HOLD_MS = 260;
export const FRONTLINE_MELEE_SPRITE_OUT_MS = FRONTLINE_MELEE_RETURN_IDLE_MS;
export const BACKLINE_MELEE_SPRITE_IN_MS = BACKLINE_MELEE_DASH_MS;
export const BACKLINE_MELEE_SPRITE_WINDUP_MS = BACKLINE_MELEE_DASH_WINDUP_MS;
export const BACKLINE_MELEE_SPRITE_HOLD_MS = BACKLINE_MELEE_DASH_HOLD_MS + 180;
export const BACKLINE_MELEE_SPRITE_OUT_MS = BACKLINE_MELEE_DASH_RETURN_MS;
export const RANGED_ATTACK_SPRITE_IN_MS = 180;
export const RANGED_ATTACK_SPRITE_HOLD_MS = 600;
export const RANGED_ATTACK_SPRITE_OUT_MS = FRONTLINE_RANGED_RETURN_IDLE_MS;
