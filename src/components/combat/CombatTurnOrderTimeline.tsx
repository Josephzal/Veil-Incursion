import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { CombatTurnOrderSnapshot, CombatTurnOrderEntry } from '../../utils/combatTurnOrder';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

interface CombatTurnOrderTimelineProps {
  turnOrder: CombatTurnOrderSnapshot | null | undefined;
  primaryColor: string;
  mutedColor: string;
  /** Optional portraits keyed by turn-order entry id. */
  portraitsById?: Record<string, ImageSourcePropType>;
}

function chipColors(
  entry: CombatTurnOrderEntry,
): { border: string; glow: string; opacity: number; label: string } {
  if (entry.state === 'defeated') {
    return {
      border: OTT.borderMuted,
      glow: 'transparent',
      opacity: 0.35,
      label: OTT.textMuted,
    };
  }
  if (entry.kind === 'operative') {
    const active = entry.state === 'active';
    return {
      border: active ? OTT.terminalGreen : OTT.cyanDim,
      glow: active ? OTT.terminalGreen : 'transparent',
      opacity: 1,
      label: active ? OTT.terminalGreen : OTT.textSecondary,
    };
  }
  if (entry.state === 'active') {
    return {
      border: OTT.soulRed,
      glow: OTT.soulRed,
      opacity: 1,
      label: OTT.soulRed,
    };
  }
  return {
    border: OTT.borderSubtle,
    glow: 'transparent',
    opacity: entry.state === 'queued' ? 0.8 : 0.55,
    label: OTT.textSecondary,
  };
}

function shortLabel(entry: CombatTurnOrderEntry): string {
  if (entry.kind === 'operative') return 'YOU';
  const raw = entry.label.replace(/^HOSTILE[_\s]*/i, '').trim();
  const upper = raw.toUpperCase();
  return upper.length > 12 ? `${upper.slice(0, 11)}…` : upper;
}

/** Compact diamond turn-order timeline — no oversized empty frame. */
export default function CombatTurnOrderTimeline({
  turnOrder,
  mutedColor,
  portraitsById,
}: CombatTurnOrderTimelineProps): React.JSX.Element {
  const entries = turnOrder?.entries ?? [];
  const phase = turnOrder?.phase;
  const roundLabel =
    phase === 'PLAYER_COMMAND'
      ? 'ROUND // YOUR TURN'
      : phase === 'ENEMY_WINDUP' || phase === 'ENEMY_ACTION' || phase === 'PARRY_WINDOW'
        ? 'ROUND // HOSTILE'
        : 'TURN ORDER';

  return (
    <View style={styles.host}>
      <Text style={styles.header}>{roundLabel}</Text>
      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: mutedColor }]}>AWAITING…</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {entries.map((entry, index) => {
            const palette = chipColors(entry);
            const portrait = portraitsById?.[entry.id];
            const active = entry.state === 'active';
            return (
              <React.Fragment key={`${entry.id}-${index}`}>
                {index > 0 ? <View style={styles.connector} /> : null}
                <View style={[styles.chipCol, { opacity: palette.opacity }]}>
                  <View
                    style={[
                      styles.diamondFrame,
                      {
                        borderColor: palette.border,
                        shadowColor: palette.glow,
                      },
                      active && styles.diamondActive,
                    ]}
                  >
                    <View style={styles.diamondInner}>
                      {portrait ? (
                        <Image source={portrait} style={styles.portrait} resizeMode="cover" />
                      ) : (
                        <Text style={[styles.initial, { color: palette.label }]}>
                          {shortLabel(entry).slice(0, 2)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.chipLabel, { color: palette.label }]} numberOfLines={1}>
                    {shortLabel(entry)}
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const DIAMOND = 24;

const styles = StyleSheet.create({
  host: {
    alignSelf: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OTT.borderMuted,
    backgroundColor: 'rgba(8, 12, 14, 0.55)',
  },
  header: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: OTT.terminalGreenMuted,
    textAlign: 'center',
  },
  empty: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    textAlign: 'center',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  connector: {
    width: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: OTT.borderSubtle,
    marginHorizontal: 1,
    marginBottom: 10,
  },
  chipCol: {
    alignItems: 'center',
    gap: 2,
    width: 62,
    minWidth: 56,
  },
  diamondFrame: {
    width: DIAMOND,
    height: DIAMOND,
    borderWidth: 1.25,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 8, 0.88)',
    overflow: 'hidden',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  diamondActive: {
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 2,
  },
  diamondInner: {
    width: DIAMOND - 5,
    height: DIAMOND - 5,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  initial: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
  },
  chipLabel: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
});
