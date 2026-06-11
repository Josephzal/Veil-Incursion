import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface InlineScannerEngagementProps {
  headline?: string;
  spectralLines: string[];
  canEngage: boolean;
  accent: string;
  mutedColor: string;
  onEngage: () => void;
  layout?: 'card' | 'dock';
  engageLabel?: string;
}

/** Node readout + breach action — card (legacy) or compact dock strip. */
export default function InlineScannerEngagement({
  headline,
  spectralLines,
  canEngage,
  accent,
  mutedColor,
  onEngage,
  layout = 'card',
  engageLabel = '[ ENGAGE ]',
}: InlineScannerEngagementProps): React.JSX.Element {
  if (layout === 'dock') {
    return (
      <View style={styles.dockRoot}>
        <View style={styles.dockReadout}>
          {headline ? (
            <Text style={[styles.dockHeadline, { color: accent }]} numberOfLines={1}>
              {headline}
            </Text>
          ) : null}
          {spectralLines.map((line) => (
            <Text key={line} style={[styles.dockSpectral, { color: mutedColor }]} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
        <Pressable
          onPress={onEngage}
          disabled={!canEngage}
          style={[
            styles.dockActionBtn,
            { borderColor: canEngage ? accent : mutedColor, opacity: canEngage ? 1 : 0.4 },
          ]}
        >
          <Text style={[styles.dockActionText, { color: canEngage ? accent : mutedColor }]}>
            {engageLabel}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <View style={styles.readoutShell}>
        {headline ? (
          <Text style={[styles.headline, { color: accent }]} numberOfLines={2}>
            {headline}
          </Text>
        ) : null}

        {spectralLines.map((line) => (
          <Text key={line} style={[styles.spectralLine, { color: accent }]} numberOfLines={2}>
            {line}
          </Text>
        ))}

        <Pressable
          onPress={onEngage}
          disabled={!canEngage}
          style={[styles.actionBtn, { borderColor: canEngage ? accent : mutedColor, opacity: canEngage ? 1 : 0.45 }]}
        >
          <Text style={[styles.actionText, { color: canEngage ? accent : mutedColor }]}>{engageLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 200,
  },
  readoutShell: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  headline: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  spectralLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.3,
  },
  actionBtn: {
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  actionText: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
  },
  dockRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  dockReadout: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dockHeadline: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dockSpectral: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
  },
  dockActionBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    flexShrink: 0,
  },
  dockActionText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
