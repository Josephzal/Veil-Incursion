import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../data/cargoGridEngine';
import CargoGridBoard, { CARGO_GRID_FRAME_SIZE } from './CargoGridBoard';
import type { CargoRunState } from '../types/cargoGrid';
import type { TerminalTheme } from '../types/theme';

interface CargoPackingPanelProps {
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onDiscardItem?: (instanceId: string) => boolean;
  runCredits?: number;
  onContinue: () => void;
  continueLabel?: string;
}

export default function CargoPackingPanel({
  cargo,
  theme,
  accentColor,
  onRelocateItem,
  onDiscardItem,
  runCredits,
  onContinue,
  continueLabel = '[ CONTINUE ]',
}: CargoPackingPanelProps): React.JSX.Element {
  const occupancy = calculateGridOccupancy(cargo);
  const occupancyPct = Math.round(occupancy * 100);
  const cargoValue = calculateCargoMarketValue(cargo);
  const accent = accentColor ?? '#00ff33';

  return (
    <View style={styles.root}>
      <View style={styles.boardColumn}>
        <View style={[styles.headerContainer, { borderColor: theme.borderColor, width: CARGO_GRID_FRAME_SIZE }]}>
          <Text style={[styles.headerLabel, { color: theme.mutedColor }]}>
            Cargo Grid // Pack Extracted Resources
          </Text>
          <Text style={[styles.statsLine, { color: theme.primaryColor }]}>
            {`OCCUPANCY ${occupancyPct}% // VALUE ${cargoValue}`}
          </Text>
        </View>
        <CargoGridBoard
        cargo={cargo}
        theme={theme}
        accentColor={accentColor}
        onRelocateItem={onRelocateItem}
        onDiscardItem={onDiscardItem}
        runCredits={runCredits}
        onContinue={onContinue}
        continueLabel={continueLabel}
        minimal
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  boardColumn: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: CARGO_GRID_FRAME_SIZE + 32,
  },
  headerContainer: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0a0b0f',
  },
  headerLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 6,
  },
  statsLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 4,
  },
  statsHint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 11,
  },
  statsWarn: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 11,
    marginTop: 4,
  },
});
