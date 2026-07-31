/**
 * Target-local Warden's Strike contact — authored burst / incision / fracture PNGs.
 */

import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { WardenStrikeDefenseMaterial, WardenStrikeOutcome } from '../../data/wardenStrikePresentation';
import {
  WARDEN_STRIKE_ART_CALIBRATION,
  WARDEN_STRIKE_COLORS,
  WARDEN_STRIKE_SIZES,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  authoredSlashRotationDeg,
} from '../../data/wardenStrikePresentation';
import {
  WARDEN_STRIKE_CONTACT_BURST,
  WARDEN_STRIKE_FRACTURE_CRACK,
  WARDEN_STRIKE_INCISION,
} from '../../data/wardenStrikeArt';
import { scalePresentationMs } from '../../data/weaponCombatPresentation/presentationSettings';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';
import { PLAYER_POSE_ALIGN_DEBUG } from '../../utils/combatPoseRegistration';

interface WardenStrikeContactFxProps {
  active: boolean;
  outcome: WardenStrikeOutcome;
  defenseMaterial: WardenStrikeDefenseMaterial;
  fractureApplied: boolean;
  facingX?: number;
  facingY?: number;
  reducedMotion?: boolean;
  reducedFlash?: boolean;
  /** Burst + defense marks (enemy portrait center). */
  enableBurst?: boolean;
  /** Delayed cut — enemy portrait center with burst. */
  enableIncision?: boolean;
  /** Conditional Fracture crack (enemy-local). */
  enableFracture?: boolean;
}

export default function WardenStrikeContactFx({
  active,
  outcome,
  defenseMaterial,
  fractureApplied,
  facingX = 1,
  facingY = 0.25,
  reducedMotion = false,
  reducedFlash = false,
  enableBurst = true,
  enableIncision = true,
  enableFracture = true,
}: WardenStrikeContactFxProps): React.JSX.Element | null {
  const burstOpacity = useSharedValue(0);
  const burstScale = useSharedValue(1);
  const underlayOpacity = useSharedValue(0);
  const incisionOpacity = useSharedValue(0);
  const fractureOpacity = useSharedValue(0);
  const fractureScale = useSharedValue(0.92);
  const settings = getCombatPresentationSettings();

  const burstCal = WARDEN_STRIKE_ART_CALIBRATION.contactBurst;
  const incCal = WARDEN_STRIKE_ART_CALIBRATION.incision;
  const fxCal = WARDEN_STRIKE_ART_CALIBRATION.fractureCrack;

  const popIn = scalePresentationMs(burstCal.popInMs, settings.combatSpeed);
  const hold = scalePresentationMs(burstCal.holdMs, settings.combatSpeed);
  const fade = scalePresentationMs(burstCal.fadeMs, settings.combatSpeed);
  const incisionDelay = scalePresentationMs(incCal.delayMs ?? 0, settings.combatSpeed);
  const incisionLife = scalePresentationMs(incCal.lifetimeMs, settings.combatSpeed);
  const fractureDelay = scalePresentationMs(fxCal.delayMs, settings.combatSpeed);
  const fractureLife = scalePresentationMs(fxCal.lifetimeMs, settings.combatSpeed);

  const isMiss = outcome === 'MISS' || outcome === 'EVADE';
  const isArmor = defenseMaterial === 'KINETIC_ARMOR';
  const isWard = defenseMaterial === 'OCCULT_WARD';
  const showFlesh = !isMiss && !isArmor && !isWard;
  const showBurst = enableBurst
    && showFlesh
    && WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredContactBurst;
  const showIncision = enableIncision
    && showFlesh
    && WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredIncision;
  const showFracture = enableFracture
    && showFlesh
    && fractureApplied
    && WARDEN_STRIKE_VFX_LAYER_TOGGLES.authoredFractureCrack;
  const showDefenseMarks = enableBurst && (isArmor || isWard);
  const showProcedural = WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralContactComparison;
  const showSparks = WARDEN_STRIKE_VFX_LAYER_TOGGLES.proceduralSparks;

  const burstRot = authoredSlashRotationDeg(facingX, facingY, burstCal.sourceAxisDeg);
  const incisionRot = authoredSlashRotationDeg(
    facingX,
    facingY,
    incCal.sourceAxisDeg,
    incCal.rotationDeg ?? 0,
  );
  const fractureRot = authoredSlashRotationDeg(
    facingX,
    facingY,
    burstCal.sourceAxisDeg,
    fxCal.rotationDeg,
  );

  useEffect(() => {
    if (!active || isMiss) {
      burstOpacity.value = 0;
      underlayOpacity.value = 0;
      incisionOpacity.value = 0;
      fractureOpacity.value = 0;
      return;
    }

    const burstPeak = reducedFlash
      ? burstCal.reducedFlashPeakOpacity
      : burstCal.peakOpacity;

    if (showBurst) {
      burstOpacity.value = 0;
      burstScale.value = reducedFlash ? 1 : 0.92;
      underlayOpacity.value = 0;
      burstOpacity.value = withSequence(
        withTiming(burstPeak, { duration: popIn, easing: Easing.out(Easing.quad) }),
        withTiming(burstPeak, { duration: hold }),
        withTiming(0, { duration: fade, easing: Easing.in(Easing.quad) }),
      );
      const underlayFade = scalePresentationMs(
        burstCal.underlayFadeMs ?? 52,
        settings.combatSpeed,
      );
      underlayOpacity.value = withSequence(
        withTiming(burstCal.underlayPeakOpacity ?? 0.5, {
          duration: Math.max(12, popIn * 0.7),
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, { duration: underlayFade, easing: Easing.in(Easing.quad) }),
      );
      if (!reducedFlash) {
        burstScale.value = withSequence(
          withTiming(1.08, { duration: popIn, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: hold + fade, easing: Easing.out(Easing.quad) }),
        );
      } else {
        burstScale.value = 1;
      }
    }

    if (showIncision) {
      incisionOpacity.value = 0;
      incisionOpacity.value = withDelay(
        incisionDelay,
        withSequence(
          withTiming(incCal.peakOpacity, { duration: 32, easing: Easing.out(Easing.quad) }),
          withTiming(incCal.peakOpacity, { duration: Math.max(28, incisionLife * 0.4) }),
          withTiming(0, { duration: Math.max(48, incisionLife * 0.5), easing: Easing.in(Easing.quad) }),
        ),
      );
    }

    if (showFracture) {
      const fracturePeak = WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureIsolationMode
        ? 1
        : fxCal.peakOpacity;
      fractureOpacity.value = 0;
      fractureScale.value = fxCal.scaleFrom;
      fractureOpacity.value = withDelay(
        fractureDelay,
        withSequence(
          withTiming(fracturePeak, { duration: 40, easing: Easing.out(Easing.quad) }),
          withTiming(fracturePeak, { duration: Math.max(30, fractureLife * 0.35) }),
          withTiming(0, { duration: Math.max(50, fractureLife * 0.5), easing: Easing.in(Easing.quad) }),
        ),
      );
      fractureScale.value = withDelay(
        fractureDelay,
        withTiming(1, { duration: 70, easing: Easing.out(Easing.cubic) }),
      );
      if (
        typeof __DEV__ !== 'undefined'
        && __DEV__
        && WARDEN_STRIKE_VFX_LAYER_TOGGLES.fractureIsolationMode
      ) {
        // eslint-disable-next-line no-console
        console.info('[WARDEN FRACTURE PROOF]', {
          fractureApplied,
          peakOpacity: fracturePeak,
          logicalWidthPx: fxCal.logicalWidthPx,
          delayMs: fractureDelay,
          lifetimeMs: fractureLife,
        });
      }
    }
  }, [
    active,
    burstCal.peakOpacity,
    burstCal.reducedFlashPeakOpacity,
    burstOpacity,
    burstScale,
    underlayOpacity,
    fade,
    fractureDelay,
    fractureLife,
    fractureOpacity,
    fractureScale,
    fxCal.peakOpacity,
    fxCal.scaleFrom,
    hold,
    incCal.peakOpacity,
    incisionLife,
    incisionDelay,
    incisionOpacity,
    isMiss,
    popIn,
    reducedFlash,
    showBurst,
    showFracture,
    showIncision,
  ]);

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [
      { rotate: `${burstRot}deg` },
      { scale: burstScale.value },
    ],
  }));
  const underlayStyle = useAnimatedStyle(() => ({
    opacity: underlayOpacity.value,
  }));
  const incisionStyle = useAnimatedStyle(() => ({
    opacity: incisionOpacity.value,
    transform: [{ rotate: `${incisionRot}deg` }],
  }));
  const fractureStyle = useAnimatedStyle(() => ({
    opacity: fractureOpacity.value,
    transform: [
      { rotate: `${fractureRot}deg` },
      { scale: fractureScale.value },
    ],
  }));

  if (!active || isMiss) return null;
  if (!WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactFx) return null;
  if (!showBurst && !showIncision && !showFracture && !showDefenseMarks) return null;

  const burstW = burstCal.logicalWidthPx;
  const burstH = burstW * (burstCal.sourceHeight / burstCal.sourceWidth);
  // Incision shares the burst footprint (same place / size on tip).
  const incisionL = burstW;
  const incisionH = burstH;
  const fractureW = fxCal.logicalWidthPx;
  const fractureH = fractureW * (fxCal.sourceHeight / fxCal.sourceWidth);

  const len = Math.hypot(facingX, facingY) || 1;
  const ux = facingX / len;
  const uy = facingY / len;
  const sparkCount = reducedMotion ? 2 : Math.min(3, WARDEN_STRIKE_SIZES.sparkCount);

  const showBounds = WARDEN_STRIKE_VFX_LAYER_TOGGLES.contactBoundsDebug
    || PLAYER_POSE_ALIGN_DEBUG;

  return (
    <View style={styles.host} pointerEvents="none">
      {showBounds ? (
        <View style={styles.debugCenter} pointerEvents="none">
          <View style={styles.debugCrossH} />
          <View style={styles.debugCrossV} />
        </View>
      ) : null}

      {showBurst ? (
        <>
          <Animated.View
            style={[
              styles.underlay,
              {
                width: burstCal.underlaySizePx ?? 30,
                height: burstCal.underlaySizePx ?? 30,
                marginLeft: -((burstCal.underlaySizePx ?? 30) / 2),
                marginTop: -((burstCal.underlaySizePx ?? 30) / 2),
              },
              underlayStyle,
            ]}
            pointerEvents="none"
          />
          <Animated.View
            style={[
              styles.burst,
              {
                width: burstW,
                height: burstH,
                marginLeft: -burstW / 2 + burstCal.offsetX,
                marginTop: -burstH / 2 + burstCal.offsetY,
              },
              burstStyle,
            ]}
            pointerEvents="none"
          >
            {showBounds ? <View style={styles.debugBoundsBurst} /> : null}
            <Image
              source={WARDEN_STRIKE_CONTACT_BURST}
              style={styles.fill}
              resizeMode="contain"
            />
          </Animated.View>
        </>
      ) : null}

      {showIncision ? (
        <Animated.View
          style={[
            styles.incision,
            {
              width: incisionL,
              height: incisionH,
              marginLeft: -incisionL / 2 + burstCal.offsetX,
              marginTop: -incisionH / 2 + burstCal.offsetY,
            },
            incisionStyle,
          ]}
          pointerEvents="none"
        >
          {showBounds ? <View style={styles.debugBoundsIncision} /> : null}
          <Image source={WARDEN_STRIKE_INCISION} style={styles.fill} resizeMode="contain" />
        </Animated.View>
      ) : null}

      {showFracture ? (
        <Animated.View
          style={[
            styles.fracture,
            {
              width: fractureW,
              height: fractureH,
              marginLeft: -fractureW / 2 + fxCal.offsetX,
              marginTop: -fractureH / 2 + fxCal.offsetY,
            },
            fractureStyle,
          ]}
          pointerEvents="none"
        >
          {showBounds ? <View style={styles.debugBoundsFracture} /> : null}
          <Image
            source={WARDEN_STRIKE_FRACTURE_CRACK}
            style={styles.fill}
            resizeMode="contain"
          />
        </Animated.View>
      ) : null}

      {showDefenseMarks && isArmor ? (
        <Svg width={72} height={72} style={styles.defenseSvg}>
          <Path
            d="M 22 44 L 34 22 L 52 36"
            stroke={WARDEN_STRIKE_COLORS.steelLead}
            strokeWidth={3.2}
            fill="none"
            strokeLinecap="square"
          />
          <Path
            d="M 26 48 L 38 28 L 54 40"
            stroke="rgba(200, 210, 220, 0.55)"
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="square"
          />
        </Svg>
      ) : null}
      {showDefenseMarks && isWard ? (
        <Svg width={72} height={72} style={styles.defenseSvg}>
          <Path
            d="M 20 40 Q 36 18 52 40"
            stroke="rgba(167, 139, 250, 0.92)"
            strokeWidth={3}
            fill="none"
          />
          <Path
            d="M 24 44 Q 36 28 48 44"
            stroke="rgba(196, 181, 253, 0.55)"
            strokeWidth={1.6}
            fill="none"
          />
        </Svg>
      ) : null}

      {(showSparks || showProcedural) && showFlesh ? (
        <Svg width={72} height={72} style={styles.sparkSvg}>
          {showSparks
            ? Array.from({ length: sparkCount }).map((_, i) => {
              const baseAngle = Math.atan2(uy, ux);
              const angle = baseAngle + (-0.4 + i * 0.35);
              const travel = WARDEN_STRIKE_SIZES.sparkTravelPx * (0.55 + (i % 3) * 0.15);
              const cx = 36;
              const cy = 36;
              return (
                <Line
                  key={`spark-${i}`}
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(angle) * travel}
                  y2={cy + Math.sin(angle) * travel}
                  stroke={WARDEN_STRIKE_COLORS.spark}
                  strokeWidth={1.1}
                  strokeLinecap="round"
                  opacity={0.7}
                />
              );
            })
            : null}
          {showProcedural ? (
            <Line
              x1={36 - ux * 18}
              y1={36 - uy * 18}
              x2={36 + ux * 18}
              y2={36 + uy * 18}
              stroke={WARDEN_STRIKE_COLORS.incision}
              strokeWidth={1.5}
              opacity={0.45}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
    zIndex: 14,
    overflow: 'visible',
  },
  burst: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 3,
    overflow: 'visible',
  },
  underlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(18, 20, 24, 0.92)',
  },
  incision: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
    overflow: 'visible',
  },
  fracture: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 4,
    overflow: 'visible',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  defenseSvg: {
    position: 'absolute',
    left: -36,
    top: -36,
    zIndex: 5,
  },
  sparkSvg: {
    position: 'absolute',
    left: -36,
    top: -36,
    zIndex: 1,
  },
  debugCenter: {
    position: 'absolute',
    left: -6,
    top: -6,
    width: 12,
    height: 12,
    zIndex: 20,
  },
  debugCrossH: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 12,
    height: 2,
    backgroundColor: '#ff00aa',
  },
  debugCrossV: {
    position: 'absolute',
    left: 5,
    top: 0,
    width: 2,
    height: 12,
    backgroundColor: '#ff00aa',
  },
  debugBoundsBurst: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    zIndex: 1,
  },
  debugBoundsIncision: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: '#66ccff',
    backgroundColor: 'rgba(102, 204, 255, 0.12)',
    zIndex: 1,
  },
  debugBoundsFracture: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    backgroundColor: 'rgba(167, 243, 208, 0.12)',
    zIndex: 1,
  },
});
