import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  BIOME_ASH_PARTICLE_SIZE,
  biomeAshParticleStyle,
  randomBiomeAshOpacity,
} from '../../constants/ashParticleVisual';

export const ENEMY_DISINTEGRATION_DURATION_MS = 1200;
export const ENEMY_DISINTEGRATION_PARTICLE_MIN = 35;
export const ENEMY_DISINTEGRATION_PARTICLE_MAX = 45;

interface EnemyDisintegrationProps {
  /** Center X within the parent coordinate space. */
  x: number;
  /** Center Y within the parent coordinate space. */
  y: number;
  width: number;
  height: number;
  onComplete?: () => void;
}

interface BurstParticleSpec {
  id: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  peakOpacity: number;
  delayMs: number;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildBurstParticles(
  x: number,
  y: number,
  width: number,
  height: number,
): BurstParticleSpec[] {
  const sizeScale = Math.max(1, Math.min(width, height) / 72);
  const count = Math.round(
    randomInt(ENEMY_DISINTEGRATION_PARTICLE_MIN, ENEMY_DISINTEGRATION_PARTICLE_MAX) * sizeScale,
  );
  const clusterX = width * 0.28;
  const clusterY = height * 0.22;
  const liftScale = Math.max(0.75, height / 120);

  return Array.from({ length: count }, (_, id) => {
    const outward = 0.55 + Math.random() * 0.95;
    const lateralSign = Math.random() < 0.5 ? -1 : 1;
    return {
      id,
      startX: x + (Math.random() - 0.5) * clusterX * 2,
      startY: y + (Math.random() - 0.5) * clusterY * 2,
      deltaX: lateralSign * (20 + Math.random() * width * 0.55) * outward,
      deltaY: -(50 + Math.random() * 100) * liftScale,
      peakOpacity: randomBiomeAshOpacity(),
      delayMs: Math.floor(Math.random() * 90),
    };
  });
}

interface BurstParticleProps {
  spec: BurstParticleSpec;
  durationMs: number;
  triggerComplete: () => void;
  isLast: boolean;
}

function BurstParticle({
  spec,
  durationMs,
  triggerComplete,
  isLast,
}: BurstParticleProps): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spec.delayMs,
      withTiming(1, {
        duration: durationMs,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished && isLast) {
          runOnJS(triggerComplete)();
        }
      }),
    );
  }, [durationMs, isLast, progress, spec.delayMs, triggerComplete]);

  const half = BIOME_ASH_PARTICLE_SIZE / 2;

  const style = useAnimatedStyle(() => ({
    opacity: spec.peakOpacity * (1 - progress.value),
    transform: [
      { translateX: spec.deltaX * progress.value },
      { translateY: spec.deltaY * progress.value },
      { scale: 1 - progress.value * 0.88 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particlePosition,
        biomeAshParticleStyle.particle,
        {
          left: spec.startX - half,
          top: spec.startY - half,
        },
        style,
      ]}
    />
  );
}

/** Biome-matched ash burst — outward/up from a dying hostile's center. */
export default function EnemyDisintegration({
  x,
  y,
  width,
  height,
  onComplete,
}: EnemyDisintegrationProps): React.JSX.Element | null {
  const [mounted, setMounted] = useState(true);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const particles = useMemo(
    () => buildBurstParticles(x, y, width, height),
    [height, width, x, y],
  );

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setMounted(false);
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    const fallbackMs = ENEMY_DISINTEGRATION_DURATION_MS + 120;
    const timer = setTimeout(finish, fallbackMs);
    return () => clearTimeout(timer);
  }, [finish]);

  if (!mounted || width <= 0 || height <= 0) return null;

  const lastId = particles[particles.length - 1]?.id ?? -1;

  return (
    <View style={styles.root} pointerEvents="none" collapsable={false}>
      {particles.map((spec) => (
        <BurstParticle
          key={spec.id}
          spec={spec}
          durationMs={ENEMY_DISINTEGRATION_DURATION_MS}
          triggerComplete={finish}
          isLast={spec.id === lastId}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 20,
    elevation: 20,
  },
  particlePosition: {
    position: 'absolute',
  },
});
