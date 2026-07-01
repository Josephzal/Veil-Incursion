import React, { useCallback, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { NarrativeOutcomeSummary } from '../../data/narrative/narrativeOutcomeSummary';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';
import { hubCtaButtonStyle, resolveHubCtaFill } from '../../constants/hubCta';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import TacticalButton from '../TacticalButton';

const SLATE_BORDER = '#475569';
const PANEL_BORDER = '#334155';
const MUTED_WHITE = '#F8FAFC';
const BODY_MUTED = '#94A3B8';
const TERMINAL_GREEN = '#00ff33';
const FAILURE_RED = '#EF4444';
const REWARD_GREEN = '#86EFAC';
const PENALTY_ORANGE = '#FB923C';
const AMBUSH_PINK = '#F472B6';
const BONUS_BLUE = '#7DD3FC';

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

interface NarrativeOutcomePanelProps {
  summary: NarrativeOutcomeSummary;
  bonusLine?: string | null;
  onContinue: () => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
  cityStreets?: boolean;
}

/** Terran Grid expedition resolve report — matches Instability Protocol panel styling. */
export default function NarrativeOutcomePanel({
  summary,
  bonusLine,
  onContinue,
  mutedColor = BODY_MUTED,
  primaryColor = MUTED_WHITE,
}: NarrativeOutcomePanelProps): React.JSX.Element {
  const { fontScale, scaleSize, scaleSpacing } = useResponsiveLayout();
  const isSuccess = summary.status === 'SUCCESS';
  const statusAccent = isSuccess ? TERMINAL_GREEN : FAILURE_RED;

  const scales = useMemo(
    () => ({
      header: 9 * fontScale,
      headerLine: 12 * fontScale,
      headline: 13 * fontScale,
      headlineLine: 18 * fontScale,
      section: 8 * fontScale,
      sectionLine: 11 * fontScale,
      body: 10 * fontScale,
      bodyLine: 15 * fontScale,
      detail: 9 * fontScale,
      detailLine: 14 * fontScale,
      panelPad: scaleSpacing(32),
      panelPadBottom: scaleSpacing(40),
      sectionGap: scaleSpacing(16),
    }),
    [fontScale, scaleSpacing],
  );

  const continueButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(TERMINAL_GREEN, scaleSize, scaleSpacing, false),
      FLAT_CTA_OVERRIDE,
      {
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        borderColor: TERMINAL_GREEN,
        borderWidth: 2,
        backgroundColor: resolveHubCtaFill(TERMINAL_GREEN),
        opacity: 1,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [scaleSize, scaleSpacing],
  );

  return (
    <View
      style={[
        styles.panel,
        {
          paddingTop: scales.panelPad,
          paddingHorizontal: scales.panelPad,
          paddingBottom: scales.panelPadBottom,
        },
      ]}
    >
      <Text
        style={[
          styles.docHeader,
          { fontSize: scales.header, lineHeight: scales.headerLine },
        ]}
      >
        EXPEDITION LOG // RESOLVE REPORT
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { gap: scales.sectionGap, paddingTop: scaleSpacing(12) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={[
            styles.headline,
            {
              color: statusAccent,
              fontSize: scales.headline,
              lineHeight: scales.headlineLine,
            },
          ]}
        >
          {summary.headline}
        </Text>

        <View style={styles.section}>
          <Text
            style={[
              styles.sectionLabel,
              { color: mutedColor, fontSize: scales.section, lineHeight: scales.sectionLine },
            ]}
          >
            OUTCOME
          </Text>
          {summary.outcomeLines.map((line) => (
            <Text
              key={line}
              style={[
                styles.bodyLine,
                {
                  color: primaryColor,
                  fontSize: scales.body,
                  lineHeight: scales.bodyLine,
                },
              ]}
            >
              {line}
            </Text>
          ))}
        </View>

        {summary.rewardLines.length > 0 ? (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionLabel,
                { color: mutedColor, fontSize: scales.section, lineHeight: scales.sectionLine },
              ]}
            >
              REWARDS
            </Text>
            {summary.rewardLines.map((line) => (
              <Text
                key={line}
                style={[
                  styles.detailLine,
                  {
                    color: REWARD_GREEN,
                    fontSize: scales.detail,
                    lineHeight: scales.detailLine,
                  },
                ]}
              >
                {line}
              </Text>
            ))}
            {bonusLine ? (
              <Text
                style={[
                  styles.detailLine,
                  {
                    color: BONUS_BLUE,
                    fontSize: scales.detail,
                    lineHeight: scales.detailLine,
                  },
                ]}
              >
                {bonusLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        {summary.penaltyLines.length > 0 ? (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionLabel,
                { color: mutedColor, fontSize: scales.section, lineHeight: scales.sectionLine },
              ]}
            >
              CONSEQUENCES
            </Text>
            {summary.penaltyLines.map((line) => (
              <Text
                key={line}
                style={[
                  styles.detailLine,
                  {
                    color: PENALTY_ORANGE,
                    fontSize: scales.detail,
                    lineHeight: scales.detailLine,
                  },
                ]}
              >
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        {summary.ambushPending ? (
          <Text
            style={[
              styles.ambushLine,
              {
                color: AMBUSH_PINK,
                fontSize: scales.detail,
                lineHeight: scales.detailLine,
              },
            ]}
          >
            {'>> HOSTILE SIGNATURES DETECTED — COMBAT IMMINENT'}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { marginTop: scaleSpacing(24) }]}>
        <TacticalButton
          label={summary.continueLabel.replace(/^\[|\]$/g, '').trim() || 'CONTINUE'}
          active
          onPress={onContinue}
          accentColor={TERMINAL_GREEN}
          mutedColor={BODY_MUTED}
          variant="cta"
          style={continueButtonStyle}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 2,
    borderColor: PANEL_BORDER,
    justifyContent: 'flex-start',
  },
  docHeader: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: BODY_MUTED,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 0,
    justifyContent: 'flex-start',
  },
  headline: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 1,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    fontWeight: '700',
  },
  bodyLine: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
  detailLine: {
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
  ambushLine: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  footer: {
    width: '100%',
    flexShrink: 0,
  },
});
