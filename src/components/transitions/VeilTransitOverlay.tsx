import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import VeilWarpField from '../scanner/VeilWarpField';
import {
  publishVeilTransitPulse,
  resetVeilTransitBridge,
  veilTransitBridge,
} from '../scanner/veilTransitBridge';
import {
  EXTRACT_SWAP_MS,
  INGRESS_SWAP_MS,
  VEIL_TRANSIT_MS,
  sampleVeilTransit,
  type VeilTransitKind,
} from './veilTransitTimeline';
import { VEIL_WARP_COLORS } from '../scanner/veilWarpFieldConfig';

export interface VeilTransitOverlayProps {
  kind: VeilTransitKind;
  /** CSS top-origin focal UV (0–1). Converted to WebGL y-up for the field. */
  focalPoint: { x: number; y: number };
  generation: number;
  onSwapScene: () => void;
  onComplete: () => void;
}

function readPrefersReducedMotionSync(): boolean {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

/**
 * Imperfect circular iris — transparent hole grows from the focal point.
 * Transparent = reveal destination · opaque = keep Veil overlay.
 */
function buildRevealMaskStyle(
  reveal: number,
  focal: { x: number; y: number },
): ViewStyle {
  if (Platform.OS !== 'web' || reveal <= 0.001) {
    return {};
  }

  // Timeline already eases reveal — map linearly so portal + iris stay in sync.
  const t = Math.max(0, Math.min(1, reveal));
  const fx = focal.x * 100;
  const fy = focal.y * 100;
  // Slightly lopsided ellipse + offset duplicate for an imperfect rim.
  const rx = 6 + t * 130;
  const ry = 5 + t * 120;
  // Soft feathered edge so destination blends into the Veil ring.
  const soft = Math.max(0, t * 58);
  const hard = Math.min(100, soft + 22 + t * 14);
  const rx2 = rx * 0.93;
  const ry2 = ry * 1.08;
  const fx2 = fx + 2.4;
  const fy2 = fy - 1.6;
  const soft2 = Math.max(0, soft - 3);
  const hard2 = Math.min(100, hard + 8);

  const maskA = `radial-gradient(ellipse ${rx}% ${ry}% at ${fx}% ${fy}%, transparent 0%, transparent ${soft}%, rgba(0,0,0,0.55) ${(soft + hard) * 0.5}%, black ${hard}%)`;
  const maskB = `radial-gradient(ellipse ${rx2}% ${ry2}% at ${fx2}% ${fy2}%, transparent 0%, transparent ${soft2}%, black ${hard2}%)`;

  return {
    maskImage: `${maskA}, ${maskB}`,
    WebkitMaskImage: `${maskA}, ${maskB}`,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  } as ViewStyle;
}

/**
 * Full-screen Veil portal transit — portal plays while iris reveals destination through it.
 */
export default function VeilTransitOverlay({
  kind,
  focalPoint,
  generation,
  onSwapScene,
  onComplete,
}: VeilTransitOverlayProps): React.JSX.Element {
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [revealRadius, setRevealRadius] = useState(0);
  const swappedRef = useRef(false);
  const completedRef = useRef(false);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const lastUiRef = useRef({ opacity: 1, reveal: 0 });
  const lastPulseRef = useRef(0);

  const fieldMode = kind === 'successfulExtraction' ? 'successfulExtraction' : 'incursionIngress';
  const swapAtMs = kind === 'successfulExtraction' ? EXTRACT_SWAP_MS : INGRESS_SWAP_MS;

  const maskStyle = useMemo(
    () => buildRevealMaskStyle(revealRadius, focalPoint),
    [revealRadius, focalPoint],
  );

  useEffect(() => {
    swappedRef.current = false;
    completedRef.current = false;
    let reduced = readPrefersReducedMotionSync();
    let startMs = performance.now();
    let started = false;
    const gen = generation;
    let rafId = 0;
    let failsafeId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const finish = () => {
      if (completedRef.current) return;
      if (generationRef.current !== gen) return;
      completedRef.current = true;
      resetVeilTransitBridge();
      setOverlayOpacity(0);
      setRevealRadius(1);
      onComplete();
    };

    const swap = () => {
      if (swappedRef.current) return;
      if (generationRef.current !== gen) return;
      swappedRef.current = true;
      onSwapScene();
    };

    const tick = (now: number) => {
      if (cancelled || generationRef.current !== gen) return;
      const elapsed = now - startMs;
      const sample = sampleVeilTransit(kind, elapsed, reduced);

      veilTransitBridge.active = 1;
      veilTransitBridge.mode = kind === 'successfulExtraction' ? 2 : 1;
      veilTransitBridge.progress = sample.progress;
      veilTransitBridge.focalU = focalPoint.x;
      veilTransitBridge.focalV = 1 - focalPoint.y;
      veilTransitBridge.aperture = sample.aperture;
      veilTransitBridge.cover = sample.cover;
      veilTransitBridge.attraction = sample.attraction;
      veilTransitBridge.densityScale = sample.densityScale;
      veilTransitBridge.motionBoost = sample.motionBoost;
      veilTransitBridge.warpBoost = sample.warpBoost;
      veilTransitBridge.intensityBoost = sample.intensityBoost;
      veilTransitBridge.chromatic = sample.chromatic;
      veilTransitBridge.pulse = sample.pulse;
      veilTransitBridge.reducedMotion = reduced ? 1 : 0;
      if (sample.pulse > 0.35 && lastPulseRef.current <= 0.35) {
        publishVeilTransitPulse();
      }
      lastPulseRef.current = sample.pulse;

      const prevUi = lastUiRef.current;
      if (Math.abs(prevUi.opacity - sample.overlayOpacity) > 0.03) {
        prevUi.opacity = sample.overlayOpacity;
        setOverlayOpacity(sample.overlayOpacity);
      }
      if (Math.abs(prevUi.reveal - sample.revealRadius) > 0.012) {
        prevUi.reveal = sample.revealRadius;
        setRevealRadius(sample.revealRadius);
      }

      if (elapsed >= swapAtMs || sample.fullyCovered) {
        swap();
      }

      if (elapsed >= VEIL_TRANSIT_MS) {
        finish();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    const begin = () => {
      if (cancelled || started) return;
      started = true;
      startMs = performance.now();
      resetVeilTransitBridge();
      veilTransitBridge.active = 1;
      veilTransitBridge.mode = kind === 'successfulExtraction' ? 2 : 1;
      veilTransitBridge.focalU = focalPoint.x;
      veilTransitBridge.focalV = 1 - focalPoint.y;
      veilTransitBridge.reducedMotion = reduced ? 1 : 0;
      publishVeilTransitPulse();
      rafId = requestAnimationFrame(tick);
      failsafeId = setTimeout(() => {
        swap();
        finish();
      }, VEIL_TRANSIT_MS + 32);
    };

    if (Platform.OS === 'web') {
      begin();
    } else {
      void Promise.race([
        AccessibilityInfo.isReduceMotionEnabled(),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 16);
        }),
      ]).then((enabled) => {
        if (cancelled) return;
        reduced = enabled;
        begin();
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (failsafeId != null) clearTimeout(failsafeId);
      if (generationRef.current === gen) {
        resetVeilTransitBridge();
      }
    };
  }, [focalPoint.x, focalPoint.y, generation, kind, onComplete, onSwapScene, swapAtMs]);

  // Native has no CSS mask — fall back to a fast opacity fade during reveal.
  const nativeRevealOpacity = Platform.OS !== 'web' && revealRadius > 0
    ? Math.max(0, 1 - revealRadius)
    : overlayOpacity;

  return (
    <View
      style={[
        styles.root,
        { opacity: Platform.OS === 'web' ? overlayOpacity : nativeRevealOpacity },
        maskStyle,
      ]}
      pointerEvents="auto"
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      <VeilWarpField
        mode={fieldMode}
        transitDriven
        style={fieldHostStyle}
      />
      {Platform.OS !== 'web' ? (
        <View pointerEvents="none" style={styles.nativeTint} />
      ) : null}
    </View>
  );
}

const fieldHostStyle = {
  position: 'absolute' as const,
  inset: 0,
  width: '100%',
  height: '100%',
  zIndex: 0,
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 10000,
    backgroundColor: VEIL_WARP_COLORS.voidBg,
  },
  nativeTint: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    backgroundColor: 'rgba(18, 4, 16, 0.5)',
    ...({
      backgroundImage:
        'radial-gradient(ellipse at 50% 50%, rgba(196, 96, 156, 0.22) 0%, transparent 40%),'
        + 'radial-gradient(ellipse at 48% 54%, rgba(100, 201, 177, 0.12) 0%, transparent 52%),'
        + 'radial-gradient(ellipse at 54% 46%, rgba(148, 78, 132, 0.18) 0%, transparent 68%)',
    } as object),
  },
});
