import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import type { EnemyPortraitGlow, EnemyIntentShimmer } from '../../utils/combatTelemetryFormat';
import CombatEnemyIntentShimmer, { enemySpriteStyles } from './CombatEnemyIntentShimmer';

const GLOW_TINT: Record<Exclude<EnemyPortraitGlow, 'none'>, string> = {
  'player-selected': '#f8fafc',
  'enemy-attacking': '#ef4444',
  'enemy-charging': '#fde68a',
};

const GLOW_SCALE: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 1.05,
  'enemy-attacking': 1.05,
  'enemy-charging': 1.09,
};

const GLOW_OPACITY: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 0.3,
  'enemy-attacking': 0.3,
  'enemy-charging': 0.38,
};

interface CombatEnemyPortraitSkiaProps {
  source: ImageSourcePropType;
  glow: EnemyPortraitGlow;
  intentShimmer?: EnemyIntentShimmer | null;
}

/** Passive portrait art — slot motion handled by CombatEnemyAnchorMotion. */
export default function CombatEnemyPortraitSkia({
  source,
  glow,
  intentShimmer = null,
}: CombatEnemyPortraitSkiaProps): React.JSX.Element {
  const glowTint = glow !== 'none' ? GLOW_TINT[glow] : null;
  const glowScale = glow !== 'none' ? GLOW_SCALE[glow] : 1.05;
  const glowOpacity = glow !== 'none' ? GLOW_OPACITY[glow] : 0.3;

  return (
    <View style={styles.root} pointerEvents="none" collapsable={false}>
      {glowTint ? (
        <View style={styles.glowDuplicate} pointerEvents="none">
          <Image
            source={source}
            resizeMode="contain"
            style={[
              enemySpriteStyles.enemySprite,
              {
                tintColor: glowTint,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
        </View>
      ) : null}
      <View style={styles.enemySpriteStack} pointerEvents="none">
        <CombatEnemyIntentShimmer kind={intentShimmer} source={source} layer="back" />
        <Image
          source={source}
          resizeMode="contain"
          style={enemySpriteStyles.enemySprite}
          nativeID="enemy-sprite"
          accessibilityLabel="enemy-sprite"
        />
        <CombatEnemyIntentShimmer kind={intentShimmer} source={source} layer="front" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  enemySpriteStack: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  glowDuplicate: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
