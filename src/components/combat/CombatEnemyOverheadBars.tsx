import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GAUGE_HOSTILE_HP,
  GAUGE_TRACK_BORDER,
  type CombatGridUnitSnapshot,
} from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';

const GAUGE_FRACTURE = '#fbbf24';

interface CombatEnemyOverheadBarsProps {
  unit: Pick<
    CombatGridUnitSnapshot,
    'currentHp' | 'maxHp' | 'fractureGauge' | 'fractureMax'
  >;
}

/** HP + fracture gauges anchored under hostile sprites in the arena. */
export default function CombatEnemyOverheadBars({
  unit,
}: CombatEnemyOverheadBarsProps): React.JSX.Element {
  const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;

  return (
    <View style={styles.root}>
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
  },
});
