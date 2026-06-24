import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { TERMINAL_ACCENT } from './MacroLogCargoButton';
import { useCargoOverlay } from '../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../context/RunStatusOverlayContext';

/** Floating cargo / status controls for non-combat run screens. */
export default function RunGlobalChrome(): React.JSX.Element {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();

  return (
    <View style={styles.host} pointerEvents="box-none">
      {status?.statusEnabled ? (
        <HapticPressable
          onPress={status.openStatus}
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Open operative status"
        >
          <Text style={styles.btnText}>STATUS</Text>
        </HapticPressable>
      ) : null}
      {cargo?.cargoEnabled ? (
        <HapticPressable
          onPress={cargo.openCargo}
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Open cargo grid"
        >
          <Text style={styles.btnText}>CARGO</Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'row',
    gap: 4,
  },
  btn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.45)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(10, 11, 15, 0.72)',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: TERMINAL_ACCENT,
  },
});
