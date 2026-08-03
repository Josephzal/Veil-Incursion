/**
 * Target-local ABYSSAL VERDICT contact FX.
 * Bound to stable unitId — never DOM order or last-child.
 *
 * Hit: larger lingering slash afterimage + impact burst.
 * Evade/Miss: streak passes beyond target — no contact burst / flash / recoil.
 * Cut-line streaks are intentionally omitted (recording feedback).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { ABYSSAL_VERDICT_ART } from '../../data/abyssalVerdictArt';
import {
  abyssalVerdictTargetReceivesCinematicImpact,
  abyssalVerdictTargetReceivesEvadePass,
  getAbyssalVerdictTimeline,
  subscribeAbyssalVerdictPresentation,
  type AbyssalVerdictPresentationEvent,
} from '../../data/abyssalVerdictPresentation';

interface AbyssalVerdictTargetFxProps {
  unitId: string;
}

export default function AbyssalVerdictTargetFx({
  unitId,
}: AbyssalVerdictTargetFxProps): React.JSX.Element | null {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'hit' | 'evade' | null>(null);
  const slash = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(0.85)).current;
  const passOffset = useRef(new Animated.Value(0)).current;
  const slashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundTokenRef = useRef(0);
  const mountedRef = useRef(true);

  const clearSlashTimer = () => {
    if (slashTimer.current) {
      clearTimeout(slashTimer.current);
      slashTimer.current = null;
    }
  };

  const hardReset = () => {
    clearSlashTimer();
    slash.stopAnimation();
    burst.stopAnimation();
    burstScale.stopAnimation();
    passOffset.stopAnimation();
    slash.setValue(0);
    burst.setValue(0);
    burstScale.setValue(0.85);
    passOffset.setValue(0);
    setMode(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hardReset();
      boundTokenRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => subscribeAbyssalVerdictPresentation((event: AbyssalVerdictPresentationEvent) => {
    if (!mountedRef.current) return;

    if (event.phase === 'idle' || event.phase === 'done') {
      if (boundTokenRef.current === 0) {
        hardReset();
        setActive(false);
        return;
      }
      const linger = getAbyssalVerdictTimeline(event.reducedMotion).contactFxLingerMs;
      const token = boundTokenRef.current;
      clearSlashTimer();
      Animated.parallel([
        Animated.timing(slash, {
          toValue: 0,
          duration: Math.max(120, linger),
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(burst, {
          toValue: 0,
          duration: Math.max(140, linger + 40),
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(() => {
        if (!mountedRef.current || boundTokenRef.current !== token) return;
        boundTokenRef.current = 0;
        hardReset();
        setActive(false);
      });
      return;
    }

    if (boundTokenRef.current !== 0 && event.activationToken !== boundTokenRef.current) {
      return;
    }

    const isHit = abyssalVerdictTargetReceivesCinematicImpact(event.result, unitId);
    const isEvade = abyssalVerdictTargetReceivesEvadePass(event.result, unitId);
    if (!isHit && !isEvade) {
      if (event.phase === 'recovery') {
        hardReset();
        setActive(false);
      }
      return;
    }

    if (boundTokenRef.current === 0) {
      boundTokenRef.current = event.activationToken;
    }

    const tl = getAbyssalVerdictTimeline(event.reducedMotion);
    setActive(true);
    setMode(isHit ? 'hit' : 'evade');

    if (event.phase === 'release' || event.phase === 'delayed_cut') {
      clearSlashTimer();
      const delay = event.phase === 'release'
        ? Math.max(0, tl.slashStart - tl.releaseStart)
        : 0;
      const token = event.activationToken;
      slashTimer.current = setTimeout(() => {
        if (!mountedRef.current || boundTokenRef.current !== token) return;
        slash.stopAnimation();
        slash.setValue(0);
        passOffset.stopAnimation();
        passOffset.setValue(isEvade ? 10 : 0);
        const holdMs = Math.max(120, Math.floor(tl.slashLifetimeMs * 0.55));
        const fadeMs = Math.max(80, tl.slashLifetimeMs - holdMs);
        Animated.parallel([
          Animated.sequence([
            Animated.timing(slash, {
              toValue: 1,
              duration: 40,
              easing: Easing.out(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
            Animated.delay(holdMs),
            Animated.timing(slash, {
              toValue: 0,
              duration: fadeMs,
              easing: Easing.in(Easing.quad),
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          isEvade
            ? Animated.timing(passOffset, {
              toValue: 22,
              duration: Math.max(80, tl.slashLifetimeMs),
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE_DRIVER,
            })
            : Animated.timing(passOffset, {
              toValue: 0,
              duration: 1,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
        ]).start();
      }, delay);
      if (event.phase === 'release') {
        burst.stopAnimation();
        burst.setValue(0);
      }
      return;
    }

    if (event.phase === 'impact') {
      if (!isHit) {
        burst.stopAnimation();
        burst.setValue(0);
        return;
      }
      burst.stopAnimation();
      burstScale.stopAnimation();
      burstScale.setValue(0.78);
      burst.setValue(0.85);
      const fadeMs = Math.max(360, tl.impactBurstFadeMs);
      Animated.parallel([
        Animated.timing(burstScale, {
          toValue: tl.impactBurstScale,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(burst, {
          toValue: 0,
          duration: fadeMs,
          delay: 60,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
      return;
    }

    // Recovery: let slash / burst finish their own fades — do not cut them short.
  }), [burst, burstScale, passOffset, slash, unitId]);

  if (!active) return null;

  const tl = getAbyssalVerdictTimeline(false);
  const slashScale = tl.slashScale;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.Image
        source={ABYSSAL_VERDICT_ART.slashAfterimage}
        style={[
          styles.slash,
          mode === 'evade' ? styles.slashEvade : null,
          {
            opacity: slash,
            transform: [
              { translateX: passOffset },
              { scale: slashScale },
              { rotate: '-10deg' },
            ],
          },
        ]}
        resizeMode="contain"
      />
      {mode === 'hit' ? (
        <Animated.Image
          source={ABYSSAL_VERDICT_ART.impactBurst}
          style={[
            styles.burst,
            { opacity: burst, transform: [{ scale: burstScale }] },
          ]}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 18,
    elevation: 18,
    overflow: 'visible',
    pointerEvents: 'none',
  },
  slash: {
    position: 'absolute',
    // Centered on the enemy portrait body — oversized afterimage.
    left: '50%',
    top: '48%',
    width: '168%',
    height: '102%',
    marginLeft: '-84%',
    marginTop: '-51%',
  },
  slashEvade: {
    left: '58%',
    top: '46%',
    width: '178%',
    height: '102%',
    marginLeft: '-89%',
    marginTop: '-51%',
  },
  burst: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: '110%',
    height: '86%',
    marginLeft: '-55%',
    marginTop: '-43%',
  },
});
