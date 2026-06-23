import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { ClassType } from '../../../types/game';
import type { CombatTurnOrderEntry, CombatTurnOrderSnapshot } from '../../../utils/combatTurnOrder';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';
const PLAYER_CYAN = '#22d3ee';
const PLAYER_GOLD = '#fbbf24';

interface TurnOrderPortraitUnit {
  unitId: string;
  portraitSource: ImageSourcePropType;
}

interface TurnOrderColumnProps {
  turnOrder: CombatTurnOrderSnapshot | null | undefined;
  gridUnits: readonly TurnOrderPortraitUnit[];
  operativeClass?: ClassType;
  primaryColor: string;
  mutedColor: string;
}

function resolvePortraitUnitId(entry: CombatTurnOrderEntry): string {
  const dashIndex = entry.id.indexOf('-');
  return dashIndex > 0 ? entry.id.slice(0, dashIndex) : entry.id;
}

function avatarPalette(
  entry: CombatTurnOrderEntry,
): { border: string; glow: string; opacity: number } {
  if (entry.state === 'defeated') {
    return { border: 'rgba(100, 116, 139, 0.35)', glow: 'transparent', opacity: 0.4 };
  }

  if (entry.kind === 'operative') {
    if (entry.state === 'active') {
      return { border: PLAYER_CYAN, glow: PLAYER_GOLD, opacity: 1 };
    }
    return { border: 'rgba(34, 211, 238, 0.55)', glow: 'transparent', opacity: 0.82 };
  }

  if (entry.state === 'active') {
    return { border: HOSTILE_ACCENT, glow: HOSTILE_ACCENT, opacity: 1 };
  }

  if (entry.state === 'queued') {
    return { border: 'rgba(239, 68, 68, 0.55)', glow: 'transparent', opacity: 0.88 };
  }

  return { border: 'rgba(127, 29, 29, 0.45)', glow: 'transparent', opacity: 0.62 };
}

/** Vertical turn-order avatars for the tactical readout column. */
export default function TurnOrderColumn({
  turnOrder,
  gridUnits,
  operativeClass: _operativeClass,
  primaryColor,
  mutedColor,
}: TurnOrderColumnProps): React.JSX.Element {
  const entries = turnOrder?.entries ?? [];
  const portraitById = useMemo(
    () => new Map(gridUnits.map((unit) => [unit.unitId, unit.portraitSource])),
    [gridUnits],
  );

  const baseSize = entries.length > 7 ? 22 : entries.length > 5 ? 26 : 30;
  const activeSize = baseSize + 6;

  return (
    <View style={styles.host}>
      <Text style={[styles.header, { color: mutedColor }]}>TURN ORDER</Text>
      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: mutedColor }]}>Awaiting telemetry…</Text>
      ) : (
        <View style={styles.column}>
          {entries.map((entry, index) => {
            const palette = avatarPalette(entry);
            const isActive = entry.state === 'active';
            const size = isActive ? activeSize : baseSize;
            const portraitSource = entry.kind === 'hostile'
              ? portraitById.get(resolvePortraitUnitId(entry))
              : null;

            return (
              <View key={`${entry.id}-${index}`} style={styles.itemWrap}>
                {index > 0 ? <View style={[styles.connector, { backgroundColor: mutedColor }]} /> : null}
                <View
                  style={[
                    styles.avatarRing,
                    entry.kind === 'operative' ? styles.avatarRingPlayer : styles.avatarRingHostile,
                    {
                      width: size,
                      height: size,
                      borderColor: palette.border,
                      opacity: palette.opacity,
                      shadowColor: isActive ? palette.glow : 'transparent',
                    },
                    isActive && styles.avatarRingActive,
                  ]}
                >
                  {entry.kind === 'hostile' && portraitSource ? (
                    <Image source={portraitSource} style={styles.portrait} resizeMode="cover" />
                  ) : (
                    <Text style={styles.operativeGlyph} numberOfLines={1}>
                      {entry.label.slice(0, 2)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  header: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  empty: {
    fontFamily: MONO,
    fontSize: 6,
    opacity: 0.75,
  },
  column: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  itemWrap: {
    alignItems: 'center',
  },
  connector: {
    width: 1,
    height: 4,
    opacity: 0.35,
    marginBottom: 2,
  },
  avatarRing: {
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingHostile: {
    borderRadius: 2,
    backgroundColor: 'rgba(40, 10, 20, 0.85)',
  },
  avatarRingPlayer: {
    borderRadius: 2,
    backgroundColor: 'rgba(8, 28, 38, 0.88)',
  },
  avatarRingActive: {
    borderWidth: 2,
    shadowOpacity: 0.65,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
    transform: [{ scale: 1.08 }],
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  operativeGlyph: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    color: PLAYER_CYAN,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
