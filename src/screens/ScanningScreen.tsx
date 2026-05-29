import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';

const { width } = Dimensions.get('window');
const SCAN_DURATION_MS = 2000;
const INCURSION_FLASH_MS = 600;

export default function ScanningScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { startCombat } = useGameFlow();
  const [phase, setPhase] = useState<'SCANNING' | 'DETECTED'>('SCANNING');
  const pulseAnim = useRef(new Animated.Value(0.25)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const alertAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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

    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    pulseLoop.start();
    sweepLoop.start();

    const scanTimer = setTimeout(() => {
      setPhase('DETECTED');
      Animated.sequence([
        Animated.timing(alertAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(alertAnim, {
          toValue: 0.85,
          duration: 420,
          useNativeDriver: true,
        }),
      ]).start();
    }, SCAN_DURATION_MS);

    const combatTimer = setTimeout(() => {
      startCombat();
    }, SCAN_DURATION_MS + INCURSION_FLASH_MS);

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
      clearTimeout(scanTimer);
      clearTimeout(combatTimer);
    };
  }, [alertAnim, pulseAnim, startCombat, sweepAnim]);

  const sweepRotation = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.statusBar, { borderColor: theme.borderColor }]}>
        <Text style={[styles.statusBarText, { color: theme.mutedColor }]}>
          ANOMALY SCAN // THREAT-SEEKING OVERLAY ACTIVE
        </Text>
      </View>

      <View style={styles.radarStage}>
        <Animated.View
          style={[
            styles.radarRingOuter,
            { borderColor: theme.primaryColor, opacity: pulseAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.radarRingMid,
            { borderColor: '#22d3ee', opacity: pulseAnim },
          ]}
        />
        <View style={[styles.radarCore, { borderColor: theme.borderColor }]}>
          <Animated.View
            style={[
              styles.radarSweepArm,
              { backgroundColor: '#22d3ee55', transform: [{ rotate: sweepRotation }] },
            ]}
          />
          <View style={[styles.radarBlip, { backgroundColor: '#ef4444' }]} />
        </View>
      </View>

      <View style={styles.readoutPanel}>
        {phase === 'SCANNING' ? (
          <>
            <Text style={[styles.scanStatus, { color: theme.primaryColor }]}>
              LOCATING ECTOPLASMIC COORD FIELDS...
            </Text>
            <Text style={[styles.scanSubStatus, { color: theme.mutedColor }]}>
              Sweeping urban ley-lines // sector harmonics in progress
            </Text>
          </>
        ) : (
          <Animated.View style={{ opacity: alertAnim, transform: [{ scale: alertAnim }] }}>
            <Text style={styles.incursionAlert}>INCURSION DETECTED</Text>
            <Text style={[styles.incursionSub, { color: theme.mutedColor }]}>
              Apparition vector locked // deploying combat interface
            </Text>
          </Animated.View>
        )}
      </View>

      <View style={[styles.footerTelemetry, { borderColor: theme.borderColor }]}>
        <Text style={[styles.telemetryLine, { color: theme.mutedColor }]}>
          RADAR_GAIN: 98% // NOISE_FLOOR: -42dB // SWEEP_RATE: 2.2s
        </Text>
      </View>
    </View>
  );
}

const RADAR_SIZE = Math.min(width - 80, 280);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
  },
  statusBar: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statusBarText: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  radarStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    width: RADAR_SIZE * 0.48,
    height: RADAR_SIZE * 0.48,
    borderRadius: (RADAR_SIZE * 0.48) / 2,
    borderWidth: 2,
    backgroundColor: '#050608',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarSweepArm: {
    position: 'absolute',
    width: '50%',
    height: 2,
    left: '50%',
    top: '50%',
    transformOrigin: 'left center',
  },
  radarBlip: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    top: '28%',
    right: '24%',
    shadowColor: '#ef4444',
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  readoutPanel: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanStatus: {
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  scanSubStatus: {
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 14,
  },
  incursionAlert: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#ef4444',
    textAlign: 'center',
    textShadowColor: '#ef4444',
    textShadowRadius: 12,
  },
  incursionSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
  footerTelemetry: {
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  telemetryLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
});
