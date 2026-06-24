import React from 'react';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import HapticPressable from './HapticPressable';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';

const TERMINAL_ACCENT = '#00ff33';

interface SelectionContinueButtonProps {
  enabled: boolean;
  onPress: () => void;
  label?: string;
  borderColor: string;
  mutedColor: string;
  accentColor?: string;
  style?: ViewStyle;
}

export default function SelectionContinueButton({
  enabled,
  onPress,
  label = '[ CONTINUE ]',
  borderColor: _borderColor,
  mutedColor,
  accentColor = TERMINAL_ACCENT,
  style,
}: SelectionContinueButtonProps): React.JSX.Element {
  const handlePress = () => {
    if (!enabled) return;
    onPress();
  };

  return (
    <HapticPressable
      onPress={handlePress}
      disabled={!enabled}
      style={({ pressed }) => [
        getInteractiveButtonStyle(accentColor, { disabled: !enabled, pressed, size: 'md' }),
        styles.btn,
        style,
        !enabled ? { opacity: 0.45 } : pressed ? { opacity: 0.85 } : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          getInteractiveButtonTextStyle('md'),
          { color: enabled ? accentColor : mutedColor },
        ]}
      >
        {label}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 10 },
});
