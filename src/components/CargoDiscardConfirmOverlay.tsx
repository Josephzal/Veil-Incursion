import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HubPrimaryCta from './hub/HubPrimaryCta';
import type { TerminalTheme } from '../types/theme';

export type CargoDiscardConfirmMode = 'jettison' | 'field-drop';

interface CargoDiscardConfirmOverlayProps {
  visible: boolean;
  itemName: string;
  theme: TerminalTheme;
  accentColor?: string;
  routeIntelWarning?: boolean;
  rareWarning?: boolean;
  quantityLabel?: string;
  mode?: CargoDiscardConfirmMode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CargoDiscardConfirmOverlay({
  visible,
  itemName,
  theme,
  accentColor = '#00ff33',
  routeIntelWarning = false,
  rareWarning = false,
  quantityLabel,
  mode = 'jettison',
  onConfirm,
  onCancel,
}: CargoDiscardConfirmOverlayProps): React.JSX.Element {
  const fieldDrop = mode === 'field-drop';
  const danger = !fieldDrop && (routeIntelWarning || rareWarning);
  const headerColor = danger ? '#ef4444' : accentColor;

  const header = fieldDrop
    ? 'DROP INTO FIELD'
    : routeIntelWarning
      ? 'JETTISON ROUTE INTEL'
      : rareWarning
        ? 'JETTISON RARE CARGO'
        : 'JETTISON CARGO';

  const hint = fieldDrop
    ? 'Return this stack to the containment field? You can pack it again before descent.'
    : routeIntelWarning
      ? 'WARNING — Sector access route intel. Cannot be fenced. Discarding delays the next sector unlock and counts toward pity recovery. Drop permanently?'
      : rareWarning
        ? 'WARNING — Rare or apex cargo. Cannot casually recover after jettison. Drop permanently?'
        : 'Drop this stack permanently from your inventory?';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: headerColor, backgroundColor: '#050608' }]}>
          <Text style={[styles.header, { color: headerColor }]}>
            {header}
          </Text>
          <Text style={[styles.body, { color: theme.primaryColor }]}>
            {itemName.toUpperCase()}
            {quantityLabel ? `  ${quantityLabel}` : ''}
          </Text>
          <Text style={[styles.hint, { color: theme.mutedColor }]}>
            {hint}
          </Text>

          <View style={styles.actions}>
            <HubPrimaryCta
              label="[ NO ]"
              onPress={onCancel}
              variant="danger"
              accessibilityLabel="Cancel"
              minHeight={48}
              style={styles.btn}
            />
            <HubPrimaryCta
              label={fieldDrop ? '[ DROP ]' : '[ YES ]'}
              onPress={onConfirm}
              variant={fieldDrop ? 'glow' : 'danger'}
              accessibilityLabel={fieldDrop ? 'Drop into field' : 'Confirm jettison'}
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
  },
});
