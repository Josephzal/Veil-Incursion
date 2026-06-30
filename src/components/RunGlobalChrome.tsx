import React from 'react';
import { StyleSheet, View } from 'react-native';
import RunFeedChromeButtons from './run/RunFeedChromeButtons';
import { useTerminal } from '../context/TerminalContext';
import { useCargoOverlay } from '../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../context/RunStatusOverlayContext';

/** Floating cargo / status controls for non-combat run screens. */
export default function RunGlobalChrome(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const showStatus = status?.statusEnabled ?? false;
  const showCargo = cargo?.cargoEnabled ?? false;

  if (!showStatus && !showCargo) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <RunFeedChromeButtons
        accent={theme.statusColor}
        mutedColor={theme.mutedColor}
      />
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
  },
});
