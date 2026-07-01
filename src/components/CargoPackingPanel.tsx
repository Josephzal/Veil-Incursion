import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import HapticPressable from './HapticPressable';
import HarvestExtractorPanel from './harvest/HarvestExtractorPanel';
import SelectionContinueButton from './SelectionContinueButton';
import {
  HARVEST_BOARD_COLUMN_GAP,
  HARVEST_CONTENT_BUFFER,
  HARVEST_CONTINUE_BUTTON_HEIGHT,
  resolveHarvestCellSize,
  resolveHarvestLeftPaneWidth,
  resolveHarvestRightPaneWidth,
  resolveHarvestTriPaneCellSize,
} from '../constants/harvestLayout';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { resolveImmersiveFooterInset } from '../constants/immersiveLayout';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../data/cargoGridEngine';
import CargoGridBoard, {
  CARGO_CELL_SIZE,
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
  /** Legacy centered harvest layout. Prefer harvestTriPane. */
  harvestLayout?: boolean;
  /** Three-pane harvest: cargo pack left, drop zone center, extractor right. */
  harvestTriPane?: boolean;
  harvestPercentage?: number;
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
  hidePackHeader?: boolean;
  embedded?: boolean;
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
  harvestTriPane = false,
  harvestPercentage = 0,
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
  const { safeBottom, safeTop } = useLandscapeMetrics();
  const useHarvestLayout = harvestLayout || harvestTriPane;

  const cellSize = useMemo(() => {
    if (compactCellSize != null) return compactCellSize;
    if (harvestTriPane) return resolveHarvestTriPaneCellSize(screenHeight, screenWidth, safeTop);
    if (harvestLayout) return resolveHarvestCellSize(screenHeight, safeBottom, safeTop);
    return CARGO_CELL_SIZE;
  }, [compactCellSize, harvestLayout, harvestTriPane, safeBottom, safeTop, screenHeight, screenWidth]);
  const frame = useMemo(() => cargoGridFrameDimensions(cellSize), [cellSize]);
  const leftPaneWidth = useMemo(
    () => (harvestTriPane ? resolveHarvestLeftPaneWidth(screenWidth) : undefined),
    [harvestTriPane, screenWidth],
  );
  const rightPaneWidth = useMemo(
    () => (harvestTriPane ? resolveHarvestRightPaneWidth(screenWidth) : undefined),
    [harvestTriPane, screenWidth],
  );
  const footerInset = resolveImmersiveFooterInset(safeBottom);

  const occupancy = calculateGridOccupancy(cargo);
  const occupancyPct = Math.round(occupancy * 100);
  const cargoValue = calculateCargoMarketValue(cargo);
  const accent = accentColor ?? '#00ff33';

  const packHeader = !hidePackHeader ? (
    <View style={[
      styles.headerContainer,
      useHarvestLayout ? styles.headerContainerHarvest : null,
      { borderColor: theme.borderColor, width: frame.frameWidth },
    ]}>
      <Text style={[styles.headerLabel, { color: theme.mutedColor }]}>
        {packHeaderLabel}
      </Text>
      <Text style={[styles.statsLine, { color: theme.primaryColor }]}>
        {`OCCUPANCY ${occupancyPct}% // VALUE ${cargoValue}`}
      </Text>
    </View>
  ) : null;

  const triPaneRightColumn = harvestTriPane && gridSidecar ? (
    <View style={[styles.harvestRightColumn, { paddingBottom: footerInset }]}>
      <HarvestExtractorPanel
        theme={theme}
        harvestPercentage={harvestPercentage}
        style={styles.extractorPanelFill}
      >
        {gridSidecar}
      </HarvestExtractorPanel>
      {onContinue && !hideContinueButton ? (
        <SelectionContinueButton
          enabled
          onPress={onContinue}
          label={continueLabel}
          borderColor={theme.borderColor}
          mutedColor={theme.mutedColor}
          style={styles.continueTriPane}
        />
      ) : null}
    </View>
  ) : undefined;

  const board = (
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
      hideContinueButton={hideContinueButton || !onContinue || harvestTriPane}
      onContainmentItemCenterMeasured={onContainmentItemCenterMeasured}
      onHarvestFloorMeasured={useHarvestLayout ? onHarvestFloorMeasured : undefined}
      fixedExternalSlotCount={fixedExternalSlotCount}
      resolveContainmentSlotIndex={useHarvestLayout ? resolveContainmentSlotIndex : undefined}
      stableExternalBay={stableExternalBay || useHarvestLayout}
      externalHover={externalHover}
      selectedPlacementItemId={selectedPlacementItemId}
      onPlaceAtCell={onPlaceAtCell}
      onGridMetricsMeasured={onGridMetricsMeasured}
      onHubExternalDrop={onHubExternalDrop}
      onDragPositionChange={onDragPositionChange}
      cellSize={cellSize}
      harvestTriPaneLayout={harvestTriPane}
      leftPaneHeader={harvestTriPane ? packHeader : undefined}
      leftPaneWidth={leftPaneWidth}
      rightPaneWidth={rightPaneWidth}
      rightPaneSlot={triPaneRightColumn}
    />
  );

  if (harvestTriPane) {
    return (
      <View style={styles.rootHarvestTriPane}>
        {board}
      </View>
    );
  }

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
        {packHeader}

        <View style={harvestLayout ? [styles.gridAnchor, { width: frame.frameWidth }] : undefined}>
          {board}
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
  rootHarvestTriPane: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  harvestRightColumn: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    gap: 8,
    justifyContent: 'flex-end',
  },
  extractorPanelFill: {
    flex: 1,
    minHeight: 0,
  },
  continueTriPane: {
    marginTop: 0,
    width: '100%',
    minHeight: HARVEST_CONTINUE_BUTTON_HEIGHT,
    flexShrink: 0,
  },
  rootEmbedded: {
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
    paddingVertical: 0,
    width: '100%',
    alignSelf: 'stretch',
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
    gap: HARVEST_BOARD_COLUMN_GAP,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: HARVEST_CONTENT_BUFFER,
  },
  boardColumnEmbedded: {
    flex: 1,
    minHeight: 0,
    gap: 0,
    maxWidth: '100%',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  gridAnchor: {
    position: 'relative',
    width: CARGO_GRID_FRAME_WIDTH,
    alignSelf: 'center',
  },
  headerContainer: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0a0b0f',
    alignSelf: 'center',
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
