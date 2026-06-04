import React, { useEffect, useMemo, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
} from '@shopify/react-native-skia';
import {
  Easing,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
const PARRY_SUCCESS = '#fff9c4';
const PARRY_FAIL = '#ef4444';
const INNER_STROKE = 4;
const OUTER_STROKE = 1.5;
const SWEET_STROKE = 2;
const CENTER_DOT_RADIUS = 5;
const HALO_DURATION_MS = 580;
const HALO_RIPPLE_DELAYS = [0, 0.14, 0.28] as const;

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
  success,
  failure,
  onTap,
  onArenaLayout,
}: ParryMatrixOverlayProps): React.JSX.Element | null {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setSize({ w, h });
      onArenaLayout?.(computeParryArenaLayout(w, h));
    }
  };

  const cx = size.w / 2;
  const cy = size.h / 2;
  const baseR = useMemo(
    () => (Math.min(size.w, size.h) * PARRY_RING_SIZE_RATIO) / 2,
    [size.w, size.h],
  );

  const centerHitR = useMemo(
    () => (size.w > 0 ? getParryCenterHitRadius({ width: size.w, height: size.h, cx, cy, baseR }) : 0),
    [size.w, size.h, cx, cy, baseR],
  );

  const outerRadius = useDerivedValue(() => baseR * shrinkScale.value);
  const outerOpacity = useDerivedValue(() => (failure ? 0.35 : success ? 0.2 : 0.9));

  const haloProgress = useSharedValue(0);

  useEffect(() => {
    if (!success) {
      haloProgress.value = 0;
      return;
    }
    haloProgress.value = 0;
    haloProgress.value = withTiming(1, {
      duration: HALO_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [success, haloProgress]);

  const haloRadius0 = useDerivedValue(() => {
    const p = Math.max(0, Math.min(1, haloProgress.value));
    return baseR * (0.35 + p * 2.75);
  });
  const haloOpacity0 = useDerivedValue(() => {
    if (!success) return 0;
    const p = Math.max(0, Math.min(1, haloProgress.value));
    return (1 - p) * 0.72;
  });
  const haloRadius1 = useDerivedValue(() => {
    const p = Math.max(0, Math.min(1, (haloProgress.value - HALO_RIPPLE_DELAYS[1]) / (1 - HALO_RIPPLE_DELAYS[1])));
    return baseR * (0.35 + p * 2.75);
  });
  const haloOpacity1 = useDerivedValue(() => {
    if (!success) return 0;
    const p = Math.max(0, Math.min(1, (haloProgress.value - HALO_RIPPLE_DELAYS[1]) / (1 - HALO_RIPPLE_DELAYS[1])));
    return (1 - p) * 0.55;
  });
  const haloRadius2 = useDerivedValue(() => {
    const p = Math.max(0, Math.min(1, (haloProgress.value - HALO_RIPPLE_DELAYS[2]) / (1 - HALO_RIPPLE_DELAYS[2])));
    return baseR * (0.35 + p * 2.75);
  });
  const haloOpacity2 = useDerivedValue(() => {
    if (!success) return 0;
    const p = Math.max(0, Math.min(1, (haloProgress.value - HALO_RIPPLE_DELAYS[2]) / (1 - HALO_RIPPLE_DELAYS[2])));
    return (1 - p) * 0.4;
  });

  const handlePress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    onTap(locationX, locationY);
  };

  if (!visible) return null;

  const innerColor = success ? PARRY_SUCCESS : failure ? PARRY_FAIL : PARRY_RING_BRIGHT;

  return (
    <View style={styles.root} onLayout={onLayout} pointerEvents="box-none" collapsable={false}>
      {size.w > 0 && size.h > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group>
            <Circle
              cx={cx}
              cy={cy}
              r={baseR + 12}
              color="rgba(0,0,0,0.35)"
              style="fill"
            />
            <Circle
              cx={cx}
              cy={cy}
              r={baseR + 16}
              color={PARRY_RING}
              opacity={0.08}
              style="fill"
            >
              <Blur blur={14} />
            </Circle>
            <Circle
              cx={cx}
              cy={cy}
              r={baseR}
              color={PARRY_SWEET}
              opacity={success ? 0.55 : 0.2}
              style="stroke"
              strokeWidth={SWEET_STROKE}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={baseR}
              color={innerColor}
              style="stroke"
              strokeWidth={INNER_STROKE}
            />
            <Circle
              cx={cx}
              cy={cy}
              r={outerRadius}
              color={PARRY_RING_BRIGHT}
              opacity={outerOpacity}
              style="stroke"
              strokeWidth={OUTER_STROKE}
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
            <Circle
              cx={cx}
              cy={cy}
              r={CENTER_DOT_RADIUS}
              color={PARRY_RING_BRIGHT}
              opacity={0.85}
            />
            {success ? (
              <>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={haloRadius2}
                  color={PARRY_SUCCESS}
                  opacity={haloOpacity2}
                  style="stroke"
                  strokeWidth={10}
                >
                  <Blur blur={16} />
                </Circle>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={haloRadius1}
                  color={PARRY_RING_BRIGHT}
                  opacity={haloOpacity1}
                  style="stroke"
                  strokeWidth={8}
                >
                  <Blur blur={12} />
                </Circle>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={haloRadius0}
                  color={PARRY_SUCCESS}
                  opacity={haloOpacity0}
                  style="fill"
                >
                  <Blur blur={20} />
                </Circle>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={haloRadius0}
                  color={PARRY_RING_BRIGHT}
                  opacity={haloOpacity0}
                  style="stroke"
                  strokeWidth={3}
                />
              </>
            ) : null}
          </Group>
        </Canvas>
      ) : null}
      <Text style={styles.hint} pointerEvents="none">
        TAP CENTER WHEN RINGS COLLIDE
      </Text>
      <Pressable style={styles.tapCapture} onPress={handlePress} />
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
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  tapCapture: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  hint: {
    position: 'absolute',
    bottom: 12,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1,
    textAlign: 'center',
    width: '100%',
    color: PARRY_RING_BRIGHT,
  },
});
