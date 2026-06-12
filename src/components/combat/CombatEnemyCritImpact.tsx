import React, { useEffect, useRef } from 'react';
import { StyleSheet, Vibration, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { DamageChannel } from '../../types/aegisCombat';

const HIT_STOP_MS = 150;
const CRIT_COLORS: Record<'KINETIC' | 'OCCULT', string> = {
  KINETIC: '#fbbf24',
  OCCULT: '#7c3aed',
};

function critChannelColor(channel?: DamageChannel): string {
  return channel === 'OCCULT' ? CRIT_COLORS.OCCULT : CRIT_COLORS.KINETIC;
}

interface CombatEnemyCritImpactProps {
  critImpactSeq?: number;
  channel?: DamageChannel;
  onHitStopChange?: (frozen: boolean) => void;
  children: React.ReactNode;
}

/** Hit-stop freeze + jagged horizontal slash flash on player critical hits. */
export default function CombatEnemyCritImpact({
  critImpactSeq = 0,
  channel,
  onHitStopChange,
  children,
}: CombatEnemyCritImpactProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const flashOpacity = useSharedValue(0);
  const slashScale = useSharedValue(0.4);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const [flashColor, setFlashColor] = React.useState(CRIT_COLORS.KINETIC);

  useEffect(() => {
    if (critImpactSeq <= 0 || critImpactSeq === lastSeqRef.current) return;
    lastSeqRef.current = critImpactSeq;

    const color = critChannelColor(channel);
    setFlashColor(color);
    onHitStopChange?.(true);
    Vibration.vibrate([0, 20, 30, 70, 25, 110]);

    flashOpacity.value = 0;
    slashScale.value = 0.35;
    flashOpacity.value = withSequence(
      withTiming(1, { duration: 40, easing: Easing.out(Easing.quad) }),
      withTiming(0.75, { duration: 60 }),
      withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }),
    );
    slashScale.value = withSequence(
      withTiming(1.15, { duration: 50, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(1, { duration: 90 }),
      withTiming(0.85, { duration: 120 }),
    );

    shakeX.value = withSequence(
      withTiming(-14, { duration: 35 }),
      withTiming(16, { duration: 35 }),
      withTiming(-10, { duration: 30 }),
      withTiming(8, { duration: 30 }),
      withTiming(0, { duration: 50 }),
    );
    shakeY.value = withSequence(
      withTiming(-6, { duration: 35 }),
      withTiming(5, { duration: 35 }),
      withTiming(0, { duration: 80 }),
    );

    const releaseTimer = setTimeout(() => {
      onHitStopChange?.(false);
    }, HIT_STOP_MS);

    return () => {
      clearTimeout(releaseTimer);
      onHitStopChange?.(false);
    };
  }, [channel, critImpactSeq, flashOpacity, onHitStopChange, shakeX, shakeY, slashScale]);

  useEffect(() => () => {
    cancelAnimation(flashOpacity);
    cancelAnimation(slashScale);
    cancelAnimation(shakeX);
    cancelAnimation(shakeY);
  }, [flashOpacity, shakeX, shakeY, slashScale]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: shakeY.value },
    ],
  }));

  const slashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scaleX: slashScale.value }],
  }));

  return (
    <Animated.View style={[styles.root, shakeStyle]}>
      {children}
      <Animated.View style={[styles.slashWrap, slashStyle]} pointerEvents="none">
        <View style={[styles.slashMain, { backgroundColor: flashColor, shadowColor: flashColor }]} />
        <View style={[styles.slashJagA, { backgroundColor: flashColor }]} />
        <View style={[styles.slashJagB, { backgroundColor: flashColor }]} />
        <View style={[styles.slashCore, { backgroundColor: '#ffffff' }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  slashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  slashMain: {
    position: 'absolute',
    width: '118%',
    height: 5,
    borderRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    transform: [{ rotate: '-4deg' }],
  },
  slashJagA: {
    position: 'absolute',
    width: '34%',
    height: 3,
    left: '8%',
    transform: [{ rotate: '12deg' }, { translateY: -7 }],
  },
  slashJagB: {
    position: 'absolute',
    width: '28%',
    height: 3,
    right: '10%',
    transform: [{ rotate: '-16deg' }, { translateY: 8 }],
  },
  slashCore: {
    position: 'absolute',
    width: '72%',
    height: 2,
    opacity: 0.85,
    transform: [{ rotate: '-2deg' }],
  },
});
