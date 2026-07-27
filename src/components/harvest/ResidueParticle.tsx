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

const VACUUM_SPRING = { damping: 20, stiffness: 88, mass: 0.95 };
const VACUUM_ABSORB_MS = 720;

interface ResidueParticleProps {
  particle: ResidueParticleData;
  isVacuuming: boolean;
  canisterCoordinates: { x: number; y: number } | null;
  onAbsorbed: (value: number, particleId: string) => void;
}

/**
 * Harvest signature — concentric field rings + faint occult residue core.
 * Not a plain glowing dot; responds to vacuum draw toward the extractor.
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
  const opacity = useSharedValue(0.9);
  const floatY = useSharedValue(0);
  const ringPulse = useSharedValue(1);

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
        withTiming(0.72, { duration: 820, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.92, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [floatY, opacity, ringPulse]);

  useEffect(() => {
    if (!isVacuuming || !canisterCoordinates || absorbedRef.current) return undefined;

    posX.value = particle.startX;
    posY.value = particle.startY;
    scale.value = 1;
    cancelAnimation(floatY);
    cancelAnimation(ringPulse);
    floatY.value = 0;
    ringPulse.value = 1.4;

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
    ringPulse,
    scale,
  ]);

  const span = Math.max(particle.size * 2.4, 22);
  const half = span / 2;
  const coreSize = Math.max(particle.size * 0.55, 5);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: posX.value - half,
    top: posY.value - half + floatY.value,
    width: span,
    height: span,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringPulse.value }],
    opacity: 0.35 + (ringPulse.value - 1) * 0.4,
  }));

  const midRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + (ringPulse.value - 1) * 0.5 }],
    opacity: 0.45,
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <View style={styles.anchor}>
        <Animated.View style={[styles.ringOuter, outerRingStyle]} />
        <Animated.View style={[styles.ringMid, midRingStyle]} />
        <View style={styles.residueGlyph} />
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
  ringOuter: {
    ...StyleSheet.absoluteFill,
    margin: 0,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(99, 226, 177, 0.55)',
  },
  ringMid: {
    position: 'absolute',
    width: '72%',
    height: '72%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(190, 82, 164, 0.35)',
  },
  residueGlyph: {
    position: 'absolute',
    width: '38%',
    height: '38%',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(190, 82, 164, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190, 82, 164, 0.4)',
  },
  core: {
    backgroundColor: 'rgba(99, 226, 177, 0.92)',
    shadowColor: RUN_FIELD.mint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    ...(Platform.OS === 'android' ? { elevation: 8 } : null),
  },
});
