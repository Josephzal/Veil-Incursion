import React, { useEffect } from 'react';
import { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface ContestedSectorPathProps {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

/** Slow breathing opacity pulse for contested macro-sectors. */
export default function ContestedSectorPath({
  d,
  fill,
  stroke,
  strokeWidth,
  strokeDasharray,
}: ContestedSectorPathProps): React.JSX.Element {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedProps = useAnimatedProps(() => ({
    opacity: pulse.value,
  }));

  return (
    <AnimatedPath
      d={d}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      animatedProps={animatedProps}
    />
  );
}
