import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import HapticPressable from '../../HapticPressable';
import type { ClassType } from '../../../types/game';
import type { CombatTurnOrderEntry, CombatTurnOrderSnapshot } from '../../../utils/combatTurnOrder';
import { useCombatDesktopLayout } from '../../../hooks/useCombatDesktopLayout';

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
  overlay?: boolean;
  selectedUnitId?: string | null;
  onHostilePress?: (unitId: string) => void;
}

function hostileEntryUnitId(entry: CombatTurnOrderEntry): string {
  return entry.id;
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
  overlay = false,
  selectedUnitId,
  onHostilePress,
}: TurnOrderColumnProps): React.JSX.Element {
  const { isCombatDesktop, scaleCombatFont, scaleCombatSize } = useCombatDesktopLayout();
  const entries = turnOrder?.entries ?? [];
  const portraitById = useMemo(
    () => new Map(gridUnits.map((unit) => [unit.unitId, unit.portraitSource])),
    [gridUnits],
  );

  const baseSize = isCombatDesktop
    ? scaleCombatSize(38)
    : entries.length > 7 ? 22 : entries.length > 5 ? 26 : 30;
  const activeSize = baseSize + (isCombatDesktop ? scaleCombatSize(8) : 6);

  return (
    <View style={[styles.host, overlay && styles.hostOverlay]}>
      {!overlay ? (
        <Text style={[
          styles.header,
          { color: mutedColor, fontSize: isCombatDesktop ? scaleCombatFont(8) : 6 },
        ]}>TURN ORDER</Text>
      ) : null}
      {entries.length === 0 ? (
        <Text style={[
          styles.empty,
          { color: mutedColor, fontSize: isCombatDesktop ? scaleCombatFont(7) : 6 },
        ]}>Awaiting telemetry…</Text>
      ) : (
        <View style={[styles.column, overlay && styles.columnOverlay]}>
          {entries.map((entry, index) => {
            const palette = avatarPalette(entry);
            const isActive = entry.state === 'active';
            const size = isActive ? activeSize : baseSize;
            const portraitSource = entry.kind === 'hostile'
              ? portraitById.get(hostileEntryUnitId(entry))
              : null;
            const unitId = entry.kind === 'hostile' ? hostileEntryUnitId(entry) : null;
            const isIntelSelected = unitId != null && selectedUnitId === unitId;
            const canPressHostile = entry.kind === 'hostile'
              && entry.state !== 'defeated'
              && unitId != null
              && onHostilePress != null;

            const avatar = (
              <View
                style={[
                  styles.avatarRing,
                  entry.kind === 'operative' ? styles.avatarRingPlayer : styles.avatarRingHostile,
                  {
                    width: size,
                    height: size,
                    borderColor: isIntelSelected ? primaryColor : palette.border,
                    opacity: palette.opacity,
                    shadowColor: isActive ? palette.glow : 'transparent',
                  },
                  isActive && styles.avatarRingActive,
                  isIntelSelected && styles.avatarRingIntelSelected,
                ]}
              >
                {entry.kind === 'hostile' && portraitSource ? (
                  <Image source={portraitSource} style={styles.portrait} resizeMode="cover" />
                ) : (
                  <Text style={[
                    styles.operativeGlyph,
                    isCombatDesktop ? { fontSize: scaleCombatFont(9) } : null,
                  ]} numberOfLines={1}>
                    {entry.label.slice(0, 2)}
                  </Text>
                )}
              </View>
            );

            return (
              <View key={`${entry.id}-${index}`} style={styles.itemWrap}>
                {index > 0 ? <View style={[styles.connector, { backgroundColor: mutedColor }]} /> : null}
                {canPressHostile ? (
                  <HapticPressable
                    onPress={() => onHostilePress(unitId)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${entry.label}`}
                  >
                    {avatar}
                  </HapticPressable>
                ) : (
                  avatar
                )}
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
  hostOverlay: {
    flex: 0,
    minHeight: undefined,
    overflow: 'visible',
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
  columnOverlay: {
    flex: 0,
    minHeight: undefined,
    overflow: 'visible',
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
  },
  avatarRingIntelSelected: {
    borderWidth: 2,
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
