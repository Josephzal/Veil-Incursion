import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import type { TerminalTheme } from '../types/theme';

interface CargoDiscardConfirmOverlayProps {
  visible: boolean;
  itemName: string;
  theme: TerminalTheme;
  accentColor?: string;
  /** Stronger warning for sector-access route intel. */
  routeIntelWarning?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CargoDiscardConfirmOverlay({
  visible,
  itemName,
  theme,
  accentColor = '#00ff33',
  routeIntelWarning = false,
  onConfirm,
  onCancel,
}: CargoDiscardConfirmOverlayProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: routeIntelWarning ? '#ef4444' : accentColor, backgroundColor: '#050608' }]}>
          <Text style={[styles.header, { color: routeIntelWarning ? '#ef4444' : accentColor }]}>
            {routeIntelWarning ? 'JETTISON ROUTE INTEL' : 'JETTISON CARGO'}
          </Text>
          <Text style={[styles.body, { color: theme.primaryColor }]}>
            {itemName.toUpperCase()}
          </Text>
          <Text style={[styles.hint, { color: theme.mutedColor }]}>
            {routeIntelWarning
              ? 'WARNING — Sector access route intel. Cannot be fenced. Discarding delays the next sector unlock and counts toward pity recovery. Drop permanently?'
              : 'Drop this item permanently from your inventory?'}
          </Text>

          <View style={styles.actions}>
            <HapticPressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.mutedColor }]}>[ NO ]</Text>
            </HapticPressable>
            <HapticPressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: '#ef4444', opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: '#ef4444' }]}>[ YES ]</Text>
            </HapticPressable>
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
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 13,
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
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
