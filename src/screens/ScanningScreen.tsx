import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import TerminalText from '../components/TerminalText';
import HapticPressable from '../components/HapticPressable';
import {
  formatScannerNodeIntel,
  generateDepthNodeScanVectors,
} from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import LandscapeSplitPane from '../components/layout/LandscapeSplitPane';
import InlineScannerEngagement from '../components/overworld/InlineScannerEngagement';
import VectorScanner from '../components/VectorScanner';
import LeyLineBoonSwapOverlay from '../components/LeyLineBoonSwapOverlay';
import ClassBoonSwapOverlay from '../components/ClassBoonSwapOverlay';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useGameFlow } from '../context/GameFlowContext';
import { getFactionDefinition } from '../data/factions';
import { RadarDot } from '../types/run';
import type { ScannerCabal } from '../types/scanner';
import { getZoneScannerTint } from '../components/scanner/zoneScannerThemes';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import { formatRiftManifestLog } from '../utils/overworldBlindScout';
import { resolveRunEventNodeHeaderFromNode } from '../utils/resolveRunEventNodeHeader';
import {
  getSectorZone,
  isEmergencyRecallAvailable,
} from '../data/sectorZoneEngine';

const TERMINAL_ACCENT = '#00ff33';
const SCANNER_BEZEL_PADDING = 6;

/** Preserve spawn layout when the scanner viewport resizes. */
function scaleRadarDots(dots: RadarDot[], fromSize: number, toSize: number): RadarDot[] {
  if (fromSize === toSize) return dots;
  const ratio = toSize / fromSize;
  const fromCenter = fromSize / 2;
  const toCenter = toSize / 2;
  return dots.map((dot) => ({
    ...dot,
    x: toCenter + (dot.x - fromCenter) * ratio,
    y: toCenter + (dot.y - fromCenter) * ratio,
  }));
}

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { useHorizontalSplit, panelPadding } = useLandscapeMetrics();
  const { scannerPrimaryRatio, isDesktop } = useResponsiveScale();
  const { fontScale } = useResponsiveLayout();
  const {
    runState,
    scanSessionKey,
    activeIncursion,
    getCurrentVectorCluster,
    ensureScannerGraphExpanded,
    openScanPreview,
    closeScanPreview,
    confirmScanPreview,
    getPreviewNode,
    appendRunLog,
    initiateEmergencyRecall,
    applyResonanceManifestScan,
    swapLeyLineMutation,
    cancelLeyBoonSwap,
    swapClassBoon,
    cancelClassBoonSwap,
  } = useRun();
  const { account } = usePlayerAccount();
  const { isScanningHub, finalizeSectorExtraction } = useDescentNavigator();
  const {
    startNarrative,
    startCombat,
    startRest,
    startBlackMarket,
    startResourceHarvest,
    startPostCombatBoon,
    startExtractionReview,
  } = useGameFlow();

  const cabal: ScannerCabal = account.alignedFaction ?? 'TERRAN_GRID';
  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [scannerViewportSize, setScannerViewportSize] = useState({ width: 0, height: 0 });
  const scannerSize = useMemo(() => {
    const innerWidth = scannerViewportSize.width - SCANNER_BEZEL_PADDING * 2;
    const innerHeight = scannerViewportSize.height - SCANNER_BEZEL_PADDING * 2;
    if (innerWidth <= 0 || innerHeight <= 0) return 0;
    return Math.floor(Math.min(innerWidth, innerHeight));
  }, [scannerViewportSize]);

  const [vectorDots, setVectorDots] = useState<RadarDot[]>([]);
  const [scannerDotsReady, setScannerDotsReady] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [siphonedNodeIds, setSiphonedNodeIds] = useState<string[]>([]);
  const [typeColoredNodeIds, setTypeColoredNodeIds] = useState<ReadonlySet<string>>(() => new Set());
  const [nodesInField, setNodesInField] = useState(0);
  const lastRadarSessionRef = useRef<number | null>(null);
  const lastManifestedSiphonsRef = useRef<Set<string>>(new Set());
  const spawnedDotsRef = useRef<RadarDot[] | null>(null);
  const spawnedForSessionRef = useRef<number | null>(null);
  const spawnedClusterKeyRef = useRef<string | null>(null);
  const spawnedScannerSizeRef = useRef(0);
  const vectorDotsRef = useRef<RadarDot[]>([]);

  const nodeIndex = activeIncursion.nodesCleared;
  const vectorCluster = useMemo(
    () => getCurrentVectorCluster(),
    [
      getCurrentVectorCluster,
      activeIncursion.sectorGraph,
      activeIncursion.currentNodeId,
      activeIncursion.nodesCleared,
      activeIncursion.resonance.percent,
      activeIncursion.bossDefeated,
      nodeIndex,
    ],
  );

  const selectedNode = getPreviewNode();
  const hasSelection = selectedNode != null;
  const scannerHeader = useMemo(() => {
    if (selectedNode) {
      return resolveRunEventNodeHeaderFromNode(selectedNode, 'DEPTH SCANNER');
    }
    return {
      title: 'DEPTH SCANNER',
      subtitle: `SECTOR T${activeIncursion.sectorTier} // NODE ${activeIncursion.nodesCleared + 1} — SWEEP VECTOR FIELD`,
    };
  }, [activeIncursion.nodesCleared, activeIncursion.sectorTier, selectedNode]);
  const emergencyRecallAvailable = isEmergencyRecallAvailable(nodeIndex);
  const zoneId = getSectorZone(nodeIndex, activeIncursion.collapseActive);
  const zoneTint = useMemo(() => getZoneScannerTint(zoneId), [zoneId]);
  const canEngage = hasSelection;

  const nodeIndexById = useMemo(
    () => new Map(vectorCluster.map((node, index) => [node.id, index])),
    [vectorCluster],
  );

  const clusterNodeIdsKey = useMemo(
    () => vectorCluster.map((node) => node.id).join('\0'),
    [vectorCluster],
  );

  const intelLines = useMemo(() => {
    if (!selectedNode) return [];
    const optionIndex = nodeIndexById.get(selectedNode.id) ?? 0;
    return formatScannerNodeIntel(selectedNode, activeIncursion.currentMacroBiomeFamily, optionIndex);
  }, [selectedNode, nodeIndexById, activeIncursion.currentMacroBiomeFamily]);

  const showNodeDock = hasSelection;
  const allNodesLocked = nodesInField > 0 && siphonedNodeIds.length >= nodesInField;

  useEffect(() => {
    vectorDotsRef.current = vectorDots;
  }, [vectorDots]);

  useEffect(() => {
    if (isScanningHub) {
      ensureScannerGraphExpanded();
    }
  }, [isScanningHub, scanSessionKey, ensureScannerGraphExpanded]);

  useEffect(() => {
    if (!isScanningHub || vectorCluster.length === 0) {
      lastRadarSessionRef.current = null;
      return;
    }
    if (lastRadarSessionRef.current === scanSessionKey) return;
    lastRadarSessionRef.current = scanSessionKey;

    setSelectedNodeId(null);
    setSiphonedNodeIds([]);
    setTypeColoredNodeIds(new Set());
    setScannerDotsReady(false);
    setVectorDots([]);
    lastManifestedSiphonsRef.current = new Set();
    spawnedDotsRef.current = null;
    spawnedForSessionRef.current = null;
    spawnedClusterKeyRef.current = null;
    spawnedScannerSizeRef.current = 0;
    setNodesInField(vectorCluster.length);
    closeScanPreview();
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, closeScanPreview]);

  useEffect(() => {
    if (!isScanningHub || vectorCluster.length === 0 || scannerSize <= 0) {
      setScannerDotsReady(false);
      return;
    }

    const needsSpawn =
      spawnedForSessionRef.current !== scanSessionKey
      || spawnedDotsRef.current == null
      || spawnedClusterKeyRef.current !== clusterNodeIdsKey;

    if (needsSpawn) {
      const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
      const dots = generateDepthNodeScanVectors(vectorCluster, scannerSize, sector);
      spawnedDotsRef.current = dots;
      spawnedForSessionRef.current = scanSessionKey;
      spawnedClusterKeyRef.current = clusterNodeIdsKey;
      spawnedScannerSizeRef.current = scannerSize;
      setVectorDots(dots);
      setScannerDotsReady(true);
      return;
    }

    if (spawnedScannerSizeRef.current !== scannerSize && spawnedDotsRef.current != null) {
      const scaled = scaleRadarDots(
        spawnedDotsRef.current,
        spawnedScannerSizeRef.current,
        scannerSize,
      );
      spawnedDotsRef.current = scaled;
      spawnedScannerSizeRef.current = scannerSize;
      setVectorDots(scaled);
    }
  }, [
    clusterNodeIdsKey,
    isScanningHub,
    vectorCluster,
    scannerSize,
    scanSessionKey,
    runState.currentSector,
  ]);

  const handleScannerViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setScannerViewportSize((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  }, []);

  const markNodeTypeColored = useCallback((nodeId: string) => {
    setTypeColoredNodeIds((prev) => {
      if (prev.has(nodeId)) return prev;
      return new Set([...prev, nodeId]);
    });
  }, []);

  useEffect(() => {
    if (selectedNodeId) markNodeTypeColored(selectedNodeId);
  }, [markNodeTypeColored, selectedNodeId]);

  const selectLockedNode = useCallback((nodeId: string) => {
    if (!siphonedNodeIds.includes(nodeId)) return;
    openScanPreview(nodeId);
    setSelectedNodeId(nodeId);
  }, [openScanPreview, siphonedNodeIds]);

  const handleScannerNodeSelect = useCallback((nodeId: string) => {
    selectLockedNode(nodeId);
  }, [selectLockedNode]);

  const handleSiphonedNodesChange = useCallback((nodeIds: string[]) => {
    setSiphonedNodeIds((previousIds) => {
      const previous = new Set(previousIds);
      const newlyLocked = nodeIds.filter((id) => !previous.has(id));

      nodeIds.forEach((nodeId) => {
        if (lastManifestedSiphonsRef.current.has(nodeId)) return;
        lastManifestedSiphonsRef.current.add(nodeId);
        const node = vectorCluster.find((entry) => entry.id === nodeId);
        if (!node) return;
        appendRunLog(formatRiftManifestLog(node.type, node.label ?? node.id));
        applyResonanceManifestScan(nodeId);
      });

      if (newlyLocked.length > 0) {
        const latestLocked = newlyLocked[newlyLocked.length - 1];
        openScanPreview(latestLocked);
        setSelectedNodeId(latestLocked);
      }

      return nodeIds;
    });
  }, [appendRunLog, applyResonanceManifestScan, openScanPreview, vectorCluster]);

  const routeAfterEngage = useCallback((nodeType: string | null) => {
    if (!nodeType) return;
    switch (nodeType) {
      case 'ANOMALY':
      case 'NARRATIVE_EVENT':
        startNarrative();
        break;
      case 'STANDARD_COMBAT':
      case 'ELITE_COMBAT':
      case 'BOSS_COMBAT':
        startCombat();
        break;
      case 'SANCTUARY':
        startRest();
        break;
      case 'BLACK_MARKET':
        startBlackMarket();
        break;
      case 'RESOURCE_HARVEST':
        startResourceHarvest();
        break;
      case 'VEIL_BLEED_BOON':
        startPostCombatBoon();
        break;
      case 'EMERGENCY_EXTRACTION':
        finalizeSectorExtraction();
        break;
      case 'SAFE_ANCHOR_EXTRACTION':
      case 'MASTER_EXTRACTION_LINK':
        startExtractionReview();
        break;
      default:
        break;
    }
  }, [
    finalizeSectorExtraction,
    startBlackMarket,
    startCombat,
    startExtractionReview,
    startNarrative,
    startPostCombatBoon,
    startResourceHarvest,
    startRest,
  ]);

  const handleEngage = useCallback(() => {
    const nodeType = confirmScanPreview();
    routeAfterEngage(nodeType);
  }, [confirmScanPreview, routeAfterEngage]);

  const handleEmergencyRecall = useCallback(() => {
    if (initiateEmergencyRecall()) {
      startCombat();
    }
  }, [initiateEmergencyRecall, startCombat]);

  const dockPlaceholder = useMemo(() => {
    if (siphonedNodeIds.length === 0) {
      return 'SWEEP THE FIELD — TAP AN ILLUMINATED PING TO LOCK';
    }
    return 'TAP A LOCKED PING TO REVIEW // SELECTED NODE SHOWS BELOW';
  }, [siphonedNodeIds.length]);

  const scannerPane = (
    <View style={styles.scannerViewport} onLayout={handleScannerViewportLayout}>
      <View style={[styles.scannerBezel, { borderColor: `${accent}55` }]}>
        {scannerSize > 0 && scannerDotsReady && vectorDots.length > 0 ? (
          <VectorScanner
            key={`scanner-${scanSessionKey}`}
            cabal={cabal}
            zoneTint={zoneTint}
            scannerSize={scannerSize}
            active
            continuousScan
            activeNodes={vectorDots}
            contactsLocked={false}
            selectedNodeId={selectedNodeId}
            typeColoredNodeIds={typeColoredNodeIds}
            onSelectNode={handleScannerNodeSelect}
            onSiphonedNodesChange={handleSiphonedNodesChange}
          />
        ) : null}
      </View>
    </View>
  );

  const nodeDockPane = (
    <View
      style={[
        styles.nodeDock,
        useHorizontalSplit ? styles.nodeDockHorizontal : styles.nodeDockVertical,
        isDesktop && styles.nodeDockHorizontalDesktop,
        { borderColor: theme.borderColor },
      ]}
    >
      <View style={styles.nodeDockBody}>
        <InlineScannerEngagement
          layout="dock"
          spectralLines={showNodeDock ? intelLines : []}
          idleMessage={showNodeDock ? undefined : dockPlaceholder}
          signalDecrypted={allNodesLocked}
          canEngage={canEngage}
          accent={accent}
          mutedColor={theme.mutedColor}
          engageLabel="[ BREACH ]"
          onEngage={handleEngage}
        />
      </View>
      {emergencyRecallAvailable ? (
        <HapticPressable
          onPress={handleEmergencyRecall}
          style={({ pressed }) => [
            styles.recallBtn,
            { borderColor: '#f59e0b', opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <TerminalText size={8} letterSpacing={0.6} style={[styles.recallBtnText, { color: '#fbbf24' }]}>
            [ EMERGENCY RECALL — DEFEND THE RIFT ]
          </TerminalText>
        </HapticPressable>
      ) : null}
    </View>
  );

  if (!isScanningHub) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.fallback, { color: theme.mutedColor }]}>SCANNING HUB STANDBY</Text>
      </View>
    );
  }

  return (
    <IncursionShell>
      <IncursionRunLayout
        style={{ backgroundColor: theme.backgroundColor }}
        hideRunChrome
      >
        <View style={[styles.body, { padding: panelPadding }]}>
          <RunEventNodeHeader
            title={scannerHeader.title}
            subtitle={scannerHeader.subtitle}
            fontScale={fontScale}
            showRunChrome
          />
          <LandscapeSplitPane
            style={styles.splitBody}
            primary={scannerPane}
            secondary={nodeDockPane}
            primaryRatio={scannerPrimaryRatio}
            primaryStyle={styles.scannerPane}
            secondaryStyle={styles.nodeDockPaneHost}
          />
        </View>
      </IncursionRunLayout>

      <LeyLineBoonSwapOverlay
        visible={activeIncursion.pendingLeyBoonSwap != null}
        ownedMutations={activeIncursion.leyLineMutations}
        incomingMutationId={activeIncursion.pendingLeyBoonSwap?.incomingMutationId ?? 'SHARPENED'}
        theme={theme}
        accentColor={accent}
        onSwap={swapLeyLineMutation}
        onCancel={cancelLeyBoonSwap}
      />

      <ClassBoonSwapOverlay
        visible={activeIncursion.pendingClassBoonSwap != null}
        classId={activeIncursion.pendingClassBoonSwap?.classId ?? 'HEX_SHOT'}
        ownedBoonIds={
          activeIncursion.pendingClassBoonSwap?.classId === 'ENVOY'
            ? activeIncursion.envoyBoons
            : activeIncursion.hexShotBoons
        }
        incomingBoonId={activeIncursion.pendingClassBoonSwap?.incomingBoonId ?? ''}
        theme={theme}
        accentColor={accent}
        onSwap={swapClassBoon}
        onCancel={cancelClassBoonSwap}
      />
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    minHeight: 0,
  },
  splitBody: {
    flex: 1,
    minHeight: 0,
  },
  scannerPane: {
    minHeight: 0,
  },
  nodeDockPaneHost: {
    minHeight: 0,
  },
  fallback: { fontFamily: 'monospace', fontSize: 10, textAlign: 'center', padding: 24 },
  scannerViewport: {
    flex: 1,
    minHeight: 0,
  },
  scannerBezel: {
    flex: 1,
    width: '100%',
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    padding: SCANNER_BEZEL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDock: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(5, 6, 8, 0.96)',
    gap: 8,
  },
  nodeDockVertical: {
    flexShrink: 0,
    borderTopWidth: 1,
    minHeight: 120,
  },
  nodeDockHorizontal: {
    borderLeftWidth: 1,
    minWidth: 240,
  },
  nodeDockHorizontalDesktop: {
    minWidth: 0,
  },
  nodeDockBody: {
    flex: 1,
    minHeight: 0,
  },
  recallBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  recallBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
