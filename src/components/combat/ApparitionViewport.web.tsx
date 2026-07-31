import React, { forwardRef, useImperativeHandle, useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const CANVAS_BACKDROP = '#000000';
const DAMAGE_FLASH_PEAK = 0.28;
const DAMAGE_MS = 176;

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

function SpritePlaceholder({
  width,
  height,
}: {
  width: number;
  height: number;
}): React.JSX.Element {
  return (
    <View style={[styles.placeholder, { width, height }]}>
      <View style={styles.placeholderFrame} />
    </View>
  );
}

export const ApparitionViewport = forwardRef<ApparitionViewportRef, ApparitionViewportProps>(
  function ApparitionViewport(
    { imageSource, style, pointerEvents = 'auto', onEradicationComplete },
    ref,
  ) {
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const shakeProgress = useSharedValue(0);
    const shakePhase = useSharedValue(0);
    const damageFlash = useSharedValue(0);
    const eradicateOpacity = useSharedValue(1);
    const isEradicating = useSharedValue(0);

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
    };

    const runShake = (duration: number, amplitude: number, cycles: number, withDamageFlash: boolean) => {
      if (isEradicating.value > 0) return;
      shakeProgress.value = 1;
      shakePhase.value = 0;
      if (withDamageFlash) {
        damageFlash.value = 0;
        damageFlash.value = withSequence(
          withTiming(DAMAGE_FLASH_PEAK, { duration: 36, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: Math.max(80, duration - 36), easing: Easing.in(Easing.quad) }),
        );
      }
      shakeProgress.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      shakePhase.value = withTiming(cycles, {
        duration,
        easing: Easing.linear,
      });
      void amplitude;
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
      [damageFlash, eradicateOpacity, isEradicating, onEradicationComplete, shakePhase, shakeProgress],
    );

    const spriteAnimatedStyle = useAnimatedStyle(() => {
      const decay = shakeProgress.value;
      const translateX = SHAKE_AMPLITUDE * decay * Math.sin(shakePhase.value * Math.PI * 2);
      return {
        opacity: eradicateOpacity.value,
        transform: [{ translateX }],
      };
    });

    const damageFlashStyle = useAnimatedStyle(() => ({
      opacity: damageFlash.value,
    }));

    const hasLayout = layout.width > 0 && layout.height > 0;
    const hasRasterSource = imageSource != null;

    return (
      <View style={[styles.root, style]} pointerEvents={pointerEvents}>
        <View style={styles.spriteFrame} onLayout={handleLayout}>
          {hasLayout ? (
            hasRasterSource ? (
              <Animated.View style={[styles.imageWrap, spriteAnimatedStyle]}>
                <Image
                  source={imageSource}
                  style={styles.spriteImage}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={imageSource}
                  resizeMode="contain"
                  tintColor="#b91c1c"
                  style={[styles.spriteImage, styles.damageFlashSilhouette, damageFlashStyle]}
                />
              </Animated.View>
            ) : (
              <SpritePlaceholder width={layout.width} height={layout.height} />
            )
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
  imageWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  spriteImage: {
    width: '100%',
    height: '100%',
  },
  damageFlashSilhouette: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CANVAS_BACKDROP,
  },
  placeholderFrame: {
    width: '60%',
    height: '76%',
    borderWidth: 1,
    borderColor: 'rgba(92, 45, 145, 0.35)',
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
  },
});
