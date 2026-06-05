import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

const TERMINAL_ACCENT = '#00ff33';

interface SelectionContinueButtonProps {
  enabled: boolean;
  onPress: () => void;
  label?: string;
  borderColor: string;
  mutedColor: string;
  style?: ViewStyle;
}

export default function SelectionContinueButton({
  enabled,
  onPress,
  label = '[ CONTINUE ]',
  borderColor,
  mutedColor,
  style,
}: SelectionContinueButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      style={({ pressed }) => [
        styles.btn,
        style,
        {
          borderColor: enabled ? TERMINAL_ACCENT : borderColor,
          opacity: !enabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      accessibilityLabel={label}
    >
      <Text style={[styles.btnText, { color: enabled ? TERMINAL_ACCENT : mutedColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 2,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
