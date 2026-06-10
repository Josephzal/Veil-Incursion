import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import AegisLoadoutEditor from './AegisLoadoutEditor';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import { validateLoadoutCommit } from '../utils/aegisLoadoutUtils';

const WEAPON_WIREFRAME = [
  '    ┌──────────────┐',
  '    │   ╱╲    ╱╲   │',
  '    │  ╱  ╲  ╱  ╲  │',
  '    │ ╱ BLADE ╲ │',
  '    │╱  CORE   ╲│',
  '    └─────┬──────┘',
  '          │ GRIP',
  '          └───┘',
].join('\n');

const PANEL_BG = '#121416';

function ManifestSection({
  title,
  children,
  borderColor,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  borderColor: string;
  accentColor: string;
}) {
  return (
    <View style={[styles.section, { borderColor, backgroundColor: PANEL_BG }]}>
      <Text style={[styles.sectionTitle, { color: accentColor }]}>{title}</Text>
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
  const slots = manifest.active_slots;
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
  const border = theme.borderColor;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.backgroundColor }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerBand, { borderColor: border, backgroundColor: PANEL_BG }]}>
        <Text style={[styles.headerTitle, { color: accent }]}>
          ASSET MANIFEST // OPERATIVE LEDGER
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`CLASS ${account.activeClass} // RANK ${account.operativeRank} // ${account.username}`}
        </Text>
      </View>

      <ManifestSection
        title="AEGIS COMBAT LOADOUT // PRE-RUN CONFIG"
        borderColor={border}
        accentColor={accent}
      >
        <AegisLoadoutEditor
          draft={loadoutDraft}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          onAssignAbility={assignAbilityToSlot}
          onCommit={commitLoadout}
          theme={{
            accentColor: accent,
            borderColor: border,
            mutedColor: theme.mutedColor,
            textColor: theme.textColor,
            panelBg: 'rgba(0, 0, 0, 0.35)',
          }}
          hint="Configure four active abilities before initiating a deep-dive. Eviscerate remains a hidden ultimate at full Abyssal Reserve."
          commitLabel="[ SAVE LOADOUT FOR NEXT RUN ]"
          statusMessage={loadoutStatus}
        />
      </ManifestSection>

      <ManifestSection
        title="EQUIPPED WEAPON SLOT"
        borderColor={border}
        accentColor={accent}
      >
        <Text style={[styles.slotId, { color: theme.statusColor }]}>{slots.weapon_id}</Text>
        <Text style={[styles.wireframe, { color: theme.mutedColor }]}>{WEAPON_WIREFRAME}</Text>
        <Text style={[styles.wireframeCaption, { color: theme.mutedColor }]}>
          ARCHITECTURAL BLUEPRINT // WIREFRAME PLACEHOLDER
        </Text>
      </ManifestSection>

      <ManifestSection
        title="EQUIPPED ARMOR / CASING SLOT"
        borderColor={border}
        accentColor={accent}
      >
        <ManifestRow label="FRAME SERIAL" value={slots.frame_id} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="TITLE ID" value={slots.equipped_title_id} mutedColor={theme.mutedColor} textColor={theme.textColor} />
      </ManifestSection>

      <ManifestSection
        title="CURRENCIES SEGMENT"
        borderColor={border}
        accentColor={accent}
      >
        <ManifestRow label="CRYPTO_GLIMMER" value={String(currencies.crypto_glimmer)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="CABAL_TRIBUTES" value={String(currencies.cabal_tributes)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="FREQUENCY_TOKENS" value={String(currencies.frequency_tokens)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="CABAL_CREDITS" value={String(account.cabalCredits)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="BANKED CARGO VALUE" value={`${account.bankedCargo.totalValue} CR`} mutedColor={theme.mutedColor} textColor={theme.textColor} />
      </ManifestSection>

      <ManifestSection
        title="ITEM INVENTORY MATRIX"
        borderColor={border}
        accentColor={accent}
      >
        {matrixItems.length === 0 ? (
          <Text style={[styles.emptyLine, { color: theme.mutedColor }]}>{'// MANIFEST EMPTY'}</Text>
        ) : (
          matrixItems.map((item, index) => (
            <View
              key={`${item.id}-${index}`}
              style={[styles.matrixRow, { borderBottomColor: `${border}66` }]}
            >
              <Text style={[styles.matrixIndex, { color: theme.statusColor }]}>
                {String(index + 1).padStart(3, '0')}
              </Text>
              <View style={styles.matrixBody}>
                <Text style={[styles.matrixId, { color: theme.textColor }]}>{item.id}</Text>
                <Text style={[styles.matrixDesignation, { color: accent }]}>{item.designation}</Text>
              </View>
              <Text style={[styles.matrixCategory, { color: theme.mutedColor }]}>{item.category}</Text>
            </View>
          ))
        )}
      </ManifestSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24, gap: 12 },
  headerBand: {
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
  },
  section: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  slotId: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  wireframe: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 12,
    marginBottom: 6,
  },
  wireframeCaption: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
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
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    paddingVertical: 8,
    gap: 8,
  },
  matrixIndex: {
    fontFamily: 'monospace',
    fontSize: 9,
    width: 28,
  },
  matrixBody: { flex: 1 },
  matrixId: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  matrixDesignation: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
  },
  matrixCategory: {
    fontFamily: 'monospace',
    fontSize: 8,
    width: 64,
    textAlign: 'right',
  },
});
