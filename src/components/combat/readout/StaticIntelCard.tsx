import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import { resolveEnemyThreatTier } from '../../../data/enemyRoster';
import type { EnemyIntent } from '../../../types/run';
import {
  formatEnemyStatusLabels,
  formatHostileId,
  formatIntentReadout,
  isEnemyBuffIntent,
  isEnemyDamageIntent,
  type CombatGridUnitSnapshot,
} from '../../../utils/combatTelemetryFormat';
import { describeEnemyIntent } from '../../../utils/enemyIntentDescriptions';
import CombatStatusIconRow from './CombatStatusIconRow';
import CombatEnemySlotBars from '../CombatEnemySlotBars';
import EnemyIntentDetailOverlay from './EnemyIntentDetailOverlay';
import type { EnemyStatusEffectKey } from '../../../utils/enemyStatusEffects';
import { ENEMY_STATUS_EFFECTS } from '../../../utils/enemyStatusEffects';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';
const INTENT_ATTACK_BG = 'rgba(127, 29, 29, 0.72)';
const INTENT_ATTACK_BORDER = '#ef4444';
const INTENT_BUFF_BG = 'rgba(30, 58, 138, 0.72)';
const INTENT_BUFF_BORDER = '#3b82f6';

interface StaticIntelCardProps {
  unit: CombatGridUnitSnapshot;
  mutedColor: string;
}

type IntentBoxTone = 'attack' | 'buff';

function classifyIntentBoxTone(intent: EnemyIntent): IntentBoxTone {
  if (isEnemyBuffIntent(intent)) return 'buff';
  if (
    intent === 'OCCULT_TETHER'
    || intent === 'VEIL_STATIC'
    || intent === 'SINKING_INTO_GRID'
    || intent === 'VEIL_BARRIER'
  ) {
    return 'buff';
  }
  if (isEnemyDamageIntent(intent)) return 'attack';
  return 'attack';
}

function extraStatusTags(
  unit: CombatGridUnitSnapshot,
  trayKeys: readonly EnemyStatusEffectKey[],
): string[] {
  const trayLabels = new Set(trayKeys.map((key) => ENEMY_STATUS_EFFECTS[key].label.toUpperCase()));
  return formatEnemyStatusLabels(unit).filter((tag) => {
    const normalized = tag.replace(/\s+x\d+$/, '');
    return !trayLabels.has(normalized);
  });
}

/** Fixed-height hostile stat block — no scroll, high-density flex layout. */
export default function StaticIntelCard({
  unit,
  mutedColor,
}: StaticIntelCardProps): React.JSX.Element {
  const [intentDetailVisible, setIntentDetailVisible] = useState(false);
  const tier = resolveEnemyThreatTier({
    isBoss: unit.isBoss,
    isApex: unit.isApex,
    rosterId: unit.rosterId,
  });
  const tierLabel = unit.isAlpha ? 'ALPHA' : tier === 'STANDARD' ? 'STD' : tier;
  const intentText = unit.intentLabel ?? formatIntentReadout(unit.intent);
  const intentTone = classifyIntentBoxTone(unit.intent);
  const trayKeys = unit.activeStatuses ?? [];
  const extraTags = useMemo(() => extraStatusTags(unit, trayKeys), [unit, trayKeys]);
  const intentDetail = useMemo(
    () => describeEnemyIntent(unit.intent),
    [unit.intent],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.name,
            { color: unit.isAlpha ? '#ff4444' : HOSTILE_ACCENT },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {formatHostileId(unit.designation)}
        </Text>
        <Text style={[styles.tier, { color: mutedColor }]} numberOfLines={1}>
          {`TIER // ${tierLabel}`}
        </Text>
      </View>

      <View style={styles.vitalsRow}>
        <CombatEnemySlotBars unit={unit} />
      </View>

      {(trayKeys.length > 0 || extraTags.length > 0) ? (
        <View style={styles.statusRow}>
          <CombatStatusIconRow statusKeys={trayKeys} />
          {extraTags.map((tag) => (
            <View key={tag} style={styles.extraTagChip}>
              <Text style={styles.extraTagLabel} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <HapticPressable
        onPress={() => setIntentDetailVisible(true)}
        style={[
          styles.intentBox,
          intentTone === 'buff' ? styles.intentBoxBuff : styles.intentBoxAttack,
        ]}
      >
        <Text style={styles.intentLabel} numberOfLines={1}>
          NEXT //
        </Text>
        <Text
          style={[
            styles.intentValue,
            { color: intentTone === 'buff' ? '#93c5fd' : '#fca5a5' },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {intentText}
        </Text>
      </HapticPressable>

      <EnemyIntentDetailOverlay
        visible={intentDetailVisible}
        detail={intentDetailVisible ? intentDetail : null}
        onDismiss={() => setIntentDetailVisible(false)}
        borderColor={intentTone === 'buff' ? INTENT_BUFF_BORDER : INTENT_ATTACK_BORDER}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    width: '100%',
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
    paddingHorizontal: 6,
    paddingTop: 0,
    paddingBottom: 5,
    overflow: 'visible',
    justifyContent: 'space-between',
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexShrink: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tier: {
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  vitalsRow: {
    flexShrink: 0,
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    overflow: 'visible',
  },
  extraTagChip: {
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  extraTagLabel: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '700',
    color: '#ddd6fe',
    letterSpacing: 0.2,
  },
  intentBox: {
    flexShrink: 0,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 1,
    minHeight: 28,
    justifyContent: 'center',
  },
  intentBoxAttack: {
    backgroundColor: INTENT_ATTACK_BG,
    borderColor: INTENT_ATTACK_BORDER,
  },
  intentBoxBuff: {
    backgroundColor: INTENT_BUFF_BG,
    borderColor: INTENT_BUFF_BORDER,
  },
  intentLabel: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '700',
    color: 'rgba(248, 250, 252, 0.65)',
    letterSpacing: 0.5,
  },
  intentValue: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.35,
    lineHeight: 9,
  },
});
