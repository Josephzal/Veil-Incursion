import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BOSS_DEPTH_INDEX, generateTierNodeScanVectors } from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import ScanConfirmOverlay from '../components/ScanConfirmOverlay';
import VectorScanner from '../components/VectorScanner';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useGameFlow } from '../context/GameFlowContext';
import { getFactionDefinition } from '../data/factions';
import { RadarDot } from '../types/run';
import type { ScannerCabal } from '../types/scanner';

const { width } = Dimensions.get('window');
const TERMINAL_ACCENT = '#00ff33';
const RADAR_SIZE = Math.min(width - 80, 280);
const RADAR_CORE = RADAR_SIZE * 0.48;
const READOUT_FIXED_HEIGHT = 72;

type ScanPhase = 'SWEEPING' | 'DOTS';

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
  const { startNarrative, startCombat, startRest } = useGameFlow();

  const cabal: ScannerCabal = account.alignedFaction ?? 'TERRAN_GRID';
  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [phase, setPhase] = useState<ScanPhase>('SWEEPING');
  const [vectorDots, setVectorDots] = useState<RadarDot[]>([]);
  const [siphonedNodeIds, setSiphonedNodeIds] = useState<string[]>([]);
  const bossPreviewOpenedRef = useRef(false);
  const lastRadarSessionRef = useRef<number | null>(null);

  const nodeIndex = activeIncursion.currentNodeIndex;
  const isBossDepth = nodeIndex === BOSS_DEPTH_INDEX;
  const vectorCluster = useMemo(
    () => getCurrentVectorCluster(),
    [
      getCurrentVectorCluster,
      activeIncursion.activeTierVectors,
      activeIncursion.tierNodes,
      activeIncursion.currentTier,
      nodeIndex,
    ],
  );

  const previewNode = getPreviewNode();

  const scannerNodes = useMemo(() => {
    if (phase !== 'DOTS' || isBossDepth) {
      return vectorDots;
    }
    const siphoned = new Set(siphonedNodeIds);
    return vectorDots.filter((dot) => siphoned.has(dot.id));
  }, [phase, isBossDepth, vectorDots, siphonedNodeIds]);

  useEffect(() => {
    if (!isScanningHub || vectorCluster.length === 0) {
      lastRadarSessionRef.current = null;
      return;
    }
    if (lastRadarSessionRef.current === scanSessionKey) return;
    lastRadarSessionRef.current = scanSessionKey;
    bossPreviewOpenedRef.current = false;

    const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
    const dots = generateTierNodeScanVectors(vectorCluster, RADAR_SIZE, sector);
    setVectorDots(dots);
    setSiphonedNodeIds([]);

    if (isBossDepth) {
      setPhase('DOTS');
    } else {
      setPhase('SWEEPING');
    }
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, runState.currentSector, isBossDepth]);

  useEffect(() => {
    if (!isScanningHub || !isBossDepth || vectorDots.length === 0) return;
    if (bossPreviewOpenedRef.current) return;
    bossPreviewOpenedRef.current = true;
    const bossDot = vectorDots.find((dot) => dot.isPreDiscovered) ?? vectorDots[0];
    if (bossDot) openScanPreview(bossDot.id);
  }, [isScanningHub, isBossDepth, vectorDots, openScanPreview]);

  const handleSiphonedNodesChange = useCallback((nodeIds: string[]) => {
    setSiphonedNodeIds((prev) => {
      if (prev.length === nodeIds.length && prev.every((id, index) => id === nodeIds[index])) {
        return prev;
      }
      return nodeIds;
    });
  }, []);

  const handleNodeTap = (nodeId: string) => {
    openScanPreview(nodeId);
  };

  const handleEngage = () => {
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
      default:
        break;
    }
  };

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
              active={phase === 'SWEEPING' && !isBossDepth}
              activeNodes={phase === 'SWEEPING' && !isBossDepth ? vectorDots : scannerNodes}
              contactsLocked={phase === 'DOTS' || isBossDepth}
              coreScale={RADAR_CORE / RADAR_SIZE}
              onSweepComplete={() => setPhase('DOTS')}
              onSelectNode={handleNodeTap}
              onSiphonedNodesChange={handleSiphonedNodesChange}
            />
          </View>

          <View
            style={[
              styles.readoutDock,
              { borderColor: theme.borderColor, height: READOUT_FIXED_HEIGHT },
            ]}
          >
            <View style={styles.readoutInner}>
              <View
                style={[
                  styles.readoutBlock,
                  styles.readoutLayer,
                  phase === 'SWEEPING' && !isBossDepth ? styles.readoutVisible : styles.readoutHidden,
                ]}
                pointerEvents={phase === 'SWEEPING' && !isBossDepth ? 'auto' : 'none'}
              >
                <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>
                  ACTIVE SIPHON // EXTRACT VECTORS
                </Text>
                <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
                  {`Tap illuminated contacts to siphon — ${vectorCluster.length} route${vectorCluster.length === 1 ? '' : 's'} at depth ${nodeIndex + 1}. Siphon at least one contact before ceasing scan.`}
                </Text>
              </View>
              <View
                style={[
                  styles.readoutBlock,
                  styles.readoutLayer,
                  phase === 'DOTS' || isBossDepth ? styles.readoutVisible : styles.readoutHidden,
                ]}
                pointerEvents={phase === 'DOTS' || isBossDepth ? 'auto' : 'none'}
              >
                <Text style={[styles.scanStatus, { color: isBossDepth ? accent : theme.primaryColor }]}>
                  {isBossDepth ? 'PRIORITY TARGET IDENTIFIED' : 'ANOMALY LOCATIONS LOCKED'}
                </Text>
                <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
                  {isBossDepth
                    ? 'Manifested core threat pre-scanned by descent engine. Review classification and engage.'
                    : `Select a node to open classification preview // ${scannerNodes.length} siphoned route${scannerNodes.length === 1 ? '' : 's'} available.`}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </MacroLogAnchoredLayout>

      <ScanConfirmOverlay
        visible={activeIncursion.scanConfirmOverlayVisible}
        node={previewNode}
        theme={theme}
        accentColor={accent}
        currentStamina={runState.currentStamina}
        onAbort={closeScanPreview}
        onEngage={handleEngage}
      />
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
    overflow: 'hidden',
  },
  readoutInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    position: 'relative',
  },
  readoutBlock: { justifyContent: 'center' },
  readoutLayer: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 12,
    bottom: 12,
    justifyContent: 'center',
  },
  readoutVisible: { opacity: 1 },
  readoutHidden: { opacity: 0 },
  scanStatus: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.1, textAlign: 'center' },
  scanSubStatus: { fontFamily: 'monospace', fontSize: 9, marginTop: 6, textAlign: 'center', lineHeight: 13 },
});
