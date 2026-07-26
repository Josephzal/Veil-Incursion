import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { resolveArenaDefenseState } from '../../data/combatArenaDefenseTelegraphEngine';
import type { ArenaIntentGlyph } from '../../data/combatArenaTelegraphEngine';
import CombatArenaDefensePips from './CombatArenaDefensePips';
import CombatArenaIntentGlyph from './CombatArenaIntentGlyph';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

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
  >;
  intentGlyph?: ArenaIntentGlyph | null;
}

/**
 * Concept nameplate — designation + HP readout above a thin red rail,
 * with intent glyph stacked above the vitals.
 */
export default function CombatEnemyOverheadBars({
  unit,
  intentGlyph = null,
}: CombatEnemyOverheadBarsProps): React.JSX.Element {
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
  const nameColor = unit.isAlpha ? '#ff8a8a' : OTT.textPrimary;

  return (
    <View style={styles.root}>
      {intentGlyph ? (
        <View style={styles.intentRow} pointerEvents="none">
          <CombatArenaIntentGlyph glyph={intentGlyph} compact />
        </View>
      ) : null}
      <View style={styles.plate}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: nameColor }]} numberOfLines={1}>
            {unit.designation.toUpperCase()}
          </Text>
          <Text style={styles.hpNum} numberOfLines={1}>
            {`${unit.currentHp}/${unit.maxHp}`}
          </Text>
        </View>
        <View style={styles.hpTrack}>
          <View style={[styles.hpFill, { width: `${Math.max(0, Math.min(1, hpRatio)) * 100}%` }]} />
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
  hpTrack: {
    height: 3,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    backgroundColor: OTT.soulRed,
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
