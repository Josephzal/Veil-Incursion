import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import { useGameFlow } from '../../context/GameFlowContext';
import { useRun } from '../../context/RunContext';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useWorldState } from '../../context/WorldStateContext';
import { formatCareerCargoRoutingDebugSnapshot } from '../../data/postRunCargoRoutingRunState';
import {
  formatPostRunCargoRoutingValidationReport,
  validateCareerCargoRoutingStats,
} from '../../data/postRunCargoRoutingValidation';
import {
  buildDevRoutingDebriefLaunchPayload,
  buildMinimalDevIncursion,
  POST_RUN_ROUTING_TEST_LEDGER,
} from '../../data/postRunCargoRoutingDebugEngine';
import {
  debugForceBribeOfferOnNextRouting,
  debugPreviewBribeOffers,
  debugPrintBetrayalAccountSnapshot,
  debugSimulateBetrayalFence,
  debugSimulateContributeContractCargo,
  debugSimulateKeepContractCargo,
  debugSimulateRivalDelivery,
  debugValidateBetrayalOffers,
} from '../../data/betrayalDebugEngine';
import {
  debugForceDeepVeilLaw,
  debugForceEncounterModifier,
  debugForceTwistedTemplate,
  debugForceVeilDistortion,
  debugPreviewDepthIdentity,
  debugPrintDistortionCatalog,
  debugPrintEncounterModifierCatalog,
  debugPrintLawCatalog,
  debugPrintTwistedTemplateCatalog,
  debugPrintDepthEnemyVariantCatalog,
  debugValidateDepthEnemyVariants,
  debugPrintScannerLabelCertaintyCatalog,
  debugValidateScannerLabelCertainty,
  debugForceDepthEnemyVariant,
  debugPrintBiomeDepthPools,
  debugPrintSectorDepthFlavor,
  debugSimulateDepthIdentityGeneration,
  debugListMissingTwistedTemplates,
  debugValidatePhaseG,
  debugValidateDepthIdentity,
} from '../../data/depthIdentityDebugEngine';
import {
  debugForceCompositionTemplate,
  debugPrintCompositionRoles,
  debugPrintCompositionTemplates,
  debugPreviewCompositionWarningCard,
  debugSimulateCompositionMatrix,
  debugSimulateCompositionSectorRun,
  debugValidateEncounterComposition,
  formatCompositionContentReport,
} from '../../data/encounterCompositionDebugEngine';
import {
  ALL_DEEP_VEIL_LAW_IDS,
  ALL_VEIL_DISTORTION_IDS,
} from '../../data/depthIdentityCatalog';
import { ALL_ENCOUNTER_MODIFIER_IDS } from '../../data/encounterModifierCatalog';
import { ALL_TWISTED_TEMPLATE_IDS } from '../../data/twistedTemplateCatalog';
import { ALL_DEPTH_ENEMY_VARIANT_KEYS } from '../../data/depthEnemyVariantCatalog';
import { buildDepthIdentityRollContext } from '../../data/veilDistortionEngine';
import {
  debugForceAppraisalBand,
  debugForceOpenTier,
  debugForceSpecimenJarTier,
  debugPreviewSealedStash,
  debugResourceEconomyReport,
  debugSimulateOpenRolls,
  debugSimulateSpecimenJarOpenRolls,
  debugValidateSealedCargo,
} from '../../data/sealedCargoDebugEngine';
import { SECTOR_WORLD_TEMPLATES } from '../../data/sectorWorldCatalog';
import ExplorationHubPanel from '../ExplorationHubPanel';
import HubScreenShell, { HubSectionHeader } from './HubScreenShell';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import type { DevSandboxPreset } from '../../types/devSandbox';
import type { OperationObjectiveKind, SectorId } from '../../types/worldState';
import { generateContractForObjectiveKind } from '../../data/contractGenerator';
import { freezeContractForRun } from '../../types/contract';
import {
  formatBracketHeader,
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../../styles/hubTerminalUi';
import {
  ALL_KEEPSAKE_IDS,
  getKeepsakeDefinition,
} from '../../data/expeditionKeepsakeRegistry';
import {
  formatKeepsakeDebugValidation,
  formatKeepsakeAcceptanceDebugReport,
} from '../../data/expeditionKeepsakeDebugEngine';
import {
  resolveKeepsakeDeploymentWarnings,
} from '../../data/expeditionKeepsakeDeploymentEngine';
import {
  formatRunItemAcceptanceDebugReport,
  formatRunItemDebugValidation,
  formatRunItemMarketSimulationReport,
  formatRunItemRecipeGapReport,
} from '../../data/runItemDebugEngine';
import { ALL_RUN_ITEM_IDS, type RunItemId } from '../../types/runItem';
import {
  buildFullRunLoopAudit,
  formatRunLoopAuditReport,
} from '../../data/runIntegration/runLoopAuditEngine';
import { formatContentMatrixReport } from '../../data/runIntegration/contentMatrixEngine';
import {
  ALLOWED_NODES_PER_DISTRICT,
  formatRunPacingDebugSummary,
  setNodesPerDistrictForTesting,
  type NodesPerDistrictPreset,
} from '../../data/runIntegration/runPacingConfig';
import { formatRunBalanceTelemetryReport, buildRunBalanceTelemetry } from '../../data/runIntegration/runBalanceTelemetryEngine';
import {
  formatBalanceConfigSummary,
  formatBalanceDashboard,
  formatBalanceSimulationBundle,
  formatBalanceValidationReport,
  formatContractGenerationReport,
  formatCraftingAffordabilityReport,
  formatEncounterDistributionReport,
  formatOperationProgressReport,
  formatRewardRollsReport,
  formatRunResourceIncomeReport,
  formatRunTreeGenerationReport,
  formatSealedOpenBalanceReport,
} from '../../data/balance';
import {
  formatWeaponValidationReport,
  validateWeaponRegistry,
  debugPrintEquippedWeapons,
} from '../../data/weaponValidationEngine';

interface SandboxLaunchButtonProps {
  label: string;
  onPress: () => void;
  accentColor: string;
}

function SandboxLaunchButton({ label, onPress, accentColor }: SandboxLaunchButtonProps): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      style={({ pressed }) => [
        getInteractiveButtonStyle(accentColor, { pressed, size: 'sm' }),
        styles.launchBtn,
      ]}
    >
      <Text style={[getInteractiveButtonTextStyle('sm'), { color: accentColor }]}>
        {label}
      </Text>
    </HapticPressable>
  );
}

/** Dev-only hub utilities — isolated node previews for QA. */
export default function DevTestHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    startCombat,
    startNarrative,
    startRest,
    startBlackMarket,
    startExtractionReview,
    startSafehouse,
    startResourceHarvest,
    startOperationDebrief,
  } = useGameFlow();
  const {
    activeIncursion,
    startDevSandboxNode,
    devQueueEchoOverlay,
    devQueueEchoEncounterKind,
    devQueueHostileEchoTemplate,
    devLogEchoRunState,
    devLogCargoRoutingRunState,
    devLogKeepsakeRunState,
    devPreviewKeepsakeDebrief,
    devLogRunItemRunState,
    devPreviewRunItemDebrief,
    devValidateRunItemPipeline,
    devValidateRunItemAcceptance,
    devGrantAllRunItems,
    devGrantRunItem,
    devPreviewEchoDebrief,
    devValidateEchoPipeline,
    devPreviewPostRunRouting,
    devSimulatePostRunRoutingSell,
    devSimulatePostRunRoutingDeliver,
    devSimulatePostRunRoutingContribute,
    devSimulatePostRunRoutingOpenCaskets,
    devSimulatePostRunRoutingPartialDogTags,
    devPreviewPostRunDebrief,
    devValidatePostRunRouting,
    devAuditPostRunRouting,
    devSimulateDeathRouting,
    devSimulateBankThenDeathRouting,
    devInjectRoutingTestCargo,
    devSetActiveContract,
  } = useRun();
  const {
    account,
    setEquippedKeepsake,
    unlockAllKeepsakes,
    setKeepsakeAttunement,
    setKeepsakeRouteDoctrine,
    setKeepsakeMirrorCategory,
    unlockAllWeaponFamilies,
    resetWeaponFamilies,
    grantWeaponUnlockResources,
    equipWeaponFamily,
    upgradeWeaponFamilyTier,
    appendHubLog,
    grantSealedCasketInHub,
    grantSpecimenJarInHub,
    grantExpansionResourcesInHub,
  } = usePlayerAccount();
  const {
    selectedSector,
    persisted,
    sectors,
    runGenerationContext,
    setSelectedSectorId,
    setPendingDebrief,
    tickAfterRunComplete,
    devRegenerateAllOperations,
    devForceSectorOperation,
    devSimulateContribution,
    devForceOperationCompletion,
    devSetAnchorDormant,
    devClearAnchorDormant,
    devForceRoutingTestContract,
    devGetValidationReport,
    devGetDebugSnapshot,
  } = useWorldState();
  const [hubOpen, setHubOpen] = useState(false);
  const [debugReport, setDebugReport] = useState<string | null>(null);
  const keyColor = hubKeyColor(theme.mutedColor);

  const operationKinds = useMemo<OperationObjectiveKind[]>(() => [
    'EXTRACTION_SURGE',
    'RESOURCE_SURVEY',
    'ANCHOR_ASSAULT',
    'BOSS_SUPPRESSION',
    'ECHO_RECOVERY',
  ], []);

  const sandboxConfig = useMemo(() => ({
    activeClass: account.activeClass,
    aegisLoadout: account.aegisLoadout,
    hexShotLoadout: account.hexShotLoadout,
    envoyLoadout: account.envoyLoadout,
    alignedFaction: account.alignedFaction,
  }), [
    account.activeClass,
    account.aegisLoadout,
    account.envoyLoadout,
    account.alignedFaction,
    account.hexShotLoadout,
  ]);

  const launchSandbox = useCallback((
    preset: DevSandboxPreset,
    navigate: () => void,
  ) => {
    startDevSandboxNode(preset, sandboxConfig);
    navigate();
  }, [sandboxConfig, startDevSandboxNode]);

  const showValidationReport = useCallback(() => {
    setDebugReport(devGetValidationReport());
  }, [devGetValidationReport]);

  const showDebugSnapshot = useCallback(() => {
    setDebugReport([
      devGetDebugSnapshot(),
      formatCareerCargoRoutingDebugSnapshot(account.careerCargoRouting),
      `equipped relic: ${account.equippedKeepsakeId ?? 'none'}`,
      `deployment attunement: ${account.keepsakeDeployment.attunement ?? 'none'}`,
      `deployment doctrine: ${account.keepsakeDeployment.routeDoctrine ?? 'none'}`,
      `deployment mirror: ${account.keepsakeDeployment.mirrorCategory ?? 'none'}`,
      `unlocked relics: ${account.unlockedKeepsakeIds.length}`,
    ].join('\n\n'));
  }, [
    account.careerCargoRouting,
    account.equippedKeepsakeId,
    account.keepsakeDeployment.attunement,
    account.keepsakeDeployment.routeDoctrine,
    account.keepsakeDeployment.mirrorCategory,
    account.unlockedKeepsakeIds.length,
    devGetDebugSnapshot,
  ]);

  const forceRoutingContract = useCallback((
    kind: 'RECOVER_ECONOMY_INTEL' | 'RECOVER_CONTRABAND',
  ) => {
    const onBoard = persisted.contractBoard.contracts.find((contract) => contract.objectiveKind === kind);
    const contract = onBoard ?? generateContractForObjectiveKind(kind, persisted.deployRunIndex);
    if (!contract) {
      setDebugReport(`ROUTING CONTRACT — failed to resolve ${kind}.`);
      return;
    }
    devForceRoutingTestContract(kind);
    if (activeIncursion.isRunActive) {
      devSetActiveContract(freezeContractForRun({
        kind: 'SPONSOR',
        contract,
        selectedAtRunIndex: persisted.deployRunIndex,
      }));
    }
    setDebugReport(`ROUTING CONTRACT — selected ${contract.title} (${contract.objectiveKind}).`);
  }, [
    activeIncursion.isRunActive,
    devForceRoutingTestContract,
    devSetActiveContract,
    persisted.contractBoard.contracts,
    persisted.deployRunIndex,
  ]);

  const launchRoutingDebriefPreview = useCallback(() => {
    if (!runGenerationContext) {
      setDebugReport('ROUTING DEBRIEF LAUNCH — no run generation context for selected sector.');
      return;
    }
    const baseIncursion = activeIncursion.isRunActive
      ? activeIncursion
      : buildMinimalDevIncursion(runGenerationContext);
    const payload = buildDevRoutingDebriefLaunchPayload(
      baseIncursion,
      runGenerationContext,
      POST_RUN_ROUTING_TEST_LEDGER,
    );
    if (!payload) {
      setDebugReport('ROUTING DEBRIEF LAUNCH — failed to build debrief payload.');
      return;
    }
    setPendingDebrief(payload);
    startOperationDebrief();
    setDebugReport('ROUTING DEBRIEF LAUNCH — opened OperationDebriefScreen with test cargo.');
  }, [activeIncursion, runGenerationContext, setPendingDebrief, startOperationDebrief]);

  const selectSector = useCallback((sectorId: SectorId) => {
    setSelectedSectorId(sectorId);
    setDebugReport(`Selected sector: ${sectorId}`);
  }, [setSelectedSectorId]);

  if (hubOpen) {
    return (
      <HubScreenShell title="DEV TEST // EXPLORATION HUB" scrollable>
        <HapticPressable
          onPress={() => setHubOpen(false)}
          style={({ pressed }) => [
            getInteractiveButtonStyle(theme.statusColor, { pressed, size: 'sm' }),
            styles.backBtn,
          ]}
        >
          <Text style={[getInteractiveButtonTextStyle('sm'), { color: theme.statusColor }]}>
            [ RETURN TO TEST MENU ]
          </Text>
        </HapticPressable>
        <View style={styles.hubPanel}>
          <ExplorationHubPanel />
        </View>
      </HubScreenShell>
    );
  }

  return (
    <HubScreenShell
      title="DEV TEST // SANDBOX"
      subtitle="Isolated node previews — continue returns here."
      scrollable
    >
      <HubSectionHeader title="NARRATIVE // TENSION MINI-GAMES" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ SCAVENGE BAR ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('narrative-scavenge', startNarrative)}
        />
        <SandboxLaunchButton
          label="[ CONCEAL SLIDER ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('narrative-conceal', startNarrative)}
        />
        <SandboxLaunchButton
          label="[ GRID CIPHER ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('narrative-sigil', startNarrative)}
        />
      </View>

      <HubSectionHeader title="COMBAT // ENCOUNTER NODES" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ STANDARD COMBAT ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('standard-combat', startCombat)}
        />
        <SandboxLaunchButton
          label="[ ELITE COMBAT ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('elite-combat', startCombat)}
        />
        <SandboxLaunchButton
          label="[ EASY COMBAT ]"
          accentColor={theme.primaryColor}
          onPress={() => launchSandbox('combat-easy', startCombat)}
        />
        <SandboxLaunchButton
          label="[ HARD COMBAT ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('combat-hard', startCombat)}
        />
        <SandboxLaunchButton
          label="[ HOSTILE ECHO ]"
          accentColor={theme.statusColor}
          onPress={() => launchSandbox('hostile-echo-combat', startCombat)}
        />
      </View>

      <HubSectionHeader title="INCURSION // FIELD NODES" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ SANCTUARY ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('sanctuary', startRest)}
        />
        <SandboxLaunchButton
          label="[ EXTRACTION REVIEW ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('extraction', startExtractionReview)}
        />
        <SandboxLaunchButton
          label="[ BLACK MARKET ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('black-market', startBlackMarket)}
        />
        <SandboxLaunchButton
          label="[ INCURSION SAFEHOUSE ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('incursion-safehouse', startSafehouse)}
        />
        <SandboxLaunchButton
          label="[ RESOURCE HARVEST ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => launchSandbox('resource-harvest', startResourceHarvest)}
        />
      </View>

      <HubSectionHeader title="CARGO ROUTING // DEBUG" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ INJECT TEST CARGO ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devInjectRoutingTestCargo('FULL')}
        />
        <SandboxLaunchButton
          label="[ INJECT LEDGER ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devInjectRoutingTestCargo('LEDGER')}
        />
        <SandboxLaunchButton
          label="[ INJECT CASKET ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devInjectRoutingTestCargo('CASKET')}
        />
        <SandboxLaunchButton
          label="[ INJECT DOG TAGS ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devInjectRoutingTestCargo('DOG_TAGS')}
        />
        <SandboxLaunchButton
          label="[ FORCE INTEL CONTRACT ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => forceRoutingContract('RECOVER_ECONOMY_INTEL')}
        />
        <SandboxLaunchButton
          label="[ FORCE CONTRABAND CONTRACT ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => forceRoutingContract('RECOVER_CONTRABAND')}
        />
        <SandboxLaunchButton
          label="[ PREVIEW ROUTING ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devPreviewPostRunRouting())}
        />
        <SandboxLaunchButton
          label="[ SIM SELL ALL ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devSimulatePostRunRoutingSell())}
        />
        <SandboxLaunchButton
          label="[ SIM DELIVER ALL ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devSimulatePostRunRoutingDeliver())}
        />
        <SandboxLaunchButton
          label="[ SIM CONTRIBUTE ALL ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devSimulatePostRunRoutingContribute())}
        />
        <SandboxLaunchButton
          label="[ SIM OPEN CASKET ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devSimulatePostRunRoutingOpenCaskets())}
        />
        <SandboxLaunchButton
          label="[ SIM PARTIAL DOG TAGS ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devSimulatePostRunRoutingPartialDogTags())}
        />
        <SandboxLaunchButton
          label="[ FORCE BRIBE OFFERS ]"
          accentColor={WARNING_ACCENT}
          onPress={() => {
            debugForceBribeOfferOnNextRouting(true);
            setDebugReport(`${debugPreviewBribeOffers(activeIncursion)}\n\nForce bribe enabled for next routing preview.`);
          }}
        />
        <SandboxLaunchButton
          label="[ PREVIEW BRIBE OFFERS ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugPreviewBribeOffers(activeIncursion))}
        />
        <SandboxLaunchButton
          label="[ SIM RIVAL DELIVERY ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugSimulateRivalDelivery(activeIncursion, 'anomalous-core'))}
        />
        <SandboxLaunchButton
          label="[ SIM BETRAY FENCE ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugSimulateBetrayalFence(activeIncursion, 'anomalous-core'))}
        />
        <SandboxLaunchButton
          label="[ SIM KEEP CARGO ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugSimulateKeepContractCargo(activeIncursion, 'anomalous-core'))}
        />
        <SandboxLaunchButton
          label="[ SIM CONTRIBUTE CARGO ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugSimulateContributeContractCargo(activeIncursion, 'anomalous-core'))}
        />
        <SandboxLaunchButton
          label="[ VALIDATE BRIBES ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugValidateBetrayalOffers(activeIncursion))}
        />
        <SandboxLaunchButton
          label="[ BETRAYAL ACCOUNT LOG ]"
          accentColor={WARNING_ACCENT}
          onPress={() => setDebugReport(debugPrintBetrayalAccountSnapshot(account))}
        />
        <SandboxLaunchButton
          label="[ GRANT SEALED CASKET ]"
          accentColor={theme.statusColor}
          onPress={() => {
            grantSealedCasketInHub(1);
            setDebugReport(debugPreviewSealedStash(account));
          }}
        />
        <SandboxLaunchButton
          label="[ GRANT SPECIMEN JAR ]"
          accentColor={theme.statusColor}
          onPress={() => {
            grantSpecimenJarInHub(1);
            setDebugReport(debugPreviewSealedStash(account));
          }}
        />
        <SandboxLaunchButton
          label="[ GRANT EXPANSION MATS ]"
          accentColor={theme.statusColor}
          onPress={() => {
            grantExpansionResourcesInHub();
            setDebugReport('Expansion materials + Specimen Jar granted to stash.');
          }}
        />
        <SandboxLaunchButton
          label="[ PREVIEW SEALED STASH ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugPreviewSealedStash(account))}
        />
        <SandboxLaunchButton
          label="[ SIM CASKET OPEN ROLLS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugSimulateOpenRolls(20))}
        />
        <SandboxLaunchButton
          label="[ SIM JAR OPEN ROLLS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugSimulateSpecimenJarOpenRolls(20))}
        />
        <SandboxLaunchButton
          label="[ FORCE APEX BAND ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceAppraisalBand('APEX_VALUE');
            setDebugReport('Forced next appraisal roll to APEX_VALUE.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE APEX OPEN TIER ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceOpenTier('APEX_CACHE');
            setDebugReport('Forced next casket open to APEX_CACHE.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE JAR BREACH TIER ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceSpecimenJarTier('SPECIMEN_BREACH');
            setDebugReport('Forced next Specimen Jar open to SPECIMEN_BREACH.');
          }}
        />
        <SandboxLaunchButton
          label="[ VALIDATE SEALED CARGO ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugValidateSealedCargo(account))}
        />
        <SandboxLaunchButton
          label="[ RESOURCE ECONOMY REPORT ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugResourceEconomyReport())}
        />
        <SandboxLaunchButton
          label="[ FORCE MEMORY DISTORTION ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceVeilDistortion('MEMORY_CONTAMINATION');
            setDebugReport('Next Depth 2 Distortion forced to MEMORY_CONTAMINATION.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE VEIL REMEMBERS LAW ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceDeepVeilLaw('THE_VEIL_REMEMBERS');
            setDebugReport('Next Depth 3 Law forced to THE_VEIL_REMEMBERS.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE MIRRORED MODIFIER ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceEncounterModifier('MIRRORED');
            setDebugReport('Next engagement encounter modifier forced to MIRRORED.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE STARVED MODIFIER ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceEncounterModifier('STARVED');
            setDebugReport('Next engagement encounter modifier forced to STARVED.');
          }}
        />
        <SandboxLaunchButton
          label="[ CLEAR FORCED MODIFIER ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            debugForceEncounterModifier(null);
            setDebugReport('Cleared forced encounter modifier.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE CORRUPTED SANCTUARY ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('CORRUPTED_SANCTUARY');
            setDebugReport('Next eligible engagement forced to CORRUPTED_SANCTUARY.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE FALSE EXTRACTION ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('FALSE_EXTRACTION_SIGNAL');
            setDebugReport('Next safe-anchor / extraction chance forced to FALSE_EXTRACTION_SIGNAL.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE RESOURCE BLOOM ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('RESOURCE_BLOOM');
            setDebugReport('Next eligible engagement forced to RESOURCE_BLOOM.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE ANCHOR CORE BREACH ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('ANCHOR_CORE_BREACH');
            setDebugReport('Next eligible engagement forced to ANCHOR_CORE_BREACH.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE VEIL PROPER CACHE ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('VEIL_PROPER_CACHE');
            setDebugReport('Next eligible engagement forced to VEIL_PROPER_CACHE.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE FINAL ROUTE FRACTURE ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('FINAL_ROUTE_FRACTURE');
            setDebugReport('Next Depth 3 safe-anchor forced toward FINAL_ROUTE_FRACTURE.');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE APEX SHADOW ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceTwistedTemplate('APEX_SHADOW');
            setDebugReport('Next eligible combat forced to APEX_SHADOW.');
          }}
        />
        <SandboxLaunchButton
          label="[ CLEAR FORCED TWIST ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            debugForceTwistedTemplate(null);
            setDebugReport('Cleared forced twisted template.');
          }}
        />
        <SandboxLaunchButton
          label="[ PREVIEW DEPTH IDENTITY ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugPreviewDepthIdentity(activeIncursion))}
        />
        <SandboxLaunchButton
          label="[ PRINT DISTORTION CATALOG ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            `${debugPrintDistortionCatalog()}\n\nIDs: ${ALL_VEIL_DISTORTION_IDS.join(', ')}`,
          )}
        />
        <SandboxLaunchButton
          label="[ PRINT LAW CATALOG ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            `${debugPrintLawCatalog()}\n\nIDs: ${ALL_DEEP_VEIL_LAW_IDS.join(', ')}`,
          )}
        />
        <SandboxLaunchButton
          label="[ PRINT MODIFIER CATALOG ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            `${debugPrintEncounterModifierCatalog()}\n\nIDs: ${ALL_ENCOUNTER_MODIFIER_IDS.join(', ')}`,
          )}
        />
        <SandboxLaunchButton
          label="[ PRINT TWISTED CATALOG ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            `${debugPrintTwistedTemplateCatalog()}\n\nIDs: ${ALL_TWISTED_TEMPLATE_IDS.join(', ')}`,
          )}
        />
        <SandboxLaunchButton
          label="[ PRINT DEPTH ENEMY VARIANTS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            `${debugPrintDepthEnemyVariantCatalog()}\n\nIDs: ${ALL_DEPTH_ENEMY_VARIANT_KEYS.join(', ')}`,
          )}
        />
        <SandboxLaunchButton
          label="[ VALIDATE DEPTH ENEMY VARIANTS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugValidateDepthEnemyVariants())}
        />
        <SandboxLaunchButton
          label="[ PRINT SCANNER CERTAINTY ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugPrintScannerLabelCertaintyCatalog())}
        />
        <SandboxLaunchButton
          label="[ VALIDATE SCANNER CERTAINTY ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugValidateScannerLabelCertainty())}
        />
        <SandboxLaunchButton
          label="[ FORCE WEEPING GARGOYLE ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceDepthEnemyVariant('WEEPING_GARGOYLE');
            setDebugReport('Next combat spawn forced to inject WEEPING_GARGOYLE (Depth 2+).');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE ANCHOR HUSK ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceDepthEnemyVariant('ANCHOR_HUSK');
            setDebugReport('Next combat spawn forced to inject ANCHOR_HUSK (Depth 2+).');
          }}
        />
        <SandboxLaunchButton
          label="[ FORCE CORE SICK AMALGAM ]"
          accentColor={theme.statusColor}
          onPress={() => {
            debugForceDepthEnemyVariant('CORE_SICK_AMALGAM');
            setDebugReport('Next combat spawn forced to inject CORE_SICK_AMALGAM (Depth 3).');
          }}
        />
        <SandboxLaunchButton
          label="[ CLEAR FORCED VARIANT ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            debugForceDepthEnemyVariant(null);
            setDebugReport('Cleared forced depth enemy variant.');
          }}
        />
        <SandboxLaunchButton
          label="[ PRINT BIOME DEPTH POOLS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugPrintBiomeDepthPools())}
        />
        <SandboxLaunchButton
          label="[ PRINT SECTOR DEPTH FLAVOR ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugPrintSectorDepthFlavor())}
        />
        <SandboxLaunchButton
          label="[ SIMULATE DEPTH GEN ]"
          accentColor={theme.statusColor}
          onPress={() => {
            const seed = `dev-depth-gen:${Date.now()}`;
            const ctx = buildDepthIdentityRollContext(
              activeIncursion.runGenerationContext ?? runGenerationContext,
              activeIncursion.runVeilBiome
                ?? runGenerationContext?.sectorState.veilBiome
                ?? null,
              seed,
            );
            setDebugReport(debugSimulateDepthIdentityGeneration(ctx));
          }}
        />
        <SandboxLaunchButton
          label="[ LIST UNSEEN TWISTED ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            debugListMissingTwistedTemplates(activeIncursion.depthIdentity),
          )}
        />
        <SandboxLaunchButton
          label="[ VALIDATE PHASE G ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugValidatePhaseG())}
        />
        <SandboxLaunchButton
          label="[ VALIDATE DEPTH IDENTITY ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugValidateDepthIdentity(activeIncursion))}
        />
        <SandboxLaunchButton
          label="[ FORCE ARTILLERY KILLBOX ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugForceCompositionTemplate('ARTILLERY_KILLBOX'))}
        />
        <SandboxLaunchButton
          label="[ FORCE ECHO CONTAMINATED ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugForceCompositionTemplate('ECHO_CONTAMINATED'))}
        />
        <SandboxLaunchButton
          label="[ FORCE ELITE NEST ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugForceCompositionTemplate('ELITE_NEST'))}
        />
        <SandboxLaunchButton
          label="[ CLEAR FORCED COMPOSITION ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(debugForceCompositionTemplate(null))}
        />
        <SandboxLaunchButton
          label="[ PRINT COMPOSITION TEMPLATES ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(debugPrintCompositionTemplates())}
        />
        <SandboxLaunchButton
          label="[ PRINT COMPOSITION ROLES ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(debugPrintCompositionRoles())}
        />
        <SandboxLaunchButton
          label="[ PREVIEW WARNING CARD ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(debugPreviewCompositionWarningCard())}
        />
        <SandboxLaunchButton
          label="[ SIM COMPOSITION MATRIX ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugSimulateCompositionMatrix({ encountersPerCell: 12 }))}
        />
        <SandboxLaunchButton
          label="[ SIM COMPOSITION RUN ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(
            debugSimulateCompositionSectorRun(
              activeIncursion.runVeilBiome
                ?? selectedSector.veilBiome
                ?? 'NULL_ZONE',
            ),
          )}
        />
        <SandboxLaunchButton
          label="[ COMPOSITION CONTENT REPORT ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(formatCompositionContentReport())}
        />
        <SandboxLaunchButton
          label="[ VALIDATE COMPOSITION ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(debugValidateEncounterComposition())}
        />
        <SandboxLaunchButton
          label="[ PREVIEW DEBRIEF ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devPreviewPostRunDebrief())}
        />
        <SandboxLaunchButton
          label="[ LAUNCH ROUTING DEBRIEF ]"
          accentColor={theme.statusColor}
          onPress={launchRoutingDebriefPreview}
        />
        <SandboxLaunchButton
          label="[ SIM DEATH LOSS ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(devSimulateDeathRouting())}
        />
        <SandboxLaunchButton
          label="[ SIM BANK + DEATH ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(devSimulateBankThenDeathRouting())}
        />
        <SandboxLaunchButton
          label="[ VALIDATE ROUTING ]"
          accentColor={theme.primaryColor}
          onPress={() => {
            const careerIssues = validateCareerCargoRoutingStats(account.careerCargoRouting);
            const report = [
              devValidatePostRunRouting(),
              formatPostRunCargoRoutingValidationReport(careerIssues),
            ].join('\n\n');
            setDebugReport(report);
          }}
        />
        <SandboxLaunchButton
          label="[ AUDIT ROUTING ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devAuditPostRunRouting())}
        />
        <SandboxLaunchButton
          label="[ LOG CARGO ROUTING STATE ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devLogCargoRoutingRunState())}
        />
      </View>

      <HubSectionHeader title="RELIC // DEBUG" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ UNLOCK ALL RELICS ]"
          accentColor={theme.primaryColor}
          onPress={() => {
            unlockAllKeepsakes();
            setDebugReport('RELIC DEBUG — all 20 expedition relics unlocked.');
          }}
        />
        {ALL_KEEPSAKE_IDS.map((keepsakeId) => {
          const def = getKeepsakeDefinition(keepsakeId);
          return (
            <SandboxLaunchButton
              key={keepsakeId}
              label={`[ EQUIP ${def.name.toUpperCase()} ]`}
              accentColor={theme.primaryColor}
              onPress={() => {
                setEquippedKeepsake(keepsakeId);
                setDebugReport(`RELIC DEBUG — equipped ${keepsakeId}.`);
              }}
            />
          );
        })}
        <SandboxLaunchButton
          label="[ CLEAR RELIC ]"
          accentColor={theme.primaryColor}
          onPress={() => {
            setEquippedKeepsake(null);
            setDebugReport('RELIC DEBUG — expedition relic cleared.');
          }}
        />
        <SandboxLaunchButton
          label="[ VALIDATE RELICS ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(formatKeepsakeDebugValidation(
            account.equippedKeepsakeId,
            account.unlockedKeepsakeIds,
            account.keepsakeDeployment,
          ))}
        />
        <SandboxLaunchButton
          label="[ VALIDATE RELIC ACCEPTANCE ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(formatKeepsakeAcceptanceDebugReport())}
        />
        <SandboxLaunchButton
          label="[ LOG DEPLOYMENT WARNINGS ]"
          accentColor={theme.primaryColor}
          onPress={() => {
            if (!account.equippedKeepsakeId) {
              setDebugReport('RELIC DEBUG — no relic equipped.');
              return;
            }
            const warnings = resolveKeepsakeDeploymentWarnings(
              account.equippedKeepsakeId,
              selectedSector,
              persisted.contractBoard.selectedContract,
            );
            setDebugReport([
              'RELIC DEPLOYMENT WARNINGS',
              `relic: ${account.equippedKeepsakeId}`,
              `sector: ${selectedSector.displayName}`,
              ...(warnings.length > 0
                ? warnings.map((warning) => `[${warning.severity}] ${warning.message}`)
                : ['none']),
            ].join('\n'));
          }}
        />
        <SandboxLaunchButton
          label="[ SET ATTUNEMENT: ECHO ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeAttunement('ECHO_RESIDUE');
            setDebugReport('RELIC DEBUG — attunement set to ECHO_RESIDUE.');
          }}
        />
        <SandboxLaunchButton
          label="[ SET ATTUNEMENT: ANCHOR ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeAttunement('ANCHOR_SIGNAL');
            setDebugReport('RELIC DEBUG — attunement set to ANCHOR_SIGNAL.');
          }}
        />
        <SandboxLaunchButton
          label="[ SET DOCTRINE: GREED ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeRouteDoctrine('GREED');
            setDebugReport('RELIC DEBUG — route doctrine set to GREED.');
          }}
        />
        <SandboxLaunchButton
          label="[ SET DOCTRINE: HUNT ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeRouteDoctrine('HUNT');
            setDebugReport('RELIC DEBUG — route doctrine set to HUNT.');
          }}
        />
        <SandboxLaunchButton
          label="[ SET MIRROR: CREDITS ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeMirrorCategory('CREDITS');
            setDebugReport('RELIC DEBUG — mirror category set to CREDITS.');
          }}
        />
        <SandboxLaunchButton
          label="[ SET MIRROR: SPONSOR REP ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeMirrorCategory('SPONSOR_REP');
            setDebugReport('RELIC DEBUG — mirror category set to SPONSOR_REP.');
          }}
        />
        <SandboxLaunchButton
          label="[ CLEAR DEPLOYMENT ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            setKeepsakeAttunement(null);
            setKeepsakeRouteDoctrine(null);
            setKeepsakeMirrorCategory(null);
            setDebugReport('RELIC DEBUG — deployment choices cleared.');
          }}
        />
        <SandboxLaunchButton
          label="[ LOG RELIC STATE ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devLogKeepsakeRunState())}
        />
        <SandboxLaunchButton
          label="[ SIMULATE RELIC DEBRIEF ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devPreviewKeepsakeDebrief())}
        />
      </View>

      <HubSectionHeader title="RUN ITEMS // DEBUG" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ VALIDATE RUN ITEMS ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(formatRunItemDebugValidation(activeIncursion))}
        />
        <SandboxLaunchButton
          label="[ RUN ITEM ACCEPTANCE ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devValidateRunItemAcceptance())}
        />
        <SandboxLaunchButton
          label="[ FULL RUN ITEM AUDIT ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(formatRunItemAcceptanceDebugReport())}
        />
        <SandboxLaunchButton
          label="[ LOG RUN ITEM STATE ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devLogRunItemRunState())}
        />
        <SandboxLaunchButton
          label="[ SIMULATE RUN ITEM DEBRIEF ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devPreviewRunItemDebrief())}
        />
        <SandboxLaunchButton
          label="[ SIMULATE MARKET STOCK ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatRunItemMarketSimulationReport(activeIncursion.currentDepth ?? 1))}
        />
        <SandboxLaunchButton
          label="[ RECIPE GAP REPORT ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatRunItemRecipeGapReport(account.resourceStash))}
        />
        <SandboxLaunchButton
          label="[ GRANT ALL RUN ITEMS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(devGrantAllRunItems())}
        />
        {ALL_RUN_ITEM_IDS.map((itemId: RunItemId) => (
          <SandboxLaunchButton
            key={itemId}
            label={`[ GRANT ${itemId.replace(/-/g, ' ').toUpperCase()} ]`}
            accentColor={theme.mutedColor}
            onPress={() => setDebugReport(devGrantRunItem(itemId).logLine)}
          />
        ))}
      </View>

      <HubSectionHeader title="ECHO // DEBUG" color={theme.mutedColor} />
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ FORCE ECHO SIGNAL ]"
          accentColor={TERMINAL_ACCENT}
          onPress={devQueueEchoOverlay}
        />
        <SandboxLaunchButton
          label="[ FORCE HOSTILE ECHO ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devQueueHostileEchoTemplate('ECHO_FALLEN_AEGIS', 'AEGIS')}
        />
        <SandboxLaunchButton
          label="[ FORCE FALLEN RUNNER ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devQueueEchoEncounterKind('FALLEN_RUNNER_ECHO')}
        />
        <SandboxLaunchButton
          label="[ FORCE CARGO ECHO ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devQueueEchoEncounterKind('CARGO_ECHO')}
        />
        <SandboxLaunchButton
          label="[ LOG ECHO STATE ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devLogEchoRunState())}
        />
        <SandboxLaunchButton
          label="[ PREVIEW ECHO DEBRIEF ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devPreviewEchoDebrief())}
        />
        <SandboxLaunchButton
          label="[ VALIDATE ECHO ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devValidateEchoPipeline())}
        />
      </View>

      <HubSectionHeader title="WORLD STATE // DEBUG" color={theme.mutedColor} />
      <Text style={[styles.debugMeta, { color: keyColor }]}>
        Deploy run {persisted.deployRunIndex} · {selectedSector.displayName} · {selectedSector.activeOperation.objectiveKind}
      </Text>
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ VALIDATE STATE ]"
          accentColor={theme.primaryColor}
          onPress={showValidationReport}
        />
        <SandboxLaunchButton
          label="[ INSPECT STATE ]"
          accentColor={theme.primaryColor}
          onPress={showDebugSnapshot}
        />
        <SandboxLaunchButton
          label="[ REGEN ALL OPS ]"
          accentColor={theme.statusColor}
          onPress={devRegenerateAllOperations}
        />
        <SandboxLaunchButton
          label="[ TICK RUN ]"
          accentColor={theme.statusColor}
          onPress={tickAfterRunComplete}
        />
        <SandboxLaunchButton
          label="[ +1 CONTRIB ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => { void devSimulateContribution(1); }}
        />
        <SandboxLaunchButton
          label="[ FORCE COMPLETE ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => devForceOperationCompletion()}
        />
        <SandboxLaunchButton
          label="[ ANCHOR DORMANT ]"
          accentColor={theme.mutedColor}
          onPress={() => devSetAnchorDormant(selectedSector.id, 3)}
        />
        <SandboxLaunchButton
          label="[ ANCHOR ACTIVE ]"
          accentColor={theme.mutedColor}
          onPress={() => devClearAnchorDormant(selectedSector.id)}
        />
      </View>
      <Text style={[styles.debugMeta, { color: keyColor }]}>Run integration audit</Text>
      <View style={styles.grid}>
        <SandboxLaunchButton
          label="[ FULL LOOP AUDIT ]"
          accentColor={TERMINAL_ACCENT}
          onPress={() => {
            const report = buildFullRunLoopAudit({
              account,
              persisted,
              sectors,
              selectedContract: persisted.contractBoard.selectedContract,
              selectedSectorId: selectedSector.id,
              incursion: activeIncursion.isRunActive ? activeIncursion : null,
              extractedSuccessfully: false,
            });
            setDebugReport(formatRunLoopAuditReport(report));
          }}
        />
        <SandboxLaunchButton
          label="[ VALIDATE ALL ]"
          accentColor={theme.primaryColor}
          onPress={() => setDebugReport(devGetValidationReport())}
        />
        <SandboxLaunchButton
          label="[ CONTENT MATRIX ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(formatContentMatrixReport([selectedSector], persisted))}
        />
        <SandboxLaunchButton
          label="[ VALIDATE WEAPONS ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(formatWeaponValidationReport(validateWeaponRegistry()))}
        />
        <SandboxLaunchButton
          label="[ UNLOCK ALL WEAPONS ]"
          accentColor={theme.primaryColor}
          onPress={() => {
            unlockAllWeaponFamilies();
            appendHubLog('>> DEV — ALL WEAPON FAMILIES UNLOCKED AT TIER III.');
            setDebugReport(debugPrintEquippedWeapons(account));
          }}
        />
        <SandboxLaunchButton
          label="[ RESET WEAPONS ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            resetWeaponFamilies();
            appendHubLog('>> DEV — WEAPON PROGRESSION RESET.');
          }}
        />
        <SandboxLaunchButton
          label="[ GRANT WEAPON RESOURCES ]"
          accentColor={theme.mutedColor}
          onPress={() => {
            grantWeaponUnlockResources();
            appendHubLog('>> DEV — WEAPON CRAFT RESOURCES GRANTED.');
          }}
        />
        <SandboxLaunchButton
          label="[ RUN TELEMETRY ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(
            formatRunBalanceTelemetryReport(buildRunBalanceTelemetry(activeIncursion)),
          )}
        />
        <SandboxLaunchButton
          label="[ BALANCE CONFIG ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatBalanceConfigSummary())}
        />
        <SandboxLaunchButton
          label="[ BALANCE DASHBOARD ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatBalanceDashboard(account.careerBalanceHistory))}
        />
        <SandboxLaunchButton
          label="[ VALIDATE BALANCE ]"
          accentColor={theme.statusColor}
          onPress={() => setDebugReport(formatBalanceValidationReport({
            careerBalanceHistory: account.careerBalanceHistory,
            runSims: true,
          }))}
        />
        <SandboxLaunchButton
          label="[ SIM BALANCE BUNDLE ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatBalanceSimulationBundle())}
        />
        <SandboxLaunchButton
          label="[ SIM TREES 100 ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatRunTreeGenerationReport(100, 1))}
        />
        <SandboxLaunchButton
          label="[ SIM REWARDS ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport([
            formatRewardRollsReport(5, 'STANDARD', 80),
            '',
            formatRewardRollsReport(20, 'ELITE', 60),
            '',
            formatRewardRollsReport(15, 'BOSS', 40),
          ].join('\n'))}
        />
        <SandboxLaunchButton
          label="[ SIM CONTRACTS ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatContractGenerationReport(50))}
        />
        <SandboxLaunchButton
          label="[ SIM OPS ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatOperationProgressReport())}
        />
        <SandboxLaunchButton
          label="[ SIM RUN LOOT ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatRunResourceIncomeReport())}
        />
        <SandboxLaunchButton
          label="[ SIM CRAFT AFFORD ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatCraftingAffordabilityReport())}
        />
        <SandboxLaunchButton
          label="[ SIM SEALED EV ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatSealedOpenBalanceReport(50))}
        />
        <SandboxLaunchButton
          label="[ SIM ENCOUNTER DIST ]"
          accentColor={theme.mutedColor}
          onPress={() => setDebugReport(formatEncounterDistributionReport())}
        />
        {ALLOWED_NODES_PER_DISTRICT.map((preset) => (
          <SandboxLaunchButton
            key={preset}
            label={`[ DEPTH ${preset} ]`}
            accentColor={theme.mutedColor}
            onPress={() => {
              setNodesPerDistrictForTesting(preset as NodesPerDistrictPreset);
              setDebugReport(formatRunPacingDebugSummary());
            }}
          />
        ))}
      </View>
      <Text style={[styles.debugMeta, { color: keyColor }]}>Sector select</Text>
      <View style={styles.grid}>
        {SECTOR_WORLD_TEMPLATES.map((sector) => (
          <SandboxLaunchButton
            key={sector.id}
            label={`[ ${sector.displayName.toUpperCase()} ]`}
            accentColor={selectedSector.id === sector.id ? theme.statusColor : theme.primaryColor}
            onPress={() => selectSector(sector.id)}
          />
        ))}
      </View>
      <Text style={[styles.debugMeta, { color: keyColor }]}>Force operation type (selected sector)</Text>
      <View style={styles.grid}>
        {operationKinds.map((kind) => (
          <SandboxLaunchButton
            key={kind}
            label={`[ ${kind.replace(/_/g, ' ')} ]`}
            accentColor={theme.statusColor}
            onPress={() => devForceSectorOperation(selectedSector.id, kind)}
          />
        ))}
      </View>
      {debugReport ? (
        <View style={[styles.debugPanel, { borderColor: theme.mutedColor }]}>
          <Text style={[styles.debugText, { color: theme.primaryColor }]}>{debugReport}</Text>
        </View>
      ) : null}

      <HapticPressable
        onPress={() => setHubOpen(true)}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.primaryColor, { pressed, size: 'md' }),
          styles.hubBtn,
        ]}
      >
        <Text style={[getInteractiveButtonTextStyle('md'), { color: theme.primaryColor }]}>
          {formatBracketHeader('METROPOLITAN EXPLORATION CORRIDOR')}
        </Text>
        <Text style={[styles.hubSub, { color: keyColor }]}>
          Open exploration hub sandbox
        </Text>
      </HapticPressable>
    </HubScreenShell>
  );
}

const TERMINAL_ACCENT = '#00ff33';
const WARNING_ACCENT = '#f59e0b';

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  launchBtn: {
    minWidth: '47%',
    flexGrow: 1,
  },
  hubBtn: {
    marginTop: 8,
    gap: 4,
    alignItems: 'flex-start',
  },
  hubSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  hubPanel: {
    flex: 1,
    minHeight: 280,
  },
  debugMeta: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  debugPanel: {
    borderWidth: 1,
    padding: 8,
    marginBottom: 12,
  },
  debugText: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
  },
});
