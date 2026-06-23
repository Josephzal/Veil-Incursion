import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CombatTurnOrderSnapshot, CombatTurnOrderEntry } from '../../utils/combatTurnOrder';

const MONO = 'monospace';
const HOSTILE_ACCENT = '#ef4444';

interface CombatTurnOrderTimelineProps {
  turnOrder: CombatTurnOrderSnapshot | null | undefined;
  primaryColor: string;
  mutedColor: string;
}

function chipColors(
  entry: CombatTurnOrderEntry,
  primaryColor: string,
  mutedColor: string,
): { border: string; background: string; text: string; opacity: number } {
  if (entry.state === 'defeated') {
    return {
      border: 'rgba(100, 116, 139, 0.35)',
      background: 'rgba(15, 23, 42, 0.5)',
      text: mutedColor,
      opacity: 0.45,
    };
  }

  if (entry.kind === 'operative') {
    if (entry.state === 'active') {
      return {
        border: primaryColor,
        background: 'rgba(139, 92, 246, 0.18)',
        text: primaryColor,
        opacity: 1,
      };
    }
    return {
      border: 'rgba(139, 92, 246, 0.35)',
      background: 'rgba(15, 23, 42, 0.7)',
      text: mutedColor,
      opacity: 0.7,
    };
  }

  if (entry.state === 'active') {
    return {
      border: HOSTILE_ACCENT,
      background: 'rgba(239, 68, 68, 0.16)',
      text: HOSTILE_ACCENT,
      opacity: 1,
    };
  }

  if (entry.state === 'queued') {
    return {
      border: 'rgba(239, 68, 68, 0.45)',
      background: 'rgba(15, 23, 42, 0.82)',
      text: '#fca5a5',
      opacity: 0.9,
    };
  }

  return {
    border: 'rgba(148, 163, 184, 0.3)',
    background: 'rgba(15, 23, 42, 0.65)',
    text: mutedColor,
    opacity: 0.65,
  };
}

/** Horizontal turn-order strip for the dashboard hostile column. */
export default function CombatTurnOrderTimeline({
  turnOrder,
  primaryColor,
  mutedColor,
}: CombatTurnOrderTimelineProps): React.JSX.Element {
  const entries = turnOrder?.entries ?? [];

  return (
    <View style={styles.host}>
      <Text style={[styles.header, { color: mutedColor }]}>TURN ORDER // INITIATIVE</Text>
      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: mutedColor }]}>Awaiting combat telemetry…</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {entries.map((entry, index) => {
            const palette = chipColors(entry, primaryColor, mutedColor);
            return (
              <React.Fragment key={`${entry.id}-${index}`}>
                {index > 0 ? (
                  <Text style={[styles.arrow, { color: mutedColor }]}>›</Text>
                ) : null}
                <View
                  style={[
                    styles.chip,
                    {
                      borderColor: palette.border,
                      backgroundColor: palette.background,
                      opacity: palette.opacity,
                    },
                    entry.state === 'active' && styles.chipActive,
                  ]}
                >
                  <Text style={[styles.chipLabel, { color: palette.text }]} numberOfLines={1}>
                    {entry.label}
                  </Text>
                  {entry.intentLabel && entry.kind === 'hostile' ? (
                    <Text style={[styles.intent, { color: mutedColor }]} numberOfLines={1}>
                      {entry.intentLabel}
                    </Text>
                  ) : null}
                </View>
              </React.Fragment>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    gap: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 51, 51, 0.9)',
  },
  header: {
    fontFamily: MONO,
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  empty: {
    fontFamily: MONO,
    fontSize: 6,
    opacity: 0.75,
    paddingVertical: 2,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 2,
  },
  arrow: {
    fontFamily: MONO,
    fontSize: 10,
    opacity: 0.55,
    paddingHorizontal: 1,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 44,
    maxWidth: 88,
    gap: 1,
  },
  chipActive: {
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  chipLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  intent: {
    fontFamily: MONO,
    fontSize: 5,
    letterSpacing: 0.25,
    opacity: 0.85,
  },
});
