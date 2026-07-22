import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import VeilTerminalEffects from '../atmosphere/VeilTerminalEffects';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useWorldState } from '../../context/WorldStateContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import type { GeneratedContract } from '../../types/contract';
import type { CabalEmployerId } from '../../types/worldState';
import {
  formatCompactContractObjective,
  formatCompactContractValidSectors,
  formatContractJobType,
  formatContractRiskTier,
  sponsorDisplayName,
} from '../../utils/contractUi';
import { describeEmployerPerks, employerSponsorLabel } from '../../utils/employerContractUi';
import { isResourceContractObjective } from '../../data/contractResolver';
import { buildSponsorReputationPreview } from '../../data/runIntegration/sponsorRepEngine';
import { getActiveAnchorInstance } from '../../data/anchorLifecycleEngine';
import { buildPreliminaryRunWorldContext } from '../../data/runWorldBriefEngine';
import { SPONSOR_IDENTITY } from '../../utils/sponsorIdentity';

const SPONSOR_ORDER: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const DEFAULT_SPONSOR_FILTER: CabalEmployerId = 'TERRAN_GRID';
const INDEPENDENT_ACCENT = '#7a8b96';
const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8edfc6';

/** Restrained channel accents — presentation only; does not alter faction data. */
const CABAL_CHANNEL: Record<CabalEmployerId, { color: string; rgb: string }> = {
  TERRAN_GRID: { color: '#69c8ad', rgb: '105, 200, 173' },
  LEGION: { color: '#9b8fd4', rgb: '155, 143, 212' },
  SOLARIS: { color: '#c88989', rgb: '200, 137, 137' },
};

type InspectedSelection =
  | { kind: 'NONE' }
  | { kind: 'INDEPENDENT' }
  | { kind: 'SPONSOR'; contractId: string };

function resolveSponsorFilter(lastUsedSponsorId: CabalEmployerId | null | undefined): CabalEmployerId {
  return lastUsedSponsorId ?? DEFAULT_SPONSOR_FILTER;
}

function formatSectorShort(id: string): string {
  return id
    .replace(/^THE_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskPresentation(difficulty: number): { label: string; color: string; extreme: boolean } {
  const base = formatContractRiskTier(difficulty);
  if (base.label === 'EXTREME') return { label: 'EXTREME', color: '#d66f71', extreme: true };
  if (base.label === 'HIGH RISK') return { label: 'HIGH', color: '#b8a7a0', extreme: false };
  if (base.label === 'MED RISK') return { label: 'MEDIUM', color: '#97a7a2', extreme: false };
  return { label: 'LOW', color: '#97a7a2', extreme: false };
}

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

function ContractSignalRow({
  contract,
  selected,
  active,
  onSelect,
  compact,
  collapseMeta,
}: {
  contract: GeneratedContract;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  compact: boolean;
  collapseMeta: boolean;
}): React.JSX.Element {
  const risk = riskPresentation(contract.difficulty);
  const isResource = isResourceContractObjective(contract.objectiveKind);
  const sectors = (contract.validSectorIds.length > 0
    ? contract.validSectorIds
    : contract.recommendedSectorIds
  )
    .slice(0, 3)
    .map(formatSectorShort)
    .join(' · ');
  const fulfillment = isResource ? 'POST-RUN DELIVERY' : 'RESOLVED IN-RUN';
  const betrayal = contract.reward.reputation > 0 ? 'BETRAYABLE' : null;

  return (
    <View
      style={styles.signal}
      {...(Platform.OS === 'web'
        ? ({
            'data-selected': selected ? 'true' : 'false',
            'data-active': active ? 'true' : 'false',
          } as object)
        : null)}
    >
      {selected ? <View style={styles.signalAccent} /> : null}
      <HapticPressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Inspect ${contract.title}`}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
          styles.signalSelect,
          collapseMeta && styles.signalSelectCollapsed,
          compact && styles.signalSelectCompact,
          selected && styles.signalSelectSelected,
          ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
          pressed && { opacity: 0.94 },
        ])}
      >
        <View style={styles.signalMain}>
          <View style={styles.signalTopline}>
            <TerminalText size={7} letterSpacing={0.9} style={styles.signalIssuer} numberOfLines={1}>
              {employerSponsorLabel(contract.sponsorId).toUpperCase()}
            </TerminalText>
            {active ? (
              <TerminalText size={7} letterSpacing={0.9} style={styles.signalStatusActive}>
                ACTIVE
              </TerminalText>
            ) : null}
          </View>
          <TerminalText size={11} letterSpacing={0.35} style={styles.signalTitle} numberOfLines={2}>
            {contract.title.toUpperCase()}
          </TerminalText>
          <TerminalText size={8.5} style={styles.signalObjective} numberOfLines={2}>
            {formatCompactContractObjective(contract)}
          </TerminalText>
          {collapseMeta ? (
            <View style={styles.signalMetaCollapsed}>
              {sectors ? (
                <TerminalText size={7.5} style={styles.signalMetaLine} numberOfLines={1}>
                  {sectors}
                </TerminalText>
              ) : null}
              <TerminalText size={7.5} letterSpacing={0.5} style={styles.signalMetaLine} numberOfLines={1}>
                {[fulfillment, betrayal].filter(Boolean).join(' · ')}
              </TerminalText>
            </View>
          ) : null}
        </View>

        {!collapseMeta ? (
          <View style={styles.signalMetaCol}>
            {sectors ? (
              <TerminalText size={7.5} style={styles.signalMetaLine} numberOfLines={2}>
                {sectors}
              </TerminalText>
            ) : null}
            <TerminalText size={7.5} letterSpacing={0.55} style={styles.signalMetaMuted} numberOfLines={1}>
              {fulfillment}
            </TerminalText>
            {betrayal ? (
              <TerminalText size={7.5} letterSpacing={0.55} style={styles.signalMetaMuted} numberOfLines={1}>
                {betrayal}
              </TerminalText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.signalRiskCol}>
          <TerminalText size={7} letterSpacing={0.9} style={styles.signalColLabel}>
            RISK
          </TerminalText>
          <TerminalText
            size={8}
            letterSpacing={0.7}
            style={[styles.signalRiskValue, risk.extreme && styles.signalRiskExtreme, { color: risk.color }]}
          >
            {risk.label}
          </TerminalText>
        </View>

        <View style={styles.signalPayoutCol}>
          <TerminalText size={7} letterSpacing={0.9} style={styles.signalColLabel}>
            PAYOUT
          </TerminalText>
          <TerminalText size={11} style={styles.signalCredits}>
            {`${contract.reward.credits} CR`}
          </TerminalText>
          <TerminalText size={7.5} style={styles.signalRep}>
            {`+${contract.reward.reputation} REP`}
          </TerminalText>
        </View>
      </HapticPressable>
    </View>
  );
}

function IndependentSignalRow({
  selected,
  active,
  onSelect,
  compact,
  collapseMeta,
}: {
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  compact: boolean;
  collapseMeta: boolean;
}): React.JSX.Element {
  return (
    <View
      style={[styles.signal, styles.signalIndependent]}
      {...(Platform.OS === 'web'
        ? ({
            'data-selected': selected ? 'true' : 'false',
            'data-active': active ? 'true' : 'false',
          } as object)
        : null)}
    >
      {selected ? <View style={[styles.signalAccent, { backgroundColor: INDEPENDENT_ACCENT }]} /> : null}
      <HapticPressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel="Inspect Independent Breach"
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
          styles.signalSelect,
          collapseMeta && styles.signalSelectCollapsed,
          compact && styles.signalSelectCompact,
          selected && styles.signalSelectSelectedIndependent,
          ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
          pressed && { opacity: 0.94 },
        ])}
      >
        <View style={styles.signalMain}>
          <View style={styles.signalTopline}>
            <TerminalText size={7} letterSpacing={0.9} style={{ color: INDEPENDENT_ACCENT, fontWeight: '700' }}>
              BLACK CHANNEL
            </TerminalText>
            {active ? (
              <TerminalText size={7} letterSpacing={0.9} style={styles.signalStatusActive}>
                ACTIVE
              </TerminalText>
            ) : (
              <TerminalText size={7} letterSpacing={0.9} style={styles.signalIssuer}>
                UNVERIFIED
              </TerminalText>
            )}
          </View>
          <TerminalText size={11} letterSpacing={0.35} style={styles.signalTitle}>
            INDEPENDENT BREACH
          </TerminalText>
          <TerminalText size={8.5} style={styles.signalObjective}>
            No sponsor. No leash. No reputation payout.
          </TerminalText>
          {collapseMeta ? (
            <View style={styles.signalMetaCollapsed}>
              <TerminalText size={7.5} letterSpacing={0.55} style={styles.signalMetaLine}>
                UNSPONSORED · UNVERIFIED
              </TerminalText>
            </View>
          ) : null}
        </View>

        {!collapseMeta ? (
          <View style={styles.signalMetaCol}>
            <TerminalText size={7.5} letterSpacing={0.55} style={styles.signalMetaMuted}>
              UNSPONSORED
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={0.55} style={styles.signalMetaMuted}>
              UNVERIFIED
            </TerminalText>
          </View>
        ) : null}

        <View style={styles.signalRiskCol}>
          <TerminalText size={7} letterSpacing={0.9} style={styles.signalColLabel}>
            RISK
          </TerminalText>
          <TerminalText size={8} letterSpacing={0.7} style={[styles.signalRiskValue, { color: '#7f928c' }]}>
            —
          </TerminalText>
        </View>

        <View style={styles.signalPayoutCol}>
          <TerminalText size={7} letterSpacing={0.9} style={styles.signalColLabel}>
            PAYOUT
          </TerminalText>
          <TerminalText size={11} style={[styles.signalCredits, { color: '#afbfba' }]}>
            0 CR
          </TerminalText>
          <TerminalText size={7.5} style={styles.signalRep}>
            +0 REP
          </TerminalText>
        </View>
      </HapticPressable>
    </View>
  );
}

export default function ContractBoardPanel(): React.JSX.Element {
  const {
    persisted,
    isHydrated,
    selectContract,
    selectIndependentContract,
    selectedSector,
  } = useWorldState();
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();

  const { contracts, selectedContract, lastUsedSponsorId } = persisted.contractBoard;
  const [activeSponsorId, setActiveSponsorId] = useState<CabalEmployerId>(
    () => resolveSponsorFilter(lastUsedSponsorId),
  );
  const [inspected, setInspected] = useState<InspectedSelection>({ kind: 'NONE' });
  const feedSweep = useRef(new Animated.Value(0)).current;
  const dossierLock = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isHydrated) return;
    setActiveSponsorId(resolveSponsorFilter(lastUsedSponsorId));
  }, [isHydrated, lastUsedSponsorId]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const styleId = 'contract-board-focus-styles-v3';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    // RN-web drops custom data-* on View; scope via board root id + aria roles.
    style.textContent = `
#contract-board-root [role="tab"]:focus,
#contract-board-root [role="tab"]:focus-visible,
#contract-board-root [role="button"]:focus,
#contract-board-root [role="button"]:focus-visible,
#contract-board-root button:focus,
#contract-board-root button:focus-visible {
  outline: 2px solid ${TERMINAL_BRIGHT} !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}
`;
    return undefined;
  }, []);

  // Seed inspection from the accepted mandate once hydrated.
  useEffect(() => {
    if (!isHydrated) return;
    if (selectedContract.kind === 'SPONSOR') {
      setInspected({ kind: 'SPONSOR', contractId: selectedContract.contract.id });
      setActiveSponsorId(selectedContract.contract.sponsorId);
    } else if (selectedContract.kind === 'INDEPENDENT') {
      setInspected({ kind: 'INDEPENDENT' });
    }
    // Intentionally once on hydrate — later acceptance is driven by explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  const visibleContracts = useMemo(
    () => contracts.filter((contract) => contract.sponsorId === activeSponsorId),
    [contracts, activeSponsorId],
  );
  const jobCountBySponsor = useMemo(() => {
    const counts: Record<CabalEmployerId, number> = { TERRAN_GRID: 0, LEGION: 0, SOLARIS: 0 };
    contracts.forEach((contract) => {
      counts[contract.sponsorId] += 1;
    });
    return counts;
  }, [contracts]);

  const crisisPreview = useMemo(() => {
    const anchor = getActiveAnchorInstance(persisted, selectedSector.id);
    return buildPreliminaryRunWorldContext({
      persisted,
      sectorState: selectedSector,
      operation: selectedSector.activeOperation,
      anchor,
    });
  }, [persisted, selectedSector]);

  const isIndependentActive = selectedContract.kind === 'INDEPENDENT';
  const activeSponsorContract = selectedContract.kind === 'SPONSOR'
    ? selectedContract.contract
    : null;
  const activeContractId = activeSponsorContract?.id ?? null;
  const listedCount = contracts.length + 1; // include Independent Breach route
  const activeCount = activeSponsorContract || isIndependentActive ? 1 : 0;

  const inspectedContract = useMemo(() => {
    if (inspected.kind !== 'SPONSOR') return null;
    return contracts.find((c) => c.id === inspected.contractId) ?? null;
  }, [contracts, inspected]);

  const dossierAccent = inspected.kind === 'INDEPENDENT'
    ? INDEPENDENT_ACCENT
    : inspectedContract
      ? CABAL_CHANNEL[inspectedContract.sponsorId].color
      : CABAL_CHANNEL[activeSponsorId].color;

  const compactHeight = screenHeight <= 800;
  const narrowLayout = screenWidth < 1500;
  const collapseMeta = screenWidth < 1500;

  const crisisTags = useMemo(() => {
    const tags = crisisPreview.threatProfile.pressureTags
      .map((t) => t.toUpperCase())
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 2);
    return tags;
  }, [crisisPreview]);

  const playFeedSweep = () => {
    if (reduceMotion) return;
    feedSweep.setValue(0);
    Animated.timing(feedSweep, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => feedSweep.setValue(0));
  };

  const playDossierLock = () => {
    if (reduceMotion) {
      dossierLock.setValue(1);
      return;
    }
    dossierLock.setValue(0.88);
    Animated.timing(dossierLock, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  const handleSelectCabal = (sponsorId: CabalEmployerId) => {
    if (sponsorId === activeSponsorId) return;
    setActiveSponsorId(sponsorId);
    const first = contracts.find((c) => c.sponsorId === sponsorId);
    if (first) {
      setInspected({ kind: 'SPONSOR', contractId: first.id });
    } else if (inspected.kind === 'INDEPENDENT') {
      // keep independent inspection while browsing empty cabal
    } else {
      setInspected({ kind: 'NONE' });
    }
    playFeedSweep();
    playDossierLock();
  };

  const handleInspectContract = (contract: GeneratedContract) => {
    setActiveSponsorId(contract.sponsorId);
    setInspected({ kind: 'SPONSOR', contractId: contract.id });
    playDossierLock();
  };

  const handleInspectIndependent = () => {
    setInspected({ kind: 'INDEPENDENT' });
    playDossierLock();
  };

  const handleAcceptInspected = () => {
    if (inspected.kind === 'INDEPENDENT') {
      selectIndependentContract();
      return;
    }
    if (inspectedContract) {
      selectContract(inspectedContract);
    }
  };

  const handleAbandon = () => {
    selectIndependentContract();
    setInspected({ kind: 'INDEPENDENT' });
  };

  const inspectedIsActiveSponsor = Boolean(
    inspectedContract && activeContractId === inspectedContract.id,
  );
  const inspectedIsActiveIndependent = inspected.kind === 'INDEPENDENT' && isIndependentActive;
  const hasOtherActiveSponsor = Boolean(
    activeSponsorContract && inspectedContract && activeSponsorContract.id !== inspectedContract.id,
  );

  const feedSweepStyle = {
    opacity: feedSweep.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.55, 0] }),
    transform: [{
      translateY: feedSweep.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }),
    }],
  };

  const inspectedRisk = inspectedContract
    ? riskPresentation(inspectedContract.difficulty)
    : null;

  const specialConditions = inspectedContract
    ? [
      inspectedContract.reward.reputation > 0 ? 'Betrayable' : null,
      inspectedContract.bonusObjective
        ? `Bonus: ${inspectedContract.bonusObjective.text}`
        : null,
      ...describeEmployerPerks(inspectedContract.sponsorId)
        .filter((line) => line !== 'Standard sponsor terms')
        .slice(0, 2),
    ].filter(Boolean) as string[]
    : [];

  return (
    <View
      style={[styles.board, narrowLayout && styles.boardNarrow]}
      {...(Platform.OS === 'web' ? ({ id: 'contract-board-root', nativeID: 'contract-board-root' } as object) : null)}
    >
      <VeilTerminalEffects intensity="subtle" scanlineOpacity={0.04} />

      <View style={styles.contractBrowser}>
        <View style={[styles.contractBoardHeader, compactHeight && styles.contractBoardHeaderCompact]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TerminalText size={7.5} letterSpacing={1.1} style={styles.contractBoardHeaderEyebrow}>
              CONTRACT BOARD / BROKER NETWORK
            </TerminalText>
            <TerminalText size={15} letterSpacing={0.55} style={styles.contractBoardHeaderTitle}>
              AVAILABLE MANDATES
            </TerminalText>
          </View>
          <View style={styles.contractBoardHeaderCounts}>
            <TerminalText size={7.5} letterSpacing={1} style={styles.contractBoardHeaderCount}>
              {`${listedCount} LISTED`}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={1} style={styles.contractBoardHeaderCount}>
              {`${activeCount} ACTIVE`}
            </TerminalText>
          </View>
        </View>

        <View style={[styles.brokerBulletin, compactHeight && styles.brokerBulletinCompact]}>
          <View style={styles.brokerBulletinAccent} />
          <View style={styles.brokerBulletinMain}>
            <TerminalText size={7} letterSpacing={0.9} style={styles.brokerEyebrow}>
              {`BROKER PRIORITY · ${formatSectorShort(selectedSector.id).toUpperCase()}`}
            </TerminalText>
            <TerminalText size={10} letterSpacing={0.4} style={styles.brokerTitle} numberOfLines={1}>
              {crisisPreview.crisisDisplayName.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} style={styles.brokerDescription} numberOfLines={2}>
              {crisisPreview.crisisSummary}
            </TerminalText>
          </View>
          {crisisTags.length > 0 ? (
            <View style={styles.brokerTags}>
              {crisisTags.map((tag) => (
                <TerminalText key={tag} size={7} letterSpacing={0.9} style={styles.brokerTag}>
                  {tag}
                </TerminalText>
              ))}
            </View>
          ) : null}
        </View>

        <View
          style={styles.sponsorChannels}
          accessibilityRole="tablist"
          {...(Platform.OS === 'web' ? ({ 'aria-label': 'Contract issuers' } as object) : {})}
        >
          {SPONSOR_ORDER.map((sponsorId) => {
            const selected = activeSponsorId === sponsorId;
            const accent = CABAL_CHANNEL[sponsorId];
            const count = jobCountBySponsor[sponsorId];
            const rep = account.sponsorReputation[sponsorId] ?? 0;
            const preview = buildSponsorReputationPreview(sponsorId, rep);
            return (
              <HapticPressable
                key={sponsorId}
                onPress={() => handleSelectCabal(sponsorId)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${sponsorDisplayName(sponsorId)} channel`}
                {...(Platform.OS === 'web'
                  ? ({ 'aria-selected': selected } as object)
                  : {})}
                style={({ pressed }) => ([
                  styles.sponsorChannel,
                  selected && styles.sponsorChannelSelected,
                  pressed && { opacity: 0.92 },
                ])}
              >
                <View style={styles.sponsorChannelTop}>
                  <TerminalText size={10} style={{ color: accent.color }}>
                    {SPONSOR_IDENTITY[sponsorId].emblem}
                  </TerminalText>
                  <TerminalText
                    size={9}
                    letterSpacing={0.55}
                    style={styles.sponsorChannelName}
                    numberOfLines={1}
                  >
                    {sponsorDisplayName(sponsorId).toUpperCase()}
                  </TerminalText>
                  <TerminalText size={7} letterSpacing={0.7} style={styles.sponsorChannelCount}>
                    {`${count} AVAILABLE`}
                  </TerminalText>
                </View>
                <TerminalText size={7} letterSpacing={0.55} style={styles.sponsorChannelRep} numberOfLines={1}>
                  {`RANK ${preview.rank} · ${preview.progressInRank} / 5 REP`}
                </TerminalText>
                {selected ? <View style={styles.sponsorChannelUnderline} /> : null}
              </HapticPressable>
            );
          })}
        </View>

        <View style={styles.contractFeed}>
          <View style={styles.contractFeedHeader}>
            <TerminalText size={7.5} letterSpacing={1} style={styles.contractFeedHeaderText}>
              {`${sponsorDisplayName(activeSponsorId).toUpperCase()} // AVAILABLE CONTRACTS`}
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={1} style={styles.contractFeedHeaderText}>
              {`${visibleContracts.length} AVAILABLE`}
            </TerminalText>
          </View>
          <View style={styles.contractFeedScrollWrap}>
            {!reduceMotion ? (
              <Animated.View pointerEvents="none" style={[styles.feedSweep, feedSweepStyle]} />
            ) : null}
            <ScrollView
              style={styles.contractFeedScroll}
              contentContainerStyle={{ paddingBottom: scaleSpacing(16) }}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'web'
                ? ({
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(105, 200, 173, 0.24) transparent',
                  } as object)
                : null)}
            >
              {visibleContracts.length === 0 ? (
                <View style={styles.emptyFeed}>
                  <TerminalText size={9} letterSpacing={0.6} style={styles.emptyFeedTitle}>
                    NO AVAILABLE CONTRACTS
                  </TerminalText>
                  <TerminalText size={8} style={styles.emptyFeedBody}>
                    This Cabal has no mandates available during the current cycle.
                  </TerminalText>
                </View>
              ) : (
                visibleContracts.map((contract) => (
                  <ContractSignalRow
                    key={contract.id}
                    contract={contract}
                    selected={inspected.kind === 'SPONSOR' && inspected.contractId === contract.id}
                    active={activeContractId === contract.id}
                    onSelect={() => handleInspectContract(contract)}
                    compact={compactHeight}
                    collapseMeta={collapseMeta}
                  />
                ))
              )}

              <View style={styles.independentSection}>
                <View style={styles.independentSectionHeader}>
                  <TerminalText size={7.5} letterSpacing={1} style={styles.independentSectionTitle}>
                    BLACK CHANNEL // INDEPENDENT ROUTES
                  </TerminalText>
                </View>
                <IndependentSignalRow
                  selected={inspected.kind === 'INDEPENDENT'}
                  active={isIndependentActive}
                  onSelect={handleInspectIndependent}
                  compact={compactHeight}
                  collapseMeta={collapseMeta}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.contractDossier,
          { opacity: dossierLock },
          Platform.OS === 'web' ? ({ '--selected-cabal-color': dossierAccent } as object) : null,
        ]}
      >
        <View style={[styles.dossierHeader, compactHeight && styles.dossierHeaderCompact]}>
          <View style={[styles.dossierHeaderAccent, { backgroundColor: dossierAccent }]} />
          <TerminalText size={7.5} letterSpacing={1.1} style={styles.dossierEyebrow}>
            CONTRACT DOSSIER
          </TerminalText>
          {inspected.kind === 'NONE' ? (
            <>
              <TerminalText size={8} letterSpacing={0.8} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                NO TRANSMISSION SELECTED
              </TerminalText>
              <TerminalText size={16.5} letterSpacing={0.35} style={styles.dossierTitle}>
                AWAITING SIGNAL
              </TerminalText>
            </>
          ) : inspected.kind === 'INDEPENDENT' ? (
            <>
              <TerminalText size={8} letterSpacing={0.8} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                BLACK CHANNEL · UNVERIFIED
              </TerminalText>
              <TerminalText size={16.5} letterSpacing={0.35} style={styles.dossierTitle}>
                INDEPENDENT BREACH
              </TerminalText>
              <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
                {isIndependentActive ? 'ACTIVE · UNSPONSORED' : 'AVAILABLE · UNSPONSORED'}
              </TerminalText>
            </>
          ) : inspectedContract ? (
            <>
              <TerminalText size={8} letterSpacing={0.8} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                {`${sponsorDisplayName(inspectedContract.sponsorId).toUpperCase()} · ${formatContractJobType(inspectedContract.objectiveKind)}`}
              </TerminalText>
              <TerminalText size={16.5} letterSpacing={0.35} style={styles.dossierTitle}>
                {inspectedContract.title.toUpperCase()}
              </TerminalText>
              <TerminalText
                size={7.5}
                letterSpacing={0.9}
                style={[
                  styles.dossierStatus,
                  inspectedRisk?.extreme ? { color: inspectedRisk.color } : null,
                ]}
              >
                {[
                  inspectedIsActiveSponsor ? 'ACTIVE' : 'AVAILABLE',
                  inspectedRisk ? `${inspectedRisk.label} RISK` : null,
                ].filter(Boolean).join(' · ')}
              </TerminalText>
            </>
          ) : (
            <>
              <TerminalText size={8} letterSpacing={0.8} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                SIGNAL LOST
              </TerminalText>
              <TerminalText size={16.5} letterSpacing={0.35} style={styles.dossierTitle}>
                TRANSMISSION UNAVAILABLE
              </TerminalText>
            </>
          )}
        </View>

        <ScrollView
          style={styles.dossierBody}
          contentContainerStyle={[
            styles.dossierBodyContent,
            compactHeight && styles.dossierBodyContentCompact,
          ]}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(105, 200, 173, 0.22) transparent',
              } as object)
            : null)}
        >
          {inspected.kind === 'NONE' ? (
            <TerminalText size={8.5} style={styles.dossierValue}>
              Select a mandate from the broker feed.
            </TerminalText>
          ) : inspected.kind === 'INDEPENDENT' ? (
            <>
              <DossierSection label="OBJECTIVE">
                <TerminalText size={8.5} style={styles.dossierValue}>
                  Unsponsored breach. Keep extracted cargo. Operations still progress.
                </TerminalText>
              </DossierSection>
              <DossierSection label="COMPENSATION">
                <TerminalText size={13} style={styles.payoutPrimary}>
                  0 CR
                </TerminalText>
                <TerminalText size={8} style={[styles.payoutSecondary, { color: INDEPENDENT_ACCENT }]}>
                  +0 CABAL REP
                </TerminalText>
              </DossierSection>
              <DossierSection label="OPERATIONAL PARAMETERS">
                <TerminalText size={7} letterSpacing={0.9} style={styles.paramLabel}>
                  VALID SECTORS
                </TerminalText>
                <TerminalText size={8.5} style={styles.dossierValueTight}>
                  Unrestricted
                </TerminalText>
                <TerminalText size={7} letterSpacing={0.9} style={styles.paramLabelSpaced}>
                  FULFILLMENT
                </TerminalText>
                <TerminalText size={8.5} style={styles.dossierValueTight}>
                  None. No sponsor delivery. No reputation payout.
                </TerminalText>
              </DossierSection>
              <DossierSection label="BRIEF" last>
                <TerminalText size={8.5} style={styles.dossierValue}>
                  Black Channel route. Unverified. Unsponsored.
                </TerminalText>
              </DossierSection>
            </>
          ) : inspectedContract ? (
            <>
              <DossierSection label="OBJECTIVE">
                <TerminalText size={8.5} style={styles.dossierValue}>
                  {inspectedContract.objectiveText}
                </TerminalText>
              </DossierSection>
              <DossierSection label="COMPENSATION">
                <TerminalText size={13} style={styles.payoutPrimary}>
                  {`${inspectedContract.reward.credits} CR`}
                </TerminalText>
                <TerminalText size={8} style={[styles.payoutSecondary, { color: dossierAccent }]}>
                  {`+${inspectedContract.reward.reputation} ${sponsorDisplayName(inspectedContract.sponsorId).toUpperCase()} REP`}
                </TerminalText>
              </DossierSection>
              <DossierSection label="OPERATIONAL PARAMETERS">
                <TerminalText size={7} letterSpacing={0.9} style={styles.paramLabel}>
                  VALID SECTORS
                </TerminalText>
                <TerminalText size={8.5} style={styles.dossierValueTight}>
                  {formatCompactContractValidSectors(inspectedContract).replace(/^Valid sectors:\s*/i, '')}
                </TerminalText>
                <TerminalText size={7} letterSpacing={0.9} style={styles.paramLabelSpaced}>
                  FULFILLMENT
                </TerminalText>
                <TerminalText size={8.5} style={styles.dossierValueTight}>
                  {isResourceContractObjective(inspectedContract.objectiveKind)
                    ? 'Post-run sponsor handoff required'
                    : 'Resolved in-run'}
                </TerminalText>
                {inspectedContract.requiredDepth ? (
                  <TerminalText size={8} style={styles.dossierSecondary}>
                    {`Minimum depth ${inspectedContract.requiredDepth}`}
                  </TerminalText>
                ) : null}
              </DossierSection>
              <DossierSection label="BRIEF" last={specialConditions.length === 0}>
                <TerminalText size={8.5} style={styles.dossierValue}>
                  {SPONSOR_IDENTITY[inspectedContract.sponsorId].sealSubline}
                </TerminalText>
              </DossierSection>
              {specialConditions.length > 0 ? (
                <DossierSection label="SPECIAL CONDITIONS" last>
                  <TerminalText size={8.5} style={styles.dossierValue}>
                    {specialConditions.join(' · ')}
                  </TerminalText>
                </DossierSection>
              ) : null}
            </>
          ) : (
            <TerminalText size={8.5} style={styles.dossierValue}>
              This transmission is no longer on the board.
            </TerminalText>
          )}
        </ScrollView>

        <View style={[styles.dossierFooter, compactHeight && styles.dossierFooterCompact]}>
          {inspected.kind === 'NONE' || (!inspectedContract && inspected.kind === 'SPONSOR') ? (
            <View style={[styles.actionButton, styles.actionDisabled]}>
              <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                [ SELECT A CONTRACT ]
              </TerminalText>
            </View>
          ) : inspectedIsActiveSponsor ? (
            <>
              <TerminalText size={7.5} letterSpacing={1} style={styles.footerStatusLabel}>
                ACTIVE MANDATE
              </TerminalText>
              <HapticPressable
                onPress={handleAbandon}
                accessibilityRole="button"
                accessibilityLabel="Abandon contract"
                style={({ pressed }) => ([
                  styles.actionButton,
                  styles.actionDestructive,
                  pressed && { opacity: 0.88 },
                ])}
              >
                <TerminalText size={8} letterSpacing={1} style={styles.actionDestructiveText}>
                  [ ABANDON CONTRACT ]
                </TerminalText>
              </HapticPressable>
            </>
          ) : inspectedIsActiveIndependent ? (
            <>
              <TerminalText size={7.5} letterSpacing={1} style={styles.footerStatusLabelMuted}>
                ACTIVE ROUTE
              </TerminalText>
              <View style={[styles.actionButton, styles.actionDisabled]}>
                <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                  [ ROUTE ENGAGED ]
                </TerminalText>
              </View>
            </>
          ) : inspected.kind === 'INDEPENDENT' ? (
            <>
              <TerminalText size={7.5} letterSpacing={1} style={styles.footerStatusLabel}>
                READY FOR ACCEPTANCE
              </TerminalText>
              <HapticPressable
                onPress={handleAcceptInspected}
                accessibilityRole="button"
                accessibilityLabel="Run unsponsored"
                style={({ pressed }) => ([
                  styles.actionButton,
                  styles.actionPrimary,
                  pressed && { opacity: 0.9 },
                ])}
              >
                <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                  [ RUN UNSPONSORED ]
                </TerminalText>
              </HapticPressable>
            </>
          ) : (
            <>
              <TerminalText size={7.5} letterSpacing={1} style={styles.footerStatusLabel}>
                {hasOtherActiveSponsor ? 'REPLACES ACTIVE MANDATE' : 'READY FOR ACCEPTANCE'}
              </TerminalText>
              <HapticPressable
                onPress={handleAcceptInspected}
                accessibilityRole="button"
                accessibilityLabel={hasOtherActiveSponsor ? 'Replace current contract' : 'Accept contract'}
                style={({ pressed }) => ([
                  styles.actionButton,
                  styles.actionPrimary,
                  pressed && { opacity: 0.9 },
                ])}
              >
                <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                  {hasOtherActiveSponsor ? '[ REPLACE CURRENT CONTRACT ]' : '[ ACCEPT CONTRACT ]'}
                </TerminalText>
              </HapticPressable>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#020606',
    position: 'relative',
    margin: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) clamp(440px, 27vw, 560px)',
        width: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  },
  boardNarrow: {
    ...Platform.select({
      web: {
        gridTemplateColumns: 'minmax(0, 1fr) 410px',
      } as object,
      default: {},
    }),
  },
  contractBrowser: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#020606',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
      } as object,
      default: {},
    }),
  },
  contractBoardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    minHeight: 76,
    paddingHorizontal: 28,
    paddingTop: 13,
    paddingBottom: 12,
    backgroundColor: 'rgba(3, 9, 8, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.14)',
    flexShrink: 0,
  },
  contractBoardHeaderCompact: {
    minHeight: 62,
    paddingTop: 10,
    paddingBottom: 9,
    paddingHorizontal: 22,
  },
  contractBoardHeaderEyebrow: {
    color: '#84958f',
    fontWeight: '700',
  },
  contractBoardHeaderTitle: {
    marginTop: 5,
    color: '#e0e7e4',
    fontWeight: '700',
  },
  contractBoardHeaderCounts: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  contractBoardHeaderCount: {
    color: '#879b95',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  brokerBulletin: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    minHeight: 82,
    maxHeight: 88,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 28,
    paddingRight: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(8, 18, 16, 0.72)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
    flexShrink: 0,
  },
  brokerBulletinCompact: {
    minHeight: 70,
    maxHeight: 76,
    paddingTop: 9,
    paddingBottom: 9,
  },
  brokerBulletinAccent: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 0,
    width: 2,
    backgroundColor: 'rgba(105, 200, 173, 0.55)',
  },
  brokerBulletinMain: {
    flex: 1,
    minWidth: 0,
  },
  brokerEyebrow: {
    color: '#7f928c',
    fontWeight: '700',
  },
  brokerTitle: {
    marginTop: 3,
    color: '#d5dfdc',
    fontWeight: '700',
  },
  brokerDescription: {
    marginTop: 3,
    color: '#91a39f',
    lineHeight: 16,
  },
  brokerTags: {
    alignItems: 'flex-end',
    gap: 3,
    flexShrink: 0,
  },
  brokerTag: {
    color: '#879b95',
    fontWeight: '700',
  },
  sponsorChannels: {
    flexDirection: 'row',
    minHeight: 66,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.15)',
    flexShrink: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      } as object,
      default: {},
    }),
  },
  sponsorChannel: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    paddingTop: 11,
    paddingBottom: 11,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(3, 8, 7, 0.72)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(137, 170, 163, 0.11)',
    ...Platform.select({
      web: { cursor: 'pointer' } as object,
      default: {},
    }),
  },
  sponsorChannelSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.055)',
  },
  sponsorChannelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sponsorChannelName: {
    flex: 1,
    minWidth: 0,
    color: '#d5dfdc',
    fontWeight: '700',
  },
  sponsorChannelCount: {
    color: '#91a39f',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  sponsorChannelRep: {
    marginTop: 6,
    color: '#7f928c',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sponsorChannelUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: TERMINAL,
  },
  contractFeed: {
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
  contractFeedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 24,
    backgroundColor: '#020606',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
    flexShrink: 0,
  },
  contractFeedHeaderText: {
    color: '#83948f',
    fontWeight: '700',
  },
  contractFeedScrollWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  contractFeedScroll: {
    flex: 1,
  },
  feedSweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    zIndex: 2,
    backgroundColor: 'rgba(142, 223, 198, 0.3)',
  },
  emptyFeed: {
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  emptyFeedTitle: {
    color: '#c5d0cc',
    fontWeight: '700',
  },
  emptyFeedBody: {
    marginTop: 8,
    color: '#91a39f',
    lineHeight: 19,
  },
  independentSection: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122, 139, 150, 0.18)',
    backgroundColor: 'rgba(10, 14, 18, 0.55)',
  },
  independentSectionHeader: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(122, 139, 150, 0.12)',
  },
  independentSectionTitle: {
    color: INDEPENDENT_ACCENT,
    fontWeight: '700',
  },
  signal: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  signalIndependent: {
    backgroundColor: 'transparent',
  },
  signalAccent: {
    position: 'absolute',
    top: 13,
    bottom: 13,
    left: 0,
    width: 2,
    zIndex: 1,
    backgroundColor: TERMINAL,
  },
  signalSelect: {
    width: '100%',
    minHeight: 116,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 28,
    paddingRight: 24,
    gap: 22,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(350px, 1fr) minmax(220px, 0.55fr) 100px 120px',
        alignItems: 'center',
        cursor: 'pointer',
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'center',
      },
    }),
  },
  signalSelectCollapsed: {
    ...Platform.select({
      web: {
        gridTemplateColumns: 'minmax(0, 1fr) 90px 110px',
      } as object,
      default: {},
    }),
  },
  signalSelectCompact: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  signalSelectHover: {
    backgroundColor: 'rgba(105, 200, 173, 0.035)',
  },
  signalSelectSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.06)',
  },
  signalSelectSelectedIndependent: {
    backgroundColor: 'rgba(122, 139, 150, 0.07)',
  },
  signalMain: {
    minWidth: 0,
  },
  signalTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signalIssuer: {
    color: '#879b95',
    fontWeight: '700',
  },
  signalStatusActive: {
    color: TERMINAL,
    fontWeight: '700',
  },
  signalTitle: {
    marginTop: 5,
    color: '#e0e7e4',
    fontWeight: '700',
  },
  signalObjective: {
    marginTop: 5,
    color: '#a1b0ac',
    lineHeight: 18,
  },
  signalMetaCollapsed: {
    marginTop: 8,
    gap: 3,
  },
  signalMetaCol: {
    minWidth: 0,
    gap: 4,
  },
  signalMetaLine: {
    color: '#99aaa5',
    fontWeight: '600',
  },
  signalMetaMuted: {
    color: '#7f928c',
    fontWeight: '700',
  },
  signalRiskCol: {
    minWidth: 0,
  },
  signalPayoutCol: {
    minWidth: 0,
    alignItems: 'flex-start',
  },
  signalColLabel: {
    color: '#6f827c',
    fontWeight: '700',
  },
  signalRiskValue: {
    marginTop: 5,
    fontWeight: '700',
  },
  signalRiskExtreme: {
    color: '#d66f71',
  },
  signalCredits: {
    marginTop: 4,
    color: '#dce5e2',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  signalRep: {
    marginTop: 3,
    color: '#9fb0ab',
    fontVariant: ['tabular-nums'],
  },
  contractDossier: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#030707',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(137, 170, 163, 0.17)',
    flexShrink: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        backgroundImage:
          'linear-gradient(180deg, rgba(8, 19, 17, 0.52), rgba(3, 7, 7, 0) 260px), #030707',
      } as object,
      default: {
        width: 440,
      },
    }),
  },
  dossierHeader: {
    position: 'relative',
    paddingTop: 22,
    paddingBottom: 20,
    paddingLeft: 34,
    paddingRight: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.14)',
    flexShrink: 0,
  },
  dossierHeaderCompact: {
    paddingTop: 16,
    paddingBottom: 14,
  },
  dossierHeaderAccent: {
    position: 'absolute',
    top: 22,
    bottom: 20,
    left: 0,
    width: 2,
  },
  dossierEyebrow: {
    color: '#84958f',
    fontWeight: '700',
  },
  dossierIssuer: {
    marginTop: 8,
    fontWeight: '700',
  },
  dossierTitle: {
    marginTop: 12,
    color: '#e2e9e6',
    fontWeight: '700',
  },
  dossierStatus: {
    marginTop: 12,
    color: '#879b95',
    fontWeight: '700',
  },
  dossierBody: {
    flex: 1,
    minHeight: 0,
  },
  dossierBodyContent: {
    paddingTop: 22,
    paddingBottom: 28,
    paddingLeft: 34,
    paddingRight: 30,
  },
  dossierBodyContentCompact: {
    paddingTop: 16,
    paddingBottom: 18,
  },
  dossierSection: {
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  dossierSectionLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  dossierLabel: {
    color: '#7f928c',
    fontWeight: '700',
  },
  dossierValue: {
    marginTop: 7,
    color: '#d2dcd8',
    lineHeight: 20,
  },
  dossierValueTight: {
    marginTop: 5,
    color: '#d2dcd8',
    lineHeight: 19,
  },
  dossierSecondary: {
    marginTop: 6,
    color: '#90a19c',
    lineHeight: 18,
  },
  paramLabel: {
    marginTop: 8,
    color: '#6f827c',
    fontWeight: '700',
  },
  paramLabelSpaced: {
    marginTop: 14,
    color: '#6f827c',
    fontWeight: '700',
  },
  payoutPrimary: {
    marginTop: 7,
    color: '#e2e9e6',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  payoutSecondary: {
    marginTop: 4,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dossierFooter: {
    paddingTop: 16,
    paddingBottom: 22,
    paddingLeft: 34,
    paddingRight: 30,
    backgroundColor: 'rgba(3, 7, 8, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(137, 190, 179, 0.18)',
    flexShrink: 0,
  },
  dossierFooterCompact: {
    paddingTop: 12,
    paddingBottom: 14,
  },
  footerStatusLabel: {
    marginBottom: 10,
    color: TERMINAL,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerStatusLabelMuted: {
    marginBottom: 10,
    color: '#879b95',
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButton: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' } as object,
      default: {},
    }),
  },
  actionPrimary: {
    backgroundColor: TERMINAL,
    borderWidth: 1,
    borderColor: TERMINAL_BRIGHT,
  },
  actionPrimaryText: {
    color: '#06110e',
    fontWeight: '800',
  },
  actionDestructive: {
    backgroundColor: 'rgba(201, 98, 98, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(201, 98, 98, 0.4)',
  },
  actionDestructiveText: {
    color: '#d89490',
    fontWeight: '800',
  },
  actionDisabled: {
    backgroundColor: 'rgba(112, 139, 133, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(137, 170, 163, 0.2)',
  },
  actionDisabledText: {
    color: '#7f928c',
    fontWeight: '800',
  },
});
