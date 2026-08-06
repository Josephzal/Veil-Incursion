import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import HubPageHeader from './HubPageHeader';
import HubPrimaryCta from './HubPrimaryCta';
import HubDossierCornerBrackets from './HubDossierCornerBrackets';
import KeepsakeDeploymentChoiceModal from './KeepsakeDeploymentChoiceModal';
import ChassisWorkspace, { resolveChassisDossier } from './loadout/ChassisWorkspace';
import WeaponChassisBriefModal from './loadout/WeaponChassisBriefModal';
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
import { OccultNeonRail } from './veilChrome';
import {
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
  HUB_CHANNEL_BUTTON_COMPACT_PADDING_V,
  HUB_CHANNEL_BUTTON_HEIGHT,
  HUB_CHANNEL_BUTTON_PADDING_V,
  HUB_CHANNEL_RAIL_INSET,
  HUB_DOSSIER_EDGE_PAD,
  HUB_DOSSIER_FOOTER_BG,
  HUB_DOSSIER_FOOTER_RULE,
  HUB_DOSSIER_LABEL,
  HUB_DOSSIER_TITLE,
  HUB_BROWSER_CONTENT_PADDING_H,
  HUB_BROWSER_FEED_PAD_TOP,
  HUB_SELECT_SURFACE,
  hubBrowserSectionLabelStyle,
  hubDossierColumnStyle,
  hubDossierShellStyle,
  hubInspectorColumnWidth,
  hubInspectorFocusBarStyle,
  hubPrimaryActionHoverStyle,
  hubPrimaryActionStyle,
  hubPrimaryActionTextHoverStyle,
  hubPrimaryActionTextStyle,
} from '../../theme/hubPanelSurfaces';
import { VEIL } from '../../theme/veilTerminalTokens';
import { CLASS_DEFINITIONS } from '../../data/classes';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
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
import { formatCargoRoutingPostExtractReminder } from '../../data/cargoRoutingIntelEngine';
import { resolvePlayerBadgePortrait } from '../../utils/combatPlayerPortrait';
import type { WeaponFamilyId } from '../../types/weapon';
import type { KeepsakeId } from '../../types/expeditionKeepsake';
import { shouldOpenWeaponFirstUseBrief } from '../../data/weaponPlayerFacing/weaponBriefPersistence';

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
      <View style={styles.dossierLabelRow}>
        <View style={styles.dossierBoneRule} />
        <TerminalText size={7} letterSpacing={1.05} style={styles.dossierLabel}>
          {label}
        </TerminalText>
      </View>
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
    acknowledgeWeaponBrief,
    hasAcknowledgedWeaponBrief,
    setEquippedKeepsake,
    setKeepsakeAttunement,
    setKeepsakeRouteDoctrine,
    setKeepsakeMirrorCategory,
    equipRunItemLoadoutSlot,
    clearRunItemLoadoutSlot,
  } = usePlayerAccount();
  const { selectedSector, persisted } = useWorldState();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const inspectorColumnWidth = hubInspectorColumnWidth(screenWidth, 'standard');
  const reduceMotion = usePrefersReducedMotion();

  const [activeCategory, setActiveCategory] = useState<LoadoutCategory>('CHASSIS');
  const [chassisId, setChassisId] = useState<WeaponFamilyId | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefMode, setBriefMode] = useState<'first-use' | 'reopen'>('first-use');
  const pendingFirstUseFamilyIdRef = useRef<WeaponFamilyId | null>(null);
  const [relicId, setRelicId] = useState<KeepsakeId | null>(null);
  const [deckSelection, setDeckSelection] = useState<DeckSelection | null>(null);
  const [deckInspect, setDeckInspect] = useState<DeckInspectModel | null>(null);
  const [fieldSelection, setFieldSelection] = useState<FieldKitSelection>(null);
  const [deploymentModalVisible, setDeploymentModalVisible] = useState(false);
  const [pendingEquipId, setPendingEquipId] = useState<KeepsakeId | null>(null);
  const [modalKeepsakeId, setModalKeepsakeId] = useState<KeepsakeId | null>(null);
  const [modalDraftValue, setModalDraftValue] = useState<string | null>(null);
  const [dossierFooterHeight, setDossierFooterHeight] = useState(96);

  const dossierLock = useRef(new Animated.Value(1)).current;
  const narrow = screenWidth < 1500;
  const compact = screenHeight <= 800;
  const dossierBodyPaddingBottom = dossierFooterHeight + (compact ? 24 : 28);

  const handleDossierFooterLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && next !== dossierFooterHeight) {
      setDossierFooterHeight(next);
    }
  };
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

  const handleSelectChassis = useCallback((id: WeaponFamilyId, opts?: { silent?: boolean }) => {
    setChassisId(id);
    if (!opts?.silent) playDossierLock();
    const unlocked = account.weaponUnlocks.includes(id);
    const open = shouldOpenWeaponFirstUseBrief({
      familyId: id,
      unlocked,
      acknowledged: account.weaponBriefAcknowledged,
      interaction: opts?.silent ? 'silent' : (unlocked ? 'explicit-select' : 'locked-browse'),
      pendingFirstUseFamilyId: pendingFirstUseFamilyIdRef.current,
    });
    if (open) {
      pendingFirstUseFamilyIdRef.current = id;
      setBriefMode('first-use');
      setBriefOpen(true);
    }
  }, [account.weaponBriefAcknowledged, account.weaponUnlocks, playDossierLock]);

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
    if (account.activeClass === 'AEGIS') return account.aegisTechniqueLoadout;
    if (account.activeClass === 'HEX_SHOT') return account.hexShotLoadout;
    return account.envoyLoadout;
  }, [account.activeClass, account.aegisTechniqueLoadout, account.hexShotLoadout, account.envoyLoadout]);

  const fieldFilled = [...account.runItemLoadout.combatSlots, ...account.runItemLoadout.fieldSlots]
    .filter((id) => id != null).length;
  const cargoOccupancy = useMemo(() => resolveCargoOccupancy(account), [account]);

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

  const catalogCopy = CATEGORY_COPY[activeCategory];

  const renderManifestEntry = (category: LoadoutCategory) => {
    const selected = activeCategory === category;
    const copy = CATEGORY_COPY[category];
    let primary = '';
    if (category === 'CHASSIS') {
      primary = weaponDisplay;
    } else if (category === 'RELIC') {
      primary = relicName;
    } else if (category === 'DECK') {
      primary = `${abilityLoadout.filter(Boolean).length} / 4 ACTIVE`;
    } else if (category === 'FIELD_KIT') {
      primary = `${fieldFilled} / 4 SLOTS FILLED`;
    } else {
      primary = `${cargoOccupancy.occupied} / ${cargoOccupancy.capacity}`;
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
          styles.manifestSlot,
          narrow && styles.manifestSlotNarrow,
          compact && styles.manifestSlotCompact,
          selected && styles.manifestSlotSelected,
          ((hovered || pressed) && !selected) ? styles.manifestSlotHover : null,
        ])}
      >
        {selected ? <OccultNeonRail style={styles.manifestAccent} /> : null}
        <View style={styles.manifestTop}>
          <TerminalText
            size={9}
            letterSpacing={1}
            style={[styles.manifestLabel, selected && styles.manifestLabelSelected]}
            numberOfLines={1}
          >
            {copy.manifestLabel}
          </TerminalText>
          <TerminalText
            size={6}
            letterSpacing={0.7}
            style={[styles.manifestCode, selected && styles.manifestCodeSelected]}
          >
            {copy.channelCode}
          </TerminalText>
        </View>
        <TerminalText
          size={6.5}
          letterSpacing={0.8}
          style={[styles.manifestPrimary, selected && styles.manifestPrimarySelected]}
          numberOfLines={1}
        >
          {primary.toUpperCase()}
        </TerminalText>
      </HapticPressable>
    );
  };

  const renderDossier = () => {
    if (activeCategory === 'CHASSIS') {
      if (!chassisDossier) {
        return emptyDossier('Select a chassis from the equipment feed.');
      }
      const { facing, tierState, tier, unlocked, equipped, canUnlock, canUpgrade, nextTier, costLines, missing } = chassisDossier;
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
            <OccultNeonRail style={styles.dossierHeaderAccent} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>WEAPON CHASSIS</TerminalText>
            <TerminalText size={14} letterSpacing={0.15} style={styles.dossierTitle}>
              {facing.displayName.toUpperCase()}
            </TerminalText>
            <TerminalText size={8} letterSpacing={0.7} style={styles.dossierSecondary}>
              {facing.roleLabel.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {`${status} · TIER ${['I', 'II', 'III'][tier - 1] ?? tier}`}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
            <DossierSection label="PLAYSTYLE">
              <TerminalText size={8.5} style={styles.dossierValue}>{facing.playstyleExplanation}</TerminalText>
              {facing.starterFraming ? (
                <TerminalText size={8} style={[styles.dossierSecondary, { marginTop: 6 }]}>
                  {facing.starterFraming}
                </TerminalText>
              ) : null}
            </DossierSection>
            <DossierSection label="BASIC ACTION">
              <TerminalText size={8.5} style={styles.dossierValue}>{facing.basicExplanation}</TerminalText>
            </DossierSection>
            <DossierSection label="RESOURCE / METER">
              <TerminalText size={8.5} style={styles.dossierValue}>{facing.meterBehavior}</TerminalText>
            </DossierSection>
            <DossierSection label="STRENGTHS">
              {facing.strengths.map((s) => (
                <TerminalText key={s.mechanicalSource} size={8.5} style={styles.dossierValueTight}>
                  {s.phrase}{s.reason ? ` — ${s.reason}` : ''}
                </TerminalText>
              ))}
            </DossierSection>
            <DossierSection label="PRESSURES">
              {facing.pressures.map((s) => (
                <TerminalText key={s.mechanicalSource} size={8.5} style={styles.dossierValueTight}>
                  {s.phrase}{s.reason ? ` — ${s.reason}` : ''}
                </TerminalText>
              ))}
            </DossierSection>
            <DossierSection label="BUILDS TOWARD">
              <TerminalText size={8.5} style={styles.dossierValue}>
                {facing.buildDirectionTags.join(' · ')}
              </TerminalText>
            </DossierSection>
            <DossierSection label="MASTERY TIP">
              <TerminalText size={8.5} style={styles.dossierValue}>{facing.firstUseBrief.watchThis}</TerminalText>
              {unlocked ? (
                <HapticPressable
                  onPress={() => {
                    setBriefMode('reopen');
                    setBriefOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="View chassis tactical brief"
                  style={styles.viewBriefBtn}
                >
                  <TerminalText size={7.5} letterSpacing={0.8} style={styles.viewBriefText}>
                    [ VIEW BRIEF ]
                  </TerminalText>
                </HapticPressable>
              ) : null}
            </DossierSection>
            {facing.sanctuaryPaths.length > 0 ? (
              <DossierSection label="SANCTUARY PATHS">
                <TerminalText size={8} style={[styles.dossierSecondary, { marginBottom: 6 }]}>
                  Informational only — grafts are found and applied at Sanctuaries during a deployment, not equipped here.
                </TerminalText>
                {facing.sanctuaryPaths.map((path) => (
                  <TerminalText key={`${path.abilityId}-${path.graftId}`} size={8.5} style={styles.dossierValueTight}>
                    {`${path.abilityId} → ${path.graftId} — ${path.reason}`}
                  </TerminalText>
                ))}
              </DossierSection>
            ) : null}
            {facing.alternateLoadoutNote ? (
              <DossierSection label="ALTERNATE LOADOUT NOTE">
                <TerminalText size={8.5} style={styles.dossierValue}>{facing.alternateLoadoutNote}</TerminalText>
              </DossierSection>
            ) : null}
            {!unlocked ? (
              <DossierSection label="UNLOCK REQUIREMENTS" last={costLines.length === 0}>
                <TerminalText size={8} style={[styles.dossierSecondary, { marginBottom: 6 }]}>
                  Class rank is not a weapon gate — stash fabrication only. Not a numeric upgrade over the starter.
                </TerminalText>
                {costLines.map((line) => (
                  <View key={line.label} style={styles.reqRow}>
                    <TerminalText size={8} style={[styles.dossierSecondary, styles.reqLabel]} numberOfLines={2}>
                      {line.label.toUpperCase()}
                    </TerminalText>
                    <TerminalText
                      size={8}
                      style={[
                        styles.reqCount,
                        { color: line.owned >= line.need ? TEXT_PRIMARY : MISSING },
                      ]}
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
            ) : costLines.length > 0 ? (
              <DossierSection label="UPGRADE REQUIREMENTS" last>
                {costLines.map((line) => (
                  <View key={line.label} style={styles.reqRow}>
                    <TerminalText size={8} style={[styles.dossierSecondary, styles.reqLabel]} numberOfLines={2}>
                      {line.label.toUpperCase()}
                    </TerminalText>
                    <TerminalText
                      size={8}
                      style={[
                        styles.reqCount,
                        { color: line.owned >= line.need ? TEXT_PRIMARY : MISSING },
                      ]}
                    >
                      {`${line.owned} / ${line.need}`}
                    </TerminalText>
                  </View>
                ))}
              </DossierSection>
            ) : nextTier ? (
              <DossierSection label="NEXT TIER" last>
                <TerminalText size={8.5} style={styles.dossierValueTight}>{nextTier.effectSummary}</TerminalText>
              </DossierSection>
            ) : (
              <DossierSection label="TIER" last>
                <TerminalText size={8.5} style={styles.dossierValueTight}>
                  Max tier — {tierState.effectSummary || 'chassis fully upgraded.'}
                </TerminalText>
              </DossierSection>
            )}
          </ScrollView>
          <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
            <View style={styles.dossierFooterRule} />
            {!unlocked ? (
              <HubPrimaryCta
                disabled={!canUnlock}
                onPress={() => appendHubLog(unlockWeaponFamilyAccount(chassisDossier.def.id).logLine)}
                accessibilityLabel="Unlock blueprint"
                label={canUnlock ? '[ UNLOCK BLUEPRINT ]' : '[ UNLOCK BLOCKED ]'}
                minHeight={50}
              />
            ) : (
              <View style={[styles.dossierFooterActions, narrow && styles.dossierFooterActionsStack]}>
                {!equipped ? (
                  <HubPrimaryCta
                    onPress={() => {
                      const result = equipWeaponFamily(chassisDossier.def.id);
                      appendHubLog(result.logLine);
                      if (result.success) {
                        const open = shouldOpenWeaponFirstUseBrief({
                          familyId: chassisDossier.def.id,
                          unlocked: true,
                          acknowledged: account.weaponBriefAcknowledged,
                          interaction: 'explicit-equip',
                          pendingFirstUseFamilyId: pendingFirstUseFamilyIdRef.current,
                        });
                        if (open) {
                          pendingFirstUseFamilyIdRef.current = chassisDossier.def.id;
                          setBriefMode('first-use');
                          setBriefOpen(true);
                        }
                      }
                    }}
                    accessibilityLabel="Equip chassis"
                    label="[ EQUIP CHASSIS ]"
                    minHeight={50}
                    style={styles.dossierFooterAction}
                  />
                ) : (
                  <View style={[styles.actionButton, styles.actionDisabled, styles.dossierFooterAction]}>
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
                      styles.dossierFooterAction,
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
            <OccultNeonRail style={styles.dossierHeaderAccent} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>EXPEDITION RELIC</TerminalText>
            <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
              {def.name.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.4} style={[styles.dossierStatus, { fontStyle: 'italic' }]}>
              {`"${def.flavorText}"`}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
            <DossierSection label="EFFECT">
              <TerminalText size={8.5} style={styles.dossierValue}>{def.effectSummary}</TerminalText>
            </DossierSection>
            <DossierSection label="RISK" last={!deploymentSummary && warnings.length === 0}>
              <TerminalText size={8.5} style={styles.dossierValue}>{def.riskSummary}</TerminalText>
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
          <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
            <View style={styles.dossierFooterRule} />
            <View style={[
              styles.dossierFooterActions,
              (!equipped || !def.deploymentChoice) && styles.dossierFooterActionsSingle,
              narrow && equipped && def.deploymentChoice ? styles.dossierFooterActionsStack : null,
            ]}>
              <HubPrimaryCta
                onPress={handleRelicEquip}
                accessibilityLabel={equipped ? 'Unequip relic' : 'Equip relic'}
                label={equipped ? '[ UNEQUIP RELIC ]' : '[ EQUIP RELIC ]'}
                minHeight={50}
                style={styles.dossierFooterAction}
              />
              {equipped && def.deploymentChoice ? (
                <HapticPressable
                  onPress={() => openDeploymentModal(def.id, false)}
                  accessibilityRole="button"
                  accessibilityLabel="Configure deployment"
                  style={({ pressed }) => ([
                    styles.actionButton,
                    styles.actionSecondary,
                    styles.dossierFooterAction,
                    pressed && { opacity: 0.9 },
                  ])}
                >
                  <TerminalText size={8} letterSpacing={1} style={styles.actionSecondaryText}>
                    [ CONFIGURE DEPLOYMENT ]
                  </TerminalText>
                </HapticPressable>
              ) : null}
            </View>
          </View>
        </>
      );
    }

    if (activeCategory === 'DECK') {
      if (!deckInspect) return emptyDossier('Select a slot or ability from the deck.');
      return (
        <>
          <View style={styles.dossierHeader}>
            <OccultNeonRail style={styles.dossierHeaderAccent} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>ABILITY RECORD</TerminalText>
            <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
              {deckInspect.title.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {deckInspect.status}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
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
            {deckInspect.guidanceLine ? (
              <DossierSection label="CHASSIS GUIDANCE">
                <TerminalText size={8} style={[styles.dossierSecondary, { marginBottom: 4 }]}>
                  Advisory only — legal off-meta loadouts remain available.
                </TerminalText>
                <TerminalText size={8.5} style={styles.dossierValue}>{deckInspect.guidanceLine}</TerminalText>
              </DossierSection>
            ) : null}
            <DossierSection label="LOADOUT RELATIONSHIP" last>
              <TerminalText size={8.5} style={styles.dossierValue}>{deckInspect.slotLine}</TerminalText>
            </DossierSection>
          </ScrollView>
          <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
            <View style={styles.dossierFooterRule} />
            <View style={[
              styles.dossierFooterActions,
              deckInspect.actions.length < 2 && styles.dossierFooterActionsSingle,
              narrow && deckInspect.actions.length > 1 ? styles.dossierFooterActionsStack : null,
            ]}>
              {deckInspect.actions.map((action) => (
                action.tone === 'danger' ? (
                  <HapticPressable
                    key={action.label}
                    disabled={action.disabled || !action.onPress}
                    onPress={action.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    style={({ pressed }) => ([
                      styles.actionButton,
                      styles.dossierFooterAction,
                      action.disabled || !action.onPress
                        ? styles.actionDisabled
                        : styles.actionDestructive,
                      pressed && !action.disabled && { opacity: 0.9 },
                    ])}
                  >
                    <TerminalText
                      size={8}
                      letterSpacing={1}
                      style={
                        action.disabled || !action.onPress
                          ? styles.actionDisabledText
                          : styles.actionDestructiveText
                      }
                    >
                      {action.label}
                    </TerminalText>
                  </HapticPressable>
                ) : (
                  <HubPrimaryCta
                    key={action.label}
                    disabled={action.disabled || !action.onPress}
                    onPress={action.onPress}
                    accessibilityLabel={action.label}
                    label={action.label}
                    minHeight={50}
                    style={styles.dossierFooterAction}
                  />
                )
              ))}
            </View>
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
              <OccultNeonRail style={styles.dossierHeaderAccent} />
              <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
              <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>FIELD KIT SLOT</TerminalText>
              <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
                {def ? def.shortName.toUpperCase() : label}
              </TerminalText>
              <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
                {def ? 'OCCUPIED' : 'EMPTY'}
              </TerminalText>
            </View>
            <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
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
            <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
              <View style={styles.dossierFooterRule} />
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
            <OccultNeonRail style={styles.dossierHeaderAccent} />
            <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>STAGED CONSUMABLE</TerminalText>
            <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
              {(def?.shortName ?? fieldSelection.itemId).toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
              {slotType}
            </TerminalText>
          </View>
          <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
            <DossierSection label="EFFECT">
              <TerminalText size={8.5} style={styles.dossierValue}>{def?.effectSummary ?? '—'}</TerminalText>
            </DossierSection>
            <DossierSection label="COMPATIBLE SLOT" last>
              <TerminalText size={8.5} style={styles.dossierValue}>{slotType}</TerminalText>
            </DossierSection>
          </ScrollView>
          <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
          <View style={styles.dossierFooterRule} />
            <HubPrimaryCta
              onPress={() => {
                const result = equipRunItemLoadoutSlot(slotType, slotIndex, fieldSelection.itemId);
                appendHubLog(result.logLine);
              }}
              accessibilityLabel="Equip to kit slot"
              label={
                replacing
                  ? `[ REPLACE ${formatRunItemSlotLabel(slotType, slotIndex).toUpperCase()} ]`
                  : `[ EQUIP TO ${formatRunItemSlotLabel(slotType, slotIndex).toUpperCase()} ]`
              }
              minHeight={50}
            />
          </View>
        </>
      );
    }

    // CARGO
    return (
      <>
        <View style={styles.dossierHeader}>
          <OccultNeonRail style={styles.dossierHeaderAccent} />
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
          <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>CARGO BAY</TerminalText>
          <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
            PRE-DESCENT HOLD
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
            {`${cargoOccupancy.occupied} / ${cargoOccupancy.capacity} CELLS`}
          </TerminalText>
        </View>
        <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
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
        <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
          <View style={styles.dossierFooterRule} />
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
        <OccultNeonRail style={styles.dossierHeaderAccent} />
        <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>EQUIPMENT INSPECTOR</TerminalText>
        <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierCategory}>NO RECORD SELECTED</TerminalText>
        <TerminalText size={19} letterSpacing={0.1} style={styles.dossierTitle}>
          AWAITING SIGNAL
        </TerminalText>
      </View>
      <ScrollView style={styles.dossierBody} contentContainerStyle={[styles.dossierBodyContent, { paddingBottom: dossierBodyPaddingBottom }]}>
        <TerminalText size={8.5} style={styles.dossierValue}>{message}</TerminalText>
      </ScrollView>
      <View onLayout={handleDossierFooterLayout} style={styles.dossierFooter}>
          <View style={styles.dossierFooterRule} />
        <View style={[styles.actionButton, styles.actionDisabled]}>
          <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
            [ SELECT A RECORD ]
          </TerminalText>
        </View>
      </View>
    </>
  );

  const operativePager = (
    <View
      style={styles.operativePager}
      {...(Platform.OS === 'web' ? ({ 'data-operative-selector': 'true' } as object) : null)}
    >
      {canCycleClass ? (
        <HapticPressable
          onPress={() => cycleActiveClass(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous operative class"
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
            styles.operativeArrow,
            (hovered || pressed) ? styles.operativeArrowHover : null,
          ])}
        >
          <TerminalText size={10} style={{ color: TERMINAL }}>{'<'}</TerminalText>
        </HapticPressable>
      ) : (
        <View style={styles.operativeArrow}>
          <TerminalText size={10} style={{ color: MUTED }}>{'<'}</TerminalText>
        </View>
      )}
      <Image source={portraitSource} style={styles.operativePortrait} resizeMode="contain" />
      <View style={styles.operativeCreds}>
        <TerminalText size={11} letterSpacing={0.35} style={styles.operativeName} numberOfLines={1}>
          {cred.username.toUpperCase()}
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={0.55} style={styles.operativeMeta} numberOfLines={1}>
          {`${classDef.displayName.toUpperCase()} · L${account.progressionProfile.runner.clearanceRank}`}
        </TerminalText>
      </View>
      {canCycleClass ? (
        <HapticPressable
          onPress={() => cycleActiveClass(1)}
          accessibilityRole="button"
          accessibilityLabel="Next operative class"
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
            styles.operativeArrow,
            (hovered || pressed) ? styles.operativeArrowHover : null,
          ])}
        >
          <TerminalText size={10} style={{ color: TERMINAL }}>{'>'}</TerminalText>
        </HapticPressable>
      ) : (
        <View style={styles.operativeArrow}>
          <TerminalText size={10} style={{ color: MUTED }}>{'>'}</TerminalText>
        </View>
      )}
    </View>
  );

  const manifestRail = narrow ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.manifestScroll}
      contentContainerStyle={styles.manifestRowScroll}
      accessibilityRole="tablist"
      {...(Platform.OS === 'web' ? ({ 'aria-orientation': 'horizontal' } as object) : {})}
    >
      {CATEGORIES.map(renderManifestEntry)}
    </ScrollView>
  ) : (
    <View
      style={styles.manifestRow}
      accessibilityRole="tablist"
      {...(Platform.OS === 'web' ? ({ 'aria-orientation': 'horizontal' } as object) : {})}
    >
      {CATEGORIES.map(renderManifestEntry)}
    </View>
  );

  return (
    <View
      style={[styles.page, narrow && styles.pageNarrow]}
      {...(Platform.OS === 'web' ? ({ id: 'loadout-root', nativeID: 'loadout-root' } as object) : null)}
    >
      <View style={styles.loadoutBrowser}>
        <HubPageHeader
          eyebrow="LOADOUT // DESCENT PREP BAY"
          title="OPERATIVE LOADOUT"
          compact={compact}
          trailing={operativePager}
        />

        <View style={[styles.manifestRail, compact && styles.manifestRailCompact]}>
          {manifestRail}
        </View>

        <View style={styles.catalog}>
          {/* Same stack as Black Market Forge: feed padTop → sectionLabel margins → items. */}
          <View style={styles.catalogFeedPad}>
            <TerminalText size={11} letterSpacing={1.05} style={styles.catalogTitle}>
              {catalogCopy.title}
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
      </View>

      <View style={[styles.dossierColumn, { width: inspectorColumnWidth, flexBasis: inspectorColumnWidth, maxWidth: inspectorColumnWidth }]}>
        {/* Outer shell owns height; Animated.View only fades content so layout cannot collapse. */}
        <View style={styles.dossier}>
          <HubDossierCornerBrackets />
          <Animated.View style={[styles.dossierFill, { opacity: dossierLock }]}>
            {renderDossier()}
          </Animated.View>
        </View>
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

      <WeaponChassisBriefModal
        visible={briefOpen && chassisDossier != null}
        summary={chassisDossier?.facing ?? null}
        mode={briefMode}
        onAcknowledge={() => {
          if (chassisDossier) {
            acknowledgeWeaponBrief(chassisDossier.def.id);
            pendingFirstUseFamilyIdRef.current = null;
          }
          setBriefOpen(false);
        }}
        onDismissWithoutAck={() => {
          // Reopen path only — do not clear pending first-use until acknowledged.
          if (briefMode === 'reopen') setBriefOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    // Flex row (same as Contract Board / Black Market) so the dossier column
    // always gets a definite stretched height.
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    margin: 0,
    ...Platform.select({
      web: {
        width: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  },
  pageNarrow: {},
  loadoutBrowser: {
    flexGrow: 2.1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
    zIndex: 1,
    // Top-pack: header → manifest → catalog (only catalog grows).
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr)',
        alignContent: 'start',
      } as object,
      default: {
        flexDirection: 'column',
        alignItems: 'stretch',
      },
    }),
  },
  operativePager: {
    // Fixed footprint so cycling classes (ENVOY / HEX SHOT / AEGIS SLAYER)
    // cannot shift the page title.
    width: 320,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    flexGrow: 0,
  },
  operativeArrow: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' } as object, default: {} }),
  },
  operativeArrowHover: {
    backgroundColor: 'rgba(105, 200, 173, 0.04)',
  },
  operativePortrait: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },
  operativeCreds: {
    width: 182,
    marginLeft: 10,
    marginRight: 4,
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  operativeName: { color: TEXT_PRIMARY, fontWeight: '700' },
  operativeMeta: { marginTop: 4, color: MUTED, fontWeight: '700' },
  dossierColumn: {
    ...hubDossierColumnStyle(),
    flexGrow: 0,
    flexShrink: 0,
  },
  manifestRail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: HUB_CHANNEL_BUTTON_HEIGHT,
    // Match Contract Board / Black Market channel row inset + bottom pad.
    paddingHorizontal: HUB_BROWSER_CONTENT_PADDING_H,
    paddingBottom: 6,
    flexGrow: 0,
    flexShrink: 0,
    gap: 10,
  },
  manifestRailCompact: {
    minHeight: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
  },
  manifestScroll: {
    flexGrow: 0,
    flex: 1,
  },
  manifestRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        columnGap: 10,
      } as object,
      default: {},
    }),
  },
  manifestRowScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
  },
  manifestSlot: {
    position: 'relative',
    height: HUB_CHANNEL_BUTTON_HEIGHT,
    minHeight: HUB_CHANNEL_BUTTON_HEIGHT,
    maxHeight: HUB_CHANNEL_BUTTON_HEIGHT,
    justifyContent: 'center',
    paddingTop: HUB_CHANNEL_BUTTON_PADDING_V,
    paddingBottom: HUB_CHANNEL_BUTTON_PADDING_V,
    paddingLeft: 12,
    paddingRight: 12,
    backgroundColor: VEIL.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VEIL.lineFaint,
    overflow: 'hidden',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none', minWidth: 0 } as object,
      default: { flex: 1 },
    }),
  },
  manifestSlotNarrow: {
    width: 168,
    minWidth: 168,
    flexGrow: 0,
    flexShrink: 0,
  },
  manifestSlotCompact: {
    height: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
    minHeight: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
    maxHeight: HUB_CHANNEL_BUTTON_COMPACT_HEIGHT,
    paddingTop: HUB_CHANNEL_BUTTON_COMPACT_PADDING_V,
    paddingBottom: HUB_CHANNEL_BUTTON_COMPACT_PADDING_V,
  },
  manifestSlotHover: {
    backgroundColor: VEIL.surface2,
  },
  manifestSlotSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  manifestAccent: {
    top: HUB_CHANNEL_RAIL_INSET,
    bottom: HUB_CHANNEL_RAIL_INSET,
  },
  manifestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manifestLabel: {
    flex: 1,
    minWidth: 0,
    color: TEXT_SECONDARY,
    fontWeight: '800',
  },
  manifestLabelSelected: { color: VEIL.text },
  manifestCode: { color: TEXT_SECONDARY, fontWeight: '700', flexShrink: 0 },
  manifestCodeSelected: { color: TERMINAL },
  manifestPrimary: { marginTop: 6, color: TEXT_SECONDARY, fontWeight: '700' },
  manifestPrimarySelected: { color: TEXT_PRIMARY },
  catalog: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
    // No horizontal pad here — section label + item feeds own the 14px edge,
    // same as Black Market ForgeWorkspace.
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
      } as object,
      default: {},
    }),
  },
  catalogFeedPad: {
    // Forge ScrollView contentContainerStyle.paddingTop
    paddingTop: HUB_BROWSER_FEED_PAD_TOP,
    flexShrink: 0,
  },
  catalogTitle: {
    ...hubBrowserSectionLabelStyle(),
  },
  catalogBody: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: HUB_BROWSER_CONTENT_PADDING_H,
  },
  dossier: {
    ...hubDossierShellStyle(),
    ...Platform.select({
      web: {},
      default: { width: 420 },
    }),
  },
  dossierFill: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    minWidth: 0,
    ...Platform.select({
      web: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      } as object,
      default: {
        flex: 1,
      },
    }),
  },
  dossierHeader: {
    position: 'relative',
    zIndex: 1,
    paddingTop: 22,
    paddingBottom: 16,
    paddingLeft: 28,
    paddingRight: 24,
    flexShrink: 0,
    overflow: 'visible',
  },
  dossierHeaderAccent: {
    ...hubInspectorFocusBarStyle(),
  },
  dossierEyebrow: {
    color: VEIL.textDim,
    fontWeight: '700',
    marginBottom: 8,
  },
  dossierCategory: { marginTop: 2, color: MUTED, fontWeight: '700', minHeight: 16 },
  dossierTitle: { marginTop: 8, color: HUB_DOSSIER_TITLE, fontWeight: '700' },
  dossierStatus: {
    marginTop: 14,
    color: TEXT_SECONDARY,
    fontWeight: '700',
    maxWidth: '72%',
  },
  dossierBody: {
    position: 'relative',
    zIndex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
  },
  dossierBodyContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingBottom: 120,
    paddingLeft: 28,
    paddingRight: 24,
  },
  dossierSection: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 14,
    marginBottom: 2,
  },
  dossierSectionLast: { marginBottom: 0, paddingBottom: 0 },
  dossierLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  dossierBoneRule: {
    width: 2,
    height: 12,
    backgroundColor: VEIL.bone,
    opacity: 0.55,
  },
  dossierLabel: { color: HUB_DOSSIER_LABEL, fontWeight: '700' },
  dossierValue: { marginTop: 7, color: VEIL.text, lineHeight: 20 },
  dossierValueTight: { marginTop: 5, color: VEIL.text, lineHeight: 19 },
  dossierSecondary: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
  viewBriefBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  viewBriefText: { color: TERMINAL, fontWeight: '700' },
  reqRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  reqLabel: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
  },
  reqCount: {
    flexShrink: 0,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dossierFooter: {
    position: 'relative',
    zIndex: 2,
    paddingTop: 14,
    paddingBottom: 16,
    paddingLeft: 24,
    paddingRight: 22,
    backgroundColor: HUB_DOSSIER_FOOTER_BG,
    flexShrink: 0,
  },
  dossierFooterRule: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: HUB_DOSSIER_FOOTER_RULE,
  },
  dossierFooterActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  dossierFooterActionsSingle: {
    flexDirection: 'column',
  },
  dossierFooterActionsStack: {
    flexDirection: 'column',
  },
  dossierFooterAction: {
    flex: 1,
    minWidth: 0,
  },
  actionButton: {
    width: '100%',
    minHeight: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer', outlineStyle: 'none' } as object, default: {} }),
  },
  actionPrimary: {
    ...hubPrimaryActionStyle(),
  },
  actionPrimaryHover: {
    ...hubPrimaryActionHoverStyle(),
  },
  actionPrimaryText: { ...hubPrimaryActionTextStyle() },
  actionPrimaryTextHover: { ...hubPrimaryActionTextHoverStyle() },
  actionSecondary: {
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  actionSecondaryText: { color: TERMINAL_BRIGHT, fontWeight: '800' },
  actionDestructive: {
    backgroundColor: 'rgba(163, 92, 102, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(163, 92, 102, 0.42)',
  },
  actionDestructiveText: { color: '#B8898F', fontWeight: '800' },
  actionDisabled: {
    backgroundColor: 'rgba(185, 181, 167, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(185, 181, 167, 0.16)',
  },
  actionDisabledText: {
    color: 'rgba(222, 227, 223, 0.32)',
    fontWeight: '800',
  },
});
