import React, { useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Line,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SLICE_CRIMSON = '#ff1744';
const SLICE_GLOW = '#ef4444';
const SLICE_CORE = '#ffe4e8';
const BACKDROP = 'rgba(0,0,0,0.32)';
export const LINE_LENGTH_RATIO = 0.52;
const GLOW_WIDTH = 9;
const CORE_WIDTH = 4;
const ORIGIN_JITTER = 0.04;

export interface SliceLineRender {
  id: number;
  centerXRatio: number;
  centerYRatio: number;
  angleDeg: number;
  isSliced: boolean;
}

interface VectorSliceOverlayProps {
  visible: boolean;
  lines: SliceLineRender[];
  activeIndex: number;
  panHandlers: object;
  onArenaLayout?: (layout: { width: number; height: number }) => void;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export default function VectorSliceOverlay({
  visible,
  lines,
  activeIndex,
  panHandlers,
  onArenaLayout,
}: VectorSliceOverlayProps): React.JSX.Element | null {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const lineOpacity = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setSize({ w, h });
      onArenaLayout?.({ width: w, height: h });
    }
  };

  useEffect(() => {
    if (!visible || activeIndex < 0) {
      lineOpacity.value = 0;
      return;
    }
    lineOpacity.value = 0;
    lineOpacity.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, activeIndex, lineOpacity]);

  const halfLen = useMemo(() => {
    if (size.w <= 0 || size.h <= 0) return 0;
    return (Math.min(size.w, size.h) * LINE_LENGTH_RATIO) / 2;
  }, [size.w, size.h]);

  const dimRadius = useMemo(
    () => (Math.min(size.w, size.h) * 0.46) / 2,
    [size.w, size.h],
  );

  if (!visible) return null;

  const renderLine = (line: SliceLineRender) => {
    if (activeIndex !== line.id || size.w <= 0) return null;
    const cx = size.w * line.centerXRatio;
    const cy = size.h * line.centerYRatio;
    const rad = degToRad(line.angleDeg);
    const dx = Math.cos(rad) * halfLen;
    const dy = Math.sin(rad) * halfLen;
    const p1 = vec(cx - dx, cy - dy);
    const p2 = vec(cx + dx, cy + dy);
    const sliced = line.isSliced;
    const glowColor = sliced ? SLICE_CRIMSON : SLICE_GLOW;
    const coreColor = sliced ? SLICE_CORE : '#ffffff';

    return (
      <Group key={line.id} opacity={lineOpacity}>
        {sliced ? (
          <Group>
            <Line
              p1={p1}
              p2={p2}
              color="#5c0606"
              strokeWidth={GLOW_WIDTH + 6}
              strokeCap="round"
            >
              <Blur blur={10} />
            </Line>
            <Line
              p1={p1}
              p2={p2}
              color="#c41010"
              strokeWidth={GLOW_WIDTH + 2}
              strokeCap="round"
            >
              <Blur blur={6} />
            </Line>
          </Group>
        ) : null}
        <Line
          p1={p1}
          p2={p2}
          color={glowColor}
          strokeWidth={sliced ? GLOW_WIDTH + 1 : GLOW_WIDTH}
          strokeCap="round"
          opacity={sliced ? 0.95 : 0.55}
        >
          <Blur blur={sliced ? 10 : 6} />
        </Line>
        <Line
          p1={p1}
          p2={p2}
          color={coreColor}
          strokeWidth={sliced ? CORE_WIDTH + 0.5 : CORE_WIDTH}
          strokeCap="round"
        />
      </Group>
    );
  };

  const centerX = size.w / 2;
  const centerY = size.h / 2;

  return (
    <View style={styles.root} onLayout={onLayout} {...panHandlers}>
      {size.w > 0 && size.h > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Circle
            cx={centerX}
            cy={centerY}
            r={dimRadius}
            color={BACKDROP}
          />
          {lines.map(renderLine)}
        </Canvas>
      ) : null}
    </View>
  );
}

export { ORIGIN_JITTER };

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
});
