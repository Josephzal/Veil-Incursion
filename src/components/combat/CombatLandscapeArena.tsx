import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { ApparitionViewport, type ApparitionViewportRef } from './ApparitionViewport';
import CombatOrbitalUltimate from './CombatOrbitalUltimate';
import CombatEviscerateCinematic from './CombatEviscerateCinematic';
import CombatRuinArenaVfx from './CombatRuinArenaVfx';
import { CombatEnemyChromeLayer } from '../../context/CombatEnemyChromeContext';
import { CombatArenaOverlayHost } from '../../context/CombatArenaOverlayContext';
import { CombatArenaCombatUiHost } from '../../context/CombatArenaCombatUiContext';
import { useCombatEnemyChrome } from '../../context/CombatEnemyChromeContext';
import CombatOperativeAugmentRow from './CombatOperativeAugmentRow';
import PlayerEntity from './PlayerEntity';
import type { CombatAugmentIcon } from '../../utils/combatAugmentIcons';
import { OPERATIVE_ARENA_SPRITE_WIDTH, OPERATIVE_ARENA_LEFT_INSET, OPERATIVE_ARENA_TOP_INSET } from '../../constants/combatLayout';
import { OTT_STAGE } from '../../constants/occultTacticalTerminalTheme';
import { useCombatDesktopLayout } from '../../hooks/useCombatDesktopLayout';
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import type { CombatPlayerViewportRef } from './CombatPlayerViewport';
import CombatGroundContact from './ui/CombatGroundContact';
import { WARDEN_ARENA_PLANE } from '../../data/wardenArenaPlanes';
import { subscribeWardenStrikePresentation } from '../../data/wardenStrikePresentation';

/**
 * Shared arena scale for every class/weapon.
 * Figure height is normalized to envoy-echo-lantern idle in combatPlayerPortrait.
 */
function operativeArenaScale(isCombatDesktop: boolean): number {
  return isCombatDesktop ? 1.6 : 0.92;
}

interface CombatLandscapeArenaProps {
  apparitionRef: React.RefObject<ApparitionViewportRef | null>;
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  portraitKey: string;
  portraitSource: ImageSourcePropType;
  operativeClass: ClassType;
  weaponFamilyId?: WeaponFamilyId | null;
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
  weaponFamilyId = null,
  wardPrimed = false,
  abilityPrimed = false,
  enemySquadPanel,
  augmentIcons = [],
  gridUnits,
  onEradicationComplete,
}: CombatLandscapeArenaProps): React.JSX.Element {
  const { isCombatDesktop, scaleCombatSize } = useCombatDesktopLayout();
  const operativeScale = operativeArenaScale(isCombatDesktop);
  // Figure height matches Vambrace idle via portrait math for every class/weapon.
  const meleeWide = operativeClass === 'AEGIS';
  const spriteSlotWidth = OPERATIVE_ARENA_SPRITE_WIDTH * (meleeWide ? 1.45 : 1);
  const operativeLeft = isCombatDesktop ? OTT_STAGE.playerLeftPercent : '6%';
  const { ui } = useCombatEnemyChrome();
  const [wardenApproachLift, setWardenApproachLift] = useState(false);
  useEffect(() => subscribeWardenStrikePresentation((event) => {
    setWardenApproachLift(event.phase !== 'done' && event.phase !== 'idle');
  }), []);
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
          { width: spriteSlotWidth + 24 },
          wardenApproachLift ? styles.operativeZoneApproach : null,
          isCombatDesktop ? {
            left: operativeLeft,
            width: spriteSlotWidth * operativeScale + scaleCombatSize(28),
            paddingLeft: scaleCombatSize(OPERATIVE_ARENA_LEFT_INSET),
            paddingTop: scaleCombatSize(OPERATIVE_ARENA_TOP_INSET),
          } : { left: operativeLeft },
        ]}
        pointerEvents="box-none"
      >
        <CombatOperativeAugmentRow icons={augmentIcons} />
        {/*
          Sprite is visual-only. Aegis melee-wide (esp. Paired Blades) overlaps FL_0;
          pointerEvents none lets targeting reach the enemy grid underneath.
        */}
        <View
          style={[
            styles.operativeSpriteSlot,
            { width: spriteSlotWidth },
            operativeScale !== 1 ? {
              transform: [{ scale: operativeScale }],
              ...(Platform.OS === 'web' ? { transformOrigin: 'bottom center' } : null),
            } : null,
          ]}
          pointerEvents="none"
        >
          <CombatGroundContact active />
          <PlayerEntity
            playerViewportRef={playerViewportRef}
            operativeClass={operativeClass}
            weaponFamilyId={weaponFamilyId}
            wardPrimed={wardPrimed}
            abilityPrimed={abilityPrimed}
          />
        </View>
      </View>

      <CombatOrbitalUltimate />

      {/*
        Idle: enemy grid sits above the operative so FL_0 under a wide Paired Blades
        sprite stays tappable (child zIndex cannot escape this host).
        Warden approach: tuck the grid back under the moving player.
      */}
      <View
        style={[
          styles.enemyGridHost,
          wardenApproachLift ? styles.enemyGridHostUnderWarden : styles.enemyGridHostSelectable,
        ]}
        pointerEvents="box-none"
      >
        {enemySquadPanel}
      </View>

      <CombatEnemyChromeLayer />

      {/* Above operative so RUIN eruption reads in front of the player sprite. */}
      <CombatRuinArenaVfx />

      <View style={styles.combatUiHost} pointerEvents="box-none">
        <CombatArenaCombatUiHost />
      </View>

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
    left: 0,
    top: 0,
    bottom: 0,
    width: OPERATIVE_ARENA_SPRITE_WIDTH + 24,
    zIndex: WARDEN_ARENA_PLANE.operative,
    elevation: WARDEN_ARENA_PLANE.operative,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingLeft: OPERATIVE_ARENA_LEFT_INSET,
    paddingTop: OPERATIVE_ARENA_TOP_INSET,
    paddingBottom: 0,
  },
  /** Above enemy art + Brand plane so the lunge is not painted over. */
  operativeZoneApproach: {
    zIndex: WARDEN_ARENA_PLANE.wardenPlayer,
    elevation: WARDEN_ARENA_PLANE.wardenPlayer,
  },
  operativeSpriteSlot: {
    width: OPERATIVE_ARENA_SPRITE_WIDTH,
    flexShrink: 0,
    flex: 1,
    minHeight: 100,
    maxHeight: '92%',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    overflow: 'visible',
    position: 'relative',
  },
  enemyGridHost: {
    ...StyleSheet.absoluteFill,
    overflow: 'visible',
  },
  enemyGridHostSelectable: {
    zIndex: WARDEN_ARENA_PLANE.operative + 1,
    elevation: WARDEN_ARENA_PLANE.operative + 1,
  },
  enemyGridHostUnderWarden: {
    zIndex: WARDEN_ARENA_PLANE.enemyGrid,
    elevation: WARDEN_ARENA_PLANE.enemyGrid,
  },
  /**
   * Combat-local UI plane — damage / response / enemy chrome above moving player,
   * below global HUD / modal overlays.
   */
  combatUiHost: {
    ...StyleSheet.absoluteFill,
    zIndex: WARDEN_ARENA_PLANE.responseText,
    elevation: WARDEN_ARENA_PLANE.responseText,
  },
  overlayHost: {
    ...StyleSheet.absoluteFill,
    zIndex: WARDEN_ARENA_PLANE.globalHud,
    elevation: WARDEN_ARENA_PLANE.globalHud,
  },
  spriteFill: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
});
