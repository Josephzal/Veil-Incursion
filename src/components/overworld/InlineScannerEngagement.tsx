import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../../styles/hubTerminalUi';
import { pulseHubButton } from '../../utils/hubButtonHaptics';

export interface InlineScannerEngagementProps {
  headline?: string;
  spectralLines: string[];
  statusLines?: string[];
  canEngage: boolean;
  accent: string;
  mutedColor: string;
  onEngage: () => void;
  layout?: 'card' | 'dock';
  engageLabel?: string;
}

function handleEngage(canEngage: boolean, onEngage: () => void): void {
  if (!canEngage) return;
  pulseHubButton();
  onEngage();
}

/** Node readout + breach action — card (legacy) or compact dock strip. */
export default function InlineScannerEngagement({
  headline,
  spectralLines,
  statusLines = [],
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
          <ScrollView
            style={styles.dockScroll}
            contentContainerStyle={styles.dockScrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {spectralLines.map((line) => (
              <Text key={line} style={[styles.dockSpectral, { color: mutedColor }]} numberOfLines={2}>
                {line}
              </Text>
            ))}
            {statusLines.length > 0 ? (
              <View style={styles.dockStatusBlock}>
                {statusLines.map((line) => (
                  <Text key={line} style={[styles.dockStatus, { color: accent }]} numberOfLines={2}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
        <Pressable
          onPress={() => handleEngage(canEngage, onEngage)}
          disabled={!canEngage}
          style={({ pressed }) => [
            getInteractiveButtonStyle(accent, { disabled: !canEngage, pressed, size: 'sm' }),
            styles.dockActionBtn,
          ]}
        >
          <Text style={[getInteractiveButtonTextStyle('sm'), { color: canEngage ? accent : mutedColor }]}>
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

        {statusLines.map((line) => (
          <Text key={line} style={[styles.statusLine, { color: mutedColor }]} numberOfLines={2}>
            {line}
          </Text>
        ))}

        <Pressable
          onPress={() => handleEngage(canEngage, onEngage)}
          disabled={!canEngage}
          style={({ pressed }) => [
            getInteractiveButtonStyle(accent, { disabled: !canEngage, pressed, size: 'sm' }),
            styles.actionBtn,
          ]}
        >
          <Text style={[getInteractiveButtonTextStyle('sm'), { color: canEngage ? accent : mutedColor }]}>
            {engageLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: 200 },
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
  statusLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  actionBtn: { marginTop: 4 },
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
    maxHeight: 88,
  },
  dockScroll: { flexGrow: 0, maxHeight: 72 },
  dockScrollContent: { gap: 1 },
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
  dockStatusBlock: { marginTop: 3, gap: 1 },
  dockStatus: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  dockActionBtn: { flexShrink: 0 },
});
