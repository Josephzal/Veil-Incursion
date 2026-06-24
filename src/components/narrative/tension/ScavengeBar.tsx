import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps, TensionMechanicSuccessResult } from './tensionMechanicTypes';

const PANEL_BG = '#141418';
const ACCENT_MUTED = '#9ca3af';
const DANGER_MUTED = '#7f1d1d';
const EXTRACT_READY = '#6ee7b7';
const EXTRACT_LOCKED = '#374151';
const GAUGE_TRACK = '#1f2937';
const GAUGE_SAFE = '#374151';
const GAUGE_WARN = '#57534e';
const GAUGE_CRITICAL = '#7f1d1d';

const BASE_LOOT_CREDITS = 10;
/** Must reach medium-yield band before extraction unlocks. */
const EXTRACT_MIN_INSTABILITY = 41;
const FIRST_RANSACK_MIN = 25;
const FIRST_RANSACK_MAX = 35;

function randomStandardInstabilityGain(): number {
  return 15 + Math.floor(Math.random() * 21);
}

function randomFirstRansackGain(): number {
  return FIRST_RANSACK_MIN + Math.floor(Math.random() * (FIRST_RANSACK_MAX - FIRST_RANSACK_MIN + 1));
}

function rewardMultiplierForInstability(instability: number): number {
  if (instability <= 40) return 1;
  if (instability <= 75) return 2;
  return 4;
}

function gaugeColor(percent: number): string {
  if (percent >= 75) return GAUGE_CRITICAL;
  if (percent >= 50) return GAUGE_WARN;
  return GAUGE_SAFE;
}

function tierLabel(instability: number): string {
  if (instability <= 40) return 'MINOR YIELD x1';
  if (instability <= 75) return 'MEDIUM YIELD x2';
  return 'MASSIVE YIELD x4';
}

export default function ScavengeBar({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const [instability, setInstability] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [ransackCount, setRansackCount] = useState(0);
  const [lastGain, setLastGain] = useState<number | null>(null);
  const [lastCreditGain, setLastCreditGain] = useState<number | null>(null);
  const [resolvedRefState, setResolvedRefState] = useState(false);
  const resolvedRef = useRef(false);
  const unlockPulse = useRef(new Animated.Value(0)).current;
  const unlockFlash = useRef(new Animated.Value(0)).current;
  const prevCanExtractRef = useRef(false);

  const canExtract = totalCredits > 0 && instability >= EXTRACT_MIN_INSTABILITY && !resolvedRef.current;

  const resolveSuccess = useCallback((payload: TensionMechanicSuccessResult) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolvedRefState(true);
    onSuccess(payload);
  }, [onSuccess]);

  const resolveFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolvedRefState(true);
    onFailure();
  }, [onFailure]);

  useEffect(() => {
    if (canExtract && !prevCanExtractRef.current) {
      unlockPulse.setValue(0);
      unlockFlash.setValue(1);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(unlockPulse, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(unlockPulse, {
            toValue: 0,
            duration: 480,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(unlockFlash, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
      ]).start();
    }
    prevCanExtractRef.current = canExtract;
  }, [canExtract, unlockFlash, unlockPulse]);

  const handleRansack = () => {
    if (resolvedRef.current) return;

    const gain = ransackCount === 0 ? randomFirstRansackGain() : randomStandardInstabilityGain();
    const multiplier = rewardMultiplierForInstability(instability);
    const creditGain = BASE_LOOT_CREDITS * multiplier;

    setLastGain(gain);
    setLastCreditGain(creditGain);
    setRansackCount((prev) => prev + 1);
    setTotalCredits((prev) => prev + creditGain);

    const nextInstability = instability + gain;
    if (nextInstability >= 100) {
      setInstability(100);
      resolveFailure();
      return;
    }

    setInstability(nextInstability);
  };

  const handleSecure = () => {
    if (resolvedRef.current || !canExtract) return;
    resolveSuccess({ bonusCredits: totalCredits });
  };

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `COLLAPSE COST: -${defaultPenalty.amount} HP`
      : `COLLAPSE COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  const secureScale = unlockPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });
  const secureGlowOpacity = unlockFlash.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  return (
    <View style={styles.root}>
      <Text style={styles.header}>SCAVENGE BAR // INSTABILITY PROTOCOL</Text>
      <View style={styles.panel}>
        <Text style={styles.instructions}>
          Push deeper for escalating credit yield. Extraction unlocks only after instability crosses the medium band ({EXTRACT_MIN_INSTABILITY}%+).
        </Text>

        <View style={styles.gaugeBlock}>
          <View style={styles.gaugeLabelRow}>
            <Text style={styles.gaugeLabel}>INSTABILITY GAUGE</Text>
            <Text style={[styles.gaugeValue, { color: gaugeColor(instability) }]}>
              {instability}%
            </Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View
              style={[
                styles.gaugeFill,
                {
                  width: `${instability}%`,
                  backgroundColor: gaugeColor(instability),
                },
              ]}
            />
          </View>
          <Text style={styles.tierReadout}>{tierLabel(instability)}</Text>
          {lastGain != null ? (
            <Text style={styles.lastGain}>
              {`Last ransack: +${lastGain}% instability${lastCreditGain != null ? ` // +${lastCreditGain} credits` : ''}`}
            </Text>
          ) : null}
        </View>

        <View style={styles.rewardBlock}>
          <Text style={styles.rewardLabel}>RUN CREDITS BANKED</Text>
          <Text style={styles.rewardValue}>{totalCredits}</Text>
          <Text style={styles.rewardHint}>
            {!canExtract
              ? totalCredits === 0
                ? 'Ransack to build yield — extraction locked until medium instability.'
                : `Extraction locked — push to ${EXTRACT_MIN_INSTABILITY}% instability (${instability}% now).`
              : 'Extraction channel open — secure before the gauge maxes.'}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <HapticPressable
            onPress={handleRansack}
            disabled={resolvedRefState}
            style={({ pressed }) => [
              styles.ransackBtn,
              { opacity: resolvedRefState ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.ransackBtnText}>[ RANSACK ]</Text>
          </HapticPressable>

          <Animated.View
            style={[
              styles.secureWrap,
              {
                transform: [{ scale: canExtract ? secureScale : 1 }],
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.secureGlow,
                { opacity: canExtract ? secureGlowOpacity : 0 },
              ]}
            />
            <HapticPressable
              onPress={handleSecure}
              disabled={!canExtract || resolvedRefState}
              style={({ pressed }) => [
                styles.secureBtn,
                {
                  borderColor: canExtract ? EXTRACT_READY : EXTRACT_LOCKED,
                  backgroundColor: canExtract
                    ? 'rgba(6, 95, 70, 0.22)'
                    : 'rgba(55, 65, 81, 0.2)',
                  opacity: !canExtract || resolvedRefState ? 0.45 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.secureBtnText,
                  { color: canExtract ? EXTRACT_READY : '#6b7280' },
                ]}
              >
                {canExtract ? '[ SECURE & LEAVE ]' : '[ EXTRACTION LOCKED ]'}
              </Text>
            </HapticPressable>
          </Animated.View>
        </View>

        {penaltyHint ? (
          <Text style={styles.penalty}>{penaltyHint}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    color: ACCENT_MUTED,
  },
  panel: {
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: PANEL_BG,
    padding: 14,
    gap: 14,
  },
  instructions: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
    color: ACCENT_MUTED,
    letterSpacing: 0.4,
  },
  gaugeBlock: {
    gap: 6,
  },
  gaugeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.8,
    color: ACCENT_MUTED,
  },
  gaugeValue: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  gaugeTrack: {
    height: 10,
    backgroundColor: GAUGE_TRACK,
    borderRadius: 1,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
  },
  tierReadout: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    color: '#9ca3af',
  },
  lastGain: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#6b7280',
    letterSpacing: 0.4,
  },
  rewardBlock: {
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 10,
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  rewardLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    color: ACCENT_MUTED,
  },
  rewardValue: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '700',
    color: '#d1d5db',
  },
  rewardHint: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 12,
    color: '#6b7280',
  },
  actionRow: {
    gap: 8,
  },
  ransackBtn: {
    borderWidth: 1,
    borderColor: '#57534e',
    backgroundColor: 'rgba(87, 83, 78, 0.15)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  ransackBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#d6d3d1',
  },
  secureWrap: {
    position: 'relative',
  },
  secureGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 1,
    backgroundColor: EXTRACT_READY,
    shadowColor: EXTRACT_READY,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  secureBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secureBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  penalty: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
    color: DANGER_MUTED,
    textAlign: 'center',
  },
});
