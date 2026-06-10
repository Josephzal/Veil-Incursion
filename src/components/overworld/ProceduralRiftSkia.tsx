import React, { useEffect } from 'react';
import { BlurMask, Group, Line, Path, Skia, vec } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { RunNodeType } from '../../types/game';

interface RiftPalette {
  core: string;
  glow: string;
  edge: string;
}

function paletteForType(nodeType: RunNodeType, isBoss: boolean): RiftPalette {
  if (isBoss) {
    return { core: 'rgba(168, 85, 247, 0.55)', glow: 'rgba(126, 34, 206, 0.35)', edge: '#c084fc' };
  }
  switch (nodeType) {
    case 'STANDARD_COMBAT':
    case 'ELITE_COMBAT':
      return { core: 'rgba(239, 68, 68, 0.42)', glow: 'rgba(220, 38, 38, 0.28)', edge: '#f87171' };
    case 'NARRATIVE_EVENT':
      return { core: 'rgba(168, 85, 247, 0.4)', glow: 'rgba(124, 58, 237, 0.28)', edge: '#a78bfa' };
    case 'RESOURCE_HARVEST':
      return { core: 'rgba(34, 211, 238, 0.38)', glow: 'rgba(6, 182, 212, 0.24)', edge: '#22d3ee' };
    case 'BLACK_MARKET':
      return { core: 'rgba(245, 158, 11, 0.38)', glow: 'rgba(217, 119, 6, 0.24)', edge: '#fbbf24' };
    case 'SANCTUARY':
    case 'SAFE_ANCHOR_EXTRACTION':
    case 'MASTER_EXTRACTION_LINK':
      return { core: 'rgba(0, 255, 51, 0.32)', glow: 'rgba(0, 255, 51, 0.18)', edge: '#00ff33' };
    default:
      return { core: 'rgba(0, 255, 51, 0.28)', glow: 'rgba(0, 255, 51, 0.14)', edge: '#00ff33' };
  }
}

function buildTearPath(cx: number, cy: number, radius: number, jag = 0.22): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make();
  const points = 8;
  path.moveTo(cx, cy - radius);
  for (let i = 1; i <= points; i += 1) {
    const angle = (-Math.PI / 2) + (i / points) * Math.PI * 2;
    const wobble = ((i % 2 === 0) ? jag : -jag) * radius;
    path.lineTo(
      cx + Math.cos(angle) * (radius + wobble),
      cy + Math.sin(angle) * (radius + wobble),
    );
  }
  path.close();
  return path;
}

export interface ProceduralRiftSkiaProps {
  cx: number;
  cy: number;
  radius: number;
  nodeType: RunNodeType;
  isBoss?: boolean;
  /** 0 = faint unstable tear, 1 = fully manifested */
  intensity?: number;
  locked?: boolean;
  pulse?: boolean;
}

export default function ProceduralRiftSkia({
  cx,
  cy,
  radius,
  nodeType,
  isBoss = false,
  intensity = 1,
  locked = false,
  pulse = true,
}: ProceduralRiftSkiaProps): React.JSX.Element {
  const palette = paletteForType(nodeType, isBoss);
  const r = isBoss ? radius + 8 : radius;
  const tear = buildTearPath(cx, cy, r, intensity < 0.6 ? 0.35 : 0.18);
  const pulsePhase = useSharedValue(0);

  useEffect(() => {
    if (!pulse) return;
    pulsePhase.value = withRepeat(
      withTiming(1, { duration: intensity < 0.6 ? 680 : 920, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [intensity, pulse, pulsePhase]);

  const glowOpacity = useDerivedValue(() => 0.25 + pulsePhase.value * 0.35 * intensity);
  const coreOpacity = useDerivedValue(() => (0.35 + intensity * 0.45) * (0.85 + pulsePhase.value * 0.15));

  return (
    <Group opacity={0.35 + intensity * 0.65}>
      <Path path={tear} color={palette.glow} opacity={glowOpacity}>
        <BlurMask blur={locked ? 14 : 10} style="outer" />
      </Path>
      <Path path={tear} color={palette.core} opacity={coreOpacity} />
      <Path path={tear} color={palette.edge} style="stroke" strokeWidth={locked ? 2.6 : 1.8} opacity={0.9} />
      <Line
        p1={vec(cx - r * 0.65, cy)}
        p2={vec(cx + r * 0.65, cy)}
        color={palette.edge}
        strokeWidth={1}
        opacity={0.35 * intensity}
      />
      <Line
        p1={vec(cx, cy - r * 0.55)}
        p2={vec(cx, cy + r * 0.55)}
        color={palette.edge}
        strokeWidth={1}
        opacity={0.28 * intensity}
      />
    </Group>
  );
}
