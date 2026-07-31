/**
 * Aegis RUIN arena eruption — full 2×2 enemy battlefield overlay.
 * Fades in/out with light transparency; sits above the operative sprite.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { WARDEN_ARENA_PLANE } from '../../data/wardenArenaPlanes';

const RUIN_ERUPTION = require('../../../assets/vfx/aegis/ruin-ground-eruption.png');

const FADE_IN_MS = 120;
const HOLD_MS = 420;
const FADE_OUT_MS = 380;
/** Peak opacity — slight transparency so the arena still reads through. */
const PEAK_OPACITY = 0.65;

export default function CombatRuinArenaVfx(): React.JSX.Element | null {
  const { ui } = useCombatEnemyChrome();
  const opacity = useRef(new Animated.Value(0)).current;
  const lastSeqRef = useRef(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const seq = ui.ruinVfxSeq;
    if (seq <= 0 || seq === lastSeqRef.current) return;
    lastSeqRef.current = seq;

    opacity.stopAnimation();
    opacity.setValue(0);
    setActive(true);

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: PEAK_OPACITY,
        duration: FADE_IN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (finished) setActive(false);
    });
  }, [opacity, ui.ruinVfxSeq]);

  if (!active) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View style={[styles.frame, { opacity }]}>
        <Image
          source={RUIN_ERUPTION}
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Matches CombatEnemyGrid staggeredArena — full 2×2 battlefield frame. */
  host: {
    position: 'absolute',
    top: 0,
    right: 255,
    width: '48%',
    height: '100%',
    zIndex: WARDEN_ARENA_PLANE.wardenPlayer + 2,
    elevation: WARDEN_ARENA_PLANE.wardenPlayer + 2,
    overflow: 'visible',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  frame: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  image: {
    width: '115%',
    height: '100%',
  },
});
