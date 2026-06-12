import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

const MONO = 'monospace';
const EVADE_COLOR = '#9ca3af';

interface CombatEnemyEvadeLabelProps {
  evadeImpactSeq?: number;
}

/** Compact EVADED floater anchored just above the enemy hitbox. */
export default function CombatEnemyEvadeLabel({
  evadeImpactSeq = 0,
}: CombatEnemyEvadeLabelProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    if (evadeImpactSeq <= 0 || evadeImpactSeq === lastSeqRef.current) return;
    lastSeqRef.current = evadeImpactSeq;
    setVisible(true);
    opacity.setValue(0);
    scale.setValue(0.75);
    translateY.setValue(8);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 160,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -22,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        delay: 180,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    });
  }, [evadeImpactSeq, opacity, scale, translateY]);

  if (!visible) return null;

  return (
    <Animated.Text
      style={[
        styles.label,
        {
          color: EVADE_COLOR,
          opacity,
          transform: [{ scale }, { translateY }],
          textShadowColor: EVADE_COLOR,
        },
      ]}
      pointerEvents="none"
    >
      EVADED
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
