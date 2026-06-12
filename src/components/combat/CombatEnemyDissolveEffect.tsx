import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  Blur,
  Canvas,
  Group,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import type { DataSourceParam } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export const ASHEN_DISSOLVE_FLASH_MS = 100;
export const ASHEN_DISSOLVE_MS = 600;
export const ASHEN_DISSOLVE_RISE_Y = -20;
export const ASHEN_DISSOLVE_BLUR_MAX = 10;
export const ASHEN_DISSOLVE_TOTAL_MS = ASHEN_DISSOLVE_FLASH_MS + ASHEN_DISSOLVE_MS;

function toSkiaSource(source: ImageSourcePropType): DataSourceParam {
  if (typeof source === 'number') return source;
  if (typeof source === 'object' && source != null && 'uri' in source && typeof source.uri === 'string') {
    return source.uri;
  }
  return null;
}

interface CombatEnemyDissolveEffectProps {
  dissolveSeq?: number;
  active?: boolean;
  portraitSource?: ImageSourcePropType;
  onComplete?: () => void;
  children: React.ReactNode;
}

/** Ashen Dissolve — lethal flash, then fade/blur/rise before slot unmount. */
export default function CombatEnemyDissolveEffect({
  dissolveSeq = 0,
  active = false,
  portraitSource,
  onComplete,
  children,
}: CombatEnemyDissolveEffectProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const finishedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [finished, setFinished] = useState(false);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const flashOpacity = useSharedValue(0);
  const spriteOpacity = useSharedValue(1);
  const riseY = useSharedValue(0);
  const blurRadius = useSharedValue(0);

  const skiaSource = portraitSource ? toSkiaSource(portraitSource) : null;
  const skiaImage = useImage(skiaSource);
  const skiaDissolveActive = active && Platform.OS !== 'web' && skiaImage != null;

  const finishDissolve = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    onCompleteRef.current?.();
  };

  useEffect(() => {
    if (!active || dissolveSeq <= 0 || dissolveSeq === lastSeqRef.current) return;
    lastSeqRef.current = dissolveSeq;
    finishedRef.current = false;
    setFinished(false);

    flashOpacity.value = 0;
    spriteOpacity.value = 1;
    riseY.value = 0;
    blurRadius.value = 0;

    flashOpacity.value = withSequence(
      withTiming(0.92, { duration: ASHEN_DISSOLVE_FLASH_MS * 0.45, easing: Easing.out(Easing.quad) }),
      withTiming(0.28, { duration: ASHEN_DISSOLVE_FLASH_MS * 0.55, easing: Easing.inOut(Easing.sin) }),
    );

    const dissolveEasing = Easing.out(Easing.cubic);
    spriteOpacity.value = withDelay(
      ASHEN_DISSOLVE_FLASH_MS,
      withTiming(0, { duration: ASHEN_DISSOLVE_MS, easing: dissolveEasing }),
    );
    riseY.value = withDelay(
      ASHEN_DISSOLVE_FLASH_MS,
      withTiming(ASHEN_DISSOLVE_RISE_Y, { duration: ASHEN_DISSOLVE_MS, easing: dissolveEasing }),
    );
    blurRadius.value = withDelay(
      ASHEN_DISSOLVE_FLASH_MS,
      withTiming(ASHEN_DISSOLVE_BLUR_MAX, { duration: ASHEN_DISSOLVE_MS, easing: dissolveEasing }, (done) => {
        if (done) runOnJS(finishDissolve)();
      }),
    );

    const fallbackTimer = setTimeout(finishDissolve, ASHEN_DISSOLVE_TOTAL_MS);
    return () => clearTimeout(fallbackTimer);
  }, [active, blurRadius, dissolveSeq, flashOpacity, riseY, spriteOpacity]);

  useEffect(() => {
    if (active) return;
    finishedRef.current = false;
    setFinished(false);
    flashOpacity.value = 0;
    spriteOpacity.value = 1;
    riseY.value = 0;
    blurRadius.value = 0;
  }, [active, blurRadius, flashOpacity, riseY, spriteOpacity]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  const dissolveStyle = useAnimatedStyle(() => {
    const blur = blurRadius.value;
    const webFilter = Platform.OS === 'web'
      ? `brightness(${1 + flashOpacity.value}) blur(${blur}px)`
      : undefined;

    return {
      opacity: spriteOpacity.value,
      transform: [{ translateY: riseY.value }],
      ...(webFilter ? ({ filter: webFilter } as ViewStyle) : null),
    };
  });

  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const skiaGroupOpacity = useDerivedValue(() => spriteOpacity.value);
  const skiaTranslateY = useDerivedValue(() => [{ translateY: riseY.value }]);
  const skiaBlur = useDerivedValue(() => blurRadius.value);

  if (finished) return null;

  if (!active) {
    return (
      <View
        style={styles.wrap}
        onLayout={handleLayout}
        pointerEvents="box-none"
        collapsable={false}
      >
        {children}
      </View>
    );
  }

  const hasLayout = layout.width > 0 && layout.height > 0;

  return (
    <Animated.View
      style={styles.wrap}
      onLayout={handleLayout}
      pointerEvents="none"
      collapsable={false}
    >
      <Animated.View style={[styles.content, dissolveStyle]}>
        {!skiaDissolveActive ? children : null}
        {skiaDissolveActive && hasLayout ? (
          <Canvas style={styles.skiaCanvas} pointerEvents="none">
            <Group opacity={skiaGroupOpacity} transform={skiaTranslateY}>
              <SkiaImage
                image={skiaImage}
                x={0}
                y={0}
                width={layout.width}
                height={layout.height}
                fit="contain"
              >
                <Blur blur={skiaBlur} />
              </SkiaImage>
            </Group>
          </Canvas>
        ) : null}
      </Animated.View>
      {portraitSource ? (
        <Animated.View style={[styles.flashOverlay, flashOverlayStyle]} pointerEvents="none">
          <Image
            source={portraitSource}
            resizeMode="contain"
            style={styles.flashImage}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  content: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  skiaCanvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  flashImage: {
    width: '100%',
    height: '100%',
    tintColor: '#f8fafc',
    opacity: 0.95,
    backgroundColor: 'transparent',
  },
});
