import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['stillpointPresentation']>;

interface StillpointHudStripProps {
  presentation: Presentation;
}

export default function StillpointHudStrip({
  presentation,
}: StillpointHudStripProps): React.JSX.Element | null {
  if (
    presentation.nativeLabel === '0 / 2'
    && !presentation.fleetingLabel
    && !presentation.stormFree
    && !presentation.stayedSentenceFree
    && presentation.stormRemaining <= 0
    && !presentation.zeroHourPausePending
  ) {
    return null;
  }
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`STILLPOINT // STILLNESS ${presentation.nativeLabel}`}
      </Text>
      {presentation.fleetingLabel ? <Text style={styles.sub}>{presentation.fleetingLabel}</Text> : null}
      {presentation.stayedSentenceFree ? <Text style={styles.sub}>STAYED SENTENCE // FREE FOCUS</Text> : null}
      {presentation.stormFree ? <Text style={styles.sub}>MOTIONLESS STORM // FREE FOCUS</Text> : null}
      {presentation.stormRemaining > 0 ? (
        <Text style={styles.sub}>{`STORM BURST ${presentation.stormRemaining} REMAINING`}</Text>
      ) : null}
      {presentation.zeroHourPausePending ? <Text style={styles.sub}>ZERO HOUR // TELEGRAPH PAUSE ARMED</Text> : null}
      {presentation.lastDiscountPreview ? <Text style={styles.sub}>{presentation.lastDiscountPreview}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(180, 160, 90, 0.45)',
    backgroundColor: 'rgba(16, 14, 8, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    marginBottom: 6,
  },
  line: {
    fontFamily: 'monospace',
    color: '#fde68a',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
});
