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
        fillRemaining
        docked={false}
        showCargo={cargo?.cargoEnabled ?? false}
        cargoDisabled={cargoDisabled}
        onCargoPress={cargo?.openCargo}
        showStatus={status?.statusEnabled ?? false}
        onStatusPress={status?.openStatus}
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
