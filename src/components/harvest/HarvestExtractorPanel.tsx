import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import DossierCardShell from '../hub/DossierCardShell';
import { DOSSIER_METER_TRACK } from '../../constants/dossierSurface';
import { HARVEST_MUTED_SLATE } from '../../constants/harvestScreenVisual';

interface HarvestExtractorPanelProps {
  harvestPercentage: number;
  accentColor: string;
  children: React.ReactNode;
  padding: number;
  fontScale: number;
  style?: StyleProp<ViewStyle>;
}

export default function HarvestExtractorPanel({
  harvestPercentage,
  accentColor,
  children,
  padding,
  fontScale,
  style,
}: HarvestExtractorPanelProps): React.JSX.Element {
  const clampedPct = Math.min(100, Math.max(0, harvestPercentage));

  return (
    <DossierCardShell
      fillHeight
      padding={padding}
      accentColor={accentColor}
      style={[styles.shell, style]}
      contentStyle={styles.content}
    >
      <Text
        style={[
          styles.header,
          {
            color: HARVEST_MUTED_SLATE,
            fontSize: 9 * fontScale,
            lineHeight: 13 * fontScale,
          },
        ]}
      >
        [ VEIL EXTRACTOR ]
      </Text>
      <Text
        style={[
          styles.subheader,
          {
            color: HARVEST_MUTED_SLATE,
            fontSize: 7 * fontScale,
            lineHeight: 11 * fontScale,
          },
        ]}
      >
        RESONANCE SINK // FIELD VACUUM
      </Text>

      <View style={styles.canisterMount}>
        {children}
      </View>

      <View style={styles.readoutBlock}>
        <View style={[styles.meterTrack, { backgroundColor: DOSSIER_METER_TRACK }]}>
          <View
            style={[
              styles.meterFill,
              {
                backgroundColor: accentColor,
                width: `${clampedPct}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.fillLabel,
            {
              color: accentColor,
              fontSize: 10 * fontScale,
              lineHeight: 14 * fontScale,
            },
          ]}
        >
          {`CAPACITY: ${Math.round(clampedPct)}%`}
        </Text>
        <Text
          style={[
            styles.hint,
            {
              color: HARVEST_MUTED_SLATE,
              fontSize: 7 * fontScale,
              lineHeight: 11 * fontScale,
            },
          ]}
        >
          HOLD GLASS TO VACUUM RESIDUE
        </Text>
      </View>
    </DossierCardShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  content: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  header: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  subheader: {
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.7,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  canisterMount: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readoutBlock: {
    width: '100%',
    gap: 8,
    flexShrink: 0,
  },
  meterTrack: {
    width: '100%',
    height: 6,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
  },
  fillLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'monospace',
    letterSpacing: 0.45,
    textAlign: 'center',
  },
});
