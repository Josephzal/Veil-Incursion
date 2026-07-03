import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HubScreenShell, { HubSectionHeader } from '../hub/HubScreenShell';
import DossierCardShell from '../hub/DossierCardShell';
import TerminalText from '../TerminalText';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { HIDDEN_SCROLLVIEW_PROPS, mergeHiddenScrollbarStyle } from '../../utils/hiddenScrollbarStyle';

export default function SafehouseHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();

  const accent = theme.statusColor;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const factionName = account.alignedFaction
    ? FACTION_DEFINITIONS[account.alignedFaction].displayName
    : 'UNALIGNED';

  const stashSummary = useMemo(() => {
    const resourceCount = Object.values(account.resourceStash).reduce((sum, qty) => sum + (qty ?? 0), 0);
    const consumableKinds = Object.keys(account.hubCraftedConsumables).length;
    return { resourceCount, consumableKinds };
  }, [account.hubCraftedConsumables, account.resourceStash]);

  const headerHud = (
    <>
      <TerminalText variant="body" letterSpacing={0.6} style={[styles.hudCredits, { color: accent, fontWeight: '700' }]}>
        {`${account.cabalCredits} CR`}
      </TerminalText>
      <TerminalText variant="caption" letterSpacing={0.5} style={[styles.hudResidue, { color: theme.statusColor }]}>
        {`${account.veilResidueBalance} VEIL RESIDUE`}
      </TerminalText>
    </>
  );

  return (
    <HubScreenShell
      title="SAFEHOUSE // VEIL PREP"
      subtitle={`OPERATIVE ${account.username.toUpperCase()} // ${classDef.displayName.toUpperCase()}`}
      headerRight={headerHud}
      contentStyle={styles.shellBody}
    >
      <ScrollView
        {...HIDDEN_SCROLLVIEW_PROPS}
        style={mergeHiddenScrollbarStyle(styles.scroll)}
        contentContainerStyle={[styles.scrollContent, { gap: scaleSpacing(10), paddingBottom: scaleSpacing(12) }]}
        keyboardShouldPersistTaps="handled"
      >
        <DossierCardShell padding={scaleSpacing(14)} accentColor={accent} showAccentStripe>
          <HubSectionHeader title="OPERATIVE STATUS" color={accent} />
          <View style={styles.statusGrid}>
            <StatusRow label="CLASS" value={classDef.displayName} accent={accent} muted={theme.mutedColor} />
            <StatusRow label="CABAL" value={factionName} accent={accent} muted={theme.mutedColor} />
            <StatusRow label="RANK" value={`${account.operativeRank}`} accent={accent} muted={theme.mutedColor} />
            <StatusRow
              label="DEPTH UNLOCKED"
              value={`${account.progressionMatrix.maxDepthUnlocked}`}
              accent={accent}
              muted={theme.mutedColor}
            />
          </View>
        </DossierCardShell>

        <DossierCardShell padding={scaleSpacing(14)} accentColor={accent} showAccentStripe>
          <HubSectionHeader title="VAULT SUMMARY" color={accent} />
          <View style={styles.statusGrid}>
            <StatusRow
              label="RESOURCE UNITS"
              value={`${stashSummary.resourceCount}`}
              accent={accent}
              muted={theme.mutedColor}
            />
            <StatusRow
              label="STAGED CONSUMABLES"
              value={`${stashSummary.consumableKinds}`}
              accent={accent}
              muted={theme.mutedColor}
            />
            <StatusRow
              label="BLUEPRINTS"
              value={`${account.unlockedBlueprints.length}`}
              accent={accent}
              muted={theme.mutedColor}
            />
            <StatusRow
              label="FORGE PASSIVES"
              value={`${account.craftedAugments.length}`}
              accent={accent}
              muted={theme.mutedColor}
            />
          </View>
          <TerminalText variant="caption" style={[styles.prepNote, { color: theme.mutedColor, marginTop: scaleSpacing(10) }]}>
            Stage combat deck and pack descent cargo in Loadout, procure contraband at the Black Market, then breach from Veil Front.
          </TerminalText>
        </DossierCardShell>
      </ScrollView>
    </HubScreenShell>
  );
}

function StatusRow({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent: string;
  muted: string;
}): React.JSX.Element {
  return (
    <View style={styles.statusRow}>
      <TerminalText variant="caption" letterSpacing={0.8} style={[styles.statusLabel, { color: muted }]}>
        {label}
      </TerminalText>
      <TerminalText variant="body" letterSpacing={0.4} style={[styles.statusValue, { color: accent }]}>
        {value}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  shellBody: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hudCredits: {
    fontWeight: '700',
    textAlign: 'right',
  },
  hudResidue: {
    textAlign: 'right',
    marginTop: 2,
  },
  statusGrid: {
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statusLabel: {
    fontWeight: '700',
    flexShrink: 0,
  },
  statusValue: {
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  prepNote: {
    lineHeight: 14,
  },
});
