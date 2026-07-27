import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CargoPackingPanel from '../CargoPackingPanel';
import TacticalButton from '../TacticalButton';
import SafehouseTexturedPanel from './SafehouseTexturedPanel';
import { cargoGridFrameDimensions } from '../CargoGridBoard';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../../data/cargoGridEngine';
import { INCURSION_CARGO_CELL_SIZE } from '../../utils/cargoGridLayout';
import type { CargoRunState } from '../../types/cargoGrid';
import type { TerminalTheme } from '../../types/theme';

const MUTED_SLATE = '#94A3B8';

interface SafehousePayloadRouterProps {
  cargo: CargoRunState;
  theme: TerminalTheme;
  activeCabal: string;
  fontScale: number;
  isDesktop: boolean;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onBankCargo: () => void;
}

function formatExtractedMass(cargo: CargoRunState): string {
  const occupancy = calculateGridOccupancy(cargo);
  const valueMass = calculateCargoMarketValue(cargo) / 10;
  const mass = Math.max(occupancy * 9.9, valueMass);
  return `${mass.toFixed(1)}v`;
}

export default function SafehousePayloadRouter({
  cargo,
  theme,
  activeCabal,
  fontScale,
  isDesktop,
  onRelocateItem,
  onBankCargo,
}: SafehousePayloadRouterProps): React.JSX.Element {
  const pad = 18 * fontScale;
  const sectionGap = 10 * fontScale;
  const extractedMass = useMemo(() => formatExtractedMass(cargo), [cargo]);

  const panelMetrics = useMemo(() => {
    const frame = cargoGridFrameDimensions(INCURSION_CARGO_CELL_SIZE);
    const contentWidth = frame.frameWidth;
    const minPanelWidth = Math.ceil(contentWidth + pad * 2);
    return {
      cellSize: INCURSION_CARGO_CELL_SIZE,
      minPanelWidth,
      preferredPanelWidth: Math.max(minPanelWidth, Math.round(340 * fontScale)),
    };
  }, [fontScale, pad]);

  return (
    <SafehouseTexturedPanel
      flex={isDesktop ? 1.15 : undefined}
      style={isDesktop ? [
        styles.sidePanel,
        {
          minWidth: panelMetrics.minPanelWidth,
          maxWidth: panelMetrics.preferredPanelWidth,
        },
      ] : undefined}
      padding={pad}
      contentStyle={[styles.content, { gap: sectionGap }]}
    >
      <View style={[styles.headerBlock, { gap: 6 * fontScale }]}>
        <Text style={[styles.header, { fontSize: 8 * fontScale, color: MUTED_SLATE, letterSpacing: 1.5 }]}>
          [ PAYLOAD ROUTER ]
        </Text>
        <Text style={[styles.meta, { fontSize: 7 * fontScale, color: MUTED_SLATE }]}>
          {`EXTRACTED MASS // ${extractedMass}`}
        </Text>
      </View>

      <View style={styles.gridHost}>
        <CargoPackingPanel
          cargo={cargo}
          theme={theme}
          accentColor={activeCabal}
          onRelocateItem={onRelocateItem}
          hideContinueButton
          hidePackHeader
          embedded
          compactCellSize={panelMetrics.cellSize}
        />
      </View>

      <View style={[styles.anchorFooter, { paddingTop: 4 * fontScale }]}>
        <TacticalButton
          label="[ ANCHOR PAYLOAD ]"
          active
          onPress={onBankCargo}
          accentColor={activeCabal}
          mutedColor={MUTED_SLATE}
          variant="cta"
          style={[
            styles.anchorBtn,
            {
              borderColor: activeCabal,
              borderWidth: 2,
            },
          ]}
        />
      </View>
    </SafehouseTexturedPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    minHeight: 0,
  },
  headerBlock: {
    flexShrink: 0,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  meta: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  gridHost: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorFooter: {
    flexShrink: 0,
    width: '100%',
  },
  anchorBtn: {
    width: '100%',
  },
  sidePanel: {
    flexGrow: 0,
    flexShrink: 0,
  },
});
