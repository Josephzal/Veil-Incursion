import React, { useEffect, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { listHubStagedConsumables, isRunItemHubConsumable } from '../../../data/hubSafehouseEngine';
import { getRunItemDefinitionByAnyId } from '../../../data/runItemRegistry';
import { formatRunItemSlotLabel } from '../../../data/runItemUseEngine';
import type { CargoItemId } from '../../../types/cargoGrid';
import { MUTED, TERMINAL, TEXT_PRIMARY, TEXT_SECONDARY } from './loadoutTerminalUi';

export type FieldKitSelection =
  | { kind: 'SLOT'; slotType: 'COMBAT' | 'FIELD'; slotIndex: 0 | 1 }
  | { kind: 'ITEM'; itemId: CargoItemId }
  | null;

interface FieldKitWorkspaceProps {
  selection: FieldKitSelection;
  onSelect: (selection: FieldKitSelection) => void;
  compact?: boolean;
}

export default function FieldKitWorkspace({
  selection,
  onSelect,
  compact,
}: FieldKitWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const staged = useMemo(
    () => listHubStagedConsumables(account.hubCraftedConsumables).filter((entry) => (
      isRunItemHubConsumable(entry.itemId)
    )),
    [account.hubCraftedConsumables],
  );

  useEffect(() => {
    if (selection) return;
    const firstOccupied = ([
      ...account.runItemLoadout.combatSlots.map((itemId, index) => (
        itemId ? { kind: 'SLOT' as const, slotType: 'COMBAT' as const, slotIndex: index as 0 | 1 } : null
      )),
      ...account.runItemLoadout.fieldSlots.map((itemId, index) => (
        itemId ? { kind: 'SLOT' as const, slotType: 'FIELD' as const, slotIndex: index as 0 | 1 } : null
      )),
    ].find(Boolean) ?? null);
    if (firstOccupied) {
      onSelect(firstOccupied);
      return;
    }
    if (staged[0]) onSelect({ kind: 'ITEM', itemId: staged[0].itemId });
  }, [account.runItemLoadout, onSelect, selection, staged]);

  const slots: Array<{ slotType: 'COMBAT' | 'FIELD'; slotIndex: 0 | 1; itemId: string | null }> = [
    { slotType: 'COMBAT', slotIndex: 0, itemId: account.runItemLoadout.combatSlots[0] },
    { slotType: 'COMBAT', slotIndex: 1, itemId: account.runItemLoadout.combatSlots[1] },
    { slotType: 'FIELD', slotIndex: 0, itemId: account.runItemLoadout.fieldSlots[0] },
    { slotType: 'FIELD', slotIndex: 1, itemId: account.runItemLoadout.fieldSlots[1] },
  ];

  return (
    <View style={styles.root}>
      <View style={[styles.slotGrid, compact && styles.slotGridCompact]}>
        {slots.map((slot) => {
          const selected = selection?.kind === 'SLOT'
            && selection.slotType === slot.slotType
            && selection.slotIndex === slot.slotIndex;
          const def = slot.itemId ? getRunItemDefinitionByAnyId(slot.itemId) : null;
          return (
            <HapticPressable
              key={`${slot.slotType}-${slot.slotIndex}`}
              onPress={() => onSelect({
                kind: 'SLOT',
                slotType: slot.slotType,
                slotIndex: slot.slotIndex,
              })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${formatRunItemSlotLabel(slot.slotType, slot.slotIndex)}`}
              style={({ pressed }) => ([
                styles.slot,
                selected && styles.slotSelected,
                pressed && { opacity: 0.92 },
              ])}
            >
              {selected ? <View style={styles.slotAccent} /> : null}
              <TerminalText size={7} letterSpacing={0.9} style={styles.slotLabel}>
                {formatRunItemSlotLabel(slot.slotType, slot.slotIndex).toUpperCase()}
              </TerminalText>
              <TerminalText size={9} letterSpacing={0.35} style={styles.slotTitle} numberOfLines={1}>
                {def ? def.shortName.toUpperCase() : 'EMPTY'}
              </TerminalText>
              <TerminalText size={7.5} style={styles.slotMeta} numberOfLines={1}>
                {def ? (def.slotType === 'COMBAT' ? 'COMBAT CONSUMABLE' : 'FIELD TOOL') : 'Select a staged item'}
              </TerminalText>
            </HapticPressable>
          );
        })}
      </View>

      <View style={styles.feedHeader}>
        <TerminalText size={7.5} letterSpacing={1} style={styles.feedHeaderText}>
          STAGED ITEMS
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={1} style={styles.feedHeaderText}>
          {`${staged.length} READY`}
        </TerminalText>
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        {...(Platform.OS === 'web'
          ? ({
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(105, 200, 173, 0.24) transparent',
            } as object)
          : null)}
      >
        {staged.length === 0 ? (
          <View style={styles.empty}>
            <TerminalText size={9} letterSpacing={0.6} style={styles.emptyTitle}>
              NO STAGED ITEMS
            </TerminalText>
            <TerminalText size={8.5} style={styles.emptyBody}>
              Craft consumables at the Fabrication Matrix before descent to prepare them here.
            </TerminalText>
          </View>
        ) : (
          staged.map((entry) => {
            const def = getRunItemDefinitionByAnyId(entry.itemId);
            const selected = selection?.kind === 'ITEM' && selection.itemId === entry.itemId;
            const equippedSlot = findEquippedSlot(account, entry.itemId);
            return (
              <View
                key={entry.itemId}
                style={styles.signal}
                {...(Platform.OS === 'web'
                  ? ({ 'data-selected': selected ? 'true' : 'false' } as object)
                  : null)}
              >
                {selected ? <View style={styles.signalAccent} /> : null}
                <HapticPressable
                  onPress={() => onSelect({ kind: 'ITEM', itemId: entry.itemId })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Inspect ${entry.name}`}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                    styles.signalSelect,
                    selected && styles.signalSelectSelected,
                    ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
                  ])}
                >
                  <View style={styles.signalMain}>
                    <View style={styles.signalTopline}>
                      <TerminalText size={7} letterSpacing={0.9} style={styles.signalMeta}>
                        {(def?.slotType ?? 'COMBAT').toUpperCase()}
                      </TerminalText>
                      <TerminalText size={7} letterSpacing={0.9} style={styles.signalMeta}>
                        {equippedSlot ?? `×${entry.quantity}`}
                      </TerminalText>
                    </View>
                    <TerminalText size={11} letterSpacing={0.35} style={styles.signalTitle} numberOfLines={1}>
                      {entry.name.toUpperCase()}
                    </TerminalText>
                    <TerminalText size={8.5} style={styles.signalBody} numberOfLines={1}>
                      {def?.effectSummary ?? 'Staged consumable'}
                    </TerminalText>
                  </View>
                </HapticPressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function findEquippedSlot(
  account: ReturnType<typeof usePlayerAccount>['account'],
  itemId: CargoItemId,
): string | null {
  const combatIndex = account.runItemLoadout.combatSlots.findIndex((id) => id === itemId);
  if (combatIndex >= 0) return `IN ${formatRunItemSlotLabel('COMBAT', combatIndex).toUpperCase()}`;
  const fieldIndex = account.runItemLoadout.fieldSlots.findIndex((id) => id === itemId);
  if (fieldIndex >= 0) return `IN ${formatRunItemSlotLabel('FIELD', fieldIndex).toUpperCase()}`;
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'rgba(137, 170, 163, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
  },
  slotGridCompact: { paddingVertical: 10 },
  slot: {
    width: '49.6%',
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#030707',
    position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  slotSelected: { backgroundColor: 'rgba(105, 200, 173, 0.05)' },
  slotAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
  },
  slotLabel: { color: MUTED, fontWeight: '700' },
  slotTitle: { marginTop: 6, color: TEXT_PRIMARY, fontWeight: '700' },
  slotMeta: { marginTop: 5, color: TEXT_SECONDARY },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
  },
  feedHeaderText: { color: MUTED, fontWeight: '700' },
  feed: { flex: 1, minHeight: 0 },
  feedContent: { paddingBottom: 16 },
  empty: { paddingHorizontal: 28, paddingTop: 22, paddingBottom: 12 },
  emptyTitle: { color: TEXT_PRIMARY, fontWeight: '700' },
  emptyBody: { marginTop: 8, color: TEXT_SECONDARY, lineHeight: 19, maxWidth: 420 },
  signal: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  signalAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
    zIndex: 1,
  },
  signalSelect: {
    minHeight: 88,
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 28,
    paddingRight: 24,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  signalSelectHover: { backgroundColor: 'rgba(105, 200, 173, 0.035)' },
  signalSelectSelected: { backgroundColor: 'rgba(105, 200, 173, 0.06)' },
  signalMain: { minWidth: 0 },
  signalTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  signalMeta: { color: MUTED, fontWeight: '700' },
  signalTitle: { marginTop: 5, color: TEXT_PRIMARY, fontWeight: '700' },
  signalBody: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
});
