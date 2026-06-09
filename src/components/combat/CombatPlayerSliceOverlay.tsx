import React from 'react';
import { StyleSheet, View } from 'react-native';
import VectorSlicePing from './VectorSlicePing';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';

/** Eviscerate ping anchored above the player operative HUD column. */
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
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 4,
    minHeight: 44,
    zIndex: 8,
  },
});
