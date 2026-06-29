import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import {
  resolveParticleEffect,
  type BiomeId,
  type ParticleEffectType,
} from '../../constants/biomeConfig';

const OVERLAY_Z_INDEX = 3;
const RAIN_DROP_MIN = 20;
const RAIN_DROP_MAX = 30;

interface RainParticleSpec {
  id: number;
  left: number;
  startY: number;
  duration: number;
  translateY: Animated.Value;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildRainParticles(width: number, height: number): RainParticleSpec[] {
  const count = randomInt(RAIN_DROP_MIN, RAIN_DROP_MAX);
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * Math.max(width, 1),
    startY: -20 - Math.random() * Math.max(height, 1),
    duration: randomInt(400, 700),
    translateY: new Animated.Value(-20 - Math.random() * Math.max(height, 1)),
  }));
}

interface RainLayerProps {
  width: number;
  height: number;
}

function RainLayer({ width, height }: RainLayerProps): React.JSX.Element {
  const particles = useMemo(
    () => (width > 0 && height > 0 ? buildRainParticles(width, height) : []),
    [height, width],
  );

  useEffect(() => {
    if (particles.length === 0) return undefined;

    const loops: Animated.CompositeAnimation[] = [];

    particles.forEach((particle) => {
      particle.translateY.setValue(particle.startY);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.translateY, {
            toValue: height + 20,
            duration: particle.duration,
            easing: Easing.linear,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.timing(particle.translateY, {
            toValue: -20,
            duration: 0,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      );
      loop.start();
      loops.push(loop);
    });

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [height, particles]);

  return (
    <>
      {particles.map((particle) => (
        <Animated.View
          key={particle.id}
          style={[
            styles.rainDrop,
            {
              left: particle.left,
              transform: [{ translateY: particle.translateY }],
            },
          ]}
        />
      ))}
    </>
  );
}

export interface ParticleOverlayProps {
  biomeId?: BiomeId | string | null;
  zIndex?: number;
}

export default function ParticleOverlay({
  biomeId,
  zIndex = OVERLAY_Z_INDEX,
}: ParticleOverlayProps): React.JSX.Element | null {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const effect = useMemo<ParticleEffectType>(
    () => resolveParticleEffect(biomeId),
    [biomeId],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  };

  if (effect === 'none') return null;

  const { width, height } = layout;

  return (
    <View
      style={[styles.overlay, { zIndex }]}
      pointerEvents="none"
      onLayout={handleLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && height > 0 && effect === 'rain' ? (
        <RainLayer width={width} height={height} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  rainDrop: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
