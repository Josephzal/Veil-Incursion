import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CombatTurnPhase } from '../../context/CombatTurnContext';
import { formatIntentReadout } from '../../utils/combatTelemetryFormat';
import type { EnemyIntent } from '../../types/run';

const MONO = 'monospace';
const HOSTILE_RED = '#ef4444';
const PARRY_GREEN = '#00ff33';

interface CombatTurnBannerProps {
  phase: CombatTurnPhase;
  primaryColor: string;
  mutedColor: string;
  enemyIntent?: EnemyIntent | null;
}

export default function CombatTurnBanner({
  phase,
  primaryColor,
  mutedColor,
  enemyIntent,
}: CombatTurnBannerProps): React.JSX.Element | null {
  if (phase === 'RESOLUTION') return null;

  let label = 'OPERATIVE TURN // SELECT ACTION';
  let sublabel: string | null = null;
  let accent = primaryColor;
  let border = primaryColor;

  switch (phase) {
    case 'ENEMY_ACTION':
      label = 'HOSTILE TURN';
      sublabel = enemyIntent ? formatIntentReadout(enemyIntent) : 'RESOLVING ATTACK';
      accent = HOSTILE_RED;
      border = HOSTILE_RED;
      break;
    case 'PARRY_WINDOW':
      label = 'COUNTER WINDOW OPEN';
      sublabel = 'TAP CENTER WHEN RINGS ALIGN';
      accent = PARRY_GREEN;
      border = PARRY_GREEN;
      break;
    case 'SLICE':
      label = 'EXECUTION PHASE';
      sublabel = 'SLICE THROUGH ALL VECTORS';
      accent = primaryColor;
      border = primaryColor;
      break;
    case 'PLAYER_COMMAND':
    default:
      sublabel = 'COMMAND DECK ONLINE';
      break;
  }

  return (
    <View style={[styles.banner, { borderColor: border }]}>
      <Text style={[styles.label, { color: accent }]}>{`>> ${label}`}</Text>
      {sublabel ? (
        <Text style={[styles.sublabel, { color: mutedColor }]} numberOfLines={1} ellipsizeMode="tail">
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
    gap: 2,
  },
  label: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  sublabel: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.5,
  },
});
