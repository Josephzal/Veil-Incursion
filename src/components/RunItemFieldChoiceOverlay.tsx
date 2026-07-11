import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

export default function RunItemFieldChoiceOverlay(): React.JSX.Element | null {
  const { activeIncursion, commitRunItemFieldChoice } = useRun();
  const { theme } = useTerminal();
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const choice = activeIncursion.itemRuntime.pendingFieldChoice;
  const visible = choice != null;

  const title = useMemo(() => {
    if (!choice) return '[ FIELD TOOL ]';
    switch (choice.kind) {
      case 'relay_spike_action':
        return '[ RELAY SPIKE ]';
      case 'echo_tuning_fork':
        return '[ ECHO TUNING FORK ]';
      case 'anchor_needle':
        return '[ ANCHOR NEEDLE ]';
      default:
        return '[ FIELD TOOL ]';
    }
  }, [choice]);

  const handleConfirm = useCallback(() => {
    if (!selectedValue) return;
    commitRunItemFieldChoice(selectedValue);
    setSelectedValue(null);
  }, [commitRunItemFieldChoice, selectedValue]);

  if (!visible || !choice) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: theme.primaryColor }]}>
          <TerminalText variant="section" style={{ color: theme.primaryColor, textAlign: 'center' }}>
            {title}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: theme.mutedColor, textAlign: 'center', marginTop: 8 }}>
            {choice.prompt}
          </TerminalText>

          <ScrollView
            style={styles.optionList}
            contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {choice.options.map((option) => {
              const selected = selectedValue === option.value;
              return (
                <HapticPressable
                  key={option.value}
                  onPress={() => setSelectedValue(option.value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      borderColor: selected ? theme.primaryColor : theme.mutedColor,
                      backgroundColor: selected ? `${theme.primaryColor}14` : 'rgba(0, 0, 0, 0.35)',
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <TerminalText
                    variant="body"
                    style={{ color: selected ? theme.primaryColor : theme.mutedColor, fontWeight: '700' }}
                  >
                    {option.label.toUpperCase()}
                  </TerminalText>
                  <TerminalText variant="caption" style={{ color: theme.mutedColor, marginTop: 4 }}>
                    {option.detail}
                  </TerminalText>
                </HapticPressable>
              );
            })}
          </ScrollView>

          <HapticPressable
            onPress={handleConfirm}
            disabled={selectedValue == null}
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                borderColor: theme.primaryColor,
                backgroundColor: `${theme.primaryColor}22`,
                opacity: selectedValue == null ? 0.45 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <TerminalText size={10} letterSpacing={1.2} style={{ color: theme.primaryColor, fontWeight: '800' }}>
              [ CONFIRM ]
            </TerminalText>
          </HapticPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 16,
    maxHeight: '80%',
  },
  optionList: {
    maxHeight: 320,
  },
  optionRow: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
  },
  confirmBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
