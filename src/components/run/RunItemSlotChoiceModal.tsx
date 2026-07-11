import React, { useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import HapticPressable from '../HapticPressable';
import type { RunItemOfferResolution, RunItemPendingOffer, RunItemsSlotState } from '../../types/runItem';
import { getRunItemDefinition } from '../../data/runItemRegistry';
import { resolveCargoItemIcon } from '../../utils/cargoItemIcon';
import { canUseRunItemOfferNow, formatRunItemSlotLabel, type RunItemActiveContext } from '../../data/runItemUseEngine';
import { listOccupiedRunItemSlots } from '../../data/runItemInventoryEngine';

interface RunItemSlotChoiceModalProps {
  visible: boolean;
  offer: RunItemPendingOffer | null;
  slots: RunItemsSlotState;
  accentColor: string;
  mutedColor: string;
  activeContext: RunItemActiveContext;
  onResolve: (resolution: RunItemOfferResolution, slotIndex?: number) => void;
}

export default function RunItemSlotChoiceModal({
  visible,
  offer,
  slots,
  accentColor,
  mutedColor,
  activeContext,
  onResolve,
}: RunItemSlotChoiceModalProps): React.JSX.Element | null {
  const def = offer ? getRunItemDefinition(offer.itemId) : null;
  const occupiedSlots = useMemo(
    () => (offer ? listOccupiedRunItemSlots(slots, offer.slotType) : []),
    [offer, slots],
  );
  const canUseNow = def && offer ? canUseRunItemOfferNow(def, activeContext) : false;

  if (!visible || !offer || !def) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onResolve('discard')}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: accentColor }]}>
          <TerminalText variant="section" style={{ color: accentColor, textAlign: 'center' }}>
            [ RUN ITEM SLOTS FULL ]
          </TerminalText>
          <View style={styles.incomingRow}>
            <Image source={resolveCargoItemIcon(offer.itemId)} style={styles.icon} resizeMode="contain" />
            <View style={styles.incomingCopy}>
              <TerminalText variant="body" style={{ color: accentColor, fontWeight: '700' }}>
                {def.name.toUpperCase()}
              </TerminalText>
              <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                {def.effectSummary}
              </TerminalText>
            </View>
          </View>
          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 8 }}>
            Choose how to handle the incoming item. Items are never silently deleted.
          </TerminalText>

          <ScrollView style={styles.optionList} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {occupiedSlots.map(({ slotIndex, itemId }) => {
              const existing = getRunItemDefinition(itemId);
              return (
                <HapticPressable
                  key={`replace-${slotIndex}`}
                  onPress={() => onResolve('replace', slotIndex)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}10`,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <TerminalText variant="body" style={{ color: accentColor, fontWeight: '700' }}>
                    {`REPLACE ${formatRunItemSlotLabel(offer.slotType, slotIndex)}`.toUpperCase()}
                  </TerminalText>
                  <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                    {`Discard ${existing.shortName} and equip incoming item.`}
                  </TerminalText>
                </HapticPressable>
              );
            })}

            {canUseNow ? (
              <HapticPressable
                onPress={() => onResolve('use_now')}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderColor: accentColor,
                    backgroundColor: `${accentColor}18`,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <TerminalText variant="body" style={{ color: accentColor, fontWeight: '700' }}>
                  USE NOW
                </TerminalText>
                <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                  Consume immediately without occupying a slot.
                </TerminalText>
              </HapticPressable>
            ) : null}

            <HapticPressable
              onPress={() => onResolve('discard')}
              style={({ pressed }) => [
                styles.optionRow,
                {
                  borderColor: mutedColor,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  opacity: pressed ? 0.82 : 1,
                },
              ]}
            >
              <TerminalText variant="body" style={{ color: mutedColor, fontWeight: '700' }}>
                DISCARD INCOMING
              </TerminalText>
              <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                Drop the new item. Keep current loadout.
              </TerminalText>
            </HapticPressable>

            {offer.source === 'BUY' && offer.purchaseCost != null ? (
              <HapticPressable
                onPress={() => onResolve('cancel_purchase')}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <TerminalText variant="body" style={{ color: '#f59e0b', fontWeight: '700' }}>
                  CANCEL PURCHASE
                </TerminalText>
                <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                  {`Refund ${offer.purchaseCost} run credits and keep current slots.`}
                </TerminalText>
              </HapticPressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    borderWidth: 1,
    backgroundColor: 'rgba(8, 12, 18, 0.96)',
    padding: 16,
    maxHeight: '85%',
  },
  incomingRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
  },
  incomingCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionList: {
    maxHeight: 320,
  },
  optionRow: {
    borderWidth: 1,
    padding: 10,
  },
});
