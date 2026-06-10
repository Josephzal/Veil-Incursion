import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { ALL_GRID_SLOTS } from '../../types/combatGrid';
import { laneForSlot } from '../../types/combatGrid';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';

const FRONTLINE_SCALE = 1;
const BACKLINE_SCALE = 0.75;

const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

interface SlotLayout {
  left: `${number}%`;
  top?: `${number}%`;
  bottom?: `${number}%`;
  width: `${number}%`;
  height: `${number}%`;
  scale: number;
  zIndex: number;
}

/** Frontline slots match player column height; backline sits higher and smaller. */
const ARENA_SLOT_LAYOUT: Record<CombatGridSlotId, SlotLayout> = {
  FL_0: { left: '0%', bottom: '2%', width: '50%', height: '78%', scale: FRONTLINE_SCALE, zIndex: 4 },
  FL_1: { left: '50%', bottom: '2%', width: '50%', height: '78%', scale: FRONTLINE_SCALE, zIndex: 3 },
  BL_0: { left: '4%', top: '2%', width: '44%', height: '50%', scale: BACKLINE_SCALE, zIndex: 1 },
  BL_1: { left: '54%', top: '4%', width: '44%', height: '50%', scale: BACKLINE_SCALE, zIndex: 2 },
};

interface CombatEnemyGridProps {
  units: CombatGridUnitView[];
  targetingActive: boolean;
  onUnitPress: (unitId: string) => void;
  borderColor?: string;
  accentColor: string;
  mutedColor: string;
  variant?: 'arena' | 'compact';
}

function InvisibleSlotAnchor({ layout }: { layout: SlotLayout }): React.JSX.Element {
  return (
    <View
      style={[
        styles.slotAnchor,
        {
          left: layout.left,
          top: layout.top,
          bottom: layout.bottom,
          width: layout.width,
          height: layout.height,
          zIndex: layout.zIndex,
          transform: [{ scale: layout.scale }],
        },
      ]}
      pointerEvents="none"
    />
  );
}

export default function CombatEnemyGrid({
  units,
  targetingActive,
  onUnitPress,
  accentColor,
  mutedColor,
  variant = 'arena',
}: CombatEnemyGridProps): React.JSX.Element {
  const isArena = variant === 'arena';
  const unitBySlot = new Map(
    units.filter((u) => !u.isDead).map((u) => [u.slot, u]),
  );

  const renderSlot = (slot: CombatGridSlotId) => {
    const unit = unitBySlot.get(slot);
    const layout = ARENA_SLOT_LAYOUT[slot];
    const isBackline = laneForSlot(slot) === 'BACKLINE';

    if (!isArena) {
      if (!unit) {
        return <View key={slot} style={styles.cellEmpty} />;
      }
      return (
        <Pressable key={slot} onPress={() => onUnitPress(unit.unitId)} style={styles.cell}>
          <CombatEnemyUnit
            unit={unit}
            targetingActive={targetingActive}
            accentColor={accentColor}
            mutedColor={mutedColor}
            isBackline={isBackline}
          />
        </Pressable>
      );
    }

    if (!unit) {
      return <InvisibleSlotAnchor key={slot} layout={layout} />;
    }

    return (
      <Pressable
        key={slot}
        onPress={() => onUnitPress(unit.unitId)}
        style={[
          styles.slotAnchor,
          {
            left: layout.left,
            top: layout.top,
            bottom: layout.bottom,
            width: layout.width,
            height: layout.height,
            zIndex: layout.zIndex,
          },
        ]}
      >
        <CombatEnemyUnit
          unit={unit}
          targetingActive={targetingActive}
          accentColor={accentColor}
          mutedColor={mutedColor}
          isBackline={isBackline}
          spriteScale={layout.scale}
        />
      </Pressable>
    );
  };

  if (isArena) {
    return (
      <View style={styles.arenaRoot}>
        {ALL_GRID_SLOTS.map((slot) => renderSlot(slot))}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {renderSlot(SLOT_ORDER[0])}
        {renderSlot(SLOT_ORDER[1])}
      </View>
      <View style={styles.row}>
        {renderSlot(SLOT_ORDER[2])}
        {renderSlot(SLOT_ORDER[3])}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arenaRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  slotAnchor: {
    position: 'absolute',
    overflow: 'visible',
  },
  grid: {
    width: '100%',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    minHeight: 0,
  },
  cell: {
    flex: 1,
    minHeight: 88,
  },
  cellEmpty: {
    flex: 1,
    minHeight: 64,
  },
});
