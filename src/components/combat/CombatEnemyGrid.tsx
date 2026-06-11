import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { ALL_GRID_SLOTS } from '../../types/combatGrid';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';
import CombatEnemySlotBars from './CombatEnemySlotBars';
import {
  ENEMY_ARENA_SLOT_LAYOUT,
  ENEMY_HEALTH_BAR_SPRITE_GAP,
  arenaSlotGaugeWidth,
  enemyUnitDepthTransform,
  resolveArenaSlotLayout,
  slotWidthPercent,
} from './combatEnemyBarLayout';

const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

interface CombatEnemyGridProps {
  units: CombatGridUnitView[];
  targetingActive: boolean;
  onUnitPress: (unitId: string) => void;
  borderColor?: string;
  accentColor: string;
  mutedColor: string;
  variant?: 'arena' | 'compact';
}

function InvisibleSlotAnchor({ slot }: { slot: CombatGridSlotId }): React.JSX.Element {
  const layout = ENEMY_ARENA_SLOT_LAYOUT[slot];
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
        },
      ]}
      pointerEvents="none"
    />
  );
}

interface EnemyUnitStackProps {
  unit: CombatGridUnitView;
  layout: ReturnType<typeof resolveArenaSlotLayout>;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
}

/** Sprite + health bars grouped and depth-scaled together. */
function EnemyUnitStack({
  unit,
  layout,
  targetingActive,
  accentColor,
  mutedColor,
}: EnemyUnitStackProps): React.JSX.Element {
  const gaugeWidth = arenaSlotGaugeWidth(
    slotWidthPercent(layout.width),
    layout.unitScale,
  );

  return (
    <View
      style={[
        styles.enemyUnit,
        { transform: enemyUnitDepthTransform(layout) },
      ]}
    >
      <View style={styles.healthBarContainer}>
        <CombatEnemySlotBars unit={unit} trackWidth={gaugeWidth} />
      </View>
      <CombatEnemyUnit
        unit={unit}
        targetingActive={targetingActive}
        accentColor={accentColor}
        mutedColor={mutedColor}
      />
    </View>
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
  const liveUnits = units.filter((unit) => !unit.isDead);
  const unitBySlot = new Map(liveUnits.map((unit) => [unit.slot, unit]));

  const renderSlot = (slot: CombatGridSlotId) => {
    const unit = unitBySlot.get(slot);
    const layout = isArena ? resolveArenaSlotLayout(slot, liveUnits) : ENEMY_ARENA_SLOT_LAYOUT[slot];
    if (!isArena) {
      if (!unit) {
        return <View key={slot} style={styles.cellEmpty} />;
      }
      return (
        <Pressable key={slot} onPress={() => onUnitPress(unit.unitId)} style={styles.cell}>
          <EnemyUnitStack
            unit={unit}
            layout={layout}
            targetingActive={targetingActive}
            accentColor={accentColor}
            mutedColor={mutedColor}
          />
        </Pressable>
      );
    }

    if (!unit) {
      return <InvisibleSlotAnchor key={slot} slot={slot} />;
    }

    return (
      <Pressable
        key={slot}
        onPress={() => onUnitPress(unit.unitId)}
        style={[
          styles.slotAnchor,
          styles.slotFill,
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
        <EnemyUnitStack
          unit={unit}
          layout={layout}
          targetingActive={targetingActive}
          accentColor={accentColor}
          mutedColor={mutedColor}
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
    overflow: 'hidden',
  },
  slotAnchor: {
    position: 'absolute',
  },
  slotFill: {
    overflow: 'visible',
  },
  enemyUnit: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  healthBarContainer: {
    alignItems: 'center',
    marginBottom: ENEMY_HEALTH_BAR_SPRITE_GAP,
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
    justifyContent: 'flex-end',
  },
  cellEmpty: {
    flex: 1,
    minHeight: 64,
  },
});
