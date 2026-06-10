import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { slotLabel } from '../../types/combatGrid';
import type { CombatGridSlotId } from '../../types/combatGrid';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { GAUGE_HOSTILE_HP, GAUGE_TRACK_BORDER } from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';
import CombatEnemyHeaderBand from './CombatEnemyHeaderBand';
import type { CombatEnemyTelemetry } from '../../utils/combatTelemetryFormat';

const MONO = 'monospace';
const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

export type CombatGridUnitView = CombatGridUnitSnapshot & {
  portraitSource: ImageSourcePropType;
};

interface CombatEnemyGridProps {
  units: CombatGridUnitView[];
  expandedUnitId: string | null;
  targetingActive: boolean;
  onUnitPress: (unitId: string) => void;
  borderColor: string;
  accentColor: string;
  mutedColor: string;
}

function toEnemyTelemetry(unit: CombatGridUnitView): CombatEnemyTelemetry {
  return {
    unitId: unit.unitId,
    designation: unit.designation,
    currentHp: unit.currentHp,
    maxHp: unit.maxHp,
    intent: unit.intent,
    affinity: unit.affinity,
    fractureGauge: unit.fractureGauge,
    fractureMax: unit.fractureMax,
    kineticArmor: unit.kineticArmor,
    occultWards: unit.occultWards,
    combatTags: unit.combatTags,
  };
}

export default function CombatEnemyGrid({
  units,
  expandedUnitId,
  targetingActive,
  onUnitPress,
  borderColor,
  accentColor,
  mutedColor,
}: CombatEnemyGridProps): React.JSX.Element {
  const unitBySlot = new Map(units.map((u) => [u.slot, u]));

  const renderCell = (slot: CombatGridSlotId) => {
    const unit = unitBySlot.get(slot);
    const empty = !unit || unit.isDead;

    if (empty) {
      return (
        <View key={slot} style={[styles.cell, styles.cellEmpty, { borderColor }]}>
          <Text style={[styles.slotTag, { color: mutedColor }]}>{slotLabel(slot)}</Text>
          <Text style={[styles.emptyLabel, { color: mutedColor }]}>—</Text>
        </View>
      );
    }

    const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;
    const isExpanded = expandedUnitId === unit.unitId;
    const border = isExpanded
      ? accentColor
      : unit.isSelected
        ? accentColor
        : unit.isFocused
          ? 'rgba(251, 191, 36, 0.85)'
          : targetingActive && unit.isTargetable
            ? 'rgba(251, 191, 36, 0.75)'
            : borderColor;

    return (
      <Pressable
        key={slot}
        onPress={() => onUnitPress(unit.unitId)}
        style={[
          styles.cell,
          { borderColor: border, opacity: unit.isTargetable || !targetingActive ? 1 : 0.55 },
        ]}
      >
        <CombatHorizontalGauge
          fillColor={GAUGE_HOSTILE_HP}
          ratio={hpRatio}
          trackBorderColor={GAUGE_TRACK_BORDER}
          width="100%"
          compact
        />

        <View style={styles.portraitFrame}>
          <Image
            source={unit.portraitSource}
            style={styles.portrait}
            resizeMode="contain"
          />
        </View>

        {!isExpanded ? (
          <Text style={[styles.hpCaption, { color: GAUGE_HOSTILE_HP }]}>
            {`${unit.currentHp}/${unit.maxHp}`}
          </Text>
        ) : null}

        {isExpanded ? (
          <View style={styles.expandedHud} pointerEvents="none">
            <CombatEnemyHeaderBand
              enemy={toEnemyTelemetry(unit)}
              intentMutedColor={mutedColor}
              arena
            />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {renderCell(SLOT_ORDER[0])}
        {renderCell(SLOT_ORDER[1])}
      </View>
      <Text style={[styles.laneLabel, { color: mutedColor }]}>BACKLINE</Text>
      <View style={styles.row}>
        {renderCell(SLOT_ORDER[2])}
        {renderCell(SLOT_ORDER[3])}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  laneLabel: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginVertical: 1,
  },
  cell: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 2,
    minHeight: 88,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    position: 'relative',
    overflow: 'visible',
  },
  cellEmpty: {
    opacity: 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 64,
  },
  slotTag: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.5,
  },
  portraitFrame: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portrait: {
    width: '100%',
    height: '100%',
    maxHeight: 52,
  },
  hpCaption: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  emptyLabel: {
    fontFamily: MONO,
    fontSize: 8,
  },
  expandedHud: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: '100%',
    marginTop: 2,
    zIndex: 20,
    elevation: 8,
  },
});
