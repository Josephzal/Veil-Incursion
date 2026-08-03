import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';

interface CombatEviscerateCinematicProps {
  targetPortrait: ImageSourcePropType | null;
}

/**
 * ABYSSAL VERDICT slice-minigame backdrop while VectorSliceOverlay runs.
 * The post-commit pose cinematic is AbyssalVerdictCinematic.
 * Portrait is optional — never gate the ultimate on portrait availability.
 */
export default function CombatEviscerateCinematic({
  targetPortrait,
}: CombatEviscerateCinematicProps): React.JSX.Element | null {
  const { ui } = useCombatEnemyChrome();

  if (!ui.sliceVisible) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.backdrop} />
      {targetPortrait ? (
        <View style={styles.portraitStage}>
          <Image
            source={targetPortrait}
            style={styles.portrait}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  portraitStage: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: '8%',
    bottom: '12%',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.55,
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
});
