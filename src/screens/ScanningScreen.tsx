import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { generateDepthNodeScanVectors } from '../data/descentEngine';
import {
  formatFocusedIntel,
  formatSpectralBlock,
} from '../data/sectorGraphEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import InlineScannerEngagement from '../components/overworld/InlineScannerEngagement';
import SectorOverworldMap from '../components/SectorOverworldMap';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useGameFlow } from '../context/GameFlowContext';
import { getFactionDefinition } from '../data/factions';
import { RadarDot } from '../types/run';
import type { ScannerCabal } from '../types/scanner';
import { isTerminalBlindActive } from '../data/resonanceEscalationEngine';
import { getZoneScannerTint } from '../components/scanner/zoneScannerThemes';
import {
  getSectorZone,
  isEmergencyRecallAvailable,
  isFullBlindZone,
} from '../data/sectorZoneEngine';

const TERMINAL_ACCENT = '#00ff33';

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
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
    focusPreviewNode,
    appendRunLog,
    initiateEmergencyRecall,
  } = useRun();
  const { account } = usePlayerAccount();
  const { isScanningHub, finalizeSectorExtraction } = useDescentNavigator();
  const {
    startNarrative,
    startCombat,
    startRest,
    startBlackMarket,
    startResourceHarvest,
    startExtractionReview,
  } = useGameFlow();

  const cabal: ScannerCabal = account.alignedFaction ?? 'TERRAN_GRID';
  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [vectorDots, setVectorDots] = useState<RadarDot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [manifestedNodeIds, setManifestedNodeIds] = useState<Set<string>>(() => new Set());
  const [riftsDetected, setRiftsDetected] = useState(0);
  const [riftsTotal, setRiftsTotal] = useState(0);
  const lastRadarSessionRef = useRef<number | null>(null);

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
  const isFocused = selectedNode?.sectorMeta?.isFocused === true;
  const terminalBlindActive = isTerminalBlindActive(activeIncursion.resonanceEscalations);
  const canEngage = hasSelection;
  const fullBlindZone = isFullBlindZone(nodeIndex);
  const isPreAuthExtraction = selectedNode?.type === 'SAFE_ANCHOR_EXTRACTION'
    || selectedNode?.type === 'MASTER_EXTRACTION_LINK';
  const emergencyRecallAvailable = isEmergencyRecallAvailable(nodeIndex);
  const zoneId = getSectorZone(nodeIndex, activeIncursion.collapseActive);
  const zoneTint = useMemo(() => getZoneScannerTint(zoneId), [zoneId]);
  const zoneLineColor = zoneTint.line ?? '#3f6212';
  const canFocus = hasSelection
    && !fullBlindZone
    && !isPreAuthExtraction
    && activeIncursion.attunement.current > 0
    && !isFocused
    && !terminalBlindActive;

  const spectralLines = useMemo(() => {
    if (!selectedNode?.sectorMeta) return [];
    if (isFocused) return formatFocusedIntel(selectedNode);
    return formatSpectralBlock(selectedNode.sectorMeta, false, terminalBlindActive);
  }, [selectedNode, isFocused, terminalBlindActive]);

  const showNodeDock = Boolean(
    hasSelection
    && selectedNodeId
    && manifestedNodeIds.has(selectedNodeId),
  );

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

    const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
    const dots = generateDepthNodeScanVectors(vectorCluster, 108, sector);
    setVectorDots(dots);
    setSelectedNodeId(null);
    setManifestedNodeIds(new Set());
    setRiftsDetected(0);
    setRiftsTotal(vectorCluster.length);
    closeScanPreview();
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, runState.currentSector, closeScanPreview]);

  const handleMapNodePress = useCallback((nodeId: string) => {
    openScanPreview(nodeId);
    setSelectedNodeId(nodeId);
  }, [openScanPreview]);

  const handleBackToMap = useCallback(() => {
    closeScanPreview();
    setSelectedNodeId(null);
  }, [closeScanPreview]);

  const handleManifestedIdsChange = useCallback((ids: readonly string[]) => {
    setManifestedNodeIds(new Set(ids));
  }, []);

  const handleScoutProgressChange = useCallback((detected: number, total: number) => {
    setRiftsDetected(detected);
    setRiftsTotal(total);
  }, []);

  const routeAfterEngage = useCallback((nodeType: string | null) => {
    if (!nodeType) return;
    switch (nodeType) {
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

  const handleFocus = useCallback(() => {
    focusPreviewNode();
  }, [focusPreviewNode]);

  const handleFrequencyMatch = useCallback((_nodeId: string, distanceMeters: number) => {
    appendRunLog(`>> FREQUENCY MATCH DETECTED // DISTANCE: ${distanceMeters}m`);
  }, [appendRunLog]);

  const handleNodeManifest = useCallback((_nodeId: string, logLine: string) => {
    appendRunLog(logLine);
  }, [appendRunLog]);

  if (!isScanningHub) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.fallback, { color: theme.mutedColor }]}>SCANNING HUB STANDBY</Text>
      </View>
    );
  }

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <OperativeTelemetryBar />

          <View style={styles.mapViewport}>
            <SectorOverworldMap
              graph={activeIncursion.sectorGraph}
              currentNodeId={activeIncursion.currentNodeId}
              encounterPath={activeIncursion.encounterPath}
              focusedNodeIds={activeIncursion.focusedNodeIds}
              cluster={vectorCluster}
              nodesCleared={nodeIndex}
              vectorDots={vectorDots}
              cabal={cabal}
              zoneTint={zoneTint}
              selectedNodeId={selectedNodeId}
              zoneLineColor={zoneLineColor}
              onNodePress={handleMapNodePress}
              onFrequencyMatch={handleFrequencyMatch}
              onNodeManifest={handleNodeManifest}
              onManifestedIdsChange={handleManifestedIdsChange}
              onScoutProgressChange={handleScoutProgressChange}
              layoutRollKey={scanSessionKey}
              mapStatusText={`SECTOR T${activeIncursion.sectorTier} // NODE ${nodeIndex} // RES ${activeIncursion.resonance.percent}% // ATT ${activeIncursion.attunement.current}/${activeIncursion.attunement.max}`}
            />
          </View>

          <View style={[styles.nodeDock, { borderColor: theme.borderColor }]}>
            <Text style={[styles.riftsCounter, { color: theme.mutedColor }]}>
              RIFTS DETECTED {riftsDetected}/{riftsTotal}
            </Text>
            <View style={styles.nodeDockBody}>
              {showNodeDock ? (
                <InlineScannerEngagement
                  layout="dock"
                  headline={selectedNode?.label?.toUpperCase()}
                  spectralLines={spectralLines}
                  canFocus={canFocus}
                  canEngage={canEngage}
                  accent={accent}
                  mutedColor={theme.mutedColor}
                  onFocus={handleFocus}
                  onEngage={handleEngage}
                  onDismiss={handleBackToMap}
                />
              ) : (
                <Text style={[styles.dockPlaceholder, { color: theme.mutedColor }]}>
                  UNCOVER A RIFT ON THE OVERWORLD TO BREACH
                </Text>
              )}
            </View>
            {emergencyRecallAvailable ? (
              <Pressable
                onPress={handleEmergencyRecall}
                style={({ pressed }) => [
                  styles.recallBtn,
                  { borderColor: '#f59e0b', opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.recallBtnText, { color: '#fbbf24' }]}>
                  [ EMERGENCY RECALL — DEFEND THE RIFT ]
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </MacroLogAnchoredLayout>

    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  fallback: { fontFamily: 'monospace', fontSize: 10, textAlign: 'center', padding: 24 },
  mapViewport: {
    flex: 1,
    minHeight: 0,
  },
  nodeDock: {
    flexShrink: 0,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(5, 6, 8, 0.96)',
    gap: 4,
    minHeight: 76,
  },
  riftsCounter: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  nodeDockBody: {
    minHeight: 52,
    justifyContent: 'center',
  },
  dockPlaceholder: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 12,
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
