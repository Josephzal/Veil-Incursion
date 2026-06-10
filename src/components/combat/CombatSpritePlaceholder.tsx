import React from 'react';
import { Group, Line, Rect, vec } from '@shopify/react-native-skia';

const GRID_SPACING = 24;

interface CombatSpritePlaceholderProps {
  width: number;
  height: number;
  lineColor?: string;
  frameColor?: string;
}

export default function CombatSpritePlaceholder({
  width,
  height,
  lineColor = 'rgba(0, 255, 51, 0.2)',
  frameColor = 'rgba(0, 255, 51, 0.1)',
}: CombatSpritePlaceholderProps): React.JSX.Element | null {
  if (width <= 0 || height <= 0) return null;

  const verticals: React.JSX.Element[] = [];
  const horizontals: React.JSX.Element[] = [];

  for (let x = 0; x <= width; x += GRID_SPACING) {
    verticals.push(
      <Line key={`v-${x}`} p1={vec(x, 0)} p2={vec(x, height)} color={lineColor} strokeWidth={1} />,
    );
  }

  for (let y = 0; y <= height; y += GRID_SPACING) {
    horizontals.push(
      <Line key={`h-${y}`} p1={vec(0, y)} p2={vec(width, y)} color={lineColor} strokeWidth={1} />,
    );
  }

  return (
    <Group>
      {verticals}
      {horizontals}
      <Rect
        x={width * 0.2}
        y={height * 0.12}
        width={width * 0.6}
        height={height * 0.76}
        color={frameColor}
        style="stroke"
        strokeWidth={1}
      />
    </Group>
  );
}
