import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { ApparitionViewportRef } from './ApparitionViewport';
import { ApparitionViewport } from './ApparitionViewport';
import CombatPlayerViewport, { type CombatPlayerViewportRef } from './CombatPlayerViewport';
import { CombatEnemyChromeLayer } from '../../context/CombatEnemyChromeContext';
import CombatPlayerSliceOverlay from './CombatPlayerSliceOverlay';
import { ARENA_ENEMY_GRID_INSET_RIGHT, PLAYER_SPRITE_LOWER_RATIO } from './combatEnemyBarLayout';

interface CombatArenaStageProps {
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  enemyViewportRef: React.RefObject<ApparitionViewportRef | null>;
  playerImageSource: ImageSourcePropType;
  playerAttackImageSource?: ImageSourcePropType;
  enemyImageSource: ImageSourcePropType;
  enemyPortraitKey: string;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
  /** When set, renders the multi-enemy squad grid in the enemy column. */
  enemySquadPanel?: React.ReactNode;
  parryBlocksEnemyTouches: boolean;
  onEradicationComplete: () => void;
}

export default function CombatArenaStage({
  playerViewportRef,
  enemyViewportRef,
  playerImageSource,
  playerAttackImageSource,
  enemyImageSource,
  enemyPortraitKey,
  wardPrimed = false,
  abilityPrimed = false,
  enemySquadPanel,
  parryBlocksEnemyTouches,
  onEradicationComplete,
}: CombatArenaStageProps): React.JSX.Element {
  const useSquadPanel = enemySquadPanel != null;
  const [playerColumnHeight, setPlayerColumnHeight] = useState(0);

  const handlePlayerColumnLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setPlayerColumnHeight((prev) => (prev === height ? prev : height));
  }, []);

  const playerSpriteSlotStyle: ViewStyle | undefined =
    playerColumnHeight > 0
      ? { transform: [{ translateY: playerColumnHeight * PLAYER_SPRITE_LOWER_RATIO }] }
      : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.playerColumn} onLayout={handlePlayerColumnLayout}>
        <View style={[styles.playerSpriteSlot, playerSpriteSlotStyle]}>
          <CombatPlayerViewport
            ref={playerViewportRef}
            imageSource={playerImageSource}
            attackImageSource={playerAttackImageSource}
            wardPrimed={wardPrimed}
            abilityPrimed={abilityPrimed}
            style={styles.spriteFill}
          />
          <CombatPlayerSliceOverlay />
        </View>
      </View>

      <View style={styles.enemyColumn}>
        {useSquadPanel ? (
          <View style={styles.enemySquadSlot}>
            <View style={styles.hiddenApparition} pointerEvents="none">
              <ApparitionViewport
                key={enemyPortraitKey}
                ref={enemyViewportRef}
                imageSource={enemyImageSource}
                style={styles.spriteFill}
                onEradicationComplete={onEradicationComplete}
              />
            </View>
            <View style={styles.enemySquadPanel} pointerEvents="box-none">
              {enemySquadPanel}
            </View>
          </View>
        ) : (
          <View style={styles.enemySpriteSlot}>
            <ApparitionViewport
              key={enemyPortraitKey}
              ref={enemyViewportRef}
              imageSource={enemyImageSource}
              style={styles.spriteFill}
              pointerEvents={parryBlocksEnemyTouches ? 'none' : 'auto'}
              onEradicationComplete={onEradicationComplete}
            />
          </View>
        )}
        <CombatEnemyChromeLayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    width: '100%',
    overflow: 'visible',
  },
  playerColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'visible',
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  enemyColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'visible',
    paddingRight: ARENA_ENEMY_GRID_INSET_RIGHT,
  },
  playerSpriteSlot: {
    width: '100%',
    height: '57%',
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
    marginBottom: -8,
    position: 'relative',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  enemySpriteSlot: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingTop: '6%',
    position: 'relative',
  },
  enemySquadSlot: {
    flex: 1,
    minHeight: 0,
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'visible',
  },
  enemySquadPanel: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  hiddenApparition: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    zIndex: 1,
  },
  spriteFill: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
