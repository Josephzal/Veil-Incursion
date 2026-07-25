import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HubPrimaryCta from './hub/HubPrimaryCta';
import type { TerminalTheme } from '../types/theme';

export type CargoLootPickupMode = 'REPLACE' | 'LEAVE_BEHIND';

interface CargoLootPickupOverlayProps {
  visible: boolean;
  mode: CargoLootPickupMode;
  itemName: string;
  quantityLabel?: string;
  occupantName?: string;
  theme: TerminalTheme;
  accentColor?: string;
  progressionWarning?: boolean;
  rareWarning?: boolean;
  onMerge?: () => void;
  showMerge?: boolean;
  onReplace?: () => void;
  onLeaveBehind: () => void;
  onCancel: () => void;
}

export default function CargoLootPickupOverlay({
  visible,
  mode,
  itemName,
  quantityLabel,
  occupantName,
  theme,
  accentColor = '#00ff33',
  progressionWarning = false,
  rareWarning = false,
  onMerge,
  showMerge = false,
  onReplace,
  onLeaveBehind,
  onCancel,
}: CargoLootPickupOverlayProps): React.JSX.Element {
  const danger = progressionWarning || rareWarning;
  const headerColor = danger ? '#ef4444' : accentColor;
  const header = mode === 'LEAVE_BEHIND'
    ? 'LEAVE UNPACKED CARGO?'
    : 'CARGO SLOT CONFLICT';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: headerColor, backgroundColor: '#050608' }]}>
          <Text style={[styles.header, { color: headerColor }]}>{header}</Text>
          <Text style={[styles.body, { color: theme.primaryColor }]}>
            {itemName.toUpperCase()}
            {quantityLabel ? `  ${quantityLabel}` : ''}
          </Text>
          <Text style={[styles.hint, { color: theme.mutedColor }]}>
            {mode === 'LEAVE_BEHIND'
              ? progressionWarning
                ? 'WARNING — Progression cargo still in containment will dissipate if you leave. Pack it or abandon the unlock path.'
                : rareWarning
                  ? 'Rare/apex cargo still unpacked will dissipate. Pack it onto the grid or leave it behind.'
                  : 'Unpacked containment cargo dissipates when you leave harvest. Pack it or leave it behind.'
              : progressionWarning
                ? `WARNING — Replacing will jettison ${(occupantName ?? 'cargo').toUpperCase()}. Progression items cannot be recovered.`
                : rareWarning
                  ? `Replacing will permanently jettison ${(occupantName ?? 'rare cargo').toUpperCase()}.`
                  : `Grid occupied by ${(occupantName ?? 'cargo').toUpperCase()}. Merge into a matching stack, replace (jettison occupant), or cancel.`}
          </Text>

          <View style={styles.actions}>
            <HubPrimaryCta
              label={mode === 'LEAVE_BEHIND' ? '[ KEEP PACKING ]' : '[ CANCEL ]'}
              onPress={onCancel}
              variant={mode === 'LEAVE_BEHIND' ? 'glow' : 'danger'}
              accessibilityLabel={mode === 'LEAVE_BEHIND' ? 'Keep packing' : 'Cancel'}
              minHeight={40}
              size={7.5}
              style={styles.btn}
            />

            {showMerge && onMerge ? (
              <HubPrimaryCta
                label="[ MERGE ]"
                onPress={onMerge}
                variant="glow"
                accessibilityLabel="Merge"
                minHeight={40}
                size={7.5}
                style={styles.btn}
              />
            ) : null}

            {mode === 'REPLACE' && onReplace ? (
              <HubPrimaryCta
                label="[ REPLACE ]"
                onPress={onReplace}
                variant="danger"
                accessibilityLabel="Replace"
                minHeight={40}
                size={7.5}
                style={styles.btn}
              />
            ) : null}

            {mode === 'LEAVE_BEHIND' ? (
              <HubPrimaryCta
                label="[ LEAVE BEHIND ]"
                onPress={onLeaveBehind}
                variant="danger"
                accessibilityLabel="Leave behind"
                minHeight={40}
                size={7.5}
                style={styles.btn}
              />
            ) : null}
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
    maxWidth: 360,
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
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 12,
    marginBottom: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  btn: {
    minWidth: 100,
    flexGrow: 1,
  },
});
