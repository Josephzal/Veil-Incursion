/**
 * Class damage feedback — blood shards that spawn off-center on the body,
 * spray past the enemy bounds, and fade out just outside.
 * Aegis: red / blackish shards + deep red blood mist.
 * Hex Shot: shorter yellowish / burnt-orange shards + deep red blood mist.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';

export type EnemyBloodBurstVariant = 'aegis' | 'hex';

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

/** Pointy tip + broader broken base — reads as a glass/bone shard, not a line. */
function shardPolygonPoints(length: number, width: number, jagged: number): string {
  const mid = width / 2;
  const tipX = length;
  const tipY = mid + (jagged - 0.5) * width * 0.18;
  const baseTop = Math.max(0.4, mid * (0.15 + jagged * 0.2));
  const baseBot = Math.min(width - 0.4, mid + mid * (0.55 + jagged * 0.35));
  const shoulderX = length * (0.42 + jagged * 0.12);
  const notchX = length * (0.18 + jagged * 0.08);
  const notchY = mid + (0.5 - jagged) * width * 0.22;
  return [
    `0,${baseTop}`,
    `${notchX},${Math.max(0.3, notchY - width * 0.12)}`,
    `${shoulderX},0`,
    `${tipX},${tipY}`,
    `${shoulderX},${width}`,
    `${notchX},${Math.min(width - 0.3, notchY + width * 0.12)}`,
    `0,${baseBot}`,
  ].join(' ');
}

function buildShards(variant: EnemyBloodBurstVariant, reduced: boolean): ShardSpec[] {
  const tiers = variant === 'hex' ? HEX_WIDTH_TIERS : AEGIS_WIDTH_TIERS;
  const primary = variant === 'hex' ? HEX_SHARD_YELLOWS : BLOOD_REDS;
  const accent = variant === 'hex' ? BURNT_ORANGE : BLACKISH;
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
    shards.push({
      id: `s-${i}-${Math.random().toString(36).slice(2, 7)}`,
      angleDeg: Math.random() * 360,
      length,
      width: tier.width,
      color: Math.random() > 0.38 ? pick(primary) : pick(accent),
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
    const hold = 50 + Math.floor(Math.random() * 36);
    const fadeOut = 80 + Math.floor(Math.random() * 45);
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
    const hold = 40 + Math.floor(Math.random() * 50);
    const fadeOut = 140 + Math.floor(Math.random() * 100);
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

/** Gap between Cinder Sweep pellet bursts. */
const BURST_REPEAT_GAP_MS = 72;
/** Keep overlapping layers mounted until shards/mist finish fading. */
const BURST_LAYER_TTL_MS = 480;

type BurstLayer = {
  token: number;
  shards: ShardSpec[];
  mist: MistSpec[];
};

interface CombatEnemyBloodBurstProps {
  hitFlashSeq?: number;
  /** Only class-specific damage should enable this layer. */
  enabled?: boolean;
  variant?: EnemyBloodBurstVariant;
  /** Pulses per hit flash — Cinder Sweep fires 3 in quick succession. */
  burstRepeats?: number;
  /** Blood mist size multiplier — Black Door / Unmaker use 1.5. */
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

    for (let i = 0; i < repeats; i += 1) {
      const fireTimer = setTimeout(() => {
        const token = Date.now() + i + Math.random();
        const layer: BurstLayer = {
          token,
          shards: buildShards(variant, reduced),
          mist: buildMist(reduced, mistSize),
        };
        setBursts((prev) => [...prev, layer]);
        const clearTimer = setTimeout(() => {
          setBursts((prev) => prev.filter((b) => b.token !== token));
        }, BURST_LAYER_TTL_MS);
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
});
