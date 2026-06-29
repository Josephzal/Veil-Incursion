import React, { useMemo, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import HapticPressable from '../HapticPressable';
import {
  computeParryArenaLayout,
  getParryCenterHitRadius,
  PARRY_RING_SIZE_RATIO,
  type ParryArenaLayout,
} from '../../utils/parryCollision';

const MONO = 'monospace';
const PARRY_RING = '#e8d998';
const PARRY_RING_BRIGHT = '#f5ecc8';
const PARRY_SWEET = '#fff8dc';
const CENTER_DOT_RADIUS = 5;
const PARRY_ARENA_SCREEN_RATIO = 0.58;

interface ParryMatrixOverlayProps {
  visible: boolean;
  shrinkScale: SharedValue<number>;
  success: boolean;
  failure: boolean;
  onTap: (tapX: number, tapY: number) => void;
  onArenaLayout?: (layout: ParryArenaLayout) => void;
}

export default function ParryMatrixOverlay({
  visible,
  shrinkScale,
  onTap,
  onArenaLayout: registerArenaLayout,
}: ParryMatrixOverlayProps): React.JSX.Element | null {
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const [arenaSize, setArenaSize] = useState({ w: 0, h: 0 });

  const onScreenLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setScreen({ w, h });
    }
  };

  const onArenaBoxLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setArenaSize({ w, h });
      registerArenaLayout?.(computeParryArenaLayout(w, h));
    }
  };

  const arenaDim = useMemo(() => {
    if (screen.w <= 0 || screen.h <= 0) return 0;
    return Math.floor(Math.min(screen.w, screen.h) * PARRY_ARENA_SCREEN_RATIO);
  }, [screen.h, screen.w]);

  const cx = arenaSize.w / 2;
  const cy = arenaSize.h / 2;
  const baseR = useMemo(
    () => (Math.min(arenaSize.w, arenaSize.h) * PARRY_RING_SIZE_RATIO) / 2,
    [arenaSize.w, arenaSize.h],
  );

  const centerHitR = useMemo(
    () => (arenaSize.w > 0 ? getParryCenterHitRadius({ width: arenaSize.w, height: arenaSize.h, cx, cy, baseR }) : 0),
    [arenaSize.w, arenaSize.h, cx, cy, baseR],
  );

  const outerRingStyle = useAnimatedStyle(() => ({
    width: baseR * 2 * shrinkScale.value,
    height: baseR * 2 * shrinkScale.value,
    borderRadius: baseR * shrinkScale.value,
    left: cx - baseR * shrinkScale.value,
    top: cy - baseR * shrinkScale.value,
  }));

  const handlePress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    onTap(locationX, locationY);
  };

  if (!visible) return null;

  return (
    <View style={styles.root} onLayout={onScreenLayout} pointerEvents="box-none" collapsable={false}>
      <View style={styles.scrim} pointerEvents="none" />

      {arenaDim > 0 ? (
        <View
          style={[styles.arena, { width: arenaDim, height: arenaDim }]}
          onLayout={onArenaBoxLayout}
        >
          {arenaSize.w > 0 && arenaSize.h > 0 ? (
            <>
              <Svg
                width={arenaSize.w}
                height={arenaSize.h}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                <Circle
                  cx={cx}
                  cy={cy}
                  r={baseR + 12}
                  fill="rgba(0,0,0,0.35)"
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={baseR}
                  fill="none"
                  stroke={PARRY_SWEET}
                  strokeWidth={2}
                  opacity={0.2}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={baseR}
                  fill="none"
                  stroke={PARRY_RING_BRIGHT}
                  strokeWidth={4}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={centerHitR}
                  fill="none"
                  stroke={PARRY_SWEET}
                  strokeWidth={1}
                  opacity={0.12}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={CENTER_DOT_RADIUS}
                  fill={PARRY_RING_BRIGHT}
                  opacity={0.85}
                />
              </Svg>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.outerRing,
                  { borderColor: PARRY_RING_BRIGHT },
                  outerRingStyle,
                ]}
              />
            </>
          ) : null}
          <HapticPressable style={styles.tapCapture} onPress={handlePress} />
        </View>
      ) : null}

      <Text style={styles.hint} pointerEvents="none">
        TAP CENTER WHEN RINGS COLLIDE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    elevation: 30,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    zIndex: 0,
  },
  arena: {
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 1.5,
    opacity: 0.9,
  },
  tapCapture: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  hint: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'center',
    color: PARRY_RING_BRIGHT,
    zIndex: 2,
  },
});
