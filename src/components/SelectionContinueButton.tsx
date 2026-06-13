import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';
import { pulseHubButton } from '../utils/hubButtonHaptics';

const TERMINAL_ACCENT = '#00ff33';

interface SelectionContinueButtonProps {
  enabled: boolean;
  onPress: () => void;
  label?: string;
  borderColor: string;
  mutedColor: string;
  accentColor?: string;
  style?: ViewStyle;
  haptic?: boolean;
}

export default function SelectionContinueButton({
  enabled,
  onPress,
  label = '[ CONTINUE ]',
  borderColor: _borderColor,
  mutedColor,
  accentColor = TERMINAL_ACCENT,
  style,
  haptic = true,
}: SelectionContinueButtonProps): React.JSX.Element {
  const handlePress = () => {
    if (!enabled) return;
    if (haptic) pulseHubButton();
    onPress();
  };

  return (
    <Pressable
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 10 },
});
