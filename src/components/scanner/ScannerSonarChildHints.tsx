import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RadarDot } from '../../types/run';
import type { ProceduralNodeType, ProceduralRunTree } from '../../types/proceduralRunTree';
import { getSonarChildTypes } from '../../data/proceduralScannerBridge';

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

interface ScannerSonarChildHintsProps {
  tree: ProceduralRunTree;
  parentNodeId: string;
  radarDots: readonly RadarDot[];
  scannerSize: number;
}

/** Semi-transparent child-type readout above a sonar-pinged scanner node. */
export default function ScannerSonarChildHints({
  tree,
  parentNodeId,
  radarDots,
  scannerSize,
}: ScannerSonarChildHintsProps): React.JSX.Element | null {
  const parentDot = radarDots.find((dot) => dot.id === parentNodeId);
  const childTypes = useMemo(
    () => getSonarChildTypes(tree, parentNodeId),
    [tree, parentNodeId],
  );

  if (!parentDot || childTypes.length === 0) return null;

  const center = scannerSize / 2;
  const offsetY = -42;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.host,
        {
          left: parentDot.x - 36,
          top: parentDot.y + offsetY,
        },
      ]}
    >
      <Text style={styles.label}>SONAR TRACE</Text>
      <View style={styles.row}>
        {childTypes.map((type, index) => (
          <View key={`${parentNodeId}-child-${index}`} style={styles.chip}>
            <Text style={styles.chipText}>{TYPE_SHORT[type]}</Text>
          </View>
        ))}
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
    opacity: 0.88,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 5,
    letterSpacing: 0.8,
    color: '#7dd3fc',
    marginBottom: 3,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.45)',
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  chipText: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    color: '#e0f2fe',
    letterSpacing: 0.4,
  },
});
