import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { laneForSlot } from '../../types/combatGrid';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';
import CombatEnemyDissolveEffect from './CombatEnemyDissolveEffect';
import CombatEnemyWrapper, {
  GROUP_ENEMY_WRAPPER_WIDTH,
  SOLO_ENEMY_WRAPPER_WIDTH,
} from './CombatEnemyWrapper';
import {
  BACKLINE_ROW_HEIGHT,
  BACKLINE_SLOTS,
  backlineMeleeDashDelta,
  FRONTLINE_ROW_HEIGHT,
  FRONTLINE_ROW_OVERLAP_MARGIN,
  FRONTLINE_SLOTS,
  type ArenaGridVariant,
  type ArenaLayoutMode,
  resolveSlotPresentation,
  SOLO_ARENA_SLOT,
  staggeredSlotStyle,
  STAGGERED_SLOT_WIDTH_PCT,
  ENEMY_ARENA_VERTICAL_SHIFT_RATIO,
  FRONTLINE_BATTLEFIELD_LIFT_RATIO,
  SOLO_BATTLEFIELD_LIFT_RATIO,
} from './combatEnemyBarLayout';

const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

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
  /** Arena grid geometry — flex rows or absolute staggered 2.5D. */
  arenaGridVariant?: ArenaGridVariant;
}

interface BattlefieldSlotProps {
  slot: CombatGridSlotId;
  unit: CombatGridUnitView | undefined;
  layoutMode: ArenaLayoutMode;
  arenaWidth: number;
  arenaHeight: number;
  wrapperWidth: `${number}%`;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  onUnitPress: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
  wrapperStyle?: ViewStyle;
  arenaGridVariant?: ArenaGridVariant;
}

function BattlefieldSlot({
  slot,
  unit,
  layoutMode,
  arenaWidth,
  arenaHeight,
  wrapperWidth,
  targetingActive,
  accentColor,
  mutedColor,
  onUnitPress,
  onUnitDissolveComplete,
  wrapperStyle,
  arenaGridVariant = 'flex',
}: BattlefieldSlotProps): React.JSX.Element {
  const presentation = resolveSlotPresentation(slot, layoutMode, arenaGridVariant);

  const meleeDashDelta = useMemo(() => {
    if (!unit || arenaWidth <= 0 || arenaHeight <= 0) return undefined;
    if (laneForSlot(slot) !== 'BACKLINE') return undefined;
    return backlineMeleeDashDelta(slot, layoutMode, arenaWidth, arenaHeight, arenaGridVariant);
  }, [arenaGridVariant, arenaHeight, arenaWidth, layoutMode, slot, unit]);

  const handleDissolveComplete = useCallback(() => {
    if (unit) onUnitDissolveComplete?.(unit.unitId);
  }, [onUnitDissolveComplete, unit]);

  const dissolving = unit != null && (unit.dissolveSeq ?? 0) > 0 && !unit.dissolveHidden;
  const zIndex = unit?.isBacklineDashing ? 50 : presentation.zIndex;

  return (
    <CombatEnemyWrapper
      width={wrapperWidth}
      scale={presentation.unitScale}
      zIndex={zIndex}
      style={wrapperStyle}
    >
      {unit ? (
        <CombatEnemyDissolveEffect
          dissolveSeq={unit.dissolveSeq}
          active={dissolving}
          portraitSource={unit.portraitSource}
          onComplete={onUnitDissolveComplete ? handleDissolveComplete : undefined}
        >
          <CombatEnemyUnit
            unit={unit}
            targetingActive={targetingActive}
            accentColor={accentColor}
            mutedColor={mutedColor}
            variant="arena"
            layoutUnitScale={presentation.unitScale}
            meleeDashDelta={meleeDashDelta}
            skipDissolveEffect
            onPress={() => onUnitPress(unit.unitId)}
          />
        </CombatEnemyDissolveEffect>
      ) : null}
    </CombatEnemyWrapper>
  );
}

interface EnemyUnitStackProps {
  unit: CombatGridUnitView;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  onUnitPress?: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
}

/** Compact grid cell — sprite only; vitals render in the intel panel. */
function EnemyUnitStack({
  unit,
  targetingActive,
  accentColor,
  mutedColor,
  onUnitPress,
  onUnitDissolveComplete,
}: EnemyUnitStackProps): React.JSX.Element {
  const handleDissolveComplete = useCallback(() => {
    onUnitDissolveComplete?.(unit.unitId);
  }, [onUnitDissolveComplete, unit.unitId]);

  return (
    <View style={styles.compactUnit} pointerEvents="box-none">
      <CombatEnemyUnit
        unit={unit}
        targetingActive={targetingActive}
        accentColor={accentColor}
        mutedColor={mutedColor}
        variant="compact"
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
  arenaGridVariant = 'flex',
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

  const unitForSlot = useCallback(
    (slot: CombatGridSlotId) => visibleUnits.find((entry) => entry.slot === slot),
    [visibleUnits],
  );

  const renderCompactSlot = (slot: CombatGridSlotId) => {
    const unit = visibleUnits.find((entry) => entry.slot === slot);

    if (!unit) {
      return <View key={slot} style={styles.cellEmpty} />;
    }

    return (
      <View key={slot} style={styles.cell} pointerEvents="box-none">
        <EnemyUnitStack
          unit={unit}
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
    const wrapperWidth = layoutMode === 'solo' ? SOLO_ENEMY_WRAPPER_WIDTH : GROUP_ENEMY_WRAPPER_WIDTH;
    const soloUnit =
      visibleUnits.find((entry) => entry.slot === SOLO_ARENA_SLOT) ?? visibleUnits[0];

    const slotProps = {
      layoutMode,
      arenaWidth: arenaSize.width,
      arenaHeight: arenaSize.height,
      wrapperWidth,
      targetingActive,
      accentColor,
      mutedColor,
      onUnitPress,
      onUnitDissolveComplete,
      arenaGridVariant,
    };

    const arenaVerticalShiftStyle: ViewStyle | undefined =
      arenaSize.height > 0
        ? { transform: [{ translateY: arenaSize.height * ENEMY_ARENA_VERTICAL_SHIFT_RATIO }] }
        : undefined;

    if (arenaGridVariant === 'staggered') {
      const slots = layoutMode === 'solo'
        ? [SOLO_ARENA_SLOT]
        : [...BACKLINE_SLOTS, ...FRONTLINE_SLOTS];

      return (
        <View
          style={styles.staggeredArena}
          onLayout={handleArenaLayout}
          pointerEvents="box-none"
        >
          {slots.map((slot) => {
            const style = staggeredSlotStyle(slot, layoutMode);
            const slotStyle: ViewStyle = {
              position: 'absolute',
              bottom: style.bottom,
              zIndex: style.zIndex,
              width: `${STAGGERED_SLOT_WIDTH_PCT}%`,
              ...(style.left != null ? { left: style.left } : { right: style.right }),
            };
            return (
              <BattlefieldSlot
                key={slot}
                slot={slot}
                unit={layoutMode === 'solo' ? soloUnit : unitForSlot(slot)}
                wrapperStyle={slotStyle}
                {...slotProps}
              />
            );
          })}
        </View>
      );
    }

    if (layoutMode === 'solo') {
      const soloLiftStyle: ViewStyle | undefined =
        arenaSize.height > 0
          ? { transform: [{ translateY: -arenaSize.height * SOLO_BATTLEFIELD_LIFT_RATIO }] }
          : undefined;

      return (
        <View
          style={[styles.battlefieldContainer, styles.soloBattlefieldContainer, arenaVerticalShiftStyle]}
          onLayout={handleArenaLayout}
          pointerEvents="box-none"
        >
          <BattlefieldSlot
            slot={SOLO_ARENA_SLOT}
            unit={soloUnit}
            
            {...slotProps}
          />
        </View>
      );
    }

    const frontlineLiftStyle: ViewStyle | undefined =
      arenaSize.height > 0
        ? { transform: [{ translateY: -arenaSize.height * FRONTLINE_BATTLEFIELD_LIFT_RATIO }] }
        : undefined;

    return (
      <View
        style={[styles.battlefieldContainer, arenaVerticalShiftStyle]}
        onLayout={handleArenaLayout}
        pointerEvents="box-none"
      >
        <View style={styles.backlineRow} pointerEvents="box-none">
          {BACKLINE_SLOTS.map((slot) => (
            <BattlefieldSlot
              key={slot}
              slot={slot}
              unit={unitForSlot(slot)}
              {...slotProps}
            />
          ))}
        </View>

        <View style={styles.frontlineRow} pointerEvents="box-none">
          {FRONTLINE_SLOTS.map((slot) => (
            <BattlefieldSlot
              key={slot}
              slot={slot}
              unit={unitForSlot(slot)}
              wrapperStyle={frontlineLiftStyle}
              {...slotProps}
            />
          ))}
        </View>
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
  staggeredArena: {
    position: 'absolute',
    top: 0,
    right: 60,
    width: '42%',
    height: '100%',
    overflow: 'visible',
  },
  battlefieldContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    overflow: 'visible',
    paddingRight: '30%'
    
  },
  backlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    height: BACKLINE_ROW_HEIGHT,
    zIndex: 1,
    overflow: 'visible',
    paddingBottom: '10%'
  },
  frontlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    height: FRONTLINE_ROW_HEIGHT,
    marginTop: FRONTLINE_ROW_OVERLAP_MARGIN,
    zIndex: 2,
    overflow: 'visible',
    paddingBottom: '70%'
  },
  soloBattlefieldContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 0,
  },
  compactUnit: {
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
