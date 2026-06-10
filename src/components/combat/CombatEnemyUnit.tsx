import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot, EnemyPortraitGlow } from '../../utils/combatTelemetryFormat';
import { ARENA_SPRITE_FRAME_WIDTH } from './combatEnemyBarLayout';

const HOOK_GLOW = '#a855f7';
const TARGET_ACCENT = 'rgba(0, 255, 51, 0.9)';
const BLOCKED_OVERLAY = 'rgba(220, 38, 38, 0.35)';
const WHITE_GLOW = '#f8fafc';
const RED_GLOW = '#ef4444';

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
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');

  const targetingAccent = () => {
    if (portraitGlow !== 'none') return undefined;
    if (unit.isHookValid && targetingActive) return HOOK_GLOW;
    if (unit.isTargetable && targetingActive) return accentColor;
    if (unit.isFocused && targetingActive) return TARGET_ACCENT;
    return undefined;
  };

  const accentColor2 = targetingAccent();
  const glowShadow = portraitGlow === 'player-selected'
    ? styles.whitePortraitShadow
    : portraitGlow === 'enemy-attacking'
      ? styles.redPortraitShadow
      : null;

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
        <View style={[styles.portraitAnchor, glowShadow]} pointerEvents="none">
          {portraitGlow !== 'none' ? (
            <Image
              source={unit.portraitSource}
              style={[
                styles.bloomWide,
                portraitGlow === 'player-selected' ? styles.whiteBloom : styles.redBloom,
              ]}
              resizeMode="contain"
            />
          ) : null}
          {portraitGlow !== 'none' ? (
            <Image
              source={unit.portraitSource}
              style={[
                styles.bloomTight,
                portraitGlow === 'player-selected' ? styles.whiteBloomTight : styles.redBloomTight,
              ]}
              resizeMode="contain"
            />
          ) : null}
          <Image
            source={unit.portraitSource}
            style={[
              styles.portrait,
              accentColor2
                ? {
                    shadowColor: accentColor2,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.85,
                    shadowRadius: 8,
                  }
                : null,
            ]}
            resizeMode="contain"
          />
        </View>
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
    position: 'relative',
  },
  portraitAnchor: {
    position: 'absolute',
    bottom: 0,
    width: '74%',
    height: '88%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  whitePortraitShadow: {
    shadowColor: WHITE_GLOW,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 20,
    elevation: 14,
  },
  redPortraitShadow: {
    shadowColor: RED_GLOW,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 20,
    elevation: 14,
  },
  bloomWide: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.14 }],
  },
  bloomTight: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.06 }],
  },
  whiteBloom: {
    opacity: 0.28,
  },
  whiteBloomTight: {
    opacity: 0.42,
  },
  redBloom: {
    opacity: 0.3,
  },
  redBloomTight: {
    opacity: 0.48,
  },
  spriteFractured: {
    opacity: 0.55,
  },
  portrait: {
    width: '100%',
    height: '100%',
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
