import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Line, vec } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';

interface ProximityScanlineOverlayProps {
  width: number;
  height: number;
  /** 0–1 glitch strength from nearest hidden node */
  intensity: number;
}

const LINE_COUNT = 14;
const FADE_OUT_MS = 520;
const FADE_IN_MS = 140;

export default function ProximityScanlineOverlay({
  width,
  height,
  intensity,
}: ProximityScanlineOverlayProps): React.JSX.Element | null {
  const phase = useSharedValue(0);
  const animatedIntensity = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [phase]);

  useEffect(() => {
    const fadingOut = intensity < animatedIntensity.value;
    animatedIntensity.value = withTiming(intensity, {
      duration: fadingOut ? FADE_OUT_MS : FADE_IN_MS,
      easing: fadingOut ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
    });
  }, [intensity, animatedIntensity]);

  const groupOpacity = useDerivedValue(
    () => animatedIntensity.value * (0.22 + Math.sin(phase.value * Math.PI * 2) * 0.08),
  );

  if (width <= 0 || height <= 0) return null;

  const lines: React.JSX.Element[] = [];
  for (let i = 0; i < LINE_COUNT; i += 1) {
    const y = (height / (LINE_COUNT + 1)) * (i + 1);
    const jitter = ((i * 17) % 5) - 2;
    lines.push(
      <Line
        key={`scan-${i}`}
        p1={vec(0, y + jitter)}
        p2={vec(width, y + jitter)}
        color="rgba(0, 255, 51, 0.55)"
        strokeWidth={i % 3 === 0 ? 1.5 : 0.8}
        opacity={0.25 + (i % 4) * 0.08}
      />,
    );
  }

  return (
    <View style={styles.host} pointerEvents="none">
      <Canvas style={{ width, height }}>
        <Group opacity={groupOpacity}>
          {lines}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
});
