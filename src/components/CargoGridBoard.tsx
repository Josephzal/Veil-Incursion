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

const REJECT_SNAP_MS = 140;
const COMBAT_DETAIL_PANEL_HEIGHT = 160;
const COMBAT_DETAIL_TITLE_HEIGHT = 18;
const COMBAT_DETAIL_BODY_HEIGHT = 39;
const COMBAT_DETAIL_META_HEIGHT = 14;
import {
  canMergeCargoAtCell,
  canPlaceCargoItemExcluding,
  combatConsumableApCost,
  combatConsumableDescription,
  findPlacedItemAtCell,
  isCombatDeployableCargoItem,
  relocateCargoItem as relocateCargoInState,
  replaceCargoAtCell as replaceCargoInState,
} from '../data/cargoGridEngine';
import { useCombatTurnOptional } from '../context/CombatTurnContext';
import type { CargoItemId, CargoRunState, PlacedCargoItem } from '../types/cargoGrid';
import { CARGO_GRID_COLS, CARGO_GRID_ROWS, CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import { resolveCargoGridCellBackground } from '../constants/cargoGridVisual';
import {
  HARVEST_CARGO_BORDER,
  HARVEST_CARGO_SURFACE,
  HARVEST_CONTAINMENT_BG,
  HARVEST_CONTAINMENT_BORDER,
  HARVEST_CONTAINMENT_SCRIM_BOTTOM,
  HARVEST_CONTAINMENT_SCRIM_TOP,
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
import TerminalText from './TerminalText';
import { resolveHubLoadoutCellSize } from '../utils/cargoGridLayout';
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
  HARVEST_STATUS_STRIP_HEIGHT,
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
  accentColor = '#00ff33',
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
          combatSelected ? styles.combatItemSelectedWrap : null,
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
        {harvestSelected ? (
          <View pointerEvents="none" style={styles.harvestSelectCorner} />
        ) : null}
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
  accentColor = '#00ff33',
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
  /** Harvest ground layer — artwork + contact shadow only until hover/drag. */
  groundPresence?: boolean;
}): React.JSX.Element {
  const slotRef = useRef<View>(null);
  const [hovered, setHovered] = useState(false);
  const rotation = useMemo(() => harvestPoseRotation(item.instanceId), [item.instanceId]);
  const inspect = useMemo(
    () => resolveCargoItemInspectInfo(item.itemId, cargoItemQuantity(item), unitCargoValue(item)),
    [item.itemId, item],
  );
  const def = CARGO_ITEM_CATALOG[item.itemId];
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

  const hoverHandlers = groundPresence
    ? (Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {
          onHoverIn: () => setHovered(true),
          onHoverOut: () => setHovered(false),
        }) as Record<string, () => void>
    : {};

  const showFocusChrome = groundPresence && (hovered || isDragging);
  const classLabel = (inspect.categoryLabel ?? inspect.rarityLabel ?? 'SALVAGE').toUpperCase();

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
      {...hoverHandlers}
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

      {showFocusChrome ? (
        <View
          pointerEvents="none"
          style={[
            styles.groundFocusChrome,
            {
              top: Math.max(0, hitPad - 2),
              left: Math.max(0, hitPad - 2),
              right: Math.max(0, hitPad - 2),
              bottom: Math.max(0, hitPad - 2),
            },
          ]}
        >
          <View style={[styles.groundTick, styles.groundTickTL]} />
          <View style={[styles.groundTick, styles.groundTickTR]} />
          <View style={[styles.groundTick, styles.groundTickBL]} />
          <View style={[styles.groundTick, styles.groundTickBR]} />
        </View>
      ) : null}

      {showFocusChrome && !isDragging ? (
        <View pointerEvents="none" style={[styles.groundLabel, { top: Math.max(0, hitPad - 28) }]}>
          <TerminalText size={7} letterSpacing={0.85} style={styles.groundLabelTitle} numberOfLines={1}>
            {inspect.shortName.toUpperCase()}
          </TerminalText>
          <TerminalText size={6} letterSpacing={0.7} style={styles.groundLabelMeta} numberOfLines={1}>
            {`${classLabel} // ${def.width}×${def.height}`}
          </TerminalText>
        </View>
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
          onInspectHover={groundPresence ? undefined : onInspectHover}
          onInspectLeave={groundPresence ? undefined : onInspectLeave}
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
  accentColor = '#00ff33',
  onRelocateItem,
  onReplaceItem,
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
  workspaceStatusStrip,
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
  const { fontScale } = useResponsiveLayout();
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
  }, [cellGap, cellSize, onGridMetricsMeasured]);

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
      if (!fits) {
        existing.delete(id);
      }
    }

    const next = scatterRectsInBounds(lootAreaSize, items, {
      existing,
      padding: pad,
      maxAttempts: 56,
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

    if (!dragged) {
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

    if (!cell) {
      const finger = resolveCellFromAbsolute(absoluteX, absoluteY);
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
          // Full stack — no room to merge; offer replace of that stack.
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
    const recoverableCount = displayCargo.containment.length;
    const fieldCleared = recoverableCount === 0;
    const signalLabel = fieldCleared
      ? 'SIGNALS EXHAUSTED'
      : recoverableCount === 1
        ? '1 RECOVERABLE SIGNAL'
        : `${recoverableCount} RECOVERABLE SIGNALS`;

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
            <View pointerEvents="none" style={styles.workspaceCornerTL} />
            <View pointerEvents="none" style={styles.workspaceCornerTR} />
            <View pointerEvents="none" style={styles.workspaceCornerBL} />
            <View pointerEvents="none" style={styles.workspaceCornerBR} />

            <View style={styles.workspaceChrome}>
              <View style={styles.workspaceTitleRow}>
                <View style={styles.workspaceStatusDot} />
                <TerminalText
                  size={10.5 * fontScale}
                  letterSpacing={0.9}
                  style={styles.workspaceEyebrow}
                  numberOfLines={1}
                >
                  {`CONTAINMENT FIELD // ${signalLabel}`}
                </TerminalText>
              </View>
              <View style={styles.workspaceRule} />
              <TerminalText
                size={8 * fontScale}
                letterSpacing={0.6}
                style={[
                  styles.workspaceInstruction,
                  fieldCleared ? styles.workspaceInstructionCleared : null,
                ]}
                numberOfLines={1}
              >
                {fieldCleared
                  ? 'RECOVERY COMPLETE // NO VIABLE SIGNALS REMAIN'
                  : 'DRAG MATERIAL TO RUN STORAGE'}
              </TerminalText>
            </View>

            <View
              ref={containmentLootAreaRef}
              onLayout={handleContainmentLootAreaLayout}
              style={styles.containmentLootArea}
            >
              <ContainmentFieldAtmosphere
                fieldCleared={fieldCleared}
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

            <View style={styles.workspaceStatusStrip}>
              {workspaceStatusStrip}
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
            </View>

            <View style={styles.cargoReadoutSlot}>
              {cargoReadout}
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
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        backgroundImage: `linear-gradient(180deg, ${HARVEST_CONTAINMENT_SCRIM_TOP} 0%, ${HARVEST_CONTAINMENT_BG} 28%, ${HARVEST_CONTAINMENT_SCRIM_BOTTOM} 100%)`,
      } as object,
      default: {
        flexDirection: 'column',
        backgroundColor: HARVEST_CONTAINMENT_BG,
      },
    }),
  },
  workspaceCornerTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 18,
    height: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: HARVEST_CONTAINMENT_BORDER,
    zIndex: 5,
  },
  workspaceCornerTR: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: HARVEST_CONTAINMENT_BORDER,
    zIndex: 5,
  },
  workspaceCornerBL: {
    position: 'absolute',
    bottom: HARVEST_STATUS_STRIP_HEIGHT + 8,
    left: 8,
    width: 18,
    height: 18,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: HARVEST_CONTAINMENT_BORDER,
    zIndex: 5,
  },
  workspaceCornerBR: {
    position: 'absolute',
    bottom: HARVEST_STATUS_STRIP_HEIGHT + 8,
    right: 8,
    width: 18,
    height: 18,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: HARVEST_CONTAINMENT_BORDER,
    zIndex: 5,
  },
  workspaceChrome: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 0,
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: 'transparent',
    maxWidth: 600,
  },
  workspaceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workspaceStatusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: HARVEST_PHOSPHOR,
    opacity: 0.8,
  },
  workspaceEyebrow: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
    textAlign: 'left',
    flexShrink: 1,
    ...Platform.select({
      web: {
        fontSize: 'clamp(19px, 1.2vw, 22px)',
        lineHeight: 1.2,
      } as object,
      default: {},
    }),
  },
  workspaceRule: {
    width: 72,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(108, 156, 143, 0.28)',
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 12,
  },
  workspaceInstruction: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '500',
    textAlign: 'left',
    opacity: 0.82,
    marginLeft: 12,
    ...Platform.select({
      web: {
        fontSize: 'clamp(14px, 0.9vw, 16px)',
        lineHeight: 1.35,
      } as object,
      default: {},
    }),
  },
  workspaceInstructionCleared: {
    color: HARVEST_PHOSPHOR,
    opacity: 0.78,
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
    left: 16,
    bottom: 10,
    zIndex: 4,
    maxWidth: '58%',
  },
  workspaceStatusStrip: {
    height: HARVEST_STATUS_STRIP_HEIGHT,
    minHeight: HARVEST_STATUS_STRIP_HEIGHT,
    maxHeight: HARVEST_STATUS_STRIP_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HARVEST_CONTAINMENT_BORDER,
    backgroundColor: HARVEST_STATUS_STRIP_BG,
    flexShrink: 0,
    zIndex: 3,
    justifyContent: 'center',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      } as object,
      default: {},
    }),
  },
  harvestCargoConsole: {
    flexShrink: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    backgroundColor: HARVEST_CARGO_SURFACE,
    borderWidth: 1,
    borderColor: HARVEST_CARGO_BORDER,
    gap: 18,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, auto) minmax(72px, 1fr) auto',
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
    justifyContent: 'center',
    flexShrink: 1,
    minHeight: 0,
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
  cargoReadoutSlot: {
    flex: 1,
    minHeight: 64,
    maxHeight: 160,
    width: '100%',
    justifyContent: 'flex-start',
    gap: 4,
    overflow: 'hidden',
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
  groundFocusChrome: {
    position: 'absolute',
    zIndex: 2,
  },
  groundTick: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderColor: 'rgba(196, 203, 198, 0.72)',
  },
  groundTickTL: {
    top: 0,
    left: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  groundTickTR: {
    top: 0,
    right: 0,
    borderTopWidth: 1,
    borderRightWidth: 1,
  },
  groundTickBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
  },
  groundTickBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  groundLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 1,
    zIndex: 5,
    ...Platform.select({
      web: {
        transitionProperty: 'opacity',
        transitionDuration: '120ms',
      } as object,
      default: {},
    }),
  },
  groundLabelTitle: {
    color: HARVEST_TEXT_PRIMARY,
    fontWeight: '700',
  },
  groundLabelMeta: {
    color: HARVEST_MUTED_SLATE,
    fontWeight: '600',
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
  harvestSelectCorner: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 8,
    height: 8,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: HARVEST_VEIL_VIOLET,
    zIndex: 3,
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
