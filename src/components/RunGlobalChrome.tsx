import React from 'react';
import { StyleSheet, View } from 'react-native';
import RunFeedChromeButtons from './run/RunFeedChromeButtons';
import CargoPressurePanel from './CargoPressurePanel';
import { useTerminal } from '../context/TerminalContext';
import { useCargoOverlay } from '../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../context/RunStatusOverlayContext';
import { useRun } from '../context/RunContext';
import { hasActiveCarriedCargoEffects } from '../data/unstableCargoEffectsEngine';
import { resolveSpecialCargoStacksForIncursion } from '../data/postRunCargoRoutingRunState';

/** Floating cargo / status controls for non-combat run screens. */
export default function RunGlobalChrome(): React.JSX.Element | null {
  const { theme } = useTerminal();
  const { activeIncursion } = useRun();
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const showStatus = status?.statusEnabled ?? false;
  const showCargo = cargo?.cargoEnabled ?? false;
  const specialCargoStacks = resolveSpecialCargoStacksForIncursion(activeIncursion);
  const showCargoPressure = hasActiveCarriedCargoEffects(activeIncursion.cargo)
    || specialCargoStacks > 0;

  if (!showStatus && !showCargo && !showCargoPressure) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {showCargoPressure ? (
        <View style={styles.pressureHost}>
          <CargoPressurePanel
            cargo={activeIncursion.cargo}
            specialCargoStacks={specialCargoStacks}
            accentColor="#f59e0b"
            mutedColor={theme.mutedColor}
            compact
          />
        </View>
      ) : null}
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
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: 220,
  },
  pressureHost: {
    maxWidth: 220,
  },
});
