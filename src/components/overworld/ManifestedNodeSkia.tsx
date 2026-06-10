import React from 'react';
import { BlurMask, Circle, Group } from '@shopify/react-native-skia';
import ActiveNodeGlow from './ActiveNodeGlow';
import { TERMINAL_GREEN } from '../../utils/overworldRadarProjection';

interface ManifestedNodeSkiaProps {
  cx: number;
  cy: number;
  radius: number;
  isAnchor: boolean;
  isBoss: boolean;
  locked: boolean;
}

export default function ManifestedNodeSkia({
  cx,
  cy,
  radius,
  isAnchor,
  isBoss,
  locked,
}: ManifestedNodeSkiaProps): React.JSX.Element {
  const r = isBoss ? radius + 6 : radius;

  return (
    <Group>
      {locked ? (
        <ActiveNodeGlow cx={cx} cy={cy} color={TERMINAL_GREEN} opacity={0.85} />
      ) : null}
      <Circle cx={cx} cy={cy} r={r + 6} color="rgba(0, 255, 51, 0.16)">
        <BlurMask blur={isAnchor ? 12 : 8} style="outer" />
      </Circle>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        color={isAnchor ? 'rgba(0, 255, 51, 0.32)' : 'rgba(0, 255, 51, 0.22)'}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        color={TERMINAL_GREEN}
        style="stroke"
        strokeWidth={locked ? 2.8 : 2}
        opacity={0.95}
      />
    </Group>
  );
}
