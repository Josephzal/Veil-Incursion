import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { EnemyDeckStrikeVariant } from '../../utils/combatTelemetryFormat';

const VARIANT_COLORS: Record<EnemyDeckStrikeVariant, string> = {
  hp: 'rgba(255, 69, 58, 0.44)',
  stamina: 'rgba(92, 45, 145, 0.5)',
  abyssal: 'rgba(0, 210, 196, 0.44)',
};

interface CombatDeckStrikeOverlayProps {
  variant: EnemyDeckStrikeVariant;
}

export default function CombatDeckStrikeOverlay({
  variant,
}: CombatDeckStrikeOverlayProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.72,
        duration: 380,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, variant]);

  const color = VARIANT_COLORS[variant];

  return (
    <Animated.View style={[styles.root, { opacity }]} pointerEvents="none">
      <View style={[styles.bar, styles.barA, { backgroundColor: color }]} />
      <View style={[styles.bar, styles.barB, { backgroundColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
  },
  bar: {
    position: 'absolute',
    width: '88%',
    height: 3,
    borderRadius: 1,
  },
  barA: {
    transform: [{ rotate: '45deg' }],
  },
  barB: {
    transform: [{ rotate: '-45deg' }],
  },
});
