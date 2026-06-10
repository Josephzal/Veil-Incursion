import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import VectorSlicePing from './VectorSlicePing';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';

const EVISCERATE_ACCENT = '#ff1744';

/** Eviscerate ultimate — anchored just above the operative HUD bar. */
export default function CombatPlayerSliceOverlay(): React.JSX.Element | null {
  const { ui, handlersRef } = useCombatEnemyChrome();

  if (!ui.slicePingVisible) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <Pressable
        onPress={() => handlersRef.current.onSlicePing()}
        disabled={ui.slicePingDisabled || !ui.slicePingReady}
        style={({ pressed }) => [
          styles.eviscerateBtn,
          { opacity: pressed ? 0.82 : 1 },
        ]}
        accessibilityLabel="Eviscerate ready"
      >
        <VectorSlicePing
          ready={ui.slicePingReady}
          disabled={ui.slicePingDisabled}
          onPress={() => handlersRef.current.onSlicePing()}
          placement="playerHud"
        />
        <Text style={styles.label}>[ EVISCERATE ]</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 12,
  },
  eviscerateBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 23, 68, 0.45)',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: EVISCERATE_ACCENT,
    marginTop: 2,
  },
});
