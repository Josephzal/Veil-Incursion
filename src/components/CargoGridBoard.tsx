import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const REJECT_SNAP_MS = 140;
import { canPlaceCargoItemExcluding } from '../data/cargoGridEngine';
import type { CargoItemId, CargoRunState, PlacedCargoItem } from '../types/cargoGrid';
import { CARGO_GRID_DIMENSION, CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import type { TerminalTheme } from '../types/theme';
import { countCargoItemInstances } from '../data/cargoGridEngine';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';

export const CARGO_CELL_SIZE = 56;
export const CARGO_CELL_GAP = 2;

const COMBAT_CONSUMABLE_IDS: CargoItemId[] = Object.values(CARGO_ITEM_CATALOG)
  .filter((def) => def.usableInCombat === true && def.combatEffect !== 'unimplemented')
  .map((def) => def.id);

export const CARGO_GRID_FRAME_SIZE =
  CARGO_GRID_DIMENSION * CARGO_CELL_SIZE + (CARGO_GRID_DIMENSION - 1) * CARGO_CELL_GAP;

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
  scannerMode?: boolean;
  combatMode?: boolean;
  combatConsumablesEnabled?: boolean;
  onUseCombatConsumable?: (itemId: CargoItemId) => boolean;
  /** Bare grid + external loot + actions — no headers or wrapper chrome. */
  minimal?: boolean;
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

export function spriteSizeForCargoItem(itemId: CargoItemId): { width: number; height: number } {
  const def = CARGO_ITEM_CATALOG[itemId];
  return {
    width: def.width * CARGO_CELL_SIZE + (def.width - 1) * CARGO_CELL_GAP,
    height: def.height * CARGO_CELL_SIZE + (def.height - 1) * CARGO_CELL_GAP,
  };
}

function cellOriginLeft(col: number): number {
  return col * (CARGO_CELL_SIZE + CARGO_CELL_GAP);
}

function cellOriginTop(row: number): number {
  return row * (CARGO_CELL_SIZE + CARGO_CELL_GAP);
}

function DraggableCargoSprite({
  dragSource,
  layoutMode,
  originRow,
  originCol,
  gridMetricsRef,
  onRelocateItem,
  onHoverCell,
  onDragStart,
  onDragEnd,
}: {
  dragSource: CargoDragSource;
  layoutMode: 'external' | 'grid';
  originRow?: number;
  originCol?: number;
  gridMetricsRef: React.RefObject<GridMetrics | null>;
  onRelocateItem: (instanceId: string, row: number, col: number) => boolean;
  onHoverCell: (
    cell: { row: number; col: number } | null,
    itemId: CargoItemId | null,
    excludeInstanceId?: string,
  ) => void;
  onDragStart: (source: CargoDragSource) => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  const spriteSize = spriteSizeForCargoItem(dragSource.itemId);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const zIndex = useSharedValue(layoutMode === 'grid' ? 2 : 1);

  const resolveCellFromAbsolute = useCallback((absoluteX: number, absoluteY: number) => {
    const metrics = gridMetricsRef.current;
    if (!metrics) return null;
    const stride = CARGO_CELL_SIZE + CARGO_CELL_GAP;
    const localX = absoluteX - metrics.pageX;
    const localY = absoluteY - metrics.pageY;
    if (localX < 0 || localY < 0 || localX > metrics.width || localY > metrics.height) return null;
    const col = Math.floor(localX / stride);
    const row = Math.floor(localY / stride);
    if (row < 0 || col < 0 || row >= CARGO_GRID_DIMENSION || col >= CARGO_GRID_DIMENSION) return null;
    return { row, col };
  }, [gridMetricsRef]);

  const settleGridDrag = useCallback(() => {
    opacity.value = 1;
    onDragEnd();
  }, [onDragEnd, opacity]);

  const instantReset = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [translateX, translateY]);

  const rejectDrop = useCallback(() => {
    translateX.value = withTiming(0, { duration: REJECT_SNAP_MS }, (finished) => {
      if (finished) runOnJS(settleGridDrag)();
    });
    translateY.value = withTiming(0, { duration: REJECT_SNAP_MS });
  }, [settleGridDrag, translateX, translateY]);

  const handleDrop = useCallback((absoluteX: number, absoluteY: number, dragged: boolean) => {
    onHoverCell(null, null);
    if (!dragged) {
      rejectDrop();
      return;
    }
    const cell = resolveCellFromAbsolute(absoluteX, absoluteY);
    if (!cell) {
      rejectDrop();
      return;
    }
    instantReset();
    opacity.value = 0;
    const placed = onRelocateItem(dragSource.instanceId, cell.row, cell.col);
    if (placed) {
      onDragEnd();
      return;
    }
    opacity.value = 1;
    rejectDrop();
  }, [
    dragSource.instanceId,
    instantReset,
    onDragEnd,
    onHoverCell,
    onRelocateItem,
    opacity,
    rejectDrop,
    resolveCellFromAbsolute,
  ]);

  const handleGridDrop = useCallback((
    absoluteX: number,
    absoluteY: number,
    _transX: number,
    _transY: number,
    dragged: boolean,
  ) => {
    onHoverCell(null, null);
    if (!dragged || originRow == null || originCol == null) {
      rejectDrop();
      return;
    }
    const cell = resolveCellFromAbsolute(absoluteX, absoluteY);
    if (!cell) {
      rejectDrop();
      return;
    }
    const moved = cell.row !== originRow || cell.col !== originCol;
    if (!moved) {
      instantReset();
      settleGridDrag();
      return;
    }
    instantReset();
    const placed = onRelocateItem(dragSource.instanceId, cell.row, cell.col);
    if (placed) {
      onDragEnd();
      return;
    }
    rejectDrop();
  }, [
    dragSource.instanceId,
    instantReset,
    onDragEnd,
    onHoverCell,
    onRelocateItem,
    originCol,
    originRow,
    rejectDrop,
    resolveCellFromAbsolute,
    settleGridDrag,
  ]);

  const handleDragUpdate = useCallback((absoluteX: number, absoluteY: number) => {
    const cell = resolveCellFromAbsolute(absoluteX, absoluteY);
    if (!cell) {
      onHoverCell(null, null);
      return;
    }
    onHoverCell(
      cell,
      dragSource.itemId,
      dragSource.source === 'grid' ? dragSource.instanceId : undefined,
    );
  }, [dragSource.instanceId, dragSource.itemId, dragSource.source, onHoverCell, resolveCellFromAbsolute]);

  const pan = Gesture.Pan()
    .minDistance(6)
    .onBegin(() => {
      runOnJS(onDragStart)(dragSource);
      scale.value = withSpring(1.08);
      opacity.value = 0.92;
      zIndex.value = 30;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      runOnJS(handleDragUpdate)(event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      const dragged = Math.hypot(event.translationX, event.translationY) >= 6;
      scale.value = 1;
      opacity.value = 1;
      zIndex.value = layoutMode === 'grid' ? 2 : 1;
      if (layoutMode === 'grid') {
        runOnJS(handleGridDrop)(
          event.absoluteX,
          event.absoluteY,
          event.translationX,
          event.translationY,
          dragged,
        );
      } else {
        runOnJS(handleDrop)(event.absoluteX, event.absoluteY, dragged);
      }
    })
    .onFinalize(() => {
      runOnJS(onHoverCell)(null, null);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    zIndex: zIndex.value,
  }));

  const staticStyle = layoutMode === 'grid' && originRow != null && originCol != null
    ? {
        position: 'absolute' as const,
        left: cellOriginLeft(originCol),
        top: cellOriginTop(originRow),
      }
    : null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.Image
        source={resolveCargoItemIcon(dragSource.itemId)}
        resizeMode="contain"
        style={[styles.lootSprite, spriteSize, staticStyle, animatedStyle]}
      />
    </GestureDetector>
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
  scannerMode = false,
  combatMode = false,
  combatConsumablesEnabled = true,
  onUseCombatConsumable,
  minimal = true,
}: CargoGridBoardProps): React.JSX.Element {
  const gridRef = useRef<View>(null);
  const gridMetricsRef = useRef<GridMetrics | null>(null);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [hoverItemId, setHoverItemId] = useState<CargoItemId | null>(null);
  const [hoverExcludeId, setHoverExcludeId] = useState<string | undefined>(undefined);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const externalSlotCountRef = useRef(0);
  if (externalSlotCountRef.current === 0 && cargo.containment.length > 0) {
    externalSlotCountRef.current = cargo.containment.length;
  }
  const externalSlotCount = Math.max(externalSlotCountRef.current, cargo.containment.length);

  const hasAmpouleInGrid = cargo.grid.placed.some((item) => item.itemId === 'focusing-ampoule');

  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    cargo.grid.placed.forEach((item) => {
      if (item.instanceId === activeDragId) return;
      cellsForItem(item.itemId, item.originRow, item.originCol).forEach((key) => set.add(key));
    });
    return set;
  }, [cargo.grid.placed, activeDragId]);

  const previewCells = useMemo(() => {
    if (!hoverCell || !hoverItemId) return new Set<string>();
    if (!canPlaceCargoItemExcluding(cargo, hoverItemId, hoverCell.row, hoverCell.col, hoverExcludeId)) {
      return new Set<string>();
    }
    return new Set(cellsForPreview(hoverItemId, hoverCell.row, hoverCell.col));
  }, [cargo, hoverCell, hoverExcludeId, hoverItemId]);

  const captureGridMetrics = useCallback(() => {
    gridRef.current?.measureInWindow((pageX, pageY, width, height) => {
      gridMetricsRef.current = { pageX, pageY, width, height };
    });
  }, []);

  const handleGridLayout = useCallback((_event: LayoutChangeEvent) => {
    captureGridMetrics();
  }, [captureGridMetrics]);

  const handleHoverCell = useCallback((
    cell: { row: number; col: number } | null,
    itemId: CargoItemId | null,
    excludeInstanceId?: string,
  ) => {
    setHoverCell(cell);
    setHoverItemId(itemId);
    setHoverExcludeId(excludeInstanceId);
  }, []);

  const handleDragStart = useCallback((source: CargoDragSource) => {
    captureGridMetrics();
    requestAnimationFrame(() => captureGridMetrics());
    setActiveDragId(source.instanceId);
  }, [captureGridMetrics]);

  const handleDragEnd = useCallback(() => {
    setActiveDragId(null);
  }, []);

  const gridBlock = (
    <View
      ref={gridRef}
      onLayout={handleGridLayout}
      style={[styles.gridFrame, { width: CARGO_GRID_FRAME_SIZE, height: CARGO_GRID_FRAME_SIZE }]}
    >
      <View style={styles.cellsLayer}>
        {Array.from({ length: CARGO_GRID_DIMENSION }, (_, row) =>
          Array.from({ length: CARGO_GRID_DIMENSION }, (_, col) => {
            const key = `${row},${col}`;
            const occupied = occupiedCells.has(key);
            const isPreview = previewCells.has(key);
            const canDrop = hoverCell?.row === row
              && hoverCell?.col === col
              && hoverItemId != null
              && canPlaceCargoItemExcluding(cargo, hoverItemId, row, col, hoverExcludeId);

            return (
              <View
                key={key}
                style={[
                  styles.cell,
                  {
                    borderColor: isPreview
                      ? (canDrop ? accentColor : '#ef4444')
                      : theme.borderColor,
                    backgroundColor: isPreview
                      ? (canDrop ? 'rgba(0, 255, 51, 0.18)' : 'rgba(239, 68, 68, 0.14)')
                      : occupied
                        ? 'rgba(0, 255, 51, 0.06)'
                        : '#0a0b0f',
                  },
                ]}
              />
            );
          }),
        )}
      </View>

      <View style={styles.placedLayer} pointerEvents="box-none">
        {cargo.grid.placed.map((item: PlacedCargoItem) => (
          <DraggableCargoSprite
            key={item.instanceId}
            dragSource={{ instanceId: item.instanceId, itemId: item.itemId, source: 'grid' }}
            layoutMode="grid"
            originRow={item.originRow}
            originCol={item.originCol}
            gridMetricsRef={gridMetricsRef}
            onRelocateItem={onRelocateItem}
            onHoverCell={handleHoverCell}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, minimal && styles.rootMinimal, styles.rootCentered, { width: CARGO_GRID_FRAME_SIZE }]}>
      <View style={styles.gridDock}>{gridBlock}</View>

      <View style={styles.externalBay}>
        
        {externalSlotCount > 0 ? (
          <View style={styles.externalRow}>
            {Array.from({ length: externalSlotCount }, (_, slotIndex) => {
              const item = cargo.containment[slotIndex] ?? null;
              if (!item) {
                return <View key={`empty-slot-${slotIndex}`} style={styles.externalSlot} />;
              }
              const spriteSize = spriteSizeForCargoItem(item.itemId);
              return (
                <View
                  key={item.instanceId}
                  style={[styles.externalSlot, { width: spriteSize.width, height: spriteSize.height }]}
                >
                  <DraggableCargoSprite
                    dragSource={{ instanceId: item.instanceId, itemId: item.itemId, source: 'containment' }}
                    layoutMode="external"
                    gridMetricsRef={gridMetricsRef}
                    onRelocateItem={onRelocateItem}
                    onHoverCell={handleHoverCell}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {scannerMode && hasAmpouleInGrid && onUseAmpoule ? (
        <Pressable
          onPress={() => onUseAmpoule()}
          style={[styles.ampouleBtn, { borderColor: accentColor }]}
        >
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE FOCUSING AMPOULE — +1 ATTUNEMENT ]
          </Text>
        </Pressable>
      ) : null}

      {scannerMode && onUseResonanceBribe && countCargoItemInstances(cargo, 'resonance-bribe') > 0 ? (
        <Pressable onPress={() => onUseResonanceBribe()} style={[styles.ampouleBtn, { borderColor: accentColor }]}>
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE RESONANCE BRIBE — −25% RESONANCE ]
          </Text>
        </Pressable>
      ) : null}

      {scannerMode && onUseDeadDrop && countCargoItemInstances(cargo, 'dead-drop-token') > 0 ? (
        <Pressable onPress={() => onUseDeadDrop()} style={[styles.ampouleBtn, { borderColor: accentColor }]}>
          <Text style={[styles.ampouleBtnText, { color: accentColor }]}>
            [ USE DEAD-DROP TOKEN — VAULT EXTRACT ]
          </Text>
        </Pressable>
      ) : null}

      {combatMode && onUseCombatConsumable ? (
        <View style={styles.combatConsumableCol}>
          {COMBAT_CONSUMABLE_IDS.map((itemId) => {
            const count = countCargoItemInstances(cargo, itemId);
            if (count <= 0) return null;
            const def = CARGO_ITEM_CATALOG[itemId];
            const useEnabled = combatConsumablesEnabled && def.combatEffect !== 'unimplemented';
            return (
              <Pressable
                key={itemId}
                disabled={!useEnabled}
                onPress={() => onUseCombatConsumable(itemId)}
                style={({ pressed }) => [
                  styles.ampouleBtn,
                  {
                    borderColor: useEnabled ? accentColor : '#1a2e22',
                    opacity: useEnabled && pressed ? 0.75 : useEnabled ? 1 : 0.45,
                  },
                ]}
              >
                <Text style={[styles.ampouleBtnText, { color: useEnabled ? accentColor : '#2a4032' }]}>
                  {`[ USE ${def.name.toUpperCase()} ] x${count}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {onContinue ? (
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueBtn,
            { borderColor: accentColor, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.continueBtnText, { color: accentColor }]}>{continueLabel}</Text>
        </Pressable>
      ) : null}
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
  },
  rootCentered: {
    alignSelf: 'center',
  },
  rootMinimal: {
    gap: 28,
  },
  gridDock: {
    alignItems: 'center',
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
  },
  cell: {
    width: CARGO_CELL_SIZE,
    height: CARGO_CELL_SIZE,
    borderWidth: 1,
  },
  placedLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  externalBay: {
    minHeight: 72,
    justifyContent: 'center',
    width: '100%',
    gap: 8,
  },
  containmentLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  externalRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 20,
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: '100%',
  },
  externalSlot: {
    width: CARGO_CELL_SIZE,
    height: CARGO_CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootSprite: {
    backgroundColor: 'transparent',
  },
  combatConsumableCol: {
    width: CARGO_GRID_FRAME_SIZE,
    gap: 8,
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
    borderWidth: 1,
    paddingVertical: 10,
    backgroundColor: '#050608',
    alignItems: 'center',
    width: CARGO_GRID_FRAME_SIZE,
    alignSelf: 'center',
  },
  continueBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
