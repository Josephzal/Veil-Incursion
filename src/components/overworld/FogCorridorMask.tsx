import React from 'react';
import { Group, Rect } from '@shopify/react-native-skia';
import type { WorldBounds } from '../../utils/overworldRadarProjection';

interface FogCorridorMaskProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  corridor: WorldBounds;
}

/** Dark fog outside the active depth corridor — the void ahead stays blind. */
export default function FogCorridorMask({
  viewBoxWidth,
  viewBoxHeight,
  corridor,
}: FogCorridorMaskProps): React.JSX.Element {
  const fog = 'rgba(2, 4, 8, 0.82)';
  const { minX, maxX, minY, maxY } = corridor;

  return (
    <Group>
      <Rect x={0} y={0} width={viewBoxWidth} height={Math.max(0, minY)} color={fog} />
      <Rect
        x={0}
        y={maxY}
        width={viewBoxWidth}
        height={Math.max(0, viewBoxHeight - maxY)}
        color={fog}
      />
      <Rect x={0} y={minY} width={Math.max(0, minX)} height={maxY - minY} color={fog} />
      <Rect
        x={maxX}
        y={minY}
        width={Math.max(0, viewBoxWidth - maxX)}
        height={maxY - minY}
        color={fog}
      />
    </Group>
  );
}
