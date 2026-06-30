import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { textGlow } from '../../utils/adaptiveStyles';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import RunFeedChromeButtons from '../run/RunFeedChromeButtons';
import { hubCtaButtonStyle } from '../../constants/hubCta';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';
import ScannerBreachButton from '../scanner/ScannerBreachButton';

const STATE_VIOLET = '#ddd6fe';
const STATE_VIOLET_GLOW = '#c4b5fd';
const TERMINAL_GREEN = '#00ff33';
const SOLARIS_CRIMSON = '#dc2626';

export interface InlineScannerEngagementProps {
  headline?: string;
  spectralLines: string[];
  statusLines?: string[];
  /** Idle scanner prompt styled as telemetry readout (no node locked). */
  idleMessage?: string;
  /** All radar pings locked — crossfade caption to SIGNAL DECRYPTED. */
  signalDecrypted?: boolean;
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

function resolveReadoutValueColor(label: string, value: string): string {
  if (label !== 'NODE TYPE') return STATE_VIOLET;
  const upper = value.toUpperCase();
  if (upper.includes('COMBAT') || upper.includes('ELITE') || upper.includes('BOSS')) {
    return SOLARIS_CRIMSON;
  }
  if (upper.includes('MARKET')) {
    return TERMINAL_GREEN;
  }
  return STATE_VIOLET;
}

function TelemetryReadoutCard({
  line,
  fontScale,
  gap,
  isDesktop,
  mutedColor,
}: {
  line: string;
  fontScale: number;
  gap: number;
  isDesktop: boolean;
  mutedColor: string;
}): React.JSX.Element {
  const { label, value } = parseTelemetryLine(line);
  const valueColor = resolveReadoutValueColor(label, value);

  if (isDesktop) {
    return (
      <View
        style={[
          styles.readoutCard,
          {
            padding: 16,
            marginBottom: gap,
          },
        ]}
      >
        <Text
          style={[
            styles.readoutLabel,
            {
              color: mutedColor,
              opacity: 1,
              fontSize: 6 * fontScale,
              lineHeight: 9 * fontScale,
              letterSpacing: 1.2 * fontScale,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={[
              styles.readoutValue,
              {
                color: valueColor,
                fontSize: 9 * fontScale * 1.2,
                lineHeight: 12 * fontScale * 1.2,
              },
              valueColor === STATE_VIOLET
                ? textGlow({ color: STATE_VIOLET_GLOW, radius: 6, offset: { width: 0, height: 0 } })
                : null,
            ]}
            numberOfLines={2}
          >
            {value.toUpperCase()}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.telemetryRow}>
      <Text style={[styles.telemetryBracket, { color: 'rgba(148, 163, 184, 0.55)' }]}>{'⟨'}</Text>
      <View style={styles.telemetryCopy}>
        <Text style={[styles.telemetryLabel, { color: mutedColor }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={[styles.telemetryValue, { color: valueColor }]} numberOfLines={2}>
            {value}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.telemetryBracket, { color: 'rgba(148, 163, 184, 0.55)' }]}>{'⟩'}</Text>
    </View>
  );
}

function TelemetryIdlePrompt({
  message,
  fontScale,
  gap,
  mutedColor,
}: {
  message: string;
  fontScale: number;
  gap: number;
  mutedColor: string;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.readoutCard,
        styles.idleReadout,
        { padding: 16, marginBottom: gap },
      ]}
    >
      <Text
        style={[
          styles.readoutLabel,
          {
            color: mutedColor,
            opacity: 1,
            fontSize: 6 * fontScale,
            lineHeight: 9 * fontScale,
            letterSpacing: 1.2 * fontScale,
          },
        ]}
        numberOfLines={1}
      >
        SCANNER STATE
      </Text>
      <Text
        style={[
          styles.idlePromptValue,
          {
            color: mutedColor,
            fontSize: 8 * fontScale * 1.2,
            lineHeight: 12 * fontScale * 1.2,
          },
        ]}
      >
        {message.toUpperCase()}
      </Text>
    </View>
  );
}

const WAVE_BASE_HEIGHTS = [12, 22, 16, 28, 18, 24, 14, 20, 26, 12];
const DECRYPT_CROSSFADE_MS = 900;
const DECRYPT_GLOW_MS = 1400;

function SignalWaveform({
  fontScale,
  decrypted,
  accentColor,
}: {
  fontScale: number;
  decrypted: boolean;
  accentColor: string;
}): React.JSX.Element {
  const [dotCount, setDotCount] = useState(0);
  const barAnims = useRef(WAVE_BASE_HEIGHTS.map(() => new Animated.Value(0.35))).current;
  const decryptBlend = useRef(new Animated.Value(decrypted ? 1 : 0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const barLoopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (decrypted) return undefined;
    setDotCount(0);
    const dotTimer = setInterval(() => {
      setDotCount((prev) => (prev >= 3 ? 0 : prev + 1));
    }, 450);
    return () => clearInterval(dotTimer);
  }, [decrypted]);

  useEffect(() => {
    Animated.timing(decryptBlend, {
      toValue: decrypted ? 1 : 0,
      duration: DECRYPT_CROSSFADE_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [decrypted, decryptBlend]);

  useEffect(() => {
    if (!decrypted) {
      glowPulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: DECRYPT_GLOW_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: DECRYPT_GLOW_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [decrypted, glowPulse]);

  useEffect(() => {
    barLoopsRef.current.forEach((loop) => loop.stop());
    barLoopsRef.current = [];

    if (decrypted) return undefined;

    const loops = barAnims.map((anim, index) => Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 520 + index * 45,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0.35,
          duration: 520 + index * 45,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    ));

    loops.forEach((loop) => loop.start());
    barLoopsRef.current = loops;
    return () => loops.forEach((loop) => loop.stop());
  }, [barAnims, decrypted]);

  const decryptingCaptionOpacity = decryptBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const decryptedCaptionOpacity = decryptBlend;
  const waveformShellOpacity = decryptBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const waveformShellHeight = decryptBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 0],
  });
  const waveformShellMargin = decryptBlend.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });
  const glowRadius = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 14],
  });

  const captionSize = 7 * fontScale;
  const dotsSlotWidth = captionSize * 0.55 * 3;

  return (
    <View style={styles.signalAnchor}>
      <Animated.View
        style={[
          styles.waveformShell,
          {
            opacity: waveformShellOpacity,
            height: waveformShellHeight,
            marginBottom: waveformShellMargin,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={styles.waveformRow}>
          {WAVE_BASE_HEIGHTS.map((baseHeight, index) => (
            <Animated.View
              key={`wave-${index}`}
              style={[
                styles.waveformBar,
                {
                  height: barAnims[index].interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [baseHeight * 0.35, baseHeight],
                  }),
                  opacity: barAnims[index].interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0.18, 0.55],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </Animated.View>

      <View style={[styles.signalCaptionHost, { minHeight: captionSize * 1.6 }]}>
        <Animated.View
          style={[
            styles.signalCaptionLayer,
            { opacity: decryptingCaptionOpacity },
          ]}
          pointerEvents="none"
        >
          <View style={styles.signalCaptionRow}>
            <TerminalText
              size={captionSize}
              letterSpacing={1.4}
              style={styles.signalCaption}
            >
              DECRYPTING SIGNAL
            </TerminalText>
            <View style={[styles.signalDotsSlot, { width: dotsSlotWidth }]}>
              {[0, 1, 2].map((index) => (
                <TerminalText
                  key={`dot-${index}`}
                  size={captionSize}
                  letterSpacing={0}
                  style={[
                    styles.signalDot,
                    { opacity: index < dotCount ? 1 : 0 },
                  ]}
                >
                  .
                </TerminalText>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.signalCaptionLayer,
            {
              opacity: decryptedCaptionOpacity,
              shadowColor: accentColor,
              shadowOpacity: glowPulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 0.95],
              }),
              shadowRadius: glowRadius,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
          pointerEvents="none"
        >
          <TerminalText
            size={captionSize}
            letterSpacing={1.4}
            style={[
              styles.signalDecryptedCaption,
              { color: accentColor },
              textGlow({ color: accentColor, radius: 8, offset: { width: 0, height: 0 } }),
            ]}
          >
            SIGNAL DECRYPTED
          </TerminalText>
        </Animated.View>
      </View>
    </View>
  );
}

function FeedChromeButtons({
  accent,
  mutedColor,
}: {
  accent: string;
  mutedColor: string;
}): React.JSX.Element | null {
  return <RunFeedChromeButtons accent={accent} mutedColor={mutedColor} />;
}

/** Node readout + breach action — card (legacy) or structured data-feed dock. */
export default function InlineScannerEngagement({
  headline,
  spectralLines,
  statusLines = [],
  idleMessage,
  signalDecrypted = false,
  canEngage,
  accent,
  mutedColor,
  onEngage,
  layout = 'card',
  engageLabel = '[ ENGAGE ]',
}: InlineScannerEngagementProps): React.JSX.Element {
  const { isDesktop, fontScale, gap, scaleFont, scaleSize, scaleSpacing } = useResponsiveLayout();

  if (layout === 'dock') {
    const telemetryLines = [...spectralLines, ...statusLines];
    const showIdle = idleMessage != null && telemetryLines.length === 0;
    const panelPadding = isDesktop ? scaleSpacing(24) : 10;

    const telemetryContent = (
      <>
        {headline ? (
          <Text
            style={[
              styles.feedHeadline,
              {
                color: mutedColor,
                fontSize: isDesktop ? scaleFont(6) : undefined,
                marginBottom: isDesktop ? gap : undefined,
              },
            ]}
            numberOfLines={1}
          >
            {headline}
          </Text>
        ) : null}
        {showIdle ? (
          <TelemetryIdlePrompt
            message={idleMessage}
            fontScale={fontScale}
            gap={gap}
            mutedColor={mutedColor}
          />
        ) : (
          telemetryLines.map((line) => (
            <TelemetryReadoutCard
              key={line}
              line={line}
              fontScale={fontScale}
              gap={gap}
              isDesktop={isDesktop}
              mutedColor={mutedColor}
            />
          ))
        )}
      </>
    );

    const telemetryBlock = isDesktop ? (
      <ScrollView
        style={styles.feedTelemetryScroll}
        contentContainerStyle={styles.readoutStack}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {telemetryContent}
      </ScrollView>
    ) : (
      <ScrollView
        style={styles.feedScroll}
        contentContainerStyle={styles.feedScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {telemetryContent}
      </ScrollView>
    );

    const breachControl = (
      <TacticalButton
        label={engageLabel}
        active={canEngage}
        onPress={onEngage}
        accentColor={accent}
        mutedColor={mutedColor}
        variant="cta"
        style={(state) => [
          styles.breachButton,
          hubCtaButtonStyle(accent, scaleSize, scaleSpacing, !canEngage),
          isDesktop && canEngage
            ? terminalHoverStyle(readPressableHover(state), state.pressed)
            : null,
        ]}
      />
    );

    return (
      <View
        style={[
          styles.dockRoot,
          {
            padding: panelPadding,
            gap: isDesktop ? gap : 10,
          },
        ]}
      >
        <View style={styles.feedTop}>
          <View
            style={[
              styles.feedHeader,
              isDesktop && styles.feedHeaderDesktop,
            ]}
          >
            <Text
              style={[
                styles.feedEyebrow,
                isDesktop && styles.feedEyebrowDesktop,
                {
                  color: mutedColor,
                  fontSize: isDesktop ? 8 * fontScale : 6,
                  lineHeight: isDesktop ? 12 * fontScale : 9,
                  paddingBottom: isDesktop ? 8 : 0,
                },
              ]}
              numberOfLines={1}
            >
              DATA FEED // VECTOR TELEMETRY
            </Text>
            <FeedChromeButtons accent={accent} mutedColor={mutedColor} />
          </View>
          {telemetryBlock}
        </View>

        {isDesktop ? (
          <View style={styles.signalDock}>
            <SignalWaveform
              fontScale={fontScale}
              decrypted={signalDecrypted}
              accentColor={accent}
            />
          </View>
        ) : null}

        {breachControl}
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
    justifyContent: 'space-between',
  },
  feedTop: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  feedTelemetryScroll: {
    flex: 1,
    minHeight: 0,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexShrink: 0,
    marginBottom: 8,
  },
  feedHeaderDesktop: {
    alignItems: 'flex-end',
  },
  feedEyebrow: {
    flex: 1,
    fontFamily: 'monospace',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  feedEyebrowDesktop: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  feedHeadline: {
    fontFamily: 'monospace',
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
  readoutStack: {
    width: '100%',
  },
  readoutCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  readoutLabel: {
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    opacity: 0.5,
    fontWeight: '600',
  },
  readoutValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  idleReadout: {
    marginTop: 4,
  },
  idlePromptValue: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.55,
  },
  signalDock: {
    flexShrink: 0,
    width: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  signalAnchor: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  waveformShell: {
    width: '100%',
    alignItems: 'center',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 32,
  },
  waveformBar: {
    width: 3,
    backgroundColor: 'rgba(167, 139, 250, 0.55)',
    borderRadius: 1,
  },
  signalCaption: {
    color: 'rgba(148, 163, 184, 0.35)',
    fontWeight: '600',
  },
  signalDecryptedCaption: {
    fontWeight: '800',
    textAlign: 'center',
  },
  signalCaptionHost: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalCaptionLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalDotsSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  signalDot: {
    color: 'rgba(148, 163, 184, 0.35)',
    fontWeight: '600',
    textAlign: 'left',
  },
  breachButton: {
    width: '100%',
    alignSelf: 'stretch',
    flexShrink: 0,
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
    ...textGlow({ color: STATE_VIOLET_GLOW, radius: 6, offset: { width: 0, height: 0 } }),
  },
});
