import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import {
  clampRatio,
  GAUGE_HOSTILE_HP,
} from '../../utils/combatTelemetryFormat';
import type { CombatGridUnitSnapshot } from '../../utils/combatTelemetryFormat';
import { CombatHorizontalGauge } from './CombatHorizontalGauge';

const GAUGE_FRACTURE = '#fbbf24';
const TARGET_GLOW = 'rgba(251, 191, 36, 0.95)';
const HOOK_GLOW = '#a855f7';
const BLOCKED_OVERLAY = 'rgba(220, 38, 38, 0.35)';
const OVERHEAD_HEIGHT = 22;
/** Bottom-anchored frontline sprite fills this share of the slot; bars sit directly above. */
const FRONTLINE_SPRITE_HEIGHT = '86%';

export type CombatGridUnitView = CombatGridUnitSnapshot & {
  portraitSource: ImageSourcePropType;
};

interface CombatEnemyUnitProps {
  unit: CombatGridUnitView;
  targetingActive: boolean;
  accentColor: string;
  mutedColor: string;
  isBackline?: boolean;
  /** Scales sprite only — overhead bars stay full size for readability. */
  spriteScale?: number;
}

function EnemyOverheadBars({
  hpRatio,
  fractureRatio,
}: {
  hpRatio: number;
  fractureRatio: number;
}): React.JSX.Element {
  return (
    <View style={styles.overhead} pointerEvents="none">
      <CombatHorizontalGauge
        fillColor={GAUGE_HOSTILE_HP}
        ratio={hpRatio}
        width="100%"
        borderless
        overhead
      />
      <CombatHorizontalGauge
        fillColor={GAUGE_FRACTURE}
        ratio={fractureRatio}
        width="100%"
        borderless
        overhead
      />
    </View>
  );
}

export default function CombatEnemyUnit({
  unit,
  targetingActive,
  accentColor,
  spriteScale = 1,
  isBackline = false,
}: CombatEnemyUnitProps): React.JSX.Element {
  const hpRatio = unit.maxHp > 0 ? unit.currentHp / unit.maxHp : 0;
  const fractureMax = unit.fractureMax ?? 100;
  const fractureRatio = clampRatio(fractureMax > 0 ? (unit.fractureGauge ?? 0) / fractureMax : 0);
  const fractured = unit.isFractured || fractureRatio >= 1;

  const portraitGlow = () => {
    if (unit.isSelected) return TARGET_GLOW;
    if (unit.isHookValid && targetingActive) return HOOK_GLOW;
    if (unit.isTargetable && targetingActive) return accentColor;
    if (unit.isFocused) return TARGET_GLOW;
    return undefined;
  };

  const glowColor = portraitGlow();

  return (
    <View
      style={[
        styles.root,
        {
          opacity: unit.isBlocked && targetingActive && !unit.isHookValid ? 0.5 : 1,
        },
      ]}
    >
      {isBackline ? (
        <View style={styles.overheadBackline}>
          <EnemyOverheadBars hpRatio={hpRatio} fractureRatio={fractureRatio} />
        </View>
      ) : (
        <View style={styles.overheadFrontline}>
          <EnemyOverheadBars hpRatio={hpRatio} fractureRatio={fractureRatio} />
        </View>
      )}

      <View
        style={[
          isBackline ? styles.spriteBackline : styles.spriteFrontline,
          fractured ? styles.spriteFractured : null,
          { transform: [{ scale: spriteScale }] },
        ]}
      >
        <Image
          source={unit.portraitSource}
          style={[
            styles.portrait,
            glowColor
              ? {
                  shadowColor: glowColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.9,
                  shadowRadius: unit.isSelected ? 12 : 8,
                }
              : null,
          ]}
          resizeMode="contain"
        />
      </View>

      {unit.isBlocked && targetingActive && !unit.isHookValid ? (
        <View style={styles.blockedOverlay} pointerEvents="none">
          <View style={styles.blockedStrike} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  overhead: {
    width: '100%',
    height: OVERHEAD_HEIGHT,
    gap: 3,
    paddingHorizontal: 2,
    justifyContent: 'flex-start',
  },
  overheadFrontline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: FRONTLINE_SPRITE_HEIGHT,
    height: OVERHEAD_HEIGHT,
    zIndex: 30,
    elevation: 30,
  },
  overheadBackline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: OVERHEAD_HEIGHT,
    zIndex: 30,
    elevation: 30,
  },
  spriteFrontline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: FRONTLINE_SPRITE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  spriteBackline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: OVERHEAD_HEIGHT,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  spriteFractured: {
    opacity: 0.55,
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  blockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 31,
  },
  blockedStrike: {
    position: 'absolute',
    width: '120%',
    height: 2,
    backgroundColor: BLOCKED_OVERLAY,
    transform: [{ rotate: '-35deg' }],
  },
});
