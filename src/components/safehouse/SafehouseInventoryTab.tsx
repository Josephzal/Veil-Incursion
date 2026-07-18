import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import InventoryMatrixRow from '../InventoryMatrixRow';
import { formatBracketHeader, hubTerminalUi } from '../../styles/hubTerminalUi';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useRun } from '../../context/RunContext';
import { summarizeBankSnapshot } from '../../data/runResourceLedgerEngine';
import {
  countSpecialCargoHeldInRun,
  resolveCargoRoutingContextFromIncursion,
} from '../../data/postRunCargoRoutingRunState';
import { formatCargoRoutingSafehouseIntelLines } from '../../data/cargoRoutingIntelEngine';
import {
  CARGO_OWNERSHIP_RULES_COPY,
  listNonBankableResourcesInCargo,
} from '../../data/cargoOwnershipEngine';
import { countResourcesInCargo } from '../../data/runResourceLedgerEngine';
import { getResourceDisplayName } from '../../data/resourceRegistry';
import { useTerminal } from '../../context/TerminalContext';

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

export default function SafehouseInventoryTab(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { account } = usePlayerAccount();
  const { activeIncursion } = useRun();
  const bankSummary = summarizeBankSnapshot(activeIncursion.runBankedSnapshot);
  const carriedUnits = Object.values(countResourcesInCargo(activeIncursion.cargo))
    .reduce((sum, qty) => sum + (qty ?? 0), 0);
  const nonBankable = listNonBankableResourcesInCargo(activeIncursion.cargo);
  const routingContext = resolveCargoRoutingContextFromIncursion(activeIncursion);
  const specialCargoInRun = routingContext
    ? countSpecialCargoHeldInRun(
      activeIncursion.cargo,
      activeIncursion.runBankedSnapshot,
      activeIncursion.activeContract,
      routingContext,
    )
    : 0;

  const manifest = profile.operative_profile.payload_manifest;
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={hubTerminalUi.dataSectionLeading}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('OPERATIVE LEDGER')}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`CLASS ${account.activeClass} // RANK ${account.operativeRank} // ${account.username}`}
        </Text>
      </View>

      <View style={hubTerminalUi.dataSection}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('CURRENCIES')}
        </Text>
        <ManifestRow label="CRYPTO_GLIMMER" value={String(currencies.crypto_glimmer)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="CABAL_TRIBUTES" value={String(currencies.cabal_tributes)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="FREQUENCY_TOKENS" value={String(currencies.frequency_tokens)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow label="CABAL_CREDITS" value={String(account.cabalCredits)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
        <ManifestRow
          label="CARRIED (RUN)"
          value={`${carriedUnits} UNIT(S)`}
          mutedColor={theme.mutedColor}
          textColor={theme.textColor}
        />
        <ManifestRow
          label="SAFEHOUSE BANK (RUN)"
          value={`${bankSummary.resourceCount} RES // ${bankSummary.consumableCount} ITEM`}
          mutedColor={theme.mutedColor}
          textColor={theme.textColor}
        />
        {nonBankable.length > 0 ? (
          <ManifestRow
            label="MUST EXTRACT"
            value={nonBankable.map((id) => getResourceDisplayName(id, true).toUpperCase()).join(' / ')}
            mutedColor={theme.mutedColor}
            textColor="#ef4444"
          />
        ) : null}
        {specialCargoInRun > 0 ? (
          <ManifestRow
            label="SPECIAL CARGO (RUN)"
            value={`${specialCargoInRun} STACK(S) — ROUTE ON EXTRACT`}
            mutedColor={theme.mutedColor}
            textColor={theme.statusColor}
          />
        ) : null}
      </View>

      <View style={hubTerminalUi.dataSection}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('CARGO OWNERSHIP')}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`CARRIED — ${CARGO_OWNERSHIP_RULES_COPY.CARRIED}`}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`BANKED — ${CARGO_OWNERSHIP_RULES_COPY.BANKED}`}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`EXTRACTED — ${CARGO_OWNERSHIP_RULES_COPY.EXTRACTED}`}
        </Text>
        <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
          {`LOST — ${CARGO_OWNERSHIP_RULES_COPY.LOST}`}
        </Text>
      </View>

      <View style={hubTerminalUi.dataSection}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('CARGO ROUTING')}
        </Text>
        {formatCargoRoutingSafehouseIntelLines().map((line) => (
          <Text key={line} style={[styles.headerSub, { color: theme.mutedColor, marginBottom: 4 }]}>
            {line}
          </Text>
        ))}
      </View>

      <View style={hubTerminalUi.dataSection}>
        <Text style={[hubTerminalUi.sectionHeader, { color: theme.mutedColor }]}>
          {formatBracketHeader('ITEM INVENTORY MATRIX')}
        </Text>
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
      </View>
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
    marginTop: 4,
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
