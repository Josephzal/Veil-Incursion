import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ArenaDefenseState } from '../../data/combatArenaDefenseTelegraphEngine';
import { DEFENSE_TELEGRAPH_PROFILES } from '../../data/combatArenaDefenseTelegraphEngine';

const MONO = 'monospace';

interface CombatArenaDefensePipsProps {
  defense: ArenaDefenseState;
  /**
   * Nameplate indicator mode — single inline row, shapes only. The `KA` / `OW`
   * codes are dropped in favour of the accessible label; full names and values
   * stay in Enemy Intel.
   */
  compact?: boolean;
}

/**
 * Phase 2 (+ polish) — compact dual-row plate/glyph pips under arena HP.
 * KA = angular plates; OW = ritual diamonds — never the same silhouette.
 */
export default function CombatArenaDefensePips({
  defense,
  compact = false,
}: CombatArenaDefensePipsProps): React.JSX.Element | null {
  const { kineticArmor, occultWards, maxPips } = defense;
  if (kineticArmor <= 0 && occultWards <= 0) return null;

  const ka = DEFENSE_TELEGRAPH_PROFILES.KINETIC_ARMOR.colors;
  const ow = DEFENSE_TELEGRAPH_PROFILES.OCCULT_WARD.colors;
  const pipCap = compact ? Math.min(maxPips, 3) : maxPips;

  return (
    <View style={compact ? styles.rootCompact : styles.root} pointerEvents="none">
      {kineticArmor > 0 ? (
        <View style={styles.lane} accessibilityLabel={`Kinetic Armor ${kineticArmor}`}>
          {compact ? null : <Text style={[styles.laneTag, { color: ka.primary }]}>KA</Text>}
          <View style={styles.row}>
            {Array.from({ length: Math.min(kineticArmor, pipCap) }, (_, i) => (
              <View
                key={`ka-${i}`}
                style={[
                  styles.plate,
                  compact ? styles.plateCompact : null,
                  { backgroundColor: ka.primary, borderColor: ka.secondary },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}
      {occultWards > 0 ? (
        <View style={styles.lane} accessibilityLabel={`Occult Wards ${occultWards}`}>
          {compact ? null : <Text style={[styles.laneTag, { color: ow.primary }]}>OW</Text>}
          <View style={styles.row}>
            {Array.from({ length: Math.min(occultWards, pipCap) }, (_, i) => (
              <View
                key={`ow-${i}`}
                style={[styles.diamondHost, compact ? styles.diamondHostCompact : null]}
              >
                <View
                  style={[
                    styles.diamond,
                    compact ? styles.diamondCompact : null,
                    { backgroundColor: ow.primary, borderColor: ow.secondary },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 1,
    marginTop: 1,
    marginBottom: 1,
  },
  rootCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  laneTag: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '800',
    letterSpacing: 0.4,
    width: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  plate: {
    width: 8,
    height: 4,
    borderWidth: 1,
    borderRadius: 0,
    transform: [{ skewX: '-14deg' }],
  },
  plateCompact: {
    width: 7,
    height: 3,
  },
  diamondHost: {
    width: 7,
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondHostCompact: {
    width: 6,
    height: 6,
  },
  diamond: {
    width: 5,
    height: 5,
    borderWidth: 1,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  diamondCompact: {
    width: 4,
    height: 4,
  },
});
