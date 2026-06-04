import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CombatEnemyTelemetry,
  formatHostileId,
  formatIntentReadout,
  GAUGE_HOSTILE_HP,
  GAUGE_TRACK_BORDER,
} from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';

const MONO = 'monospace';

interface CombatEnemyHeaderBandProps {
  enemy: CombatEnemyTelemetry | null;
  intentMutedColor: string;
}

export default function CombatEnemyHeaderBand({
  enemy,
  intentMutedColor,
}: CombatEnemyHeaderBandProps): React.JSX.Element | null {
  if (!enemy) return null;

  const hpRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;

  return (
    <View style={styles.band}>
      <View style={styles.identityCol}>
        <Text style={styles.hostileId} numberOfLines={1} ellipsizeMode="tail">
          {`HOSTILE_ID // ${formatHostileId(enemy.designation)}`}
        </Text>
        <Text style={[styles.intentLine, { color: intentMutedColor }]} numberOfLines={1} ellipsizeMode="tail">
          {`INTENT // ${formatIntentReadout(enemy.intent)}`}
        </Text>
      </View>
      <CombatHorizontalGauge
        fillColor={GAUGE_HOSTILE_HP}
        ratio={hpRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        valueCaption={`HP: ${enemy.currentHp}/${enemy.maxHp}`}
        valueCaptionColor={GAUGE_HOSTILE_HP}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    width: '100%',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#000000',
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  hostileId: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 12,
    color: '#ffffff',
  },
  intentLine: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.5,
    lineHeight: 11,
  },
});
