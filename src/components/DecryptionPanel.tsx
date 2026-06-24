import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import {
  DECRYPTION_COST,
  UNIDENTIFIED_TEMPLATE_LABELS,
} from '../types/unidentifiedItem';
import { canAffordRecipe } from '../data/resourceStashEngine';

const TERMINAL_ACCENT = '#3ecf6e';
const TERMINAL_MUTED = '#6b7c72';
const BORDER = 'rgba(62, 207, 110, 0.28)';

interface DecryptionPanelProps {
  onStatus: (line: string) => void;
}

export default function DecryptionPanel({ onStatus }: DecryptionPanelProps): React.JSX.Element {
  const { account, decryptUnidentifiedItem } = usePlayerAccount();
  const [busyId, setBusyId] = useState<string | null>(null);

  const locked = account.unidentifiedStash.filter((item) => item.state !== 'REVEALED');

  const handleDecrypt = useCallback(async (instanceId: string) => {
    setBusyId(instanceId);
    const lines = await decryptUnidentifiedItem(instanceId);
    onStatus(lines[lines.length - 1] ?? '>> DECRYPTION COMPLETE.');
    setBusyId(null);
  }, [decryptUnidentifiedItem, onStatus]);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>ANOMALY DECRYPTION // SAFEHOUSE VAULT</Text>
      <Text style={styles.copy}>
        Gatekeeper cores and caskets arrive sealed. Spend echo-glass shards to reveal weighted loot (60% salvage / 30% gear / 10% masterwork).
      </Text>
      {locked.length === 0 ? (
        <Text style={styles.empty}>NO LOCKED CONTAINERS IN VAULT.</Text>
      ) : (
        locked.map((item) => {
          const cost = DECRYPTION_COST[item.templateId];
          const affordable = canAffordRecipe(account.resourceStash, {
            id: item.instanceId,
            label: '',
            kind: 'LOADOUT',
            outputId: '',
            requirements: cost,
          });
          return (
            <View key={item.instanceId} style={[styles.card, { borderColor: BORDER }]}>
              <Text style={styles.cardTitle}>{UNIDENTIFIED_TEMPLATE_LABELS[item.templateId]}</Text>
              <Text style={styles.cardMeta}>{`STATE: ${item.state}`}</Text>
              <Text style={styles.cardMeta}>
                {`COST: ${cost.map((entry) => `${entry.quantity}× ${entry.resourceId}`).join(', ')}`}
              </Text>
              <HapticPressable
                disabled={!affordable || busyId === item.instanceId}
                onPress={() => { void handleDecrypt(item.instanceId); }}
                style={[
                  styles.actionBtn,
                  { borderColor: affordable ? TERMINAL_ACCENT : BORDER, opacity: affordable ? 1 : 0.5 },
                ]}
              >
                <Text style={styles.actionLabel}>
                  {busyId === item.instanceId ? '[ DECRYPTING... ]' : '[ INITIATE DECRYPTION ]'}
                </Text>
              </HapticPressable>
            </View>
          );
        })
      )}
      {account.unlockedBlueprints.length > 0 ? (
        <View style={[styles.unlockedBlock, { borderColor: BORDER }]}>
          <Text style={styles.unlockedTitle}>UNLOCKED BLUEPRINTS</Text>
          {account.unlockedBlueprints.map((id) => (
            <Text key={id} style={styles.unlockedLine}>{`• ${id.replace(/_/g, ' ').toUpperCase()}`}</Text>
          ))}
          {account.equippedBlueprintId ? (
            <Text style={styles.equippedLine}>
              {`ACTIVE WEAPON LINK: ${account.equippedBlueprintId.replace(/_/g, ' ').toUpperCase()}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  title: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: TERMINAL_ACCENT,
    letterSpacing: 1,
  },
  copy: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#b8c4bc',
    lineHeight: 14,
  },
  empty: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: TERMINAL_MUTED,
  },
  card: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#d8e2dc',
  },
  cardMeta: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: TERMINAL_MUTED,
  },
  actionBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  actionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: TERMINAL_ACCENT,
  },
  unlockedBlock: {
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  unlockedTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: TERMINAL_ACCENT,
  },
  unlockedLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#c5d0c8',
  },
  equippedLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#ff9f6b',
    marginTop: 4,
  },
});
