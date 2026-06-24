import React, { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import SoulCoreImage from '../../assets/images/item images/soul-core.png';
import TargetFragmentImage from '../../assets/images/item images/target-fragment.png';
import VeilShardImage from '../../assets/images/item images/veil-shard.png';
import type { IncursionConsumable, IncursionConsumableId } from '../types/incursionInventory';
import type { TerminalTheme } from '../types/theme';

const TERMINAL_ACCENT = '#00ff33';
const GRID_SLOTS = 6;
const CELL_SIZE = 84;
const DETAIL_BLOCK_HEIGHT = 110;
const USE_DISABLED_BORDER = '#1a2e22';
const USE_DISABLED_BG = '#070809';
const USE_DISABLED_TEXT = '#2a4032';

const ITEM_IMAGES: Partial<Record<IncursionConsumableId, ImageSourcePropType>> = {
  'soul-core': SoulCoreImage,
  'veil-shard': VeilShardImage,
  'target-fragment': TargetFragmentImage,
};

function formatItemEffect(item: IncursionConsumable): string {
  if (item.effect === 'stun') {
    return 'EFFECT: STUN HOSTILE — SKIPS NEXT TURN // SHATTERS WORLD-ENDER';
  }
  if (item.effect === 'unimplemented') {
    return 'EFFECT: FIELD DEPLOYMENT PENDING — NOT YET OPERATIONAL';
  }
  return `EFFECT: +${item.healPercent ?? 0}% SOUL ANCHOR INTEGRITY`;
}

function getItemImage(itemId: IncursionConsumableId): ImageSourcePropType | null {
  return ITEM_IMAGES[itemId] ?? null;
}

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
  const useEnabled = selectedItem != null
    && selectedItem.quantity > 0
    && selectedItem.effect !== 'unimplemented';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <HapticPressable style={styles.backdrop} onPress={onClose}>
        <HapticPressable
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
                <HapticPressable
                  key={item?.id ?? `empty-${index}`}
                  disabled={item == null || item.quantity <= 0}
                  onPress={() => item != null && setSelectedId(item.id)}
                  style={({ pressed }) => [
                    styles.gridCell,
                    { borderColor: isSelected ? accentColor : theme.borderColor },
                    item == null ? styles.gridCellVacant : null,
                    pressed && item != null ? { opacity: 0.75 } : null,
                  ]}
                >
                  {item != null ? (
                    <>
                      {getItemImage(item.id) != null ? (
                        <View style={styles.cellImageWrap}>
                          <Image
                            source={getItemImage(item.id)!}
                            style={styles.cellImage}
                            resizeMode="contain"
                          />
                        </View>
                      ) : (
                        <View style={styles.cellImageWrap}>
                          <Text style={[styles.cellLabel, { color: accentColor }]} numberOfLines={2}>
                            {item.name.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.cellQty, { color: theme.mutedColor }]}>x{item.quantity}</Text>
                    </>
                  ) : (
                    <View style={styles.cellEmptyWrap}>
                      <Text style={[styles.cellEmpty, { color: theme.mutedColor }]}>—</Text>
                    </View>
                  )}
                </HapticPressable>
              );
            })}
          </View>

          <View style={[styles.detailBlock, { borderColor: theme.borderColor }]}>
            {selectedItem != null ? (
              <View style={styles.detailHeader}>
                {getItemImage(selectedItem.id) != null ? (
                  <View style={styles.detailImageWrap}>
                    <Image
                      source={getItemImage(selectedItem.id)!}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={styles.detailImageWrap} />
                )}
                <View style={styles.detailCopy}>
                  <Text style={[styles.detailTitle, { color: accentColor }]} numberOfLines={1}>
                    {selectedItem.name.toUpperCase()}
                  </Text>
                  <Text style={[styles.detailBody, { color: theme.primaryColor }]} numberOfLines={3}>
                    {selectedItem.description}
                  </Text>
                  <Text style={[styles.detailEffect, { color: theme.mutedColor }]} numberOfLines={2}>
                    {formatItemEffect(selectedItem)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.detailPlaceholder}>
                <Text style={[styles.detailBody, { color: theme.mutedColor }]} numberOfLines={3}>
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <HapticPressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btn,
                styles.closeBtn,
                { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.mutedColor }]}>[ CLOSE ]</Text>
            </HapticPressable>
            <HapticPressable
              disabled={!useEnabled}
              onPress={() => selectedItem != null && onUse(selectedItem.id)}
              style={({ pressed }) => [
                styles.btn,
                styles.useBtn,
                {
                  borderColor: useEnabled ? accentColor : USE_DISABLED_BORDER,
                  backgroundColor: useEnabled ? '#0a0b0f' : USE_DISABLED_BG,
                  opacity: useEnabled && pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.btnText, { color: useEnabled ? accentColor : USE_DISABLED_TEXT }]}>
                [ USE ]
              </Text>
            </HapticPressable>
          </View>
        </HapticPressable>
      </HapticPressable>
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
    justifyContent: 'space-between',
    alignContent: 'flex-start',
    rowGap: 8,
    width: '100%',
    marginBottom: 12,
  },
  gridCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
    padding: 5,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridCellVacant: {
    opacity: 0.55,
  },
  cellImageWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellImage: {
    width: '100%',
    height: '100%',
  },
  cellLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  cellQty: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    alignSelf: 'flex-end',
  },
  cellEmptyWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    fontFamily: 'monospace',
    fontSize: 10,
    textAlign: 'center',
  },
  detailBlock: {
    borderWidth: 1,
    backgroundColor: '#0a0b0f',
    padding: 12,
    marginBottom: 12,
    height: DETAIL_BLOCK_HEIGHT,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  detailImageWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailPlaceholder: {
    flex: 1,
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
    marginBottom: 4,
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
  useBtn: {},
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
