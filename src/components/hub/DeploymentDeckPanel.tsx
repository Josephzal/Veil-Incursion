import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import TacticalButton from '../TacticalButton';
import CabalPanel from './CabalPanel';
import { getFactionDefinition } from '../../data/factions';
import { shadowWarBuffsToRunModifiers } from '../../data/shadowWarBuffEngine';
import { SHADOW_WAR_SECTORS } from '../../data/shadowWarSectors';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useShadowWar } from '../../context/ShadowWarContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { HUB_BORDER_INSET, hubCtaButtonStyle } from '../../constants/hubCta';
import { formatBracketHeader } from '../../styles/hubTerminalUi';
import type { PlayerAccount } from '../../types/game';
import type { ShadowWarBuffId } from '../../types/shadowWar';
import type { OperativeProfile } from '../../types/profile';
import type { TerminalTheme } from '../../types/theme';
import HubScreenShell, { HubSectionHeader } from './HubScreenShell';
import OperativeIdentityDossier from './OperativeIdentityDossier';

const LABEL_DIM = 'rgba(255, 255, 255, 0.5)';

const BUFF_LABELS: Record<ShadowWarBuffId, string> = {
  KINETIC_ARMOR_PLUS_1: '+1 Kinetic Armor layer',
  MAX_HP_PLUS_10: '+10% Max Soul Anchor',
  RARE_LOOT_PLUS_10: '+10% Rare loot drop rate',
  BLACK_MARKET_DISCOUNT_15: '15% Black Market discount',
  FIRST_TURN_AP_PLUS_1: '+1 AP on combat turn 1',
};

interface StagingFieldProps {
  label: string;
  value: string;
  valueColor: string;
}

function StagingField({ label, value, valueColor }: StagingFieldProps): React.JSX.Element {
  return (
    <View style={styles.stagingField}>
      <TerminalText
        variant="caption"
        letterSpacing={0.8}
        style={styles.stagingLabel}
      >
        {formatBracketHeader(label)}
      </TerminalText>
      <TerminalText
        variant="display"
        letterSpacing={0.5}
        style={[styles.stagingValue, { color: valueColor }]}
      >
        {value}
      </TerminalText>
    </View>
  );
}

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
  const { activeBuffs } = useShadowWar();
  const { getStashCapacitySnapshot } = usePlayerAccount();
  const {
    isDesktop,
    scaleSize,
    scaleSpacing,
    contentWidth,
    gap,
    deploymentDossierLaneWidth,
    deploymentStagingLaneWidth,
  } = useHubLayout();

  const stash = getStashCapacitySnapshot();
  const factionDef = account.alignedFaction ? getFactionDefinition(account.alignedFaction) : null;
  const factionColor = factionDef?.accentColor ?? theme.statusColor;
  const headerColor = theme.statusColor;
  const keyColor = hubKeyColor(theme.mutedColor);
  const sectionHeaderSize = isDesktop ? 10 : 9;
  const buffMods = shadowWarBuffsToRunModifiers(activeBuffs);
  const canLaunch = !runDisabled && !launching;

  const activeBuffSummary = useMemo(() => {
    if (activeBuffs.length === 0) return 'No secured sector buffs active';
    return activeBuffs.map((id) => BUFF_LABELS[id] ?? id).join(' // ');
  }, [activeBuffs]);

  const securedSectors = useMemo(
    () => SHADOW_WAR_SECTORS.filter((s) => activeBuffs.includes(s.buffId)).map((s) => s.label),
    [activeBuffs],
  );

  const stagingSection = (
    <View style={styles.stagingTop}>
      <HubSectionHeader title="STAGING MANIFEST" color={headerColor} size={sectionHeaderSize} />
      <StagingField
        label="CABAL"
        value={factionDef?.displayName ?? 'UNALIGNED'}
        valueColor={factionColor}
      />
      <StagingField
        label="STASH MANIFEST"
        value={`${stash.used}/${stash.max} SLOTS`}
        valueColor={theme.statusColor}
      />
      <View style={styles.buffBlock}>
        <StagingField
          label="SHADOW WAR BUFFS"
          value={activeBuffSummary}
          valueColor={theme.statusColor}
        />
        {securedSectors.length > 0 ? (
          <TerminalText
            variant="caption"
            letterSpacing={0.3}
            style={[styles.buffMeta, { color: keyColor }]}
          >
            {`Secured: ${securedSectors.join(', ')}`}
          </TerminalText>
        ) : null}
        {buffMods.firstTurnApBonus > 0 || buffMods.maxHpBonusPct > 0 ? (
          <TerminalText
            variant="caption"
            letterSpacing={0.3}
            style={[styles.buffMeta, { color: keyColor }]}
          >
            {`Run modifiers: +${buffMods.maxHpBonusPct}% HP, +${buffMods.firstTurnApBonus} turn-1 AP`}
          </TerminalText>
        ) : null}
      </View>
    </View>
  );

  const dropSection = (
    <View style={styles.dropSection}>
      <TerminalText
        variant="caption"
        letterSpacing={0.4}
        style={[styles.dropHint, { color: keyColor }]}
      >
        {runDisabled
          ? 'Align with a Cabal to unlock descent'
          : ''}
      </TerminalText>
      <TacticalButton
        label={launching ? '[ INITIATING DESCENT... ]' : '[ BEGIN INCURSION ]'}
        active={canLaunch}
        onPress={onBeginIncursion}
        accentColor={factionColor}
        mutedColor={theme.mutedColor}
        variant="cta"
        style={hubCtaButtonStyle(factionColor, scaleSize, scaleSpacing, !canLaunch)}
      />
    </View>
  );

  const deckContent = (
    <View
      style={[
        styles.deck,
        isDesktop ? styles.deckDesktop : styles.deckMobile,
        isDesktop
          ? {
              gap,
              flex: 1,
              alignSelf: 'stretch',
              paddingHorizontal: HUB_BORDER_INSET,
              paddingBottom: scaleSpacing(8),
              maxWidth: contentWidth,
              width: contentWidth,
            }
          : { gap: scaleSpacing(16) },
      ]}
    >
      <CabalPanel
        shrinkWrap={!isDesktop}
        fillHeight={isDesktop}
        style={[
          styles.dossierColumn,
          isDesktop ? { width: deploymentDossierLaneWidth, flexShrink: 0 } : null,
        ]}
        contentStyle={[
          styles.dossierContent,
          isDesktop ? styles.dossierContentDesktop : null,
          { padding: scaleSpacing(isDesktop ? 12 : 10) },
        ]}
      >
        <OperativeIdentityDossier theme={theme} profile={profile} account={account} />
      </CabalPanel>

      <View
        style={[
          styles.stagingColumn,
          isDesktop
            ? {
                flex: 1,
                minWidth: deploymentStagingLaneWidth,
                minHeight: 0,
                alignSelf: 'stretch',
                justifyContent: 'space-between',
              }
            : null,
        ]}
      >
        {stagingSection}
        {dropSection}
      </View>
    </View>
  );

  return (
    <HubScreenShell
      title="DEPLOYMENT // DESCENT STAGING"
      subtitle="Review operative dossier, confirm staging manifest, then breach the Veil."
      contentStyle={styles.shellBody}
    >
      <View style={styles.stage}>
        {isDesktop ? (
          <View style={styles.deckHost}>
            {deckContent}
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContentMobile,
              { paddingBottom: scaleSpacing(24), gap: scaleSpacing(16) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {deckContent}
          </ScrollView>
        )}
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
    position: 'relative',
  },
  deckHost: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    zIndex: 2,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    zIndex: 2,
  },
  scrollContentMobile: {
    flexGrow: 1,
  },
  deck: {
    width: '100%',
    alignSelf: 'center',
  },
  deckDesktop: {
    flex: 1,
    maxHeight: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  deckMobile: {
    flexDirection: 'column',
  },
  dossierColumn: {
    width: '100%',
    alignSelf: 'stretch',
  },
  dossierContent: {
    justifyContent: 'flex-start',
  },
  dossierContentDesktop: {
    flex: 1,
    minHeight: 0,
  },
  stagingColumn: {
    width: '100%',
    gap: 12,
  },
  stagingTop: {
    gap: 10,
    flexShrink: 1,
  },
  stagingField: {
    gap: 2,
  },
  stagingLabel: {
    color: LABEL_DIM,
    fontWeight: '600',
  },
  stagingValue: {
    fontWeight: '900',
  },
  buffBlock: {
    gap: 4,
  },
  buffMeta: {},
  dropSection: {
    gap: 6,
    flexShrink: 0,
    paddingHorizontal: HUB_BORDER_INSET,
    overflow: 'visible',
  },
  dropHint: {
    textAlign: 'center',
  },
});
