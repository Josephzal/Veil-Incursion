import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';
import CombatEnemySlottedUnit from './CombatEnemySlottedUnit';
import {
  arenaSlotsForMode,
  ENEMY_ARENA_SLOT_LAYOUT,
  enemyUnitDepthTransform,
  type ArenaLayoutMode,
  resolveArenaSlotLayout,
  slotAnchorStyle,
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
  /** Locked at encounter start — prevents mid-fight solo reflow. */
  layoutMode?: ArenaLayoutMode;
}

interface FixedSlotAnchorProps {
  slot: CombatGridSlotId;
  layoutMode: ArenaLayoutMode;
}

/** Permanent slot box — same bounds whether occupied or empty. */
function FixedSlotAnchor({ slot, layoutMode }: FixedSlotAnchorProps): React.JSX.Element {
  const layout = resolveArenaSlotLayout(slot, layoutMode);
  return (
    <View
      style={[styles.slotAnchor, slotAnchorStyle(layout)]}
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

/** Compact grid cell — sprite only; vitals render in the intel panel. */
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
  layoutMode = 'group',
}: CombatEnemyGridProps): React.JSX.Element {
  const isArena = variant === 'arena';
  const [arenaSize, setArenaSize] = useState({ width: 0, height: 0 });

  const handleArenaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArenaSize((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  }, []);

  const visibleUnits = units.filter((unit) => {
    if (unit.dissolveHidden) return false;
    if (!unit.isDead) return true;
    return (unit.dissolveSeq ?? 0) > 0;
  });

  const renderCompactSlot = (slot: CombatGridSlotId) => {
    const unit = visibleUnits.find((entry) => entry.slot === slot);
    const layout = ENEMY_ARENA_SLOT_LAYOUT[slot];

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
          onUnitPress={onUnitPress}
          onUnitDissolveComplete={onUnitDissolveComplete}
        />
      </View>
    );
  };

  if (isArena) {
    const anchorSlots = arenaSlotsForMode(layoutMode);
    const anchorRenderOrder = layoutMode === 'solo'
      ? anchorSlots
      : ARENA_DEPTH_RENDER_ORDER;

    return (
      <View style={styles.arenaRoot} onLayout={handleArenaLayout} pointerEvents="box-none">
        {anchorRenderOrder.map((slot) => (
          <FixedSlotAnchor key={`anchor-${slot}`} slot={slot} layoutMode={layoutMode} />
        ))}

        {visibleUnits.map((unit) => (
          <CombatEnemySlottedUnit
            key={unit.unitId}
            unit={unit}
            slot={unit.slot}
            layoutMode={layoutMode}
            arenaWidth={arenaSize.width}
            arenaHeight={arenaSize.height}
            targetingActive={targetingActive}
            accentColor={accentColor}
            mutedColor={mutedColor}
            onUnitPress={onUnitPress}
            onUnitDissolveComplete={onUnitDissolveComplete}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.grid} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        {renderCompactSlot(SLOT_ORDER[0])}
        {renderCompactSlot(SLOT_ORDER[1])}
      </View>
      <View style={styles.row} pointerEvents="box-none">
        {renderCompactSlot(SLOT_ORDER[2])}
        {renderCompactSlot(SLOT_ORDER[3])}
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
    overflow: 'visible',
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
