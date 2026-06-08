import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getBiomeContextLog } from '../data/descentEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { IncursionBiome } from '../types/game';

interface EncounterBiomeBannerProps {
  biomeOverride?: IncursionBiome;
}

export default function EncounterBiomeBanner({
  biomeOverride,
}: EncounterBiomeBannerProps): React.JSX.Element | null {
  const { getSelectedVectorNode, activeIncursion } = useRun();
  const { theme } = useTerminal();

  const node = getSelectedVectorNode();
  const biome = biomeOverride ?? node?.biome;
  if (!biome || activeIncursion.mapMode === 'SCANNING_HUB') return null;

  return (
    <View style={[styles.banner, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
      <Text style={[styles.biomeLine, { color: theme.primaryColor }]}>
        {getBiomeContextLog(biome)}
      </Text>
      <Text style={[styles.depthLine, { color: theme.mutedColor }]}>
        {`DEPTH ${activeIncursion.currentDepth} // ENCOUNTER ${activeIncursion.currentEncounterIndex + 1}/10 // INCURSION LAYER ACTIVE`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexShrink: 0,
  },
  biomeLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    lineHeight: 12,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  depthLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    marginTop: 4,
    textAlign: 'center',
  },
});
