import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { laneForSlot } from '../../types/combatGrid';
import {
  ARENA_ENEMY_SPRITE_HEIGHT_SHARE,
  ARENA_SPRITE_FRAME_WIDTH,
  BACKLINE_HITBOX,
  ENEMY_HITBOX_DEBUG,
  FRONTLINE_HITBOX,
} from './combatEnemyBarLayout';
import CombatEnemyPortraitSkia from './CombatEnemyPortraitSkia';

const BLOCKED_OVERLAY = 'rgba(220, 38, 38, 0.35)';
const HITBOX_DEBUG_FILL = 'rgba(255, 0, 0, 0)';

export type CombatGridUnitView = CombatGridUnitSnapshot & {
  portraitSource: ImageSourcePropType;
};

interface CombatEnemyUnitProps {
  unit: CombatGridUnitView;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  /** Arena grid: cap sprite height to match player footprint. */
  constrainSpriteHeight?: boolean;
  onPress?: () => void;
}

export default function CombatEnemyUnit({
  unit,
  targetingActive,
  constrainSpriteHeight = false,
  onPress,
}: CombatEnemyUnitProps): React.JSX.Element {
  const spriteHeightShare =
    `${Math.round(ARENA_ENEMY_SPRITE_HEIGHT_SHARE * 100)}%` as `${number}%`;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const fractured = unit.isFractured || fractureRatio >= 1;
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');
  const isBackline = laneForSlot(unit.slot) === 'BACKLINE';
  const hitboxLayout = isBackline ? BACKLINE_HITBOX : FRONTLINE_HITBOX;

  return (
    <View
      style={[
        styles.imageShell,
        constrainSpriteHeight ? styles.imageShellArena : styles.imageShellCompact,
        constrainSpriteHeight ? { height: spriteHeightShare, maxHeight: spriteHeightShare } : null,
        fractured ? styles.spriteFractured : null,
        {
          opacity: unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.portraitLayer} pointerEvents="none">
        <CombatEnemyPortraitSkia
          source={unit.portraitSource}
          glow={portraitGlow}
          anim={unit.portraitAnim ?? 'none'}
        />
      </View>

      {onPress ? (
        <Pressable
          onPress={onPress}
          style={[
            styles.hitbox,
            {
              width: hitboxLayout.width,
              height: hitboxLayout.height,
            },
            'bottom' in hitboxLayout
              ? { bottom: hitboxLayout.bottom }
              : { top: hitboxLayout.top },
            ENEMY_HITBOX_DEBUG ? styles.hitboxDebug : null,
          ]}
          pointerEvents="auto"
        />
      ) : null}

      {unit.isBlocked && targetingActive && !unit.isHookValid ? (
        <View style={styles.blockedOverlay} pointerEvents="none">
          <View style={styles.blockedStrike} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  imageShell: {
    width: ARENA_SPRITE_FRAME_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  imageShellArena: {
    minHeight: 0,
  },
  imageShellCompact: {
    minHeight: 88,
    flexGrow: 1,
    flexShrink: 1,
  },
  portraitLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  hitbox: {
    position: 'absolute',
    zIndex: 10,
    alignSelf: 'center',
  },
  hitboxDebug: {
    backgroundColor: HITBOX_DEBUG_FILL,
  },
  spriteFractured: {
    opacity: 0.55,
  },
  blockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  blockedStrike: {
    position: 'absolute',
    width: '120%',
    height: 2,
    backgroundColor: BLOCKED_OVERLAY,
    transform: [{ rotate: '-35deg' }],
  },
});
