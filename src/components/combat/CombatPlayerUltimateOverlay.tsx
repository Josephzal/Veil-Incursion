import React from 'react';
import { StyleSheet, View } from 'react-native';
import CombatMasteryProgress from './CombatMasteryProgress';
import UltimateReadyPing from './UltimateReadyPing';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';

/** Mastery pips + ultimate ping directly above the player stat bar. */
export default function CombatPlayerUltimateOverlay(): React.JSX.Element | null {
  const { ui, handlersRef } = useCombatEnemyChrome();

  const showProgress = ui.masteryProgressVisible && !ui.ultimatePingVisible;
  const showPing = ui.ultimatePingVisible && ui.ultimatePingVariant;

  if (!showProgress && !showPing) return null;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {showProgress ? (
        <CombatMasteryProgress
          current={ui.masteryProgressCurrent}
          required={ui.masteryProgressRequired}
          accent={ui.masteryProgressAccent}
        />
      ) : null}
      {showPing ? (
        <UltimateReadyPing
          ready={ui.ultimatePingReady}
          disabled={ui.ultimatePingDisabled}
          variant={ui.ultimatePingVariant!}
          onPress={() => handlersRef.current.onUltimatePing()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 16,
    elevation: 16,
  },
});
