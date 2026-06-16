import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { laneForSlot } from '../../types/combatGrid';
import {
  ARENA_ENEMY_SPRITE_HEIGHT_SHARE,
  ARENA_SPRITE_FRAME_WIDTH,
  BACKLINE_HITBOX,
  critLabelAnchorAboveHitbox,
  ENEMY_HITBOX_DEBUG,
  ENEMY_SPRITE_FRAME_HEIGHT,
  FRONTLINE_HITBOX,
  SOLO_UNIT_SCALE,
} from './combatEnemyBarLayout';
import CombatEnemyAnchorMotion from './CombatEnemyAnchorMotion';
import CombatEnemyCritImpact from './CombatEnemyCritImpact';
import CombatEnemyCritLabel from './CombatEnemyCritLabel';
import CombatEnemyEvadeLabel from './CombatEnemyEvadeLabel';
import CombatFloatingStatusText from './CombatFloatingStatusText';
import CombatEnemyDissolveEffect from './CombatEnemyDissolveEffect';
import CombatEnemyHitEffect from './CombatEnemyHitEffect';
import CombatEnemyPortraitSkia from './CombatEnemyPortraitSkia';
import CombatSilhouetteShatterEffect from './CombatSilhouetteShatterEffect';

const HITBOX_DEBUG_FILL = 'rgba(255, 0, 0, 0)';

export type CombatGridUnitView = CombatGridUnitSnapshot & {
  portraitSource: ImageSourcePropType;
  attackPortraitSource: ImageSourcePropType;
};

interface CombatEnemyUnitProps {
  unit: CombatGridUnitView;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  /** Arena grid: cap sprite height to match player footprint. */
  constrainSpriteHeight?: boolean;
  /** Slot depth scale — crit label counter-scales to match solo-enemy readout size. */
  layoutUnitScale?: number;
  /** Parent handles dissolve VFX (arena slotted units). */
  skipDissolveEffect?: boolean;
  /** Arena backline dash target offset toward operative sprite. */
  meleeDashDelta?: { x: number; y: number };
  onPress?: () => void;
  onDissolveComplete?: () => void;
}

export default function CombatEnemyUnit({
  unit,
  targetingActive,
  constrainSpriteHeight = false,
  layoutUnitScale = 1,
  skipDissolveEffect = false,
  meleeDashDelta,
  onPress,
  onDissolveComplete,
}: CombatEnemyUnitProps): React.JSX.Element | null {
  const [portraitFrozen, setPortraitFrozen] = useState(false);
  const handleHitStopChange = useCallback((frozen: boolean) => {
    setPortraitFrozen(frozen);
  }, []);

  const spriteHeightShare =
    `${Math.round(ARENA_ENEMY_SPRITE_HEIGHT_SHARE * 100)}%` as `${number}%`;
  const fractured = unit.isFractured;
  const dissolving = (unit.dissolveSeq ?? 0) > 0 && !unit.dissolveHidden;
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');
  const isBackline = laneForSlot(unit.slot) === 'BACKLINE';
  const hitboxLayout = isBackline ? BACKLINE_HITBOX : FRONTLINE_HITBOX;
  const critLabelAnchor = critLabelAnchorAboveHitbox(hitboxLayout);
  const critLabelScale = layoutUnitScale > 0 ? SOLO_UNIT_SCALE / layoutUnitScale : 1;

  if (unit.dissolveHidden) return null;

  const unitBody = (
    <View
      style={[
        styles.imageShell,
        constrainSpriteHeight ? styles.imageShellArena : styles.imageShellCompact,
        constrainSpriteHeight ? { height: spriteHeightShare, maxHeight: spriteHeightShare } : null,
        {
          opacity: unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
        },
      ]}
      pointerEvents={dissolving ? 'none' : 'box-none'}
    >
      <CombatEnemyAnchorMotion
        turnPhase={unit.turnPhase ?? null}
        isBacklineDashing={unit.isBacklineDashing}
        hitFlashSeq={unit.hitFlashSeq}
        backlineMeleeDashSeq={unit.backlineMeleeDashSeq}
        meleeDashDelta={meleeDashDelta}
        frozen={portraitFrozen || dissolving}
      >
        <View style={styles.spriteFrame} pointerEvents="none">
          <CombatEnemyCritImpact
            critImpactSeq={unit.critImpactSeq}
            channel={unit.critImpactChannel}
            onHitStopChange={handleHitStopChange}
          >
            <CombatEnemyHitEffect
              hitFlashSeq={unit.hitFlashSeq}
              portraitSource={unit.portraitSource}
            >
              <CombatSilhouetteShatterEffect trigger={fractured} portraitSource={unit.portraitSource}>
                <CombatEnemyPortraitSkia
                  source={unit.portraitSource}
                  attackSource={unit.attackPortraitSource}
                  turnPhase={unit.turnPhase ?? null}
                  backlineDashSeq={unit.backlineMeleeDashSeq ?? 0}
                  isBacklineDashing={unit.isBacklineDashing === true}
                  glow={portraitGlow}
                  intentShimmer={unit.intentShimmer ?? null}
                  isEnraged={unit.isEnraged === true}
                />
              </CombatSilhouetteShatterEffect>
            </CombatEnemyHitEffect>
          </CombatEnemyCritImpact>
        </View>

        <View
          style={[
            styles.critLabelAnchor,
            critLabelAnchor,
            { transform: [{ scale: critLabelScale }] },
          ]}
          pointerEvents="none"
        >
          <CombatEnemyCritLabel
            critImpactSeq={unit.critImpactSeq}
            channel={unit.critImpactChannel}
          />
          <CombatEnemyEvadeLabel evadeImpactSeq={unit.evadeImpactSeq} />
          <CombatFloatingStatusText
            triggerSeq={unit.statusFloatSeq}
            label={unit.statusFloatLabel}
            tone={unit.statusFloatTone}
          />
          <CombatFloatingStatusText
            triggerSeq={unit.immuneFloatSeq}
            label={unit.immuneFloatLabel}
            tone="neutral"
          />
        </View>

        {onPress && !dissolving ? (
          <Pressable
            onPress={onPress}
            style={[
              styles.hitbox,
              {
                width: hitboxLayout.width,
                height: hitboxLayout.height,
              },
              'bottom' in hitboxLayout
                ? { bottom: hitboxLayout.bottom }
                : { top: hitboxLayout.top },
              ENEMY_HITBOX_DEBUG ? styles.hitboxDebug : null,
            ]}
            pointerEvents="auto"
          />
        ) : null}
      </CombatEnemyAnchorMotion>
    </View>
  );

  if (skipDissolveEffect) return unitBody;

  return (
    <CombatEnemyDissolveEffect
      dissolveSeq={unit.dissolveSeq}
      active={dissolving}
      portraitSource={unit.portraitSource}
      onComplete={onDissolveComplete}
    >
      {unitBody}
    </CombatEnemyDissolveEffect>
  );
}

const styles = StyleSheet.create({
  imageShell: {
    width: ARENA_SPRITE_FRAME_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  imageShellArena: {
    minHeight: 0,
  },
  imageShellCompact: {
    minHeight: 88,
    flexGrow: 1,
    flexShrink: 1,
  },
  spriteFrame: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ENEMY_SPRITE_FRAME_HEIGHT,
    overflow: 'hidden',
    zIndex: 1,
  },
  critLabelAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  hitbox: {
    position: 'absolute',
    zIndex: 10,
    alignSelf: 'center',
  },
  hitboxDebug: {
    backgroundColor: HITBOX_DEBUG_FILL,
  },
});
