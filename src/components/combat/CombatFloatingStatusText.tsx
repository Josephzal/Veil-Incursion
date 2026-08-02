import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { textGlow } from '../../utils/adaptiveStyles';
import type { StatusFloatTone } from '../../utils/combatTelemetryFormat';
import { isWardenStrikePresentationActive } from '../../data/wardenStrikePresentation';

const MONO = 'monospace';

const TONE_COLORS: Record<StatusFloatTone, string> = {
  fortify: '#7c8fa8',
  evade: '#9ca3af',
  charge: '#a8917c',
  neutral: '#8b949e',
  armor: '#c8d0dc',
  ward: '#a78bfa',
};

interface CombatFloatingStatusTextProps {
  triggerSeq?: number;
  label?: string;
  tone?: StatusFloatTone;
  durationMs?: number;
}

/** Reusable typography floater for buffs and future status procs. */
export default function CombatFloatingStatusText({
  triggerSeq = 0,
  label = '',
  tone = 'neutral',
  durationMs = 1000,
}: CombatFloatingStatusTextProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    if (triggerSeq <= 0 || triggerSeq === lastSeqRef.current || !label) return;
    lastSeqRef.current = triggerSeq;
    setVisible(true);

    const warden = isWardenStrikePresentationActive();
    const isNumericDamage = /^\d+$/.test(label);
    const endY = isNumericDamage
      ? (warden ? -52 : -56)
      : (warden ? -60 : -56);
    const fadeInMs = 90;
    const fadeOutMs = Math.max(180, Math.floor(durationMs * 0.35));
    const holdMs = Math.max(0, durationMs - fadeInMs - fadeOutMs);

    opacity.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(0);
    scale.setValue(0.92);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeInMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(holdMs),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOutMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(translateY, {
        toValue: endY,
        duration: durationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [durationMs, label, opacity, scale, translateY, triggerSeq]);

  if (!visible || !label) return null;

  const color = TONE_COLORS[tone];
  const isNumericDamage = /^\d+$/.test(label);

  return (
    <Animated.Text
      style={[
        styles.label,
        isNumericDamage ? styles.damageLabel : null,
        {
          color: isNumericDamage ? '#f1f5f9' : color,
          opacity,
          transform: [{ translateY }, { scale }],
          ...textGlow({ color: isNumericDamage ? '#f1f5f9' : color, radius: 6, offset: { width: 0, height: 0 } }),
          pointerEvents: 'none',
        },
      ]}
    >
      {isNumericDamage ? label : label.toUpperCase()}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center'
  },
  damageLabel: {
    fontSize: 15,
    letterSpacing: 0.8,
    fontWeight: '900',
  },
});
