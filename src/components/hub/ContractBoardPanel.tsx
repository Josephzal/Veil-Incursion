import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import HubScreenShell from './HubScreenShell';
import TerminalText from '../TerminalText';
import { FACTION_DEFINITIONS } from '../../data/factions';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useWorldState } from '../../context/WorldStateContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { HUB_DATA_DIVIDER } from '../../styles/hubTerminalUi';
import type { GeneratedContract } from '../../types/contract';
import type { CabalEmployerId } from '../../types/worldState';
import {
  formatContractRewardSummary,
  sponsorDisplayName,
} from '../../utils/contractUi';
import { formatContractCargoDeliveryHints } from '../../data/cargoRoutingIntelEngine';
import { isResourceContractObjective } from '../../data/contractResolver';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

const TERRAN_ACCENT = FACTION_DEFINITIONS.TERRAN_GRID.accentColor;

function difficultyLabel(difficulty: number): string {
  return '★'.repeat(difficulty).padEnd(5, '·');
}

function ContractJobCard({
  contract,
  isSelected,
  onPress,
}: {
  contract: GeneratedContract;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTerminal();
  const { scaleSpacing, scaleFont } = useHubLayout();
  const cardPadding = scaleSpacing(16);
  const sponsorAccent = FACTION_DEFINITIONS[contract.sponsorId].accentColor;

  return (
    <HapticPressable
      onPress={onPress}
      style={(state) => [
        styles.jobCard,
        {
          borderColor: isSelected ? sponsorAccent : HUB_DATA_DIVIDER,
          backgroundColor: isSelected ? `${sponsorAccent}14` : 'rgba(15, 23, 42, 0.35)',
          padding: cardPadding,
          gap: scaleSpacing(5),
        },
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      <TerminalText size={scaleFont(6)} style={{ color: sponsorAccent, fontWeight: '700' }}>
        {sponsorDisplayName(contract.sponsorId).toUpperCase()}
      </TerminalText>
      <TerminalText size={scaleFont(7.5)} style={{ color: theme.textColor, fontWeight: '800' }}>
        {contract.title.toUpperCase()}
      </TerminalText>
      <TerminalText size={scaleFont(6.2)} style={{ color: theme.mutedColor }}>
        {contract.objectiveText}
      </TerminalText>
      <TerminalText size={scaleFont(5.8)} style={{ color: theme.textColor }}>
        {`SECTORS: ${contract.recommendedSectorIds.map((id) => id.replace('THE_', '').replace(/_/g, ' ')).join(' · ')}`}
      </TerminalText>
      {contract.requiredDepth ? (
        <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor }}>
          {`MIN DEPTH: ${contract.requiredDepth}`}
        </TerminalText>
      ) : null}
      <TerminalText size={scaleFont(5.8)} style={{ color: TERRAN_ACCENT }}>
        {formatContractRewardSummary(contract)}
      </TerminalText>
      {contract.bonusObjective ? (
        <TerminalText size={scaleFont(5.5)} style={{ color: theme.mutedColor }}>
          {`BONUS: ${contract.bonusObjective.text}`}
        </TerminalText>
      ) : null}
      {isResourceContractObjective(contract.objectiveKind) ? (
        <>
          <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(4) }}>
            POST-RUN DELIVERY
          </TerminalText>
          {formatContractCargoDeliveryHints(contract).map((line) => (
            <TerminalText key={line} size={scaleFont(5.5)} style={{ color: theme.mutedColor }}>
              {line}
            </TerminalText>
          ))}
        </>
      ) : null}
      <View style={styles.jobFooter}>
        <TerminalText size={scaleFont(5.5)} style={{ color: theme.mutedColor }}>
          {difficultyLabel(contract.difficulty)}
        </TerminalText>
        <TerminalText size={scaleFont(5.5)} style={{ color: theme.mutedColor }}>
          {contract.refreshLabel.toUpperCase()}
        </TerminalText>
      </View>
      {isSelected ? (
        <TerminalText size={scaleFont(6)} style={{ color: sponsorAccent, fontWeight: '700' }}>
          [ SELECTED CONTRACT ]
        </TerminalText>
      ) : null}
    </HapticPressable>
  );
}

function IndependentCard({
  isSelected,
  onPress,
}: {
  isSelected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTerminal();
  const { scaleSpacing, scaleFont } = useHubLayout();
  const cardPadding = scaleSpacing(16);

  return (
    <HapticPressable
      onPress={onPress}
      style={(state) => [
        styles.jobCard,
        {
          borderColor: isSelected ? TERRAN_ACCENT : HUB_DATA_DIVIDER,
          backgroundColor: isSelected ? `${TERRAN_ACCENT}14` : 'rgba(15, 23, 42, 0.35)',
          padding: cardPadding,
          gap: scaleSpacing(5),
        },
        terminalHoverStyle(readPressableHover(state), state.pressed),
      ]}
    >
      <TerminalText size={scaleFont(7.5)} style={{ color: theme.textColor, fontWeight: '800' }}>
        INDEPENDENT BREACH
      </TerminalText>
      <TerminalText size={scaleFont(6.2)} style={{ color: theme.mutedColor }}>
        No sponsor contract. Base sector rewards only. Operations still progress normally.
      </TerminalText>
      {isSelected ? (
        <TerminalText size={scaleFont(6)} style={{ color: TERRAN_ACCENT, fontWeight: '700' }}>
          [ SELECTED ]
        </TerminalText>
      ) : null}
    </HapticPressable>
  );
}

const SPONSOR_ORDER: CabalEmployerId[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

const DEFAULT_SPONSOR_FILTER: CabalEmployerId = 'TERRAN_GRID';

function resolveSponsorFilter(lastUsedSponsorId: CabalEmployerId | null | undefined): CabalEmployerId {
  return lastUsedSponsorId ?? DEFAULT_SPONSOR_FILTER;
}

function SponsorFilterRow({
  activeSponsorId,
  onSelectSponsor,
}: {
  activeSponsorId: CabalEmployerId;
  onSelectSponsor: (sponsorId: CabalEmployerId) => void;
}) {
  const { theme } = useTerminal();
  const { scaleSpacing, scaleFont } = useHubLayout();

  return (
    <View style={[styles.sponsorRow, { gap: scaleSpacing(6) }]}>
      {SPONSOR_ORDER.map((sponsorId) => {
        const isActive = activeSponsorId === sponsorId;
        const accent = FACTION_DEFINITIONS[sponsorId].accentColor;
        return (
          <HapticPressable
            key={sponsorId}
            onPress={() => onSelectSponsor(sponsorId)}
            style={(state) => [
              styles.sponsorButton,
              {
                borderColor: isActive ? accent : HUB_DATA_DIVIDER,
                backgroundColor: isActive ? `${accent}18` : 'rgba(15, 23, 42, 0.35)',
                paddingVertical: scaleSpacing(8),
                paddingHorizontal: scaleSpacing(6),
              },
              terminalHoverStyle(readPressableHover(state), state.pressed),
            ]}
          >
            <TerminalText
              size={scaleFont(6.2)}
              letterSpacing={0.4}
              style={{ color: isActive ? accent : theme.mutedColor, fontWeight: isActive ? '800' : '600' }}
            >
              {sponsorDisplayName(sponsorId).toUpperCase()}
            </TerminalText>
          </HapticPressable>
        );
      })}
    </View>
  );
}

export default function ContractBoardPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const {
    persisted,
    isHydrated,
    selectContract,
    selectIndependentContract,
    abandonSelectedContract,
  } = useWorldState();
  const { scaleSpacing } = useHubLayout();

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
  const isIndependent = selectedContract.kind === 'INDEPENDENT';
  const selectedId = selectedContract.kind === 'SPONSOR' ? selectedContract.contract.id : null;

  const handleSelectContract = (contract: GeneratedContract) => {
    setActiveSponsorId(contract.sponsorId);
    selectContract(contract);
  };

  return (
    <HubScreenShell
      title="CONTRACT BOARD"
      subtitle="SPONSOR POSTINGS // SELECT ONE CONTRACT OR BREACH INDEPENDENTLY"
      headerRight={(
        <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
          {`RUN INDEX ${persisted.deployRunIndex}`}
        </TerminalText>
      )}
      contentStyle={styles.shellBody}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { gap: scaleSpacing(10), paddingBottom: scaleSpacing(24) }]}
        showsVerticalScrollIndicator={false}
      >
        <IndependentCard
          isSelected={isIndependent}
          onPress={selectIndependentContract}
        />

        <SponsorFilterRow
          activeSponsorId={activeSponsorId}
          onSelectSponsor={setActiveSponsorId}
        />

        <View style={{ gap: scaleSpacing(8) }}>
          {visibleContracts.length > 0 ? (
            visibleContracts.map((contract) => (
              <ContractJobCard
                key={contract.id}
                contract={contract}
                isSelected={selectedId === contract.id}
                onPress={() => handleSelectContract(contract)}
              />
            ))
          ) : (
            <TerminalText size={11} style={{ color: theme.mutedColor }}>
              {`No ${sponsorDisplayName(activeSponsorId)} postings this refresh.`}
            </TerminalText>
          )}
        </View>

        {!isIndependent && selectedContract.kind === 'SPONSOR' ? (
          <HapticPressable
            onPress={abandonSelectedContract}
            style={({ pressed }) => [
              styles.abandonButton,
              {
                borderColor: theme.mutedColor,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <TerminalText variant="caption" style={{ color: theme.mutedColor, fontWeight: '700' }}>
              [ ABANDON SELECTED CONTRACT ]
            </TerminalText>
          </HapticPressable>
        ) : null}

        <View style={[styles.reputationStrip, { borderColor: theme.borderColor }]}>
          <TerminalText variant="caption" style={{ color: theme.mutedColor, marginBottom: scaleSpacing(4) }}>
            SPONSOR REPUTATION
          </TerminalText>
          {SPONSOR_ORDER.map((sponsorId) => (
            <TerminalText key={sponsorId} variant="caption" style={{ color: theme.textColor }}>
              {`${sponsorDisplayName(sponsorId).toUpperCase()}: ${account.sponsorReputation[sponsorId] ?? 0}`}
            </TerminalText>
          ))}
        </View>
      </ScrollView>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  shellBody: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  jobCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  abandonButton: {
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reputationStrip: {
    borderWidth: 1,
    padding: 12,
    gap: 4,
    backgroundColor: 'rgba(8, 13, 22, 0.5)',
  },
  sponsorRow: {
    flexDirection: 'row',
  },
  sponsorButton: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
});
