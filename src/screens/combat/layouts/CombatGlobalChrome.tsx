import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TERMINAL_ACCENT } from '../../../components/MacroLogCargoButton';
import { useCargoOverlay } from '../../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../../context/RunStatusOverlayContext';
import { useCombatTurnOptional } from '../../../context/CombatTurnContext';

/** Semi-transparent lower-left run controls — cargo and status above the command deck. */
export default function CombatGlobalChrome(): React.JSX.Element {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const combatTurn = useCombatTurnOptional();
  const cargoDisabled = combatTurn != null && !combatTurn.canUseCargo;

  return (
    <View style={styles.host} pointerEvents="box-none">
      {cargo?.cargoEnabled ? (
        <Pressable
          onPress={cargo.openCargo}
          disabled={cargoDisabled}
          style={({ pressed }) => [
            styles.btn,
            { opacity: cargoDisabled ? 0.35 : pressed ? 0.75 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open cargo grid"
        >
          <Text style={styles.btnText}>CARGO</Text>
        </Pressable>
      ) : null}
      {status?.statusEnabled ? (
        <Pressable
          onPress={status.openStatus}
          style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Open operative status"
        >
          <Text style={styles.btnText}>STATUS</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    bottom: '30%',
    left: 8,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'column',
    gap: 4,
    marginBottom: 6,
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(10, 10, 15, 0.55)',
  },
  btn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.45)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(10, 11, 15, 0.85)',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: TERMINAL_ACCENT,
  },
});
