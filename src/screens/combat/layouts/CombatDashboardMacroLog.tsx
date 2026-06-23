import React from 'react';
import { StyleSheet, View } from 'react-native';
import PersistentTerminalLog from '../../../components/PersistentTerminalLog';

/** Macro log column for the tactical dashboard — no cargo/status buttons (global chrome). */
export default function CombatDashboardMacroLog(): React.JSX.Element {
  return (
    <View style={styles.host}>
      <PersistentTerminalLog
        visible
        fillRemaining
        docked={false}
        showCargo={false}
        showStatus={false}
        hideTopBorder
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
