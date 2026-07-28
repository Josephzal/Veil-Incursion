import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import CargoPackingPanel from '../CargoPackingPanel';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import FieldPlate from '../runField/FieldPlate';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../../data/cargoGridEngine';
import {
  BLACK_MARKET_CARGO_CELL_SIZE,
  resolveUniformIncursionCargoCellSize,
} from '../../utils/cargoGridLayout';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import type { CargoRunState } from '../../types/cargoGrid';
import type { TerminalTheme } from '../../types/theme';

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

/**
 * Safehouse cargo column — FieldPlate chrome + cell sizing match Black Market CARGO DECK.
 */
export default function SafehousePayloadRouter({
  cargo,
  theme,
  activeCabal,
  fontScale,
  isDesktop,
  onRelocateItem,
  onBankCargo,
}: SafehousePayloadRouterProps): React.JSX.Element {
  const panelPad = 14 * fontScale;
  const actionGap = 10 * fontScale;
  const dossierMeta = 8 * fontScale;
  const section = 9 * fontScale;
  const extractedMass = useMemo(() => formatExtractedMass(cargo), [cargo]);
  const [cargoAreaSize, setCargoAreaSize] = useState({ width: 0, height: 0 });

  const cellSize = useMemo(
    () => (cargoAreaSize.width > 0 && cargoAreaSize.height > 0
      ? resolveUniformIncursionCargoCellSize(cargoAreaSize.width, cargoAreaSize.height)
      : BLACK_MARKET_CARGO_CELL_SIZE),
    [cargoAreaSize.height, cargoAreaSize.width],
  );

  const handleCargoAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCargoAreaSize({ width, height });
  }, []);

  return (
    <FieldPlate
      density="standard"
      tone="neutral"
      brackets
      style={[styles.panel, isDesktop ? styles.sidePanel : null]}
      contentStyle={[styles.panelContent, { gap: actionGap, padding: panelPad }]}
    >
      <View style={styles.headerBlock}>
        <Text
          style={[
            styles.eyebrow,
            { color: RUN_FIELD.mint, fontSize: dossierMeta, lineHeight: dossierMeta * 1.35 },
          ]}
        >
          HOLD // STAGED PAYLOAD
        </Text>
        <Text
          style={[
            styles.sectionLabel,
            {
              color: RUN_FIELD.textSecondary,
              fontSize: section,
              lineHeight: section * 1.4,
            },
          ]}
        >
          CARGO DECK
        </Text>
        <Text
          style={[
            styles.meta,
            {
              color: RUN_FIELD.textSecondary,
              fontSize: dossierMeta,
              lineHeight: dossierMeta * 1.35,
            },
          ]}
        >
          {`EXTRACTED MASS // ${extractedMass}`}
        </Text>
      </View>

      <View style={styles.gridHost} onLayout={handleCargoAreaLayout}>
        <CargoPackingPanel
          cargo={cargo}
          theme={theme}
          accentColor={activeCabal}
          onRelocateItem={onRelocateItem}
          hideContinueButton
          hidePackHeader
          embedded
          compactCellSize={cellSize}
          cargoBackdrop={false}
        />
      </View>

      <View style={styles.anchorFooter}>
        <HubPrimaryCta
          label="ANCHOR PAYLOAD"
          onPress={onBankCargo}
          variant="glow"
          accessibilityLabel="Anchor payload"
          minHeight={48}
          style={styles.anchorCta}
        />
      </View>
    </FieldPlate>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  sidePanel: {
    flex: 1.15,
    minWidth: 280,
    maxWidth: 520,
    flexGrow: 0,
    flexShrink: 0,
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
  },
  headerBlock: {
    flexShrink: 0,
    gap: 6,
  },
  eyebrow: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
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
  },
  anchorFooter: {
    flexShrink: 0,
    width: '100%',
    alignItems: 'center',
    paddingTop: 8,
  },
  anchorCta: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 300,
  },
});
