import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  resolveCombatEnemyPortrait,
  resolvePortraitKeySuffix,
  resolveUnitCombatAttackPortrait,
  resolveUnitCombatPortrait,
} from '../utils/combatEnemyPortrait';
import type { ApparitionViewportRef } from '../components/combat/ApparitionViewport';
import CombatLandscapeArena from '../components/combat/CombatLandscapeArena';
import CombatArenaBackground from '../components/combat/CombatArenaBackground';
import CombatEnemyGrid from '../components/combat/CombatEnemyGrid';
import { resolveArenaLayoutMode } from '../components/combat/combatEnemyBarLayout';
import CombatJuiceHost from '../components/combat/CombatJuiceHost';
import WeaponCombatPresentationHost from '../components/combat/WeaponCombatPresentationHost';
import CombatParryScreenOverlay from '../components/combat/CombatParryScreenOverlay';
import CombatResolutionBanner from '../components/combat/CombatResolutionBanner';
import ParticleOverlay from '../components/atmosphere/ParticleOverlay';
import { macroFamilyToBiomeId } from '../constants/biomeConfig';
import {
  resolveCombatArenaBackground,
  resolveCombatArenaBackgroundScrim,
} from '../constants/combatArenaBackground';
import { pulseCombatTargetSelect } from '../utils/hubButtonHaptics';
import { triggerShake } from '../utils/combatJuice';
import type { CombatPlayerViewportRef } from '../components/combat/CombatPlayerViewport';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import TacticalCombatHub from '../components/TacticalCombatHub';
import {
  CombatEnemyChromeProvider,
} from '../context/CombatEnemyChromeContext';
import { CombatArenaOverlayProvider } from '../context/CombatArenaOverlayContext';
import { CombatArenaCombatUiProvider } from '../context/CombatArenaCombatUiContext';
import { CombatMinigameOverlayProvider, CombatMinigameOverlayHost } from '../context/CombatMinigameOverlayContext';
import { CombatTurnProvider } from '../context/CombatTurnContext';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useRunDeathFinalizer } from '../hooks/useRunDeathFinalizer';
import { useDevSandboxExit } from '../hooks/useDevSandboxExit';
import { isDevSandboxCombatPreset } from '../types/devSandbox';
import {
  standardKillCredits,
} from '../data/combatCredits';
import {
  formatCompositionRewardPayoutLog,
} from '../data/encounterCompositionRewardEngine';
import {
  bossFlavorRareLootBonusPct,
  buildBossFlavorContextFromRun,
  resolveBossFlavorRewardTier,
} from '../data/encounterBossFlavorEngine';
import { depthFromNodesCleared, getDistrictFromDepth, isDistrictGateDepth, isPrimeBossDepth } from '../data/districtPacing';
import { rollGatekeeperLockedTemplate } from '../data/combatRewardEngine';
import { resolveCargoHealReceivedMultiplier } from '../data/unstableCargoEffectsEngine';
import { resolveStarvedHealMultiplier } from '../data/encounterModifierCombatEngine';
import {
  type PendingNarrativeCombatBoons,
} from '../types/narrativeBonusReward';
import { resolveEchoRecoveryContext } from '../data/echoRecoveryEngine';
import {
  buildInitialSquadUiSnapshot,
  type CombatSquadUiSnapshot,
} from '../utils/combatTelemetryFormat';
import {
  computeCombatVictoryCreditReward,
  resolveCombatVictoryContinueDestination,
  resolveCombatVictoryContinueLabel,
  resolveCombatVictoryHeading,
  resolveCombatVictoryKind,
} from '../utils/combatVictoryResolution';
import { buildCombatAugmentIcons } from '../utils/combatAugmentIcons';
import { encounterBudgetForDepth } from '../data/combatEncounterBudget';
import type { CargoItemId } from '../types/cargoGrid';
import { shouldGrantAdrenalinePrimerAp } from '../data/boundRequisitionEngine';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';
import CombatTacticalDashboard from './combat/layouts/CombatTacticalDashboard';
import CombatDashboardMacroLog from './combat/layouts/CombatDashboardMacroLog';
import HostileIntelView from './combat/layouts/HostileIntelView';
import TurnOrderTopBar from './combat/layouts/TurnOrderTopBar';
import CombatMissionReadout, {
  type CombatQuestLogInfo,
} from './combat/layouts/CombatMissionReadout';
import CombatRightRail from './combat/layouts/CombatRightRail';
import CombatDashboardCommandColumn from './combat/layouts/CombatDashboardCommandColumn';
import CombatHudAtmosphereOverlay from '../components/combat/ui/CombatHudAtmosphereOverlay';
import CombatTopDockFade from '../components/combat/ui/CombatTopDockFade';
import CombatOperativeHud, {
  type CombatOperativeTelemetry,
} from '../components/combat/CombatOperativeHud';
import { OTT } from '../constants/occultTacticalTerminalTheme';
import { subscribeAbyssalVerdictPresentation } from '../data/abyssalVerdictPresentation';
import type { AbyssalVerdictHudSnapshot } from '../data/abyssalVerdictReadyUi';
import AbyssalVerdictReadyBanner from '../components/combat/AbyssalVerdictReadyBanner';
import { resolveWeaponState } from '../data/weaponProgressionEngine';
import { resolveClassCompatibleWeaponFamily } from '../data/weaponRunState';
import { resolveWeaponCombatStatsFromState } from '../data/weaponCombatEngine';
import { shouldShowUnitInArenaGrid } from '../data/combatSquadEngine';
import { sponsorDisplayName } from '../utils/contractUi';

type CombatResolutionPanelState = {
  outcome: 'VICTORY' | 'DEFEAT';
  playerTurns: number;
  hostilesDefeated: number;
  objectiveCallout: string | null;
};

export default function CombatScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { startResourceHarvest, startPostCombatBoon, startExtractionReview } = useGameFlow();
  const { exitToDevTestHub } = useDevSandboxExit();
  const { finalizeRunDeath } = useRunDeathFinalizer();
  const {
    runState,
    syncAfterCombat,
    appendRunLog,
    useIncursionConsumable,
    endRun,
    refillStaminaAfterCombat,
    preparePostCombatMutations,
    clearPendingAmbush,
    incrementCombatNodesCleared,
    activeIncursion,
    shiftBossPhase,
    awardRunCredits,
    getSelectedVectorNode,
    beginPostCombatHarvest,
    grantCombatResourceDrops,
    grantCombatSalvage,
    grantHostileEchoRewards,
    applyVoidsTollSacrifice,
    completeDefendRiftVictory,
    consumeAdrenalinePrimerAfterCombat,
    peekPendingNarrativeCombatBoons,
    clearPendingNarrativeCombatBoons,
    clearNarrativeBoonStatusEffects,
    isPostCombatBoonBlocked,
    recordRunKillAttacker,
    clearEncounterUltimateDisabled,
    setCombatLogActive,
    clearRunLog,
    beginCombatRunLogSession,
    recordDepthIdentityCombatVictory,
    recordCompositionEncounterVictory,
    recordBalanceCombatSample,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const { account, addLockedContainer } = usePlayerAccount();
  const operativeClass = activeIncursion.activeClass ?? account.activeClass;
  const combatWeaponFamilyId = resolveClassCompatibleWeaponFamily(
    operativeClass,
    activeIncursion.activeWeaponFamilyId,
  );
  const baseWeaponStats = useMemo(() => {
    const tier = activeIncursion.activeWeaponTier ?? 1;
    return resolveWeaponCombatStatsFromState(resolveWeaponState(combatWeaponFamilyId, tier));
  }, [
    combatWeaponFamilyId,
    activeIncursion.activeWeaponTier,
  ]);
  const strikeBonusPct = activeIncursion.strikeDamageBonusPct ?? 0;
  const weaponCombatStats = useMemo(() => {
    if (strikeBonusPct <= 0) return baseWeaponStats;
    const mult = 1 + strikeBonusPct / 100;
    return {
      ...baseWeaponStats,
      strikeDamage: Math.floor(baseWeaponStats.strikeDamage * mult),
      exhaustedStrikeDamage: Math.floor(baseWeaponStats.exhaustedStrikeDamage * mult),
      ...(baseWeaponStats.aegisTechniqueStrikePower != null
        ? {
          aegisTechniqueStrikePower: Math.floor(
            baseWeaponStats.aegisTechniqueStrikePower * mult,
          ),
        }
        : {}),
    };
  }, [baseWeaponStats, strikeBonusPct]);
  const playerCritChanceBonus = account.factionPerks.critChanceBonus;
  const env = activeIncursion.environmentalModifiers;
  const combatEntryStamina =
    env.startingStaminaPenalty > 0 ? 50 : runState.currentStamina;
  const adrenalinePrimerActive = shouldGrantAdrenalinePrimerAp(activeIncursion);
  const runApBonus = activeIncursion.runModifiers?.firstTurnApBonus ?? 0;
  const runKineticArmor = activeIncursion.runModifiers?.kineticArmorBonus ?? 0;
  const kineticBatteryActive = activeIncursion.boundRequisition?.kineticBatteryActive ?? false;
  const encounterModifier = getSelectedVectorNode()?.contextModifiers?.encounterModifier ?? null;
  const cargoHealReceivedMultiplier = useMemo(() => {
    const cargoMult = resolveCargoHealReceivedMultiplier(
      activeIncursion.cargo,
      activeIncursion.keepsakeRuntime,
    );
    return cargoMult * resolveStarvedHealMultiplier(encounterModifier);
  }, [activeIncursion.cargo, activeIncursion.keepsakeRuntime, encounterModifier]);
  const firstTurnBonusAp = runApBonus;
  const [narrativeCombatBoons] = useState<PendingNarrativeCombatBoons>(
    peekPendingNarrativeCombatBoons,
  );

  useEffect(() => {
    beginCombatRunLogSession();
    clearPendingNarrativeCombatBoons();
    return () => {
      setCombatLogActive(false);
      clearRunLog();
    };
  }, [beginCombatRunLogSession, clearPendingNarrativeCombatBoons, clearRunLog, setCombatLogActive]);

  const [squadUi, setSquadUi] = useState<CombatSquadUiSnapshot | null>(null);
  const [operativeTelemetry, setOperativeTelemetry] = useState<CombatOperativeTelemetry | null>(null);
  const [wardPrimed, setWardPrimed] = useState(false);
  const [abilityPrimed, setAbilityPrimed] = useState(false);
  const [resolutionPanel, setResolutionPanel] = useState<CombatResolutionPanelState | null>(null);
  const [abyssalHudOpacity, setAbyssalHudOpacity] = useState(1);
  const [abyssalVerdictUi, setAbyssalVerdictUi] = useState<AbyssalVerdictHudSnapshot | null>(null);
  const abyssalVerdictHandlersRef = useRef<{
    prime: () => void;
    cancel: () => void;
  } | null>(null);
  useEffect(() => subscribeAbyssalVerdictPresentation((event) => {
    setAbyssalHudOpacity(event.hudOpacity);
  }), []);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const cancelIfTargeting = () => {
      if (abyssalVerdictUi?.state === 'targeting') {
        abyssalVerdictHandlersRef.current?.cancel();
        return true;
      }
      return false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        if (cancelIfTargeting()) event.preventDefault();
        return;
      }
      if (
        (event.key === 'u' || event.key === 'U')
        && abyssalVerdictUi?.state === 'ready'
        && abyssalVerdictUi.canInteract
      ) {
        event.preventDefault();
        abyssalVerdictHandlersRef.current?.prime();
      }
    };
    const onContextMenu = (event: MouseEvent) => {
      if (cancelIfTargeting()) event.preventDefault();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 2) cancelIfTargeting();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [abyssalVerdictUi]);
  const resolutionDismissRef = useRef<() => void>(() => {});
  const victoryCreditRewardRef = useRef<number | null>(null);
  const apparitionRef = useRef<ApparitionViewportRef>(null);
  const playerViewportRef = useRef<CombatPlayerViewportRef>(null);
  const killResolverRef = useRef<() => void>(() => {});
  const healHandlerRef = useRef<(amount: number) => void>(() => {});
  const consumableHandlerRef = useRef<(result: IncursionConsumableUseResult) => void>(() => {});
  const canDeployCargoRef = useRef<(itemId: CargoItemId) => boolean>(() => false);
  const targetHandlerRef = useRef<(unitId: string) => void>(() => {});
  const intelTargetHandlerRef = useRef<(unitId: string) => void>(() => {});
  const dissolveCompleteRef = useRef<(unitId: string) => void>(() => {});

  const handlePlayerCritImpact = useCallback(() => {
    triggerShake('heavy');
  }, []);

  const handleSquadUiChange = useCallback((snapshot: CombatSquadUiSnapshot) => {
    setSquadUi(snapshot);
  }, []);

  const handleOperativeTelemetryChange = useCallback((telemetry: CombatOperativeTelemetry | null) => {
    setOperativeTelemetry(telemetry);
  }, []);

  const registerTargetHandler = useCallback((handler: (unitId: string) => void) => {
    targetHandlerRef.current = handler;
  }, []);

  const registerIntelTargetHandler = useCallback((handler: (unitId: string) => void) => {
    intelTargetHandlerRef.current = handler;
  }, []);

  const registerAbyssalVerdictHandlers = useCallback((
    handlers: { prime: () => void; cancel: () => void } | null,
  ) => {
    abyssalVerdictHandlersRef.current = handlers;
  }, []);

  const handleEnemyUnitPress = useCallback((unitId: string) => {
    pulseCombatTargetSelect();
    targetHandlerRef.current(unitId);
  }, []);

  const handleTurnOrderHostilePress = useCallback((unitId: string) => {
    pulseCombatTargetSelect();
    intelTargetHandlerRef.current(unitId);
  }, []);

  const registerKillResolver = useCallback((resolver: () => void) => {
    killResolverRef.current = resolver;
  }, []);

  const registerHealHandler = useCallback((handler: (amount: number) => void) => {
    healHandlerRef.current = handler;
  }, []);

  const registerConsumableHandler = useCallback((handler: (result: IncursionConsumableUseResult) => void) => {
    consumableHandlerRef.current = handler;
  }, []);

  const registerCanDeployCargoHandler = useCallback((handler: (itemId: CargoItemId) => boolean) => {
    canDeployCargoRef.current = handler;
  }, []);

  const registerDissolveCompleteHandler = useCallback((handler: (unitId: string) => void) => {
    dissolveCompleteRef.current = handler;
  }, []);

  const handleUnitDissolveComplete = useCallback((unitId: string) => {
    dissolveCompleteRef.current(unitId);
  }, []);

  const handleConsumableUsed = useCallback((result: IncursionConsumableUseResult) => {
    consumableHandlerRef.current(result);
  }, []);

  const handleDeployCargoItem = useCallback((itemId: CargoItemId): boolean => {
    if (!canDeployCargoRef.current(itemId)) {
      appendRunLog('[REJECTED] >> Cargo deploy unavailable this turn.');
      return false;
    }
    const result = useIncursionConsumable(itemId);
    if (!result) return false;
    consumableHandlerRef.current(result);
    return true;
  }, [appendRunLog, useIncursionConsumable]);

  const handleEradicationComplete = useCallback(() => {
    killResolverRef.current();
  }, []);

  const combatSquad = useMemo(
    () => (runState.pendingEnemies.length > 0
      ? runState.pendingEnemies
      : runState.pendingEnemy
        ? [runState.pendingEnemy]
        : []),
    [runState.pendingEnemies, runState.pendingEnemy],
  );

  const combatAugmentIcons = useMemo(
    () => buildCombatAugmentIcons({
      operativeClass,
      aegisLoadout: activeIncursion.aegisTechniqueLoadout,
      hexShotLoadout: activeIncursion.hexShotLoadout,
      envoyLoadout: activeIncursion.envoyLoadout,
      abilityGrafts: activeIncursion.abilityGrafts,
      hexShotAbilityGrafts: activeIncursion.hexShotAbilityGrafts,
      envoyAbilityGrafts: activeIncursion.envoyAbilityGrafts,
      leyLineMutations: activeIncursion.leyLineMutations,
      hexShotBoons: activeIncursion.hexShotBoons,
      envoyBoons: activeIncursion.envoyBoons,
      narrativeCombatBoons,
    }),
    [
      operativeClass,
      activeIncursion.aegisTechniqueLoadout,
      activeIncursion.hexShotLoadout,
      activeIncursion.envoyLoadout,
      activeIncursion.abilityGrafts,
      activeIncursion.hexShotAbilityGrafts,
      activeIncursion.envoyAbilityGrafts,
      activeIncursion.leyLineMutations,
      activeIncursion.hexShotBoons,
      activeIncursion.envoyBoons,
      narrativeCombatBoons,
    ],
  );

  const arenaLayoutMode = useMemo(
    () => resolveArenaLayoutMode(combatSquad.length),
    [combatSquad.length],
  );
  const vectorNode = getSelectedVectorNode();
  const isBossEncounter =
    activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
  const nodeType = vectorNode?.type;
  const combatDepth = depthFromNodesCleared(runState.combatNodesCleared);
  const threatBudget = encounterBudgetForDepth({
    depth: combatDepth,
    isElite: nodeType === 'ELITE_COMBAT',
    isAmbush: runState.pendingAmbush,
    breachGrade: activeIncursion.breachGrade ?? 'I',
  }).phaseBudget;
  const portraitSource = resolveCombatEnemyPortrait({
    isBoss: isBossEncounter,
    rosterId: runState.pendingEnemy?.rosterId,
    nodeType,
  });
  const portraitKey =
    `${runState.pendingEnemy?.designation ?? 'hostile'}`
    + `-${resolvePortraitKeySuffix({
      isBoss: isBossEncounter,
      rosterId: runState.pendingEnemy?.rosterId,
      nodeType,
    })}`
    + `-${activeIncursion.currentEncounterIndex}`
    + `-${runState.combatNodesCleared}`;

  const bootstrappedSquadUi = useMemo(
    () => buildInitialSquadUiSnapshot(combatSquad),
    [combatSquad],
  );
  const effectiveSquadUi = useMemo(() => {
    if (!squadUi || squadUi.units.length === 0) {
      return bootstrappedSquadUi;
    }
    return squadUi;
  }, [bootstrappedSquadUi, squadUi]);

  const gridUnits = useMemo(() => {
    return effectiveSquadUi.units
      .filter(shouldShowUnitInArenaGrid)
      .map((unit) => {
        const portraitMeta = {
          isBoss: unit.isBoss,
          class: unit.enemyClass ?? 'GREMLIN',
          rosterId: unit.rosterId,
        } as const;
        const portraitSource = resolveUnitCombatPortrait(portraitMeta, nodeType);
        return {
          ...unit,
          portraitSource,
          attackPortraitSource: resolveUnitCombatAttackPortrait(portraitMeta, portraitSource),
        };
      });
  }, [effectiveSquadUi.units, nodeType]);

  const showVictoryBanner = resolutionPanel?.outcome === 'VICTORY';
  const showDefeatBanner = resolutionPanel?.outcome === 'DEFEAT';
  const resolutionActive = showVictoryBanner || showDefeatBanner;

  const victoryPresentation = useMemo(() => {
    if (!showVictoryBanner || !resolutionPanel) return null;
    const vectorNode = getSelectedVectorNode();
    const isBossEncounter =
      activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
    const kind = resolveCombatVictoryKind({
      isBossEncounter,
      defendRiftActive: Boolean(activeIncursion.defendRiftActive),
      vectorNodeType: vectorNode?.type ?? null,
    });
    const destination = resolveCombatVictoryContinueDestination({
      isDevExit: Boolean(runState.devSandboxPreset || runState.combatTestPreset),
      defendRiftActive: Boolean(activeIncursion.defendRiftActive),
      isBossEncounter,
      pendingAmbush: Boolean(runState.pendingAmbush),
      ambushHarvestRoute: activeIncursion.pendingHarvestReturn ?? null,
      boonBlocked: isPostCombatBoonBlocked(),
    });
    const showCredits = !activeIncursion.defendRiftActive
      && !runState.devSandboxPreset
      && !runState.combatTestPreset;
    const credits = showCredits ? (victoryCreditRewardRef.current ?? 0) : 0;
    const summary = [
      {
        value: String(resolutionPanel.hostilesDefeated),
        label: resolutionPanel.hostilesDefeated === 1 ? 'HOSTILE' : 'HOSTILES',
      },
      {
        value: String(resolutionPanel.playerTurns),
        label: resolutionPanel.playerTurns === 1 ? 'TURN' : 'TURNS',
      },
      credits > 0
        ? { value: `+${credits}`, label: 'CREDITS', accent: true as const }
        : null,
    ].filter(Boolean) as { value: string; label: string; accent?: boolean }[];

    return {
      heading: resolveCombatVictoryHeading(kind),
      continueLabel: resolveCombatVictoryContinueLabel(destination),
      summary,
      objectiveLine: resolutionPanel.objectiveCallout,
    };
  }, [
    activeIncursion.bossProfile,
    activeIncursion.defendRiftActive,
    activeIncursion.pendingHarvestReturn,
    getSelectedVectorNode,
    isPostCombatBoonBlocked,
    resolutionPanel,
    runState.combatTestPreset,
    runState.devSandboxPreset,
    runState.pendingAmbush,
    runState.pendingEnemy?.isBoss,
    showVictoryBanner,
  ]);

  const defeatPresentation = useMemo(() => {
    if (!showDefeatBanner || !resolutionPanel) return null;
    return {
      heading: 'OPERATIVE SOUL DISCONNECTED',
      continueLabel: 'INCURSION FAILED',
      subtitle: 'Soul anchor severed. Veil sync lost.',
      eyebrow: 'COMBAT RECORD // FAILED',
      summary: [
        {
          value: String(resolutionPanel.hostilesDefeated),
          label: resolutionPanel.hostilesDefeated === 1 ? 'HOSTILE' : 'HOSTILES',
        },
        {
          value: String(resolutionPanel.playerTurns),
          label: resolutionPanel.playerTurns === 1 ? 'TURN' : 'TURNS',
        },
      ],
      objectiveLine: resolutionPanel.objectiveCallout,
    };
  }, [resolutionPanel, showDefeatBanner]);

  const enemySquadPanel = (
    <CombatEnemyGrid
      variant="arena"
      layoutMode={arenaLayoutMode}
      arenaGridVariant="staggered"
      units={gridUnits}
      targetingActive={effectiveSquadUi.targetingActive}
      abilityArmed={Boolean(effectiveSquadUi.abilityTargetingActive)}
      onUnitPress={handleEnemyUnitPress}
      onUnitDissolveComplete={handleUnitDissolveComplete}
      accentColor={theme.primaryColor}
      mutedColor={theme.mutedColor}
      bloodBurstVariant={
        operativeClass === 'AEGIS'
          ? ('aegis' as const)
          : operativeClass === 'HEX_SHOT'
            ? ('hex' as const)
            : operativeClass === 'ENVOY'
              ? ('envoy' as const)
              : null
      }
      bloodMistScale={
        combatWeaponFamilyId === 'hex-void-cannon'
        || combatWeaponFamilyId === 'aegis-claymore-blade'
          ? 1.5 // keep in sync with TacticalCombatHub bloodMistScaleRef
          : 1
      }
    />
  );

  const focusedPortraitSource = useMemo(() => {
    const focused = gridUnits.find((unit) => unit.isFocused && !unit.isDead)
      ?? gridUnits.find((unit) => unit.isSelected && !unit.isDead)
      ?? gridUnits.find((unit) => !unit.isDead);
    return focused?.portraitSource ?? portraitSource;
  }, [gridUnits, portraitSource]);

  const selectedEnemyUnit = useMemo(
    () => gridUnits.find((unit) => unit.isFocused && !unit.isDead)
      ?? gridUnits.find((unit) => unit.isSelected && !unit.isDead)
      ?? null,
    [gridUnits],
  );

  const combatBiomeId = useMemo(
    () => macroFamilyToBiomeId(activeIncursion.currentMacroBiomeFamily),
    [activeIncursion.currentMacroBiomeFamily],
  );
  const arenaBackgroundSource = useMemo(
    () => resolveCombatArenaBackground(combatBiomeId),
    [combatBiomeId],
  );
  const arenaBackgroundScrimColor = useMemo(
    () => resolveCombatArenaBackgroundScrim(combatBiomeId),
    [combatBiomeId],
  );

  const handleResolutionPanelChange = useCallback(
    (panel: {
      outcome: 'VICTORY' | 'DEFEAT';
      onDismiss: () => void;
      playerTurns: number;
      hostilesDefeated: number;
      objectiveCallout: string | null;
    } | null) => {
      if (!panel) {
        setResolutionPanel(null);
        victoryCreditRewardRef.current = null;
        resolutionDismissRef.current = () => {};
        return;
      }
      if (panel.outcome === 'VICTORY' && victoryCreditRewardRef.current == null) {
        const vectorNode = getSelectedVectorNode();
        const isBossEncounter =
          activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
        victoryCreditRewardRef.current = computeCombatVictoryCreditReward({
          activeIncursion,
          vectorNode,
          isBossEncounter,
        });
      }
      setResolutionPanel({
        outcome: panel.outcome,
        playerTurns: panel.playerTurns,
        hostilesDefeated: panel.hostilesDefeated,
        objectiveCallout: panel.objectiveCallout,
      });
      resolutionDismissRef.current = panel.onDismiss;
    },
    [
      activeIncursion,
      getSelectedVectorNode,
      runState.pendingEnemy?.isBoss,
    ],
  );

  const handleResolutionDismiss = useCallback(() => {
    resolutionDismissRef.current();
  }, []);

  const handleCombatComplete = useCallback((result: {
    victory: boolean;
    remainingHp: number;
    remainingStamina: number;
    playerTurns?: number;
    damageTaken?: number;
    healingReceived?: number;
    damageDealt?: number;
    intentTelemetry?: import('../data/balance/combatIntentTelemetryEngine').CombatIntentTelemetry;
    classLoopTelemetry?: import('../data/balance/classLoopTelemetryEngine').ClassLoopTelemetry;
    objectiveTelemetry?: import('../data/balance/encounterObjectiveTelemetryEngine').EncounterObjectiveTelemetry;
    directorTelemetry?: {
      pressureTotal: number;
      pressureLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
      rewardMultiplier: number;
      adjustmentsApplied: number;
      severity: 'OK' | 'WARNING' | 'ERROR';
      debugSummary: string;
    };
    juiceTelemetry?: import('../data/combatJuiceFeedbackEngine').CombatJuiceTelemetry;
  }) => {
    const vectorNode = getSelectedVectorNode();
    const isBossEncounter =
      activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
    const combatKind = isBossEncounter
      ? 'BOSS' as const
      : vectorNode?.type === 'ELITE_COMBAT'
        ? 'ELITE' as const
        : 'STANDARD' as const;
    recordBalanceCombatSample({
      kind: combatKind,
      playerTurns: result.playerTurns ?? 0,
      damageTaken: result.damageTaken ?? 0,
      healingReceived: result.healingReceived ?? 0,
      damageDealt: result.damageDealt ?? 0,
      victory: Boolean(result.victory && result.remainingHp > 0),
      playerClassId: operativeClass,
      depth: getDistrictFromDepth(depthFromNodesCleared(activeIncursion.nodesCleared)),
      enemyCount: (runState.pendingEnemies?.length ?? (runState.pendingEnemy ? 1 : 0)),
      endingPlayerHp: result.remainingHp,
      defense: {
        fractureAppliedCount: 0,
        fractureTriggeredByArmorBreakCount: 0,
        fractureTriggeredByWardBreakCount: 0,
        kineticArmorDamageReduced: 0,
        kineticArmorStacksRemoved: 0,
        kineticArmorBreaks: 0,
        occultWardDamageReduced: 0,
        occultWardStacksRemoved: 0,
        occultWardBreaks: 0,
        hadKineticArmorEnemy: (runState.pendingEnemies ?? (runState.pendingEnemy ? [runState.pendingEnemy] : []))
          .some((e) => (e.baseKineticArmor ?? e.kineticArmor ?? 0) > 0),
        hadOccultWardEnemy: (runState.pendingEnemies ?? (runState.pendingEnemy ? [runState.pendingEnemy] : []))
          .some((e) => (e.baseOccultWards ?? e.occultWards ?? 0) > 0),
      },
      intent: result.intentTelemetry,
      classLoop: result.classLoopTelemetry,
      objective: result.objectiveTelemetry,
      director: result.directorTelemetry,
      juice: result.juiceTelemetry,
    });

    if (runState.devSandboxPreset || runState.combatTestPreset) {
      victoryCreditRewardRef.current = null;
      exitToDevTestHub();
      return;
    }

    if (!result.victory || result.remainingHp <= 0) {
      victoryCreditRewardRef.current = null;
      clearNarrativeBoonStatusEffects();
      finalizeRunDeath(
        result.remainingHp <= 0 ? 'SOUL ANCHOR DESTROYED' : 'OPERATIVE DEFEATED IN COMBAT',
      );
      return;
    }

    syncAfterCombat(result.remainingHp, result.remainingStamina);
    clearEncounterUltimateDisabled();
    clearNarrativeBoonStatusEffects();

    const victoryModifier = getSelectedVectorNode()?.contextModifiers?.encounterModifier;
    const victoryTwisted = getSelectedVectorNode()?.contextModifiers?.twistedTemplate;
    recordDepthIdentityCombatVictory({
      modifierId: victoryModifier ?? null,
      twistedTemplateId: victoryTwisted ?? null,
      slainEnemies: runState.pendingEnemies ?? [],
    });

    if (activeIncursion.defendRiftActive) {
      victoryCreditRewardRef.current = null;
      completeDefendRiftVictory();
      startExtractionReview();
      return;
    }

    const nodeType = vectorNode?.type;
    const depth = activeIncursion.nodesCleared + 1;
    const mods = vectorNode?.contextModifiers;
    const compositionTier = mods?.compositionRewardTier ?? null;
    const compositionTemplateId = mods?.compositionTemplateId ?? null;
    const bossFlavorCtx = isBossEncounter
      ? buildBossFlavorContextFromRun({
          depth: getDistrictFromDepth(depth),
          depthIdentity: activeIncursion.depthIdentity,
          anchorType: activeIncursion.runGenerationContext?.activeAnchor?.type
            ?? activeIncursion.runGenerationContext?.sectorState.activeAnchor?.type
            ?? null,
          operationKind: activeIncursion.runGenerationContext?.activeOperation.objectiveKind ?? null,
        })
      : null;
    const rewardTier = isBossEncounter && bossFlavorCtx
      ? resolveBossFlavorRewardTier(bossFlavorCtx)
      : compositionTier;
    recordCompositionEncounterVictory({
      templateId: compositionTemplateId,
      riskLabel: mods?.compositionRiskLabel ?? null,
      rewardTier,
      isElite: nodeType === 'ELITE_COMBAT',
      highRisk: Boolean(mods?.highRisk),
      anchorSignal: Boolean(mods?.anchorSignal),
      echoSignal: Boolean(mods?.echoSignal),
      highValue: Boolean(mods?.highValueResource),
      twistedTemplateId: victoryTwisted ?? null,
    });
    let creditReward = victoryCreditRewardRef.current;
    if (creditReward == null) {
      creditReward = computeCombatVictoryCreditReward({
        activeIncursion,
        vectorNode,
        isBossEncounter,
      });
    }
    victoryCreditRewardRef.current = null;
    const creditReason = isBossEncounter
      ? (isPrimeBossDepth(depth) ? 'prime anomaly eradicated' : 'district gate boss eradicated')
      : nodeType === 'ELITE_COMBAT'
        ? 'elite hostile eradicated'
        : 'hostile eradicated';

    awardRunCredits(creditReward, creditReason);
    const payoutLog = formatCompositionRewardPayoutLog(rewardTier, creditReward);
    if (payoutLog) {
      appendRunLog(payoutLog);
    }
    const isGatekeeper = isBossEncounter && isDistrictGateDepth(depth);
    if (isGatekeeper) {
      const lockedTemplate = rollGatekeeperLockedTemplate(
        `gatekeeper:${depth}:${runState.pendingEnemy?.rosterId ?? 'unknown'}`,
      );
      addLockedContainer(lockedTemplate);
      appendRunLog('>> GATEKEEPER SALVAGE — sealed container routed to Safehouse decryption vault.');
    }
    const bossRareBonus = bossFlavorCtx ? bossFlavorRareLootBonusPct(bossFlavorCtx) : 0;
    const combatDropInstanceIds = grantCombatResourceDrops({
      depth,
      isElite: nodeType === 'ELITE_COMBAT',
      isGatekeeper,
      rosterId: runState.pendingEnemy?.rosterId,
      seed: `combat:${depth}:${nodeType ?? 'std'}:${runState.pendingEnemy?.rosterId ?? 'unknown'}`,
      slainEnemies: runState.pendingEnemies ?? [],
      rareLootBonusPct: (activeIncursion.runModifiers?.rareLootBonusPct ?? 0)
        + bossRareBonus
        + (activeIncursion.environmentalModifiers?.directorRareLootBonusPct ?? 0),
      rewardTier,
      compositionTemplateId,
      veilBiome: activeIncursion.runVeilBiome,
      highValue: Boolean(mods?.highValueResource),
      echoSignal: Boolean(mods?.echoSignal),
      anchorSignal: Boolean(mods?.anchorSignal),
      highRisk: Boolean(mods?.highRisk),
      hasModifier: Boolean(mods?.encounterModifier),
      hasTwisted: Boolean(mods?.twistedTemplate),
      breachGrade: activeIncursion.breachGrade ?? 'I',
      rewardNodeKind: isBossEncounter ? 'BOSS' : undefined,
    });
    const echoCtx = resolveEchoRecoveryContext(vectorNode, activeIncursion.runGenerationContext);
    const echoDropInstanceIds = echoCtx && vectorNode?.contextModifiers?.echoEncounterKind === 'HOSTILE_ECHO'
      ? grantHostileEchoRewards(echoCtx, depth)
      : [];
    const harvestStagingIds = [...combatDropInstanceIds, ...echoDropInstanceIds];
    if (adrenalinePrimerActive) {
      consumeAdrenalinePrimerAfterCombat();
    }

    if (runState.pendingAmbush) {
      clearPendingAmbush();
      incrementCombatNodesCleared();
      refillStaminaAfterCombat();

      const harvestRoute = activeIncursion.pendingHarvestReturn;
      if (harvestRoute === 'POST_COMBAT') {
        if (isPostCombatBoonBlocked()) {
          completeCurrentNode('Ambush repelled — Ley-Scar boon waived.', result.remainingHp);
          return;
        }
        startPostCombatBoon();
        return;
      }
      if (harvestRoute === 'COMPLETE_NODE') {
        completeCurrentNode('Ambush repelled — harvest secured.', result.remainingHp);
        return;
      }

      completeCurrentNode('Ambush repelled.', result.remainingHp);
      return;
    }

    incrementCombatNodesCleared();
    refillStaminaAfterCombat();

    if (isBossEncounter) {
      completeCurrentNode('Region-Prime checkpoint cleared.', result.remainingHp);
      return;
    }

    beginPostCombatHarvest(harvestStagingIds);

    if (isPostCombatBoonBlocked()) {
      startResourceHarvest();
      return;
    }

    startPostCombatBoon();
  }, [
    activeIncursion.bossProfile,
    activeIncursion.defendRiftActive,
    activeIncursion.depthIdentity,
    activeIncursion.runGenerationContext,
    activeIncursion.runModifiers?.rareLootBonusPct,
    activeIncursion.runVeilBiome,
    adrenalinePrimerActive,
    awardRunCredits,
    grantCombatResourceDrops,
    grantHostileEchoRewards,
    consumeAdrenalinePrimerAfterCombat,
    addLockedContainer,
    appendRunLog,
    isPostCombatBoonBlocked,
    completeDefendRiftVictory,
    clearPendingAmbush,
    completeCurrentNode,
    exitToDevTestHub,
    finalizeRunDeath,
    getSelectedVectorNode,
    incrementCombatNodesCleared,
    beginPostCombatHarvest,
    refillStaminaAfterCombat,
    runState.combatTestPreset,
    runState.devSandboxPreset,
    runState.pendingAmbush,
    runState.pendingEnemy?.isBoss,
    startExtractionReview,
    startPostCombatBoon,
    startResourceHarvest,
    syncAfterCombat,
    clearNarrativeBoonStatusEffects,
    clearEncounterUltimateDisabled,
    recordDepthIdentityCombatVictory,
    recordCompositionEncounterVictory,
    recordBalanceCombatSample,
    activeIncursion.pendingHarvestReturn,
    activeIncursion.runGenerationContext,
  ]);

  const missionDepth = depthFromNodesCleared(activeIncursion.nodesCleared);
  const missionDepthLabel = `DEPTH ${missionDepth} // LEVEL ${activeIncursion.nodesCleared + 1}`;
  const rawSectorCandidate =
    activeIncursion.runGenerationContext?.sectorState?.activeAnchor?.displayName
    ?? activeIncursion.currentDistrict
    ?? null;
  const missionSectorLabel = (() => {
    if (rawSectorCandidate == null) return '';
    const text = String(rawSectorCandidate).replace(/_/g, ' ').trim();
    // Omit bare numeric / empty rows (was showing an isolated "2" under DEPTH).
    if (!text || /^\d+$/.test(text)) return '';
    return text;
  })();
  const activeContract = activeIncursion.activeContract;
  const activeOperation =
    activeIncursion.runGenerationContext?.activeOperation
    ?? activeIncursion.runGenerationContext?.sectorState?.activeOperation
    ?? null;
  const missionObjective =
    activeContract?.title
    ?? activeOperation?.title
    ?? activeOperation?.objectiveKind
    ?? (activeIncursion.defendRiftActive ? 'Hold the Rift' : null);
  const combatQuestLog = useMemo((): CombatQuestLogInfo | null => {
    if (!activeContract?.title && !activeOperation?.title) {
      if (activeIncursion.defendRiftActive) {
        return {
          contractTitle: 'Independent Descent',
          sponsorLabel: 'No Sponsor Mandate',
          objectiveText: 'Hold the Rift under fire and survive the encounter.',
          sectorLabel: String(missionSectorLabel).replace(/_/g, ' '),
        };
      }
      return null;
    }

    const reward = activeContract?.reward;
    const rewardText = reward
      ? `+${reward.credits} CR // +${reward.reputation} REP${
          reward.rareLootBonusPct ? ` // +${reward.rareLootBonusPct}% rare loot` : ''
        }`
      : null;
    const sealed = activeContract?.keepsakeSealedClause?.text?.trim();
    const mirrored = activeContract?.keepsakeMirroredObjective?.text?.trim();
    const bonusParts = [
      activeContract?.bonusObjectiveText?.trim(),
      sealed ? `Sealed: ${sealed}` : null,
      mirrored ? `Mirror: ${mirrored}` : null,
    ].filter(Boolean);

    return {
      contractTitle: activeContract?.title?.trim() || 'Independent Descent',
      sponsorLabel: activeContract?.sponsorId
        ? sponsorDisplayName(activeContract.sponsorId)
        : 'No Sponsor Mandate',
      objectiveText:
        activeContract?.objectiveText?.trim()
        || activeContract?.title?.trim()
        || 'Survive the encounter and extract.',
      bonusText: bonusParts.length > 0 ? bonusParts.join(' · ') : null,
      rewardText,
      difficultyLabel: activeContract?.difficulty
        ? `Tier ${activeContract.difficulty} / 5`
        : null,
      operationTitle: activeOperation?.title?.trim() || null,
      operationBrief:
        activeOperation?.description?.trim()
        || activeOperation?.rewardPreview?.trim()
        || null,
      sectorLabel: String(missionSectorLabel).replace(/_/g, ' '),
    };
  }, [
    activeContract,
    activeOperation,
    activeIncursion.defendRiftActive,
    missionSectorLabel,
  ]);

  return (
    <IncursionShell>
      <CombatTurnProvider>
        <CombatEnemyChromeProvider>
        <CombatArenaOverlayProvider>
        <CombatArenaCombatUiProvider>
        <CombatMinigameOverlayProvider>
        <IncursionRunLayout
          onConsumableUsed={handleConsumableUsed}
          onDeployCargoItem={handleDeployCargoItem}
          hideRunChrome
          style={styles.combatRoot}
        >
          <View style={styles.landscapeRoot}>
            <View style={styles.landscapeColumn}>
              <CombatJuiceHost style={styles.body}>
                <WeaponCombatPresentationHost />
                <View style={styles.arenaPanel}>
                  <CombatArenaBackground
                    source={arenaBackgroundSource}
                    scrimColor={arenaBackgroundScrimColor}
                  />

                  <View
                    style={[
                      styles.arenaForeground,
                      resolutionActive ? styles.arenaForegroundDimmed : null,
                    ]}
                    pointerEvents={resolutionActive ? 'none' : 'box-none'}
                  >
                    <CombatHudAtmosphereOverlay />
                    <CombatTopDockFade />

                    <View
                      style={[
                        styles.abyssalHudLayer,
                        abyssalHudOpacity < 1 ? { opacity: abyssalHudOpacity } : null,
                      ]}
                      pointerEvents={abyssalHudOpacity < 0.5 ? 'none' : 'box-none'}
                    >
                      <CombatMissionReadout
                        depthLabel={missionDepthLabel}
                        sectorLabel={missionSectorLabel}
                        objectiveLabel={missionObjective ? String(missionObjective).replace(/_/g, ' ') : null}
                        questLog={combatQuestLog}
                      />

                      <TurnOrderTopBar
                        turnOrder={squadUi?.turnOrder}
                        gridUnits={gridUnits}
                        operativeClass={operativeClass}
                        primaryColor={OTT.cyanSelect}
                        mutedColor={OTT.textMuted}
                        selectedUnitId={selectedEnemyUnit?.unitId}
                        onHostilePress={handleTurnOrderHostilePress}
                      />

                      <AbyssalVerdictReadyBanner
                        notifySeq={abyssalVerdictUi?.notifySeq ?? 0}
                        reducedMotion={abyssalVerdictUi?.reducedMotion === true}
                      />

                      <CombatRightRail
                        combatLog={<CombatDashboardMacroLog />}
                        hostileIntel={(
                          <HostileIntelView
                            enemy={selectedEnemyUnit}
                            enemies={gridUnits}
                            mutedColor={OTT.textSecondary}
                            onSelectEnemy={handleTurnOrderHostilePress}
                          />
                        )}
                      />
                    </View>

                    <ParticleOverlay biomeId={combatBiomeId} />

                    <CombatLandscapeArena
                      apparitionRef={apparitionRef}
                      playerViewportRef={playerViewportRef}
                      portraitKey={portraitKey}
                      portraitSource={focusedPortraitSource}
                      operativeClass={operativeClass}
                      weaponFamilyId={combatWeaponFamilyId}
                      wardPrimed={wardPrimed}
                      abilityPrimed={abilityPrimed}
                      enemySquadPanel={enemySquadPanel}
                      augmentIcons={combatAugmentIcons}
                      gridUnits={gridUnits}
                      onEradicationComplete={handleEradicationComplete}
                    />
                  </View>
                </View>

                <CombatTacticalDashboard
                  resolutionDimmed={resolutionActive}
                  cinematicOpacity={resolutionActive ? 1 : abyssalHudOpacity}
                  operativeStatus={(
                    operativeTelemetry ? (
                      <CombatOperativeHud
                        telemetry={operativeTelemetry}
                        primaryColor={OTT.terminalGreenMuted}
                        consolePanel
                        abyssalVerdictUi={abyssalVerdictUi}
                        onAbyssalVerdictPrime={() => abyssalVerdictHandlersRef.current?.prime()}
                        onAbyssalVerdictCancel={() => abyssalVerdictHandlersRef.current?.cancel()}
                      />
                    ) : null
                  )}
                  commandDeck={(
                    <CombatDashboardCommandColumn>
                      <TacticalCombatHub
                      arenaGridVariant="staggered"
                      apparitionRef={apparitionRef}
                      playerViewportRef={playerViewportRef}
                      registerKillResolver={registerKillResolver}
                      registerDissolveCompleteHandler={registerDissolveCompleteHandler}
                      registerHealHandler={registerHealHandler}
                      registerConsumableHandler={registerConsumableHandler}
                      registerCanDeployCargoHandler={registerCanDeployCargoHandler}
                      registerTargetHandler={registerTargetHandler}
                      registerIntelTargetHandler={registerIntelTargetHandler}
                      onAbyssalVerdictUiChange={setAbyssalVerdictUi}
                      registerAbyssalVerdictHandlers={registerAbyssalVerdictHandlers}
                      onSquadUiChange={handleSquadUiChange}
                      onOperativeTelemetryChange={handleOperativeTelemetryChange}
                      enemySquad={combatSquad}
                      threatBudget={threatBudget}
                      combatDistrict={activeIncursion.currentDistrict}
                      onWardPrimedChange={setWardPrimed}
                      onAbilityPrimedChange={setAbilityPrimed}
                      onResolutionPanelChange={handleResolutionPanelChange}
                      onCombatComplete={handleCombatComplete}
                      onLethalEnemyStrike={recordRunKillAttacker}
                      onGraftLootDrop={(kind) => {
                        if (kind.startsWith('CREDITS')) {
                          const amount = Number(kind.split(':')[1] ?? '5') || 5;
                          awardRunCredits(amount, 'Graft salvage (capped)');
                        }
                        if (kind === 'LEY_SLAG') {
                          grantCombatSalvage('ley-slag', 5);
                        }
                      }}
                      runCredits={activeIncursion.runCredits}
                      initialOperativeHp={runState.soulAnchorIntegrity}
                      initialStamina={combatEntryStamina}
                      maxStamina={runState.maxStamina}
                      maxSoulAnchor={runState.maxSoulAnchor}
                      startingAbyssalReservePercent={runState.startingAbyssalReservePercent}
                      parryMultiplierBonus={runState.parryMultiplierBonus}
                      parryWindowBonus={runState.parryWindowBonus}
                      sliceDamagePenalty={runState.sliceDamagePenalty}
                      enemyProfile={runState.pendingEnemy}
                      nodeIndex={activeIncursion.currentEncounterIndex}
                      onTerminalLog={appendRunLog}
                      weaponCombatStats={weaponCombatStats}
                      environmentalModifiers={env}
                      bossProfile={activeIncursion.bossProfile}
                      onBossPhaseShift={shiftBossPhase}
                      aegisLoadout={activeIncursion.aegisTechniqueLoadout}
                      hexShotLoadout={activeIncursion.hexShotLoadout}
                      envoyLoadout={activeIncursion.envoyLoadout}
                      leyLineMutations={activeIncursion.leyLineMutations}
                      hexShotBoons={activeIncursion.hexShotBoons}
                      envoyBoons={activeIncursion.envoyBoons}
                      firstTurnBonusAp={firstTurnBonusAp}
                      adrenalinePrimerActive={adrenalinePrimerActive}
                      incursionApBonus={activeIncursion.voidsTollApBonus}
                      onVoidsTollTriggered={applyVoidsTollSacrifice}
                      playerKineticArmorBonus={runKineticArmor}
                      kineticBatteryActive={kineticBatteryActive}
                      narrativeCombatBoons={narrativeCombatBoons}
                      activeWeaponFamilyId={combatWeaponFamilyId}
                      activeWeaponTier={activeIncursion.activeWeaponTier ?? 1}
                      simplifiedUltimateInputs={account.simplifiedUltimateInputs === true}
                      primeUltimateAtStart={
                        isDevSandboxCombatPreset(runState.devSandboxPreset)
                        || runState.combatTestPreset != null
                      }
                      playerCritChanceBonus={playerCritChanceBonus}
                      onPlayerCritImpact={handlePlayerCritImpact}
                      godModeActive={activeIncursion.godModeActive}
                      fullCritActive={activeIncursion.fullCritActive}
                      abilityGrafts={activeIncursion.abilityGrafts}
                      hexShotAbilityGrafts={activeIncursion.hexShotAbilityGrafts}
                      envoyAbilityGrafts={activeIncursion.envoyAbilityGrafts}
                      encounterUltimateDisabled={activeIncursion.encounterUltimateDisabled}
                      cargoHealReceivedMultiplier={cargoHealReceivedMultiplier}
                      encounterModifier={encounterModifier}
                      operativeClass={operativeClass}
                    />
                    </CombatDashboardCommandColumn>
                  )}
                />

                {showVictoryBanner && victoryPresentation ? (
                  <CombatResolutionBanner
                    outcome="VICTORY"
                    heading={victoryPresentation.heading}
                    summary={victoryPresentation.summary}
                    objectiveLine={victoryPresentation.objectiveLine}
                    continueLabel={victoryPresentation.continueLabel}
                    onDismiss={handleResolutionDismiss}
                  />
                ) : null}

                {showDefeatBanner && defeatPresentation ? (
                  <CombatResolutionBanner
                    outcome="DEFEAT"
                    heading={defeatPresentation.heading}
                    subtitle={defeatPresentation.subtitle}
                    eyebrow={defeatPresentation.eyebrow}
                    summary={defeatPresentation.summary}
                    objectiveLine={defeatPresentation.objectiveLine}
                    continueLabel={defeatPresentation.continueLabel}
                    onDismiss={handleResolutionDismiss}
                  />
                ) : null}

                <CombatMinigameOverlayHost />
              </CombatJuiceHost>

              <CombatParryScreenOverlay />
            </View>
          </View>
        </IncursionRunLayout>
        </CombatMinigameOverlayProvider>
        </CombatArenaCombatUiProvider>
        </CombatArenaOverlayProvider>
        </CombatEnemyChromeProvider>
      </CombatTurnProvider>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  combatRoot: {
    flex: 1,
    backgroundColor: OTT.bgBlack,
  },
  landscapeRoot: {
    flex: 1,
    width: '100%',
    backgroundColor: OTT.bgBlack,
  },
  landscapeColumn: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    // Visible so console hover detail can paint above the dock without clipping.
    overflow: 'visible',
  },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    position: 'relative',
    // Visible so ability hover panels can extend above the console band.
    overflow: 'visible',
  },
  arenaPanel: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    overflow: 'hidden',
  },
  arenaForeground: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  arenaForegroundDimmed: {
    opacity: 0.28,
  },
  /** Absolute host so CombatRightRail (position:absolute) keeps full arena bounds. */
  abyssalHudLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    pointerEvents: 'box-none',
  },
});
