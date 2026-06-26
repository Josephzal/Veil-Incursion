import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { ENEMY_HITBOX_DEBUG } from './combatEnemyBarLayout';
import CombatEnemyAnchorMotion from './CombatEnemyAnchorMotion';
import CombatEnemyCritImpact from './CombatEnemyCritImpact';
import CombatEnemyClassImpact from './CombatEnemyClassImpact';
import CombatEnemyCritLabel from './CombatEnemyCritLabel';
import CombatEnemyEvadeLabel from './CombatEnemyEvadeLabel';
import CombatFloatingStatusText from './CombatFloatingStatusText';
import CombatEnemyDissolveEffect from './CombatEnemyDissolveEffect';
import CombatEnemyHitEffect from './CombatEnemyHitEffect';
import CombatEnemyPortraitSkia from './CombatEnemyPortraitSkia';
import CombatSilhouetteShatterEffect from './CombatSilhouetteShatterEffect';
import CombatEnemyOverheadBars from './CombatEnemyOverheadBars';
import EnemyEntity from './EnemyEntity';
import EliteSkullBadge from './EliteSkullBadge';

const MONO = 'monospace';
const ALPHA_CRIMSON = '#ff4444';

const HITBOX_DEBUG_FILL = 'rgba(255, 0, 0, 0.35)';

export type CombatGridUnitView = CombatGridUnitSnapshot & {
  portraitSource: ImageSourcePropType;
  attackPortraitSource: ImageSourcePropType;
};

interface CombatEnemyUnitProps {
  unit: CombatGridUnitView;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  variant?: 'arena' | 'compact';
  /** Slot depth scale — crit label counter-scales for consistent readout size. */
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
  variant = 'arena',
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

  const isArena = variant === 'arena';
  const isAlpha = unit.isAlpha === true;
  const isBacklineSlot = unit.slot?.startsWith('BL') === true;
  const fractured = unit.isFractured;
  const dissolving = (unit.dissolveSeq ?? 0) > 0 && !unit.dissolveHidden;
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');
  const critLabelScale = layoutUnitScale > 0 ? 1 / layoutUnitScale : 1;

  if (unit.dissolveHidden) return null;

  const breachTarget = unit.isFractureBreachTarget === true;

  const unitBody = (
    <View
      style={[
        styles.enemyContainer,
        isAlpha && styles.alphaGlow,
        breachTarget && styles.breachTargetRing,
        styles.imageShell,
        isArena ? styles.imageShellArena : styles.imageShellCompact,
        {
          opacity: breachTarget
            ? 1
            : unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
        },
      ]}
      pointerEvents={dissolving ? 'none' : 'box-none'}
    >
      {breachTarget ? (
        <Text style={styles.breachCallout} numberOfLines={1}>
          [ TAP TO BREACH ]
        </Text>
      ) : null}
      {isAlpha ? <EliteSkullBadge style={styles.eliteBadge} /> : null}

      {isAlpha ? (
        <Text style={styles.alphaNameplate} numberOfLines={1} ellipsizeMode="tail">
          {unit.designation.toUpperCase()}
        </Text>
      ) : null}

      <EnemyEntity
        showVitals={isArena}
        vitals={<CombatEnemyOverheadBars unit={unit} />}
        sprite={(
          <CombatEnemyAnchorMotion
            turnPhase={unit.turnPhase ?? null}
            isBacklineDashing={unit.isBacklineDashing}
            hitFlashSeq={unit.hitFlashSeq}
            backlineMeleeDashSeq={unit.backlineMeleeDashSeq}
            meleeDashDelta={meleeDashDelta}
            frozen={portraitFrozen || dissolving}
          >
            <View
              style={[
                styles.overlayLayer,
                { transform: [{ scale: isAlpha ? 0.86 : 0.75 }] },
              ]}
              pointerEvents="none"
            >
              <CombatEnemyCritImpact
                critImpactSeq={unit.critImpactSeq}
                channel={unit.critImpactChannel}
                onHitStopChange={handleHitStopChange}
              >
                <CombatEnemyClassImpact
                  impactFxSeq={unit.classImpactFxSeq}
                  impactFxKind={unit.classImpactFxKind}
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
                </CombatEnemyClassImpact>
              </CombatEnemyCritImpact>
            </View>

            <View
              style={[
                styles.statusAnchor,
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
              <HapticPressable
                onPress={onPress}
                style={[
                  isBacklineSlot ? styles.hitbox : styles.hitboxFrontline,
                  ENEMY_HITBOX_DEBUG ? styles.hitboxDebug : null,
                ]}
                pointerEvents="auto"
              />
            ) : null}
          </CombatEnemyAnchorMotion>
        )}
      />
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
  enemyContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  alphaGlow: {
    shadowColor: ALPHA_CRIMSON,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  breachTargetRing: {
    borderWidth: 2,
    borderColor: '#22d3ee',
    shadowColor: '#22d3ee',
    shadowOpacity: 0.85,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  breachCallout: {
    position: 'absolute',
    top: -16,
    left: 0,
    right: 0,
    zIndex: 22,
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#67e8f9',
  },
  eliteBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 20,
  },
  alphaNameplate: {
    position: 'absolute',
    top: -14,
    left: 0,
    right: 0,
    zIndex: 18,
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: ALPHA_CRIMSON,
  },
  imageShell: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  imageShellArena: {
    minHeight: 0,
  },
  imageShellCompact: {
    minHeight: 88,
    flexGrow: 1,
    flexShrink: 1,
    width: '92%',
  },
  overlayLayer: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    top: '-10%',
    left: '-10%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  statusAnchor: {
    position: 'absolute',
    top: '38%',
    width: '100%',
    alignItems: 'center',
    zIndex: 12,
  },
  hitbox: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 10,
  },
  hitboxFrontline: {
    position: 'absolute',
    width: '62%',
    height: '72%',
    bottom: 0,
    left: '19%',
    zIndex: 10,
  },
  hitboxDebug: {
    backgroundColor: HITBOX_DEBUG_FILL,
  },
});
