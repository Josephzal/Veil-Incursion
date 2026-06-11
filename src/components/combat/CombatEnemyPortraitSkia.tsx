import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import type { EnemyPortraitGlow } from '../../utils/combatTelemetryFormat';

const GLOW_TINT: Record<Exclude<EnemyPortraitGlow, 'none'>, string> = {
  'player-selected': '#f8fadc',
  'enemy-attacking': '#ef4444',
};

interface CombatEnemyPortraitSkiaProps {
  source: ImageSourcePropType;
  glow: EnemyPortraitGlow;
}

/** Silhouette glow via duplicate tinted Image behind the main portrait. */
export default function CombatEnemyPortraitSkia({
  source,
  glow,
}: CombatEnemyPortraitSkiaProps): React.JSX.Element {
  const glowTint = glow !== 'none' ? GLOW_TINT[glow] : null;

  return (
    <View style={styles.root} collapsable={false}>
      {glowTint ? (
        <Image
          source={source}
          resizeMode="contain"
          style={[styles.portrait, styles.glowDuplicate, { tintColor: glowTint }]}
        />
      ) : null}
      <Image
        source={source}
        resizeMode="contain"
        style={styles.portrait}
      />
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
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  glowDuplicate: {
    position: 'absolute',
    opacity: 0.3,
    transform: [{ scale: 1.05 }],
  },
});
