import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import RunItemSlotChip from './RunItemSlotChip';
import type { RunItemsSlotState } from '../../types/runItem';
import { formatRunItemSlotLabel } from '../../data/runItemUseEngine';

interface RunItemSlotsPanelProps {
  slots: RunItemsSlotState;
  accentColor: string;
  mutedColor: string;
  title?: string;
  compact?: boolean;
  onSelectCombatSlot?: (slotIndex: 0 | 1) => void;
  onSelectFieldSlot?: (slotIndex: 0 | 1) => void;
  onClearCombatSlot?: (slotIndex: 0 | 1) => void;
  onClearFieldSlot?: (slotIndex: 0 | 1) => void;
  selectedCombatSlot?: 0 | 1 | null;
  selectedFieldSlot?: 0 | 1 | null;
}

export default function RunItemSlotsPanel({
  slots,
  accentColor,
  mutedColor,
  title = 'RUN ITEMS',
  compact = false,
  onSelectCombatSlot,
  onSelectFieldSlot,
  onClearCombatSlot,
  onClearFieldSlot,
  selectedCombatSlot = null,
  selectedFieldSlot = null,
}: RunItemSlotsPanelProps): React.JSX.Element {
  return (
    <View style={styles.root}>
      {title ? (
        <TerminalText variant="section" style={[styles.title, { color: accentColor }]}>
          {title}
        </TerminalText>
      ) : null}
      <TerminalText variant="caption" style={{ color: mutedColor, marginBottom: 6 }}>
        COMBAT CONSUMABLES
      </TerminalText>
      <View style={styles.row}>
        {slots.combatSlots.map((itemId, index) => {
          const slotIndex = index as 0 | 1;
          return (
            <View key={`combat-${index}`} style={styles.cell}>
              <RunItemSlotChip
                itemId={itemId}
                label={formatRunItemSlotLabel('COMBAT', index)}
                accentColor={accentColor}
                mutedColor={mutedColor}
                compact={compact}
                selected={selectedCombatSlot === slotIndex}
                onPress={onSelectCombatSlot ? () => onSelectCombatSlot(slotIndex) : undefined}
                onClear={onClearCombatSlot && itemId ? () => onClearCombatSlot(slotIndex) : undefined}
              />
            </View>
          );
        })}
      </View>
      <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 8, marginBottom: 6 }}>
        FIELD TOOLS
      </TerminalText>
      <View style={styles.row}>
        {slots.fieldSlots.map((itemId, index) => {
          const slotIndex = index as 0 | 1;
          return (
            <View key={`field-${index}`} style={styles.cell}>
              <RunItemSlotChip
                itemId={itemId}
                label={formatRunItemSlotLabel('FIELD', index)}
                accentColor={accentColor}
                mutedColor={mutedColor}
                compact={compact}
                selected={selectedFieldSlot === slotIndex}
                onPress={onSelectFieldSlot ? () => onSelectFieldSlot(slotIndex) : undefined}
                onClear={onClearFieldSlot && itemId ? () => onClearFieldSlot(slotIndex) : undefined}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 2,
  },
  title: {
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
