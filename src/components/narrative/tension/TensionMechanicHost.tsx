import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import ConcealSlider from './ConcealSlider';
import ScavengeBar from './ScavengeBar';
import GridCipher from './GridCipher';
import {
  formatTensionMechanicLabel,
  type TensionMechanicHostProps,
} from './tensionMechanicTypes';

const TERMINAL_ACCENT = '#00ff33';
const TENSION_MUTED = '#6b7280';
const TENSION_PANEL = '#141418';

function TensionMechanicFallback({
  mechanicLabel,
  penaltyPreview,
  onComplete,
  borderColor = '#334155',
  mutedColor = '#94a3b8',
  primaryColor = '#f8fafc',
}: {
  mechanicLabel: string;
  penaltyPreview?: string;
  onComplete: () => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
}): React.JSX.Element {
  return (
    <View style={styles.fallbackCol}>
      <Text style={[styles.fallbackHeader, { color: mutedColor }]}>
        TENSION PROTOCOL // STAGING
      </Text>
      <View style={[styles.fallbackPanel, { borderColor }]}>
        <Text style={[styles.fallbackTitle, { color: primaryColor }]}>
          {mechanicLabel}
        </Text>
        <View style={styles.fallbackGaugeTrack}>
          <View style={styles.fallbackGaugeFill} />
        </View>
        <Text style={[styles.fallbackBody, { color: TENSION_MUTED }]}>
          Unknown or unsupported tension mechanic — auto-resolving as success.
        </Text>
        {penaltyPreview ? (
          <Text style={[styles.fallbackPenalty, { color: '#9ca3af' }]}>
            {penaltyPreview}
          </Text>
        ) : null}
      </View>
      <HapticPressable
        onPress={onComplete}
        style={({ pressed }) => [
          styles.fallbackCompleteBtn,
          {
            borderColor: TERMINAL_ACCENT,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text style={[styles.fallbackCompleteBtnText, { color: TERMINAL_ACCENT }]}>
          [ COMPLETE PROTOCOL — AUTO SUCCESS ]
        </Text>
      </HapticPressable>
    </View>
  );
}

export default function TensionMechanicHost({
  tensionMechanic,
  onSuccess,
  onFailure,
  defaultPenalty,
  fallbackLabel,
  penaltyPreview,
  borderColor,
  mutedColor,
  primaryColor,
}: TensionMechanicHostProps): React.JSX.Element {
  const mechanicProps = { onSuccess, onFailure, defaultPenalty };

  switch (tensionMechanic) {
    case 'Mechanic_SigilTrace':
      return (
        <View style={styles.mechanicHost}>
          <GridCipher {...mechanicProps} />
        </View>
      );
    case 'Mechanic_ScavengeBar':
      return (
        <View style={styles.mechanicHost}>
          <ScavengeBar {...mechanicProps} />
        </View>
      );
    case 'Mechanic_ConcealSlider':
      return (
        <View style={styles.mechanicHost}>
          <ConcealSlider {...mechanicProps} />
        </View>
      );
    default:
      return (
        <View style={styles.mechanicHost}>
          <TensionMechanicFallback
          mechanicLabel={fallbackLabel ?? formatTensionMechanicLabel(tensionMechanic)}
          penaltyPreview={penaltyPreview}
          onComplete={onSuccess}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
        />
        </View>
      );
  }
}

const styles = StyleSheet.create({
  mechanicHost: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
  },
  fallbackCol: {
    gap: 8,
  },
  fallbackHeader: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
  },
  fallbackPanel: {
    borderWidth: 1,
    backgroundColor: TENSION_PANEL,
    padding: 14,
    gap: 10,
  },
  fallbackTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  fallbackGaugeTrack: {
    height: 6,
    backgroundColor: '#1f2937',
    borderRadius: 1,
    overflow: 'hidden',
  },
  fallbackGaugeFill: {
    width: '38%',
    height: '100%',
    backgroundColor: '#374151',
  },
  fallbackBody: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
  },
  fallbackPenalty: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  fallbackCompleteBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  fallbackCompleteBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
