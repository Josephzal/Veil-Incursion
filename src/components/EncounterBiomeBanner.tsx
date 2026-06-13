import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getMacroBiomeDisplayLabel } from '../data/descentEngine';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

export default function EncounterBiomeBanner(): React.JSX.Element | null {
  const { activeIncursion } = useRun();
  const { theme } = useTerminal();

  const macroFamily = activeIncursion.currentMacroBiomeFamily;
  if (!macroFamily || activeIncursion.mapMode === 'SCANNING_HUB') return null;

  return (
    <View style={[styles.banner, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
      <Text style={[styles.biomeLine, { color: theme.primaryColor }]}>
        {`MACRO BIOME // ${getMacroBiomeDisplayLabel(macroFamily).toUpperCase()}`}
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
