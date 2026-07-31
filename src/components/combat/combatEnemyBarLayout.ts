import { Dimensions, type ViewStyle } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { ALL_GRID_SLOTS, laneForSlot } from '../../types/combatGrid';

const ARENA_HORIZONTAL_INSET = 16;

/** Arena column split — enemy grid uses the wider share, shifted toward center. */
export const ARENA_PLAYER_COLUMN_FLEX = 2;
export const ARENA_ENEMY_COLUMN_FLEX = 3;
export const ARENA_ENEMY_COLUMN_RATIO =
  ARENA_ENEMY_COLUMN_FLEX / (ARENA_PLAYER_COLUMN_FLEX + ARENA_ENEMY_COLUMN_FLEX);
/** Pull enemy grid away from the right screen edge (horizontal only). */
export const ARENA_ENEMY_GRID_INSET_RIGHT = 72;

/** Matches CombatLandscapeArena playerSpriteSlot height (% of enemy column). */
export const ARENA_SPRITE_HEIGHT = '27%';
export const ARENA_SPRITE_BOTTOM = '20%';
export const ARENA_STAGE_PADDING_BOTTOM = 20;

/** Toggle red hitbox overlay — set false once overlap is verified. */
export const ENEMY_HITBOX_DEBUG = false;

/** Hit-test layer for backline — above frontline draw order without changing visuals. */
export const BACKLINE_TARGET_OVERLAY_Z_INDEX = 30;

/** Hit-test layer for frontline — above slot art so wide operative overlap cannot steal taps. */
export const FRONTLINE_TARGET_OVERLAY_Z_INDEX = 28;

function clampHitboxPercent(value: number): number {
  return Math.max(8, Math.min(92, Math.round(value)));
}

function scaleHitboxPercent(base: number, layoutUnitScale: number): number {
  const scaleFactor = Math.max(0.72, Math.min(1.12, layoutUnitScale));
  return clampHitboxPercent(base * scaleFactor);
}

/** Horizontally centers the tap target under the sprite torso. */
function centerHitboxStyle(widthPct: number, heightPct: number): ViewStyle {
  return {
    width: `${widthPct}%`,
    height: `${heightPct}%`,
    bottom: 0,
    left: `${Math.round((100 - widthPct) / 2)}%`,
  };
}

/** Torso-focused tap target — scales with slot depth and sprite scale. */
export function resolveEnemyHitbox(
  slot: CombatGridSlotId | undefined,
  layoutUnitScale: number,
  isAlpha: boolean,
): ViewStyle {
  const isBackline = slot?.startsWith('BL') === true;
  if (isBackline) {
    return centerHitboxStyle(
      scaleHitboxPercent(90, layoutUnitScale),
      scaleHitboxPercent(110, layoutUnitScale),
      
    );
  }

  const widthBase = isAlpha ? 90 : 70;
  return centerHitboxStyle(
    scaleHitboxPercent(widthBase, layoutUnitScale),
    scaleHitboxPercent(100, layoutUnitScale),
  );
}

export {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT as ARENA_GAUGE_BLOCK_HEIGHT,
  COMBAT_GAUGE_ROW_GAP_COMPACT as ARENA_GAUGE_ROW_GAP,
  COMBAT_GAUGE_TRACK_HEIGHT_COMPACT as ARENA_GAUGE_TRACK_HEIGHT,
} from './combatGaugeMetrics';

export const COMBAT_ARENA_FRONTLINE_SLOT_COUNT = 2;
export const COMBAT_ARENA_BACKLINE_SLOT_COUNT = 2;

/** Locked at encounter start — never reflow mid-fight when the squad shrinks. */
export type ArenaLayoutMode = 'solo' | 'group';

/** Arena grid presentation — flex rows (legacy) or absolute staggered 2.5D. */
export type ArenaGridVariant = 'flex' | 'staggered';

export const STAGGERED_ARENA_WIDTH = '48%' as const;
export const STAGGERED_SLOT_WIDTH_PCT = 34;

export interface StaggeredSlotStyle {
  bottom: `${number}%`;
  left?: `${number}%`;
  right?: `${number}%`;
  zIndex: number;
  scale: number;
}

/**
 * Concept arc — hostiles occupy mid/right with open center field.
 * Frontline lower/larger; backline higher/smaller and inset.
 */
/** Bottoms clear the console dock; right inset keeps labels clear of Enemy Intel. */
export const STAGGERED_GROUP_SLOTS: Record<CombatGridSlotId, StaggeredSlotStyle> = {
  FL_0: { bottom: '36%', left: '2%', zIndex: 4, scale: 1.08 },
  FL_1: { bottom: '32%', right: '18%', zIndex: 5, scale: 1.14 },
  BL_0: { bottom: '56%', left: '22%', zIndex: 2, scale: 0.86 },
  BL_1: { bottom: '60%', right: '28%', zIndex: 1, scale: 0.78 },
};

export const STAGGERED_SOLO_SLOT: StaggeredSlotStyle = {
  bottom: '40%',
  left: '28%',
  zIndex: 4,
  scale: 1.12,
};

/** Slight lift so feet clear the console without crowding turn-order chrome. */
export const ENEMY_ARENA_VERTICAL_SHIFT_RATIO = -0.02;

function shiftSlotBottom(bottom: `${number}%`): `${number}%` {
  const shifted = Math.max(
    0,
    Number.parseFloat(bottom) - ENEMY_ARENA_VERTICAL_SHIFT_RATIO * 100,
  );
  return `${shifted}%`;
}

export function staggeredSlotStyle(
  slot: CombatGridSlotId,
  mode: ArenaLayoutMode,
): StaggeredSlotStyle {
  const base = mode === 'solo' ? STAGGERED_SOLO_SLOT : STAGGERED_GROUP_SLOTS[slot];
  return {
    ...base,
    bottom: shiftSlotBottom(base.bottom),
  };
}

/** Landscape operative anchor — bottom-left of full arena. */
export const LANDSCAPE_OPERATIVE_ZONE_WIDTH = '28%' as const;
export const LANDSCAPE_OPERATIVE_SPRITE_HEIGHT = '72%' as const;

/** Slot id used for dedicated single-hostile encounters. */
export const SOLO_ARENA_SLOT: CombatGridSlotId = 'FL_0';

export const FRONTLINE_SLOTS: readonly CombatGridSlotId[] = ['FL_0', 'FL_1'];
export const BACKLINE_SLOTS: readonly CombatGridSlotId[] = ['BL_0', 'BL_1'];

export interface EnemySlotPresentation {
  unitScale: number;
  zIndex: number;
}

export const FRONTLINE_UNIT_SCALE = 1.1;
export const SOLO_UNIT_SCALE = .85;
/** Lift hostiles upward as a share of battlefield height. */
export const FRONTLINE_BATTLEFIELD_LIFT_RATIO = 0.1;
export const SOLO_BATTLEFIELD_LIFT_RATIO = 0.12;
/** Lower the operative sprite as a share of the player column height. */
export const PLAYER_SPRITE_LOWER_RATIO = 0.04;

const FRONTLINE_PRESENTATION: EnemySlotPresentation = {
  unitScale: FRONTLINE_UNIT_SCALE,
  zIndex: 8,
};

const BACKLINE_PRESENTATION: EnemySlotPresentation = {
  unitScale: 0.75,
  zIndex: 2,
};

const SOLO_PRESENTATION: EnemySlotPresentation = {
  unitScale: SOLO_UNIT_SCALE,
  zIndex: 8,
};

/** Vertical share of the battlefield column used by each flex row. */
export const BACKLINE_ROW_HEIGHT = '40%' as const;
export const FRONTLINE_ROW_HEIGHT = '52%' as const;
/** Pull frontline up over backline feet for 2.5D overlap (% of battlefield width). */
export const FRONTLINE_ROW_OVERLAP_MARGIN = '-12%' as const;

/** Resolve layout mode once from the encounter's initial squad size. */
export function resolveArenaLayoutMode(initialUnitCount: number): ArenaLayoutMode {
  return initialUnitCount <= 1 ? 'solo' : 'group';
}

/** Slots that receive permanent anchors for the given layout mode. */
export function arenaSlotsForMode(mode: ArenaLayoutMode): readonly CombatGridSlotId[] {
  return mode === 'solo' ? [SOLO_ARENA_SLOT] : ALL_GRID_SLOTS;
}

export function resolveSlotPresentation(
  slot: CombatGridSlotId,
  mode: ArenaLayoutMode,
  gridVariant: ArenaGridVariant = 'flex',
): EnemySlotPresentation {
  if (gridVariant === 'staggered') {
    const style = staggeredSlotStyle(slot, mode);
    return { unitScale: style.scale, zIndex: style.zIndex };
  }
  if (mode === 'solo') return SOLO_PRESENTATION;
  return laneForSlot(slot) === 'BACKLINE' ? BACKLINE_PRESENTATION : FRONTLINE_PRESENTATION;
}

interface SlotAnchorFraction {
  /** Normalized X center within the enemy column (0–1). */
  x: number;
  /** Normalized Y center within the battlefield (0–1). */
  y: number;
  /** Normalized foot baseline Y within the battlefield (0–1). */
  footY: number;
}

function estimateStaggeredSlotAnchor(
  slot: CombatGridSlotId,
  layoutMode: ArenaLayoutMode,
): SlotAnchorFraction {
  const style = staggeredSlotStyle(slot, layoutMode);
  const widthFrac = STAGGERED_SLOT_WIDTH_PCT / 100;
  let x: number;
  if (style.left != null) {
    x = Number.parseFloat(style.left) / 100 + widthFrac * 0.5;
  } else {
    x = 1 - Number.parseFloat(style.right ?? '10') / 100 - widthFrac * 0.5;
  }
  const footY = 1 - Number.parseFloat(style.bottom) / 100;
  const y = Math.max(0.12, footY - 0.14);
  return { x, y, footY };
}

/** Estimated slot centers for attack dash math — mirrors flex row + wrapper layout. */
export function estimateSlotAnchorFraction(
  slot: CombatGridSlotId,
  layoutMode: ArenaLayoutMode,
  gridVariant: ArenaGridVariant = 'flex',
): SlotAnchorFraction {
  if (gridVariant === 'staggered') {
    return estimateStaggeredSlotAnchor(slot, layoutMode);
  }
  if (layoutMode === 'solo') {
    return {
      x: 0.5,
      y: 0.66 + ENEMY_ARENA_VERTICAL_SHIFT_RATIO,
      footY: 0.82 + ENEMY_ARENA_VERTICAL_SHIFT_RATIO,
    };
  }

  const isBackline = laneForSlot(slot) === 'BACKLINE';
  const isLeft = slot.endsWith('_0');
  const x = isLeft ? 0.28 : 0.72;
  const y = (isBackline ? 0.34 : 0.68) + ENEMY_ARENA_VERTICAL_SHIFT_RATIO;
  const footY = (isBackline ? 0.48 : 0.84) + ENEMY_ARENA_VERTICAL_SHIFT_RATIO;
  return { x, y, footY };
}

export type ArenaLayoutUnit = {
  slot: CombatGridSlotId;
  isDead?: boolean;
  dissolveSeq?: number;
  dissolveHidden?: boolean;
};

import { shouldShowUnitInArenaGrid } from '../../data/combatSquadEngine';

/** Units still occupying a slot — alive, or mid-dissolve before removal. */
export function unitOccupiesArenaSlot(unit: ArenaLayoutUnit): boolean {
  return shouldShowUnitInArenaGrid(unit);
}

/** Backline melee dash-and-return timing (ms). */
export const BACKLINE_MELEE_DASH_WINDUP_MS = 150;
export const BACKLINE_MELEE_DASH_WINDUP_X = 10;
export const BACKLINE_MELEE_DASH_MS = 200;
/** Freeze at the player plane before dashing back. */
export const BACKLINE_MELEE_DASH_HOLD_MS = 250;
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
  gridVariant: ArenaGridVariant = 'flex',
): { x: number; y: number } {
  const effectiveSlot = layoutMode === 'solo' ? SOLO_ARENA_SLOT : slot;
  const anchor = estimateSlotAnchorFraction(effectiveSlot, layoutMode, gridVariant);
  const slotCenterX = gridVariant === 'staggered'
    ? (arenaWidth * (1 - Number.parseFloat(STAGGERED_ARENA_WIDTH) / 100))
      + (arenaWidth * Number.parseFloat(STAGGERED_ARENA_WIDTH) / 100) * anchor.x
    : arenaWidth * anchor.x;
  const slotFootY = arenaHeight * anchor.footY;

  const playerFootY = gridVariant === 'staggered'
    ? arenaHeight * 0.96
    : arenaHeight * (1 - Number.parseFloat(ARENA_SPRITE_BOTTOM) / 100);
  const x = gridVariant === 'staggered'
    ? -(slotCenterX - arenaWidth * 0.15)
    : -(slotCenterX + arenaWidth * 0.42);
  const y = Math.max(16, playerFootY - slotFootY);

  return { x, y };
}

/** Forward lunge from the operative sprite toward a targeted hostile slot. */
export function playerAttackLungeDelta(
  slot: CombatGridSlotId,
  layoutMode: ArenaLayoutMode,
  arenaWidth: number,
  arenaHeight: number,
  gridVariant: ArenaGridVariant = 'flex',
): { x: number; y: number } {
  const effectiveSlot = layoutMode === 'solo' ? SOLO_ARENA_SLOT : slot;
  const anchor = estimateSlotAnchorFraction(effectiveSlot, layoutMode, gridVariant);

  if (gridVariant === 'staggered') {
    const staggeredLeft = arenaWidth * (1 - Number.parseFloat(STAGGERED_ARENA_WIDTH) / 100);
    const gridWidth = arenaWidth - staggeredLeft;
    const slotCenterX = staggeredLeft + gridWidth * anchor.x;
    // Operative sits bottom-left; bias toward enemy column so the lunge closes distance.
    const operativeAnchorX = arenaWidth * 0.15;
    const rawGap = slotCenterX - operativeAnchorX;
    const x = Math.round(Math.min(210, Math.max(72, rawGap * 0.72)));
    const playerFootY = arenaHeight * 0.96;
    const slotTorsoY = arenaHeight * anchor.y;
    // Keep vertical travel subtle — forward close should dominate over a hop up.
    const y = Math.round(Math.min(0, Math.max(-10, (slotTorsoY - playerFootY) * 0.12)));
    return { x, y };
  }

  const enemyColumnWidth = arenaWidth * 0.5;
  const enemyColumnLeft = arenaWidth * 0.5;
  const slotCenterX = enemyColumnLeft + enemyColumnWidth * anchor.x;

  const playerColumnWidth = arenaWidth * 0.5;
  const playerAnchorX = playerColumnWidth * 0.52;
  const rawGap = slotCenterX - playerAnchorX;
  const x = Math.round(Math.min(180, Math.max(64, rawGap * 0.62)));

  const playerFootY = arenaHeight * 0.98;
  const slotTorsoY = arenaHeight * (laneForSlot(effectiveSlot) === 'BACKLINE' ? anchor.y + 0.08 : anchor.y + 0.06);
  const y = Math.round(Math.min(0, Math.max(-12, (slotTorsoY - playerFootY) * 0.14)));

  return { x, y };
}

/** Frontline melee attack choreography (ms) — idle, stand, attack are distinct coordinates. */
export const FRONTLINE_STAND_X = -20;
export const FRONTLINE_MELEE_ATTACK_X = -52;
export const FRONTLINE_STAND_MS = 220;
export const FRONTLINE_MELEE_SNAP_MS = 120;
export const FRONTLINE_MELEE_RETURN_IDLE_MS = 110;
/** Freeze at the attack pose before returning to idle. */
export const FRONTLINE_MELEE_HOLD_MS = 250;
export const FRONTLINE_RANGED_RETURN_IDLE_MS = 140;
export const STATUS_FLOAT_DURATION_MS = 1000;

/** @deprecated Use FRONTLINE_STAND_X */
export const FRONTLINE_STEP_OUT_X = FRONTLINE_STAND_X;
/** @deprecated Melee snap target is FRONTLINE_MELEE_ATTACK_X */
export const FRONTLINE_IMPACT_SNAP_X = FRONTLINE_MELEE_ATTACK_X - FRONTLINE_STAND_X;
export const FRONTLINE_STEP_OUT_MS = FRONTLINE_STAND_MS;
/** @deprecated Use FRONTLINE_MELEE_HOLD_MS */
export const FRONTLINE_IMPACT_HOLD_MS = FRONTLINE_MELEE_HOLD_MS;
export const FRONTLINE_IMPACT_SNAP_MS = FRONTLINE_MELEE_SNAP_MS;
export const FRONTLINE_RETURN_MS = FRONTLINE_RANGED_RETURN_IDLE_MS;

/** Player strike feedback — fires as the lunge completes, then hold begins. */
export const FRONTLINE_MELEE_IMPACT_MS = FRONTLINE_MELEE_SNAP_MS;

export const ENEMY_BUFF_ANIM_MS = STATUS_FLOAT_DURATION_MS + FRONTLINE_MELEE_RETURN_IDLE_MS;
export const ENEMY_MELEE_ANIM_MS =
  FRONTLINE_MELEE_SNAP_MS + FRONTLINE_MELEE_HOLD_MS + FRONTLINE_MELEE_RETURN_IDLE_MS;
export const ENEMY_RANGED_ANIM_MS = 880;
export const ENEMY_BACKLINE_MELEE_ANIM_MS = BACKLINE_MELEE_DASH_TOTAL_MS;

/** Attack sprite crossfade — locked to CombatEnemyAnchorMotion choreography. */
export const FRONTLINE_MELEE_SPRITE_IN_MS = FRONTLINE_MELEE_SNAP_MS;
export const FRONTLINE_MELEE_SPRITE_HOLD_MS = FRONTLINE_MELEE_HOLD_MS;
export const FRONTLINE_MELEE_SPRITE_OUT_MS = FRONTLINE_MELEE_RETURN_IDLE_MS;
export const BACKLINE_MELEE_SPRITE_IN_MS = BACKLINE_MELEE_DASH_MS;
export const BACKLINE_MELEE_SPRITE_WINDUP_MS = BACKLINE_MELEE_DASH_WINDUP_MS;
export const BACKLINE_MELEE_SPRITE_HOLD_MS = BACKLINE_MELEE_DASH_HOLD_MS;
export const BACKLINE_MELEE_SPRITE_OUT_MS = BACKLINE_MELEE_DASH_RETURN_MS;
export const RANGED_ATTACK_SPRITE_IN_MS = 180;
export const RANGED_ATTACK_SPRITE_HOLD_MS = 600;
export const RANGED_ATTACK_SPRITE_OUT_MS = FRONTLINE_RANGED_RETURN_IDLE_MS;
