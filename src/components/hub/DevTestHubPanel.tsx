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
  } = usePlayerAccount();
  const {
    selectedSector,
    persisted,
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
