import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { getClassBoonDisplayName } from '../data/classBoonEngine';
import type { ClassType } from '../types/game';
import type { TerminalTheme } from '../types/theme';
import { LEY_BOON_SWAP_HP_COST_PCT } from '../types/overworldFeatures';

interface ClassBoonSwapOverlayProps {
  visible: boolean;
  classId: ClassType;
  ownedBoonIds: readonly string[];
  incomingBoonId: string;
  theme: TerminalTheme;
  accentColor?: string;
  onSwap: (outgoingId: string) => void;
  onCancel: () => void;
}

export default function ClassBoonSwapOverlay({
  visible,
  classId,
  ownedBoonIds,
  incomingBoonId,
  theme,
  accentColor = '#00ff33',
  onSwap,
  onCancel,
}: ClassBoonSwapOverlayProps): React.JSX.Element {
  const incomingName = getClassBoonDisplayName(classId, incomingBoonId);
  const classLabel = classId === 'HEX_SHOT'
    ? 'HEX-SHOT'
    : classId === 'ENVOY'
      ? 'ENVOY'
      : 'LEY-LINE';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <HapticPressable style={styles.backdrop} onPress={onCancel}>
        <HapticPressable
          style={[styles.panel, { borderColor: accentColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: accentColor }]}>
            {`${classLabel} BOON CAP EXCEEDED // SWAP REQUIRED`}
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedColor }]}>
            Max 5 boons active. Incoming: {incomingName}
          </Text>
          <Text style={[styles.cost, { color: '#f87171' }]}>
            Swap cost: −{LEY_BOON_SWAP_HP_COST_PCT}% Max Health
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {ownedBoonIds.map((id) => (
              <HapticPressable
                key={id}
                onPress={() => onSwap(id)}
                style={[styles.swapRow, { borderColor: accentColor }]}
              >
                <Text style={[styles.swapLabel, { color: accentColor }]}>
                  {getClassBoonDisplayName(classId, id)}
                </Text>
                <Text style={[styles.swapAction, { color: theme.mutedColor }]}>
                  [ REPLACE WITH INCOMING ]
                </Text>
              </HapticPressable>
            ))}
          </ScrollView>

          <HapticPressable onPress={onCancel} style={[styles.cancelBtn, { borderColor: theme.mutedColor }]}>
            <Text style={[styles.cancelText, { color: theme.mutedColor }]}>
              [ DECLINE INCOMING BOON ]
            </Text>
          </HapticPressable>
        </HapticPressable>
      </HapticPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#0a0b0f',
    borderWidth: 1,
    padding: 14,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 8,
    marginBottom: 4,
  },
  cost: {
    fontFamily: 'monospace',
    fontSize: 8,
    marginBottom: 10,
  },
  scroll: {
    maxHeight: 280,
  },
  swapRow: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  swapLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  swapAction: {
    fontFamily: 'monospace',
    fontSize: 7,
  },
  cancelBtn: {
    marginTop: 8,
    alignSelf: 'center',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontFamily: 'monospace',
    fontSize: 8,
  },
});
