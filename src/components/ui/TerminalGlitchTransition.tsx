import React, { useEffect } from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CRT_GLITCH_DURATION_MS = 150;
const STEP_MS = Math.round(CRT_GLITCH_DURATION_MS / 8);

/** 150ms digital tear — hard horizontal cuts, no skew wobble. */
const glitchKeyframe = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ translateX: 0 }],
  },
  12: {
    opacity: 0.6,
    transform: [{ translateX: 3 }],
  },
  24: {
    opacity: 1,
    transform: [{ translateX: -2 }],
  },
  38: {
    opacity: 0.7,
    transform: [{ translateX: 4 }],
  },
  52: {
    opacity: 1,
    transform: [{ translateX: -3 }],
  },
  68: {
    opacity: 0.85,
    transform: [{ translateX: 2 }],
  },
  84: {
    opacity: 1,
    transform: [{ translateX: -1 }],
  },
  100: {
    opacity: 1,
    transform: [{ translateX: 0 }],
  },
}).duration(CRT_GLITCH_DURATION_MS);

const step = (to: number, duration = STEP_MS) =>
  withTiming(to, { duration, easing: Easing.linear });

export interface TerminalGlitchTransitionProps {
  children: React.ReactNode;
  transitionKey: string | number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Remounts children on `transitionKey` change and plays a CRT glitch entering animation.
 * Sidebar / chrome should sit outside this wrapper.
 *
 * Web avoids Reanimated layout `entering` — remount cleanup can hit undefined snapshots
 * (`setElementPosition` → reading `snapshot.top`) and crash the hub.
 */
export default function TerminalGlitchTransition({
  children,
  transitionKey,
  style,
}: TerminalGlitchTransitionProps): React.JSX.Element {
  const glitchX = useSharedValue(0);
  const glitchOpacity = useSharedValue(1);

  useEffect(() => {
    // triggerSfx('UI_TERMINAL_GLITCH');
  }, [transitionKey]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    glitchX.value = 0;
    glitchOpacity.value = 1;
    glitchX.value = withSequence(
      step(3),
      step(-2),
      step(4),
      step(-3),
      step(2),
      step(-1),
      step(0),
    );
    glitchOpacity.value = withSequence(
      step(0.6),
      step(1),
      step(0.7),
      step(1),
      step(0.85),
      step(1),
      step(1),
    );
  }, [glitchOpacity, glitchX, transitionKey]);

  const webGlitchStyle = useAnimatedStyle(() => ({
    opacity: glitchOpacity.value,
    transform: [{ translateX: glitchX.value }],
  }));

  if (Platform.OS === 'web') {
    return (
      <Animated.View
        key={transitionKey}
        style={[styles.viewport, style, webGlitchStyle]}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      key={transitionKey}
      entering={glitchKeyframe}
      style={[styles.viewport, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
});
