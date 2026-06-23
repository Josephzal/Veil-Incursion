import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ClassType } from '../../types/game';
import CombatPlayerViewport, { type CombatPlayerViewportRef } from './CombatPlayerViewport';
import {
  resolvePlayerCombatAttackPortrait,
  resolvePlayerCombatIdlePortrait,
} from '../../utils/combatPlayerPortrait';
import { OPERATIVE_ARENA_SPRITE_WIDTH } from '../../constants/combatLayout';

interface PlayerEntityProps {
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  operativeClass: ClassType;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Operative sprite shell in the arena — vitals live in the left dashboard. */
export default function PlayerEntity({
  playerViewportRef,
  operativeClass,
  wardPrimed = false,
  abilityPrimed = false,
  style,
}: PlayerEntityProps): React.JSX.Element {
  return (
    <View style={[styles.spriteContainer, style]}>
      <CombatPlayerViewport
        ref={playerViewportRef}
        imageSource={resolvePlayerCombatIdlePortrait(operativeClass)}
        attackImageSource={resolvePlayerCombatAttackPortrait(operativeClass)}
        wardPrimed={wardPrimed}
        abilityPrimed={abilityPrimed}
        style={styles.sprite}
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
  sprite: {
    width: OPERATIVE_ARENA_SPRITE_WIDTH,
    flex: 1,
    minHeight: 190,
    alignSelf: 'flex-start',
  },
});
