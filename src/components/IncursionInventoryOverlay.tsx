import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IncursionConsumable, IncursionConsumableId } from '../types/incursionInventory';
import type { TerminalTheme } from '../types/theme';

const TERMINAL_ACCENT = '#00ff33';
const GRID_SLOTS = 6;

interface IncursionInventoryOverlayProps {
  visible: boolean;
  items: IncursionConsumable[];
  theme: TerminalTheme;
  accentColor?: string;
  onClose: () => void;
  onUse: (itemId: IncursionConsumableId) => void;
}

export default function IncursionInventoryOverlay({
  visible,
  items,
  theme,
  accentColor = TERMINAL_ACCENT,
  onClose,
  onUse,
}: IncursionInventoryOverlayProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<IncursionConsumableId | null>(null);

  useEffect(() => {
    if (!visible) setSelectedId(null);
  }, [visible]);

  const selectedItem = selectedId != null
    ? items.find((item) => item.id === selectedId) ?? null
    : null;

  const gridCells = Array.from({ length: GRID_SLOTS }, (_, index) => items[index] ?? null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.panel, { borderColor: accentColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.header, { color: accentColor }]}>INCURSION INVENTORY</Text>
          <Text style={[styles.subHeader, { color: theme.mutedColor }]}>
            FIELD CONSUMABLES // COMBAT DEPLOYMENT ONLY
          </Text>

          <View style={styles.grid}>
            {gridCells.map((item, index) => {
              const isSelected = item != null && item.id === selectedId;
              return (
                <Pressable
                  key={item?.id ?? `empty-${index}`}
                  disabled={item == null || item.quantity <= 0}
                  onPress={() => item != null && setSelectedId(item.id)}
                  style={({ pressed }) => [
                    styles.gridCell,
                    { borderColor: isSelected ? accentColor : theme.borderColor },
                    item == null && styles.gridCellEmpty,
                    pressed && item != null ? { opacity: 0.75 } : null,
                  ]}
                >
                  {item != null ? (
                    <>
                      <Text style={[styles.cellLabel, { color: accentColor }]} numberOfLines={2}>
                        {item.name.toUpperCase()}
                      </Text>
                      <Text style={[styles.cellQty, { color: theme.mutedColor }]}>x{item.quantity}</Text>
                    </>
                  ) : (
                    <Text style={[styles.cellEmpty, { color: theme.mutedColor }]}>—</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {selectedItem != null ? (
            <View style={[styles.detailBlock, { borderColor: theme.borderColor }]}>
              <Text style={[styles.detailTitle, { color: accentColor }]}>{selectedItem.name.toUpperCase()}</Text>
              <Text style={[styles.detailBody, { color: theme.primaryColor }]}>{selectedItem.description}</Text>
              <Text style={[styles.detailEffect, { color: theme.mutedColor }]}>
                {`EFFECT: +${selectedItem.healPercent}% SOUL ANCHOR INTEGRITY`}
              </Text>
            </View>
          ) : (
            <View style={[styles.detailBlock, styles.detailPlaceholder, { borderColor: theme.borderColor }]}>
              <Text style={[styles.detailBody, { color: theme.mutedColor }]}>
                SELECT A FIELD ITEM TO VIEW DEPLOYMENT DATA.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btn,
                styles.closeBtn,
                { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.mutedColor }]}>[ CLOSE ]</Text>
            </Pressable>
            <Pressable
              disabled={selectedItem == null || selectedItem.quantity <= 0}
              onPress={() => selectedItem != null && onUse(selectedItem.id)}
              style={({ pressed }) => [
                styles.btn,
                styles.useBtn,
                {
                  borderColor: accentColor,
                  opacity: selectedItem == null || selectedItem.quantity <= 0 ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: accentColor }]}>[ USE ]</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 2,
    backgroundColor: '#050608',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  subHeader: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  gridCell: {
    width: '30%',
    minHeight: 72,
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
    padding: 8,
    justifyContent: 'space-between',
  },
  gridCellEmpty: {
    opacity: 0.45,
  },
  cellLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  cellQty: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  cellEmpty: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
    alignSelf: 'center',
  },
  detailBlock: {
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
    padding: 12,
    marginBottom: 12,
    minHeight: 88,
  },
  detailPlaceholder: {
    justifyContent: 'center',
  },
  detailTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  detailBody: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  detailEffect: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtn: {
    backgroundColor: '#0a0b0f',
  },
  useBtn: {
    backgroundColor: '#0a0b0f',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
