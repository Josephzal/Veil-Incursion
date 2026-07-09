import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RadarDot } from '../../types/run';

interface KeepsakeStampedExtractionHintProps {
  nodeId: string;
  radarDots: readonly RadarDot[];
}

/** Extraction Token — verified evac vector stamped on scanner. */
export default function KeepsakeStampedExtractionHint({
  nodeId,
  radarDots,
}: KeepsakeStampedExtractionHintProps): React.JSX.Element | null {
  const dot = radarDots.find((entry) => entry.id === nodeId);
  if (!dot) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.host,
        {
          left: dot.x - 40,
          top: dot.y - 44,
        },
      ]}
    >
      <Text style={styles.label}>STAMPED EVAC</Text>
      <View style={styles.chip}>
        <Text style={styles.chipText}>EXT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
    zIndex: 7,
    opacity: 0.92,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 5,
    letterSpacing: 0.8,
    color: '#67e8f9',
    marginBottom: 3,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.55)',
    backgroundColor: 'rgba(8, 47, 73, 0.82)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    color: '#a5f3fc',
    letterSpacing: 0.4,
  },
});
