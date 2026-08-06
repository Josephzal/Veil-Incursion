import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { CombatGridSlotId } from '../../types/combatGrid';
import { laneForSlot } from '../../types/combatGrid';
import HapticPressable from '../HapticPressable';
import type { CombatGridUnitView } from './CombatEnemyUnit';
import CombatEnemyUnit from './CombatEnemyUnit';
import CombatEnemyDissolveEffect from './CombatEnemyDissolveEffect';
import CombatEnemyWrapper, {
  ENEMY_WRAPPER_ASPECT_RATIO,
  GROUP_ENEMY_WRAPPER_WIDTH,
  SOLO_ENEMY_WRAPPER_WIDTH,
} from './CombatEnemyWrapper';
import { shouldShowUnitInArenaGrid } from '../../data/combatSquadEngine';
import {
  BACKLINE_ROW_HEIGHT,
  BACKLINE_SLOTS,
  BACKLINE_TARGET_OVERLAY_Z_INDEX,
  backlineMeleeDashDelta,
  ENEMY_HITBOX_DEBUG,
  FRONTLINE_ROW_HEIGHT,
  FRONTLINE_ROW_OVERLAP_MARGIN,
  FRONTLINE_SLOTS,
  FRONTLINE_TARGET_OVERLAY_Z_INDEX,
  type ArenaGridVariant,
  type ArenaLayoutMode,
  resolveEnemyHitbox,
  resolveSlotPresentation,
  SOLO_ARENA_SLOT,
  staggeredSlotStyle,
  STAGGERED_SLOT_WIDTH_PCT,
  ENEMY_ARENA_VERTICAL_SHIFT_RATIO,
  FRONTLINE_BATTLEFIELD_LIFT_RATIO,
  SOLO_BATTLEFIELD_LIFT_RATIO,
} from './combatEnemyBarLayout';
import {
  getWardenStrikeActiveTargetId,
  isWardenStrikePresentationActive,
  subscribeWardenStrikePresentation,
} from '../../data/wardenStrikePresentation';

const HITBOX_DEBUG_FILL = 'rgba(255, 0, 0, 0.35)';

interface SlotHitOverlayProps {
  slot: CombatGridSlotId;
  unit: CombatGridUnitView;
  layoutMode: ArenaLayoutMode;
  onUnitPress: (unitId: string) => void;
  onUnitHoverIn?: (unitId: string) => void;
  onUnitHoverOut?: (unitId: string) => void;
  overlayZIndex: number;
}

/** Transparent tap layer — lives above slot art so overlapping sprites cannot steal presses. */
function SlotHitOverlay({
  slot,
  unit,
  layoutMode,
  onUnitPress,
  onUnitHoverIn,
  onUnitHoverOut,
  overlayZIndex,
}: SlotHitOverlayProps): React.JSX.Element {
  const presentation = resolveSlotPresentation(slot, layoutMode, 'staggered');
  const anchor = staggeredSlotStyle(slot, layoutMode);
  const hitbox = resolveEnemyHitbox(slot, presentation.unitScale, unit.isAlpha === true);
  const scaled =
    presentation.unitScale !== 1
      ? { transform: [{ scale: presentation.unitScale }] as ViewStyle['transform'] }
      : undefined;

  const hoverIn = () => onUnitHoverIn?.(unit.unitId);
  const hoverOut = () => onUnitHoverOut?.(unit.unitId);

  return (
    <View
      style={[
        styles.slotHitFrame,
        {
          bottom: anchor.bottom,
          width: `${STAGGERED_SLOT_WIDTH_PCT}%`,
          zIndex: overlayZIndex,
          ...(anchor.left != null ? { left: anchor.left } : { right: anchor.right }),
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.slotHitInner, scaled]} pointerEvents="box-none">
        <HapticPressable
          sfx={false}
          onPress={() => onUnitPress(unit.unitId)}
          onHoverIn={hoverIn}
          onHoverOut={hoverOut}
          {...({
            onMouseEnter: hoverIn,
            onMouseLeave: hoverOut,
          } as object)}
          style={[
            styles.slotHitPressable,
            hitbox,
            ENEMY_HITBOX_DEBUG ? styles.slotHitDebug : null,
          ]}
        />
      </View>
    </View>
  );
}

const SLOT_ORDER: CombatGridSlotId[] = ['FL_0', 'FL_1', 'BL_0', 'BL_1'];

interface CombatEnemyGridProps {
  units: CombatGridUnitView[];
  targetingActive: boolean;
  /** Staged ability awaiting hostile selection — drives target reticles. */
  abilityArmed?: boolean;
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
  /** Class damage blood-shard burst on enemy center. */
  bloodBurstVariant?: 'aegis' | 'hex' | 'envoy' | null;
  /** Blood mist size multiplier (Nullbreach / Unmaker = 1.5). */
  bloodMistScale?: number;
}

interface BattlefieldSlotProps {
  slot: CombatGridSlotId;
  unit: CombatGridUnitView | undefined;
  layoutMode: ArenaLayoutMode;
  arenaWidth: number;
  arenaHeight: number;
  wrapperWidth: `${number}%`;
  targetingActive: boolean;
  abilityArmed?: boolean;
  accentColor: string;
  mutedColor: string;
  onUnitPress: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
  /** Hovered via SlotHitOverlay (covers unit hitboxes while targeting). */
  reticleHovered?: boolean;
  wrapperStyle?: ViewStyle;
  arenaGridVariant?: ArenaGridVariant;
  bloodBurstVariant?: 'aegis' | 'hex' | 'envoy' | null;
  bloodMistScale?: number;
}

function BattlefieldSlot({
  slot,
  unit,
  layoutMode,
  arenaWidth,
  arenaHeight,
  wrapperWidth,
  targetingActive,
  abilityArmed = false,
  accentColor,
  mutedColor,
  onUnitPress,
  onUnitDissolveComplete,
  reticleHovered = false,
  wrapperStyle,
  arenaGridVariant = 'flex',
  bloodBurstVariant = null,
  bloodMistScale = 1,
}: BattlefieldSlotProps): React.JSX.Element {
  const presentation = resolveSlotPresentation(slot, layoutMode, arenaGridVariant);
  const [wardenPlane, setWardenPlane] = useState<'none' | 'target' | 'nonTarget'>('none');

  useEffect(() => subscribeWardenStrikePresentation((event) => {
    if (event.phase === 'done' || event.result.replayOnly) {
      setWardenPlane('none');
      return;
    }
    if (!isWardenStrikePresentationActive()) {
      setWardenPlane('none');
      return;
    }
    const targetId = getWardenStrikeActiveTargetId();
    if (!unit?.unitId || targetId == null) {
      setWardenPlane('none');
      return;
    }
    setWardenPlane(unit.unitId === targetId ? 'target' : 'nonTarget');
  }), [unit?.unitId]);

  const meleeDashDelta = useMemo(() => {
    if (!unit || arenaWidth <= 0 || arenaHeight <= 0) return undefined;
    if (laneForSlot(slot) !== 'BACKLINE') return undefined;
    return backlineMeleeDashDelta(slot, layoutMode, arenaWidth, arenaHeight, arenaGridVariant);
  }, [arenaGridVariant, arenaHeight, arenaWidth, layoutMode, slot, unit]);

  const handleDissolveComplete = useCallback(() => {
    if (unit) onUnitDissolveComplete?.(unit.unitId);
  }, [onUnitDissolveComplete, unit]);

  const dissolving = unit != null && (unit.dissolveSeq ?? 0) > 0 && !unit.dissolveHidden;
  // Parent stacking: keep ALL enemy artwork (including the selected target) under the
  // moving player. Brand/portrait must not print onto the Aegis. Chrome floats lift
  // via the arena combat-UI plane, not by elevating this whole slot.
  let zIndex = unit?.isBacklineDashing ? 50 : presentation.zIndex;
  if (wardenPlane === 'nonTarget' || wardenPlane === 'target') {
    zIndex = 1;
  }

  const slotStyle: ViewStyle | undefined = wrapperStyle
    ? {
        ...wrapperStyle,
        zIndex,
        elevation: wardenPlane !== 'none' ? 1 : undefined,
      }
    : undefined;

  return (
    <CombatEnemyWrapper
      width={wrapperWidth}
      scale={presentation.unitScale}
      zIndex={zIndex}
      style={slotStyle}
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
            abilityArmed={abilityArmed}
            accentColor={accentColor}
            mutedColor={mutedColor}
            variant="arena"
            layoutUnitScale={presentation.unitScale}
            meleeDashDelta={meleeDashDelta}
            skipDissolveEffect
            bloodBurstVariant={bloodBurstVariant}
            bloodMistScale={bloodMistScale}
            reticleHovered={reticleHovered}
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
  abilityArmed?: boolean;
  accentColor: string;
  mutedColor: string;
  bloodBurstVariant?: 'aegis' | 'hex' | 'envoy' | null;
  bloodMistScale?: number;
  onUnitPress?: (unitId: string) => void;
  onUnitDissolveComplete?: (unitId: string) => void;
}

/** Compact grid cell — sprite only; vitals render in the intel panel. */
function EnemyUnitStack({
  unit,
  targetingActive,
  abilityArmed = false,
  accentColor,
  mutedColor,
  bloodBurstVariant = null,
  bloodMistScale = 1,
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
        abilityArmed={abilityArmed}
        accentColor={accentColor}
        mutedColor={mutedColor}
        variant="compact"
        bloodBurstVariant={bloodBurstVariant}
        bloodMistScale={bloodMistScale}
        onPress={onUnitPress ? () => onUnitPress(unit.unitId) : undefined}
        onDissolveComplete={onUnitDissolveComplete ? handleDissolveComplete : undefined}
      />
    </View>
  );
}

export default function CombatEnemyGrid({
  units,
  targetingActive,
  abilityArmed = false,
  onUnitPress,
  onUnitDissolveComplete,
  accentColor,
  mutedColor,
  variant = 'arena',
  layoutMode = 'group',
  arenaGridVariant = 'flex',
  bloodBurstVariant = null,
  bloodMistScale = 1,
}: CombatEnemyGridProps): React.JSX.Element {
  const isArena = variant === 'arena';
  const [arenaSize, setArenaSize] = useState({ width: 0, height: 0 });
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (!targetingActive) setHoveredUnitId(null);
  }, [targetingActive]);

  const handleUnitHoverIn = useCallback((unitId: string) => {
    setHoveredUnitId(unitId);
  }, []);
  const handleUnitHoverOut = useCallback((unitId: string) => {
    setHoveredUnitId((prev) => (prev === unitId ? null : prev));
  }, []);

  const handleArenaLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArenaSize((prev) => (
      prev.width === width && prev.height === height ? prev : { width, height }
    ));
  }, []);

  const visibleUnits = units.filter(shouldShowUnitInArenaGrid);

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
      <View key={`${slot}-${unit.unitId}`} style={styles.cell} pointerEvents="box-none">
        <EnemyUnitStack
          unit={unit}
          targetingActive={targetingActive}
          abilityArmed={abilityArmed}
          accentColor={accentColor}
          mutedColor={mutedColor}
          bloodBurstVariant={bloodBurstVariant}
          bloodMistScale={bloodMistScale}
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
      abilityArmed,
      accentColor,
      mutedColor,
      onUnitPress,
      onUnitDissolveComplete,
      arenaGridVariant,
      bloodBurstVariant,
      bloodMistScale,
    };

    const hoverOverlayProps = {
      onUnitHoverIn: handleUnitHoverIn,
      onUnitHoverOut: handleUnitHoverOut,
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
            const slotUnit = layoutMode === 'solo' ? soloUnit : unitForSlot(slot);
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
                key={`${slot}-${slotUnit?.unitId ?? 'empty'}`}
                slot={slot}
                unit={slotUnit}
                wrapperStyle={slotStyle}
                reticleHovered={slotUnit != null && hoveredUnitId === slotUnit.unitId}
                {...slotProps}
              />
            );
          })}
          {targetingActive && layoutMode === 'solo' && soloUnit?.isTargetable
            ? (
              <SlotHitOverlay
                key={`solo-target-${soloUnit.unitId}`}
                slot={SOLO_ARENA_SLOT}
                unit={soloUnit}
                layoutMode={layoutMode}
                onUnitPress={onUnitPress}
                overlayZIndex={FRONTLINE_TARGET_OVERLAY_Z_INDEX}
                {...hoverOverlayProps}
              />
            )
            : null}
          {targetingActive && layoutMode === 'group'
            ? FRONTLINE_SLOTS.map((slot) => {
              const unit = unitForSlot(slot);
              if (!unit?.isTargetable) return null;
              return (
                <SlotHitOverlay
                  key={`fl-target-${slot}-${unit.unitId}`}
                  slot={slot}
                  unit={unit}
                  layoutMode={layoutMode}
                  onUnitPress={onUnitPress}
                  overlayZIndex={FRONTLINE_TARGET_OVERLAY_Z_INDEX}
                  {...hoverOverlayProps}
                />
              );
            })
            : null}
          {targetingActive && layoutMode === 'group'
            ? BACKLINE_SLOTS.map((slot) => {
              const unit = unitForSlot(slot);
              if (!unit?.isTargetable) return null;
              return (
                <SlotHitOverlay
                  key={`bl-target-${slot}-${unit.unitId}`}
                  slot={slot}
                  unit={unit}
                  layoutMode={layoutMode}
                  onUnitPress={onUnitPress}
                  overlayZIndex={BACKLINE_TARGET_OVERLAY_Z_INDEX}
                  {...hoverOverlayProps}
                />
              );
            })
            : null}
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
              key={`${slot}-${unitForSlot(slot)?.unitId ?? 'empty'}`}
              slot={slot}
              unit={unitForSlot(slot)}
              {...slotProps}
            />
          ))}
        </View>

        <View style={styles.frontlineRow} pointerEvents="box-none">
          {FRONTLINE_SLOTS.map((slot) => (
            <BattlefieldSlot
              key={`${slot}-${unitForSlot(slot)?.unitId ?? 'empty'}`}
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
    right: 210,
    width: '48%',
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
  slotHitFrame: {
    position: 'absolute',
    aspectRatio: ENEMY_WRAPPER_ASPECT_RATIO,
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  slotHitInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  slotHitPressable: {
    position: 'absolute',
    zIndex: 10,
  },
  slotHitDebug: {
    backgroundColor: HITBOX_DEBUG_FILL,
  },
});
