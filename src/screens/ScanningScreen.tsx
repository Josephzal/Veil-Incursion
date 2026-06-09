import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { generateDepthNodeScanVectors } from '../data/descentEngine';
import {
  formatFocusedIntel,
  formatSpectralBlock,
} from '../data/sectorGraphEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import { calculateGridOccupancy } from '../data/cargoGridEngine';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import SectorOverworldMap from '../components/SectorOverworldMap';
import VectorScanner from '../components/VectorScanner';
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
  isCleanExtractionAvailable,
  isEmergencyRecallAvailable,
  isFullBlindZone,
} from '../data/sectorZoneEngine';

const { width } = Dimensions.get('window');
const TERMINAL_ACCENT = '#00ff33';
const RADAR_SIZE = Math.min(width - 80, 280);
const RADAR_CORE = RADAR_SIZE * 0.48;
const READOUT_FIXED_HEIGHT = 228;

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

  const infiltrationLocked = nodeIndex < 4;
  const zoneLabel = zoneId.replace(/_/g, ' ');
  const vectorCountLabel = `${vectorCluster.length} vector${vectorCluster.length === 1 ? '' : 's'}`;
  const scanHint = infiltrationLocked
    ? `INFILTRATION PHASE — ${vectorCountLabel} // safe extraction locked until node 5`
    : fullBlindZone
      ? `INNER SANCTUM — ${vectorCountLabel} // attunement offline // emergency recall only`
      : activeIncursion.collapseActive
        ? `COLLAPSE RIFT — ${vectorCountLabel} // resonance unbound`
        : `ZONE ${zoneLabel} — ${vectorCountLabel}${
          isCleanExtractionAvailable(nodeIndex) ? ' // safe anchor at crossing depths' : ''
        }${emergencyRecallAvailable ? ' // emergency recall available' : ''}`;

  const spectralLines = useMemo(() => {
    if (!selectedNode?.sectorMeta) return [];
    if (isFocused) return formatFocusedIntel(selectedNode);
    return formatSpectralBlock(selectedNode.sectorMeta, false, terminalBlindActive);
  }, [selectedNode, isFocused, terminalBlindActive]);

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
    const dots = generateDepthNodeScanVectors(vectorCluster, RADAR_SIZE, sector);
    setVectorDots(dots);
    setSelectedNodeId(null);
    closeScanPreview();
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, runState.currentSector, closeScanPreview]);

  const handleMapNodePress = useCallback((nodeId: string) => {
    openScanPreview(nodeId);
    setSelectedNodeId(nodeId);
  }, [openScanPreview]);

  const handleScannerNodeTap = useCallback((nodeId: string) => {
    openScanPreview(nodeId);
    setSelectedNodeId(nodeId);
  }, [openScanPreview]);

  const handleBackToMap = useCallback(() => {
    closeScanPreview();
    setSelectedNodeId(null);
  }, [closeScanPreview]);

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

          <View style={[styles.statusStrip, { borderColor: theme.borderColor }]}>
            <Text style={[styles.statusStripText, { color: theme.mutedColor }]}>
              {`SECTOR T${activeIncursion.sectorTier} // NODE ${nodeIndex} // RES ${activeIncursion.resonance.percent}% // ATT ${activeIncursion.attunement.current}/${activeIncursion.attunement.max}`}
            </Text>
          </View>

          {!hasSelection ? (
            <SectorOverworldMap
              graph={activeIncursion.sectorGraph}
              currentNodeId={activeIncursion.currentNodeId}
              encounterPath={activeIncursion.encounterPath}
              focusedNodeIds={activeIncursion.focusedNodeIds}
              cluster={vectorCluster}
              selectedNodeId={selectedNodeId}
              zoneLineColor={zoneLineColor}
              zoneTint={zoneTint}
              onNodePress={handleMapNodePress}
            />
          ) : (
            <>
              <View style={styles.radarDock}>
                <VectorScanner
                  cabal={cabal}
                  zoneTint={zoneTint}
                  scannerSize={RADAR_SIZE}
                  active
                  continuousScan
                  activeNodes={vectorDots}
                  contactsLocked={false}
                  coreScale={RADAR_CORE / RADAR_SIZE}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={handleScannerNodeTap}
                />
              </View>

              <View
                style={[
                  styles.readoutDock,
                  { borderColor: theme.borderColor, height: READOUT_FIXED_HEIGHT },
                ]}
              >
                <Pressable onPress={handleBackToMap} style={styles.backToMapBtn}>
                  <Text style={[styles.backToMapText, { color: accent }]}>
                    [ ← SECTOR MAP ]
                  </Text>
                </Pressable>

                <Text style={[styles.readoutLabel, { color: theme.mutedColor }]}>
                  {terminalBlindActive
                    ? 'TERMINAL_BLIND // CORRUPTED FEED // BREACH BLIND ONLY'
                    : isFocused
                      ? 'FOCUSED TELEMETRY // CLASSIFICATION UNLOCKED'
                      : 'SPECTRAL READOUT // AMBIGUOUS BAND'}
                </Text>

                <View style={styles.spectralBlock}>
                  {spectralLines.map((line) => (
                    <Text key={line} style={[styles.spectralLine, { color: theme.primaryColor }]} numberOfLines={1}>
                      {line}
                    </Text>
                  ))}
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={handleFocus}
                    disabled={!canFocus}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnHalf,
                      {
                        borderColor: canFocus ? accent : theme.borderColor,
                        opacity: !canFocus ? 0.45 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionBtnText, { color: canFocus ? accent : theme.mutedColor }]}>
                      [ FOCUS −1 ]
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleEngage}
                    disabled={!canEngage}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnHalf,
                      {
                        borderColor: canEngage ? TERMINAL_ACCENT : theme.borderColor,
                        opacity: !canEngage ? 0.45 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionBtnText, { color: canEngage ? TERMINAL_ACCENT : theme.mutedColor }]}>
                      [ BREACH BLIND ]
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.statusLine, { color: theme.mutedColor }]}>
                  {`ATT ${activeIncursion.attunement.current}/${activeIncursion.attunement.max} // RES ${activeIncursion.resonance.percent}% // CARGO ${Math.round(calculateGridOccupancy(activeIncursion.cargo) * 100)}%`}
                </Text>

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
            </>
          )}

          {!hasSelection ? (
            <View style={[styles.mapHintDock, { borderColor: theme.borderColor }]}>
              <Text style={[styles.mapHintText, { color: theme.mutedColor }]}>
                {scanHint}
              </Text>
            </View>
          ) : null}
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
  statusStrip: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexShrink: 0,
  },
  statusStripText: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  radarDock: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readoutDock: {
    flexShrink: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  backToMapBtn: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  backToMapText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  readoutLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  spectralBlock: {
    minHeight: 52,
    gap: 2,
  },
  spectralLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    borderWidth: 2,
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionBtnHalf: {
    flex: 1,
  },
  actionBtnText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statusLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  recallBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  recallBtnText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  mapHintDock: {
    flexShrink: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mapHintText: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 12,
  },
});
