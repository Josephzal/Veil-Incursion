import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import CargoPackingPanel from '../CargoPackingPanel';
import SafehouseStashPanel from './SafehouseStashPanel';
import type { CargoDragSource } from '../CargoGridBoard';
import { canPlaceCargoItem } from '../../data/cargoGridEngine';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';
import {
  pointInWindowRect,
  resolveCargoGridCellFromWindow,
  resolveHubLoadoutCellSize,
  type CargoGridWindowMetrics,
} from '../../utils/cargoGridLayout';

type WindowRect = { pageX: number; pageY: number; width: number; height: number };

const STASH_DROP_PADDING = 16;

export default function SafehouseLoadoutTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    account,
    relocatePreRunCargoItem,
    loadStashItemToCargoAtCell,
    returnPreRunCargoToStash,
    returnAllPreRunContainmentToStash,
    appendHubLog,
  } = usePlayerAccount();

  const [externalHover, setExternalHover] = useState<{ itemId: CargoItemId; row: number; col: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ itemId: CargoItemId; x: number; y: number } | null>(null);
  const [stashDropActive, setStashDropActive] = useState(false);
  const [cargoAreaSize, setCargoAreaSize] = useState({ width: 0, height: 0 });

  const gridMetricsRef = useRef<CargoGridWindowMetrics | null>(null);
  const stashMetricsRef = useRef<WindowRect | null>(null);
  const rootRef = useRef<View>(null);
  const rootOffsetRef = useRef({ x: 0, y: 0 });

  const accent = theme.statusColor;
  const panelBg = theme.backgroundColor;
  const { safehouseLeftRatio, isDesktop, scaleSpacing } = useResponsiveScale();
  const stashFlex = isDesktop ? safehouseLeftRatio : 1;
  const deploymentFlex = isDesktop ? 1 - safehouseLeftRatio : 1;

  const hubCellSize = useMemo(
    () => resolveHubLoadoutCellSize(cargoAreaSize.width, cargoAreaSize.height),
    [cargoAreaSize.height, cargoAreaSize.width],
  );

  useEffect(() => () => {
    returnAllPreRunContainmentToStash();
  }, [returnAllPreRunContainmentToStash]);

  const isOverStash = useCallback((absoluteX: number, absoluteY: number) => {
    const stash = stashMetricsRef.current;
    return stash ? pointInWindowRect(absoluteX, absoluteY, stash, STASH_DROP_PADDING) : false;
  }, []);

  const updateStashDropHighlight = useCallback((absoluteX: number, absoluteY: number) => {
    setStashDropActive(isOverStash(absoluteX, absoluteY));
  }, [isOverStash]);

  const returnCargoToStash = useCallback((instanceId: string) => {
    const result = returnPreRunCargoToStash(instanceId);
    appendHubLog(result.logLine);
    return result.success;
  }, [appendHubLog, returnPreRunCargoToStash]);

  const tryReturnCargoAtPoint = useCallback((instanceId: string, absoluteX: number, absoluteY: number) => {
    if (!isOverStash(absoluteX, absoluteY)) return false;
    return returnCargoToStash(instanceId);
  }, [isOverStash, returnCargoToStash]);

  const placeStashItemAtPoint = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    const metrics = gridMetricsRef.current;
    if (!metrics) return false;
    const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
    if (!cell) return false;
    if (!canPlaceCargoItem(account.preRunCargo, itemId, cell.row, cell.col)) return false;

    const result = loadStashItemToCargoAtCell(itemId, cell.row, cell.col);
    appendHubLog(result.logLine);
    return result.success;
  }, [account.preRunCargo, appendHubLog, loadStashItemToCargoAtCell]);

  const handleStashDragStart = useCallback((_itemId: CargoItemId) => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOffsetRef.current = { x, y };
    });
    setExternalHover(null);
    setStashDropActive(false);
  }, []);

  const handleStashDragMove = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost({ itemId, x: absoluteX, y: absoluteY });
    updateStashDropHighlight(absoluteX, absoluteY);
    const metrics = gridMetricsRef.current;
    if (metrics) {
      const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
      if (cell && canPlaceCargoItem(account.preRunCargo, itemId, cell.row, cell.col)) {
        setExternalHover({ itemId, row: cell.row, col: cell.col });
      } else {
        setExternalHover(null);
      }
    } else {
      setExternalHover(null);
    }
  }, [account.preRunCargo, updateStashDropHighlight]);

  const handleStashDragEnd = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost(null);
    setExternalHover(null);
    setStashDropActive(false);
    placeStashItemAtPoint(itemId, absoluteX, absoluteY);
  }, [placeStashItemAtPoint]);

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

  const handleCargoAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCargoAreaSize({ width, height });
  }, []);

  return (
    <View ref={rootRef} style={styles.root}>
      <View style={[styles.split, { gap: scaleSpacing(10) }]}>
        <View style={{ flex: stashFlex, minWidth: 0, minHeight: 0 }}>
          <SafehouseStashPanel
          resourceStash={account.resourceStash}
          hubCraftedConsumables={account.hubCraftedConsumables}
          isDropTarget={stashDropActive}
          onPanelMeasured={(rect) => {
            stashMetricsRef.current = rect;
          }}
          onDragStart={handleStashDragStart}
          onDragMove={handleStashDragMove}
          onDragEnd={handleStashDragEnd}
        />
        </View>

        <View
          style={[
            styles.deploymentPanel,
            {
              flex: deploymentFlex,
              borderColor: theme.borderColor,
              backgroundColor: panelBg,
              paddingHorizontal: scaleSpacing(10),
              paddingTop: scaleSpacing(6),
              paddingBottom: scaleSpacing(10),
            },
          ]}
        >
          <TerminalText size={9} letterSpacing={0.8} style={[styles.deploymentTitle, { color: accent, marginBottom: scaleSpacing(4) }]}>
            DEPLOYMENT PACK
          </TerminalText>

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
              onGridMetricsMeasured={(metrics) => {
                gridMetricsRef.current = metrics;
              }}
              onHubExternalDrop={handleHubExternalDrop}
              onDragPositionChange={handleCargoDragPosition}
            />
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
                left: dragGhost.x - rootOffsetRef.current.x - 14,
                top: dragGhost.y - rootOffsetRef.current.y - 14,
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
    minHeight: 0,
  },
  deploymentPanel: {
    borderWidth: 1,
    minHeight: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  deploymentTitle: {
    fontWeight: '700',
    flexShrink: 0,
  },
  cargoWrap: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    marginTop: -2,
  },
  dragGhostLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  dragGhostIcon: {
    position: 'absolute',
    width: 28,
    height: 28,
    opacity: 0.92,
  },
});
