/**
 * Class damage feedback — shards that spawn off-center on the body,
 * spray past the enemy bounds, and fade out just outside.
 * Aegis: red / blackish shards + deep red blood mist.
 * Hex Shot: shorter yellowish / burnt-orange shards + deep red blood mist.
 * Envoy: Aegis-spread pink / purple / near-black shards + rising occult smoke + pink embers.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';

export type EnemyBloodBurstVariant = 'aegis' | 'hex' | 'envoy';

const BLOOD_REDS = [
  'rgba(168, 22, 28, 0.95)',
  'rgba(140, 12, 18, 0.92)',
  'rgba(196, 36, 42, 0.9)',
  'rgba(110, 8, 14, 0.94)',
] as const;

/** Hex shard primary — sulfur / brass yellow (mist stays deep red). */
const HEX_SHARD_YELLOWS = [
  'rgba(232, 198, 72, 0.95)',
  'rgba(212, 176, 48, 0.93)',
  'rgba(245, 214, 96, 0.9)',
  'rgba(196, 158, 36, 0.94)',
  'rgba(220, 188, 64, 0.92)',
] as const;

const BLACKISH = [
  'rgba(12, 10, 12, 0.92)',
  'rgba(28, 22, 24, 0.9)',
  'rgba(8, 6, 8, 0.88)',
  'rgba(40, 28, 30, 0.86)',
] as const;

const BURNT_ORANGE = [
  'rgba(194, 92, 24, 0.94)',
  'rgba(168, 70, 16, 0.92)',
  'rgba(212, 108, 32, 0.9)',
  'rgba(128, 54, 12, 0.9)',
  'rgba(176, 78, 20, 0.88)',
] as const;

/** Envoy shard palette — deep pink, violet, near-black occult ink. */
const ENVOY_PINKS = [
  'rgba(210, 42, 130, 0.95)',
  'rgba(186, 28, 112, 0.93)',
  'rgba(232, 64, 148, 0.9)',
  'rgba(168, 22, 98, 0.94)',
  'rgba(196, 48, 140, 0.92)',
] as const;

const ENVOY_PURPLES = [
  'rgba(118, 28, 168, 0.95)',
  'rgba(86, 18, 140, 0.93)',
  'rgba(142, 44, 190, 0.9)',
  'rgba(68, 12, 118, 0.94)',
  'rgba(104, 24, 154, 0.92)',
] as const;

const ENVOY_NEAR_BLACK = [
  'rgba(14, 4, 18, 0.95)',
  'rgba(10, 2, 14, 0.93)',
  'rgba(22, 6, 28, 0.9)',
  'rgba(8, 2, 12, 0.94)',
  'rgba(28, 8, 36, 0.88)',
] as const;

/** Deep desaturated blood — dense core vs wispy fringe. */
const MIST_CORE = [
  'rgba(78, 4, 10, 0.72)',
  'rgba(96, 8, 14, 0.62)',
  'rgba(62, 2, 8, 0.68)',
] as const;

const MIST_WISP = [
  'rgba(110, 12, 18, 0.38)',
  'rgba(84, 6, 12, 0.32)',
  'rgba(128, 18, 24, 0.28)',
  'rgba(58, 2, 8, 0.34)',
] as const;

const MIST_STREAK = [
  'rgba(140, 16, 24, 0.55)',
  'rgba(96, 8, 14, 0.48)',
  'rgba(72, 4, 10, 0.52)',
  'rgba(118, 14, 20, 0.42)',
] as const;

/** Occult smoke — almost black violet haze. */
const SMOKE_DARK = [
  'rgba(12, 2, 16, 0.58)',
  'rgba(18, 4, 24, 0.5)',
  'rgba(8, 1, 12, 0.54)',
  'rgba(24, 6, 32, 0.44)',
  'rgba(16, 3, 22, 0.48)',
] as const;

/** Pink embers that lift out of the smoke and die quickly. */
const EMBER_PINKS = [
  'rgba(255, 96, 168, 0.95)',
  'rgba(236, 72, 148, 0.92)',
  'rgba(210, 48, 128, 0.9)',
  'rgba(255, 120, 186, 0.88)',
  'rgba(196, 40, 118, 0.9)',
] as const;

/**
 * Always longer than wide. Widths are base thickness; length runs tip→base.
 * Thick / chunky read as real shards, not hairlines.
 */
const AEGIS_WIDTH_TIERS = {
  skinny: { width: 2.5, lengthMin: 16, lengthMax: 28 },
  medium: { width: 5, lengthMin: 20, lengthMax: 34 },
  thick: { width: 8.5, lengthMin: 24, lengthMax: 40 },
  chunky: { width: 12, lengthMin: 28, lengthMax: 44 },
} as const;

/** Hex shards keep the same thickness band but run shorter. */
const HEX_WIDTH_TIERS = {
  skinny: { width: 2.5, lengthMin: 9, lengthMax: 15 },
  medium: { width: 4.5, lengthMin: 11, lengthMax: 18 },
  thick: { width: 7.5, lengthMin: 13, lengthMax: 22 },
  chunky: { width: 10, lengthMin: 15, lengthMax: 24 },
} as const;

type WidthTier = keyof typeof AEGIS_WIDTH_TIERS;

type ShardSpec = {
  id: string;
  angleDeg: number;
  length: number;
  width: number;
  color: string;
  /** Asymmetry of the shard silhouette (0–1). */
  jagged: number;
  /** Distance from center where the shard first appears (already on the body). */
  startRadius: number;
  /** Distance from center at end of spray (well outside the enemy container). */
  endRadius: number;
  delayMs: number;
};

/** Directional mist particle — elongated streak/wisp, never a round puff. */
type MistSpec = {
  id: string;
  angleDeg: number;
  length: number;
  thickness: number;
  color: string;
  startRadius: number;
  endRadius: number;
  /** Extra downward drift by end of travel (gravity on heavier droplets). */
  gravity: number;
  delayMs: number;
  peakOpacity: number;
};

/** Rising occult smoke wisp or pink ember — elongated, never a hard circle. */
type SmokeSpec = {
  id: string;
  kind: 'plume' | 'ember';
  startX: number;
  endX: number;
  startY: number;
  /** Negative = upward (screen Y grows downward). */
  rise: number;
  /** Horizontal thickness of the wisp capsule. */
  width: number;
  /** Vertical length — smoke reads as a rising ribbon, not a disc. */
  height: number;
  /** Slight lean so columns don't look mechanical. */
  tiltDeg: number;
  color: string;
  delayMs: number;
  peakOpacity: number;
  /** Lateral billow as the wisp rises. */
  endScaleX: number;
  /** Vertical stretch / dissipation. */
  endScaleY: number;
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickWidthTier(): WidthTier {
  const roll = Math.random();
  if (roll < 0.28) return 'skinny';
  if (roll < 0.58) return 'medium';
  if (roll < 0.82) return 'thick';
  return 'chunky';
}

function pickEnvoyShardColor(): string {
  const roll = Math.random();
  if (roll < 0.34) return pick(ENVOY_PINKS);
  if (roll < 0.68) return pick(ENVOY_PURPLES);
  return pick(ENVOY_NEAR_BLACK);
}

/** Soft diamond with slight irregularity — not perfect geometry, not amorphous shards. */
function shardPolygonPoints(length: number, width: number, jagged: number): string {
  const midY = width / 2;
  const tipBias = (jagged - 0.5) * width * 0.1;
  const waist = 0.48 + jagged * 0.06;
  const tipX = length;
  const leftX = 0;
  const midX = length * waist;
  const topY = Math.max(0.35, midY * (0.08 + jagged * 0.12));
  const botY = Math.min(width - 0.35, midY + midY * (0.78 - jagged * 0.1));
  // Four-point diamond: left → top → tip → bottom, with a soft waist notch.
  return [
    `${leftX},${midY + tipBias * 0.4}`,
    `${midX * 0.55},${topY}`,
    `${midX},${Math.max(0.25, topY - width * 0.04)}`,
    `${tipX},${midY + tipBias}`,
    `${midX},${Math.min(width - 0.25, botY + width * 0.04)}`,
    `${midX * 0.55},${botY}`,
  ].join(' ');
}

function buildShards(variant: EnemyBloodBurstVariant, reduced: boolean): ShardSpec[] {
  const tiers = variant === 'hex' ? HEX_WIDTH_TIERS : AEGIS_WIDTH_TIERS;
  const primary = variant === 'hex'
    ? HEX_SHARD_YELLOWS
    : variant === 'envoy'
      ? ENVOY_PINKS
      : BLOOD_REDS;
  const accent = variant === 'hex'
    ? BURNT_ORANGE
    : variant === 'envoy'
      ? ENVOY_PURPLES
      : BLACKISH;
  // 10–15 shards; reduced-motion keeps the same band but prefers the low end.
  const count = reduced
    ? 10 + Math.floor(Math.random() * 3)
    : 10 + Math.floor(Math.random() * 6);
  const shards: ShardSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const tier = tiers[pickWidthTier()];
    const length = tier.lengthMin + Math.random() * (tier.lengthMax - tier.lengthMin);
    const startRadius = (reduced ? 24 : 30) + Math.random() * (reduced ? 16 : 22);
    const sprayCarry = variant === 'hex'
      ? (reduced ? 48 : 64) + Math.random() * (reduced ? 28 : 42)
      : (reduced ? 70 : 95) + Math.random() * (reduced ? 40 : 70);
    const endRadius = startRadius + sprayCarry;
    const color = variant === 'envoy'
      ? pickEnvoyShardColor()
      : Math.random() > 0.38 ? pick(primary) : pick(accent);
    shards.push({
      id: `s-${i}-${Math.random().toString(36).slice(2, 7)}`,
      angleDeg: Math.random() * 360,
      length,
      width: tier.width,
      color,
      jagged: Math.random(),
      startRadius,
      endRadius,
      delayMs: Math.floor(Math.random() * (reduced ? 20 : 36)),
    });
  }
  return shards;
}

function buildMist(reduced: boolean, scale = 1): MistSpec[] {
  const s = Math.max(0.5, scale);
  // Larger plumes need a bit more opacity so they don't read as thin haze.
  const opacityBoost = s > 1.05 ? Math.min(1.35, 0.92 + s * 0.12) : 1;
  // One primary spray heading + a tighter secondary plume for turbulence.
  const heading = Math.random() * 360;
  const fanHalf = reduced ? 34 : 42 + Math.random() * 18;
  const secondaryHeading = heading + (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 28);
  const mist: MistSpec[] = [];

  const pushParticle = (
    angleDeg: number,
    length: number,
    thickness: number,
    color: string,
    carry: number,
    peakOpacity: number,
    gravity: number,
    delayCap: number,
  ) => {
    const startRadius = (8 + Math.random() * 16) * s;
    mist.push({
      id: `m-${mist.length}-${Math.random().toString(36).slice(2, 7)}`,
      angleDeg,
      length: length * s,
      thickness: thickness * s,
      color,
      startRadius,
      endRadius: startRadius + carry * s,
      gravity: gravity * s,
      delayMs: Math.floor(Math.random() * delayCap),
      peakOpacity: Math.min(0.95, peakOpacity * opacityBoost),
    });
  };

  // Dense elongated core clumps — soft ovals along the spray axis.
  const coreCount = reduced ? 3 : 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < coreCount; i += 1) {
    const angle = heading + (Math.random() * 2 - 1) * fanHalf * 0.45;
    pushParticle(
      angle,
      (reduced ? 26 : 34) + Math.random() * (reduced ? 16 : 28),
      (reduced ? 10 : 14) + Math.random() * (reduced ? 8 : 12),
      pick(MIST_CORE),
      (reduced ? 28 : 40) + Math.random() * (reduced ? 18 : 28),
      0.55 + Math.random() * 0.25,
      6 + Math.random() * 14,
      reduced ? 12 : 20,
    );
  }

  // Mid wisps — softer, longer, more spread.
  const wispCount = reduced ? 6 : 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < wispCount; i += 1) {
    const useSecondary = Math.random() > 0.65;
    const base = useSecondary ? secondaryHeading : heading;
    const angle = base + (Math.random() * 2 - 1) * fanHalf;
    pushParticle(
      angle,
      (reduced ? 18 : 22) + Math.random() * (reduced ? 14 : 22),
      3.5 + Math.random() * 5.5,
      pick(MIST_WISP),
      (reduced ? 42 : 58) + Math.random() * (reduced ? 24 : 40),
      0.35 + Math.random() * 0.28,
      10 + Math.random() * 22,
      reduced ? 18 : 30,
    );
  }

  // Hairline streaks / needle fringe — particulate spray edges.
  const streakCount = reduced ? 14 : 22 + Math.floor(Math.random() * 12);
  for (let i = 0; i < streakCount; i += 1) {
    const useSecondary = Math.random() > 0.55;
    const base = useSecondary ? secondaryHeading : heading;
    // Wider fan at the fringe so the silhouette feathers out.
    const angle = base + (Math.random() * 2 - 1) * (fanHalf * 1.35);
    pushParticle(
      angle,
      (reduced ? 10 : 12) + Math.random() * (reduced ? 12 : 18),
      0.9 + Math.random() * 1.8,
      pick(MIST_STREAK),
      (reduced ? 50 : 70) + Math.random() * (reduced ? 30 : 50),
      0.28 + Math.random() * 0.35,
      14 + Math.random() * 28,
      reduced ? 22 : 36,
    );
  }

  return mist;
}

/** Rising occult smoke + pink embers (Envoy only — replaces blood mist). */
function buildMagicalSmoke(reduced: boolean, scale = 2): SmokeSpec[] {
  const s = Math.max(0.5, scale);
  const smoke: SmokeSpec[] = [];

  // Dense core ribbons + fringe wisps — all seeded from portrait center.
  const plumeCount = reduced ? 7 : 11 + Math.floor(Math.random() * 5);
  for (let i = 0; i < plumeCount; i += 1) {
    const core = i < (reduced ? 3 : 5);
    // Tight origin around silhouette center so the column stems from the body.
    const startX = (Math.random() * 2 - 1) * (core ? 4 : 9) * s;
    const drift = (Math.random() * 2 - 1) * (core ? 14 : 28) * s;
    const width = ((core ? 7 : 4) + Math.random() * (core ? 8 : 6)) * s;
    const height = width * ((core ? 2.8 : 3.4) + Math.random() * (core ? 1.6 : 2.2));
    smoke.push({
      id: `p-${i}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'plume',
      startX,
      endX: startX + drift,
      startY: (Math.random() * 2 - 1) * 3 * s,
      rise: -((reduced ? 40 : 56) + Math.random() * (reduced ? 32 : 52)) * s,
      width,
      height,
      tiltDeg: (Math.random() * 2 - 1) * (core ? 12 : 22),
      color: pick(SMOKE_DARK),
      delayMs: Math.floor(Math.random() * (reduced ? 18 : 34)),
      peakOpacity: core ? 0.38 + Math.random() * 0.22 : 0.22 + Math.random() * 0.2,
      endScaleX: 1.55 + Math.random() * 0.7,
      endScaleY: 1.7 + Math.random() * 0.85,
    });
  }

  const emberCount = reduced ? 8 : 14 + Math.floor(Math.random() * 8);
  for (let i = 0; i < emberCount; i += 1) {
    const startX = (Math.random() * 2 - 1) * 6 * s;
    const drift = (Math.random() * 2 - 1) * (reduced ? 10 : 18) * s;
    const width = (1.2 + Math.random() * 1.6) * s;
    const height = width * (2.2 + Math.random() * 2.4);
    smoke.push({
      id: `e-${i}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'ember',
      startX,
      endX: startX + drift,
      startY: (Math.random() * 2 - 1) * 4 * s,
      rise: -((reduced ? 44 : 62) + Math.random() * (reduced ? 30 : 48)) * s,
      width,
      height,
      tiltDeg: (Math.random() * 2 - 1) * 18,
      color: pick(EMBER_PINKS),
      delayMs: Math.floor(Math.random() * (reduced ? 24 : 40)),
      peakOpacity: 0.75 + Math.random() * 0.2,
      endScaleX: 0.45 + Math.random() * 0.35,
      endScaleY: 0.55 + Math.random() * 0.4,
    });
  }

  return smoke;
}

function BloodShard({
  shard,
  playToken,
}: {
  shard: ShardSpec;
  playToken: number;
}): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const points = useMemo(
    () => shardPolygonPoints(shard.length, shard.width, shard.jagged),
    [shard.jagged, shard.length, shard.width],
  );

  useEffect(() => {
    opacity.stopAnimation();
    travel.stopAnimation();
    opacity.setValue(0);
    travel.setValue(0);

    const fadeIn = 36 + Math.floor(Math.random() * 24);
    let hold = 50 + Math.floor(Math.random() * 36);
    let fadeOut = 80 + Math.floor(Math.random() * 45);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const abyssalMod = require('../../data/abyssalVerdictPresentation') as {
        isAbyssalVerdictPresentationActive: () => boolean;
      };
      if (abyssalMod.isAbyssalVerdictPresentationActive()) {
        hold += 70;
        fadeOut += 90;
      }
    } catch {
      // ignore
    }
    const moveMs = fadeIn + hold + fadeOut;

    Animated.parallel([
      Animated.sequence([
        Animated.delay(shard.delayMs),
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeIn,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: hold,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOut,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.sequence([
        Animated.delay(shard.delayMs),
        Animated.timing(travel, {
          toValue: 1,
          duration: moveMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [opacity, playToken, shard.delayMs, travel]);

  const rad = (shard.angleDeg * Math.PI) / 180;
  const startX = Math.cos(rad) * shard.startRadius;
  const startY = Math.sin(rad) * shard.startRadius;
  const endX = Math.cos(rad) * shard.endRadius;
  const endY = Math.sin(rad) * shard.endRadius;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shard,
        {
          width: shard.length,
          height: shard.width,
          marginLeft: -shard.length / 2,
          marginTop: -shard.width / 2,
          opacity,
          transform: [
            {
              translateX: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [startX, endX],
              }),
            },
            {
              translateY: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [startY, endY],
              }),
            },
            { rotate: `${shard.angleDeg}deg` },
            {
              scaleX: travel.interpolate({
                inputRange: [0, 0.25, 1],
                outputRange: [0.65, 1.05, 0.92],
              }),
            },
          ],
        },
      ]}
    >
      <Svg width={shard.length} height={shard.width}>
        <Polygon points={points} fill={shard.color} />
      </Svg>
    </Animated.View>
  );
}

function BloodMistStreak({
  mist,
  playToken,
}: {
  mist: MistSpec;
  playToken: number;
}): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    opacity.stopAnimation();
    travel.stopAnimation();
    opacity.setValue(0);
    travel.setValue(0);

    const fadeIn = 28 + Math.floor(Math.random() * 24);
    let hold = 40 + Math.floor(Math.random() * 50);
    let fadeOut = 140 + Math.floor(Math.random() * 100);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const abyssalMod = require('../../data/abyssalVerdictPresentation') as {
        isAbyssalVerdictPresentationActive: () => boolean;
      };
      if (abyssalMod.isAbyssalVerdictPresentationActive()) {
        hold += 60;
        fadeOut += 80;
      }
    } catch {
      // ignore
    }
    const moveMs = fadeIn + hold + fadeOut;

    Animated.parallel([
      Animated.sequence([
        Animated.delay(mist.delayMs),
        Animated.timing(opacity, {
          toValue: mist.peakOpacity,
          duration: fadeIn,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: mist.peakOpacity * 0.7,
          duration: hold,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOut,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.sequence([
        Animated.delay(mist.delayMs),
        Animated.timing(travel, {
          toValue: 1,
          duration: moveMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [mist.delayMs, mist.peakOpacity, opacity, playToken, travel]);

  const rad = (mist.angleDeg * Math.PI) / 180;
  const startX = Math.cos(rad) * mist.startRadius;
  const startY = Math.sin(rad) * mist.startRadius;
  const endX = Math.cos(rad) * mist.endRadius;
  const endY = Math.sin(rad) * mist.endRadius + mist.gravity;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.mist,
        {
          width: mist.length,
          height: mist.thickness,
          marginLeft: -mist.length / 2,
          marginTop: -mist.thickness / 2,
          borderRadius: mist.thickness / 2,
          backgroundColor: mist.color,
          opacity,
          transform: [
            {
              translateX: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [startX, endX],
              }),
            },
            {
              translateY: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [startY, endY],
              }),
            },
            { rotate: `${mist.angleDeg}deg` },
            {
              scaleX: travel.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0.55, 1.08, 1.2],
              }),
            },
            {
              scaleY: travel.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0.85, 1, 0.55],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function MagicalSmokeParticle({
  smoke,
  playToken,
}: {
  smoke: SmokeSpec;
  playToken: number;
}): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(0)).current;
  const isEmber = smoke.kind === 'ember';

  useEffect(() => {
    opacity.stopAnimation();
    travel.stopAnimation();
    opacity.setValue(0);
    travel.setValue(0);

    // Embers: bright flash then rapid die-off while still rising.
    const fadeIn = isEmber
      ? 16 + Math.floor(Math.random() * 14)
      : 48 + Math.floor(Math.random() * 36);
    const hold = isEmber
      ? 18 + Math.floor(Math.random() * 22)
      : 80 + Math.floor(Math.random() * 70);
    const fadeOut = isEmber
      ? 70 + Math.floor(Math.random() * 50)
      : 180 + Math.floor(Math.random() * 100);
    const moveMs = fadeIn + hold + fadeOut;

    Animated.parallel([
      Animated.sequence([
        Animated.delay(smoke.delayMs),
        Animated.timing(opacity, {
          toValue: smoke.peakOpacity,
          duration: fadeIn,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: isEmber ? smoke.peakOpacity * 0.55 : smoke.peakOpacity * 0.62,
          duration: hold,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOut,
          easing: isEmber ? Easing.in(Easing.quad) : Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.sequence([
        Animated.delay(smoke.delayMs),
        Animated.timing(travel, {
          toValue: 1,
          duration: moveMs,
          easing: isEmber ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();
  }, [isEmber, opacity, playToken, smoke.delayMs, smoke.peakOpacity, travel]);

  const endY = smoke.startY + smoke.rise;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.smoke,
        {
          width: smoke.width,
          height: smoke.height,
          marginLeft: -smoke.width / 2,
          marginTop: -smoke.height / 2,
          // Capsule / ribbon — soft ends, never a filled disc.
          borderRadius: Math.min(smoke.width, smoke.height) / 2,
          backgroundColor: smoke.color,
          opacity,
          transform: [
            {
              translateX: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [smoke.startX, smoke.endX],
              }),
            },
            {
              translateY: travel.interpolate({
                inputRange: [0, 1],
                outputRange: [smoke.startY, endY],
              }),
            },
            { rotate: `${smoke.tiltDeg}deg` },
            {
              scaleX: travel.interpolate({
                inputRange: [0, 0.3, 1],
                outputRange: isEmber
                  ? [0.75, 1, smoke.endScaleX]
                  : [0.45, 0.95, smoke.endScaleX],
              }),
            },
            {
              scaleY: travel.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: isEmber
                  ? [0.85, 1.1, smoke.endScaleY]
                  : [0.55, 1.15, smoke.endScaleY],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/** Gap between Cinder Sweep pellet bursts. */
const BURST_REPEAT_GAP_MS = 72;
/** Keep overlapping layers mounted until shards/mist finish fading. */
const BURST_LAYER_TTL_MS = 480;
/** Brief linger so shards remain as Abyssal Verdict HUD restores. */
const ABYSSAL_BURST_LAYER_TTL_MS = 720;
/** Envoy smoke rises a beat longer than blood mist. */
const ENVOY_BURST_LAYER_TTL_MS = 640;

type BurstLayer = {
  token: number;
  shards: ShardSpec[];
  mist: MistSpec[];
  smoke: SmokeSpec[];
};

interface CombatEnemyBloodBurstProps {
  hitFlashSeq?: number;
  /** Only class-specific damage should enable this layer. */
  enabled?: boolean;
  variant?: EnemyBloodBurstVariant;
  /** Pulses per hit flash — Cinder Sweep fires 3 in quick succession. */
  burstRepeats?: number;
  /** Blood mist size multiplier — Nullbreach / Unmaker use 1.5. */
  mistScale?: number;
}

export default function CombatEnemyBloodBurst({
  hitFlashSeq = 0,
  enabled = false,
  variant = 'aegis',
  burstRepeats = 1,
  mistScale = 1,
}: CombatEnemyBloodBurstProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const [bursts, setBursts] = useState<BurstLayer[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (hitFlashSeq <= 0 || hitFlashSeq === lastSeqRef.current) return;
    lastSeqRef.current = hitFlashSeq;

    const repeats = Math.max(1, Math.min(6, Math.floor(burstRepeats)));
    const reduced = getCombatPresentationSettings().reducedMotion;
    const gap = reduced ? Math.floor(BURST_REPEAT_GAP_MS * 0.75) : BURST_REPEAT_GAP_MS;
    // Geometry scale only — parent View transforms fight native-driver particle motion.
    const mistSize = mistScale > 0 ? mistScale : 1;
    const isEnvoy = variant === 'envoy';
    let abyssalActive = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const abyssalMod = require('../../data/abyssalVerdictPresentation') as {
        isAbyssalVerdictPresentationActive: () => boolean;
      };
      abyssalActive = abyssalMod.isAbyssalVerdictPresentationActive();
    } catch {
      abyssalActive = false;
    }
    const layerTtl = isEnvoy
      ? ENVOY_BURST_LAYER_TTL_MS
      : abyssalActive
        ? ABYSSAL_BURST_LAYER_TTL_MS
        : BURST_LAYER_TTL_MS;

    for (let i = 0; i < repeats; i += 1) {
      const fireTimer = setTimeout(() => {
        const token = Date.now() + i + Math.random();
        const layer: BurstLayer = {
          token,
          shards: buildShards(variant, reduced),
          mist: isEnvoy ? [] : buildMist(reduced, mistSize),
          smoke: isEnvoy ? buildMagicalSmoke(reduced) : [],
        };
        setBursts((prev) => [...prev, layer]);
        const clearTimer = setTimeout(() => {
          setBursts((prev) => prev.filter((b) => b.token !== token));
        }, layerTtl);
        timersRef.current.push(clearTimer);
      }, i * gap);
      timersRef.current.push(fireTimer);
    }
  }, [burstRepeats, enabled, hitFlashSeq, mistScale, variant]);

  if (!enabled || bursts.length === 0) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {bursts.map((burst) => (
        <React.Fragment key={burst.token}>
          {burst.mist.map((particle) => (
            <BloodMistStreak
              key={`${burst.token}-${particle.id}`}
              mist={particle}
              playToken={burst.token}
            />
          ))}
          {burst.smoke.map((particle) => (
            <MagicalSmokeParticle
              key={`${burst.token}-${particle.id}`}
              smoke={particle}
              playToken={burst.token}
            />
          ))}
          {burst.shards.map((shard) => (
            <BloodShard
              key={`${burst.token}-${shard.id}`}
              shard={shard}
              playToken={burst.token}
            />
          ))}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9,
    overflow: 'visible',
  },
  shard: {
    position: 'absolute',
    left: '50%',
    top: '50%',
  },
  mist: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    zIndex: 0,
  },
  smoke: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    zIndex: 0,
  },
});
