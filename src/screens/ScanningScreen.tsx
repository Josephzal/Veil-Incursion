import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BOSS_DEPTH_INDEX, generateTierNodeScanVectors } from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
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
const RADAR_DOCK_HEIGHT = RADAR_SIZE + 32;

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

  useEffect(() => {
    if (!isScanningHub || vectorCluster.length === 0) {
      lastRadarSessionRef.current = null;
      return;
    }
    if (lastRadarSessionRef.current === scanSessionKey) return;
    lastRadarSessionRef.current = scanSessionKey;
    bossPreviewOpenedRef.current = false;

    const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
    const dots = generateTierNodeScanVectors(vectorCluster, RADAR_CORE, sector);
    setVectorDots(dots);

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
          <View style={[styles.statusBar, { borderColor: theme.borderColor }]}>
            <Text style={[styles.statusBarText, { color: theme.mutedColor }]}>
              {`TIER ${activeIncursion.currentTier} // DEPTH ${nodeIndex + 1}/10 // TACTICAL SWEEP HUB`}
            </Text>
          </View>

          <View style={[styles.radarDock, { height: RADAR_DOCK_HEIGHT }]}>
            <VectorScanner
              cabal={cabal}
              scannerSize={RADAR_SIZE}
              active={phase === 'SWEEPING' && !isBossDepth}
              activeNodes={vectorDots}
              contactsLocked={phase === 'DOTS' || isBossDepth}
              coreScale={RADAR_CORE / RADAR_SIZE}
              onSweepComplete={() => setPhase('DOTS')}
              onSelectNode={handleNodeTap}
            />
          </View>

          <View style={[styles.readoutDock, { borderColor: theme.borderColor }]}>
            <View style={styles.readoutInner}>
              {phase === 'SWEEPING' && !isBossDepth && (
                <View style={styles.readoutBlock}>
                  <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>
                    LOCATING THREAT VECTORS...
                  </Text>
                  <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
                    {`Tactical sweep mapping ${vectorCluster.length} candidate contact${vectorCluster.length === 1 ? '' : 's'} at depth ${nodeIndex + 1}`}
                  </Text>
                </View>
              )}
              {(phase === 'DOTS' || isBossDepth) && (
                <View style={styles.readoutBlock}>
                  <Text style={[styles.scanStatus, { color: isBossDepth ? accent : theme.primaryColor }]}>
                    {isBossDepth ? 'PRIORITY TARGET IDENTIFIED' : 'VECTOR CONTACTS LOCKED'}
                  </Text>
                  <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
                    {isBossDepth
                      ? 'Manifested core threat pre-scanned by descent engine. Review classification and engage.'
                      : `Select a radar contact to open classification preview — ${vectorDots.length} route${vectorDots.length === 1 ? '' : 's'} available.`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.footerTelemetry, { borderColor: theme.borderColor }]}>
            <Text style={[styles.telemetryLine, { color: theme.mutedColor }]}>
              {`TIER ${activeIncursion.currentTier} // DEPTH ${nodeIndex + 1}/10 // CONTACTS: ${vectorCluster.length} // STAMINA: ${runState.currentStamina}`}
            </Text>
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
  statusBar: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16, flexShrink: 0 },
  statusBarText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  radarDock: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  readoutDock: {
    flex: 1,
    minHeight: 88,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    backgroundColor: '#050608',
    overflow: 'hidden',
  },
  readoutInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  readoutBlock: { justifyContent: 'center' },
  scanStatus: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.1, textAlign: 'center' },
  scanSubStatus: { fontFamily: 'monospace', fontSize: 9, marginTop: 6, textAlign: 'center', lineHeight: 13 },
  footerTelemetry: { borderTopWidth: 1, paddingVertical: 8, paddingHorizontal: 16, flexShrink: 0 },
  telemetryLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});
