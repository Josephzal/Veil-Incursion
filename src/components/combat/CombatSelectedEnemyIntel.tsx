import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resolveEnemyThreatTier } from '../../data/enemyRoster';
import { affinityWeaknessLabel } from '../../data/combatEnvironmentEngine';
import { AFFINITY_DISPLAY_LABEL } from '../../types/combatEnvironment';
import { formatHostileId, formatIntentReadout } from '../../utils/combatTelemetryFormat';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import CombatEnemySlotBars from './CombatEnemySlotBars';
import {
  COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT,
  combatDeckGaugeTrackWidth,
} from './combatGaugeMetrics';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';
const WEAKNESS_COLOR = '#a78bfa';

const RIGHT_TEXT_LINE = 8;
const RIGHT_TEXT_GAP = 2;
const RIGHT_TEXT_BLOCK = RIGHT_TEXT_LINE * 3 + RIGHT_TEXT_GAP * 2;

const INTEL_PANEL_HEIGHT =
  9 + 2 + Math.max(COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT, RIGHT_TEXT_BLOCK) + 8;

interface CombatSelectedEnemyIntelProps {
  unit: CombatGridUnitSnapshot;
  mutedColor: string;
}

function statusLines(tags: string[] | undefined): string {
  const lines: string[] = [];
  if (tags?.includes('CONCUSSED')) lines.push('DAZED');
  if (tags?.includes('DOOMED')) lines.push('DOOMED');
  if (tags?.includes('FRACTURED')) lines.push('FRACTURED');
  return lines.length > 0 ? lines.join(' // ') : 'CLEAR';
}

export default function CombatSelectedEnemyIntel({
  unit,
  mutedColor,
}: CombatSelectedEnemyIntelProps): React.JSX.Element {
  const affinity = unit.affinity;
  const affinityLabel = affinity ? AFFINITY_DISPLAY_LABEL[affinity] : 'UNKNOWN';
  const tier = resolveEnemyThreatTier({
    isBoss: unit.isBoss,
    isApex: unit.isApex,
    rosterId: unit.rosterId,
  });
  const tierLabel = tier === 'STANDARD' ? 'STANDARD' : tier;
  const gaugeWidth = combatDeckGaugeTrackWidth();

  return (
    <View style={[styles.panel, { borderColor: HOSTILE_ACCENT }]} pointerEvents="none">
      <View style={styles.bodyRow}>
        <View style={styles.leftColumn}>
          <Text style={[styles.title, { color: HOSTILE_ACCENT }]} numberOfLines={1}>
            {`>> HOSTILE INTEL // ${formatHostileId(unit.designation)}`}
          </Text>
          <CombatEnemySlotBars unit={unit} trackWidth={gaugeWidth} />
        </View>

        <View style={styles.rightColumn}>
          <Text style={[styles.compactLine, styles.rightText, { color: mutedColor }]} numberOfLines={1}>
            {`CLASS ${affinityLabel.toUpperCase()} // TIER ${tierLabel} // ${statusLines(unit.combatTags)}`}
          </Text>
          <Text style={[styles.compactLine, styles.rightText, { color: WEAKNESS_COLOR }]} numberOfLines={1}>
            {`WEAK TO // ${affinityWeaknessLabel(affinity).toUpperCase()}`}
          </Text>
          <Text style={[styles.compactLine, styles.rightText, { color: HOSTILE_ACCENT }]} numberOfLines={1}>
            {`NEXT ATTACK // ${unit.intentLabel ?? formatIntentReadout(unit.intent)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    height: INTEL_PANEL_HEIGHT,
    minHeight: INTEL_PANEL_HEIGHT,
    maxHeight: INTEL_PANEL_HEIGHT,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rightColumn: {
    flexShrink: 0,
    gap: RIGHT_TEXT_GAP,
    alignItems: 'flex-end',
    maxWidth: '46%',
  },
  title: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 9,
  },
  compactLine: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: RIGHT_TEXT_LINE,
  },
  rightText: {
    textAlign: 'right',
  },
});
