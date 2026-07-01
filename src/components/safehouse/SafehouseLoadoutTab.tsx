import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import CargoPackingPanel from '../CargoPackingPanel';
import DossierCardShell from '../hub/DossierCardShell';
import SafehouseStashPanel from './SafehouseStashPanel';
import { DOSSIER_FOREGROUND } from '../../constants/dossierSurface';
import type { CargoDragSource } from '../CargoGridBoard';
import { canPlaceCargoItem } from '../../data/cargoGridEngine';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  resolveHubLoadoutCellSize,
  resolveHubStashIconSquareSize,
  scaleHubCargoCellSize,
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
  const {
    isDesktop,
    scaleSpacing,
    stashLaneWidth,
    deploymentLaneWidth,
    iconSize,
  } = useHubLayout();

  const stashIconSquareSize = resolveHubStashIconSquareSize(iconSize);
  const cargoCellTarget = scaleHubCargoCellSize(stashIconSquareSize);

  const hubCellSize = useMemo(
    () => resolveHubLoadoutCellSize(
      cargoAreaSize.width,
      cargoAreaSize.height,
      cargoCellTarget,
      cargoCellTarget,
    ),
    [cargoAreaSize.height, cargoAreaSize.width, cargoCellTarget],
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
      <View style={[styles.split, isDesktop && styles.splitDesktop, { gap: scaleSpacing(10) }]}>
        <View
          style={[
            styles.stashColumn,
            Platform.OS === 'web' && styles.stashColumnWeb,
            {
              flex: isDesktop ? 1 : undefined,
              width: isDesktop ? stashLaneWidth : undefined,
              minWidth: 0,
              minHeight: 0,
              flexShrink: isDesktop ? 1 : 1,
            },
          ]}
        >
          <SafehouseStashPanel
          fillHeight={Platform.OS === 'web'}
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

        <DossierCardShell
          fillHeight
          padding={scaleSpacing(10)}
          style={[
            styles.deploymentPanel,
            isDesktop && styles.deploymentPanelDesktop,
            Platform.OS === 'web' && styles.deploymentPanelWeb,
            {
              flex: 1,
              minWidth: isDesktop ? deploymentLaneWidth : 0,
            },
          ]}
          contentStyle={styles.deploymentContent}
        >
          <TerminalText variant="panelTitle" letterSpacing={0.8} style={[styles.deploymentTitle, { color: accent, marginBottom: scaleSpacing(4) }]}>
            DEPLOYMENT PACK
          </TerminalText>

          <View
            style={[
              styles.containmentField,
              isDesktop && styles.containmentFieldDesktop,
              { borderColor: 'rgba(255, 255, 255, 0.1)' },
            ]}
          >
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
        </DossierCardShell>
      </View>

      {dragGhost ? (
        <View style={styles.dragGhostLayer} pointerEvents="none">
          <Image
            source={resolveCargoItemIcon(dragGhost.itemId)}
            resizeMode="contain"
            style={[
              styles.dragGhostIcon,
              {
                width: stashIconSquareSize,
                height: stashIconSquareSize,
                left: dragGhost.x - rootOffsetRef.current.x - stashIconSquareSize / 2,
                top: dragGhost.y - rootOffsetRef.current.y - stashIconSquareSize / 2,
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
  splitDesktop: {
    alignItems: 'stretch',
  },
  stashColumn: {
    flex: 1,
    minHeight: 0,
  },
  stashColumnWeb: {
    alignSelf: 'stretch',
    height: '100%',
  },
  deploymentPanel: {
    minHeight: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  deploymentContent: {
    flex: 1,
    minHeight: 0,
    paddingTop: 6,
  },
  deploymentPanelDesktop: {
    flexShrink: 0,
  },
  deploymentPanelWeb: {
    alignSelf: 'stretch',
    height: '100%',
  },
  deploymentTitle: {
    fontWeight: '700',
    flexShrink: 0,
  },
  containmentField: {
    flex: 1,
    minHeight: 0,
    borderWidth: 2,
    backgroundColor: DOSSIER_FOREGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  containmentFieldDesktop: {
    padding: 12,
  },
  cargoWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DOSSIER_FOREGROUND,
  },
  dragGhostLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
  },
  dragGhostIcon: {
    position: 'absolute',
    opacity: 0.92,
  },
});
