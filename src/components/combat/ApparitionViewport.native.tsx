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
import {
  BlendColor,
  Canvas,
  Group,
  Image,
  Rect,
  useImage,
} from '@shopify/react-native-skia';
import CombatSpritePlaceholder from './CombatSpritePlaceholder';
import type { DataSourceParam } from '@shopify/react-native-skia';
import {
  Easing,
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const CANVAS_BACKDROP = '#000000';
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
  triggerStatEvade: () => void;
  triggerPlayerCritSunder: (channel?: 'KINETIC' | 'OCCULT') => void;
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
    const eradicateOpacity = useSharedValue(1);
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
          eradicateOpacity.value = withTiming(
            0,
            { duration: ERADICATION_MS, easing: Easing.out(Easing.cubic) },
            (finished) => {
              if (finished && onEradicationComplete) {
                runOnJS(onEradicationComplete)();
              }
            },
          );
        },
        triggerStatEvade: () => {
          runShake(180, 4, 2, false);
        },
        triggerPlayerCritSunder: (channel = 'KINETIC') => {
          runShake(DAMAGE_MS + 80, SHAKE_AMPLITUDE + 10, SHAKE_CYCLES + 2, true);
          void channel;
        },
      }),
      [canvasH, canvasW, damageFlash, eradicateOpacity, isEradicating, onEradicationComplete, shakePhase, shakeProgress],
    );

    const shakeTranslateX = useDerivedValue(() => {
      'worklet';
      const decay = shakeProgress.value;
      return SHAKE_AMPLITUDE * decay * Math.sin(shakePhase.value * Math.PI * 2);
    });

    const groupTransform = useDerivedValue(() => [{ translateX: shakeTranslateX.value }]);

    const spriteOpacity = useDerivedValue(() => eradicateOpacity.value);

    const damageBlendOpacity = useDerivedValue(() => damageFlash.value * 0.65);

    const hasLayout = layout.width > 0 && layout.height > 0;
    const hasRasterSource = imageSource != null;

    return (
      <View style={[styles.root, style]} pointerEvents={pointerEvents}>
        <View style={styles.spriteFrame} onLayout={handleLayout}>
          {hasLayout ? (
            <>
              {hasRasterSource && !skiaImage ? (
                <RNImage
                  source={imageSource}
                  style={styles.fallbackImage}
                  resizeMode="contain"
                />
              ) : null}
              <Canvas style={styles.effectCanvas} pointerEvents="none">
                <Rect x={0} y={0} width={layout.width} height={layout.height} color={CANVAS_BACKDROP} opacity={0} />
                {!hasRasterSource && !skiaImage ? (
                  <CombatSpritePlaceholder
                    width={layout.width}
                    height={layout.height}
                    lineColor="rgba(139, 92, 246, 0.22)"
                    frameColor="rgba(92, 45, 145, 0.12)"
                  />
                ) : null}
                {skiaImage ? (
                  <Group transform={groupTransform} opacity={spriteOpacity}>
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
                ) : null}
              </Canvas>
            </>
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
    minHeight: 120,
    position: 'relative',
    overflow: 'hidden',
  },
  fallbackImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  effectCanvas: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
