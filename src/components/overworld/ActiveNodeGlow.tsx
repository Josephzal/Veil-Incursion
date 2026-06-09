import React, { useEffect } from 'react';
import { BlurMask, Circle, Group } from '@shopify/react-native-skia';
import {
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const GLOW_MIN = 15;
const GLOW_MAX = 25;

interface ActiveNodeGlowProps {
  cx: number;
  cy: number;
  color: string;
  opacity?: number;
}

export default function ActiveNodeGlow({
  cx,
  cy,
  color,
  opacity = 0.5,
}: ActiveNodeGlowProps): React.JSX.Element {
  const glowRadius = useSharedValue(GLOW_MIN);

  useEffect(() => {
    glowRadius.value = withRepeat(
      withSequence(
        withTiming(GLOW_MAX, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        withTiming(GLOW_MIN, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    );
  }, [glowRadius]);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={glowRadius} color={color} opacity={opacity}>
        <BlurMask blur={8} style="outer" />
      </Circle>
    </Group>
  );
}
