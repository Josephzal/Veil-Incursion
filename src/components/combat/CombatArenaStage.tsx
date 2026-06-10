import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { ApparitionViewportRef } from './ApparitionViewport';
import { ApparitionViewport } from './ApparitionViewport';
import CombatPlayerViewport, { type CombatPlayerViewportRef } from './CombatPlayerViewport';
import { CombatEnemyChromeLayer } from '../../context/CombatEnemyChromeContext';

interface CombatArenaStageProps {
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  enemyViewportRef: React.RefObject<ApparitionViewportRef | null>;
  playerImageSource: ImageSourcePropType;
  enemyImageSource: ImageSourcePropType;
  enemyPortraitKey: string;
  wardPrimed?: boolean;
  parryBlocksEnemyTouches: boolean;
  onEradicationComplete: () => void;
}

export default function CombatArenaStage({
  playerViewportRef,
  enemyViewportRef,
  playerImageSource,
  enemyImageSource,
  enemyPortraitKey,
  wardPrimed = false,
  parryBlocksEnemyTouches,
  onEradicationComplete,
}: CombatArenaStageProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      <View style={styles.playerColumn}>
        <View style={styles.playerSpriteSlot}>
          <CombatPlayerViewport
            ref={playerViewportRef}
            imageSource={playerImageSource}
            wardPrimed={wardPrimed}
            style={styles.spriteFill}
          />
        </View>
      </View>

      <View style={styles.enemyColumn}>
        <View style={styles.enemySpriteSlot}>
          <ApparitionViewport
            key={enemyPortraitKey}
            ref={enemyViewportRef}
            imageSource={enemyImageSource}
            style={styles.spriteFill}
            pointerEvents={parryBlocksEnemyTouches ? 'none' : 'auto'}
            onEradicationComplete={onEradicationComplete}
          />
          <CombatEnemyChromeLayer />
        </View>
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
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  playerColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  enemyColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
    position: 'relative',
  },
  playerSpriteSlot: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end',
    paddingBottom: '2%',
  },
  enemySpriteSlot: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingTop: '6%',
    position: 'relative',
  },
  spriteFill: {
    flex: 1,
    width: '100%',
  },
});
