import React, { useEffect, useMemo, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import SelectedContractSummary from './SelectedContractSummary';
import { ProgressBar } from './VeilFrontUiPrimitives';
import { SELECT_ACCENT } from '../../constants/dossierSurface';
import { OTT } from '../../constants/occultTacticalTerminalTheme';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { operationProgressPercent } from '../../data/worldStateHelpers';
import { getRecentlySuppressedAnchor } from '../../data/anchorLifecycleEngine';
import type { SelectedContractState } from '../../types/contract';
import type { SectorState } from '../../types/worldState';
import type { VeilBiome } from '../../types/encounterSpawn';
import { TerminalTheme } from '../../types/theme';
import {
  describeAnchorInRunPressure,
  formatEchoBriefingIntel,
  formatCargoRoutingBriefingIntel,
  formatOperationBonusObjectiveLines,
  formatOperationContributesForObjective,
  hazardLabel,
  rewardLabel,
  SECTOR_FLAVOR_LINES,
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
  getBreachGradeTuning,
  listSelectableBreachGrades,
  PLAYABLE_BREACH_GRADES,
  resolveSelectedBreachGrade,
} from '../../data/breachGradeEngine';
import {
  evaluateAllPinnedGoals,
  formatPinnedGoalBriefingLines,
  listAvailableGoalsToPin,
  maxPinnedGoalSlots,
} from '../../data/pinnedGoalEngine';
import type { BreachGradeId } from '../../types/progression';
import {
  formatSectorFarmingPreviewLines,
  listPinnedGoalMissingResourceHints,
} from '../../data/resourceSourceHintEngine';
import { sectorPrimaryResourcePool } from '../../data/sectorResourceTableEngine';
import { getResourceDefinition } from '../../data/resourceRegistry';
import { isBreachGradeUnlockedInProfile } from '../../data/progressionProfileEngine';

import CityStreets from '../../../assets/images/environment images/citystreets.png';
import CityBuilding from '../../../assets/images/environment images/city_building.png';
import Backroads from '../../../assets/images/environment images/backroads.png';
import Underground from '../../../assets/images/environment images/underground.png';
import Blacksite from '../../../assets/images/environment images/blacksite.png';

const ACCENT = SELECT_ACCENT;
const YIELD_CYAN = OTT.cyanSelect;
const THREAT_RED = OTT.soulRed;
const ANCHOR_VIOLET = OTT.fluxViolet;

const SECTOR_THUMB: Record<VeilBiome, ImageSourcePropType> = {
  NULL_ZONE: CityStreets,
  SLAG_WORKS: CityBuilding,
  ASHEN_WASTE: Backroads,
  ABYSSAL_SINK: Underground,
  BLACKLINE_TERMINUS: Blacksite,
};

interface SectorBriefingPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
}

function threatColor(level: number): string {
  if (level <= 1) return '#f8fafc';
  if (level <= 2) return OTT.warningAmber;
  return THREAT_RED;
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
      <TerminalText size={scaleFont(5.6)} letterSpacing={1.1} style={{ color: mutedColor, fontWeight: '700' }}>
        {label}
      </TerminalText>
      {lines.map((line) => (
        <TerminalText
          key={line}
          size={scaleFont(5.5)}
          style={{ color, lineHeight: scaleFont(8.5) }}
        >
          {line}
        </TerminalText>
      ))}
    </View>
  );
}

/** Right panel — Selected Sector theater dossier matching concept layout. */
export default function SectorBriefingPanel({
  theme,
  sector,
  selectedContract,
  sectorCompatibility,
}: SectorBriefingPanelProps): React.JSX.Element {
  const { scaleFont, scaleSpacing } = useVeilFrontLayout();
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
  const farmingPreview = useMemo(
    () => formatSectorFarmingPreviewLines(sector.id, progressionProfile),
    [sector.id, progressionProfile],
  );
  const goalResourceHints = useMemo(
    () => listPinnedGoalMissingResourceHints(progressionProfile, account.resourceStash),
    [progressionProfile, account.resourceStash],
  );
  const fieldProfile = useMemo(
    () => sectorPrimaryResourcePool(sector.id)
      .slice(0, 3)
      .map((id) => getResourceDefinition(id).shortName.toUpperCase()),
    [sector.id],
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
  const anchorActive = sector.activeAnchor != null;
  const anchorPressure = sector.activeAnchor ? describeAnchorInRunPressure(sector.activeAnchor) : [];
  const suppressed = getRecentlySuppressedAnchor(persisted, sector.id);
  const flavor = SECTOR_FLAVOR_LINES[sector.id]
    ?? 'Breach vectors available. Local geometry remains unstable.';

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

  const isSponsor = selectedContract.kind === 'SPONSOR';
  const contract = isSponsor ? selectedContract.contract : null;
  const echoIntel = formatEchoBriefingIntel(sector);
  const cargoIntel = formatCargoRoutingBriefingIntel(sector, selectedContract);
  const contributes = formatOperationContributesForObjective(
    op.objectiveKind,
    op.contributionRules,
    op.rewardEmphasis.targetResources,
  );
  const bonusLines = formatOperationBonusObjectiveLines(op.bonusObjectives);

  const clearanceRoman = (
    (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const)[
      Math.max(0, Math.min(9, clearance.rank - 1))
    ] ?? String(clearance.rank)
  );

  return (
    <View style={styles.panel}>
      <View style={styles.dossier}>
        <ScrollView
          style={[
            styles.scroll,
            Platform.OS === 'web'
              ? ({ scrollbarWidth: 'thin', overscrollBehavior: 'contain' } as object)
              : null,
          ]}
          contentContainerStyle={{
            padding: scaleSpacing(22),
            paddingBottom: scaleSpacing(36),
            gap: scaleSpacing(14),
          }}
          showsVerticalScrollIndicator
        >
        <View style={{ gap: scaleSpacing(5) }}>
          <TerminalText size={scaleFont(11)} letterSpacing={1} style={{ color: '#F2F4F0', fontWeight: '800' }}>
            {sector.displayName.toUpperCase()}
          </TerminalText>
          <TerminalText size={scaleFont(5.5)} letterSpacing={1} style={{ color: theme.mutedColor }}>
            {`${biomeVisual.label.toUpperCase()} / CLEARANCE ${clearanceRoman}`}
          </TerminalText>

          <Image
            source={SECTOR_THUMB[sector.veilBiome]}
            style={[styles.thumb, { height: scaleSpacing(72), marginTop: scaleSpacing(6) }]}
            resizeMode="cover"
          />

          <TerminalText
            size={scaleFont(5.6)}
            style={{ color: theme.mutedColor, lineHeight: scaleFont(8.5), marginTop: scaleSpacing(4) }}
          >
            {flavor}
          </TerminalText>

          <View style={[styles.sectionDivider, { marginTop: scaleSpacing(8) }]} />

          <View style={{ gap: scaleSpacing(6) }}>
            <View style={styles.metricRow}>
              <TerminalText size={scaleFont(5.6)} letterSpacing={1} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                THREAT
              </TerminalText>
              <TerminalText
                size={scaleFont(6.2)}
                letterSpacing={0.6}
                style={{ color: threatColor(sector.hazardLevel), fontWeight: '800' }}
              >
                {hazardLabel(sector.hazardLevel).toUpperCase()}
              </TerminalText>
            </View>
            <View style={styles.metricRow}>
              <TerminalText size={scaleFont(5.6)} letterSpacing={1} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                YIELD
              </TerminalText>
              <TerminalText size={scaleFont(6.2)} letterSpacing={0.6} style={{ color: YIELD_CYAN, fontWeight: '800' }}>
                {rewardLabel(sector.rewardLevel).toUpperCase()}
              </TerminalText>
            </View>
            <View style={styles.metricRow}>
              <TerminalText size={scaleFont(5.6)} letterSpacing={1} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                ANCHOR SIGNAL
              </TerminalText>
              <TerminalText
                size={scaleFont(6.2)}
                letterSpacing={0.6}
                style={{ color: anchorActive ? ANCHOR_VIOLET : theme.mutedColor, fontWeight: '800' }}
              >
                {anchorActive ? 'ACTIVE' : 'NONE'}
              </TerminalText>
            </View>
          </View>

          {!mandateBriefing.canBreach ? (
            <View style={{ marginTop: scaleSpacing(6), gap: scaleSpacing(10) }}>
              <View style={{ gap: scaleSpacing(3) }}>
                <TerminalText size={scaleFont(5.2)} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                  ACCESS
                </TerminalText>
                <TerminalText size={scaleFont(5.8)} style={{ color: THREAT_RED, fontWeight: '700' }}>
                  {mandateBriefing.mandateState === 'ACTIVE'
                    ? 'LOCKED — MANDATE ACTIVE'
                    : mandateBriefing.mandateState === 'AVAILABLE'
                      ? 'LOCKED — MANDATE AVAILABLE'
                      : 'LOCKED — ROUTE UNKNOWN'}
                </TerminalText>
              </View>

              {mandateBriefing.mandate ? (
                <View style={{ gap: scaleSpacing(3) }}>
                  <TerminalText size={scaleFont(5.2)} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                    REQUIREMENT
                  </TerminalText>
                  <TerminalText
                    size={scaleFont(5.4)}
                    style={{ color: 'rgba(170, 178, 185, 0.88)', lineHeight: scaleFont(8.5) }}
                  >
                    {mandateBriefing.mandate.summary}
                  </TerminalText>
                </View>
              ) : null}

              {mandateBriefing.mandate ? (
                <View style={{ gap: scaleSpacing(3) }}>
                  <TerminalText size={scaleFont(5.2)} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                    CLEARANCE
                  </TerminalText>
                  <TerminalText
                    size={scaleFont(5.4)}
                    style={{ color: 'rgba(170, 178, 185, 0.88)', lineHeight: scaleFont(8.5) }}
                  >
                    {`Runner Clearance ${
                      (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const)[
                        Math.max(0, Math.min(9, mandateBriefing.mandate.minClearance - 1))
                      ] ?? String(mandateBriefing.mandate.minClearance)
                    } required${
                      mandateBriefing.mandate.requiresMandateFlag ? ' + Sector Access Mandates.' : '.'
                    }`}
                  </TerminalText>
                </View>
              ) : (
                <TerminalText
                  size={scaleFont(5.4)}
                  style={{ color: 'rgba(170, 178, 185, 0.88)', lineHeight: scaleFont(8.5) }}
                >
                  No access mandate defined for this sector.
                </TerminalText>
              )}

              {mandateBriefing.canAcceptMandate ? (
                <HapticPressable
                  onPress={() => activateSectorAccessMandate(sector.id)}
                  style={({ pressed }) => ({
                    marginTop: scaleSpacing(2),
                    borderWidth: 1,
                    borderColor: ACCENT,
                    paddingVertical: scaleSpacing(6),
                    paddingHorizontal: scaleSpacing(8),
                    opacity: pressed ? 0.75 : 1,
                    alignItems: 'center',
                  })}
                >
                  <TerminalText size={scaleFont(6)} letterSpacing={0.6} style={{ color: ACCENT, fontWeight: '800' }}>
                    [ ACCEPT ACCESS MANDATE ]
                  </TerminalText>
                </HapticPressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {mandateBriefing.canBreach ? (
          <>
            <View style={styles.sectionDivider} />

            {/* --- OPERATION --- */}
            <View style={{ gap: scaleSpacing(5) }}>
              <TerminalText size={scaleFont(5.4)} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                {`OPERATION: ${op.title.toUpperCase()}`}
              </TerminalText>
              <TerminalText size={scaleFont(5.6)} letterSpacing={0.6} style={{ color: '#D6DDD8' }}>
                {`${op.progressCurrent} / ${op.progressRequired} OBJECTIVES`}
              </TerminalText>
              <ProgressBar percent={opPct} accentColor={ACCENT} height={scaleFont(3.5)} />
            </View>

            {/* --- FIELD PROFILE --- */}
            {fieldProfile.length > 0 ? (
              <>
                <View style={styles.sectionDivider} />
                <View style={{ gap: scaleSpacing(5) }}>
                  <TerminalText size={scaleFont(5.4)} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                    FIELD PROFILE
                  </TerminalText>
                  <View style={[styles.chipRow, { gap: scaleSpacing(5) }]}>
                    {fieldProfile.map((label) => (
                      <View
                        key={label}
                        style={[
                          styles.fieldChip,
                          {
                            borderColor: 'rgba(88, 223, 168, 0.35)',
                            paddingHorizontal: scaleSpacing(7),
                            paddingVertical: scaleSpacing(4),
                          },
                        ]}
                      >
                        <TerminalText size={scaleFont(5.2)} letterSpacing={0.5} style={{ color: ACCENT, fontWeight: '700' }}>
                          {label}
                        </TerminalText>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            <View style={styles.sectionDivider} />

            {/* --- BREACH GRADE --- */}
            <View style={{ gap: scaleSpacing(6) }}>
              <TerminalText size={scaleFont(5.4)} letterSpacing={1.2} style={{ color: theme.mutedColor, fontWeight: '700' }}>
                BREACH GRADE
              </TerminalText>
              <View style={[styles.gradeRow, { gap: scaleSpacing(5) }]}>
                {PLAYABLE_BREACH_GRADES.map((grade) => {
                  const unlocked = isBreachGradeUnlockedInProfile(progressionProfile, grade);
                  const selected = unlocked && grade === selectedBreachGrade;
                  const primaryColor = selected
                    ? ACCENT
                    : unlocked
                      ? '#E8EEEA'
                      : 'rgba(148, 163, 184, 0.7)';
                  return (
                    <HapticPressable
                      key={grade}
                      onPress={() => handleSelectGrade(grade)}
                      disabled={!unlocked}
                      style={({ pressed }) => ([
                        styles.gradeTile,
                        {
                          borderColor: selected ? ACCENT : 'rgba(148, 163, 184, 0.28)',
                          backgroundColor: selected ? 'rgba(88, 223, 168, 0.1)' : 'rgba(0, 0, 0, 0.28)',
                          paddingVertical: scaleSpacing(8),
                          paddingHorizontal: scaleSpacing(4),
                          opacity: !unlocked ? 0.72 : pressed ? 0.8 : 1,
                        },
                      ])}
                    >
                      <TerminalText
                        size={scaleFont(7.2)}
                        letterSpacing={0.6}
                        numberOfLines={1}
                        style={{ color: primaryColor, fontWeight: '800', textAlign: 'center' }}
                      >
                        {grade}
                      </TerminalText>
                    </HapticPressable>
                  );
                })}
              </View>
              <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor, lineHeight: scaleFont(8.5) }}>
                {gradeTuning.summary}
              </TerminalText>
            </View>
          </>
        ) : null}

        <View style={styles.sectionDivider} />

        {/* --- SECONDARY: goals / intel --- */}
        <View style={{ gap: scaleSpacing(6) }}>
          <HapticPressable
            onPress={() => setGoalsOpen((v) => !v)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <TerminalText size={scaleFont(5.4)} letterSpacing={0.8} style={{ color: theme.mutedColor, fontWeight: '700' }}>
              {goalsOpen
                ? `[ − PINNED GOALS (${pinnedStatuses.length}/${pinSlots}) ]`
                : `[ + PINNED GOALS (${pinnedStatuses.length}/${pinSlots}) ]`}
            </TerminalText>
          </HapticPressable>
          {goalsOpen ? (
            <View style={{ gap: scaleSpacing(6) }}>
              {farmingPreview.map((line) => (
                <TerminalText key={line} size={scaleFont(5.4)} style={{ color: theme.mutedColor, lineHeight: scaleFont(8.5) }}>
                  {line}
                </TerminalText>
              ))}
              {pinnedStatuses.length === 0 ? (
                <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
                  No goals pinned.
                </TerminalText>
              ) : (
                pinnedStatuses.map((status) => {
                  const lines = formatPinnedGoalBriefingLines(status);
                  return (
                    <View key={status.pinned.id} style={{ gap: scaleSpacing(2) }}>
                      <TerminalText size={scaleFont(6)} style={{ color: theme.textColor, fontWeight: '800' }}>
                        {lines[0]}
                      </TerminalText>
                      {lines.slice(1).map((line) => (
                        <TerminalText key={line} size={scaleFont(5.2)} style={{ color: theme.mutedColor }}>
                          {line}
                        </TerminalText>
                      ))}
                      <HapticPressable onPress={() => unpinProgressionGoalId(status.pinned.id)}>
                        <TerminalText size={scaleFont(5.2)} style={{ color: ACCENT, fontWeight: '700' }}>
                          [ UNPIN ]
                        </TerminalText>
                      </HapticPressable>
                    </View>
                  );
                })
              )}
              {availableGoals.slice(0, 3).map((goal) => (
                <View key={goal.id} style={{ gap: scaleSpacing(2) }}>
                  <TerminalText size={scaleFont(5.6)} style={{ color: theme.textColor, fontWeight: '700' }}>
                    {goal.label}
                  </TerminalText>
                  <HapticPressable
                    onPress={() => pinProgressionGoalId(goal.id)}
                    disabled={pinnedStatuses.length >= pinSlots}
                  >
                    <TerminalText size={scaleFont(5.2)} style={{ color: ACCENT, fontWeight: '800' }}>
                      [ PIN ]
                    </TerminalText>
                  </HapticPressable>
                </View>
              ))}
              {goalResourceHints.slice(0, 2).map((hint) => (
                <TerminalText key={hint.resourceId} size={scaleFont(5.2)} style={{ color: theme.mutedColor }}>
                  {hint.compact}
                </TerminalText>
              ))}
            </View>
          ) : null}

          <HapticPressable
            onPress={() => setIntelOpen((v) => !v)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <TerminalText size={scaleFont(5.4)} letterSpacing={0.8} style={{ color: theme.mutedColor, fontWeight: '700' }}>
              {intelOpen ? '[ − INTEL / CONTRACT ]' : '[ + INTEL / CONTRACT ]'}
            </TerminalText>
          </HapticPressable>
          {intelOpen ? (
            <View>
              {contract ? (
                <>
                  <TerminalText size={scaleFont(5.4)} style={{ color: theme.mutedColor }}>
                    {sponsorDisplayName(contract.sponsorId).toUpperCase()}
                  </TerminalText>
                  <TerminalText size={scaleFont(7)} style={{ color: theme.textColor, fontWeight: '800', marginTop: scaleSpacing(2) }}>
                    {contract.title}
                  </TerminalText>
                  <TerminalText size={scaleFont(5.4)} style={{ color: ACCENT, marginTop: scaleSpacing(4) }}>
                    {formatContractRewardSummary(contract)}
                  </TerminalText>
                </>
              ) : (
                <TerminalText size={scaleFont(6)} style={{ color: theme.textColor, fontWeight: '800' }}>
                  Independent Breach
                </TerminalText>
              )}
              {crisisPreview.explain.cause ? (
                <DetailList label={crisisPreview.explain.title.toUpperCase()} lines={[crisisPreview.explain.cause]} color={theme.mutedColor} mutedColor={theme.mutedColor} />
              ) : null}
              <DetailList label="CONTRIBUTES" lines={contributes} color={theme.textColor} mutedColor={theme.mutedColor} />
              <DetailList label="ECHO INTEL" lines={echoIntel} color={ACCENT} mutedColor={theme.mutedColor} />
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
                <DetailList
                  label="AFTERMATH"
                  lines={[`${suppressed.displayName} suppressed for ${suppressed.remainingRuns} run(s).`]}
                  color={theme.mutedColor}
                  mutedColor={theme.mutedColor}
                />
              ) : null}
              <View style={{ marginTop: scaleSpacing(8) }}>
                <SelectedContractSummary theme={theme} selectedContract={selectedContract} />
              </View>
              {sectorCompatibility ? null : null}
            </View>
          ) : null}
        </View>
        </ScrollView>
      </View>
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
  dossier: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: 'rgba(70, 85, 95, 0.55)',
    backgroundColor: 'rgba(6, 12, 14, 0.72)',
    overflow: 'hidden',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  thumb: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#0a0a0c',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gradeRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    width: '100%',
  },
  gradeTile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldChip: {
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
});
