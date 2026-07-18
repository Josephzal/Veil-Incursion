import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import SelectedContractSummary from './SelectedContractSummary';
import { ProgressBar } from './VeilFrontUiPrimitives';
import { LoadoutSectionHeader } from '../hub/loadoutTabUi';
import { CARD_BLACK, SELECT_ACCENT } from '../../constants/dossierSurface';
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
  formatContractRewardSummary,
  sponsorDisplayName,
  type ContractSectorCompatibility,
} from '../../utils/contractUi';
import { useWorldState } from '../../context/WorldStateContext';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { getActiveAnchorInstance } from '../../data/anchorLifecycleEngine';
import { buildPreliminaryRunWorldContext } from '../../data/runWorldBriefEngine';
import { buildProceduralExplainabilityText } from '../../data/proceduralDirectorExplainabilityEngine';
import { getSectorAftermathModifiers } from '../../data/proceduralDirectorAftermathEngine';
import { scoreRunPressure } from '../../data/proceduralDirectorPressureEngine';
import { clearanceXpProgress } from '../../data/runnerClearanceEngine';
import { getAccountProgressionProfile } from '../../data/progressionDebugEngine';
import { buildSectorMandateBriefing } from '../../data/sectorAccessMandateEngine';
import {
  formatBreachGradeLabel,
  getBreachGradeTuning,
  listSelectableBreachGrades,
  resolveSelectedBreachGrade,
} from '../../data/breachGradeEngine';
import {
  evaluateAllPinnedGoals,
  formatPinnedGoalBriefingLines,
  listAvailableGoalsToPin,
  maxPinnedGoalSlots,
} from '../../data/pinnedGoalEngine';
import type { BreachGradeId } from '../../types/progression';

interface SectorBriefingPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
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

/** Subtle briefing card — section headers sit outside, content sits inside. */
function SectionCard({ children }: { children: React.ReactNode }) {
  const { scaleSpacing } = useVeilFrontLayout();
  return (
    <View style={[styles.sectionCard, { padding: scaleSpacing(9), gap: scaleSpacing(3) }]}>
      {children}
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
}: SectorBriefingPanelProps): React.JSX.Element {
  const { sectionGap, scaleFont, scaleSpacing } = useVeilFrontLayout();
  const { persisted, setSelectedBreachGrade } = useWorldState();
  const {
    account,
    activateSectorAccessMandate,
    pinProgressionGoalId,
    unpinProgressionGoalId,
  } = usePlayerAccount();
  const [intelOpen, setIntelOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const progressionProfile = useMemo(
    () => getAccountProgressionProfile(account),
    [account],
  );
  const clearance = useMemo(
    () => clearanceXpProgress(progressionProfile),
    [progressionProfile],
  );
  const mandateBriefing = useMemo(
    () => buildSectorMandateBriefing(progressionProfile, sector.id),
    [progressionProfile, sector.id],
  );
  const selectableGrades = useMemo(
    () => listSelectableBreachGrades(progressionProfile),
    [progressionProfile],
  );
  const selectedBreachGrade = useMemo(
    () => resolveSelectedBreachGrade(progressionProfile, persisted.selectedBreachGrade),
    [persisted.selectedBreachGrade, progressionProfile],
  );
  const gradeTuning = getBreachGradeTuning(selectedBreachGrade);
  const pinnedStatuses = useMemo(
    () => evaluateAllPinnedGoals(progressionProfile),
    [progressionProfile],
  );
  const pinSlots = maxPinnedGoalSlots(progressionProfile);
  const availableGoals = useMemo(
    () => listAvailableGoalsToPin(progressionProfile).slice(0, 6),
    [progressionProfile],
  );

  useEffect(() => {
    if (persisted.selectedBreachGrade !== selectedBreachGrade) {
      setSelectedBreachGrade(selectedBreachGrade);
    }
  }, [persisted.selectedBreachGrade, selectedBreachGrade, setSelectedBreachGrade]);

  const handleSelectGrade = (grade: BreachGradeId) => {
    if (!selectableGrades.includes(grade)) return;
    setSelectedBreachGrade(grade);
  };

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
        contentContainerStyle={{ paddingBottom: scaleSpacing(4), gap: scaleSpacing(9) }}
        showsVerticalScrollIndicator={false}
      >
        {/* --- SECTOR BRIEFING --- */}
        <View>
          <LoadoutSectionHeader label="Sector Briefing" style={{ marginBottom: scaleSpacing(4) }} />
          <SectionCard>
            <TerminalText size={scaleFont(12)} letterSpacing={0.5} style={{ color: theme.textColor, fontWeight: '800' }}>
              {sector.displayName}
            </TerminalText>
            <TerminalText size={scaleFont(6)} letterSpacing={1} style={{ color: biomeVisual.glow, marginTop: scaleSpacing(2) }}>
              {biomeVisual.label}
            </TerminalText>
            <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(4) }}>
              {`Runner Clearance ${clearance.rank} // ${clearance.current}/${clearance.required} XP`}
            </TerminalText>
            <TerminalText
              size={scaleFont(5.8)}
              style={{
                color: mandateBriefing.canBreach ? theme.statusColor : '#f87171',
                marginTop: scaleSpacing(4),
                fontWeight: '700',
              }}
            >
              {mandateBriefing.headline}
            </TerminalText>
            {mandateBriefing.detailLines.map((line) => (
              <TerminalText
                key={line}
                size={scaleFont(5.6)}
                style={{ color: theme.mutedColor, marginTop: scaleSpacing(2), lineHeight: scaleFont(8.5) }}
              >
                {line}
              </TerminalText>
            ))}
            {mandateBriefing.canAcceptMandate ? (
              <HapticPressable
                onPress={() => {
                  activateSectorAccessMandate(sector.id);
                }}
                style={({ pressed }) => ({
                  marginTop: scaleSpacing(8),
                  borderWidth: 1,
                  borderColor: SELECT_ACCENT,
                  paddingVertical: scaleSpacing(6),
                  paddingHorizontal: scaleSpacing(8),
                  opacity: pressed ? 0.75 : 1,
                  alignItems: 'center',
                })}
              >
                <TerminalText size={scaleFont(6)} letterSpacing={0.6} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
                  [ ACCEPT ACCESS MANDATE ]
                </TerminalText>
              </HapticPressable>
            ) : null}
          </SectionCard>
        </View>

        {/* --- PINNED GOALS --- */}
        <View>
          <LoadoutSectionHeader
            label={`Pinned Goals (${pinnedStatuses.length}/${pinSlots})`}
            style={{ marginBottom: scaleSpacing(4) }}
          />
          <SectionCard>
            {pinnedStatuses.length === 0 ? (
              <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, lineHeight: scaleFont(9) }}>
                No goals pinned. Pin a target to focus sector, grade, and sponsor choices.
              </TerminalText>
            ) : (
              pinnedStatuses.map((status) => {
                const lines = formatPinnedGoalBriefingLines(status);
                return (
                  <View key={status.pinned.id} style={{ marginBottom: scaleSpacing(8) }}>
                    <TerminalText size={scaleFont(6.5)} style={{ color: theme.textColor, fontWeight: '800' }}>
                      {lines[0]}
                    </TerminalText>
                    {lines.slice(1).map((line) => (
                      <TerminalText
                        key={line}
                        size={scaleFont(5.6)}
                        style={{ color: theme.mutedColor, marginTop: scaleSpacing(2), lineHeight: scaleFont(8.5) }}
                      >
                        {line}
                      </TerminalText>
                    ))}
                    <HapticPressable
                      onPress={() => unpinProgressionGoalId(status.pinned.id)}
                      style={({ pressed }) => ({
                        marginTop: scaleSpacing(4),
                        alignSelf: 'flex-start',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <TerminalText size={scaleFont(5.4)} letterSpacing={0.5} style={{ color: theme.statusColor, fontWeight: '700' }}>
                        [ UNPIN ]
                      </TerminalText>
                    </HapticPressable>
                  </View>
                );
              })
            )}
            <HapticPressable
              onPress={() => setGoalsOpen((v) => !v)}
              style={({ pressed }) => ({
                marginTop: scaleSpacing(4),
                alignSelf: 'flex-start',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <TerminalText size={scaleFont(5.6)} letterSpacing={0.6} style={{ color: theme.statusColor, fontWeight: '700' }}>
                {goalsOpen ? '[ − AVAILABLE GOALS ]' : '[ + AVAILABLE GOALS ]'}
              </TerminalText>
            </HapticPressable>
            {goalsOpen ? (
              <View style={{ marginTop: scaleSpacing(6), gap: scaleSpacing(6) }}>
                {availableGoals.length === 0 ? (
                  <TerminalText size={scaleFont(5.6)} style={{ color: theme.mutedColor }}>
                    No available goals to pin.
                  </TerminalText>
                ) : (
                  availableGoals.map((goal) => (
                    <View key={goal.id} style={{ gap: scaleSpacing(2) }}>
                      <TerminalText size={scaleFont(6)} style={{ color: theme.textColor, fontWeight: '700' }}>
                        {goal.label}
                      </TerminalText>
                      <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor, lineHeight: scaleFont(8) }}>
                        {goal.summary}
                      </TerminalText>
                      <HapticPressable
                        onPress={() => pinProgressionGoalId(goal.id)}
                        disabled={pinnedStatuses.length >= pinSlots}
                        style={({ pressed }) => ({
                          alignSelf: 'flex-start',
                          opacity: pinnedStatuses.length >= pinSlots ? 0.4 : pressed ? 0.7 : 1,
                        })}
                      >
                        <TerminalText size={scaleFont(5.4)} letterSpacing={0.5} style={{ color: SELECT_ACCENT, fontWeight: '800' }}>
                          [ PIN ]
                        </TerminalText>
                      </HapticPressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </SectionCard>
        </View>

        {mandateBriefing.canBreach ? (
        <>
        {/* --- BREACH GRADE --- */}
        <View>
          <LoadoutSectionHeader label="Breach Grade" style={{ marginBottom: scaleSpacing(4) }} />
          <SectionCard>
            <View style={[styles.chipRow, { gap: scaleSpacing(5) }]}>
              {selectableGrades.map((grade) => {
                const selected = grade === selectedBreachGrade;
                const color = selected ? SELECT_ACCENT : theme.mutedColor;
                return (
                  <HapticPressable
                    key={grade}
                    onPress={() => handleSelectGrade(grade)}
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: selected ? SELECT_ACCENT : `${theme.mutedColor}55`,
                      backgroundColor: selected ? `${SELECT_ACCENT}18` : 'rgba(15, 23, 42, 0.4)',
                      paddingHorizontal: scaleSpacing(8),
                      paddingVertical: scaleSpacing(4),
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <TerminalText size={scaleFont(6)} letterSpacing={0.5} style={{ color, fontWeight: '800' }}>
                      {formatBreachGradeLabel(grade, true).toUpperCase()}
                    </TerminalText>
                  </HapticPressable>
                );
              })}
            </View>
            <TerminalText
              size={scaleFont(5.8)}
              style={{ color: theme.mutedColor, marginTop: scaleSpacing(6), lineHeight: scaleFont(9) }}
            >
              {gradeTuning.summary}
            </TerminalText>
            {(gradeTuning.creditBonusPct > 0 || gradeTuning.rareLootBonusPct > 0) ? (
              <TerminalText
                size={scaleFont(5.6)}
                style={{ color: theme.statusColor, marginTop: scaleSpacing(4) }}
              >
                {[
                  gradeTuning.creditBonusPct > 0 ? `+${gradeTuning.creditBonusPct}% credits` : null,
                  gradeTuning.rareLootBonusPct > 0 ? `+${gradeTuning.rareLootBonusPct}% rare loot` : null,
                ].filter(Boolean).join(' // ')}
              </TerminalText>
            ) : null}
          </SectionCard>
        </View>

        {/* --- ACTIVE OPERATION --- */}
        <View>
          <LoadoutSectionHeader label="Active Operation" style={{ marginBottom: scaleSpacing(4) }} />
          <SectionCard>
            <TerminalText size={scaleFont(8.5)} style={{ color: theme.textColor, fontWeight: '800', lineHeight: scaleFont(12) }}>
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
            {anchorActive && anchorPressure.length > 0 ? (
              <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(7), lineHeight: scaleFont(9) }} numberOfLines={2}>
                {`Anchor // ${anchorName}: ${anchorPressure[0]}`}
              </TerminalText>
            ) : null}
          </SectionCard>
        </View>

        {/* --- RUN SIGNALS --- */}
        {runSignals.length > 0 ? (
          <View>
            <LoadoutSectionHeader label="Run Signals" style={{ marginBottom: scaleSpacing(4) }} />
            <SectionCard>
              <View style={[styles.chipRow, { gap: scaleSpacing(5) }]}>
                {runSignals.map((sig) => (
                  <Chip key={sig} label={sig} color="#7dd3fc" />
                ))}
              </View>
            </SectionCard>
          </View>
        ) : null}

        {/* --- SELECTED CONTRACT --- */}
        <View>
          <LoadoutSectionHeader label="Selected Contract" style={{ marginBottom: scaleSpacing(4) }} />
          <SectionCard>
            {contract ? (
              <>
                <TerminalText size={scaleFont(5.8)} letterSpacing={0.6} style={{ color: theme.mutedColor }}>
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
                {contract.minBreachGrade ? (
                  <TerminalText
                    size={scaleFont(5.6)}
                    style={{
                      color: theme.mutedColor,
                      marginTop: scaleSpacing(4),
                    }}
                  >
                    {`Min ${formatBreachGradeLabel(contract.minBreachGrade, true)}`}
                  </TerminalText>
                ) : null}
              </>
            ) : (
              <>
                <TerminalText size={scaleFont(8)} style={{ color: theme.textColor, fontWeight: '800' }}>
                  Independent Breach
                </TerminalText>
                <TerminalText size={scaleFont(5.8)} style={{ color: theme.mutedColor, marginTop: scaleSpacing(4), lineHeight: scaleFont(9) }} numberOfLines={2}>
                  No sponsor objective. Take contract work on the Contract Board.
                </TerminalText>
              </>
            )}
          </SectionCard>
        </View>

        {/* --- INTEL DRAWER --- */}
        <HapticPressable
          onPress={() => setIntelOpen((v) => !v)}
          style={({ pressed }) => [styles.intelToggle, { opacity: pressed ? 0.7 : 1 }]}
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
        </>
        ) : null}
      </ScrollView>
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
  sectionCard: {
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.22)',
    backgroundColor: CARD_BLACK,
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
});
