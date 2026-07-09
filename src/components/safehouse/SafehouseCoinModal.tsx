import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import type { SafehouseCoinService } from '../../data/expeditionKeepsakeSafehouseEngine';

const ACCENT = '#f59e0b';

const OPTIONS: Array<{ id: SafehouseCoinService; label: string; detail: string }> = [
  {
    id: 'route_cargo',
    label: 'ROUTE CARGO',
    detail: 'Banked cargo valued +15% on extract.',
  },
  {
    id: 'buy_information',
    label: 'BUY INFORMATION',
    detail: 'Reveal first node type of next depth.',
  },
  {
    id: 'stabilize_payload',
    label: 'STABILIZE PAYLOAD',
    detail: 'Reduce one unstable cargo penalty by 25%.',
  },
];

interface SafehouseCoinModalProps {
  visible: boolean;
  accentColor: string;
  fontScale: number;
  onSelect: (service: SafehouseCoinService) => void;
}

export default function SafehouseCoinModal({
  visible,
  accentColor,
  fontScale,
  onSelect,
}: SafehouseCoinModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.panel, { borderColor: accentColor }]}>
          <Text style={[styles.title, { fontSize: 11 * fontScale, color: ACCENT }]}>
            SAFEHOUSE COIN // ONE FAVOR
          </Text>
          <Text style={[styles.subtitle, { fontSize: 9 * fontScale }]}>
            Authorized off-the-books service — choose one.
          </Text>
          <View style={styles.optionCol}>
            {OPTIONS.map((option) => (
              <HapticPressable
                key={option.id}
                onPress={() => onSelect(option.id)}
                style={(state: { pressed: boolean }) => [
                  styles.optionBtn,
                  {
                    borderColor: state.pressed ? accentColor : 'rgba(148, 163, 184, 0.35)',
                    opacity: state.pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.optionLabel, { fontSize: 10 * fontScale, color: accentColor }]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDetail, { fontSize: 8.5 * fontScale }]}>
                  {option.detail}
                </Text>
              </HapticPressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(9, 9, 11, 0.96)',
    borderWidth: 1,
    borderRadius: 4,
    padding: 20,
    gap: 12,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: 'monospace',
    color: '#94a3b8',
    lineHeight: 14,
  },
  optionCol: {
    gap: 10,
    marginTop: 4,
  },
  optionBtn: {
    borderWidth: 1,
    borderRadius: 3,
    padding: 12,
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  optionLabel: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  optionDetail: {
    fontFamily: 'monospace',
    color: '#cbd5e1',
    lineHeight: 13,
  },
});
