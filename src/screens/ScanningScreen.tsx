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
import { generateRadarScanDots } from '../data/regions';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
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

type ScanPhase = 'SWEEPING' | 'DOTS' | 'SECTOR_CARD';

function sweepDeltaDeg(sweepDeg: number, dotDeg: number): number {
  const raw = ((sweepDeg - dotDeg) % 360 + 360) % 360;
  return raw > 180 ? 360 - raw : raw;
}

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { deployEncounter } = useGameFlow();
  const { runState, scanSessionKey, appendRunLog, commitRadarDot } = useRun();

  const [phase, setPhase] = useState<ScanPhase>('SWEEPING');
  const [scanDots, setScanDots] = useState<RadarDot[]>([]);
  const [displayDots, setDisplayDots] = useState<RadarDot[]>([]);
  const [selectedDot, setSelectedDot] = useState<RadarDot | null>(null);

  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const dotOpacityRefs = useRef<Animated.Value[]>([]);
  const dotPulseRefs = useRef<Animated.CompositeAnimation[]>([]);
  const pingedThisRotationRef = useRef<Set<string>>(new Set());
  const lastSweepValueRef = useRef(0);

  const isDiscoveryScan = runState.homeRegion === null;
  const upcomingNodeIndex = runState.currentNode;

  useEffect(() => {
    setPhase('SWEEPING');
    setSelectedDot(null);
    setDisplayDots([]);

    const freshDots = generateRadarScanDots(
      runState.homeRegion,
      upcomingNodeIndex,
      runState.combatNodesCleared,
      RADAR_CORE,
    );
    setScanDots(freshDots);
    dotOpacityRefs.current = freshDots.map(() => new Animated.Value(0));
    dotPulseRefs.current = [];
    pingedThisRotationRef.current.clear();
    lastSweepValueRef.current = 0;
  }, [scanSessionKey, runState.homeRegion, upcomingNodeIndex, runState.combatNodesCleared]);

  useEffect(() => {
    if (scanDots.length === 0) return;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    sweepAnim.setValue(0);
    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: SCAN_SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    sweepLoop.start();

    const pingDot = (index: number, dotId: string) => {
      if (pingedThisRotationRef.current.has(dotId)) return;
      pingedThisRotationRef.current.add(dotId);

      dotPulseRefs.current[index]?.stop();
      dotOpacityRefs.current[index]?.setValue(1);
      const pulse = Animated.timing(dotOpacityRefs.current[index], {
        toValue: 0,
        duration: PING_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      dotPulseRefs.current[index] = pulse;
      pulse.start();
    };

    const sweepListener = sweepAnim.addListener(({ value }) => {
      if (value < lastSweepValueRef.current) {
        pingedThisRotationRef.current.clear();
      }
      lastSweepValueRef.current = value;

      const sweepDeg = (value * 360) % 360;
      scanDots.forEach((dot, index) => {
        if (sweepDeltaDeg(sweepDeg, dot.angleDeg) <= SWEEP_DETECT_ARC_DEG) {
          pingDot(index, dot.id);
        }
      });
    });

    const finishTimer = setTimeout(() => {
      sweepLoop.stop();
      sweepAnim.stopAnimation();
      sweepAnim.removeListener(sweepListener);

      dotPulseRefs.current.forEach((p) => p?.stop());
      Animated.parallel(
        scanDots.map((_, index) =>
          Animated.timing(dotOpacityRefs.current[index], {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ),
      ).start(() => {
        setDisplayDots(scanDots);
        setPhase('DOTS');
      });
    }, SCAN_DURATION_MS);

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
      sweepAnim.removeListener(sweepListener);
      clearTimeout(finishTimer);
      dotPulseRefs.current.forEach((p) => p?.stop());
    };
  }, [scanDots, pulseAnim, sweepAnim]);

  const sweepRotation = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleDotPress = (dot: RadarDot) => {
    setSelectedDot(dot);
    setPhase('SECTOR_CARD');
  };

  const handleInitiateIncursion = () => {
    if (!selectedDot) return;
    commitRadarDot(selectedDot);
    appendRunLog(`>> Initiating incursion — Node ${runState.homeRegion === null ? 1 : runState.currentNode + 1}.`);
    deployEncounter(selectedDot.encounterType);
  };

  const handleBackToDots = () => {
    setPhase('DOTS');
    setSelectedDot(null);
  };

  const renderDot = (dot: RadarDot, index: number, interactive: boolean) => {
    const dimmed = interactive && selectedDot && selectedDot.id !== dot.id;
    const hitboxStyle = {
      left: dot.x - DOT_HIT_SIZE / 2,
      top: dot.y - DOT_HIT_SIZE / 2,
    };

    if (phase === 'SWEEPING') {
      const dotOpacity = dotOpacityRefs.current[index];
      if (!dotOpacity) return null;
      return (
        <View key={dot.id} style={[styles.dotHitbox, hitboxStyle]} pointerEvents="none">
          <Animated.View style={[styles.whiteDot, { opacity: dotOpacity }]} />
        </View>
      );
    }

    return (
      <Pressable
        key={dot.id}
        onPress={interactive ? () => handleDotPress(dot) : undefined}
        disabled={!interactive}
        hitSlop={8}
        style={[styles.dotHitbox, hitboxStyle]}
      >
        <View style={[styles.whiteDot, dimmed ? { opacity: 0.35 } : null]} />
      </Pressable>
    );
  };

  const activeDots = phase === 'SWEEPING' ? scanDots : displayDots;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.statusBar, { borderColor: theme.borderColor }]}>
        <Text style={[styles.statusBarText, { color: theme.mutedColor }]}>
          {isDiscoveryScan
            ? 'ANOMALY SCAN // SECTOR DISCOVERY'
            : `NODE ${Math.min(upcomingNodeIndex + 1, runState.totalNodes)}/${runState.totalNodes} // REGIONAL SWEEP`}
        </Text>
      </View>

      <View style={styles.radarStage}>
        <Animated.View
          style={[styles.radarRingOuter, { borderColor: theme.primaryColor, opacity: pulseAnim }]}
        />
        <Animated.View
          style={[styles.radarRingMid, { borderColor: TERMINAL_ACCENT, opacity: pulseAnim }]}
        />
        <View
          style={[
            styles.radarCore,
            { borderColor: theme.borderColor, width: RADAR_CORE, height: RADAR_CORE, borderRadius: RADAR_CORE / 2 },
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
                    backgroundColor: '#00ff3366',
                  },
                ]}
              />
            </Animated.View>
          )}

          {activeDots.map((dot, index) => renderDot(dot, index, phase !== 'SWEEPING'))}
        </View>
      </View>

      <View style={styles.readoutPanel}>
        {phase === 'SWEEPING' && (
          <>
            <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>LOCATING THREAT VECTORS...</Text>
            <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
              Radar sweep in progress // sonar ping mapping active
            </Text>
          </>
        )}
        {phase === 'DOTS' && (
          <>
            <Text style={[styles.scanStatus, { color: TERMINAL_ACCENT }]}>3 VECTORS DETECTED</Text>
            <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
              Select a white node to inspect encounter profile
            </Text>
          </>
        )}
        {phase === 'SECTOR_CARD' && selectedDot && (
          <View style={[styles.sectorCard, { borderColor: TERMINAL_ACCENT, backgroundColor: '#0e1624' }]}>
            <Text style={[styles.sectorCardLabel, { color: theme.mutedColor }]}>ENCOUNTER VECTOR LOCKED</Text>
            <Text style={styles.sectorCardTitle}>{selectedDot.pingLabel}</Text>
            <Text style={[styles.sectorCardSub, { color: TERMINAL_ACCENT }]}>{selectedDot.sector.subsector}</Text>
            <Text style={[styles.sectorCardBody, { color: theme.mutedColor }]}>{selectedDot.sector.description}</Text>
            <Pressable
              onPress={handleInitiateIncursion}
              style={({ pressed }) => [
                styles.incursionButton,
                { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#0d1a12' : '#0a0b0f' },
              ]}
            >
              <Text style={styles.incursionButtonText}>INITIATE INCURSION</Text>
            </Pressable>
            <Pressable onPress={handleBackToDots}>
              <Text style={[styles.backLink, { color: theme.mutedColor }]}>{'<< RE-SCAN NODES'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={[styles.footerTelemetry, { borderColor: theme.borderColor }]}>
        <Text style={[styles.telemetryLine, { color: theme.mutedColor }]}>
          {runState.runActive
            ? `NODE ${Math.min(upcomingNodeIndex + 1, runState.totalNodes)}/${runState.totalNodes} // RADAR_GAIN: 98%`
            : 'RADAR_GAIN: 98% // SWEEP_RATE: 2.2s'}
        </Text>
      </View>

      <PersistentTerminalLog visible={runState.runActive} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 24 : 8 },
  statusBar: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  statusBarText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  radarStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  radarRingOuter: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  radarRingMid: {
    position: 'absolute',
    width: RADAR_SIZE * 0.72,
    height: RADAR_SIZE * 0.72,
    borderRadius: (RADAR_SIZE * 0.72) / 2,
    borderWidth: 1,
  },
  radarCore: {
    borderWidth: 2,
    backgroundColor: '#050608',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepPivot: { position: 'absolute', top: 0, left: 0 },
  radarSweepArm: { position: 'absolute', height: 2 },
  dotHitbox: {
    position: 'absolute',
    width: DOT_HIT_SIZE,
    height: DOT_HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteDot: {
    width: DOT_VISUAL_SIZE,
    height: DOT_VISUAL_SIZE,
    borderRadius: DOT_VISUAL_SIZE / 2,
    backgroundColor: '#ffffff',
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  readoutPanel: { paddingHorizontal: 20, paddingBottom: 16, minHeight: 140, justifyContent: 'center' },
  scanStatus: { fontFamily: 'monospace', fontSize: 12, letterSpacing: 1.2, textAlign: 'center' },
  scanSubStatus: { fontFamily: 'monospace', fontSize: 10, marginTop: 8, textAlign: 'center', lineHeight: 14 },
  sectorCard: { borderWidth: 2, padding: 16 },
  sectorCardLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1.4, marginBottom: 8 },
  sectorCardTitle: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: '#ffffff', marginBottom: 6, lineHeight: 16 },
  sectorCardSub: { fontFamily: 'monospace', fontSize: 11, marginBottom: 10 },
  sectorCardBody: { fontFamily: 'monospace', fontSize: 10, lineHeight: 15, marginBottom: 16 },
  incursionButton: { borderWidth: 2, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  incursionButtonText: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: TERMINAL_ACCENT, letterSpacing: 1.2 },
  backLink: { fontFamily: 'monospace', fontSize: 9, textAlign: 'center', letterSpacing: 1 },
  footerTelemetry: { borderTopWidth: 1, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 8 },
  telemetryLine: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.8, textAlign: 'center' },
});
