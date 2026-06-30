import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
import { OPERATIVE_ARENA_SPRITE_WIDTH, OPERATIVE_ARENA_LEFT_INSET, OPERATIVE_ARENA_TOP_INSET } from '../../constants/combatLayout';
import { useCombatDesktopLayout } from '../../hooks/useCombatDesktopLayout';
import type { ClassType } from '../../types/game';
import type { CombatPlayerViewportRef } from './CombatPlayerViewport';

function operativeScaleForClass(operativeClass: ClassType, isCombatDesktop: boolean): number {
  if (!isCombatDesktop) return 1;
  if (operativeClass === 'AEGIS') return 1.4;
  return 1.15;
}

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
  const { isCombatDesktop, scaleCombatSize } = useCombatDesktopLayout();
  const operativeScale = operativeScaleForClass(operativeClass, isCombatDesktop);
  const operativeLeft = isCombatDesktop ? '10%' : 0;
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

      <View
        style={[
          styles.operativeZone,
          isCombatDesktop ? {
            left: operativeLeft,
            width: OPERATIVE_ARENA_SPRITE_WIDTH * operativeScale + scaleCombatSize(28),
            paddingLeft: scaleCombatSize(OPERATIVE_ARENA_LEFT_INSET),
            paddingTop: scaleCombatSize(OPERATIVE_ARENA_TOP_INSET),
          } : null,
        ]}
        pointerEvents="box-none"
      >
        <CombatOperativeAugmentRow icons={augmentIcons} />
        <View
          style={[
            styles.operativeSpriteSlot,
            operativeScale !== 1 ? {
              transform: [{ scale: operativeScale }],
              ...(Platform.OS === 'web' ? { transformOrigin: 'bottom center' } : null),
            } : null,
          ]}
        >
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
    ...StyleSheet.absoluteFill,
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
    paddingLeft: OPERATIVE_ARENA_LEFT_INSET,
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
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    elevation: 10,
    overflow: 'visible',
  },
  overlayHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 25,
    elevation: 25,
  },
  spriteFill: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
