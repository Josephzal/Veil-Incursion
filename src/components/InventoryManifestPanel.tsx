import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import AegisLoadoutEditor from './AegisLoadoutEditor';
import InventoryMatrixRow from './InventoryMatrixRow';
import {
  formatBracketHeader,
  hubTerminalUi,
} from '../styles/hubTerminalUi';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import { validateLoadoutCommit } from '../utils/aegisLoadoutUtils';

function ManifestSection({
  title,
  children,
  mutedColor,
  leading = false,
}: {
  title: string;
  children: React.ReactNode;
  mutedColor: string;
  leading?: boolean;
}) {
  return (
    <View style={leading ? hubTerminalUi.dataSectionLeading : hubTerminalUi.dataSection}>
      <Text style={[hubTerminalUi.sectionHeader, { color: mutedColor }]}>
        {formatBracketHeader(title)}
      </Text>
      {children}
    </View>
  );
}

function ManifestRow({
  label,
  value,
  mutedColor,
  textColor,
}: {
  label: string;
  value: string;
  mutedColor: string;
  textColor: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: textColor }]}>{value}</Text>
    </View>
  );
}

export default function InventoryManifestPanel(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { account, setAegisLoadout, appendHubLog } = usePlayerAccount();

  const manifest = profile.operative_profile.payload_manifest;
  const currencies = manifest.currencies;
  const storedItems = manifest.stored_items ?? [];

  const [loadoutDraft, setLoadoutDraft] = useState<AegisAbilityId[]>([...account.aegisLoadout]);
  const [selectedSlot, setSelectedSlot] = useState<0 | 1 | 2 | 3>(0);
  const [loadoutStatus, setLoadoutStatus] = useState<string | null>(null);

  useEffect(() => {
    setLoadoutDraft([...account.aegisLoadout]);
  }, [account.aegisLoadout]);

  const accountItems = account.inventory.items.map((item) => ({
    id: item.id,
    designation: item.name.toUpperCase(),
    category: item.type,
  }));

  const matrixItems = [
    ...storedItems,
    ...accountItems.filter((ai) => !storedItems.some((si) => si.id === ai.id)),
  ];

  const assignAbilityToSlot = useCallback((abilityId: AegisAbilityId) => {
    if (abilityId === 'EVISCERATE') return;
    setLoadoutDraft((prev) => {
      const next = [...prev];
      next[selectedSlot] = abilityId;
      return next;
    });
    setLoadoutStatus(null);
  }, [selectedSlot]);

  const commitLoadout = useCallback(() => {
    const rejection = validateLoadoutCommit(loadoutDraft);
    if (rejection) {
      setLoadoutStatus(rejection);
      return;
    }
    const committed: AegisLoadout = [
      loadoutDraft[0],
      loadoutDraft[1],
      loadoutDraft[2],
      loadoutDraft[3],
    ];
    setAegisLoadout(committed);
    appendHubLog('>> AEGIS LOADOUT LOCKED — combat deck staged for next incursion.');
    setLoadoutStatus('>> LOADOUT COMMITTED — CARRIES INTO NEXT RUN.');
  }, [appendHubLog, loadoutDraft, setAegisLoadout]);

  const accent = theme.primaryColor;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={hubTerminalUi.dataSectionLeading}>
        <Text style={[hubTerminalUi.sectionHeaderLg, { color: theme.mutedColor }]}>
          {formatBracketHeader('ASSET MANIFEST // OPERATIVE LEDGER')}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`CLASS ${account.activeClass} // RANK ${account.operativeRank} // ${account.username}`}
        </Text>
      </View>

      <ManifestSection title="PRE-RUN CONFIG" mutedColor={theme.mutedColor}>
        <AegisLoadoutEditor
          draft={loadoutDraft}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          onAssignAbility={assignAbilityToSlot}
          onCommit={commitLoadout}
          theme={{
            accentColor: accent,
            borderColor: theme.borderColor,
            mutedColor: theme.mutedColor,
            textColor: theme.textColor,
          }}
          hint="Configure four active abilities before initiating a deep-dive. Eviscerate remains a hidden ultimate at full Abyssal Reserve."
          commitLabel="[ SAVE LOADOUT FOR NEXT RUN ]"
          statusMessage={loadoutStatus}
        />
      </ManifestSection>

      <ManifestSection title="CURRENCIES" mutedColor={theme.mutedColor}>
        <ManifestRow label="CRYPTO_GLIMMER" value={String(currencies.crypto_glimmer)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="CABAL_TRIBUTES" value={String(currencies.cabal_tributes)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="FREQUENCY_TOKENS" value={String(currencies.frequency_tokens)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="CABAL_CREDITS" value={String(account.cabalCredits)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="BANKED CARGO VALUE" value={`${account.bankedCargo.totalValue} CR`} mutedColor={theme.mutedColor} textColor={theme.textColor} />
      </ManifestSection>

      <ManifestSection title="ITEM INVENTORY MATRIX" mutedColor={theme.mutedColor}>
        {matrixItems.length === 0 ? (
          <Text style={[styles.emptyLine, { color: theme.mutedColor }]}>{'// MANIFEST EMPTY'}</Text>
        ) : (
          matrixItems.map((item, index) => (
            <InventoryMatrixRow
              key={`${item.id}-${index}`}
              item={item}
              index={index}
              striped={index % 2 === 1}
              isLast={index === matrixItems.length - 1}
            />
          ))
        )}
      </ManifestSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  rowLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
    flex: 1,
  },
  rowValue: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'right',
  },
  emptyLine: {
    fontFamily: 'monospace',
    fontSize: 8,
  },
});
