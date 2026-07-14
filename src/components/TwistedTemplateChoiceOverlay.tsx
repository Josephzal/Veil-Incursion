import React, { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

export default function TwistedTemplateChoiceOverlay(): React.JSX.Element | null {
  const { activeIncursion, commitTwistedTemplateChoice } = useRun();
  const { theme } = useTerminal();
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const choice = activeIncursion.depthIdentity?.pendingTwistedChoice ?? null;
  const accentColor = theme.primaryColor;
  const mutedColor = theme.mutedColor;

  const handleConfirm = useCallback(() => {
    if (!selectedValue) return;
    commitTwistedTemplateChoice(selectedValue);
    setSelectedValue(null);
  }, [commitTwistedTemplateChoice, selectedValue]);

  if (!choice) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: accentColor }]}>
          <TerminalText variant="section" style={{ color: accentColor, textAlign: 'center' }}>
            {`[ TWISTED // ${choice.title.toUpperCase()} ]`}
          </TerminalText>
          <TerminalText variant="caption" style={{ color: mutedColor, textAlign: 'center', marginTop: 8 }}>
            {choice.prompt}
          </TerminalText>

          {choice.warnings.length > 0 ? (
            <View style={styles.warningBlock}>
              {choice.warnings.map((warning) => (
                <TerminalText
                  key={warning}
                  variant="caption"
                  style={{ color: '#f59e0b', textAlign: 'center', marginTop: 4 }}
                >
                  {warning}
                </TerminalText>
              ))}
            </View>
          ) : null}

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

          <HapticPressable
            onPress={handleConfirm}
            disabled={selectedValue == null}
            style={({ pressed }) => [
              styles.confirmBtn,
              {
                borderColor: accentColor,
                backgroundColor: `${accentColor}22`,
                opacity: selectedValue == null ? 0.45 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <TerminalText size={10} letterSpacing={1.2} style={{ color: accentColor, fontWeight: '800' }}>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    borderWidth: 1,
    backgroundColor: '#050608',
    padding: 16,
  },
  warningBlock: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  optionList: {
    maxHeight: 320,
  },
  optionRow: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  confirmBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
});
