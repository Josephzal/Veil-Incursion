import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { pulseHubButton } from '../../utils/hubButtonHaptics';

const PANEL_BG = '#080C0E';
const PANEL_BORDER = 'rgba(98, 230, 165, 0.34)';
const BACKDROP = 'rgba(2, 5, 7, 0.76)';
const TEXT_PRIMARY = '#E3ECE8';
const TEXT_SECONDARY = '#82918C';
const MINT = OTT.terminalGreen;
const OCCULT = '#C45AAE';
const CTA_REVEAL_MS = 520;
const CTA_GUARD_MS = 280;

export interface CombatResolutionSummaryStat {
  value: string;
  label: string;
  /** Mint the value when it is a confirmed reward / positive status. */
  accent?: boolean;
}

interface CombatResolutionBannerProps {
  outcome: 'VICTORY' | 'DEFEAT';
  heading: string;
  subtitle?: string;
  eyebrow?: string;
  summary?: CombatResolutionSummaryStat[];
  objectiveLine?: string | null;
  continueLabel: string;
  onDismiss: () => void;
}

function padStat(value: string, width = 2): string {
  if (/^\d+$/.test(value) && value.length < width) {
    return value.padStart(width, '0');
  }
  return value;
}

export default function CombatResolutionBanner({
  outcome,
  heading,
  subtitle = outcome === 'VICTORY'
    ? 'All hostile signatures extinguished.'
    : 'Soul anchor severed. Veil sync lost.',
  eyebrow = outcome === 'VICTORY' ? 'COMBAT RECORD // CLOSED' : 'COMBAT RECORD // FAILED',
  summary = [],
  objectiveLine = null,
  continueLabel,
  onDismiss,
}: CombatResolutionBannerProps): React.JSX.Element {
  const isVictory = outcome === 'VICTORY';
  const [ctaEnabled, setCtaEnabled] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dismissedRef = useRef(false);
  const ctaReadyAtRef = useRef(0);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelScaleX = useRef(new Animated.Value(0.12)).current;
  const headingOpacity = useRef(new Animated.Value(0)).current;
  const headingShift = useRef(new Animated.Value(6)).current;
  const glitchOpacity = useRef(new Animated.Value(0)).current;
  const summaryOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const occultPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => {
        if (mounted) setReduceMotion(media.matches);
      };
      apply();
      media.addEventListener?.('change', apply);
      return () => {
        mounted = false;
        media.removeEventListener?.('change', apply);
      };
    }
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    dismissedRef.current = false;
    setCtaEnabled(false);
    ctaReadyAtRef.current = 0;

    backdropOpacity.setValue(0);
    panelOpacity.setValue(0);
    panelScaleX.setValue(reduceMotion ? 1 : 0.12);
    headingOpacity.setValue(0);
    headingShift.setValue(reduceMotion ? 0 : 6);
    glitchOpacity.setValue(0);
    summaryOpacity.setValue(0);
    ctaOpacity.setValue(0);
    occultPulse.setValue(0);

    const enableCta = () => {
      ctaReadyAtRef.current = Date.now() + CTA_GUARD_MS;
      setCtaEnabled(true);
    };

    if (reduceMotion) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(panelOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(headingOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(summaryOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(ctaOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) enableCta();
      });
      return undefined;
    }

    const sequence = Animated.sequence([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(panelOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(panelScaleX, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(occultPulse, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(headingOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(headingShift, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(glitchOpacity, { toValue: 0.55, duration: 40, useNativeDriver: true }),
          Animated.timing(glitchOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(summaryOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(Math.max(0, CTA_REVEAL_MS - 420)),
      Animated.timing(ctaOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) enableCta();
    });

    return () => {
      sequence.stop();
    };
  }, [
    backdropOpacity,
    ctaOpacity,
    glitchOpacity,
    headingOpacity,
    headingShift,
    occultPulse,
    panelOpacity,
    panelScaleX,
    reduceMotion,
    summaryOpacity,
    heading,
    outcome,
  ]);

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current || !ctaEnabled) return;
    if (Date.now() < ctaReadyAtRef.current) return;
    dismissedRef.current = true;
    pulseHubButton();
    onDismiss();
  }, [ctaEnabled, onDismiss]);

  useEffect(() => {
    if (!ctaEnabled || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ctaEnabled, handleDismiss]);

  const visibleSummary = useMemo(
    () => summary.filter((stat) => Boolean(stat.value) && Boolean(stat.label)).slice(0, 3),
    [summary],
  );

  return (
    <View style={styles.wrap} pointerEvents="auto" accessibilityViewIsModal>
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      />

      <Animated.View
        style={[
          styles.panelShell,
          {
            opacity: panelOpacity,
            transform: [{ scaleX: panelScaleX }],
          },
        ]}
      >
        <View style={styles.panel}>
          <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
          <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
          <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
          <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />
          <View style={styles.innerEdge} pointerEvents="none" />
          <View style={styles.scanlines} pointerEvents="none" />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.occultGlyph,
              {
                opacity: occultPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.14],
                }),
              },
            ]}
          />

          <Text style={styles.eyebrow}>{eyebrow}</Text>

          <View style={styles.headingBlock}>
            <Animated.Text
              style={[
                styles.heading,
                isVictory ? styles.headingVictory : styles.headingDefeat,
                {
                  opacity: headingOpacity,
                  transform: [{ translateY: headingShift }],
                },
              ]}
            >
              {heading}
            </Animated.Text>
            <Animated.Text
              pointerEvents="none"
              style={[
                styles.headingGlitch,
                {
                  opacity: glitchOpacity,
                },
              ]}
            >
              {heading}
            </Animated.Text>
          </View>

          <Animated.Text style={[styles.subtitle, { opacity: headingOpacity }]}>
            {subtitle}
          </Animated.Text>

          <Animated.View style={[styles.occultDivider, { opacity: summaryOpacity }]} />

          {visibleSummary.length > 0 ? (
            <Animated.View style={[styles.summaryRow, { opacity: summaryOpacity }]}>
              {visibleSummary.map((stat, index) => (
                <React.Fragment key={`${stat.label}-${index}`}>
                  {index > 0 ? <View style={styles.summarySep} /> : null}
                  <View style={styles.summaryCell}>
                    <Text
                      style={[
                        styles.summaryValue,
                        stat.accent ? styles.summaryValueAccent : null,
                      ]}
                    >
                      {padStat(stat.value)}
                    </Text>
                    <Text style={styles.summaryLabel}>{stat.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </Animated.View>
          ) : null}

          {objectiveLine ? (
            <Animated.Text style={[styles.objectiveLine, { opacity: summaryOpacity }]}>
              {objectiveLine}
            </Animated.Text>
          ) : null}

          <Animated.View style={[styles.ctaWrap, { opacity: ctaOpacity }]}>
            <HubPrimaryCta
              label={continueLabel}
              onPress={ctaEnabled ? handleDismiss : undefined}
              disabled={!ctaEnabled}
              variant="classic"
              accessibilityLabel={continueLabel}
              minHeight={50}
              style={styles.cta}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKDROP,
  },
  panelShell: {
    width: '92%',
    maxWidth: 540,
  },
  panel: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 30,
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    borderColor: PANEL_BORDER,
  },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: 'rgba(98, 230, 165, 0.72)',
  },
  cornerTL: { top: 6, left: 6, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: 6, right: 6, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: 6, left: 6, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: 6, right: 6, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  innerEdge: {
    ...StyleSheet.absoluteFill,
    margin: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(227, 236, 232, 0.06)',
  },
  scanlines: {
    ...StyleSheet.absoluteFill,
    opacity: 0.5,
    backgroundColor: OTT.scanline,
  },
  occultGlyph: {
    position: 'absolute',
    top: '28%',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: OCCULT,
    backgroundColor: 'rgba(196, 90, 174, 0.08)',
  },
  eyebrow: {
    fontFamily: OTT.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: 'rgba(98, 230, 165, 0.62)',
    textAlign: 'center',
    marginBottom: 14,
  },
  headingBlock: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontFamily: OTT.mono,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  headingVictory: {
    color: TEXT_PRIMARY,
  },
  headingDefeat: {
    color: OTT.soulRed,
  },
  headingGlitch: {
    ...StyleSheet.absoluteFill,
    fontFamily: OTT.mono,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
    color: OCCULT,
    transform: [{ translateX: 2 }, { translateY: -1 }],
  },
  subtitle: {
    fontFamily: OTT.mono,
    fontSize: 14,
    letterSpacing: 0.4,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  occultDivider: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(196, 90, 174, 0.45)',
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  summarySep: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: 'rgba(130, 145, 140, 0.45)',
  },
  summaryValue: {
    fontFamily: OTT.mono,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1,
    color: TEXT_PRIMARY,
  },
  summaryValueAccent: {
    color: MINT,
  },
  summaryLabel: {
    fontFamily: OTT.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  objectiveLine: {
    fontFamily: OTT.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: 'rgba(196, 90, 174, 0.85)',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  ctaWrap: {
    marginTop: 18,
    alignItems: 'center',
    width: '100%',
  },
  cta: {
    width: 260,
    maxWidth: '100%',
    alignSelf: 'center',
  },
});
