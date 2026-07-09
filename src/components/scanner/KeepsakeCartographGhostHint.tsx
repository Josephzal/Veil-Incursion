import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RadarDot } from '../../types/run';
import type { ProceduralNodeType } from '../../types/proceduralRunTree';

const TYPE_SHORT: Record<ProceduralNodeType, string> = {
  COMBAT: 'CMB',
  ANOMALY: 'ANO',
  ELITE: 'ELT',
  MARKET: 'MKT',
  EXTRACTION: 'EXT',
  SANCTUARY: 'SAN',
  RESOURCE: 'RES',
  GATEKEEPER: 'BOSS',
};

interface KeepsakeCartographGhostHintProps {
  nodeId: string;
  ghostType: ProceduralNodeType;
  radarDots: readonly RadarDot[];
}

/** Ashen Cartograph — faded broad-type preview on a future scanner node. */
export default function KeepsakeCartographGhostHint({
  nodeId,
  ghostType,
  radarDots,
}: KeepsakeCartographGhostHintProps): React.JSX.Element | null {
  const dot = radarDots.find((entry) => entry.id === nodeId);
  if (!dot) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.host,
        {
          left: dot.x - 36,
          top: dot.y - 42,
        },
      ]}
    >
      <Text style={styles.label}>ROUTE GHOST</Text>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{TYPE_SHORT[ghostType]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 72,
    alignItems: 'center',
    zIndex: 6,
    opacity: 0.72,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 5,
    letterSpacing: 0.8,
    color: '#d6d3d1',
    marginBottom: 3,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(214, 211, 209, 0.35)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(12, 10, 9, 0.72)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    color: '#e7e5e4',
    letterSpacing: 0.4,
  },
});
