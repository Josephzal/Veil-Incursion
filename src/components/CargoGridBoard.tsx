import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const REJECT_SNAP_MS = 140;
const COMBAT_DETAIL_PANEL_HEIGHT = 160;
const COMBAT_DETAIL_TITLE_HEIGHT = 18;
const COMBAT_DETAIL_BODY_HEIGHT = 39;
const COMBAT_DETAIL_META_HEIGHT = 14;
import {
  canPlaceCargoItemExcluding,
  combatConsumableApCost,
  combatConsumableDescription,
  isCombatDeployableCargoItem,
  relocateCargoItem as relocateCargoInState,
} from '../data/cargoGridEngine';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import type { CargoItemId, CargoRunState, PlacedCargoItem } from '../types/cargoGrid';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS, CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import { resolveCargoGridCellBackground } from '../constants/cargoGridVisual';
import {
  HARVEST_CONTAINMENT_BORDER,
  HARVEST_GRID_CELL_BORDER,
  HARVEST_MUTED_SLATE,
  resolveHarvestGridCellBackground,
} from '../constants/harvestScreenVisual';
import CargoGridBackdrop from './cargo/CargoGridBackdrop';
import DossierCardShell from './hub/DossierCardShell';
import {
  HUB_CARGO_INCURSION_CELL_MAX,
  HUB_CARGO_INCURSION_CELL_TARGET,
  resolveHubLoadoutCellSize,
} from '../utils/cargoGridLayout';
import {
  HARVEST_CARGO_BACKING_PADDING,
  HARVEST_DESKTOP_CENTER_FLEX,
  HARVEST_DESKTOP_LEFT_FLEX,
  HARVEST_DESKTOP_RIGHT_FLEX,
  HARVEST_EXTERNAL_BAY_MARGIN_TOP,
  HARVEST_TRI_PANE_GAP,
  harvestExternalBayHeight,
} from '../constants/harvestLayout';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { COMBAT_OVERLAY_SPLIT_GAP, resolveCombatOverlaySplitWidths } from '../constants/cargoOverlayLayout';
import {
  CARGO_CELL_GAP,
  CARGO_CELL_SIZE,
  CARGO_GRID_FRAME_HEIGHT,
  CARGO_GRID_FRAME_SIZE,
  CARGO_GRID_FRAME_WIDTH,
} from '../constants/cargoGridLayout';
import type { TerminalTheme } from '../types/theme';
import { countCargoItemInstances } from '../data/cargoGridEngine';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';
import CargoDiscardConfirmOverlay from './CargoDiscardConfirmOverlay';
import CargoCreditsHud from './CargoCreditsHud';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';
import {
  pulseCargoItemPickup,
  pulseCargoItemSelect,
  pulseCargoItemUse,
} from '../utils/hubButtonHaptics';

export {
  CARGO_CELL_GAP,
  CARGO_CELL_SIZE,
  CARGO_GRID_FRAME_HEIGHT,
  CARGO_GRID_FRAME_SIZE,
  CARGO_GRID_FRAME_WIDTH,
} from '../constants/cargoGridLayout';

interface GridMetrics {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

export interface CargoDragSource {
  instanceId: string;
  itemId: CargoItemId;
  source: 'containment' | 'grid';
}

interface CargoGridBoardProps {
  cargo: CargoRunState;
  theme: TerminalTheme;
  accentColor?: string;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onContinue?: () => void;
  continueLabel?: string;
  onUseAmpoule?: () => boolean;
  onUseResonanceBribe?: () => boolean;
  onUseDeadDrop?: () => boolean;
  showDeadDropFieldTool?: boolean;
  onUseAshSeal?: () => boolean;
  onUseContainmentFoam?: () => boolean;
  scannerMode?: boolean;
  combatMode?: boolean;
  combatConsumablesEnabled?: boolean;
  onUseCombatConsumable?: (itemId: CargoItemId) => boolean;
  onDiscardItem?: (instanceId: string) => boolean;
  runCredits?: number;
  playerActionPoints?: number;
  showCreditsHud?: boolean;
  minimal?: boolean;
  onContainmentItemCenterMeasured?: (instanceId: string, center: { x: number; y: number }) => void;
  onHarvestFloorMeasured?: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Locks containment bay slot count and layout (harvest screen). */
  fixedExternalSlotCount?: number;
  resolveContainmentSlotIndex?: (instanceId: string) => number | undefined;
  stableExternalBay?: boolean;
  hideContinueButton?: boolean;
  /** Hover preview while dragging from an external stash panel. */
  externalHover?: { itemId: CargoItemId; row: number; col: number } | null;
  /** Tap-to-place: selected stash item awaiting grid cell click. */
  selectedPlacementItemId?: CargoItemId | null;
  onPlaceAtCell?: (row: number, col: number) => void;
  onGridMetricsMeasured?: (metrics: GridMetrics & { cellSize: number; cellGap: number }) => void;
  /** Hub loadout: drag off-grid onto stash returns item without discard confirm. */
  onHubExternalDrop?: (source: CargoDragSource, absoluteX: number, absoluteY: number) => boolean;
  /** Reports in-progress cargo drags for cross-panel drop highlighting. */
  onDragPositionChange?: (payload: { source: CargoDragSource; x: number; y: number } | null) => void;
  /** Override cell pixel size — hub loadout uses a compact grid. */
  cellSize?: number;
  /** Incursion cargo modal: tighter gaps and combat detail panel. */
  overlayCompact?: boolean;
  /** Combat overlay: grid left, item detail + USE ITEM right — no vertical scroll. */
  overlayCombatSplit?: boolean;
  /** Full inner width of the combat overlay panel (excluding modal padding). */
  contentWidth?: number;
  /** Harvest tri-pane: extractor left, containment center, cargo right. */
  harvestTriPaneLayout?: boolean;
  /** Cargo deck header — rendered in the right pane. */
  rightPaneHeader?: React.ReactNode;
  /** Veil extractor column — rendered in the left pane. */
  leftPaneSlot?: React.ReactNode;
  /** Pinned CTA under the containment field. */
  centerPaneFooter?: React.ReactNode;
  leftPaneWidth?: number;
  rightPaneWidth?: number;
  /** @deprecated Use rightPaneHeader */
  leftPaneHeader?: React.ReactNode;
  /** @deprecated Use leftPaneSlot */
  rightPaneSlot?: React.ReactNode;
  /** Tactical cargo mat texture behind grid cells. */
  cargoBackdrop?: boolean;
}

function cellsForItem(itemId: CargoItemId, originRow: number, originCol: number): string[] {
  const def = CARGO_ITEM_CATALOG[itemId];
  const keys: string[] = [];
  for (let row = 0; row < def.height; row += 1) {
    for (let col = 0; col < def.width; col += 1) {
      keys.push(`${originRow + row},${originCol + col}`);
    }
  }
  return keys;
}

export function spriteSizeForCargoItem(
  itemId: CargoItemId,
  cellSize: number = CARGO_CELL_SIZE,
): { width: number; height: number } {
  const def = CARGO_ITEM_CATALOG[itemId];
  return {
    width: def.width * cellSize + (def.width - 1) * CARGO_CELL_GAP,
    height: def.height * cellSize + (def.height - 1) * CARGO_CELL_GAP,
  };
}

export function cargoGridFrameDimensions(cellSize: number = CARGO_CELL_SIZE): {
  frameWidth: number;
  frameHeight: number;
  stride: number;
} {
  const stride = cellSize + CARGO_CELL_GAP;
  return {
    frameWidth: CARGO_GRID_COLS * cellSize + (CARGO_GRID_COLS - 1) * CARGO_CELL_GAP,
    frameHeight: CARGO_GRID_ROWS * cellSize + (CARGO_GRID_ROWS - 1) * CARGO_CELL_GAP,
    stride,
  };
}

function cellOriginLeft(col: number, cellSize: number = CARGO_CELL_SIZE): number {
  return col * (cellSize + CARGO_CELL_GAP);
}

function cellOriginTop(row: number, cellSize: number = CARGO_CELL_SIZE): number {
  return row * (cellSize + CARGO_CELL_GAP);
}

function DraggableCargoSprite({
  dragSource,
  isDragging,
  onHoverCell,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDropAttempt,
  combatSelectMode = false,
  combatSelected = false,
  onCombatSelect,
  originRow,
  originCol,
  cellSize = CARGO_CELL_SIZE,
}: {
  dragSource: CargoDragSource;
  isDragging: boolean;
  onHoverCell: (
    cell: { row: number; col: number } | null,
    itemId: CargoItemId | null,
    excludeInstanceId?: string,
  ) => void;
  onDragStart: (source: CargoDragSource) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  onDropAttempt: (
    source: CargoDragSource,
    absoluteX: number,
    absoluteY: number,
    dragged: boolean,
    originRow: number | undefined,
    originCol: number | undefined,
    onResult: (placed: boolean) => void,
  ) => void;
  combatSelectMode?: boolean;
  combatSelected?: boolean;
  onCombatSelect?: () => void;
  originRow?: number;
  originCol?: number;
  cellSize?: number;
}): React.JSX.Element {
  const spriteSize = spriteSizeForCargoItem(dragSource.itemId, cellSize);

  if (combatSelectMode && onCombatSelect) {
    return (
      <HapticPressable
        onPress={onCombatSelect}
        style={({ pressed }) => [
          spriteSize,
          styles.spriteWrap,
          styles.combatSelectPressable,
          combatSelected ? styles.combatItemSelectedWrap : null,
          pressed ? styles.combatItemPressed : null,
        ]}
      >
        <Image
          source={resolveCargoItemIcon(dragSource.itemId)}
          resizeMode="contain"
          style={[styles.lootSprite, spriteSize, combatSelected ? styles.combatItemSelected : null]}
        />
      </HapticPressable>
    );
  }

  const finishDrop = useCallback((
    absoluteX: number,
    absoluteY: number,
    translationX: number,
    translationY: number,
  ) => {
    const dragged = Math.hypot(translationX, translationY) >= 4;
    onDropAttempt(
      dragSource,
      absoluteX,
      absoluteY,
      dragged,
      originRow,
      originCol,
      (placed) => {
        if (!placed) {
          onDragEnd();
          return;
        }
        onDragEnd();
      },
    );
  }, [dragSource, onDragEnd, onDropAttempt, originCol, originRow]);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin((event) => {
      runOnJS(onDragStart)(dragSource);
      runOnJS(onDragMove)(event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(onDragMove)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(finishDrop)(
        event.absoluteX,
        event.absoluteY,
        event.translationX,
        event.translationY,
      );
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[spriteSize, styles.spriteWrap]}>
        {isDragging ? (
          <View style={styles.dragPlaceholder} pointerEvents="none" />
        ) : (
          <Image
            source={resolveCargoItemIcon(dragSource.itemId)}
            resizeMode="contain"
            style={[styles.lootSprite, spriteSize]}
          />
        )}
      </View>
    </GestureDetector>
  );
}

function ContainmentSlot({
  item,
  spriteSize,
  isDragging,
  source,
  onContainmentItemCenterMeasured,
  onHoverCell,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDropAttempt,
  combatMode,
  combatConsumablesEnabled,
  selectedCombatItemId,
  selectCombatItem,
}: {
  item: import('../types/cargoGrid').ContainmentItem;
  spriteSize: { width: number; height: number };
  isDragging: boolean;
  source: CargoDragSource;
  onContainmentItemCenterMeasured?: (instanceId: string, center: { x: number; y: number }) => void;
  onHoverCell: (
    cell: { row: number; col: number } | null,
    itemId: CargoItemId | null,
    excludeInstanceId?: string,
  ) => void;
  onDragStart: (source: CargoDragSource) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  onDropAttempt: (
    source: CargoDragSource,
    absoluteX: number,
    absoluteY: number,
    dragged: boolean,
    originRow: number | undefined,
    originCol: number | undefined,
    onResult: (placed: boolean) => void,
  ) => void;
  combatMode: boolean;
  combatConsumablesEnabled: boolean;
  selectedCombatItemId: CargoItemId | null;
  selectCombatItem: (itemId: CargoItemId) => void;
}): React.JSX.Element {
  const slotRef = useRef<View>(null);

  const reportCenter = useCallback(() => {
    if (!onContainmentItemCenterMeasured) return;
    slotRef.current?.measureInWindow((x, y, width, height) => {
      onContainmentItemCenterMeasured(item.instanceId, {
        x: x + width / 2,
        y: y + height / 2,
      });
    });
  }, [item.instanceId, onContainmentItemCenterMeasured]);

  useEffect(() => {
    reportCenter();
  }, [reportCenter]);

  return (
    <View
      ref={slotRef}
      onLayout={reportCenter}
      style={[styles.externalSlot, { width: spriteSize.width, height: spriteSize.height }]}
    >
      <DraggableCargoSprite
        dragSource={source}
        isDragging={isDragging}
        onHoverCell={onHoverCell}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDropAttempt={onDropAttempt}
        combatSelectMode={combatMode && combatConsumablesEnabled && isCombatDeployableCargoItem(item.itemId)}
        combatSelected={selectedCombatItemId === item.itemId}
        onCombatSelect={
          combatMode && combatConsumablesEnabled && isCombatDeployableCargoItem(item.itemId)
            ? () => selectCombatItem(item.itemId)
            : undefined
        }
      />
    </View>
  );
}

export default function CargoGridBoard({
  cargo,
  theme,
  accentColor = '#00ff33',
  onRelocateItem,
  onContinue,
  continueLabel = '[ CONTINUE ]',
  onUseAmpoule,
  onUseResonanceBribe,
  onUseDeadDrop,
  showDeadDropFieldTool = false,
  onUseAshSeal,
  onUseContainmentFoam,
  scannerMode = false,
  combatMode = false,
  combatConsumablesEnabled = true,
  onUseCombatConsumable,
  onDiscardItem,
  runCredits: runCreditsProp,
  playerActionPoints: playerActionPointsProp,
  showCreditsHud = true,
  minimal = true,
  onContainmentItemCenterMeasured,
  onHarvestFloorMeasured,
  fixedExternalSlotCount,
  resolveContainmentSlotIndex,
  stableExternalBay = false,
  hideContinueButton = false,
  externalHover = null,
  selectedPlacementItemId = null,
  onPlaceAtCell,
  onGridMetricsMeasured,
  onHubExternalDrop,
  onDragPositionChange,
  cellSize: cellSizeProp,
  overlayCompact = false,
  overlayCombatSplit = false,
  contentWidth,
  harvestTriPaneLayout = false,
  rightPaneHeader,
  leftPaneSlot,
  centerPaneFooter,
  leftPaneHeader,
  rightPaneSlot,
  leftPaneWidth,
  rightPaneWidth,
  cargoBackdrop = false,
}: CargoGridBoardProps): React.JSX.Element {
  const [harvestDeckSize, setHarvestDeckSize] = useState({ width: 0, height: 0 });
  const cellSize = useMemo(() => {
    if (
      harvestTriPaneLayout
      && harvestDeckSize.width > 0
      && harvestDeckSize.height > 0
    ) {
      return resolveHubLoadoutCellSize(
        harvestDeckSize.width,
        harvestDeckSize.height,
        HUB_CARGO_INCURSION_CELL_TARGET,
        HUB_CARGO_INCURSION_CELL_MAX,
      );
    }
    return cellSizeProp ?? CARGO_CELL_SIZE;
  }, [cellSizeProp, harvestDeckSize.height, harvestDeckSize.width, harvestTriPaneLayout]);
  const { isDesktop, scaleSpacing } = useResponsiveScale();
  const { fontScale } = useResponsiveLayout();
  const harvestPaneGap = scaleSpacing(HARVEST_TRI_PANE_GAP);
  const harvestCenterMargin = scaleSpacing(16);
  const harvestPanelPadding = scaleSpacing(24);
  const harvestMatPadding = scaleSpacing(HARVEST_CARGO_BACKING_PADDING);
  const resolvedRightPaneHeader = rightPaneHeader ?? leftPaneHeader;
  const resolvedLeftPaneSlot = leftPaneSlot ?? rightPaneSlot;
  const combatDetailHeight = overlayCompact ? 168 : COMBAT_DETAIL_PANEL_HEIGHT;
  const boardGap = overlayCompact ? 10 : undefined;
  const externalBayMarginTop = stableExternalBay
    ? HARVEST_EXTERNAL_BAY_MARGIN_TOP
    : overlayCompact
      ? 10
      : 28;
  const { frameWidth, frameHeight, stride } = useMemo(
    () => cargoGridFrameDimensions(cellSize),
    [cellSize],
  );
  const combatSplitWidths = useMemo(
    () => (overlayCombatSplit ? resolveCombatOverlaySplitWidths(frameWidth) : null),
    [frameWidth, overlayCombatSplit],
  );
  const combatLayoutWidth = combatSplitWidths
    ? combatSplitWidths.gridWidth + COMBAT_OVERLAY_SPLIT_GAP + combatSplitWidths.detailWidth
    : frameWidth;
  const combatTurn = useCombatTurnOptional();
  const runCredits = runCreditsProp ?? combatTurn?.runCredits ?? 0;
  const playerActionPoints = playerActionPointsProp ?? combatTurn?.playerActionPoints ?? 0;
  const boardRef = useRef<View>(null);
  const externalBayRef = useRef<View>(null);
  const dropZoneRef = useRef<View>(null);
  const gridRef = useRef<View>(null);
  const gridMetricsRef = useRef<GridMetrics | null>(null);
  const boardMetricsRef = useRef<GridMetrics | null>(null);
  const pendingDropRef = useRef<{ row: number; col: number } | null>(null);
  const dropTargetRef = useRef<{
    row: number;
    col: number;
    itemId: CargoItemId;
    excludeInstanceId?: string;
  } | null>(null);
  const hoverCellRef = useRef<{ row: number; col: number } | null>(null);
  const hoverItemIdRef = useRef<CargoItemId | null>(null);
  const hoverExcludeIdRef = useRef<string | undefined>(undefined);

  const [displayCargo, setDisplayCargo] = useState(cargo);
  const cargoRef = useRef(displayCargo);
  cargoRef.current = displayCargo;

  useEffect(() => {
    setDisplayCargo(cargo);
  }, [cargo]);

  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [hoverItemId, setHoverItemId] = useState<CargoItemId | null>(null);
  const [hoverExcludeId, setHoverExcludeId] = useState<string | undefined>(undefined);
  const activeDragRef = useRef<CargoDragSource | null>(null);
  const [activeDrag, setActiveDrag] = useState<CargoDragSource | null>(null);
  const [dragOverlay, setDragOverlay] = useState<{ x: number; y: number } | null>(null);
  const [selectedCombatItemId, setSelectedCombatItemId] = useState<CargoItemId | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<CargoDragSource | null>(null);
  const externalSlotCountRef = useRef(0);

  const dragGhostScale = useSharedValue(1);

  if (externalSlotCountRef.current === 0 && displayCargo.containment.length > 0) {
    externalSlotCountRef.current = displayCargo.containment.length;
  }
  const dynamicExternalSlotCount = Math.max(externalSlotCountRef.current, displayCargo.containment.length);
  const externalSlotCount = fixedExternalSlotCount ?? dynamicExternalSlotCount;

  const containmentBySlot = useMemo(() => {
    if (!fixedExternalSlotCount || !resolveContainmentSlotIndex) return null;
    const map = new Map<number, import('../types/cargoGrid').ContainmentItem>();
    displayCargo.containment.forEach((item) => {
      const slot = resolveContainmentSlotIndex(item.instanceId);
      if (slot != null) map.set(slot, item);
    });
    return map;
  }, [displayCargo.containment, fixedExternalSlotCount, resolveContainmentSlotIndex]);

  const hasAmpouleInGrid = displayCargo.grid.placed.some((item) => item.itemId === 'focusing-ampoule');

  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    displayCargo.grid.placed.forEach((item) => {
      if (activeDrag?.instanceId === item.instanceId) return;
      cellsForItem(item.itemId, item.originRow, item.originCol).forEach((key) => set.add(key));
    });
    return set;
  }, [activeDrag?.instanceId, displayCargo.grid.placed]);

  const previewCells = useMemo(() => {
    const hover = externalHover ?? (hoverCell && hoverItemId ? { itemId: hoverItemId, row: hoverCell.row, col: hoverCell.col } : null);
    if (!hover) {
      return { cells: new Set<string>(), valid: false };
    }
    const cells = new Set(cellsForPreview(hover.itemId, hover.row, hover.col));
    const valid = canPlaceCargoItemExcluding(
      displayCargo,
      hover.itemId,
      hover.row,
      hover.col,
      externalHover ? undefined : hoverExcludeId,
    );
    return { cells, valid };
  }, [displayCargo, externalHover, hoverCell, hoverExcludeId, hoverItemId]);

  const captureMetrics = useCallback(() => {
    gridRef.current?.measureInWindow((pageX, pageY, width, height) => {
      const metrics = { pageX, pageY, width, height, cellSize, cellGap: CARGO_CELL_GAP };
      gridMetricsRef.current = metrics;
      onGridMetricsMeasured?.(metrics);
    });
    boardRef.current?.measureInWindow((pageX, pageY, width, height) => {
      boardMetricsRef.current = { pageX, pageY, width, height };
    });
  }, [cellSize, onGridMetricsMeasured]);

  const reportHarvestFloor = useCallback(() => {
    if (!onHarvestFloorMeasured) return;
    const measureRef = harvestTriPaneLayout ? dropZoneRef : externalBayRef;
    measureRef.current?.measureInWindow((x, y, width, height) => {
      onHarvestFloorMeasured({ x, y, width, height });
    });
  }, [harvestTriPaneLayout, onHarvestFloorMeasured]);

  const handleDropZoneLayout = useCallback(() => {
    captureMetrics();
    reportHarvestFloor();
  }, [captureMetrics, reportHarvestFloor]);

  const handleGridLayout = useCallback((_event: LayoutChangeEvent) => {
    captureMetrics();
    reportHarvestFloor();
  }, [captureMetrics, reportHarvestFloor]);

  useLayoutEffect(() => {
    captureMetrics();
    reportHarvestFloor();
  }, [captureMetrics, displayCargo.containment.length, displayCargo.grid.placed.length, reportHarvestFloor]);

  const resolveCellFromAbsolute = useCallback((absoluteX: number, absoluteY: number) => {
    const metrics = gridMetricsRef.current;
    if (!metrics) return null;
    const stride = cellSize + CARGO_CELL_GAP;
    const localX = absoluteX - metrics.pageX;
    const localY = absoluteY - metrics.pageY;
    if (localX < 0 || localY < 0 || localX >= metrics.width || localY >= metrics.height) return null;
    const col = Math.floor(localX / stride);
    const row = Math.floor(localY / stride);
    if (row < 0 || col < 0 || row >= CARGO_GRID_ROWS || col >= CARGO_GRID_COLS) return null;
    return { row, col };
  }, [cellSize]);

  const resolveValidDropCell = useCallback((
    absoluteX: number,
    absoluteY: number,
    itemId: CargoItemId,
    excludeInstanceId?: string,
  ): { row: number; col: number } | null => {
    const currentCargo = cargoRef.current;
    const locked = dropTargetRef.current;

    if (
      locked
      && locked.itemId === itemId
      && canPlaceCargoItemExcluding(
        currentCargo,
        itemId,
        locked.row,
        locked.col,
        locked.excludeInstanceId ?? excludeInstanceId,
      )
    ) {
      return { row: locked.row, col: locked.col };
    }

    const hover = hoverCellRef.current;
    const hoverItem = hoverItemIdRef.current;
    const hoverExclude = hoverExcludeIdRef.current;

    if (
      hover
      && hoverItem === itemId
      && canPlaceCargoItemExcluding(currentCargo, itemId, hover.row, hover.col, hoverExclude ?? excludeInstanceId)
    ) {
      return hover;
    }

    const pending = pendingDropRef.current;
    if (
      pending
      && canPlaceCargoItemExcluding(currentCargo, itemId, pending.row, pending.col, excludeInstanceId)
    ) {
      return pending;
    }

    const fromFinger = resolveCellFromAbsolute(absoluteX, absoluteY);
    if (
      fromFinger
      && canPlaceCargoItemExcluding(currentCargo, itemId, fromFinger.row, fromFinger.col, excludeInstanceId)
    ) {
      return fromFinger;
    }
    return null;
  }, [cellSize, resolveCellFromAbsolute]);

  const handleHoverCell = useCallback((
    cell: { row: number; col: number } | null,
    itemId: CargoItemId | null,
    excludeInstanceId?: string,
  ) => {
    setHoverCell(cell);
    setHoverItemId(itemId);
    setHoverExcludeId(excludeInstanceId);
    hoverCellRef.current = cell;
    hoverItemIdRef.current = itemId;
    hoverExcludeIdRef.current = excludeInstanceId;
    if (
      cell
      && itemId
      && canPlaceCargoItemExcluding(cargoRef.current, itemId, cell.row, cell.col, excludeInstanceId)
    ) {
      pendingDropRef.current = { row: cell.row, col: cell.col };
      dropTargetRef.current = {
        row: cell.row,
        col: cell.col,
        itemId,
        excludeInstanceId,
      };
    }
  }, []);

  const handleDragStart = useCallback((source: CargoDragSource) => {
    pulseCargoItemPickup();
    pendingDropRef.current = null;
    dropTargetRef.current = null;
    activeDragRef.current = source;
    captureMetrics();
    requestAnimationFrame(() => captureMetrics());
    dragGhostScale.value = withSpring(1.08);
    setActiveDrag(source);
  }, [captureMetrics, dragGhostScale]);

  const reportDragPosition = useCallback((absoluteX: number, absoluteY: number) => {
    const source = activeDragRef.current;
    if (!source || !onDragPositionChange) return;
    onDragPositionChange({ source, x: absoluteX, y: absoluteY });
  }, [onDragPositionChange]);

  const clearDrag = useCallback(() => {
    pendingDropRef.current = null;
    dropTargetRef.current = null;
    hoverCellRef.current = null;
    hoverItemIdRef.current = null;
    hoverExcludeIdRef.current = undefined;
    activeDragRef.current = null;
    dragGhostScale.value = withTiming(1, { duration: REJECT_SNAP_MS });
    setActiveDrag(null);
    setDragOverlay(null);
    setHoverCell(null);
    setHoverItemId(null);
    setHoverExcludeId(undefined);
    onDragPositionChange?.(null);
  }, [dragGhostScale, onDragPositionChange]);

  const selectCombatItem = useCallback((itemId: CargoItemId) => {
    pulseCargoItemSelect();
    setSelectedCombatItemId(itemId);
  }, []);

  const handleDragMove = useCallback((absoluteX: number, absoluteY: number) => {
    const source = activeDragRef.current;
    const board = boardMetricsRef.current;
    if (board) {
      setDragOverlay({ x: absoluteX - board.pageX, y: absoluteY - board.pageY });
    }
    reportDragPosition(absoluteX, absoluteY);
    const cell = resolveCellFromAbsolute(absoluteX, absoluteY);
    if (!cell || !source) {
      handleHoverCell(null, null);
      return;
    }
    handleHoverCell(
      cell,
      source.itemId,
      source.source === 'grid' ? source.instanceId : undefined,
    );
  }, [handleHoverCell, reportDragPosition, resolveCellFromAbsolute]);

  const handleDropAttempt = useCallback((
    source: CargoDragSource,
    absoluteX: number,
    absoluteY: number,
    dragged: boolean,
    originRow: number | undefined,
    originCol: number | undefined,
    onResult: (placed: boolean) => void,
  ) => {
    captureMetrics();

    if (!dragged) {
      clearDrag();
      onResult(false);
      return;
    }

    if (onHubExternalDrop?.(source, absoluteX, absoluteY)) {
      clearDrag();
      onResult(true);
      return;
    }

    const excludeId = source.source === 'grid' ? source.instanceId : undefined;
    const cell = resolveValidDropCell(absoluteX, absoluteY, source.itemId, excludeId);

    if (!cell) {
      clearDrag();
      if (onDiscardItem) {
        setPendingDiscard(source);
        return;
      }
      onResult(false);
      return;
    }

    if (source.source === 'grid' && originRow === cell.row && originCol === cell.col) {
      clearDrag();
      onResult(false);
      return;
    }

    const snapshot = cargoRef.current;
    const optimisticNext = relocateCargoInState(snapshot, source.instanceId, cell.row, cell.col);
    if (!optimisticNext) {
      clearDrag();
      onResult(false);
      return;
    }

    clearDrag();
    setDisplayCargo(optimisticNext);
    cargoRef.current = optimisticNext;

    const placed = onRelocateItem(source.instanceId, cell.row, cell.col);
    if (!placed) {
      setDisplayCargo(snapshot);
      cargoRef.current = snapshot;
    }
    onResult(placed);
  }, [captureMetrics, clearDrag, onDiscardItem, onHubExternalDrop, onRelocateItem, resolveValidDropCell]);

  const selectedApCost = selectedCombatItemId ? combatConsumableApCost(selectedCombatItemId) : 2;
  const canAffordConsumableAp = playerActionPoints >= selectedApCost;
  const combatUseEnabled = combatConsumablesEnabled
    && selectedCombatItemId != null
    && canAffordConsumableAp;

  const ghostAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dragGhostScale.value }],
  }));

  const handleHarvestDeckLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHarvestDeckSize((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  }, []);

  const gridBlock = (
    <View
      ref={gridRef}
      onLayout={handleGridLayout}
      style={[
        styles.gridFrame,
        { width: frameWidth, height: frameHeight },
      ]}
    >
      <View style={[styles.cellsLayer, { gap: CARGO_CELL_GAP }]}>
        {Array.from({ length: CARGO_GRID_ROWS }, (_, row) =>
          Array.from({ length: CARGO_GRID_COLS }, (_, col) => {
            const key = `${row},${col}`;
            const occupied = occupiedCells.has(key);
            const isPreview = previewCells.cells.has(key);
            const canDrop = isPreview && previewCells.valid;

            return (
              <HapticPressable
                key={key}
                disabled={!selectedPlacementItemId || !onPlaceAtCell}
                onPress={() => onPlaceAtCell?.(row, col)}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderColor: isPreview
                      ? (canDrop ? accentColor : '#ef4444')
                      : harvestTriPaneLayout && cargoBackdrop
                        ? theme.borderColor
                        : harvestTriPaneLayout
                          ? HARVEST_GRID_CELL_BORDER
                          : theme.borderColor,
                    backgroundColor: harvestTriPaneLayout && cargoBackdrop
                      ? resolveCargoGridCellBackground({
                        occupied,
                        isPreview,
                        canDrop,
                        cargoBackdrop: true,
                      })
                      : harvestTriPaneLayout
                        ? resolveHarvestGridCellBackground({
                          occupied,
                          isPreview,
                          canDrop,
                          accentColor,
                        })
                        : resolveCargoGridCellBackground({
                          occupied,
                          isPreview,
                          canDrop,
                          cargoBackdrop,
                        }),
                  },
                ]}
              />
            );
          }),
        )}
      </View>

      <View style={[styles.placedLayer, combatMode ? styles.placedLayerCombat : null]} pointerEvents="box-none">
        {displayCargo.grid.placed.map((item: PlacedCargoItem) => {
          const deployable = isCombatDeployableCargoItem(item.itemId);
          const selectMode = combatMode && combatConsumablesEnabled && deployable;
          const source: CargoDragSource = { instanceId: item.instanceId, itemId: item.itemId, source: 'grid' };
          const spriteSize = spriteSizeForCargoItem(item.itemId, cellSize);
          const isDragging = activeDrag?.instanceId === item.instanceId;

          return (
            <View
              key={`${item.instanceId}@${item.originRow},${item.originCol}`}
              style={[
                styles.placedItemAnchor,
                {
                  left: cellOriginLeft(item.originCol, cellSize),
                  top: cellOriginTop(item.originRow, cellSize),
                  width: spriteSize.width,
                  height: spriteSize.height,
                },
              ]}
              pointerEvents="box-none"
            >
              <DraggableCargoSprite
                dragSource={source}
                isDragging={isDragging}
                originRow={item.originRow}
                originCol={item.originCol}
                cellSize={cellSize}
                onHoverCell={handleHoverCell}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={clearDrag}
                onDropAttempt={handleDropAttempt}
                combatSelectMode={selectMode}
                combatSelected={selectedCombatItemId === item.itemId}
                onCombatSelect={selectMode ? () => selectCombatItem(item.itemId) : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );

  const overlaySprite = activeDrag && dragOverlay
    ? spriteSizeForCargoItem(activeDrag.itemId, cellSize)
    : null;

  const layoutWidth = overlayCombatSplit ? combatLayoutWidth : frameWidth;

  const combatDetailPanel = combatMode && onUseCombatConsumable ? (
    <View
      style={[
        styles.combatDetailPanel,
        {
          borderColor: theme.borderColor,
          height: overlayCombatSplit ? frameHeight : combatDetailHeight,
          width: overlayCombatSplit
            ? combatSplitWidths?.detailWidth
            : frameWidth,
          flex: undefined,
          minWidth: overlayCombatSplit ? 0 : undefined,
          flexShrink: overlayCombatSplit ? 0 : undefined,
        },
      ]}
    >
      <View
        style={[
          styles.combatDetailInner,
          overlayCombatSplit ? styles.combatDetailInnerSplit : null,
        ]}
      >
        <View style={styles.combatDetailTitleSlot}>
          <Text
            style={[
              styles.combatDetailTitle,
              { color: selectedCombatItemId ? accentColor : theme.mutedColor },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {selectedCombatItemId
              ? CARGO_ITEM_CATALOG[selectedCombatItemId].name.toUpperCase()
              : 'AWAITING SELECTION'}
          </Text>
        </View>

        <View
          style={[
            styles.combatDetailBodySlot,
            overlayCombatSplit ? styles.combatDetailBodySlotSplit : null,
          ]}
        >
          <Text
            style={[
              styles.combatDetailBody,
              { color: selectedCombatItemId ? theme.primaryColor : theme.mutedColor },
            ]}
            numberOfLines={overlayCombatSplit ? 5 : 3}
            ellipsizeMode="tail"
          >
            {selectedCombatItemId
              ? combatConsumableDescription(selectedCombatItemId)
              : 'TAP A COMBAT ITEM IN THE GRID TO REVIEW AND DEPLOY.'}
          </Text>
        </View>

        <View style={styles.combatDetailMetaSlot}>
          <Text
            style={[styles.combatDetailMeta, { color: theme.mutedColor }]}
            numberOfLines={1}
          >
            {selectedCombatItemId
              ? `OWNED: ${countCargoItemInstances(displayCargo, selectedCombatItemId)} // COST: ${selectedApCost} AP`
              : ' '}
          </Text>
        </View>

        <HapticPressable
          disabled={!combatUseEnabled}
          onPress={() => {
            if (!selectedCombatItemId || !combatUseEnabled) return;
            pulseCargoItemUse();
            const ok = onUseCombatConsumable(selectedCombatItemId);
            if (ok) setSelectedCombatItemId(null);
          }}
          style={({ pressed }) => [
            styles.ampouleBtn,
            styles.deployBtn,
            {
              borderColor: combatUseEnabled ? accentColor : '#1a2e22',
              opacity: combatUseEnabled && pressed
                ? 0.75
                : combatUseEnabled
                  ? 1
                  : 0.45,
            },
          ]}
        >
          <Text
            style={[
              styles.ampouleBtnText,
              { color: combatUseEnabled ? accentColor : '#2a4032' },
            ]}
            numberOfLines={1}
          >
            [ USE ITEM ]
          </Text>
        </HapticPressable>
      </View>
    </View>
  ) : null;

  const externalBayNode = externalSlotCount > 0 ? (
    <View
      ref={harvestTriPaneLayout ? undefined : externalBayRef}
      onLayout={harvestTriPaneLayout ? undefined : reportHarvestFloor}
      style={[
        styles.externalBay,
        stableExternalBay ? styles.externalBayStable : null,
        harvestTriPaneLayout ? styles.externalBayTriPane : null,
        stableExternalBay && !harvestTriPaneLayout ? { height: harvestExternalBayHeight(cellSize) } : null,
        { marginTop: harvestTriPaneLayout ? 0 : externalBayMarginTop },
      ]}
    >
      <View
        style={[
          styles.externalRow,
          stableExternalBay ? {
            width: externalSlotCount * cellSize + (externalSlotCount - 1) * 20,
            alignSelf: 'center',
            justifyContent: 'flex-start',
          } : null,
          harvestTriPaneLayout ? styles.externalRowTriPane : null,
        ]}
      >
        {Array.from({ length: externalSlotCount }, (_, slotIndex) => {
            const item = containmentBySlot
              ? (containmentBySlot.get(slotIndex) ?? null)
              : (displayCargo.containment[slotIndex] ?? null);
            if (!item) {
              return (
                <View
                  key={`empty-slot-${slotIndex}`}
                  style={[styles.externalSlot, { width: cellSize, height: cellSize }]}
                />
              );
            }
            const spriteSize = spriteSizeForCargoItem(item.itemId, cellSize);
            const source: CargoDragSource = {
              instanceId: item.instanceId,
              itemId: item.itemId,
              source: 'containment',
            };
            const isDragging = activeDrag?.instanceId === item.instanceId;
            return (
              <ContainmentSlot
                key={`external-slot-${slotIndex}`}
                item={item}
                spriteSize={spriteSize}
                isDragging={isDragging}
                source={source}
                onContainmentItemCenterMeasured={onContainmentItemCenterMeasured}
                onHoverCell={handleHoverCell}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={clearDrag}
                onDropAttempt={handleDropAttempt}
                combatMode={combatMode}
                combatConsumablesEnabled={combatConsumablesEnabled}
                selectedCombatItemId={selectedCombatItemId}
                selectCombatItem={selectCombatItem}
              />
            );
          })}
      </View>
    </View>
  ) : null;

  const dragGhostOverlay = activeDrag && dragOverlay && overlaySprite ? (
    <View style={styles.dragOverlayLayer} pointerEvents="none">
      <Animated.View
        style={[
          ghostAnimatedStyle,
          {
            position: 'absolute',
            left: dragOverlay.x - overlaySprite.width / 2,
            top: dragOverlay.y - overlaySprite.height / 2,
            width: overlaySprite.width,
            height: overlaySprite.height,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Image
          source={resolveCargoItemIcon(activeDrag.itemId)}
          resizeMode="contain"
          style={[styles.lootSprite, overlaySprite]}
        />
      </Animated.View>
    </View>
  ) : null;

  const postBoardControls = (
    <>
      {scannerMode && hasAmpouleInGrid && onUseAmpoule ? (
        <HapticPressable
          onPress={() => {
            pulseCargoItemUse();
            onUseAmpoule();
          }}
          style={[styles.ampouleBtn, { borderColor: accentColor }]}
        >
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE FOCUSING AMPOULE — +1 ATTUNEMENT ]
          </Text>
        </HapticPressable>
      ) : null}

      {scannerMode && onUseResonanceBribe && countCargoItemInstances(displayCargo, 'resonance-bribe') > 0 ? (
        <HapticPressable
          onPress={() => {
            pulseCargoItemUse();
            onUseResonanceBribe();
          }}
          style={[styles.ampouleBtn, { borderColor: accentColor }]}
        >
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE RESONANCE BRIBE — −25% RESONANCE ]
          </Text>
        </HapticPressable>
      ) : null}

      {scannerMode && onUseDeadDrop && (showDeadDropFieldTool || countCargoItemInstances(displayCargo, 'dead-drop-token') > 0) ? (
        <HapticPressable
          onPress={() => {
            pulseCargoItemUse();
            onUseDeadDrop();
          }}
          style={[styles.ampouleBtn, { borderColor: accentColor }]}
        >
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE DEAD-DROP TOKEN — VAULT EXTRACT ]
          </Text>
        </HapticPressable>
      ) : null}

      {scannerMode && onUseAshSeal ? (
        <HapticPressable
          onPress={() => {
            pulseCargoItemUse();
            onUseAshSeal();
          }}
          style={[styles.ampouleBtn, { borderColor: accentColor }]}
        >
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE ASH-SEAL — DAMPEN UNSTABLE CARGO ]
          </Text>
        </HapticPressable>
      ) : null}

      {scannerMode && onUseContainmentFoam ? (
        <HapticPressable
          onPress={() => {
            pulseCargoItemUse();
            onUseContainmentFoam();
          }}
          style={[styles.ampouleBtn, { borderColor: accentColor }]}
        >
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE CONTAINMENT FOAM — PROTECT CARGO ]
          </Text>
        </HapticPressable>
      ) : null}

      {!overlayCombatSplit ? combatDetailPanel : null}

      {onContinue && !hideContinueButton ? (
        <HapticPressable
          onPress={onContinue}
          style={({ pressed }) => [
            getInteractiveButtonStyle(accentColor, { pressed, size: 'md' }),
            styles.continueBtn,
            pressed ? { opacity: 0.85 } : null,
          ]}
        >
          <Text style={[getInteractiveButtonTextStyle('md'), styles.continueBtnText, { color: accentColor }]}>
            {continueLabel}
          </Text>
        </HapticPressable>
      ) : null}

      <CargoDiscardConfirmOverlay
        visible={pendingDiscard != null}
        itemName={pendingDiscard ? CARGO_ITEM_CATALOG[pendingDiscard.itemId].name : ''}
        theme={theme}
        accentColor={accentColor}
        onConfirm={() => {
          if (!pendingDiscard || !onDiscardItem) return;
          onDiscardItem(pendingDiscard.instanceId);
          setPendingDiscard(null);
        }}
        onCancel={() => setPendingDiscard(null)}
      />
    </>
  );

  if (harvestTriPaneLayout) {
    return (
      <View style={[styles.root, styles.rootHarvestTriPane, { width: '100%' }]}>
        {showCreditsHud ? (
          <CargoCreditsHud credits={runCredits} accentColor={accentColor} style={styles.creditsHud} />
        ) : null}

        <View
          ref={boardRef}
          onLayout={captureMetrics}
          style={[styles.harvestTriPaneRow, { gap: harvestPaneGap }, !isDesktop ? styles.harvestTriPaneRowMobile : null]}
        >
          <View
            style={[
              styles.harvestLeftPane,
              isDesktop
                ? styles.harvestLeftPaneDesktop
                : leftPaneWidth != null
                  ? { width: leftPaneWidth }
                  : null,
              isDesktop ? { flex: HARVEST_DESKTOP_LEFT_FLEX } : null,
            ]}
          >
            {resolvedLeftPaneSlot}
          </View>

          <View
            ref={dropZoneRef}
            onLayout={handleDropZoneLayout}
            style={[
              styles.harvestCenterPane,
              {
                marginHorizontal: harvestCenterMargin,
                borderRadius: scaleSpacing(8),
              },
              isDesktop ? { flex: HARVEST_DESKTOP_CENTER_FLEX } : null,
            ]}
          >
            <Text
              style={[
                styles.containmentLabel,
                {
                  color: HARVEST_MUTED_SLATE,
                  fontSize: 9 * fontScale,
                  lineHeight: 13 * fontScale,
                },
              ]}
            >
              [ CONTAINMENT FIELD ]
            </Text>
            <Text
              style={[
                styles.containmentSubLabel,
                {
                  color: HARVEST_MUTED_SLATE,
                  fontSize: 7 * fontScale,
                  lineHeight: 11 * fontScale,
                },
              ]}
            >
              UNPACKED ANOMALY FRAGMENTS // DRAG TO CARGO DECK
            </Text>
            <View style={styles.containmentLootArea}>
              {externalBayNode}
            </View>
            {centerPaneFooter ? (
              <View style={styles.centerPaneFooter}>
                {centerPaneFooter}
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.harvestRightPane,
              isDesktop
                ? styles.harvestRightPaneDesktop
                : rightPaneWidth != null
                  ? { width: rightPaneWidth }
                  : null,
              isDesktop ? { flex: HARVEST_DESKTOP_RIGHT_FLEX } : null,
            ]}
          >
            <DossierCardShell
              fillHeight
              padding={harvestPanelPadding}
              accentColor={accentColor}
              style={styles.harvestCargoShell}
              contentStyle={styles.harvestCargoContent}
            >
              {resolvedRightPaneHeader}
              <View
                style={styles.harvestCargoMatSlot}
                onLayout={handleHarvestDeckLayout}
              >
                <View
                  style={[
                    styles.harvestGridBackdropHost,
                    cargoBackdrop ? styles.harvestGridBackdropHostTextured : null,
                    {
                      width: frameWidth + harvestMatPadding * 4,
                      height: frameHeight + harvestMatPadding * 4,
                      padding: harvestMatPadding,
                    },
                  ]}
                >
                  {cargoBackdrop ? <CargoGridBackdrop /> : null}
                  <View style={[styles.boardShell, { width: frameWidth }]}>
                    <View style={styles.gridDock}>{gridBlock}</View>
                  </View>
                </View>
              </View>
            </DossierCardShell>
          </View>

          {dragGhostOverlay}
        </View>

        {postBoardControls}
      </View>
    );
  }

  return (
    <View style={[
      styles.root,
      minimal && styles.rootMinimal,
      overlayCompact && styles.rootOverlayCompact,
      overlayCombatSplit ? styles.rootCombatSplit : styles.rootCentered,
      { width: layoutWidth, gap: boardGap ?? (cellSize < 48 ? 8 : undefined) },
    ]}>
      {showCreditsHud ? (
        <CargoCreditsHud credits={runCredits} accentColor={accentColor} style={styles.creditsHud} />
      ) : null}

      <View
        ref={boardRef}
        onLayout={captureMetrics}
        style={[
          styles.boardShell,
          { width: layoutWidth },
          overlayCombatSplit ? styles.boardShellCombatSplit : null,
        ]}
      >
        <View
          style={[
            styles.gridDock,
            overlayCombatSplit ? styles.gridDockSplit : null,
            combatSplitWidths ? { width: combatSplitWidths.gridWidth } : null,
          ]}
        >
          {gridBlock}
        </View>

        {overlayCombatSplit ? combatDetailPanel : null}

        {externalBayNode}

        {dragGhostOverlay}
      </View>

      {postBoardControls}
    </View>
  );
}

function cellsForPreview(itemId: CargoItemId, originRow: number, originCol: number): string[] {
  return cellsForItem(itemId, originRow, originCol);
}

const styles = StyleSheet.create({
  root: {
    gap: 24,
    alignItems: 'center',
    position: 'relative',
  },
  rootCentered: {
    alignSelf: 'center',
  },
  rootCombatSplit: {
    alignSelf: 'stretch',
  },
  rootMinimal: {
    gap: 28,
  },
  rootOverlayCompact: {
    gap: 10,
  },
  rootHarvestTriPane: {
    flex: 1,
    minHeight: 0,
    gap: 0,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
  },
  harvestTriPaneRow: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
    overflow: 'visible',
  },
  harvestTriPaneRowMobile: {
    flexDirection: 'column',
  },
  harvestLeftPane: {
    flexShrink: 0,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  harvestLeftPaneDesktop: {
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  cargoPackBacking: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'rgba(5, 6, 8, 0.84)',
    borderWidth: 1,
    padding: 12,
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cargoPackBackingTextured: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 6, 8, 0.55)',
  },
  cargoPackBackingDesktop: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  harvestCenterPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: HARVEST_CONTAINMENT_BORDER,
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  containmentLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.9,
    textAlign: 'center',
    zIndex: 1,
  },
  containmentSubLabel: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    zIndex: 1,
  },
  containmentLootArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    overflow: 'visible',
  },
  centerPaneFooter: {
    width: '100%',
    flexShrink: 0,
    zIndex: 1,
    marginTop: 'auto',
  },
  harvestCargoShell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  harvestCargoContent: {
    flex: 1,
    minHeight: 0,
    gap: 8,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  harvestCargoMatSlot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  harvestGridBackdropHost: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
  },
  harvestGridBackdropHostTextured: {
    backgroundColor: 'rgba(5, 6, 8, 0.55)',
  },
  dropZoneLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  harvestRightPane: {
    flexShrink: 0,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  harvestRightPaneDesktop: {
    flexShrink: 1,
    minWidth: 0,
  },
  creditsHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 30,
  },
  boardShell: {
    width: CARGO_GRID_FRAME_SIZE,
    position: 'relative',
    overflow: 'visible',
  },
  boardShellCombatSplit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: COMBAT_OVERLAY_SPLIT_GAP,
  },
  gridDock: {
    alignItems: 'center',
  },
  gridDockSplit: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gridFrame: {
    position: 'relative',
    overflow: 'visible',
  },
  cellsLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARGO_CELL_GAP,
    zIndex: 1,
  },
  cell: {
    width: CARGO_CELL_SIZE,
    height: CARGO_CELL_SIZE,
    borderWidth: 1,
  },
  placedLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 2,
  },
  placedLayerCombat: {
    zIndex: 4,
  },
  placedItemAnchor: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragOverlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    overflow: 'visible',
  },
  dragPlaceholder: {
    width: '100%',
    height: '100%',
  },
  combatSelectPressable: {
    zIndex: 5,
  },
  combatItemSelectedWrap: {
    borderWidth: 1,
    borderColor: '#00ff33',
    backgroundColor: 'rgba(0, 255, 51, 0.1)',
  },
  combatItemPressed: {
    opacity: 0.8,
  },
  externalBay: {
    minHeight: 72,
    justifyContent: 'center',
    width: '100%',
    gap: 8,
    marginTop: 28,
  },
  externalBayStable: {
    minHeight: undefined,
    marginTop: HARVEST_EXTERNAL_BAY_MARGIN_TOP,
  },
  externalBayTriPane: {
    marginTop: 0,
    minHeight: undefined,
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  externalRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  externalRowTriPane: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    alignSelf: 'center',
  },
  externalSlot: {
    width: CARGO_CELL_SIZE,
    height: CARGO_CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spriteWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  combatItemSelected: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  lootSprite: {
    backgroundColor: 'transparent',
  },
  combatDetailPanel: {
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
  },
  combatDetailInner: {
    padding: 10,
    gap: 6,
    justifyContent: 'flex-start',
  },
  combatDetailInnerSplit: {
    flex: 1,
    justifyContent: 'space-between',
  },
  combatDetailTitleSlot: {
    height: COMBAT_DETAIL_TITLE_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  combatDetailTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  combatDetailBodySlot: {
    height: COMBAT_DETAIL_BODY_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  combatDetailBodySlotSplit: {
    flex: 1,
    height: undefined,
    justifyContent: 'center',
  },
  combatDetailBody: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 13,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  combatDetailMetaSlot: {
    height: COMBAT_DETAIL_META_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  combatDetailMeta: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  deployBtn: {
    marginTop: 0,
    minHeight: 34,
    justifyContent: 'center',
  },
  ampouleBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#050608',
  },
  ampouleBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  continueBtn: {
    width: CARGO_GRID_FRAME_SIZE,
    alignSelf: 'center',
  },
  continueBtnText: {
    textAlign: 'center',
  },
});
