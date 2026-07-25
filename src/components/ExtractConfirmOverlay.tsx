import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HubPrimaryCta from './hub/HubPrimaryCta';
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
          <Text style={[styles.header, { color: accentColor }]}>EXTRACT FROM INCURSION</Text>
          <Text style={[styles.body, { color: theme.mutedColor }]}>
            Terminate the active run. All unresolved incursion progress will be lost.
          </Text>

          <View style={styles.actions}>
            <HubPrimaryCta
              label="[ NO ]"
              onPress={onCancel}
              variant="danger"
              accessibilityLabel="Cancel extract"
              minHeight={48}
              style={styles.btn}
            />
            <HubPrimaryCta
              label="[ YES ]"
              onPress={onConfirm}
              variant="glow"
              accessibilityLabel="Confirm extract"
              minHeight={48}
              style={styles.btn}
            />
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
  },
});
