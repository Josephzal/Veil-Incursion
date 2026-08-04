/**
 * ABYSSAL VERDICT targeting brackets — crimson SVG L-corners.
 * Hover glow tuned in `data/reticleHoverGlow.ts` (shared with ability brackets).
 */

import React, { useEffect, useId, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import {
  ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS,
  ABYSSAL_VERDICT_UI_COLORS as C,
} from '../../data/abyssalVerdictReadyUi';
import {
  RETICLE_HOVER_GLOW as GLOW,
  reticleHoverWebGlowStyle,
} from '../../data/reticleHoverGlow';

export interface AbyssalVerdictTargetBracketsProps {
  active?: boolean;
  focused?: boolean;
  collapsing?: boolean;
  reducedMotion?: boolean;
  contentScale?: number;
}

const ARM = 0.22;

export default function AbyssalVerdictTargetBrackets({
  active = true,
  focused = false,
  collapsing = false,
  reducedMotion = false,
  contentScale = 1,
}: AbyssalVerdictTargetBracketsProps): React.JSX.Element | null {
  const pulse = useSharedValue(0.7);
  const collapse = useSharedValue(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reactId = useId();
  const filterSafeId = reactId.replace(/:/g, '');

  useEffect(() => {
    if (!active) {
      cancelAnimation(pulse);
      cancelAnimation(collapse);
      pulse.value = 0.7;
      collapse.value = 0;
      return;
    }
    if (collapsing) {
      cancelAnimation(pulse);
      if (reducedMotion) {
        collapse.value = 1;
        return;
      }
      collapse.value = withTiming(1, {
        duration: ABYSSAL_VERDICT_BRACKET_COLLAPSE_MS,
        easing: Easing.in(Easing.cubic),
      });
      return;
    }
    collapse.value = 0;
    if (reducedMotion) {
      pulse.value = focused ? 1 : 0.78;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(focused ? 1 : 0.95, {
          duration: focused ? 700 : 1200,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(focused ? 0.9 : 0.68, {
          duration: focused ? 700 : 1200,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(collapse);
    };
  }, [active, collapsing, collapse, focused, pulse, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: (focused ? 1 : pulse.value) * (1 - collapse.value * 0.4),
    transform: [{ scale: 1 - collapse.value * 0.28 }],
  }));

  if (!active) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    if (Math.abs(width - size.w) < 0.5 && Math.abs(height - size.h) < 0.5) return;
    setSize({ w: width, h: height });
  };

  const color = focused ? C.crimsonBright : '#A02837';
  const inset = 3;
  const w = size.w;
  const h = size.h;
  const arm = Math.max(16, Math.min(w, h) * ARM);
  const stroke = focused ? GLOW.strokeHover : GLOW.strokeIdle;
  const ready = w > 0 && h > 0;
  const paths = ready
    ? [
        `M ${inset} ${inset + arm} L ${inset} ${inset} L ${inset + arm} ${inset}`,
        `M ${w - inset - arm} ${inset} L ${w - inset} ${inset} L ${w - inset} ${inset + arm}`,
        `M ${inset} ${h - inset - arm} L ${inset} ${h - inset} L ${inset + arm} ${h - inset}`,
        `M ${w - inset - arm} ${h - inset} L ${w - inset} ${h - inset} L ${w - inset} ${h - inset - arm}`,
      ]
    : [];

  const glowStyle = focused && Platform.OS === 'web'
    ? reticleHoverWebGlowStyle(color)
    : null;

  return (
    <View style={styles.root} pointerEvents="none" onLayout={onLayout}>
      <View style={[styles.glowHost, glowStyle]} pointerEvents="none">
        <View
          style={[
            styles.scaleHost,
            contentScale !== 1 ? { transform: [{ scale: contentScale }] } : null,
          ]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.fill, animStyle]} pointerEvents="none">
            {ready ? (
              <Svg width={w} height={h} style={styles.svg}>
                {focused
                  ? paths.flatMap((d, i) =>
                    GLOW.passes.map((pass, pi) => (
                      <Path
                        key={`${filterSafeId}-g-${i}-${pi}`}
                        d={d}
                        stroke={color}
                        strokeWidth={stroke + pass.extra}
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                        fill="none"
                        opacity={pass.opacity}
                      />
                    )))
                  : null}
                {paths.map((d, i) => (
                  <Path
                    key={`${filterSafeId}-c-${i}`}
                    d={d}
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                    fill="none"
                    opacity={1}
                  />
                ))}
              </Svg>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: '2%',
    right: '6%',
    bottom: '4%',
    left: '6%',
    zIndex: 17,
    overflow: 'visible',
  },
  glowHost: {
    ...StyleSheet.absoluteFill,
    overflow: 'visible',
  },
  scaleHost: {
    ...StyleSheet.absoluteFill,
    overflow: 'visible',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'visible',
  },
  svg: {
    overflow: 'visible',
  },
});
