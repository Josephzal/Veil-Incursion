import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resolveEnemyThreatTier } from '../../data/enemyRoster';
import { formatHostileId, formatIntentReadout } from '../../utils/combatTelemetryFormat';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import CombatEnemySlotBars from './CombatEnemySlotBars';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';

interface CombatSelectedEnemyIntelProps {
  unit: CombatGridUnitSnapshot;
  mutedColor: string;
}

export default function CombatSelectedEnemyIntel({
  unit,
  mutedColor,
}: CombatSelectedEnemyIntelProps): React.JSX.Element {
  const tier = resolveEnemyThreatTier({
    isBoss: unit.isBoss,
    isApex: unit.isApex,
    rosterId: unit.rosterId,
  });
  const tierLabel = unit.isAlpha ? 'ALPHA' : tier === 'STANDARD' ? 'STANDARD' : tier;

  return (
    <View style={[styles.panel, { borderColor: HOSTILE_ACCENT }]} pointerEvents="none">
      <Text
        style={[
          styles.title,
          { color: unit.isAlpha ? '#ff4444' : HOSTILE_ACCENT },
          unit.isAlpha && styles.alphaTitle,
        ]}
        numberOfLines={1}
      >
        {`>> HOSTILE INTEL // ${formatHostileId(unit.designation)}`}
      </Text>

      <CombatEnemySlotBars unit={unit} />

      <View style={styles.metaBlock}>
        <Text style={[styles.compactLine, { color: mutedColor }]} numberOfLines={1}>
          {`TIER ${tierLabel}`}
        </Text>
        <Text style={[styles.compactLine, styles.intentLine, { color: HOSTILE_ACCENT }]} numberOfLines={2}>
          {`NEXT ATTACK // ${unit.intentLabel ?? formatIntentReadout(unit.intent)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
  },
  title: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  alphaTitle: {
    fontWeight: '800',
  },
  metaBlock: {
    gap: 3,
  },
  compactLine: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 9,
  },
  intentLine: {
    fontWeight: '700',
  },
});
