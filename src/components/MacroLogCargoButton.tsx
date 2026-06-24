import React from 'react';
import { StyleSheet, Text } from 'react-native';
import HapticPressable from './HapticPressable';
import { TACTICAL_HUB_STACKED_RIGHT_INSET } from '../constants/combatLayout';

export const TERMINAL_ACCENT = '#00ff33';
const MACRO_LOG_HORIZONTAL_PADDING = 12;

interface MacroLogCargoButtonProps {
  disabled?: boolean;
  onPress: () => void;
}

export default function MacroLogCargoButton({
  disabled = false,
  onPress,
}: MacroLogCargoButtonProps): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: TERMINAL_ACCENT,
          opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={disabled ? 'Cargo unavailable during hostile turn' : 'Open cargo grid'}
    >
      <Text style={[styles.btnText, { color: TERMINAL_ACCENT }]}>
        {disabled ? '[ CARGO LOCKED ]' : '[ CARGO ]'}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexShrink: 0,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: TACTICAL_HUB_STACKED_RIGHT_INSET - MACRO_LOG_HORIZONTAL_PADDING,
    backgroundColor: '#0a0b0f',
  },
  btnText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
