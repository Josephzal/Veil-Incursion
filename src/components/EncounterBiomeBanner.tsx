import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getBiomeContextLog } from '../data/descentEngine';
import { getEnvironmentCombatProfile } from '../data/combatEnvironmentEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { IncursionBiome } from '../types/game';
import { ENVIRONMENT_DISPLAY_LABEL } from '../types/sector';

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

  const envLabel = node?.environmentType
    ? ENVIRONMENT_DISPLAY_LABEL[node.environmentType]
    : null;
  const envProfile = getEnvironmentCombatProfile(node?.environmentType);

  return (
    <View style={[styles.banner, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
      <Text style={[styles.biomeLine, { color: theme.primaryColor }]}>
        {envLabel
          ? `ENVIRONMENT // ${envLabel.toUpperCase()} // ${envProfile?.hazardLabel ?? 'ACTIVE'}`
          : getBiomeContextLog(biome)}
      </Text>
      <Text style={[styles.depthLine, { color: theme.mutedColor }]}>
        {`SECTOR T${activeIncursion.sectorTier} // NODE ${activeIncursion.nodesCleared + 1}`}
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
