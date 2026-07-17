import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CraftingMenuPanel from '../CraftingMenuPanel';
import HubScreenShell from './HubScreenShell';
import HubCommandBar from './HubCommandBar';
import { MarketTabs } from './marketUi';
import TerminalGlitchTransition from '../ui/TerminalGlitchTransition';
import TerminalText from '../TerminalText';
import SafehouseBlackMarketTab from '../safehouse/SafehouseBlackMarketTab';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { SELECT_ACCENT } from '../../constants/dossierSurface';

export type BlackMarketTab = 'FORGE' | 'VENDOR';

const NAV_ITEMS: Array<{ key: BlackMarketTab; label: string }> = [
  { key: 'FORGE', label: 'FORGE' },
  { key: 'VENDOR', label: 'VENDOR' },
];

export default function BlackMarketHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();
  const [activeTab, setActiveTab] = useState<BlackMarketTab>('FORGE');

  const accent = SELECT_ACCENT;

  const headerHud = (
    <>
      <TerminalText variant="body" letterSpacing={0.6} style={[styles.hudCredits, { color: accent, fontWeight: '700' }]}>
        {`${account.cabalCredits} CR`}
      </TerminalText>
      <TerminalText variant="caption" letterSpacing={0.5} style={[styles.hudResidue, { color: theme.mutedColor }]}>
        {`${account.veilResidueBalance} VEIL RESIDUE`}
      </TerminalText>
    </>
  );

  return (
    <HubScreenShell
      title="BLACK MARKET // CONTRABAND LANE"
      subtitle={`OPERATIVE ${account.username.toUpperCase()} // FABRICATION & PROCUREMENT`}
      headerRight={headerHud}
      contentStyle={styles.shellBody}
      footer={(
        <HubCommandBar
          statusLabel={`${account.cabalCredits} CR AVAILABLE // MARKET FEED STABLE`}
        />
      )}
    >
      <View style={styles.stage}>
        <View style={[styles.stickyNav, { marginBottom: scaleSpacing(12) }]}>
          <MarketTabs
            items={NAV_ITEMS}
            activeKey={activeTab}
            onChange={setActiveTab}
          />
        </View>

        <View style={styles.tabBodyFixed}>
          <TerminalGlitchTransition transitionKey={activeTab} style={styles.tabBodyFill}>
            {activeTab === 'FORGE' && <CraftingMenuPanel embedded />}
            {activeTab === 'VENDOR' && <SafehouseBlackMarketTab />}
          </TerminalGlitchTransition>
        </View>
      </View>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  shellBody: {
    flex: 1,
    minHeight: 0,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  hudCredits: {
    fontWeight: '700',
    textAlign: 'right',
  },
  hudResidue: {
    textAlign: 'right',
    marginTop: 2,
  },
  stickyNav: {
    zIndex: 2,
    flexShrink: 0,
  },
  tabBodyFixed: {
    flex: 1,
    minHeight: 0,
  },
  tabBodyFill: {
    flex: 1,
    minHeight: 0,
  },
});
