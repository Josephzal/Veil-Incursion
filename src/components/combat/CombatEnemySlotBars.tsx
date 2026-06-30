import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GAUGE_HOSTILE_HP,
  GAUGE_TRACK_BORDER,
  type CombatGridUnitSnapshot,
} from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';
import {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT,
  COMBAT_GAUGE_ROW_GAP_COMPACT,
  COMBAT_GAUGE_TRACK_HEIGHT_COMPACT,
} from './combatGaugeMetrics';

const GAUGE_FRACTURE = '#fbbf24';

interface CombatEnemySlotBarsProps {
  unit: Pick<
    CombatGridUnitSnapshot,
    'currentHp' | 'maxHp' | 'fractureGauge' | 'fractureMax'
  >;
  trackHeight?: number;
}

export default function CombatEnemySlotBars({
  unit,
  trackHeight,
}: CombatEnemySlotBarsProps): React.JSX.Element {
  const barHeight = trackHeight ?? COMBAT_GAUGE_TRACK_HEIGHT_COMPACT;
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
        compact
        trackHeight={barHeight}
      />
      <View style={[styles.gap, trackHeight != null ? { height: 5 } : null]} />
      <CombatHorizontalGauge
        fillColor={GAUGE_FRACTURE}
        ratio={fractureRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        width="100%"
        compact
        trackHeight={barHeight}
      />
    </View>
  );
}

export const COMBAT_ENEMY_SLOT_BARS_HEIGHT = COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT;

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  gap: {
    height: COMBAT_GAUGE_ROW_GAP_COMPACT,
  },
});
