import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import {
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { EnemyDeckStrikeVariant } from '../../utils/combatTelemetryFormat';
import {
  FRONTLINE_MELEE_RETURN_IDLE_MS,
  FRONTLINE_MELEE_SNAP_MS,
  FRONTLINE_MELEE_SPRITE_HOLD_MS,
} from './combatEnemyBarLayout';
import CombatPlayerAttackSprite, { type CombatPlayerAttackSpriteHandle } from './CombatPlayerAttackSprite';
import { usesAnatomyPoseRegistration } from '../../utils/combatPoseRegistration';

const SHAKE_AMPLITUDE = 10;
const DEFAULT_LUNGE = { x: 96, y: -6 };
/** Shrink while lunging — legacy weapons only. Longsword uses anatomy registration (no scale pop). */
const AEGIS_LUNGE_SCALE = 0.84;
const GLOW_PULSE_MS = 900;

export interface PlayerAttackLungeDelta {
  x: number;
  y: number;
}

export interface PlayerStrikeOptions {
  /** @deprecated Faction tint overlays removed — kept for call-site compatibility. */
  faction?: string;
}

export interface CombatPlayerViewportRef {
  triggerDamageEffect: (variant?: EnemyDeckStrikeVariant) => void;
  triggerAttackLunge: (delta?: PlayerAttackLungeDelta, options?: PlayerStrikeOptions) => void;
  /** Ranged strike — attack crossfade, no lunge/scale. */
  triggerRangedAttack: (options?: PlayerStrikeOptions) => void;
  triggerEvadeAfterimage: () => void;
  triggerEnemyCritVignette: () => void;
  setWardPrimed: (active: boolean) => void;
}

interface CombatPlayerViewportProps {
  imageSource: ImageSourcePropType;
  attackImageSource?: ImageSourcePropType;
  operativeClass?: ClassType;
  weaponFamilyId?: WeaponFamilyId | null;
  /** Crossfade attack art only — no lunge or scale. */
  stationaryAttack?: boolean;
  style?: StyleProp<ViewStyle>;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
}

const CombatPlayerViewport = forwardRef<CombatPlayerViewportRef, CombatPlayerViewportProps>(
  function CombatPlayerViewport(
    {
      imageSource,
      attackImageSource,
      operativeClass = 'AEGIS',
      weaponFamilyId = null,
      stationaryAttack = false,
      style,
      wardPrimed = false,
      abilityPrimed = false,
    },
    ref,
  ) {
    const shakeX = useSharedValue(0);
    const lungeX = useSharedValue(0);
    const lungeY = useSharedValue(0);
    const attackScale = useSharedValue(1);
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

    const runSpriteCrossfade = (melee: boolean) => {
      if (melee) {
        void attackSpriteRef.current?.executeAttackAnimation();
      } else {
        void attackSpriteRef.current?.executeRangedAttackAnimation();
      }
      lungeX.value = 0;
      lungeY.value = 0;
      attackScale.value = 1;
    };

    const runTargetedLunge = (delta: PlayerAttackLungeDelta) => {
      if (stationaryAttack) {
        runSpriteCrossfade(true);
        return;
      }
      void attackSpriteRef.current?.executeAttackAnimation();
      cancelAnimation(attackScale);
      cancelAnimation(lungeX);
      cancelAnimation(lungeY);
      // Anatomy-registered Longsword keeps body scale at 1 — only translate toward the target.
      const lungeScale = usesAnatomyPoseRegistration(weaponFamilyId) ? 1 : AEGIS_LUNGE_SCALE;
      attackScale.value = withSequence(
        withTiming(lungeScale, {
          duration: FRONTLINE_MELEE_SNAP_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(FRONTLINE_MELEE_SPRITE_HOLD_MS, withTiming(lungeScale, { duration: 0 })),
        withTiming(1, {
          duration: FRONTLINE_MELEE_RETURN_IDLE_MS,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
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

    const runRangedAttack = () => {
      void attackSpriteRef.current?.executeRangedAttackAnimation();
      lungeX.value = 0;
      lungeY.value = 0;
      attackScale.value = 1;
    };

    useImperativeHandle(ref, () => ({
      triggerDamageEffect: () => {
        // Shake only — colored portrait tint overlays removed.
        runShake();
      },
      triggerAttackLunge: (delta = DEFAULT_LUNGE) => {
        runTargetedLunge(delta);
      },
      triggerRangedAttack: () => {
        runRangedAttack();
      },
      triggerEvadeAfterimage: () => {
        lungeX.value = withSequence(
          withTiming(-14, { duration: 70, easing: Easing.out(Easing.cubic) }),
          withTiming(10, { duration: 70, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 60, easing: Easing.in(Easing.cubic) }),
        );
        lungeY.value = withTiming(0, { duration: 60 });
      },
      triggerEnemyCritVignette: () => {
        runShake();
      },
      setWardPrimed: (active: boolean) => {
        if (active) {
          glowOpacity.value = 0.8;
          return;
        }
        glowOpacity.value = withTiming(0, { duration: GLOW_PULSE_MS });
      },
    }), [attackScale, stationaryAttack, lungeX, lungeY, shakeX, glowOpacity, weaponFamilyId]);

    const frameAnimatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: shakeX.value + lungeX.value },
        { translateY: lungeY.value },
        { scale: attackScale.value },
      ],
      // Keep feet planted while shrinking into the lunge.
      transformOrigin: 'bottom center',
    }));

    return (
      <View style={[styles.root, style]}>
        <Animated.View style={[styles.spriteFrame, frameAnimatedStyle]}>
          <View style={styles.spriteStack} pointerEvents="none">
            <CombatPlayerAttackSprite
              ref={attackSpriteRef}
              idleSource={imageSource}
              attackSource={resolvedAttackSource}
              operativeClass={operativeClass}
              weaponFamilyId={weaponFamilyId}
              primedGlowOpacity={glowOpacity}
            />
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
    width: '100%',
    height: '100%',
    minHeight: 120,
    position: 'relative',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  spriteStack: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    zIndex: 2,
    overflow: 'visible',
  },
});
