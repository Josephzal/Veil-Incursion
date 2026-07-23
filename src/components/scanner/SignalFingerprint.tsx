import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { SCANNER_PHOSPHOR, SCANNER_VEIL_VIOLET, accentWithAlpha } from './vectorScannerShared';
import { VEIL } from '../../theme/veilTerminalTokens';

export type SignalFingerprintMode = 'idle' | 'locked' | 'decrypted';

interface SignalFingerprintProps {
  /** Stable seed from selected vector / node id — decorative only. */
  seed: string;
  /** Bearing degrees when available — drawn as a quiet radial. */
  bearingDeg?: number | null;
  /** @deprecated Prefer `mode`. */
  decrypted?: boolean;
  mode?: SignalFingerprintMode;
  /** Semantic classification accent when type is known. */
  semanticColor?: string;
  size?: number;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function waveformPath(seed: number, cx: number, cy: number, width: number, ampScale: number): string {
  const amp = (18 + (seed % 10)) * ampScale;
  const steps = 28;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = cx - width / 2 + t * width;
    const phase = seed % 7;
    const y = cy
      + Math.sin(t * Math.PI * (3.2 + phase * 0.15) + phase) * amp
      + Math.sin(t * Math.PI * 7.1 + phase * 0.4) * (amp * 0.28);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

function unresolvedNoisePath(seed: number, cx: number, cy: number, width: number): string {
  const steps = 36;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = cx - width / 2 + t * width;
    const n = ((seed >> (i % 8)) & 7) / 7;
    const y = cy
      + Math.sin(t * Math.PI * 5.4 + n) * 6
      + Math.sin(t * 40 + seed) * 2.2
      + (n - 0.5) * 5;
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

/**
 * Substantial signal fingerprint — intercepted waveform / corrupted tomography.
 * Decorative only; seeded from contact id for stable per-vector geometry.
 */
export default function SignalFingerprint({
  seed,
  bearingDeg = null,
  decrypted = false,
  mode,
  semanticColor,
  size = 248,
}: SignalFingerprintProps): React.JSX.Element {
  const resolvedMode: SignalFingerprintMode = mode
    ?? (decrypted ? 'decrypted' : 'idle');
  const geometry = useMemo(() => {
    const h = hashSeed(seed || 'IDLE');
    return {
      rot: (h % 20) - 10,
      fracture: 36 + (h % 48),
      notch: 22 + (h % 30),
      cutAngle: -18 + (h % 36),
      wave: h,
      tickOffsets: [0.18, 0.34, 0.52, 0.71, 0.86].map((t, i) => t + ((h >> (i * 3)) % 5) * 0.01),
    };
  }, [seed]);

  const [lockFlash, setLockFlash] = useState(0);
  const lastSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (resolvedMode === 'idle') return undefined;
    if (lastSeedRef.current === seed) return undefined;
    lastSeedRef.current = seed;
    setLockFlash(1);
    const t = setTimeout(() => setLockFlash(0), 420);
    return () => clearTimeout(t);
  }, [seed, resolvedMode]);

  const cx = 100;
  const cy = 100;
  const isIdle = resolvedMode === 'idle';
  const isLocked = resolvedMode === 'locked';
  const isDecrypted = resolvedMode === 'decrypted';
  const stroke = isDecrypted
    ? (semanticColor ?? SCANNER_PHOSPHOR)
    : isLocked
      ? SCANNER_PHOSPHOR
      : SCANNER_VEIL_VIOLET;
  const rootOpacity = isIdle ? 0.72 : isDecrypted ? 1 : 0.94;
  const ringOpacity = isIdle ? 0.07 : isDecrypted ? 0.18 : 0.14;
  const traceOpacity = isIdle ? 0.12 : isDecrypted ? 0.32 : 0.26;
  const bearing = bearingDeg != null ? ((bearingDeg % 360) + 360) % 360 : null;
  const wave = isIdle
    ? unresolvedNoisePath(geometry.wave, cx, cy + 8, 150)
    : waveformPath(geometry.wave, cx, cy + 8, isDecrypted ? 158 : 150, isDecrypted ? 1.05 : 0.9);
  const guideOpacity = isIdle ? 0.08 : 0.2 + lockFlash * 0.15;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[
        styles.root,
        {
          width: size,
          height: size,
          opacity: rootOpacity,
          maxWidth: '70%',
        },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 200 200">
        <G transform={`rotate(${geometry.rot}, ${cx}, ${cy})`}>
          <Circle
            cx={cx}
            cy={cy}
            r={84}
            stroke={stroke}
            strokeWidth={isIdle ? 1 : 1.35}
            fill="none"
            opacity={ringOpacity}
            strokeDasharray={`${200 - geometry.notch} ${geometry.notch + 36}`}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={66}
            stroke={stroke}
            strokeWidth={1.05}
            fill="none"
            opacity={ringOpacity * 0.9}
            strokeDasharray="132 72"
          />
          {!isIdle ? (
            <Circle
              cx={cx}
              cy={cy}
              r={46}
              stroke={VEIL.bone}
              strokeWidth={0.85}
              fill="none"
              opacity={ringOpacity * 0.75}
              strokeDasharray="88 48"
            />
          ) : null}

          {!isIdle ? (
            <>
              <Path
                d={`M ${cx - 76} ${cy - 22} Q ${cx - 18} ${cy - 64} ${cx + 42} ${cy - 28}`}
                stroke={isDecrypted ? stroke : SCANNER_VEIL_VIOLET}
                strokeWidth={1.05}
                fill="none"
                opacity={traceOpacity * 0.85}
              />
              <Path
                d={`M ${cx + 58} ${cy + 10} Q ${cx + 8} ${cy + 54} ${cx - 48} ${cy + 38}`}
                stroke={stroke}
                strokeWidth={0.95}
                fill="none"
                opacity={traceOpacity * 0.7}
              />
            </>
          ) : null}

          <Path
            d={wave}
            stroke={stroke}
            strokeWidth={isIdle ? 1 : 1.25}
            fill="none"
            opacity={traceOpacity}
          />

          {!isIdle ? (
            <Line
              x1={cx - 70}
              y1={cy + geometry.fracture * 0.2}
              x2={cx + 62}
              y2={cy + geometry.fracture * 0.2 + geometry.cutAngle * 0.35}
              stroke={VEIL.bone}
              strokeWidth={0.8}
              opacity={ringOpacity}
            />
          ) : null}

          {geometry.tickOffsets.map((t, i) => {
            const ang = (t * 360 * Math.PI) / 180;
            const r0 = isIdle ? 70 : 78;
            const r1 = isIdle ? 80 : 88;
            return (
              <Line
                key={`tick-${i}`}
                x1={cx + Math.cos(ang) * r0}
                y1={cy + Math.sin(ang) * r0}
                x2={cx + Math.cos(ang) * r1}
                y2={cy + Math.sin(ang) * r1}
                stroke={stroke}
                strokeWidth={isIdle ? 0.9 : 1.2}
                opacity={guideOpacity}
              />
            );
          })}

          {bearing != null && !isIdle ? (
            <Line
              x1={cx}
              y1={cy}
              x2={cx + 70 * Math.cos((bearing * Math.PI) / 180)}
              y2={cy + 70 * Math.sin((bearing * Math.PI) / 180)}
              stroke={SCANNER_PHOSPHOR}
              strokeWidth={0.9}
              opacity={isDecrypted ? 0.28 : 0.18}
            />
          ) : null}

          <Circle
            cx={cx}
            cy={cy}
            r={isIdle ? 9 : 11}
            stroke={stroke}
            strokeWidth={1.15}
            fill={isLocked || isDecrypted ? accentWithAlpha(stroke, 0.06 + lockFlash * 0.08) : 'none'}
            strokeDasharray={isIdle ? '10 14' : '16 10'}
            opacity={traceOpacity}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={isIdle ? 1.6 : 2.4}
            fill={isDecrypted ? (semanticColor ?? SCANNER_PHOSPHOR) : isLocked ? SCANNER_PHOSPHOR : VEIL.textSoft}
            opacity={isIdle ? 0.35 : isDecrypted ? 0.9 : 0.75}
          />
          {!isIdle ? (
            <>
              <Line x1={cx - 18} y1={cy} x2={cx - 12} y2={cy} stroke={VEIL.textSoft} strokeWidth={1} opacity={0.55} />
              <Line x1={cx + 12} y1={cy} x2={cx + 18} y2={cy} stroke={VEIL.textSoft} strokeWidth={1} opacity={0.55} />
              <Line x1={cx} y1={cy - 18} x2={cx} y2={cy - 12} stroke={VEIL.textSoft} strokeWidth={1} opacity={0.55} />
              <Line x1={cx} y1={cy + 12} x2={cx} y2={cy + 18} stroke={VEIL.textSoft} strokeWidth={1} opacity={0.55} />
            </>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
