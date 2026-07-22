import React, { useEffect, useMemo } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ImageStyle,
} from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { ProgressBar } from './VeilFrontUiPrimitives';
import { useVeilFrontLayout } from './useVeilFrontLayout';
import { operationProgressPercent } from '../../data/worldStateHelpers';
import type { SelectedContractState } from '../../types/contract';
import type { SectorState } from '../../types/worldState';
import type { VeilBiome } from '../../types/encounterSpawn';
import { TerminalTheme } from '../../types/theme';
import {
  formatOperationObjectiveProgressLine,
  hazardLabel,
  rewardLabel,
  SECTOR_DOSSIER_SUMMARIES,
  SECTOR_FLAVOR_LINES,
  VEIL_BIOME_VISUALS,
} from '../../utils/veilFrontSectorUi';
import {
  formatCompactContractObjective,
  formatCompactContractPayout,
  formatCompactContractValidSectors,
  formatDeploymentContractStatus,
  formatIncompatibleContractDeployConsequence,
  sponsorDisplayName,
  type ContractSectorCompatibility,
} from '../../utils/contractUi';
import { useWorldState } from '../../context/WorldStateContext';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { clearanceXpProgress } from '../../data/runnerClearanceEngine';
import { getAccountProgressionProfile } from '../../data/progressionDebugEngine';
import { buildSectorMandateBriefing } from '../../data/sectorAccessMandateEngine';
import {
  PLAYABLE_BREACH_GRADES,
  resolveSelectedBreachGrade,
} from '../../data/breachGradeEngine';
import type { BreachGradeId } from '../../types/progression';
import { sectorPrimaryResourcePool } from '../../data/sectorResourceTableEngine';
import { getResourceDefinition } from '../../data/resourceRegistry';
import { isBreachGradeUnlockedInProfile } from '../../data/progressionProfileEngine';

import CityStreets from '../../../assets/images/environment images/citystreets.png';
import CityBuilding from '../../../assets/images/environment images/city_building.png';
import Backroads from '../../../assets/images/environment images/backroads.png';
import Underground from '../../../assets/images/environment images/underground.png';
import Blacksite from '../../../assets/images/environment images/blacksite.png';

const RAIL = {
  bg: '#030708',
  textPrimary: '#d5dfdc',
  textSecondary: '#91a39f',
  textMuted: '#627572',
  terminal: '#69c8ad',
  terminalBright: '#8ee0c6',
  danger: '#c96262',
  incompat: '#d58b86',
  anchor: '#8b78a7',
  line: 'rgba(137, 170, 163, 0.14)',
  lineStrong: 'rgba(137, 190, 179, 0.25)',
  lineSoft: 'rgba(137, 170, 163, 0.075)',
} as const;

/** Base sizes chosen so desktop scaleFont(~1.35–1.65) lands near the readability targets. */
const TYPE = {
  label: 7.5,
  body: 8.5,
  bodyEm: 9,
  meta: 7.5,
  title: 18,
  cta: 8,
  micro: 6.8,
} as const;

const SECTOR_THUMB: Record<VeilBiome, ImageSourcePropType> = {
  NULL_ZONE: CityStreets,
  SLAG_WORKS: CityBuilding,
  ASHEN_WASTE: Backroads,
  ABYSSAL_SINK: Underground,
  BLACKLINE_TERMINUS: Blacksite,
};

const SECTOR_THUMB_POSITION: Record<VeilBiome, string> = {
  NULL_ZONE: 'center 42%',
  SLAG_WORKS: 'center 48%',
  ASHEN_WASTE: 'center 55%',
  ABYSSAL_SINK: 'center 40%',
  BLACKLINE_TERMINUS: 'center 35%',
};

const CLEARANCE_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'] as const;

interface SectorBriefingPanelProps {
  theme: TerminalTheme;
  sector: SectorState;
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
  sectorUnlocked: boolean;
  breachDisabled: boolean;
  launching: boolean;
  gradeMeetsContract: boolean;
  gradeWarning: string | null;
  onRequestDeploy: () => void;
}

function SectorConditionRow({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: string;
  tone: 'danger' | 'reward' | 'anchor' | 'neutral';
  compact: boolean;
}): React.JSX.Element {
  const valueColor =
    tone === 'danger' ? RAIL.danger
      : tone === 'reward' ? RAIL.terminal
        : tone === 'anchor' ? RAIL.anchor
          : RAIL.textPrimary;

  return (
    <View style={[styles.conditionRow, compact && styles.conditionRowCompact]}>
      <TerminalText size={TYPE.label} letterSpacing={0.9} style={styles.conditionLabel}>
        {label}
      </TerminalText>
      <TerminalText size={TYPE.label} letterSpacing={0.7} style={[styles.conditionValue, { color: valueColor }]}>
        {value}
      </TerminalText>
    </View>
  );
}

function ActiveOperationSummary({
  title,
  objectiveLine,
  percent,
  compact,
}: {
  title: string;
  objectiveLine: string;
  percent: number;
  compact: boolean;
}): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.activeOperation, compact && styles.activeOperationCompact]}>
      <View style={styles.activeOperationTopline}>
        <TerminalText size={TYPE.label} letterSpacing={1} style={styles.sectionLabel}>
          ACTIVE OPERATION
        </TerminalText>
        <TerminalText size={TYPE.body} letterSpacing={0.6} style={styles.activeOperationPct}>
          {`${clamped}%`}
        </TerminalText>
      </View>
      <TerminalText size={TYPE.bodyEm} letterSpacing={0.7} style={styles.activeOperationTitle}>
        {title}
      </TerminalText>
      <TerminalText size={TYPE.body} style={styles.activeOperationObjective}>
        {objectiveLine}
      </TerminalText>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Active operation progress"
        accessibilityValue={{ min: 0, max: 100, now: clamped }}
        accessibilityHint="Shows progress toward the sector operation objective"
        style={styles.activeOperationTrack}
      >
        <ProgressBar
          percent={clamped}
          accentColor={RAIL.terminal}
          trackColor="rgba(133, 165, 158, 0.12)"
          height={3}
        />
      </View>
    </View>
  );
}

function DeploymentContractSummary({
  selectedContract,
  sectorCompatibility,
  sectorDisplayName,
}: {
  selectedContract: SelectedContractState;
  sectorCompatibility: ContractSectorCompatibility;
  sectorDisplayName: string;
}): React.JSX.Element {
  if (selectedContract.kind !== 'SPONSOR') {
    return (
      <View style={styles.deploymentContract}>
        <TerminalText size={TYPE.label} letterSpacing={1} style={styles.sectionLabel}>
          CURRENT CONTRACT
        </TerminalText>
        <TerminalText size={TYPE.bodyEm} letterSpacing={0.4} style={styles.deploymentIdentity}>
          NO CONTRACT SELECTED
        </TerminalText>
        <TerminalText size={TYPE.body} style={styles.deploymentObjective}>
          Choose a mandate on the Contract Board
        </TerminalText>
      </View>
    );
  }

  const contract = selectedContract.contract;
  const status = formatDeploymentContractStatus(sectorCompatibility);
  const incompatible = status === 'INCOMPATIBLE';
  const compatible = status === 'COMPATIBLE';
  return (
    <View
      style={[
        styles.deploymentContract,
        compatible && styles.deploymentContractCompatible,
        incompatible && styles.deploymentContractIncompatible,
      ]}
    >
      <View style={styles.deploymentTopline}>
        <TerminalText size={TYPE.label} letterSpacing={1} style={styles.sectionLabel}>
          CURRENT CONTRACT
        </TerminalText>
        <TerminalText
          size={TYPE.micro}
          letterSpacing={0.8}
          accessibilityLabel={status === 'NEUTRAL' ? 'No compatibility status' : status}
          style={[
            styles.deploymentStatus,
            compatible && styles.deploymentStatusCompatible,
            incompatible && styles.deploymentStatusIncompatible,
          ]}
        >
          {status === 'NEUTRAL' ? '' : status}
        </TerminalText>
      </View>
      <TerminalText
        size={TYPE.bodyEm}
        letterSpacing={0.4}
        numberOfLines={2}
        style={styles.deploymentIdentity}
      >
        {`${sponsorDisplayName(contract.sponsorId).toUpperCase()} · ${contract.title.toUpperCase()}`}
      </TerminalText>
      <TerminalText size={TYPE.body} numberOfLines={2} style={styles.deploymentObjective}>
        {incompatible
          ? formatIncompatibleContractDeployConsequence(contract, sectorDisplayName)
          : formatCompactContractObjective(contract)}
      </TerminalText>
      {incompatible ? (
        <TerminalText size={TYPE.body} numberOfLines={2} style={styles.deploymentObjective}>
          {formatCompactContractValidSectors(contract)}
        </TerminalText>
      ) : null}
      <TerminalText size={TYPE.body} style={styles.deploymentPayout}>
        {formatCompactContractPayout(contract)}
      </TerminalText>
    </View>
  );
}

function BreachGradeSelector({
  selectedGrade,
  onSelect,
  progressionProfile,
}: {
  selectedGrade: BreachGradeId;
  onSelect: (grade: BreachGradeId) => void;
  progressionProfile: ReturnType<typeof getAccountProgressionProfile>;
}): React.JSX.Element {
  return (
    <View>
      <TerminalText size={TYPE.label} letterSpacing={1} style={[styles.sectionLabel, { marginBottom: 8 }]}>
        BREACH GRADE
      </TerminalText>
      <View style={styles.breachGradeOptions}>
        {PLAYABLE_BREACH_GRADES.map((grade) => {
          const unlocked = isBreachGradeUnlockedInProfile(progressionProfile, grade);
          const selected = unlocked && grade === selectedGrade;
          return (
            <HapticPressable
              key={grade}
              onPress={() => onSelect(grade)}
              disabled={!unlocked}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !unlocked }}
              {...(Platform.OS === 'web'
                ? ({ 'aria-pressed': selected } as object)
                : {})}
              style={({ pressed }) => ([
                styles.breachGradeOption,
                selected && styles.breachGradeOptionSelected,
                !unlocked && styles.breachGradeOptionDisabled,
                pressed && unlocked ? { opacity: 0.85 } : null,
              ])}
            >
              <TerminalText
                size={TYPE.cta}
                letterSpacing={1}
                style={{
                  color: selected
                    ? RAIL.terminalBright
                    : unlocked
                      ? RAIL.textMuted
                      : 'rgba(213, 223, 220, 0.35)',
                  fontWeight: '800',
                  textAlign: 'center',
                }}
              >
                {grade}
              </TerminalText>
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

/** Right-side Sector Dossier mission rail. */
export default function SectorBriefingPanel({
  theme: _theme,
  sector,
  selectedContract,
  sectorCompatibility,
  sectorUnlocked,
  breachDisabled,
  launching,
  gradeMeetsContract,
  gradeWarning,
  onRequestDeploy,
}: SectorBriefingPanelProps): React.JSX.Element {
  const { isCompactHeight, isUltraCompactHeight } = useVeilFrontLayout();
  const { persisted, setSelectedBreachGrade } = useWorldState();
  const { account, activateSectorAccessMandate } = usePlayerAccount();

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
  const selectedBreachGrade = useMemo(
    () => resolveSelectedBreachGrade(progressionProfile, persisted.selectedBreachGrade),
    [persisted.selectedBreachGrade, progressionProfile],
  );
  const recoverables = useMemo(
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
    if (!isBreachGradeUnlockedInProfile(progressionProfile, grade)) return;
    setSelectedBreachGrade(grade);
  };

  const biomeVisual = VEIL_BIOME_VISUALS[sector.veilBiome];
  const op = sector.activeOperation;
  const opPct = operationProgressPercent(op.progressCurrent, op.progressRequired);
  const anchorActive = sector.activeAnchor != null;
  const summary = SECTOR_DOSSIER_SUMMARIES[sector.id]
    ?? SECTOR_FLAVOR_LINES[sector.id]
    ?? 'Breach vectors available. Local geometry remains unstable.';
  const objectiveLine = formatOperationObjectiveProgressLine(op.objectiveKind, op.progressRequired);

  const clearanceRoman = CLEARANCE_ROMAN[
    Math.max(0, Math.min(9, clearance.rank - 1))
  ] ?? String(clearance.rank);

  const actionLabel = launching
    ? '[ DEPLOYING... ]'
    : !sectorUnlocked
      ? '[ ACCESS DENIED ]'
      : !gradeMeetsContract
        ? '[ GRADE TOO LOW ]'
        : '[ INITIATE BREACH ]';

  const lockHeadline = mandateBriefing.mandateState === 'ACTIVE'
    ? 'LOCKED — MANDATE ACTIVE'
    : mandateBriefing.mandateState === 'AVAILABLE'
      ? 'LOCKED — MANDATE AVAILABLE'
      : 'ACCESS LOCKED';

  const heroHeight = isUltraCompactHeight ? 72 : isCompactHeight ? 82 : 100;
  const padX = isCompactHeight ? 22 : 28;
  const contractIncompatible = sectorCompatibility === 'UNAVAILABLE' && sectorUnlocked;

  return (
    <View style={styles.dossier}>
      <View style={[
        styles.header,
        {
          paddingHorizontal: padX,
          paddingTop: isCompactHeight ? 16 : 20,
          paddingBottom: isCompactHeight ? 12 : 16,
        },
      ]}
      >
        <TerminalText size={isCompactHeight ? 16.5 : TYPE.title} letterSpacing={0.7} style={styles.title}>
          {sector.displayName.replace(/^The\s+/i, '').toUpperCase()}
        </TerminalText>
        <TerminalText size={TYPE.meta} letterSpacing={0.9} style={styles.meta}>
          {`${biomeVisual.label.toUpperCase()} · CLEARANCE ${clearanceRoman}`}
        </TerminalText>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          {
            paddingHorizontal: padX,
            paddingTop: isCompactHeight ? 12 : 16,
            paddingBottom: isCompactHeight ? 12 : 16,
          },
        ]}
        showsVerticalScrollIndicator
        {...(Platform.OS === 'web'
          ? ({
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(105, 200, 173, 0.24) transparent',
              overscrollBehavior: 'contain',
            } as object)
          : null)}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image
            source={SECTOR_THUMB[sector.veilBiome]}
            style={[
              styles.heroImage,
              Platform.OS === 'web'
                ? ({
                    objectPosition: SECTOR_THUMB_POSITION[sector.veilBiome],
                    filter: 'saturate(0.82) contrast(1.08) brightness(0.76)',
                  } as ImageStyle)
                : null,
            ]}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} pointerEvents="none" />
        </View>

        <TerminalText size={TYPE.body} numberOfLines={2} style={styles.description}>
          {summary}
        </TerminalText>

        <View style={[styles.section, isCompactHeight && styles.sectionCompact]}>
          <TerminalText size={TYPE.label} letterSpacing={1} style={styles.sectionLabel}>
            CONDITIONS
          </TerminalText>
          <View style={styles.conditions}>
            <SectorConditionRow
              label="THREAT"
              value={hazardLabel(sector.hazardLevel).toUpperCase()}
              tone={sector.hazardLevel >= 3 ? 'danger' : 'neutral'}
              compact={isCompactHeight}
            />
            <SectorConditionRow
              label="YIELD"
              value={rewardLabel(sector.rewardLevel).toUpperCase()}
              tone="reward"
              compact={isCompactHeight}
            />
            <SectorConditionRow
              label="ANCHOR"
              value={anchorActive ? 'ACTIVE' : 'NONE'}
              tone={anchorActive ? 'anchor' : 'neutral'}
              compact={isCompactHeight}
            />
          </View>
        </View>

        <ActiveOperationSummary
          title={op.title.toUpperCase()}
          objectiveLine={objectiveLine}
          percent={opPct}
          compact={isCompactHeight}
        />

        {recoverables.length > 0 ? (
          <View style={[styles.section, isCompactHeight && styles.sectionCompact]}>
            <TerminalText size={TYPE.label} letterSpacing={1} style={styles.sectionLabel}>
              LIKELY RECOVERABLES
            </TerminalText>
            <TerminalText size={TYPE.body} letterSpacing={0.5} style={styles.recoverableItem}>
              {recoverables.join(' · ')}
            </TerminalText>
          </View>
        ) : null}

        <DeploymentContractSummary
          selectedContract={selectedContract}
          sectorCompatibility={sectorCompatibility}
          sectorDisplayName={sector.displayName}
        />
      </ScrollView>

      <View
        style={[
          styles.decision,
          {
            paddingHorizontal: padX,
            paddingTop: isCompactHeight ? 12 : 14,
            paddingBottom: isCompactHeight ? 14 : 18,
          },
        ]}
      >
        {!sectorUnlocked ? (
          <View style={styles.lockNotice}>
            <TerminalText size={TYPE.label} letterSpacing={0.7} style={styles.lockNoticeTitle}>
              {lockHeadline}
            </TerminalText>
            <TerminalText size={TYPE.body} style={styles.lockNoticeDetail}>
              {mandateBriefing.mandate?.summary
                ?? 'Route unknown. Clearance and mandate requirements apply.'}
            </TerminalText>
            {mandateBriefing.canAcceptMandate ? (
              <HapticPressable
                onPress={() => activateSectorAccessMandate(sector.id)}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <TerminalText size={TYPE.body} letterSpacing={0.5} style={{ color: RAIL.terminal, fontWeight: '800' }}>
                  [ ACCEPT ACCESS MANDATE ]
                </TerminalText>
              </HapticPressable>
            ) : null}
          </View>
        ) : !gradeMeetsContract && gradeWarning ? (
          <TerminalText size={TYPE.label} style={styles.quietConsequenceWarn}>
            {gradeWarning}
          </TerminalText>
        ) : contractIncompatible ? (
          <TerminalText size={TYPE.label} style={styles.quietConsequenceWarn}>
            THIS DEPLOYMENT WILL FAIL THE CURRENT CONTRACT
          </TerminalText>
        ) : null}

        <BreachGradeSelector
          selectedGrade={selectedBreachGrade}
          onSelect={handleSelectGrade}
          progressionProfile={progressionProfile}
        />

        <HapticPressable
          onPress={onRequestDeploy}
          disabled={breachDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: breachDisabled }}
          style={({ pressed }) => ([
            styles.initiateBreach,
            isCompactHeight && styles.initiateBreachCompact,
            breachDisabled && styles.initiateBreachDisabled,
            pressed && !breachDisabled ? { transform: [{ translateY: 1 }] } : null,
          ])}
        >
          <TerminalText
            size={TYPE.cta}
            letterSpacing={1.2}
            style={{
              color: breachDisabled ? 'rgba(213, 223, 220, 0.38)' : '#06110e',
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            {actionLabel}
          </TerminalText>
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dossier: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: RAIL.bg,
    borderLeftWidth: 1,
    borderLeftColor: RAIL.lineStrong,
    ...Platform.select({
      web: {
        backgroundImage: `linear-gradient(180deg, rgba(14, 27, 25, 0.2) 0%, rgba(3, 7, 8, 0) 26%), ${RAIL.bg}`,
        boxShadow: '-18px 0 42px rgba(0, 0, 0, 0.22), inset 1px 0 rgba(255, 255, 255, 0.015)',
      } as object,
      default: {},
    }),
  },
  header: {
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: RAIL.line,
  },
  title: {
    color: RAIL.textPrimary,
    fontWeight: '600',
    lineHeight: 32,
  },
  meta: {
    marginTop: 4,
    color: RAIL.terminal,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  bodyContent: {
    flexGrow: 1,
  },
  hero: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: RAIL.line,
    backgroundColor: '#050a0a',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 6, 0.28)',
  },
  description: {
    marginTop: 12,
    maxWidth: 360,
    color: RAIL.textSecondary,
    lineHeight: 21,
  },
  section: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: RAIL.line,
  },
  sectionCompact: {
    marginTop: 12,
    paddingTop: 10,
  },
  sectionLabel: {
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  conditions: {
    marginTop: 8,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RAIL.lineSoft,
    paddingVertical: 5,
  },
  conditionRowCompact: {
    minHeight: 26,
  },
  conditionLabel: {
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  conditionValue: {
    fontWeight: '800',
    textAlign: 'right',
  },
  activeOperation: {
    marginTop: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    paddingLeft: 16,
    backgroundColor: 'rgba(105, 200, 173, 0.05)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(105, 200, 173, 0.58)',
  },
  activeOperationCompact: {
    marginTop: 12,
    paddingVertical: 10,
  },
  activeOperationTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeOperationPct: {
    color: RAIL.terminal,
    fontWeight: '700',
  },
  activeOperationTitle: {
    marginTop: 7,
    color: RAIL.textPrimary,
    fontWeight: '700',
  },
  activeOperationObjective: {
    marginTop: 3,
    color: RAIL.textSecondary,
    lineHeight: 18,
  },
  activeOperationTrack: {
    marginTop: 10,
  },
  recoverableItem: {
    marginTop: 8,
    color: RAIL.textSecondary,
    fontWeight: '600',
  },
  deploymentContract: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(126, 151, 160, 0.04)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(126, 151, 160, 0.32)',
  },
  deploymentContractCompatible: {
    borderLeftColor: 'rgba(105, 200, 173, 0.5)',
  },
  deploymentContractIncompatible: {
    backgroundColor: 'rgba(201, 98, 98, 0.04)',
    borderLeftColor: 'rgba(201, 98, 98, 0.58)',
  },
  deploymentTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deploymentStatus: {
    color: '#8fa39f',
    fontWeight: '800',
  },
  deploymentStatusCompatible: {
    color: RAIL.terminal,
  },
  deploymentStatusIncompatible: {
    color: RAIL.incompat,
  },
  deploymentIdentity: {
    marginTop: 8,
    color: RAIL.textPrimary,
    fontWeight: '700',
    lineHeight: 19,
  },
  deploymentObjective: {
    marginTop: 4,
    color: RAIL.textSecondary,
    lineHeight: 18,
  },
  deploymentPayout: {
    marginTop: 6,
    color: '#aebdb9',
    fontVariant: ['tabular-nums'],
  },
  decision: {
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: RAIL.lineStrong,
    backgroundColor: 'rgba(3, 7, 8, 0.96)',
  },
  quietConsequence: {
    marginBottom: 12,
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  quietConsequenceWarn: {
    marginBottom: 12,
    color: RAIL.incompat,
    fontWeight: '700',
  },
  lockNotice: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(201, 98, 98, 0.055)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(201, 98, 98, 0.6)',
  },
  lockNoticeTitle: {
    color: '#d59a95',
    fontWeight: '800',
  },
  lockNoticeDetail: {
    marginTop: 4,
    color: RAIL.textMuted,
    lineHeight: 18,
  },
  breachGradeOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  breachGradeOption: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(110, 145, 137, 0.035)',
    borderWidth: 1,
    borderColor: RAIL.line,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  breachGradeOptionSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.09)',
    borderColor: 'rgba(105, 200, 173, 0.62)',
  },
  breachGradeOptionDisabled: {
    opacity: 0.35,
    ...Platform.select({
      web: { cursor: 'not-allowed' } as object,
      default: {},
    }),
  },
  initiateBreach: {
    width: '100%',
    minHeight: 58,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RAIL.terminal,
    borderWidth: 1,
    borderColor: RAIL.terminalBright,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 0 20px rgba(105, 200, 173, 0.11), inset 0 1px rgba(255, 255, 255, 0.18)',
        outlineStyle: 'none',
      } as object,
      default: {},
    }),
  },
  initiateBreachCompact: {
    minHeight: 52,
  },
  initiateBreachDisabled: {
    backgroundColor: 'rgba(116, 139, 134, 0.08)',
    borderColor: 'rgba(116, 139, 134, 0.18)',
    ...Platform.select({
      web: {
        cursor: 'not-allowed',
        boxShadow: 'none',
      } as object,
      default: {},
    }),
  },
});
