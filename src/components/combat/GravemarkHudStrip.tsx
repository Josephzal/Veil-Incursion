import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import type { NineStrainRuntime } from '../../data/nineStrain/runtime';

type Presentation = ReturnType<NineStrainRuntime['gravemarkPresentation']>;

interface GravemarkHudStripProps {
  presentation: Presentation;
}

const POLARITY_LABEL: Record<string, string> = {
  ARMAMENT: 'ARM',
  DISCIPLINE: 'DSC',
  INSTINCT: 'INS',
  CURRENT: 'CUR',
};

export default function GravemarkHudStrip({
  presentation,
}: GravemarkHudStripProps): React.JSX.Element | null {
  if (!presentation.active && !presentation.lastLog) return null;
  const polarityEntries = Object.entries(presentation.polarityByUnitId);
  const polarityLine = polarityEntries.length > 0
    ? polarityEntries
      .map(([id, polarity]) => `${id.replace(/^enemy-/, '')}:${POLARITY_LABEL[polarity] ?? polarity}`)
      .join(' · ')
    : 'CLEAR';
  const unmooredLine = presentation.unmooredUnitIds.length > 0
    ? presentation.unmooredUnitIds.map((id) => id.replace(/^enemy-/, '')).join(', ')
    : 'NONE';
  const eventHorizonLine = presentation.eventHorizonUnitIds.length > 0
    ? presentation.eventHorizonUnitIds.map((id) => id.replace(/^enemy-/, '')).join(', ')
    : null;
  return (
    <View style={styles.host} accessibilityRole="summary">
      <Text style={styles.line} numberOfLines={1}>
        {`GRAVEMARK // POLARITY ${polarityLine}`}
      </Text>
      <Text style={styles.line} numberOfLines={1}>
        {`UNMOORED ${unmooredLine} · DISPLACEMENT CAP ${presentation.displacementCap}/CYCLE`}
      </Text>
      {eventHorizonLine ? (
        <Text style={styles.sub} numberOfLines={1}>
          {`EVENT HORIZON // ${eventHorizonLine}`}
        </Text>
      ) : null}
      {presentation.lastLog ? <Text style={styles.sub}>{presentation.lastLog}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
    backgroundColor: 'rgba(12, 8, 18, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 3,
    marginBottom: 6,
  },
  line: {
    fontFamily: 'monospace',
    color: '#c4b5fd',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: 'monospace',
    color: OTT.terminalGreenMuted,
    fontSize: 7,
  },
});
