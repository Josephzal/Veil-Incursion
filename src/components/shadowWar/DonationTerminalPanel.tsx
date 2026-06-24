import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import {
  calculateDonationDraftIp,
  listDonatableStashResources,
  validateDonationDraft,
} from '../../data/shadowWarEngine';
import { VEIL_RESIDUE_DONATION_IP } from '../../constants/veilResidue';
import { RESOURCE_REGISTRY } from '../../data/resourceRegistry';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useShadowWar } from '../../context/ShadowWarContext';
import { useTerminal } from '../../context/TerminalContext';
import type { ResourceItemId } from '../../types/resourceItem';
import type { ShadowWarDonationDraft, ShadowWarSectorId } from '../../types/shadowWar';

const AMBER = '#d4a574';

interface DonationTerminalPanelProps {
  sectorId: ShadowWarSectorId;
  onStatus: (line: string) => void;
}

export default function DonationTerminalPanel({
  sectorId,
  onStatus,
}: DonationTerminalPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, applyShadowWarDonationAccount } = usePlayerAccount();
  const { donateToSector } = useShadowWar();
  const [draft, setDraft] = useState<ShadowWarDonationDraft>({ items: {} });
  const [uploading, setUploading] = useState(false);

  const donatable = useMemo(
    () => listDonatableStashResources(account.resourceStash),
    [account.resourceStash],
  );

  const residueDraftQty = draft.veilResidue ?? 0;
  const draftIp = calculateDonationDraftIp(draft);
  const canUpload = validateDonationDraft(account.resourceStash, account.veilResidueBalance, draft)
    && account.alignedFaction != null
    && !uploading;

  const adjustDraft = (resourceId: ResourceItemId, delta: number) => {
    setDraft((prev) => {
      const current = prev.items[resourceId] ?? 0;
      const owned = account.resourceStash[resourceId] ?? 0;
      const nextQty = Math.max(0, Math.min(owned, current + delta));
      const items = { ...prev.items };
      if (nextQty <= 0) delete items[resourceId];
      else items[resourceId] = nextQty;
      return { ...prev, items };
    });
  };

  const adjustResidueDraft = (delta: number) => {
    setDraft((prev) => {
      const current = prev.veilResidue ?? 0;
      const nextQty = Math.max(0, Math.min(account.veilResidueBalance, current + delta));
      if (nextQty <= 0) {
        const { veilResidue: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, veilResidue: nextQty };
    });
  };

  const handleUpload = async () => {
    if (!canUpload || !account.alignedFaction) return;
    setUploading(true);
    const result = await donateToSector(
      sectorId,
      account.alignedFaction,
      account.username,
      account.resourceStash,
      account.veilResidueBalance,
      draft,
    );
    if (result.success && result.nextStash != null && result.nextVeilResidueBalance != null) {
      applyShadowWarDonationAccount(result.nextStash, result.nextVeilResidueBalance);
      setDraft({ items: {} });
    }
    onStatus(result.logLine);
    setUploading(false);
  };

  return (
    <View style={[styles.root, { borderColor: '#3a3028' }]}>
      <Text style={[styles.title, { color: AMBER }]}>DONATION TERMINAL</Text>
      <Text style={[styles.sub, { color: theme.mutedColor }]}>
        Convert stash salvage or vaulted Veil Residue into Influence Points for your Cabal.
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {account.veilResidueBalance > 0 ? (
          <View style={[styles.row, styles.residueRow, { borderColor: '#3a4538' }]}>
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: theme.textColor }]}>VEIL RESIDUE</Text>
              <Text style={[styles.rowMeta, { color: theme.mutedColor }]}>
                {`${account.veilResidueBalance} vaulted // ${VEIL_RESIDUE_DONATION_IP} IP each`}
              </Text>
            </View>
            <View style={styles.rowControls}>
              <HapticPressable onPress={() => adjustResidueDraft(-1)} style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>-</Text>
              </HapticPressable>
              <Text style={[styles.qty, { color: AMBER }]}>{residueDraftQty}</Text>
              <HapticPressable onPress={() => adjustResidueDraft(1)} style={styles.stepBtn}>
                <Text style={styles.stepBtnText}>+</Text>
              </HapticPressable>
            </View>
          </View>
        ) : null}

        {donatable.length === 0 ? (
          <Text style={[styles.empty, { color: theme.mutedColor }]}>
            {account.veilResidueBalance > 0
              ? 'NO DONATABLE STASH RESOURCES — VEIL RESIDUE AVAILABLE ABOVE.'
              : 'NO DONATABLE RESOURCES IN STASH.'}
          </Text>
        ) : (
          donatable.map((entry) => {
            const qty = draft.items[entry.resourceId] ?? 0;
            return (
              <View key={entry.resourceId} style={[styles.row, { borderColor: '#2a2f36' }]}>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: theme.textColor }]}>
                    {RESOURCE_REGISTRY[entry.resourceId].name}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.mutedColor }]}>
                    {`${entry.quantity} owned // ${entry.ipValue} IP each`}
                  </Text>
                </View>
                <View style={styles.rowControls}>
                  <HapticPressable onPress={() => adjustDraft(entry.resourceId, -1)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnText}>-</Text>
                  </HapticPressable>
                  <Text style={[styles.qty, { color: AMBER }]}>{qty}</Text>
                  <HapticPressable onPress={() => adjustDraft(entry.resourceId, 1)} style={styles.stepBtn}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </HapticPressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Text style={[styles.yield, { color: AMBER }]}>{`UPLOAD YIELD: ${draftIp} IP`}</Text>

      <HapticPressable
        disabled={!canUpload}
        onPress={handleUpload}
        style={[styles.uploadBtn, { borderColor: canUpload ? AMBER : '#3a3028', opacity: canUpload ? 1 : 0.45 }]}
      >
        <Text style={[styles.uploadText, { color: canUpload ? AMBER : '#5a4a38' }]}>
          [ INITIATE UPLOAD ]
        </Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    backgroundColor: '#0d0f12',
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  title: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  sub: { fontFamily: 'monospace', fontSize: 7, lineHeight: 11 },
  list: { maxHeight: 160 },
  listContent: { gap: 6 },
  empty: { fontFamily: 'monospace', fontSize: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  residueRow: {
    backgroundColor: 'rgba(0, 255, 51, 0.04)',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  rowMeta: { fontFamily: 'monospace', fontSize: 7 },
  rowControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    borderWidth: 1,
    borderColor: '#3a3028',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: '#fff', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  qty: { fontFamily: 'monospace', fontSize: 10, fontWeight: '700', width: 20, textAlign: 'center' },
  yield: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', textAlign: 'center' },
  uploadBtn: { borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  uploadText: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
});
