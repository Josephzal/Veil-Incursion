import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface DimensionalTearOverlayProps {
  active: boolean;
  onComplete?: () => void;
}

export default function DimensionalTearOverlay({
  active,
  onComplete,
}: DimensionalTearOverlayProps): React.JSX.Element | null {
  const invert = useSharedValue(0);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      invert.value = 0;
      shake.value = 0;
      flash.value = 0;
      return;
    }

    invert.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0.2, { duration: 120 }),
      withTiming(0, { duration: 180 }),
    );
    shake.value = withSequence(
      withTiming(8, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(4, { duration: 45 }),
      withTiming(0, { duration: 90 }),
    );
    flash.value = withSequence(
      withTiming(0.75, { duration: 70 }),
      withTiming(0.15, { duration: 100 }),
      withTiming(0, { duration: 220 }, (finished) => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      }),
    );
  }, [active, flash, invert, onComplete, shake]);

  const style = useAnimatedStyle(() => ({
    opacity: flash.value,
    transform: [
      { translateX: shake.value },
      { scaleX: 1 + invert.value * 0.04 },
      { scaleY: 1 - invert.value * 0.03 },
    ],
    backgroundColor: invert.value > 0.5 ? '#00ff33' : '#f8fafc',
  }));

  if (!active) return null;

  return <Animated.View pointerEvents="none" style={[styles.overlay, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22,
    mixBlendMode: 'difference',
  },
});
