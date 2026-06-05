import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TerminalTheme } from '../types/theme';

interface ExtractConfirmOverlayProps {
  visible: boolean;
  theme: TerminalTheme;
  accentColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ExtractConfirmOverlay({
  visible,
  theme,
  accentColor = '#00ff33',
  onConfirm,
  onCancel,
}: ExtractConfirmOverlayProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: accentColor, backgroundColor: '#050608' }]}>
          <Text style={[styles.header, { color: accentColor }]}>EXTRACT FROM INCURSION?</Text>
          <Text style={[styles.body, { color: theme.mutedColor }]}>
            Terminate the active run. All unresolved incursion progress will be lost.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                styles.cancelBtn,
                { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.mutedColor }]}>[ NO ]</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                styles.confirmBtn,
                { borderColor: accentColor, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: accentColor }]}>[ YES ]</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  panel: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0a0b0f',
  },
  cancelBtn: {},
  confirmBtn: {},
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
