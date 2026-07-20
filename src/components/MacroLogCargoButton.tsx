import React from 'react';
import { StyleSheet, Text } from 'react-native';
import HapticPressable from './HapticPressable';

import { OTT } from '../constants/occultTacticalTerminalTheme';

/** Restrained terminal accent — not full neon Matrix green. */
export const TERMINAL_ACCENT = OTT.terminalGreenMuted;

interface MacroLogCargoButtonProps {
  disabled?: boolean;
  onPress: () => void;
  fontSize?: number;
}

export default function MacroLogCargoButton({
  disabled = false,
  onPress,
  fontSize = 7,
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
      <Text style={[styles.btnText, { color: TERMINAL_ACCENT, fontSize }]}>
        {disabled ? '[ CARGO LOCKED ]' : '[ CARGO ]'}
      </Text>
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
