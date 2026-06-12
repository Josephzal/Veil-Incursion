import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GAUGE_HOSTILE_HP,
  GAUGE_TRACK_BORDER,
  type EnemyStatusUnitFields,
} from '../../utils/combatTelemetryFormat';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';
import CombatEnemyStatusStrip from './CombatEnemyStatusStrip';
import {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT,
  COMBAT_GAUGE_ROW_GAP_COMPACT,
  combatDeckGaugeTrackWidth,
} from './combatGaugeMetrics';

const GAUGE_FRACTURE = '#fbbf24';
const STATUS_ROW_HEIGHT = 8;
const STATUS_ROW_GAP = 1;

interface CombatEnemySlotBarsProps {
  unit: Pick<
    CombatGridUnitSnapshot,
    'currentHp' | 'maxHp' | 'fractureGauge' | 'fractureMax'
  > & EnemyStatusUnitFields;
  trackWidth?: number;
}

export default function CombatEnemySlotBars({
  unit,
  trackWidth: trackWidthProp,
}: CombatEnemySlotBarsProps): React.JSX.Element {
  const trackWidth = trackWidthProp ?? combatDeckGaugeTrackWidth();
  const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 1;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0;

  return (
    <View style={[styles.root, { width: trackWidth }]}>
      <CombatHorizontalGauge
        fillColor={GAUGE_HOSTILE_HP}
        ratio={hpRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        width={trackWidth}
        compact
      />
      <View style={styles.gap} />
      <CombatHorizontalGauge
        fillColor={GAUGE_FRACTURE}
        ratio={fractureRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        width={trackWidth}
        compact
      />
      <View style={styles.statusGap} />
      <CombatEnemyStatusStrip unit={unit} trackWidth={trackWidth} />
    </View>
  );
}

export const COMBAT_ENEMY_SLOT_BARS_HEIGHT =
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT + STATUS_ROW_GAP + STATUS_ROW_HEIGHT;

const styles = StyleSheet.create({
  root: {
    height: COMBAT_ENEMY_SLOT_BARS_HEIGHT,
    flexShrink: 0,
    alignItems: 'stretch',
  },
  statusGap: {
    height: STATUS_ROW_GAP,
  },
  gap: {
    height: COMBAT_GAUGE_ROW_GAP_COMPACT,
  },
});
