import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
import { RUN_FIELD } from '../../theme/runFieldTokens';
import { HARVEST_VEIL_VIOLET } from '../../constants/harvestScreenVisual';

const VACUUM_SPRING = { damping: 18, stiffness: 92, mass: 0.9 };
const VACUUM_ABSORB_MS = 680;
const MINT = RUN_FIELD.mint;
const VIOLET = HARVEST_VEIL_VIOLET;

interface ResidueParticleProps {
  particle: ResidueParticleData;
  isVacuuming: boolean;
  canisterCoordinates: { x: number; y: number } | null;
  onAbsorbed: (value: number, particleId: string) => void;
}

/**
 * Supernatural veil residue — soft glowing motes with occult halo, not crystal shards.
 * Drawn toward the extractor while vacuuming.
 */
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
  const opacity = useSharedValue(0);
  const floatY = useSharedValue(0);
  const haloPulse = useSharedValue(1);
  const sparkOrbit = useSharedValue(0);

  const handleAbsorbed = useCallback(() => {
    if (absorbedRef.current) return;
    absorbedRef.current = true;
    onAbsorbed(particle.value, particle.id);
  }, [onAbsorbed, particle.id, particle.value]);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });

    floatY.value = withRepeat(
      withSequence(
        withTiming(-4 - particle.size * 0.15, {
          duration: 1100 + particle.size * 40,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(3 + particle.size * 0.1, {
          duration: 1100 + particle.size * 40,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );

    haloPulse.value = withRepeat(
      withSequence(
        withTiming(1.28, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.88, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    sparkOrbit.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [floatY, haloPulse, opacity, particle.size, sparkOrbit]);

  useEffect(() => {
    if (!isVacuuming || !canisterCoordinates || absorbedRef.current) return undefined;

    posX.value = particle.startX;
    posY.value = particle.startY;
    scale.value = 1;
    cancelAnimation(floatY);
    cancelAnimation(haloPulse);
    cancelAnimation(sparkOrbit);
    floatY.value = 0;
    haloPulse.value = 1.55;

    const targetX = canisterCoordinates.x;
    const targetY = canisterCoordinates.y;
    const delay = particle.vacuumDelayMs;

    posX.value = withDelay(delay, withSpring(targetX, VACUUM_SPRING));
    posY.value = withDelay(delay, withSpring(targetY, VACUUM_SPRING));
    scale.value = withDelay(
      delay,
      withTiming(0.08, { duration: VACUUM_ABSORB_MS, easing: Easing.in(Easing.cubic) }),
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
    haloPulse,
    isVacuuming,
    opacity,
    particle.vacuumDelayMs,
    particle.startX,
    particle.startY,
    posX,
    posY,
    scale,
    sparkOrbit,
  ]);

  const span = Math.max(particle.size * 3.2, 28);
  const half = span / 2;
  const coreSize = Math.max(particle.size * 0.7, 6);
  const midSize = Math.max(particle.size * 1.35, 12);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: posX.value - half,
    top: posY.value - half + floatY.value,
    width: span,
    height: span,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloPulse.value }],
    opacity: 0.28 + (haloPulse.value - 0.88) * 0.55,
  }));

  const midGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + (haloPulse.value - 1) * 0.35 }],
    opacity: 0.55,
  }));

  const sparkStyle = useAnimatedStyle(() => {
    const angle = sparkOrbit.value * Math.PI * 2;
    const radius = span * 0.22;
    return {
      opacity: 0.55 + Math.sin(angle) * 0.25,
      transform: [
        { translateX: Math.cos(angle) * radius },
        { translateY: Math.sin(angle) * radius * 0.7 },
      ],
    };
  });

  return (
    <Animated.View style={style} pointerEvents="none">
      <View style={styles.anchor}>
        <Animated.View style={[styles.halo, haloStyle]} />
        <Animated.View
          style={[
            styles.midGlow,
            midGlowStyle,
            {
              width: midSize,
              height: midSize,
              borderRadius: midSize / 2,
            },
          ]}
        />
        <View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
            },
          ]}
        />
        <View
          style={[
            styles.coreHot,
            {
              width: Math.max(2, coreSize * 0.35),
              height: Math.max(2, coreSize * 0.35),
              borderRadius: 99,
            },
          ]}
        />
        <Animated.View style={[styles.spark, sparkStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(99, 226, 177, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190, 82, 164, 0.35)',
    shadowColor: MINT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    ...(Platform.OS === 'android' ? { elevation: 10 } : null),
  },
  midGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(167, 139, 250, 0.28)',
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
  },
  core: {
    backgroundColor: 'rgba(180, 255, 230, 0.95)',
    shadowColor: MINT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    ...(Platform.OS === 'android' ? { elevation: 12 } : null),
  },
  coreHot: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    opacity: 0.9,
  },
  spark: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(233, 213, 255, 0.95)',
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
});
