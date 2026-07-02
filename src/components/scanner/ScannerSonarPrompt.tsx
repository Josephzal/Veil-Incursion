import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';

interface ScannerSonarPromptProps {
  visible: boolean;
  onUse: () => void;
}

/** Prompt to deploy Sonar-Ping on the selected scanner vector. */
export default function ScannerSonarPrompt({
  visible,
  onUse,
}: ScannerSonarPromptProps): React.JSX.Element | null {
  if (!visible) return null;

  return (
    <View style={styles.host}>
      <HapticPressable onPress={onUse} style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}>
        <TerminalText size={7} letterSpacing={0.5} style={styles.label}>
          [ USE SONAR-PING ]
        </TerminalText>
      </HapticPressable>
      <Text style={styles.hint}>Reveal downstream vector types</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  btn: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnPressed: {
    opacity: 0.75,
    backgroundColor: '#1e293b',
  },
  label: {
    color: '#7dd3fc',
    fontWeight: '700',
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 6,
    color: '#64748b',
    letterSpacing: 0.3,
  },
});
