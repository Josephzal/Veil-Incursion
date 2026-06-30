import React, { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Keyframe } from 'react-native-reanimated';

const CRT_GLITCH_DURATION_MS = 150;

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
})
  .duration(CRT_GLITCH_DURATION_MS);

export interface TerminalGlitchTransitionProps {
  children: React.ReactNode;
  transitionKey: string | number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Remounts children on `transitionKey` change and plays a CRT glitch entering animation.
 * Sidebar / chrome should sit outside this wrapper.
 */
export default function TerminalGlitchTransition({
  children,
  transitionKey,
  style,
}: TerminalGlitchTransitionProps): React.JSX.Element {
  useEffect(() => {
    // triggerSfx('UI_TERMINAL_GLITCH');
  }, [transitionKey]);

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
