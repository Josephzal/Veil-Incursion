import React, {
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import {
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
  Image as RNImage,
  StyleSheet,
  View,
} from 'react-native';
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
const ERADICATION_MS = 800;
const SHAKE_AMPLITUDE = 12;
const SHAKE_CYCLES = 5;

/** Static crimson boost — applied on damage overlay pass only. */
const CRIMSON_BOOST_MATRIX = [
  1.85, 0, 0, 0, 0.12,
  0, 0.18, 0, 0, 0,
  0, 0, 0.18, 0, 0,
  0, 0, 0, 1, 0,
];

export interface ApparitionViewportRef {
  triggerDamageEffect: () => void;
  triggerEradication: () => void;
}

export interface ApparitionViewportProps {
  imageSource?: ImageSourcePropType | null;
  style?: StyleProp<ViewStyle>;
  onEradicationComplete?: () => void;
}

function toSkiaImageSource(source: ImageSourcePropType | null | undefined): DataSourceParam {
  if (source == null) return null;
  if (typeof source === 'number') {
    const resolved = RNImage.resolveAssetSource(source);
    return resolved?.uri ?? source;
  }
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
  function ApparitionViewport({ imageSource, style, onEradicationComplete }, ref) {
    const skiaImage = useImage(toSkiaImageSource(imageSource));
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

    useImperativeHandle(
      ref,
      () => ({
        triggerDamageEffect: () => {
          if (isEradicating.value > 0) return;
          shakeProgress.value = 1;
          shakePhase.value = 0;
          crimsonMix.value = 1;
          shakeProgress.value = withTiming(0, {
            duration: DAMAGE_MS,
            easing: Easing.out(Easing.cubic),
          });
          shakePhase.value = withTiming(SHAKE_CYCLES, {
            duration: DAMAGE_MS,
            easing: Easing.linear,
          });
          crimsonMix.value = withTiming(0, {
            duration: DAMAGE_MS,
            easing: Easing.out(Easing.cubic),
          });
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

    const hasLayout = layout.width > 0 && layout.height > 0;
    const showSprite = skiaImage != null && hasLayout;

    return (
      <View style={[styles.root, style]} onLayout={handleLayout}>
        {hasLayout ? (
          <Canvas style={{ width: layout.width, height: layout.height }}>
            <Rect x={0} y={0} width={layout.width} height={layout.height} color={CANVAS_BACKDROP} />

            {showSprite ? (
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
});
