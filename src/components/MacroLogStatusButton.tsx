import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TERMINAL_ACCENT } from './MacroLogCargoButton';

interface MacroLogStatusButtonProps {
  onPress: () => void;
}

export default function MacroLogStatusButton({
  onPress,
}: MacroLogStatusButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: TERMINAL_ACCENT,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open operative status"
    >
      <Text style={[styles.btnText, { color: TERMINAL_ACCENT }]}>[ STATUS ]</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexShrink: 0,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#0a0b0f',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
