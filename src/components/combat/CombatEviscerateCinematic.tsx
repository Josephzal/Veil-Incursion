import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';
import VectorSliceOverlay from './VectorSliceOverlay';

interface CombatEviscerateCinematicProps {
  targetPortrait: ImageSourcePropType | null;
}

/** Full-screen eviscerate sequence — dim backdrop, large target portrait, scaled slashes. */
export default function CombatEviscerateCinematic({
  targetPortrait,
}: CombatEviscerateCinematicProps): React.JSX.Element | null {
  const { ui, handlersRef } = useCombatEnemyChrome();

  if (!ui.sliceVisible || !targetPortrait) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.backdrop} pointerEvents="none" />
      <View style={styles.portraitStage} pointerEvents="none">
        <Image
          source={targetPortrait}
          style={styles.portrait}
          resizeMode="contain"
        />
      </View>
      {handlersRef.current.slicePanHandlers ? (
        <VectorSliceOverlay
          visible
          variant="cinematic"
          lines={ui.sliceLines}
          activeIndex={ui.activeSliceIndex}
          panHandlers={handlersRef.current.slicePanHandlers}
          onArenaLayout={(layout) => handlersRef.current.registerSliceArena(layout)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  portraitStage: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: '8%',
    bottom: '12%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
});
