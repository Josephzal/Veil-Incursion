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
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type IntentShimmerKind = 'fortify' | 'evade';

export const ENRAGE_TINT = '#8B0000';
export const ENRAGE_PULSE_MS = 2000;

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

function useIntentShimmerAnimation(kind: IntentShimmerKind | null) {
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

  return { glowOpacity, tintOpacity, evadePhase };
}

interface CombatEnemyIntentShimmerSyncedProps {
  kind: IntentShimmerKind | null;
  idleSource: ImageSourcePropType;
  attackSource: ImageSourcePropType;
  idleOpacity: SharedValue<number>;
  attackOpacity: SharedValue<number>;
  /** Fortify tint renders on `front`; glow halo on `back`. */
  layer?: 'back' | 'front';
}

/** Fortify / evade VFX — idle overlay tracks idle pose; attack overlay tracks attack pose. */
export function CombatEnemyIntentShimmerSynced({
  kind,
  idleSource,
  attackSource,
  idleOpacity,
  attackOpacity,
  layer = 'back',
}: CombatEnemyIntentShimmerSyncedProps): React.JSX.Element | null {
  const { glowOpacity, tintOpacity, evadePhase } = useIntentShimmerAnimation(kind);

  const idleGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * idleOpacity.value,
  }));

  const attackGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * attackOpacity.value,
  }));

  const idleFortifyTintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value * idleOpacity.value,
  }));

  const attackFortifyTintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value * attackOpacity.value,
  }));

  const idleEvadeTintStyle = useAnimatedStyle(() => ({
    opacity: (0.1 + evadePhase.value * 0.28) * idleOpacity.value,
  }));

  const attackEvadeTintStyle = useAnimatedStyle(() => ({
    opacity: (0.1 + evadePhase.value * 0.28) * attackOpacity.value,
  }));

  if (!kind) return null;

  if (kind === 'fortify') {
    if (layer === 'back') {
      return (
        <>
          <AnimatedImage
            source={idleSource}
            resizeMode="contain"
            style={[
              styles.enemySprite,
              styles.enemySpriteLayer,
              styles.enemySpriteGlow,
              idleGlowStyle,
              { tintColor: FORTIFY_GLOW },
              spriteDropShadow('rgba(251, 146, 60, 0.65)', 12),
            ]}
          />
          <AnimatedImage
            source={attackSource}
            resizeMode="contain"
            style={[
              styles.enemySprite,
              styles.enemySpriteLayer,
              styles.enemySpriteGlow,
              attackGlowStyle,
              { tintColor: FORTIFY_GLOW },
              spriteDropShadow('rgba(251, 146, 60, 0.65)', 12),
            ]}
          />
        </>
      );
    }
    return (
      <>
        <AnimatedImage
          source={idleSource}
          resizeMode="contain"
          style={[
            styles.enemySprite,
            styles.enemySpriteLayer,
            styles.enemySpriteFront,
            idleFortifyTintStyle,
            { tintColor: FORTIFY_TINT },
          ]}
        />
        <AnimatedImage
          source={attackSource}
          resizeMode="contain"
          style={[
            styles.enemySprite,
            styles.enemySpriteLayer,
            styles.enemySpriteFront,
            attackFortifyTintStyle,
            { tintColor: FORTIFY_TINT },
          ]}
        />
      </>
    );
  }

  if (layer === 'front') return null;

  return (
    <>
      <AnimatedImage
        source={idleSource}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          styles.enemySpriteGlow,
          idleGlowStyle,
          { tintColor: EVADE_GLOW },
          spriteDropShadow('rgba(248, 250, 252, 0.55)', 10),
        ]}
      />
      <AnimatedImage
        source={idleSource}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          idleEvadeTintStyle,
          { tintColor: EVADE_TINT },
        ]}
      />
      <AnimatedImage
        source={attackSource}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          styles.enemySpriteGlow,
          attackGlowStyle,
          { tintColor: EVADE_GLOW },
          spriteDropShadow('rgba(248, 250, 252, 0.55)', 10),
        ]}
      />
      <AnimatedImage
        source={attackSource}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          attackEvadeTintStyle,
          { tintColor: EVADE_TINT },
        ]}
      />
    </>
  );
}

interface CombatEnemyEnrageOverlaySyncedProps {
  idleSource: ImageSourcePropType;
  attackSource: ImageSourcePropType;
  idleOpacity: SharedValue<number>;
  attackOpacity: SharedValue<number>;
  pulseOpacity: SharedValue<number>;
}

/** Enraged crimson pulse — idle tint tracks idle pose; attack tint tracks attack pose. */
export function CombatEnemyEnrageOverlaySynced({
  idleSource,
  attackSource,
  idleOpacity,
  attackOpacity,
  pulseOpacity,
}: CombatEnemyEnrageOverlaySyncedProps): React.JSX.Element {
  const idleEnrageStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value * idleOpacity.value,
  }));

  const attackEnrageStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value * attackOpacity.value,
  }));

  return (
    <>
      <AnimatedImage
        source={idleSource}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          styles.enemySpriteFront,
          idleEnrageStyle,
          { tintColor: ENRAGE_TINT },
        ]}
      />
      <AnimatedImage
        source={attackSource}
        resizeMode="contain"
        style={[
          styles.enemySprite,
          styles.enemySpriteLayer,
          styles.enemySpriteFront,
          attackEnrageStyle,
          { tintColor: ENRAGE_TINT },
        ]}
      />
    </>
  );
}

/** @deprecated Use CombatEnemyIntentShimmerSynced inside AnimatedEnemySprite. */
interface CombatEnemyIntentShimmerProps {
  kind: IntentShimmerKind | null;
  source: ImageSourcePropType;
  layer?: 'back' | 'front';
}

export default function CombatEnemyIntentShimmer({
  kind,
  source,
  layer = 'back',
}: CombatEnemyIntentShimmerProps): React.JSX.Element | null {
  const idleOpacity = useSharedValue(1);
  const attackOpacity = useSharedValue(0);
  return (
    <CombatEnemyIntentShimmerSynced
      kind={kind}
      idleSource={source}
      attackSource={source}
      idleOpacity={idleOpacity}
      attackOpacity={attackOpacity}
      layer={layer}
    />
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
