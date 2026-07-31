import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  subscribeWardenStrikePresentation,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
  isWardenStrikePresentationActive,
} from '../../data/wardenStrikePresentation';
import { enemySpriteStyles } from './CombatEnemyIntentShimmer';

/** Low-opacity red silhouette wash — peaks with enemy contact VFX. */
const RED_TINT = '#b91c1c';
const RED_PEAK = 0.28;
const RED_FADE_IN_MS = 36;
const RED_FADE_OUT_MS = 140;

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface CombatEnemyHitEffectProps {
  hitFlashSeq?: number;
  /** When set, Warden contact-timed wash only fires for this target. */
  unitId?: string;
  portraitSource?: ImageSourcePropType | unknown;
  attackPortraitSource?: ImageSourcePropType | unknown;
  children: React.ReactNode;
}

/**
 * Red damage wash clipped to the enemy portrait alpha (tinted sprite duplicate).
 * Non-Warden: fires with hitFlashSeq. Warden: fires on contact (with burst/incision).
 */
export default function CombatEnemyHitEffect({
  hitFlashSeq = 0,
  unitId,
  portraitSource,
  attackPortraitSource,
  children,
}: CombatEnemyHitEffectProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const redOpacity = useSharedValue(0);

  const flashRed = () => {
    redOpacity.value = 0;
    redOpacity.value = withSequence(
      withTiming(RED_PEAK, { duration: RED_FADE_IN_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: RED_FADE_OUT_MS, easing: Easing.in(Easing.quad) }),
    );
  };

  useEffect(() => {
    if (hitFlashSeq <= 0 || hitFlashSeq === lastSeqRef.current) return;
    lastSeqRef.current = hitFlashSeq;
    if (isWardenStrikePresentationActive()) return;
    if (!WARDEN_STRIKE_VFX_LAYER_TOGGLES.hitFlashSeqVisuals) return;
    if (!WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyHitEffect) return;
    flashRed();
  }, [hitFlashSeq, redOpacity]);

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    if (event.phase !== 'contact') return;
    if (unitId && event.result.targetId !== unitId) return;
    if (!WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyHitEffect) return;
    if (event.result.outcome === 'EVADE' || event.result.outcome === 'MISS') return;
    if (event.result.damage <= 0) return;
    flashRed();
  }), [redOpacity, unitId]);

  const redStyle = useAnimatedStyle(() => ({
    opacity: redOpacity.value,
  }));

  const idleSrc = portraitSource as ImageSourcePropType | undefined;
  const attackSrc = (attackPortraitSource as ImageSourcePropType | undefined) ?? idleSrc;

  // Hits land on the idle pose; one tinted duplicate keeps the wash silhouette-only.
  const washSrc = idleSrc ?? attackSrc;

  return (
    <View style={styles.root}>
      {children}
      {washSrc ? (
        <View style={styles.silhouetteHost} pointerEvents="none">
          <AnimatedImage
            source={washSrc}
            resizeMode="contain"
            tintColor={RED_TINT}
            style={[
              enemySpriteStyles.enemySprite,
              enemySpriteStyles.enemySpriteLayer,
              redStyle,
            ]}
          />
        </View>
      ) : null}
    </View>
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
  silhouetteHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
});
