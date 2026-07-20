import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OTT, OTT_LAYOUT } from '../../../constants/occultTacticalTerminalTheme';

interface ResourceRailProps {
  label: string;
  valueLabel: string;
  ratio: number;
  fillColor: string;
  trackBorderColor?: string;
}

/** Thin diagnostic resource rail (SOUL / FLUX / etc.). */
export default function ResourceRail({
  label,
  valueLabel,
  ratio,
  fillColor,
  trackBorderColor = OTT.borderSubtle,
}: ResourceRailProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.root}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{valueLabel}</Text>
      </View>
      <View style={[styles.track, { borderColor: trackBorderColor }]}>
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 3,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  label: {
    fontFamily: OTT.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: OTT.textSecondary,
  },
  value: {
    fontFamily: OTT.mono,
    fontSize: 9,
    fontWeight: '700',
    color: OTT.textPrimary,
  },
  track: {
    height: OTT_LAYOUT.railHeight,
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
