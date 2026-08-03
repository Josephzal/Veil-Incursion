/**
 * ABYSSAL VERDICT cinematic overlay — non-interactive, pointerEvents none.
 * Renders only while a live activation token is active and phase is not idle.
 *
 * `layer="screen"` — stealth vignette (mount outside world camera).
 * `layer="poses"` — Aegis charge/release + blade VFX (mount inside world camera).
 * Gameplay reveal stays on IMPACT.
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { ABYSSAL_VERDICT_ART } from '../../data/abyssalVerdictArt';
import {
  computeAbyssalVerdictPoseLayouts,
  getAbyssalVerdictTimeline,
  isAbyssalVerdictPresentationActive,
  subscribeAbyssalVerdictPresentation,
  type AbyssalVerdictPhase,
  type AbyssalVerdictPresentationEvent,
} from '../../data/abyssalVerdictPresentation';

type CinematicLayer = 'all' | 'screen' | 'poses';

type LayerVisibility = {
  darken: number;
  framing: number;
  title: number;
  poseCharge: number;
  poseRelease: number;
  veilPull: number;
  bladeCharge: number;
  edgeFlare: number;
  hideNormalSprite: boolean;
  releaseDisplaceX: number;
  bladeReveal: number;
  veilCompress: number;
  travelStreak: number;
  wisps: boolean;
};

const HIDDEN: LayerVisibility = {
  darken: 0,
  framing: 0,
  title: 0,
  poseCharge: 0,
  poseRelease: 0,
  veilPull: 0,
  bladeCharge: 0,
  edgeFlare: 0,
  hideNormalSprite: false,
  releaseDisplaceX: 0,
  bladeReveal: 0,
  veilCompress: 1,
  travelStreak: 0,
  wisps: false,
};

function visibilityForPhase(
  phase: AbyssalVerdictPhase,
  reducedMotion: boolean,
): LayerVisibility {
  const tl = getAbyssalVerdictTimeline(reducedMotion);
  switch (phase) {
    case 'idle':
    case 'done':
      return HIDDEN;
    case 'activation':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity * 0.6,
        framing: tl.framingOpacity * 0.55,
        hideNormalSprite: true,
        poseCharge: 1,
      };
    case 'charge':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity * 0.85,
        framing: tl.framingOpacity * 0.9,
        poseCharge: 1,
        hideNormalSprite: true,
      };
    case 'veil_pull':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity,
        framing: tl.framingOpacity,
        poseCharge: 1,
        veilPull: tl.veilPull.opacity,
        veilCompress: 0.94,
        hideNormalSprite: true,
      };
    case 'blade_charge':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity,
        framing: tl.framingOpacity,
        poseCharge: 1,
        veilPull: tl.veilPull.opacity * 0.7,
        bladeCharge: tl.bladeCharge.opacity,
        bladeReveal: 0.55,
        veilCompress: 0.9,
        hideNormalSprite: true,
      };
    case 'edge_flare':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity,
        framing: tl.framingOpacity,
        poseCharge: 1,
        veilPull: tl.veilPull.opacity * 0.45,
        bladeCharge: tl.bladeCharge.opacity * 0.85,
        edgeFlare: tl.edgeFlare.opacity * 0.55,
        bladeReveal: 0.85,
        veilCompress: 0.88,
        hideNormalSprite: true,
      };
    case 'anticipation':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity,
        framing: tl.framingOpacity,
        poseCharge: 1,
        bladeCharge: tl.bladeCharge.opacity * 0.7,
        edgeFlare: tl.edgeFlare.opacity,
        bladeReveal: 1,
        veilCompress: 0.86,
        hideNormalSprite: true,
      };
    case 'release':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity * 0.92,
        framing: tl.framingOpacity * 0.95,
        poseRelease: 1,
        edgeFlare: 0.9,
        releaseDisplaceX: tl.releaseDisplacePx,
        hideNormalSprite: true,
        travelStreak: 1,
      };
    case 'delayed_cut':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity * 0.9,
        framing: tl.framingOpacity * 0.9,
        poseRelease: 1,
        releaseDisplaceX: tl.releaseDisplacePx,
        hideNormalSprite: true,
      };
    case 'impact':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity * 0.75,
        framing: tl.framingOpacity * 0.85,
        poseRelease: 1,
        releaseDisplaceX: tl.releaseDisplacePx,
        hideNormalSprite: true,
      };
    case 'recovery':
      return {
        ...HIDDEN,
        darken: tl.darkenOpacity * 0.35,
        framing: tl.framingOpacity * 0.4,
        poseRelease: 0.55,
        releaseDisplaceX: tl.releaseDisplacePx * 0.35,
        hideNormalSprite: true,
      };
    default:
      return HIDDEN;
  }
}

function vfxBox(box: {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}) {
  return {
    left: `${box.leftPct}%`,
    top: `${box.topPct}%`,
    width: `${box.widthPct}%`,
    height: `${box.heightPct}%`,
  } as const;
}

interface AbyssalVerdictCinematicProps {
  /**
   * `screen` — stealth vignette only (mount outside world camera).
   * `poses` — Aegis charge/release + blade VFX (mount inside world camera).
   * `all` — both (legacy / tests).
   */
  layer?: CinematicLayer;
}

export default function AbyssalVerdictCinematic({
  layer = 'all',
}: AbyssalVerdictCinematicProps): React.JSX.Element | null {
  const showScreen = layer === 'all' || layer === 'screen';
  const showPoses = layer === 'all' || layer === 'poses';
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<AbyssalVerdictPhase>('idle');
  const [boundToken, setBoundToken] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const vignetteUid = useId().replace(/:/g, '');

  const darken = useRef(new Animated.Value(0)).current;
  const framing = useRef(new Animated.Value(0)).current;
  const titleOp = useRef(new Animated.Value(0)).current;
  const poseCharge = useRef(new Animated.Value(0)).current;
  const poseRelease = useRef(new Animated.Value(0)).current;
  const veilPull = useRef(new Animated.Value(0)).current;
  const bladeCharge = useRef(new Animated.Value(0)).current;
  const edgeFlare = useRef(new Animated.Value(0)).current;
  const releaseX = useRef(new Animated.Value(0)).current;
  const bladeReveal = useRef(new Animated.Value(0)).current;
  const veilScaleX = useRef(new Animated.Value(1)).current;
  const pressureFlash = useRef(new Animated.Value(0)).current;
  const palmPulse = useRef(new Animated.Value(0)).current;
  const travelOp = useRef(new Animated.Value(0)).current;
  const travelProgress = useRef(new Animated.Value(0)).current;
  const boundTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const activePoseRef = useRef<'none' | 'charge' | 'release'>('none');

  const animatedValues = useMemo(() => [
    darken,
    framing,
    titleOp,
    poseCharge,
    poseRelease,
    veilPull,
    bladeCharge,
    edgeFlare,
    releaseX,
    bladeReveal,
    veilScaleX,
    pressureFlash,
    palmPulse,
    travelOp,
    travelProgress,
  ], [
    bladeCharge,
    bladeReveal,
    darken,
    edgeFlare,
    framing,
    palmPulse,
    poseCharge,
    poseRelease,
    pressureFlash,
    releaseX,
    titleOp,
    travelOp,
    travelProgress,
    veilPull,
    veilScaleX,
  ]);

  const hardResetVisuals = () => {
    animatedValues.forEach((value) => {
      value.stopAnimation();
    });
    darken.setValue(0);
    framing.setValue(0);
    titleOp.setValue(0);
    poseCharge.setValue(0);
    poseRelease.setValue(0);
    veilPull.setValue(0);
    bladeCharge.setValue(0);
    edgeFlare.setValue(0);
    releaseX.setValue(0);
    bladeReveal.setValue(0);
    veilScaleX.setValue(1);
    pressureFlash.setValue(0);
    palmPulse.setValue(0);
    travelOp.setValue(0);
    travelProgress.setValue(0);
    activePoseRef.current = 'none';
  };

  const pulsePalm = useRef(() => {
    palmPulse.stopAnimation();
    palmPulse.setValue(0.7);
    Animated.timing(palmPulse, {
      toValue: 0,
      duration: 90,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }).current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hardResetVisuals();
      boundTokenRef.current = 0;
      // Only the pose layer owns cancel — screen vignette may remount independently.
      if (showPoses && isAbyssalVerdictPresentationActive()) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require('../../data/abyssalVerdictPresentation') as {
            cancelAbyssalVerdictPresentation: () => void;
          };
          mod.cancelAbyssalVerdictPresentation();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup
  }, []);

  useEffect(() => subscribeAbyssalVerdictPresentation((event: AbyssalVerdictPresentationEvent) => {
    if (!mountedRef.current) return;

    if (event.phase === 'idle' || event.phase === 'done') {
      boundTokenRef.current = 0;
      hardResetVisuals();
      setBoundToken(0);
      setActive(false);
      setPhase('idle');
      return;
    }

    if (boundTokenRef.current !== 0 && event.activationToken !== boundTokenRef.current) {
      return;
    }
    if (boundTokenRef.current === 0) {
      boundTokenRef.current = event.activationToken;
      setBoundToken(event.activationToken);
    } else if (event.activationToken !== boundTokenRef.current) {
      return;
    }

    setReducedMotion(event.reducedMotion);
    setActive(true);
    setPhase(event.phase);

    const tl = getAbyssalVerdictTimeline(event.reducedMotion);
    const next = visibilityForPhase(event.phase, event.reducedMotion);
    const fade = (
      value: Animated.Value,
      toValue: number,
      duration: number,
      easing: (t: number) => number = Easing.inOut(Easing.cubic),
    ) => {
      value.stopAnimation();
      Animated.timing(value, {
        toValue,
        duration,
        easing,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    };

    const screenMs = event.phase === 'activation'
      ? 160
      : event.phase === 'recovery'
        ? 280
        : event.phase === 'impact'
          ? 120
          : 220;
    fade(darken, next.darken, screenMs);
    fade(framing, next.framing, screenMs);

    const wantCharge = next.poseCharge > 0;
    const wantRelease = next.poseRelease > 0;
    if (wantCharge && activePoseRef.current !== 'charge') {
      poseRelease.stopAnimation();
      poseRelease.setValue(0);
      poseCharge.stopAnimation();
      poseCharge.setValue(1);
      activePoseRef.current = 'charge';
      if (event.phase === 'charge' || event.phase === 'veil_pull') pulsePalm();
    } else if (wantRelease && activePoseRef.current !== 'release') {
      // Soft crossfade into release so the zoom-out doesn't hitch on a hard pose pop.
      const swapMs = Math.max(48, Math.min(90, tl.poseSwapMs + 40));
      fade(poseCharge, 0, swapMs, Easing.out(Easing.quad));
      poseRelease.stopAnimation();
      poseRelease.setValue(0);
      fade(poseRelease, 1, swapMs, Easing.out(Easing.cubic));
      activePoseRef.current = 'release';
    } else if (!wantCharge && !wantRelease) {
      fade(poseCharge, 0, 160);
      fade(poseRelease, 0, 160);
      activePoseRef.current = 'none';
    }

    if (next.poseCharge > 0) {
      fade(veilPull, next.veilPull, 160);
      fade(bladeCharge, next.bladeCharge, 180);
      fade(edgeFlare, next.edgeFlare, 140);
      fade(bladeReveal, next.bladeReveal, 200);
      fade(veilScaleX, next.veilCompress, 200);
    } else {
      fade(veilPull, 0, 120);
      fade(bladeCharge, 0, 120);
      fade(edgeFlare, 0, 100);
    }

    fade(releaseX, 0, 1);

    if (next.travelStreak > 0) {
      travelOp.setValue(0);
    } else {
      travelOp.stopAnimation();
      travelProgress.stopAnimation();
      travelOp.setValue(0);
      travelProgress.setValue(0);
    }

    if (event.phase === 'impact' && !event.reducedFlash) {
      pressureFlash.stopAnimation();
      pressureFlash.setValue(0.55);
      Animated.timing(pressureFlash, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }
  }), animatedValues);

  const tl = useMemo(() => getAbyssalVerdictTimeline(reducedMotion), [reducedMotion]);
  const poseLayouts = useMemo(() => computeAbyssalVerdictPoseLayouts(tl), [tl]);

  if (!active || phase === 'idle' || boundToken === 0) return null;

  const radialId = `abyssalStealthRadial-${vignetteUid}`;
  const topGradId = `abyssalStealthTop-${vignetteUid}`;
  const bottomGradId = `abyssalStealthBottom-${vignetteUid}`;
  const leftGradId = `abyssalStealthLeft-${vignetteUid}`;
  const rightGradId = `abyssalStealthRight-${vignetteUid}`;

  return (
    <View style={styles.root} pointerEvents="none">
      {showScreen ? (
        <>
          <Animated.View
            style={[styles.fill, { opacity: darken, backgroundColor: 'rgba(8, 4, 10, 1)' }]}
            pointerEvents="none"
          />
          <Animated.View style={[styles.framingHost, { opacity: framing }]} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient
                  id={radialId}
                  cx="42%"
                  cy="58%"
                  rx="62%"
                  ry="68%"
                >
                  <Stop offset="0" stopColor="#050208" stopOpacity="0" />
                  <Stop offset="0.42" stopColor="#050208" stopOpacity="0" />
                  <Stop offset="0.68" stopColor="#050208" stopOpacity={0.22 * tl.vignetteOpacity} />
                  <Stop offset="0.86" stopColor="#030105" stopOpacity={0.55 * tl.vignetteOpacity} />
                  <Stop offset="1" stopColor="#020103" stopOpacity={0.82 * tl.vignetteOpacity} />
                </RadialGradient>
                <LinearGradient id={topGradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#020103" stopOpacity={0.72 * tl.vignetteOpacity} />
                  <Stop offset="0.55" stopColor="#020103" stopOpacity={0.22 * tl.vignetteOpacity} />
                  <Stop offset="1" stopColor="#020103" stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id={bottomGradId} x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0" stopColor="#020103" stopOpacity={0.7 * tl.vignetteOpacity} />
                  <Stop offset="0.6" stopColor="#020103" stopOpacity={0.2 * tl.vignetteOpacity} />
                  <Stop offset="1" stopColor="#020103" stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id={leftGradId} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#020103" stopOpacity={0.75 * tl.vignetteOpacity} />
                  <Stop offset="0.55" stopColor="#020103" stopOpacity={0.2 * tl.vignetteOpacity} />
                  <Stop offset="1" stopColor="#020103" stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id={rightGradId} x1="1" y1="0" x2="0" y2="0">
                  <Stop offset="0" stopColor="#020103" stopOpacity={0.78 * tl.vignetteOpacity} />
                  <Stop offset="0.55" stopColor="#020103" stopOpacity={0.22 * tl.vignetteOpacity} />
                  <Stop offset="1" stopColor="#020103" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${radialId})`} />
              <Rect x="0" y="0" width="100%" height="22%" fill={`url(#${topGradId})`} />
              <Rect x="0" y="78%" width="100%" height="22%" fill={`url(#${bottomGradId})`} />
              <Rect x="0" y="0" width="18%" height="100%" fill={`url(#${leftGradId})`} />
              <Rect x="82%" y="0" width="18%" height="100%" fill={`url(#${rightGradId})`} />
            </Svg>
          </Animated.View>
        </>
      ) : null}

      {showPoses ? (
        <Animated.View
          style={[
            styles.actorPlane,
            {
              left: `${tl.actorPlaneLeftPct}%`,
              bottom: `${tl.actorPlaneBottomPct}%`,
              width: `${tl.actorPlaneWidthPct}%`,
              height: `${tl.actorPlaneHeightPct}%`,
            },
          ]}
          pointerEvents="none"
        >
          <Animated.View
            style={[styles.pressureFlash, { opacity: pressureFlash }]}
            pointerEvents="none"
          />

          <Animated.View
            style={[
              styles.poseHost,
              {
                width: `${poseLayouts.charge.widthPct}%`,
                height: `${poseLayouts.charge.heightPct}%`,
                opacity: poseCharge,
                transform: [
                  { translateX: tl.chargePoseOffsetX },
                  { translateY: tl.chargePoseOffsetY + tl.poseBaselineOffsetY },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Animated.Image
              source={ABYSSAL_VERDICT_ART.poseCharge}
              style={styles.poseFill}
              resizeMode="contain"
            />
            <Animated.Image
              source={ABYSSAL_VERDICT_ART.veilPull}
              style={[
                styles.vfx,
                vfxBox(tl.veilPull),
                {
                  opacity: veilPull,
                  transform: [
                    { scale: tl.veilPull.scale },
                    { scaleX: veilScaleX },
                    { rotate: `${tl.veilPull.rotateDeg}deg` },
                  ],
                },
              ]}
              resizeMode="contain"
            />
            <Animated.View
              style={[
                styles.palmPulse,
                {
                  left: `${tl.palm.leftPct}%`,
                  top: `${tl.palm.topPct}%`,
                  opacity: palmPulse,
                  transform: [{
                    scale: palmPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.35],
                    }),
                  }],
                },
              ]}
              pointerEvents="none"
            />
            <View
              style={[styles.vfx, vfxBox(tl.bladeCharge), styles.bladeClip]}
              pointerEvents="none"
            >
              <Animated.Image
                source={ABYSSAL_VERDICT_ART.bladeCharge}
                style={[
                  styles.bladeFill,
                  {
                    opacity: bladeCharge,
                    transform: [
                      { scale: tl.bladeCharge.scale },
                      { rotate: `${tl.bladeCharge.rotateDeg}deg` },
                      {
                        translateY: bladeReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [28, 0],
                        }),
                      },
                    ],
                  },
                ]}
                resizeMode="contain"
              />
            </View>
            {/* Clip keeps flare on the steel — not the grip / pommel. */}
            <View
              style={[styles.vfx, vfxBox(tl.edgeFlare), styles.bladeClip]}
              pointerEvents="none"
            >
              <Animated.Image
                source={ABYSSAL_VERDICT_ART.edgeFlare}
                style={[
                  styles.bladeFill,
                  {
                    opacity: edgeFlare,
                    transform: [
                      { scale: tl.edgeFlare.scale },
                      { rotate: `${tl.edgeFlare.rotateDeg}deg` },
                    ],
                  },
                ]}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.poseHost,
              {
                width: `${poseLayouts.release.widthPct}%`,
                height: `${poseLayouts.release.heightPct}%`,
                opacity: poseRelease,
                transform: [
                  { translateX: tl.releasePoseOffsetX },
                  { translateY: tl.releasePoseOffsetY + tl.poseBaselineOffsetY },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Animated.Image
              source={ABYSSAL_VERDICT_ART.poseRelease}
              style={styles.poseFill}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 46,
    elevation: 46,
    pointerEvents: 'none',
    overflow: 'visible',
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  framingHost: {
    ...StyleSheet.absoluteFill,
  },
  actorPlane: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  pressureFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(28, 6, 14, 0.55)',
  },
  poseHost: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    overflow: 'visible',
  },
  poseFill: {
    width: '100%',
    height: '100%',
  },
  vfx: {
    position: 'absolute',
  },
  palmPulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: 'rgba(200, 70, 140, 0.55)',
  },
  bladeClip: {
    overflow: 'hidden',
  },
  bladeFill: {
    width: '100%',
    height: '100%',
  },
});
