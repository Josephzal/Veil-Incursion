import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ResidueParticleData } from '../../types/residueParticle';

const VACUUM_SPRING = { damping: 20, stiffness: 88, mass: 0.95 };
const VACUUM_ABSORB_MS = 720;

interface ResidueParticleProps {
  particle: ResidueParticleData;
  isVacuuming: boolean;
  canisterCoordinates: { x: number; y: number } | null;
  onAbsorbed: (value: number, particleId: string) => void;
}

export default function ResidueParticle({
  particle,
  isVacuuming,
  canisterCoordinates,
  onAbsorbed,
}: ResidueParticleProps): React.JSX.Element {
  const absorbedRef = useRef(false);
  const posX = useSharedValue(particle.startX);
  const posY = useSharedValue(particle.startY);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.9);
  const floatY = useSharedValue(0);

  const handleAbsorbed = useCallback(() => {
    if (absorbedRef.current) return;
    absorbedRef.current = true;
    onAbsorbed(particle.value, particle.id);
  }, [onAbsorbed, particle.id, particle.value]);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 820, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.62, { duration: 820, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [floatY, opacity]);

  useEffect(() => {
    if (!isVacuuming || !canisterCoordinates || absorbedRef.current) return undefined;

    posX.value = particle.startX;
    posY.value = particle.startY;
    scale.value = 1;
    cancelAnimation(floatY);
    floatY.value = 0;

    const targetX = canisterCoordinates.x;
    const targetY = canisterCoordinates.y;
    const delay = particle.vacuumDelayMs;

    posX.value = withDelay(
      delay,
      withSpring(targetX, VACUUM_SPRING),
    );
    posY.value = withDelay(
      delay,
      withSpring(targetY, VACUUM_SPRING),
    );
    scale.value = withDelay(
      delay,
      withTiming(0.1, { duration: VACUUM_ABSORB_MS, easing: Easing.in(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withTiming(0, { duration: VACUUM_ABSORB_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(handleAbsorbed)();
        }
      }),
    );

    return () => {
      if (!absorbedRef.current) {
        cancelAnimation(posX);
        cancelAnimation(posY);
        cancelAnimation(scale);
        cancelAnimation(opacity);
      }
    };
  }, [
    canisterCoordinates,
    floatY,
    handleAbsorbed,
    isVacuuming,
    opacity,
    particle.vacuumDelayMs,
    particle.startX,
    particle.startY,
    posX,
    posY,
    scale,
  ]);

  const half = particle.size / 2;

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: posX.value - half,
    top: posY.value - half + floatY.value,
    width: particle.size,
    height: particle.size,
    borderRadius: half,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.orb, style]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  orb: {
    backgroundColor: 'rgba(0, 255, 200, 0.9)',
    shadowColor: '#00ffcc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    ...(Platform.OS === 'android' ? { elevation: 10 } : null),
  },
});
