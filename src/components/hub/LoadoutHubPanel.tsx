import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HubScreenShell from './HubScreenShell';
import DossierCardShell from './DossierCardShell';
import OperativeIdentityDossier from './OperativeIdentityDossier';
import HapticPressable from '../HapticPressable';
import TerminalGlitchTransition from '../ui/TerminalGlitchTransition';
import TerminalText from '../TerminalText';
import SafehouseAbilitiesTab from '../safehouse/SafehouseAbilitiesTab';
import SafehouseLoadoutTab from '../safehouse/SafehouseLoadoutTab';
import KeepsakeLoadoutPanel from './KeepsakeLoadoutPanel';
import RunItemLoadoutPanel from './RunItemLoadoutPanel';
import WeaponLoadoutPanel from './WeaponLoadoutPanel';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { getEquippedWeaponForClass, getWeaponTier, resolveWeaponState } from '../../data/weaponProgressionEngine';
import { getKeepsakeDefinition } from '../../data/expeditionKeepsakeRegistry';
import { getRunItemDefinitionByAnyId } from '../../data/runItemRegistry';
import { resolveClassAbilityCost } from '../../data/classAbilityResolver';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import { SELECT_ACCENT } from '../../constants/dossierSurface';
import { LoadoutSectionHeader, LoadoutTabHeader } from './loadoutTabUi';
import { HIDDEN_SCROLLVIEW_PROPS, mergeHiddenScrollbarStyle } from '../../utils/hiddenScrollbarStyle';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

type LoadoutCategory = 'CHASSIS' | 'RELIC' | 'DECK' | 'FIELD_KIT' | 'CARGO';

interface CategoryMeta {
  key: LoadoutCategory;
  label: string;
  accent: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'CHASSIS', label: 'CHASSIS', accent: '#f59e0b' },
  { key: 'RELIC', label: 'RELIC', accent: '#a78bfa' },
  { key: 'DECK', label: 'DECK', accent: '#4ade80' },
  { key: 'FIELD_KIT', label: 'FIELD KIT', accent: '#38bdf8' },
  { key: 'CARGO', label: 'CARGO', accent: '#94a3b8' },
];

const CATEGORY_HEADERS: Record<Exclude<LoadoutCategory, 'CARGO'>, { title: string; subtitle: string }> = {
  CHASSIS: {
    title: 'Weapon Chassis',
    subtitle: 'One weapon per class — locked for the run at descent.',
  },
  RELIC: {
    title: 'Expedition Relic',
    subtitle: 'Relics alter scanner behavior, route planning, cargo risk, or extraction pressure.',
  },
  DECK: {
    title: 'Ability Deck',
    subtitle: 'Four active combat slots. Slot 1 is your class anchor.',
  },
  FIELD_KIT: {
    title: 'Field Kit',
    subtitle: 'One-use combat consumables and field tools prepared for descent.',
  },
};

function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

function KitSlot({
  label,
  value,
  accent,
  active,
  muted,
  textColor,
  onPress,
  scaleFont,
  scaleSpacing,
  children,
}: {
  label: string;
  value?: string;
  accent: string;
  active: boolean;
  muted: string;
  textColor: string;
  onPress: () => void;
  scaleFont: (n: number) => number;
  scaleSpacing: (n: number) => number;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      style={(state) => [
        styles.kitSlot,
        {
          borderColor: active ? accent : HUB_DATA_DIVIDER,
          backgroundColor: active ? withAlpha(accent, '1a') : 'rgba(15, 23, 42, 0.35)',
          padding: scaleSpacing(8),
          gap: scaleSpacing(2),
        },
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      <TerminalText size={scaleFont(4.8)} letterSpacing={0.7} style={{ color: active ? accent : muted, fontWeight: '800' }}>
        {label}
      </TerminalText>
      {value != null ? (
        <TerminalText size={scaleFont(5.8)} numberOfLines={1} style={{ color: textColor, fontWeight: '700' }}>
          {value}
        </TerminalText>
      ) : null}
      {children}
    </HapticPressable>
  );
}

export default function LoadoutHubPanel(): React.JSX.Element {
  const { theme, profile } = useTerminal();
  const { account } = usePlayerAccount();
  const { isDesktop, scaleSpacing, scaleFont } = useHubLayout();
  const [activeCategory, setActiveCategory] = useState<LoadoutCategory>('CHASSIS');

  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const accent = theme.statusColor;
  const muted = theme.mutedColor;
  // Amber is the universal selection/active color across hub screens.
  const categoryAccent = SELECT_ACCENT;

  const weaponDisplay = useMemo(() => {
    const progression = {
      weaponUnlocks: account.weaponUnlocks,
      weaponTiers: account.weaponTiers,
      equippedWeaponByClass: account.equippedWeaponByClass,
    };
    const familyId = getEquippedWeaponForClass(progression, account.activeClass);
    const tier = getWeaponTier(progression, familyId);
    return resolveWeaponState(familyId, tier).displayName;
  }, [account.activeClass, account.equippedWeaponByClass, account.weaponTiers, account.weaponUnlocks]);

  const relicName = account.equippedKeepsakeId
    ? getKeepsakeDefinition(account.equippedKeepsakeId).name
    : 'None equipped';

  const abilityLoadout = useMemo(() => {
    if (account.activeClass === 'AEGIS') return account.aegisLoadout;
    if (account.activeClass === 'HEX_SHOT') return account.hexShotLoadout;
    return account.envoyLoadout;
  }, [account.activeClass, account.aegisLoadout, account.hexShotLoadout, account.envoyLoadout]);

  const abilityNames = useMemo(
    () => abilityLoadout.map((id) => resolveClassAbilityCost(account.activeClass, id).label),
    [abilityLoadout, account.activeClass],
  );

  const fieldKit = useMemo(() => {
    const nameFor = (id: string | null): string =>
      id ? (getRunItemDefinitionByAnyId(id)?.shortName ?? 'Unknown') : 'Empty';
    const combat = account.runItemLoadout.combatSlots.map(nameFor);
    const field = account.runItemLoadout.fieldSlots.map(nameFor);
    const emptyCount = [...account.runItemLoadout.combatSlots, ...account.runItemLoadout.fieldSlots]
      .filter((id) => id == null).length;
    return { combat, field, emptyCount };
  }, [account.runItemLoadout]);

  const renderCategoryBody = (): React.JSX.Element => {
    switch (activeCategory) {
      case 'RELIC':
        return (
          <DossierCardShell padding={scaleSpacing(10)} accentColor={categoryAccent}>
            <KeepsakeLoadoutPanel accent={categoryAccent} muted={muted} />
          </DossierCardShell>
        );
      case 'DECK':
        return (
          <DossierCardShell padding={scaleSpacing(10)} accentColor={categoryAccent}>
            <SafehouseAbilitiesTab />
          </DossierCardShell>
        );
      case 'FIELD_KIT':
        return (
          <DossierCardShell padding={scaleSpacing(10)} accentColor={categoryAccent}>
            <RunItemLoadoutPanel accent={categoryAccent} muted={muted} />
          </DossierCardShell>
        );
      case 'CHASSIS':
      default:
        return (
          <DossierCardShell padding={scaleSpacing(10)} accentColor={categoryAccent}>
            <WeaponLoadoutPanel accent={categoryAccent} muted={muted} />
          </DossierCardShell>
        );
    }
  };

  const descentKitSlots = (
    <View style={[styles.kitColumn, { gap: scaleSpacing(10) }]}>
      <KitSlot
        label="WEAPON"
        value={weaponDisplay}
        accent={SELECT_ACCENT}
        active={activeCategory === 'CHASSIS'}
        muted={muted}
        textColor={theme.textColor}
        onPress={() => setActiveCategory('CHASSIS')}
        scaleFont={scaleFont}
        scaleSpacing={scaleSpacing}
      />
      <KitSlot
        label="RELIC"
        value={relicName}
        accent={SELECT_ACCENT}
        active={activeCategory === 'RELIC'}
        muted={muted}
        textColor={theme.textColor}
        onPress={() => setActiveCategory('RELIC')}
        scaleFont={scaleFont}
        scaleSpacing={scaleSpacing}
      />
      <KitSlot
        label="ABILITY DECK"
        accent={SELECT_ACCENT}
        active={activeCategory === 'DECK'}
        muted={muted}
        textColor={theme.textColor}
        onPress={() => setActiveCategory('DECK')}
        scaleFont={scaleFont}
        scaleSpacing={scaleSpacing}
      >
        {abilityNames.map((name, index) => (
          <TerminalText key={`${name}-${index}`} size={scaleFont(5.2)} numberOfLines={1} style={{ color: theme.textColor }}>
            {`S${index + 1}  ${name}`}
          </TerminalText>
        ))}
      </KitSlot>
      <KitSlot
        label="FIELD KIT"
        accent={SELECT_ACCENT}
        active={activeCategory === 'FIELD_KIT'}
        muted={muted}
        textColor={theme.textColor}
        onPress={() => setActiveCategory('FIELD_KIT')}
        scaleFont={scaleFont}
        scaleSpacing={scaleSpacing}
      >
        <TerminalText size={scaleFont(5.2)} numberOfLines={1} style={{ color: theme.textColor }}>
          {`Combat: ${fieldKit.combat.join(' / ')}`}
        </TerminalText>
        <TerminalText size={scaleFont(5.2)} numberOfLines={1} style={{ color: theme.textColor }}>
          {`Field: ${fieldKit.field.join(' / ')}`}
        </TerminalText>
      </KitSlot>
    </View>
  );

  return (
    <HubScreenShell
      title="OPERATIVE LOADOUT"
      subtitle={`${classDef.displayName.toUpperCase()} // DESCENT PREP BAY`}
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

        <View style={[styles.categoryNav, { marginTop: scaleSpacing(8), marginBottom: scaleSpacing(8), gap: scaleSpacing(6) }]}>
          {CATEGORIES.map((item) => {
            const active = activeCategory === item.key;
            return (
              <HapticPressable
                key={item.key}
                onPress={() => setActiveCategory(item.key)}
                style={(state) => [
                  styles.categoryTab,
                  isDesktop && styles.categoryTabDesktop,
                  {
                    borderColor: active ? SELECT_ACCENT : theme.borderColor,
                    backgroundColor: active ? withAlpha(SELECT_ACCENT, '18') : 'rgba(0, 0, 0, 0.35)',
                  },
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <TerminalText
                  variant="body"
                  letterSpacing={0.8}
                  style={{ color: active ? SELECT_ACCENT : theme.mutedColor, fontWeight: '700' }}
                >
                  {item.label}
                </TerminalText>
              </HapticPressable>
            );
          })}
        </View>

        <View style={styles.bodyFixed}>
          <TerminalGlitchTransition transitionKey={activeCategory} style={styles.bodyFill}>
            {activeCategory === 'CARGO' ? (
              <SafehouseLoadoutTab />
            ) : isDesktop ? (
              <View style={[styles.prepRow, { gap: scaleSpacing(10) }]}>
                <View style={[styles.headerRow, { gap: scaleSpacing(24) }]}>
                  <View style={styles.kitCell}>
                    <LoadoutSectionHeader label="Descent Kit" />
                  </View>
                  <View style={styles.centerCell}>
                    <LoadoutTabHeader
                      title={CATEGORY_HEADERS[activeCategory as Exclude<LoadoutCategory, 'CARGO'>].title}
                      subtitle={CATEGORY_HEADERS[activeCategory as Exclude<LoadoutCategory, 'CARGO'>].subtitle}
                    />
                  </View>
                </View>
                <View style={[styles.contentRow, { gap: scaleSpacing(24) }]}>
                  <View style={styles.kitCell}>{descentKitSlots}</View>
                  <View style={styles.centerColumn}>
                    <ScrollView
                      {...HIDDEN_SCROLLVIEW_PROPS}
                      style={mergeHiddenScrollbarStyle(styles.scroll)}
                      contentContainerStyle={[styles.scrollContent, { paddingBottom: scaleSpacing(12) }]}
                      keyboardShouldPersistTaps="handled"
                    >
                      {renderCategoryBody()}
                    </ScrollView>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.prepRow, { gap: scaleSpacing(12) }]}>
                <LoadoutSectionHeader label="Descent Kit" />
                {descentKitSlots}
                <LoadoutTabHeader
                  title={CATEGORY_HEADERS[activeCategory as Exclude<LoadoutCategory, 'CARGO'>].title}
                  subtitle={CATEGORY_HEADERS[activeCategory as Exclude<LoadoutCategory, 'CARGO'>].subtitle}
                />
                <View style={styles.centerColumn}>
                  <ScrollView
                    {...HIDDEN_SCROLLVIEW_PROPS}
                    style={mergeHiddenScrollbarStyle(styles.scroll)}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: scaleSpacing(12) }]}
                    keyboardShouldPersistTaps="handled"
                  >
                    {renderCategoryBody()}
                  </ScrollView>
                </View>
              </View>
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
  categoryNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 0,
    zIndex: 2,
  },
  categoryTab: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabDesktop: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 100,
  },
  bodyFixed: {
    flex: 1,
    minHeight: 0,
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
  },
  prepRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
  },
  contentRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  kitCell: {
    width: 280,
    flexShrink: 0,
  },
  centerCell: {
    flex: 1,
    minWidth: 0,
  },
  kitColumn: {
    flexShrink: 0,
    width: '100%',
  },
  kitSlot: {
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  centerColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
