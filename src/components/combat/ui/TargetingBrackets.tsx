import React, { useId, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  TARGET_RETICLE_COLOR,
  resolveTargetReticleOpacity,
  resolveTargetReticleStroke,
  type TargetReticleIntensity,
} from '../../../data/combatTargetReticlePresentation';
import {
  RETICLE_HOVER_GLOW as GLOW,
  reticleHoverWebGlowStyle,
} from '../../../data/reticleHoverGlow';

export type TargetingBracketVariant = 'full' | 'candidate';

interface TargetingBracketsProps {
  active?: boolean;
  /** @deprecated Ignored — player target brackets always use canonical cyan/mint. */
  color?: string;
  /** Brighten without resizing — prefer `intensity`. */
  focused?: boolean;
  intensity?: TargetReticleIntensity;
  /** Full exterior corners vs restrained candidate ticks. */
  variant?: TargetingBracketVariant;
  /**
   * Deprecated for player targeting — scaling the reticle onto the portrait
   * caused artwork overlap. Kept for API compat; no longer applied.
   */
  contentScale?: number;
}

/** Corner arm length as a fraction of the (already inset) frame. */
const ARM = 0.18;

/** Horizontal inset of the bracket frame — keep overhead bars matched to this. */
export const TARGET_BRACKET_INSET_X = '8%';
/** Vertical inset of the bracket frame. */
export const TARGET_BRACKET_INSET_Y = '6%';

/** Steady glow floor — former pulse dimmest point (no animation). */
function steadyReticleOpacity(baseOpacity: number, bright: boolean): number {
  return Math.max(0.35, baseOpacity - (bright ? 0.06 : 0.12));
}

/**
 * Occult scanner lock — SVG L-corners outside the enemy silhouette.
 * State uses opacity/stroke only — never hue swaps, inward zoom, or pulse.
 */
export default function TargetingBrackets({
  active = true,
  focused = false,
  intensity: intensityProp,
  variant = 'full',
}: TargetingBracketsProps): React.JSX.Element | null {
  const intensity: TargetReticleIntensity = intensityProp
    ?? (focused ? 'focus' : 'inspect');
  const baseOpacity = resolveTargetReticleOpacity(intensity);
  const stroke = resolveTargetReticleStroke(intensity);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reactId = useId();
  const filterSafeId = reactId.replace(/:/g, '');
  const color = TARGET_RETICLE_COLOR;
  const bright = intensity === 'focus'
    || intensity === 'inspectFocus'
    || intensity === 'confirm';
  const glowOpacity = steadyReticleOpacity(baseOpacity, bright);

  if (!active) return null;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    if (Math.abs(width - size.w) < 0.5 && Math.abs(height - size.h) < 0.5) return;
    setSize({ w: width, h: height });
  };

  const inset = 3;
  const w = size.w;
  const h = size.h;
  const armFull = Math.max(16, Math.min(w, h) * ARM);
  const arm = variant === 'candidate' ? Math.max(8, armFull * 0.42) : armFull;
  const ready = w > 0 && h > 0;
  const paths = ready
    ? [
        `M ${inset} ${inset + arm} L ${inset} ${inset} L ${inset + arm} ${inset}`,
        `M ${w - inset - arm} ${inset} L ${w - inset} ${inset} L ${w - inset} ${inset + arm}`,
        `M ${inset} ${h - inset - arm} L ${inset} ${h - inset} L ${inset + arm} ${h - inset}`,
        `M ${w - inset - arm} ${h - inset} L ${w - inset} ${h - inset} L ${w - inset} ${h - inset - arm}`,
      ]
    : [];

  const glowStyle = bright && Platform.OS === 'web'
    ? reticleHoverWebGlowStyle(color)
    : null;

  return (
    <View style={styles.root} pointerEvents="none" onLayout={onLayout}>
      <View style={[styles.glowHost, glowStyle, { opacity: glowOpacity }]} pointerEvents="none">
        <View style={styles.fill} pointerEvents="none">
          {ready ? (
            <Svg width={w} height={h} style={styles.svg}>
              {bright && variant === 'full'
                ? paths.flatMap((d, i) =>
                  GLOW.passes.map((pass, pi) => (
                    <Path
                      key={`${filterSafeId}-g-${i}-${pi}`}
                      d={d}
                      stroke={color}
                      strokeWidth={stroke + pass.extra}
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      fill="none"
                      opacity={pass.opacity}
                    />
                  )))
                : null}
              {paths.map((d, i) => (
                <Path
                  key={`${filterSafeId}-c-${i}`}
                  d={d}
                  stroke={color}
                  strokeWidth={stroke}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  fill="none"
                  opacity={variant === 'candidate' ? 0.85 : 1}
                />
              ))}
            </Svg>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Tight frame inside the enemy selectable shell (not the oversized outer pad).
    position: 'absolute',
    top: TARGET_BRACKET_INSET_Y,
    right: TARGET_BRACKET_INSET_X,
    bottom: TARGET_BRACKET_INSET_Y,
    left: TARGET_BRACKET_INSET_X,
    zIndex: 16,
    overflow: 'visible',
  },
  glowHost: {
    ...StyleSheet.absoluteFill,
    overflow: 'visible',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'visible',
  },
  svg: {
    overflow: 'visible',
  },
});
