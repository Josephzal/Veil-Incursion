import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import type { ImageSourcePropType } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { ENEMY_HITBOX_DEBUG, resolveEnemyHitbox } from './combatEnemyBarLayout';
import CombatEnemyAnchorMotion from './CombatEnemyAnchorMotion';
import CombatEnemyCritImpact from './CombatEnemyCritImpact';
import CombatEnemyClassImpact from './CombatEnemyClassImpact';
import CombatEnemyCritLabel from './CombatEnemyCritLabel';
import CombatEnemyEvadeLabel from './CombatEnemyEvadeLabel';
import CombatFloatingStatusText from './CombatFloatingStatusText';
import CombatWardenCalloutStack from './CombatWardenCalloutStack';
import CombatEnemyDissolveEffect from './CombatEnemyDissolveEffect';
import CombatEnemyHitEffect from './CombatEnemyHitEffect';
import CombatEnemyBloodBurst from './CombatEnemyBloodBurst';
import CombatEnemyEvadeEffect from './CombatEnemyEvadeEffect';
import WardenStrikeEnemyContactHost from './WardenStrikeEnemyContactHost';
import AbyssalVerdictTargetFx from './AbyssalVerdictTargetFx';
import CombatArenaUnitUiPortal from './CombatArenaUnitUiPortal';
import CombatEnemyPortraitSkia from './CombatEnemyPortraitSkia';
import CombatSilhouetteShatterEffect from './CombatSilhouetteShatterEffect';
import CombatEnemyOverheadBars from './CombatEnemyOverheadBars';
import EnemyEntity from './EnemyEntity';
import EliteSkullBadge from './EliteSkullBadge';
import TargetingBrackets from './ui/TargetingBrackets';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { resolveArenaIntentGlyph } from '../../data/combatArenaTelegraphEngine';
import {
  isWardenStrikePresentationActive,
  subscribeWardenStrikePresentation,
  WARDEN_STRIKE_VFX_LAYER_TOGGLES,
} from '../../data/wardenStrikePresentation';
import { subscribeAbyssalVerdictPresentation } from '../../data/abyssalVerdictPresentation';

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
  /** True while an ability is staged and waiting on hostile picks. */
  abilityArmed?: boolean;
  accentColor: string;
  mutedColor: string;
  variant?: 'arena' | 'compact';
  /** Slot depth scale — crit label counter-scales for consistent readout size. */
  layoutUnitScale?: number;
  /** Parent handles dissolve VFX (arena slotted units). */
  skipDissolveEffect?: boolean;
  /** Arena backline dash target offset toward operative sprite. */
  meleeDashDelta?: { x: number; y: number };
  /** Class-specific blood shard burst on damage flash. */
  bloodBurstVariant?: 'aegis' | 'hex' | 'envoy' | null;
  /** Blood mist size multiplier (Black Door / Unmaker = 1.5). */
  bloodMistScale?: number;
  onPress?: () => void;
  onDissolveComplete?: () => void;
}

export default function CombatEnemyUnit({
  unit,
  targetingActive,
  abilityArmed = false,
  variant = 'arena',
  layoutUnitScale = 1,
  skipDissolveEffect = false,
  meleeDashDelta,
  bloodBurstVariant = null,
  bloodMistScale = 1,
  onPress,
  onDissolveComplete,
}: CombatEnemyUnitProps): React.JSX.Element | null {
  const [portraitFrozen, setPortraitFrozen] = useState(false);
  const [wardenCrossBelowPlayer, setWardenCrossBelowPlayer] = useState(false);
  const [abyssalUnitOpacity, setAbyssalUnitOpacity] = useState(1);
  const [abyssalMotionFrozen, setAbyssalMotionFrozen] = useState(false);
  const handleHitStopChange = useCallback((frozen: boolean) => {
    setPortraitFrozen(frozen);
  }, []);

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    if (event.phase === 'done') {
      setWardenCrossBelowPlayer(false);
      return;
    }
    // All enemy artwork (including the selected target) tucks under the moving player.
    // Brand / portrait must not print onto the Aegis. HP / floats lift via arena UI plane.
    setWardenCrossBelowPlayer(
      isWardenStrikePresentationActive()
      && !event.result.replayOnly,
    );
  }), [unit.unitId]);

  useEffect(() => subscribeAbyssalVerdictPresentation((event) => {
    if (event.phase === 'idle' || event.phase === 'done') {
      setAbyssalUnitOpacity(1);
      setAbyssalMotionFrozen(false);
      return;
    }
    // Freeze idle bob / turn steps for the whole cinematic — enemy stays planted.
    setAbyssalMotionFrozen(true);
    const isPrimary = event.result.targetId === unit.unitId
      || event.result.affectedTargetIds.includes(unit.unitId)
      || event.result.evadedTargetIds.includes(unit.unitId);
    setAbyssalUnitOpacity(isPrimary ? 1 : event.nonTargetEnemyOpacity);
  }), [unit.unitId]);

  const isArena = variant === 'arena';
  const isAlpha = unit.isAlpha === true;
  const isBacklineSlot = unit.slot?.startsWith('BL') === true;
  const hitboxStyle = isArena
    ? resolveEnemyHitbox(unit.slot, layoutUnitScale, isAlpha)
    : null;
  const dissolving = (unit.dissolveSeq ?? 0) > 0 && !unit.dissolveHidden;
  const portraitGlow = unit.portraitGlow ?? (unit.isSelected ? 'player-selected' : 'none');
  const critLabelScale = layoutUnitScale > 0 ? 1 / layoutUnitScale : 1;

  if (unit.dissolveHidden) return null;

  const breachTarget = unit.isFractureBreachTarget === true;
  const showAbilityReticle = abilityArmed
    && unit.isTargetable
    && !unit.isBlocked
    && !breachTarget;
  const arenaGlyph = isArena
    ? resolveArenaIntentGlyph({
        intent: unit.intent,
        turnsRemaining: unit.intentTurnsRemaining ?? 0,
        jammed: unit.intentLabel === 'STATIC // JAMMED',
      })
    : null;

  const unitBody = (
    <View
      style={[
        styles.enemyContainer,
        isAlpha && styles.alphaGlow,
        breachTarget && styles.breachTargetRing,
        styles.imageShell,
        isArena ? styles.imageShellArena : styles.imageShellCompact,
        {
          opacity: Math.min(
            abyssalUnitOpacity,
            breachTarget
              ? 1
              : unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
          ),
        },
      ]}
      pointerEvents={dissolving ? 'none' : 'box-none'}
    >
      {breachTarget ? (
        <Text style={styles.breachCallout} numberOfLines={1}>
          [ TAP TO BREACH ]
        </Text>
      ) : null}
      {showAbilityReticle ? (
        <View
          style={[
            styles.targetCalloutPlate,
            unit.isAoeAffected ? styles.targetCalloutPlateAoe : null,
            wardenCrossBelowPlayer ? styles.localDecalTucked : null,
          ]}
        >
          <Text
            style={[
              styles.targetCallout,
              unit.isAoeAffected ? styles.targetCalloutAoe : null,
            ]}
            numberOfLines={1}
          >
            {unit.isAoeAffected ? '[ AOE ]' : unit.isSlumped ? '[ EXECUTES ]' : '[ TARGET ]'}
          </Text>
        </View>
      ) : null}
      {isAlpha ? <EliteSkullBadge style={styles.eliteBadge} /> : null}

      <EnemyEntity
        showVitals={isArena}
        vitals={<CombatEnemyOverheadBars unit={unit} intentGlyph={arenaGlyph} />}
        sprite={(
          <View style={styles.spriteRoot} pointerEvents="box-none">
            <CombatEnemyAnchorMotion
              turnPhase={unit.turnPhase ?? null}
              isBacklineDashing={unit.isBacklineDashing}
              hitFlashSeq={unit.hitFlashSeq}
              backlineMeleeDashSeq={unit.backlineMeleeDashSeq}
              meleeDashDelta={meleeDashDelta}
              frozen={portraitFrozen || dissolving || abyssalMotionFrozen}
              layoutUnitScale={layoutUnitScale}
            >
              <View
                style={[
                  styles.overlayLayer,
                  { transform: [{ scale: isAlpha ? 0.86 : 0.75 }] },
                  wardenCrossBelowPlayer ? styles.localDecalTucked : null,
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
                    <CombatEnemyEvadeEffect
                      evadeImpactSeq={unit.evadeImpactSeq}
                      portraitSource={unit.portraitSource}
                    >
                      <CombatEnemyHitEffect
                        hitFlashSeq={unit.hitFlashSeq}
                        unitId={unit.unitId}
                        portraitSource={unit.portraitSource}
                        attackPortraitSource={unit.attackPortraitSource}
                      >
                        <CombatSilhouetteShatterEffect
                          shatterSeq={unit.fractureShatterSeq}
                          portraitSource={unit.portraitSource}
                        >
                          <View style={styles.portraitDefenseStack}>
                            <CombatEnemyPortraitSkia
                              source={unit.portraitSource}
                              attackSource={unit.attackPortraitSource}
                              turnPhase={unit.turnPhase ?? null}
                              backlineDashSeq={unit.backlineMeleeDashSeq ?? 0}
                              isBacklineDashing={unit.isBacklineDashing === true}
                              glow={portraitGlow}
                              intentShimmer={unit.intentShimmer ?? null}
                              isEnraged={unit.isEnraged === true}
                              isSlumped={unit.isSlumped === true}
                            />
                            <TargetingBrackets
                              active={showAbilityReticle || unit.isSlumped === true}
                              color={
                                unit.isSlumped
                                  ? OTT.terminalGreenMuted
                                  : unit.isAoeAffected
                                    ? OTT.warningAmber
                                    : OTT.cyanSelect
                              }
                            />
                            <CombatEnemyBloodBurst
                              hitFlashSeq={unit.hitFlashSeq}
                              enabled={bloodBurstVariant != null}
                              variant={bloodBurstVariant ?? 'aegis'}
                              burstRepeats={unit.bloodBurstRepeats ?? 1}
                              mistScale={Math.max(unit.bloodMistScale ?? 1, bloodMistScale)}
                            />
                            <AbyssalVerdictTargetFx unitId={unit.unitId} />
                          </View>
                        </CombatSilhouetteShatterEffect>
                      </CombatEnemyHitEffect>
                    </CombatEnemyEvadeEffect>
                  </CombatEnemyClassImpact>
                </CombatEnemyCritImpact>
              </View>
            </CombatEnemyAnchorMotion>

            {/* Stationary: contact anchor, callouts, hitbox — only portrait recoils. */}
            <WardenStrikeEnemyContactHost unitId={unit.unitId} />

            {WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode
              && isWardenStrikePresentationActive() ? (
              <>
                <View style={styles.recoilRootMark} pointerEvents="none" />
                <View style={styles.recoilUiAnchorMark} pointerEvents="none" />
              </>
            ) : null}

            <View
              style={[
                styles.statusAnchor,
                { transform: [{ scale: critLabelScale }] },
              ]}
              pointerEvents="none"
            >
              <CombatArenaUnitUiPortal
                unitId={unit.unitId}
                damageSeq={unit.damageFloatSeq}
                damageLabel={unit.damageFloatLabel}
                statusSeq={unit.statusFloatSeq}
                statusLabel={unit.statusFloatLabel}
                statusTone={unit.statusFloatTone}
                critImpactSeq={unit.critImpactSeq}
                critImpactChannel={unit.critImpactChannel}
                evadeImpactSeq={unit.evadeImpactSeq}
              >
                <CombatEnemyCritLabel
                  critImpactSeq={unit.critImpactSeq}
                  channel={unit.critImpactChannel}
                />
                <CombatEnemyEvadeLabel evadeImpactSeq={unit.evadeImpactSeq} />
                <CombatWardenCalloutStack
                  damageSeq={unit.damageFloatSeq}
                  damageLabel={unit.damageFloatLabel}
                  statusSeq={unit.statusFloatSeq}
                  statusLabel={unit.statusFloatLabel}
                  statusTone={unit.statusFloatTone}
                  durationMs={900}
                />
                <CombatFloatingStatusText
                  triggerSeq={unit.immuneFloatSeq}
                  label={unit.immuneFloatLabel}
                  tone="neutral"
                />
              </CombatArenaUnitUiPortal>
            </View>

            {onPress && !dissolving ? (
              <HapticPressable
                sfx={false}
                onPress={onPress}
                style={[
                  styles.hitboxArena,
                  isArena && hitboxStyle ? hitboxStyle : (isBacklineSlot ? styles.hitbox : styles.hitboxFrontline),
                  ENEMY_HITBOX_DEBUG ? styles.hitboxDebug : null,
                ]}
                pointerEvents="auto"
              />
            ) : null}
          </View>
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
  spriteRoot: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
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
    top: -58,
    left: 0,
    right: 0,
    zIndex: 22,
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#67e8f9',
  },
  targetCalloutPlate: {
    position: 'absolute',
    top: -62,
    left: '8%',
    right: '8%',
    zIndex: 22,
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(98, 220, 229, 0.55)',
    backgroundColor: 'rgba(5, 10, 12, 0.72)',
    shadowColor: OTT.cyanSelect,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  localDecalTucked: {
    zIndex: 1,
    elevation: 1,
  },
  targetCalloutPlateAoe: {
    borderColor: 'rgba(224, 180, 90, 0.65)',
    shadowColor: OTT.warningAmber,
  },
  targetCallout: {
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: OTT.cyanSelect,
  },
  targetCalloutAoe: {
    color: OTT.warningAmber,
  },
  eliteBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 20,
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
    overflow: 'visible',
  },
  portraitDefenseStack: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  statusAnchor: {
    position: 'absolute',
    top: '38%',
    width: '100%',
    alignItems: 'center',
    zIndex: 18,
  },
  recoilRootMark: {
    position: 'absolute',
    left: '50%',
    top: '55%',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderWidth: 1.5,
    borderColor: '#22d3ee',
    backgroundColor: 'rgba(34, 211, 238, 0.25)',
    zIndex: 40,
  },
  recoilUiAnchorMark: {
    position: 'absolute',
    left: '50%',
    top: '20%',
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    zIndex: 40,
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
  hitboxArena: {
    position: 'absolute',
    zIndex: 10,
  },
  hitboxDebug: {
    backgroundColor: HITBOX_DEBUG_FILL,
  },
});
