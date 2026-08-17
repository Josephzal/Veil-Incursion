import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['faultlinePresentation']>;

interface FaultlineHudStripProps {
  presentation: Presentation;
}

export default function FaultlineHudStrip({
  presentation,
}: FaultlineHudStripProps): React.JSX.Element | null {
  if (!presentation.active && !presentation.lastLog) return null;
  const pips = Object.entries(presentation.pips).filter(([, value]) => value > 0);
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`FAULTLINE // ${pips.length > 0 ? pips.map(([id, value]) => `${id.replace(/^enemy-/, '')}:${value}`).join(' · ') : 'CLEAR'}`}
      </Text>
      {presentation.lastLog ? <Text style={styles.sub}>{presentation.lastLog}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(200, 140, 70, 0.5)',
    backgroundColor: 'rgba(18, 12, 6, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    marginBottom: 6,
  },
  line: {
    fontFamily: 'monospace',
    color: '#fdba74',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
});
