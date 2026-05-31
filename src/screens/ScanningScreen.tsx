import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { generateTierNodeScanVector } from '../data/descentEngine';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import IncursionShell from '../components/IncursionShell';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
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
const READOUT_DOCK_HEIGHT = 196;

type ScanPhase = 'SWEEPING' | 'DOTS';

function sweepDeltaDeg(sweepDeg: number, dotDeg: number): number {
  const raw = ((sweepDeg - dotDeg) % 360 + 360) % 360;
  return raw > 180 ? 360 - raw : raw;
}

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, scanSessionKey, activeIncursion } = useRun();
  const { account } = usePlayerAccount();
  const { deploySelectedVector, isScanningHub, getCurrentTierNode } = useDescentNavigator();

  const accent =
    account.alignedFaction != null
      ? getFactionDefinition(account.alignedFaction).accentColor
      : TERMINAL_ACCENT;

  const [phase, setPhase] = useState<ScanPhase>('SWEEPING');
  const [vectorDot, setVectorDot] = useState<RadarDot | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const dotOpacityAnim = useRef(new Animated.Value(0)).current;
  const dotPulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const pingedThisRotationRef = useRef(false);
  const lastSweepValueRef = useRef(0);
  const lastRadarSessionRef = useRef<number | null>(null);
  const deployingRef = useRef(false);

  const tierNode = getCurrentTierNode();
  const nodeIndex = activeIncursion.currentNodeIndex;

  useEffect(() => {
    if (!isScanningHub || !tierNode) {
      lastRadarSessionRef.current = null;
      return;
    }
    if (lastRadarSessionRef.current === scanSessionKey) return;
    lastRadarSessionRef.current = scanSessionKey;

    setPhase('SWEEPING');
    deployingRef.current = false;

    const sector = runState.currentSector ?? INITIAL_SECTOR_POOL[0];
    const dot = generateTierNodeScanVector(tierNode, RADAR_CORE, sector);
    setVectorDot(dot);
    dotOpacityAnim.setValue(0);
    pingedThisRotationRef.current = false;
    lastSweepValueRef.current = 0;
  }, [isScanningHub, scanSessionKey, tierNode, nodeIndex, runState.currentSector]);

  useEffect(() => {
    if (!isScanningHub || !vectorDot) return;

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

    const pingDot = () => {
      if (pingedThisRotationRef.current) return;
      pingedThisRotationRef.current = true;
      dotPulseRef.current?.stop();
      dotOpacityAnim.setValue(1);
      const pulse = Animated.timing(dotOpacityAnim, {
        toValue: 0,
        duration: PING_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      dotPulseRef.current = pulse;
      pulse.start();
    };

    const sweepListener = sweepAnim.addListener(({ value }) => {
      if (value < lastSweepValueRef.current) pingedThisRotationRef.current = false;
      lastSweepValueRef.current = value;
      const sweepDeg = (value * 360) % 360;
      if (sweepDeltaDeg(sweepDeg, vectorDot.angleDeg) <= SWEEP_DETECT_ARC_DEG) pingDot();
    });

    const finishTimer = setTimeout(() => {
      sweepLoop.stop();
      sweepAnim.stopAnimation();
      sweepAnim.removeListener(sweepListener);
      dotPulseRef.current?.stop();
      Animated.timing(dotOpacityAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setPhase('DOTS'));
    }, SCAN_DURATION_MS);

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
      sweepAnim.removeListener(sweepListener);
      clearTimeout(finishTimer);
      dotPulseRef.current?.stop();
    };
  }, [isScanningHub, vectorDot, pulseAnim, sweepAnim]);

  const sweepRotation = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleVectorSelect = () => {
    if (phase !== 'DOTS' || deployingRef.current || !tierNode) return;
    deployingRef.current = true;
    deploySelectedVector();
  };

  const renderVectorDot = () => {
    if (!vectorDot) return null;
    const hitboxStyle = {
      left: vectorDot.x - DOT_HIT_SIZE / 2,
      top: vectorDot.y - DOT_HIT_SIZE / 2,
    };

    if (phase === 'SWEEPING') {
      return (
        <View style={[styles.dotHitbox, hitboxStyle]} pointerEvents="none">
          <Animated.View style={[styles.vectorDot, { opacity: dotOpacityAnim }]} />
        </View>
      );
    }

    return (
      <Pressable onPress={handleVectorSelect} hitSlop={12} style={[styles.dotHitbox, hitboxStyle]}>
        <View style={styles.vectorDot} />
      </Pressable>
    );
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
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
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
              {renderVectorDot()}
            </View>
          </View>
        </View>

        <View style={[styles.readoutDock, { height: READOUT_DOCK_HEIGHT, borderColor: theme.borderColor }]}>
          <View style={styles.readoutInner}>
            {phase === 'SWEEPING' && (
              <View style={styles.readoutBlock}>
                <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>LOCATING THREAT VECTORS...</Text>
                <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
                  Tactical sweep mapping tier depth {nodeIndex + 1}
                </Text>
              </View>
            )}
            {phase === 'DOTS' && tierNode && vectorDot && (
              <View style={[styles.vectorCard, { borderColor: accent }]}>
                <Text style={[styles.vectorCardLabel, { color: theme.mutedColor }]}>NEXT-STEP VECTOR LOCKED</Text>
                <Text style={[styles.vectorCardTitle, { color: accent }]}>{vectorDot.pingLabel}</Text>
                <Text style={[styles.vectorCardSub, { color: theme.primaryColor }]}>{tierNode.label}</Text>
                <Text style={[styles.vectorCardHint, { color: theme.mutedColor }]}>
                  Tap the white blip on radar to commit vector and deploy encounter layer.
                </Text>
                <Pressable
                  onPress={handleVectorSelect}
                  style={({ pressed }) => [
                    styles.commitBtn,
                    { borderColor: accent, opacity: pressed ? 0.75 : 1, backgroundColor: pressed ? '#0d1a12' : '#0a0b0f' },
                  ]}
                >
                  <Text style={[styles.commitBtnText, { color: accent }]}>[ COMMIT VECTOR ]</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.footerTelemetry, { borderColor: theme.borderColor }]}>
          <Text style={[styles.telemetryLine, { color: theme.mutedColor }]}>
            {`TIER ${activeIncursion.currentTier} // NODE ${nodeIndex + 1}/7 // RADAR_GAIN: 98%`}
          </Text>
        </View>

        <PersistentTerminalLog visible={runState.runActive} />
      </View>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 24 : 8 },
  fallback: { fontFamily: 'monospace', fontSize: 10, textAlign: 'center', padding: 24 },
  statusBar: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  statusBarText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  radarDock: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
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
  readoutDock: { borderTopWidth: 1, borderBottomWidth: 1, backgroundColor: '#050608', overflow: 'hidden' },
  readoutInner: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center' },
  readoutBlock: { justifyContent: 'center' },
  scanStatus: { fontFamily: 'monospace', fontSize: 11, letterSpacing: 1.1, textAlign: 'center' },
  scanSubStatus: { fontFamily: 'monospace', fontSize: 9, marginTop: 6, textAlign: 'center', lineHeight: 13 },
  vectorCard: { borderWidth: 1, padding: 10, backgroundColor: '#0e1624', flex: 1, justifyContent: 'space-between' },
  vectorCardLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1.4, marginBottom: 4 },
  vectorCardTitle: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', marginBottom: 4, lineHeight: 14 },
  vectorCardSub: { fontFamily: 'monospace', fontSize: 9, marginBottom: 6, lineHeight: 13 },
  vectorCardHint: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12, marginBottom: 8 },
  commitBtn: { borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  commitBtnText: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  footerTelemetry: { borderTopWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  telemetryLine: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.8, textAlign: 'center' },
});
