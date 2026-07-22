import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

/** Static horizontal scanlines — phosphor grid over the working surface. */
const DEFAULT_SCANLINE_OPACITY = 0.055;
/** Occasional downward sweep — Fallout hacking-style retrace. */
const BEAM_COLOR = 'rgba(130, 255, 210, 0.14)';

export type VeilTerminalEffectsIntensity = 'subtle' | 'none';

interface VeilTerminalEffectsProps {
  /**
   * Optional fixed travel distance for the CRT beam.
   * When omitted, the overlay measures its own container height.
   */
  viewportHeight?: number;
  intensity?: VeilTerminalEffectsIntensity;
  /** Override static scanline opacity without changing motion timers. */
  scanlineOpacity?: number;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  return reduced;
}

/**
 * Shared Veil Network CRT veil for hub workstations (Veil Front, Contract Board).
 * - Static scanlines + soft vignette
 * - Rare brightness dips (not a constant loop)
 * - Occasional horizontal sync disturbance
 *
 * pointerEvents none — never blocks interaction. Motion stops under reduced-motion.
 */
export default function VeilTerminalEffects({
  viewportHeight: viewportHeightProp,
  intensity = 'subtle',
  scanlineOpacity = DEFAULT_SCANLINE_OPACITY,
}: VeilTerminalEffectsProps): React.JSX.Element | null {
  const reduceMotion = usePrefersReducedMotion();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const viewportHeight = viewportHeightProp && viewportHeightProp > 0
    ? viewportHeightProp
    : measuredHeight;

  const dimPulse = useSharedValue(0);
  const beamY = useSharedValue(-12);
  const beamOpacity = useSharedValue(0);

  useEffect(() => {
    if (intensity === 'none' || reduceMotion) {
      dimPulse.value = 0;
      beamOpacity.value = 0;
      return undefined;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => {
        if (!cancelled) fn();
      }, ms));
    };

    const pulseBrightness = () => {
      const strength = 0.012 + Math.random() * 0.028;
      dimPulse.value = withSequence(
        withTiming(strength, { duration: 30 + Math.random() * 50 }),
        withTiming(0, { duration: 90 + Math.random() * 140 }),
      );
    };

    const scheduleBrightnessPulse = () => {
      later(() => {
        if (Math.random() < 0.48) pulseBrightness();
        scheduleBrightnessPulse();
      }, 1500 + Math.random() * 6000);
    };

    const sweepScanLine = () => {
      if (viewportHeight <= 0) return;
      const peak = 0.05 + Math.random() * 0.09;
      beamOpacity.value = withTiming(peak, { duration: 60 + Math.random() * 80 });
      beamY.value = -8;
      beamY.value = withTiming(
        viewportHeight + 8,
        {
          duration: 2400 + Math.random() * 2000,
          easing: Easing.linear,
        },
        (finished) => {
          if (finished) {
            beamOpacity.value = withTiming(0, { duration: 120 + Math.random() * 80 });
          }
        },
      );
    };

    const scheduleScanLine = () => {
      later(() => {
        if (Math.random() < 0.65) sweepScanLine();
        scheduleScanLine();
      }, 9000 + Math.random() * 24000);
    };

    scheduleBrightnessPulse();
    later(() => {
      if (Math.random() < 0.5) sweepScanLine();
    }, 4000 + Math.random() * 8000);
    scheduleScanLine();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [beamOpacity, beamY, dimPulse, intensity, reduceMotion, viewportHeight]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimPulse.value,
  }));

  const beamStyle = useAnimatedStyle(() => ({
    opacity: beamOpacity.value,
    transform: [{ translateY: beamY.value }],
  }));

  if (intensity === 'none') return null;

  return (
    <View
      pointerEvents="none"
      style={styles.root}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0 && next !== measuredHeight) setMeasuredHeight(next);
      }}
    >
      <View pointerEvents="none" style={styles.vignette} />

      <View pointerEvents="none" style={[styles.scanlineLayer, { opacity: scanlineOpacity }]}>
        <Svg width="100%" height="100%" style={styles.svgFill}>
          <Defs>
            <Pattern id="veilTerminalScanlines" width={1} height={4} patternUnits="userSpaceOnUse">
              <Rect width={1} height={1} fill="rgba(255, 255, 255, 0.35)" />
              <Rect y={1} width={1} height={3} fill="transparent" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#veilTerminalScanlines)" />
        </Svg>
      </View>

      {!reduceMotion ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.dimLayer, dimStyle]} />
          <Animated.View pointerEvents="none" style={[styles.scanBeam, beamStyle]} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    overflow: 'hidden',
  },
  svgFill: {
    ...StyleSheet.absoluteFill,
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.22) 100%)',
      } as object,
      default: {
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  scanlineLayer: {
    ...StyleSheet.absoluteFill,
  },
  dimLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: BEAM_COLOR,
  },
});
