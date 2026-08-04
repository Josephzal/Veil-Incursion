/**
 * One-shot ABYSSAL VERDICT ready notification — Reserve → lower-center banner.
 * Non-blocking. Plays only when notifySeq increments (false→true ready edge).
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ABYSSAL_VERDICT_READY_NOTIFY_MS,
  ABYSSAL_VERDICT_UI_COLORS as C,
  ABYSSAL_VERDICT_UI_COPY as COPY,
} from '../../data/abyssalVerdictReadyUi';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { OTT, OTT_LAYOUT } from '../../constants/occultTacticalTerminalTheme';

export interface AbyssalVerdictReadyBannerProps {
  /** Increments once per ready-edge. 0 = idle / never fired. */
  notifySeq: number;
  reducedMotion?: boolean;
  durationMs?: number;
}

export default function AbyssalVerdictReadyBanner({
  notifySeq,
  reducedMotion = false,
  durationMs = ABYSSAL_VERDICT_READY_NOTIFY_MS,
}: AbyssalVerdictReadyBannerProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const lastSeq = useRef(0);
  const opacity = useSharedValue(0);
  const slide = useSharedValue(-24);
  const edgePulse = useSharedValue(0);
  const barFlash = useSharedValue(0);

  useEffect(() => {
    if (notifySeq <= 0 || notifySeq === lastSeq.current) return;
    lastSeq.current = notifySeq;
    setVisible(true);

    cancelAnimation(opacity);
    cancelAnimation(slide);
    cancelAnimation(edgePulse);
    cancelAnimation(barFlash);

    const hold = Math.max(400, durationMs - 280);
    if (reducedMotion) {
      opacity.value = 1;
      slide.value = 0;
      barFlash.value = 1;
      edgePulse.value = 0.35;
      const t = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 160 });
        setTimeout(() => setVisible(false), 180);
      }, hold);
      return () => clearTimeout(t);
    }

    opacity.value = 0;
    slide.value = -28;
    barFlash.value = 0;
    edgePulse.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withDelay(hold, withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })),
    );
    slide.value = withSequence(
      withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withDelay(hold - 40, withTiming(18, { duration: 200, easing: Easing.in(Easing.quad) })),
    );
    barFlash.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0.35, { duration: 280 }),
      withDelay(hold - 200, withTiming(0, { duration: 180 })),
    );
    edgePulse.value = withSequence(
      withTiming(0.55, { duration: 160 }),
      withTiming(0.2, { duration: 320 }),
      withDelay(hold - 200, withTiming(0, { duration: 180 })),
    );

    const clear = setTimeout(() => setVisible(false), durationMs + 40);
    return () => clearTimeout(clear);
  }, [barFlash, durationMs, edgePulse, notifySeq, opacity, reducedMotion, slide]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: slide.value },
      { translateY: slide.value * 0.15 },
    ],
  }));
  const edgeStyle = useAnimatedStyle(() => ({
    opacity: edgePulse.value,
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + barFlash.value * 0.65,
  }));

  if (!visible) return null;

  return (
    <View style={styles.host} pointerEvents="none" testID="abyssal-verdict-ready-banner">
      <Animated.View style={[styles.edgeLeft, edgeStyle]} />
      <Animated.View style={[styles.edgeBottom, edgeStyle]} />
      <Animated.View style={[styles.banner, bannerStyle]}>
        <Animated.View style={[styles.reserveFlash, barStyle]} />
        <View style={styles.slash} />
        <Text style={styles.eyebrow}>{COPY.readyEyebrow}</Text>
        <Text style={styles.title}>{COPY.displayName}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 28,
  },
  edgeLeft: {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: OTT_LAYOUT.consoleHeightPercent,
    width: 10,
    backgroundColor: C.crimson,
    opacity: 0,
  },
  edgeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: OTT_LAYOUT.consoleHeightPercent,
    height: 6,
    backgroundColor: C.crimson,
    opacity: 0,
  },
  banner: {
    position: 'absolute',
    left: '6%',
    bottom: '32%',
    maxWidth: 340,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.panel,
    borderLeftWidth: 3,
    borderLeftColor: C.crimsonBright,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.crimsonBorder,
    transform: [{ skewX: '-12deg' }],
    overflow: 'hidden',
  },
  reserveFlash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: C.crimsonBright,
  },
  slash: {
    position: 'absolute',
    top: -4,
    right: 12,
    width: 48,
    height: 1,
    backgroundColor: C.violetAccent,
    transform: [{ rotate: '-28deg' }],
  },
  eyebrow: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    letterSpacing: 2,
    color: C.boneMuted,
    transform: [{ skewX: '12deg' }],
  },
  title: {
    fontFamily: OTT.mono,
    fontSize: 15,
    letterSpacing: 2.2,
    fontWeight: '700',
    color: C.bone,
    marginTop: 2,
    transform: [{ skewX: '12deg' }],
  },
});
