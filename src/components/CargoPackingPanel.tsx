import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import HapticPressable from './HapticPressable';
import {
  GRID_CANISTER_GAP,
  harvestGridFrameHeight,
  resolveHarvestCellSize,
  resolveHarvestSidecarWidth,
} from '../constants/harvestLayout';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../data/cargoGridEngine';
import CargoGridBoard, {
  CARGO_CELL_SIZE,
  CARGO_GRID_FRAME_HEIGHT,
  CARGO_GRID_FRAME_SIZE,
  CARGO_GRID_FRAME_WIDTH,
  cargoGridFrameDimensions,
  type CargoDragSource,
} from './CargoGridBoard';
import type { CargoRunState } from '../types/cargoGrid';
import type { TerminalTheme } from '../types/theme';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';

interface CargoPackingPanelProps {
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onDiscardItem?: (instanceId: string) => boolean;
  runCredits?: number;
  showCreditsHud?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
  hideContinueButton?: boolean;
  onContainmentItemCenterMeasured?: (instanceId: string, center: { x: number; y: number }) => void;
  onHarvestFloorMeasured?: (rect: { x: number; y: number; width: number; height: number }) => void;
  fixedExternalSlotCount?: number;
  resolveContainmentSlotIndex?: (instanceId: string) => number | undefined;
  /** Harvest screen: grid centered on screen, sidecar anchored to cell grid. */
  harvestLayout?: boolean;
  gridSidecar?: React.ReactNode;
  externalHover?: { itemId: import('../types/cargoGrid').CargoItemId; row: number; col: number } | null;
  selectedPlacementItemId?: import('../types/cargoGrid').CargoItemId | null;
  onPlaceAtCell?: (row: number, col: number) => void;
  onGridMetricsMeasured?: (metrics: {
    pageX: number;
    pageY: number;
    width: number;
    height: number;
    cellSize: number;
    cellGap: number;
  }) => void;
  packHeaderLabel?: string;
  /** Hub loadout: skip bordered header — parent renders stats. */
  hidePackHeader?: boolean;
  /** Hub loadout: no flex expansion, compact padding. */
  embedded?: boolean;
  /** Hub loadout: smaller cargo cells. */
  compactCellSize?: number;
  stableExternalBay?: boolean;
  onHubExternalDrop?: (
    source: CargoDragSource,
    absoluteX: number,
    absoluteY: number,
  ) => boolean;
  onDragPositionChange?: (payload: { source: CargoDragSource; x: number; y: number } | null) => void;
}

export default function CargoPackingPanel({
  cargo,
  theme,
  accentColor,
  onRelocateItem,
  onDiscardItem,
  runCredits,
  showCreditsHud = false,
  onContinue,
  continueLabel = '[ CONTINUE ]',
  hideContinueButton = false,
  onContainmentItemCenterMeasured,
  harvestLayout = false,
  gridSidecar,
  onHarvestFloorMeasured,
  fixedExternalSlotCount,
  resolveContainmentSlotIndex,
  externalHover,
  selectedPlacementItemId,
  onPlaceAtCell,
  onGridMetricsMeasured,
  packHeaderLabel = 'Cargo Grid // Pack Extracted Resources',
  hidePackHeader = false,
  embedded = false,
  compactCellSize,
  stableExternalBay = false,
  onHubExternalDrop,
  onDragPositionChange,
}: CargoPackingPanelProps): React.JSX.Element {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { safeBottom } = useLandscapeMetrics();
  const harvestSidecarWidth = useMemo(
    () => (harvestLayout ? resolveHarvestSidecarWidth(screenWidth) : 0),
    [harvestLayout, screenWidth],
  );

  const cellSize = useMemo(() => {
    if (compactCellSize != null) return compactCellSize;
    if (harvestLayout) return resolveHarvestCellSize(screenHeight, safeBottom);
    return CARGO_CELL_SIZE;
  }, [compactCellSize, harvestLayout, safeBottom, screenHeight]);
  const harvestGridHeight = harvestLayout ? harvestGridFrameHeight(cellSize) : CARGO_GRID_FRAME_HEIGHT;
  const frame = useMemo(() => cargoGridFrameDimensions(cellSize), [cellSize]);

  const occupancy = calculateGridOccupancy(cargo);
  const occupancyPct = Math.round(occupancy * 100);
  const cargoValue = calculateCargoMarketValue(cargo);
  const accent = accentColor ?? '#00ff33';

  return (
    <View style={[
      styles.root,
      harvestLayout ? styles.rootHarvest : null,
      embedded ? styles.rootEmbedded : null,
    ]}>
      <View style={[
        styles.boardColumn,
        harvestLayout ? styles.boardColumnHarvest : null,
        embedded ? styles.boardColumnEmbedded : null,
      ]}>
        {!hidePackHeader ? (
          <View style={[styles.headerContainer, harvestLayout ? styles.headerContainerHarvest : null, { borderColor: theme.borderColor, width: frame.frameWidth }]}>
            <Text style={[styles.headerLabel, { color: theme.mutedColor }]}>
              {packHeaderLabel}
            </Text>
            <Text style={[styles.statsLine, { color: theme.primaryColor }]}>
              {`OCCUPANCY ${occupancyPct}% // VALUE ${cargoValue}`}
            </Text>
          </View>
        ) : null}

        <View style={harvestLayout ? styles.gridAnchor : undefined}>
          <CargoGridBoard
            cargo={cargo}
            theme={theme}
            accentColor={accentColor}
            onRelocateItem={onRelocateItem}
            onDiscardItem={onDiscardItem}
            runCredits={runCredits}
            showCreditsHud={showCreditsHud}
            onContinue={onContinue}
            continueLabel={continueLabel}
            minimal
            hideContinueButton={hideContinueButton || !onContinue}
            onContainmentItemCenterMeasured={onContainmentItemCenterMeasured}
            onHarvestFloorMeasured={harvestLayout ? onHarvestFloorMeasured : undefined}
            fixedExternalSlotCount={fixedExternalSlotCount}
            resolveContainmentSlotIndex={harvestLayout ? resolveContainmentSlotIndex : undefined}
            stableExternalBay={stableExternalBay}
            externalHover={externalHover}
            selectedPlacementItemId={selectedPlacementItemId}
            onPlaceAtCell={onPlaceAtCell}
            onGridMetricsMeasured={onGridMetricsMeasured}
            onHubExternalDrop={onHubExternalDrop}
            onDragPositionChange={onDragPositionChange}
            cellSize={cellSize}
          />

          {harvestLayout && gridSidecar ? (
            <View
              style={[
                styles.gridSidecarSlot,
                { width: harvestSidecarWidth, height: harvestGridHeight },
              ]}
              pointerEvents="box-none"
            >
              {React.isValidElement(gridSidecar)
                ? React.cloneElement(
                    gridSidecar as React.ReactElement<{ gridFrameHeight?: number }>,
                    { gridFrameHeight: harvestGridHeight },
                  )
                : gridSidecar}
            </View>
          ) : null}
        </View>

        {harvestLayout && onContinue && !hideContinueButton ? (
          <HapticPressable
            onPress={onContinue}
            style={({ pressed }) => [
              getInteractiveButtonStyle(accent, { pressed, size: 'md' }),
              styles.continueBtn,
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('md'), styles.continueBtnText, { color: accent }]}>
              {continueLabel}
            </Text>
          </HapticPressable>
        ) : null}
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
  rootHarvest: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rootEmbedded: {
    flex: 0,
    flexGrow: 0,
    paddingVertical: 0,
    width: '100%',
  },
  boardColumn: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: CARGO_GRID_FRAME_SIZE + 32,
  },
  boardColumnHarvest: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    gap: 6,
    justifyContent: 'flex-start',
  },
  boardColumnEmbedded: {
    gap: 0,
    maxWidth: '100%',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  gridAnchor: {
    position: 'relative',
    width: CARGO_GRID_FRAME_WIDTH,
    alignSelf: 'center',
  },
  gridSidecarSlot: {
    position: 'absolute',
    top: 0,
    left: CARGO_GRID_FRAME_WIDTH + GRID_CANISTER_GAP,
    height: CARGO_GRID_FRAME_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 20,
  },
  headerContainer: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0a0b0f',
  },
  headerContainerHarvest: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 6,
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
  continueBtn: {
    width: CARGO_GRID_FRAME_SIZE,
    alignSelf: 'center',
  },
  continueBtnText: {
    textAlign: 'center',
  },
});
