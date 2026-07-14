import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getMacroBiomeDisplayLabel } from '../data/descentEngine';
import { formatSectorDepthFlavorLine } from '../data/sectorDepthVisualCatalog';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

export default function EncounterBiomeBanner(): React.JSX.Element | null {
  const { activeIncursion, getSelectedVectorNode } = useRun();
  const { theme } = useTerminal();

  const macroFamily = activeIncursion.currentMacroBiomeFamily;
  if (!macroFamily || activeIncursion.mapMode === 'SCANNING_HUB') return null;

  const modifiers = getSelectedVectorNode()?.contextModifiers;
  const modLabel = modifiers?.encounterModifierLabel;
  const modSummary = modifiers?.encounterModifierSummary;
  const twistLabel = modifiers?.twistedTemplateLabel;
  const twistSummary = modifiers?.twistedTemplateSummary;
  const district = (activeIncursion.currentDistrict as 1 | 2 | 3) ?? 1;
  const sectorFlavor = activeIncursion.runVeilBiome
    ? formatSectorDepthFlavorLine(activeIncursion.runVeilBiome, district)
    : null;

  return (
    <View style={[styles.banner, { borderColor: theme.borderColor, backgroundColor: '#050608' }]}>
      <Text style={[styles.biomeLine, { color: theme.primaryColor }]}>
        {`MACRO BIOME // ${getMacroBiomeDisplayLabel(macroFamily).toUpperCase()}`}
      </Text>
      <Text style={[styles.depthLine, { color: theme.mutedColor }]}>
        {`SECTOR T${activeIncursion.sectorTier} // NODE ${activeIncursion.nodesCleared + 1}`}
      </Text>
      {sectorFlavor ? (
        <Text style={[styles.modLine, { color: theme.mutedColor }]}>
          {`DEPTH FLAVOR // ${sectorFlavor.toUpperCase()}`}
        </Text>
      ) : null}
      {twistLabel ? (
        <Text style={[styles.modLine, { color: theme.primaryColor }]}>
          {`TWIST // ${twistLabel.toUpperCase()}${twistSummary ? ` — ${twistSummary}` : ''}`}
        </Text>
      ) : null}
      {modLabel ? (
        <Text style={[styles.modLine, { color: theme.primaryColor }]}>
          {`MOD // ${modLabel.toUpperCase()}${modSummary ? ` — ${modSummary}` : ''}`}
        </Text>
      ) : null}
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
  modLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    marginTop: 4,
    lineHeight: 11,
    textAlign: 'center',
  },
});
