import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

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
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -18,
        duration: riseMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: riseMs,
        easing: Easing.out(Easing.back(1.12)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: fadeMs,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setVisible(false));
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
          textShadowColor: color,
        },
      ]}
      pointerEvents="none"
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
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
