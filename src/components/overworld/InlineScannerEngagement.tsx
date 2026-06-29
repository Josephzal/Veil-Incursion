import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { textGlow } from '../../utils/adaptiveStyles';
import HapticPressable from '../HapticPressable';
import { TERMINAL_ACCENT } from '../MacroLogCargoButton';
import { useCargoOverlay } from '../../context/CargoOverlayContext';
import { useRunStatusOverlay } from '../../context/RunStatusOverlayContext';
import ScannerBreachButton from '../scanner/ScannerBreachButton';

const STATE_VIOLET = '#ddd6fe';
const STATE_VIOLET_GLOW = '#c4b5fd';

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

function parseTelemetryLine(line: string): { label: string; value: string } {
  const trimmed = line.replace(/^>\s*/, '');
  const splitIndex = trimmed.indexOf(':');
  if (splitIndex === -1) {
    return { label: trimmed, value: '' };
  }
  return {
    label: trimmed.slice(0, splitIndex).trim(),
    value: trimmed.slice(splitIndex + 1).trim(),
  };
}

function TelemetryRow({
  line,
  mutedColor,
}: {
  line: string;
  mutedColor: string;
}): React.JSX.Element {
  const { label, value } = parseTelemetryLine(line);
  return (
    <View style={styles.telemetryRow}>
      <Text style={[styles.telemetryBracket, { color: mutedColor }]}>{'⟨'}</Text>
      <View style={styles.telemetryCopy}>
        <Text style={[styles.telemetryLabel, { color: mutedColor }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={styles.telemetryValue} numberOfLines={2}>
            {value}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.telemetryBracket, { color: mutedColor }]}>{'⟩'}</Text>
    </View>
  );
}

function FeedChromeButtons(): React.JSX.Element | null {
  const cargo = useCargoOverlay();
  const status = useRunStatusOverlay();
  const showStatus = status?.statusEnabled ?? false;
  const showCargo = cargo?.cargoEnabled ?? false;

  if (!showStatus && !showCargo) return null;

  return (
    <View style={styles.feedChromeRow}>
      {showStatus ? (
        <HapticPressable
          onPress={status!.openStatus}
          style={({ pressed }) => [styles.feedChromeBtn, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Open operative status"
        >
          <Text style={styles.feedChromeBtnText}>STATUS</Text>
        </HapticPressable>
      ) : null}
      {showCargo ? (
        <HapticPressable
          onPress={cargo!.openCargo}
          style={({ pressed }) => [styles.feedChromeBtn, { opacity: pressed ? 0.75 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Open cargo grid"
        >
          <Text style={styles.feedChromeBtnText}>CARGO</Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

/** Node readout + breach action — card (legacy) or structured data-feed dock. */
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
        <View style={styles.feedFrame}>
          <View style={styles.feedHeader}>
            <Text style={[styles.feedEyebrow, { color: mutedColor }]}>
              DATA FEED // VECTOR TELEMETRY
            </Text>
            <FeedChromeButtons />
          </View>
          <ScrollView
            style={styles.feedScroll}
            contentContainerStyle={styles.feedScrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {headline ? (
              <Text style={[styles.feedHeadline, { color: mutedColor }]} numberOfLines={1}>
                {headline}
              </Text>
            ) : null}
            {spectralLines.map((line) => (
              <TelemetryRow key={line} line={line} mutedColor={mutedColor} />
            ))}
            {statusLines.map((line) => (
              <TelemetryRow key={line} line={line} mutedColor={mutedColor} />
            ))}
          </ScrollView>
        </View>
        <ScannerBreachButton
          label={engageLabel}
          enabled={canEngage}
          accent={accent}
          mutedColor={mutedColor}
          onPress={onEngage}
        />
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

        <ScannerBreachButton
          label={engageLabel}
          enabled={canEngage}
          accent={accent}
          mutedColor={mutedColor}
          onPress={onEngage}
        />
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
  dockRoot: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  feedFrame: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    backgroundColor: 'rgba(3, 4, 6, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
  },
  feedEyebrow: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  feedHeadline: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.5,
  },
  feedScroll: {
    flex: 1,
    minHeight: 0,
  },
  feedScrollContent: {
    gap: 6,
    paddingBottom: 4,
  },
  feedChromeRow: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  feedChromeBtn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 51, 0.65)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(10, 11, 15, 0.95)',
    minWidth: 60,
    alignItems: 'center',
  },
  feedChromeBtnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: TERMINAL_ACCENT,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  telemetryBracket: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    opacity: 0.55,
    marginTop: 1,
  },
  telemetryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  telemetryLabel: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  telemetryValue: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.5,
    fontWeight: '700',
    color: STATE_VIOLET,
    ...textGlow({ color: STATE_VIOLET_GLOW, radius: 6, offset: { width: 0, height: 0 } }),
  },
});
