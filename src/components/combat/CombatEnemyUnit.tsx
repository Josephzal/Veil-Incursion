import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { ARENA_SPRITE_FRAME_WIDTH } from './combatEnemyBarLayout';
import CombatEnemyPortraitSkia from './CombatEnemyPortraitSkia';

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
  isBackline = false,
  spriteScale = 1,
}: CombatEnemyUnitProps): React.JSX.Element {
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const fractured = unit.isFractured || fractureRatio >= 1;
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');

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
        <View style={styles.portraitAnchor} pointerEvents="none">
          <CombatEnemyPortraitSkia
            source={unit.portraitSource}
            glow={portraitGlow}
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
    justifyContent: 'flex-end',
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
    width: '88%',
    height: '94%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
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
