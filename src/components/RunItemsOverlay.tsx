import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import TerminalText from './TerminalText';
import HapticPressable from './HapticPressable';
import RunItemSlotsPanel from './run/RunItemSlotsPanel';
import { useRunItemOverlay } from '../context/RunItemOverlayContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

interface RunItemsOverlayProps {
  combatMode?: boolean;
  onUseCombatItem?: (itemId: import('../types/runItem').RunItemId) => boolean;
}

export default function RunItemsOverlay({
  combatMode = false,
  onUseCombatItem,
}: RunItemsOverlayProps): React.JSX.Element | null {
  const overlay = useRunItemOverlay();
  const { theme } = useTerminal();
  const { activeIncursion, clearRunItemSlot } = useRun();

  if (!overlay?.itemsEnabled) return null;

  return (
    <Modal
      visible={overlay.itemsOpen}
      transparent
      animationType="fade"
      onRequestClose={overlay.closeItems}
    >
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: theme.statusColor }]}>
          <View style={styles.header}>
            <TerminalText variant="section" style={{ color: theme.statusColor }}>
              [ RUN ITEM MANIFEST ]
            </TerminalText>
            <HapticPressable onPress={overlay.closeItems}>
              <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
                [ CLOSE ]
              </TerminalText>
            </HapticPressable>
          </View>
          <TerminalText variant="caption" style={{ color: theme.mutedColor, marginBottom: 8 }}>
            Field tools: scanner, cargo overlay, harvest, Black Market — context must match item type.
          </TerminalText>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <RunItemSlotsPanel
              slots={activeIncursion.runItems}
              accentColor={theme.statusColor}
              mutedColor={theme.mutedColor}
              onClearCombatSlot={(slotIndex) => clearRunItemSlot('COMBAT', slotIndex)}
              onClearFieldSlot={(slotIndex) => clearRunItemSlot('FIELD', slotIndex)}
            />
            {combatMode && onUseCombatItem ? (
              <View style={styles.useSection}>
                <TerminalText variant="caption" style={{ color: theme.mutedColor, marginBottom: 6 }}>
                  DEPLOY COMBAT ITEM
                </TerminalText>
                <View style={styles.useRow}>
                  {activeIncursion.runItems.combatSlots.map((itemId, index) => {
                    if (!itemId) return null;
                    return (
                      <HapticPressable
                        key={`use-${itemId}-${index}`}
                        onPress={() => {
                          const ok = onUseCombatItem(itemId);
                          if (ok) overlay.closeItems();
                        }}
                        style={({ pressed }) => [
                          styles.useBtn,
                          {
                            borderColor: theme.statusColor,
                            opacity: pressed ? 0.82 : 1,
                          },
                        ]}
                      >
                        <TerminalText variant="caption" style={{ color: theme.statusColor, fontWeight: '700' }}>
                          {`USE SLOT ${index + 1}`}
                        </TerminalText>
                      </HapticPressable>
                    );
                  })}
                </View>
              </View>
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
    padding: 16,
  },
  panel: {
    borderWidth: 1,
    backgroundColor: 'rgba(8, 12, 18, 0.96)',
    padding: 14,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  useSection: {
    marginTop: 16,
  },
  useRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  useBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
