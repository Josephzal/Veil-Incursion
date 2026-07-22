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
import SignalRail from './blackMarket/SignalRail';
import {
  ContractLoggedLine,
  CONTRACT_LOGGED_MESSAGE,
  DOSSIER_STATUS_SLOT_HEIGHT,
  matchesAcceptTarget,
  useContractAcceptTypewriter,
  type ContractAcceptStampState,
} from './ContractAcceptedStamp';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { pulseHubButton } from '../../utils/hubButtonHaptics';
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
/** Shared with Black Market occult-terminal chrome. */
const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8ee0c6';
const META = '#7a8f99';
const TEXT_PRIMARY = '#c8d4cf';
const SELECTION_RAIL = '#75d4b3';

const CHANNEL_RAIL: Record<CabalEmployerId, { label: string; code: string }> = {
  TERRAN_GRID: { label: 'TERRAN CHANNEL', code: 'TG-01' },
  LEGION: { label: 'LEGION CHANNEL', code: 'LG-01' },
  SOLARIS: { label: 'SOLARIS CHANNEL', code: 'SL-01' },
};

/** Restrained channel accents — presentation only; does not alter faction data. */
const CABAL_CHANNEL: Record<CabalEmployerId, { color: string; rgb: string }> = {
  TERRAN_GRID: { color: '#69c8ad', rgb: '105, 200, 173' },
  LEGION: { color: '#9988b3', rgb: '153, 136, 179' },
  SOLARIS: { color: '#c86e72', rgb: '200, 110, 114' },
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
      <TerminalText size={7} letterSpacing={1.05} style={styles.dossierLabel}>
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
                {fulfillment}
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
  const [acceptStamp, setAcceptStamp] = useState<ContractAcceptStampState | null>(null);
  const feedSweep = useRef(new Animated.Value(0)).current;
  const dossierLock = useRef(new Animated.Value(1)).current;

  const acceptTypewriter = useContractAcceptTypewriter(acceptStamp, reduceMotion);

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
#contract-board-root [role="tab"]:focus-visible,
#contract-board-root [role="button"]:focus-visible,
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

  const playAcceptStamp = (target: ContractAcceptStampState['target']) => {
    pulseHubButton();
    setAcceptStamp({
      stampId: `accept-${Date.now()}`,
      target,
    });
  };

  const handleAcceptInspected = () => {
    if (inspected.kind === 'INDEPENDENT') {
      selectIndependentContract();
      playAcceptStamp({ kind: 'INDEPENDENT' });
      return;
    }
    if (inspectedContract) {
      selectContract(inspectedContract);
      playAcceptStamp({ kind: 'SPONSOR', contractId: inspectedContract.id });
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
      <VeilTerminalEffects intensity="subtle" scanlineOpacity={0.045} />

      <View style={styles.contractBrowser}>
        <View style={[styles.contractBoardHeader, compactHeight && styles.contractBoardHeaderCompact]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <TerminalText size={7} letterSpacing={1.05} style={styles.contractBoardHeaderEyebrow}>
              BROKER NETWORK // CB-01
            </TerminalText>
            <TerminalText size={18} letterSpacing={0.3} style={styles.contractBoardHeaderTitle}>
              CONTRACT BOARD
            </TerminalText>
            <TerminalText size={7.5} letterSpacing={1.05} style={styles.contractBoardHeaderBreadcrumb}>
              AVAILABLE MANDATES
            </TerminalText>
          </View>
          <View style={styles.contractBoardHeaderCounts}>
            <TerminalText size={6.5} letterSpacing={1} style={styles.contractBoardHeaderCountLabel}>
              BOARD STATUS
            </TerminalText>
            <View style={styles.contractBoardHeaderCountRow}>
              <TerminalText size={13} letterSpacing={0.25} style={styles.contractBoardHeaderCountValue}>
                {listedCount}
              </TerminalText>
              <TerminalText size={8} letterSpacing={0.7} style={styles.contractBoardHeaderCountMeta}>
                {` LISTED · ${activeCount} ACTIVE`}
              </TerminalText>
            </View>
          </View>
        </View>

        <SignalRail
          label={CHANNEL_RAIL[activeSponsorId].label}
          code={CHANNEL_RAIL[activeSponsorId].code}
          active
          compact={compactHeight}
        />

        <View
          style={[styles.sponsorChannels, compactHeight && styles.sponsorChannelsCompact]}
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
                  compactHeight && styles.sponsorChannelCompact,
                  selected && styles.sponsorChannelSelected,
                  pressed && { opacity: 0.9 },
                ])}
              >
                <TerminalText
                  size={9}
                  letterSpacing={1.05}
                  style={{
                    color: selected ? '#eef4f1' : '#7f928c',
                    fontWeight: '800',
                  }}
                  numberOfLines={1}
                >
                  {sponsorDisplayName(sponsorId).toUpperCase()}
                </TerminalText>
                <TerminalText size={6.5} letterSpacing={0.8} style={styles.sponsorChannelRep} numberOfLines={1}>
                  {`${count} AVAILABLE · RANK ${preview.rank}`}
                </TerminalText>
                <TerminalText size={6} letterSpacing={0.7} style={[styles.sponsorChannelCode, { color: selected ? accent.color : '#5f746f' }]}>
                  {CHANNEL_RAIL[sponsorId].code}
                </TerminalText>
                {selected ? (
                  <View
                    style={[
                      styles.sponsorChannelUnderline,
                      Platform.OS !== 'web' ? { backgroundColor: accent.color } : null,
                    ]}
                  />
                ) : null}
              </HapticPressable>
            );
          })}
          <View style={styles.sponsorChannelSpacer} />
        </View>

        <View style={[styles.brokerBulletin, compactHeight && styles.brokerBulletinCompact]}>
          <View style={styles.brokerBulletinAccent} />
          <View style={styles.brokerBulletinMain}>
            <TerminalText size={7} letterSpacing={0.9} style={styles.brokerEyebrow}>
              {`BROKER PRIORITY · ${formatSectorShort(selectedSector.id).toUpperCase()}`}
            </TerminalText>
            <TerminalText size={10} letterSpacing={0.35} style={styles.brokerTitle} numberOfLines={1}>
              {crisisPreview.crisisDisplayName.toUpperCase()}
            </TerminalText>
            <TerminalText size={7.5} style={styles.brokerDescription} numberOfLines={compactHeight ? 1 : 2}>
              {crisisPreview.crisisSummary}
            </TerminalText>
          </View>
          {crisisTags.length > 0 ? (
            <View style={styles.brokerTags}>
              {crisisTags.map((tag) => (
                <TerminalText key={tag} size={6.5} letterSpacing={0.9} style={styles.brokerTag}>
                  {tag}
                </TerminalText>
              ))}
            </View>
          ) : null}
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
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
            CONTRACT DOSSIER
          </TerminalText>
          {inspected.kind === 'NONE' ? (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: TERMINAL }]}>
                NO TRANSMISSION SELECTED
              </TerminalText>
              <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
                AWAITING SIGNAL
              </TerminalText>
            </>
          ) : inspected.kind === 'INDEPENDENT' ? (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                BLACK CHANNEL · UNVERIFIED
              </TerminalText>
              <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
                INDEPENDENT BREACH
              </TerminalText>
              <View style={styles.dossierStatusSlot}>
                {isIndependentActive || matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' }) ? (
                  <ContractLoggedLine
                    typed={
                      matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' })
                        ? acceptTypewriter.typed || CONTRACT_LOGGED_MESSAGE
                        : CONTRACT_LOGGED_MESSAGE
                    }
                    cursorOn={
                      matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' })
                      && acceptTypewriter.cursorOn
                    }
                    live={
                      matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' })
                      && acceptTypewriter.typing
                    }
                  />
                ) : (
                  <TerminalText size={7.5} letterSpacing={0.9} style={styles.dossierStatus}>
                    AVAILABLE · UNSPONSORED
                  </TerminalText>
                )}
              </View>
            </>
          ) : inspectedContract ? (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                {`${sponsorDisplayName(inspectedContract.sponsorId).toUpperCase()} · ${formatContractJobType(inspectedContract.objectiveKind)}`}
              </TerminalText>
              <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
                {inspectedContract.title.toUpperCase()}
              </TerminalText>
              <View style={styles.dossierStatusSlot}>
                {inspectedIsActiveSponsor
                || matchesAcceptTarget(acceptStamp, {
                  kind: 'SPONSOR',
                  contractId: inspectedContract.id,
                }) ? (
                  <ContractLoggedLine
                    typed={
                      matchesAcceptTarget(acceptStamp, {
                        kind: 'SPONSOR',
                        contractId: inspectedContract.id,
                      })
                        ? acceptTypewriter.typed || CONTRACT_LOGGED_MESSAGE
                        : CONTRACT_LOGGED_MESSAGE
                    }
                    cursorOn={
                      matchesAcceptTarget(acceptStamp, {
                        kind: 'SPONSOR',
                        contractId: inspectedContract.id,
                      })
                      && acceptTypewriter.cursorOn
                    }
                    live={
                      matchesAcceptTarget(acceptStamp, {
                        kind: 'SPONSOR',
                        contractId: inspectedContract.id,
                      })
                      && acceptTypewriter.typing
                    }
                  />
                ) : (
                  <TerminalText
                    size={7.5}
                    letterSpacing={0.9}
                    style={[
                      styles.dossierStatus,
                      inspectedRisk?.extreme ? { color: inspectedRisk.color } : null,
                    ]}
                  >
                    {[
                      'AVAILABLE',
                      inspectedRisk ? `${inspectedRisk.label} RISK` : null,
                    ].filter(Boolean).join(' · ')}
                  </TerminalText>
                )}
              </View>
            </>
          ) : (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                SIGNAL LOST
              </TerminalText>
              <TerminalText size={18} letterSpacing={0.2} style={styles.dossierTitle}>
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
          ) : inspectedIsActiveIndependent ? (
            <View style={[styles.actionButton, styles.actionDisabled]}>
              <TerminalText size={8} letterSpacing={1} style={styles.actionDisabledText}>
                [ ROUTE ENGAGED ]
              </TerminalText>
            </View>
          ) : inspected.kind === 'INDEPENDENT' ? (
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
          ) : (
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
    backgroundColor: '#010304',
    position: 'relative',
    margin: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) clamp(420px, 26vw, 470px)',
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
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(137, 190, 179, 0.16)',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto auto auto auto minmax(0, 1fr)',
      } as object,
      default: {},
    }),
  },
  contractBoardHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    minHeight: 72,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
    flexShrink: 0,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(180deg, rgba(4, 12, 11, 0.92), rgba(2, 6, 6, 0))',
      } as object,
      default: {
        backgroundColor: 'rgba(3, 8, 8, 0.72)',
      },
    }),
  },
  contractBoardHeaderCompact: {
    minHeight: 58,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 14,
  },
  contractBoardHeaderEyebrow: {
    color: META,
    fontWeight: '700',
    marginBottom: 4,
  },
  contractBoardHeaderTitle: {
    color: '#eef4f1',
    fontWeight: '700',
  },
  contractBoardHeaderBreadcrumb: {
    marginTop: 5,
    color: META,
    fontWeight: '700',
  },
  contractBoardHeaderCounts: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  contractBoardHeaderCountLabel: {
    color: TERMINAL,
    fontWeight: '700',
  },
  contractBoardHeaderCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 3,
  },
  contractBoardHeaderCountValue: {
    color: '#f2f7f5',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  contractBoardHeaderCountMeta: {
    color: TERMINAL,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  brokerBulletin: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    minHeight: 64,
    maxHeight: 72,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 22,
    paddingRight: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 12, 11, 0.55)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
    flexShrink: 0,
  },
  brokerBulletinCompact: {
    minHeight: 52,
    maxHeight: 56,
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 14,
    paddingRight: 14,
  },
  brokerBulletinAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: SELECTION_RAIL,
    ...Platform.select({
      web: {
        boxShadow: '0 0 10px rgba(117, 212, 179, 0.25)',
      } as object,
      default: {},
    }),
  },
  brokerBulletinMain: {
    flex: 1,
    minWidth: 0,
  },
  brokerEyebrow: {
    color: META,
    fontWeight: '700',
  },
  brokerTitle: {
    marginTop: 3,
    color: '#e8f0ed',
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
    color: META,
    fontWeight: '700',
  },
  sponsorChannels: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingBottom: 2,
    flexShrink: 0,
    gap: 8,
  },
  sponsorChannelsCompact: {
    minHeight: 50,
  },
  sponsorChannel: {
    position: 'relative',
    minWidth: 160,
    maxWidth: 220,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 12,
    backgroundColor: 'rgba(5, 12, 11, 0.4)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
      } as object,
      default: {
        flex: 1,
      },
    }),
  },
  sponsorChannelCompact: {
    minWidth: 140,
    paddingTop: 8,
    paddingBottom: 9,
  },
  sponsorChannelSelected: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(135deg, rgba(105, 200, 173, 0.08), rgba(105, 200, 173, 0.015))',
      } as object,
      default: {
        backgroundColor: 'rgba(105, 200, 173, 0.06)',
      },
    }),
  },
  sponsorChannelRep: {
    marginTop: 4,
    color: META,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sponsorChannelCode: {
    marginTop: 3,
    fontWeight: '700',
  },
  sponsorChannelUnderline: {
    position: 'absolute',
    left: 16,
    right: 15,
    bottom: 0,
    height: 2,
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, #69c8ad 0 68%, transparent 68% 73%, rgba(105, 200, 173, 0.35) 73% 100%)',
      } as object,
      default: {
        backgroundColor: TERMINAL,
      },
    }),
  },
  sponsorChannelSpacer: {
    flex: 1,
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
    minHeight: 40,
    paddingHorizontal: 22,
    backgroundColor: 'rgba(3, 8, 8, 0.55)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.12)',
    flexShrink: 0,
  },
  contractFeedHeaderText: {
    color: META,
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
    color: '#e8f0ed',
    fontWeight: '700',
  },
  emptyFeedBody: {
    marginTop: 8,
    color: TEXT_PRIMARY,
    lineHeight: 19,
  },
  independentSection: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(122, 139, 150, 0.18)',
    backgroundColor: 'rgba(6, 10, 12, 0.55)',
  },
  independentSectionHeader: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(122, 139, 150, 0.12)',
  },
  independentSectionTitle: {
    color: INDEPENDENT_ACCENT,
    fontWeight: '700',
  },
  signal: {
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  signalIndependent: {
    backgroundColor: 'transparent',
  },
  signalAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    zIndex: 1,
    backgroundColor: SELECTION_RAIL,
    ...Platform.select({
      web: {
        boxShadow: '0 0 10px rgba(117, 212, 179, 0.25)',
      } as object,
      default: {},
    }),
  },
  signalSelect: {
    width: '100%',
    minHeight: 108,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 22,
    paddingRight: 20,
    gap: 18,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1fr) minmax(200px, 0.55fr) 96px 112px',
        alignItems: 'center',
        cursor: 'pointer',
        outlineStyle: 'none',
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
    minHeight: 92,
    paddingTop: 11,
    paddingBottom: 11,
  },
  signalSelectHover: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(128, 153, 149, 0.08), rgba(128, 153, 149, 0.02))',
      } as object,
      default: {
        backgroundColor: 'rgba(128, 153, 149, 0.05)',
      },
    }),
  },
  signalSelectSelected: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(105, 200, 173, 0.1), rgba(105, 200, 173, 0.02))',
      } as object,
      default: {
        backgroundColor: 'rgba(105, 200, 173, 0.06)',
      },
    }),
  },
  signalSelectSelectedIndependent: {
    ...Platform.select({
      web: {
        backgroundImage:
          'linear-gradient(90deg, rgba(122, 139, 150, 0.12), rgba(122, 139, 150, 0.02))',
      } as object,
      default: {
        backgroundColor: 'rgba(122, 139, 150, 0.07)',
      },
    }),
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
    color: META,
    fontWeight: '700',
  },
  signalStatusActive: {
    color: TERMINAL_BRIGHT,
    fontWeight: '700',
  },
  signalTitle: {
    marginTop: 5,
    color: '#f1f6f3',
    fontWeight: '700',
  },
  signalObjective: {
    marginTop: 5,
    color: TEXT_PRIMARY,
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
    color: META,
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
    color: '#5f746f',
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
    color: '#e2e9e6',
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
    backgroundColor: '#040a09',
    flexShrink: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        backgroundImage:
          'linear-gradient(180deg, #07110f 0%, #020606 42%)',
      } as object,
      default: {
        width: 420,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: 'rgba(137, 190, 179, 0.16)',
      },
    }),
  },
  dossierHeader: {
    position: 'relative',
    paddingTop: 20,
    paddingBottom: 18,
    paddingLeft: 28,
    paddingRight: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.14)',
    flexShrink: 0,
  },
  dossierHeaderCompact: {
    paddingTop: 14,
    paddingBottom: 12,
  },
  dossierHeaderAccent: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 0,
    width: 2,
  },
  dossierEyebrow: {
    color: META,
    fontWeight: '700',
  },
  dossierIssuer: {
    marginTop: 8,
    fontWeight: '700',
  },
  dossierTitle: {
    marginTop: 10,
    color: '#f3f8f5',
    fontWeight: '700',
  },
  dossierStatusSlot: {
    marginTop: 10,
    height: DOSSIER_STATUS_SLOT_HEIGHT,
    minHeight: DOSSIER_STATUS_SLOT_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dossierStatus: {
    color: META,
    fontWeight: '700',
  },
  dossierBody: {
    flex: 1,
    minHeight: 0,
  },
  dossierBodyContent: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingLeft: 28,
    paddingRight: 24,
  },
  dossierBodyContentCompact: {
    paddingTop: 14,
    paddingBottom: 16,
  },
  dossierSection: {
    paddingBottom: 18,
    marginBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  dossierSectionLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  dossierLabel: {
    color: META,
    fontWeight: '700',
  },
  dossierValue: {
    marginTop: 7,
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
  dossierValueTight: {
    marginTop: 5,
    color: TEXT_PRIMARY,
    lineHeight: 19,
  },
  dossierSecondary: {
    marginTop: 6,
    color: '#90a19c',
    lineHeight: 18,
  },
  paramLabel: {
    marginTop: 8,
    color: '#5f746f',
    fontWeight: '700',
  },
  paramLabelSpaced: {
    marginTop: 14,
    color: '#5f746f',
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
    paddingTop: 14,
    paddingBottom: 18,
    paddingLeft: 28,
    paddingRight: 24,
    backgroundColor: 'rgba(2, 6, 6, 0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(137, 190, 179, 0.2)',
    flexShrink: 0,
  },
  dossierFooterCompact: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  actionButton: {
    width: '100%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
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
    backgroundColor: 'rgba(200, 110, 114, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(200, 110, 114, 0.42)',
  },
  actionDestructiveText: {
    color: '#d89490',
    fontWeight: '800',
  },
  actionDisabled: {
    backgroundColor: 'rgba(105, 200, 173, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.18)',
  },
  actionDisabledText: {
    color: 'rgba(188, 204, 198, 0.34)',
    fontWeight: '800',
  },
});
