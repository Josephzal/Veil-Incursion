import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { clampRatio } from '../../utils/combatTelemetryFormat';

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
}

export function CombatHorizontalGauge({
  fillColor,
  ratio,
  trackBorderColor = 'rgba(139, 92, 246, 0.45)',
  valueCaption,
  valueCaptionColor = '#FF453A',
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

  return (
    <View style={styles.gaugeColumn}>
      {valueCaption ? (
        <Text style={[styles.valueCaption, { color: valueCaptionColor }]} numberOfLines={1}>
          {valueCaption}
        </Text>
      ) : null}
      <View style={[styles.trackOuter, { borderColor: trackBorderColor }]}>
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
}

export default function CombatTelemetryGaugeRow({
  label,
  labelColor,
  fillColor,
  ratio,
  trackBorderColor,
}: CombatTelemetryGaugeRowProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
      <CombatHorizontalGauge fillColor={fillColor} ratio={ratio} trackBorderColor={trackBorderColor} />
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
  valueCaption: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 11,
    textAlign: 'right',
    width: '100%',
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
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
});
