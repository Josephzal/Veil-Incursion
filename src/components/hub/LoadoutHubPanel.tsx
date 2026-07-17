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
import { useTerminalNavOptional } from '../../context/TerminalNavContext';
import { useWorldState } from '../../context/WorldStateContext';
import { getEquippedWeaponForClass, getWeaponTier, resolveWeaponState } from '../../data/weaponProgressionEngine';
import { getKeepsakeDefinition } from '../../data/expeditionKeepsakeRegistry';
import { getRunItemDefinitionByAnyId } from '../../data/runItemRegistry';
import { resolveClassAbilityCost } from '../../data/classAbilityResolver';
import { sponsorDisplayName } from '../../utils/contractUi';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import { HIDDEN_SCROLLVIEW_PROPS, mergeHiddenScrollbarStyle } from '../../utils/hiddenScrollbarStyle';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

type LoadoutCategory = 'CHASSIS' | 'RELIC' | 'DECK' | 'FIELD_KIT' | 'CARGO';

interface CategoryMeta {
  key: LoadoutCategory;
  label: string;
  glyph: string;
  accent: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'CHASSIS', label: 'CHASSIS', glyph: '⚔', accent: '#f59e0b' },
  { key: 'RELIC', label: 'RELIC', glyph: '◈', accent: '#a78bfa' },
  { key: 'DECK', label: 'DECK', glyph: '▤', accent: '#4ade80' },
  { key: 'FIELD_KIT', label: 'FIELD KIT', glyph: '▣', accent: '#38bdf8' },
  { key: 'CARGO', label: 'CARGO', glyph: '▦', accent: '#94a3b8' },
];

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
  const nav = useTerminalNavOptional();
  const { persisted } = useWorldState();
  const [activeCategory, setActiveCategory] = useState<LoadoutCategory>('CHASSIS');

  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const accent = theme.statusColor;
  const muted = theme.mutedColor;
  const categoryAccent = CATEGORIES.find((c) => c.key === activeCategory)?.accent ?? accent;

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

  const selectedContract = persisted.contractBoard.selectedContract;
  const contractLabel = selectedContract.kind === 'SPONSOR'
    ? `${sponsorDisplayName(selectedContract.contract.sponsorId)} // ${selectedContract.contract.title}`
    : 'Independent Breach';

  const readiness = useMemo(() => {
    const items: Array<{ label: string; ok: boolean }> = [
      { label: 'Weapon', ok: true },
      { label: 'Relic', ok: account.equippedKeepsakeId != null },
      { label: 'Deck', ok: abilityLoadout.length === 4 },
      { label: 'Field Kit', ok: fieldKit.emptyCount === 0 },
      { label: 'Contract', ok: true },
    ];
    return items;
  }, [account.equippedKeepsakeId, abilityLoadout.length, fieldKit.emptyCount]);

  const handleReadyForDescent = () => {
    nav?.setTerminalView('MAP');
  };

  const renderCategoryBody = (): React.JSX.Element => {
    switch (activeCategory) {
      case 'RELIC':
        return <KeepsakeLoadoutPanel accent={categoryAccent} muted={muted} />;
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

  const descentKit = (
    <View style={[styles.kitColumn, { gap: scaleSpacing(6), width: isDesktop ? 236 : undefined }]}>
      <TerminalText size={scaleFont(5.4)} letterSpacing={0.9} style={{ color: muted, fontWeight: '800' }}>
        DESCENT KIT
      </TerminalText>
      <KitSlot
        label="WEAPON"
        value={weaponDisplay}
        accent={CATEGORIES[0].accent}
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
        accent={CATEGORIES[1].accent}
        active={activeCategory === 'RELIC'}
        muted={muted}
        textColor={theme.textColor}
        onPress={() => setActiveCategory('RELIC')}
        scaleFont={scaleFont}
        scaleSpacing={scaleSpacing}
      />
      <KitSlot
        label="ABILITY DECK"
        accent={CATEGORIES[2].accent}
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
        accent={CATEGORIES[3].accent}
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
      <KitSlot
        label="CARGO"
        value="Containment grid"
        accent={CATEGORIES[4].accent}
        active={activeCategory === 'CARGO'}
        muted={muted}
        textColor={theme.textColor}
        onPress={() => setActiveCategory('CARGO')}
        scaleFont={scaleFont}
        scaleSpacing={scaleSpacing}
      />
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
          <View style={[styles.identityMeta, { borderTopColor: HUB_DATA_DIVIDER, marginTop: scaleSpacing(6), paddingTop: scaleSpacing(6), gap: scaleSpacing(2) }]}>
            <TerminalText size={scaleFont(5.4)} numberOfLines={1} style={{ color: muted }}>
              {`WEAPON  `}
              <TerminalText size={scaleFont(5.4)} style={{ color: theme.textColor, fontWeight: '700' }}>{weaponDisplay}</TerminalText>
            </TerminalText>
            <TerminalText size={scaleFont(5.4)} numberOfLines={1} style={{ color: muted }}>
              {`CONTRACT  `}
              <TerminalText size={scaleFont(5.4)} style={{ color: theme.textColor, fontWeight: '700' }}>{contractLabel}</TerminalText>
            </TerminalText>
          </View>
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
                    borderColor: active ? item.accent : theme.borderColor,
                    backgroundColor: active ? withAlpha(item.accent, '18') : 'rgba(0, 0, 0, 0.35)',
                  },
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <TerminalText
                  variant="body"
                  letterSpacing={0.8}
                  style={{ color: active ? item.accent : theme.mutedColor, fontWeight: '700' }}
                >
                  {`${item.glyph} ${item.label}`}
                </TerminalText>
              </HapticPressable>
            );
          })}
        </View>

        <View style={styles.bodyFixed}>
          <TerminalGlitchTransition transitionKey={activeCategory} style={styles.bodyFill}>
            {activeCategory === 'CARGO' ? (
              <SafehouseLoadoutTab />
            ) : (
              <View style={[styles.prepRow, isDesktop && styles.prepRowDesktop, { gap: scaleSpacing(10) }]}>
                {descentKit}
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

        <View style={[styles.actionBar, { borderTopColor: HUB_DATA_DIVIDER, paddingTop: scaleSpacing(8), marginTop: scaleSpacing(6), gap: scaleSpacing(8) }]}>
          <View style={styles.readinessRow}>
            <TerminalText size={scaleFont(5)} letterSpacing={0.6} style={{ color: '#4ade80', fontWeight: '800' }}>
              ● LOADOUT SAVED
            </TerminalText>
            {readiness.map((item) => (
              <TerminalText
                key={item.label}
                size={scaleFont(5)}
                style={{ color: item.ok ? theme.mutedColor : '#f59e0b', fontWeight: '700' }}
              >
                {`${item.ok ? '✓' : '!'} ${item.label}`}
              </TerminalText>
            ))}
          </View>
          <HapticPressable
            onPress={handleReadyForDescent}
            style={(state) => [
              styles.descentButton,
              {
                borderColor: accent,
                backgroundColor: withAlpha(accent, '1c'),
              },
              terminalHoverStyle(readPressableHover(state), state.pressed),
            ]}
          >
            <TerminalText variant="body" letterSpacing={1} style={{ color: accent, fontWeight: '800' }}>
              [ READY FOR DESCENT ]
            </TerminalText>
          </HapticPressable>
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
  identityMeta: {
    borderTopWidth: 1,
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
  prepRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  kitColumn: {
    flexShrink: 0,
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
  actionBar: {
    flexShrink: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  readinessRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  descentButton: {
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
