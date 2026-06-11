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
}

export default function CombatEnemyUnit({
  unit,
  targetingActive,
}: CombatEnemyUnitProps): React.JSX.Element {
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const fractured = unit.isFractured || fractureRatio >= 1;
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');

  return (
    <View
      style={[
        styles.imageRoot,
        fractured ? styles.spriteFractured : null,
        {
          opacity: unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.portraitAnchor} pointerEvents="none">
        <CombatEnemyPortraitSkia
          source={unit.portraitSource}
          glow={portraitGlow}
          anim={unit.portraitAnim ?? 'none'}
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
  imageRoot: {
    width: ARENA_SPRITE_FRAME_WIDTH,
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  portraitAnchor: {
    width: '100%',
    height: '100%',
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
