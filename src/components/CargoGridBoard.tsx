import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import HapticPressable from './HapticPressable';
import { RUN_FIELD } from '../theme/runFieldTokens';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import CargoItemInspectPanel, {
  type CargoItemInspectAnchor,
} from './cargo/CargoItemInspectPanel';
import { resolveCargoItemInspectInfo } from '../utils/cargoItemInspect';
import { COMBAT_HUD_TYPE } from '../constants/combatHudTypography';

const REJECT_SNAP_MS = 140;
const COMBAT_DETAIL_PANEL_HEIGHT = 200;
const COMBAT_DETAIL_TITLE_HEIGHT = 24;
const COMBAT_DETAIL_BODY_HEIGHT = 56;
const COMBAT_DETAIL_META_HEIGHT = 18;
import {
  canMergeCargoAtCell,
  canPlaceCargoItemExcluding,
  combatConsumableApCost,
  combatConsumableDescription,
  findPlacedItemAtCell,
  isCombatDeployableCargoItem,
  relocateCargoItem as relocateCargoInState,
  returnCargoToContainment as returnCargoToContainmentInState,
  replaceCargoAtCell as replaceCargoInState,
} from '../data/cargoGridEngine';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import type { CargoItemId, CargoRunState, PlacedCargoItem } from '../types/cargoGrid';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS, CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import { resolveCargoGridCellBackground } from '../constants/cargoGridVisual';
import {
  HARVEST_CARGO_BORDER,
  HARVEST_CARGO_SURFACE,
  HARVEST_MUTED_SLATE,
  HARVEST_PHOSPHOR,
  HARVEST_STATUS_STRIP_BG,
  HARVEST_TEXT_PRIMARY,
  HARVEST_VEIL_VIOLET,
  resolveHarvestGridCellBackground,
  resolveHarvestGridCellBorder,
} from '../constants/harvestScreenVisual';
import CargoGridBackdrop from './cargo/CargoGridBackdrop';
import ContainmentFieldAtmosphere from './harvest/ContainmentFieldAtmosphere';
import { pointInWindowRect, resolveHubLoadoutCellSize } from '../utils/cargoGridLayout';
import {
  HARVEST_CARGO_BACKING_PADDING,
  HARVEST_CARGO_CONSOLE_MAX_PCT,
  HARVEST_CARGO_CONSOLE_WIDTH_CSS,
  HARVEST_CARGO_CONSOLE_WIDTH_NATIVE,
  HARVEST_CELL_GAP,
  HARVEST_CELL_SIZE_MAX,
  HARVEST_CELL_SIZE_MIN,
  HARVEST_CELL_SIZE_VH,
  HARVEST_DESKTOP_CENTER_FLEX,
  HARVEST_DESKTOP_RIGHT_FLEX,
  HARVEST_EXTERNAL_BAY_MARGIN_TOP,
  HARVEST_EXTRACTOR_DOCK_BOTTOM,
  HARVEST_EXTRACTOR_DOCK_LEFT,
  HARVEST_STATUS_STRIP_HEIGHT,
  HARVEST_TRI_PANE_GAP,
  harvestExternalBayHeight,
  resolveHarvestExtractorExcludeZone,
} from '../constants/harvestLayout';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
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
import CargoLootPickupOverlay from './CargoLootPickupOverlay';
import { isRouteIntelResourceId } from '../data/sectorAccessMandateEngine';
import {
  cargoItemQuantity,
  getCargoStackCap,
  isProgressionProtectedCargo,
  isRareOrApexCargo,
  unitCargoValue,
} from '../data/cargoStackEngine';
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
import {
  poseOverlapsExcludeZone,
  scatterRectsInBounds,
  type ScatterPose,
} from '../utils/harvestScatter';

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
  /** Phase 2A.1 — jettison occupant and place source at cell. */
  onReplaceItem?: (instanceId: string, row: number, col: number) => boolean;
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
  /** Harvest — return a grid item to the containment field floor. */
  onReturnToContainment?: (instanceId: string) => boolean;
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
  /** Harvest two-zone: containment workspace + cargo console. */
  harvestTriPaneLayout?: boolean;
  /** Cargo console header — rendered in the right rail. */
  rightPaneHeader?: React.ReactNode;
  /** Docked Veil extractor module inside the containment workspace. */
  leftPaneSlot?: React.ReactNode;
  /** Sticky CTA footer in the cargo console. */
  centerPaneFooter?: React.ReactNode;
  /** Bottom telemetry strip inside the containment workspace. */
  workspaceStatusStrip?: React.ReactNode;
  /** Live residue particle count for containment terminology. */
  residueLooseCount?: number;
  /** Contextual readout below the cargo grid. */
  cargoReadout?: React.ReactNode;
  /** Harvest: selected stored cargo instance for rail readout. */
  selectedHarvestInstanceId?: string | null;
  onHarvestCargoSelect?: (instanceId: string | null) => void;
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
  cellGap: number = CARGO_CELL_GAP,
): { width: number; height: number } {
  const def = CARGO_ITEM_CATALOG[itemId];
  return {
    width: def.width * cellSize + (def.width - 1) * cellGap,
    height: def.height * cellSize + (def.height - 1) * cellGap,
  };
}

export function cargoGridFrameDimensions(
  cellSize: number = CARGO_CELL_SIZE,
  cellGap: number = CARGO_CELL_GAP,
): {
  frameWidth: number;
  frameHeight: number;
  stride: number;
} {
  const stride = cellSize + cellGap;
  return {
    frameWidth: CARGO_GRID_COLS * cellSize + (CARGO_GRID_COLS - 1) * cellGap,
    frameHeight: CARGO_GRID_ROWS * cellSize + (CARGO_GRID_ROWS - 1) * cellGap,
    stride,
  };
}

function cellOriginLeft(
  col: number,
  cellSize: number = CARGO_CELL_SIZE,
  cellGap: number = CARGO_CELL_GAP,
): number {
  return col * (cellSize + cellGap);
}

function cellOriginTop(
  row: number,
  cellSize: number = CARGO_CELL_SIZE,
  cellGap: number = CARGO_CELL_GAP,
): number {
  return row * (cellSize + cellGap);
}

function formatStackBadge(itemId: CargoItemId, quantity: number): string | null {
  const cap = getCargoStackCap(itemId);
  if (cap <= 1 && quantity <= 1) return null;
  if (cap <= 1) return `×${quantity}`;
  return `${quantity} / ${cap}`;
}

type CargoInspectHoverPayload = {
  instanceId: string;
  itemId: CargoItemId;
  quantity: number;
  unitValue: number;
  anchor: CargoItemInspectAnchor;
};

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
  cellGap = CARGO_CELL_GAP,
  stackBadge = null,
  accentColor = '#62CDB5',
  inspectQuantity = 1,
  inspectUnitValue,
  onInspectHover,
  onInspectLeave,
  harvestSelected = false,
  harvestBadge = false,
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
  cellGap?: number;
  stackBadge?: string | null;
  accentColor?: string;
  inspectQuantity?: number;
  inspectUnitValue?: number;
  onInspectHover?: (payload: CargoInspectHoverPayload) => void;
  onInspectLeave?: (instanceId: string) => void;
  harvestSelected?: boolean;
  harvestBadge?: boolean;
}): React.JSX.Element {
  const spriteSize = spriteSizeForCargoItem(dragSource.itemId, cellSize, cellGap);
  const hostRef = useRef<View>(null);

  const reportInspectHover = useCallback(() => {
    if (!onInspectHover || isDragging) return;
    hostRef.current?.measureInWindow((x, y, width, height) => {
      onInspectHover({
        instanceId: dragSource.instanceId,
        itemId: dragSource.itemId,
        quantity: inspectQuantity,
        unitValue: inspectUnitValue ?? CARGO_ITEM_CATALOG[dragSource.itemId].baseValue,
        anchor: { x, y, width, height },
      });
    });
  }, [
    dragSource.instanceId,
    dragSource.itemId,
    inspectQuantity,
    inspectUnitValue,
    isDragging,
    onInspectHover,
  ]);

  const clearInspectHover = useCallback(() => {
    onInspectLeave?.(dragSource.instanceId);
  }, [dragSource.instanceId, onInspectLeave]);

  const hoverHandlers = (
    Platform.OS === 'web'
      ? {
          onMouseEnter: reportInspectHover,
          onMouseLeave: clearInspectHover,
        }
      : {
          onHoverIn: reportInspectHover,
          onHoverOut: clearInspectHover,
        }
  ) as Record<string, () => void>;

  const badge = stackBadge ? (
    <View
      style={[styles.stackBadge, harvestBadge ? styles.stackBadgeHarvest : null]}
      pointerEvents="none"
    >
      <Text
        style={[
          styles.stackBadgeText,
          harvestBadge ? styles.stackBadgeTextHarvest : null,
          !harvestBadge ? { color: accentColor } : null,
        ]}
      >
        {stackBadge}
      </Text>
    </View>
  ) : null;

  if (combatSelectMode && onCombatSelect) {
    return (
      <HapticPressable
        onPress={onCombatSelect}
        {...hoverHandlers}
        style={({ pressed }) => [
          spriteSize,
          styles.spriteWrap,
          styles.combatSelectPressable,
          combatSelected
            ? [
              styles.combatItemSelectedWrap,
              {
                borderColor: accentColor ?? '#62CDB5',
                backgroundColor: 'rgba(98, 205, 181, 0.12)',
              },
            ]
            : null,
          pressed ? styles.combatItemPressed : null,
        ]}
      >
        <Image
          source={resolveCargoItemIcon(dragSource.itemId)}
          resizeMode="contain"
          style={[styles.lootSprite, spriteSize, combatSelected ? styles.combatItemSelected : null]}
        />
        {badge}
      </HapticPressable>
    );
  }

  const finishDrop = useCallback((
    absoluteX: number,
    absoluteY: number,
    translationX: number,
    translationY: number,
  ) => {
    // Treat even tiny pointer travel as a drag so same-cell snap-back works on quick clicks.
    const dragged = Math.hypot(translationX, translationY) >= 2;
    onDropAttempt(
      dragSource,
      absoluteX,
      absoluteY,
      dragged,
      originRow,
      originCol,
      () => {
        onDragEnd();
      },
    );
  }, [dragSource, onDragEnd, onDropAttempt, originCol, originRow]);

  const pan = Gesture.Pan()
    .minDistance(2)
    .onBegin((event) => {
      runOnJS(clearInspectHover)();
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
      <View
        ref={hostRef}
        style={[
          spriteSize,
          styles.spriteWrap,
          harvestSelected ? styles.harvestSelectedSpriteWrap : null,
        ]}
        {...hoverHandlers}
      >
        {isDragging ? (
          <View style={styles.dragPlaceholder} pointerEvents="none" />
        ) : (
          <Image
            source={resolveCargoItemIcon(dragSource.itemId)}
            resizeMode="contain"
            style={[
              styles.lootSprite,
              spriteSize,
              harvestSelected ? styles.lootSpriteSelected : null,
              harvestBadge ? styles.lootSpriteHarvestNorm : null,
            ]}
          />
        )}
        {!isDragging ? badge : null}
      </View>
    </GestureDetector>
  );
}

function harvestPoseRotation(instanceId: string): number {
  let hash = 0;
  for (let i = 0; i < instanceId.length; i += 1) {
    hash = (hash * 31 + instanceId.charCodeAt(i)) | 0;
  }
  return (hash % 15) - 7;
}

function ContainmentSlot({
  item,
  spriteSize,
  isDragging,
  source,
  scatterPose,
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
  accentColor = RUN_FIELD.mint,
  onInspectHover,
  onInspectLeave,
  groundPresence = false,
}: {
  item: import('../types/cargoGrid').ContainmentItem;
  spriteSize: { width: number; height: number };
  isDragging: boolean;
  source: CargoDragSource;
  scatterPose?: ScatterPose | null;
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
  accentColor?: string;
  onInspectHover?: (payload: CargoInspectHoverPayload) => void;
  onInspectLeave?: (instanceId: string) => void;
  /** Harvest ground layer — artwork + contact shadow. */
  groundPresence?: boolean;
}): React.JSX.Element {
  const slotRef = useRef<View>(null);
  const rotation = useMemo(() => harvestPoseRotation(item.instanceId), [item.instanceId]);
  const hitPad = groundPresence ? 14 : 0;

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
  }, [reportCenter, scatterPose?.left, scatterPose?.top]);

  return (
    <View
      ref={slotRef}
      onLayout={reportCenter}
      style={[
        styles.externalSlot,
        groundPresence ? styles.externalSlotGround : null,
        {
          width: spriteSize.width + hitPad * 2,
          height: spriteSize.height + hitPad * 2,
          padding: hitPad,
        },
        scatterPose
          ? {
              position: 'absolute',
              left: Math.max(0, scatterPose.left - hitPad),
              top: Math.max(0, scatterPose.top - hitPad),
            }
          : null,
      ]}
    >
      {groundPresence ? (
        <View
          pointerEvents="none"
          style={[
            styles.contactShadow,
            {
              width: spriteSize.width * 0.72,
              height: Math.max(8, spriteSize.height * 0.14),
              bottom: hitPad + 2,
              opacity: isDragging ? 0.55 : 0.38,
              transform: [{ scaleX: isDragging ? 1.08 : 1 }],
            },
          ]}
        />
      ) : null}

      <View
        style={groundPresence
          ? {
              transform: [
                { rotate: `${rotation}deg` },
                { translateY: isDragging ? -6 : 0 },
              ],
            }
          : null}
      >
        <DraggableCargoSprite
          dragSource={source}
          isDragging={isDragging}
          stackBadge={null}
          accentColor={accentColor}
          inspectQuantity={cargoItemQuantity(item)}
          inspectUnitValue={unitCargoValue(item)}
          onInspectHover={(payload) => {
            onInspectHover?.(payload);
          }}
          onInspectLeave={(instanceId) => {
            onInspectLeave?.(instanceId);
          }}
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
    </View>
  );
}

export default function CargoGridBoard({
  cargo,
  theme,
  accentColor = RUN_FIELD.mint,
  onRelocateItem,
  onReplaceItem,
  onContinue,
  continueLabel = 'CONTINUE',
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
  onReturnToContainment,
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
  workspaceStatusStrip,
  residueLooseCount = 0,
  cargoReadout,
  selectedHarvestInstanceId = null,
  onHarvestCargoSelect,
  leftPaneHeader,
  rightPaneSlot,
  leftPaneWidth,
  rightPaneWidth,
  cargoBackdrop = false,
}: CargoGridBoardProps): React.JSX.Element {
  const [harvestDeckSize, setHarvestDeckSize] = useState({ width: 0, height: 0 });
  const [clearSweepToken, setClearSweepToken] = useState(0);
  const [lastClearCenter, setLastClearCenter] = useState<{ x: number; y: number } | null>(null);
  const [placementFlashKeys, setPlacementFlashKeys] = useState<Set<string>>(new Set());
  const priorRecoverableRef = useRef<number | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const cellGap = harvestTriPaneLayout ? HARVEST_CELL_GAP : CARGO_CELL_GAP;
  const cellSize = useMemo(() => {
    if (
      harvestTriPaneLayout
      && harvestDeckSize.width > 0
      && harvestDeckSize.height > 0
    ) {
      const vhTarget = Math.round(windowHeight * HARVEST_CELL_SIZE_VH);
      const target = Math.min(HARVEST_CELL_SIZE_MAX, Math.max(HARVEST_CELL_SIZE_MIN, vhTarget));
      return resolveHubLoadoutCellSize(
        harvestDeckSize.width,
        harvestDeckSize.height,
        target,
        HARVEST_CELL_SIZE_MAX,
        HARVEST_CELL_GAP,
      );
    }
    return cellSizeProp ?? CARGO_CELL_SIZE;
  }, [
    cellSizeProp,
    harvestDeckSize.height,
    harvestDeckSize.width,
    harvestTriPaneLayout,
    windowHeight,
  ]);
  const { isDesktop, scaleSpacing } = useResponsiveScale();
  const harvestPaneGap = scaleSpacing(HARVEST_TRI_PANE_GAP);
  const harvestPanelPadding = scaleSpacing(30);
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
    () => cargoGridFrameDimensions(cellSize, cellGap),
    [cellGap, cellSize],
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
  const containmentLootAreaRef = useRef<View>(null);
  const dropZoneRef = useRef<View>(null);
  const gridRef = useRef<View>(null);
  const scatterPosesRef = useRef<Map<string, ScatterPose>>(new Map());
  const [lootAreaSize, setLootAreaSize] = useState({ width: 0, height: 0 });
  const [scatterPoses, setScatterPoses] = useState<Map<string, ScatterPose>>(() => new Map());
  const gridMetricsRef = useRef<(GridMetrics & { cellSize: number; cellGap: number }) | null>(null);
  const boardMetricsRef = useRef<GridMetrics | null>(null);
  const fieldMetricsRef = useRef<GridMetrics | null>(null);
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
  const [pendingFieldDrop, setPendingFieldDrop] = useState<CargoDragSource | null>(null);
  const [pendingReplace, setPendingReplace] = useState<{
    source: CargoDragSource;
    row: number;
    col: number;
    occupantId: CargoItemId;
    occupantName: string;
    canMerge: boolean;
  } | null>(null);
  const [inspectHover, setInspectHover] = useState<CargoInspectHoverPayload | null>(null);
  const [boardOrigin, setBoardOrigin] = useState({ x: 0, y: 0 });
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
    const excludeId = externalHover ? undefined : hoverExcludeId;
    const cells = new Set(cellsForPreview(hover.itemId, hover.row, hover.col));
    const canPlace = canPlaceCargoItemExcluding(
      displayCargo,
      hover.itemId,
      hover.row,
      hover.col,
      excludeId,
    );
    /** Same-item merge with remaining stack room is a valid drop — not a red reject. */
    const canMerge = canMergeCargoAtCell(
      displayCargo,
      hover.itemId,
      hover.row,
      hover.col,
      excludeId,
    );
    return { cells, valid: canPlace || canMerge };
  }, [displayCargo, externalHover, hoverCell, hoverExcludeId, hoverItemId]);

  const captureMetrics = useCallback(() => {
    gridRef.current?.measureInWindow((pageX, pageY, width, height) => {
      const metrics = { pageX, pageY, width, height, cellSize, cellGap };
      gridMetricsRef.current = metrics;
      onGridMetricsMeasured?.(metrics);
    });
    boardRef.current?.measureInWindow((pageX, pageY, width, height) => {
      boardMetricsRef.current = { pageX, pageY, width, height };
      setBoardOrigin((prev) => (
        prev.x === pageX && prev.y === pageY ? prev : { x: pageX, y: pageY }
      ));
    });
    if (harvestTriPaneLayout) {
      containmentLootAreaRef.current?.measureInWindow((pageX, pageY, width, height) => {
        if (width > 0 && height > 0) {
          fieldMetricsRef.current = { pageX, pageY, width, height };
        }
      });
    }
  }, [cellGap, cellSize, harvestTriPaneLayout, onGridMetricsMeasured]);

  const handleInspectHover = useCallback((payload: CargoInspectHoverPayload) => {
    if (activeDragRef.current) return;
    setInspectHover(payload);
  }, []);

  const handleInspectLeave = useCallback((instanceId: string) => {
    setInspectHover((prev) => (prev?.instanceId === instanceId ? null : prev));
  }, []);

  useEffect(() => {
    priorRecoverableRef.current = displayCargo.containment.length;
  }, [displayCargo.containment.length]);

  const reportHarvestFloor = useCallback(() => {
    if (!onHarvestFloorMeasured) return;
    const measureRef = harvestTriPaneLayout ? containmentLootAreaRef : externalBayRef;
    measureRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      onHarvestFloorMeasured({ x, y, width, height });
    });
  }, [harvestTriPaneLayout, onHarvestFloorMeasured]);

  const handleDropZoneLayout = useCallback(() => {
    captureMetrics();
    if (!harvestTriPaneLayout) {
      reportHarvestFloor();
    }
  }, [captureMetrics, harvestTriPaneLayout, reportHarvestFloor]);

  const handleContainmentLootAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLootAreaSize((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
    containmentLootAreaRef.current?.measureInWindow((pageX, pageY, w, h) => {
      if (w > 0 && h > 0) {
        fieldMetricsRef.current = { pageX, pageY, width: w, height: h };
      }
    });
    reportHarvestFloor();
  }, [reportHarvestFloor]);

  const handleGridLayout = useCallback((_event: LayoutChangeEvent) => {
    captureMetrics();
    reportHarvestFloor();
  }, [captureMetrics, reportHarvestFloor]);

  useLayoutEffect(() => {
    captureMetrics();
    reportHarvestFloor();
  }, [captureMetrics, displayCargo.containment.length, displayCargo.grid.placed.length, reportHarvestFloor]);

  useLayoutEffect(() => {
    if (!harvestTriPaneLayout || lootAreaSize.width <= 0 || lootAreaSize.height <= 0) {
      return;
    }

    const harvestSpriteScale = 1.2;
    const items = displayCargo.containment.map((item) => {
      const base = spriteSizeForCargoItem(item.itemId, cellSize, cellGap);
      return {
        id: item.instanceId,
        size: {
          width: Math.round(base.width * harvestSpriteScale),
          height: Math.round(base.height * harvestSpriteScale),
        },
      };
    });
    const pad = 8;
    const extractorExclude = resolveHarvestExtractorExcludeZone(lootAreaSize);
    const excludeZones = extractorExclude ? [extractorExclude] : [];
    const existing = new Map(scatterPosesRef.current);
    for (const [id, pose] of existing) {
      const match = items.find((item) => item.id === id);
      if (!match) {
        existing.delete(id);
        continue;
      }
      const fits =
        pose.left >= 0
        && pose.top >= 0
        && pose.left + match.size.width <= lootAreaSize.width
        && pose.top + match.size.height <= lootAreaSize.height;
      const blocked = excludeZones.some((zone) => (
        poseOverlapsExcludeZone(pose, match.size, zone)
      ));
      if (!fits || blocked) {
        existing.delete(id);
      }
    }

    const next = scatterRectsInBounds(lootAreaSize, items, {
      existing,
      padding: pad,
      maxAttempts: 72,
      excludeZones,
    });
    scatterPosesRef.current = next;
    setScatterPoses(next);
  }, [cellGap, cellSize, displayCargo.containment, harvestTriPaneLayout, lootAreaSize]);

  const resolveCellFromAbsolute = useCallback((absoluteX: number, absoluteY: number) => {
    const metrics = gridMetricsRef.current;
    if (!metrics) return null;
    const stride = cellSize + cellGap;
    const localX = absoluteX - metrics.pageX;
    const localY = absoluteY - metrics.pageY;
    if (localX < 0 || localY < 0 || localX >= metrics.width || localY >= metrics.height) return null;
    const col = Math.floor(localX / stride);
    const row = Math.floor(localY / stride);
    if (row < 0 || col < 0 || row >= CARGO_GRID_ROWS || col >= CARGO_GRID_COLS) return null;
    return { row, col };
  }, [cellGap, cellSize]);

  const resolveValidDropCell = useCallback((
    absoluteX: number,
    absoluteY: number,
    itemId: CargoItemId,
    excludeInstanceId?: string,
  ): { row: number; col: number } | null => {
    const currentCargo = cargoRef.current;
    const accepts = (row: number, col: number) => (
      canPlaceCargoItemExcluding(currentCargo, itemId, row, col, excludeInstanceId)
      || canMergeCargoAtCell(currentCargo, itemId, row, col, excludeInstanceId)
    );
    const locked = dropTargetRef.current;

    if (
      locked
      && locked.itemId === itemId
      && accepts(locked.row, locked.col)
    ) {
      return { row: locked.row, col: locked.col };
    }

    const hover = hoverCellRef.current;
    const hoverItem = hoverItemIdRef.current;
    const hoverExclude = hoverExcludeIdRef.current;

    if (
      hover
      && hoverItem === itemId
      && (
        canPlaceCargoItemExcluding(currentCargo, itemId, hover.row, hover.col, hoverExclude ?? excludeInstanceId)
        || canMergeCargoAtCell(currentCargo, itemId, hover.row, hover.col, hoverExclude ?? excludeInstanceId)
      )
    ) {
      return hover;
    }

    const pending = pendingDropRef.current;
    if (
      pending
      && accepts(pending.row, pending.col)
    ) {
      return pending;
    }

    const fromFinger = resolveCellFromAbsolute(absoluteX, absoluteY);
    if (
      fromFinger
      && accepts(fromFinger.row, fromFinger.col)
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
      && (
        canPlaceCargoItemExcluding(cargoRef.current, itemId, cell.row, cell.col, excludeInstanceId)
        || canMergeCargoAtCell(cargoRef.current, itemId, cell.row, cell.col, excludeInstanceId)
      )
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
    setInspectHover(null);
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
    setInspectHover(null);
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

    const snapBackHome = () => {
      clearDrag();
      onResult(true);
    };

    const finger = resolveCellFromAbsolute(absoluteX, absoluteY);
    const isSameHomeCell = (
      source.source === 'grid'
      && originRow != null
      && originCol != null
      && finger != null
      && cellsForItem(source.itemId, originRow, originCol).includes(`${finger.row},${finger.col}`)
    );

    if (!dragged) {
      if (isSameHomeCell) {
        snapBackHome();
        return;
      }
      if (harvestTriPaneLayout && source.source === 'grid') {
        onHarvestCargoSelect?.(source.instanceId);
        pulseCargoItemSelect();
      }
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

    if (
      source.source === 'grid'
      && originRow != null
      && originCol != null
      && (
        isSameHomeCell
        || (cell != null && cell.row === originRow && cell.col === originCol)
      )
    ) {
      snapBackHome();
      return;
    }

    if (!cell) {
      if (finger && onReplaceItem) {
        const occupant = findPlacedItemAtCell(
          cargoRef.current,
          finger.row,
          finger.col,
          excludeId,
        );
        if (occupant && occupant.itemId !== source.itemId) {
          clearDrag();
          setPendingReplace({
            source,
            row: finger.row,
            col: finger.col,
            occupantId: occupant.itemId,
            occupantName: CARGO_ITEM_CATALOG[occupant.itemId].name,
            canMerge: false,
          });
          onResult(false);
          return;
        }
        if (occupant && occupant.itemId === source.itemId) {
          clearDrag();
          setPendingReplace({
            source,
            row: finger.row,
            col: finger.col,
            occupantId: occupant.itemId,
            occupantName: CARGO_ITEM_CATALOG[occupant.itemId].name,
            canMerge: false,
          });
          onResult(false);
          return;
        }
      }

      // Harvest: drop cargo onto the containment field → confirm return to floor.
      if (
        harvestTriPaneLayout
        && source.source === 'grid'
        && onReturnToContainment
        && fieldMetricsRef.current
        && pointInWindowRect(absoluteX, absoluteY, fieldMetricsRef.current, 8)
      ) {
        clearDrag();
        setPendingFieldDrop(source);
        onResult(false);
        return;
      }

      // Over the grid but no valid placement — snap home instead of jettison.
      if (finger) {
        snapBackHome();
        return;
      }

      clearDrag();
      if (onDiscardItem) {
        setPendingDiscard(source);
        return;
      }
      onResult(false);
      return;
    }

    const snapshot = cargoRef.current;
    const optimisticNext = relocateCargoInState(snapshot, source.instanceId, cell.row, cell.col);
    if (!optimisticNext) {
      snapBackHome();
      return;
    }

    clearDrag();
    setDisplayCargo(optimisticNext);
    cargoRef.current = optimisticNext;

    const placed = onRelocateItem(source.instanceId, cell.row, cell.col);
    if (!placed) {
      setDisplayCargo(snapshot);
      cargoRef.current = snapshot;
      onResult(false);
      return;
    }

    if (harvestTriPaneLayout) {
      const flashKeys = new Set(
        cellsForItem(source.itemId, cell.row, cell.col),
      );
      setPlacementFlashKeys(flashKeys);
      setTimeout(() => setPlacementFlashKeys(new Set()), 280);
      onHarvestCargoSelect?.(source.instanceId);

      const remaining = optimisticNext.containment.length;
      const prior = priorRecoverableRef.current;
      if (prior != null && prior > 0 && remaining === 0) {
        const lastPose = scatterPosesRef.current.get(source.instanceId);
        if (lastPose) {
          const sz = spriteSizeForCargoItem(source.itemId, cellSize, cellGap);
          setLastClearCenter({
            x: lastPose.left + sz.width * 0.6,
            y: lastPose.top + sz.height * 0.6,
          });
        }
        setClearSweepToken((token) => token + 1);
      }
      priorRecoverableRef.current = remaining;
    }

    onResult(true);
  }, [
    captureMetrics,
    cellGap,
    cellSize,
    clearDrag,
    harvestTriPaneLayout,
    onDiscardItem,
    onHarvestCargoSelect,
    onHubExternalDrop,
    onRelocateItem,
    onReplaceItem,
    onReturnToContainment,
    resolveCellFromAbsolute,
    resolveValidDropCell,
  ]);

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
      <View style={[styles.cellsLayer, { gap: cellGap }]}>
        {Array.from({ length: CARGO_GRID_ROWS }, (_, row) =>
          Array.from({ length: CARGO_GRID_COLS }, (_, col) => {
            const key = `${row},${col}`;
            const occupied = occupiedCells.has(key);
            const isPreview = previewCells.cells.has(key);
            const canDrop = isPreview && previewCells.valid;
            const selectedHarvestCell = Boolean(
              harvestTriPaneLayout
              && selectedHarvestInstanceId
              && displayCargo.grid.placed.some((item) => {
                if (item.instanceId !== selectedHarvestInstanceId) return false;
                return cellsForItem(item.itemId, item.originRow, item.originCol).includes(key);
              }),
            );
            const placementFlash = harvestTriPaneLayout && placementFlashKeys.has(key);

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
                    borderColor: harvestTriPaneLayout
                      ? (placementFlash
                        ? HARVEST_PHOSPHOR
                        : resolveHarvestGridCellBorder({
                          occupied,
                          isPreview,
                          canDrop,
                          selected: selectedHarvestCell,
                        }))
                      : isPreview
                        ? (canDrop ? accentColor : '#ef4444')
                        : theme.borderColor,
                    backgroundColor: harvestTriPaneLayout
                      ? resolveHarvestGridCellBackground({
                        occupied,
                        isPreview,
                        canDrop,
                        selected: selectedHarvestCell,
                      })
                      : resolveCargoGridCellBackground({
                        occupied,
                        isPreview,
                        canDrop,
                        cargoBackdrop,
                      }),
                    ...(Platform.OS === 'web' && (placementFlash || (isPreview && canDrop))
                      ? ({
                        boxShadow: placementFlash
                          ? `inset 0 0 0 1px ${HARVEST_PHOSPHOR}`
                          : `inset 0 0 0 1px rgba(100, 201, 177, 0.45)`,
                      } as object)
                      : null),
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
          const spriteSize = spriteSizeForCargoItem(item.itemId, cellSize, cellGap);
          const isDragging = activeDrag?.instanceId === item.instanceId;
          const stackBadge = formatStackBadge(item.itemId, cargoItemQuantity(item));
          const harvestSelected = harvestTriPaneLayout
            && selectedHarvestInstanceId === item.instanceId;

          return (
            <View
              key={`${item.instanceId}@${item.originRow},${item.originCol}`}
              style={[
                styles.placedItemAnchor,
                {
                  left: cellOriginLeft(item.originCol, cellSize, cellGap),
                  top: cellOriginTop(item.originRow, cellSize, cellGap),
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
                cellGap={cellGap}
                stackBadge={stackBadge}
                accentColor={accentColor}
                harvestSelected={harvestSelected}
                harvestBadge={harvestTriPaneLayout}
                inspectQuantity={cargoItemQuantity(item)}
                inspectUnitValue={unitCargoValue(item)}
                onInspectHover={handleInspectHover}
                onInspectLeave={handleInspectLeave}
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
    ? spriteSizeForCargoItem(activeDrag.itemId, cellSize, cellGap)
    : null;

  const layoutWidth = overlayCombatSplit ? combatLayoutWidth : frameWidth;

  const combatDetailPanel = combatMode && onUseCombatConsumable ? (
    <View
      style={[
        styles.combatDetailPanel,
        {
          borderColor: accentColor,
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
        <View
          style={[
            styles.combatDetailTitleSlot,
            overlayCombatSplit && !selectedCombatItemId
              ? styles.combatDetailTitleSlotIdle
              : null,
          ]}
        >
          <Text
            style={[
              styles.combatDetailTitle,
              selectedCombatItemId
                ? { color: accentColor }
                : [styles.combatDetailTitleIdle, { color: theme.mutedColor }],
            ]}
            numberOfLines={overlayCombatSplit && !selectedCombatItemId ? 2 : 1}
            ellipsizeMode="tail"
          >
            {selectedCombatItemId
              ? CARGO_ITEM_CATALOG[selectedCombatItemId].name.toUpperCase()
              : 'Tap an item to inspect'}
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

        <View style={styles.combatDetailFooter}>
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
                borderColor: combatUseEnabled ? accentColor : 'rgba(99, 226, 177, 0.22)',
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
                { color: combatUseEnabled ? accentColor : 'rgba(99, 226, 177, 0.35)' },
              ]}
              numberOfLines={1}
            >
              [ USE ITEM ]
            </Text>
          </HapticPressable>
        </View>
      </View>
    </View>
  ) : null;

  const externalBayNode = externalSlotCount > 0 ? (
    harvestTriPaneLayout ? (
      <View style={styles.externalBayScatter}>
        {displayCargo.containment.map((item) => {
          const baseSize = spriteSizeForCargoItem(item.itemId, cellSize, cellGap);
          const spriteSize = {
            width: Math.round(baseSize.width * 1.2),
            height: Math.round(baseSize.height * 1.2),
          };
          const source: CargoDragSource = {
            instanceId: item.instanceId,
            itemId: item.itemId,
            source: 'containment',
          };
          const isDragging = activeDrag?.instanceId === item.instanceId;
          const pose = scatterPoses.get(item.instanceId) ?? null;
          if (!pose) return null;
          return (
            <ContainmentSlot
              key={item.instanceId}
              item={item}
              spriteSize={spriteSize}
              isDragging={isDragging}
              source={source}
              scatterPose={pose}
              groundPresence
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
              accentColor={accentColor}
              onInspectHover={handleInspectHover}
              onInspectLeave={handleInspectLeave}
            />
          );
        })}
      </View>
    ) : (
      <View
        ref={externalBayRef}
        onLayout={reportHarvestFloor}
        style={[
          styles.externalBay,
          stableExternalBay ? styles.externalBayStable : null,
          stableExternalBay ? { height: harvestExternalBayHeight(cellSize) } : null,
          { marginTop: externalBayMarginTop },
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
            const spriteSize = spriteSizeForCargoItem(item.itemId, cellSize, cellGap);
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
                accentColor={accentColor}
                onInspectHover={handleInspectHover}
                onInspectLeave={handleInspectLeave}
              />
            );
          })}
        </View>
      </View>
    )
  ) : null;

  const inspectOverlay = inspectHover && !activeDrag ? (
    <View style={styles.inspectOverlayLayer} pointerEvents="none">
      <CargoItemInspectPanel
        info={resolveCargoItemInspectInfo(
          inspectHover.itemId,
          inspectHover.quantity,
          inspectHover.unitValue,
        )}
        anchor={inspectHover.anchor}
        originOffset={boardOrigin}
        accentColor={accentColor}
      />
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
        quantityLabel={(() => {
          if (!pendingDiscard) return undefined;
          const entry = [...displayCargo.grid.placed, ...displayCargo.containment]
            .find((item) => item.instanceId === pendingDiscard.instanceId);
          if (!entry) return undefined;
          return formatStackBadge(entry.itemId, cargoItemQuantity(entry)) ?? undefined;
        })()}
        theme={theme}
        accentColor={accentColor}
        routeIntelWarning={Boolean(
          pendingDiscard && isRouteIntelResourceId(pendingDiscard.itemId),
        )}
        rareWarning={Boolean(
          pendingDiscard
          && !isRouteIntelResourceId(pendingDiscard.itemId)
          && isRareOrApexCargo(pendingDiscard.itemId),
        )}
        onConfirm={() => {
          if (!pendingDiscard || !onDiscardItem) return;
          onDiscardItem(pendingDiscard.instanceId);
          setPendingDiscard(null);
        }}
        onCancel={() => setPendingDiscard(null)}
      />

      <CargoDiscardConfirmOverlay
        visible={pendingFieldDrop != null}
        mode="field-drop"
        itemName={pendingFieldDrop ? CARGO_ITEM_CATALOG[pendingFieldDrop.itemId].name : ''}
        quantityLabel={(() => {
          if (!pendingFieldDrop) return undefined;
          const entry = displayCargo.grid.placed
            .find((item) => item.instanceId === pendingFieldDrop.instanceId);
          if (!entry) return undefined;
          return formatStackBadge(entry.itemId, cargoItemQuantity(entry)) ?? undefined;
        })()}
        theme={theme}
        accentColor={accentColor}
        onConfirm={() => {
          if (!pendingFieldDrop || !onReturnToContainment) {
            setPendingFieldDrop(null);
            return;
          }
          const snapshot = cargoRef.current;
          const optimistic = returnCargoToContainmentInState(
            snapshot,
            pendingFieldDrop.instanceId,
          );
          if (optimistic) {
            setDisplayCargo(optimistic);
            cargoRef.current = optimistic;
          }
          const ok = onReturnToContainment(pendingFieldDrop.instanceId);
          if (!ok && optimistic) {
            setDisplayCargo(snapshot);
            cargoRef.current = snapshot;
          }
          setPendingFieldDrop(null);
        }}
        onCancel={() => setPendingFieldDrop(null)}
      />

      <CargoLootPickupOverlay
        visible={pendingReplace != null}
        mode="REPLACE"
        itemName={pendingReplace ? CARGO_ITEM_CATALOG[pendingReplace.source.itemId].name : ''}
        quantityLabel={(() => {
          if (!pendingReplace) return undefined;
          const entry = [...displayCargo.grid.placed, ...displayCargo.containment]
            .find((item) => item.instanceId === pendingReplace.source.instanceId);
          if (!entry) return undefined;
          return formatStackBadge(entry.itemId, cargoItemQuantity(entry)) ?? undefined;
        })()}
        occupantName={pendingReplace?.occupantName}
        theme={theme}
        accentColor={accentColor}
        progressionWarning={Boolean(
          pendingReplace && (
            isProgressionProtectedCargo(pendingReplace.occupantId)
            || isProgressionProtectedCargo(pendingReplace.source.itemId)
          ),
        )}
        rareWarning={Boolean(
          pendingReplace && (
            isRareOrApexCargo(pendingReplace.occupantId)
            || isRareOrApexCargo(pendingReplace.source.itemId)
          ),
        )}
        onReplace={() => {
          if (!pendingReplace || !onReplaceItem) {
            setPendingReplace(null);
            return;
          }
          const snapshot = cargoRef.current;
          const optimistic = replaceCargoInState(
            snapshot,
            pendingReplace.source.instanceId,
            pendingReplace.row,
            pendingReplace.col,
          );
          if (optimistic) {
            setDisplayCargo(optimistic);
            cargoRef.current = optimistic;
          }
          const ok = onReplaceItem(
            pendingReplace.source.instanceId,
            pendingReplace.row,
            pendingReplace.col,
          );
          if (!ok && optimistic) {
            setDisplayCargo(snapshot);
            cargoRef.current = snapshot;
          }
          setPendingReplace(null);
        }}
        onLeaveBehind={() => setPendingReplace(null)}
        onCancel={() => setPendingReplace(null)}
      />
    </>
  );

  if (harvestTriPaneLayout) {
    const materialCount = displayCargo.containment.length;
    const fieldFullyCleared = materialCount === 0 && residueLooseCount <= 0;

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
            ref={dropZoneRef}
            onLayout={handleDropZoneLayout}
            style={[
              styles.harvestWorkspace,
              isDesktop ? { flex: HARVEST_DESKTOP_CENTER_FLEX } : null,
            ]}
          >
            <View
              ref={containmentLootAreaRef}
              onLayout={handleContainmentLootAreaLayout}
              style={styles.containmentLootArea}
            >
              <ContainmentFieldAtmosphere
                fieldCleared={fieldFullyCleared}
                clearSweepToken={clearSweepToken}
                lastClearCenter={lastClearCenter}
                areaWidth={lootAreaSize.width}
                areaHeight={lootAreaSize.height}
              />
              {externalBayNode}
              {resolvedLeftPaneSlot ? (
                <View style={styles.extractorDock} pointerEvents="box-none">
                  {resolvedLeftPaneSlot}
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.harvestCargoConsole,
              isDesktop
                ? styles.harvestCargoConsoleDesktop
                : rightPaneWidth != null
                  ? { width: rightPaneWidth }
                  : null,
              isDesktop ? { flex: HARVEST_DESKTOP_RIGHT_FLEX } : null,
              { padding: harvestPanelPadding },
            ]}
          >
            <View pointerEvents="none" style={styles.cargoConsoleCornerTL} />
            <View pointerEvents="none" style={styles.cargoConsoleCornerTR} />
            <View pointerEvents="none" style={styles.cargoConsoleCornerBL} />
            <View pointerEvents="none" style={styles.cargoConsoleCornerBR} />
            {resolvedRightPaneHeader}
            <View
              style={styles.harvestCargoMatSlot}
              onLayout={handleHarvestDeckLayout}
            >
              <View
                style={[
                  styles.harvestGridBackdropHost,
                  {
                    width: frameWidth + harvestMatPadding * 2,
                    height: frameHeight + harvestMatPadding * 2,
                    padding: harvestMatPadding,
                  },
                ]}
              >
                <View style={[styles.boardShell, { width: frameWidth }]}>
                  <View style={styles.gridDock}>{gridBlock}</View>
                </View>
              </View>
              {cargoReadout ? (
                <View style={styles.harvestCargoReadoutSlot}>
                  {cargoReadout}
                </View>
              ) : null}
            </View>

            {centerPaneFooter ? (
              <View style={styles.cargoConsoleFooter}>
                {centerPaneFooter}
              </View>
            ) : null}
          </View>

          {dragGhostOverlay}
          {inspectOverlay}
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
        {inspectOverlay}
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
  harvestWorkspace: {
    // Open floor — no panel/scrim so loot reads as physical world pickup.
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'minmax(0, 1fr)',
      } as object,
      default: {
        flexDirection: 'column',
      },
    }),
  },
  workspaceCornerTL: {
    display: 'none',
  },
  workspaceCornerTR: {
    display: 'none',
  },
  workspaceCornerBL: {
    display: 'none',
  },
  workspaceCornerBR: {
    display: 'none',
  },
  cargoConsoleCornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: RUN_FIELD.bracket.size,
    height: RUN_FIELD.bracket.size,
    borderTopWidth: RUN_FIELD.bracket.stroke,
    borderLeftWidth: RUN_FIELD.bracket.stroke,
    borderColor: 'rgba(99, 226, 177, 0.28)',
    zIndex: 5,
  },
  cargoConsoleCornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: RUN_FIELD.bracket.size,
    height: RUN_FIELD.bracket.size,
    borderTopWidth: RUN_FIELD.bracket.stroke,
    borderRightWidth: RUN_FIELD.bracket.stroke,
    borderColor: 'rgba(99, 226, 177, 0.28)',
    zIndex: 5,
  },
  cargoConsoleCornerBL: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: RUN_FIELD.bracket.size,
    height: RUN_FIELD.bracket.size,
    borderBottomWidth: RUN_FIELD.bracket.stroke,
    borderLeftWidth: RUN_FIELD.bracket.stroke,
    borderColor: 'rgba(99, 226, 177, 0.28)',
    zIndex: 5,
  },
  cargoConsoleCornerBR: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: RUN_FIELD.bracket.size,
    height: RUN_FIELD.bracket.size,
    borderBottomWidth: RUN_FIELD.bracket.stroke,
    borderRightWidth: RUN_FIELD.bracket.stroke,
    borderColor: 'rgba(99, 226, 177, 0.28)',
    zIndex: 5,
  },
  containmentLootArea: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  extractorDock: {
    position: 'absolute',
    left: HARVEST_EXTRACTOR_DOCK_LEFT,
    bottom: HARVEST_EXTRACTOR_DOCK_BOTTOM,
    zIndex: 4,
    maxWidth: '78%',
    overflow: 'visible',
  },
  workspaceStatusStrip: {
    display: 'none',
  },
  harvestCargoConsole: {
    position: 'relative',
    flexShrink: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    backgroundColor: HARVEST_CARGO_SURFACE,
    borderWidth: 1,
    borderColor: HARVEST_CARGO_BORDER,
    gap: 12,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        width: HARVEST_CARGO_CONSOLE_WIDTH_CSS,
        maxWidth: 540,
      } as object,
      default: {
        width: HARVEST_CARGO_CONSOLE_WIDTH_NATIVE,
        maxWidth: HARVEST_CARGO_CONSOLE_MAX_PCT,
        flexDirection: 'column',
      },
    }),
  },
  harvestCargoConsoleDesktop: {
    flexShrink: 1,
    minWidth: 0,
  },
  harvestCargoMatSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    gap: 12,
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  harvestCargoReadoutSlot: {
    width: '100%',
    flexShrink: 0,
    paddingHorizontal: 2,
  },
  harvestGridBackdropHost: {
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  cargoConsoleFooter: {
    width: '100%',
    flexShrink: 0,
    marginTop: 0,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HARVEST_CARGO_BORDER,
  },
  dropZoneLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    overflow: 'visible',
  },
  inspectOverlayLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
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
    borderWidth: 1.25,
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
  externalBayScatter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 2,
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
  externalSlotGround: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  contactShadow: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 0,
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
  stackBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  stackBadgeHarvest: {
    right: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(4, 8, 8, 0.88)',
    borderColor: 'rgba(108, 156, 143, 0.28)',
  },
  stackBadgeText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  stackBadgeTextHarvest: {
    color: HARVEST_MUTED_SLATE,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  harvestSelectedSpriteWrap: {
    borderWidth: 1,
    borderColor: HARVEST_VEIL_VIOLET,
  },
  lootSpriteSelected: {
    opacity: 1,
    ...Platform.select({
      web: {
        filter: 'contrast(1.12) saturate(1.08)',
      } as object,
      default: {},
    }),
  },
  lootSpriteHarvestNorm: {
    maxWidth: '92%',
    maxHeight: '92%',
  },
  combatDetailPanel: {
    borderWidth: 1.25,
    backgroundColor: 'rgba(8, 12, 12, 0.92)',
  },
  combatDetailInner: {
    padding: 12,
    gap: 8,
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
  combatDetailTitleSlotIdle: {
    height: undefined,
    minHeight: COMBAT_DETAIL_TITLE_HEIGHT,
  },
  combatDetailTitle: {
    fontFamily: 'monospace',
    fontSize: COMBAT_HUD_TYPE.title,
    fontWeight: '800',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  combatDetailTitleIdle: {
    fontSize: COMBAT_HUD_TYPE.title - 3,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'none',
    opacity: 0.65,
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
    fontSize: COMBAT_HUD_TYPE.body,
    lineHeight: COMBAT_HUD_TYPE.lineBody,
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  combatDetailMetaSlot: {
    height: COMBAT_DETAIL_META_HEIGHT,
    justifyContent: 'center',
    width: '100%',
  },
  combatDetailMeta: {
    fontFamily: 'monospace',
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 0.55,
    textAlign: 'center',
    fontWeight: '600',
  },
  combatDetailFooter: {
    width: '100%',
    flexShrink: 0,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RUN_FIELD.line,
  },
  deployBtn: {
    marginTop: 0,
    minHeight: 40,
    justifyContent: 'center',
  },
  ampouleBtn: {
    borderWidth: 1.25,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: '#050608',
    width: '100%',
  },
  ampouleBtnText: {
    fontFamily: 'monospace',
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  continueBtn: {
    width: CARGO_GRID_FRAME_SIZE,
    alignSelf: 'center',
  },
  continueBtnText: {
    textAlign: 'center',
  },
});
