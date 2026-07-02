import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import CargoPackingPanel from '../CargoPackingPanel';
import TacticalButton from '../TacticalButton';
import SafehouseTexturedPanel from './SafehouseTexturedPanel';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../../data/cargoGridEngine';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import {
  HUB_CARGO_INCURSION_CELL_MAX,
  HUB_CARGO_INCURSION_CELL_TARGET,
  resolveHubMatAwareLoadoutCellSize,
} from '../../utils/cargoGridLayout';
import { HUB_CARGO_MAT_INSET } from '../../constants/cargoGridVisual';
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
  const { scaleSpacing } = useResponsiveLayout();
  const pad = 24 * fontScale;
  const sectionGap = 12 * fontScale;
  const [gridAreaSize, setGridAreaSize] = useState({ width: 0, height: 0 });
  const extractedMass = useMemo(() => formatExtractedMass(cargo), [cargo]);

  const hubCellSize = useMemo(
    () => resolveHubMatAwareLoadoutCellSize(
      gridAreaSize.width,
      gridAreaSize.height,
      scaleSpacing,
      HUB_CARGO_INCURSION_CELL_TARGET,
      HUB_CARGO_INCURSION_CELL_MAX,
      HUB_CARGO_MAT_INSET,
    ),
    [gridAreaSize.height, gridAreaSize.width, scaleSpacing],
  );

  const handleGridAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setGridAreaSize({ width, height });
  }, []);

  return (
    <SafehouseTexturedPanel
      flex={isDesktop ? 1 : undefined}
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

      <View style={styles.gridHost} onLayout={handleGridAreaLayout}>
        <CargoPackingPanel
          cargo={cargo}
          theme={theme}
          accentColor={activeCabal}
          onRelocateItem={onRelocateItem}
          hideContinueButton
          hidePackHeader
          embedded
          compactCellSize={hubCellSize}
          cargoBackdrop
          hubCargoMatInset={HUB_CARGO_MAT_INSET}
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
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  anchorFooter: {
    flexShrink: 0,
    width: '100%',
  },
  anchorBtn: {
    width: '100%',
  },
});
