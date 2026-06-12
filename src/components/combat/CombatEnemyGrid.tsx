import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';
import {
  ENEMY_ARENA_SLOT_LAYOUT,
  enemyUnitDepthTransform,
  resolveArenaSlotLayout,
} from './combatEnemyBarLayout';

const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];
/** Backline first so frontline paints on top for 2.5D overlap. */
const ARENA_DEPTH_RENDER_ORDER: CombatGridSlotId[] = ['BL_0', 'BL_1', 'FL_0', 'FL_1'];

interface CombatEnemyGridProps {
  units: CombatGridUnitView[];
  targetingActive: boolean;
  onUnitPress: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
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
  constrainSpriteHeight?: boolean;
  onUnitPress?: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
}

/** Sprite only — vitals render in the intel panel. */
function EnemyUnitStack({
  unit,
  layout,
  targetingActive,
  accentColor,
  mutedColor,
  constrainSpriteHeight = false,
  onUnitPress,
  onUnitDissolveComplete,
}: EnemyUnitStackProps): React.JSX.Element {
  const handleDissolveComplete = useCallback(() => {
    onUnitDissolveComplete?.(unit.unitId);
  }, [onUnitDissolveComplete, unit.unitId]);

  return (
    <View
      style={[
        styles.enemyUnit,
        { transform: enemyUnitDepthTransform(layout) },
      ]}
      pointerEvents="box-none"
    >
      <CombatEnemyUnit
        unit={unit}
        targetingActive={targetingActive}
        accentColor={accentColor}
        mutedColor={mutedColor}
        constrainSpriteHeight={constrainSpriteHeight}
        layoutUnitScale={layout.unitScale}
        onPress={onUnitPress ? () => onUnitPress(unit.unitId) : undefined}
        onDissolveComplete={onUnitDissolveComplete ? handleDissolveComplete : undefined}
      />
    </View>
  );
}

export default function CombatEnemyGrid({
  units,
  targetingActive,
  onUnitPress,
  onUnitDissolveComplete,
  accentColor,
  mutedColor,
  variant = 'arena',
}: CombatEnemyGridProps): React.JSX.Element {
  const isArena = variant === 'arena';
  const layoutUnits = units;

  const renderSlot = (slot: CombatGridSlotId) => {
    const unit = units.find((entry) => entry.slot === slot && (
      !entry.isDead || (entry.dissolveSeq ?? 0) > 0
    ));
    const layout = isArena ? resolveArenaSlotLayout(slot, layoutUnits) : ENEMY_ARENA_SLOT_LAYOUT[slot];
    if (!isArena) {
      if (!unit) {
        return <View key={slot} style={styles.cellEmpty} />;
      }
      return (
        <View key={slot} style={styles.cell} pointerEvents="box-none">
          <EnemyUnitStack
            unit={unit}
            layout={layout}
            targetingActive={targetingActive}
            accentColor={accentColor}
            mutedColor={mutedColor}
            constrainSpriteHeight={isArena}
            onUnitPress={onUnitPress}
            onUnitDissolveComplete={onUnitDissolveComplete}
          />
        </View>
      );
    }

    if (!unit) {
      return <InvisibleSlotAnchor key={slot} slot={slot} />;
    }

    return (
      <View
        key={slot}
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
        pointerEvents="box-none"
      >
        <EnemyUnitStack
          unit={unit}
          layout={layout}
          targetingActive={targetingActive}
          accentColor={accentColor}
          mutedColor={mutedColor}
          constrainSpriteHeight
          onUnitPress={onUnitPress}
          onUnitDissolveComplete={onUnitDissolveComplete}
        />
      </View>
    );
  };

  if (isArena) {
    return (
      <View style={styles.arenaRoot} pointerEvents="box-none">
        {ARENA_DEPTH_RENDER_ORDER.map((slot) => renderSlot(slot))}
      </View>
    );
  }

  return (
    <View style={styles.grid} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        {renderSlot(SLOT_ORDER[0])}
        {renderSlot(SLOT_ORDER[1])}
      </View>
      <View style={styles.row} pointerEvents="box-none">
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
  },
  slotFill: {
    overflow: 'visible',
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  enemyUnit: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
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
