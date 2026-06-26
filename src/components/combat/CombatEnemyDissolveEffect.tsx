import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import EnemyDisintegration from './EnemyDisintegration';

export const ASHEN_DISSOLVE_FLASH_MS = 80;
export const ASHEN_DISSOLVE_MS = 450;
export const ASHEN_DISSOLVE_RISE_Y = -20;
export const ASHEN_DISSOLVE_BLUR_MAX = 10;
export const ASHEN_DISSOLVE_TOTAL_MS = ASHEN_DISSOLVE_FLASH_MS + ASHEN_DISSOLVE_MS;

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
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const flashOpacity = useSharedValue(0);
  const spriteOpacity = useSharedValue(1);
  const riseY = useSharedValue(0);
  const blurRadius = useSharedValue(0);
  const [showBurst, setShowBurst] = useState(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  const finishDissolve = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.();
  };

  useEffect(() => {
    if (!active || dissolveSeq <= 0 || dissolveSeq === lastSeqRef.current) return;
    lastSeqRef.current = dissolveSeq;
    completedRef.current = false;
    setShowBurst(true);

    flashOpacity.value = 0;
    spriteOpacity.value = 1;
    riseY.value = 0;
    blurRadius.value = 0;

    flashOpacity.value = withSequence(
      withTiming(0.92, { duration: ASHEN_DISSOLVE_FLASH_MS * 0.45, easing: Easing.out(Easing.quad) }),
      withTiming(0.28, { duration: ASHEN_DISSOLVE_FLASH_MS * 0.55, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: ASHEN_DISSOLVE_MS * 0.35, easing: Easing.out(Easing.cubic) }),
    );

    const dissolveEasing = Easing.out(Easing.cubic);
    spriteOpacity.value = withDelay(
      ASHEN_DISSOLVE_FLASH_MS,
      withTiming(0, { duration: ASHEN_DISSOLVE_MS, easing: dissolveEasing }, (done) => {
        if (done) runOnJS(finishDissolve)();
      }),
    );
    riseY.value = withDelay(
      ASHEN_DISSOLVE_FLASH_MS,
      withTiming(ASHEN_DISSOLVE_RISE_Y, { duration: ASHEN_DISSOLVE_MS, easing: dissolveEasing }),
    );
    blurRadius.value = withDelay(
      ASHEN_DISSOLVE_FLASH_MS,
      withTiming(ASHEN_DISSOLVE_BLUR_MAX, { duration: ASHEN_DISSOLVE_MS, easing: dissolveEasing }),
    );

    const fallbackTimer = setTimeout(finishDissolve, ASHEN_DISSOLVE_TOTAL_MS + 48);
    return () => clearTimeout(fallbackTimer);
  }, [active, blurRadius, dissolveSeq, flashOpacity, riseY, spriteOpacity]);

  useEffect(() => {
    if (active) return;
    if (completedRef.current) return;
    setShowBurst(false);
    flashOpacity.value = 0;
    spriteOpacity.value = 1;
    riseY.value = 0;
    blurRadius.value = 0;
  }, [active, blurRadius, flashOpacity, riseY, spriteOpacity]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBounds((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  };

  const handleBurstComplete = () => {
    setShowBurst(false);
  };

  const burstReady = showBurst && bounds.width > 0 && bounds.height > 0;

  const dissolveStyle = useAnimatedStyle(() => {
    const blur = blurRadius.value;
    const webFilter = Platform.OS === 'web'
      ? `brightness(${1 + flashOpacity.value * 0.35}) blur(${blur}px)`
      : undefined;

    return {
      opacity: spriteOpacity.value,
      transform: [{ translateY: riseY.value }],
      ...(webFilter ? ({ filter: webFilter } as ViewStyle) : null),
    };
  });

  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value * spriteOpacity.value,
  }));

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

  return (
    <Animated.View
      style={styles.wrap}
      onLayout={handleLayout}
      pointerEvents="none"
      collapsable={false}
    >
      <Animated.View style={[styles.content, dissolveStyle]}>
        {children}
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
      {burstReady ? (
        <EnemyDisintegration
          x={bounds.width / 2}
          y={bounds.height / 2}
          width={bounds.width}
          height={bounds.height}
          onComplete={handleBurstComplete}
        />
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
