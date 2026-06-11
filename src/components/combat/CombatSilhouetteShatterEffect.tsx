import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ImageSourcePropType,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, Image as SvgImage, Polygon } from 'react-native-svg';

const GOLD = '#FFD700';
const SHARD_PHANTOM_OPACITY = 0.6;
const FADE_HOLD_MS = 100;
const FADE_OUT_MS = 400;
const BURST_MS = 420;


interface ShardDef {
  id: number;
  /** Normalized polygon vertices in 0–1 sprite space — together they tile the silhouette. */
  normPoints: [number, number][];
  dx: number;
  dy: number;
}

const SHARD_DEFS: ShardDef[] = [
  { id: 0, normPoints: [[0, 0], [0.52, 0.06], [0.38, 0.5], [0.04, 0.36]], dx: -40, dy: -40 },
  { id: 1, normPoints: [[0.52, 0], [1, 0], [0.92, 0.38], [0.58, 0.22]], dx: 42, dy: -38 },
  { id: 2, normPoints: [[0, 0.36], [0.38, 0.5], [0.28, 1], [0, 0.88]], dx: -36, dy: 42 },
  { id: 3, normPoints: [[0.58, 0.22], [0.92, 0.38], [1, 0.82], [0.48, 0.72]], dx: 44, dy: 28 },
  { id: 4, normPoints: [[0.28, 1], [0.48, 0.72], [0.72, 1]], dx: 8, dy: 46 },
  { id: 5, normPoints: [[0.04, 0.36], [0.38, 0.5], [0.48, 0.72], [0.28, 1], [0, 0.88]], dx: -28, dy: 18 },
  { id: 6, normPoints: [[0.38, 0.5], [0.58, 0.22], [0.48, 0.72]], dx: 12, dy: -8 },
  { id: 7, normPoints: [[0.72, 1], [1, 0.82], [1, 0.55], [0.92, 0.38]], dx: 38, dy: 40 },
];

function resolveSvgHref(source: ImageSourcePropType): number | string | undefined {
  if (typeof source === 'number') return source;
  if (typeof source === 'object' && source != null && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return undefined;
}

function pointsForShard(normPoints: [number, number][], width: number, height: number): string {
  return normPoints.map(([nx, ny]) => `${nx * width},${ny * height}`).join(' ');
}

interface GoldenShardProps {
  shard: ShardDef;
  width: number;
  height: number;
  imageHref: number | string | undefined;
  rotateDeg: number;
  burst: SharedValue<number>;
  fade: SharedValue<number>;
}

function GoldenShard({
  shard,
  width,
  height,
  imageHref,
  rotateDeg,
  burst,
  fade,
}: GoldenShardProps): React.JSX.Element | null {
  const clipId = `shard-clip-${shard.id}`;
  const points = useMemo(
    () => pointsForShard(shard.normPoints, width, height),
    [height, shard.normPoints, width],
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { scale: 0.65 },
      { translateX: shard.dx * burst.value },
      { translateY: shard.dy * burst.value },
      { rotate: `${rotateDeg * burst.value}deg` },
    ],
  }));

  if (!imageHref || width <= 0 || height <= 0) return null;

  return (
    <Animated.View
      style={[styles.shardWrap, { width, height }, styles.shardGlow, animStyle]}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <Defs>
          <ClipPath id={clipId}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <SvgImage
            href={imageHref}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid meet"
            opacity={SHARD_PHANTOM_OPACITY}
          />
          <Polygon points={points} fill={GOLD} opacity={SHARD_PHANTOM_OPACITY} />
        </G>
      </Svg>
    </Animated.View>
  );
}

interface CombatSilhouetteShatterEffectProps {
  trigger: boolean;
  portraitSource: ImageSourcePropType;
  onTrigger?: () => void;
  children: React.ReactNode;
}

/**
 * Silhouette glass shatter — golden clipped shards burst outward over the enemy sprite.
 */
export default function CombatSilhouetteShatterEffect({
  trigger,
  portraitSource,
  onTrigger,
  children,
}: CombatSilhouetteShatterEffectProps): React.JSX.Element {
  const wasTriggeredRef = useRef(false);
  const [shardsActive, setShardsActive] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [shardRotations, setShardRotations] = useState<number[]>(
    () => SHARD_DEFS.map(() => Math.random() * 90),
  );

  const burst = useSharedValue(0);
  const fade = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  const imageHref = useMemo(() => resolveSvgHref(portraitSource), [portraitSource]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  useEffect(() => {
    if (!trigger || wasTriggeredRef.current) return;
    wasTriggeredRef.current = true;
    onTrigger?.();
    setShardRotations(SHARD_DEFS.map(() => Math.random() * 90));
    setShardsActive(true);

    flashOpacity.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
    );

    shakeX.value = withSequence(
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 40 }),
      withTiming(-6, { duration: 35 }),
      withTiming(0, { duration: 50 }),
    );
    shakeY.value = withSequence(
      withTiming(-5, { duration: 40 }),
      withTiming(5, { duration: 40 }),
      withTiming(0, { duration: 50 }),
    );

    burst.value = 0;
    burst.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) });

    fade.value = 1;
    fade.value = withDelay(
      FADE_HOLD_MS,
      withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) }),
    );

    const hideTimer = setTimeout(() => setShardsActive(false), FADE_HOLD_MS + FADE_OUT_MS + 60);
    return () => clearTimeout(hideTimer);
  }, [burst, fade, flashOpacity, onTrigger, shakeX, shakeY, trigger]);

  useEffect(() => {
    if (!trigger) {
      wasTriggeredRef.current = false;
      setShardsActive(false);
      burst.value = 0;
      fade.value = 1;
    }
  }, [burst, fade, trigger]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: shakeY.value },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const hasLayout = layout.width > 0 && layout.height > 0;

  return (
    <View style={styles.root} onLayout={handleLayout}>
      <Animated.View style={[styles.content, shakeStyle]}>
        {children}
        
      </Animated.View>

      {shardsActive && hasLayout ? (
        <View style={styles.shardLayer} pointerEvents="none">
          {SHARD_DEFS.map((shard, index) => (
            <GoldenShard
              key={shard.id}
              shard={shard}
              width={layout.width}
              height={layout.height}
              imageHref={imageHref}
              rotateDeg={shardRotations[index] ?? 0}
              burst={burst}
              fade={fade}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  content: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 215, 0, 0.45)',
    zIndex: 4,
  },
  shardLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 8,
    overflow: 'visible',
  },
  shardWrap: {
    position: 'absolute',
    bottom: 0,
    overflow: 'visible',
  },
  shardGlow: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 20,
  },
});
