import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CombatEnemyTelemetry,
  formatHostileId,
  formatIntentReadout,
  GAUGE_HOSTILE_HP,
  GAUGE_TRACK_BORDER,
  clampRatio,
} from '../../utils/combatTelemetryFormat';

const GAUGE_FRACTURE = '#fbbf24';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';

const MONO = 'monospace';

interface CombatEnemyHeaderBandProps {
  enemy: CombatEnemyTelemetry | null;
  intentMutedColor: string;
  compact?: boolean;
  arena?: boolean;
}

export default function CombatEnemyHeaderBand({
  enemy,
  intentMutedColor,
  compact = false,
  arena = false,
}: CombatEnemyHeaderBandProps): React.JSX.Element | null {
  if (!enemy) return null;

  const hpRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;
  const fractureMax = enemy.fractureMax ?? 100;
  const fractureRatio = clampRatio(fractureMax > 0 ? (enemy.fractureGauge ?? 0) / fractureMax : 0);
  const armorLine = `KA ${enemy.kineticArmor ?? 0} // OW ${enemy.occultWards ?? 0}`;
  const tagLine = enemy.combatTags?.length ? enemy.combatTags.join(' / ') : null;
  const shellStyle = arena ? styles.bandArena : compact ? styles.bandCompact : null;

  if (arena) {
    return (
      <View style={[styles.band, shellStyle]}>
        <View style={styles.arenaTopRow}>
          <Text style={[styles.hostileIdArena, enemy.isAlpha && styles.alphaHostileId]} numberOfLines={1} ellipsizeMode="tail">
            {formatHostileId(enemy.designation)}
          </Text>
          <Text style={[styles.hpCaption, { color: GAUGE_HOSTILE_HP }]}>
            {`${enemy.currentHp}/${enemy.maxHp}`}
          </Text>
        </View>
        <CombatHorizontalGauge
          fillColor={GAUGE_HOSTILE_HP}
          ratio={hpRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          width="100%"
          compact
        />
        <View style={styles.fractureRow}>
          <Text style={[styles.fractureCaption, { color: GAUGE_FRACTURE }]}>
            {`FRACTURE ${enemy.fractureGauge ?? 0}/${fractureMax}`}
          </Text>
          <Text style={[styles.armorCaption, { color: intentMutedColor }]}>{armorLine}</Text>
        </View>
        <CombatHorizontalGauge
          fillColor={GAUGE_FRACTURE}
          ratio={fractureRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          width="100%"
          compact
        />
        <Text style={[styles.intentLineArena, { color: intentMutedColor }]} numberOfLines={1} ellipsizeMode="tail">
          {tagLine
            ? `${tagLine} // ${formatIntentReadout(enemy.intent)}`
            : formatIntentReadout(enemy.intent)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.band, shellStyle]}>
      <View style={styles.identityCol}>
        <Text style={[styles.hostileId, enemy.isAlpha && styles.alphaHostileId]} numberOfLines={compact ? 2 : 1} ellipsizeMode="tail">
          {`HOSTILE_ID // ${formatHostileId(enemy.designation)}`}
        </Text>
        <Text
          style={[styles.intentLine, { color: intentMutedColor }]}
          numberOfLines={compact ? 2 : 1}
          ellipsizeMode="tail"
        >
          {`INTENT // ${formatIntentReadout(enemy.intent)}`}
        </Text>
      </View>
      <CombatHorizontalGauge
        fillColor={GAUGE_HOSTILE_HP}
        ratio={hpRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
        valueCaption={`HP: ${enemy.currentHp}/${enemy.maxHp}`}
        valueCaptionColor={GAUGE_HOSTILE_HP}
        width={compact ? '100%' : undefined}
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
  bandCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.35)',
  },
  bandArena: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.35)',
    width: '100%',
  },
  arenaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hostileIdArena: {
    flex: 1,
    minWidth: 0,
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 10,
    color: '#ffffff',
  },
  alphaHostileId: {
    color: '#ff4444',
    fontWeight: '800',
  },
  hpCaption: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 10,
    flexShrink: 0,
  },
  fractureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  fractureCaption: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 9,
  },
  armorCaption: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.3,
    lineHeight: 8,
    flexShrink: 0,
  },
  intentLineArena: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 9,
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
