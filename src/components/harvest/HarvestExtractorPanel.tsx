import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { TerminalTheme } from '../../types/theme';

interface HarvestExtractorPanelProps {
  theme: TerminalTheme;
  harvestPercentage: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function HarvestExtractorPanel({
  theme,
  harvestPercentage,
  children,
  style,
}: HarvestExtractorPanelProps): React.JSX.Element {
  return (
    <View style={[styles.block, { borderColor: theme.borderColor }, style]}>
      <Text style={[styles.eyebrow, { color: theme.mutedColor }]}>
        VEIL EXTRACTOR // RESONANCE SINK
      </Text>
      <View style={styles.canisterMount}>
        {children}
      </View>
      <Text style={[styles.fillLabel, { color: theme.primaryColor }]}>
        {`CANISTER ${Math.round(harvestPercentage)}%`}
      </Text>
      <Text style={[styles.hint, { color: theme.mutedColor }]}>
        HOLD GLASS TO VACUUM RESIDUE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(5, 6, 8, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  eyebrow: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  canisterMount: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
