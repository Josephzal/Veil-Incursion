import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import HapticPressable from '../HapticPressable';
import HubScreenShell from './HubScreenShell';
import HubCommandBar from './HubCommandBar';
import TerminalText from '../TerminalText';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useWorldState } from '../../context/WorldStateContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { useTerminalNavOptional } from '../../context/TerminalNavContext';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import {
  BONE_WHITE,
  CARD_BLACK,
  CARD_BLACK_HOVER,
  DANGER_RED,
  DOSSIER_BORDER,
  DOSSIER_ROW_BG,
  SELECT_ACCENT,
} from '../../constants/dossierSurface';
import { LoadoutSectionHeader } from './loadoutTabUi';
import type { GeneratedContract, SelectedContractState } from '../../types/contract';
import type { CabalEmployerId } from '../../types/worldState';
import {
  formatContractContextTag,
  formatContractJobType,
  formatContractRiskTier,
  sponsorDisplayName,
} from '../../utils/contractUi';
import { describeEmployerPerks, employerSponsorLabel } from '../../utils/employerContractUi';
import { formatContractCargoDeliveryHints } from '../../data/cargoRoutingIntelEngine';
import { isResourceContractObjective } from '../../data/contractResolver';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';
import { buildSponsorReputationPreview } from '../../data/runIntegration/sponsorRepEngine';
import { getActiveAnchorInstance } from '../../data/anchorLifecycleEngine';
import { buildPreliminaryRunWorldContext } from '../../data/runWorldBriefEngine';
import { SPONSOR_IDENTITY } from '../../utils/sponsorIdentity';

const SPONSOR_ORDER: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];
const DEFAULT_SPONSOR_FILTER: CabalEmployerId = 'TERRAN_GRID';
const INDEPENDENT_ACCENT = '#64748b';

function resolveSponsorFilter(lastUsedSponsorId: CabalEmployerId | null | undefined): CabalEmployerId {
  return lastUsedSponsorId ?? DEFAULT_SPONSOR_FILTER;
}

function formatSectorShort(id: string): string {
  return id.replace('THE_', '').replace(/_/g, ' ');
}

function sponsorStandingLabel(rank: number): string {
  if (rank <= 0) return 'Neutral';
  if (rank <= 2) return 'Recognized';
  if (rank <= 4) return 'Trusted';
  return 'Favored';
}

function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

/** Faint scanline + grid backdrop so the empty black gets vibe without hurting readability. */
function BoardBackdrop(): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="cbGrid" width={44} height={44} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={0} x2={44} y2={0} stroke="rgba(100,116,139,0.06)" strokeWidth={0.5} />
            <Line x1={0} y1={0} x2={0} y2={44} stroke="rgba(100,116,139,0.06)" strokeWidth={0.5} />
          </Pattern>
          <Pattern id="cbScan" width={3} height={4} patternUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={3} height={1} fill="rgba(148,163,184,0.05)" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cbGrid)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cbScan)" />
      </Svg>
    </View>
  );
}

const CHIP_TEXT = '#9aa6b2';

/** Charcoal chip on a black dossier. `color` sets the text (and border when `strong`). */
function Chip({
  label,
  color,
  strong,
  size,
}: {
  label: string;
  color?: string;
  strong?: boolean;
  size: number;
}): React.JSX.Element {
  const textColor = color ?? CHIP_TEXT;
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: strong ? withAlpha(textColor, '99') : HUB_DATA_DIVIDER,
          backgroundColor: DOSSIER_ROW_BG,
        },
      ]}
    >
      <TerminalText size={size} letterSpacing={0.4} style={{ color: textColor, fontWeight: '700' }}>
        {label}
      </TerminalText>
    </View>
  );
}

function StatRow({
  label,
  value,
  valueColor,
  labelColor,
  size,
}: {
  label: string;
  value: string;
  valueColor: string;
  labelColor: string;
  size: number;
}): React.JSX.Element {
  return (
    <View style={styles.statRow}>
      <TerminalText size={size} letterSpacing={0.5} style={{ color: labelColor, fontWeight: '700', width: 78 }}>
        {label}
      </TerminalText>
      <TerminalText size={size} style={{ color: valueColor, flex: 1 }}>
        {value}
      </TerminalText>
    </View>
  );
}

function ContractDossierCard({
  contract,
  isSelected,
  onAccept,
  onAbandon,
}: {
  contract: GeneratedContract;
  isSelected: boolean;
  onAccept: () => void;
  onAbandon: () => void;
}): React.JSX.Element {
  const { theme } = useTerminal();
  const { scaleSpacing, scaleFont } = useHubLayout();
  const [expanded, setExpanded] = useState(false);
  const accent = FACTION_DEFINITIONS[contract.sponsorId].accentColor;
  const identity = SPONSOR_IDENTITY[contract.sponsorId];
  const risk = formatContractRiskTier(contract.difficulty);
  const jobType = formatContractJobType(contract.objectiveKind);
  const isResource = isResourceContractObjective(contract.objectiveKind);
  const contextTag = formatContractContextTag(contract);
  const primarySector = contract.recommendedSectorIds[0]
    ? formatSectorShort(contract.recommendedSectorIds[0])
    : null;

  const stampAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  useEffect(() => {
    if (isSelected) {
      stampAnim.setValue(0);
      Animated.spring(stampAnim, {
        toValue: 1,
        friction: 5,
        tension: 150,
        useNativeDriver: true,
      }).start();
    } else {
      stampAnim.setValue(0);
    }
  }, [isSelected, stampAnim]);

  const rewardValue = (() => {
    const parts = [`${contract.reward.credits} CR`, `+${contract.reward.reputation} REP`];
    if (contract.reward.rareLootBonusPct) parts.push(`+${contract.reward.rareLootBonusPct}% RARE`);
    return parts.join('   ');
  })();

  return (
    <View
      style={[
        styles.dossierCard,
        {
          borderColor: isSelected ? SELECT_ACCENT : DOSSIER_BORDER,
          borderLeftColor: isSelected ? SELECT_ACCENT : accent,
          borderWidth: isSelected ? 1.5 : 1,
          backgroundColor: isSelected ? CARD_BLACK_HOVER : CARD_BLACK,
          padding: scaleSpacing(12),
          gap: scaleSpacing(5),
        },
      ]}
    >
      {isSelected ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.seal,
            {
              borderColor: accent,
              opacity: stampAnim,
              transform: [
                { rotate: '-11deg' },
                { scale: stampAnim.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] }) },
              ],
            },
          ]}
        >
          <TerminalText size={scaleFont(5.6)} letterSpacing={1} style={{ color: accent, fontWeight: '800' }}>
            {identity.sealLabel}
          </TerminalText>
        </Animated.View>
      ) : null}

      <View style={styles.dossierHeader}>
        <TerminalText size={scaleFont(6)} letterSpacing={0.6} style={{ color: accent, fontWeight: '800' }}>
          {`${identity.emblem}  ${sponsorDisplayName(contract.sponsorId).toUpperCase()}`}
        </TerminalText>
        <TerminalText size={scaleFont(5.2)} letterSpacing={0.5} style={{ color: theme.mutedColor, fontWeight: '700' }}>
          {isSelected ? identity.sealLabel : 'REFRESHES AFTER RUN'}
        </TerminalText>
      </View>

      <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
        {`${employerSponsorLabel(contract.sponsorId)}${primarySector ? ` / ${primarySector}` : ''}`}
      </TerminalText>

      <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800' }}>
        {contract.title.toUpperCase()}
      </TerminalText>

      <TerminalText size={scaleFont(6)} numberOfLines={2} style={{ color: theme.mutedColor }}>
        {contract.objectiveText}
      </TerminalText>

      <View style={styles.chipRow}>
        <Chip label={jobType} size={scaleFont(5)} />
        <Chip label={risk.label} color={risk.color} strong size={scaleFont(5)} />
        {primarySector ? <Chip label={primarySector.toUpperCase()} size={scaleFont(5)} /> : null}
        {isResource ? <Chip label="POST-RUN DELIVERY" size={scaleFont(5)} /> : null}
        {contract.reward.reputation > 0 ? <Chip label="BETRAYABLE" color={DANGER_RED} strong size={scaleFont(5)} /> : null}
      </View>

      <View style={[styles.statBlock, { borderTopColor: HUB_DATA_DIVIDER }]}>
        <StatRow
          label="REWARD"
          value={rewardValue}
          valueColor={BONE_WHITE}
          labelColor={theme.mutedColor}
          size={scaleFont(5.6)}
        />
        {primarySector ? (
          <StatRow
            label="ROUTE"
            value={contract.recommendedSectorIds.map((id) => formatSectorShort(id)).join(' · ')}
            valueColor={theme.textColor}
            labelColor={theme.mutedColor}
            size={scaleFont(5.6)}
          />
        ) : null}
        {contract.requiredDepth ? (
          <StatRow
            label="MIN DEPTH"
            value={`Depth ${contract.requiredDepth}`}
            valueColor={theme.textColor}
            labelColor={theme.mutedColor}
            size={scaleFont(5.6)}
          />
        ) : null}
        <StatRow
          label="DELIVERY"
          value={isResource ? 'Post-run sponsor handoff required' : 'Resolved in-run'}
          valueColor={theme.textColor}
          labelColor={theme.mutedColor}
          size={scaleFont(5.6)}
        />
        {contextTag ? (
          <StatRow
            label="CONTEXT"
            value={contextTag}
            valueColor={theme.textColor}
            labelColor={theme.mutedColor}
            size={scaleFont(5.6)}
          />
        ) : null}
      </View>

      {expanded ? (
        <View style={[styles.detailBlock, { borderTopColor: HUB_DATA_DIVIDER }]}>
          {contract.bonusObjective ? (
            <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
              {`BONUS: ${contract.bonusObjective.text}`}
            </TerminalText>
          ) : null}
          {isResource
            ? formatContractCargoDeliveryHints(contract).map((line) => (
                <TerminalText key={line} size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
                  {line}
                </TerminalText>
              ))
            : null}
          <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
            {`SPONSOR TERMS: ${describeEmployerPerks(contract.sponsorId).join(' · ')}`}
          </TerminalText>
          <TerminalText size={scaleFont(5.4)} style={{ color: DANGER_RED }}>
            Betrayal: keep/sell the cargo elsewhere, but forfeit sponsor reputation.
          </TerminalText>
        </View>
      ) : null}

      {isSelected ? (
        <TerminalText size={scaleFont(5.4)} style={{ color: accent }}>
          {identity.sealSubline}
        </TerminalText>
      ) : null}

      <View style={styles.actionRow}>
        {isSelected ? (
          <>
            <View style={[styles.actionButton, styles.actionAccepted, { borderColor: SELECT_ACCENT, backgroundColor: withAlpha(SELECT_ACCENT, '1f') }]}>
              <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
                [ CONTRACT ACCEPTED ]
              </TerminalText>
            </View>
            <HapticPressable
              onPress={onAbandon}
              style={(state) => [
                styles.actionButton,
                { borderColor: DOSSIER_BORDER, backgroundColor: DOSSIER_ROW_BG },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                [ ABANDON ]
              </TerminalText>
            </HapticPressable>
          </>
        ) : (
          <>
            <HapticPressable
              onPress={onAccept}
              style={(state) => [
                styles.actionButton,
                styles.actionPrimary,
                { borderColor: SELECT_ACCENT, backgroundColor: withAlpha(SELECT_ACCENT, '14') },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
                [ ACCEPT CONTRACT ]
              </TerminalText>
            </HapticPressable>
            <HapticPressable
              onPress={() => setExpanded((prev) => !prev)}
              style={(state) => [
                styles.actionButton,
                { borderColor: DOSSIER_BORDER, backgroundColor: DOSSIER_ROW_BG },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                {expanded ? '[ HIDE ]' : '[ DETAILS ]'}
              </TerminalText>
            </HapticPressable>
          </>
        )}
      </View>
    </View>
  );
}

function IndependentBreachCard({
  isSelected,
  onPress,
}: {
  isSelected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { theme } = useTerminal();
  const { scaleSpacing, scaleFont } = useHubLayout();

  return (
    <View
      style={[
        styles.independentCard,
        {
          borderColor: isSelected ? SELECT_ACCENT : DOSSIER_BORDER,
          borderLeftColor: isSelected ? SELECT_ACCENT : INDEPENDENT_ACCENT,
          backgroundColor: isSelected ? CARD_BLACK_HOVER : CARD_BLACK,
          padding: scaleSpacing(12),
          gap: scaleSpacing(5),
        },
      ]}
    >
      <View style={styles.dossierHeader}>
        <TerminalText size={scaleFont(6)} letterSpacing={0.8} style={{ color: INDEPENDENT_ACCENT, fontWeight: '800' }}>
          ⌁ BLACK CHANNEL
        </TerminalText>
        <TerminalText size={scaleFont(5.2)} letterSpacing={0.5} style={{ color: theme.mutedColor, fontWeight: '700' }}>
          UNVERIFIED ROUTE
        </TerminalText>
      </View>

      <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800' }}>
        INDEPENDENT BREACH
      </TerminalText>
      <TerminalText size={scaleFont(6)} style={{ color: theme.mutedColor }}>
        No sponsor. No leash. No guaranteed payout.
      </TerminalText>

      <View style={styles.chipRow}>
        <Chip label="NO REP" size={scaleFont(5)} />
        <Chip label="KEEP YOUR CARGO" size={scaleFont(5)} />
        <Chip label="OPS PROGRESS" size={scaleFont(5)} />
      </View>

      <View style={{ gap: scaleSpacing(2) }}>
        <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
          • You keep everything you extract — no delivery obligations.
        </TerminalText>
        <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
          • Operations still progress normally.
        </TerminalText>
        <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
          • No sponsor reputation, no safety net.
        </TerminalText>
      </View>

      <View style={styles.actionRow}>
        {isSelected ? (
          <View style={[styles.actionButton, styles.actionPrimary, { borderColor: SELECT_ACCENT, backgroundColor: withAlpha(SELECT_ACCENT, '1f') }]}>
            <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
              [ UNSPONSORED — ACTIVE ]
            </TerminalText>
          </View>
        ) : (
          <HapticPressable
            onPress={onPress}
            style={(state) => [
              styles.actionButton,
              styles.actionPrimary,
              { borderColor: SELECT_ACCENT, backgroundColor: withAlpha(SELECT_ACCENT, '14') },
              terminalHoverStyle(readPressableHover(state), state.pressed),
            ]}
          >
            <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
              [ RUN UNSPONSORED ]
            </TerminalText>
          </HapticPressable>
        )}
      </View>
    </View>
  );
}

function SponsorIdentityCard({
  sponsorId,
  isActive,
  jobCount,
  onPress,
}: {
  sponsorId: CabalEmployerId;
  isActive: boolean;
  jobCount: number;
  onPress: () => void;
}): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing, scaleFont } = useHubLayout();
  const accent = FACTION_DEFINITIONS[sponsorId].accentColor;
  const identity = SPONSOR_IDENTITY[sponsorId];
  const rep = account.sponsorReputation[sponsorId] ?? 0;
  const preview = buildSponsorReputationPreview(sponsorId, rep);

  return (
    <HapticPressable
      onPress={onPress}
      style={(state) => [
        styles.sponsorCard,
        {
          borderColor: isActive ? SELECT_ACCENT : DOSSIER_BORDER,
          borderLeftColor: isActive ? SELECT_ACCENT : accent,
          backgroundColor: isActive ? CARD_BLACK_HOVER : CARD_BLACK,
          padding: scaleSpacing(8),
          gap: scaleSpacing(3),
        },
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      <View style={styles.sponsorCardHeader}>
        <TerminalText size={scaleFont(8)} style={{ color: accent }}>
          {identity.emblem}
        </TerminalText>
        <TerminalText size={scaleFont(4.6)} letterSpacing={0.4} style={{ color: isActive ? SELECT_ACCENT : theme.mutedColor, fontWeight: '700' }}>
          {`${jobCount} ${jobCount === 1 ? 'JOB' : 'JOBS'}`}
        </TerminalText>
      </View>
      <TerminalText size={scaleFont(6.6)} letterSpacing={0.6} style={{ color: isActive ? SELECT_ACCENT : theme.textColor, fontWeight: '800' }}>
        {sponsorDisplayName(sponsorId).toUpperCase()}
      </TerminalText>
      <TerminalText size={scaleFont(5)} numberOfLines={2} style={{ color: theme.mutedColor }}>
        {identity.descriptor}
      </TerminalText>
      <TerminalText size={scaleFont(4.8)} letterSpacing={0.5} style={{ color: theme.mutedColor, fontWeight: '700' }}>
        {`REP ${preview.reputation}   RANK ${preview.rank}   NEXT ${preview.progressToNext}`}
      </TerminalText>
    </HapticPressable>
  );
}

function CurrentRouteCard({
  selectedContract,
}: {
  selectedContract: SelectedContractState;
}): React.JSX.Element {
  const { theme } = useTerminal();
  const { scaleSpacing, scaleFont } = useHubLayout();

  if (selectedContract.kind === 'INDEPENDENT') {
    return (
      <View style={[styles.routeCard, { padding: scaleSpacing(12), gap: scaleSpacing(4) }]}>
        <TerminalText size={scaleFont(7.5)} style={{ color: theme.textColor, fontWeight: '800' }}>
          Independent Breach
        </TerminalText>
        <View style={[styles.statBlock, { borderTopColor: HUB_DATA_DIVIDER }]}>
          <StatRow label="SPONSOR" value="None" valueColor={theme.textColor} labelColor={theme.mutedColor} size={scaleFont(5.6)} />
          <StatRow label="OBLIGATION" value="None" valueColor={theme.textColor} labelColor={theme.mutedColor} size={scaleFont(5.6)} />
          <StatRow label="CARGO" value="Keep everything you extract" valueColor={theme.textColor} labelColor={theme.mutedColor} size={scaleFont(5.6)} />
          <StatRow label="OPS" value="Progress enabled" valueColor={theme.textColor} labelColor={theme.mutedColor} size={scaleFont(5.6)} />
        </View>
      </View>
    );
  }

  const contract = selectedContract.contract;
  const accent = FACTION_DEFINITIONS[contract.sponsorId].accentColor;
  const identity = SPONSOR_IDENTITY[contract.sponsorId];
  const isResource = isResourceContractObjective(contract.objectiveKind);
  const rewardValue = `${contract.reward.credits} CR   +${contract.reward.reputation} REP`;

  return (
    <View style={[styles.routeCard, { padding: scaleSpacing(12), gap: scaleSpacing(4) }]}>
      <TerminalText size={scaleFont(5.4)} letterSpacing={0.5} style={{ color: accent, fontWeight: '700' }}>
        {`${identity.emblem}  ${sponsorDisplayName(contract.sponsorId).toUpperCase()}`}
      </TerminalText>
      <TerminalText size={scaleFont(7.5)} style={{ color: theme.textColor, fontWeight: '800' }}>
        {contract.title}
      </TerminalText>
      <View style={[styles.statBlock, { borderTopColor: HUB_DATA_DIVIDER }]}>
        <StatRow label="REWARD" value={rewardValue} valueColor={BONE_WHITE} labelColor={theme.mutedColor} size={scaleFont(5.6)} />
        <StatRow
          label="DELIVERY"
          value={isResource ? 'Post-run handoff required' : 'Resolved in-run'}
          valueColor={theme.textColor}
          labelColor={theme.mutedColor}
          size={scaleFont(5.6)}
        />
        <StatRow label="RISK" value="Betrayable" valueColor={DANGER_RED} labelColor={theme.mutedColor} size={scaleFont(5.6)} />
      </View>
    </View>
  );
}

function SponsorLedger(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing, scaleFont } = useHubLayout();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.ledger, { borderColor: HUB_DATA_DIVIDER, padding: scaleSpacing(12), gap: scaleSpacing(6) }]}>
      <HapticPressable
        onPress={() => setOpen((prev) => !prev)}
        style={(state) => [styles.ledgerHeader, terminalHoverStyle(readPressableHover(state), state.pressed)]}
      >
        <TerminalText size={scaleFont(5.8)} letterSpacing={0.8} style={{ color: theme.mutedColor, fontWeight: '800' }}>
          SPONSOR LEDGER
        </TerminalText>
        <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, fontWeight: '800' }}>
          {open ? '−' : '+'}
        </TerminalText>
      </HapticPressable>
      {open
        ? SPONSOR_ORDER.map((sponsorId) => {
            const rep = account.sponsorReputation[sponsorId] ?? 0;
            const preview = buildSponsorReputationPreview(sponsorId, rep);
            const accent = FACTION_DEFINITIONS[sponsorId].accentColor;
            return (
              <View key={sponsorId} style={styles.ledgerRow}>
                <TerminalText size={scaleFont(5.4)} style={{ color: accent, fontWeight: '700', flex: 1.3 }}>
                  {sponsorDisplayName(sponsorId)}
                </TerminalText>
                <TerminalText size={scaleFont(5.4)} style={{ color: theme.textColor, flex: 1 }}>
                  {`Rank ${preview.rank}`}
                </TerminalText>
                <TerminalText size={scaleFont(5.4)} style={{ color: theme.textColor, flex: 1 }}>
                  {`${preview.progressInRank}/5 Rep`}
                </TerminalText>
                <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor, flex: 1.1, textAlign: 'right' }}>
                  {sponsorStandingLabel(preview.rank)}
                </TerminalText>
              </View>
            );
          })
        : null}
    </View>
  );
}

export default function ContractBoardPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    persisted,
    isHydrated,
    selectContract,
    selectIndependentContract,
    selectedSector,
  } = useWorldState();
  const { scaleSpacing, scaleFont, isDesktop, screenWidth } = useHubLayout();

  const { contracts, selectedContract, lastUsedSponsorId } = persisted.contractBoard;
  const [activeSponsorId, setActiveSponsorId] = useState<CabalEmployerId>(
    () => resolveSponsorFilter(lastUsedSponsorId),
  );

  useEffect(() => {
    if (!isHydrated) return;
    setActiveSponsorId(resolveSponsorFilter(lastUsedSponsorId));
  }, [isHydrated, lastUsedSponsorId]);

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

  const isIndependent = selectedContract.kind === 'INDEPENDENT';
  const selectedId = selectedContract.kind === 'SPONSOR' ? selectedContract.contract.id : null;
  const twoColumn = isDesktop && screenWidth >= 1180;

  const handleSelectContract = (contract: GeneratedContract) => {
    setActiveSponsorId(contract.sponsorId);
    selectContract(contract);
  };

  const conditionChips = useMemo(() => {
    const chips: string[] = [formatSectorShort(selectedSector.id).toUpperCase()];
    crisisPreview.threatProfile.pressureTags.slice(0, 3).forEach((tag) => {
      const upper = tag.toUpperCase();
      if (!chips.includes(upper)) chips.push(upper);
    });
    return chips.slice(0, 5);
  }, [crisisPreview, selectedSector]);

  const routeLabel = isIndependent ? 'CURRENT ROUTE' : 'CURRENT CONTRACT';

  const nav = useTerminalNavOptional();
  const commandStatus = selectedContract.kind === 'SPONSOR'
    ? `CONTRACT ACCEPTED: ${selectedContract.contract.title.toUpperCase()}`
    : 'UNSPONSORED ROUTE ACTIVE';

  const contractFeed = (
    <View style={[styles.feedColumn, twoColumn && styles.feedColumnWide, { gap: scaleSpacing(16) }]}>
      <LoadoutSectionHeader label={`${sponsorDisplayName(activeSponsorId).toUpperCase()} // CONTRACT FEED`} />
      {visibleContracts.length > 0 ? (
        visibleContracts.map((contract) => (
          <ContractDossierCard
            key={contract.id}
            contract={contract}
            isSelected={selectedId === contract.id}
            onAccept={() => handleSelectContract(contract)}
            onAbandon={selectIndependentContract}
          />
        ))
      ) : (
        <TerminalText size={scaleFont(6)} style={{ color: theme.mutedColor }}>
          {`No ${sponsorDisplayName(activeSponsorId)} postings this refresh.`}
        </TerminalText>
      )}
    </View>
  );

  const sideRail = (
    <View style={[styles.rail, { gap: scaleSpacing(16) }]}>
      <LoadoutSectionHeader label={routeLabel} />
      <CurrentRouteCard selectedContract={selectedContract} />
      <IndependentBreachCard isSelected={isIndependent} onPress={selectIndependentContract} />
      <SponsorLedger />
    </View>
  );

  return (
    <HubScreenShell
      title="CONTRACT BOARD"
      subtitle="Broker feed weighted by crisis conditions, sector resources, and sponsor demand."
      headerRight={(
        <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
          {`BROKER FEED // CYCLE ${String(persisted.deployRunIndex).padStart(2, '0')}`}
        </TerminalText>
      )}
      contentStyle={styles.shellBody}
      footer={(
        <HubCommandBar
          statusLabel={commandStatus}
          statusColor={isIndependent ? INDEPENDENT_ACCENT : SELECT_ACCENT}
          dotColor={isIndependent ? INDEPENDENT_ACCENT : SELECT_ACCENT}
          actionLabel="[ RETURN TO VEIL FRONT ]"
          onAction={nav ? () => nav.setTerminalView('MAP') : undefined}
        />
      )}
    >
      <View style={styles.root}>
        <BoardBackdrop />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { gap: scaleSpacing(10), paddingBottom: scaleSpacing(24) }]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.conditionStrip,
              { borderLeftColor: SELECT_ACCENT, padding: scaleSpacing(10), gap: scaleSpacing(3) },
            ]}
          >
            <TerminalText size={scaleFont(5.4)} letterSpacing={0.8} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
              {`${formatSectorShort(selectedSector.id).toUpperCase()} // CRISIS ACTIVE`}
            </TerminalText>
            <TerminalText size={scaleFont(8.5)} letterSpacing={0.4} style={{ color: theme.textColor, fontWeight: '800' }}>
              {crisisPreview.crisisDisplayName.toUpperCase()}
            </TerminalText>
            <TerminalText size={scaleFont(5.8)} numberOfLines={2} style={{ color: theme.mutedColor }}>
              {crisisPreview.crisisSummary}
            </TerminalText>
            <View style={styles.chipRow}>
              {conditionChips.map((chip) => (
                <Chip key={chip} label={chip} size={scaleFont(5)} />
              ))}
            </View>
          </View>

          <View style={styles.sponsorRow}>
            {SPONSOR_ORDER.map((sponsorId) => (
              <SponsorIdentityCard
                key={sponsorId}
                sponsorId={sponsorId}
                isActive={activeSponsorId === sponsorId}
                jobCount={jobCountBySponsor[sponsorId]}
                onPress={() => setActiveSponsorId(sponsorId)}
              />
            ))}
          </View>

          <View style={[styles.mainArea, twoColumn ? styles.mainAreaRow : styles.mainAreaColumn, { gap: scaleSpacing(twoColumn ? 24 : 16) }]}>
            {contractFeed}
            {twoColumn ? <View style={styles.railColumn}>{sideRail}</View> : sideRail}
          </View>
        </ScrollView>
      </View>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  shellBody: {
    flex: 1,
    minHeight: 0,
  },
  root: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  conditionStrip: {
    borderLeftWidth: 3,
    backgroundColor: CARD_BLACK,
  },
  sponsorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sponsorCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  routeCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: DOSSIER_BORDER,
    borderLeftColor: SELECT_ACCENT,
    backgroundColor: CARD_BLACK,
  },
  sponsorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainArea: {
    flex: 1,
  },
  mainAreaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainAreaColumn: {
    flexDirection: 'column',
  },
  feedColumn: {
    minWidth: 0,
    width: '100%',
  },
  feedColumnWide: {
    flex: 8,
    width: 'auto',
  },
  railColumn: {
    flex: 3,
    minWidth: 0,
  },
  rail: {
    minWidth: 0,
    width: '100%',
  },
  dossierCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  dossierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  statBlock: {
    borderTopWidth: 1,
    paddingTop: 6,
    gap: 3,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  detailBlock: {
    borderTopWidth: 1,
    paddingTop: 6,
    gap: 3,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    flexGrow: 1,
  },
  actionAccepted: {
    flexGrow: 1,
  },
  seal: {
    position: 'absolute',
    top: 14,
    right: 10,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    zIndex: 5,
  },
  independentCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderLeftWidth: 3,
  },
  ledger: {
    borderWidth: 1,
    borderColor: DOSSIER_BORDER,
    backgroundColor: CARD_BLACK,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
