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
  StyleSheet,
  View,
} from 'react-native';
import {
  BlendColor,
  Canvas,
  Group,
  Image,
  Line,
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
const DAMAGE_BLEND = '#dc2626';

const DAMAGE_MS = 200;
const ATTACK_MS = 320;
const ERADICATION_MS = 800;
const SHAKE_AMPLITUDE = 12;
const ATTACK_SHAKE_AMPLITUDE = 7;
const SHAKE_CYCLES = 5;
const ATTACK_SHAKE_CYCLES = 4;

export interface ApparitionViewportRef {
  triggerDamageEffect: () => void;
  triggerAttackEffect: () => void;
  triggerEradication: () => void;
}

export interface ApparitionViewportProps {
  imageSource?: ImageSourcePropType | null;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewProps['pointerEvents'];
  onEradicationComplete?: () => void;
}

function toSkiaImageSource(source: ImageSourcePropType | null | undefined): DataSourceParam {
  if (source == null) return null;
  if (typeof source === 'number') return source;
  if (typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
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
    const skiaImage = useImage(skiaImageSource);
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const canvasW = useSharedValue(0);
    const canvasH = useSharedValue(0);
    const shakeProgress = useSharedValue(0);
    const shakePhase = useSharedValue(0);
    const damageFlash = useSharedValue(0);
    const dissolveSweep = useSharedValue(0);
    const isEradicating = useSharedValue(0);

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
      canvasW.value = width;
      canvasH.value = height;
    };

    const runShake = (duration: number, amplitude: number, cycles: number, withDamageFlash: boolean) => {
      if (isEradicating.value > 0) return;
      shakeProgress.value = 1;
      shakePhase.value = 0;
      if (withDamageFlash) damageFlash.value = 1;
      shakeProgress.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      shakePhase.value = withTiming(cycles, {
        duration,
        easing: Easing.linear,
      });
      if (withDamageFlash) {
        damageFlash.value = withTiming(0, {
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
      [canvasH, canvasW, damageFlash, dissolveSweep, isEradicating, onEradicationComplete, shakePhase, shakeProgress],
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

    const damageBlendOpacity = useDerivedValue(() => damageFlash.value * 0.65);

    const hasLayout = layout.width > 0 && layout.height > 0;
    const showSkiaSprite = skiaImage != null && hasLayout;
    const showWireframeGrid = hasLayout && !showSkiaSprite;

    return (
      <View style={[styles.root, style]} pointerEvents={pointerEvents}>
        <View style={styles.spriteFrame} onLayout={handleLayout}>
          {hasLayout && (showSkiaSprite || showWireframeGrid) ? (
            <Canvas style={{ width: layout.width, height: layout.height }}>
              <Rect x={0} y={0} width={layout.width} height={layout.height} color={CANVAS_BACKDROP} />

              {showSkiaSprite ? (
                <Group clip={dissolveClip} transform={groupTransform}>
                  <Image
                    image={skiaImage}
                    x={0}
                    y={0}
                    width={layout.width}
                    height={layout.height}
                    fit="contain"
                  />
                  <Group opacity={damageBlendOpacity}>
                    <Image
                      image={skiaImage}
                      x={0}
                      y={0}
                      width={layout.width}
                      height={layout.height}
                      fit="contain"
                    >
                      <BlendColor color={DAMAGE_BLEND} mode="srcATop" />
                    </Image>
                  </Group>
                </Group>
              ) : (
                <PlaceholderGrid width={layout.width} height={layout.height} />
              )}
            </Canvas>
          ) : null}
        </View>
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  spriteFrame: {
    width: '86%',
    height: '90%',
    position: 'relative',
    overflow: 'hidden',
  },
});
