import React, { useEffect, useMemo, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import {
  Blur,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
} from '@shopify/react-native-skia';
import {
  type SharedValue,
  useDerivedValue,
} from 'react-native-reanimated';
import {
  computeParryArenaLayout,
  getParryCenterHitRadius,
  PARRY_OUTER_RING_STROKE,
  PARRY_RING_SIZE_RATIO,
  PARRY_STATIC_RING_STROKE,
  PARRY_SWEET_RING_STROKE,
  type ParryArenaLayout,
} from '../../utils/parryCollision';

const MONO = 'monospace';
const PARRY_RING = '#e8d998';
const PARRY_RING_BRIGHT = '#f5ecc8';
const PARRY_SWEET = '#fff8dc';
const CENTER_DOT_RADIUS = 5;
/** Centered parry arena as a share of the shorter screen axis. */
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

  const outerRadius = useDerivedValue(() => baseR * shrinkScale.value);

  const handlePress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    onTap(locationX, locationY);
  };

  useEffect(() => {
    if (!visible || arenaSize.w <= 0 || Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      if (event.repeat) return;
      event.preventDefault();
      onTap(arenaSize.w / 2, arenaSize.h / 2);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [arenaSize.h, arenaSize.w, onTap, visible]);

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
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              <Group>
                <Circle cx={cx} cy={cy} r={baseR + 12} color="rgba(0,0,0,0.35)" style="fill" />
                <Circle cx={cx} cy={cy} r={baseR + 16} color={PARRY_RING} opacity={0.08} style="fill">
                  <Blur blur={14} />
                </Circle>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={baseR}
                  color={PARRY_SWEET}
                  opacity={0.22}
                  style="stroke"
                  strokeWidth={PARRY_SWEET_RING_STROKE}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={baseR}
                  color={PARRY_RING_BRIGHT}
                  style="stroke"
                  strokeWidth={PARRY_STATIC_RING_STROKE}
                />
                <Circle
                  cx={cx}
                  cy={cy}
                  r={outerRadius}
                  color={PARRY_RING_BRIGHT}
                  opacity={0.9}
                  style="stroke"
                  strokeWidth={PARRY_OUTER_RING_STROKE}
                >
                  <DashPathEffect intervals={[8, 6]} />
                </Circle>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={centerHitR}
                  color={PARRY_SWEET}
                  opacity={0.12}
                  style="stroke"
                  strokeWidth={1}
                />
                <Circle cx={cx} cy={cy} r={CENTER_DOT_RADIUS} color={PARRY_RING_BRIGHT} opacity={0.85} />
              </Group>
            </Canvas>
          ) : null}
          <HapticPressable style={styles.tapCapture} onPress={handlePress} />
        </View>
      ) : null}

      <Text style={styles.hint} pointerEvents="none">
        {Platform.OS === 'web'
          ? 'PRESS SPACE OR TAP INSIDE RING WHEN RINGS COLLIDE'
          : 'TAP INSIDE RING WHEN RINGS COLLIDE'}
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
