import React from 'react';
import { StyleSheet, View } from 'react-native';
import PersistentTerminalLog from '../../../components/PersistentTerminalLog';
import { useCargoOverlay } from '../../../context/CargoOverlayContext';
import { useCombatTurnOptional } from '../../../context/CombatTurnContext';
import { useRunStatusOverlay } from '../../../context/RunStatusOverlayContext';

/** Macro log column — cargo/status controls inline in the terminal header. */
export default function CombatDashboardMacroLog(): React.JSX.Element {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const combatTurn = useCombatTurnOptional();
  const cargoDisabled = combatTurn != null && !combatTurn.canUseCargo;

  return (
    <View style={styles.host}>
      <PersistentTerminalLog
        visible
        fillRemaining={false}
        docked={false}
        showCargo={false}
        cargoDisabled={cargoDisabled}
        onCargoPress={cargo?.openCargo}
        showStatus={false}
        onStatusPress={status?.openStatus}
        hideTopBorder
        hideHeader
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 36,
    maxHeight: 120,
    width: '100%',
  },
});
