import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import CargoPackingPanel from '../CargoPackingPanel';
import DossierCardShell from '../hub/DossierCardShell';
import { LoadoutTabHeader, LoadoutSectionHeader } from '../hub/loadoutTabUi';
import SafehouseStashPanel from './SafehouseStashPanel';
import { DOSSIER_FOREGROUND } from '../../constants/dossierSurface';
import type { CargoDragSource } from '../CargoGridBoard';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useWorldState } from '../../context/WorldStateContext';
import {
  countSpecialCargoInPreRunCargo,
} from '../../data/postRunCargoRoutingRunState';
import {
  formatCargoRoutingPostExtractReminder,
  formatContractCargoDeliveryHints,
} from '../../data/cargoRoutingIntelEngine';
import { isResourceContractObjective } from '../../data/contractResolver';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { useHubLayout } from '../../context/HubLayoutContext';
import {
  pointInWindowRect,
  resolveCargoGridCellFromWindow,
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
    stageStashItemToPreRunCargo,
    returnPreRunCargoToStash,
    returnAllPreRunContainmentToStash,
    appendHubLog,
  } = usePlayerAccount();
  const { persisted, runGenerationContext } = useWorldState();
  const selectedContract = persisted.contractBoard.selectedContract;

  const specialPreRunStacks = useMemo(
    () => countSpecialCargoInPreRunCargo(
      account.preRunCargo,
      null,
      runGenerationContext,
    ),
    [account.preRunCargo, runGenerationContext],
  );

  const contractDeliveryHints = useMemo(() => (
    selectedContract.kind === 'SPONSOR'
      && isResourceContractObjective(selectedContract.contract.objectiveKind)
      ? formatContractCargoDeliveryHints(selectedContract.contract)
      : []
  ), [selectedContract]);

  const [externalHover, setExternalHover] = useState<{ itemId: CargoItemId; row: number; col: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{ itemId: CargoItemId; x: number; y: number } | null>(null);
  const [stashDropActive, setStashDropActive] = useState(false);
  const [cargoAreaSize, setCargoAreaSize] = useState({ width: 0, height: 0 });

  const gridMetricsRef = useRef<CargoGridWindowMetrics | null>(null);
  const cargoAreaMetricsRef = useRef<WindowRect | null>(null);
  const stashMetricsRef = useRef<WindowRect | null>(null);
  const cargoAreaRef = useRef<View>(null);
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

  const reportCargoAreaMetrics = useCallback(() => {
    cargoAreaRef.current?.measureInWindow((pageX, pageY, width, height) => {
      cargoAreaMetricsRef.current = { pageX, pageY, width, height };
    });
  }, []);

  const isOverStash = useCallback((absoluteX: number, absoluteY: number) => {
    const stash = stashMetricsRef.current;
    return stash ? pointInWindowRect(absoluteX, absoluteY, stash, STASH_DROP_PADDING) : false;
  }, []);

  const isOverCargoArea = useCallback((absoluteX: number, absoluteY: number) => {
    const area = cargoAreaMetricsRef.current;
    return area ? pointInWindowRect(absoluteX, absoluteY, area, 8) : false;
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
    if (!isOverCargoArea(absoluteX, absoluteY)) return false;

    const metrics = gridMetricsRef.current;
    const cell = metrics ? resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics) : null;
    if (cell) {
      const result = loadStashItemToCargoAtCell(itemId, cell.row, cell.col);
      appendHubLog(result.logLine);
      return result.success;
    }

    const staged = stageStashItemToPreRunCargo(itemId);
    appendHubLog(staged.logLine);
    return staged.success;
  }, [appendHubLog, isOverCargoArea, loadStashItemToCargoAtCell, stageStashItemToPreRunCargo]);

  const handleStashDragStart = useCallback((_itemId: CargoItemId) => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOffsetRef.current = { x, y };
    });
    reportCargoAreaMetrics();
    setExternalHover(null);
    setStashDropActive(false);
  }, [reportCargoAreaMetrics]);

  const handleStashDragMove = useCallback((itemId: CargoItemId, absoluteX: number, absoluteY: number) => {
    setDragGhost({ itemId, x: absoluteX, y: absoluteY });
    updateStashDropHighlight(absoluteX, absoluteY);
    const metrics = gridMetricsRef.current;
    if (metrics && isOverCargoArea(absoluteX, absoluteY)) {
      const cell = resolveCargoGridCellFromWindow(absoluteX, absoluteY, metrics);
      if (cell) {
        setExternalHover({ itemId, row: cell.row, col: cell.col });
      } else {
        setExternalHover(null);
      }
    } else {
      setExternalHover(null);
    }
  }, [isOverCargoArea, updateStashDropHighlight]);

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
      <LoadoutTabHeader
        title="Cargo Hold"
        subtitle="Recovered resources are stored here during the run. Unstable cargo may alter descent conditions."
      />
      <View style={[styles.split, isDesktop && styles.splitDesktop, { gap: scaleSpacing(10) }]}>
        <DossierCardShell
          fillHeight
          padding={scaleSpacing(10)}
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
          contentStyle={styles.stashContent}
        >
          <SafehouseStashPanel
            fillHeight={Platform.OS === 'web'}
            shellWrapped
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
        </DossierCardShell>

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
          <LoadoutSectionHeader label="Current Cargo Grid" style={[styles.deploymentTitle, { marginBottom: scaleSpacing(4) }]} />

          {specialPreRunStacks > 0 ? (
            <TerminalText variant="caption" style={{ color: accent, marginBottom: scaleSpacing(4) }}>
              {`${specialPreRunStacks} special stack(s) staged — post-run routing on extract.`}
            </TerminalText>
          ) : null}
          <TerminalText variant="caption" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(6) }}>
            {formatCargoRoutingPostExtractReminder()}
          </TerminalText>
          {contractDeliveryHints.map((line) => (
            <TerminalText key={line} variant="caption" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}>
              {line}
            </TerminalText>
          ))}

          <View
            style={[
              styles.containmentField,
              isDesktop && styles.containmentFieldDesktop,
            ]}
          >
            <View
              ref={cargoAreaRef}
              style={styles.cargoWrap}
              onLayout={(event) => {
                handleCargoAreaLayout(event);
                reportCargoAreaMetrics();
              }}
            >
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
              cargoBackdrop
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
  stashContent: {
    flex: 1,
    minHeight: 0,
  },
  deploymentPanel: {
    minHeight: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  deploymentContent: {
    flex: 1,
    minHeight: 0,
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
