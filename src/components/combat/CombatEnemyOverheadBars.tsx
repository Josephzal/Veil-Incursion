import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { resolveArenaDefenseState } from '../../data/combatArenaDefenseTelegraphEngine';
import type { ArenaIntentGlyph } from '../../data/combatArenaTelegraphEngine';
import CombatArenaDefensePips from './CombatArenaDefensePips';
import CombatArenaIntentGlyph from './CombatArenaIntentGlyph';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { subscribeAbyssalVerdictPresentation } from '../../data/abyssalVerdictPresentation';

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
  >;
  intentGlyph?: ArenaIntentGlyph | null;
  /** Dried-crimson HP rail while Abyssal Verdict targeting is active. */
  abyssalVerdictTint?: boolean;
}

/**
 * Concept nameplate — designation + HP readout above a thin red rail,
 * with intent glyph stacked above the vitals.
 * Slumped thralls replace the HP rail with an execute prompt + revival meter.
 */
export default function CombatEnemyOverheadBars({
  unit,
  intentGlyph = null,
  abyssalVerdictTint = false,
}: CombatEnemyOverheadBarsProps): React.JSX.Element {
  const [cinematicBarOpacity, setCinematicBarOpacity] = useState(1);
  useEffect(() => subscribeAbyssalVerdictPresentation((event) => {
    setCinematicBarOpacity(event.hpBarOpacity);
  }), []);
  const slumped = unit.isSlumped === true;
  const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const rotStacks = unit.veilRotStacks ?? 0;
  const defense = useMemo(
    () =>
      resolveArenaDefenseState({
        kineticArmor: unit.kineticArmor,
        occultWards: unit.occultWards,
        isFractured: unit.isFractured,
      }),
    [unit.kineticArmor, unit.occultWards, unit.isFractured],
  );
  const nameColor = slumped
    ? '#C45AAE'
    : unit.isAlpha
      ? '#ff8a8a'
      : OTT.textPrimary;

  const revivalSegments = slumped
    ? (unit.slumpGraceThisPlayerTurn ? 2 : Math.max(1, unit.slumpTurnsRemaining ?? 1))
    : 0;
  const revivalFill = slumped
    ? (unit.slumpGraceThisPlayerTurn
      ? 1
      : Math.max(0, Math.min(1, (unit.slumpTurnsRemaining ?? 0) / 1)))
    : 0;

  return (
    <View style={[styles.root, cinematicBarOpacity < 1 ? { opacity: cinematicBarOpacity } : null]}>
      {intentGlyph && !slumped ? (
        <View style={styles.intentRow} pointerEvents="none">
          <CombatArenaIntentGlyph glyph={intentGlyph} compact />
        </View>
      ) : null}
      <View style={[
        styles.plate,
        slumped ? styles.plateSlumped : null,
        abyssalVerdictTint ? styles.plateAbyssal : null,
      ]}>
        <View style={styles.nameRow}>
          <Text style={[
            styles.name,
            { color: abyssalVerdictTint ? '#E4D8C4' : nameColor },
          ]} numberOfLines={1}>
            {unit.designation.toUpperCase()}
          </Text>
          {slumped ? (
            <Text style={styles.slumpBadge} numberOfLines={1}>SLUMPED</Text>
          ) : (
            <Text style={[styles.hpNum, abyssalVerdictTint ? styles.hpNumAbyssal : null]} numberOfLines={1}>
              {`${unit.currentHp}/${unit.maxHp}`}
            </Text>
          )}
        </View>
        {slumped ? (
          <>
            <Text style={styles.executeHint} numberOfLines={1}>
              STRIKE AGAIN TO EXECUTE
            </Text>
            <View style={styles.revivalTrack}>
              <View
                style={[
                  styles.revivalFill,
                  { width: `${Math.max(0.12, revivalFill) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.revivalLabel} numberOfLines={1}>
              {unit.slumpGraceThisPlayerTurn
                ? 'REVIVAL AFTER NEXT FULL TURN'
                : revivalSegments <= 1
                  ? 'REVIVAL IMMINENT'
                  : `REVIVAL IN ${revivalSegments} TURN(S)`}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.hpTrack, abyssalVerdictTint ? styles.hpTrackAbyssal : null]}>
              <View style={[
                styles.hpFill,
                abyssalVerdictTint ? styles.hpFillAbyssal : null,
                { width: `${Math.max(0, Math.min(1, hpRatio)) * 100}%` },
              ]} />
            </View>
            {fractureRatio > 0.02 ? (
              <View style={styles.fractureTrack}>
                <View
                  style={[
                    styles.fractureFill,
                    { width: `${Math.max(0, Math.min(1, fractureRatio)) * 100}%` },
                  ]}
                />
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <CombatArenaDefensePips defense={defense} />
              {rotStacks > 0 ? (
                <Text style={styles.rotBadge} numberOfLines={1}>
                  {`ROT ${rotStacks}`}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 3,
    alignItems: 'stretch',
  },
  intentRow: {
    alignItems: 'center',
  },
  plate: {
    backgroundColor: 'rgba(5, 8, 10, 0.62)',
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
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    letterSpacing: 0.55,
  },
  hpNum: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: OTT.soulRed,
  },
  hpNumAbyssal: {
    color: '#E4D8C4',
  },
  slumpBadge: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#C45AAE',
  },
  executeHint: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '700',
    letterSpacing: 0.45,
    color: OTT.terminalGreenMuted,
  },
  revivalTrack: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  revivalFill: {
    height: '100%',
    backgroundColor: '#C45AAE',
  },
  revivalLabel: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '600',
    letterSpacing: 0.35,
    color: 'rgba(196, 90, 174, 0.85)',
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
  hpFill: {
    height: '100%',
    backgroundColor: OTT.soulRed,
  },
  hpFillAbyssal: {
    backgroundColor: '#8B1E2D',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    minHeight: 8,
  },
  rotBadge: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: OTT.terminalGreenMuted,
  },
});
