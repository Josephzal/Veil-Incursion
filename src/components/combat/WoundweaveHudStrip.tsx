import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['woundweavePresentation']>;

interface WoundweaveHudStripProps {
  presentation: Presentation;
}

export default function WoundweaveHudStrip({
  presentation,
}: WoundweaveHudStripProps): React.JSX.Element | null {
  if (presentation.durationLabel === 'NONE' && !presentation.lastLog && !presentation.pendingId) {
    return null;
  }
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {presentation.selfLink
          ? `WOUNDWEAVE // SELF-LINK ${presentation.endpointALabel ?? 'HOSTILE'}`
          : `WOUNDWEAVE // ${presentation.endpointALabel ?? '—'} · ${presentation.endpointBLabel ?? '—'}`}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {presentation.durationLabel}
        {presentation.persistent ? ' // STITCH' : ''}
        {presentation.emptySlot ? ' // EMPTY SLOT' : ''}
        {presentation.threadCharge != null ? ` // THREAD ${presentation.threadCharge}` : ''}
        {presentation.secondaryCount > 0 ? ` // BODY ${presentation.secondaryCount}` : ''}
      </Text>
      {presentation.lastLog ? <Text style={styles.sub}>{presentation.lastLog}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(180, 90, 90, 0.45)',
    backgroundColor: 'rgba(16, 8, 8, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    marginBottom: 6,
  },
  line: {
    fontFamily: 'monospace',
    color: '#fecaca',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
});
