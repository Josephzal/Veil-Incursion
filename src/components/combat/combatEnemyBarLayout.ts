import { Dimensions } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { ALL_GRID_SLOTS, laneForSlot } from '../../types/combatGrid';

const ARENA_HORIZONTAL_INSET = 16;

/** Arena column split — enemy grid uses the wider share, shifted toward center. */
export const ARENA_PLAYER_COLUMN_FLEX = 2;
export const ARENA_ENEMY_COLUMN_FLEX = 3;
export const ARENA_ENEMY_COLUMN_RATIO =
  ARENA_ENEMY_COLUMN_FLEX / (ARENA_PLAYER_COLUMN_FLEX + ARENA_ENEMY_COLUMN_FLEX);
/** Pull enemy grid away from the right screen edge (horizontal only). */
export const ARENA_ENEMY_GRID_INSET_RIGHT = 44;

/** Matches CombatArenaStage playerSpriteSlot height (% of enemy column). */
export const ARENA_SPRITE_HEIGHT = '27%';
export const ARENA_SPRITE_BOTTOM = '20%';
export const ARENA_STAGE_PADDING_BOTTOM = 20;

/** Toggle red hitbox overlay — set false once overlap is verified. */
export const ENEMY_HITBOX_DEBUG = false;

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

export const FRONTLINE_SLOTS: readonly CombatGridSlotId[] = ['FL_0', 'FL_1'];
export const BACKLINE_SLOTS: readonly CombatGridSlotId[] = ['BL_0', 'BL_1'];

export interface EnemySlotPresentation {
  unitScale: number;
  zIndex: number;
}

export const FRONTLINE_UNIT_SCALE = 1.1;
export const SOLO_UNIT_SCALE = .85;
/** Lift hostiles upward as a share of battlefield height. */
export const FRONTLINE_BATTLEFIELD_LIFT_RATIO = 0.07;
export const SOLO_BATTLEFIELD_LIFT_RATIO = 0.1;
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
): EnemySlotPresentation {
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

/** Estimated slot centers for attack dash math — mirrors flex row + wrapper layout. */
export function estimateSlotAnchorFraction(
  slot: CombatGridSlotId,
  layoutMode: ArenaLayoutMode,
): SlotAnchorFraction {
  if (layoutMode === 'solo') {
    return { x: 0.5, y: 0.66, footY: 0.82 };
  }

  const isBackline = laneForSlot(slot) === 'BACKLINE';
  const isLeft = slot.endsWith('_0');
  const x = isLeft ? 0.28 : 0.72;
  const y = isBackline ? 0.34 : 0.68;
  const footY = isBackline ? 0.48 : 0.84;
  return { x, y, footY };
}

/** Intel panel gauge track — spans the enemy-column overlay width. */
export function arenaIntelGaugeTrackWidth(screenWidth = Dimensions.get('window').width): number {
  const enemyColumnWidth = screenWidth * ARENA_ENEMY_COLUMN_RATIO;
  return Math.max(120, Math.floor(enemyColumnWidth - 24));
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
): { x: number; y: number } {
  const effectiveSlot = layoutMode === 'solo' ? SOLO_ARENA_SLOT : slot;
  const anchor = estimateSlotAnchorFraction(effectiveSlot, layoutMode);
  const slotCenterX = arenaWidth * anchor.x;
  const slotFootY = arenaHeight * anchor.footY;

  const playerFootY = arenaHeight * (1 - Number.parseFloat(ARENA_SPRITE_BOTTOM) / 100);
  const x = -(slotCenterX + arenaWidth * 0.42);
  const y = Math.max(16, playerFootY - slotFootY);

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
  const anchor = estimateSlotAnchorFraction(effectiveSlot, layoutMode);
  const enemyColumnWidth = arenaWidth * 0.5;
  const enemyColumnLeft = arenaWidth * 0.5;
  const slotCenterX = enemyColumnLeft + enemyColumnWidth * anchor.x;

  const playerColumnWidth = arenaWidth * 0.5;
  const playerAnchorX = playerColumnWidth * 0.58;
  const rawGap = slotCenterX - playerAnchorX;
  const x = Math.round(Math.min(88, Math.max(28, rawGap * 0.42)));

  const playerFootY = arenaHeight * 0.98;
  const slotTorsoY = arenaHeight * (laneForSlot(effectiveSlot) === 'BACKLINE' ? anchor.y + 0.08 : anchor.y + 0.06);
  const y = Math.round(Math.min(0, Math.max(-32, (slotTorsoY - playerFootY) * 0.3)));

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
