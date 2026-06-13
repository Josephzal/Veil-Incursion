import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TensionMechanicProps } from './tensionMechanicTypes';

const PANEL_BG = '#141418';
const ACCENT_MUTED = '#9ca3af';
const DANGER_MUTED = '#7f1d1d';
const GAUGE_TRACK = '#1f2937';
const GAUGE_SAFE = '#374151';
const GAUGE_WARN = '#57534e';
const GAUGE_CRITICAL = '#7f1d1d';

function randomInstabilityGain(): number {
  return 15 + Math.floor(Math.random() * 21);
}

function gaugeColor(percent: number): string {
  if (percent >= 75) return GAUGE_CRITICAL;
  if (percent >= 50) return GAUGE_WARN;
  return GAUGE_SAFE;
}

export default function ScavengeBar({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const [instability, setInstability] = useState(0);
  const [salvageStacks, setSalvageStacks] = useState(0);
  const [lastGain, setLastGain] = useState<number | null>(null);
  const resolvedRef = useRef(false);

  const resolveSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onSuccess();
  }, [onSuccess]);

  const resolveFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onFailure();
  }, [onFailure]);

  const handleRansack = () => {
    if (resolvedRef.current) return;

    const gain = randomInstabilityGain();
    setLastGain(gain);
    setSalvageStacks((prev) => prev + 1);

    const nextInstability = instability + gain;
    if (nextInstability >= 100) {
      setInstability(100);
      resolveFailure();
      return;
    }

    setInstability(nextInstability);
  };

  const handleSecure = () => {
    if (resolvedRef.current) return;
    resolveSuccess();
  };

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `COLLAPSE COST: -${defaultPenalty.amount} HP`
      : `COLLAPSE COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  return (
    <View style={styles.root}>
      <Text style={styles.header}>SCAVENGE BAR // INSTABILITY PROTOCOL</Text>
      <View style={styles.panel}>
        <Text style={styles.instructions}>
          Push your luck — each ransack raises instability and salvage yield. Bail out before the gauge maxes.
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
          {lastGain != null ? (
            <Text style={styles.lastGain}>Last ransack: +{lastGain}% instability</Text>
          ) : null}
        </View>

        <View style={styles.rewardBlock}>
          <Text style={styles.rewardLabel}>SALVAGE STACKS</Text>
          <Text style={styles.rewardValue}>{salvageStacks}</Text>
          <Text style={styles.rewardHint}>
            {salvageStacks === 0
              ? 'No salvage secured yet — ransack to build yield.'
              : `${salvageStacks} extraction pass${salvageStacks === 1 ? '' : 'es'} banked.`}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleRansack}
            disabled={resolvedRef.current}
            style={({ pressed }) => [
              styles.ransackBtn,
              { opacity: resolvedRef.current ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.ransackBtnText}>[ RANSACK ]</Text>
          </Pressable>
          <Pressable
            onPress={handleSecure}
            disabled={resolvedRef.current}
            style={({ pressed }) => [
              styles.secureBtn,
              { opacity: resolvedRef.current ? 0.4 : pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.secureBtnText}>[ SECURE & LEAVE ]</Text>
          </Pressable>
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
  secureBtn: {
    borderWidth: 1,
    borderColor: '#065f46',
    backgroundColor: 'rgba(6, 95, 70, 0.12)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secureBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#6ee7b7',
  },
  penalty: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
    color: DANGER_MUTED,
    textAlign: 'center',
  },
});
