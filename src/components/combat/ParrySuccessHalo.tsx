import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { PARRY_HALO_DURATION_MS } from '../../utils/parryCollision';

const PARRY_SUCCESS = '#fff9c4';
const PARRY_RING_BRIGHT = '#f5ecc8';
const RIPPLE_DELAYS_MS = [0, 80, 160] as const;

interface ParrySuccessHaloProps {
  cx: number;
  cy: number;
  baseR: number;
  burstEpoch?: number;
}

export default function ParrySuccessHalo({
  cx,
  cy,
  baseR,
  burstEpoch = 0,
}: ParrySuccessHaloProps): React.JSX.Element | null {
  const progress0 = useRef(new Animated.Value(0)).current;
  const progress1 = useRef(new Animated.Value(0)).current;
  const progress2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (baseR <= 0) return;
    progress0.setValue(0);
    progress1.setValue(0);
    progress2.setValue(0);
    const run = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: PARRY_HALO_DURATION_MS,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    const anim = Animated.parallel([
      run(progress0, RIPPLE_DELAYS_MS[0]),
      run(progress1, RIPPLE_DELAYS_MS[1]),
      run(progress2, RIPPLE_DELAYS_MS[2]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [baseR, burstEpoch, progress0, progress1, progress2]);

  if (baseR <= 0) return null;

  const diameter = baseR * 2;

  const ripple = (
    progress: Animated.Value,
    color: string,
    maxOpacity: number,
    borderWidth = 0,
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 3.1],
    });
    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [maxOpacity, 0],
    });
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          {
            left: cx - baseR,
            top: cy - baseR,
            width: diameter,
            height: diameter,
            borderRadius: baseR,
            backgroundColor: borderWidth > 0 ? 'transparent' : color,
            borderWidth,
            borderColor: color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    );
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} pointerEvents="none">
      {ripple(progress2, PARRY_SUCCESS, 0.4, 10)}
      {ripple(progress1, PARRY_RING_BRIGHT, 0.55, 8)}
      {ripple(progress0, PARRY_SUCCESS, 0.72)}
      {ripple(progress0, PARRY_RING_BRIGHT, 0.72, 3)}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 35,
    elevation: 35,
  },
  ripple: {
    position: 'absolute',
  },
});
