import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { resolveArenaDefenseState } from '../../data/combatArenaDefenseTelegraphEngine';
import type { ArenaIntentGlyph } from '../../data/combatArenaTelegraphEngine';
import CombatArenaDefensePips from './CombatArenaDefensePips';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { subscribeAbyssalVerdictPresentation } from '../../data/abyssalVerdictPresentation';
import { getCombatPresentationSettings } from '../../data/weaponCombatPresentation/presentationSettings';
import {
  ENEMY_STATUS_EFFECTS,
  type EnemyStatusEffectKey,
} from '../../utils/enemyStatusEffects';
import {
  formatNameplateHp,
  formatNameplateIntentLine,
  resolveEnemyNameplateDensity,
  resolveNameplateRegions,
  selectNameplateIndicators,
} from '../../data/combatEnemyNameplatePresentation';
import { resolveSlumpedPresentation } from '../../data/combatSlumpedPresentation';

/** Trailing health segment catch-up, inside the 250–400ms readability band. */
const HP_TRAIL_MS = 320;

const EMPTY_STATUSES: readonly EnemyStatusEffectKey[] = [];

interface CombatEnemyOverheadBarsProps {
  unit: Pick<
    CombatGridUnitSnapshot,
    | 'designation'
    | 'currentHp'
    | 'maxHp'
    | 'fractureGauge'
    | 'fractureMax'
    | 'veilRotStacks'
    | 'kineticArmor'
    | 'occultWards'
    | 'isFractured'
    | 'isAlpha'
    | 'isSlumped'
    | 'slumpTurnsRemaining'
    | 'slumpGraceThisPlayerTurn'
    | 'activeStatuses'
    | 'isSelected'
    | 'isFocused'
    | 'isActingEnemy'
  >;
  intentGlyph?: ArenaIntentGlyph | null;
  /** Pointer hover on this unit's reticle — a disclosure input only. */
  reticleHovered?: boolean;
  /** Dried-crimson HP rail while Abyssal Verdict targeting is active. */
  abyssalVerdictTint?: boolean;
}

/**
 * Compact nameplate with fixed semantic regions:
 *   top    — identity + health
 *   middle — thin health rail (with delayed damage trail)
 *   bottom — canonical intent (left) · essential indicators (right)
 *
 * Regions never swap meaning. Disclosure changes text detail only, never the
 * plate's size or position. All values are supplied by canonical authorities.
 */
export default function CombatEnemyOverheadBars({
  unit,
  intentGlyph = null,
  reticleHovered = false,
  abyssalVerdictTint = false,
}: CombatEnemyOverheadBarsProps): React.JSX.Element {
  const [cinematicBarOpacity, setCinematicBarOpacity] = useState(1);
  useEffect(() => subscribeAbyssalVerdictPresentation((event) => {
    setCinematicBarOpacity(event.hpBarOpacity);
  }), []);

  const slumped = unit.isSlumped === true;
  const slumpCopy = resolveSlumpedPresentation(unit);
  const hpRatio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.currentHp / unit.maxHp)) : 1;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const rotStacks = unit.veilRotStacks ?? 0;

  // Delayed trailing segment + brief HP emphasis, driven by resolved HP only.
  const [trailRatio, setTrailRatio] = useState(hpRatio);
  const [hpStruck, setHpStruck] = useState(false);
  const previousRatio = useRef(hpRatio);
  const trailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const previous = previousRatio.current;
    previousRatio.current = hpRatio;
    if (hpRatio >= previous) {
      if (trailTimer.current) clearTimeout(trailTimer.current);
      setTrailRatio(hpRatio);
      setHpStruck(false);
      return;
    }
    if (getCombatPresentationSettings().reducedMotion === true) {
      setTrailRatio(hpRatio);
      return;
    }
    setTrailRatio(previous);
    setHpStruck(true);
    if (trailTimer.current) clearTimeout(trailTimer.current);
    trailTimer.current = setTimeout(() => {
      setTrailRatio(hpRatio);
      setHpStruck(false);
    }, HP_TRAIL_MS);
  }, [hpRatio]);
  useEffect(() => () => {
    if (trailTimer.current) clearTimeout(trailTimer.current);
  }, []);

  const defense = useMemo(
    () =>
      resolveArenaDefenseState({
        kineticArmor: unit.kineticArmor,
        occultWards: unit.occultWards,
        isFractured: unit.isFractured,
      }),
    [unit.kineticArmor, unit.occultWards, unit.isFractured],
  );

  const density = resolveEnemyNameplateDensity({
    isSelected: unit.isSelected,
    isFocused: unit.isFocused,
    reticleHovered,
    isActingEnemy: unit.isActingEnemy,
  });

  // `activeStatuses` already arrives in ENEMY_STATUS_EFFECT_ORDER.
  const statusKeys: readonly EnemyStatusEffectKey[] = unit.activeStatuses ?? EMPTY_STATUSES;
  const indicators = useMemo(
    () => selectNameplateIndicators<EnemyStatusEffectKey>({
      kineticArmor: unit.kineticArmor,
      occultWards: unit.occultWards,
      statuses: statusKeys.map((key) => ({
        key,
        label: ENEMY_STATUS_EFFECTS[key]?.label ?? key,
      })),
    }),
    [unit.kineticArmor, unit.occultWards, statusKeys],
  );
  const visibleStatuses = indicators.visible.filter(
    (indicator): indicator is Extract<typeof indicator, { kind: 'status' }> =>
      indicator.kind === 'status',
  );
  const showDefensePips = indicators.visible.some(
    (indicator) => indicator.kind === 'kineticArmor' || indicator.kind === 'occultWard',
  );

  const regions = resolveNameplateRegions({
    isSlumped: slumped,
    intentLine: formatNameplateIntentLine({
      symbol: intentGlyph?.symbol,
      label: intentGlyph?.label,
      countdownLabel: intentGlyph?.countdownLabel,
      density,
      imminent: intentGlyph?.arenaPriority === 1,
    }),
    slumpedIntentLine: slumpCopy?.executableLabel,
    indicatorCount: indicators.visible.length,
    overflow: indicators.overflow,
  });

  const intentAccent = !intentGlyph
    ? OTT.textMuted
    : intentGlyph.kind === 'CHANNEL' || intentGlyph.kind === 'SUPPORT' || intentGlyph.kind === 'SUMMON'
      ? OTT.fluxViolet
      : intentGlyph.kind === 'GUARD'
        ? OTT.cyanSelect
        : intentGlyph.accentColor;

  const nameColor = slumped
    ? '#C45AAE'
    : unit.isAlpha
      ? '#ff8a8a'
      : OTT.textPrimary;

  const revivalFill = slumped
    ? (unit.slumpGraceThisPlayerTurn
      ? 1
      : Math.max(0, Math.min(1, (unit.slumpTurnsRemaining ?? 0) / 1)))
    : 0;

  return (
    <View style={[styles.root, cinematicBarOpacity < 1 ? { opacity: cinematicBarOpacity } : null]}>
      <View style={[
        styles.plate,
        slumped ? styles.plateSlumped : null,
        abyssalVerdictTint ? styles.plateAbyssal : null,
      ]}>
        {/* Region 1 — identity + health. */}
        <View style={styles.nameRow}>
          <Text style={[
            styles.name,
            { color: abyssalVerdictTint ? '#E4D8C4' : nameColor },
          ]} numberOfLines={1}>
            {unit.designation.toUpperCase()}
          </Text>
          {slumped ? (
            <Text style={styles.slumpBadge} numberOfLines={1}>
              {slumpCopy?.stateLabel ?? 'SLUMPED'}
            </Text>
          ) : (
            <Text
              style={[
                styles.hpNum,
                abyssalVerdictTint ? styles.hpNumAbyssal : null,
                hpStruck ? styles.hpNumStruck : null,
              ]}
              numberOfLines={1}
            >
              {formatNameplateHp({ currentHp: unit.currentHp, maxHp: unit.maxHp, density })}
            </Text>
          )}
        </View>

        {/* Region 2 — thin rail, subordinate to the artwork. */}
        {slumped ? (
          <View style={styles.hpTrack}>
            <View
              style={[styles.revivalFill, { width: `${Math.max(0.12, revivalFill) * 100}%` }]}
            />
          </View>
        ) : (
          <View style={[styles.hpTrack, abyssalVerdictTint ? styles.hpTrackAbyssal : null]}>
            {trailRatio > hpRatio ? (
              <View style={[styles.hpTrail, { width: `${trailRatio * 100}%` }]} />
            ) : null}
            <View style={[
              styles.hpFill,
              abyssalVerdictTint ? styles.hpFillAbyssal : null,
              { width: `${hpRatio * 100}%` },
            ]} />
          </View>
        )}
        {!slumped && fractureRatio > 0.02 ? (
          <View style={styles.fractureTrack}>
            <View
              style={[
                styles.fractureFill,
                { width: `${Math.max(0, Math.min(1, fractureRatio)) * 100}%` },
              ]}
            />
          </View>
        ) : null}

        {/* Region 3 — intent (left) never yields its slot to indicators (right). */}
        <View style={styles.footerRow}>
          <Text
            style={[
              styles.intentLine,
              slumped ? styles.intentLineSlumped : { color: intentAccent },
            ]}
            numberOfLines={1}
          >
            {regions.lowerLeft}
          </Text>
          <View style={styles.indicatorCluster} pointerEvents="none">
            {slumped ? (
              <Text style={styles.revivalShort} numberOfLines={1}>
                {slumpCopy?.revivalShort ?? ''}
              </Text>
            ) : (
              <>
                {showDefensePips ? <CombatArenaDefensePips defense={defense} compact /> : null}
                {visibleStatuses.map((indicator) => {
                  const def = ENEMY_STATUS_EFFECTS[indicator.statusKey];
                  if (!def) return null;
                  return (
                    <Image
                      key={indicator.statusKey}
                      source={def.icon}
                      style={styles.statusIcon}
                      resizeMode="contain"
                      accessibilityLabel={indicator.label}
                    />
                  );
                })}
                {indicators.overflow > 0 ? (
                  <Text
                    style={styles.overflowBadge}
                    numberOfLines={1}
                    accessibilityLabel={`${indicators.overflow} more effects — see Enemy Intel`}
                  >
                    {`+${indicators.overflow}`}
                  </Text>
                ) : null}
                {rotStacks > 0 && indicators.overflow === 0 ? (
                  <Text style={styles.rotBadge} numberOfLines={1}>
                    {`ROT ${rotStacks}`}
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'stretch',
  },
  plate: {
    backgroundColor: 'rgba(5, 8, 10, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderMuted,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 2,
  },
  plateSlumped: {
    borderColor: 'rgba(196, 90, 174, 0.55)',
    backgroundColor: 'rgba(12, 4, 14, 0.72)',
  },
  plateAbyssal: {
    borderColor: 'rgba(160, 40, 55, 0.7)',
    backgroundColor: 'rgba(8, 5, 6, 0.78)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 4,
  },
  name: {
    flex: 1,
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  hpNum: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.label,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: OTT.soulRed,
  },
  hpNumAbyssal: {
    color: '#E4D8C4',
  },
  hpNumStruck: {
    color: '#FFD9DC',
  },
  slumpBadge: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#C45AAE',
  },
  hpTrack: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  hpTrackAbyssal: {
    backgroundColor: 'rgba(20, 6, 8, 0.7)',
  },
  hpTrail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 168, 176, 0.55)',
  },
  hpFill: {
    height: '100%',
    backgroundColor: OTT.soulRed,
  },
  hpFillAbyssal: {
    backgroundColor: '#8B1E2D',
  },
  revivalFill: {
    height: '100%',
    backgroundColor: '#C45AAE',
  },
  fractureTrack: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  fractureFill: {
    height: '100%',
    backgroundColor: OTT.warningAmber,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    minHeight: 10,
  },
  intentLine: {
    flexShrink: 1,
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  intentLineSlumped: {
    color: OTT.terminalGreenMuted,
  },
  indicatorCluster: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusIcon: {
    width: 9,
    height: 9,
  },
  overflowBadge: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: OTT.textSecondary,
  },
  revivalShort: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: 'rgba(196, 90, 174, 0.85)',
  },
  rotBadge: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: OTT.terminalGreenMuted,
  },
});
