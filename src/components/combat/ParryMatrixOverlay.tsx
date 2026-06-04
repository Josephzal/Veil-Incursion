import React, { useMemo, useState } from 'react';
import {
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
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

const MONO = 'monospace';
const PARRY_RING = '#e8d998';
const PARRY_RING_BRIGHT = '#f5ecc8';
const PARRY_SWEET = '#fff8dc';
const PARRY_SUCCESS = '#fff9c4';
const PARRY_FAIL = '#ef4444';
const RING_SIZE_RATIO = 0.38;
const INNER_STROKE = 4;
const OUTER_STROKE = 1.5;
const SWEET_STROKE = 2;

interface ParryMatrixOverlayProps {
  visible: boolean;
  shrinkScale: SharedValue<number>;
  success: boolean;
  failure: boolean;
  onTap: () => void;
}

export default function ParryMatrixOverlay({
  visible,
  shrinkScale,
  success,
  failure,
  onTap,
}: ParryMatrixOverlayProps): React.JSX.Element | null {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setSize({ w, h });
  };

  const cx = size.w / 2;
  const cy = size.h / 2;
  const baseR = useMemo(
    () => (Math.min(size.w, size.h) * RING_SIZE_RATIO) / 2,
    [size.w, size.h],
  );

  const outerRadius = useDerivedValue(() => baseR * shrinkScale.value);
  const outerOpacity = useDerivedValue(() => (failure ? 0.35 : success ? 0.2 : 0.9));

  if (!visible) return null;

  const innerColor = success ? PARRY_SUCCESS : failure ? PARRY_FAIL : PARRY_RING_BRIGHT;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap} />
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
            {success ? (
              <Circle
                cx={cx}
                cy={cy}
                r={baseR * 0.42}
                color={PARRY_SUCCESS}
                opacity={0.4}
                style="stroke"
                strokeWidth={8}
              >
                <Blur blur={12} />
              </Circle>
            ) : null}
          </Group>
        </Canvas>
      ) : null}
      <Text style={styles.hint} pointerEvents="none">
        COUNTER STANCE — TAP ON RING COLLISION
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
    backgroundColor: 'rgba(0,0,0,0.28)',
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
