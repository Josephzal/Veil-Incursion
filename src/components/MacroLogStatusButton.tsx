import React from 'react';
import { StyleSheet, Text } from 'react-native';
import HapticPressable from './HapticPressable';
import { TERMINAL_ACCENT } from './MacroLogCargoButton';

interface MacroLogStatusButtonProps {
  onPress: () => void;
}

export default function MacroLogStatusButton({
  onPress,
}: MacroLogStatusButtonProps): React.JSX.Element {
  return (
    <HapticPressable
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
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexShrink: 0,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: '#0a0b0f',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
