import React from 'react';
import { Circle, DashPathEffect, Group, Line, vec } from '@shopify/react-native-skia';

const RANGE_RING_RADII = [52, 92, 132] as const;
const CROSSHAIR_COLOR = 'rgba(0, 255, 51, 0.14)';
const RING_COLOR = 'rgba(0, 255, 51, 0.16)';

interface RadarRangeRingsProps {
  cx: number;
  cy: number;
}

/** Concentric dashed range rings centered on the operative (map space). */
export function RadarRangeRings({ cx, cy }: RadarRangeRingsProps): React.JSX.Element {
  return (
    <Group>
      {RANGE_RING_RADII.map((radius) => (
        <Circle
          key={`range-${radius}`}
          cx={cx}
          cy={cy}
          r={radius}
          color={RING_COLOR}
          style="stroke"
          strokeWidth={1}
          opacity={0.55 - radius * 0.0015}
        >
          <DashPathEffect intervals={[5, 9]} />
        </Circle>
      ))}
    </Group>
  );
}

interface RadarViewportCrosshairProps {
  width: number;
  height: number;
}

/** Fixed viewport reticle — stays locked to the camera window while the map pans. */
export function RadarViewportCrosshair({
  width,
  height,
}: RadarViewportCrosshairProps): React.JSX.Element | null {
  if (width <= 0 || height <= 0) return null;

  const cx = width / 2;
  const cy = height / 2;

  return (
    <Group>
      <Line
        p1={vec(0, cy)}
        p2={vec(width, cy)}
        color={CROSSHAIR_COLOR}
        strokeWidth={1}
        opacity={0.85}
      >
        <DashPathEffect intervals={[10, 14]} />
      </Line>
      <Line
        p1={vec(cx, 0)}
        p2={vec(cx, height)}
        color={CROSSHAIR_COLOR}
        strokeWidth={1}
        opacity={0.85}
      >
        <DashPathEffect intervals={[10, 14]} />
      </Line>
    </Group>
  );
}
