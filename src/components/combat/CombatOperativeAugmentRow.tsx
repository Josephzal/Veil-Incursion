import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CombatAugmentIcon } from '../../utils/combatAugmentIcons';
import { OPERATIVE_ARENA_SPRITE_WIDTH } from '../../constants/combatLayout';

const MONO = 'monospace';

interface CombatOperativeAugmentRowProps {
  icons: readonly CombatAugmentIcon[];
  mutedColor?: string;
}

/** Glowing augment chips beside the operative — grafts, mutations, and boons. */
export default function CombatOperativeAugmentRow({
  icons,
  mutedColor = '#94a3b8',
}: CombatOperativeAugmentRowProps): React.JSX.Element | null {
  if (icons.length === 0) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <Text style={[styles.header, { color: mutedColor }]}>AUGMENTS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {icons.map((icon) => (
          <View
            key={icon.id}
            accessibilityLabel={icon.title}
            style={[
              styles.chip,
              {
                borderColor: icon.accentColor,
                shadowColor: icon.accentColor,
              },
            ]}
          >
            <Text style={[styles.chipLabel, { color: icon.accentColor }]} numberOfLines={1}>
              {icon.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexShrink: 0,
    width: '100%',
    gap: 3,
    marginBottom: 2,
    maxWidth: OPERATIVE_ARENA_SPRITE_WIDTH,
  },
  header: {
    fontFamily: MONO,
    fontSize: 5,
    fontWeight: '700',
    letterSpacing: 0.6,
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 1,
  },
  chip: {
    minWidth: 24,
    height: 22,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 11, 15, 0.88)',
    shadowOpacity: 0.55,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  chipLabel: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
