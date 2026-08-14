import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['ritualPresentation']>;

interface RitualCadenceHudStripProps {
  presentation: Presentation;
}

export default function RitualCadenceHudStrip({
  presentation,
}: RitualCadenceHudStripProps): React.JSX.Element | null {
  if (presentation.measure === 'EMPTY' && presentation.previousSurfaceLabel === 'None' && !presentation.heldResonanceArmed) {
    return null;
  }
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`MEASURE // ${presentation.beatLabel} // LAST ${presentation.previousSurfaceLabel}`}
      </Text>
      {presentation.finale ? <Text style={styles.sub}>FINALE</Text> : null}
      {presentation.heldResonanceArmed ? <Text style={styles.sub}>HELD RESONANCE ARMED</Text> : null}
      {presentation.improvisedAvailable ? <Text style={styles.sub}>IMPROVISED READY</Text> : null}
      {presentation.grandCadenceReady ? <Text style={styles.sub}>GRAND CADENCE READY</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(120, 200, 180, 0.45)',
    backgroundColor: 'rgba(8, 16, 14, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
  },
  line: {
    fontFamily: 'monospace',
    color: '#99f6e4',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
});
