import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { ARENA_SPRITE_FRAME_WIDTH } from './combatEnemyBarLayout';

const TARGET_GLOW = 'rgba(251, 191, 36, 0.95)';
const HOOK_GLOW = '#a855f7';
const BLOCKED_OVERLAY = 'rgba(220, 38, 38, 0.35)';

export type CombatGridUnitView = CombatGridUnitSnapshot & {
  portraitSource: ImageSourcePropType;
};

interface CombatEnemyUnitProps {
  unit: CombatGridUnitView;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  isBackline?: boolean;
  spriteScale?: number;
}

export default function CombatEnemyUnit({
  unit,
  targetingActive,
  accentColor,
  isBackline = false,
  spriteScale = 1,
}: CombatEnemyUnitProps): React.JSX.Element {
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const fractured = unit.isFractured || fractureRatio >= 1;

  const portraitGlow = () => {
    if (unit.isSelected) return TARGET_GLOW;
    if (unit.isHookValid && targetingActive) return HOOK_GLOW;
    if (unit.isTargetable && targetingActive) return accentColor;
    if (unit.isFocused) return TARGET_GLOW;
    return undefined;
  };

  const glowColor = portraitGlow();

  return (
    <View
      style={[
        styles.root,
        isBackline ? styles.rootBackline : styles.rootFrontline,
        {
          opacity: unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.spriteFrame,
          fractured ? styles.spriteFractured : null,
          { transform: [{ scale: spriteScale }] },
        ]}
      >
        <Image
          source={unit.portraitSource}
          style={[
            styles.portrait,
            glowColor
              ? {
                  shadowColor: glowColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: unit.isSelected ? 12 : 8,
                }
              : null,
          ]}
          resizeMode="contain"
        />
      </View>

      {unit.isBlocked && targetingActive && !unit.isHookValid ? (
        <View style={styles.blockedOverlay} pointerEvents="none">
          <View style={styles.blockedStrike} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  rootFrontline: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  rootBackline: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 0,
  },
  spriteFrame: {
    width: ARENA_SPRITE_FRAME_WIDTH,
    height: '100%',
    minHeight: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  spriteFractured: {
    opacity: 0.55,
  },
  portrait: {
    width: '100%',
    height: '100%',
    minHeight: 120,
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
