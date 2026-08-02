import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { textGlow } from '../../utils/adaptiveStyles';

interface CombatCenterStatusFloatProps {
  triggerSeq?: number;
  label?: string;
  color?: string;
  durationMs?: number;
}

/** Arena-center fading status line (e.g. full hostile phase skip). */
export default function CombatCenterStatusFloat({
  triggerSeq = 0,
  label = '',
  color = '#9ca3af',
  durationMs = 1200,
}: CombatCenterStatusFloatProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    if (triggerSeq <= 0 || triggerSeq === lastSeqRef.current || !label) return;
    lastSeqRef.current = triggerSeq;
    setVisible(true);
    opacity.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(0);
    scale.setValue(0.92);

    const fadeInMs = 90;
    const fadeOutMs = Math.max(180, Math.floor(durationMs * 0.35));
    const holdMs = Math.max(0, durationMs - fadeInMs - fadeOutMs);

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
        toValue: -56,
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

  return (
    <Animated.Text
      style={[
        styles.label,
        {
          color,
          opacity,
          transform: [{ translateY }, { scale }],
          ...textGlow({ color, radius: 8, offset: { width: 0, height: 0 } }),
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
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
});
