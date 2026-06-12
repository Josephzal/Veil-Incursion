import React, { useEffect, useRef } from 'react';
import { Image, type ImageSourcePropType, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const DAMAGE_TINT = '#dc2626';

interface CombatEnemyHitEffectProps {
  hitFlashSeq?: number;
  portraitSource: ImageSourcePropType;
  children: React.ReactNode;
}

/** Red image tint flash when the operative deals damage — motion handled by anchor layer. */
export default function CombatEnemyHitEffect({
  hitFlashSeq = 0,
  portraitSource,
  children,
}: CombatEnemyHitEffectProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    if (hitFlashSeq <= 0 || hitFlashSeq === lastSeqRef.current) return;
    lastSeqRef.current = hitFlashSeq;

    flashOpacity.value = withSequence(
      withTiming(0.65, { duration: 60, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
    );
  }, [flashOpacity, hitFlashSeq]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <Animated.View style={styles.root}>
      {children}
      <Animated.View style={[styles.imageFlashWrap, flashStyle]} pointerEvents="none">
        <Image
          source={portraitSource}
          resizeMode="contain"
          style={[styles.portraitTint, { tintColor: DAMAGE_TINT }]}
        />
      </Animated.View>
    </Animated.View>
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
  imageFlashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 5,
  },
  portraitTint: {
    width: '100%',
    height: '100%',
  },
});
