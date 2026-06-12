import React, { useEffect } from 'react';
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  Platform,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type IntentShimmerKind = 'fortify' | 'evade';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const FORTIFY_GLOW = '#fb923c';
const FORTIFY_TINT = 'rgba(251, 146, 60, 0.55)';
const EVADE_GLOW = '#f8fafc';
const EVADE_TINT = 'rgba(248, 250, 252, 0.5)';

/** Web-only — drop-shadow respects PNG alpha (no box-shadow on containers). */
function spriteDropShadow(color: string, blurPx = 10): ImageStyle | undefined {
  if (Platform.OS !== 'web') return undefined;
  return { filter: `drop-shadow(0 0 ${blurPx}px ${color})` } as ImageStyle;
}

interface CombatEnemyIntentShimmerProps {
  kind: IntentShimmerKind | null;
  source: ImageSourcePropType;
  /** Fortify tint renders on `front`; glow halo on `back`. */
  layer?: 'back' | 'front';
}

/** Fortify / evade VFX — tinted duplicate sprites only (never parent box overlays). */
export default function CombatEnemyIntentShimmer({
  kind,
  source,
  layer = 'back',
}: CombatEnemyIntentShimmerProps): React.JSX.Element | null {
  const glowOpacity = useSharedValue(0.28);
  const tintOpacity = useSharedValue(0.18);
  const evadePhase = useSharedValue(0);

  useEffect(() => {
    if (!kind) {
      cancelAnimation(glowOpacity);
      cancelAnimation(tintOpacity);
      cancelAnimation(evadePhase);
      glowOpacity.value = 0.28;
      tintOpacity.value = 0.18;
      evadePhase.value = 0;
      return;
    }

    if (kind === 'fortify') {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.52, { duration: 550, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0.22, { duration: 550, easing: Easing.inOut(Easing.cubic) }),
        ),
        -1,
        false,
      );
      tintOpacity.value = withRepeat(
        withTiming(0.38, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        -1,
        true,
      );
      return () => {
        cancelAnimation(glowOpacity);
        cancelAnimation(tintOpacity);
      };
    }

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.42, { duration: 320, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.12, { duration: 280, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      false,
    );
    evadePhase.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(glowOpacity);
      cancelAnimation(evadePhase);
    };
  }, [evadePhase, glowOpacity, kind, tintOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const fortifyTintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value,
  }));

  const evadeTintStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + evadePhase.value * 0.28,
  }));

  if (!kind) return null;

  if (kind === 'fortify') {
    if (layer === 'back') {
      return (
        <AnimatedImage
          source={source}
          resizeMode="contain"
          style={[
            styles.enemySprite,
            styles.enemySpriteLayer,
            styles.enemySpriteGlow,
            glowStyle,
            { tintColor: FORTIFY_GLOW },
            spriteDropShadow('rgba(251, 146, 60, 0.65)', 12),
          ]}
        />
      );
    }
    return (
      <AnimatedImage
        source={source}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          styles.enemySpriteFront,
          fortifyTintStyle,
          { tintColor: FORTIFY_TINT },
        ]}
      />
    );
  }

  if (layer === 'front') return null;

  return (
    <>
      <AnimatedImage
        source={source}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          styles.enemySpriteGlow,
          glowStyle,
          { tintColor: EVADE_GLOW },
          spriteDropShadow('rgba(248, 250, 252, 0.55)', 10),
        ]}
      />
      <AnimatedImage
        source={source}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          evadeTintStyle,
          { tintColor: EVADE_TINT },
        ]}
      />
    </>
  );
}

export const enemySpriteStyles = StyleSheet.create({
  enemySprite: {
    width: '100%',
    height: '100%',
  },
  enemySpriteLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  enemySpriteGlow: {
    transform: [{ scale: 1.045 }],
  },
  enemySpriteFront: {
    zIndex: 2,
  },
});

const styles = enemySpriteStyles;
