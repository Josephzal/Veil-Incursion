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
  /** Tighter typography for the landscape dashboard column. */
  compact?: boolean;
}

export default function CombatTurnBanner({
  phase,
  primaryColor,
  mutedColor,
  enemyIntent,
  compact = false,
}: CombatTurnBannerProps): React.JSX.Element | null {
  if (phase === 'RESOLUTION') return null;

  let label = 'OPERATIVE TURN // SELECT ACTION';
  let sublabel: string | null = null;
  let accent = primaryColor;
  let border = primaryColor;

  switch (phase) {
    case 'ENEMY_WINDUP':
      label = 'HOSTILE TURN';
      sublabel = enemyIntent
        ? `${formatIntentReadout(enemyIntent)} — READ INTENT`
        : 'ANALYZING HOSTILE CHANNEL';
      accent = HOSTILE_RED;
      border = HOSTILE_RED;
      break;
    case 'ENEMY_ACTION':
      label = 'HOSTILE ATTACK';
      sublabel = enemyIntent ? `${formatIntentReadout(enemyIntent)} — INCOMING` : 'STRIKE CHANNEL ACTIVE';
      accent = HOSTILE_RED;
      border = HOSTILE_RED;
      break;
    case 'PARRY_WINDOW':
      label = 'COUNTER WINDOW OPEN';
      sublabel = 'TAP INSIDE RING WHEN RINGS ALIGN';
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
    <View style={[styles.banner, compact && styles.bannerCompact, { borderColor: border }]}>
      <Text style={[styles.label, compact && styles.labelCompact, { color: accent }]}>{`>> ${label}`}</Text>
      {sublabel ? (
        <Text
          style={[styles.sublabel, compact && styles.sublabelCompact, { color: mutedColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
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
    width: '100%',
  },
  bannerCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 1,
    backgroundColor: 'rgba(10, 11, 15, 0.88)',
  },
  label: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  labelCompact: {
    fontSize: 7,
    letterSpacing: 0.5,
  },
  sublabel: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.5,
  },
  sublabelCompact: {
    fontSize: 6,
    letterSpacing: 0.35,
  },
});
