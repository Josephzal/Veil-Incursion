import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from '../../data/resourceRegistry';
import { listHubStagedConsumables } from '../../data/hubSafehouseEngine';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { pulseCargoItemPickup } from '../../utils/hubButtonHaptics';

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
  selectedItemId: CargoItemId | null;
  isDropTarget?: boolean;
  onPanelMeasured?: (rect: { pageX: number; pageY: number; width: number; height: number }) => void;
  onSelectItem: (itemId: CargoItemId) => void;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}

function DraggableStashRow({
  entry,
  selected,
  accentColor,
  borderColor,
  mutedColor,
  textColor,
  primaryColor,
  onSelectItem,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  entry: StashEntry;
  selected: boolean;
  accentColor: string;
  borderColor: string;
  mutedColor: string;
  textColor: string;
  primaryColor: string;
  onSelectItem: (itemId: CargoItemId) => void;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}): React.JSX.Element {
  const finishDrag = (absoluteX: number, absoluteY: number, translationX: number, translationY: number) => {
    const dragged = Math.hypot(translationX, translationY) >= 4;
    if (dragged) {
      onDragEnd(entry.itemId, absoluteX, absoluteY);
    }
  };

  const pan = Gesture.Pan()
    .minDistance(4)
    .onBegin((event) => {
      runOnJS(pulseCargoItemPickup)();
      runOnJS(onDragStart)(entry.itemId);
      runOnJS(onDragMove)(entry.itemId, event.absoluteX, event.absoluteY);
    })
    .onUpdate((event) => {
      runOnJS(onDragMove)(entry.itemId, event.absoluteX, event.absoluteY);
    })
    .onEnd((event) => {
      runOnJS(finishDrag)(
        event.absoluteX,
        event.absoluteY,
        event.translationX,
        event.translationY,
      );
    });

  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd(() => {
      runOnJS(onSelectItem)(entry.itemId);
    });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.row,
          {
            borderColor: selected ? accentColor : borderColor,
            backgroundColor: selected ? `${primaryColor}18` : 'transparent',
          },
        ]}
      >
        <Image
          source={resolveCargoItemIcon(entry.itemId)}
          resizeMode="contain"
          style={styles.rowIcon}
        />
        <View style={styles.rowCopy}>
          <Text style={[styles.rowName, { color: textColor }]} numberOfLines={1}>
            {entry.name.toUpperCase()}
          </Text>
          <Text style={[styles.rowMeta, { color: mutedColor }]}>
            {`${entry.quantity}× // ${entry.kind === 'resource' ? 'RESOURCE' : 'CONSUMABLE'}`}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

export default function SafehouseStashPanel({
  resourceStash,
  hubCraftedConsumables,
  selectedItemId,
  isDropTarget = false,
  onPanelMeasured,
  onSelectItem,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SafehouseStashPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const [search, setSearch] = useState('');
  const accent = theme.statusColor;

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
      style={[
        styles.root,
        {
          borderColor: isDropTarget ? accent : theme.borderColor,
          backgroundColor: isDropTarget ? `${theme.primaryColor}12` : theme.backgroundColor,
        },
      ]}
      ref={(ref) => {
        if (!ref) return;
        ref.measureInWindow((pageX, pageY, width, height) => {
          onPanelMeasured?.({ pageX, pageY, width, height });
        });
      }}
    >
      <Text style={[styles.title, { color: accent }]}>HOME STASH</Text>
      <Text style={[styles.subtitle, { color: theme.mutedColor }]}>
        DRAG ITEMS BETWEEN STASH AND DEPLOYMENT PACK
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
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <Text style={[styles.empty, { color: theme.mutedColor }]}>
            {search.trim() ? '// NO MATCHING ITEMS' : '// STASH EMPTY'}
          </Text>
        ) : (
          entries.map((entry) => (
            <DraggableStashRow
              key={entry.key}
              entry={entry}
              selected={selectedItemId === entry.itemId}
              accentColor={accent}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              textColor={theme.textColor}
              primaryColor={theme.primaryColor}
              onSelectItem={onSelectItem}
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
  listContent: { gap: 6, paddingBottom: 8 },
  empty: { fontFamily: 'monospace', fontSize: 8, paddingVertical: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rowIcon: { width: 28, height: 28 },
  rowCopy: { flex: 1, gap: 2 },
  rowName: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  rowMeta: { fontFamily: 'monospace', fontSize: 7 },
});
