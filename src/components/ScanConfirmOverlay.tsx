import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BIOME_DISPLAY_LABEL,
  getEncounterDisplayLabel,
} from '../data/descentEngine';
import { IncursionNode } from '../types/game';
import { SCAN_ENGAGE_STAMINA_COST } from '../types/run';
import { TerminalTheme } from '../types/theme';

interface ScanConfirmOverlayProps {
  visible: boolean;
  node: IncursionNode | null;
  theme: TerminalTheme;
  accentColor: string;
  currentStamina: number;
  onAbort: () => void;
  onEngage: () => void;
}

export default function ScanConfirmOverlay({
  visible,
  node,
  theme,
  accentColor,
  currentStamina,
  onAbort,
  onEngage,
}: ScanConfirmOverlayProps): React.JSX.Element {
  const canEngage = currentStamina >= SCAN_ENGAGE_STAMINA_COST;

  return (
    <Modal visible={visible && node != null} transparent animationType="fade" onRequestClose={onAbort}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.panel,
            {
              borderColor: accentColor,
              backgroundColor: '#050608',
            },
          ]}
        >
          <Text style={[styles.header, { color: accentColor }]}>
            {node?.isPreDiscovered ? 'PRIORITY THREAT IDENTIFIED' : 'VECTOR CLASSIFICATION PREVIEW'}
          </Text>
          <Text style={[styles.subHeader, { color: theme.mutedColor }]}>
            DEPTH {node != null ? node.depthIndex + 1 : '—'}/10 // TERMINAL CONFIRMATION REQUIRED
          </Text>

          <View style={[styles.dataBlock, { borderColor: theme.borderColor }]}>
            <Text style={[styles.fieldLabel, { color: theme.mutedColor }]}>ENCOUNTER TYPE</Text>
            <Text style={[styles.fieldValue, { color: theme.primaryColor }]}>
              {node != null
                ? getEncounterDisplayLabel(node.encounterType, node.depthIndex).toUpperCase()
                : '—'}
            </Text>

            <Text style={[styles.fieldLabel, { color: theme.mutedColor, marginTop: 12 }]}>ACTIVE BIOME</Text>
            <Text style={[styles.fieldValue, { color: theme.primaryColor }]}>
              {node != null ? BIOME_DISPLAY_LABEL[node.biome].toUpperCase() : '—'}
            </Text>
          </View>

          {node?.isPreDiscovered ? (
            <Text style={[styles.bossNote, { color: accentColor }]}>
              HIGH-VALUE MANIFESTED CORE — PRE-SCANNED BY DESCENT ENGINE. ENGAGE TO INITIATE FINAL INCURSION.
            </Text>
          ) : (
            <Text style={[styles.costNote, { color: theme.mutedColor }]}>
              {`ENGAGE COST: ${SCAN_ENGAGE_STAMINA_COST} STAMINA // CURRENT RESERVE: ${currentStamina}`}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onAbort}
              style={({ pressed }) => [
                styles.btn,
                styles.abortBtn,
                { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: theme.mutedColor }]}>[ ABORT ]</Text>
            </Pressable>
            <Pressable
              onPress={onEngage}
              disabled={!canEngage}
              style={({ pressed }) => [
                styles.btn,
                styles.engageBtn,
                {
                  borderColor: canEngage ? accentColor : theme.borderColor,
                  opacity: !canEngage ? 0.4 : pressed ? 0.75 : 1,
                  backgroundColor: canEngage ? '#0d1a12' : '#0a0b0f',
                },
              ]}
            >
              <Text style={[styles.btnText, { color: canEngage ? accentColor : theme.mutedColor }]}>
                [ ENGAGE ]
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.82)',
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
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  subHeader: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  dataBlock: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0a0b0f',
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1.2,
  },
  fieldValue: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  bossNote: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  costNote: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 14,
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
  },
  abortBtn: {
    backgroundColor: '#0a0b0f',
  },
  engageBtn: {},
  btnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
