import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ITEM_CATALOG } from '../data/inventory';
import { formatItemDisplayName } from '../utils/formatDisplayName';

const INDEX_MUTED = '#6b7280';
const CATEGORY_ACCENTS: Record<string, string> = {
  WEAPON: '#60a5fa',
  TRINKET: '#c084fc',
  MATERIAL: '#4ade80',
  SHROUD: '#94a3b8',
  CONSUMABLE: '#fbbf24',
  CURRENCY: '#7dd3fc',
  DEFAULT: '#a78bfa',
};

function categoryAccent(category: string): string {
  const key = category.toUpperCase().replace(/\s+/g, '_');
  return CATEGORY_ACCENTS[key] ?? CATEGORY_ACCENTS.DEFAULT;
}

export interface InventoryMatrixRowItem {
  id: string;
  designation: string;
  category: string;
}

interface InventoryMatrixRowProps {
  item: InventoryMatrixRowItem;
  index: number;
  striped?: boolean;
  isLast?: boolean;
}

export default function InventoryMatrixRow({
  item,
  index,
  striped = false,
  isLast = false,
}: InventoryMatrixRowProps): React.JSX.Element {
  const catalogEntry = ITEM_CATALOG[item.id];
  const displayName = formatItemDisplayName(
    catalogEntry?.name ?? item.designation,
    item.id,
  );
  const description = catalogEntry?.description ?? item.category.replace(/_/g, ' ');
  const typeLabel = item.category.toUpperCase().replace(/_/g, ' ');
  const accent = categoryAccent(item.category);

  return (
    <View
      style={[
        styles.row,
        striped && styles.rowStriped,
        !isLast && styles.rowDivider,
      ]}
    >
      <View style={styles.leftCol}>
        <Text style={styles.index}>{String(index + 1).padStart(3, '0')}</Text>
        <View style={styles.iconPlaceholder} />
      </View>

      <View style={styles.midCol}>
        <Text style={styles.itemName} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={styles.itemDesc} numberOfLines={2}>
          {description}
        </Text>
      </View>

      <Text style={[styles.typeTag, { color: accent }]} numberOfLines={1}>
        {typeLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    gap: 10,
  },
  rowStriped: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 72,
    flexShrink: 0,
  },
  index: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: INDEX_MUTED,
    width: 28,
  },
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  midCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemName: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.2,
  },
  itemDesc: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 11,
    color: 'rgba(148, 163, 184, 0.85)',
    letterSpacing: 0.3,
  },
  typeTag: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
    width: 64,
    textAlign: 'right',
    flexShrink: 0,
  },
});
