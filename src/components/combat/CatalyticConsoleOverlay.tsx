import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import HapticPressable from '../HapticPressable';
import { COMBAT_MINIGAME_GREEN as GREEN } from '../../constants/combatMinigameTheme';
import {
  CATALYTIC_RING_MAX_CHARGE_SCALE,
  CATALYTIC_RING_STROKE_SCALE,
  CATALYTIC_RING_TOUCH_SCALE,
  isCatalyticReleaseOvercharge,
  isCatalyticReleasePerfect,
} from '../../data/envoyRotEngine';

/** Board-wide catalytic hold & release — inner ring expands until it meets the outer target. */
const EXPANSION_RATE = 0.024;
const TICK_MS = 16;
const FAIL_BURST_MS = 520;
const IS_WEB = Platform.OS === 'web';

interface CatalyticConsoleOverlayProps {
  visible: boolean;
  rotStacksTotal: number;
  payloadEstimate: number;
  onRelease: (overlapRatio: number) => void;
}

function CatalyticConsoleOverlay({
  visible,
  rotStacksTotal,
  payloadEstimate,
  onRelease,
}: CatalyticConsoleOverlayProps): React.JSX.Element | null {
  const [holding, setHolding] = useState(false);
  const [chargeRatio, setChargeRatio] = useState(0);
  const [failBurstEpoch, setFailBurstEpoch] = useState(0);
  const innerScale = useSharedValue(0);
  const burstScale = useSharedValue(0.4);
  const burstOpacity = useSharedValue(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const innerRatioRef = useRef(0);
  const resolvedRef = useRef(false);
  const onReleaseRef = useRef(onRelease);
  onReleaseRef.current = onRelease;

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const finishRelease = useCallback((overlapRatio: number) => {
    onReleaseRef.current(overlapRatio);
  }, []);

  const playOverchargeBurst = useCallback((overlapRatio: number) => {
    setFailBurstEpoch((epoch) => epoch + 1);
    burstScale.value = 0.45;
    burstOpacity.value = 0.9;
    burstScale.value = withTiming(2.4, {
      duration: FAIL_BURST_MS,
      easing: Easing.out(Easing.cubic),
    });
    burstOpacity.value = withTiming(0, {
      duration: FAIL_BURST_MS,
      easing: Easing.out(Easing.cubic),
    }, () => {
      runOnJS(finishRelease)(overlapRatio);
    });
  }, [burstOpacity, burstScale, finishRelease]);

  const resolveRelease = useCallback((overlapRatio: number, forcedOvercharge = false) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setHolding(false);
    clearTick();

    const overcharge = forcedOvercharge || isCatalyticReleaseOvercharge(overlapRatio);
    if (overcharge) {
      playOverchargeBurst(overlapRatio);
      return;
    }
    finishRelease(overlapRatio);
  }, [clearTick, finishRelease, playOverchargeBurst]);

  const tickCharge = useCallback(() => {
    if (resolvedRef.current) return;
    const next = innerRatioRef.current + EXPANSION_RATE;
    if (next >= CATALYTIC_RING_MAX_CHARGE_SCALE) {
      innerRatioRef.current = CATALYTIC_RING_MAX_CHARGE_SCALE;
      innerScale.value = CATALYTIC_RING_MAX_CHARGE_SCALE;
      setChargeRatio(CATALYTIC_RING_MAX_CHARGE_SCALE);
      resolveRelease(CATALYTIC_RING_MAX_CHARGE_SCALE, true);
      return;
    }
    innerRatioRef.current = next;
    innerScale.value = next;
    setChargeRatio(next);
  }, [innerScale, resolveRelease]);

  const startHold = useCallback(() => {
    if (resolvedRef.current || !visible) return;
    setHolding(true);
    clearTick();
    tickRef.current = setInterval(tickCharge, TICK_MS);
  }, [clearTick, tickCharge, visible]);

  const endHold = useCallback(() => {
    if (resolvedRef.current || !visible) return;
    resolveRelease(innerRatioRef.current);
  }, [resolveRelease, visible]);

  useEffect(() => {
    if (!visible) {
      resolvedRef.current = false;
      innerRatioRef.current = 0;
      innerScale.value = 0;
      burstOpacity.value = 0;
      setChargeRatio(0);
      setHolding(false);
      clearTick();
      return;
    }
    resolvedRef.current = false;
    innerRatioRef.current = 0;
    innerScale.value = 0;
    burstOpacity.value = 0;
    setChargeRatio(0);
  }, [burstOpacity, clearTick, innerScale, visible]);

  useEffect(() => {
    if (!visible || !IS_WEB || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.repeat) return;
      event.preventDefault();
      startHold();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      event.preventDefault();
      endHold();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [endHold, startHold, visible]);

  const innerStyle = useAnimatedStyle(() => {
    const pastTouch = innerScale.value >= CATALYTIC_RING_TOUCH_SCALE;
    return {
      transform: [{ scale: innerScale.value }],
      opacity: 0.35 + innerScale.value * 0.45,
      borderColor: pastTouch ? GREEN.active : GREEN.ringSoft,
      backgroundColor: pastTouch ? GREEN.fillStrong : GREEN.fill,
    };
  });

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ scale: burstScale.value }],
  }));

  if (!visible) return null;

  const inPassWindow = isCatalyticReleasePerfect(chargeRatio);
  const pastTouch = chargeRatio >= CATALYTIC_RING_TOUCH_SCALE;
  const hint = holding
    ? (pastTouch && !inPassWindow
      ? 'OVERCHARGE — RELEASE NOW'
      : inPassWindow
        ? 'RELEASE — RINGS ALIGNED'
        : 'RELEASE ON RING OVERLAP')
    : (IS_WEB ? 'HOLD [SPACE] OR TAP TO CHARGE CATALYST' : 'HOLD TO CHARGE CATALYST');

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <HapticPressable
        style={styles.arena}
        onPressIn={startHold}
        onPressOut={endHold}
      >
        <View style={styles.outerRing} />
        <Animated.View style={[styles.innerCircle, innerStyle]} />
        {failBurstEpoch > 0 ? (
          <Animated.View
            key={`catalytic-fail-burst-${failBurstEpoch}`}
            style={[styles.failBurst, burstStyle]}
            pointerEvents="none"
          />
        ) : null}
        <Text style={styles.meta}>
          {`ROT // ${rotStacksTotal} STACKS — ~${payloadEstimate} OCCULT PAYLOAD`}
        </Text>
        <Text style={styles.hint}>{hint}</Text>
      </HapticPressable>
    </View>
  );
}

export default memo(CatalyticConsoleOverlay);

const CATALYST_SCALE = 1.5;
const INNER_RING = Math.round(220 * 1.15 * CATALYST_SCALE);
const OUTER_RING = Math.round(INNER_RING * 1.2);
const OUTER_RING_BORDER = 10 * CATALYTIC_RING_STROKE_SCALE;
const INNER_RING_BORDER = 8 * CATALYTIC_RING_STROKE_SCALE;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GREEN.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arena: {
    width: OUTER_RING + 40,
    height: OUTER_RING + 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: OUTER_RING,
    height: OUTER_RING,
    borderRadius: OUTER_RING / 2,
    borderWidth: OUTER_RING_BORDER,
    borderColor: GREEN.ring,
    position: 'absolute',
  },
  innerCircle: {
    width: INNER_RING * 0.92,
    height: INNER_RING * 0.92,
    borderRadius: (INNER_RING * 0.92) / 2,
    backgroundColor: GREEN.fill,
    borderWidth: INNER_RING_BORDER,
    borderColor: GREEN.ringSoft,
    position: 'absolute',
  },
  failBurst: {
    position: 'absolute',
    width: OUTER_RING,
    height: OUTER_RING,
    borderRadius: OUTER_RING / 2,
    borderWidth: OUTER_RING_BORDER * 1.4,
    borderColor: GREEN.ring,
    backgroundColor: GREEN.fillStrong,
    shadowColor: GREEN.active,
    shadowOpacity: 0.85,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  meta: {
    position: 'absolute',
    top: 0,
    fontFamily: 'monospace',
    fontSize: 7,
    color: GREEN.text,
    letterSpacing: 0.5,
    textAlign: 'center',
    width: OUTER_RING + 40,
  },
  hint: {
    position: 'absolute',
    bottom: 0,
    fontFamily: 'monospace',
    fontSize: 8,
    color: GREEN.textBright,
    letterSpacing: 0.6,
    textAlign: 'center',
    width: OUTER_RING + 40,
  },
});
