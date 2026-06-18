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
      return { core: 'rgba(239, 68, 68, 0.42)', glow: 'rgba(220, 38, 38, 0.28)', edge: '#f87171' };
    case 'ELITE_COMBAT':
      return { core: 'rgba(127, 29, 29, 0.55)', glow: 'rgba(69, 10, 10, 0.38)', edge: '#991b1b' };
    case 'NARRATIVE_EVENT':
      return { core: 'rgba(168, 85, 247, 0.4)', glow: 'rgba(124, 58, 237, 0.28)', edge: '#a78bfa' };
    case 'RESOURCE_HARVEST':
      return { core: 'rgba(34, 211, 238, 0.38)', glow: 'rgba(6, 182, 212, 0.24)', edge: '#22d3ee' };
    case 'BLACK_MARKET':
      return { core: 'rgba(245, 158, 11, 0.38)', glow: 'rgba(217, 119, 6, 0.24)', edge: '#fbbf24' };
    case 'SANCTUARY':
      return { core: 'rgba(34, 197, 94, 0.38)', glow: 'rgba(22, 163, 74, 0.24)', edge: '#22c55e' };
    case 'SAFE_ANCHOR_EXTRACTION':
    case 'MASTER_EXTRACTION_LINK':
      return { core: 'rgba(245, 158, 11, 0.38)', glow: 'rgba(217, 119, 6, 0.24)', edge: '#fbbf24' };
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
  /** Active breach target — strong selection ring */
  selected?: boolean;
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
  selected = false,
  pulse = true,
}: ProceduralRiftSkiaProps): React.JSX.Element {
  const palette = paletteForType(nodeType, isBoss);
  const r = isBoss ? radius + 8 : radius;
  const tear = buildTearPath(cx, cy, r, intensity < 0.6 ? 0.35 : 0.18);
  const selectionRing = buildTearPath(cx, cy, r + 12, 0.08);
  const pulsePhase = useSharedValue(0);
  const selectionPulse = useSharedValue(0);

  useEffect(() => {
    if (!pulse && !selected) return;
    pulsePhase.value = withRepeat(
      withTiming(1, { duration: intensity < 0.6 ? 680 : 920, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [intensity, pulse, selected, pulsePhase]);

  useEffect(() => {
    if (!selected) {
      selectionPulse.value = 0;
      return;
    }
    selectionPulse.value = withRepeat(
      withTiming(1, { duration: 560, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [selected, selectionPulse]);

  const glowOpacity = useDerivedValue(() => 0.25 + pulsePhase.value * 0.35 * intensity);
  const coreOpacity = useDerivedValue(() => (0.35 + intensity * 0.45) * (0.85 + pulsePhase.value * 0.15));
  const selectionOpacity = useDerivedValue(() => 0.55 + selectionPulse.value * 0.45);

  return (
    <Group opacity={0.35 + intensity * 0.65}>
      {selected ? (
        <Path path={selectionRing} color="#00ff33" style="stroke" strokeWidth={3} opacity={selectionOpacity}>
          <BlurMask blur={8} style="outer" />
        </Path>
      ) : null}
      <Path path={tear} color={palette.glow} opacity={glowOpacity}>
        <BlurMask blur={selected || locked ? 14 : 10} style="outer" />
      </Path>
      <Path path={tear} color={palette.core} opacity={coreOpacity} />
      <Path
        path={tear}
        color={selected ? '#00ff66' : palette.edge}
        style="stroke"
        strokeWidth={selected ? 3.2 : locked ? 2.6 : 1.8}
        opacity={selected ? 1 : 0.9}
      />
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
