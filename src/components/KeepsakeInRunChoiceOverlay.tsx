import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
import HubPrimaryCta from './hub/HubPrimaryCta';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { EXPEDITION_REQUISITION_REGISTRY } from '../data/expeditionRequisitionRegistry';

export default function KeepsakeInRunChoiceOverlay(): React.JSX.Element | null {
  const { activeIncursion, commitKeepsakePendingChoice } = useRun();
  const { theme } = useTerminal();
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const runtime = activeIncursion.requisitionRuntime;
  const choice = runtime?.pendingChoice ?? null;
  const requisition = runtime
    ? EXPEDITION_REQUISITION_REGISTRY[runtime.requisitionId]
    : null;

  const accentColor = theme.primaryColor;
  const mutedColor = theme.mutedColor;

  const visible = choice != null && requisition != null;

  const resetSelection = useCallback(() => {
    setSelectedValue(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedValue) return;
    commitKeepsakePendingChoice(selectedValue);
    resetSelection();
  }, [commitKeepsakePendingChoice, resetSelection, selectedValue]);

  const title = useMemo(() => {
    if (!choice) return '[ REQUISITION CHOICE ]';
    switch (choice.kind) {
      case 'contract_seal_clause':
        return '[ SEALED CLAUSE ]';
      case 'dead_drop_action':
        return '[ DEAD-DROP ]';
      case 'extraction_token_action':
        return '[ EXTRACTION TOKEN ]';
      case 'cartograph_lock':
        return '[ CARTOGRAPH LOCK ]';
      case 'smugglers_double_wrap':
        return "[ SMUGGLER'S WRAP ]";
      default:
        return '[ REQUISITION CHOICE ]';
    }
  }, [choice]);

  if (!visible || !choice || !requisition) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: accentColor }]}>
          <TerminalText variant="section" style={{ color: accentColor, textAlign: 'center' }}>
            {title}
          </TerminalText>
          <TerminalText variant="body" style={{ color: accentColor, textAlign: 'center', marginTop: 8 }}>
            {requisition.name.toUpperCase()}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 6 }}>
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
                      borderColor: selected ? accentColor : mutedColor,
                      backgroundColor: selected ? `${accentColor}14` : 'rgba(0, 0, 0, 0.35)',
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <TerminalText variant="body" style={{ color: selected ? accentColor : mutedColor, fontWeight: '700' }}>
                    {option.label.toUpperCase()}
                  </TerminalText>
                  <TerminalText variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                    {option.detail}
                  </TerminalText>
                </HapticPressable>
              );
            })}
          </ScrollView>

          <HubPrimaryCta
            label="[ CONFIRM ]"
            onPress={handleConfirm}
            disabled={selectedValue == null}
            variant="glow"
            accessibilityLabel="Confirm"
            minHeight={48}
            size={10}
            letterSpacing={1.2}
            style={styles.confirmBtn}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 2,
    backgroundColor: '#050608',
    padding: 16,
    maxHeight: '90%',
  },
  optionList: {
    maxHeight: 360,
  },
  optionRow: {
    borderWidth: 1,
    padding: 10,
  },
  confirmBtn: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    backgroundColor: '#0a0b0f',
  },
});
