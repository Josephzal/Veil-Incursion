import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BOSS_DEPTH_INDEX, generateTierNodeScanVectors } from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import ScanConfirmOverlay from '../components/ScanConfirmOverlay';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useGameFlow } from '../context/GameFlowContext';
import { getFactionDefinition } from '../data/factions';
import { RadarDot } from '../types/run';
import { RunNodeType } from '../types/game';

const { width } = Dimensions.get('window');
const SCAN_SWEEP_MS = 2200;
const SCAN_ROTATIONS = 3;
const SCAN_DURATION_MS = SCAN_SWEEP_MS * SCAN_ROTATIONS;
const SWEEP_DETECT_ARC_DEG = 14;
const PING_FADE_MS = 260;
const DOT_HIT_SIZE = 44;
const DOT_VISUAL_SIZE = 12;
const BOSS_DOT_SIZE = 16;
const TERMINAL_ACCENT = '#00ff33';
const RADAR_SIZE = Math.min(width - 80, 280);
const RADAR_CORE = RADAR_SIZE * 0.48;
const RADAR_DOCK_HEIGHT = RADAR_SIZE + 32;

type ScanPhase = 'SWEEPING' | 'DOTS';

function sweepDeltaDeg(sweepDeg: number, dotDeg: number): number {
  const raw = ((sweepDeg - dotDeg) % 360 + 360) % 360;
  return raw > 180 ? 360 - raw : raw;
}

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

  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [phase, setPhase] = useState<ScanPhase>('SWEEPING');
  const [vectorDots, setVectorDots] = useState<RadarDot[]>([]);
  const bossPreviewOpenedRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const dotOpacityMapRef = useRef<Record<string, Animated.Value>>({});
  const dotPulseMapRef = useRef<Record<string, Animated.CompositeAnimation | null>>({});
  const pingedThisRotationRef = useRef<Record<string, boolean>>({});
  const lastSweepValueRef = useRef(0);
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

  const ensureDotOpacity = (dotId: string): Animated.Value => {
    if (!dotOpacityMapRef.current[dotId]) {
      dotOpacityMapRef.current[dotId] = new Animated.Value(isBossDepth ? 1 : 0);
    }
    return dotOpacityMapRef.current[dotId];
  };

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
    dots.forEach((dot) => ensureDotOpacity(dot.id).setValue(isBossDepth ? 1 : 0));
    pingedThisRotationRef.current = {};
    lastSweepValueRef.current = 0;
    setVectorDots(dots);

    if (isBossDepth) {
      setPhase('DOTS');
    } else {
      setPhase('SWEEPING');
    }
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, runState.currentSector, isBossDepth]);

  useEffect(() => {
    if (!isScanningHub || vectorDots.length === 0 || isBossDepth) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();

    sweepAnim.setValue(0);
    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: SCAN_SWEEP_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    sweepLoop.start();

    const pingDot = (dotId: string) => {
      if (pingedThisRotationRef.current[dotId]) return;
      pingedThisRotationRef.current[dotId] = true;
      dotPulseMapRef.current[dotId]?.stop();
      const opacity = ensureDotOpacity(dotId);
      opacity.setValue(1);
      const pulse = Animated.timing(opacity, {
        toValue: 0,
        duration: PING_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      dotPulseMapRef.current[dotId] = pulse;
      pulse.start();
    };

    const sweepListener = sweepAnim.addListener(({ value }) => {
      if (value < lastSweepValueRef.current) {
        pingedThisRotationRef.current = {};
      }
      lastSweepValueRef.current = value;
      const sweepDeg = (value * 360) % 360;
      vectorDots.forEach((dot) => {
        if (sweepDeltaDeg(sweepDeg, dot.angleDeg) <= SWEEP_DETECT_ARC_DEG) pingDot(dot.id);
      });
    });

    const finishTimer = setTimeout(() => {
      sweepLoop.stop();
      sweepAnim.stopAnimation();
      sweepAnim.removeListener(sweepListener);
      vectorDots.forEach((dot) => {
        dotPulseMapRef.current[dot.id]?.stop();
        Animated.timing(ensureDotOpacity(dot.id), {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
      setPhase('DOTS');
    }, SCAN_DURATION_MS);

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
      sweepAnim.removeListener(sweepListener);
      clearTimeout(finishTimer);
      vectorDots.forEach((dot) => dotPulseMapRef.current[dot.id]?.stop());
    };
  }, [isScanningHub, vectorDots, pulseAnim, sweepAnim, isBossDepth]);

  useEffect(() => {
    if (!isScanningHub || !isBossDepth || vectorDots.length === 0) return;
    if (bossPreviewOpenedRef.current) return;
    bossPreviewOpenedRef.current = true;
    const bossDot = vectorDots.find((dot) => dot.isPreDiscovered) ?? vectorDots[0];
    if (bossDot) openScanPreview(bossDot.id);
  }, [isScanningHub, isBossDepth, vectorDots, openScanPreview]);

  const sweepRotation = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleNodeTap = (nodeId: string) => {
    if (phase !== 'DOTS') return;
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

  const renderVectorDots = () =>
    vectorDots.map((dot) => {
      const hitboxStyle = {
        left: dot.x - DOT_HIT_SIZE / 2,
        top: dot.y - DOT_HIT_SIZE / 2,
      };
      const opacity = ensureDotOpacity(dot.id);
      const dotSize = dot.isPreDiscovered ? BOSS_DOT_SIZE : DOT_VISUAL_SIZE;

      if (phase === 'SWEEPING') {
        return (
          <View key={dot.id} style={[styles.dotHitbox, hitboxStyle]} pointerEvents="none">
            <Animated.View
              style={[
                styles.vectorDot,
                dot.isPreDiscovered ? styles.bossDot : null,
                { width: dotSize, height: dotSize, borderRadius: dotSize / 2, opacity },
              ]}
            />
          </View>
        );
      }

      return (
        <Pressable
          key={dot.id}
          onPress={() => handleNodeTap(dot.id)}
          hitSlop={12}
          style={[styles.dotHitbox, hitboxStyle]}
        >
          <View
            style={[
              styles.vectorDot,
              dot.isPreDiscovered ? styles.bossDot : null,
              { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
            ]}
          />
        </Pressable>
      );
    });

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
            <View style={[styles.radarViewport, { width: RADAR_SIZE, height: RADAR_SIZE }]}>
              <Animated.View
                style={[
                  styles.radarRingOuter,
                  { borderColor: theme.primaryColor, opacity: pulseAnim, width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: RADAR_SIZE / 2 },
                ]}
              />
              <Animated.View
                style={[
                  styles.radarRingMid,
                  {
                    borderColor: accent,
                    opacity: pulseAnim,
                    width: RADAR_SIZE * 0.72,
                    height: RADAR_SIZE * 0.72,
                    borderRadius: (RADAR_SIZE * 0.72) / 2,
                  },
                ]}
              />
              <View
                style={[
                  styles.radarCore,
                  {
                    borderColor: theme.borderColor,
                    width: RADAR_CORE,
                    height: RADAR_CORE,
                    borderRadius: RADAR_CORE / 2,
                    top: (RADAR_SIZE - RADAR_CORE) / 2,
                    left: (RADAR_SIZE - RADAR_CORE) / 2,
                  },
                ]}
              >
                {phase === 'SWEEPING' && !isBossDepth && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.sweepPivot,
                      { width: RADAR_CORE, height: RADAR_CORE, transform: [{ rotate: sweepRotation }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.radarSweepArm,
                        {
                          width: RADAR_CORE / 2,
                          top: RADAR_CORE / 2 - 1,
                          left: RADAR_CORE / 2,
                          backgroundColor: `${accent}66`,
                        },
                      ]}
                    />
                  </Animated.View>
                )}
                {renderVectorDots()}
              </View>
            </View>
          </View>

          <View style={[styles.readoutDock, { borderColor: theme.borderColor }]}>
            <View style={styles.readoutInner}>
              {phase === 'SWEEPING' && !isBossDepth && (
                <View style={styles.readoutBlock}>
                  <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>LOCATING THREAT VECTORS...</Text>
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
  radarViewport: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  radarRingOuter: { position: 'absolute', top: 0, left: 0, borderWidth: 1, borderStyle: 'dashed' },
  radarRingMid: {
    position: 'absolute',
    top: (RADAR_SIZE - RADAR_SIZE * 0.72) / 2,
    left: (RADAR_SIZE - RADAR_SIZE * 0.72) / 2,
    borderWidth: 1,
  },
  radarCore: { position: 'absolute', borderWidth: 2, backgroundColor: '#050608', overflow: 'hidden' },
  sweepPivot: { position: 'absolute', top: 0, left: 0 },
  radarSweepArm: { position: 'absolute', height: 2 },
  dotHitbox: {
    position: 'absolute',
    width: DOT_HIT_SIZE,
    height: DOT_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vectorDot: {
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  bossDot: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
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
