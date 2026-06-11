import React from 'react';
import { StyleSheet, View } from 'react-native';
import VectorSlicePing from './VectorSlicePing';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';

/** Glowing eviscerate ping — tap to trigger, anchored above the player sprite. */
export default function CombatPlayerSliceOverlay(): React.JSX.Element | null {
  const { ui, handlersRef } = useCombatEnemyChrome();

  if (!ui.slicePingVisible) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <VectorSlicePing
        ready={ui.slicePingReady}
        disabled={ui.slicePingDisabled}
        onPress={() => handlersRef.current.onSlicePing()}
        placement="playerHud"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    bottom: '64%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 16,
    elevation: 16,
  },
});
