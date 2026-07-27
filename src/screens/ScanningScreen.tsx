import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import TerminalText from '../components/TerminalText';
import HapticPressable from '../components/HapticPressable';
import {
  formatScannerNodeIntel,
  generateDepthNodeScanVectors,
} from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
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
import ScannerSonarChildHints from '../components/scanner/ScannerSonarChildHints';
import KeepsakeCartographGhostHint from '../components/scanner/KeepsakeCartographGhostHint';
import KeepsakeStampedExtractionHint from '../components/scanner/KeepsakeStampedExtractionHint';
import ScannerSonarPrompt from '../components/scanner/ScannerSonarPrompt';
import ScannerSignalOverlays from '../components/scanner/ScannerSignalOverlays';
import ScannerVeilFrontLegend from '../components/scanner/ScannerVeilFrontLegend';
import ScanScreenHeader from '../components/scanner/ScanScreenHeader';
import ScanInstrument from '../components/scanner/ScanInstrument';
import { DOSSIER_ROW_BG } from '../constants/dossierSurface';
import { formatRiftManifestLog } from '../utils/overworldBlindScout';
import { hasFieldRunItem } from '../data/runItemFieldEngine';
import { getKeepsakeCartographGhostType } from '../data/expeditionKeepsakeScannerEngine';
import {
  computeBaseSectorExtractionPayout,
  previewKeepsakeStampedExtractionPayout,
} from '../data/expeditionKeepsakeEconomyEngine';
import {
  getSectorZone,
  isEmergencyRecallAvailable,
} from '../data/sectorZoneEngine';
import {
  SCANNER_APERTURE_SAFE_INSET,
  SCANNER_FIELD_SURROUND,
  SCANNER_PAGE_BG,
  SCANNER_TELEMETRY_RAIL_HEIGHT,
} from '../components/scanner/vectorScannerShared';
import { OccultInterference } from '../components/hub/veilChrome';
import VeilWarpField from '../components/scanner/VeilWarpField';
import {
  SCANNER_INSTRUMENT_BIAS_X,
  publishScannerSweepGeometry,
} from '../components/scanner/scannerSweepBridge';

const TERMINAL_ACCENT = '#00ff33';
const SCANNER_BEZEL_PADDING = 4;

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
  const { panelPadding } = useLandscapeMetrics();
  const { isDesktop } = useResponsiveScale();
  const { fontScale } = useResponsiveLayout();
  const {
    runState,
    scanSessionKey,
    activeIncursion,
    getCurrentVectorCluster,
    syncProceduralScannerTypes,
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
    useSonarPingOnNode,
    hasSonarPingInCargo,
    useRelaySpikeOnNode,
    useNullLensOnNode,
    tryDeferEngageForFieldTool,
    hasPendingEncounterWarning,
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
    const innerHeight = scannerViewportSize.height
      - SCANNER_BEZEL_PADDING * 2
      - SCANNER_TELEMETRY_RAIL_HEIGHT;
    if (innerWidth <= 0 || innerHeight <= 0) return 0;
    return Math.max(
      0,
      Math.floor(Math.min(innerWidth, innerHeight) - SCANNER_APERTURE_SAFE_INSET),
    );
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
      activeIncursion.proceduralRunTree,
      activeIncursion.cargo,
      nodeIndex,
    ],
  );

  useEffect(() => {
    if (isScanningHub && activeIncursion.proceduralRunTree) {
      syncProceduralScannerTypes();
    }
  }, [
    isScanningHub,
    activeIncursion.nodesCleared,
    activeIncursion.cargo,
    activeIncursion.proceduralRunTree,
    syncProceduralScannerTypes,
  ]);

  const selectedNode = getPreviewNode();
  const hasSelection = selectedNode != null;
  const sectorDisplayName = useMemo(() => {
    const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
    return (sector?.name ?? `SECTOR T${activeIncursion.sectorTier}`).toUpperCase();
  }, [activeIncursion.sectorTier, runState.currentSector]);
  const selectedBearingDeg = useMemo(() => {
    if (!selectedNodeId || scannerSize <= 0) return null;
    const dot = vectorDots.find((entry) => entry.id === selectedNodeId);
    if (!dot) return null;
    const cx = scannerSize / 2;
    const cy = scannerSize / 2;
    const rad = Math.atan2(dot.y - cy, dot.x - cx);
    return ((rad * 180) / Math.PI + 360) % 360;
  }, [scannerSize, selectedNodeId, vectorDots]);
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
    const lines = formatScannerNodeIntel(
      selectedNode,
      activeIncursion.currentMacroBiomeFamily,
      optionIndex,
      activeIncursion.runGenerationContext,
      activeIncursion.runVeilBiome,
    );
    const polaroid = activeIncursion.keepsakeGravePolaroidPreview;
    if (polaroid && polaroid.nodeId === selectedNode.id) {
      return [...lines, ...polaroid.lines];
    }
    if (activeIncursion.keepsakeStampedExtractionNodeId === selectedNode.id) {
      const base = computeBaseSectorExtractionPayout(activeIncursion);
      const preview = previewKeepsakeStampedExtractionPayout(
        activeIncursion.keepsakeRuntime,
        activeIncursion,
        base,
        selectedNode.id,
      );
      return [
        ...lines,
        `>> STAMPED EVAC — verified payout preview: ${preview} CR (+1 free bank on extract).`,
      ];
    }
    return lines;
  }, [
    selectedNode,
    nodeIndexById,
    activeIncursion.currentMacroBiomeFamily,
    activeIncursion.runVeilBiome,
    activeIncursion.runGenerationContext,
    activeIncursion.keepsakeGravePolaroidPreview,
    activeIncursion.keepsakeStampedExtractionNodeId,
    activeIncursion.keepsakeRuntime,
    activeIncursion,
  ]);

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
    setTypeColoredNodeIds(new Set(activeIncursion.keepsakeFullyInterpretedNodeIds));
    setScannerDotsReady(false);
    setVectorDots([]);
    lastManifestedSiphonsRef.current = new Set();
    spawnedDotsRef.current = null;
    spawnedForSessionRef.current = null;
    spawnedClusterKeyRef.current = null;
    spawnedScannerSizeRef.current = 0;
    setNodesInField(vectorCluster.length);
    closeScanPreview();
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, closeScanPreview, activeIncursion.keepsakeFullyInterpretedNodeIds]);

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
      const dots = generateDepthNodeScanVectors(
        vectorCluster,
        scannerSize,
        sector,
        undefined,
        activeIncursion.runGenerationContext,
      );
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
    activeIncursion.runGenerationContext,
  ]);

  const handleScannerViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setScannerViewportSize((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  }, []);

  // Atmosphere UV geometry for sweep coupling — presentation only; no React frame loop.
  useEffect(() => {
    if (scannerViewportSize.width <= 0 || scannerViewportSize.height <= 0 || scannerSize <= 0) {
      return;
    }
    // Atmosphere host is clipped above the telemetry rail — geometry uses that same box.
    const fieldHeight = Math.max(
      0,
      scannerViewportSize.height - SCANNER_TELEMETRY_RAIL_HEIGHT,
    );
    publishScannerSweepGeometry({
      fieldWidth: scannerViewportSize.width,
      fieldHeight,
      scannerSize,
      bezelPadding: SCANNER_BEZEL_PADDING,
      biasX: SCANNER_INSTRUMENT_BIAS_X,
      bottomReserve: 0,
    });
  }, [scannerSize, scannerViewportSize.height, scannerViewportSize.width]);

  const markNodeTypeColored = useCallback((nodeId: string) => {
    setTypeColoredNodeIds((prev) => {
      if (prev.has(nodeId)) return prev;
      return new Set([...prev, nodeId]);
    });
  }, []);

  useEffect(() => {
    activeIncursion.keepsakeFullyInterpretedNodeIds.forEach((nodeId) => {
      markNodeTypeColored(nodeId);
    });
  }, [activeIncursion.keepsakeFullyInterpretedNodeIds, markNodeTypeColored]);

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
    if (selectedNodeId && tryDeferEngageForFieldTool(selectedNodeId)) {
      return;
    }
    const nodeType = confirmScanPreview();
    // Phase B — high-risk/modifier combat waits on EncounterWarningCardOverlay.
    if (hasPendingEncounterWarning()) {
      return;
    }
    routeAfterEngage(nodeType);
  }, [
    confirmScanPreview,
    hasPendingEncounterWarning,
    routeAfterEngage,
    selectedNodeId,
    tryDeferEngageForFieldTool,
  ]);

  const handleEmergencyRecall = useCallback(() => {
    if (initiateEmergencyRecall()) {
      startCombat();
    }
  }, [initiateEmergencyRecall, startCombat]);

  const dockScannerState = useMemo(() => {
    if (!hasSelection) return undefined;
    if (canEngage) return 'BREACH LINK AVAILABLE';
    if (siphonedNodeIds.length === 0) return 'SELECT AN ILLUMINATED PING';
    return 'TAP A LOCKED PING TO REVIEW';
  }, [canEngage, hasSelection, siphonedNodeIds.length]);

  const showSonarPrompt = Boolean(
    selectedNodeId
    && hasSonarPingInCargo()
    && activeIncursion.proceduralRunTree
    && !activeIncursion.revealedSonarNodeIds.includes(selectedNodeId),
  );
  const showRelaySpikePrompt = Boolean(
    selectedNodeId
    && hasFieldRunItem(activeIncursion.runItems, 'relay-spike')
    && activeIncursion.itemRuntime.pendingRelayModifier == null,
  );
  const showNullLensPrompt = Boolean(
    selectedNodeId
    && hasFieldRunItem(activeIncursion.runItems, 'null-lens-filter')
    && !activeIncursion.keepsakeFullyInterpretedNodeIds.includes(selectedNodeId),
  );

  const scannerPane = (
    <View style={styles.scannerViewport} onLayout={handleScannerViewportLayout}>
      <View style={styles.scannerBezel}>
        <View pointerEvents="none" style={styles.scannerAtmosphere}>
          <VeilWarpField />
          {/* Web: VeilWarpField replaces OccultInterference. Native: keep quiet interference. */}
          {Platform.OS !== 'web' ? (
            <OccultInterference active color="rgba(140, 115, 159, 1)" />
          ) : null}
        </View>
        {scannerSize > 0 && scannerDotsReady && vectorDots.length > 0 ? (
          <>
            <View style={styles.scannerInstrument}>
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
            </View>
            <ScannerVeilFrontLegend
              runContext={activeIncursion.runGenerationContext}
              ledger={activeIncursion.runResourceLedger}
              contract={activeIncursion.activeContract}
              mutedColor={theme.mutedColor}
              accentColor={accent}
            />
            <ScannerSignalOverlays
              radarDots={vectorDots}
              siphonedNodeIds={siphonedNodeIds}
              selectedNodeId={selectedNodeId}
              fullyInterpretedNodeIds={activeIncursion.keepsakeFullyInterpretedNodeIds}
            />
            {(activeIncursion.keepsakeCartographGhostNodeIds.length > 0
              ? activeIncursion.keepsakeCartographGhostNodeIds
              : activeIncursion.keepsakeCartographGhostNodeId
                ? [activeIncursion.keepsakeCartographGhostNodeId]
                : []
            ).map((ghostNodeId) => {
              const ghostType = getKeepsakeCartographGhostType(activeIncursion, ghostNodeId);
              if (!ghostType) return null;
              return (
                <KeepsakeCartographGhostHint
                  key={`cartograph-ghost-${ghostNodeId}`}
                  nodeId={ghostNodeId}
                  ghostType={ghostType}
                  radarDots={vectorDots}
                />
              );
            })}
            {activeIncursion.keepsakeStampedExtractionNodeId ? (
              <KeepsakeStampedExtractionHint
                nodeId={activeIncursion.keepsakeStampedExtractionNodeId}
                radarDots={vectorDots}
              />
            ) : null}
            {activeIncursion.proceduralRunTree
              ? activeIncursion.revealedSonarNodeIds.map((nodeId) => (
                <ScannerSonarChildHints
                  key={`sonar-${nodeId}`}
                  tree={activeIncursion.proceduralRunTree!}
                  parentNodeId={nodeId}
                  radarDots={vectorDots}
                  scannerSize={scannerSize}
                />
              ))
              : null}
          </>
        ) : null}
      </View>
    </View>
  );

  const nodeDockPane = (
    <View style={styles.nodeDockBody}>
      <InlineScannerEngagement
        layout="dock"
        spectralLines={showNodeDock ? intelLines : []}
        idleMessage={dockScannerState}
        signalDecrypted={allNodesLocked}
        contactTyped={Boolean(selectedNodeId && typeColoredNodeIds.has(selectedNodeId))}
        sectorLabel={sectorDisplayName}
        selectedBearingDeg={selectedBearingDeg}
        fingerprintSeed={selectedNodeId ?? undefined}
        fingerprintAccent={accent}
        canEngage={canEngage}
        accent={accent}
        mutedColor={theme.mutedColor}
        engageLabel="BREACH"
        onEngage={handleEngage}
        sonarPrompt={showSonarPrompt || showRelaySpikePrompt || showNullLensPrompt ? (
          <View style={{ gap: 6, paddingHorizontal: 26 }}>
            {showSonarPrompt ? (
              <ScannerSonarPrompt
                visible
                onUse={() => {
                  if (selectedNodeId) useSonarPingOnNode(selectedNodeId);
                }}
              />
            ) : null}
            {showNullLensPrompt ? (
              <HapticPressable
                onPress={() => {
                  if (selectedNodeId) useNullLensOnNode(selectedNodeId);
                }}
                style={({ pressed }) => [
                  { borderWidth: 1, borderColor: accent, padding: 8, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <TerminalText size={9} letterSpacing={0.8} style={{ color: accent, fontWeight: '700' }}>
                  [ NULL-LENS ] — FULL INTERPRET NODE
                </TerminalText>
              </HapticPressable>
            ) : null}
            {showRelaySpikePrompt ? (
              <HapticPressable
                onPress={() => {
                  if (!selectedNodeId) return;
                  const tree = activeIncursion.proceduralRunTree;
                  const isBoss = tree?.bossNodeId === selectedNodeId
                    || tree?.nodes[selectedNodeId]?.type === 'GATEKEEPER';
                  useRelaySpikeOnNode(selectedNodeId, Boolean(isBoss));
                }}
                style={({ pressed }) => [
                  { borderWidth: 1, borderColor: accent, padding: 8, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <TerminalText size={9} letterSpacing={0.8} style={{ color: accent, fontWeight: '700' }}>
                  [ RELAY SPIKE ] — PLANT ON NODE
                </TerminalText>
              </HapticPressable>
            ) : null}
          </View>
        ) : null}
      />
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
        style={{ backgroundColor: SCANNER_PAGE_BG }}
        hideRunChrome
      >
        <View style={[styles.body, { padding: Math.max(panelPadding, isDesktop ? 22 : panelPadding) }]}>
          <ScanScreenHeader
            title="FIELD SCANNER"
            subtitle={sectorDisplayName}
            fontScale={fontScale}
          />
          <ScanInstrument
            style={styles.instrument}
            scanner={scannerPane}
            dossier={nodeDockPane}
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
    paddingBottom: 20,
  },
  instrument: {
    flex: 1,
    minHeight: 0,
    marginTop: 2,
  },
  fallback: { fontFamily: 'monospace', fontSize: 10, textAlign: 'center', padding: 24 },
  scannerViewport: {
    flex: 1,
    minHeight: 0,
  },
  scannerBezel: {
    flex: 1,
    width: '100%',
    borderWidth: 0,
    backgroundColor: SCANNER_FIELD_SURROUND,
    padding: SCANNER_BEZEL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backgroundImage:
          `radial-gradient(ellipse at 42% 48%, rgba(100, 201, 177, 0.015) 0%, transparent 52%),`
          + `linear-gradient(180deg, #090E0E 0%, ${SCANNER_FIELD_SURROUND} 55%, #060A0A 100%)`,
      } as object,
      default: {},
    }),
  },
  /** Atmosphere shares the instrument box — not drawn under the telemetry rail. */
  scannerAtmosphere: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: SCANNER_TELEMETRY_RAIL_HEIGHT,
    overflow: 'hidden',
    zIndex: 0,
  },
  /** Instrument box ends above the telemetry rail so the circular aperture is never clipped. */
  scannerInstrument: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: SCANNER_TELEMETRY_RAIL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: SCANNER_INSTRUMENT_BIAS_X }],
    zIndex: 1,
  },
  nodeDockBody: {
    flex: 1,
    minHeight: 0,
  },
  recallBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: DOSSIER_ROW_BG,
    marginHorizontal: 22,
    marginBottom: 10,
  },
  recallBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
