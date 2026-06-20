import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import CargoPackingPanel from '../CargoPackingPanel';
import SafehouseStashPanel from './SafehouseStashPanel';
import type { CargoDragSource } from '../CargoGridBoard';
import { isHubCraftableConsumable } from '../../data/hubSafehouseEngine';
import { calculateCargoMarketValue, calculateGridOccupancy } from '../../data/cargoGridEngine';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../../types/cargoGrid';
import {
  pointInWindowRect,
  resolveCargoGridCellFromWindow,
  resolveHubLoadoutCellSize,
  type CargoGridWindowMetrics,
} from '../../utils/cargoGridLayout';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';

type WindowRect = { pageX: number; pageY: number; width: number; height: number };

export default function SafehouseLoadoutTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    account,
    relocatePreRunCargoItem,
    loadStashItemToCargoAtCell,
    returnPreRunCargoToStash,
    equipTacticalSlot,
    clearTacticalSlot,
    appendHubLog,
  } = usePlayerAccount();

  const [selectedItemId, setSelectedItemId] = useState<CargoItemId | null>(null);
  const [selectedTacticalSlot, setSelectedTacticalSlot] = useState<0 | 1 | 2>(0);
  const [externalHover, setExternalHover] = useState<{ itemId: CargoItemId; row: number; col: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ itemId: CargoItemId; x: number; y: number } | null>(null);
  const [stashDropActive, setStashDropActive] = useState(false);
  const [cargoAreaSize, setCargoAreaSize] = useState({ width: 0, height: 0 });

  const gridMetricsRef = useRef<CargoGridWindowMetrics | null>(null);
  const stashMetricsRef = useRef<WindowRect | null>(null);
  const tacticalSlotMetricsRef = useRef<Array<WindowRect>>([]);
  const rootRef = useRef<View>(null);
  const rootOffsetRef = useRef({ x: 0, y: 0 });

  const accent = theme.statusColor;
  const panelBg = theme.backgroundColor;

  const hubCellSize = useMemo(
    () => resolveHubLoadoutCellSize(cargoAreaSize.width, cargoAreaSize.height),
    [cargoAreaSize.height, cargoAreaSize.width],
  );

  const occupancyPct = useMemo(
    () => Math.round(calculateGridOccupancy(account.preRunCargo) * 100),
    [account.preRunCargo],
  );
  const cargoValue = useMemo(
    () => calculateCargoMarketValue(account.preRunCargo),
    [account.preRunCargo],
  );

  const updateStashDropHighlight = useCallback((absoluteX: number, absoluteY: number) => {
    const stash = stashMetricsRef.current;
    setStashDropActive(stash ? pointInWindowRect(absoluteX, absoluteY, stash) : false);
  }, []);

  const returnCargoToStash = useCallback((instanceId: string) => {
    const result = returnPreRunCargoToStash(instanceId);
    appendHubLog(result.logLine);
    return result.success;
  }, [appendHubLog, returnPreRunCargoToStash]);

  const placeStashItem = useCallback((itemId: CargoItemId, row: number, col: number) => {
    const result = loadStashItemToCargoAtCell(itemId, row, col);
    appendHubLog(result.logLine);
    if (result.success) setSelectedItemId(null);
    return result.success;
  }, [appendHubLog, loadStashItemToCargoAtCell]);

  const resolveTacticalSlotFromPoint = useCallback((absoluteX: number, absoluteY: number): 0 | 1 | 2 | null => {
    const index = tacticalSlotMetricsRef.current.findIndex((rect) => pointInWindowRect(absoluteX, absoluteY, rect));
    return index >= 0 ? index as 0 | 1 | 2 : null;
  }, []);

  const tryReturnCargoAtPoint = useCallback((instanceId: string, absoluteX: number, absoluteY: number) => {
    const stash = stashMetricsRef.current;
    if (!stash || !pointInWindowRect(absoluteX, absoluteY, stash)) return false;
    return returnCargoToStash(instanceId);
  }, [returnCargoToStash]);

  const handleStashDragStart = useCallback((itemId: CargoItemId) => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOffsetRef.current = { x, y };
    });
    setSelectedItemId(itemId);
    setDragGhost(null);
    setExternalHover(null);
    setStashDropActive(false);
  }, []);

  const handleStashDragMove = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost({ itemId, x: absoluteX, y: absoluteY });
    updateStashDropHighlight(absoluteX, absoluteY);
    const metrics = gridMetricsRef.current;
    if (metrics) {
      const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
      setExternalHover(cell ? { itemId, row: cell.row, col: cell.col } : null);
    } else {
      setExternalHover(null);
    }
  }, [updateStashDropHighlight]);

  const handleStashDragEnd = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost(null);
    setExternalHover(null);
    setStashDropActive(false);

    const tacticalSlot = resolveTacticalSlotFromPoint(absoluteX, absoluteY);
    if (tacticalSlot != null && isHubCraftableConsumable(itemId)) {
      const result = equipTacticalSlot(tacticalSlot, itemId);
      appendHubLog(result.logLine);
      if (result.success) setSelectedItemId(null);
      return;
    }

    const metrics = gridMetricsRef.current;
    if (!metrics) return;
    const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
    if (!cell) return;
    placeStashItem(itemId, cell.row, cell.col);
  }, [appendHubLog, equipTacticalSlot, placeStashItem, resolveTacticalSlotFromPoint]);

  const handleCargoDragPosition = useCallback((payload: { source: CargoDragSource; x: number; y: number } | null) => {
    if (!payload) {
      setStashDropActive(false);
      return;
    }
    updateStashDropHighlight(payload.x, payload.y);
  }, [updateStashDropHighlight]);

  const handleHubExternalDrop = useCallback((source: CargoDragSource, absoluteX: number, absoluteY: number) => {
    setStashDropActive(false);
    return tryReturnCargoAtPoint(source.instanceId, absoluteX, absoluteY);
  }, [tryReturnCargoAtPoint]);

  const handlePlaceAtCell = useCallback((row: number, col: number) => {
    if (!selectedItemId) return;
    placeStashItem(selectedItemId, row, col);
  }, [placeStashItem, selectedItemId]);

  const handleEquipTactical = useCallback(() => {
    if (!selectedItemId || !isHubCraftableConsumable(selectedItemId)) return;
    const result = equipTacticalSlot(selectedTacticalSlot, selectedItemId);
    appendHubLog(result.logLine);
    if (result.success) setSelectedItemId(null);
  }, [appendHubLog, equipTacticalSlot, selectedItemId, selectedTacticalSlot]);

  const handleCargoAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCargoAreaSize({ width, height });
  }, []);

  return (
    <View ref={rootRef} style={styles.root}>
      <View style={styles.split}>
        <SafehouseStashPanel
          resourceStash={account.resourceStash}
          hubCraftedConsumables={account.hubCraftedConsumables}
          selectedItemId={selectedItemId}
          isDropTarget={stashDropActive}
          onPanelMeasured={(rect) => {
            stashMetricsRef.current = rect;
          }}
          onSelectItem={setSelectedItemId}
          onDragStart={handleStashDragStart}
          onDragMove={handleStashDragMove}
          onDragEnd={handleStashDragEnd}
        />

        <View style={[styles.deploymentPanel, { borderColor: theme.borderColor, backgroundColor: panelBg }]}>
          <View style={styles.deploymentHeader}>
            <Text style={[styles.deploymentTitle, { color: accent }]}>DEPLOYMENT PACK</Text>
            <Text style={[styles.deploymentStats, { color: theme.primaryColor }]}>
              {`OCCUPANCY ${occupancyPct}% // VALUE ${cargoValue}`}
            </Text>
          </View>

          <View style={styles.cargoWrap} onLayout={handleCargoAreaLayout}>
            <CargoPackingPanel
              cargo={account.preRunCargo}
              theme={theme}
              accentColor={accent}
              onRelocateItem={relocatePreRunCargoItem}
              hideContinueButton
              hidePackHeader
              embedded
              compactCellSize={hubCellSize}
              externalHover={externalHover}
              selectedPlacementItemId={selectedItemId}
              onPlaceAtCell={handlePlaceAtCell}
              onGridMetricsMeasured={(metrics) => {
                gridMetricsRef.current = metrics;
              }}
              onHubExternalDrop={handleHubExternalDrop}
              onDragPositionChange={handleCargoDragPosition}
            />
          </View>

          <View style={styles.tacticalSection}>
            <Text style={[styles.tacticalTitle, { color: accent }]}>TACTICAL CONSUMABLE SLOTS</Text>
            <View style={styles.tacticalRow}>
              {account.tacticalLoadout.map((itemId, index) => {
                const slot = index as 0 | 1 | 2;
                const active = selectedTacticalSlot === slot;
                return (
                  <Pressable
                    key={`tactical-${index}`}
                    ref={(ref) => {
                      if (!ref) return;
                      ref.measureInWindow((pageX, pageY, width, height) => {
                        tacticalSlotMetricsRef.current[slot] = { pageX, pageY, width, height };
                      });
                    }}
                    onPress={() => {
                      setSelectedTacticalSlot(slot);
                      if (selectedItemId && isHubCraftableConsumable(selectedItemId)) {
                        const result = equipTacticalSlot(slot, selectedItemId);
                        appendHubLog(result.logLine);
                        if (result.success) setSelectedItemId(null);
                      }
                    }}
                    style={[
                      styles.tacticalSlot,
                      {
                        borderColor: active ? accent : theme.borderColor,
                        backgroundColor: panelBg,
                      },
                    ]}
                  >
                    <Text style={[styles.slotLabel, { color: theme.mutedColor }]}>{`SLOT ${index + 1}`}</Text>
                    <Text style={[styles.slotValue, { color: itemId ? accent : theme.mutedColor }]} numberOfLines={2}>
                      {itemId ? CARGO_ITEM_CATALOG[itemId]?.name.toUpperCase() : 'EMPTY'}
                    </Text>
                    {itemId ? (
                      <Pressable onPress={() => clearTacticalSlot(slot)} style={styles.clearLink}>
                        <Text style={[styles.clearLinkText, { color: '#ef4444' }]}>[ CLEAR ]</Text>
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={!selectedItemId || !isHubCraftableConsumable(selectedItemId)}
              onPress={handleEquipTactical}
              style={[
                styles.equipBtn,
                {
                  borderColor: selectedItemId ? accent : theme.borderColor,
                  opacity: selectedItemId && isHubCraftableConsumable(selectedItemId) ? 1 : 0.45,
                },
              ]}
            >
              <Text style={[styles.equipBtnText, { color: accent }]}>
                {`[ ARM SLOT ${selectedTacticalSlot + 1} ]`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {dragGhost ? (
        <View style={styles.dragGhostLayer} pointerEvents="none">
          <Image
            source={resolveCargoItemIcon(dragGhost.itemId)}
            resizeMode="contain"
            style={[
              styles.dragGhostIcon,
              {
                left: dragGhost.x - rootOffsetRef.current.x - 18,
                top: dragGhost.y - rootOffsetRef.current.y - 18,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  split: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 0,
  },
  deploymentPanel: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    minHeight: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  deploymentHeader: {
    flexShrink: 0,
    gap: 4,
    marginBottom: 8,
  },
  deploymentTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  deploymentStats: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
  },
  cargoWrap: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalSection: {
    flexShrink: 0,
    gap: 6,
    marginTop: 'auto',
    paddingTop: 8,
  },
  tacticalTitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  tacticalRow: { flexDirection: 'row', gap: 6 },
  tacticalSlot: {
    flex: 1,
    borderWidth: 1,
    padding: 6,
    gap: 2,
    minHeight: 56,
  },
  slotLabel: { fontFamily: 'monospace', fontSize: 6, letterSpacing: 0.5 },
  slotValue: { fontFamily: 'monospace', fontSize: 7, fontWeight: '700' },
  clearLink: { marginTop: 2 },
  clearLinkText: { fontFamily: 'monospace', fontSize: 6 },
  equipBtn: { borderWidth: 1, paddingVertical: 6, alignItems: 'center' },
  equipBtnText: { fontFamily: 'monospace', fontSize: 7, fontWeight: '700' },
  dragGhostLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  dragGhostIcon: {
    position: 'absolute',
    width: 36,
    height: 36,
    opacity: 0.88,
  },
});
