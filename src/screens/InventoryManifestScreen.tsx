import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';

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

function LedgerSection({
  title,
  children,
  borderColor,
  borderWidth,
  titleColor,
}: {
  title: string;
  children: React.ReactNode;
  borderColor: string;
  borderWidth: number;
  titleColor: string;
}) {
  return (
    <View style={[styles.section, { borderColor, borderWidth }]}>
      <Text style={[styles.sectionTitle, { color: titleColor }]}>{title}</Text>
      {children}
    </View>
  );
}

function LedgerLine({ label, value, theme }: { label: string; value: string; theme: { mutedColor: string; textColor: string } }) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={[styles.ledgerLabel, { color: theme.mutedColor }]}>{label}</Text>
      <Text style={[styles.ledgerValue, { color: theme.textColor }]}>{value}</Text>
    </View>
  );
}

export default function InventoryManifestScreen(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { account } = usePlayerAccount();
  const { goToHub } = useGameFlow();

  const manifest = profile.operative_profile.payload_manifest;
  const slots = manifest.active_slots;
  const currencies = manifest.currencies;
  const storedItems = manifest.stored_items ?? [];

  const accountItems = account.inventory.items.map((item) => ({
    id: item.id,
    designation: item.name.toUpperCase(),
    category: item.type,
  }));

  const matrixItems = [
    ...storedItems,
    ...accountItems.filter((ai) => !storedItems.some((si) => si.id === ai.id)),
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundColor }]}>
      <View
        style={[
          styles.topBar,
          { borderBottomColor: theme.borderColor, borderBottomWidth: theme.borderWidth },
        ]}
      >
        <Text style={[styles.topTitle, { color: theme.primaryColor }]}>ASSET MANIFEST // INVENTORY LEDGER</Text>
        <Pressable onPress={goToHub} style={[styles.backBtn, { borderColor: theme.borderColor }]}>
          <Text style={[styles.backBtnText, { color: theme.statusColor }]}>[ RETURN TO TERMINAL ]</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <LedgerSection
          title="EQUIPPED WEAPON SLOT"
          borderColor={theme.borderColor}
          borderWidth={theme.borderWidth}
          titleColor={theme.primaryColor}
        >
          <Text style={[styles.slotId, { color: theme.statusColor }]}>{slots.weapon_id}</Text>
          <Text style={[styles.wireframe, { color: theme.mutedColor }]}>{WEAPON_WIREFRAME}</Text>
          <Text style={[styles.wireframeCaption, { color: theme.mutedColor }]}>
            ARCHITECTURAL BLUEPRINT // WIREFRAME PLACEHOLDER
          </Text>
        </LedgerSection>

        <LedgerSection
          title="EQUIPPED ARMOR / CASING SLOT"
          borderColor={theme.borderColor}
          borderWidth={theme.borderWidth}
          titleColor={theme.primaryColor}
        >
          <LedgerLine label="FRAME SERIAL" value={slots.frame_id} theme={theme} />
          <LedgerLine label="TITLE ID" value={slots.equipped_title_id} theme={theme} />
        </LedgerSection>

        <LedgerSection
          title="CURRENCIES SEGMENT"
          borderColor={theme.borderColor}
          borderWidth={theme.borderWidth}
          titleColor={theme.primaryColor}
        >
          <LedgerLine label="CRYPTO_GLIMMER" value={String(currencies.crypto_glimmer)} theme={theme} />
          <LedgerLine label="CABAL_TRIBUTES" value={String(currencies.cabal_tributes)} theme={theme} />
          <LedgerLine label="FREQUENCY_TOKENS" value={String(currencies.frequency_tokens)} theme={theme} />
          <LedgerLine label="CABAL_CREDITS" value={String(account.cabalCredits)} theme={theme} />
        </LedgerSection>

        <LedgerSection
          title="ITEM INVENTORY MATRIX"
          borderColor={theme.borderColor}
          borderWidth={theme.borderWidth}
          titleColor={theme.primaryColor}
        >
          {matrixItems.length === 0 ? (
            <Text style={[styles.emptyLine, { color: theme.mutedColor }]}>{'// MANIFEST EMPTY'}</Text>
          ) : (
            matrixItems.map((item, index) => (
              <View
                key={`${item.id}-${index}`}
                style={[styles.matrixRow, { borderBottomColor: `${theme.borderColor}66` }]}
              >
                <Text style={[styles.matrixIndex, { color: theme.statusColor }]}>
                  {String(index + 1).padStart(3, '0')}
                </Text>
                <View style={styles.matrixBody}>
                  <Text style={[styles.matrixId, { color: theme.textColor }]}>{item.id}</Text>
                  <Text style={[styles.matrixDesignation, { color: theme.primaryColor }]}>{item.designation}</Text>
                </View>
                <Text style={[styles.matrixCategory, { color: theme.mutedColor }]}>{item.category}</Text>
              </View>
            ))
          )}
        </LedgerSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 12 },
  topTitle: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  backBtn: { borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  backBtnText: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },
  section: { padding: 12, marginBottom: 4 },
  sectionTitle: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  slotId: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10 },
  wireframe: { fontFamily: 'monospace', fontSize: 9, lineHeight: 12, marginBottom: 6 },
  wireframeCaption: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.5 },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  ledgerLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.5, flex: 1 },
  ledgerValue: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.3, flex: 1, textAlign: 'right' },
  emptyLine: { fontFamily: 'monospace', fontSize: 8 },
  matrixRow: { flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, paddingVertical: 8, gap: 8 },
  matrixIndex: { fontFamily: 'monospace', fontSize: 9, width: 28 },
  matrixBody: { flex: 1 },
  matrixId: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 0.3, marginBottom: 2 },
  matrixDesignation: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  matrixCategory: { fontFamily: 'monospace', fontSize: 8, width: 64, textAlign: 'right' },
});
