import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import HapticPressable from './HapticPressable';
import HarvestExtractorPanel from './harvest/HarvestExtractorPanel';
import TerminalText from './TerminalText';
import CargoGridBackdrop from './cargo/CargoGridBackdrop';
import {
  HARVEST_BOARD_COLUMN_GAP,
  HARVEST_CONTENT_BUFFER,
  HARVEST_CONTINUE_BUTTON_HEIGHT,
  resolveHarvestCellSize,
  resolveHarvestRightPaneWidth,
  resolveHarvestTriPaneCellSize,
} from '../constants/harvestLayout';
import {
  HARVEST_MUTED_SLATE,
  HARVEST_PHOSPHOR,
  HARVEST_TEXT_PRIMARY,
} from '../constants/harvestScreenVisual';
import { resolveHubCargoMatShellMetrics } from '../constants/cargoGridVisual';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../data/cargoGridEngine';
import { MAX_RUN_CANISTER_RESIDUE } from '../constants/veilResidue';
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
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';
import { pulseHubButton } from '../utils/hubButtonHaptics';
import { SCANNER_PHOSPHOR } from './scanner/vectorScannerShared';

interface CargoPackingPanelProps {
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onReplaceItem?: (instanceId: string, row: number, col: number) => boolean;
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
  /** Two-zone harvest: containment workspace + cargo console. */
  harvestTriPane?: boolean;
  harvestPercentage?: number;
  residueCollected?: number;
  residueCapacity?: number;
  residueLooseCount?: number;
  isVacuuming?: boolean;
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
  /** Tactical cargo mat behind the grid cells. */
  cargoBackdrop?: boolean;
  /** Shrinks the hub mat shell by this many px per edge (Black Market). */
  hubCargoMatInset?: number;
}

export default function CargoPackingPanel({
  cargo,
  theme,
  accentColor,
  onRelocateItem,
  onReplaceItem,
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
  residueCollected,
  residueCapacity = MAX_RUN_CANISTER_RESIDUE,
  residueLooseCount = 0,
  isVacuuming = false,
  gridSidecar,
  onHarvestFloorMeasured,
  fixedExternalSlotCount,
  resolveContainmentSlotIndex,
  externalHover,
  selectedPlacementItemId,
  onPlaceAtCell,
  onGridMetricsMeasured,
  packHeaderLabel = 'CARGO MANIFEST',
  hidePackHeader = false,
  embedded = false,
  compactCellSize,
  stableExternalBay = false,
  onHubExternalDrop,
  onDragPositionChange,
  cargoBackdrop = false,
  hubCargoMatInset,
}: CargoPackingPanelProps): React.JSX.Element {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { fontScale, scaleSpacing } = useResponsiveLayout();
  const { safeBottom, safeTop } = useLandscapeMetrics();
  const useHarvestLayout = harvestLayout || harvestTriPane;
  const extractorPadding = scaleSpacing(14);

  const cellSize = useMemo(() => {
    if (compactCellSize != null) return compactCellSize;
    if (harvestTriPane) return resolveHarvestTriPaneCellSize(screenHeight, screenWidth, safeTop);
    if (harvestLayout) return resolveHarvestCellSize(screenHeight, safeBottom, safeTop);
    return CARGO_CELL_SIZE;
  }, [compactCellSize, harvestLayout, harvestTriPane, safeBottom, safeTop, screenHeight, screenWidth]);
  const frame = useMemo(() => cargoGridFrameDimensions(cellSize), [cellSize]);
  const useHubMatShell = cargoBackdrop && !harvestTriPane && hubCargoMatInset != null;
  const hubMatShell = useMemo(() => {
    if (hubCargoMatInset == null) return null;
    return resolveHubCargoMatShellMetrics(
      frame.frameWidth,
      frame.frameHeight,
      scaleSpacing,
      hubCargoMatInset,
    );
  }, [frame.frameHeight, frame.frameWidth, hubCargoMatInset, scaleSpacing]);
  const rightPaneWidth = useMemo(
    () => (harvestTriPane ? resolveHarvestRightPaneWidth(screenWidth) : undefined),
    [harvestTriPane, screenWidth],
  );

  const occupancy = calculateGridOccupancy(cargo);
  const occupancyPct = Math.round(occupancy * 100);
  const cargoValue = calculateCargoMarketValue(cargo);
  const accent = accentColor ?? SCANNER_PHOSPHOR;
  const slotsUsed = cargo.grid.placed.length;
  const unstowedCount = cargo.containment.length;
  const continueReady = true;
  const readinessLine = unstowedCount > 0
    ? `RECOVERY COMPLETE // ${unstowedCount} MATERIAL${unstowedCount === 1 ? '' : 'S'} REMAIN`
    : 'RECOVERY COMPLETE // FIELD CLEARED';

  const harvestCargoHeader = !hidePackHeader ? (
    <View style={styles.harvestDeckHeader}>
      <TerminalText size={6.5 * fontScale} letterSpacing={1.05} style={styles.harvestDeckEyebrow}>
        RUN STORAGE // 12 SLOT DECK
      </TerminalText>
      <TerminalText size={12 * fontScale} letterSpacing={0.7} style={styles.harvestDeckTitle}>
        {packHeaderLabel}
      </TerminalText>
      <TerminalText size={7 * fontScale} letterSpacing={0.7} style={styles.harvestDeckStats}>
        {`OCCUPANCY ${String(occupancyPct).padStart(2, '0')}% · ${slotsUsed}/12 SLOTS · VALUE ${cargoValue} CR`}
      </TerminalText>
    </View>
  ) : null;

  const workspaceStatusStrip = harvestTriPane ? (
    <View style={styles.statusStripRow}>
      <View style={styles.statusField}>
        <TerminalText size={6 * fontScale} letterSpacing={1} style={styles.statusLabel}>UNSTOWED</TerminalText>
        <TerminalText size={8 * fontScale} letterSpacing={0.6} style={styles.statusValue}>
          {`${unstowedCount} MATERIAL${unstowedCount === 1 ? '' : 'S'}`}
        </TerminalText>
      </View>
      <View style={styles.statusDivider} />
      <View style={styles.statusField}>
        <TerminalText size={6 * fontScale} letterSpacing={1} style={styles.statusLabel}>RESIDUE</TerminalText>
        <TerminalText size={8 * fontScale} letterSpacing={0.6} style={styles.statusValue}>
          {`${String(residueLooseCount).padStart(2, '0')} SIGNALS`}
        </TerminalText>
      </View>
      <View style={styles.statusDivider} />
      <View style={styles.statusField}>
        <TerminalText size={6 * fontScale} letterSpacing={1} style={styles.statusLabel}>FIELD STATE</TerminalText>
        <TerminalText size={8 * fontScale} letterSpacing={0.6} style={[styles.statusValue, { color: HARVEST_PHOSPHOR }]}>
          STABLE
        </TerminalText>
      </View>
    </View>
  ) : null;

  const cargoReadout = harvestTriPane ? (
    <View style={styles.readoutBlock}>
      <TerminalText size={7 * fontScale} letterSpacing={1.05} style={styles.readoutEyebrow}>
        AWAITING MATERIAL
      </TerminalText>
      <TerminalText size={8 * fontScale} style={styles.readoutBody}>
        Drag a recoverable fragment into an available slot.
      </TerminalText>
    </View>
  ) : null;

  const packHeader = !hidePackHeader && !harvestTriPane ? (
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

  const extractorPane = harvestTriPane && gridSidecar ? (
    <HarvestExtractorPanel
      harvestPercentage={harvestPercentage}
      residueCollected={residueCollected}
      residueCapacity={residueCapacity}
      accentColor={accent}
      padding={extractorPadding}
      fontScale={fontScale}
      active={isVacuuming}
      style={styles.extractorPanelFill}
    >
      {gridSidecar}
    </HarvestExtractorPanel>
  ) : undefined;

  const cargoConsoleFooter = harvestTriPane && onContinue && !hideContinueButton ? (
    <View style={styles.continueBlock}>
      <TerminalText
        size={7 * fontScale}
        letterSpacing={1.05}
        style={[styles.readiness, { color: continueReady ? HARVEST_PHOSPHOR : HARVEST_MUTED_SLATE }]}
        numberOfLines={1}
      >
        {readinessLine}
      </TerminalText>
      <HapticPressable
        onPress={() => {
          pulseHubButton();
          onContinue();
        }}
        accessibilityRole="button"
        accessibilityLabel={continueLabel}
        style={(state) => [
          styles.continueBtn,
          terminalHoverStyle(readPressableHover(state), state.pressed),
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
        ]}
      >
        <TerminalText size={11} letterSpacing={1.2} style={styles.continueBtnText}>
          {continueLabel}
        </TerminalText>
      </HapticPressable>
    </View>
  ) : undefined;

  const board = (
    <CargoGridBoard
      cargo={cargo}
      theme={theme}
      accentColor={accentColor}
      onRelocateItem={onRelocateItem}
      onReplaceItem={onReplaceItem}
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
      cargoBackdrop={harvestTriPane || cargoBackdrop}
      cellSize={cellSize}
      harvestTriPaneLayout={harvestTriPane}
      rightPaneHeader={harvestTriPane ? harvestCargoHeader : undefined}
      leftPaneSlot={extractorPane}
      centerPaneFooter={cargoConsoleFooter}
      workspaceStatusStrip={workspaceStatusStrip}
      cargoReadout={cargoReadout}
      rightPaneWidth={rightPaneWidth}
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
        useHubMatShell
          ? styles.boardColumnBackdropSlot
          : cargoBackdrop && !harvestTriPane
            ? styles.boardColumnBackdropHost
            : null,
      ]}>
        {useHubMatShell ? (
          <View
            style={[
              styles.hubCargoMatShell,
              styles.hubCargoMatShellTextured,
              hubMatShell,
            ]}
          >
            <CargoGridBackdrop />
            <View style={styles.backdropContent}>{board}</View>
          </View>
        ) : (
          <>
            {cargoBackdrop && !harvestTriPane ? <CargoGridBackdrop /> : null}
            {packHeader}

            <View style={harvestLayout ? [styles.gridAnchor, { width: frame.frameWidth }] : styles.backdropContent}>
              {board}
            </View>
          </>
        )}

        {harvestLayout && onContinue && !hideContinueButton ? (
          <HapticPressable
            onPress={onContinue}
            style={({ pressed }) => [
              getInteractiveButtonStyle(accent, { pressed, size: 'md' }),
              styles.legacyContinueBtn,
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Text style={[getInteractiveButtonTextStyle('md'), styles.legacyContinueBtnText, { color: accent }]}>
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
  extractorPanelFill: {
    maxWidth: '100%',
  },
  continueBlock: {
    width: '100%',
    gap: 10,
  },
  readiness: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  continueBtn: {
    width: '100%',
    height: HARVEST_CONTINUE_BUTTON_HEIGHT,
    minHeight: HARVEST_CONTINUE_BUTTON_HEIGHT,
    maxHeight: 64,
    borderWidth: 1,
    borderColor: SCANNER_PHOSPHOR,
    backgroundColor: '#0A1011',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: 'inset 0 1px 0 rgba(100, 201, 177, 0.1)',
      } as object,
      default: {},
    }),
  },
  continueBtnText: {
    color: SCANNER_PHOSPHOR,
    fontWeight: '800',
    textTransform: 'uppercase',
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
  boardColumnBackdropHost: {
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  boardColumnBackdropSlot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubCargoMatShell: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hubCargoMatShellTextured: {
    backgroundColor: 'rgba(5, 6, 8, 0.55)',
  },
  backdropContent: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    alignItems: 'center',
  },
  gridAnchor: {
    position: 'relative',
    width: CARGO_GRID_FRAME_WIDTH,
    alignSelf: 'center',
  },
  harvestDeckHeader: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 4,
    flexShrink: 0,
  },
  harvestDeckEyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
  },
  harvestDeckTitle: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '800',
  },
  harvestDeckStats: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
    marginTop: 2,
  },
  statusStripRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 0,
  },
  statusField: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  statusLabel: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
  },
  statusValue: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
  },
  statusDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 12,
    marginHorizontal: 12,
    backgroundColor: 'rgba(108, 156, 143, 0.22)',
  },
  readoutBlock: {
    gap: 6,
    paddingTop: 4,
  },
  readoutEyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '700',
  },
  readoutBody: {
    color: HARVEST_MUTED_SLATE,
    lineHeight: 16,
    opacity: 0.9,
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
  legacyContinueBtn: {
    width: CARGO_GRID_FRAME_SIZE,
    alignSelf: 'center',
  },
  legacyContinueBtnText: {
    textAlign: 'center',
  },
});
