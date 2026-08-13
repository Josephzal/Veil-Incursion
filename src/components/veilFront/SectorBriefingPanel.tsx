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
import HubDossierCornerBrackets from '../hub/HubDossierCornerBrackets';
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
import { getEquippedWeaponForClass } from '../../data/weaponProgressionEngine';
import {
  getWeaponPlayerFacingSummary,
  resolveWeaponSectorPressureNote,
} from '../../data/weaponPlayerFacing/weaponPlayerFacingEngine';
import { VEIL } from '../../theme/veilTerminalTokens';
import {
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_DOSSIER_FOOTER_BG,
  HUB_DOSSIER_FOOTER_RULE,
  HUB_DOSSIER_LABEL,
  HUB_DOSSIER_SURFACE,
  HUB_DOSSIER_TITLE,
  hubDossierShellStyle,
  hubInspectorFocusBarStyle,
  HUB_META,
  HUB_SELECT_SURFACE,
  HUB_TEXT_PRIMARY,
  HUB_TEXT_SECONDARY,
} from '../../theme/hubPanelSurfaces';
import { OccultNeonRail } from '../hub/veilChrome';
import HubPrimaryCta from '../hub/HubPrimaryCta';

import CityStreets from '../../../assets/images/environment images/citystreets.png';
import CityBuilding from '../../../assets/images/environment images/city_building.png';
import Backroads from '../../../assets/images/environment images/backroads.png';
import Underground from '../../../assets/images/environment images/underground.png';
import Blacksite from '../../../assets/images/environment images/blacksite.png';

/** Deployment dossier rail — Contract Board hub surfaces (map untouched). */
const RAIL = {
  bg: HUB_DOSSIER_SURFACE,
  textPrimary: HUB_TEXT_PRIMARY,
  textSecondary: HUB_TEXT_SECONDARY,
  textMuted: HUB_META,
  terminal: VEIL.mint,
  terminalBright: VEIL.mintBright,
  danger: VEIL.blood,
  incompat: VEIL.riskHigh,
  /** Active states use mint — violet reserved for the dossier edge rail. */
  anchor: VEIL.mint,
  line: VEIL.lineFaint,
  lineStrong: HUB_CARD_BORDER,
  lineSoft: 'rgba(27, 33, 31, 0.55)',
  label: HUB_DOSSIER_LABEL,
} as const;

/** Base sizes chosen so desktop scaleFont(~1.35–1.65) lands near the readability targets. */
const TYPE = {
  label: 7,
  body: 8.5,
  bodyEm: 9,
  meta: 7.5,
  title: 19,
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
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionBoneRule} />
          <TerminalText size={TYPE.label} letterSpacing={1.05} style={styles.sectionLabel}>
            ACTIVE OPERATION
          </TerminalText>
        </View>
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
          height={2}
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
      <TerminalText size={TYPE.label} letterSpacing={1.05} style={[styles.sectionLabel, { marginBottom: 10 }]}>
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
                      : 'rgba(198, 206, 202, 0.52)',
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

  const chassisPressure = useMemo(() => {
    const familyId = getEquippedWeaponForClass({
      weaponUnlocks: account.weaponUnlocks,
      equippedWeaponByClass: account.equippedWeaponByClass,
    }, account.activeClass);
    if (!familyId) return null;
    const facing = getWeaponPlayerFacingSummary(familyId);
    const note = resolveWeaponSectorPressureNote(familyId, sector.id, 1);
    return { facing, note };
  }, [
    account.activeClass,
    account.equippedWeaponByClass,
    account.weaponUnlocks,
    sector.id,
  ]);

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

  const heroHeight = isUltraCompactHeight ? 72 : isCompactHeight ? 82 : 96;
  const padX = isCompactHeight ? 22 : 28;
  const contractIncompatible = sectorCompatibility === 'UNAVAILABLE' && sectorUnlocked;

  return (
    <View style={styles.dossier}>
      <HubDossierCornerBrackets />
      <View style={[
        styles.header,
        {
          paddingHorizontal: padX,
          paddingTop: isCompactHeight ? 16 : 22,
          paddingBottom: isCompactHeight ? 12 : 16,
        },
      ]}
      >
        <OccultNeonRail style={styles.dossierAccent} />
        <TerminalText size={7} letterSpacing={1.05} style={styles.eyebrow}>
          SECTOR DOSSIER
        </TerminalText>
        <TerminalText size={isCompactHeight ? 16.5 : TYPE.title} letterSpacing={0.1} style={styles.title}>
          {sector.displayName.replace(/^The\s+/i, '').toUpperCase()}
        </TerminalText>
        <TerminalText size={TYPE.meta} letterSpacing={0.85} style={styles.meta}>
          {`${biomeVisual.label.toUpperCase()} · CLEARANCE ${clearanceRoman}`}
        </TerminalText>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          {
            paddingHorizontal: padX,
            paddingTop: isCompactHeight ? 8 : 10,
            paddingBottom: isCompactHeight ? 14 : 18,
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
                    filter: 'saturate(0.88) contrast(1.14) brightness(0.92)',
                  } as ImageStyle)
                : null,
            ]}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} pointerEvents="none" />
        </View>

        <TerminalText size={TYPE.body} lineHeight={14} numberOfLines={3} style={styles.description}>
          {summary}
        </TerminalText>

        <View style={[styles.section, isCompactHeight && styles.sectionCompact]}>
          <View style={styles.sectionLabelRow}>
            <View style={styles.sectionBoneRule} />
            <TerminalText size={TYPE.label} letterSpacing={1.05} style={styles.sectionLabel}>
              CONDITIONS
            </TerminalText>
          </View>
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

        {chassisPressure ? (
          <View style={[styles.section, isCompactHeight && styles.sectionCompact]}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionBoneRule} />
              <TerminalText size={TYPE.label} letterSpacing={1.05} style={styles.sectionLabel}>
                CHASSIS BRIEF
              </TerminalText>
            </View>
            <TerminalText size={TYPE.body} style={styles.recoverableItem}>
              {`${chassisPressure.facing.displayName.toUpperCase()} · ${chassisPressure.facing.roleLabel.toUpperCase()}`}
            </TerminalText>
            {chassisPressure.note.advantage ? (
              <TerminalText size={TYPE.body} style={[styles.recoverableItem, { marginTop: 4 }]}>
                {`ADVANTAGE — ${chassisPressure.note.advantage}`}
              </TerminalText>
            ) : null}
            {chassisPressure.note.pressure ? (
              <TerminalText size={TYPE.body} style={[styles.recoverableItem, { marginTop: 4, color: RAIL.textSecondary }]}>
                {`PRESSURE — ${chassisPressure.note.pressure}`}
              </TerminalText>
            ) : null}
            <TerminalText size={TYPE.body} style={[styles.recoverableItem, { marginTop: 4, color: RAIL.textSecondary }]}>
              {chassisPressure.note.preparation
                ?? chassisPressure.note.fallbackNeutral}
            </TerminalText>
            <TerminalText size={TYPE.label} letterSpacing={0.5} style={[styles.sectionLabel, { marginTop: 8, opacity: 0.7 }]}>
              Sector-level planning only — not a roster reveal.
            </TerminalText>
          </View>
        ) : null}

        <ActiveOperationSummary
          title={op.title.toUpperCase()}
          objectiveLine={objectiveLine}
          percent={opPct}
          compact={isCompactHeight}
        />

        {recoverables.length > 0 ? (
          <View style={[styles.section, isCompactHeight && styles.sectionCompact]}>
            <View style={styles.sectionLabelRow}>
              <View style={styles.sectionBoneRule} />
              <TerminalText size={TYPE.label} letterSpacing={1.05} style={styles.sectionLabel}>
                LIKELY RECOVERABLES
              </TerminalText>
            </View>
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
            paddingTop: isCompactHeight ? 10 : 12,
            paddingBottom: isCompactHeight ? 12 : 14,
          },
        ]}
      >
        <View style={styles.decisionRule} />
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

        <HubPrimaryCta
          label={actionLabel}
          onPress={onRequestDeploy}
          disabled={breachDisabled}
          accessibilityLabel={actionLabel}
          minHeight={isCompactHeight ? 50 : 52}
          style={styles.initiateBreach}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dossier: {
    ...hubDossierShellStyle(),
  },
  header: {
    position: 'relative',
    flexShrink: 0,
    zIndex: 1,
    overflow: 'visible',
  },
  dossierAccent: {
    ...hubInspectorFocusBarStyle(),
  },
  eyebrow: {
    color: VEIL.textDim,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: HUB_DOSSIER_TITLE,
    fontWeight: '700',
    lineHeight: 23,
  },
  meta: {
    marginTop: 6,
    color: HUB_META,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  bodyContent: {
    flexGrow: 0,
    justifyContent: 'flex-start',
  },
  hero: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    backgroundColor: HUB_CARD_SURFACE,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 6, 0.12)',
  },
  description: {
    marginTop: 12,
    marginBottom: 2,
    maxWidth: 360,
    color: HUB_TEXT_PRIMARY,
  },
  section: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VEIL.line,
  },
  sectionCompact: {
    marginTop: 16,
    paddingTop: 12,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionBoneRule: {
    width: 2,
    height: 12,
    backgroundColor: VEIL.bone,
    opacity: 0.55,
  },
  sectionLabel: {
    color: HUB_DOSSIER_LABEL,
    fontWeight: '700',
  },
  conditions: {
    marginTop: 10,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RAIL.lineSoft,
    paddingVertical: 4,
  },
  conditionRowCompact: {
    minHeight: 24,
  },
  conditionLabel: {
    color: HUB_META,
    fontWeight: '700',
  },
  conditionValue: {
    fontWeight: '800',
    textAlign: 'right',
  },
  activeOperation: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
  },
  activeOperationCompact: {
    marginTop: 16,
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
    marginTop: 8,
    color: VEIL.text,
    fontWeight: '700',
  },
  activeOperationObjective: {
    marginTop: 4,
    color: HUB_TEXT_PRIMARY,
    lineHeight: 14,
  },
  activeOperationTrack: {
    marginTop: 10,
  },
  recoverableItem: {
    marginTop: 10,
    color: HUB_TEXT_PRIMARY,
    fontWeight: '600',
    lineHeight: 14,
  },
  deploymentContract: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
  },
  deploymentContractCompatible: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  deploymentContractIncompatible: {
    backgroundColor: 'rgba(163, 92, 102, 0.06)',
    borderColor: 'rgba(163, 92, 102, 0.4)',
  },
  deploymentTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  deploymentStatus: {
    color: HUB_META,
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
    color: VEIL.text,
    fontWeight: '700',
    lineHeight: 14,
  },
  deploymentObjective: {
    marginTop: 4,
    color: HUB_TEXT_PRIMARY,
    lineHeight: 14,
  },
  deploymentPayout: {
    marginTop: 6,
    color: HUB_META,
    fontVariant: ['tabular-nums'],
  },
  decision: {
    position: 'relative',
    flexShrink: 0,
    zIndex: 2,
    backgroundColor: HUB_DOSSIER_FOOTER_BG,
  },
  decisionRule: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: HUB_DOSSIER_FOOTER_RULE,
  },
  quietConsequence: {
    marginBottom: 10,
    color: RAIL.textMuted,
    fontWeight: '700',
  },
  quietConsequenceWarn: {
    marginBottom: 10,
    color: RAIL.incompat,
    fontWeight: '700',
  },
  lockNotice: {
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(163, 92, 102, 0.055)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(163, 92, 102, 0.6)',
  },
  lockNoticeTitle: {
    color: '#B8898F',
    fontWeight: '800',
  },
  lockNoticeDetail: {
    marginTop: 4,
    color: RAIL.textMuted,
    lineHeight: 14,
  },
  breachGradeOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  breachGradeOption: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VEIL.surface3,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  breachGradeOptionSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  breachGradeOptionDisabled: {
    opacity: 0.55,
    backgroundColor: 'rgba(185, 181, 167, 0.03)',
    borderColor: 'rgba(185, 181, 167, 0.16)',
    ...Platform.select({
      web: { cursor: 'not-allowed' } as object,
      default: {},
    }),
  },
  initiateBreach: {
    marginTop: 10,
  },
});
