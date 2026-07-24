import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import SafehouseLoadoutTab from '../../safehouse/SafehouseLoadoutTab';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { calculateGridOccupancy } from '../../../data/cargoGridEngine';
import { CARGO_GRID_CELL_COUNT } from '../../../types/cargoGrid';
import { MUTED, TERMINAL, TEXT_SECONDARY } from './loadoutTerminalUi';
import { HUB_CARD_BORDER } from '../../../theme/hubPanelSurfaces';

export function resolveCargoOccupancy(account: ReturnType<typeof usePlayerAccount>['account']) {
  const ratio = calculateGridOccupancy(account.preRunCargo);
  const occupied = Math.round(ratio * CARGO_GRID_CELL_COUNT);
  return {
    occupied,
    capacity: CARGO_GRID_CELL_COUNT,
    placedCount: account.preRunCargo.grid.placed.length,
    containmentCount: account.preRunCargo.containment.length,
  };
}

interface CargoWorkspaceProps {
  compact?: boolean;
}

export default function CargoWorkspace({ compact }: CargoWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const occupancy = useMemo(() => resolveCargoOccupancy(account), [account]);

  return (
    <View style={styles.root}>
      <View style={[styles.context, compact && styles.contextCompact]}>
        <TerminalText size={7.5} letterSpacing={1} style={styles.contextLabel}>
          BAY CAPACITY
        </TerminalText>
        <TerminalText size={11} style={styles.contextValue}>
          {`${occupancy.occupied} / ${occupancy.capacity} CELLS`}
        </TerminalText>
        <TerminalText size={7.5} style={styles.contextMeta}>
          {occupancy.placedCount === 0 && occupancy.containmentCount === 0
            ? 'NO CARGO STAGED'
            : `${occupancy.placedCount} STACK(S) · ${occupancy.containmentCount} CONTAINMENT`}
        </TerminalText>
      </View>
      <View style={styles.bay}>
        <SafehouseLoadoutTab terminalPresentation />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  context: {
    minHeight: 64,
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HUB_CARD_BORDER,
    backgroundColor: '#000000',
  },
  contextCompact: { minHeight: 54, paddingVertical: 9 },
  contextLabel: { color: MUTED, fontWeight: '700' },
  contextValue: { marginTop: 4, color: TERMINAL, fontWeight: '700', fontVariant: ['tabular-nums'] },
  contextMeta: { marginTop: 3, color: TEXT_SECONDARY, fontWeight: '700' },
  bay: { flex: 1, minHeight: 0 },
});
