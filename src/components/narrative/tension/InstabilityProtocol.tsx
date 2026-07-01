import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { readPressableHover, terminalHoverStyle } from '../../../utils/terminalHoverStyle';
import TacticalButton from '../../TacticalButton';
import { hubCtaButtonStyle, resolveHubCtaFill } from '../../../constants/hubCta';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import type { TensionMechanicProps, TensionMechanicSuccessResult } from './tensionMechanicTypes';

const SLATE_BORDER = '#475569';
const MUTED_WHITE = '#F8FAFC';
const BODY_MUTED = '#94A3B8';
const SIPHON_LABEL = '#FFFFFF';
const LOCKED_LABEL = '#94A3B8';
const TERMINAL_GREEN = '#00ff33';
const RESIDUE_VALUE = '#FFFFFF';
const COLLAPSE_RED = '#EF4444';
const GAUGE_SAFE = '#64748B';
const GAUGE_WARN = '#E11D48';
const GAUGE_CRITICAL = '#EF4444';

const FLAT_CTA_OVERRIDE: ViewStyle = Platform.select({
  web: { boxShadow: 'none' },
  default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
}) ?? { shadowOpacity: 0, shadowRadius: 0, elevation: 0 };

const BASE_LOOT_CREDITS = 10;
const EXTRACT_MIN_INSTABILITY = 41;
const FIRST_RANSACK_MIN = 25;
const FIRST_RANSACK_MAX = 35;

function randomStandardInstabilityGain(): number {
  return 15 + Math.floor(Math.random() * 21);
}

function randomFirstRansackGain(): number {
  return FIRST_RANSACK_MIN + Math.floor(Math.random() * (FIRST_RANSACK_MAX - FIRST_RANSACK_MIN + 1));
}

function rewardMultiplierForInstability(instability: number): number {
  if (instability <= 40) return 1;
  if (instability <= 75) return 2;
  return 4;
}

function gaugeFillColor(percent: number): string {
  if (percent > 80) return GAUGE_CRITICAL;
  if (percent >= EXTRACT_MIN_INSTABILITY) return GAUGE_WARN;
  return GAUGE_SAFE;
}

function tierLabel(instability: number): string {
  if (instability <= 40) return 'RESONANCE MULTIPLIER x1';
  if (instability <= 75) return 'RESONANCE MULTIPLIER x2';
  return 'RESONANCE MULTIPLIER x4';
}

function residueSubtext(
  canExtract: boolean,
  totalCredits: number,
  instability: number,
): string {
  if (!canExtract) {
    if (totalCredits === 0) {
      return 'Siphon the anomaly to build residue — extraction locked until medium instability.';
    }
    return `Extraction locked — draw deeper to ${EXTRACT_MIN_INSTABILITY}% instability (${instability}% now).`;
  }
  return 'Extraction route open — seal the rift before the gauge maxes.';
}

/** Terran Grid Siphon Matrix — brutalist instability extraction mini-game. */
export default function InstabilityProtocol({
  onSuccess,
  onFailure,
  defaultPenalty,
}: TensionMechanicProps): React.JSX.Element {
  const { isDesktop, fontScale, scaleSize, scaleSpacing } = useResponsiveLayout();

  const [instability, setInstability] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [ransackCount, setRansackCount] = useState(0);
  const [lastGain, setLastGain] = useState<number | null>(null);
  const [lastCreditGain, setLastCreditGain] = useState<number | null>(null);
  const [resolvedRefState, setResolvedRefState] = useState(false);
  const resolvedRef = useRef(false);

  const canExtract = totalCredits > 0
    && instability >= EXTRACT_MIN_INSTABILITY
    && !resolvedRef.current;
  const extractLocked = !canExtract || resolvedRefState;
  const gaugeHeight = isDesktop ? 32 : 24;
  const scaledGaugeHeight = scaleSize(gaugeHeight);

  const resolveSuccess = useCallback((payload: TensionMechanicSuccessResult) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolvedRefState(true);
    onSuccess(payload);
  }, [onSuccess]);

  const resolveFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolvedRefState(true);
    onFailure();
  }, [onFailure]);

  const handleSiphon = () => {
    if (resolvedRef.current) return;

    const gain = ransackCount === 0 ? randomFirstRansackGain() : randomStandardInstabilityGain();
    const multiplier = rewardMultiplierForInstability(instability);
    const creditGain = BASE_LOOT_CREDITS * multiplier;

    setLastGain(gain);
    setLastCreditGain(creditGain);
    setRansackCount((prev) => prev + 1);
    setTotalCredits((prev) => prev + creditGain);

    const nextInstability = instability + gain;
    if (nextInstability >= 100) {
      setInstability(100);
      resolveFailure();
      return;
    }

    setInstability(nextInstability);
  };

  const handleExtract = () => {
    if (resolvedRef.current || !canExtract) return;
    resolveSuccess({ bonusCredits: totalCredits });
  };

  const penaltyHint = defaultPenalty
    ? defaultPenalty.type === 'HP'
      ? `COLLAPSE COST: -${defaultPenalty.amount} HP`
      : `COLLAPSE COST: +${defaultPenalty.amount} RESONANCE`
    : null;

  const scales = useMemo(
    () => ({
      header: 9 * fontScale,
      headerLine: 12 * fontScale,
      body: 10 * fontScale,
      bodyLine: 15 * fontScale,
      gaugeLabel: 9 * fontScale,
      gaugePct: 11 * fontScale,
      gaugePctLine: scaledGaugeHeight,
      tier: 8 * fontScale,
      feedback: 8 * fontScale,
      feedbackLine: 12 * fontScale,
      residueLabel: 8 * fontScale,
      residueValue: 32 * fontScale,
      residueHint: 9 * fontScale,
      residueHintLine: 13 * fontScale,
      penalty: 10 * fontScale,
      panelPad: scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING),
      panelPadBottom: scaleSpacing(40),
      actionGap: scaleSpacing(16),
    }),
    [fontScale, scaleSpacing, scaledGaugeHeight],
  );

  const fillColor = gaugeFillColor(instability);
  const feedbackLine = lastGain != null
    ? `Last siphon: +${lastGain}% instability${lastCreditGain != null ? ` // +${lastCreditGain} residue` : ''}`
    : ' ';

  const siphonButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(SLATE_BORDER, scaleSize, scaleSpacing, resolvedRefState),
      FLAT_CTA_OVERRIDE,
      {
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        borderColor: SLATE_BORDER,
        borderWidth: 2,
        backgroundColor: resolveHubCtaFill(SLATE_BORDER),
        opacity: resolvedRefState ? 0.4 : 1,
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [resolvedRefState, scaleSize, scaleSpacing],
  );

  const extractButtonStyle = useCallback(
    (state: { pressed: boolean; hovered?: boolean }) => [
      hubCtaButtonStyle(canExtract ? TERMINAL_GREEN : SLATE_BORDER, scaleSize, scaleSpacing, extractLocked),
      FLAT_CTA_OVERRIDE,
      {
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        borderWidth: 2,
        ...(canExtract && !resolvedRefState
          ? {
              borderColor: TERMINAL_GREEN,
              backgroundColor: resolveHubCtaFill(TERMINAL_GREEN),
              opacity: 1,
            }
          : {
              borderColor: 'rgba(71, 85, 105, 0.3)',
              backgroundColor: 'rgba(71, 85, 105, 0.09)',
              opacity: 1,
            }),
      },
      terminalHoverStyle(readPressableHover(state), state.pressed),
    ],
    [canExtract, extractLocked, resolvedRefState, scaleSize, scaleSpacing],
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
          styles.header,
          { fontSize: scales.header, lineHeight: scales.headerLine },
        ]}
      >
        SIPHON MATRIX // INSTABILITY PROTOCOL
      </Text>

      <Text
        style={[
          styles.instructions,
          {
            fontSize: scales.body,
            lineHeight: scales.bodyLine,
            marginBottom: 24,
          },
        ]}
      >
        Draw deeper from the rift to escalate raw occult extraction. Extraction route opens only after instability crosses the medium threshold ({EXTRACT_MIN_INSTABILITY}%+).
      </Text>

      <Text
        style={[
          styles.gaugeLabel,
          { fontSize: scales.gaugeLabel, lineHeight: scales.gaugeLabel + 3 },
        ]}
      >
        INSTABILITY GAUGE
      </Text>

      <View
        style={[
          styles.gaugeTrack,
          {
            height: scaledGaugeHeight,
            marginTop: scaleSpacing(8),
          },
        ]}
      >
        <View
          style={[
            styles.gaugeFill,
            {
              width: `${instability}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
        <Text
          style={[
            styles.gaugePct,
            {
              fontSize: scales.gaugePct,
              lineHeight: scales.gaugePctLine,
              height: scaledGaugeHeight,
            },
          ]}
        >
          {instability}%
        </Text>
      </View>

      <Text
        style={[
          styles.tier,
          {
            fontSize: scales.tier,
            lineHeight: scales.tier + 4,
            marginTop: scaleSpacing(8),
          },
        ]}
      >
        {tierLabel(instability)}
      </Text>

      <View
        style={[
          styles.feedbackSlot,
          {
            minHeight: scales.feedbackLine,
            marginTop: scaleSpacing(6),
          },
        ]}
      >
        <Text
          style={[
            styles.feedback,
            {
              fontSize: scales.feedback,
              lineHeight: scales.feedbackLine,
            },
          ]}
        >
          {feedbackLine}
        </Text>
      </View>

      <View
        style={[
          styles.residueBox,
          {
            padding: scaleSpacing(24),
            marginTop: scaleSpacing(32),
          },
        ]}
      >
        <Text
          style={[
            styles.residueLabel,
            { fontSize: scales.residueLabel, lineHeight: scales.residueLabel + 4 },
          ]}
        >
          VEIL RESIDUE SECURED
        </Text>
        <Text
          style={[
            styles.residueValue,
            {
              fontSize: scales.residueValue,
              lineHeight: scales.residueValue + 4,
              marginTop: scaleSpacing(8),
            },
          ]}
        >
          {totalCredits}
        </Text>
        <Text
          style={[
            styles.residueHint,
            {
              fontSize: scales.residueHint,
              lineHeight: scales.residueHintLine,
              minHeight: scales.residueHintLine * 2,
              marginTop: scaleSpacing(8),
            },
          ]}
          numberOfLines={2}
        >
          {residueSubtext(canExtract, totalCredits, instability)}
        </Text>
      </View>

      <View style={[styles.actionCol, { gap: scales.actionGap, marginTop: scaleSpacing(24) }]}>
        <TacticalButton
          label="SIPHON ANOMALY"
          active
          disabled={resolvedRefState}
          onPress={handleSiphon}
          accentColor={SIPHON_LABEL}
          mutedColor={BODY_MUTED}
          variant="cta"
          style={siphonButtonStyle}
        />

        <TacticalButton
          label="SEAL RIFT"
          active={canExtract}
          disabled={extractLocked}
          onPress={handleExtract}
          accentColor={canExtract && !resolvedRefState ? TERMINAL_GREEN : LOCKED_LABEL}
          mutedColor={BODY_MUTED}
          variant="cta"
          style={extractButtonStyle}
        />
      </View>

      <View style={[styles.penaltySlot, { minHeight: scales.penalty + 4, marginTop: scaleSpacing(16) }]}>
        {penaltyHint ? (
          <Text
            style={[
              styles.penalty,
              {
                fontSize: scales.penalty,
                lineHeight: scales.penalty + 4,
              },
            ]}
          >
            {penaltyHint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: NARRATIVE_UNIFIED_PANEL_BG,
    borderWidth: 1,
    borderColor: NARRATIVE_UNIFIED_PANEL_BORDER,
    justifyContent: 'flex-start',
  },
  header: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    color: BODY_MUTED,
    fontWeight: '700',
  },
  instructions: {
    fontFamily: 'monospace',
    color: MUTED_WHITE,
    letterSpacing: 0.4,
    marginTop: 12,
  },
  gaugeLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    color: BODY_MUTED,
    fontWeight: '700',
  },
  gaugeTrack: {
    borderWidth: 2,
    borderColor: SLATE_BORDER,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  gaugeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  gaugePct: {
    position: 'absolute',
    right: 12,
    top: 0,
    fontFamily: 'monospace',
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
    includeFontPadding: false,
  },
  tier: {
    fontFamily: 'monospace',
    letterSpacing: 0.6,
    color: BODY_MUTED,
  },
  feedbackSlot: {
    justifyContent: 'center',
  },
  feedback: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
    color: BODY_MUTED,
  },
  residueBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: SLATE_BORDER,
    alignItems: 'center',
  },
  residueLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    color: BODY_MUTED,
    textAlign: 'center',
  },
  residueValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    color: RESIDUE_VALUE,
    textAlign: 'center',
  },
  residueHint: {
    fontFamily: 'monospace',
    color: BODY_MUTED,
    textAlign: 'center',
  },
  actionCol: {
    width: '100%',
  },
  penaltySlot: {
    justifyContent: 'center',
  },
  penalty: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    color: COLLAPSE_RED,
    textAlign: 'center',
    fontWeight: '800',
  },
});
