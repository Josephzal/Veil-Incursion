import React, { useEffect, useMemo } from 'react';
import { BlurMask, Circle, Group, Points, vec } from '@shopify/react-native-skia';
import type { SkPoint } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const TERMINAL_GREEN = '#00ff33';
const GLITCH_CHECK_MS = 72;

interface AnchorRiftVisualProps {
  cx: number;
  cy: number;
  accessible: boolean;
}

function buildRing(cx: number, cy: number, radius: number, count: number): SkPoint[] {
  const points: SkPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    points.push(vec(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius));
  }
  return points;
}

export default function AnchorRiftVisual({
  cx,
  cy,
  accessible,
}: AnchorRiftVisualProps): React.JSX.Element {
  const glitchX = useSharedValue(0);
  const glitchY = useSharedValue(0);
  const glitchOpacity = useSharedValue(accessible ? 0.92 : 0.45);

  const particleRings = useMemo(
    () => [
      buildRing(cx, cy, 10, 10),
      buildRing(cx, cy, 16, 14),
      buildRing(cx, cy, 22, 18),
    ],
    [cx, cy],
  );

  useEffect(() => {
    glitchOpacity.value = withTiming(accessible ? 0.95 : 0.4, { duration: 220 });
  }, [accessible, glitchOpacity]);

  useEffect(() => {
    const burst = () => {
      const skipX = (Math.random() - 0.5) * 9;
      const skipY = (Math.random() - 0.5) * 9;
      glitchX.value = withSequence(
        withTiming(skipX, { duration: 28 }),
        withTiming(-skipX * 0.45, { duration: 22 }),
        withTiming(0, { duration: 36 }),
      );
      glitchY.value = withSequence(
        withTiming(skipY, { duration: 24 }),
        withTiming(skipY * 0.35, { duration: 18 }),
        withTiming(0, { duration: 32 }),
      );
      glitchOpacity.value = withSequence(
        withTiming(0.25 + Math.random() * 0.7, { duration: 24 }),
        withTiming(accessible ? 0.95 : 0.45, { duration: 48 }),
      );
    };

    const id = setInterval(() => {
      if (Math.random() > 0.38) burst();
    }, GLITCH_CHECK_MS);

    return () => clearInterval(id);
  }, [accessible, glitchOpacity, glitchX, glitchY]);

  const glitchTransform = useDerivedValue(() => [
    { translateX: glitchX.value },
    { translateY: glitchY.value },
  ]);

  return (
    <Group transform={glitchTransform} opacity={glitchOpacity}>
      <Circle cx={cx} cy={cy} r={20} color="rgba(0, 255, 51, 0.12)" opacity={0.85}>
        <BlurMask blur={10} style="outer" />
      </Circle>
      {particleRings.map((ring, index) => (
        <Points
          key={`anchor-ring-${index}`}
          points={ring}
          mode="points"
          color={TERMINAL_GREEN}
          style="stroke"
          strokeWidth={index === 0 ? 2.5 : 1.5}
          strokeCap="round"
          opacity={0.55 + index * 0.12}
        />
      ))}
      <Circle cx={cx} cy={cy} r={7} color={TERMINAL_GREEN} opacity={0.9}>
        <BlurMask blur={6} style="solid" />
      </Circle>
    </Group>
  );
}
