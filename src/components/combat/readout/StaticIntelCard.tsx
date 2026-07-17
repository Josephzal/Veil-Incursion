import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import { resolveEnemyThreatTier } from '../../../data/enemyRoster';
import type { EnemyIntent } from '../../../types/run';
import {
  formatHostileId,
  formatIntentReadout,
  isEnemyBuffIntent,
  isEnemyDamageIntent,
  type CombatGridUnitSnapshot,
} from '../../../utils/combatTelemetryFormat';
import { describeEnemyIntent } from '../../../utils/enemyIntentDescriptions';
import { getIntentSeverity, severityColor } from '../../../data/enemyIntentCatalog';
import CombatStatusIconRow from './CombatStatusIconRow';
import CombatEnemySlotBars from '../CombatEnemySlotBars';
import EnemyIntentDetailOverlay from './EnemyIntentDetailOverlay';
import { resolveIntelStatusChips } from '../../../utils/enemyStatusEffects';
import { useCombatDesktopLayout } from '../../../hooks/useCombatDesktopLayout';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';
const INTENT_ATTACK_BG = 'rgba(127, 29, 29, 0.72)';
const INTENT_ATTACK_BORDER = '#ef4444';
const INTENT_BUFF_BG = 'rgba(30, 58, 138, 0.72)';
const INTENT_BUFF_BORDER = '#3b82f6';
const INTENT_HIGH_BG = 'rgba(154, 52, 18, 0.78)';
const INTENT_CRITICAL_BG = 'rgba(127, 29, 29, 0.88)';

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

/** Fixed-height hostile stat block — no scroll, high-density flex layout. */
export default function StaticIntelCard({
  unit,
  mutedColor,
}: StaticIntelCardProps): React.JSX.Element {
  const { isCombatDesktop, scaleCombatFont, scaleCombatSize } = useCombatDesktopLayout();
  const [intentDetailVisible, setIntentDetailVisible] = useState(false);
  const tier = resolveEnemyThreatTier({
    isBoss: unit.isBoss,
    isApex: unit.isApex,
    rosterId: unit.rosterId,
  });
  const tierLabel = unit.isAlpha ? 'ALPHA' : tier === 'STANDARD' ? 'STD' : tier;
  const intentText = unit.intentLabel ?? formatIntentReadout(unit.intent);
  const intentTone = classifyIntentBoxTone(unit.intent);
  const severity = unit.intentSeverity ?? getIntentSeverity(unit.intent);
  const turnsRemaining = unit.intentTurnsRemaining ?? 0;
  const trayKeys = unit.activeStatuses ?? [];
  const statusChips = useMemo(() => resolveIntelStatusChips({
    combatTags: unit.combatTags,
    evadeActive: unit.evadeActive,
    evadeTurnsRemaining: unit.evadeTurnsRemaining,
    intent: unit.intent,
    fortifyTurnsRemaining: unit.fortifyTurnsRemaining,
    doomedStacks: unit.doomedStacks,
    isEnraged: unit.isEnraged,
    chargeTurns: unit.chargeTurns,
    isFractured: unit.isFractured,
    veilRotStacks: unit.veilRotStacks,
    kineticArmor: unit.kineticArmor,
    occultWards: unit.occultWards,
  }), [unit]);
  // Prefer live-derived chips; fall back to tray keys if needed for snapshot parity.
  const chips = statusChips.length > 0
    ? statusChips
    : trayKeys.map((key) => ({
      id: key,
      abbr: key.slice(0, 2).toUpperCase(),
      label: key,
      description: key,
    }));
  const intentDetail = useMemo(
    () => describeEnemyIntent(unit.intent, {
      designation: unit.designation,
      chargeTurns: unit.chargeTurns,
    }),
    [unit.intent, unit.designation, unit.chargeTurns],
  );
  const intentBorder = severity === 'CRITICAL' || severity === 'HIGH'
    ? severityColor(severity)
    : intentTone === 'buff'
      ? INTENT_BUFF_BORDER
      : INTENT_ATTACK_BORDER;
  const intentBoxStyle = severity === 'CRITICAL'
    ? styles.intentBoxCritical
    : severity === 'HIGH'
      ? styles.intentBoxHigh
      : intentTone === 'buff'
        ? styles.intentBoxBuff
        : styles.intentBoxAttack;
  const intentValueColor = severity === 'HIGH' || severity === 'CRITICAL'
    ? severityColor(severity)
    : intentTone === 'buff'
      ? '#93c5fd'
      : '#fca5a5';
  const intentDisplay = turnsRemaining > 0
    ? `${intentText}  T-${turnsRemaining}`
    : intentText;

  return (
    <View style={styles.card}>
      <View style={styles.intelBody}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.name,
              {
                color: unit.isAlpha ? '#ff4444' : HOSTILE_ACCENT,
                fontSize: isCombatDesktop ? scaleCombatFont(10) : 8,
              },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {formatHostileId(unit.designation)}
          </Text>
          <Text
            style={[
              styles.tier,
              {
                color: mutedColor,
                fontSize: isCombatDesktop ? scaleCombatFont(7) : 5,
              },
            ]}
            numberOfLines={1}
          >
            {`TIER // ${tierLabel}`}
          </Text>
        </View>

        <CombatEnemySlotBars
          unit={unit}
          trackHeight={isCombatDesktop ? scaleCombatSize(14) : undefined}
        />

        {chips.length > 0 ? (
          <View style={styles.statusRow}>
            <CombatStatusIconRow chips={chips} />
          </View>
        ) : null}
      </View>

      <HapticPressable
        onPress={() => setIntentDetailVisible(true)}
        style={[
          styles.intentBox,
          intentBoxStyle,
          { borderColor: intentBorder },
        ]}
      >
        <Text
          style={[
            styles.intentLabel,
            isCombatDesktop ? { fontSize: scaleCombatFont(7) } : null,
          ]}
          numberOfLines={1}
        >
          {severity === 'HIGH' || severity === 'CRITICAL'
            ? `${severity} //`
            : 'NEXT //'}
        </Text>
        <Text
          style={[
            styles.intentValue,
            {
              color: intentValueColor,
              fontSize: isCombatDesktop ? scaleCombatFont(9) : 7,
              lineHeight: isCombatDesktop ? scaleCombatFont(12) : 9,
            },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {intentDisplay}
        </Text>
      </HapticPressable>

      <EnemyIntentDetailOverlay
        visible={intentDetailVisible}
        detail={intentDetailVisible ? intentDetail : null}
        onDismiss={() => setIntentDetailVisible(false)}
        borderColor={intentBorder}
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
    paddingHorizontal: 6,
    paddingTop: 0,
    paddingBottom: 5,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: 4,
  },
  intelBody: {
    flex: 1,
    minHeight: 0,
    gap: 4,
    flexShrink: 1,
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
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
    overflow: 'visible',
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
  intentBoxHigh: {
    backgroundColor: INTENT_HIGH_BG,
    borderColor: '#f97316',
  },
  intentBoxCritical: {
    backgroundColor: INTENT_CRITICAL_BG,
    borderColor: '#ef4444',
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
