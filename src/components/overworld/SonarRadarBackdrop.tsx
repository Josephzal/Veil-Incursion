import React, { useEffect } from 'react';
import {
  BlurMask,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SLATE_BLACK, TERMINAL_GREEN } from '../../utils/overworldRadarProjection';

const SONAR_RING_RADII = [68, 118, 168] as const;
const GRID_STEP = 38;
const MAJOR_GRID_STEP = 152;

interface SonarRadarBackdropProps {
  width: number;
  height: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
}

export function SonarScreenHud({
  width,
  height,
}: {
  width: number;
  height: number;
}): React.JSX.Element | null {
  const cx = width / 2;
  const cy = height / 2;
  const sweepAngle = useSharedValue(0);

  useEffect(() => {
    sweepAngle.value = withRepeat(
      withTiming(360, { duration: 4200, easing: Easing.linear }),
      -1,
      false,
    );
  }, [sweepAngle]);

  const sweepTransform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: (sweepAngle.value * Math.PI) / 180 },
    { translateX: -cx },
    { translateY: -cy },
  ]);

  if (width <= 0 || height <= 0) return null;

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} color={SLATE_BLACK} />
      {SONAR_RING_RADII.map((radius) => (
        <Circle
          key={`sonar-${radius}`}
          cx={cx}
          cy={cy}
          r={radius}
          color="rgba(0, 255, 51, 0.12)"
          style="stroke"
          strokeWidth={1}
          opacity={0.65 - radius * 0.0018}
        >
          <DashPathEffect intervals={[4, 10]} />
        </Circle>
      ))}
      <Circle cx={cx} cy={cy} r={SONAR_RING_RADII[2] + 8} color="rgba(0, 255, 51, 0.05)">
        <BlurMask blur={12} style="outer" />
      </Circle>
      <Group transform={sweepTransform}>
        <Line
          p1={vec(cx, cy)}
          p2={vec(cx, cy - SONAR_RING_RADII[2] - 6)}
          color={TERMINAL_GREEN}
          strokeWidth={2}
          opacity={0.72}
        />
        <Line
          p1={vec(cx, cy)}
          p2={vec(cx, cy - SONAR_RING_RADII[2] - 6)}
          color="rgba(0, 255, 51, 0.22)"
          strokeWidth={10}
          opacity={0.35}
        >
          <BlurMask blur={8} style="outer" />
        </Line>
      </Group>
      <Line p1={vec(0, cy)} p2={vec(width, cy)} color="rgba(0, 255, 51, 0.1)" strokeWidth={1}>
        <DashPathEffect intervals={[8, 12]} />
      </Line>
      <Line p1={vec(cx, 0)} p2={vec(cx, height)} color="rgba(0, 255, 51, 0.1)" strokeWidth={1}>
        <DashPathEffect intervals={[8, 12]} />
      </Line>
    </Group>
  );
}

export function BlueprintStreetGrid({
  viewBoxWidth,
  viewBoxHeight,
}: {
  viewBoxWidth: number;
  viewBoxHeight: number;
}): React.JSX.Element {
  const verticals: React.JSX.Element[] = [];
  const horizontals: React.JSX.Element[] = [];

  for (let x = 0; x <= viewBoxWidth; x += GRID_STEP) {
    const major = x % MAJOR_GRID_STEP === 0;
    verticals.push(
      <Line
        key={`v-${x}`}
        p1={vec(x, 0)}
        p2={vec(x, viewBoxHeight)}
        color={major ? 'rgba(72, 96, 118, 0.42)' : 'rgba(48, 62, 78, 0.28)'}
        strokeWidth={major ? 1.4 : 0.8}
        opacity={major ? 0.55 : 0.38}
      >
        <DashPathEffect intervals={major ? [10, 6] : [3, 16]} />
      </Line>,
    );
  }

  for (let y = 0; y <= viewBoxHeight; y += GRID_STEP) {
    const major = y % MAJOR_GRID_STEP === 0;
    horizontals.push(
      <Line
        key={`h-${y}`}
        p1={vec(0, y)}
        p2={vec(viewBoxWidth, y)}
        color={major ? 'rgba(72, 96, 118, 0.42)' : 'rgba(48, 62, 78, 0.28)'}
        strokeWidth={major ? 1.4 : 0.8}
        opacity={major ? 0.55 : 0.38}
      >
        <DashPathEffect intervals={major ? [10, 6] : [3, 16]} />
      </Line>,
    );
  }

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={viewBoxWidth}
        height={viewBoxHeight}
        color="rgba(9, 13, 22, 0.92)"
      />
      {verticals}
      {horizontals}
      <Rect
        x={8}
        y={8}
        width={viewBoxWidth - 16}
        height={viewBoxHeight - 16}
        color="transparent"
        style="stroke"
        strokeWidth={1.5}
        opacity={0.35}
      />
    </Group>
  );
}

export default function SonarRadarBackdrop({
  width,
  height,
  viewBoxWidth,
  viewBoxHeight,
}: SonarRadarBackdropProps): React.JSX.Element | null {
  void viewBoxWidth;
  void viewBoxHeight;
  return <SonarScreenHud width={width} height={height} />;
}
