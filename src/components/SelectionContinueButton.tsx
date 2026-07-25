import React from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import HubPrimaryCta from './hub/HubPrimaryCta';
import type { HubInteractiveButtonSize } from '../styles/hubTerminalUi';

interface SelectionContinueButtonProps {
  enabled: boolean;
  onPress: () => void;
  label?: string;
  borderColor: string;
  mutedColor: string;
  accentColor?: string;
  size?: HubInteractiveButtonSize;
  style?: ViewStyle;
}

export default function SelectionContinueButton({
  enabled,
  onPress,
  label = '[ CONTINUE ]',
  style,
}: SelectionContinueButtonProps): React.JSX.Element {
  return (
    <HubPrimaryCta
      label={label}
      onPress={onPress}
      disabled={!enabled}
      variant="glow"
      accessibilityLabel={label}
      minHeight={48}
      style={[styles.btn, style]}
    />
  );
}

const styles = StyleSheet.create({
  btn: { marginTop: 0 },
});
