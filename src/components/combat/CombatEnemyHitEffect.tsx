import React, { useEffect, useRef } from 'react';
import { Image, type ImageSourcePropType, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const DAMAGE_TINT = '#dc2626';
const ENRAGE_TINT = '#8B0000';
const ENRAGE_PULSE_MS = 2000;

interface CombatEnemyHitEffectProps {
  hitFlashSeq?: number;
  isEnraged?: boolean;
  portraitSource: ImageSourcePropType;
  children: React.ReactNode;
}

/** Red image tint flash when damaged; persistent crimson pulse while enraged. */
export default function CombatEnemyHitEffect({
  hitFlashSeq = 0,
  isEnraged = false,
  portraitSource,
  children,
}: CombatEnemyHitEffectProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const flashOpacity = useSharedValue(0);
  const enrageOpacity = useSharedValue(0);

  useEffect(() => {
    if (hitFlashSeq <= 0 || hitFlashSeq === lastSeqRef.current) return;
    lastSeqRef.current = hitFlashSeq;

    flashOpacity.value = withSequence(
      withTiming(0.65, { duration: 60, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
    );
  }, [flashOpacity, hitFlashSeq]);

  useEffect(() => {
    if (isEnraged) {
      enrageOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: ENRAGE_PULSE_MS / 2, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: ENRAGE_PULSE_MS / 2, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
      return;
    }
    enrageOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [enrageOpacity, isEnraged]);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const enrageStyle = useAnimatedStyle(() => ({
    opacity: enrageOpacity.value,
  }));

  return (
    <Animated.View style={styles.root}>
      {children}
      {isEnraged ? (
        <Animated.View style={[styles.enrageWrap, enrageStyle]} pointerEvents="none">
          <Image
            source={portraitSource}
            resizeMode="contain"
            style={[styles.portraitTint, { tintColor: ENRAGE_TINT }]}
          />
        </Animated.View>
      ) : null}
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
  enrageWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 3,
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
