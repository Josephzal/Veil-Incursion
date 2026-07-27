import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import CargoPackingPanel from '../CargoPackingPanel';
import { useTerminal } from '../../context/TerminalContext';
import { useRun } from '../../context/RunContext';
import type { CargoItemId } from '../../types/cargoGrid';
import {
  resolveHubLoadoutCellSize,
  HUB_CARGO_INCURSION_CELL_MAX,
  HUB_CARGO_INCURSION_CELL_TARGET,
} from '../../utils/cargoGridLayout';

interface RunIncursionCargoPanelProps {
  accentColor: string;
  externalHover?: { itemId: CargoItemId; row: number; col: number } | null;
  selectedPlacementItemId?: CargoItemId | null;
  onPlaceAtCell?: (row: number, col: number) => void;
  onGridMetricsMeasured?: (metrics: {
    pageX: number;
    pageY: number;
    width: number;
    height: number;
    cellSize: number;
    cellGap: number;
  }) => void;
  onCellSizeResolved?: (cellSize: number) => void;
  onHubExternalDrop?: (
    source: import('../CargoGridBoard').CargoDragSource,
    absoluteX: number,
    absoluteY: number,
  ) => boolean;
  onDragPositionChange?: (
    payload: { source: import('../CargoGridBoard').CargoDragSource; x: number; y: number } | null,
  ) => void;
}

export default function RunIncursionCargoPanel({
  accentColor,
  externalHover = null,
  selectedPlacementItemId = null,
  onPlaceAtCell,
  onGridMetricsMeasured,
  onCellSizeResolved,
  onHubExternalDrop,
  onDragPositionChange,
}: RunIncursionCargoPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { activeIncursion, relocateCargoItem, replaceCargoItem } = useRun();
  const [cargoAreaSize, setCargoAreaSize] = useState({ width: 0, height: 0 });

  const cellSize = useMemo(
    () => resolveHubLoadoutCellSize(
      cargoAreaSize.width,
      cargoAreaSize.height,
      HUB_CARGO_INCURSION_CELL_TARGET,
      HUB_CARGO_INCURSION_CELL_MAX,
    ),
    [cargoAreaSize.height, cargoAreaSize.width],
  );

  React.useEffect(() => {
    onCellSizeResolved?.(cellSize);
  }, [cellSize, onCellSizeResolved]);

  const handleCargoAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCargoAreaSize({ width, height });
  }, []);

  return (
    <View style={styles.root} onLayout={handleCargoAreaLayout}>
      <CargoPackingPanel
        cargo={activeIncursion.cargo}
        theme={theme}
        accentColor={accentColor}
        onRelocateItem={relocateCargoItem}
        onReplaceItem={replaceCargoItem}
        hideContinueButton
        hidePackHeader
        embedded
        compactCellSize={cellSize}
        externalHover={externalHover}
        selectedPlacementItemId={selectedPlacementItemId}
        onPlaceAtCell={onPlaceAtCell}
        onGridMetricsMeasured={onGridMetricsMeasured}
        onHubExternalDrop={onHubExternalDrop}
        onDragPositionChange={onDragPositionChange}
        cargoBackdrop={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
