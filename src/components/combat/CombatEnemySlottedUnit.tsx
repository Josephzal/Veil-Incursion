import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { CombatGridSlotId } from '../../types/combatGrid';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';
import {
  ARENA_SLOT_TRANSITION_MS,
  type ArenaLayoutMode,
  type EnemySlotLayout,
  resolveArenaSlotLayout,
  SOLO_ARENA_SLOT,
  slotLayoutToAnchorRect,
} from './combatEnemyBarLayout';

const DEPTH_SCALE_PIVOT_Y = 76;
const SLOT_EASING = Easing.out(Easing.cubic);

interface CombatEnemySlottedUnitProps {
  unit: CombatGridUnitView;
  slot: CombatGridSlotId;
  layoutMode: ArenaLayoutMode;
  arenaWidth: number;
  arenaHeight: number;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  onUnitPress?: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
}

function applySlotMetrics(
  rect: ReturnType<typeof slotLayoutToAnchorRect>,
  layout: EnemySlotLayout,
  left: SharedValue<number>,
  top: SharedValue<number>,
  width: SharedValue<number>,
  height: SharedValue<number>,
  unitScale: SharedValue<number>,
  unitTranslateY: SharedValue<number>,
  animate: boolean,
): void {
  const timing = { duration: ARENA_SLOT_TRANSITION_MS, easing: SLOT_EASING };
  if (animate) {
    left.value = withTiming(rect.left, timing);
    top.value = withTiming(rect.top, timing);
    width.value = withTiming(rect.width, timing);
    height.value = withTiming(rect.height, timing);
    unitScale.value = withTiming(layout.unitScale, timing);
    unitTranslateY.value = withTiming(layout.unitTranslateY, timing);
    return;
  }

  left.value = rect.left;
  top.value = rect.top;
  width.value = rect.width;
  height.value = rect.height;
  unitScale.value = layout.unitScale;
  unitTranslateY.value = layout.unitTranslateY;
}

/** Enemy graphic + hitbox layer that slides between fixed slot anchors. */
export default function CombatEnemySlottedUnit({
  unit,
  slot,
  layoutMode,
  arenaWidth,
  arenaHeight,
  targetingActive,
  accentColor,
  mutedColor,
  onUnitPress,
  onUnitDissolveComplete,
}: CombatEnemySlottedUnitProps): React.JSX.Element {
  const effectiveSlot = layoutMode === 'solo' ? SOLO_ARENA_SLOT : slot;
  const layout = resolveArenaSlotLayout(effectiveSlot, layoutMode);
  const prevSlotRef = useRef(effectiveSlot);
  const hasMountedRef = useRef(false);

  const left = useSharedValue(0);
  const top = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const unitScale = useSharedValue(layout.unitScale);
  const unitTranslateY = useSharedValue(layout.unitTranslateY);

  useEffect(() => {
    if (arenaWidth <= 0 || arenaHeight <= 0) return;

    const nextLayout = resolveArenaSlotLayout(effectiveSlot, layoutMode);
    const rect = slotLayoutToAnchorRect(nextLayout, arenaWidth, arenaHeight);
    const slotChanged = hasMountedRef.current && prevSlotRef.current !== effectiveSlot;
    const animate = slotChanged;

    applySlotMetrics(rect, nextLayout, left, top, width, height, unitScale, unitTranslateY, animate);
    prevSlotRef.current = effectiveSlot;
    hasMountedRef.current = true;
  }, [arenaHeight, arenaWidth, effectiveSlot, height, layoutMode, left, top, unitScale, unitTranslateY, width]);

  const containerStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: left.value,
    top: top.value,
    width: width.value,
    height: height.value,
  }));

  const depthStyle = useAnimatedStyle(() => {
    const scale = unitScale.value;
    const translateY = unitTranslateY.value;

    if (scale === 1 && translateY === 0) {
      return { transform: [] };
    }

    if (scale < 1) {
      return {
        transform: [
          { translateY: DEPTH_SCALE_PIVOT_Y },
          { scale },
          { translateY: -DEPTH_SCALE_PIVOT_Y + translateY },
        ],
      };
    }

    return {
      transform: [{ translateY }, { scale }],
    };
  });

  const handleDissolveComplete = useCallback(() => {
    onUnitDissolveComplete?.(unit.unitId);
  }, [onUnitDissolveComplete, unit.unitId]);

  return (
    <Animated.View
      style={[styles.slotUnit, containerStyle, { zIndex: layout.zIndex }]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.enemyUnit, depthStyle]} pointerEvents="box-none">
        <CombatEnemyUnit
          unit={unit}
          targetingActive={targetingActive}
          accentColor={accentColor}
          mutedColor={mutedColor}
          constrainSpriteHeight
          layoutUnitScale={layout.unitScale}
          onPress={onUnitPress ? () => onUnitPress(unit.unitId) : undefined}
          onDissolveComplete={onUnitDissolveComplete ? handleDissolveComplete : undefined}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slotUnit: {
    overflow: 'visible',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  enemyUnit: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
