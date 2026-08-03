import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ApparitionViewport, type ApparitionViewportRef } from './ApparitionViewport';
import CombatOrbitalUltimate from './CombatOrbitalUltimate';
import CombatEviscerateCinematic from './CombatEviscerateCinematic';
import AbyssalVerdictCinematic from './AbyssalVerdictCinematic';
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
import {
  getAbyssalVerdictCameraSegment,
  getAbyssalVerdictTimeline,
  subscribeAbyssalVerdictPresentation,
  type AbyssalVerdictCameraSegment,
} from '../../data/abyssalVerdictPresentation';

/**
 * Shared arena scale for every class/weapon.
 * Figure height is normalized to envoy-echo-lantern idle in combatPlayerPortrait.
 */
function operativeArenaScale(isCombatDesktop: boolean): number {
  return isCombatDesktop ? 1.6 : 0.92;
}

/** Smooth ease — slow start/end so pose swaps don't read as camera hits. */
const ZOOM_IN_EASING = Easing.bezier(0.33, 0.0, 0.2, 1);
const ZOOM_OUT_EASING = Easing.bezier(0.4, 0.0, 0.2, 1);

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
  const meleeWide = operativeClass === 'AEGIS';
  const spriteSlotWidth = OPERATIVE_ARENA_SPRITE_WIDTH * (meleeWide ? 1.45 : 1);
  const operativeLeft = isCombatDesktop ? OTT_STAGE.playerLeftPercent : '6%';
  const { ui } = useCombatEnemyChrome();
  const [wardenApproachLift, setWardenApproachLift] = useState(false);
  const [abyssalHideOperative, setAbyssalHideOperative] = useState(false);
  const [abyssalHudClear, setAbyssalHudClear] = useState(false);
  /** Player-only zoom on the UI thread — avoids JS-timer jitter on web. */
  const playerScale = useSharedValue(1);
  const pivotX = useSharedValue(0);
  const pivotY = useSharedValue(0);
  const cameraSegRef = useRef<AbyssalVerdictCameraSegment>('idle');

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    setWardenApproachLift(event.phase !== 'done' && event.phase !== 'idle');
  }), []);

  useEffect(() => subscribeAbyssalVerdictPresentation((event) => {
    const inactive = event.phase === 'done' || event.phase === 'idle';
    setAbyssalHideOperative(!inactive);
    setAbyssalHudClear(!inactive && event.hudOpacity < 0.15);

    const nextSeg = getAbyssalVerdictCameraSegment(event.phase);
    // Keep one continuous ease per segment — phase stamps must not restart mid-ramp.
    if (nextSeg === cameraSegRef.current) {
      return;
    }
    // zoomOut already settles to identity; idle/done must not re-kick.
    if (nextSeg === 'idle' && cameraSegRef.current === 'zoomOut') {
      cameraSegRef.current = 'idle';
      return;
    }
    if (nextSeg === 'idle' && cameraSegRef.current === 'idle') {
      return;
    }
    cameraSegRef.current = nextSeg;

    const tl = getAbyssalVerdictTimeline(event.reducedMotion);
    const peak = event.worldCamera.scale;
    if (nextSeg === 'zoomIn') {
      playerScale.value = withTiming(peak, {
        duration: Math.max(240, tl.worldZoomInMs),
        easing: ZOOM_IN_EASING,
      });
      return;
    }
    if (nextSeg === 'zoomOut') {
      // Single continuous peak → 1. Starts soft so the release pose swap isn't a camera hit.
      playerScale.value = withTiming(1, {
        duration: Math.max(320, tl.worldZoomOutMs),
        easing: ZOOM_OUT_EASING,
      });
      return;
    }
    playerScale.value = withTiming(1, {
      duration: 280,
      easing: ZOOM_OUT_EASING,
    });
  }), [playerScale]);

  const playerCamStyle = useAnimatedStyle(() => {
    // Explicit pivot (Aegis center) — pure zoom, no XY drift from default center-origin scale.
    const s = playerScale.value;
    const px = pivotX.value;
    const py = pivotY.value;
    return {
      transform: [
        { translateX: px },
        { translateY: py },
        { scale: s },
        { translateX: -px },
        { translateY: -py },
      ],
    };
  });

  const eviscerateTargetPortrait = useMemo(() => {
    if (!ui.eviscerateTargetUnitId) return null;
    return gridUnits.find((unit) => unit.unitId === ui.eviscerateTargetUnitId)?.portraitSource ?? null;
  }, [gridUnits, ui.eviscerateTargetUnitId]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Static battlefield — enemies / chrome / VFX never scale with the player zoom. */}
      <View style={styles.worldPlane} pointerEvents="box-none">
        <View style={styles.hiddenApparition} pointerEvents="none">
          <ApparitionViewport
            key={portraitKey}
            ref={apparitionRef}
            imageSource={portraitSource}
            style={styles.spriteFill}
            onEradicationComplete={onEradicationComplete}
          />
        </View>

        {abyssalHudClear ? null : <CombatOrbitalUltimate />}

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
        <CombatRuinArenaVfx />

        <View
          style={[styles.combatUiHost, abyssalHudClear ? { opacity: 0 } : null]}
          pointerEvents={abyssalHudClear ? 'none' : 'box-none'}
        >
          <CombatArenaCombatUiHost />
        </View>

        {/* Player camera host — zoom in/out Aegis only. */}
        <Animated.View
          style={[styles.playerCameraHost, playerCamStyle]}
          pointerEvents="box-none"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            // Character center in the arena — keeps the release pose planted while scaling.
            pivotX.value = width * 0.18;
            pivotY.value = height * 0.55;
          }}
        >
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
            <View
              style={[
                styles.operativeSpriteSlot,
                { width: spriteSlotWidth },
                operativeScale !== 1 ? {
                  transform: [{ scale: operativeScale }],
                  ...(Platform.OS === 'web' ? { transformOrigin: 'bottom center' } : null),
                } : null,
                abyssalHideOperative ? { opacity: 0 } : null,
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

          <AbyssalVerdictCinematic layer="poses" />
        </Animated.View>
      </View>

      {/* Screen-locked stealth vignette — outside the player scale transform. */}
      <AbyssalVerdictCinematic layer="screen" />

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
  worldPlane: {
    ...StyleSheet.absoluteFill,
  },
  playerCameraHost: {
    ...StyleSheet.absoluteFill,
    zIndex: WARDEN_ARENA_PLANE.operative + 2,
    elevation: WARDEN_ARENA_PLANE.operative + 2,
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
