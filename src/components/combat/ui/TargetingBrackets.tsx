import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { OTT } from '../../../constants/occultTacticalTerminalTheme';

interface TargetingBracketsProps {
  active?: boolean;
  /** Concept art uses occult violet lock reticle. */
  color?: string;
}

/** Occult scanner lock — glowing corner brackets only. */
export default function TargetingBrackets({
  active = true,
  color = OTT.fluxViolet,
}: TargetingBracketsProps): React.JSX.Element | null {
  const pulse = useSharedValue(0.7);

  useEffect(() => {
    if (!active) {
      cancelAnimation(pulse);
      pulse.value = 0.7;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.68, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [active, pulse]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  if (!active) return null;

  return (
    <Animated.View style={[styles.root, animStyle]} pointerEvents="none">
      <View
        style={[
          styles.corner,
          styles.tl,
          { borderColor: color, shadowColor: color },
          styles.cornerGlow,
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.tr,
          { borderColor: color, shadowColor: color },
          styles.cornerGlow,
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.bl,
          { borderColor: color, shadowColor: color },
          styles.cornerGlow,
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.br,
          { borderColor: color, shadowColor: color },
          styles.cornerGlow,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: '2%',
    right: '6%',
    bottom: '4%',
    left: '6%',
    zIndex: 16,
  },
  corner: {
    position: 'absolute',
    width: '18%',
    height: '14%',
    borderWidth: 1.5,
  },
  cornerGlow: {
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
});
