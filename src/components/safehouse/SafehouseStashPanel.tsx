import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import type { ResourceItemId } from '../../types/resourceItem';
import { ALL_RESOURCE_ITEM_IDS, getResourceDisplayName, getResourceCategory } from '../../data/resourceRegistry';
import { listHubStagedConsumables } from '../../data/hubSafehouseEngine';
import { DOSSIER_FOREGROUND, DOSSIER_ROW_BG } from '../../constants/dossierSurface';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { useHubTypography } from '../../hooks/useHubTypography';
import {
  HIDDEN_SCROLLBAR_VIEW_STYLE,
  HIDDEN_SCROLLVIEW_PROPS,
} from '../../utils/hiddenScrollbarStyle';
import type { CargoItemId } from '../../types/cargoGrid';
import TerminalText from '../TerminalText';
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
  /** When true, panel sits inside DossierCardShell — no outer chrome. */
  shellWrapped?: boolean;
  /** Stretch panel to fill a fixed-height loadout column (desktop web scroll). */
  fillHeight?: boolean;
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
  isDesktop,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  entry: StashEntry;
  borderColor: string;
  mutedColor: string;
  textColor: string;
  isDesktop: boolean;
  onDragStart: (itemId: CargoItemId) => void;
  onDragMove: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
  onDragEnd: (itemId: CargoItemId, absoluteX: number, absoluteY: number) => void;
}): React.JSX.Element {
  return (
    <View style={[styles.row, isDesktop && styles.rowDesktop, { borderColor, backgroundColor: DOSSIER_ROW_BG }]}>
      <View style={styles.rowMain}>
        <View style={styles.rowCopy}>
          <TerminalText
            variant="body"
            style={{ color: textColor, fontWeight: '700' }}
            numberOfLines={1}
          >
            {entry.name.toUpperCase()}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor }}>
            {`${entry.quantity}× // ${entry.kind === 'resource' ? getResourceCategory(entry.itemId as ResourceItemId) : 'CONSUMABLE'}`}
          </TerminalText>
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
  shellWrapped = false,
  fillHeight = false,
  onPanelMeasured,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SafehouseStashPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { isDesktop } = useHubLayout();
  const { bodySize } = useHubTypography();
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
        name: getResourceDisplayName(resourceId, true),
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
        fillHeight && styles.rootFill,
        shellWrapped && styles.rootShellWrapped,
        !shellWrapped && {
          borderColor: isDropTarget ? accent : theme.borderColor,
          backgroundColor: isDropTarget ? `${theme.primaryColor}12` : theme.backgroundColor,
        },
        shellWrapped && isDropTarget && {
          backgroundColor: `${theme.primaryColor}12`,
        },
      ]}
    >
      <TerminalText variant="panelTitle" letterSpacing={0.8} style={{ color: accent, fontWeight: '700' }}>
        HOME STASH
      </TerminalText>
      <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
        DRAG ICON INTO PACK // DRAG PACK ITEMS BACK HERE
      </TerminalText>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="SEARCH STASH..."
        placeholderTextColor={theme.mutedColor}
        autoCapitalize="characters"
        autoCorrect={false}
        style={[
          styles.searchInput,
          isDesktop && styles.searchInputDesktop,
          {
            borderColor: theme.borderColor,
            color: theme.textColor,
            backgroundColor: DOSSIER_FOREGROUND,
            fontSize: bodySize(8),
          },
        ]}
      />
      <ScrollView
        style={[styles.list, Platform.OS === 'web' && styles.listWeb, HIDDEN_SCROLLBAR_VIEW_STYLE]}
        contentContainerStyle={styles.listContent}
        {...HIDDEN_SCROLLVIEW_PROPS}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {entries.length === 0 ? (
          <TerminalText variant="caption" style={{ color: theme.mutedColor, paddingVertical: 12 }}>
            {search.trim() ? '// NO MATCHING ITEMS' : '// STASH EMPTY'}
          </TerminalText>
        ) : (
          entries.map((entry) => (
            <StashRow
              key={entry.key}
              entry={entry}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              textColor={theme.textColor}
              isDesktop={isDesktop}
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
    padding: 10,
    gap: 8,
    minHeight: 0,
  },
  rootShellWrapped: {
    padding: 0,
    gap: 8,
  },
  rootFill: {
    height: '100%',
    alignSelf: 'stretch',
  },
  searchInput: {
    borderWidth: 1,
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  searchInputDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  list: { flex: 1, minHeight: 0 },
  listWeb: {
    flex: 1,
    minHeight: 0,
    height: 0,
    overflow: 'auto',
  },
  listContent: { gap: 6, paddingBottom: 8, paddingRight: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    minHeight: 44,
  },
  rowDesktop: {
    minHeight: 56,
  },
  rowMain: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowCopy: { gap: 4 },
});
