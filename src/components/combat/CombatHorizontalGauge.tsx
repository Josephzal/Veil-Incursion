import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { clampRatio } from '../../utils/combatTelemetryFormat';

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

  const gaugeStyle = width != null
    ? [styles.gaugeColumn, typeof width === 'number' ? { width } : styles.gaugeFullWidth]
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
}

export default function CombatTelemetryGaugeRow({
  label,
  labelColor,
  fillColor,
  ratio,
  trackBorderColor,
  variant = 'inline',
  gaugeWidth,
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
        { color: labelColor },
      ]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      <CombatHorizontalGauge
        fillColor={fillColor}
        ratio={ratio}
        trackBorderColor={trackBorderColor}
        width={gaugeWidth}
        compact={isCompact}
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
    fontSize: 8,
    letterSpacing: 0.5,
    lineHeight: 11,
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
    width: 72,
    flexShrink: 0,
    flex: 0,
    fontSize: 7,
    lineHeight: 9,
  },
  valueCaption: {
    fontFamily: MONO,
    fontSize: 9,
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
