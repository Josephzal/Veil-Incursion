import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { generateTierNodeScanVectors } from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { getFactionDefinition } from '../data/factions';
import { RadarDot } from '../types/run';

const { width } = Dimensions.get('window');
const SCAN_SWEEP_MS = 2200;
const SCAN_ROTATIONS = 3;
const SCAN_DURATION_MS = SCAN_SWEEP_MS * SCAN_ROTATIONS;
const SWEEP_DETECT_ARC_DEG = 14;
const PING_FADE_MS = 260;
const DOT_HIT_SIZE = 44;
const DOT_VISUAL_SIZE = 12;
const TERMINAL_ACCENT = '#00ff33';
const RADAR_SIZE = Math.min(width - 80, 280);
const RADAR_CORE = RADAR_SIZE * 0.48;
const RADAR_DOCK_HEIGHT = RADAR_SIZE + 32;
const READOUT_DOCK_HEIGHT = 220;

type ScanPhase = 'SWEEPING' | 'DOTS';

function sweepDeltaDeg(sweepDeg: number, dotDeg: number): number {
  const raw = ((sweepDeg - dotDeg) % 360 + 360) % 360;
  return raw > 180 ? 360 - raw : raw;
}

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, scanSessionKey, activeIncursion } = useRun();
  const { account } = usePlayerAccount();
  const { deploySelectedVector, isScanningHub } = useDescentNavigator();

  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [phase, setPhase] = useState<ScanPhase>('SWEEPING');
  const [vectorDots, setVectorDots] = useState<RadarDot[]>([]);

  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const dotOpacityMapRef = useRef<Record<string, Animated.Value>>({});
  const dotPulseMapRef = useRef<Record<string, Animated.CompositeAnimation | null>>({});
  const pingedThisRotationRef = useRef<Record<string, boolean>>({});
  const lastSweepValueRef = useRef(0);
  const lastRadarSessionRef = useRef<number | null>(null);
  const deployingRef = useRef(false);

  const nodeIndex = activeIncursion.currentNodeIndex;
  const vectorCluster = activeIncursion.activeTierVectors[nodeIndex] ?? [];

  const ensureDotOpacity = (dotId: string): Animated.Value => {
    if (!dotOpacityMapRef.current[dotId]) {
      dotOpacityMapRef.current[dotId] = new Animated.Value(0);
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

    setPhase('SWEEPING');
    deployingRef.current = false;

    const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
    const dots = generateTierNodeScanVectors(vectorCluster, RADAR_CORE, sector);
    dots.forEach((dot) => ensureDotOpacity(dot.id).setValue(0));
    pingedThisRotationRef.current = {};
    lastSweepValueRef.current = 0;
    setVectorDots(dots);
  }, [isScanningHub, scanSessionKey, vectorCluster, nodeIndex, runState.currentSector]);

  useEffect(() => {
    if (!isScanningHub || vectorDots.length === 0) return;

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
  }, [isScanningHub, vectorDots, pulseAnim, sweepAnim]);

  const sweepRotation = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleVectorSelect = (nodeId: string) => {
    if (phase !== 'DOTS' || deployingRef.current) return;
    deployingRef.current = true;
    deploySelectedVector(nodeId);
  };

  const renderVectorDots = () =>
    vectorDots.map((dot) => {
      const hitboxStyle = {
        left: dot.x - DOT_HIT_SIZE / 2,
        top: dot.y - DOT_HIT_SIZE / 2,
      };
      const opacity = ensureDotOpacity(dot.id);

      if (phase === 'SWEEPING') {
        return (
          <View key={dot.id} style={[styles.dotHitbox, hitboxStyle]} pointerEvents="none">
            <Animated.View style={[styles.vectorDot, { opacity }]} />
          </View>
        );
      }

      return (
        <Pressable
          key={dot.id}
          onPress={() => handleVectorSelect(dot.id)}
          hitSlop={12}
          style={[styles.dotHitbox, hitboxStyle]}
        >
          <View style={styles.vectorDot} />
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
              {`TIER ${activeIncursion.currentTier} // DEPTH ${nodeIndex + 1}/7 // TACTICAL SWEEP HUB`}
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
              {phase === 'SWEEPING' && (
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
            {phase === 'SWEEPING' && (
              <View style={styles.readoutBlock}>
                <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>LOCATING THREAT VECTORS...</Text>
                <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
                  {`Tactical sweep mapping ${vectorCluster.length} candidate vector${vectorCluster.length === 1 ? '' : 's'} at depth ${nodeIndex + 1}`}
                </Text>
              </View>
            )}
            {phase === 'DOTS' && vectorDots.length > 0 && (
              <View style={[styles.vectorLogPanel, { borderColor: accent }]}>
                <Text style={[styles.vectorLogHeader, { color: theme.mutedColor }]}>
                  {`VECTOR CLOUD LOCKED — ${vectorDots.length} SELECTABLE ROUTE${vectorDots.length === 1 ? '' : 'S'}`}
                </Text>
                <ScrollView style={styles.vectorLogScroll} contentContainerStyle={styles.vectorLogContent}>
                  {vectorDots.map((dot, i) => (
                    <Pressable
                      key={dot.id}
                      onPress={() => handleVectorSelect(dot.id)}
                      style={({ pressed }) => [
                        styles.vectorLogEntry,
                        { borderColor: theme.borderColor, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={[styles.vectorLogIndex, { color: accent }]}>
                        {`[${String(i + 1).padStart(2, '0')}]`}
                      </Text>
                      <View style={styles.vectorLogBody}>
                        <Text style={[styles.vectorLogTag, { color: accent }]}>{dot.pingLabel}</Text>
                        <Text style={[styles.vectorLogLabel, { color: theme.primaryColor }]}>{dot.label}</Text>
                      </View>
                      <Text style={[styles.vectorLogAction, { color: theme.mutedColor }]}>{'>'}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.vectorLogHint, { color: theme.mutedColor }]}>
                  Tap a radar blip or log entry to commit vector and deploy encounter layer.
                </Text>
              </View>
            )}
            </View>
          </View>

          <View style={[styles.footerTelemetry, { borderColor: theme.borderColor }]}>
            <Text style={[styles.telemetryLine, { color: theme.mutedColor }]}>
              {`TIER ${activeIncursion.currentTier} // SCAN ${nodeIndex + 1}/7 // VECTORS: ${vectorCluster.length} // RADAR_GAIN: 98%`}
            </Text>
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
    width: DOT_VISUAL_SIZE,
    height: DOT_VISUAL_SIZE,
    borderRadius: DOT_VISUAL_SIZE / 2,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  readoutDock: {
    flex: 1,
    minHeight: 120,
    maxHeight: READOUT_DOCK_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    backgroundColor: '#050608',
    overflow: 'hidden',
  },
  readoutInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  readoutBlock: { justifyContent: 'center' },
  scanStatus: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.1, textAlign: 'center' },
  scanSubStatus: { fontFamily: 'monospace', fontSize: 9, marginTop: 6, textAlign: 'center', lineHeight: 13 },
  vectorLogPanel: { flex: 1, borderWidth: 1, padding: 8, backgroundColor: '#0e1624' },
  vectorLogHeader: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1.4, marginBottom: 6 },
  vectorLogScroll: { flex: 1 },
  vectorLogContent: { gap: 4 },
  vectorLogEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#0a0b0f',
  },
  vectorLogIndex: { fontFamily: 'monospace', fontSize: 9, width: 28 },
  vectorLogBody: { flex: 1 },
  vectorLogTag: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', lineHeight: 13 },
  vectorLogLabel: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12, marginTop: 2, flexShrink: 1, flexWrap: 'wrap' },
  vectorLogAction: { fontFamily: 'monospace', fontSize: 12, paddingLeft: 6 },
  vectorLogHint: { fontFamily: 'monospace', fontSize: 7, lineHeight: 11, marginTop: 6 },
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
