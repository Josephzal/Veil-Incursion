import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import SelectedContractSummary from './SelectedContractSummary';
import { ProgressBar } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { operationProgressPercent } from '../../data/worldStateHelpers';
import { getRecentlySuppressedAnchor } from '../../data/anchorLifecycleEngine';
import type { SelectedContractState } from '../../types/contract';
import type { SectorState } from '../../types/worldState';
import { TerminalTheme } from '../../types/theme';
import {
  describeAnchorInRunPressure,
  formatEchoBriefingIntel,
  formatCargoRoutingBriefingIntel,
  formatOperationBonusObjectiveLines,
  formatOperationContributesForObjective,
  formatOperationLifecycleStatus,
  operationLifecycleAccentColor,
  operationTypeChip,
  VEIL_BIOME_VISUALS,
} from '../../utils/veilFrontSectorUi';
import {
  contractSectorWarning,
  formatContractRewardSummary,
  sponsorDisplayName,
  type ContractSectorCompatibility,
} from '../../utils/contractUi';
import { useWorldState } from '../../context/WorldStateContext';
import { getActiveAnchorInstance } from '../../data/anchorLifecycleEngine';
import { buildPreliminaryRunWorldContext } from '../../data/runWorldBriefEngine';
import { buildProceduralExplainabilityText } from '../../data/proceduralDirectorExplainabilityEngine';
import { getSectorAftermathModifiers } from '../../data/proceduralDirectorAftermathEngine';
import { scoreRunPressure } from '../../data/proceduralDirectorPressureEngine';
import { viewShadow } from '../../utils/adaptiveStyles';

interface SectorBriefingPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
  onRequestDeploy: () => void;
  runDisabled: boolean;
  launching: boolean;
}

/* ------------------------------------------------------------------ *
 * Compact primitives — spacing / dividers / chips, not boxed cards.   *
 * ------------------------------------------------------------------ */
function BlockLabel({ label, color }: { label: string; color: string }) {
  const { scaleFont } = useVeilFrontLayout();
  return (
    <TerminalText size={scaleFont(5.6)} letterSpacing={1.1} style={{ color, fontWeight: '700' }}>
      {label}
    </TerminalText>
  );
}

function Divider() {
  const { scaleSpacing } = useVeilFrontLayout();
  return <View style={[styles.divider, { marginVertical: scaleSpacing(9) }]} />;
}

function Chip({ label, color }: { label: string; color: string }) {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
  return (
    <View style={[styles.chip, { borderColor: `${color}55`, paddingHorizontal: scaleSpacing(6), paddingVertical: scaleSpacing(2.5) }]}>
      <TerminalText size={scaleFont(5.6)} letterSpacing={0.4} style={{ color, fontWeight: '700' }}>
        {label}
      </TerminalText>
    </View>
  );
}

function DetailList({
  label,
  lines,
  color,
  mutedColor,
}: {
  label: string;
  lines: string[];
  color: string;
  mutedColor: string;
}) {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
  if (lines.length === 0) return null;
  return (
    <View style={{ gap: scaleSpacing(3), marginTop: scaleSpacing(6) }}>
      <BlockLabel label={label} color={mutedColor} />
      {lines.map((line) => (
        <TerminalText key={line} size={scaleFont(5.8)} style={{ color, lineHeight: scaleFont(9) }} numberOfLines={3}>
          {line}
        </TerminalText>
      ))}
    </View>
  );
}

/** Right panel — compact Deployment Dossier: stacked summary + deploy. */
export default function SectorBriefingPanel({
  theme,
  sector,
  selectedContract,
  sectorCompatibility,
  onRequestDeploy,
  runDisabled,
  launching,
}: SectorBriefingPanelProps): React.JSX.Element {
  const { sectionGap, scaleFont, scaleSpacing, deployButtonHeight } = useVeilFrontLayout();
  const { persisted } = useWorldState();
  const [intelOpen, setIntelOpen] = useState(false);

  const biomeVisual = VEIL_BIOME_VISUALS[sector.veilBiome];
  const op = sector.activeOperation;
  const opPct = operationProgressPercent(op.progressCurrent, op.progressRequired);
  const lifecycleLabel = formatOperationLifecycleStatus(op.lifecycleStatus, op.runsRemaining).split(' — ')[0];
  const lifecycleColor = operationLifecycleAccentColor(op.lifecycleStatus, theme.statusColor);
  const anchorActive = sector.activeAnchor != null;
  const anchorName = sector.activeAnchor?.displayName ?? 'None';
  const anchorPressure = sector.activeAnchor ? describeAnchorInRunPressure(sector.activeAnchor) : [];
  const suppressed = getRecentlySuppressedAnchor(persisted, sector.id);

  const crisisPreview = useMemo(() => {
    const anchor = getActiveAnchorInstance(persisted, sector.id);
    const prelim = buildPreliminaryRunWorldContext({
      persisted,
      sectorState: sector,
      operation: sector.activeOperation,
      anchor,
    });
    const aftermath = getSectorAftermathModifiers(persisted, sector.id);
    const pressure = scoreRunPressure({
      crisisTheme: prelim.crisisTheme,
      crisisDisplayName: prelim.crisisDisplayName,
      crisisSummary: prelim.crisisSummary,
      threatProfile: prelim.threatProfile,
      scannerBias: prelim.scannerBias,
      encounterBias: prelim.encounterBias,
      rewardBias: prelim.rewardBias,
      resourceStress: prelim.resourceStress,
      sectorId: sector.id,
      sectorDisplayName: sector.displayName,
    } as import('../../types/runWorldBrief').RunWorldBrief, {
      persisted,
      sectorState: sector,
      contractBoard: persisted.contractBoard.contracts,
      selectedContractId: null,
      aftermathModifiers: aftermath,
    });
    const explain = buildProceduralExplainabilityText(
      {
        crisisTheme: prelim.crisisTheme,
        crisisDisplayName: prelim.crisisDisplayName,
        crisisSummary: prelim.crisisSummary,
        threatProfile: prelim.threatProfile,
        resourceStress: prelim.resourceStress,
        anchorInstance: anchor,
        sectorDisplayName: sector.displayName,
      } as import('../../types/runWorldBrief').RunWorldBrief,
      pressure,
      aftermath,
    );
    return { prelim, explain, pressure };
  }, [persisted, sector]);

  const runSignals = crisisPreview.explain.expectedSignals.slice(0, 4);

  // Contract summary (compact).
  const isSponsor = selectedContract.kind === 'SPONSOR';
  const contract = isSponsor ? selectedContract.contract : null;
  const recommendedState: { label: string; color: string } | null = !isSponsor
    ? null
    : sectorCompatibility === 'RECOMMENDED'
      ? { label: 'YES', color: '#34d399' }
      : sectorCompatibility === 'UNAVAILABLE'
        ? { label: 'NO', color: '#f87171' }
        : { label: 'VALID', color: '#fbbf24' };

  const canLaunch = !runDisabled && !launching;
  const deployLabel = launching ? '[ DEPLOYING... ]' : '[ INITIATE BREACH ]';
  const sectorWarning = contractSectorWarning(sectorCompatibility);

  // Intel drawer content.
  const echoIntel = formatEchoBriefingIntel(sector);
  const cargoIntel = formatCargoRoutingBriefingIntel(sector, selectedContract);
  const contributes = formatOperationContributesForObjective(
    op.objectiveKind,
    op.contributionRules,
    op.rewardEmphasis.targetResources,
  );
  const bonusLines = formatOperationBonusObjectiveLines(op.bonusObjectives);

  return (
    <View style={[styles.panel, { gap: sectionGap }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: scaleSpacing(4) }}
        showsVerticalScrollIndicator={false}
      >
        {/* --- SECTOR DOSSIER --- */}
        <TerminalText size={scaleFont(12)} letterSpacing={0.5} style={{ color: theme.textColor, fontWeight: '800' }}>
          {sector.displayName}
        </TerminalText>
        <TerminalText size={scaleFont(6)} letterSpacing={1} style={{ color: biomeVisual.glow, marginTop: scaleSpacing(2) }}>
          {biomeVisual.label}
        </TerminalText>

        <Divider />

        {/* --- ACTIVE OPERATION --- */}
        <BlockLabel label="ACTIVE OPERATION" color={theme.statusColor} />
        <TerminalText size={scaleFont(8.5)} style={{ color: theme.textColor, fontWeight: '800', lineHeight: scaleFont(12), marginTop: scaleSpacing(4) }}>
          {op.title}
        </TerminalText>
        <View style={[styles.chipRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(5) }]}>
          <Chip label={operationTypeChip(op.objectiveKind)} color={theme.statusColor} />
          <Chip label={lifecycleLabel} color={lifecycleColor} />
          {anchorActive ? <Chip label={anchorName} color="#c084fc" /> : null}
        </View>
        <TerminalText size={scaleFont(6)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(7) }}>
          {`Progress: ${op.progressCurrent} / ${op.progressRequired} (${opPct}%)`}
        </TerminalText>
        <View style={{ marginTop: scaleSpacing(3) }}>
          <ProgressBar percent={opPct} accentColor={lifecycleColor} height={scaleFont(5)} />
        </View>

        {runSignals.length > 0 ? (
          <View style={{ marginTop: scaleSpacing(8), gap: scaleSpacing(4) }}>
            <BlockLabel label="RUN SIGNALS" color={theme.mutedColor} />
            <View style={[styles.chipRow, { gap: scaleSpacing(5) }]}>
              {runSignals.map((sig) => (
                <Chip key={sig} label={sig} color="#7dd3fc" />
              ))}
            </View>
          </View>
        ) : null}

        {anchorActive && anchorPressure.length > 0 ? (
          <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(7), lineHeight: scaleFont(9) }} numberOfLines={2}>
            {`Anchor // ${anchorName}: ${anchorPressure[0]}`}
          </TerminalText>
        ) : null}

        <Divider />

        {/* --- SELECTED CONTRACT --- */}
        <BlockLabel label="SELECTED CONTRACT" color={theme.statusColor} />
        {contract ? (
          <>
            <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: theme.mutedColor, marginTop: scaleSpacing(4) }}>
              {sponsorDisplayName(contract.sponsorId).toUpperCase()}
            </TerminalText>
            <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800', lineHeight: scaleFont(11), marginTop: scaleSpacing(2) }}>
              {contract.title}
            </TerminalText>
            <TerminalText size={scaleFont(6)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(4), lineHeight: scaleFont(9) }} numberOfLines={2}>
              {contract.objectiveText}
            </TerminalText>
            <View style={[styles.chipRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(6), alignItems: 'center' }]}>
              {recommendedState ? (
                <View style={styles.recRow}>
                  <TerminalText size={scaleFont(5.6)} letterSpacing={0.5} style={{ color: theme.mutedColor }}>
                    RECOMMENDED HERE:
                  </TerminalText>
                  <TerminalText size={scaleFont(6.4)} style={{ color: recommendedState.color, fontWeight: '800', marginLeft: scaleSpacing(4) }}>
                    {recommendedState.label}
                  </TerminalText>
                </View>
              ) : null}
            </View>
            <TerminalText size={scaleFont(6)} style={{ color: theme.statusColor, marginTop: scaleSpacing(5) }}>
              {formatContractRewardSummary(contract)}
            </TerminalText>
          </>
        ) : (
          <>
            <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800', marginTop: scaleSpacing(4) }}>
              Independent Breach
            </TerminalText>
            <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(4), lineHeight: scaleFont(9) }} numberOfLines={2}>
              No sponsor objective. Take contract work on the Contract Board.
            </TerminalText>
          </>
        )}

        {/* --- INTEL DRAWER --- */}
        <HapticPressable
          onPress={() => setIntelOpen((v) => !v)}
          style={({ pressed }) => [styles.intelToggle, { marginTop: scaleSpacing(10), opacity: pressed ? 0.7 : 1 }]}
        >
          <TerminalText size={scaleFont(6)} letterSpacing={0.8} style={{ color: theme.statusColor, fontWeight: '700' }}>
            {intelOpen ? '[ − INTEL ]' : '[ + INTEL ]'}
          </TerminalText>
        </HapticPressable>

        {intelOpen ? (
          <View style={{ marginTop: scaleSpacing(6) }}>
            {crisisPreview.explain.cause ? (
              <DetailList label={crisisPreview.explain.title.toUpperCase()} lines={[crisisPreview.explain.cause]} color={theme.mutedColor} mutedColor={theme.mutedColor} />
            ) : null}
            {op.description ? (
              <DetailList label="OPERATION" lines={[op.description]} color={theme.mutedColor} mutedColor={theme.mutedColor} />
            ) : null}
            <DetailList label="CONTRIBUTES" lines={contributes} color={theme.textColor} mutedColor={theme.mutedColor} />
            <DetailList label="ECHO INTEL" lines={echoIntel} color={theme.statusColor} mutedColor={theme.mutedColor} />
            <DetailList label="CARGO ROUTING" lines={cargoIntel} color="#fbbf24" mutedColor={theme.mutedColor} />
            <DetailList label="BONUS OBJECTIVES" lines={bonusLines} color={theme.textColor} mutedColor={theme.mutedColor} />
            {sector.activeAnchor ? (
              <DetailList
                label="ANCHOR PRESSURE"
                lines={[sector.activeAnchor.description, ...anchorPressure]}
                color={theme.mutedColor}
                mutedColor={theme.mutedColor}
              />
            ) : null}
            {suppressed && suppressed.remainingRuns > 0 ? (
              <DetailList label="AFTERMATH" lines={[`${suppressed.displayName} suppressed for ${suppressed.remainingRuns} run(s).`]} color={theme.mutedColor} mutedColor={theme.mutedColor} />
            ) : null}
            <View style={{ marginTop: scaleSpacing(8) }}>
              <SelectedContractSummary theme={theme} selectedContract={selectedContract} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {sectorWarning ? (
        <TerminalText
          size={scaleFont(5.5)}
          style={{ color: sectorCompatibility === 'UNAVAILABLE' ? '#f87171' : theme.mutedColor, lineHeight: scaleFont(8) }}
        >
          {sectorWarning}
        </TerminalText>
      ) : null}

      <HapticPressable
        onPress={onRequestDeploy}
        disabled={!canLaunch}
        style={({ pressed }) => [
          styles.deployButton,
          {
            borderColor: theme.statusColor,
            backgroundColor: `${theme.statusColor}28`,
            height: deployButtonHeight,
            opacity: !canLaunch ? 0.45 : pressed ? 0.88 : 1,
            ...viewShadow({
              color: theme.statusColor,
              opacity: !canLaunch ? 0.2 : 0.75,
              radius: 10,
              offset: { width: 0, height: 0 },
            }),
          },
        ]}
      >
        <TerminalText
          size={scaleFont(7.5)}
          letterSpacing={0.6}
          style={{ color: canLaunch ? theme.statusColor : theme.mutedColor, fontWeight: '800' }}
        >
          {deployLabel}
        </TerminalText>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.22)',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intelToggle: {
    alignSelf: 'flex-start',
  },
  deployButton: {
    width: '100%',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
