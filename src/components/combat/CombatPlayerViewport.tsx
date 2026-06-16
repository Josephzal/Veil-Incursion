import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Image,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { EnemyDeckStrikeVariant } from '../../utils/combatTelemetryFormat';
import {
  FRONTLINE_MELEE_RETURN_IDLE_MS,
  FRONTLINE_MELEE_SNAP_MS,
  FRONTLINE_MELEE_SPRITE_HOLD_MS,
} from './combatEnemyBarLayout';
import CombatPlayerAttackSprite, { type CombatPlayerAttackSpriteHandle } from './CombatPlayerAttackSprite';

const SHAKE_AMPLITUDE = 10;
const DEFAULT_LUNGE = { x: 48, y: 0 };
const GLOW_PULSE_MS = 900;
const PRIMED_GLOW = '#ff00ff';

const FLASH_COLORS: Record<EnemyDeckStrikeVariant, string> = {
  hp: '#FF453A',
  stamina: '#5C2D91',
  abyssal: '#00D2C4',
};

export interface PlayerAttackLungeDelta {
  x: number;
  y: number;
}

export interface CombatPlayerViewportRef {
  triggerDamageEffect: (variant?: EnemyDeckStrikeVariant) => void;
  triggerAttackLunge: (delta?: PlayerAttackLungeDelta) => void;
  triggerEvadeAfterimage: () => void;
  triggerEnemyCritVignette: () => void;
  setWardPrimed: (active: boolean) => void;
}

interface CombatPlayerViewportProps {
  imageSource: ImageSourcePropType;
  attackImageSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
}

const CombatPlayerViewport = forwardRef<CombatPlayerViewportRef, CombatPlayerViewportProps>(
  function CombatPlayerViewport(
    { imageSource, attackImageSource, style, wardPrimed = false, abilityPrimed = false },
    ref,
  ) {
    const shakeX = useSharedValue(0);
    const lungeX = useSharedValue(0);
    const lungeY = useSharedValue(0);
    const flashOpacity = useSharedValue(0);
    const [flashColor, setFlashColor] = useState(FLASH_COLORS.hp);
    const flashColorRef = useRef(FLASH_COLORS.hp);
    const glowOpacity = useSharedValue(0);
    const attackSpriteRef = useRef<CombatPlayerAttackSpriteHandle>(null);
    const resolvedAttackSource = attackImageSource ?? imageSource;

    const primed = wardPrimed || abilityPrimed;

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

    const runTargetedLunge = (delta: PlayerAttackLungeDelta) => {
      void attackSpriteRef.current?.executeAttackAnimation();
      lungeX.value = withSequence(
        withTiming(delta.x, { duration: FRONTLINE_MELEE_SNAP_MS, easing: Easing.out(Easing.cubic) }),
        withDelay(FRONTLINE_MELEE_SPRITE_HOLD_MS, withTiming(delta.x, { duration: 0 })),
        withTiming(0, { duration: FRONTLINE_MELEE_RETURN_IDLE_MS, easing: Easing.inOut(Easing.cubic) }),
      );
      lungeY.value = withSequence(
        withTiming(delta.y, { duration: FRONTLINE_MELEE_SNAP_MS, easing: Easing.out(Easing.cubic) }),
        withDelay(FRONTLINE_MELEE_SPRITE_HOLD_MS, withTiming(delta.y, { duration: 0 })),
        withTiming(0, { duration: FRONTLINE_MELEE_RETURN_IDLE_MS, easing: Easing.inOut(Easing.cubic) }),
      );
    };

    useImperativeHandle(ref, () => ({
      triggerDamageEffect: (variant = 'hp') => {
        runShake();
        runFlash(variant);
      },
      triggerAttackLunge: (delta = DEFAULT_LUNGE) => {
        runTargetedLunge(delta);
      },
      triggerEvadeAfterimage: () => {
        lungeX.value = withSequence(
          withTiming(-14, { duration: 70, easing: Easing.out(Easing.cubic) }),
          withTiming(10, { duration: 70, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 60, easing: Easing.in(Easing.cubic) }),
        );
        lungeY.value = withTiming(0, { duration: 60 });
        runFlash('hp');
      },
      triggerEnemyCritVignette: () => {
        runShake();
        runFlash('hp');
      },
      setWardPrimed: (active: boolean) => {
        if (active) {
          glowOpacity.value = 0.8;
          return;
        }
        glowOpacity.value = withTiming(0, { duration: GLOW_PULSE_MS });
      },
    }), [flashOpacity, lungeX, lungeY, shakeX, glowOpacity]);

    const frameAnimatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: shakeX.value + lungeX.value },
        { translateY: lungeY.value },
      ],
    }));

    const glowStyle = useAnimatedStyle(() => ({
      opacity: glowOpacity.value * 0.38,
    }));

    const flashStyle = useAnimatedStyle(() => ({
      opacity: flashOpacity.value,
    }));

    return (
      <View style={[styles.root, style]}>
        <Animated.View style={[styles.spriteFrame, frameAnimatedStyle]}>
          <Animated.View style={[styles.glowDuplicate, glowStyle]} pointerEvents="none">
            <View style={styles.glowArtBox} pointerEvents="none">
              <Image
                source={imageSource}
                resizeMode="contain"
                style={[styles.spriteLayer, styles.glowImage, { tintColor: PRIMED_GLOW }]}
              />
            </View>
          </Animated.View>
          <View style={styles.spriteStack} pointerEvents="none">
            <CombatPlayerAttackSprite
              ref={attackSpriteRef}
              idleSource={imageSource}
              attackSource={resolvedAttackSource}
            />
            <Animated.View style={[styles.damageFlashWrap, flashStyle]} pointerEvents="none">
              <View style={styles.flashArtBox} pointerEvents="none">
                <Image
                  source={imageSource}
                  resizeMode="contain"
                  style={[styles.spriteLayer, { tintColor: flashColor }]}
                />
              </View>
            </Animated.View>
          </View>
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  spriteStack: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  glowArtBox: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  flashArtBox: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  spriteLayer: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    backgroundColor: 'transparent',
  },
  glowImage: {
    transform: [{ scale: 1.05 }],
  },
  glowDuplicate: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  damageFlashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
});
