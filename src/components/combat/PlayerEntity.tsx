import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import CombatPlayerViewport, { type CombatPlayerViewportRef } from './CombatPlayerViewport';
import {
  resolvePlayerCombatAttackPortrait,
  resolvePlayerCombatIdlePortrait,
} from '../../utils/combatPlayerPortrait';
import { OPERATIVE_ARENA_SPRITE_WIDTH } from '../../constants/combatLayout';

interface PlayerEntityProps {
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  operativeClass: ClassType;
  weaponFamilyId?: WeaponFamilyId | null;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Operative sprite shell in the arena — vitals live in the left dashboard. */
export default function PlayerEntity({
  playerViewportRef,
  operativeClass,
  weaponFamilyId = null,
  wardPrimed = false,
  abilityPrimed = false,
  style,
}: PlayerEntityProps): React.JSX.Element {
  return (
    <View
      style={[
        styles.spriteContainer,
        operativeClass === 'AEGIS' ? styles.spriteContainerMeleeWide : null,
        style,
      ]}
      pointerEvents="none"
    >
      <CombatPlayerViewport
        ref={playerViewportRef}
        imageSource={resolvePlayerCombatIdlePortrait(operativeClass, weaponFamilyId)}
        attackImageSource={resolvePlayerCombatAttackPortrait(operativeClass, weaponFamilyId)}
        operativeClass={operativeClass}
        weaponFamilyId={weaponFamilyId}
        // Aegis lunges into the enemy line; Envoy / Hex Shot stay planted for ranged strikes.
        stationaryAttack={operativeClass !== 'AEGIS'}
        wardPrimed={wardPrimed}
        abilityPrimed={abilityPrimed}
        style={[styles.sprite, operativeClass === 'AEGIS' ? styles.spriteMeleeWide : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  spriteContainer: {
    width: OPERATIVE_ARENA_SPRITE_WIDTH,
    flex: 1,
    minHeight: 190,
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  spriteContainerMeleeWide: {
    width: OPERATIVE_ARENA_SPRITE_WIDTH * 1.45,
  },
  sprite: {
    width: OPERATIVE_ARENA_SPRITE_WIDTH,
    flex: 1,
    minHeight: 190,
    alignSelf: 'flex-start',
    overflow: 'visible',
  },
  /** Extra horizontal room so Aegis attack pose / aura are not clipped mid-lunge. */
  spriteMeleeWide: {
    width: '100%',
    maxWidth: OPERATIVE_ARENA_SPRITE_WIDTH * 1.45,
  },
});
