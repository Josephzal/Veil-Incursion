import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import OperativeIdentityDossier from '../hub/OperativeIdentityDossier';
import TerminalText from '../TerminalText';
import { SectionFrame } from './VeilFrontUiPrimitives';
import { useHubLayout } from '../../context/HubLayoutContext';
import type { PlayerAccount } from '../../types/game';
import type { OperativeProfile } from '../../types/profile';
import type { SectorState } from '../../types/worldState';
import type { SelectedContractState } from '../../types/contract';
import { TerminalTheme } from '../../types/theme';
import {
  contractSectorWarning,
  formatContractRewardSummary,
  sponsorDisplayName,
  type ContractSectorCompatibility,
} from '../../utils/contractUi';
import { hazardLabel, formatOperationContributes, formatOperationLifecycleStatus, operationLifecycleAccentColor } from '../../utils/veilFrontSectorUi';
import { describeEmployerPerks } from '../../utils/employerContractUi';

interface VeilFrontDeployConfirmModalProps {
  visible: boolean;
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
  sector: SectorState;
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
  launching: boolean;
  onContinue: () => void;
  onAbort: () => void;
}

function SummaryRow({
  label,
  value,
  mutedColor,
  textColor,
}: {
  label: string;
  value: string;
  mutedColor: string;
  textColor: string;
}) {
  const { scaleSpacing } = useHubLayout();
  return (
    <View style={[styles.summaryRow, { marginBottom: scaleSpacing(6) }]}>
      <TerminalText variant="micro" style={{ color: mutedColor, minWidth: 88 }}>
        {label.toUpperCase()}
      </TerminalText>
      <TerminalText variant="micro" style={{ color: textColor, flex: 1, textAlign: 'right' }} numberOfLines={2}>
        {value}
      </TerminalText>
    </View>
  );
}

export default function VeilFrontDeployConfirmModal({
  visible,
  theme,
  profile,
  account,
  sector,
  selectedContract,
  sectorCompatibility,
  launching,
  onContinue,
  onAbort,
}: VeilFrontDeployConfirmModalProps): React.JSX.Element {
  const { scaleSpacing, scaleSize } = useHubLayout();
  const rewardFocus = sector.resourceFocus.slice(0, 2).join(' / ');
  const sectorWarning = contractSectorWarning(sectorCompatibility);
  const isSponsor = selectedContract.kind === 'SPONSOR';
  const contract = isSponsor ? selectedContract.contract : null;
  const operationLifecycle = formatOperationLifecycleStatus(
    sector.activeOperation.lifecycleStatus,
    sector.activeOperation.runsRemaining,
  );
  const operationLifecycleColor = operationLifecycleAccentColor(
    sector.activeOperation.lifecycleStatus,
    theme.statusColor,
  );
  const operationContributes = formatOperationContributes(sector.activeOperation.contributionRules)
    .slice(0, 3)
    .join(' · ');
  const sponsorPerks = isSponsor ? describeEmployerPerks(contract!.sponsorId) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onAbort}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.panel,
            {
              borderColor: theme.statusColor,
              backgroundColor: '#050608',
              padding: scaleSpacing(16),
              maxHeight: '92%',
            },
          ]}
        >
          <TerminalText
            variant="section"
            letterSpacing={1}
            style={{ color: theme.statusColor, textAlign: 'center', marginBottom: scaleSpacing(12) }}
          >
            [ DEPLOYMENT CONFIRMATION ]
          </TerminalText>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scaleSpacing(8) }}>
            <OperativeIdentityDossier theme={theme} profile={profile} account={account} compact />

            {sectorWarning ? (
              <View
                style={[
                  styles.warningBanner,
                  {
                    borderColor: sectorCompatibility === 'UNAVAILABLE' ? '#f87171' : theme.mutedColor,
                    marginTop: scaleSpacing(12),
                    padding: scaleSpacing(8),
                  },
                ]}
              >
                <TerminalText variant="micro" style={{ color: sectorCompatibility === 'UNAVAILABLE' ? '#f87171' : theme.mutedColor }}>
                  {sectorWarning.toUpperCase()}
                </TerminalText>
              </View>
            ) : null}

            <View style={{ marginTop: scaleSpacing(16) }}>
              <SectionFrame title="Deployment Summary" accentColor={theme.statusColor}>
                <SummaryRow label="Sector" value={sector.displayName} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                <SummaryRow
                  label="Contract"
                  value={isSponsor ? contract!.title : 'Independent Breach'}
                  mutedColor={theme.mutedColor}
                  textColor={theme.textColor}
                />
                <SummaryRow
                  label="Sponsor"
                  value={isSponsor ? sponsorDisplayName(contract!.sponsorId) : 'No Sponsor'}
                  mutedColor={theme.mutedColor}
                  textColor={theme.textColor}
                />
                {isSponsor ? (
                  <>
                    <SummaryRow label="Objective" value={contract!.objectiveText} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                    <SummaryRow label="Reward" value={formatContractRewardSummary(contract!)} mutedColor={theme.mutedColor} textColor={theme.statusColor} />
                    {sponsorPerks.length > 0 ? (
                      <SummaryRow label="Perks" value={sponsorPerks.join(' · ')} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                    ) : null}
                  </>
                ) : null}
                <SummaryRow label="Operation" value={sector.activeOperation.title} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                <SummaryRow label="Op Status" value={operationLifecycle} mutedColor={theme.mutedColor} textColor={operationLifecycleColor} />
                <SummaryRow
                  label="Op Reward"
                  value={sector.activeOperation.rewardPreview}
                  mutedColor={theme.mutedColor}
                  textColor={theme.statusColor}
                />
                {operationContributes.length > 0 ? (
                  <SummaryRow
                    label="Op Credit"
                    value={operationContributes}
                    mutedColor={theme.mutedColor}
                    textColor={theme.textColor}
                  />
                ) : null}
                <SummaryRow label="Threat" value={hazardLabel(sector.hazardLevel)} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                <SummaryRow label="Reward Focus" value={rewardFocus} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                {sector.activeAnchor ? (
                  <SummaryRow label="Anchor" value={sector.activeAnchor.displayName} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                ) : null}
              </SectionFrame>
            </View>
          </ScrollView>

          <View style={[styles.actions, { marginTop: scaleSpacing(14), gap: scaleSpacing(10) }]}>
            <HapticPressable
              onPress={onAbort}
              disabled={launching}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: theme.borderColor,
                  minHeight: scaleSize(44),
                  opacity: launching ? 0.45 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <TerminalText size={10} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '800' }}>
                [ ABORT ]
              </TerminalText>
            </HapticPressable>
            <HapticPressable
              onPress={onContinue}
              disabled={launching}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.continueBtn,
                {
                  borderColor: theme.statusColor,
                  backgroundColor: `${theme.statusColor}22`,
                  minHeight: scaleSize(44),
                  opacity: launching ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <TerminalText size={10} letterSpacing={1.2} style={{ color: theme.statusColor, fontWeight: '800' }}>
                {launching ? '[ DEPLOYING... ]' : '[ CONTINUE ]'}
              </TerminalText>
            </HapticPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 620,
    borderWidth: 2,
  },
  warningBanner: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flex: 1,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0b0f',
  },
  continueBtn: {},
});
