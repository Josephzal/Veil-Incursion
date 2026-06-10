import React from 'react';
import { StyleSheet, View } from 'react-native';
import VectorSlicePing from './VectorSlicePing';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';

/** Eviscerate ping anchored just above the operative HUD bar. */
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
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 12,
  },
});
