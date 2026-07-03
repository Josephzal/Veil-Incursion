import React from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import OperativeIdentityDossier from '../hub/OperativeIdentityDossier';
import TerminalText from '../TerminalText';
import { SectionFrame } from './VeilFrontUiPrimitives';
import { useHubLayout } from '../../context/HubLayoutContext';
import type { PlayerAccount } from '../../types/game';
import type { OperativeProfile } from '../../types/profile';
import type { CabalEmployerId, SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import { employerSponsorLabel } from '../../utils/employerContractUi';
import { hazardLabel } from '../../utils/veilFrontSectorUi';

interface VeilFrontDeployConfirmModalProps {
  visible: boolean;
  theme: TerminalTheme;
  profile: OperativeProfile;
  account: PlayerAccount;
  sector: SectorState;
  selectedEmployer: CabalEmployerId | null;
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
  selectedEmployer,
  launching,
  onContinue,
  onAbort,
}: VeilFrontDeployConfirmModalProps): React.JSX.Element {
  const { scaleSpacing, scaleSize } = useHubLayout();
  const sponsorSummary = selectedEmployer
    ? employerSponsorLabel(selectedEmployer)
    : 'No Sponsor';
  const rewardFocus = sector.resourceFocus.slice(0, 2).join(' / ');

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

            <View style={{ marginTop: scaleSpacing(16) }}>
              <SectionFrame title="Deployment Summary" accentColor={theme.statusColor}>
                <SummaryRow label="Sector" value={sector.displayName} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                <SummaryRow label="Sponsor" value={sponsorSummary} mutedColor={theme.mutedColor} textColor={theme.textColor} />
                <SummaryRow label="Operation" value={sector.activeOperation.title} mutedColor={theme.mutedColor} textColor={theme.textColor} />
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
