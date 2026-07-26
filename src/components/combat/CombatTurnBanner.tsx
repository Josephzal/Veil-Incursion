import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CombatTurnPhase } from '../../context/CombatTurnContext';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { formatIntentReadout } from '../../utils/combatTelemetryFormat';
import type { EnemyIntent } from '../../types/run';

const HOSTILE_RED = OTT.soulRed;
const PARRY_GREEN = OTT.terminalGreen;

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
  let fill = 'rgba(8, 12, 14, 0.88)';

  switch (phase) {
    case 'ENEMY_WINDUP':
      label = 'HOSTILE CHANNEL';
      sublabel = enemyIntent
        ? `${formatIntentReadout(enemyIntent)} — READ INTENT`
        : 'ANALYZING HOSTILE CHANNEL';
      accent = HOSTILE_RED;
      border = 'rgba(255, 90, 98, 0.72)';
      fill = 'rgba(255, 90, 98, 0.06)';
      break;
    case 'ENEMY_ACTION':
      label = 'HOSTILE ATTACK';
      sublabel = enemyIntent ? `${formatIntentReadout(enemyIntent)} — INCOMING` : 'STRIKE CHANNEL ACTIVE';
      accent = HOSTILE_RED;
      border = 'rgba(255, 90, 98, 0.72)';
      fill = 'rgba(255, 90, 98, 0.06)';
      break;
    case 'PARRY_WINDOW':
      label = 'COUNTER WINDOW OPEN';
      sublabel = 'TAP INSIDE RING WHEN RINGS ALIGN';
      accent = PARRY_GREEN;
      border = 'rgba(69, 247, 160, 0.65)';
      fill = 'rgba(69, 247, 160, 0.06)';
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
    <View style={[
      styles.banner,
      compact && styles.bannerCompact,
      { borderColor: border, backgroundColor: fill },
    ]}>
      <Text style={[
        styles.label,
        compact && styles.labelCompact,
        { color: accent },
      ]}>
        {`>> ${label}`}
      </Text>
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
    borderWidth: 1.25,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
    width: '100%',
  },
  bannerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
  },
  label: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.body,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  labelCompact: {
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 0.55,
  },
  sublabel: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    letterSpacing: 0.45,
    color: OTT.textSecondary,
  },
  sublabelCompact: {
    fontSize: COMBAT_HUD_TYPE.micro,
    letterSpacing: 0.35,
  },
});
