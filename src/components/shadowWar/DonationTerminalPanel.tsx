import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalOverlay from '../TerminalOverlay';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import {
  calculateDonationDraftIp,
  listDonatableStashResources,
  validateDonationDraft,
} from '../../data/shadowWarEngine';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { VEIL_RESIDUE_DONATION_IP } from '../../constants/veilResidue';
import { RESOURCE_REGISTRY } from '../../data/resourceRegistry';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useShadowWar } from '../../context/ShadowWarContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { textGlow } from '../../utils/adaptiveStyles';
import type { FactionType } from '../../types/game';
import type { ResourceItemId } from '../../types/resourceItem';
import type { ShadowWarDonationDraft, ShadowWarSectorId } from '../../types/shadowWar';

const FACTION_CTA_BG: Record<FactionType, string> = {
  TERRAN_GRID: '#334155',
  LEGION: '#5b21b6',
  SOLARIS: '#991b1b',
};

const META_DIM = 'rgba(255, 255, 255, 0.5)';

interface DonationTerminalPanelProps {
  sectorId: ShadowWarSectorId;
  onStatus: (line: string) => void;
  onClose: () => void;
}

export default function DonationTerminalPanel({
  sectorId,
  onStatus,
  onClose,
}: DonationTerminalPanelProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, applyShadowWarDonationAccount } = usePlayerAccount();
  const { donateToSector } = useShadowWar();
  const { isDesktop, scaleSize, scaleSpacing } = useHubLayout();
  const [draft, setDraft] = useState<ShadowWarDonationDraft>({ items: {} });
  const [uploading, setUploading] = useState(false);

  const factionDef = account.alignedFaction
    ? FACTION_DEFINITIONS[account.alignedFaction]
    : null;
  const cabalAccent = factionDef?.accentColor ?? theme.statusColor;
  const cabalCtaBg = account.alignedFaction
    ? FACTION_CTA_BG[account.alignedFaction]
    : '#334155';

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

  const renderDial = (qty: number, onDecrement: () => void, onIncrement: () => void) => (
    <View style={[styles.dial, { paddingHorizontal: scaleSpacing(6), gap: scaleSpacing(6) }]}>
      <HapticPressable onPress={onDecrement} style={[styles.stepBtn, { width: scaleSize(28), height: scaleSize(28) }]}>
        <TerminalText size={12} style={styles.stepBtnText}>-</TerminalText>
      </HapticPressable>
      <TerminalText size={11} style={[styles.qty, { color: cabalAccent, minWidth: scaleSize(22) }]}>
        {qty}
      </TerminalText>
      <HapticPressable onPress={onIncrement} style={[styles.stepBtn, { width: scaleSize(28), height: scaleSize(28) }]}>
        <TerminalText size={12} style={styles.stepBtnText}>+</TerminalText>
      </HapticPressable>
    </View>
  );

  return (
    <View style={styles.root}>
      <TerminalOverlay />

      <View style={[styles.header, { borderBottomColor: `${cabalAccent}44`, paddingBottom: scaleSpacing(10) }]}>
        <TerminalText
          size={isDesktop ? 9 : 8}
          letterSpacing={1.4}
          style={[styles.headerTitle, { color: cabalAccent }]}
        >
          {'>> UPLINK ESTABLISHED // PAYLOAD ROUTING'}
        </TerminalText>
        <HapticPressable onPress={onClose} style={styles.closeBtn}>
          <TerminalText size={8} letterSpacing={0.6} style={{ color: theme.mutedColor }}>
            [ CLOSE ]
          </TerminalText>
        </HapticPressable>
      </View>

      <TerminalText
        size={7}
        lineHeight={11}
        style={[styles.sub, { color: theme.mutedColor, marginTop: scaleSpacing(10) }]}
      >
        Convert stash salvage or vaulted Veil Residue into Influence Points for your Cabal.
      </TerminalText>

      <ScrollView
        style={[styles.list, { maxHeight: isDesktop ? scaleSize(280) : 180 }]}
        contentContainerStyle={[styles.listContent, { gap: scaleSpacing(8), paddingVertical: scaleSpacing(4) }]}
      >
        {account.veilResidueBalance > 0 ? (
          <View style={[styles.row, styles.residueRow]}>
            <View style={styles.rowInfo}>
              <TerminalText size={10} style={[styles.rowName, { color: theme.textColor }]}>
                VEIL RESIDUE
              </TerminalText>
              <TerminalText size={7} style={[styles.rowMeta, { color: META_DIM }]}>
                {`${account.veilResidueBalance} vaulted // ${VEIL_RESIDUE_DONATION_IP} IP each`}
              </TerminalText>
            </View>
            {renderDial(residueDraftQty, () => adjustResidueDraft(-1), () => adjustResidueDraft(1))}
          </View>
        ) : null}

        {donatable.length === 0 ? (
          <TerminalText size={8} style={{ color: theme.mutedColor }}>
            {account.veilResidueBalance > 0
              ? 'NO DONATABLE STASH RESOURCES — VEIL RESIDUE AVAILABLE ABOVE.'
              : 'NO DONATABLE RESOURCES IN STASH.'}
          </TerminalText>
        ) : (
          donatable.map((entry) => {
            const qty = draft.items[entry.resourceId] ?? 0;
            return (
              <View key={entry.resourceId} style={styles.row}>
                <View style={styles.rowInfo}>
                  <TerminalText size={10} style={[styles.rowName, { color: theme.textColor }]}>
                    {RESOURCE_REGISTRY[entry.resourceId].name.toUpperCase()}
                  </TerminalText>
                  <TerminalText size={7} style={[styles.rowMeta, { color: META_DIM }]}>
                    {`${entry.quantity} owned // ${entry.ipValue} IP each`}
                  </TerminalText>
                </View>
                {renderDial(qty, () => adjustDraft(entry.resourceId, -1), () => adjustDraft(entry.resourceId, 1))}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.footer, { marginTop: scaleSpacing(12), gap: scaleSpacing(10) }]}>
        <View style={styles.yieldBlock}>
          <TerminalText
            size={7}
            letterSpacing={1.2}
            style={[styles.yieldLabel, { color: META_DIM }]}
          >
            UPLOAD YIELD
          </TerminalText>
          <TerminalText
            size={isDesktop ? 32 : 26}
            letterSpacing={1}
            style={[
              styles.yieldValue,
              { color: cabalAccent },
              textGlow({ color: cabalAccent, radius: 14 }),
            ]}
          >
            {`${draftIp} IP`}
          </TerminalText>
        </View>

        <TacticalButton
          label="[ INITIATE UPLOAD ]"
          active={canUpload}
          onPress={handleUpload}
          accentColor={cabalAccent}
          mutedColor={theme.mutedColor}
          variant="cta"
          style={[
            {
              backgroundColor: cabalCtaBg,
              borderColor: cabalAccent,
            },
            !canUpload ? { opacity: 0.4 } : null,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 14,
  },
  header: {
    position: 'relative',
    borderBottomWidth: 1,
    paddingRight: 72,
    zIndex: 2,
  },
  headerTitle: {
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
    zIndex: 3,
  },
  sub: {
    zIndex: 2,
  },
  list: {
    zIndex: 2,
  },
  listContent: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 2,
  },
  residueRow: {
    backgroundColor: 'rgba(0, 255, 51, 0.04)',
    borderRadius: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  rowInfo: {
    flex: 1,
    flexShrink: 1,
    gap: 3,
    paddingRight: 8,
  },
  rowName: {
    fontWeight: '800',
  },
  rowMeta: {},
  dial: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    flexShrink: 0,
  },
  stepBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  qty: {
    fontWeight: '800',
    textAlign: 'center',
  },
  footer: {
    zIndex: 2,
  },
  yieldBlock: {
    alignItems: 'center',
    gap: 4,
  },
  yieldLabel: {
    fontWeight: '600',
  },
  yieldValue: {
    fontWeight: '900',
    textAlign: 'center',
  },
});
