import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { CombatTurnOrderSnapshot, CombatTurnOrderEntry } from '../../utils/combatTurnOrder';
import {
  resolveTurnOrderEmphasis,
  resolveTurnOrderOpacity,
  windowTurnOrderEntries,
  type TurnOrderEmphasis,
} from '../../utils/combatTurnOrderWindow';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { COMBAT_HUD_TYPE } from '../../constants/combatHudTypography';

interface CombatTurnOrderTimelineProps {
  turnOrder: CombatTurnOrderSnapshot | null | undefined;
  primaryColor: string;
  mutedColor: string;
  /** Optional portraits keyed by turn-order entry id. */
  portraitsById?: Record<string, ImageSourcePropType>;
}

interface ChipPalette {
  border: string;
  fill: string;
  glow: string;
  label: string;
}

function chipColors(entry: CombatTurnOrderEntry, emphasis: TurnOrderEmphasis): ChipPalette {
  if (emphasis === 'inactive') {
    return {
      border: OTT.borderMuted,
      fill: 'rgba(5, 7, 8, 0.88)',
      glow: 'transparent',
      label: OTT.textSecondary,
    };
  }
  if (emphasis === 'current') {
    const hostile = entry.kind === 'hostile';
    return {
      border: hostile ? OTT.soulRed : OTT.cyanSelect,
      // Filled marker — the current actor is unambiguous at a glance.
      fill: hostile ? 'rgba(158, 40, 48, 0.55)' : 'rgba(98, 220, 229, 0.4)',
      glow: hostile ? OTT.soulRed : OTT.cyanSelect,
      label: OTT.textPrimary,
    };
  }
  if (emphasis === 'next') {
    return {
      border: entry.kind === 'hostile' ? 'rgba(158, 40, 48, 0.75)' : OTT.cyanDim,
      fill: 'rgba(10, 16, 18, 0.9)',
      glow: 'transparent',
      label: OTT.textPrimary,
    };
  }
  return {
    border: OTT.borderSubtle,
    fill: 'rgba(8, 12, 14, 0.85)',
    glow: 'transparent',
    label: OTT.textSecondary,
  };
}

/** Compact canonical state marks — no HP, defenses, or intent copy. */
function stateGlyph(entry: CombatTurnOrderEntry): string | null {
  if (entry.state === 'defeated') return '✕';
  if (entry.isSlumped === true) return '◌';
  return null;
}

function shortLabel(entry: CombatTurnOrderEntry): string {
  if (entry.kind === 'operative') return 'YOU';
  const raw = entry.label.replace(/^HOSTILE[_\s]*/i, '').trim();
  const upper = raw.toUpperCase();
  return upper.length > 12 ? `${upper.slice(0, 11)}…` : upper;
}

/** Compact diamond turn-order timeline — current actor plus the next few. */
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

  const windowed = windowTurnOrderEntries(entries);
  const hasCurrentActor = windowed.some((entry) => entry.state === 'active');

  return (
    <View style={styles.host}>
      <Text style={styles.header}>{roundLabel}</Text>
      {windowed.length === 0 ? (
        <Text style={[styles.empty, { color: mutedColor }]}>AWAITING…</Text>
      ) : (
        <View style={styles.sequence}>
          {windowed.map((entry, index) => {
            const emphasis = resolveTurnOrderEmphasis({
              state: entry.state,
              indexInWindow: index,
              hasCurrentActor,
            });
            const palette = chipColors(entry, emphasis);
            const portrait = portraitsById?.[entry.id];
            const glyph = stateGlyph(entry);
            return (
              <React.Fragment key={`${entry.id}-${index}`}>
                {index > 0 ? <View style={styles.connector} /> : null}
                <View
                  style={[styles.chipCol, { opacity: resolveTurnOrderOpacity(emphasis, index) }]}
                  accessibilityLabel={`${shortLabel(entry)}${
                    emphasis === 'current' ? ' — acting now' : ''
                  }${entry.isSlumped ? ' — slumped' : ''}`}
                >
                  <View
                    style={[
                      styles.diamondFrame,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.fill,
                        shadowColor: palette.glow,
                      },
                      emphasis === 'current' ? styles.diamondCurrent : null,
                      emphasis === 'next' ? styles.diamondNext : null,
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
                  <View style={styles.labelRow}>
                    {glyph ? <Text style={styles.stateGlyph}>{glyph}</Text> : null}
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: palette.label },
                        emphasis === 'current' ? styles.chipLabelCurrent : null,
                      ]}
                      numberOfLines={1}
                    >
                      {shortLabel(entry)}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>
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
    // Softened outer frame — the sequence carries the read, not the container.
    backgroundColor: 'rgba(8, 12, 14, 0.4)',
  },
  header: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: OTT.textSecondary,
    textAlign: 'center',
  },
  empty: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    textAlign: 'center',
  },
  sequence: {
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
    overflow: 'hidden',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  diamondCurrent: {
    borderWidth: 2,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 2,
  },
  diamondNext: {
    borderWidth: 1.6,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    maxWidth: '100%',
  },
  stateGlyph: {
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.micro,
    fontWeight: '800',
    color: OTT.textMuted,
  },
  chipLabel: {
    flexShrink: 1,
    fontFamily: OTT.mono,
    fontSize: COMBAT_HUD_TYPE.caption,
    fontWeight: '800',
    letterSpacing: 0.35,
    textAlign: 'center',
  },
  chipLabelCurrent: {
    letterSpacing: 0.5,
  },
});
