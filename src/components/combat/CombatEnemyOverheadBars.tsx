import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  GAUGE_HOSTILE_HP,
  GAUGE_TRACK_BORDER,
  type CombatGridUnitSnapshot,
} from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';

const GAUGE_FRACTURE = '#fbbf24';
const MONO = 'monospace';
const CATALYST_LIVE = '#4ade80';
const CATALYST_BORDER = '#22c55e';
const CATALYST_BG = 'rgba(34, 197, 94, 0.88)';

interface CombatEnemyOverheadBarsProps {
  unit: Pick<
    CombatGridUnitSnapshot,
    'currentHp' | 'maxHp' | 'fractureGauge' | 'fractureMax' | 'veilRotStacks'
  >;
}

/** HP + fracture gauges anchored under hostile sprites in the arena. */
export default function CombatEnemyOverheadBars({
  unit,
}: CombatEnemyOverheadBarsProps): React.JSX.Element {
  const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;
  const rotStacks = unit.veilRotStacks ?? 0;

  return (
    <View style={styles.root}>
      {rotStacks > 0 ? (
        <View style={styles.rotBadge}>
          <Text style={styles.rotBadgeLabel} numberOfLines={1}>
            {`${rotStacks}`}
          </Text>
        </View>
      ) : null}
      <CombatHorizontalGauge
        fillColor={GAUGE_HOSTILE_HP}
        ratio={hpRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        width="100%"
        overhead
        borderless
      />
      <CombatHorizontalGauge
        fillColor={GAUGE_FRACTURE}
        ratio={fractureRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        width="100%"
        overhead
        borderless
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 2,
    alignItems: 'flex-start',
  },
  rotBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    backgroundColor: CATALYST_BG,
    borderWidth: 1,
    borderColor: CATALYST_BORDER,
    marginBottom: 1,
  },
  rotBadgeLabel: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: CATALYST_LIVE,
  },
});
