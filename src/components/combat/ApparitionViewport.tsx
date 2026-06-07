import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
  Image as RNImage,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  Canvas,
  ColorMatrix,
  Group,
  Image,
  Line,
  Paint,
  Rect,
  rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import type { DataSourceParam } from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const CANVAS_BACKDROP = '#000000';
const GRID_LINE = 'rgba(139, 92, 246, 0.22)';
const GRID_SPACING = 24;

const DAMAGE_MS = 200;
const ATTACK_MS = 320;
const ERADICATION_MS = 800;
const SHAKE_AMPLITUDE = 12;
const ATTACK_SHAKE_AMPLITUDE = 7;
const SHAKE_CYCLES = 5;
const ATTACK_SHAKE_CYCLES = 4;

/** Static crimson boost — applied on damage overlay pass only. */
const CRIMSON_BOOST_MATRIX = [
  1.85, 0, 0, 0, 0.12,
  0, 0.18, 0, 0, 0,
  0, 0, 0.18, 0, 0,
  0, 0, 0, 1, 0,
];

export interface ApparitionViewportRef {
  triggerDamageEffect: () => void;
  /** Hostile attack windup — shake only, no crimson flash. */
  triggerAttackEffect: () => void;
  triggerEradication: () => void;
}

export interface ApparitionViewportProps {
  imageSource?: ImageSourcePropType | null;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  onEradicationComplete?: () => void;
}

/** Skia loads bundled assets reliably from `require()` module ids; URI resolution can fail intermittently. */
function toSkiaImageSource(source: ImageSourcePropType | null | undefined): DataSourceParam {
  if (source == null) return null;
  if (typeof source === 'number') {
    return source;
  }
  if (typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return null;
}

function resolveNativeImageSource(
  source: ImageSourcePropType | null | undefined,
): ImageSourcePropType | null {
  if (source == null) return null;
  if (typeof source === 'number') {
    return source;
  }
  if (typeof source === 'object' && 'uri' in source) {
    return source;
  }
  return null;
}

interface PlaceholderGridProps {
  width: number;
  height: number;
}

function PlaceholderGrid({ width, height }: PlaceholderGridProps): React.JSX.Element | null {
  if (width <= 0 || height <= 0) return null;

  const verticals: React.JSX.Element[] = [];
  const horizontals: React.JSX.Element[] = [];

  for (let x = 0; x <= width; x += GRID_SPACING) {
    verticals.push(
      <Line key={`v-${x}`} p1={vec(x, 0)} p2={vec(x, height)} color={GRID_LINE} strokeWidth={1} />,
    );
  }

  for (let y = 0; y <= height; y += GRID_SPACING) {
    horizontals.push(
      <Line key={`h-${y}`} p1={vec(0, y)} p2={vec(width, y)} color={GRID_LINE} strokeWidth={1} />,
    );
  }

  return (
    <Group>
      {verticals}
      {horizontals}
      <Rect
        x={width * 0.2}
        y={height * 0.12}
        width={width * 0.6}
        height={height * 0.76}
        color="rgba(92, 45, 145, 0.12)"
        style="stroke"
        strokeWidth={1}
      />
    </Group>
  );
}

export const ApparitionViewport = forwardRef<ApparitionViewportRef, ApparitionViewportProps>(
  function ApparitionViewport(
    { imageSource, style, pointerEvents = 'auto', onEradicationComplete },
    ref,
  ) {
    const skiaImageSource = useMemo(() => toSkiaImageSource(imageSource), [imageSource]);
    const nativeImageSource = useMemo(
      () => resolveNativeImageSource(imageSource),
      [imageSource],
    );
    const skiaImage = useImage(skiaImageSource);
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const canvasW = useSharedValue(0);
    const canvasH = useSharedValue(0);
    const shakeProgress = useSharedValue(0);
    const shakePhase = useSharedValue(0);
    const crimsonMix = useSharedValue(0);
    const dissolveSweep = useSharedValue(0);
    const isEradicating = useSharedValue(0);

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
      canvasW.value = width;
      canvasH.value = height;
    };

    const runShake = (duration: number, amplitude: number, cycles: number, withCrimson: boolean) => {
      if (isEradicating.value > 0) return;
      shakeProgress.value = 1;
      shakePhase.value = 0;
      if (withCrimson) crimsonMix.value = 1;
      shakeProgress.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      shakePhase.value = withTiming(cycles, {
        duration,
        easing: Easing.linear,
      });
      if (withCrimson) {
        crimsonMix.value = withTiming(0, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        triggerDamageEffect: () => {
          runShake(DAMAGE_MS, SHAKE_AMPLITUDE, SHAKE_CYCLES, true);
        },
        triggerAttackEffect: () => {
          runShake(ATTACK_MS, ATTACK_SHAKE_AMPLITUDE, ATTACK_SHAKE_CYCLES, false);
        },
        triggerEradication: () => {
          if (isEradicating.value > 0) return;
          isEradicating.value = 1;
          dissolveSweep.value = 0;
          dissolveSweep.value = withTiming(
            1,
            { duration: ERADICATION_MS, easing: Easing.inOut(Easing.cubic) },
            (finished) => {
              if (finished && onEradicationComplete) {
                runOnJS(onEradicationComplete)();
              }
            },
          );
        },
      }),
      [canvasH, canvasW, crimsonMix, dissolveSweep, isEradicating, onEradicationComplete, shakePhase, shakeProgress],
    );

    const shakeTranslateX = useDerivedValue(() => {
      'worklet';
      const decay = shakeProgress.value;
      return SHAKE_AMPLITUDE * decay * Math.sin(shakePhase.value * Math.PI * 2);
    });

    const groupTransform = useDerivedValue(() => [{ translateX: shakeTranslateX.value }]);

    const dissolveClip = useDerivedValue(() => {
      'worklet';
      const y = canvasH.value * dissolveSweep.value;
      const h = Math.max(0, canvasH.value * (1 - dissolveSweep.value));
      return rect(0, y, canvasW.value, h);
    });

    const nativeDissolveClipStyle = useAnimatedStyle(() => {
      const h = Math.max(0, canvasH.value * (1 - dissolveSweep.value));
      return {
        height: h,
        overflow: 'hidden' as const,
      };
    });

    const nativeShakeStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: SHAKE_AMPLITUDE * shakeProgress.value * Math.sin(shakePhase.value * Math.PI * 2) }],
    }));

    const crimsonOverlayStyle = useAnimatedStyle(() => ({
      opacity: crimsonMix.value * 0.52,
    }));

    const hasLayout = layout.width > 0 && layout.height > 0;
    const hasPortraitSource = nativeImageSource != null;
    const showSkiaSprite = skiaImage != null && hasLayout;
    const showNativeFallback = hasLayout && hasPortraitSource && !showSkiaSprite;
    const showWireframeGrid = hasLayout && !hasPortraitSource;

    return (
      <View style={[styles.root, style]} onLayout={handleLayout} pointerEvents={pointerEvents}>
        {showNativeFallback ? (
          <Animated.View
            style={[
              styles.portraitFallback,
              { width: layout.width },
              nativeDissolveClipStyle,
            ]}
          >
            <Animated.View style={nativeShakeStyle}>
              <RNImage
                source={nativeImageSource}
                style={{ width: layout.width, height: layout.height }}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>
        ) : null}
        {hasLayout && (showSkiaSprite || showWireframeGrid) ? (
          <Canvas style={{ width: layout.width, height: layout.height }}>
            <Rect x={0} y={0} width={layout.width} height={layout.height} color={CANVAS_BACKDROP} />

            {showSkiaSprite ? (
              <>
                <Group clip={dissolveClip} transform={groupTransform}>
                  <Image
                    image={skiaImage}
                    x={0}
                    y={0}
                    width={layout.width}
                    height={layout.height}
                    fit="contain"
                  />
                </Group>
                <Group clip={dissolveClip} transform={groupTransform} opacity={crimsonMix}>
                  <Group
                    layer={
                      <Paint>
                        <ColorMatrix matrix={CRIMSON_BOOST_MATRIX} />
                      </Paint>
                    }
                  >
                    <Image
                      image={skiaImage}
                      x={0}
                      y={0}
                      width={layout.width}
                      height={layout.height}
                      fit="contain"
                    />
                  </Group>
                </Group>
              </>
            ) : (
              <PlaceholderGrid width={layout.width} height={layout.height} />
            )}
          </Canvas>
        ) : null}
        {hasLayout ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.crimsonFlash, crimsonOverlayStyle]}
          />
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: CANVAS_BACKDROP,
    overflow: 'hidden',
  },
  portraitFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CANVAS_BACKDROP,
  },
  crimsonFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#dc2626',
  },
});
