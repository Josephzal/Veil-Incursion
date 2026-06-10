import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface InlineScannerEngagementProps {
  headline?: string;
  spectralLines: string[];
  canFocus: boolean;
  canEngage: boolean;
  accent: string;
  mutedColor: string;
  onFocus: () => void;
  onEngage: () => void;
  onDismiss: () => void;
  layout?: 'card' | 'dock';
}

/** Node readout + Focus/Engage/Disengage — card (legacy) or compact dock strip. */
export default function InlineScannerEngagement({
  headline,
  spectralLines,
  canFocus,
  canEngage,
  accent,
  mutedColor,
  onFocus,
  onEngage,
  onDismiss,
  layout = 'card',
}: InlineScannerEngagementProps): React.JSX.Element {
  if (layout === 'dock') {
    return (
      <View style={styles.dockRoot}>
        <View style={styles.dockReadout}>
          <Pressable onPress={onDismiss} hitSlop={6}>
            <Text style={[styles.dockDismiss, { color: accent }]}>[ DISENGAGE ]</Text>
          </Pressable>
          {headline ? (
            <Text style={[styles.dockHeadline, { color: accent }]} numberOfLines={1}>
              {headline}
            </Text>
          ) : null}
          {spectralLines.slice(0, 2).map((line) => (
            <Text key={line} style={[styles.dockSpectral, { color: mutedColor }]} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.dockActions}>
          <Pressable
            onPress={onFocus}
            disabled={!canFocus}
            style={[
              styles.dockActionBtn,
              { borderColor: canFocus ? accent : mutedColor, opacity: canFocus ? 1 : 0.4 },
            ]}
          >
            <Text style={[styles.dockActionText, { color: canFocus ? accent : mutedColor }]}>
              [ FOCUS ]
            </Text>
          </Pressable>
          <Pressable
            onPress={onEngage}
            disabled={!canEngage}
            style={[
              styles.dockActionBtn,
              { borderColor: canEngage ? accent : mutedColor, opacity: canEngage ? 1 : 0.4 },
            ]}
          >
            <Text style={[styles.dockActionText, { color: canEngage ? accent : mutedColor }]}>
              [ ENGAGE ]
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <View style={styles.readoutShell}>
        <Pressable onPress={onDismiss} style={styles.dismissBtn}>
          <Text style={[styles.dismissText, { color: accent }]}>[ DISENGAGE ]</Text>
        </Pressable>

        {headline ? (
          <Text style={[styles.headline, { color: accent }]} numberOfLines={2}>
            {headline}
          </Text>
        ) : null}

        {spectralLines.slice(0, 4).map((line) => (
          <Text key={line} style={[styles.spectralLine, { color: accent }]} numberOfLines={2}>
            {line}
          </Text>
        ))}

        <View style={styles.actionRow}>
          <Pressable
            onPress={onFocus}
            disabled={!canFocus}
            style={[styles.actionBtn, { borderColor: canFocus ? accent : mutedColor, opacity: canFocus ? 1 : 0.45 }]}
          >
            <Text style={[styles.actionText, { color: canFocus ? accent : mutedColor }]}>[ FOCUS ]</Text>
          </Pressable>
          <Pressable
            onPress={onEngage}
            disabled={!canEngage}
            style={[styles.actionBtn, { borderColor: canEngage ? accent : mutedColor, opacity: canEngage ? 1 : 0.45 }]}
          >
            <Text style={[styles.actionText, { color: canEngage ? accent : mutedColor }]}>[ ENGAGE ]</Text>
          </Pressable>
        </View>
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
  dismissBtn: {
    alignSelf: 'flex-start',
  },
  dismissText: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
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
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
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
  dockDismiss: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    marginBottom: 2,
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
  dockActions: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  dockActionBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  dockActionText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
