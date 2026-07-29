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
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FACTION_STRIKE_TINT } from '../../constants/combatFactionStrike';
import type { ClassType, FactionType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { EnemyDeckStrikeVariant } from '../../utils/combatTelemetryFormat';
import {
  FRONTLINE_MELEE_RETURN_IDLE_MS,
  FRONTLINE_MELEE_SNAP_MS,
  FRONTLINE_MELEE_SPRITE_HOLD_MS,
  FRONTLINE_MELEE_SPRITE_IN_MS,
  FRONTLINE_MELEE_SPRITE_OUT_MS,
  RANGED_ATTACK_SPRITE_HOLD_MS,
  RANGED_ATTACK_SPRITE_IN_MS,
  RANGED_ATTACK_SPRITE_OUT_MS,
} from './combatEnemyBarLayout';
import CombatPlayerAttackSprite, { type CombatPlayerAttackSpriteHandle } from './CombatPlayerAttackSprite';

const SHAKE_AMPLITUDE = 10;
const DEFAULT_LUNGE = { x: 96, y: -6 };
/** Shrink while lunging — attack pose should read smaller than idle as they close distance. */
const AEGIS_LUNGE_SCALE = 0.84;
const GLOW_PULSE_MS = 900;

const DAMAGE_FLASH_COLORS: Record<EnemyDeckStrikeVariant, string> = {
  hp: '#FF453A',
  stamina: '#5C2D91',
  abyssal: '#00D2C4',
};

export interface PlayerAttackLungeDelta {
  x: number;
  y: number;
}

export interface PlayerStrikeOptions {
  faction?: FactionType;
}

export interface CombatPlayerViewportRef {
  triggerDamageEffect: (variant?: EnemyDeckStrikeVariant) => void;
  triggerAttackLunge: (delta?: PlayerAttackLungeDelta, options?: PlayerStrikeOptions) => void;
  /** Ranged strike — attack crossfade, no lunge/scale; faction aura behind art. */
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
    const damageFlashOpacity = useSharedValue(0);
    const strikeAuraOpacity = useSharedValue(0);
    const [damageTint, setDamageTint] = useState(DAMAGE_FLASH_COLORS.hp);
    const [strikeTint, setStrikeTint] = useState(FACTION_STRIKE_TINT.TERRAN_GRID);
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

    const runDamageFlash = (variant: EnemyDeckStrikeVariant) => {
      setDamageTint(DAMAGE_FLASH_COLORS[variant]);
      cancelAnimation(strikeAuraOpacity);
      strikeAuraOpacity.value = 0;
      damageFlashOpacity.value = withSequence(
        withTiming(0.72, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withTiming(0.48, { duration: 180 }),
        withTiming(0, { duration: 320, easing: Easing.inOut(Easing.cubic) }),
      );
    };

    const runStrikeAura = (
      faction: FactionType | undefined,
      inMs: number,
      holdMs: number,
      outMs: number,
    ) => {
      setStrikeTint(FACTION_STRIKE_TINT[faction ?? 'TERRAN_GRID']);
      cancelAnimation(damageFlashOpacity);
      damageFlashOpacity.value = 0;
      strikeAuraOpacity.value = withSequence(
        withTiming(1, {
          duration: inMs,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(holdMs, withTiming(1, { duration: 0 })),
        withTiming(0, {
          duration: outMs,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
    };

    const runSpriteCrossfade = (melee: boolean) => {
      if (melee) {
        void attackSpriteRef.current?.executeAttackAnimation();
      } else {
        void attackSpriteRef.current?.executeRangedAttackAnimation();
      }
      cancelAnimation(strikeAuraOpacity);
      strikeAuraOpacity.value = 0;
      lungeX.value = 0;
      lungeY.value = 0;
      attackScale.value = 1;
    };

    const runTargetedLunge = (delta: PlayerAttackLungeDelta, faction?: FactionType) => {
      if (stationaryAttack) {
        runSpriteCrossfade(true);
        return;
      }
      void attackSpriteRef.current?.executeAttackAnimation();
      runStrikeAura(
        faction,
        FRONTLINE_MELEE_SPRITE_IN_MS,
        FRONTLINE_MELEE_SPRITE_HOLD_MS,
        FRONTLINE_MELEE_SPRITE_OUT_MS,
      );
      cancelAnimation(attackScale);
      cancelAnimation(lungeX);
      cancelAnimation(lungeY);
      attackScale.value = withSequence(
        withTiming(AEGIS_LUNGE_SCALE, {
          duration: FRONTLINE_MELEE_SNAP_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(FRONTLINE_MELEE_SPRITE_HOLD_MS, withTiming(AEGIS_LUNGE_SCALE, { duration: 0 })),
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

    const runRangedAttack = (faction?: FactionType) => {
      if (stationaryAttack) {
        // Stationary classes still get the footprint-aligned strike aura on attack art.
        void attackSpriteRef.current?.executeRangedAttackAnimation();
        runStrikeAura(
          faction,
          RANGED_ATTACK_SPRITE_IN_MS,
          RANGED_ATTACK_SPRITE_HOLD_MS,
          RANGED_ATTACK_SPRITE_OUT_MS,
        );
        lungeX.value = 0;
        lungeY.value = 0;
        attackScale.value = 1;
        return;
      }
      void attackSpriteRef.current?.executeRangedAttackAnimation();
      runStrikeAura(
        faction,
        RANGED_ATTACK_SPRITE_IN_MS,
        RANGED_ATTACK_SPRITE_HOLD_MS,
        RANGED_ATTACK_SPRITE_OUT_MS,
      );
      lungeX.value = 0;
      lungeY.value = 0;
      attackScale.value = 1;
    };

    useImperativeHandle(ref, () => ({
      triggerDamageEffect: (variant = 'hp') => {
        runShake();
        runDamageFlash(variant);
      },
      triggerAttackLunge: (delta = DEFAULT_LUNGE, options) => {
        runTargetedLunge(delta, options?.faction);
      },
      triggerRangedAttack: (options) => {
        runRangedAttack(options?.faction);
      },
      triggerEvadeAfterimage: () => {
        lungeX.value = withSequence(
          withTiming(-14, { duration: 70, easing: Easing.out(Easing.cubic) }),
          withTiming(10, { duration: 70, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: 60, easing: Easing.in(Easing.cubic) }),
        );
        lungeY.value = withTiming(0, { duration: 60 });
        runDamageFlash('hp');
      },
      triggerEnemyCritVignette: () => {
        runShake();
        runDamageFlash('hp');
      },
      setWardPrimed: (active: boolean) => {
        if (active) {
          glowOpacity.value = 0.8;
          return;
        }
        glowOpacity.value = withTiming(0, { duration: GLOW_PULSE_MS });
      },
    }), [attackScale, damageFlashOpacity, stationaryAttack, strikeAuraOpacity, lungeX, lungeY, shakeX, glowOpacity]);

    const frameAnimatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: shakeX.value + lungeX.value },
        { translateY: lungeY.value },
        { scale: attackScale.value },
      ],
      // Keep feet planted while shrinking into the lunge.
      transformOrigin: 'bottom center',
    }));

    const damageFlashStyle = useAnimatedStyle(() => ({
      opacity: damageFlashOpacity.value * (1 - strikeAuraOpacity.value),
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
              strikeAuraOpacity={strikeAuraOpacity}
              strikeTint={strikeTint}
              primedGlowOpacity={glowOpacity}
            />
            <Animated.View style={[styles.damageFlashWrap, damageFlashStyle]} pointerEvents="none">
              <View style={styles.flashArtBox} pointerEvents="none">
                <Image
                  source={imageSource}
                  resizeMode="contain"
                  style={[styles.spriteLayer, { tintColor: damageTint }]}
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
  flashArtBox: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  spriteLayer: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    backgroundColor: 'transparent',
  },
  damageFlashWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 3,
    backgroundColor: 'transparent',
  },
});
