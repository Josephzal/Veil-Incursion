import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ActiveIncursionState } from '../types/game';
import type { TerminalTheme } from '../types/theme';
import {
  RUN_STATUS_CATEGORY_LABELS,
  buildRunStatusSnapshot,
  groupRunStatusEntries,
} from '../utils/runStatusSnapshot';
import type { RunStatusCategory } from '../utils/runStatusSnapshot';

const TERMINAL_ACCENT = '#00ff33';
const CATEGORY_ORDER: RunStatusCategory[] = [
  'SECTOR',
  'BOON',
  'HAZARD',
  'MACRO',
  'ENVIRONMENT',
  'RESONANCE',
];

interface RunStatusOverlayProps {
  visible: boolean;
  activeIncursion: ActiveIncursionState;
  theme: TerminalTheme;
  accentColor?: string;
  onClose: () => void;
}

export default function RunStatusOverlay({
  visible,
  activeIncursion,
  theme,
  accentColor = TERMINAL_ACCENT,
  onClose,
}: RunStatusOverlayProps): React.JSX.Element {
  const grouped = useMemo(() => {
    const entries = buildRunStatusSnapshot(activeIncursion);
    return groupRunStatusEntries(entries);
  }, [activeIncursion]);

  const hasAny = CATEGORY_ORDER.some((cat) => grouped[cat].length > 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.panel, { borderColor: accentColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: accentColor }]}>OPERATIVE STATUS // RUN MANIFEST</Text>
          <Text style={[styles.subtitle, { color: theme.mutedColor }]}>
            RESONANCE {activeIncursion.resonance.percent}% // DISTRICT {activeIncursion.currentDistrict}
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {!hasAny ? (
              <Text style={[styles.empty, { color: theme.mutedColor }]}>
                No active buffs, debuffs, or boons. Sector conditions nominal.
              </Text>
            ) : (
              CATEGORY_ORDER.map((category) => {
                const items = grouped[category];
                if (items.length === 0) return null;
                return (
                  <View key={category} style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.mutedColor }]}>
                      {RUN_STATUS_CATEGORY_LABELS[category].toUpperCase()}
                    </Text>
                    {items.map((entry) => (
                      <View key={entry.id} style={styles.entry}>
                        <Text style={[styles.entryLabel, { color: accentColor }]}>{entry.label}</Text>
                        <Text style={[styles.entryDesc, { color: theme.textColor }]}>{entry.description}</Text>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: accentColor }]}>
            <Text style={[styles.closeText, { color: accentColor }]}>[ DISMISS ]</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '78%',
    backgroundColor: '#0a0b0f',
    borderWidth: 1,
    padding: 14,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 8,
    marginBottom: 10,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 360,
  },
  empty: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  entry: {
    marginBottom: 8,
    paddingLeft: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#1a2a1a',
  },
  entryLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
  },
  entryDesc: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    opacity: 0.9,
  },
  closeBtn: {
    marginTop: 10,
    alignSelf: 'center',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  closeText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
  },
});
