import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../../data/resourceRegistry';
import { listHubStagedConsumables } from '../../data/hubSafehouseEngine';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';
import DraggableStashIcon from './DraggableStashIcon';

export type StashEntryKind = 'resource' | 'consumable';

export interface StashEntry {
  key: string;
  kind: StashEntryKind;
  itemId: CargoItemId;
  name: string;
  quantity: number;
}

interface SafehouseStashPanelProps {
  resourceStash: Partial<Record<string, number>>;
  hubCraftedConsumables: Partial<Record<CargoItemId, number>>;
  isDropTarget?: boolean;
  onPanelMeasured?: (rect: { pageX: number; pageY: number; width: number; height: number }) => void;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}

function StashRow({
  entry,
  borderColor,
  mutedColor,
  textColor,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  entry: StashEntry;
  borderColor: string;
  mutedColor: string;
  textColor: string;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}): React.JSX.Element {
  return (
    <View style={[styles.row, { borderColor }]}>
      <View style={styles.rowMain}>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowName, { color: textColor }]} numberOfLines={1}>
            {entry.name.toUpperCase()}
          </Text>
          <Text style={[styles.rowMeta, { color: mutedColor }]}>
            {`${entry.quantity}× // ${entry.kind === 'resource' ? 'RESOURCE' : 'CONSUMABLE'}`}
          </Text>
        </View>
      </View>
      <DraggableStashIcon
        itemId={entry.itemId}
        borderColor={mutedColor}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      />
    </View>
  );
}

export default function SafehouseStashPanel({
  resourceStash,
  hubCraftedConsumables,
  isDropTarget = false,
  onPanelMeasured,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SafehouseStashPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const [search, setSearch] = useState('');
  const accent = theme.statusColor;
  const panelRef = useRef<View>(null);

  const reportPanelMetrics = () => {
    panelRef.current?.measureInWindow((pageX, pageY, width, height) => {
      onPanelMeasured?.({ pageX, pageY, width, height });
    });
  };

  useEffect(() => {
    if (isDropTarget) {
      reportPanelMetrics();
    }
  }, [isDropTarget]);

  const entries = useMemo(() => {
    const resourceEntries: StashEntry[] = ALL_RESOURCE_ITEM_IDS.flatMap((resourceId) => {
      const quantity = resourceStash[resourceId] ?? 0;
      if (quantity <= 0) return [];
      return [{
        key: `resource-${resourceId}`,
        kind: 'resource' as const,
        itemId: resourceId as CargoItemId,
        name: RESOURCE_REGISTRY[resourceId].name,
        quantity,
      }];
    });

    const consumableEntries: StashEntry[] = listHubStagedConsumables(hubCraftedConsumables).map((entry) => ({
      key: `consumable-${entry.itemId}`,
      kind: 'consumable' as const,
      itemId: entry.itemId,
      name: entry.name,
      quantity: entry.quantity,
    }));

    const query = search.trim().toLowerCase();
    const merged = [...resourceEntries, ...consumableEntries];
    if (!query) return merged;
    return merged.filter(
      (entry) => entry.name.toLowerCase().includes(query)
        || entry.itemId.toLowerCase().includes(query),
    );
  }, [hubCraftedConsumables, resourceStash, search]);

  return (
    <View
      ref={panelRef}
      onLayout={reportPanelMetrics}
      style={[
        styles.root,
        {
          borderColor: isDropTarget ? accent : theme.borderColor,
          backgroundColor: isDropTarget ? `${theme.primaryColor}12` : theme.backgroundColor,
        },
      ]}
    >
      <Text style={[styles.title, { color: accent }]}>HOME STASH</Text>
      <Text style={[styles.subtitle, { color: theme.mutedColor }]}>
        DRAG ICON INTO PACK // DRAG PACK ITEMS BACK HERE
      </Text>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="SEARCH STASH..."
        placeholderTextColor={theme.mutedColor}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[
          styles.searchInput,
          {
            borderColor: theme.borderColor,
            color: theme.textColor,
            backgroundColor: '#0a0b0f',
          },
        ]}
      />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
        persistentScrollbar={Platform.OS === 'android'}
        indicatorStyle="white"
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {entries.length === 0 ? (
          <Text style={[styles.empty, { color: theme.mutedColor }]}>
            {search.trim() ? '// NO MATCHING ITEMS' : '// STASH EMPTY'}
          </Text>
        ) : (
          entries.map((entry) => (
            <StashRow
              key={entry.key}
              entry={entry}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              textColor={theme.textColor}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    minHeight: 0,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 10,
  },
  searchInput: {
    borderWidth: 1,
    fontFamily: 'monospace',
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  list: { flex: 1, minHeight: 0 },
  listContent: { gap: 6, paddingBottom: 8, paddingRight: 2 },
  empty: { fontFamily: 'monospace', fontSize: 8, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    minHeight: 44,
  },
  rowMain: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rowCopy: { gap: 2 },
  rowName: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  rowMeta: { fontFamily: 'monospace', fontSize: 7 },
});
