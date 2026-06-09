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
  useImage,
} from '@shopify/react-native-skia';
import type { DataSourceParam } from '@shopify/react-native-skia';
import {
  Easing,
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
const WARD_PULSE_MS = 900;

const FLASH_COLORS: Record<EnemyDeckStrikeVariant, string> = {
  hp: '#FF453A',
  stamina: '#5C2D91',
  abyssal: '#00D2C4',
};

const WARD_BLEND = '#FBBF24';

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
}

const CombatPlayerViewport = forwardRef<CombatPlayerViewportRef, CombatPlayerViewportProps>(
  function CombatPlayerViewport({ imageSource, style, wardPrimed = false }, ref) {
    const skiaSource = useMemo(() => toSkiaImageSource(imageSource), [imageSource]);
    const skiaImage = useImage(skiaSource);
    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const shakeX = useSharedValue(0);
    const lungeX = useSharedValue(0);
    const flashOpacity = useSharedValue(0);
    const [flashColor, setFlashColor] = useState(FLASH_COLORS.hp);
    const flashColorRef = useRef(FLASH_COLORS.hp);
    const wardOpacity = useSharedValue(wardPrimed ? 0.7 : 0);

    const handleLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setLayout({ width, height });
    };

    useEffect(() => {
      if (wardPrimed) {
        wardOpacity.value = withRepeat(
          withSequence(
            withTiming(0.85, { duration: WARD_PULSE_MS * 0.5, easing: Easing.inOut(Easing.cubic) }),
            withTiming(0.35, { duration: WARD_PULSE_MS * 0.5, easing: Easing.inOut(Easing.cubic) }),
          ),
          -1,
          true,
        );
        return;
      }
      wardOpacity.value = withTiming(0, { duration: 280 });
    }, [wardPrimed, wardOpacity]);

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
        wardOpacity.value = withTiming(active ? 0.7 : 0, { duration: WARD_PULSE_MS });
      },
    }), [flashOpacity, lungeX, shakeX, wardOpacity]);

    const spriteTransform = useDerivedValue(() => [
      { translateX: shakeX.value + lungeX.value },
    ]);

    const damageBlendOpacity = useDerivedValue(() => flashOpacity.value);
    const wardBlendOpacity = useDerivedValue(() => wardOpacity.value);

    const hasLayout = layout.width > 0 && layout.height > 0;

    return (
      <View style={[styles.root, style]}>
        <View style={styles.spriteFrame} onLayout={handleLayout}>
          {hasLayout && skiaImage ? (
            <Canvas style={{ width: layout.width, height: layout.height }}>
              <Group transform={spriteTransform}>
                <Image
                  image={skiaImage}
                  x={0}
                  y={0}
                  width={layout.width}
                  height={layout.height}
                  fit="contain"
                />
                <Group opacity={wardBlendOpacity}>
                  <Image
                    image={skiaImage}
                    x={0}
                    y={0}
                    width={layout.width}
                    height={layout.height}
                    fit="contain"
                  >
                    <BlendColor color={WARD_BLEND} mode="srcATop" />
                  </Image>
                </Group>
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
              </Group>
            </Canvas>
          ) : null}
        </View>
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
    backgroundColor: '#000000',
    overflow: 'hidden',
    paddingBottom: 4,
  },
  spriteFrame: {
    width: '86%',
    height: '90%',
    position: 'relative',
    overflow: 'hidden',
  },
});
