import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { ApparitionViewport, type ApparitionViewportRef } from './ApparitionViewport';
import CombatOrbitalUltimate from './CombatOrbitalUltimate';
import CombatEviscerateCinematic from './CombatEviscerateCinematic';
import { CombatEnemyChromeLayer } from '../../context/CombatEnemyChromeContext';
import { CombatArenaOverlayHost } from '../../context/CombatArenaOverlayContext';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';
import CombatOperativeAugmentRow from './CombatOperativeAugmentRow';
import PlayerEntity from './PlayerEntity';
import type { CombatAugmentIcon } from '../../utils/combatAugmentIcons';
import { OPERATIVE_ARENA_SPRITE_WIDTH, OPERATIVE_ARENA_TOP_INSET } from '../../constants/combatLayout';
import type { ClassType } from '../../types/game';
import type { CombatPlayerViewportRef } from './CombatPlayerViewport';

interface CombatLandscapeArenaProps {
  apparitionRef: React.RefObject<ApparitionViewportRef | null>;
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  portraitKey: string;
  portraitSource: ImageSourcePropType;
  operativeClass: ClassType;
  wardPrimed?: boolean;
  abilityPrimed?: boolean;
  enemySquadPanel: React.ReactNode;
  augmentIcons?: readonly CombatAugmentIcon[];
  gridUnits: Array<{ unitId: string; portraitSource: ImageSourcePropType }>;
  onEradicationComplete: () => void;
}

/** Landscape console arena — operative bottom-left, orbital ultimate center, staggered grid right. */
export default function CombatLandscapeArena({
  apparitionRef,
  playerViewportRef,
  portraitKey,
  portraitSource,
  operativeClass,
  wardPrimed = false,
  abilityPrimed = false,
  enemySquadPanel,
  augmentIcons = [],
  gridUnits,
  onEradicationComplete,
}: CombatLandscapeArenaProps): React.JSX.Element {
  const { ui } = useCombatEnemyChrome();
  const eviscerateTargetPortrait = useMemo(() => {
    if (!ui.eviscerateTargetUnitId) return null;
    return gridUnits.find((unit) => unit.unitId === ui.eviscerateTargetUnitId)?.portraitSource ?? null;
  }, [gridUnits, ui.eviscerateTargetUnitId]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.hiddenApparition} pointerEvents="none">
        <ApparitionViewport
          key={portraitKey}
          ref={apparitionRef}
          imageSource={portraitSource}
          style={styles.spriteFill}
          onEradicationComplete={onEradicationComplete}
        />
      </View>

      <View style={styles.operativeZone} pointerEvents="box-none">
        <CombatOperativeAugmentRow icons={augmentIcons} />
        <View style={styles.operativeSpriteSlot}>
          <PlayerEntity
            playerViewportRef={playerViewportRef}
            operativeClass={operativeClass}
            wardPrimed={wardPrimed}
            abilityPrimed={abilityPrimed}
          />
        </View>
      </View>

      <CombatOrbitalUltimate />

      <View style={styles.enemyGridHost} pointerEvents="box-none">
        {enemySquadPanel}
      </View>

      <CombatEnemyChromeLayer />

      <View style={styles.overlayHost} pointerEvents="box-none">
        <CombatArenaOverlayHost />
      </View>

      <CombatEviscerateCinematic targetPortrait={eviscerateTargetPortrait} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  hiddenApparition: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    zIndex: 0,
  },
  operativeZone: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    top: 0,
    width: OPERATIVE_ARENA_SPRITE_WIDTH + 24,
    zIndex: 12,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingLeft: 4,
    paddingTop: OPERATIVE_ARENA_TOP_INSET,
  },
  operativeSpriteSlot: {
    width: OPERATIVE_ARENA_SPRITE_WIDTH,
    flexShrink: 0,
    flex: 1,
    minHeight: 100,
    maxHeight: '82%',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  enemyGridHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    elevation: 25,
  },
  spriteFill: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
