import React, { useEffect, useRef } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const WISP_GREY = '#9ca3af';
const WISP_SOFT = '#c4c9d1';
/** Slide away from the operative (enemies sit on the right). */
const EVADE_SLIDE_X = 34;
const EVADE_OUT_MS = 140;
const EVADE_HOLD_MS = 70;
const EVADE_RETURN_MS = 280;

interface CombatEnemyEvadeEffectProps {
  evadeImpactSeq?: number;
  portraitSource: ImageSourcePropType;
  children: React.ReactNode;
}

/**
 * Dodge VFX — portrait slides out and settles back with a wispy grey afterimage.
 * Triggered by evadeImpactSeq bumps from combat resolution.
 */
export default function CombatEnemyEvadeEffect({
  evadeImpactSeq = 0,
  portraitSource,
  children,
}: CombatEnemyEvadeEffectProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const slideX = useSharedValue(0);
  const bodyOpacity = useSharedValue(1);
  const wispOpacity = useSharedValue(0);
  const ghostX = useSharedValue(0);
  const mistDrift = useSharedValue(0);

  useEffect(() => {
    if (evadeImpactSeq <= 0 || evadeImpactSeq === lastSeqRef.current) return;
    lastSeqRef.current = evadeImpactSeq;

    cancelAnimation(slideX);
    cancelAnimation(bodyOpacity);
    cancelAnimation(wispOpacity);
    cancelAnimation(ghostX);
    cancelAnimation(mistDrift);

    slideX.value = 0;
    bodyOpacity.value = 1;
    wispOpacity.value = 0;
    ghostX.value = 0;
    mistDrift.value = 0;

    slideX.value = withSequence(
      withTiming(EVADE_SLIDE_X, {
        duration: EVADE_OUT_MS,
        easing: Easing.out(Easing.cubic),
      }),
      withDelay(EVADE_HOLD_MS, withTiming(EVADE_SLIDE_X, { duration: 0 })),
      withTiming(0, {
        duration: EVADE_RETURN_MS,
        easing: Easing.inOut(Easing.cubic),
      }),
    );

    bodyOpacity.value = withSequence(
      withTiming(0.55, {
        duration: EVADE_OUT_MS,
        easing: Easing.out(Easing.quad),
      }),
      withDelay(EVADE_HOLD_MS, withTiming(0.55, { duration: 0 })),
      withTiming(1, {
        duration: EVADE_RETURN_MS,
        easing: Easing.inOut(Easing.quad),
      }),
    );

    // Soft grey wash peaks mid-dodge, then fades as the body settles.
    wispOpacity.value = withSequence(
      withTiming(0.72, {
        duration: EVADE_OUT_MS,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0.45, { duration: EVADE_HOLD_MS + 40 }),
      withTiming(0, {
        duration: EVADE_RETURN_MS + 60,
        easing: Easing.in(Easing.cubic),
      }),
    );

    // Afterimage lags behind the body, then dissolves.
    ghostX.value = withSequence(
      withTiming(EVADE_SLIDE_X * 0.35, {
        duration: EVADE_OUT_MS,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(EVADE_SLIDE_X * 0.15, {
        duration: EVADE_HOLD_MS + EVADE_RETURN_MS * 0.4,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: EVADE_RETURN_MS * 0.6,
        easing: Easing.in(Easing.quad),
      }),
    );

    mistDrift.value = withSequence(
      withTiming(1, {
        duration: EVADE_OUT_MS + EVADE_HOLD_MS,
        easing: Easing.out(Easing.sin),
      }),
      withTiming(0, {
        duration: EVADE_RETURN_MS + 80,
        easing: Easing.in(Easing.quad),
      }),
    );
  }, [bodyOpacity, evadeImpactSeq, ghostX, mistDrift, slideX, wispOpacity]);

  useEffect(() => () => {
    cancelAnimation(slideX);
    cancelAnimation(bodyOpacity);
    cancelAnimation(wispOpacity);
    cancelAnimation(ghostX);
    cancelAnimation(mistDrift);
  }, [bodyOpacity, ghostX, mistDrift, slideX, wispOpacity]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateX: slideX.value }],
  }));

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: wispOpacity.value * 0.55,
    transform: [{ translateX: ghostX.value }],
  }));

  const washStyle = useAnimatedStyle(() => ({
    opacity: wispOpacity.value * 0.5,
    transform: [{ translateX: slideX.value * 0.7 }],
  }));

  const streakAStyle = useAnimatedStyle(() => ({
    opacity: wispOpacity.value * 0.85,
    transform: [
      { translateX: slideX.value * 0.45 - mistDrift.value * 10 },
      { translateY: -6 + mistDrift.value * 4 },
      { scaleX: 1 + mistDrift.value * 0.35 },
    ],
  }));

  const streakBStyle = useAnimatedStyle(() => ({
    opacity: wispOpacity.value * 0.55,
    transform: [
      { translateX: slideX.value * 0.25 - mistDrift.value * 16 },
      { translateY: 10 - mistDrift.value * 3 },
      { scaleX: 1 + mistDrift.value * 0.5 },
    ],
  }));

  const streakCStyle = useAnimatedStyle(() => ({
    opacity: wispOpacity.value * 0.4,
    transform: [
      { translateX: slideX.value * 0.15 - mistDrift.value * 22 },
      { translateY: -14 + mistDrift.value * 6 },
      { scaleX: 0.85 + mistDrift.value * 0.4 },
    ],
  }));

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.body, bodyStyle]}>
        {children}
        <Animated.View style={[styles.imageFlashWrap, washStyle]} pointerEvents="none">
          <Image
            source={portraitSource}
            resizeMode="contain"
            style={[styles.portraitTint, { tintColor: WISP_SOFT }]}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.afterimage, ghostStyle]} pointerEvents="none">
        <Image
          source={portraitSource}
          resizeMode="contain"
          style={[styles.portraitTint, { tintColor: WISP_GREY, opacity: 0.55 }]}
        />
      </Animated.View>

      <Animated.View style={[styles.streak, styles.streakA, streakAStyle]} pointerEvents="none" />
      <Animated.View style={[styles.streak, styles.streakB, streakBStyle]} pointerEvents="none" />
      <Animated.View style={[styles.streak, styles.streakC, streakCStyle]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  body: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  afterimage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 4,
  },
  imageFlashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  portraitTint: {
    width: '100%',
    height: '100%',
  },
  streak: {
    position: 'absolute',
    left: '8%',
    height: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(156, 163, 175, 0.45)',
    shadowColor: WISP_GREY,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 6,
  },
  streakA: {
    top: '42%',
    width: '48%',
  },
  streakB: {
    top: '58%',
    width: '38%',
    height: 7,
    backgroundColor: 'rgba(196, 201, 209, 0.35)',
  },
  streakC: {
    top: '34%',
    width: '28%',
    height: 5,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
  },
});
