/**
 * Longsword swing trail — authored painted smear fitted to swept-blade samples.
 * Procedural SVG retained only behind proceduralSwingComparison.
 *
 * Step 2E acceptance: use a full-image opacity reveal so the curved crescent
 * body is readable. A directional width clip previously exposed only the
 * narrow leading tip and read as a second straight blade.
 */

import React, { useEffect, useMemo } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  WARDEN_STRIKE_ART_CALIBRATION,
  WARDEN_STRIKE_COLORS,
  WARDEN_STRIKE_SIZES,
  WARDEN_STRIKE_TIMELINE_MS,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  computeSwingSmearPlacement,
  type BladeSampleLike,
} from '../../data/wardenStrikePresentation';
import { WARDEN_STRIKE_SWING_SMEAR } from '../../data/wardenStrikeArt';
import { scalePresentationMs } from '../../data/weaponCombatPresentation/presentationSettings';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';
import {
  AEGIS_LONGSWORD_POSE_REGISTRATION,
  type BladeSample,
} from '../../utils/combatPoseRegistration';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedView = Animated.View;

interface LongswordSwingTrailProps {
  samples: BladeSample[];
  active: boolean;
  reducedFlash?: boolean;
  reducedMotion?: boolean;
  /** Registered actor-box width for responsive smear sizing. */
  actorBoxWidth?: number;
}

function tipArc(samples: BladeSampleLike[]): Array<{ x: number; y: number }> {
  return samples.map((s) => s.tip);
}

function midArc(samples: BladeSampleLike[], t = 0.42): Array<{ x: number; y: number }> {
  return samples.map((s) => ({
    x: s.hilt.x + (s.tip.x - s.hilt.x) * t,
    y: s.hilt.y + (s.tip.y - s.hilt.y) * t,
  }));
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
  for (let i = 0; i < rest.length; i += 1) {
    const p = rest[i];
    const prev = i === 0 ? first : rest[i - 1];
    const cpx = (prev.x + p.x) / 2;
    const cpy = (prev.y + p.y) / 2;
    d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${cpy.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

function buildRibbonPath(
  tipPts: Array<{ x: number; y: number }>,
  midPts: Array<{ x: number; y: number }>,
): string {
  if (tipPts.length < 2 || midPts.length < 2) return '';
  let d = `M ${tipPts[0].x.toFixed(1)} ${tipPts[0].y.toFixed(1)}`;
  for (let i = 1; i < tipPts.length; i += 1) {
    const p = tipPts[i];
    const prev = tipPts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    const cpy = (prev.y + p.y) / 2;
    d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${cpx.toFixed(1)} ${cpy.toFixed(1)}`;
  }
  const tipLast = tipPts[tipPts.length - 1];
  d += ` L ${tipLast.x.toFixed(1)} ${tipLast.y.toFixed(1)}`;
  for (let i = midPts.length - 1; i >= 0; i -= 1) {
    const p = midPts[i];
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  d += ' Z';
  return d;
}

function offsetSamples(samples: BladeSampleLike[], ox: number, oy: number): BladeSampleLike[] {
  return samples.map((s) => ({
    hilt: { x: s.hilt.x - ox, y: s.hilt.y - oy },
    tip: { x: s.tip.x - ox, y: s.tip.y - oy },
  }));
}

function ProceduralComparison({
  samples,
  active,
  reducedFlash,
}: {
  samples: BladeSample[];
  active: boolean;
  reducedFlash: boolean;
}): React.JSX.Element | null {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  const settings = getCombatPresentationSettings();
  const drawMs = scalePresentationMs(70, settings.combatSpeed);
  const totalMs = scalePresentationMs(WARDEN_STRIKE_TIMELINE_MS.trailLifetime, settings.combatSpeed);
  const pad = 16;
  const bounds = useMemo(() => {
    if (samples.length < 1) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = samples[0].tip.x;
    let minY = samples[0].tip.y;
    let maxX = minX;
    let maxY = minY;
    for (const s of samples) {
      for (const p of [s.hilt, s.tip]) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    return { minX, minY, maxX, maxY };
  }, [samples]);
  const local = useMemo(
    () => offsetSamples(samples, bounds.minX - pad, bounds.minY - pad),
    [bounds.minX, bounds.minY, samples],
  );
  const tipPts = useMemo(() => tipArc(local), [local]);
  const midPts = useMemo(() => midArc(local, 0.38), [local]);
  const leadD = useMemo(() => buildSmoothPath(tipPts), [tipPts]);
  const ribbonD = useMemo(() => buildRibbonPath(tipPts, midPts), [midPts, tipPts]);
  const dashLen = Math.max(48, tipPts.length * 40);

  useEffect(() => {
    if (!active || samples.length < 2) {
      progress.value = 0;
      opacity.value = 0;
      return;
    }
    progress.value = 0;
    opacity.value = 0.55;
    progress.value = withTiming(1, { duration: drawMs, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: totalMs, easing: Easing.in(Easing.quad) });
  }, [active, drawMs, opacity, progress, samples.length, totalMs]);

  const leadProps = useAnimatedProps(() => ({
    strokeDashoffset: (1 - progress.value) * dashLen,
    opacity: opacity.value,
  }));
  const bodyProps = useAnimatedProps(() => ({ opacity: opacity.value * 0.7 }));

  if (samples.length < 2 || !leadD || !ribbonD) return null;
  const width = Math.max(1, bounds.maxX - bounds.minX + pad * 2);
  const height = Math.max(1, bounds.maxY - bounds.minY + pad * 2);

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { left: bounds.minX - pad, top: bounds.minY - pad, width, height, zIndex: 1 }]}
    >
      <Svg width={width} height={height}>
        <AnimatedPath d={ribbonD} fill={WARDEN_STRIKE_COLORS.steelBody} animatedProps={bodyProps} />
        {!reducedFlash ? (
          <AnimatedPath
            d={leadD}
            stroke={WARDEN_STRIKE_COLORS.mintEdge}
            strokeWidth={WARDEN_STRIKE_SIZES.trailMintWidthPx}
            fill="none"
            strokeDasharray={`${dashLen}`}
            animatedProps={leadProps}
          />
        ) : null}
        <AnimatedPath
          d={leadD}
          stroke={WARDEN_STRIKE_COLORS.steelLead}
          strokeWidth={WARDEN_STRIKE_SIZES.trailLeadWidthPx}
          fill="none"
          strokeDasharray={`${dashLen}`}
          animatedProps={leadProps}
        />
      </Svg>
    </View>
  );
}

export default function LongswordSwingTrail({
  samples,
  active,
  reducedFlash = false,
  reducedMotion = false,
  actorBoxWidth,
}: LongswordSwingTrailProps): React.JSX.Element | null {
  const opacity = useSharedValue(0);
  const settings = getCombatPresentationSettings();
  const cal = WARDEN_STRIKE_ART_CALIBRATION.swingSmear;
  const facing = AEGIS_LONGSWORD_POSE_REGISTRATION.attack.targetFacing;
  const placement = useMemo(
    () => computeSwingSmearPlacement(samples, facing.x, facing.y, cal, actorBoxWidth),
    [actorBoxWidth, cal, facing.x, facing.y, samples],
  );

  const fadeInMs = scalePresentationMs(
    Math.min(36, cal.revealMs ?? 70),
    settings.combatSpeed,
  );
  const fadeMs = scalePresentationMs(
    WARDEN_STRIKE_TIMELINE_MS.trailFadeAfterContactMs,
    settings.combatSpeed,
  );
  const totalMs = scalePresentationMs(WARDEN_STRIKE_TIMELINE_MS.trailLifetime, settings.combatSpeed);
  const peak = WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearProofOpaque
    ? 1
    : (reducedFlash ? cal.reducedFlashPeakOpacity : cal.peakOpacity);

  useEffect(() => {
    if (!active || !placement) {
      opacity.value = 0;
      return;
    }
    if (WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearProofOpaque) {
      // Dev proof: hold opaque crescent with no directional reveal / fade.
      opacity.value = 1;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.info('[WARDEN SMEAR PROOF]', {
          assetUri: 'assets/vfx/aegis/longsword/warden-strike-swing-smear.png',
          sourceWidth: cal.sourceWidth,
          sourceHeight: cal.sourceHeight,
          sourceCropRight: cal.sourceCropRight,
          imageElementRect: {
            width: placement.imageWidth,
            height: placement.height,
          },
          cropWrapperRect: {
            width: placement.width,
            height: placement.height,
            left: placement.left,
            top: placement.top,
          },
          finalTransformedRect: {
            width: placement.width,
            height: placement.height,
            left: placement.left,
            top: placement.top,
            rotationDeg: placement.rotationDeg,
          },
          visibleAlphaRect: {
            width: placement.width,
            height: placement.height,
            left: placement.left,
            top: placement.top,
          },
          rotationDeg: placement.rotationDeg,
          parentScale: 1,
          effectiveOpacity: 1,
          arenaPlane: 'wardenPlayer+approachWrapper',
        });
      }
      return;
    }
    // Full-image opacity reveal — keeps the entire curved crescent readable
    // for ≥3 frames at peak instead of exposing only the leading tip.
    opacity.value = 0;
    opacity.value = withTiming(peak, {
      duration: reducedMotion ? 16 : fadeInMs,
      easing: Easing.out(Easing.quad),
    });
    const hold = Math.max(0, totalMs - fadeMs - fadeInMs);
    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: fadeMs, easing: Easing.in(Easing.quad) });
    }, fadeInMs + hold);
    return () => clearTimeout(fadeTimer);
  }, [active, cal, fadeInMs, fadeMs, opacity, peak, placement, reducedMotion, totalMs]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const showAuthored = WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredSwingSmear
    && WARDEN_STRIKE_VFX_LAYER_TOGGLES.swingTrail;
  const showProcedural = WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralSwingComparison;

  if (samples.length < 2) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {showProcedural ? (
        <ProceduralComparison samples={samples} active={active} reducedFlash={reducedFlash} />
      ) : null}
      {showAuthored && placement ? (
        <View
          pointerEvents="none"
          style={[
            styles.root,
            {
              left: placement.left,
              top: placement.top,
              width: placement.width,
              height: placement.height,
              transform: [
                ...(cal.mirrorX ? [{ scaleX: -1 as const }] : []),
                { rotate: `${placement.rotationDeg}deg` },
              ],
              zIndex: 1,
            },
          ]}
        >
          {/* Static crop: rightmost detached strokes excluded; full crescent visible. */}
          <View style={styles.crop}>
            <AnimatedView style={imageStyle}>
              <Image
                source={WARDEN_STRIKE_SWING_SMEAR}
                style={{
                  width: placement.imageWidth,
                  height: placement.height,
                  ...(Platform.OS === 'web'
                    && !WARDEN_STRIKE_VFX_LAYER_TOGGLES.smearProofOpaque
                    ? {
                        filter: `brightness(${cal.brightness ?? 1}) contrast(${cal.contrast ?? 1})`,
                      }
                    : null),
                }}
                resizeMode="stretch"
              />
            </AnimatedView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    overflow: 'hidden',
  },
  crop: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
