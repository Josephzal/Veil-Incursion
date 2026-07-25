import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { getFactionDefinition } from '../../data/factions';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { useHubLayout } from '../../context/HubLayoutContext';
import type { PlayerAccount } from '../../types/game';
import type { OperativeProfile } from '../../types/profile';
import type { TerminalTheme } from '../../types/theme';
import DossierCardShell from './DossierCardShell';
import HubPrimaryCta from './HubPrimaryCta';
import HubScreenShell from './HubScreenShell';
import OperativeIdentityDossier from './OperativeIdentityDossier';

interface DeploymentDeckPanelProps {
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
  runDisabled: boolean;
  launching: boolean;
  onBeginIncursion: () => void;
}

export default function DeploymentDeckPanel({
  theme,
  profile,
  account,
  runDisabled,
  launching,
  onBeginIncursion,
}: DeploymentDeckPanelProps): React.JSX.Element {
  const {
    scaleSize,
    scaleSpacing,
    fontScale,
    contentWidth,
  } = useHubLayout();

  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const factionColor = factionDef?.accentColor ?? theme.statusColor;
  const keyColor = hubKeyColor(theme.mutedColor);
  const canLaunch = !runDisabled && !launching;

  const cardPadding = scaleSpacing(16);
  const ctaMinHeight = scaleSize(52);

  return (
    <HubScreenShell
      title="DEPLOYMENT // OPERATIVE DOSSIER"
      subtitle="Verify credentials. Confirm loadout. Breach the Veil."
      contentStyle={styles.shellBody}
    >
      <View style={styles.stage}>
        <View style={styles.dossierHost}>
          <DossierCardShell
            padding={cardPadding}
            accentColor={factionColor}
            style={{ maxWidth: contentWidth }}
            contentStyle={styles.dossierContent}
          >
            <OperativeIdentityDossier theme={theme} profile={profile} account={account} />

            <View style={[styles.ctaBlock, { marginTop: scaleSpacing(14), gap: scaleSpacing(6) }]}>
              {runDisabled ? (
                <TerminalText
                  variant="caption"
                  letterSpacing={0.4}
                  style={[styles.dropHint, { color: keyColor, fontSize: Math.max(8, 9 * fontScale) }]}
                >
                  Align with a Cabal to unlock descent
                </TerminalText>
              ) : null}
              <HubPrimaryCta
                label={launching ? '[ INITIATING DESCENT... ]' : '[ BEGIN INCURSION ]'}
                onPress={onBeginIncursion}
                disabled={!canLaunch}
                variant="classic"
                accessibilityLabel="Begin incursion"
                minHeight={ctaMinHeight}
                style={styles.breachButton}
              />
            </View>
          </DossierCardShell>
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
  },
  dossierHost: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    minHeight: 0,
  },
  dossierContent: {
    flex: 0,
    minHeight: 0,
  },
  ctaBlock: {
    width: '100%',
  },
  breachButton: {
    width: '100%',
    alignSelf: 'stretch',
  },
  dropHint: {
    textAlign: 'center',
  },
});
