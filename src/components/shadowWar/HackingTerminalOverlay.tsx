import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

/** Static horizontal scanlines — barely visible phosphor grid. */
const SCANLINE_OPACITY = 0.022;
/** Occasional downward sweep — Fallout hacking-style retrace. */
const BEAM_COLOR = 'rgba(130, 255, 210, 0.14)';

interface HackingTerminalOverlayProps {
  /** Map viewport height — required for scan-line travel distance. */
  viewportHeight: number;
}

/**
 * Subtle Fallout-style terminal veil for the Shadow War map.
 * - Rare, soft brightness dips (not a constant loop)
 * - Single scan lines that drift downward, then vanish until the next random cue
 */
export default function HackingTerminalOverlay({
  viewportHeight,
}: HackingTerminalOverlayProps): React.JSX.Element {
  const dimPulse = useSharedValue(0);
  const beamY = useSharedValue(-12);
  const beamOpacity = useSharedValue(0);

  useEffect(() => {
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
  }, [beamOpacity, beamY, dimPulse, viewportHeight]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimPulse.value,
  }));

  const beamStyle = useAnimatedStyle(() => ({
    opacity: beamOpacity.value,
    transform: [{ translateY: beamY.value }],
  }));

  return (
    <View pointerEvents="none" style={styles.root}>
      <View pointerEvents="none" style={styles.scanlineLayer}>
        <Svg width="100%" height="100%" style={styles.svgFill}>
          <Defs>
            <Pattern id="hackingScanlines" width={1} height={4} patternUnits="userSpaceOnUse">
              <Rect width={1} height={1} fill="rgba(0, 0, 0, 0.55)" />
              <Rect y={1} width={1} height={3} fill="transparent" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hackingScanlines)" />
        </Svg>
      </View>

      <Animated.View pointerEvents="none" style={[styles.dimLayer, dimStyle]} />

      <Animated.View pointerEvents="none" style={[styles.scanBeam, beamStyle]} />
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
  scanlineLayer: {
    ...StyleSheet.absoluteFill,
    opacity: SCANLINE_OPACITY,
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
