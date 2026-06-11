import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE } from '../CombatCommandDeck';

const INTEL_PANEL_HEIGHT = Math.round(COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE / 2.5);
import { resolveEnemyThreatTier } from '../../data/enemyRoster';
import { affinityWeaknessLabel } from '../../data/combatEnvironmentEngine';
import { AFFINITY_DISPLAY_LABEL } from '../../types/combatEnvironment';
import { formatHostileId, formatIntentReadout } from '../../utils/combatTelemetryFormat';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';

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

  return (
    <View style={[styles.panel, { borderColor: HOSTILE_ACCENT }]} pointerEvents="none">
      <Text style={[styles.title, { color: HOSTILE_ACCENT }]} numberOfLines={1}>
        {`>> HOSTILE INTEL // ${formatHostileId(unit.designation)}`}
      </Text>
      <Text style={[styles.compactLine, { color: mutedColor }]} numberOfLines={1}>
        {`CLASS ${affinityLabel.toUpperCase()} // TIER ${tierLabel} // ${statusLines(unit.combatTags)}`}
      </Text>
      <Text style={[styles.compactLine, { color: mutedColor }]} numberOfLines={1}>
        {`NEXT ATTACK // ${unit.intentLabel ?? formatIntentReadout(unit.intent)}`}
      </Text>
      <Text style={[styles.compactLine, { color: mutedColor }]} numberOfLines={1}>
        {`WEAK TO // ${affinityWeaknessLabel(affinity).toUpperCase()}`}
      </Text>
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
    gap: 2,
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
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
    lineHeight: 8,
  },
});
