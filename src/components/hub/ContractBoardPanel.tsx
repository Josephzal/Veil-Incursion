import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import VeilTerminalEffects from '../atmosphere/VeilTerminalEffects';
import {
  ContractLoggedLine,
  CONTRACT_LOGGED_MESSAGE,
  DossierAvailabilityLine,
  DOSSIER_STATUS_SLOT_HEIGHT,
  matchesAcceptTarget,
  useContractAcceptTypewriter,
  type ContractAcceptStampState,
} from './ContractAcceptedStamp';
import {
  CabalMark,
  ContainmentFragment,
  LiveStatus,
  OccultInterference,
} from './veilChrome';
import {
  CabalDossierMark,
  CabalReputationSummary,
  ContractProvision,
  ContractSpecialCondition,
  ContractTermsStrip,
  DossierLedger,
} from './dossier';
import BrokerPriorityBulletin from './BrokerPriorityBulletin';
import ContractGroupHeader from './ContractGroupHeader';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { pulseHubButton } from '../../utils/hubButtonHaptics';
import { useWorldState } from '../../context/WorldStateContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import type { GeneratedContract } from '../../types/contract';
import type { CabalEmployerId } from '../../types/worldState';
import {
  formatContractCargoLedger,
  formatContractDepthLedger,
  formatContractFulfillmentDetailed,
  formatContractIssuerCategory,
  formatContractRiskTier,
  formatContractRowMetaLine,
  formatContractSectorEligibilityDetailed,
  formatMechanicalObjective,
  resolveContractProvisions,
  resolveSpecialConditionFields,
  sponsorDisplayName,
} from '../../utils/contractUi';
import { describeEmployerPerks } from '../../utils/employerContractUi';
import { getCabalReputationProgress } from '../../data/cabalRepEngine';
import { getActiveAnchorInstance } from '../../data/anchorLifecycleEngine';
import { buildPreliminaryRunWorldContext } from '../../data/runWorldBriefEngine';
import { SPONSOR_IDENTITY } from '../../utils/sponsorIdentity';
import {
  resolveCabalTone,
  VEIL,
  VEIL_BLACK_CHANNEL_TONE,
  VEIL_CHANNEL_CODES,
} from '../../theme/veilTerminalTokens';

const SPONSOR_ORDER: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const DEFAULT_SPONSOR_FILTER: CabalEmployerId = 'TERRAN_GRID';
/** Secondary functional text — ~12% brighter than VEIL.textMuted. */
const META = '#8A9690';
const TEXT_PRIMARY = '#C4CBC6';
const TEXT_SECONDARY = '#8A9690';
/** Fixed dossier title band (2 lines @ 23lh) so status / body anchors stay stable. */
const DOSSIER_TITLE_LINE_HEIGHT = 23;
const DOSSIER_TITLE_LINES = 2;
/** Objective band reserves ~3 lines; longer copy still grows the section. */
const DOSSIER_OBJECTIVE_LINE_HEIGHT = 13.5;
const DOSSIER_OBJECTIVE_MIN_LINES = 3;

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
  if (base.label === 'EXTREME') return { label: 'EXTREME', color: VEIL.riskExtreme, extreme: true };
  if (base.label === 'HIGH RISK') return { label: 'HIGH', color: VEIL.riskHigh, extreme: false };
  if (base.label === 'MED RISK') return { label: 'MEDIUM', color: VEIL.riskMedium, extreme: false };
  return { label: 'LOW', color: VEIL.riskLow, extreme: false };
}

function padTelemetry(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
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
  variant = 'open',
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
  variant?: 'open' | 'brief';
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.dossierSection,
        last && styles.dossierSectionLast,
      ]}
    >
      <View style={styles.dossierLabelRow}>
        {variant === 'open' ? <View style={styles.dossierBoneRule} /> : null}
        <TerminalText size={7} letterSpacing={1.05} style={styles.dossierLabel}>
          {label}
        </TerminalText>
      </View>
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
  reduceMotion,
}: {
  contract: GeneratedContract;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  compact: boolean;
  reduceMotion: boolean;
}): React.JSX.Element {
  const risk = riskPresentation(contract.difficulty);
  const tone = resolveCabalTone(contract.sponsorId);
  const metaLine = formatContractRowMetaLine(contract);

  return (
    <View
      style={[styles.signal, selected && styles.signalSelectedShell]}
      {...(Platform.OS === 'web'
        ? ({
            'data-selected': selected ? 'true' : 'false',
            'data-active': active ? 'true' : 'false',
          } as object)
        : null)}
    >
      <View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={[
          styles.signalIdentityMark,
          selected && { backgroundColor: tone.accent },
        ]}
      />
      {selected ? (
        <OccultInterference active reduceMotion={reduceMotion} color={`rgba(${tone.rgb}, 1)`} />
      ) : null}
      <HapticPressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Inspect ${contract.title}`}
        style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => ([
          styles.signalSelect,
          compact && styles.signalSelectCompact,
          selected && [
            styles.signalSelectSelected,
            Platform.OS === 'web'
              ? ({
                  backgroundImage:
                    `linear-gradient(90deg, rgba(${tone.rgb}, 0.1), rgba(${tone.rgb}, 0.03) 55%, rgba(4, 5, 5, 0))`,
                } as object)
              : { backgroundColor: tone.accentSoft },
          ],
          ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
          focused && !selected ? styles.signalSelectFocused : null,
          pressed && { opacity: 0.94 },
        ])}
      >
        <View style={styles.signalMain}>
          <View style={styles.signalTopline}>
            <TerminalText
              size={7}
              letterSpacing={0.9}
              style={[styles.signalIssuer, selected && { color: tone.accent }]}
              numberOfLines={1}
            >
              {formatContractIssuerCategory(contract)}
            </TerminalText>
            {active ? (
              <View style={styles.activeBadge}>
                <LiveStatus label="ACTIVE" size={6} />
              </View>
            ) : null}
          </View>
          <TerminalText
            size={11}
            letterSpacing={0.3}
            style={[styles.signalTitle, selected && styles.signalTitleSelected]}
            numberOfLines={1}
          >
            {contract.title.toUpperCase()}
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.45} style={styles.signalMetaLine} numberOfLines={1}>
            {metaLine}
          </TerminalText>
        </View>

        <View style={styles.signalRiskCol}>
          <TerminalText size={6.5} letterSpacing={0.85} style={styles.signalRiskLabel}>
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
          <TerminalText size={11} style={[styles.signalCredits, selected && styles.signalCreditsSelected]}>
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
  reduceMotion,
}: {
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  compact: boolean;
  reduceMotion: boolean;
}): React.JSX.Element {
  const tone = VEIL_BLACK_CHANNEL_TONE;
  return (
    <View
      style={[styles.signal, styles.signalIndependent, selected && styles.signalSelectedShell]}
      {...(Platform.OS === 'web'
        ? ({
            'data-selected': selected ? 'true' : 'false',
            'data-active': active ? 'true' : 'false',
          } as object)
        : null)}
    >
      <View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={[
          styles.signalIdentityMark,
          styles.signalIdentityMarkCorrupt,
          selected && { backgroundColor: tone.accent },
        ]}
      />
      {selected ? (
        <OccultInterference active reduceMotion={reduceMotion} color={`rgba(${tone.rgb}, 1)`} />
      ) : null}
      <HapticPressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel="Inspect Independent Breach"
        style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => ([
          styles.signalSelect,
          compact && styles.signalSelectCompact,
          selected && [
            styles.signalSelectSelectedIndependent,
            Platform.OS === 'web'
              ? ({
                  backgroundImage:
                    `linear-gradient(90deg, rgba(${tone.rgb}, 0.1), rgba(${tone.rgb}, 0.03) 55%, rgba(4, 5, 5, 0))`,
                } as object)
              : { backgroundColor: tone.accentSoft },
          ],
          ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
          focused && !selected ? styles.signalSelectFocused : null,
          pressed && { opacity: 0.94 },
        ])}
      >
        <View style={styles.signalMain}>
          <View style={styles.signalTopline}>
            <TerminalText size={7} letterSpacing={0.9} style={styles.signalIssuerIndependent} numberOfLines={1}>
              INDEPENDENT ROUTE // UNVERIFIED
            </TerminalText>
            {active ? (
              <View style={styles.activeBadge}>
                <LiveStatus label="ACTIVE" size={6} />
              </View>
            ) : null}
          </View>
          <TerminalText
            size={11}
            letterSpacing={0.3}
            style={[styles.signalTitle, selected && styles.signalTitleSelected]}
            numberOfLines={1}
          >
            INDEPENDENT BREACH
          </TerminalText>
          <TerminalText size={7.5} letterSpacing={0.45} style={styles.signalMetaLine} numberOfLines={1}>
            ANY SECTOR · UNSPONSORED · IN-RUN
          </TerminalText>
        </View>

        <View style={styles.signalRiskCol}>
          <TerminalText size={6.5} letterSpacing={0.85} style={styles.signalRiskLabel}>
            RISK
          </TerminalText>
          <TerminalText size={8} letterSpacing={0.7} style={[styles.signalRiskValue, { color: tone.accent }]}>
            UNVERIFIED
          </TerminalText>
        </View>

        <View style={styles.signalPayoutCol}>
          <TerminalText size={9} style={[styles.signalCredits, { color: TEXT_PRIMARY }]}>
            NO FIXED
          </TerminalText>
          <TerminalText size={7.5} style={styles.signalRep}>
            NO CABAL REP
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
  const { scaleSpacing, scaleFont } = useHubLayout();
  const dossierTitleSlotHeight = scaleFont(DOSSIER_TITLE_LINE_HEIGHT) * DOSSIER_TITLE_LINES;
  const dossierObjectiveSlotMinHeight =
    scaleFont(DOSSIER_OBJECTIVE_LINE_HEIGHT) * DOSSIER_OBJECTIVE_MIN_LINES;
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
  const dossierFooterRef = useRef<View>(null);
  const [dossierFooterHeight, setDossierFooterHeight] = useState(96);

  const acceptTypewriter = useContractAcceptTypewriter(acceptStamp, reduceMotion);

  useEffect(() => {
    if (!isHydrated) return;
    setActiveSponsorId(resolveSponsorFilter(lastUsedSponsorId));
  }, [isHydrated, lastUsedSponsorId]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const styleId = 'contract-board-focus-styles-v4';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
#contract-board-root [role="tab"]:focus-visible,
#contract-board-root [role="button"]:focus-visible,
#contract-board-root button:focus-visible {
  outline: 2px solid ${VEIL.focus} !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}
#contract-board-root [role="tab"],
#contract-board-root [role="button"] {
  transition: background-color 180ms ease, border-color 180ms ease, opacity 140ms ease;
}
@media (prefers-reduced-motion: reduce) {
  #contract-board-root [role="tab"],
  #contract-board-root [role="button"] {
    transition: none !important;
  }
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
  /** Visible cabal rows + always-listed Black Channel independent route. */
  const displayedRecordCount = visibleContracts.length + 1;
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
  const inspectedContract = useMemo(() => {
    if (inspected.kind !== 'SPONSOR') return null;
    return contracts.find((c) => c.id === inspected.contractId) ?? null;
  }, [contracts, inspected]);

  const dossierTone = inspected.kind === 'INDEPENDENT'
    ? VEIL_BLACK_CHANNEL_TONE
    : inspectedContract
      ? resolveCabalTone(inspectedContract.sponsorId)
      : resolveCabalTone(activeSponsorId);
  const dossierAccent = dossierTone.accent;
  const activeChannelTone = resolveCabalTone(activeSponsorId);

  const compactHeight = screenHeight <= 800;
  const narrowLayout = screenWidth < 1500;

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
    dossierLock.setValue(0.9);
    Animated.timing(dossierLock, {
      toValue: 1,
      duration: 190,
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

  const runProvisions = inspectedContract
    ? resolveContractProvisions(describeEmployerPerks(inspectedContract.sponsorId))
    : [];
  const specialConditionData = inspectedContract
    ? resolveSpecialConditionFields(inspectedContract)
    : { fields: [] as const, fallbackText: null };

  const selectedCabalProgress = useMemo(
    () => getCabalReputationProgress(account.progressionProfile, activeSponsorId),
    [account.progressionProfile, activeSponsorId],
  );

  const dossierSealChannel = inspected.kind === 'INDEPENDENT'
    ? 'BLACK_CHANNEL' as const
    : inspectedContract?.sponsorId ?? activeSponsorId;

  const dossierSettleKey = inspected.kind === 'INDEPENDENT'
    ? 'independent'
    : inspectedContract?.id ?? `channel-${activeSponsorId}`;

  const sponsorLedgerRows = useMemo(() => {
    if (!inspectedContract) return [];
    // Stable ledger anchors: always the same four rows; values may be em-dash.
    // Sector text still grows the VALID SECTORS row naturally.
    return [
      {
        label: 'VALID SECTORS',
        value: formatContractSectorEligibilityDetailed(inspectedContract),
      },
      {
        label: 'FULFILLMENT',
        value: formatContractFulfillmentDetailed(inspectedContract),
      },
      {
        label: 'CARGO',
        value: formatContractCargoLedger(inspectedContract) ?? '—',
      },
      {
        label: 'MINIMUM DEPTH',
        value: formatContractDepthLedger(inspectedContract) ?? '—',
      },
    ];
  }, [inspectedContract]);

  const inspectedRisk = inspectedContract
    ? riskPresentation(inspectedContract.difficulty)
    : { label: '—', color: VEIL.textDim, extreme: false };

  const handleDossierFooterLayout = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    if (next > 0 && next !== dossierFooterHeight) {
      setDossierFooterHeight(next);
    }
  };

  const dossierBodyPaddingBottom = dossierFooterHeight + (compactHeight ? 24 : 28);

  return (
    <View
      style={[styles.board, narrowLayout && styles.boardNarrow]}
      {...(Platform.OS === 'web' ? ({ id: 'contract-board-root', nativeID: 'contract-board-root' } as object) : null)}
    >
      <VeilTerminalEffects intensity="subtle" scanlineOpacity={0.03} />
      <View
        pointerEvents="none"
        accessible={false}
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
        style={styles.boardWash}
      />

      <View style={styles.contractBrowser}>
        <View style={[styles.contractBoardHeader, compactHeight && styles.contractBoardHeaderCompact]}>
          <ContainmentFragment variant="ring" align="right" size={96} opacity={0.028} color={VEIL.bone} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.headerEyebrowRow}>
              <View style={styles.headerBoneMark} />
              <TerminalText size={6.5} letterSpacing={1.05} style={styles.contractBoardHeaderEyebrow}>
                BROKER NETWORK // CB-01
              </TerminalText>
            </View>
            <TerminalText size={22} letterSpacing={0.15} style={styles.contractBoardHeaderTitle}>
              CONTRACT BOARD
            </TerminalText>
            <TerminalText size={7} letterSpacing={1} style={styles.contractBoardHeaderBreadcrumb}>
              AVAILABLE MANDATES
            </TerminalText>
          </View>
        </View>

        <View
          style={[styles.sponsorChannels, compactHeight && styles.sponsorChannelsCompact]}
          accessibilityRole="tablist"
          {...(Platform.OS === 'web' ? ({ 'aria-label': 'Contract issuers' } as object) : {})}
        >
          {SPONSOR_ORDER.map((sponsorId) => {
            const selected = activeSponsorId === sponsorId;
            const tone = resolveCabalTone(sponsorId);
            const count = jobCountBySponsor[sponsorId];
            const rankProgress = getCabalReputationProgress(account.progressionProfile, sponsorId);
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
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                  styles.sponsorChannel,
                  compactHeight && styles.sponsorChannelCompact,
                  selected && styles.sponsorChannelSelected,
                  ((hovered || pressed) && !selected) ? styles.sponsorChannelHover : null,
                  pressed && { opacity: 0.92 },
                ])}
              >
                <View
                  pointerEvents="none"
                  accessible={false}
                  {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
                  style={[
                    styles.sponsorChannelEdge,
                    { backgroundColor: selected ? tone.accent : VEIL.lineFaint },
                  ]}
                />
                {selected ? (
                  <View
                    pointerEvents="none"
                    accessible={false}
                    {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
                    style={[styles.sponsorSelectStamp, { borderColor: tone.accent }]}
                  />
                ) : null}
                {sponsorId === 'SOLARIS' ? (
                  <View
                    pointerEvents="none"
                    accessible={false}
                    {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
                    style={[
                      styles.sponsorSolarisArc,
                      { borderColor: selected ? tone.accent : VEIL.line },
                    ]}
                  />
                ) : null}
                <View style={styles.sponsorChannelTop}>
                  <CabalMark tone={tone} selected={selected} size="sm" />
                  <TerminalText
                    size={9}
                    letterSpacing={1}
                    style={{
                      color: selected ? VEIL.text : TEXT_SECONDARY,
                      fontWeight: '800',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {sponsorDisplayName(sponsorId).toUpperCase()}
                  </TerminalText>
                  <TerminalText
                    size={6}
                    letterSpacing={0.7}
                    style={{ color: selected ? tone.accent : TEXT_SECONDARY, fontWeight: '700' }}
                  >
                    {VEIL_CHANNEL_CODES[sponsorId].code}
                  </TerminalText>
                </View>
                <TerminalText size={6.5} letterSpacing={0.8} style={styles.sponsorChannelRep} numberOfLines={1}>
                  {`${count} AVAILABLE · RANK ${rankProgress.rank}`}
                </TerminalText>
              </HapticPressable>
            );
          })}
        </View>

        <View style={styles.feedSummaryRow}>
          <View style={styles.feedSummaryRep}>
            <CabalReputationSummary
              progress={selectedCabalProgress}
              tone={activeChannelTone}
            />
          </View>
          <View style={styles.feedSummaryBroker}>
            <BrokerPriorityBulletin
              sectorLabel={formatSectorShort(selectedSector.id).toUpperCase()}
              headline={crisisPreview.crisisDisplayName.toUpperCase()}
              description={crisisPreview.crisisSummary}
              classification={crisisTags[0] ?? null}
              compact={compactHeight}
            />
          </View>
        </View>

        <View style={styles.contractFeed}>
          <View style={styles.cabalGroupHeaderWrap}>
            <ContractGroupHeader
              primaryLabel={sponsorDisplayName(activeSponsorId).toUpperCase()}
              secondaryLabel="AVAILABLE CONTRACTS"
              meta={`${visibleContracts.length} AVAILABLE`}
              tone={activeChannelTone}
              variant="cabal"
            />
          </View>
          <View style={styles.contractFeedScrollWrap}>
            {!reduceMotion ? (
              <Animated.View pointerEvents="none" style={[styles.feedSweep, feedSweepStyle]} />
            ) : null}
            <ScrollView
              style={styles.contractFeedScroll}
              contentContainerStyle={[
                styles.contractFeedScrollContent,
                { paddingBottom: scaleSpacing(16) },
              ]}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'web'
                ? ({
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(185, 181, 167, 0.22) transparent',
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
                    reduceMotion={reduceMotion}
                  />
                ))
              )}

              <View style={styles.independentSection}>
                <ContractGroupHeader
                  primaryLabel="BLACK CHANNEL"
                  secondaryLabel="INDEPENDENT ROUTES"
                  meta="1 ROUTE // UNVERIFIED"
                  tone={VEIL_BLACK_CHANNEL_TONE}
                  variant="blackChannel"
                />
                <IndependentSignalRow
                  selected={inspected.kind === 'INDEPENDENT'}
                  active={isIndependentActive}
                  onSelect={handleInspectIndependent}
                  compact={compactHeight}
                  reduceMotion={reduceMotion}
                />
              </View>

              <View
                style={styles.feedTerminator}
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
              >
                <View style={styles.feedTerminatorMark} />
                <TerminalText size={6.5} letterSpacing={0.85} style={styles.feedTerminatorText}>
                  {`END OF AVAILABLE RECORDS // ${padTelemetry(displayedRecordCount)} DISPLAYED`}
                </TerminalText>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.contractDossier,
          { opacity: dossierLock },
          Platform.OS === 'web' ? ({
            boxShadow: '-8px 0 18px rgba(0, 0, 0, 0.35)',
          } as object) : null,
        ]}
      >
        <CabalDossierMark
          channel={dossierSealChannel}
          settleKey={dossierSettleKey}
          reduceMotion={reduceMotion}
        />
        <View style={[styles.dossierHeader, compactHeight && styles.dossierHeaderCompact]}>
          <View style={[styles.dossierHeaderAccent, { backgroundColor: dossierAccent }]} />
          <TerminalText size={7} letterSpacing={1.05} style={styles.dossierEyebrow}>
            CONTRACT DOSSIER
          </TerminalText>
          {inspected.kind === 'NONE' ? (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: VEIL.bone }]}>
                NO TRANSMISSION SELECTED
              </TerminalText>
              <View style={[styles.dossierTitleSlot, { minHeight: dossierTitleSlotHeight }]}>
                <TerminalText
                  size={19}
                  lineHeight={DOSSIER_TITLE_LINE_HEIGHT}
                  letterSpacing={0.1}
                  style={styles.dossierTitle}
                  numberOfLines={DOSSIER_TITLE_LINES}
                >
                  AWAITING SIGNAL
                </TerminalText>
              </View>
              <View style={styles.dossierStatusSlot} />
            </>
          ) : inspected.kind === 'INDEPENDENT' ? (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                BLACK CHANNEL · UNVERIFIED
              </TerminalText>
              <View style={[styles.dossierTitleSlot, { minHeight: dossierTitleSlotHeight }]}>
                <TerminalText
                  size={19}
                  lineHeight={DOSSIER_TITLE_LINE_HEIGHT}
                  letterSpacing={0.1}
                  style={styles.dossierTitle}
                  numberOfLines={DOSSIER_TITLE_LINES}
                >
                  INDEPENDENT BREACH
                </TerminalText>
              </View>
              <View style={styles.dossierStatusSlot}>
                {isIndependentActive || matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' }) ? (
                  <ContractLoggedLine
                    typed={
                      matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' })
                        ? acceptTypewriter.typed || CONTRACT_LOGGED_MESSAGE
                        : CONTRACT_LOGGED_MESSAGE
                    }
                    live={
                      matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' })
                      && acceptTypewriter.typing
                    }
                    cursorOn={
                      matchesAcceptTarget(acceptStamp, { kind: 'INDEPENDENT' })
                      && acceptTypewriter.cursorOn
                    }
                  />
                ) : (
                  <DossierAvailabilityLine />
                )}
              </View>
            </>
          ) : inspectedContract ? (
            <>
              <TerminalText
                size={7.5}
                letterSpacing={0.85}
                style={[styles.dossierIssuer, { color: dossierAccent }]}
                numberOfLines={1}
              >
                {formatContractIssuerCategory(inspectedContract)}
              </TerminalText>
              <View style={[styles.dossierTitleSlot, { minHeight: dossierTitleSlotHeight }]}>
                <TerminalText
                  size={19}
                  lineHeight={DOSSIER_TITLE_LINE_HEIGHT}
                  letterSpacing={0.1}
                  style={styles.dossierTitle}
                  numberOfLines={DOSSIER_TITLE_LINES}
                >
                  {inspectedContract.title.toUpperCase()}
                </TerminalText>
              </View>
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
                    live={
                      matchesAcceptTarget(acceptStamp, {
                        kind: 'SPONSOR',
                        contractId: inspectedContract.id,
                      })
                      && acceptTypewriter.typing
                    }
                    cursorOn={
                      matchesAcceptTarget(acceptStamp, {
                        kind: 'SPONSOR',
                        contractId: inspectedContract.id,
                      })
                      && acceptTypewriter.cursorOn
                    }
                  />
                ) : (
                  <DossierAvailabilityLine />
                )}
              </View>
            </>
          ) : (
            <>
              <TerminalText size={7.5} letterSpacing={0.85} style={[styles.dossierIssuer, { color: dossierAccent }]}>
                SIGNAL LOST
              </TerminalText>
              <View style={[styles.dossierTitleSlot, { minHeight: dossierTitleSlotHeight }]}>
                <TerminalText
                  size={19}
                  lineHeight={DOSSIER_TITLE_LINE_HEIGHT}
                  letterSpacing={0.1}
                  style={styles.dossierTitle}
                  numberOfLines={DOSSIER_TITLE_LINES}
                >
                  TRANSMISSION UNAVAILABLE
                </TerminalText>
              </View>
              <View style={styles.dossierStatusSlot} />
            </>
          )}
        </View>

        <ScrollView
          style={styles.dossierBody}
          contentContainerStyle={[
            styles.dossierBodyContent,
            compactHeight && styles.dossierBodyContentCompact,
            { paddingBottom: dossierBodyPaddingBottom },
          ]}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web'
            ? ({
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(185, 181, 167, 0.2) transparent',
              } as object)
            : null)}
        >
          {inspected.kind === 'NONE' ? (
            <TerminalText size={8.5} style={styles.dossierValue}>
              Select a mandate from the broker feed.
            </TerminalText>
          ) : inspected.kind === 'INDEPENDENT' ? (
            <>
              <DossierSection label="OBJECTIVE" variant="open">
                <View style={[styles.dossierObjectiveSlot, { minHeight: dossierObjectiveSlotMinHeight }]}>
                  <TerminalText
                    size={8.5}
                    lineHeight={DOSSIER_OBJECTIVE_LINE_HEIGHT}
                    letterSpacing={0.12}
                    style={styles.dossierValue}
                  >
                    Complete an unsponsored breach. Keep extracted cargo. Operations still progress.
                  </TerminalText>
                </View>
              </DossierSection>
              <ContractTermsStrip
                riskLabel="UNVERIFIED"
                riskColor={VEIL_BLACK_CHANNEL_TONE.accent}
                paymentLabel="NO FIXED PAYOUT"
                paymentHeading="IN-RUN GAINS"
                reputationLabel="NO CABAL REP"
                reputationHeading="REPUTATION"
                reputationColor={VEIL_BLACK_CHANNEL_TONE.accent}
              />
              <DossierLedger
                rows={[
                  { label: 'VALID SECTORS', value: 'Any sector' },
                  { label: 'FULFILLMENT', value: 'No sponsor delivery. No reputation payout.' },
                  { label: 'CARGO', value: '—' },
                  { label: 'MINIMUM DEPTH', value: '—' },
                ]}
              />
              <DossierSection label="BRIEF" variant="brief" last>
                <TerminalText size={8.5} lineHeight={13.5} letterSpacing={0.12} style={styles.dossierBrief}>
                  Black Channel route. Unverified. Unsponsored.
                </TerminalText>
              </DossierSection>
              <View style={styles.dossierBodyTail} />
            </>
          ) : inspectedContract ? (
            <>
              <DossierSection label="OBJECTIVE" variant="open">
                <View style={[styles.dossierObjectiveSlot, { minHeight: dossierObjectiveSlotMinHeight }]}>
                  <TerminalText
                    size={8.5}
                    lineHeight={DOSSIER_OBJECTIVE_LINE_HEIGHT}
                    letterSpacing={0.12}
                    style={styles.dossierValue}
                  >
                    {formatMechanicalObjective(inspectedContract)}
                  </TerminalText>
                </View>
              </DossierSection>
              <ContractTermsStrip
                riskLabel={inspectedRisk.label}
                riskColor={inspectedRisk.color}
                paymentLabel={`${inspectedContract.reward.credits} CR`}
                reputationLabel={`+${inspectedContract.reward.reputation} ${sponsorDisplayName(inspectedContract.sponsorId).toUpperCase()}`}
                reputationColor={dossierAccent}
              />
              <DossierLedger rows={sponsorLedgerRows} />
              <DossierSection
                label="BRIEF"
                variant="brief"
                last={runProvisions.length === 0 && specialConditionData.fields.length === 0}
              >
                <TerminalText size={8.5} lineHeight={13.5} letterSpacing={0.12} style={styles.dossierBrief}>
                  {SPONSOR_IDENTITY[inspectedContract.sponsorId].sealSubline}
                </TerminalText>
              </DossierSection>
              <ContractProvision benefits={runProvisions} />
              <ContractSpecialCondition
                fields={specialConditionData.fields}
                fallbackText={specialConditionData.fallbackText}
              />
              <View style={styles.dossierBodyTail} />
            </>
          ) : (
            <TerminalText size={8.5} style={styles.dossierValue}>
              This transmission is no longer on the board.
            </TerminalText>
          )}
        </ScrollView>

        <View
          ref={dossierFooterRef}
          onLayout={handleDossierFooterLayout}
          style={[styles.dossierFooter, compactHeight && styles.dossierFooterCompact]}
        >
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
              accessibilityLabel="Abandon"
              style={({
                pressed,
                hovered,
                focused,
              }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => ([
                styles.actionButton,
                styles.actionDestructive,
                (hovered || pressed) && styles.actionDestructiveHover,
                focused && styles.actionFocusVisible,
                pressed && { opacity: 0.9 },
              ])}
            >
              <TerminalText size={7.5} letterSpacing={0.95} style={styles.actionDestructiveText}>
                [ ABANDON ]
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
              accessibilityLabel="Accept"
              style={({ pressed }) => ([
                styles.actionButton,
                styles.actionPrimary,
                pressed && { opacity: 0.9 },
              ])}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                [ ACCEPT ]
              </TerminalText>
            </HapticPressable>
          ) : (
            <HapticPressable
              onPress={handleAcceptInspected}
              accessibilityRole="button"
              accessibilityLabel={hasOtherActiveSponsor ? 'Replace' : 'Accept'}
              style={({ pressed }) => ([
                styles.actionButton,
                styles.actionPrimary,
                pressed && { opacity: 0.9 },
              ])}
            >
              <TerminalText size={8} letterSpacing={1} style={styles.actionPrimaryText}>
                {hasOtherActiveSponsor ? '[ REPLACE ]' : '[ ACCEPT ]'}
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
    maxWidth: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: VEIL.bg,
    position: 'relative',
    margin: 0,
    ...Platform.select({
      web: {
        display: 'grid',
        // ~68/32 at wide desktop; dossier floors at 360px for usable wrapping.
        gridTemplateColumns: 'minmax(0, 2.1fr) minmax(360px, 1fr)',
        width: '100%',
        maxWidth: '100%',
        height: '100%',
      } as object,
      default: {},
    }),
  },
  boardWash: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    ...Platform.select({
      web: {
        backgroundImage:
          'radial-gradient(ellipse at 30% 12%, rgba(185, 181, 167, 0.02), transparent 40%), radial-gradient(ellipse at 78% 72%, rgba(140, 115, 159, 0.015), transparent 46%)',
      } as object,
      default: {},
    }),
  },
  boardNarrow: {
    ...Platform.select({
      web: {
        gridTemplateColumns: 'minmax(0, 2fr) minmax(340px, 1fr)',
      } as object,
      default: {},
    }),
  },
  contractBrowser: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: VEIL.bgSoft,
    zIndex: 1,
        // Top-pack: header → tabs → reputation+broker → feed (only feed grows).
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
        alignContent: 'start',
      } as object,
      default: {
        flexDirection: 'column',
        alignItems: 'stretch',
      },
    }),
  },
  feedSummaryRow: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 18,
    marginHorizontal: 14,
    marginBottom: 0,
    paddingTop: 6,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VEIL.lineFaint,
    minHeight: 0,
  },
  feedSummaryRep: {
    flex: 0.95,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: VEIL.lineFaint,
  },
  feedSummaryBroker: {
    flex: 1.35,
    minWidth: 0,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  contractBoardHeader: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    minHeight: 92,
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 14,
    flexShrink: 0,
    overflow: 'hidden',
  },
  contractBoardHeaderCompact: {
    minHeight: 74,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
  },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerBoneMark: {
    width: 8,
    height: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VEIL.bone,
    opacity: 0.45,
  },
  contractBoardHeaderEyebrow: {
    color: VEIL.textDim,
    fontWeight: '700',
  },
  contractBoardHeaderTitle: {
    color: VEIL.text,
    fontWeight: '700',
  },
  contractBoardHeaderBreadcrumb: {
    marginTop: 5,
    color: VEIL.textDim,
    fontWeight: '700',
  },
  sponsorChannels: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 60,
    paddingHorizontal: 14,
    paddingBottom: 6,
    flexGrow: 0,
    flexShrink: 0,
    gap: 10,
  },
  sponsorChannelsCompact: {
    minHeight: 52,
  },
  sponsorChannel: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 11,
    backgroundColor: VEIL.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VEIL.lineFaint,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outlineStyle: 'none',
      } as object,
      default: {},
    }),
  },
  sponsorChannelCompact: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  sponsorChannelSelected: {
    backgroundColor: VEIL.surface3,
    borderColor: VEIL.line,
  },
  sponsorChannelHover: {
    backgroundColor: VEIL.surface2,
  },
  sponsorChannelEdge: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 2,
  },
  sponsorSelectStamp: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 9,
    height: 9,
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  sponsorSolarisArc: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    opacity: 0.55,
  },
  sponsorChannelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sponsorChannelRep: {
    marginTop: 6,
    marginLeft: 18,
    color: TEXT_SECONDARY,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  contractFeed: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: VEIL.bgSoft,
    // 16–20px after reputation + broker summary row.
    marginTop: 20,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        alignContent: 'start',
      } as object,
      default: {
        flexDirection: 'column',
      },
    }),
  },
  cabalGroupHeaderWrap: {
    flexGrow: 0,
    flexShrink: 0,
    // 8–12px between group divider and first selectable contract.
    marginBottom: 12,
  },
  contractFeedScrollWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  contractFeedScroll: {
    flex: 1,
  },
  contractFeedScrollContent: {
    flexGrow: 0,
    justifyContent: 'flex-start',
  },
  feedSweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    zIndex: 2,
    backgroundColor: 'rgba(185, 181, 167, 0.18)',
  },
  emptyFeed: {
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  emptyFeedTitle: {
    color: VEIL.text,
    fontWeight: '700',
  },
  emptyFeedBody: {
    marginTop: 8,
    color: TEXT_PRIMARY,
    lineHeight: 19,
  },
  independentSection: {
    // 16–20px above Black Channel group header.
    marginTop: 20,
    // 8–12px between Black Channel divider and its first record.
    gap: 12,
  },
  feedTerminator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    marginBottom: 8,
    paddingHorizontal: 18,
  },
  feedTerminatorMark: {
    width: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: VEIL.line,
    opacity: 0.55,
  },
  feedTerminatorText: {
    color: 'rgba(154, 150, 140, 0.68)',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  signal: {
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: VEIL.lineFaint,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transitionProperty: 'background-color',
        transitionDuration: '120ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {},
    }),
  },
  signalSelectedShell: {
    backgroundColor: VEIL.surface3,
  },
  signalIndependent: {
    backgroundColor: 'transparent',
  },
  signalIdentityMark: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    left: 0,
    width: 2,
    zIndex: 2,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        transitionProperty: 'background-color',
        transitionDuration: '120ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {},
    }),
  },
  signalIdentityMarkCorrupt: {
    top: 18,
    bottom: 10,
  },
  signalSelect: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: 90,
    minHeight: 90,
    maxHeight: 90,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 18,
    paddingRight: 18,
    gap: 14,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 100px 130px',
        alignItems: 'center',
        cursor: 'pointer',
        outlineStyle: 'none',
        transitionProperty: 'background-color, background-image',
        transitionDuration: '120ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'center',
      },
    }),
  },
  signalSelectCompact: {
    height: 82,
    minHeight: 82,
    maxHeight: 82,
    paddingTop: 12,
    paddingBottom: 12,
  },
  signalSelectHover: {
    backgroundColor: VEIL.surface1,
  },
  signalSelectFocused: {
    ...Platform.select({
      web: {
        outlineStyle: 'solid',
        outlineWidth: 1,
        outlineColor: VEIL.mint,
        outlineOffset: -1,
      } as object,
      default: {},
    }),
  },
  signalSelectSelected: {},
  signalSelectSelectedIndependent: {},
  signalMain: {
    minWidth: 0,
    overflow: 'hidden',
  },
  signalTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    flexShrink: 0,
    marginLeft: 6,
  },
  signalIssuer: {
    // Quieter than ContractGroupHeader category labels.
    color: 'rgba(138, 150, 144, 0.72)',
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '72%',
  },
  signalIssuerIndependent: {
    color: 'rgba(159, 89, 99, 0.62)',
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: '78%',
  },
  signalTitle: {
    marginTop: 5,
    color: VEIL.text,
    fontWeight: '700',
  },
  signalTitleSelected: {
    color: '#F0F2EF',
  },
  signalMetaLine: {
    marginTop: 5,
    color: META,
    fontWeight: '600',
  },
  signalRiskCol: {
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  signalPayoutCol: {
    minWidth: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  signalRiskLabel: {
    color: TEXT_SECONDARY,
    fontWeight: '700',
  },
  signalRiskValue: {
    fontWeight: '700',
  },
  signalRiskExtreme: {
    color: VEIL.riskExtreme,
  },
  signalCredits: {
    color: VEIL.textSoft,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  signalCreditsSelected: {
    color: VEIL.text,
  },
  signalRep: {
    marginTop: 3,
    color: META,
    fontVariant: ['tabular-nums'],
  },
  contractDossier: {
    position: 'relative',
    minWidth: 0,
    minHeight: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: VEIL.surfaceRaised,
    flexShrink: 1,
    zIndex: 2,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        backgroundImage: `linear-gradient(180deg, ${VEIL.surface3} 0%, ${VEIL.bg} 58%)`,
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
        borderLeftWidth: 1,
        borderLeftColor: VEIL.line,
      } as object,
      default: {
        width: 420,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: VEIL.line,
      },
    }),
  },
  dossierHeader: {
    position: 'relative',
    zIndex: 1,
    paddingTop: 20,
    paddingBottom: 14,
    paddingLeft: 26,
    paddingRight: 22,
    flexShrink: 0,
    overflow: 'hidden',
  },
  dossierHeaderCompact: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  dossierHeaderAccent: {
    position: 'absolute',
    top: 18,
    height: 42,
    left: 0,
    width: 2,
  },
  dossierEyebrow: {
    color: VEIL.textDim,
    fontWeight: '700',
    marginBottom: 8,
  },
  dossierIssuer: {
    marginTop: 2,
    fontWeight: '700',
    minHeight: 16,
  },
  dossierTitleSlot: {
    marginTop: 8,
    // minHeight applied at runtime via scaleFont so desktop type scale stays aligned.
    justifyContent: 'flex-start',
  },
  dossierTitle: {
    color: '#F2F4F1',
    fontWeight: '700',
  },
  dossierStatusSlot: {
    marginTop: 14,
    height: DOSSIER_STATUS_SLOT_HEIGHT,
    minHeight: DOSSIER_STATUS_SLOT_HEIGHT,
    maxHeight: DOSSIER_STATUS_SLOT_HEIGHT,
    justifyContent: 'center',
    overflow: 'visible',
    alignSelf: 'flex-start',
    width: '50%',
    maxWidth: '50%',
  },
  dossierBody: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minHeight: 0,
  },
  dossierBodyContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: 6,
    // Overridden at runtime with measured footer height + breathing room.
    paddingBottom: 120,
    paddingLeft: 26,
    paddingRight: 22,
  },
  dossierBodyContentCompact: {
    paddingTop: 4,
  },
  /** Absorbs leftover dossier height so short records are not stretched. */
  dossierBodyTail: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 0,
  },
  dossierSection: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 14,
    marginBottom: 2,
  },
  dossierSectionLast: {
    marginBottom: 0,
    paddingBottom: 0,
  },
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
  dossierLabel: {
    color: 'rgba(185, 181, 167, 0.84)',
    fontWeight: '700',
  },
  dossierObjectiveSlot: {
    marginTop: 6,
    // minHeight applied at runtime via scaleFont.
  },
  dossierValue: {
    color: VEIL.text,
  },
  dossierBrief: {
    marginTop: 6,
    color: TEXT_PRIMARY,
  },
  dossierFooter: {
    position: 'relative',
    zIndex: 2,
    paddingTop: 12,
    paddingBottom: 14,
    paddingLeft: 22,
    paddingRight: 20,
    backgroundColor: VEIL.surface1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VEIL.line,
    flexShrink: 0,
    ...Platform.select({
      web: {
        boxShadow: '0 -8px 18px rgba(0, 0, 0, 0.28)',
      } as object,
      default: {},
    }),
  },
  dossierFooterCompact: {
    paddingTop: 10,
    paddingBottom: 12,
  },
  actionButton: {
    width: '100%',
    minHeight: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  actionPrimary: {
    backgroundColor: VEIL.surface3,
    borderWidth: 1,
    borderColor: VEIL.mint,
  },
  actionPrimaryText: {
    color: VEIL.mintBright,
    fontWeight: '800',
  },
  actionDestructive: {
    minHeight: 48,
    height: 48,
    backgroundColor: 'rgba(8, 6, 7, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(163, 92, 102, 0.34)',
  },
  actionDestructiveHover: {
    backgroundColor: 'rgba(20, 10, 12, 0.96)',
    borderColor: 'rgba(163, 92, 102, 0.55)',
  },
  actionDestructiveText: {
    color: '#B8898F',
    fontWeight: '700',
  },
  actionFocusVisible: {
    ...Platform.select({
      web: {
        outlineStyle: 'solid',
        outlineWidth: 1,
        outlineColor: VEIL.mint,
        outlineOffset: 2,
      } as object,
      default: {
        borderColor: VEIL.mint,
      },
    }),
  },
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
