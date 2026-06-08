import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BIOME_DISPLAY_LABEL,
  BOSS_ENCOUNTER_INDEX,
  generateDepthNodeScanVectors,
  getEncounterDisplayLabel,
} from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import VectorScanner from '../components/VectorScanner';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useGameFlow } from '../context/GameFlowContext';
import { getFactionDefinition } from '../data/factions';
import { RadarDot, SCAN_ENGAGE_STAMINA_COST } from '../types/run';
import type { ScannerCabal } from '../types/scanner';

const { width } = Dimensions.get('window');
const TERMINAL_ACCENT = '#00ff33';
const RADAR_SIZE = Math.min(width - 80, 280);
const RADAR_CORE = RADAR_SIZE * 0.48;
/** Fixed readout footprint — must not grow/shrink when a vector is selected. */
const READOUT_FIXED_HEIGHT = 148;

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    scanSessionKey,
    activeIncursion,
    getCurrentVectorCluster,
    openScanPreview,
    closeScanPreview,
    confirmScanPreview,
    getPreviewNode,
  } = useRun();
  const { account } = usePlayerAccount();
  const { isScanningHub } = useDescentNavigator();
  const { startNarrative, startCombat, startRest, startBlackMarket } = useGameFlow();

  const cabal: ScannerCabal = account.alignedFaction ?? 'TERRAN_GRID';
  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [vectorDots, setVectorDots] = useState<RadarDot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const lastRadarSessionRef = useRef<number | null>(null);

  const nodeIndex = activeIncursion.currentEncounterIndex;
  const isBossEncounter = nodeIndex === BOSS_ENCOUNTER_INDEX;
  const vectorCluster = useMemo(
    () => getCurrentVectorCluster(),
    [
      getCurrentVectorCluster,
      activeIncursion.encounterOptionClusters,
      activeIncursion.encounterPath,
      activeIncursion.currentDepth,
      nodeIndex,
    ],
  );

  const selectedNode = getPreviewNode();
  const hasSelection = selectedNode != null;
  const canEngage = hasSelection && runState.currentStamina >= SCAN_ENGAGE_STAMINA_COST;

  const scanHint = isBossEncounter
    ? 'Tap the priority contact when illuminated to lock and review classification.'
    : `Tap illuminated contacts to lock routes — ${vectorCluster.length} vector${vectorCluster.length === 1 ? '' : 's'} at encounter ${nodeIndex + 1}. Scanner remains active.`;

  const metaLine = hasSelection
    ? (
      selectedNode.isPreDiscovered
        ? 'PRIORITY MANIFESTED CORE — PRE-SCANNED BY DESCENT ENGINE.'
        : `BIOME // ${BIOME_DISPLAY_LABEL[selectedNode.biome].toUpperCase()} // ENGAGE ${SCAN_ENGAGE_STAMINA_COST} STAMINA — RESERVE ${runState.currentStamina}`
    )
    : scanHint;

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

  const handleNodeTap = useCallback((nodeId: string) => {
    openScanPreview(nodeId);
    setSelectedNodeId(nodeId);
  }, [openScanPreview]);

  const handleEngage = useCallback(() => {
    const nodeType = confirmScanPreview();
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
      default:
        break;
    }
  }, [confirmScanPreview, startBlackMarket, startCombat, startNarrative, startRest]);

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

          <View style={styles.radarDock}>
            <VectorScanner
              cabal={cabal}
              scannerSize={RADAR_SIZE}
              active
              continuousScan
              activeNodes={vectorDots}
              contactsLocked={false}
              coreScale={RADAR_CORE / RADAR_SIZE}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleNodeTap}
            />
          </View>

          <View
            style={[
              styles.readoutDock,
              { borderColor: theme.borderColor, height: READOUT_FIXED_HEIGHT },
            ]}
          >
            <Text style={[styles.readoutLabel, { color: theme.mutedColor }]}>
              {hasSelection ? 'LOCKED VECTOR // CLASSIFICATION' : 'CONTINUOUS VECTOR SCAN // ACTIVE'}
            </Text>

            <Text
              style={[
                styles.encounterType,
                { color: hasSelection ? (isBossEncounter ? accent : theme.primaryColor) : theme.mutedColor },
              ]}
              numberOfLines={1}
            >
              {hasSelection
                ? getEncounterDisplayLabel(selectedNode.encounterType, selectedNode.encounterIndex).toUpperCase()
                : 'AWAITING VECTOR LOCK'}
            </Text>

            <Text
              style={[
                styles.readoutMeta,
                { color: hasSelection && selectedNode.isPreDiscovered ? accent : theme.mutedColor },
              ]}
              numberOfLines={2}
            >
              {metaLine}
            </Text>

            <Pressable
              onPress={handleEngage}
              disabled={!canEngage}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: canEngage ? TERMINAL_ACCENT : theme.borderColor,
                  opacity: !canEngage ? 0.45 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.actionBtnText, { color: canEngage ? TERMINAL_ACCENT : theme.mutedColor }]}>
                [ ENGAGE ]
              </Text>
            </Pressable>
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
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  readoutLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  encounterType: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.9,
    textAlign: 'center',
    minHeight: 16,
  },
  readoutMeta: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 12,
    minHeight: 24,
  },
  actionBtn: {
    borderWidth: 2,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
