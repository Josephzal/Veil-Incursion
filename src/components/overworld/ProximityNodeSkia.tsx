import React, { useMemo } from 'react';
import { BlurMask, Circle, Group, Line, Points, vec } from '@shopify/react-native-skia';
import type { ProximityTier } from '../../utils/overworldRadarProjection';
import { TERMINAL_GREEN } from '../../utils/overworldRadarProjection';
import ActiveNodeGlow from './ActiveNodeGlow';

interface ProximityNodeSkiaProps {
  cx: number;
  cy: number;
  tier: ProximityTier;
  radius: number;
  markerOpacity: number;
  isInteractive: boolean;
  nodeId: string;
}

function buildNoisePoints(cx: number, cy: number, nodeId: string, tick: number): ReturnType<typeof vec>[] {
  const points: ReturnType<typeof vec>[] = [];
  const seed = nodeId.charCodeAt(0) + tick;
  for (let i = 0; i < 7; i += 1) {
    const spread = ((seed + i * 17) % 11) - 5;
    const yJitter = ((seed + i * 9) % 5) - 2;
    points.push(vec(cx + spread * 2.2, cy + yJitter * 0.8));
  }
  return points;
}

export default function ProximityNodeSkia({
  cx,
  cy,
  tier,
  radius,
  markerOpacity,
  isInteractive,
  nodeId,
}: ProximityNodeSkiaProps): React.JSX.Element {
  const noisePoints = useMemo(
    () => buildNoisePoints(cx, cy, nodeId, 0),
    [cx, cy, nodeId],
  );

  if (tier === 'FAR') {
    return (
      <Group opacity={markerOpacity * 0.75}>
        <Points
          points={noisePoints}
          mode="points"
          color="rgba(0, 255, 51, 0.35)"
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
        />
        <Line
          p1={vec(cx - radius * 0.9, cy)}
          p2={vec(cx + radius * 0.9, cy)}
          color="rgba(148, 163, 184, 0.45)"
          strokeWidth={2}
          opacity={0.55}
        />
      </Group>
    );
  }

  if (tier === 'LOCK_ON') {
    return (
      <Group>
        <ActiveNodeGlow cx={cx} cy={cy} color={TERMINAL_GREEN} opacity={0.78} />
        <Circle cx={cx} cy={cy} r={radius + 8} color="rgba(0, 255, 51, 0.2)">
          <BlurMask blur={10} style="outer" />
        </Circle>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          color="rgba(0, 255, 51, 0.28)"
          opacity={markerOpacity}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          color={TERMINAL_GREEN}
          style="stroke"
          strokeWidth={isInteractive ? 2.5 : 2}
          opacity={markerOpacity}
        />
      </Group>
    );
  }

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={radius + 4} color="rgba(0, 255, 51, 0.1)" opacity={0.7} />
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color="rgba(0, 255, 51, 0.18)"
        opacity={markerOpacity}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        color={TERMINAL_GREEN}
        style="stroke"
        strokeWidth={1.8}
        opacity={markerOpacity * 0.9}
      />
    </Group>
  );
}
