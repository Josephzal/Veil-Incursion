import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import HarvestExtractorPanel from './harvest/HarvestExtractorPanel';
import HubPrimaryCta from './hub/HubPrimaryCta';
import TerminalText from './TerminalText';
import CargoGridBackdrop from './cargo/CargoGridBackdrop';
import {
  HARVEST_BOARD_COLUMN_GAP,
  HARVEST_CELL_GAP,
  HARVEST_CONTENT_BUFFER,
  HARVEST_CONTINUE_BUTTON_HEIGHT,
  resolveHarvestCellSize,
  resolveHarvestRightPaneWidth,
  resolveHarvestTriPaneCellSize,
} from '../constants/harvestLayout';
import { CARGO_CELL_GAP } from '../constants/cargoGridLayout';
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
import { pulseHubButton } from '../utils/hubButtonHaptics';
import { SCANNER_PHOSPHOR } from './scanner/vectorScannerShared';
import { resolveHarvestCargoReadout } from '../utils/harvestCargoReadout';

interface CargoPackingPanelProps {
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onReplaceItem?: (instanceId: string, row: number, col: number) => boolean;
  onDiscardItem?: (instanceId: string) => boolean;
  /** Harvest — return grid cargo to the containment field. */
  onReturnToContainment?: (instanceId: string) => boolean;
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
  onReturnToContainment,
  runCredits,
  showCreditsHud = false,
  onContinue,
  continueLabel = 'CONTINUE',
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
  const activeCellGap = harvestTriPane ? HARVEST_CELL_GAP : CARGO_CELL_GAP;
  const frame = useMemo(
    () => cargoGridFrameDimensions(cellSize, activeCellGap),
    [activeCellGap, cellSize],
  );
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
  const fieldCleared = unstowedCount === 0;
  const [selectedCargoInstanceId, setSelectedCargoInstanceId] = useState<string | null>(null);

  useEffect(() => {
    if (!cargo.grid.placed.some((item) => item.instanceId === selectedCargoInstanceId)) {
      setSelectedCargoInstanceId(null);
    }
  }, [cargo.grid.placed, selectedCargoInstanceId]);

  const selectedPlaced = useMemo(
    () => cargo.grid.placed.find((item) => item.instanceId === selectedCargoInstanceId) ?? null,
    [cargo.grid.placed, selectedCargoInstanceId],
  );
  const selectedReadout = useMemo(
    () => (selectedPlaced ? resolveHarvestCargoReadout(selectedPlaced) : null),
    [selectedPlaced],
  );

  const harvestCargoHeader = !hidePackHeader ? (
    <View style={styles.harvestDeckHeader}>
      <TerminalText size={16 * fontScale} letterSpacing={0.55} style={styles.harvestDeckTitle}>
        {packHeaderLabel}
      </TerminalText>
      <View style={styles.metricsRow}>
        <TerminalText size={11.5 * fontScale} letterSpacing={0.4} style={styles.metricValue}>
          {`${slotsUsed} / 12 SLOTS`}
        </TerminalText>
        <TerminalText size={11.5 * fontScale} letterSpacing={0.4} style={[styles.metricValue, styles.metricValueEnd]}>
          {`${cargoValue} CR`}
        </TerminalText>
      </View>
      <View style={styles.metricsRule} />
    </View>
  ) : null;

  const workspaceStatusStrip = null;

  const cargoReadout = harvestTriPane ? (
    <View
      key={selectedReadout
        ? selectedCargoInstanceId ?? 'selected'
        : fieldCleared
          ? (slotsUsed > 0 ? 'secured' : 'empty')
          : 'awaiting'}
      style={[
        styles.readoutBlock,
        Platform.OS === 'web' ? styles.readoutBlockWeb : null,
      ]}
    >
      {selectedReadout ? (
        <>
          <TerminalText size={9 * fontScale} letterSpacing={0.8} style={styles.readoutSelectedTitle} numberOfLines={2}>
            {selectedReadout.title}
          </TerminalText>
          <View style={styles.readoutRows}>
            {selectedReadout.rows.map((row) => (
              <View key={row.label} style={styles.readoutRow}>
                <TerminalText size={7 * fontScale} letterSpacing={0.8} style={styles.readoutRowLabel}>
                  {row.label}
                </TerminalText>
                <TerminalText size={7.5 * fontScale} style={styles.readoutRowValue} numberOfLines={2}>
                  {row.value}
                </TerminalText>
              </View>
            ))}
          </View>
        </>
      ) : fieldCleared && slotsUsed > 0 ? (
        <>
          <TerminalText size={8.5 * fontScale} letterSpacing={0.95} style={styles.readoutEyebrow}>
            MANIFEST SECURED
          </TerminalText>
          <TerminalText size={7.5 * fontScale} style={styles.readoutBody}>
            {`${slotsUsed} SLOT${slotsUsed === 1 ? '' : 'S'} OCCUPIED // ${cargoValue} CR`}
          </TerminalText>
        </>
      ) : fieldCleared ? (
        <>
          <TerminalText size={8.5 * fontScale} letterSpacing={0.95} style={styles.readoutEyebrow}>
            NO CARGO RECOVERED
          </TerminalText>
          <TerminalText size={7.5 * fontScale} style={styles.readoutBody}>
            RUN STORAGE EMPTY
          </TerminalText>
        </>
      ) : (
        <>
          <TerminalText size={8.5 * fontScale} letterSpacing={0.95} style={styles.readoutEyebrow}>
            AWAITING MATERIAL
          </TerminalText>
          <TerminalText size={7.5 * fontScale} style={styles.readoutBody}>
            Drag a recoverable fragment into an available slot.
          </TerminalText>
        </>
      )}
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
      residueAvailable={residueLooseCount > 0}
      style={styles.extractorPanelFill}
    >
      {gridSidecar}
    </HarvestExtractorPanel>
  ) : undefined;

  const cargoConsoleFooter = harvestTriPane && onContinue && !hideContinueButton ? (
    <View style={styles.continueBlock}>
      <HubPrimaryCta
        label={continueLabel}
        onPress={() => {
          pulseHubButton();
          onContinue();
        }}
        variant="glow"
        accessibilityLabel={continueLabel}
        minHeight={HARVEST_CONTINUE_BUTTON_HEIGHT}
        style={styles.continueBtnShell}
      />
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
      onReturnToContainment={onReturnToContainment}
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
      residueLooseCount={residueLooseCount}
      cargoReadout={null}
      rightPaneWidth={rightPaneWidth}
      selectedHarvestInstanceId={harvestTriPane ? selectedCargoInstanceId : null}
      onHarvestCargoSelect={harvestTriPane ? setSelectedCargoInstanceId : undefined}
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
          <HubPrimaryCta
            label={continueLabel}
            onPress={onContinue}
            variant="glow"
            accessibilityLabel={continueLabel}
            minHeight={HARVEST_CONTINUE_BUTTON_HEIGHT}
            style={styles.legacyContinueBtn}
          />
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
    gap: 8,
    flexShrink: 0,
  },
  readinessStack: {
    gap: 2,
  },
  readiness: {
    fontWeight: '700',
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        fontSize: 'clamp(14px, 0.9vw, 16px)',
      } as object,
      default: {},
    }),
  },
  readinessReady: {
    color: HARVEST_PHOSPHOR,
  },
  readinessPending: {
    color: HARVEST_MUTED_SLATE,
  },
  readinessSecondary: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    opacity: 0.78,
    textTransform: 'uppercase',
  },
  continueBtnShell: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  continueBtn: {
    width: '100%',
    height: HARVEST_CONTINUE_BUTTON_HEIGHT,
    minHeight: HARVEST_CONTINUE_BUTTON_HEIGHT,
    maxHeight: 60,
    borderWidth: 1,
    borderColor: 'rgba(100, 201, 177, 0.55)',
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
  continueBtnReady: {
    borderColor: 'rgba(100, 201, 177, 0.72)',
  },
  continueScan: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(100, 201, 177, 0.18)',
    zIndex: 2,
  },
  continueBtnText: {
    color: SCANNER_PHOSPHOR,
    fontWeight: '700',
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        fontSize: 'clamp(15px, 0.95vw, 17px)',
      } as object,
      default: {},
    }),
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
    gap: 0,
    flexShrink: 0,
  },
  harvestDeckTitle: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
    marginBottom: 10,
    ...Platform.select({
      web: {
        fontSize: 'clamp(28px, 1.7vw, 32px)',
        lineHeight: 1,
      } as object,
      default: {},
    }),
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  metricValue: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      web: {
        fontSize: 'clamp(18px, 1.1vw, 20px)',
      } as object,
      default: {},
    }),
  },
  metricValueEnd: {
    textAlign: 'right',
  },
  metricsRule: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(108, 156, 143, 0.16)',
    marginBottom: 0,
  },
  statusStripRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 0,
    backgroundColor: 'transparent',
  },
  statusField: {
    flex: 1,
    gap: 3,
    minWidth: 0,
    justifyContent: 'center',
  },
  statusLabel: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
      } as object,
      default: {},
    }),
  },
  statusValue: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(15px, 0.95vw, 17px)',
      } as object,
      default: {},
    }),
  },
  statusValueStable: {
    color: HARVEST_PHOSPHOR,
  },
  statusDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 12,
    marginHorizontal: 12,
    backgroundColor: 'rgba(91, 224, 195, 0.14)',
  },
  readoutBlock: {
    gap: 4,
    paddingTop: 22,
    minHeight: 0,
    flexShrink: 1,
  },
  readoutBlockWeb: {
    ...Platform.select({
      web: {
        transitionProperty: 'opacity',
        transitionDuration: '140ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {},
    }),
  },
  readoutEyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(16px, 0.95vw, 18px)',
        lineHeight: '1.25',
      } as object,
      default: {
        lineHeight: 22,
      },
    }),
  },
  readoutSelectedTitle: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
    ...Platform.select({
      web: {
        fontSize: 'clamp(16px, 0.95vw, 18px)',
        lineHeight: '1.25',
      } as object,
      default: {
        lineHeight: 22,
      },
    }),
  },
  readoutBody: {
    color: HARVEST_MUTED_SLATE,
    opacity: 0.82,
    fontWeight: '500',
    ...Platform.select({
      web: {
        fontSize: 'clamp(13px, 0.8vw, 14px)',
        lineHeight: '1.35',
      } as object,
      default: {
        lineHeight: 18,
      },
    }),
  },
  readoutRows: {
    gap: 4,
    marginTop: 2,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(108, 156, 143, 0.14)',
  },
  readoutRowLabel: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    minWidth: 72,
  },
  readoutRowValue: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
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
