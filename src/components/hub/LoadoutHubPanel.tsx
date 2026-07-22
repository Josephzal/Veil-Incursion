import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import VeilTerminalEffects from '../atmosphere/VeilTerminalEffects';
import KeepsakeDeploymentChoiceModal from './KeepsakeDeploymentChoiceModal';
import ChassisWorkspace, { resolveChassisDossier } from './loadout/ChassisWorkspace';
import RelicWorkspace, { resolveRelicDossier } from './loadout/RelicWorkspace';
import DeckWorkspace, { type DeckInspectModel, type DeckSelection } from './loadout/DeckWorkspace';
import FieldKitWorkspace, { type FieldKitSelection } from './loadout/FieldKitWorkspace';
import CargoWorkspace, { resolveCargoOccupancy } from './loadout/CargoWorkspace';
import {
  CATEGORY_COPY,
  MISSING,
  MUTED,
  TERMINAL,
  TERMINAL_BRIGHT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  type LoadoutCategory,
} from './loadout/loadoutTerminalUi';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useTerminalNavOptional } from '../../context/TerminalNavContext';
import { useWorldState } from '../../context/WorldStateContext';
import { getEquippedWeaponForClass, getWeaponTier, resolveWeaponState } from '../../data/weaponProgressionEngine';
import { getKeepsakeDefinition } from '../../data/expeditionKeepsakeRegistry';
import { EXPEDITION_KEEPSAKE_REGISTRY } from '../../data/expeditionKeepsakeRegistry';
import {
  getKeepsakeDeploymentChoiceValue,
  isKeepsakeDeploymentConfigured,
} from '../../data/expeditionKeepsakeDeploymentEngine';
import { getRunItemDefinitionByAnyId } from '../../data/runItemRegistry';
import { formatRunItemSlotLabel } from '../../data/runItemUseEngine';
import { resolveClassAbilityCost } from '../../data/classAbilityResolver';
import { formatCargoRoutingPostExtractReminder } from '../../data/cargoRoutingIntelEngine';
import { resolvePlayerBadgePortrait } from '../../utils/combatPlayerPortrait';
import type { WeaponFamilyId } from '../../types/weapon';
import type { KeepsakeId } from '../../types/expeditionKeepsake';

const CATEGORIES: LoadoutCategory[] = ['CHASSIS', 'RELIC', 'DECK', 'FIELD_KIT', 'CARGO'];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

function DossierSection({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.dossierSection, last && styles.dossierSectionLast]}>
      <TerminalText size={7} letterSpacing={1} style={styles.dossierLabel}>
        {label}
      </TerminalText>
      {children}
    </View>
  );
}

export default function LoadoutHubPanel(): React.JSX.Element {
  const { profile } = useTerminal();
  const {
    account,
    cycleActiveClass,
    appendHubLog,
    equipWeaponFamily,
    unlockWeaponFamilyAccount,
    upgradeWeaponFamilyTier,
    setEquippedKeepsake,
    setKeepsakeAttunement,
    setKeepsakeRouteDoctrine,
    setKeepsakeMirrorCategory,
    equipRunItemLoadoutSlot,
    clearRunItemLoadoutSlot,
  } = usePlayerAccount();
  const { selectedSector, persisted } = useWorldState();
  const nav = useTerminalNavOptional();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();

  const [activeCategory, setActiveCategory] = useState<LoadoutCategory>('CHASSIS');
  const [chassisId, setChassisId] = useState<WeaponFamilyId | null>(null);
  const [relicId, setRelicId] = useState<KeepsakeId | null>(null);
  const [deckSelection, setDeckSelection] = useState<DeckSelection | null>(null);
  const [deckInspect, setDeckInspect] = useState<DeckInspectModel | null>(null);
  const [fieldSelection, setFieldSelection] = useState<FieldKitSelection>(null);
  const [deploymentModalVisible, setDeploymentModalVisible] = useState(false);
  const [pendingEquipId, setPendingEquipId] = useState<KeepsakeId | null>(null);
  const [modalKeepsakeId, setModalKeepsakeId] = useState<KeepsakeId | null>(null);
  const [modalDraftValue, setModalDraftValue] = useState<string | null>(null);

  const dossierLock = useRef(new Animated.Value(1)).current;
  const narrow = screenWidth < 1550;
  const compact = screenHeight <= 800;
  const classDef = CLASS_DEFINITIONS[account.activeClass];
  const canCycleClass = account.unlockedClasses.length > 1;
  const portraitSource = useMemo(
    () => resolvePlayerBadgePortrait(account.activeClass),
    [account.activeClass],
  );
  const cred = profile.operative_profile.credentials;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const styleId = 'loadout-focus-styles-v1';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
#loadout-root [role="tab"]:focus,
#loadout-root [role="tab"]:focus-visible,
#loadout-root [role="button"]:focus,
#loadout-root [role="button"]:focus-visible,
#loadout-root button:focus,
#loadout-root button:focus-visible {
  outline: 2px solid ${TERMINAL_BRIGHT} !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}
`;
    return undefined;
  }, []);

  const playDossierLock = useCallback(() => {
    if (reduceMotion) {
      dossierLock.setValue(1);
      return;
    }
    dossierLock.setValue(0.9);
    Animated.timing(dossierLock, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [dossierLock, reduceMotion]);

  const handleSelectCategory = (category: LoadoutCategory) => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    playDossierLock();
  };

  const handleSelectChassis = useCallback((id: WeaponFamilyId) => {
    setChassisId(id);
    playDossierLock();
  }, [playDossierLock]);

  const handleSelectRelic = useCallback((id: KeepsakeId | null) => {
    setRelicId(id);
    playDossierLock();
  }, [playDossierLock]);

  const handleSelectDeck = useCallback((selection: DeckSelection) => {
    setDeckSelection(selection);
    playDossierLock();
  }, [playDossierLock]);

  const handleSelectField = useCallback((selection: FieldKitSelection) => {
    setFieldSelection(selection);
    playDossierLock();
  }, [playDossierLock]);

  const progression = useMemo(() => ({
    weaponUnlocks: account.weaponUnlocks,
    weaponTiers: account.weaponTiers,
    equippedWeaponByClass: account.equippedWeaponByClass,
  }), [account.equippedWeaponByClass, account.weaponTiers, account.weaponUnlocks]);

  const weaponDisplay = useMemo(() => {
    const familyId = getEquippedWeaponForClass(progression, account.activeClass);
    const tier = getWeaponTier(progression, familyId);
    return resolveWeaponState(familyId, tier).displayName;
  }, [account.activeClass, progression]);

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

  const fieldFilled = [...account.runItemLoadout.combatSlots, ...account.runItemLoadout.fieldSlots]
    .filter((id) => id != null).length;
  const cargoOccupancy = useMemo(() => resolveCargoOccupancy(account), [account]);

  const completionSummary = useMemo(() => {
    let complete = 0;
    if (weaponDisplay) complete += 1;
    if (account.equippedKeepsakeId) complete += 1;
    if (abilityLoadout.every(Boolean)) complete += 1;
    if (fieldFilled > 0) complete += 1;
    if (cargoOccupancy.placedCount > 0 || cargoOccupancy.containmentCount > 0) complete += 1;
    return `${complete} / 5 SET`;
  }, [abilityLoadout, account.equippedKeepsakeId, cargoOccupancy, fieldFilled, weaponDisplay]);

  const chassisDossier = useMemo(
    () => resolveChassisDossier(account, chassisId),
    [account, chassisId],
  );
  const relicDossier = useMemo(
    () => resolveRelicDossier(
      account,
      relicId,
      selectedSector,
      persisted.contractBoard.selectedContract,
    ),
    [account, persisted.contractBoard.selectedContract, relicId, selectedSector],
  );

  const openDeploymentModal = (keepsakeId: KeepsakeId, equipAfterConfirm: boolean) => {
    const def = EXPEDITION_KEEPSAKE_REGISTRY[keepsakeId];
    if (!def.deploymentChoice) return;
    const current = getKeepsakeDeploymentChoiceValue(account.keepsakeDeployment, def.deploymentChoice);
    setPendingEquipId(equipAfterConfirm ? keepsakeId : null);
    setModalKeepsakeId(keepsakeId);
    setModalDraftValue(current);
    setDeploymentModalVisible(true);
  };

  const commitDeploymentSelection = (value: string) => {
    if (!modalKeepsakeId) return;
    const def = EXPEDITION_KEEPSAKE_REGISTRY[modalKeepsakeId];
    if (!def?.deploymentChoice) return;
    switch (def.deploymentChoice.kind) {
      case 'attunement':
        setKeepsakeAttunement(value as import('../../types/expeditionKeepsake').KeepsakeAttunement);
        break;
      case 'route_doctrine':
        setKeepsakeRouteDoctrine(value as import('../../types/expeditionKeepsake').KeepsakeRouteDoctrine);
        break;
      case 'mirror_category':
        setKeepsakeMirrorCategory(value as import('../../types/expeditionKeepsake').KeepsakeMirrorCategory);
        break;
      default:
        break;
    }
  };

  const handleRelicEquip = () => {
    if (!relicId) return;
    if (account.equippedKeepsakeId === relicId) {
      setEquippedKeepsake(null);
      return;
    }
    const def = EXPEDITION_KEEPSAKE_REGISTRY[relicId];
    if (def.deploymentChoice && !isKeepsakeDeploymentConfigured(relicId, account.keepsakeDeployment)) {
      openDeploymentModal(relicId, true);
      return;
    }
    setEquippedKeepsake(relicId);
  };

  const handleDeploymentConfirm = () => {
    if (!modalDraftValue || !modalKeepsakeId) return;
    commitDeploymentSelection(modalDraftValue);
    if (pendingEquipId) setEquippedKeepsake(pendingEquipId);
    setDeploymentModalVisible(false);
    setPendingEquipId(null);
    setModalKeepsakeId(null);
  };

  const modalRelic = modalKeepsakeId ? EXPEDITION_KEEPSAKE_REGISTRY[modalKeepsakeId] : null;
  const modalWarnings = useMemo(() => {
    if (!modalRelic) return [];
    return resolveRelicDossier(
      account,
      modalRelic.id,
      selectedSector,
      persisted.contractBoard.selectedContract,
    )?.warnings.map((entry) => entry.message) ?? [];
  }, [account, modalRelic, persisted.contractBoard.selectedContract, selectedSector]);

  const handleReady = () => {
    nav?.setTerminalView('MAP');
  };

  const catalogCopy = CATEGORY_COPY[activeCategory];

  const renderManifestEntry = (category: LoadoutCategory) => {
    const selected = activeCategory === category;
    const copy = CATEGORY_COPY[category];
    let primary = '';
    let secondary = '';
    if (category === 'CHASSIS') {
      primary = weaponDisplay;
      secondary = 'TIER · EQUIPPED';
      const equippedId = getEquippedWeaponForClass(progression, account.activeClass);
      const tier = getWeaponTier(progression, equippedId);
      secondary = `TIER ${['I', 'II', 'III'][tier - 1] ?? tier} · EQUIPPED`;
    } else if (category === 'RELIC') {
      primary = relicName;
      secondary = account.equippedKeepsakeId ? 'EQUIPPED' : 'NONE';
    } else if (category === 'DECK') {
      primary = `${abilityLoadout.filter(Boolean).length} / 4 ACTIVE`;
      secondary = `ANCHOR: ${abilityNames[0] ?? '—'}`;
    } else if (category === 'FIELD_KIT') {
      primary = `${fieldFilled} / 4 SLOTS FILLED`;
      secondary = fieldFilled === 0 ? 'NO ITEMS STAGED' : 'KIT READY';
    } else {
      primary = `${cargoOccupancy.occupied} / ${cargoOccupancy.capacity}`;
      secondary = cargoOccupancy.placedCount === 0 ? 'NO CARGO STAGED' : 'CARGO STAGED';
    }

    return (
      <HapticPressable
        key={category}
        onPress={() => handleSelectCategory(category)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={`${copy.manifestLabel} category`}
        {...(Platform.OS === 'web' ? ({ 'aria-selected': selected } as object) : {})}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
          styles.manifestEntry,
          compact && styles.manifestEntryCompact,
          selected && styles.manifestEntrySelected,
          ((hovered || pressed) && !selected) ? styles.manifestEntryHover : null,
        ])}
      >
        {selected ? <View style={styles.manifestAccent} /> : null}
        <TerminalText size={7.5} letterSpacing={1} style={styles.manifestLabel}>
          {copy.manifestLabel}
        </TerminalText>
        <TerminalText size={9.5} letterSpacing={0.3} style={styles.manifestPrimary} numberOfLines={1}>
          {primary.toUpperCase()}
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={0.55} style={styles.manifestSecondary} numberOfLines={1}>
          {secondary.toUpperCase()}
        </TerminalText>
      </HapticPressable>
    );
  };

  const renderDossier = () => {
    if (activeCategory === 'CHASSIS') {
      if (!chassisDossier) {
        return emptyDossier('Select a chassis from the equipment feed.');
      }
      const { tierState, tier, unlocked, equipped, canUnlock, canUpgrade, nextTier, statLines, costLines, missing } = chassisDossier;
      const status = equipped
        ? 'EQUIPPED'
        : !unlocked
          ? (missing.missingTotal > 0 ? 'MISSING MATERIALS' : 'BLUEPRINT LOCKED')
          : canUpgrade
            ? 'UPGRADE AVAILABLE'
            : 'AVAILABLE';
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierHeaderAccent} />
            <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>WEAPON CHASSIS</TerminalText>
            <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
              {tierState.displayName.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {`${status} · TIER ${['I', 'II', 'III'][tier - 1] ?? tier}`}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
            <DossierSection label="IDENTITY">
              <TerminalText size={8.5} style={styles.dossierValue}>{chassisDossier.def.description}</TerminalText>
              <TerminalText size={8} style={styles.dossierSecondary}>{chassisDossier.def.role}</TerminalText>
            </DossierSection>
            <DossierSection label="COMBAT PROFILE">
              {statLines.map((line) => (
                <TerminalText key={line} size={8.5} style={styles.dossierValueTight}>{line}</TerminalText>
              ))}
            </DossierSection>
            {nextTier ? (
              <DossierSection label="NEXT TIER">
                <TerminalText size={8.5} style={styles.dossierValue}>{nextTier.displayName}</TerminalText>
                <TerminalText size={8.5} style={styles.dossierValueTight}>{nextTier.effectSummary}</TerminalText>
              </DossierSection>
            ) : null}
            {costLines.length > 0 ? (
              <DossierSection label={!unlocked ? 'UNLOCK REQUIREMENTS' : 'UPGRADE REQUIREMENTS'} last>
                {costLines.map((line) => (
                  <View key={line.label} style={styles.reqRow}>
                    <TerminalText size={8} style={styles.dossierSecondary}>{line.label.toUpperCase()}</TerminalText>
                    <TerminalText
                      size={8}
                      style={{
                        color: line.owned >= line.need ? TEXT_PRIMARY : MISSING,
                        fontWeight: '700',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {`${line.owned} / ${line.need}`}
                    </TerminalText>
                  </View>
                ))}
                {missing.missingTotal > 0 ? (
                  <TerminalText size={8} style={[styles.dossierSecondary, { color: MISSING, marginTop: 8 }]}>
                    {missing.parts.join(' · ').toUpperCase()} REQUIRED
                  </TerminalText>
                ) : null}
              </DossierSection>
            ) : (
              <DossierSection label="PROGRESSION" last>
                <TerminalText size={8.5} style={styles.dossierValue}>Max tier reached for this chassis.</TerminalText>
              </DossierSection>
            )}
          </ScrollView>
          <View style={styles.dossierFooter}>
            {!unlocked ? (
              <HapticPressable
                disabled={!canUnlock}
                onPress={() => appendHubLog(unlockWeaponFamilyAccount(chassisDossier.def.id).logLine)}
                accessibilityRole="button"
                accessibilityLabel="Unlock blueprint"
                style={({ pressed }) => ([
                  styles.actionButton,
                  canUnlock ? styles.actionPrimary : styles.actionDisabled,
                  pressed && canUnlock && { opacity: 0.9 },
                ])}
              >
                <TerminalText size={8} letterSpacing={1} style={canUnlock ? styles.actionPrimaryText : styles.actionDisabledText}>
                  {canUnlock ? '[ UNLOCK BLUEPRINT ]' : '[ UNLOCK BLOCKED ]'}
                </TerminalText>
              </HapticPressable>
            ) : (
              <View style={{ gap: 8 }}>
                {!equipped ? (
                  <HapticPressable
                    onPress={() => appendHubLog(equipWeaponFamily(chassisDossier.def.id).logLine)}
                    accessibilityRole="button"
                    accessibilityLabel="Equip chassis"
                    style={({ pressed }) => ([styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.9 }])}
                  >
                    <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                      [ EQUIP CHASSIS ]
                    </TerminalText>
                  </HapticPressable>
                ) : (
                  <View style={[styles.actionButton, styles.actionDisabled]}>
                    <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                      [ EQUIPPED ]
                    </TerminalText>
                  </View>
                )}
                {nextTier ? (
                  <HapticPressable
                    disabled={!canUpgrade}
                    onPress={() => appendHubLog(upgradeWeaponFamilyTier(chassisDossier.def.id).logLine)}
                    accessibilityRole="button"
                    accessibilityLabel="Upgrade tier"
                    style={({ pressed }) => ([
                      styles.actionButton,
                      canUpgrade ? styles.actionSecondary : styles.actionDisabled,
                      pressed && canUpgrade && { opacity: 0.9 },
                    ])}
                  >
                    <TerminalText size={8} letterSpacing={1} style={canUpgrade ? styles.actionSecondaryText : styles.actionDisabledText}>
                      {canUpgrade ? '[ UPGRADE TIER ]' : '[ UPGRADE BLOCKED ]'}
                    </TerminalText>
                  </HapticPressable>
                ) : null}
              </View>
            )}
          </View>
        </>
      );
    }

    if (activeCategory === 'RELIC') {
      if (!relicDossier) {
        return emptyDossier('Select a relic from the equipment feed.');
      }
      const { def, equipped, deploymentSummary, configured, warnings } = relicDossier;
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierHeaderAccent} />
            <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>EXPEDITION RELIC</TerminalText>
            <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
              {def.name.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {equipped ? 'EQUIPPED' : 'AVAILABLE'}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
            <DossierSection label="RUN STYLE">
              <TerminalText size={8.5} style={styles.dossierValue}>{def.runStyle}</TerminalText>
            </DossierSection>
            <DossierSection label="EFFECT">
              <TerminalText size={8.5} style={styles.dossierValue}>{def.effectSummary}</TerminalText>
            </DossierSection>
            <DossierSection label="RISK">
              <TerminalText size={8.5} style={styles.dossierValue}>{def.riskSummary}</TerminalText>
            </DossierSection>
            <DossierSection label="FLAVOR" last={!deploymentSummary && warnings.length === 0}>
              <TerminalText size={8.5} style={[styles.dossierValue, { fontStyle: 'italic' }]}>
                {`"${def.flavorText}"`}
              </TerminalText>
            </DossierSection>
            {deploymentSummary ? (
              <DossierSection label="DEPLOYMENT" last={warnings.length === 0}>
                <TerminalText size={8.5} style={styles.dossierValue}>{deploymentSummary}</TerminalText>
                {!configured ? (
                  <TerminalText size={8} style={[styles.dossierSecondary, { color: MISSING }]}>
                    Deployment configuration required before descent.
                  </TerminalText>
                ) : null}
              </DossierSection>
            ) : null}
            {warnings.length > 0 ? (
              <DossierSection label="DEPLOYMENT WARNINGS" last>
                {warnings.map((warning) => (
                  <TerminalText key={warning.message} size={8.5} style={styles.dossierValueTight}>
                    {warning.message}
                  </TerminalText>
                ))}
              </DossierSection>
            ) : null}
          </ScrollView>
          <View style={styles.dossierFooter}>
            <HapticPressable
              onPress={handleRelicEquip}
              accessibilityRole="button"
              accessibilityLabel={equipped ? 'Unequip relic' : 'Equip relic'}
              style={({ pressed }) => ([styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.9 }])}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                {equipped ? '[ UNEQUIP RELIC ]' : '[ EQUIP RELIC ]'}
              </TerminalText>
            </HapticPressable>
            {equipped && def.deploymentChoice ? (
              <HapticPressable
                onPress={() => openDeploymentModal(def.id, false)}
                accessibilityRole="button"
                accessibilityLabel="Configure deployment"
                style={({ pressed }) => ([styles.actionButton, styles.actionSecondary, { marginTop: 8 }, pressed && { opacity: 0.9 }])}
              >
                <TerminalText size={8} letterSpacing={1} style={styles.actionSecondaryText}>
                  [ CONFIGURE DEPLOYMENT ]
                </TerminalText>
              </HapticPressable>
            ) : null}
          </View>
        </>
      );
    }

    if (activeCategory === 'DECK') {
      if (!deckInspect) return emptyDossier('Select a slot or ability from the deck.');
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierHeaderAccent} />
            <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>ABILITY RECORD</TerminalText>
            <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
              {deckInspect.title.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {deckInspect.status}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
            <DossierSection label="CLASS">
              <TerminalText size={8.5} style={styles.dossierValue}>{deckInspect.typeLine}</TerminalText>
            </DossierSection>
            <DossierSection label="COSTS">
              <TerminalText size={8.5} style={[styles.dossierValue, { fontVariant: ['tabular-nums'] }]}>
                {deckInspect.costLine}
              </TerminalText>
            </DossierSection>
            <DossierSection label="TAGS">
              <TerminalText size={8.5} style={styles.dossierValue}>{deckInspect.tags}</TerminalText>
            </DossierSection>
            <DossierSection label="EFFECT">
              <TerminalText size={8.5} style={styles.dossierValue}>{deckInspect.description}</TerminalText>
            </DossierSection>
            <DossierSection label="LOADOUT RELATIONSHIP" last>
              <TerminalText size={8.5} style={styles.dossierValue}>{deckInspect.slotLine}</TerminalText>
            </DossierSection>
          </ScrollView>
          <View style={styles.dossierFooter}>
            {deckInspect.actions.map((action) => (
              <HapticPressable
                key={action.label}
                disabled={action.disabled || !action.onPress}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => ([
                  styles.actionButton,
                  action.disabled || !action.onPress
                    ? styles.actionDisabled
                    : action.tone === 'danger'
                      ? styles.actionDestructive
                      : styles.actionPrimary,
                  { marginBottom: 8 },
                  pressed && !action.disabled && { opacity: 0.9 },
                ])}
              >
                <TerminalText
                  size={8}
                  letterSpacing={1}
                  style={
                    action.disabled || !action.onPress
                      ? styles.actionDisabledText
                      : action.tone === 'danger'
                        ? styles.actionDestructiveText
                        : styles.actionPrimaryText
                  }
                >
                  {action.label}
                </TerminalText>
              </HapticPressable>
            ))}
          </View>
        </>
      );
    }

    if (activeCategory === 'FIELD_KIT') {
      if (!fieldSelection) return emptyDossier('Select a field kit slot or staged item.');
      if (fieldSelection.kind === 'SLOT') {
        const itemId = fieldSelection.slotType === 'COMBAT'
          ? account.runItemLoadout.combatSlots[fieldSelection.slotIndex]
          : account.runItemLoadout.fieldSlots[fieldSelection.slotIndex];
        const def = itemId ? getRunItemDefinitionByAnyId(itemId) : null;
        const label = formatRunItemSlotLabel(fieldSelection.slotType, fieldSelection.slotIndex).toUpperCase();
        return (
          <>
            <View style={styles.dossierHeader}>
              <View style={styles.dossierHeaderAccent} />
              <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
              <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>FIELD KIT SLOT</TerminalText>
              <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
                {def ? def.shortName.toUpperCase() : label}
              </TerminalText>
              <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
                {def ? 'OCCUPIED' : 'EMPTY'}
              </TerminalText>
            </View>
            <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
              <DossierSection label="SLOT">
                <TerminalText size={8.5} style={styles.dossierValue}>{label}</TerminalText>
              </DossierSection>
              {def ? (
                <>
                  <DossierSection label="EFFECT">
                    <TerminalText size={8.5} style={styles.dossierValue}>{def.effectSummary}</TerminalText>
                  </DossierSection>
                  <DossierSection label="CATEGORY" last>
                    <TerminalText size={8.5} style={styles.dossierValue}>{def.slotType}</TerminalText>
                  </DossierSection>
                </>
              ) : (
                <DossierSection label="INSTRUCTION" last>
                  <TerminalText size={8.5} style={styles.dossierValue}>
                    Select a staged {fieldSelection.slotType.toLowerCase()} consumable to equip here.
                  </TerminalText>
                </DossierSection>
              )}
            </ScrollView>
            <View style={styles.dossierFooter}>
              {def ? (
                <HapticPressable
                  onPress={() => {
                    clearRunItemLoadoutSlot(fieldSelection.slotType, fieldSelection.slotIndex);
                    appendHubLog(`>> CLEARED ${formatRunItemSlotLabel(fieldSelection.slotType, fieldSelection.slotIndex).toUpperCase()}.`);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from kit"
                  style={({ pressed }) => ([styles.actionButton, styles.actionDestructive, pressed && { opacity: 0.88 }])}
                >
                  <TerminalText size={8} letterSpacing={1} style={styles.actionDestructiveText}>
                    [ REMOVE FROM KIT ]
                  </TerminalText>
                </HapticPressable>
              ) : (
                <View style={[styles.actionButton, styles.actionDisabled]}>
                  <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                    [ SELECT STAGED ITEM ]
                  </TerminalText>
                </View>
              )}
            </View>
          </>
        );
      }

      const def = getRunItemDefinitionByAnyId(fieldSelection.itemId);
      const slotType = def?.slotType ?? 'COMBAT';
      const emptyIndex = slotType === 'COMBAT'
        ? account.runItemLoadout.combatSlots.findIndex((id) => id == null)
        : account.runItemLoadout.fieldSlots.findIndex((id) => id == null);
      const slotIndex: 0 | 1 = emptyIndex === 1 ? 1 : 0;
      const replacing = emptyIndex < 0;
      return (
        <>
          <View style={styles.dossierHeader}>
            <View style={styles.dossierHeaderAccent} />
            <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>STAGED CONSUMABLE</TerminalText>
            <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
              {(def?.shortName ?? fieldSelection.itemId).toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {slotType}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
            <DossierSection label="EFFECT">
              <TerminalText size={8.5} style={styles.dossierValue}>{def?.effectSummary ?? '—'}</TerminalText>
            </DossierSection>
            <DossierSection label="COMPATIBLE SLOT" last>
              <TerminalText size={8.5} style={styles.dossierValue}>{slotType}</TerminalText>
            </DossierSection>
          </ScrollView>
          <View style={styles.dossierFooter}>
            <HapticPressable
              onPress={() => {
                const result = equipRunItemLoadoutSlot(slotType, slotIndex, fieldSelection.itemId);
                appendHubLog(result.logLine);
              }}
              accessibilityRole="button"
              accessibilityLabel="Equip to kit slot"
              style={({ pressed }) => ([styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.9 }])}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                {replacing
                  ? `[ REPLACE ${formatRunItemSlotLabel(slotType, slotIndex).toUpperCase()} ]`
                  : `[ EQUIP TO ${formatRunItemSlotLabel(slotType, slotIndex).toUpperCase()} ]`}
              </TerminalText>
            </HapticPressable>
          </View>
        </>
      );
    }

    // CARGO
    return (
      <>
        <View style={styles.dossierHeader}>
          <View style={styles.dossierHeaderAccent} />
          <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
          <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>CARGO BAY</TerminalText>
          <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
            PRE-DESCENT HOLD
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
            {`${cargoOccupancy.occupied} / ${cargoOccupancy.capacity} CELLS`}
          </TerminalText>
        </View>
        <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
          <DossierSection label="CAPACITY">
            <TerminalText size={8.5} style={styles.dossierValue}>
              {`${cargoOccupancy.placedCount} stack(s) · ${cargoOccupancy.containmentCount} containment`}
            </TerminalText>
          </DossierSection>
          <DossierSection label="ROUTING" last>
            <TerminalText size={8.5} style={styles.dossierValue}>
              {formatCargoRoutingPostExtractReminder()}
            </TerminalText>
            <TerminalText size={8.5} style={[styles.dossierValueTight, { marginTop: 10 }]}>
              Drag stash resources into the bay. Spatial placement rules are unchanged.
            </TerminalText>
          </DossierSection>
        </ScrollView>
        <View style={styles.dossierFooter}>
          <View style={[styles.actionButton, styles.actionDisabled]}>
            <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
              [ USE CARGO BAY CONTROLS ]
            </TerminalText>
          </View>
        </View>
      </>
    );
  };

  const emptyDossier = (message: string): React.JSX.Element => (
    <>
      <View style={styles.dossierHeader}>
        <View style={styles.dossierHeaderAccent} />
        <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>EQUIPMENT DOSSIER</TerminalText>
        <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>NO RECORD SELECTED</TerminalText>
        <TerminalText size={16.5} letterSpacing={0.3} style={styles.dossierTitle}>
          AWAITING SIGNAL
        </TerminalText>
      </View>
      <ScrollView style={styles.dossierBody} contentContainerStyle={styles.dossierBodyContent}>
        <TerminalText size={8.5} style={styles.dossierValue}>{message}</TerminalText>
      </ScrollView>
      <View style={styles.dossierFooter}>
        <View style={[styles.actionButton, styles.actionDisabled]}>
          <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
            [ SELECT A RECORD ]
          </TerminalText>
        </View>
      </View>
    </>
  );

  return (
    <View
      style={[styles.page, narrow && styles.pageNarrow]}
      {...(Platform.OS === 'web' ? ({ id: 'loadout-root', nativeID: 'loadout-root' } as object) : null)}
    >
      <VeilTerminalEffects intensity="subtle" scanlineOpacity={0.04} />

      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.headerTitleBlock}>
          <TerminalText size={7.5} letterSpacing={1.1} style={styles.headerEyebrow}>
            LOADOUT // DESCENT PREP BAY
          </TerminalText>
          <TerminalText size={15} letterSpacing={0.55} style={styles.headerTitle}>
            OPERATIVE LOADOUT
          </TerminalText>
        </View>

        <View style={styles.operativeSelector}>
          {canCycleClass ? (
            <HapticPressable
              onPress={() => cycleActiveClass(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous operative class"
              style={({ pressed }) => ([styles.operativeArrow, pressed && { opacity: 0.7 }])}
            >
              <TerminalText size={10} style={{ color: TERMINAL }}>{'<'}</TerminalText>
            </HapticPressable>
          ) : <View style={styles.operativeArrow} />}
          <Image source={portraitSource} style={styles.operativePortrait} resizeMode="contain" />
          <View style={styles.operativeCreds}>
            <TerminalText size={11} letterSpacing={0.35} style={styles.operativeName} numberOfLines={1}>
              {cred.username.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.55} style={styles.operativeMeta} numberOfLines={1}>
              {`${classDef.displayName.toUpperCase()} · CLEARANCE ${account.progressionProfile.runner.clearanceRank}`}
            </TerminalText>
          </View>
          {canCycleClass ? (
            <HapticPressable
              onPress={() => cycleActiveClass(1)}
              accessibilityRole="button"
              accessibilityLabel="Next operative class"
              style={({ pressed }) => ([styles.operativeArrow, pressed && { opacity: 0.7 }])}
            >
              <TerminalText size={10} style={{ color: TERMINAL }}>{'>'}</TerminalText>
            </HapticPressable>
          ) : <View style={styles.operativeArrow} />}
        </View>

        <View style={styles.headerActions}>
          <TerminalText size={7.5} letterSpacing={1} style={styles.savedLabel}>
            ● LOADOUT SAVED
          </TerminalText>
          <HapticPressable
            onPress={handleReady}
            accessibilityRole="button"
            accessibilityLabel="Ready for descent"
            style={({ pressed }) => ([styles.readyAction, pressed && { opacity: 0.9 }])}
          >
            <TerminalText size={8} letterSpacing={1} style={styles.readyActionText}>
              [ READY FOR DESCENT ]
            </TerminalText>
          </HapticPressable>
        </View>
      </View>

      <View style={[styles.workspace, narrow && styles.workspaceNarrow]}>
        <View style={styles.manifest}>
          <View style={styles.manifestHeader}>
            <TerminalText size={7.5} letterSpacing={1} style={styles.manifestHeaderText}>
              DESCENT MANIFEST
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={1} style={styles.manifestHeaderText}>
              {completionSummary}
            </TerminalText>
          </View>
          <View
            style={styles.manifestList}
            accessibilityRole="tablist"
            {...(Platform.OS === 'web' ? ({ 'aria-orientation': 'vertical' } as object) : {})}
          >
            {CATEGORIES.map(renderManifestEntry)}
          </View>
        </View>

        <View style={styles.catalog}>
          <View style={[styles.catalogHeader, compact && styles.catalogHeaderCompact]}>
            <TerminalText size={7.5} letterSpacing={1} style={styles.catalogEyebrow}>
              {catalogCopy.eyebrow}
            </TerminalText>
            <TerminalText size={13.5} letterSpacing={0.45} style={styles.catalogTitle}>
              {catalogCopy.title}
            </TerminalText>
            <TerminalText size={8.5} style={styles.catalogDescription}>
              {catalogCopy.description}
            </TerminalText>
          </View>
          <View style={styles.catalogBody}>
            {activeCategory === 'CHASSIS' ? (
              <ChassisWorkspace selectedId={chassisId} onSelect={handleSelectChassis} compact={compact} />
            ) : null}
            {activeCategory === 'RELIC' ? (
              <RelicWorkspace selectedId={relicId} onSelect={handleSelectRelic} compact={compact} />
            ) : null}
            {activeCategory === 'DECK' ? (
              <DeckWorkspace
                selection={deckSelection}
                onSelect={handleSelectDeck}
                onInspectChange={setDeckInspect}
                compact={compact}
              />
            ) : null}
            {activeCategory === 'FIELD_KIT' ? (
              <FieldKitWorkspace selection={fieldSelection} onSelect={handleSelectField} compact={compact} />
            ) : null}
            {activeCategory === 'CARGO' ? <CargoWorkspace compact={compact} /> : null}
          </View>
        </View>

        <Animated.View style={[styles.dossier, { opacity: dossierLock }]}>
          {renderDossier()}
        </Animated.View>
      </View>

      {modalRelic?.deploymentChoice ? (
        <KeepsakeDeploymentChoiceModal
          visible={deploymentModalVisible}
          relic={modalRelic}
          choice={modalRelic.deploymentChoice}
          selectedValue={modalDraftValue}
          accentColor={TERMINAL}
          mutedColor={MUTED}
          warnings={modalWarnings}
          onSelect={setModalDraftValue}
          onConfirm={handleDeploymentConfirm}
          onDismiss={() => {
            setDeploymentModalVisible(false);
            setPendingEquipId(null);
            setModalKeepsakeId(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#020606',
    position: 'relative',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        width: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  },
  pageNarrow: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    minHeight: 86,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: 'rgba(3, 9, 8, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.16)',
    flexShrink: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(230px, 0.8fr) minmax(380px, 1.25fr) auto',
      } as object,
      default: {},
    }),
  },
  headerCompact: {
    minHeight: 72,
    paddingVertical: 9,
    gap: 18,
  },
  headerTitleBlock: { minWidth: 0 },
  headerEyebrow: { color: MUTED, fontWeight: '700' },
  headerTitle: { marginTop: 5, color: TEXT_PRIMARY, fontWeight: '700' },
  operativeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    minWidth: 0,
    backgroundColor: 'rgba(2, 6, 7, 0.62)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(190, 208, 202, 0.72)',
    paddingRight: 10,
  },
  operativeArrow: {
    width: 38,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operativePortrait: {
    width: 46,
    height: 46,
  },
  operativeCreds: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  operativeName: { color: TEXT_PRIMARY, fontWeight: '700' },
  operativeMeta: { marginTop: 4, color: MUTED, fontWeight: '700' },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  savedLabel: { color: TERMINAL, fontWeight: '700' },
  readyAction: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TERMINAL,
    borderWidth: 1,
    borderColor: TERMINAL_BRIGHT,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  readyActionText: { color: '#06110e', fontWeight: '800' },
  workspace: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: '284px minmax(0, 1fr) clamp(420px, 25vw, 500px)',
      } as object,
      default: {},
    }),
  },
  workspaceNarrow: {
    ...Platform.select({
      web: {
        gridTemplateColumns: '230px minmax(0, 1fr) 390px',
      } as object,
      default: {},
    }),
  },
  manifest: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#030707',
    borderRightWidth: 1,
    borderRightColor: 'rgba(137, 170, 163, 0.15)',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
      } as object,
      default: { width: 284 },
    }),
  },
  manifestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.13)',
  },
  manifestHeaderText: { color: MUTED, fontWeight: '700' },
  manifestList: { flex: 1, minHeight: 0 },
  manifestEntry: {
    position: 'relative',
    minHeight: 82,
    paddingTop: 15,
    paddingBottom: 14,
    paddingLeft: 22,
    paddingRight: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.09)',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  manifestEntryCompact: { minHeight: 70, paddingTop: 11, paddingBottom: 10 },
  manifestEntryHover: { backgroundColor: 'rgba(105, 200, 173, 0.035)' },
  manifestEntrySelected: { backgroundColor: 'rgba(105, 200, 173, 0.06)' },
  manifestAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
  },
  manifestLabel: { color: MUTED, fontWeight: '700' },
  manifestPrimary: { marginTop: 6, color: TEXT_PRIMARY, fontWeight: '700' },
  manifestSecondary: { marginTop: 5, color: TEXT_SECONDARY, fontWeight: '700' },
  catalog: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#020606',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
      } as object,
      default: {},
    }),
  },
  catalogHeader: {
    minHeight: 76,
    paddingTop: 17,
    paddingBottom: 15,
    paddingHorizontal: 26,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.13)',
    flexShrink: 0,
  },
  catalogHeaderCompact: {
    minHeight: 64,
    paddingTop: 12,
    paddingBottom: 11,
  },
  catalogEyebrow: { color: TERMINAL, fontWeight: '700' },
  catalogTitle: { marginTop: 6, color: TEXT_PRIMARY, fontWeight: '700' },
  catalogDescription: { marginTop: 6, color: TEXT_SECONDARY, lineHeight: 18 },
  catalogBody: { flex: 1, minHeight: 0 },
  dossier: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#030707',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(137, 170, 163, 0.16)',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        backgroundImage:
          'linear-gradient(180deg, rgba(8, 20, 17, 0.56), rgba(3, 7, 7, 0) 260px), #030707',
      } as object,
      default: { width: 420 },
    }),
  },
  dossierHeader: {
    position: 'relative',
    paddingTop: 23,
    paddingBottom: 20,
    paddingLeft: 32,
    paddingRight: 28,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.14)',
    flexShrink: 0,
  },
  dossierHeaderAccent: {
    position: 'absolute',
    top: 23,
    bottom: 20,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
  },
  dossierEyebrow: { color: MUTED, fontWeight: '700' },
  dossierCategory: { marginTop: 8, color: TERMINAL, fontWeight: '700' },
  dossierTitle: { marginTop: 9, color: TEXT_PRIMARY, fontWeight: '700' },
  dossierStatus: { marginTop: 10, color: TEXT_SECONDARY, fontWeight: '700' },
  dossierBody: { flex: 1, minHeight: 0 },
  dossierBodyContent: {
    paddingTop: 22,
    paddingBottom: 28,
    paddingLeft: 32,
    paddingRight: 28,
  },
  dossierSection: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  dossierSectionLast: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
  dossierLabel: { color: MUTED, fontWeight: '700' },
  dossierValue: { marginTop: 7, color: '#d2dcd8', lineHeight: 20 },
  dossierValueTight: { marginTop: 5, color: '#d2dcd8', lineHeight: 19 },
  dossierSecondary: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
  reqRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  dossierFooter: {
    paddingTop: 16,
    paddingBottom: 22,
    paddingLeft: 32,
    paddingRight: 28,
    backgroundColor: 'rgba(3, 7, 8, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(137, 190, 179, 0.19)',
    flexShrink: 0,
  },
  actionButton: {
    width: '100%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  actionPrimary: {
    backgroundColor: TERMINAL,
    borderWidth: 1,
    borderColor: TERMINAL_BRIGHT,
  },
  actionPrimaryText: { color: '#06110e', fontWeight: '800' },
  actionSecondary: {
    backgroundColor: 'rgba(105, 200, 173, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.35)',
  },
  actionSecondaryText: { color: TERMINAL_BRIGHT, fontWeight: '800' },
  actionDestructive: {
    backgroundColor: 'rgba(201, 98, 98, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(201, 98, 98, 0.4)',
  },
  actionDestructiveText: { color: '#d89490', fontWeight: '800' },
  actionDisabled: {
    backgroundColor: 'rgba(112, 139, 133, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.2)',
  },
  actionDisabledText: { color: '#7f928c', fontWeight: '800' },
});
