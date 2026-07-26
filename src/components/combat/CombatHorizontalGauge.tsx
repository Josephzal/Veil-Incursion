import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { clampRatio } from '../../utils/combatTelemetryFormat';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

import { COMBAT_GAUGE_TRACK_HEIGHT_COMPACT } from './combatGaugeMetrics';

const MONO = 'monospace';
const GAUGE_WIDTH = 112;
const TRACK_HEIGHT = 8;
const FILL_ANIM_MS = 420;

interface CombatHorizontalGaugeProps {
  fillColor: string;
  ratio: number;
  trackBorderColor?: string;
  valueCaption?: string;
  valueCaptionColor?: string;
  width?: number | '100%';
  compact?: boolean;
  trackHeight?: number;
  /** Enemy overhead — fill track only, no border box. */
  borderless?: boolean;
  /** Taller high-contrast bar for enemy overhead HUD. */
  overhead?: boolean;
}

export function CombatHorizontalGauge({
  fillColor,
  ratio,
  trackBorderColor = 'rgba(139, 92, 246, 0.45)',
  valueCaption,
  valueCaptionColor = '#FF453A',
  width,
  compact = false,
  trackHeight,
  borderless = false,
  overhead = false,
}: CombatHorizontalGaugeProps): React.JSX.Element {
  const displayRatio = useRef(new Animated.Value(clampRatio(ratio))).current;

  useEffect(() => {
    Animated.timing(displayRatio, {
      toValue: clampRatio(ratio),
      duration: FILL_ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [displayRatio, ratio]);

  const fillWidth = displayRatio.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const gaugeStyle = width === '100%' && compact
    ? [styles.gaugeFlex, styles.gaugeFullWidth]
    : width != null
      ? [styles.gaugeColumn, typeof width === 'number' ? { width } : styles.gaugeFullWidth]
      : compact
        ? [styles.gaugeFlex]
        : styles.gaugeColumn;

  return (
    <View style={gaugeStyle}>
      {valueCaption ? (
        <Text style={[styles.valueCaption, { color: valueCaptionColor }]} numberOfLines={1}>
          {valueCaption}
        </Text>
      ) : null}
      <View style={[
        styles.trackOuter,
        overhead ? styles.trackOuterOverhead : null,
        !overhead && compact ? styles.trackOuterCompact : null,
        trackHeight != null ? { height: trackHeight } : null,
        borderless ? styles.trackOuterBorderless : { borderColor: trackBorderColor },
      ]}>
        <Animated.View style={[styles.trackFill, { width: fillWidth, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

interface CombatTelemetryGaugeRowProps {
  label: string;
  labelColor: string;
  fillColor: string;
  ratio: number;
  trackBorderColor?: string;
  variant?: 'inline' | 'stacked' | 'compact';
  gaugeWidth?: number | '100%';
  labelFontScale?: number;
  trackHeight?: number;
}

export default function CombatTelemetryGaugeRow({
  label,
  labelColor,
  fillColor,
  ratio,
  trackBorderColor,
  variant = 'inline',
  gaugeWidth,
  labelFontScale = 1,
  trackHeight,
}: CombatTelemetryGaugeRowProps): React.JSX.Element {
  const isCompact = variant === 'compact';
  const isStacked = variant === 'stacked';

  return (
    <View style={[
      styles.row,
      isStacked ? styles.rowStacked : null,
      isCompact ? styles.rowCompact : null,
    ]}>
      <Text style={[
        styles.rowLabel,
        isStacked ? styles.rowLabelStacked : null,
        isCompact ? styles.rowLabelCompact : null,
        labelFontScale !== 1 ? {
          fontSize: (isCompact ? COMBAT_HUD_TYPE.caption : COMBAT_HUD_TYPE.body) * labelFontScale,
          lineHeight: (isCompact ? COMBAT_HUD_TYPE.lineCaption : COMBAT_HUD_TYPE.lineBody) * labelFontScale,
        } : null,
        { color: labelColor },
      ]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      <CombatHorizontalGauge
        fillColor={fillColor}
        ratio={ratio}
        trackBorderColor={trackBorderColor}
        width={isCompact ? '100%' : gaugeWidth}
        compact={isCompact}
        trackHeight={trackHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 3,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    letterSpacing: 0.5,
    lineHeight: COMBAT_HUD_TYPE.lineBody,
  },
  gaugeColumn: {
    width: GAUGE_WIDTH,
    flexShrink: 0,
    alignItems: 'stretch',
    gap: 2,
  },
  gaugeFullWidth: {
    width: '100%',
    flexShrink: 1,
  },
  gaugeFlex: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    alignItems: 'stretch',
    gap: 2,
  },
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 3,
  },
  rowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 1,
  },
  rowLabelStacked: {
    flex: 0,
    width: '100%',
  },
  rowLabelCompact: {
    width: 88,
    flexShrink: 0,
    flex: 0,
    fontSize: COMBAT_HUD_TYPE.caption,
    lineHeight: COMBAT_HUD_TYPE.lineCaption,
  },
  valueCaption: {
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 11,
    textAlign: 'right',
    width: '100%',
  },
  trackOuterCompact: {
    height: COMBAT_GAUGE_TRACK_HEIGHT_COMPACT,
  },
  trackOuter: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderWidth: 1,
    borderRadius: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
  },
  trackOuterOverhead: {
    height: 7,
  },
  trackOuterBorderless: {
    borderWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
});
