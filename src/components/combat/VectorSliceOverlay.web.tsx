import React, { useEffect, useMemo, useState } from 'react';
import {
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
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
const LINE_LENGTH_RATIO_CINEMATIC = 0.68;
const GLOW_WIDTH = 9;
const GLOW_WIDTH_CINEMATIC = 14;
const CORE_WIDTH = 4;
const CORE_WIDTH_CINEMATIC = 6;
export const ORIGIN_JITTER = 0.04;

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
  variant?: 'arena' | 'cinematic';
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
  variant = 'arena',
}: VectorSliceOverlayProps): React.JSX.Element | null {
  const isCinematic = variant === 'cinematic';
  const lineLengthRatio = isCinematic ? LINE_LENGTH_RATIO_CINEMATIC : LINE_LENGTH_RATIO;
  const glowWidth = isCinematic ? GLOW_WIDTH_CINEMATIC : GLOW_WIDTH;
  const coreWidth = isCinematic ? CORE_WIDTH_CINEMATIC : CORE_WIDTH;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [lineOpacity, setLineOpacity] = useState(0);
  const lineOpacitySV = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setSize({ w, h });
      onArenaLayout?.({ width: w, height: h });
    }
  };

  useEffect(() => {
    if (!visible || activeIndex < 0) {
      lineOpacitySV.value = 0;
      setLineOpacity(0);
      return;
    }
    lineOpacitySV.value = 0;
    lineOpacitySV.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    setLineOpacity(1);
  }, [visible, activeIndex, lineOpacitySV]);

  const halfLen = useMemo(() => {
    if (size.w <= 0 || size.h <= 0) return 0;
    return (Math.min(size.w, size.h) * lineLengthRatio) / 2;
  }, [lineLengthRatio, size.w, size.h]);

  const dimRadius = useMemo(
    () => (isCinematic ? 0 : (Math.min(size.w, size.h) * 0.46) / 2),
    [isCinematic, size.w, size.h],
  );

  if (!visible) return null;

  const renderLine = (line: SliceLineRender) => {
    if (activeIndex !== line.id || size.w <= 0) return null;
    const cx = size.w * line.centerXRatio;
    const cy = size.h * line.centerYRatio;
    const rad = degToRad(line.angleDeg);
    const dx = Math.cos(rad) * halfLen;
    const dy = Math.sin(rad) * halfLen;
    const x1 = cx - dx;
    const y1 = cy - dy;
    const x2 = cx + dx;
    const y2 = cy + dy;
    const sliced = line.isSliced;
    const glowColor = sliced ? SLICE_CRIMSON : SLICE_GLOW;
    const coreColor = sliced ? SLICE_CORE : '#ffffff';

    return (
      <React.Fragment key={line.id}>
        {sliced ? (
          <>
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#5c0606"
              strokeWidth={glowWidth + 6}
              strokeLinecap="round"
              opacity={lineOpacity}
            />
            <Line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#c41010"
              strokeWidth={glowWidth + 2}
              strokeLinecap="round"
              opacity={lineOpacity}
            />
          </>
        ) : null}
        <Line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={glowColor}
          strokeWidth={sliced ? glowWidth + 1 : glowWidth}
          strokeLinecap="round"
          opacity={(sliced ? 0.95 : 0.55) * lineOpacity}
        />
        <Line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={coreColor}
          strokeWidth={sliced ? coreWidth + 0.5 : coreWidth}
          strokeLinecap="round"
          opacity={lineOpacity}
        />
      </React.Fragment>
    );
  };

  const centerX = size.w / 2;
  const centerY = size.h / 2;

  return (
    <View style={styles.root} onLayout={onLayout} {...panHandlers}>
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          {dimRadius > 0 ? (
            <Circle cx={centerX} cy={centerY} r={dimRadius} fill={BACKDROP} />
          ) : null}
          {lines.map(renderLine)}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
});
