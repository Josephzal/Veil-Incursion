import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { textGlow } from '../../utils/adaptiveStyles';
import type { StatusFloatTone } from '../../utils/combatTelemetryFormat';

const MONO = 'monospace';

const TONE_COLORS: Record<StatusFloatTone, string> = {
  fortify: '#7c8fa8',
  evade: '#9ca3af',
  charge: '#a8917c',
  neutral: '#8b949e',
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
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    if (triggerSeq <= 0 || triggerSeq === lastSeqRef.current || !label) return;
    lastSeqRef.current = triggerSeq;
    setVisible(true);
    opacity.setValue(0);
    translateY.setValue(10);
    scale.setValue(0.88);

    const riseMs = Math.floor(durationMs * 0.55);
    const fadeMs = Math.floor(durationMs * 0.45);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: Math.min(120, riseMs),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: -26,
        duration: riseMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: riseMs,
        easing: Easing.out(Easing.back(1.15)),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: fadeMs,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(() => setVisible(false));
    });
  }, [durationMs, label, opacity, scale, translateY, triggerSeq]);

  if (!visible || !label) return null;

  const color = TONE_COLORS[tone];

  return (
    <Animated.Text
      style={[
        styles.label,
        {
          color,
          opacity,
          transform: [{ translateY }, { scale }],
          ...textGlow({ color, radius: 6, offset: { width: 0, height: 0 } }),
          pointerEvents: 'none',
        },
      ]}
    >
      {label.toUpperCase()}
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
});
