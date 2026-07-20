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

/** Occult scanner lock — thin corner brackets + faint circular reticle. */
export default function TargetingBrackets({
  active = true,
  color = OTT.fluxViolet,
}: TargetingBracketsProps): React.JSX.Element | null {
  const pulse = useSharedValue(0.62);

  useEffect(() => {
    if (!active) {
      cancelAnimation(pulse);
      pulse.value = 0.62;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.58, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
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
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
      <View style={[styles.reticle, { borderColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: '4%',
    right: '10%',
    bottom: '8%',
    left: '10%',
    zIndex: 16,
  },
  corner: {
    position: 'absolute',
    width: '16%',
    height: '12%',
    borderWidth: 1,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  reticle: {
    position: 'absolute',
    width: '38%',
    height: '38%',
    top: '31%',
    left: '31%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    opacity: 0.45,
  },
});
