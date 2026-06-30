import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';

interface TacticalTagRowProps {
  tags: readonly string[];
}

/** Classified data tags for ability cards. */
export default function TacticalTagRow({ tags }: TacticalTagRowProps): React.JSX.Element | null {
  if (tags.length === 0) return null;

  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <View key={tag} style={styles.pill}>
          <TerminalText size={6} letterSpacing={1.4} style={styles.pillText}>
            {tag.toUpperCase()}
          </TerminalText>
        </View>
      ))}
    </View>
  );
}

/** Parse tag strings from catalog lines like "[ KINETIC · MELEE ]" or "KINETIC · MELEE". */
export function parseTagsLine(tagsLine: string): string[] {
  const stripped = tagsLine.replace(/^\[\s*|\s*\]$/g, '').trim();
  if (!stripped) return [];
  return stripped.split(/\s*[·,]\s*/).map((t) => t.trim()).filter(Boolean);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '700',
  },
});
