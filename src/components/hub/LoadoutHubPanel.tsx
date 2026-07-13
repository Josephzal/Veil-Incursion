import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HubScreenShell, { HubSectionHeader } from './HubScreenShell';
import DossierCardShell from './DossierCardShell';
import OperativeIdentityDossier from './OperativeIdentityDossier';
import HapticPressable from '../HapticPressable';
import TerminalGlitchTransition from '../ui/TerminalGlitchTransition';
import TerminalText from '../TerminalText';
import SafehouseAbilitiesTab from '../safehouse/SafehouseAbilitiesTab';
import SafehouseLoadoutTab from '../safehouse/SafehouseLoadoutTab';
import KeepsakeLoadoutPanel from './KeepsakeLoadoutPanel';
import RunItemLoadoutPanel from './RunItemLoadoutPanel';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { getFactionAccent } from '../../data/factions';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import WeaponLoadoutPanel from './WeaponLoadoutPanel';
import { getEquippedWeaponForClass, getWeaponTier, resolveWeaponState } from '../../data/weaponProgressionEngine';
import { formatBracketHeader } from '../../styles/hubTerminalUi';
import { HIDDEN_SCROLLVIEW_PROPS, mergeHiddenScrollbarStyle } from '../../utils/hiddenScrollbarStyle';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

export type LoadoutHubTab = 'LOADOUT' | 'CARGO';

const NAV_ITEMS: Array<{ key: LoadoutHubTab; label: string }> = [
  { key: 'LOADOUT', label: 'LOADOUT' },
  { key: 'CARGO', label: 'CARGO' },
];

function EquipmentSlotCard({
  title,
  primary,
  secondary,
  accent,
  muted,
}: {
  title: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
}): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();

  return (
    <DossierCardShell
      padding={scaleSpacing(10)}
      accentColor={accent}
      showAccentStripe
      style={styles.equipmentCard}
    >
      <HubSectionHeader title={title} color={accent} size={8} />
      <TerminalText variant="body" letterSpacing={0.35} style={[styles.equipmentPrimary, { color: accent }]}>
        {primary}
      </TerminalText>
      <TerminalText variant="caption" style={[styles.equipmentSecondary, { color: muted }]}>
        {secondary}
      </TerminalText>
    </DossierCardShell>
  );
}

export default function LoadoutHubPanel(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { account } = usePlayerAccount();
  const { isDesktop, scaleSpacing } = useHubLayout();
  const [activeTab, setActiveTab] = useState<LoadoutHubTab>('LOADOUT');

  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const accent = theme.statusColor;
  const muted = theme.mutedColor;
  const factionAccent = getFactionAccent(account.alignedFaction);

  const weaponDisplay = useMemo(() => {
    const progression = {
      weaponUnlocks: account.weaponUnlocks,
      weaponTiers: account.weaponTiers,
      equippedWeaponByClass: account.equippedWeaponByClass,
    };
    const familyId = getEquippedWeaponForClass(progression, account.activeClass);
    const tier = getWeaponTier(progression, familyId);
    const weapon = resolveWeaponState(familyId, tier);
    return {
      primary: weapon.displayName.toUpperCase(),
      secondary: weapon.effectSummary,
    };
  }, [account.activeClass, account.equippedWeaponByClass, account.weaponTiers, account.weaponUnlocks]);

  return (
    <HubScreenShell
      title="OPERATIVE LOADOUT"
      subtitle={`${classDef.displayName.toUpperCase()} // CLASS MANIFEST // DESCENT PREP`}
      scrollable={false}
      contentStyle={styles.shellBody}
    >
      <View style={styles.stage}>
        <DossierCardShell
          padding={scaleSpacing(8)}
          accentColor={accent}
          showAccentStripe
          style={styles.identityStrip}
        >
          <OperativeIdentityDossier
            theme={theme}
            profile={profile}
            account={account}
            mini
            hideManifest
          />
        </DossierCardShell>

        <View
          style={[
            styles.stickyNav,
            {
              marginTop: scaleSpacing(8),
              marginBottom: scaleSpacing(8),
              paddingVertical: scaleSpacing(4),
            },
          ]}
        >
          <View style={[styles.navRow, isDesktop && styles.navRowDesktop, { gap: scaleSpacing(isDesktop ? 8 : 6) }]}>
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.key;
              return (
                <HapticPressable
                  key={item.key}
                  onPress={() => setActiveTab(item.key)}
                  style={(state) => [
                    styles.hardwareTab,
                    isDesktop && styles.hardwareTabDesktop,
                    {
                      borderColor: active ? factionAccent : theme.borderColor,
                      backgroundColor: active ? `${factionAccent}14` : 'rgba(0, 0, 0, 0.35)',
                    },
                    terminalHoverStyle(readPressableHover(state), state.pressed),
                  ]}
                >
                  <TerminalText
                    variant="body"
                    letterSpacing={1}
                    style={{ color: active ? factionAccent : theme.mutedColor, fontWeight: '700' }}
                  >
                    {item.label}
                  </TerminalText>
                </HapticPressable>
              );
            })}
          </View>
        </View>

        <View style={styles.tabBodyFixed}>
          <TerminalGlitchTransition transitionKey={activeTab} style={styles.tabBodyFill}>
            {activeTab === 'CARGO' ? (
              <SafehouseLoadoutTab />
            ) : (
              <ScrollView
                {...HIDDEN_SCROLLVIEW_PROPS}
                style={mergeHiddenScrollbarStyle(styles.scroll)}
                contentContainerStyle={[styles.scrollContent, { gap: scaleSpacing(8), paddingBottom: scaleSpacing(12) }]}
                keyboardShouldPersistTaps="handled"
              >
                <View style={[styles.equipmentRow, isDesktop && styles.equipmentRowDesktop, { gap: scaleSpacing(8) }]}>
                  <EquipmentSlotCard
                    title="WEAPON CHASSIS"
                    primary={weaponDisplay.primary}
                    secondary={weaponDisplay.secondary}
                    accent={accent}
                    muted={muted}
                  />
                </View>

                <DossierCardShell padding={scaleSpacing(10)} accentColor={accent}>
                  <WeaponLoadoutPanel accent={accent} muted={muted} />
                </DossierCardShell>

                <KeepsakeLoadoutPanel accent={accent} muted={muted} />

                <DossierCardShell padding={scaleSpacing(10)} accentColor={accent}>
                  <RunItemLoadoutPanel accent={accent} muted={muted} />
                </DossierCardShell>

                <View style={styles.abilitiesSection}>
                  <TerminalText variant="section" letterSpacing={1.1} style={[styles.abilitiesHeader, { color: accent }]}>
                    {formatBracketHeader('ABILITY DECK')}
                  </TerminalText>
                  <DossierCardShell padding={scaleSpacing(10)} accentColor={accent}>
                    <SafehouseAbilitiesTab />
                  </DossierCardShell>
                </View>
              </ScrollView>
            )}
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
  },
  identityStrip: {
    flexShrink: 0,
  },
  stickyNav: {
    zIndex: 2,
    flexShrink: 0,
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  navRowDesktop: {
    gap: 8,
  },
  hardwareTab: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hardwareTabDesktop: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 96,
  },
  tabBodyFixed: {
    flex: 1,
    minHeight: 0,
  },
  tabBodyFill: {
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
  equipmentRow: {
    flexDirection: 'column',
  },
  equipmentRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  equipmentCard: {
    flex: 1,
    minWidth: 0,
  },
  equipmentPrimary: {
    fontWeight: '800',
    marginBottom: 4,
    fontSize: 10,
  },
  equipmentSecondary: {
    lineHeight: 13,
    fontSize: 8,
  },
  abilitiesSection: {
    gap: 6,
  },
  abilitiesHeader: {
    fontWeight: '800',
  },
});
