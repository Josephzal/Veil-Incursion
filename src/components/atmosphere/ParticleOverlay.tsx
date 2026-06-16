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
const ASH_PARTICLE_MIN = 15;
const ASH_PARTICLE_MAX = 25;

interface RainParticleSpec {
  id: number;
  left: number;
  startY: number;
  duration: number;
  translateY: Animated.Value;
}

interface AshParticleSpec {
  id: number;
  left: number;
  startY: number;
  yDuration: number;
  xDuration: number;
  drift: number;
  opacity: number;
  translateY: Animated.Value;
  translateX: Animated.Value;
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

function buildAshParticles(width: number, height: number): AshParticleSpec[] {
  const count = randomInt(ASH_PARTICLE_MIN, ASH_PARTICLE_MAX);
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * Math.max(width, 1),
    startY: -10 - Math.random() * Math.max(height, 1),
    yDuration: randomInt(3000, 5000),
    xDuration: randomInt(1800, 3200),
    drift: randomInt(10, 20),
    opacity: 0.35 + Math.random() * 0.35,
    translateY: new Animated.Value(-10 - Math.random() * Math.max(height, 1)),
    translateX: new Animated.Value(0),
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
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateY, {
            toValue: -20,
            duration: 0,
            useNativeDriver: true,
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

interface AshLayerProps {
  width: number;
  height: number;
}

function AshLayer({ width, height }: AshLayerProps): React.JSX.Element {
  const particles = useMemo(
    () => (width > 0 && height > 0 ? buildAshParticles(width, height) : []),
    [height, width],
  );

  useEffect(() => {
    if (particles.length === 0) return undefined;

    const loops: Animated.CompositeAnimation[] = [];

    particles.forEach((particle) => {
      particle.translateY.setValue(particle.startY);
      particle.translateX.setValue(0);

      const verticalLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.translateY, {
            toValue: height + 20,
            duration: particle.yDuration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateY, {
            toValue: -10,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

      const horizontalLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.translateX, {
            toValue: particle.drift,
            duration: particle.xDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateX, {
            toValue: -particle.drift,
            duration: particle.xDuration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

      verticalLoop.start();
      horizontalLoop.start();
      loops.push(verticalLoop, horizontalLoop);
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
            styles.ashParticle,
            {
              left: particle.left,
              opacity: particle.opacity,
              transform: [
                { translateY: particle.translateY },
                { translateX: particle.translateX },
              ],
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
      {width > 0 && height > 0 && effect === 'ash' ? (
        <AshLayer width={width} height={height} />
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
  ashParticle: {
    position: 'absolute',
    top: 0,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(180, 180, 180, 0.6)',
  },
});
