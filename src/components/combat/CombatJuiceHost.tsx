import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewProps } from 'react-native';
import {
  registerCombatJuiceShake,
  unregisterCombatJuiceShake,
  type ShakeIntensity,
} from '../../utils/combatJuice';

interface CombatJuiceHostProps extends ViewProps {
  children: React.ReactNode;
}

const SHAKE_OFFSET: Record<ShakeIntensity, number> = {
  micro: 1,
  light: 2,
  heavy: 10,
};

export default function CombatJuiceHost({
  children,
  style,
  ...rest
}: CombatJuiceHostProps): React.JSX.Element {
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    registerCombatJuiceShake((intensity: ShakeIntensity) => {
      const offset = SHAKE_OFFSET[intensity];
      const steps = intensity === 'heavy' ? 6 : intensity === 'light' ? 4 : 2;
      const anims: Animated.CompositeAnimation[] = [];
      for (let i = 0; i < steps; i += 1) {
        const dx = (i % 2 === 0 ? 1 : -1) * offset;
        const dy = intensity === 'heavy' ? (i % 3 === 0 ? offset * 0.6 : -offset * 0.4) : 0;
        anims.push(
          Animated.parallel([
            Animated.timing(shakeX, { toValue: dx, duration: 28, useNativeDriver: true }),
            Animated.timing(shakeY, { toValue: dy, duration: 28, useNativeDriver: true }),
          ]),
        );
      }
      anims.push(
        Animated.parallel([
          Animated.timing(shakeX, { toValue: 0, duration: 40, useNativeDriver: true }),
          Animated.timing(shakeY, { toValue: 0, duration: 40, useNativeDriver: true }),
        ]),
      );
      Animated.sequence(anims).start();
    });
    return () => unregisterCombatJuiceShake();
  }, [shakeX, shakeY]);

  return (
    <Animated.View
      style={[styles.host, style, { transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}
      {...rest}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
