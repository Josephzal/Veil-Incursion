import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../../../components/HapticPressable';
import StatusEffectTray from '../../../components/combat/StatusEffectTray';
import { OTT } from '../../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../../constants/combatHudTypography';
import type { CombatGridUnitSnapshot } from '../../../utils/combatTelemetryFormat';
import { formatHostileId } from '../../../utils/combatTelemetryFormat';
import { describeEnemyIntent } from '../../../utils/enemyIntentDescriptions';
import {
  resolveSlumpedPresentation,
  shouldSuppressNextIntent,
} from '../../../data/combatSlumpedPresentation';

interface HostileIntelViewProps {
  enemy: CombatGridUnitSnapshot | null;
  enemies?: readonly CombatGridUnitSnapshot[];
  mutedColor: string;
  onSelectEnemy?: (unitId: string) => void;
}

type DetailPayload = {
  title: string;
  body: string;
  meta?: string;
};

/** Multi-enemy scanner — intent + status chips open detailed readouts. */
export default function HostileIntelView({
  enemy,
  enemies,
  mutedColor,
  onSelectEnemy,
}: HostileIntelViewProps): React.JSX.Element {
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const list = (enemies ?? []).filter((u) => !u.isDead && !u.dissolveHidden);
  const rows = list.length > 0 ? list : enemy ? [enemy] : [];

  const selectedId = enemy?.unitId ?? rows.find((u) => u.isSelected || u.isFocused)?.unitId;
  const selected = rows.find((u) => u.unitId === selectedId) ?? rows[0];
  const others = rows.filter((u) => u && selected && u.unitId !== selected.unitId);

  const openIntentDetail = (unit: CombatGridUnitSnapshot) => {
    const info = describeEnemyIntent(unit.intent, {
      designation: unit.designation,
      chargeTurns: unit.chargeTurns,
    });
    const turns =
      unit.intentTurnsRemaining != null && unit.intentTurnsRemaining > 0
        ? `Turns remaining: ${unit.intentTurnsRemaining}`
        : info.turnsRemaining != null && info.turnsRemaining > 0
          ? `Turns remaining: ${info.turnsRemaining}`
          : undefined;
    setDetail({
      title: `INTENT // ${info.title}`,
      body: [info.summary, info.effect, info.counterplay].filter(Boolean).join('\n\n'),
      meta: [info.severity ? `Severity: ${info.severity}` : null, turns].filter(Boolean).join(' · ') || undefined,
    });
  };

  const openTraitDetail = (title: string, body: string) => {
    setDetail({ title, body });
  };

  if (rows.length === 0) {
    return (
      <View style={styles.standby}>
        <Text style={styles.standbyTitle}>STANDBY</Text>
        <Text style={[styles.standbyBody, { color: mutedColor }]}>
          SCANNING… Tap a hostile to lock intel.
        </Text>
      </View>
    );
  }

  const renderSelected = (unit: CombatGridUnitSnapshot) => {
    const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;
    const intent = unit.intentLabel ?? unit.intent;
    const tier = unit.isAlpha || unit.isElite ? 'ELITE' : 'STANDARD';
    const statuses = unit.activeStatuses ?? [];
    // Same authority the battlefield plate reads, so the two cannot disagree.
    const slump = resolveSlumpedPresentation(unit);
    const suppressIntent = shouldSuppressNextIntent(unit);

    return (
      <View key={unit.unitId} style={styles.targetCard}>
        <View style={[styles.targetAccent, slump ? styles.targetAccentSlumped : null]} />
        <View style={styles.targetBody}>
          <HapticPressable onPress={() => onSelectEnemy?.(unit.unitId)}>
            <View style={styles.targetHeader}>
              <Text style={styles.targetTitle} numberOfLines={1}>
                {`TARGET // ${formatHostileId(unit.designation)}`}
              </Text>
              {slump ? (
                <Text style={styles.slumpState}>{slump.stateLabel}</Text>
              ) : (
                <Text style={styles.targetHp}>{`${unit.currentHp}`}</Text>
              )}
            </View>
            <Text style={styles.tierLine}>{`TIER // ${tier}`}</Text>
            <View style={styles.soulRow}>
              <Text style={styles.soulLabel}>SOUL</Text>
              <View style={styles.hpTrack}>
                <View style={[styles.hpFill, { width: `${Math.max(0, Math.min(1, hpRatio)) * 100}%` }]} />
              </View>
              <Text style={styles.soulValue}>{`${unit.currentHp}/${unit.maxHp}`}</Text>
            </View>
          </HapticPressable>

          {(unit.kineticArmor ?? 0) > 0 ? (
            <HapticPressable
              onPress={() => openTraitDetail(
                'KINETIC ARMOR',
                `Absorbs kinetic hits. Remaining layers: ${unit.kineticArmor}. Break with armor-break or fracture pressure.`,
              )}
            >
              <Text style={styles.traitLink}>{`ARMOR  KINETIC ARMOR x${unit.kineticArmor}  ›`}</Text>
            </HapticPressable>
          ) : null}
          {(unit.occultWards ?? 0) > 0 ? (
            <HapticPressable
              onPress={() => openTraitDetail(
                'OCCULT WARD',
                `Absorbs occult pressure. Remaining wards: ${unit.occultWards}. Strip with ward-break tools.`,
              )}
            >
              <Text style={styles.traitLink}>{`WARD   OCCULT WARD x${unit.occultWards}  ›`}</Text>
            </HapticPressable>
          ) : null}
          {unit.isFractured ? (
            <HapticPressable
              onPress={() => openTraitDetail(
                'FRACTURED',
                'Structural integrity broken — restricted actions and heightened damage taken. Breach targets can be executed.',
              )}
            >
              <Text style={styles.traitLink}>STATE  FRACTURED  ›</Text>
            </HapticPressable>
          ) : null}

          {statuses.length > 0 ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusHeader}>BUFFS / DEBUFFS</Text>
              <Text style={styles.statusHint}>Tap an icon for details</Text>
              <StatusEffectTray
                activeStatuses={statuses}
                onStatusPress={(def) => openTraitDetail(def.label.toUpperCase(), def.description)}
              />
            </View>
          ) : null}

          <View style={styles.separator} />
          {suppressIntent && slump ? (
            <HapticPressable
              onPress={() => openTraitDetail(
                'SLUMPED',
                `Collapsed but not destroyed. It takes no action while slumped and can be executed by a follow-up strike. ${slump.revivalLabel
                  .charAt(0)}${slump.revivalLabel.slice(1).toLowerCase()} if left alive.`,
              )}
              style={styles.intentBtn}
            >
              <Text style={styles.intentSlumped}>{`NEXT // NONE — ${slump.stateLabel}`}</Text>
              <Text style={styles.slumpExecutable}>{slump.executableLabel}</Text>
              <Text style={styles.slumpRevival}>{slump.revivalLabel}</Text>
              <Text style={styles.intentHint}>TAP FOR DETAILS</Text>
            </HapticPressable>
          ) : (
            <HapticPressable onPress={() => openIntentDetail(unit)} style={styles.intentBtn}>
              <Text style={styles.intent}>{`NEXT // ${intent}`}</Text>
              <Text style={styles.intentHint}>TAP FOR DETAILS</Text>
            </HapticPressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <ScrollView style={styles.host} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {selected ? renderSelected(selected) : null}
        {/* Switcher only — vitals and intent for other hostiles stay on the battlefield. */}
        {others.length > 0 ? (
          <View style={styles.switcher}>
            {others.map((unit) => (
              <HapticPressable
                key={unit.unitId}
                onPress={() => onSelectEnemy?.(unit.unitId)}
                style={styles.switcherChip}
                accessibilityRole="button"
                accessibilityLabel={`Inspect ${formatHostileId(unit.designation)}`}
              >
                <Text style={styles.switcherLabel} numberOfLines={1}>
                  {formatHostileId(unit.designation)}
                </Text>
                {unit.isSlumped ? <Text style={styles.switcherGlyph}>◌</Text> : null}
              </HapticPressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={detail != null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.detailBackdrop}>
          <HapticPressable style={styles.detailDismiss} onPress={() => setDetail(null)} />
          {detail ? (
            <View style={styles.detailCard} pointerEvents="box-none">
              <Text style={styles.detailTitle}>{detail.title}</Text>
              {detail.meta ? <Text style={styles.detailMeta}>{detail.meta}</Text> : null}
              <Text style={styles.detailBody}>{detail.body}</Text>
              <HapticPressable onPress={() => setDetail(null)} style={styles.detailClose}>
                <Text style={styles.detailCloseLabel}>CLOSE</Text>
              </HapticPressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    gap: 6,
    paddingBottom: 4,
  },
  standby: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  standbyTitle: {
    fontFamily: OTT.mono,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: OTT.cyanSelect,
  },
  standbyBody: {
    fontFamily: OTT.mono,
    fontSize: 11,
    lineHeight: 13,
  },
  targetCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: OTT.cyanSelect,
    backgroundColor: 'rgba(98, 220, 229, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  targetAccent: {
    width: 3,
    backgroundColor: OTT.cyanSelect,
  },
  targetAccentSlumped: {
    backgroundColor: '#C45AAE',
  },
  slumpState: {
    fontFamily: OTT.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#C45AAE',
  },
  targetBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 7,
    paddingVertical: 6,
    gap: 3,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 6,
  },
  targetTitle: {
    flex: 1,
    fontFamily: OTT.mono,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: OTT.cyanSelect,
  },
  targetHp: {
    fontFamily: OTT.mono,
    fontSize: 14,
    fontWeight: '800',
    color: OTT.soulRed,
  },
  tierLine: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: OTT.textSecondary,
  },
  soulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  soulLabel: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: OTT.textSecondary,
    width: 28,
  },
  soulValue: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '700',
    color: OTT.textPrimary,
  },
  hpTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderMuted,
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    backgroundColor: OTT.soulRed,
  },
  traitLink: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: OTT.textSecondary,
    textDecorationLine: 'underline',
  },
  statusBlock: {
    marginTop: 2,
    gap: 2,
  },
  statusHeader: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: OTT.textMuted,
  },
  statusHint: {
    fontFamily: OTT.mono,
    fontSize: 9,
    color: OTT.textMuted,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: OTT.borderMuted,
    marginVertical: 2,
  },
  intentBtn: {
    gap: 2,
  },
  intent: {
    fontFamily: OTT.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: OTT.warningAmber,
  },
  intentHint: {
    fontFamily: OTT.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    color: OTT.textMuted,
  },
  intentSlumped: {
    fontFamily: OTT.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#C45AAE',
  },
  slumpExecutable: {
    fontFamily: OTT.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: OTT.textPrimary,
  },
  slumpRevival: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: OTT.textSecondary,
  },
  switcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  switcherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderMuted,
    backgroundColor: 'rgba(8, 12, 14, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 2,
  },
  switcherLabel: {
    flexShrink: 1,
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: OTT.textSecondary,
  },
  switcherGlyph: {
    fontFamily: OTT.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#C45AAE',
  },
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  detailDismiss: {
    ...StyleSheet.absoluteFill,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: OTT.cyanSelect,
    backgroundColor: 'rgba(8, 12, 14, 0.96)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    zIndex: 2,
  },
  detailTitle: {
    fontFamily: OTT.mono,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: OTT.cyanSelect,
  },
  detailMeta: {
    fontFamily: OTT.mono,
    fontSize: 11,
    color: OTT.warningAmber,
    letterSpacing: 0.4,
  },
  detailBody: {
    fontFamily: OTT.mono,
    fontSize: 12,
    lineHeight: 15,
    color: OTT.textPrimary,
  },
  detailClose: {
    alignSelf: 'flex-end',
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  detailCloseLabel: {
    fontFamily: OTT.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: OTT.textSecondary,
  },
});
