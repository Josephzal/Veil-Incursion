import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
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
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { EnemyDeckStrikeVariant } from '../../utils/combatTelemetryFormat';

const SHAKE_AMPLITUDE = 10;
const LUNGE_DISTANCE = 28;
const LUNGE_MS = 280;
const GLOW_PULSE_MS = 900;
const PRIMED_GLOW = '#ff00ff';

const FLASH_COLORS: Record<EnemyDeckStrikeVariant, string> = {
  hp: '#FF453A',
  stamina: '#5C2D91',
  abyssal: '#00D2C4',
};

function toSkiaImageSource(source: ImageSourcePropType): DataSourceParam {
  if (typeof source === 'number') return source;
  if (typeof source === 'object' && source != null && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return null;
}

export interface CombatPlayerViewportRef {
  triggerDamageEffect: (variant?: EnemyDeckStrikeVariant) => void;
  triggerAttackLunge: () => void;
  setWardPrimed: (active: boolean) => void;
}

interface CombatPlayerViewportProps {
  imageSource: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
}

const CombatPlayerViewport = forwardRef<CombatPlayerViewportRef, CombatPlayerViewportProps>(
  function CombatPlayerViewport({ imageSource, style, wardPrimed = false, abilityPrimed = false }, ref) {
    const skiaSource = useMemo(() => toSkiaImageSource(imageSource), [imageSource]);
    const skiaImage = useImage(skiaSource);
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const shakeX = useSharedValue(0);
    const lungeX = useSharedValue(0);
    const flashOpacity = useSharedValue(0);
    const [flashColor, setFlashColor] = useState(FLASH_COLORS.hp);
    const flashColorRef = useRef(FLASH_COLORS.hp);
    const glowOpacity = useSharedValue(0);

    const primed = wardPrimed || abilityPrimed;

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
    };

    useEffect(() => {
      if (primed) {
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.8, { duration: GLOW_PULSE_MS * 0.5, easing: Easing.inOut(Easing.cubic) }),
            withTiming(0.45, { duration: GLOW_PULSE_MS * 0.5, easing: Easing.inOut(Easing.cubic) }),
          ),
          -1,
          true,
        );
        return;
      }
      glowOpacity.value = withTiming(0, { duration: 280 });
    }, [primed, glowOpacity]);

    const runShake = () => {
      shakeX.value = withSequence(
        withTiming(SHAKE_AMPLITUDE, { duration: 40 }),
        withTiming(-SHAKE_AMPLITUDE, { duration: 40 }),
        withTiming(SHAKE_AMPLITUDE * 0.6, { duration: 40 }),
        withTiming(0, { duration: 60 }),
      );
    };

    const runFlash = (variant: EnemyDeckStrikeVariant) => {
      const nextColor = FLASH_COLORS[variant];
      flashColorRef.current = nextColor;
      setFlashColor(nextColor);
      flashOpacity.value = withSequence(
        withTiming(0.72, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withTiming(0.48, { duration: 180 }),
        withTiming(0, { duration: 320, easing: Easing.inOut(Easing.cubic) }),
      );
    };

    useImperativeHandle(ref, () => ({
      triggerDamageEffect: (variant = 'hp') => {
        runShake();
        runFlash(variant);
      },
      triggerAttackLunge: () => {
        lungeX.value = withSequence(
          withTiming(LUNGE_DISTANCE, { duration: LUNGE_MS * 0.45, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: LUNGE_MS * 0.55, easing: Easing.inOut(Easing.cubic) }),
        );
      },
      setWardPrimed: (active: boolean) => {
        if (active) {
          glowOpacity.value = 0.8;
          return;
        }
        glowOpacity.value = withTiming(0, { duration: GLOW_PULSE_MS });
      },
    }), [flashOpacity, lungeX, shakeX, glowOpacity]);

    const frameAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: shakeX.value + lungeX.value }],
    }));

    const imageGlowStyle = useAnimatedStyle(() => ({
      shadowColor: PRIMED_GLOW,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: glowOpacity.value,
      shadowRadius: 15,
    }));

    const damageBlendOpacity = useDerivedValue(() => flashOpacity.value);

    const hasLayout = layout.width > 0 && layout.height > 0;

    return (
      <View style={[styles.root, style]}>
        <Animated.View style={[styles.spriteFrame, frameAnimatedStyle]} onLayout={handleLayout}>
          {hasLayout ? (
            <>
              <Animated.Image
                source={imageSource}
                style={[styles.playerImage, imageGlowStyle]}
                resizeMode="contain"
              />
              <Canvas style={styles.effectCanvas} pointerEvents="none">
                <Rect x={0} y={0} width={layout.width} height={layout.height} color="transparent" />
                {!skiaImage ? (
                  <CombatSpritePlaceholder width={layout.width} height={layout.height} />
                ) : (
                  <Group opacity={damageBlendOpacity}>
                    <Image
                      image={skiaImage}
                      x={0}
                      y={0}
                      width={layout.width}
                      height={layout.height}
                      fit="contain"
                    >
                      <BlendColor color={flashColor} mode="srcATop" />
                    </Image>
                  </Group>
                )}
              </Canvas>
            </>
          ) : null}
        </Animated.View>
      </View>
    );
  },
);

export default CombatPlayerViewport;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'visible',
    paddingBottom: 0,
  },
  spriteFrame: {
    width: '92%',
    height: '100%',
    minHeight: 120,
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  playerImage: {
    width: '100%',
    height: '100%',
    minHeight: 120,
  },
  effectCanvas: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 2,
    pointerEvents: 'none',
  },
});
