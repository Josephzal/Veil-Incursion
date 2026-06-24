import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';

export interface RegistryEntry {
  id: string;
  label: string;
  manifested: boolean;
}

export interface DiscoveredNodesRegistryProps {
  entries: RegistryEntry[];
  selectedNodeId?: string | null;
  accent?: string;
  onSelectNode: (nodeId: string) => void;
}

/** Expands upward — toggle anchors to scanner top; list grows above toggle. */
export default function DiscoveredNodesRegistry({
  entries,
  selectedNodeId = null,
  accent = '#00ff33',
  onSelectNode,
}: DiscoveredNodesRegistryProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const manifestedCount = entries.filter((e) => e.manifested).length;

  return (
    <View style={styles.root}>
      {expanded ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {entries.map((entry) => {
            const isSelected = entry.id === selectedNodeId;
            const shortLabel = entry.label.split(' // ').slice(-1)[0] ?? entry.label;
            return (
              <HapticPressable
                key={entry.id}
                onPress={() => onSelectNode(entry.id)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderColor: isSelected ? accent : 'rgba(0, 255, 51, 0.22)',
                    backgroundColor: isSelected
                      ? 'rgba(0, 255, 51, 0.12)'
                      : pressed
                        ? 'rgba(0, 255, 51, 0.06)'
                        : 'rgba(0, 0, 0, 0.75)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rowLabel,
                    { color: isSelected ? accent : '#94a3b8' },
                  ]}
                  numberOfLines={1}
                >
                  {shortLabel.toUpperCase()}
                </Text>
                <Text style={[styles.rowStatus, { color: entry.manifested ? accent : '#64748b' }]}>
                  {entry.manifested ? 'BREACH READY' : 'DISCOVERED'}
                </Text>
              </HapticPressable>
            );
          })}
        </ScrollView>
      ) : null}

      <HapticPressable
        onPress={() => setExpanded((prev) => !prev)}
        style={({ pressed }) => [
          styles.toggle,
          { borderColor: accent, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.toggleText, { color: accent }]}>
          {expanded ? '[ ▲ REGISTRY ]' : `[ ▼ BREACH REGISTRY // ${entries.length} ]`}
        </Text>
        {manifestedCount > 0 ? (
          <Text style={[styles.toggleSub, { color: accent }]}>
            {`${manifestedCount} READY`}
          </Text>
        ) : null}
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    maxWidth: 168,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  list: {
    maxHeight: 108,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(0, 255, 51, 0.22)',
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    marginBottom: 0,
  },
  listContent: {
    paddingVertical: 2,
  },
  toggle: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    gap: 1,
  },
  toggleText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  toggleSub: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.3,
    opacity: 0.85,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  rowLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rowStatus: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.4,
  },
});
