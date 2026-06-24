import React, { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions, Pressable, Vibration, PanResponder } from 'react-native';
import {
  cancelAnimation,
  Easing as ReanimatedEasing,
  runOnJS,
  runOnUI,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTerminal } from '../context/TerminalContext';
import { advanceEnemyIntent } from '../data/enemies';
import { resolveEffectiveEnemyIntent } from '../data/enemyIntentUtils';
import { resolveActiveEnemyStatuses } from '../utils/enemyStatusEffects';
import type { PlayerAIState } from '../data/AIDecisionEngine';
import {
  computeBloodFrenzyHeal,
  scaleKineticDamage,
  type KineticDamageSource,
} from '../data/combatEnvironmentEngine';
import { bossStrikeDamage, rollBossIntent, shouldShiftBossPhase } from '../data/bossCombat';
import { resolveEnemyThreatTier } from '../data/enemyRoster';
import { COMBAT_ACTION, ENEMY_ABYSSAL_SIPHON_REQUEST, EnemyCombatProfile, EnemyIntent } from '../types/run';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';
import {
  applyCritMultiplier,
  resolveEnemyAttackHit,
  resolvePlayerAttackHit,
} from '../data/combatChanceEngine';
import {
  COMBAT_CHANCE,
  createDefaultCombatChanceState,
  type CombatChanceEncounterState,
  type CombatFeedbackEvent,
} from '../types/combatChance';
import CombatFloatingFeedback from './combat/CombatFloatingFeedback';
import { DEFAULT_AEGIS_LOADOUT, PLAYER_ACTION_POINTS_PER_TURN, type AegisAbilityId, type AegisLoadout } from '../types/aegisCombat';
import { getAbilityDefinition } from '../data/aegisAbilities';
import { buildGraftCastPlan, scaleGraftDamage } from '../data/veilGraftEngine';
import { getVeilGraftDefinition } from '../data/veilGraftDatabase';
import type { GraftCastPlan } from '../types/veilGraft';
import { COMBAT_CONSUMABLE_AP_COST, absorbByArmor, resolveHostileHpHit } from '../data/aegisAbilityResolver';
import { combatConsumableApCost } from '../data/cargoGridEngine';
import type { CargoItemId } from '../types/cargoGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import {
  executeExtendedAbility,
  isExtendedAbilityEnabled,
  type PlayerCombatBuffState,
} from '../data/aegisAbilityExecutor';
import {
  aggregateMutationModifiers,
  boonMatchesAction,
  createDefaultBoonEncounterState,
  hasMutation,
  modifierForAction,
  targetIsExposed,
  type MutationCombatModifiers,
} from '../data/boonEngine';
import { getAbilityTags } from '../data/aegisAbilities';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import type { EnvoyBoonId, HexShotBoonId } from '../types/classBoon';
import { createDefaultClassBoonEncounterState } from '../types/classBoon';
import type {
  EnvoyAbilityGraftMap,
  HexShotAbilityGraftMap,
  ClassGraftCastPlan,
} from '../types/classGraft';
import {
  buildClassGraftCastPlan,
  effectiveGraftAmmoCost,
  isClassUltimateDisabledForEncounter,
  scaleClassGraftDamage,
} from '../data/classGraftEngine';
import {
  aggregateEnvoyBoonModifiers,
  aggregateHexShotBoonModifiers,
  boonMatchesEnvoyAction,
  boonMatchesHexAction,
  hasEnvoyBoon,
  hasHexShotBoon,
} from '../data/classBoonEngine';
import {
  runClassTakeDamageBoons,
  runEnvoyEvadeSuccessBoons,
  runEnvoyRiftWardFailBoons,
  runEnvoyRiftWardSuccessBoons,
  runEnvoyTurnStartBoons,
  runHexShotKillBoons,
} from '../data/classBoonHookRunner';
import {
  adjustHexShotOutgoingDamage,
  applyVoidBleedDot,
  getHexShotCritOverrides,
  isOverwatchMasteryActive,
  markHexShotTacticalReloadPending,
  runHexShotKillBurstBoons,
  runHexShotOnAbilityResolveBoons,
  runHexShotOnHitBoons,
  applyHexShotTacticalReloadDiscount,
  tickHexShotChemicalWarfare,
  tryHexShotPanicButton,
} from '../data/hexShotBoonHookRunner';
import {
  adjustEnvoyOutgoingDamage,
  applyEnvoyHeavyGravityApDrain,
  applyEnvoyWardWeaverApDiscount,
  applyVoidsBargainStartBleed,
  getCataclysmicEchoDamageBonus,
  getEnvoyVolatileMagicCritBonus,
  resolveEnvoyAethericBulwarkArmor,
  runAgonizingHexOnEnemyTurn,
  runEnvoyKillBoonsExtended,
  runEnvoyOnAbilityResolveBoons,
  runEnvoyOnHitBoons,
  runEnvoyOverloadEntryBoons,
  tickEnvoyHexBreaker,
  tryEnvoyBloodMagicCast,
  markEnemyCursed,
} from '../data/envoyBoonHookRunner';
import {
  applyClassGraftEnemyApDrains,
  applyClassGraftTargetPatch,
  collectClassGraftCastSideEffects,
  finalizeClassGraftAfterAbility,
  resolveClassGraftFailDebuff,
  resolveClassGraftSurviveDebuff,
  resolveClassGraftStrikeTargetIds,
} from '../data/classGraftRuntime';
import { getHexShotAbilityTags } from '../data/hexShotAbilities';
import { getEnvoyAbilityTags } from '../data/envoyAbilities';
import { normalizeSquad, spawnCombatSquad, squadFromSingleEnemy } from '../data/combatSpawnEngine';
import {
  allUnitsDefeated,
  aliveUnits,
  getUnitById,
  isUnitAlive,
  nextDefaultTarget,
  primaryAliveUnit,
  updateUnit as patchSquadUnit,
} from '../data/combatSquadEngine';
import {
  abilityRequiresTarget,
  abilityTargetMode,
  canTargetWithAbility,
  isUnitBlockedForAbility,
  isUnitHookValid,
  validTargetsForAbility,
  resolveWardenInterceptTarget,
} from '../data/combatTargeting';
import {
  BREACHER_STAMINA_DRAIN,
  LEGION_COLD_VACUUM_STAMINA,
  SPOTTER_ARTILLERY_TRUE_DAMAGE,
} from '../data/factionTraitEngine';
import {
  pickThreatBudgetActions,
  recoverFracturedUnits,
  THREAT_BUDGET_AMBUSH,
  THREAT_BUDGET_ELITE,
  THREAT_BUDGET_STANDARD,
} from '../data/combatThreatBudget';
import {
  addCombatTag,
  applyDamageWithFractureBonus,
  applyFractureDamage,
  applyFracturedState,
  willFractureBreak,
  doomedPulseStacks,
  fractureRatio,
  initEnemyCombatLayers,
  isEnemyFractured,
  recoverFromFracture,
  stackDoomedTag,
} from '../data/combatFractureEngine';
import type { BlueprintId } from '../types/equipmentBlueprint';
import { CombatLifecycleManager, applyHookWeaverTetherAction, applyLeySirenTetherAction } from '../data/combatLifecycleEngine';
import { isRosterSpecificIntent, isNullShadeVoidAmbush, nullShadeVoidAmbushCleanupPatch, patchRosterAfterIntentExec, resolveRosterEnemyDamage, ROSTER_AI_WEIGHTS, syncRosterCombatState, VOID_AMBUSH_CRIT_CHANCE, VOID_AMBUSH_INTERRUPT_THRESHOLD } from '../data/combatRosterActions';
import { getAlphaMechanic } from '../data/enemyAlphaConfig';
import {
  fixerDistrictFromProfile,
  fixerRepairTarget,
  rollFixerRepairAmount,
} from '../data/fixerRepairEngine';
import type { PlayerCombatState } from '../types/combatLifecycle';
import type { CombatSessionExtras } from '../types/combatHooks';
import { createDefaultCombatSessionExtras, addStructuredDebuff, hasStructuredDebuff, removeStructuredDebuff } from '../types/combatHooks';
import { isHeavyArchetype, type EnemySpawnArchetype } from '../data/enemyCombatConfig';
import {
  getEnemyAccuracyPenalty,
  getEnemyDamageTakenMultiplier,
  patchEnemyTagsFromExtras,
  runOnCombatStartHooks,
  runOnFireHooks,
  runOnHitHooks,
  tickCombatSessionExtras,
  applyFrontlineBlinded,
} from '../data/combatHookRunner';

import { ResolvedWeaponCombatStats } from '../data/inventory';
import { BossRuntimeProfile, EnvironmentalModifiers, type ClassType } from '../types/game';
import {
  DEFAULT_MAGAZINE_SIZE,
  ENVOY_OVERLOAD_SELF_DAMAGE,
  ENVOY_OVERLOAD_THRESHOLD,
  type ActiveReloadResult,
} from '../types/classCombatResources';
import { activeReloadLogLine } from '../data/activeReloadEngine';
import ActiveReloadOverlay from './combat/ActiveReloadOverlay';
import ZeroProtocolGridOverlay from './combat/ZeroProtocolGridOverlay';
import CataclysmSigilOverlay from './combat/CataclysmSigilOverlay';
import FractureBreakPrompt from './combat/FractureBreakPrompt';
import EnvoyWardOverlay, { type EnvoyWardExpansionSpeed } from './combat/EnvoyWardOverlay';
import { ASHEN_DISSOLVE_TOTAL_MS } from './combat/CombatEnemyDissolveEffect';
import {
  PERFECT_PARRIES_FOR_ULTIMATE,
  PERFECT_RELOADS_FOR_ULTIMATE,
  ENVOY_FLUX_ULTIMATE_THRESHOLD,
  ZERO_PROTOCOL_DAMAGE_PER_TAP,
  CATACLYSM_SUCCESS_AOE,
  CATACLYSM_FAIL_AOE,
  CATACLYSM_FAIL_BACKLASH,
  CATACLYSM_FAIL_FLUX,
  isEnvoyProcUltimate,
  isHexShotProcUltimate,
} from '../data/combatMasteryEngine';
import {
  sanitizeEnvoyCombatLoadout,
  sanitizeHexShotCombatLoadout,
} from '../data/classAbilityUnlockEngine';
import { planFractureBreachStrike } from '../data/combatFractureBreachEngine';
import {
  isHitstopActive,
  triggerHitstop,
  triggerHaptic,
  triggerShake,
} from '../utils/combatJuice';
import type { UltimatePingVariant } from './combat/UltimateReadyPing';
import CombatMagazineGauge from './combat/CombatMagazineGauge';
import {
  createDefaultClassCombatEncounterState,
  type ClassCombatEncounterState,
} from '../types/classCombatAbility';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
  type EnvoyLoadout,
  type HexShotLoadout,
} from '../types/operativeClass';
import {
  classAbilityRequiresTarget,
  classAbilityTargetMode,
  canTargetWithClassAbility,
  isUnitBlockedForClassAbility,
  isUnitHookValidForClass,
  validTargetsForClassAbility,
} from '../data/combatClassTargeting';
import {
  formatClassAbilityCostLine,
  resolveClassAbilityCost,
} from '../data/classAbilityResolver';
import { formatAbilityLabel } from '../data/classLoadoutEngine';
import {
  detonateRiftSnareOnUnit,
  executeHexShotAbility,
  isHexShotAbilityEnabled,
  tickHexShotClassState,
} from '../data/hexShotAbilityExecutor';
import {
  applyEntropyHexDot,
  executeEnvoyAbility,
  isEnvoyAbilityEnabled,
} from '../data/envoyAbilityExecutor';
import {
  applyBrimstoneBleedDot,
  applyEnemyApDrainAtTurnStart,
  isEnemyHealBlocked,
  isGhostCamoBlockingAttacks,
  resolveAstralLockCrit,
} from '../data/classCombatStateEngine';
import CombatTelemetryGaugeRow from './combat/CombatHorizontalGauge';
import type { ApparitionViewportRef } from './combat/ApparitionViewport';
import type { CombatPlayerViewportRef } from './combat/CombatPlayerViewport';
import type { CombatOperativeTelemetry } from './combat/CombatOperativeHud';
import CombatCommandDeck, { COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE } from './CombatCommandDeck';
import ParryMatrixOverlay from './combat/ParryMatrixOverlay';
import ParrySuccessBurstOverlay from './combat/ParrySuccessBurstOverlay';
import VectorSliceOverlay, { ORIGIN_JITTER } from './combat/VectorSliceOverlay';
import {
  generateVariedSliceAngles,
  getSliceLineSegment,
  swipeHitsSliceLine,
  type SliceArenaSize,
} from '../utils/sliceLineGeometry';
import {
  CombatChromeBridge,
  useCombatEnemyChromeOptional,
} from '../context/CombatEnemyChromeContext';
import { CombatArenaOverlaySink } from '../context/CombatArenaOverlayContext';
import {
  type CombatTurnPhase,
  useCombatTurnOptional,
} from '../context/CombatTurnContext';
import {
  type CombatSquadUiSnapshot,
  type EnemyDeckStrikeVariant,
  formatHostileId,
  formatIntentReadout,
  isEnemyChargeIntent,
  isEnemyDamageIntent,
  isEnemySiphonIntent,
  classifyEnemyTurnMotion,
  resolveEnemyTurnPhase,
  getEnemyBuffFloatLabel,
  getStatusFloatTone,
  type EnemyPortraitAnim,
  type EnemyPortraitGlow,
  type EnemyIntentShimmer,
  getEnemyDeckStrikeVariant,
  GAUGE_ABYSSAL,
  GAUGE_MAGAZINE,
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
  GAUGE_VEIL_FLUX,
} from '../utils/combatTelemetryFormat';
import { buildCombatTurnOrder } from '../utils/combatTurnOrder';
import {
  BACKLINE_MELEE_DASH_IMPACT_MS,
  BACKLINE_MELEE_DASH_TOTAL_MS,
  ENEMY_BACKLINE_MELEE_ANIM_MS,
  ENEMY_BUFF_ANIM_MS,
  ENEMY_MELEE_ANIM_MS,
  ENEMY_RANGED_ANIM_MS,
  FRONTLINE_MELEE_IMPACT_MS,
  playerAttackLungeDelta,
  resolveArenaLayoutMode,
  type ArenaGridVariant,
  type ArenaLayoutMode,
} from './combat/combatEnemyBarLayout';
import VignetteFlashOverlay from './VignetteFlashOverlay';
import {
  applyAbyssalSiphon,
  formatAbyssalSiphonLog,
} from '../utils/combatResourceState';
import { useReactiveCombatStatus } from '../hooks/useReactiveCombatStatus';
import {
  isParryAttemptSuccessful,
  PARRY_HALO_DURATION_MS,
  PARRY_RING_SCALE_END,
  PARRY_RING_SCALE_START,
  type ParryArenaLayout,
} from '../utils/parryCollision';

const TELEMETRY_DIVIDER = 'rgba(139, 92, 246, 0.2)';

const FRACTURE_HOUND_DOUBLE_STRIKE_CHANCE = 0.35;
const EVISCERATE_AP_COST = 2;

const DEFEND_ABILITIES: AegisAbilityId[] = ['WRAITH_PARRY', 'ASHEN_MANTLE', 'BLOOD_BOUND_CARAPACE'];
const BUFF_ABILITIES: AegisAbilityId[] = ['DEMONS_LUNG', 'CRIMSON_PACT'];

const { width, height: windowHeight } = Dimensions.get('window');

/** @deprecated Import from `src/constants/combatLayout`. */
export { TACTICAL_HUB_STACKED_RIGHT_INSET } from '../constants/combatLayout';
const MONO = 'monospace';
const P = {
  enemyHp: '#ef4444', unitTitle: '#ffffff', enemyPosture: '#fde68a',
  kr: '#bae6fd', krBorder: '#7dd3fc', parry: '#00ff33', defeat: '#5c0606',
};
const PARRY_DURATION = 1000;
const SLICE_HIT_HAPTIC_MS = 15;
const WARD_STRIKE_ACCENT = '#fde68a';
type CombatPhase = 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'DEFEND_WARD' | 'OFFENSE_SLICE' | 'RESOLUTION';

interface TacticalCombatHubProps {
  /** Arena grid geometry for strike FX / dash math. */
  arenaGridVariant?: ArenaGridVariant;
  onOperativeTelemetryChange?: (telemetry: CombatOperativeTelemetry | null) => void;
  onWardPrimedChange?: (primed: boolean) => void;
  onAbilityPrimedChange?: (primed: boolean) => void;
  apparitionRef?: RefObject<ApparitionViewportRef | null>;
  playerViewportRef?: RefObject<CombatPlayerViewportRef | null>;
  /** Registers callback invoked after eradication dissolve completes (victory). */
  registerKillResolver?: (resolver: () => void) => void;
  /** Registers callback when a hostile finishes its dissolve VFX. */
  registerDissolveCompleteHandler?: (handler: (unitId: string) => void) => void;
  /** Registers callback to apply mid-combat healing from incursion consumables. */
  registerHealHandler?: (handler: (amount: number) => void) => void;
  /** Registers callback when a field consumable is deployed during combat. */
  registerConsumableHandler?: (handler: (result: IncursionConsumableUseResult) => void) => void;
  /** Registers preflight check before cargo is consumed (player turn + AP for item). */
  registerCanDeployCargoHandler?: (handler: (itemId: import('../types/cargoGrid').CargoItemId) => boolean) => void;
  /** Registers grid target selection from CombatScreen. */
  registerTargetHandler?: (handler: (unitId: string) => void) => void;
  /** Registers intel-only hostile focus (turn order / scouting). */
  registerIntelTargetHandler?: (handler: (unitId: string) => void) => void;
  /** Stacked layout: victory/defeat panel in the apparition viewport (hub keeps deck + gauges). */
  onResolutionPanelChange?: (
    panel: { outcome: 'VICTORY' | 'DEFEAT'; onDismiss: () => void } | null,
  ) => void;
  onCombatComplete?: (r: { victory: boolean; remainingHp: number; remainingStamina: number }) => void;
  /** Live run credits for cargo deck HUD. */
  runCredits?: number;
  /** Records the hostile designation that dealt the killing blow. */
  onLethalEnemyStrike?: (designation: string) => void;
  initialOperativeHp?: number; initialStamina?: number; maxStamina?: number; maxSoulAnchor?: number;
  startingAbyssalReservePercent?: number; parryMultiplierBonus?: number; parryWindowBonus?: number;
  sliceDamagePenalty?: number; onTerminalLog?: (text: string) => void;
  enemyProfile?: EnemyCombatProfile | null;
  enemySquad?: EnemyCombatProfile[];
  onSquadUiChange?: (snapshot: CombatSquadUiSnapshot) => void;
  threatBudget?: number;
  nodeIndex?: number;
  weaponCombatStats?: ResolvedWeaponCombatStats;
  environmentalModifiers?: EnvironmentalModifiers;
  bossProfile?: BossRuntimeProfile | null;
  onBossPhaseShift?: (phase: number) => void;
  aegisLoadout?: AegisLoadout;
  hexShotLoadout?: HexShotLoadout;
  envoyLoadout?: EnvoyLoadout;
  leyLineMutations?: LeyLineMutationId[];
  hexShotBoons?: HexShotBoonId[];
  envoyBoons?: EnvoyBoonId[];
  combatDistrict?: 1 | 2 | 3;
  /** Bound requisition first-turn AP bonus (Adrenaline Primer). */
  firstTurnBonusAp?: number;
  /** Shadow War Slag Works — flat kinetic armor layers on operative. */
  playerKineticArmorBonus?: number;
  /** Bound requisition / forge passive — defend to overcharge next strike. */
  kineticBatteryActive?: boolean;
  /** Narrative bonus boons claimed for this combat encounter. */
  narrativeCombatBoons?: import('../types/narrativeBonusReward').PendingNarrativeCombatBoons;
  /** Equipped class weapon blueprint — claymore / pulse rifle / hex hooks. */
  equippedBlueprintId?: BlueprintId | null;
  /** Faction passive crit bonus (e.g. Solaris +10%). */
  playerCritChanceBonus?: number;
  /** Arena camera shake + global crit hooks (CombatScreen). */
  onPlayerCritImpact?: (payload: {
    unitId: string;
    channel: 'KINETIC' | 'OCCULT' | 'TRUE';
  }) => void;
  /** God Mode consumable — 1000 STRIKE damage and locked max resources. */
  godModeActive?: boolean;
  /** Run-scoped Veil-Grafts keyed by loadout ability. */
  abilityGrafts?: import('../types/veilGraft').AbilityGraftMap;
  hexShotAbilityGrafts?: HexShotAbilityGraftMap;
  envoyAbilityGrafts?: EnvoyAbilityGraftMap;
  /** Apex Graft — disables ultimate abilities for this encounter. */
  encounterUltimateDisabled?: boolean;
  /** Graft kill loot — e.g. Scavenger Bolt credits. */
  onGraftLootDrop?: (kind: string) => void;
  /** Active operative class — drives magazine / veil-flux resources (Phase 2). */
  operativeClass?: ClassType;
}
interface SliceLineConfig {
  id: number;
  centerXRatio: number;
  centerYRatio: number;
  angleDeg: number;
  isSliced: boolean;
}

const isAttackIntent = (i: EnemyIntent) =>
  i === 'STRIKE'
  || i === 'WORLD_ENDER'
  || i === 'OVERDRIVE_DISCHARGE'
  || i === 'PAVEMENT_CRUSHER'
  || i === 'DOUBLE_STRIKE'
  || i === 'VOID_AMBUSH'
  || i === 'RESONANCE_OVERLOAD';

const ENEMY_INTENT_READ_MS = 1800;
const ENEMY_TURN_GAP_MS = 500;
const GOD_MODE_STRIKE_DAMAGE = 1000;

type EnemyActionStage = 'reading' | 'executing' | null;

export default function TacticalCombatHub({
  arenaGridVariant = 'staggered',
  onOperativeTelemetryChange,
  onWardPrimedChange,
  onAbilityPrimedChange,
  apparitionRef,
  playerViewportRef,
  registerKillResolver,
  registerDissolveCompleteHandler,
  registerHealHandler,
  registerConsumableHandler,
  registerCanDeployCargoHandler,
  registerTargetHandler,
  registerIntelTargetHandler,
  onResolutionPanelChange,
  onCombatComplete,
  onLethalEnemyStrike,
  runCredits = 0,
  initialOperativeHp = 100, initialStamina = 100, maxStamina = 100,
  maxSoulAnchor = 100, startingAbyssalReservePercent = 0, parryMultiplierBonus = 0,
  parryWindowBonus = 0, sliceDamagePenalty = 0, onTerminalLog,
  enemyProfile = null,
  enemySquad,
  onSquadUiChange,
  threatBudget,
  nodeIndex = 0,
  weaponCombatStats,
  environmentalModifiers,
  bossProfile = null,
  onBossPhaseShift,
  aegisLoadout = DEFAULT_AEGIS_LOADOUT,
  hexShotLoadout = DEFAULT_HEX_SHOT_LOADOUT,
  envoyLoadout = DEFAULT_ENVOY_LOADOUT,
  leyLineMutations = [],
  hexShotBoons = [],
  envoyBoons = [],
  combatDistrict = 1,
  firstTurnBonusAp = 0,
  playerKineticArmorBonus = 0,
  kineticBatteryActive = false,
  narrativeCombatBoons,
  equippedBlueprintId = null,
  playerCritChanceBonus = 0,
  onPlayerCritImpact,
  godModeActive = false,
  abilityGrafts = {},
  hexShotAbilityGrafts = {},
  envoyAbilityGrafts = {},
  encounterUltimateDisabled = false,
  onGraftLootDrop,
  operativeClass = 'AEGIS',
}: TacticalCombatHubProps): React.JSX.Element {
  const hexShotBoonMods = useMemo(
    () => aggregateHexShotBoonModifiers(hexShotBoons),
    [hexShotBoons],
  );
  const envoyBoonMods = useMemo(
    () => aggregateEnvoyBoonModifiers(envoyBoons),
    [envoyBoons],
  );
  const maxAmmo = DEFAULT_MAGAZINE_SIZE + hexShotBoonMods.maxAmmoBonus;
  const fluxOverloadThreshold = envoyBoonMods.fluxOverloadThreshold;
  const env = environmentalModifiers ?? {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
  };
  const strikeStats = weaponCombatStats ?? {
    strikeDamage: COMBAT_ACTION.ABYSSAL_STRIKE_DAMAGE,
    strikeStaminaCost: COMBAT_ACTION.ABYSSAL_STRIKE_STAMINA,
    exhaustedStrikeDamage: COMBAT_ACTION.ABYSSAL_STRIKE_EXHAUSTED_DAMAGE,
    abyssalChargePerStrike: COMBAT_ACTION.ABYSSAL_RESERVE_CHARGE,
    label: 'Standard Blade',
  };
  const { theme, profile, awardCurrencies } = useTerminal();

  const [cycleState, setCycleState] = useState<CombatPhase>('TEXT_COMBAT');
  const [squad, setSquad] = useState<EnemyCombatProfile[]>([]);
  const squadRef = useRef<EnemyCombatProfile[]>([]);
  const [enemy, setEnemy] = useState<EnemyCombatProfile | null>(null);
  const enemyRef = useRef<EnemyCombatProfile | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const selectedTargetIdRef = useRef<string | null>(null);
  const focusedUnitIdRef = useRef<string | null>(null);
  const enemyActionQueueRef = useRef<string[]>([]);
  const counteringEnemyRef = useRef(false);
  const threatBudgetRef = useRef(threatBudget ?? THREAT_BUDGET_STANDARD);
  const arenaLayoutModeRef = useRef<ArenaLayoutMode>('group');
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [operativeHp, setOperativeHp] = useState(initialOperativeHp);
  const [stamina, setStamina] = useState(initialStamina);
  const [abyssalReserve, setAbyssalReserve] = useState(startingAbyssalReservePercent);
  const { isExhausted } = useReactiveCombatStatus(stamina);
  const [abyssalWardActive, setAbyssalWardActive] = useState(false);
  /** True after Aegis blocks — next Abyssal Strike gets bonus AR (deck highlight). */
  const [strikeArPrimed, setStrikeArPrimed] = useState(false);
  const [counterPrepActive, setCounterPrepActive] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isFailureState, setIsFailureState] = useState(false);
  const [parrySuccessBurstActive, setParrySuccessBurstActive] = useState(false);
  const [parryBurstArena, setParryBurstArena] = useState<ParryArenaLayout | null>(null);
  const [parryBurstEpoch, setParryBurstEpoch] = useState(0);
  const enemyChrome = useCombatEnemyChromeOptional();
  const enemyChromeRef = useRef(enemyChrome);
  enemyChromeRef.current = enemyChrome;
  const combatTurn = useCombatTurnOptional();
  const parryBurstEpochRef = useRef(0);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const [screenFlashColor, setScreenFlashColor] = useState(P.defeat);
  const [phaseAlert, setPhaseAlert] = useState<string | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const bossPhaseRef = useRef(bossProfile?.currentPhase ?? 1);
  const bossRuntimeRef = useRef<BossRuntimeProfile | null>(bossProfile);
  const [activeSliceIndex, setActiveSliceIndex] = useState(-1);
  const [sliceLines, setSliceLines] = useState<SliceLineConfig[]>([]);
  const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
  const [playerActionPoints, setPlayerActionPoints] = useState(PLAYER_ACTION_POINTS_PER_TURN);
  const [initiativeQueued, setInitiativeQueued] = useState(false);
  const [initiativeProcSeq, setInitiativeProcSeq] = useState(0);
  const [apRollupDisplay, setApRollupDisplay] = useState<number | null>(null);
  const [shadowstepProcActive, setShadowstepProcActive] = useState(false);
  const [enemyActionStage, setEnemyActionStage] = useState<EnemyActionStage>(null);
  const enemyActionStageRef = useRef<EnemyActionStage>(null);
  const [eviscerateTargetUnitId, setEviscerateTargetUnitId] = useState<string | null>(null);
  const [currentAmmo, setCurrentAmmo] = useState(DEFAULT_MAGAZINE_SIZE);
  const [hexOvercharged, setHexOvercharged] = useState(false);
  const [veilFlux, setVeilFlux] = useState(0);
  const [envoyOverloaded, setEnvoyOverloaded] = useState(false);
  const [envoySilenced, setEnvoySilenced] = useState(false);
  const [activeReloadVisible, setActiveReloadVisible] = useState(false);
  const [hexReloadUsedThisTurn, setHexReloadUsedThisTurn] = useState(false);
  const hexReloadUsedThisTurnRef = useRef(false);
  const [zeroProtocolVisible, setZeroProtocolVisible] = useState(false);
  const zeroProtocolActiveRef = useRef(false);
  const [cataclysmSigilVisible, setCataclysmSigilVisible] = useState(false);
  const [fractureBreakUnitId, setFractureBreakUnitId] = useState<string | null>(null);
  const [envoyWardSpeed, setEnvoyWardSpeed] = useState<EnvoyWardExpansionSpeed>('normal');
  const [perfectReloadCount, setPerfectReloadCount] = useState(0);
  const [successfulParryCount, setSuccessfulParryCount] = useState(0);
  const [cataclysmReadyUi, setCataclysmReadyUi] = useState(false);
  const combatPausedRef = useRef(false);
  const riftWardReadyRef = useRef(false);

  const operativeHpRef = useRef(initialOperativeHp);
  const currentAmmoRef = useRef(DEFAULT_MAGAZINE_SIZE);
  const hexOverchargedRef = useRef(false);
  const veilFluxRef = useRef(0);
  const envoyOverloadedRef = useRef(false);
  const envoySilencedRef = useRef(false);
  const sessionExtrasRef = useRef<CombatSessionExtras>(createDefaultCombatSessionExtras());
  const combatChanceRef = useRef<CombatChanceEncounterState>(createDefaultCombatChanceState());
  const [combatFeedback, setCombatFeedback] = useState<{
    nonce: number;
    event: CombatFeedbackEvent;
  } | null>(null);
  const feedbackNonceRef = useRef(0);
  const staminaRef = useRef(initialStamina);
  const abyssalRef = useRef(startingAbyssalReservePercent);
  const skipRegenRef = useRef(false);
  const abyssalWardRef = useRef(false);
  const wardStrikeBonusRef = useRef(false);
  const kineticBatteryChargedRef = useRef(false);
  const counterRef = useRef(false);
  const pendingDmgRef = useRef(0);
  const pendingUnblockRef = useRef(false);
  /** HP already applied when the red deck strike overlay appeared. */
  const preAppliedHpStrikeRef = useRef(0);
  const enemyStunPendingRef = useRef(false);
  const hitFlashSeqRef = useRef<Record<string, number>>({});
  const classImpactFxRef = useRef<Record<string, { seq: number; kind: import('../utils/combatTelemetryFormat').CombatClassImpactKind }>>({});
  const critImpactSeqRef = useRef<Record<string, { seq: number; channel: 'KINETIC' | 'OCCULT' | 'TRUE' }>>({});
  const evadeImpactSeqRef = useRef<Record<string, number>>({});
  const statusFloatSeqRef = useRef<Record<string, number>>({});
  const lifecycleFloatLabelsRef = useRef<Record<string, string>>({});
  const backlineDashSeqRef = useRef<Record<string, number>>({});
  const backlineDashActiveRef = useRef<Record<string, boolean>>({});
  const retributionParryRef = useRef<{ unitId: string; occultDamage: number } | null>(null);
  const pendingDissolveRef = useRef<{ unitId: string; profile: EnemyCombatProfile; hp: number } | null>(null);
  const dissolveSeqRef = useRef<Record<string, number>>({});
  const dissolvedHiddenRef = useRef<Set<string>>(new Set());
  const pendingVictoryRef = useRef(false);
  const victoryFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasEnemyTurnAtVictoryRef = useRef(false);
  const lastActiveTurnPhaseRef = useRef<CombatTurnPhase>('PLAYER_COMMAND');
  const survivedEnemyTurnsRef = useRef(0);
  const isPlayerTurnRef = useRef(isPlayerTurn);
  const resolutionRef = useRef<'VICTORY' | 'DEFEAT' | null>(null);
  const dismissedRef = useRef(false);
  const cycleRef = useRef<CombatPhase>('TEXT_COMBAT');
  const parryScaleSV = useSharedValue(2.5);
  const parryResolvedRef = useRef(false);
  const parryTapPendingRef = useRef(false);
  const parrySessionRef = useRef(0);
  const parryHaloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parryBurstCompleteRef = useRef<(() => void) | null>(null);
  const parryArenaRef = useRef<ParryArenaLayout | null>(null);
  const screenFlashAnim = useRef(new Animated.Value(0)).current;
  const activeSliceRef = useRef(-1);
  const sliceArenaRef = useRef<SliceArenaSize>({ width: 0, height: 0 });
  const sliceTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const crossedRef = useRef(false);
  const sliceSessionRef = useRef({
    lines: [] as SliceLineConfig[], hitCount: 0, slicedIds: new Set<number>(),
    segmentTimer: null as ReturnType<typeof setTimeout> | null,
    hitFlashTimer: null as ReturnType<typeof setTimeout> | null, evaluated: false,
  });
  const sliceHandlersRef = useRef({
    queueNext: (_i: number) => {}, validate: () => {}, evaluate: () => {}, trigger: () => {},
  });
  const enemyTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyTurnGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyStrikeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voidAmbushWindowRef = useRef<{ unitId: string; damageDealt: number } | null>(null);
  const playerApRef = useRef(PLAYER_ACTION_POINTS_PER_TURN);
  const wraithParryRef = useRef(false);
  const bloodBoundCarapaceRef = useRef(false);
  const shadowstepProcRef = useRef(false);
  const apRollupFrameRef = useRef<number | null>(null);
  const combatBuffRef = useRef<PlayerCombatBuffState>({
    demonLungCooldown: 0,
    crimsonPactCharges: 0,
    bonusApThisTurn: 0,
    initiativeQueued: false,
  });
  const mutationModsRef = useRef<MutationCombatModifiers>(
    aggregateMutationModifiers(leyLineMutations),
  );
  const hexShotBoonModsRef = useRef(hexShotBoonMods);
  hexShotBoonModsRef.current = hexShotBoonMods;
  const envoyBoonModsRef = useRef(envoyBoonMods);
  envoyBoonModsRef.current = envoyBoonMods;
  const mutationEncounterRef = useRef(createDefaultBoonEncounterState());
  const classBoonEncounterRef = useRef(createDefaultClassBoonEncounterState());
  const activeGraftPlanRef = useRef<GraftCastPlan | null>(null);
  const activeGraftStaminaSpentRef = useRef(0);
  const activeGraftApCostRef = useRef(0);
  const graftCooldownsRef = useRef<Partial<Record<AegisAbilityId, number>>>({});
  const abilityGraftsRef = useRef(abilityGrafts);
  abilityGraftsRef.current = abilityGrafts;
  const hexShotAbilityGraftsRef = useRef(hexShotAbilityGrafts);
  hexShotAbilityGraftsRef.current = hexShotAbilityGrafts;
  const envoyAbilityGraftsRef = useRef(envoyAbilityGrafts);
  envoyAbilityGraftsRef.current = envoyAbilityGrafts;
  const activeClassGraftPlanRef = useRef<ClassGraftCastPlan | null>(null);
  const activeClassGraftApCostRef = useRef(0);
  const lastPlayerAbilityRef = useRef<string | null>(null);
  const lastAegisAbilityRef = (): AegisAbilityId | undefined =>
    operativeClass === 'AEGIS'
      ? (lastPlayerAbilityRef.current as AegisAbilityId | undefined)
      : undefined;
  const classCombatRef = useRef<ClassCombatEncounterState>(createDefaultClassCombatEncounterState());

  const isCombatTerminal = () =>
    resolutionRef.current != null || operativeHpRef.current <= 0;

  const canPlayerCommand = () =>
    cycleRef.current === 'TEXT_COMBAT'
    && !shadowstepProcRef.current
    && !combatPausedRef.current
    && !activeReloadVisible
    && !zeroProtocolVisible
    && !cataclysmSigilVisible
    && fractureBreakUnitId == null
    && (isPlayerTurnRef.current || voidAmbushWindowRef.current != null);

  const buildPlayerAIState = (): PlayerAIState => ({
    hp: operativeHpRef.current,
    maxHp: maxSoulAnchor,
    stamina: staminaRef.current,
    maxStamina,
    abyssalReserve: abyssalRef.current,
    actionPoints: playerApRef.current,
  });

  const buildLifecycleContext = () => ({
    squad: squadRef.current,
    player: buildPlayerAIState() as PlayerCombatState,
    extras: {
      ...sessionExtrasRef.current,
      fleshWarpUnitIds: classCombatRef.current.fleshWarpUnits,
    },
  });

  const applyLifecycleExtras = (patch?: Partial<CombatSessionExtras>) => {
    if (!patch) return;
    sessionExtrasRef.current = {
      ...sessionExtrasRef.current,
      ...patch,
      immunePopupSeq: patch.immunePopupSeq ?? sessionExtrasRef.current.immunePopupSeq,
      leySirenTetheredUnitIds: patch.leySirenTetheredUnitIds ?? sessionExtrasRef.current.leySirenTetheredUnitIds,
      playerApPenaltyNextTurn: patch.playerApPenaltyNextTurn ?? sessionExtrasRef.current.playerApPenaltyNextTurn,
      playerApCapNextTurn: patch.playerApCapNextTurn !== undefined
        ? patch.playerApCapNextTurn
        : sessionExtrasRef.current.playerApCapNextTurn,
      ashTokens: patch.ashTokens ?? sessionExtrasRef.current.ashTokens,
      structuredDebuffs: patch.structuredDebuffs ?? sessionExtrasRef.current.structuredDebuffs,
    };
    sessionExtrasRef.current.playerDebuffs = sessionExtrasRef.current.structuredDebuffs.map((d) => d.type);
  };

  const applyLifecyclePlayerDelta = (delta?: number) => {
    if (delta == null || delta === 0) return;
    setOperativeHp((prev) => {
      const next = Math.max(0, Math.min(maxSoulAnchor, prev + delta));
      operativeHpRef.current = next;
      return next;
    });
  };

  const applyLifecycleStaminaDelta = (delta?: number) => {
    if (delta == null || delta === 0) return;
    applyStamina(staminaRef.current + delta);
  };

  const smogCallerActive = () =>
    aliveUnits(squadRef.current).find((u) => u.rosterId === 'smog-caller') ?? null;

  const hookWeaverTetheredUnitId = () => {
    const weaver = aliveUnits(squadRef.current).find((u) => u.rosterId === 'hook-weaver');
    return weaver?.tetheredAllyUnitId ?? sessionExtrasRef.current.hookWeaverTetheredUnitId;
  };

  const activeHookWeaver = () =>
    aliveUnits(squadRef.current).find((u) => u.rosterId === 'hook-weaver') ?? null;

  const hasAshOnBoard = () => Object.keys(sessionExtrasRef.current.ashTokens).length > 0;

  const consumeAshToken = () => {
    const slots = Object.keys(sessionExtrasRef.current.ashTokens);
    if (slots.length === 0) return;
    const next = { ...sessionExtrasRef.current.ashTokens };
    delete next[slots[0] as keyof typeof next];
    sessionExtrasRef.current.ashTokens = next;
  };

  const markPlayerDefendedRef = useRef<() => void>(() => {});
  const resolvePlayerTurnEndDebuffsRef = useRef<() => void>(() => {});
  const isBuffOrDefendAbility = (abilityId: AegisAbilityId) =>
    DEFEND_ABILITIES.includes(abilityId) || BUFF_ABILITIES.includes(abilityId);

  const log = (t: string) => onTerminalLog?.(t);
  const parryTimingWindowBonus = parryWindowBonus * 0.02;
  const parryTimingBlindPenalty = env.isPlayerBlinded ? 0.015 : 0;
  const counterReady = operativeClass === 'AEGIS'
    && abyssalReserve >= COMBAT_ACTION.COUNTER_ABYSSAL_MIN
    && !isExhausted;
  const sliceReady = operativeClass === 'AEGIS'
    && successfulParryCount >= PERFECT_PARRIES_FOR_ULTIMATE
    && !isExhausted;
  const zeroProtocolReady = operativeClass === 'HEX_SHOT'
    && perfectReloadCount >= PERFECT_RELOADS_FOR_ULTIMATE
    && !isExhausted;
  const cataclysmReady = operativeClass === 'ENVOY'
    && cataclysmReadyUi
    && !isExhausted;
  const ultimatePingVariant: UltimatePingVariant | null = zeroProtocolReady
    ? 'zero_protocol'
    : cataclysmReady
      ? 'cataclysm'
      : sliceReady
        ? 'eviscerate'
        : null;
  const ultimatePingReady = ultimatePingVariant != null;
  const activeLoadout = useMemo((): readonly string[] => {
    if (operativeClass === 'HEX_SHOT') return sanitizeHexShotCombatLoadout(hexShotLoadout);
    if (operativeClass === 'ENVOY') return sanitizeEnvoyCombatLoadout(envoyLoadout);
    return aegisLoadout;
  }, [operativeClass, hexShotLoadout, envoyLoadout, aegisLoadout]);
  const masteryProgress = useMemo(() => {
    if (operativeClass === 'HEX_SHOT') {
      if (perfectReloadCount > 0 && perfectReloadCount < PERFECT_RELOADS_FOR_ULTIMATE) {
        return {
          visible: true,
          current: perfectReloadCount,
          required: PERFECT_RELOADS_FOR_ULTIMATE,
          accent: '#fbbf24',
        };
      }
    } else if (operativeClass === 'AEGIS') {
      if (successfulParryCount > 0 && successfulParryCount < PERFECT_PARRIES_FOR_ULTIMATE) {
        return {
          visible: true,
          current: successfulParryCount,
          required: PERFECT_PARRIES_FOR_ULTIMATE,
          accent: '#ff1744',
        };
      }
    } else if (operativeClass === 'ENVOY' && !cataclysmReadyUi && veilFlux > 0) {
      const required = 3;
      const current = Math.min(
        required,
        Math.floor(veilFlux / (ENVOY_FLUX_ULTIMATE_THRESHOLD / required)),
      );
      if (current > 0) {
        return {
          visible: true,
          current,
          required,
          accent: '#a78bfa',
        };
      }
    }
    return {
      visible: false,
      current: 0,
      required: 3,
      accent: '#94a3b8',
    };
  }, [
    operativeClass,
    perfectReloadCount,
    successfulParryCount,
    cataclysmReadyUi,
    veilFlux,
  ]);
  const strikeWardPrimed = strikeArPrimed || wardStrikeBonusRef.current;

  const tryPreventExhaustionBreak = (next: number): number => {
    if (next > 0 || staminaRef.current <= 0) return next;
    if (!hasMutation(leyLineMutations, 'UNSTOPPABLE_FORCE')) return next;
    if (mutationEncounterRef.current.unstoppableFractureUsed) return next;
    mutationEncounterRef.current.unstoppableFractureUsed = true;
    log('[UNSTOPPABLE FORCE] >> Fracture break absorbed — stamina holds.');
    return 1;
  };

  const applyStamina = (next: number) => {
    let clamped = Math.max(0, Math.min(next, maxStamina));
    if (clamped === 0) clamped = tryPreventExhaustionBreak(0);
    staminaRef.current = clamped;
    setStamina(clamped);
    if (clamped > 0) {
      combatChanceRef.current.momentumShiftEvadeDisabled = false;
    }
    return clamped;
  };

  const godModeRef = useRef(godModeActive);
  godModeRef.current = godModeActive;

  const setMagazineAmmo = (next: number) => {
    const clamped = Math.max(0, Math.min(next, maxAmmo));
    currentAmmoRef.current = clamped;
    setCurrentAmmo(clamped);
    return clamped;
  };

  const spendAmmo = (amount: number): boolean => {
    if (amount <= 0) return true;
    if (currentAmmoRef.current < amount) return false;
    setMagazineAmmo(currentAmmoRef.current - amount);
    return true;
  };

  const emptyMagazine = () => {
    setMagazineAmmo(0);
  };

  const reduceEnemyAp = (unitId: string, amount: number) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit) return;
    const nextAp = Math.max(0, (unit.enemyActionPoints ?? 1) - amount);
    patchUnit(unitId, { enemyActionPoints: nextAp });
  };

  const applyVeilFlux = (delta: number) => {
    const next = Math.max(0, veilFluxRef.current + delta);
    veilFluxRef.current = next;
    setVeilFlux(next);
    if (
      operativeClass === 'ENVOY'
      && next >= ENVOY_FLUX_ULTIMATE_THRESHOLD
      && !cataclysmReadyUi
    ) {
      classCombatRef.current.cataclysmReady = true;
      setCataclysmReadyUi(true);
      log('>> VEIL-FLUX SATURATED — Cataclysm Sigil primed.');
    }
    if (next < fluxOverloadThreshold) {
      if (envoySilencedRef.current) {
        envoySilencedRef.current = false;
        setEnvoySilenced(false);
      }
      if (envoyOverloadedRef.current) {
        envoyOverloadedRef.current = false;
        setEnvoyOverloaded(false);
      }
    }
    return next;
  };

  const applyGodModeResources = () => {
    operativeHpRef.current = maxSoulAnchor;
    setOperativeHp(maxSoulAnchor);
    applyStamina(maxStamina);
    if (operativeClass === 'HEX_SHOT') {
      setMagazineAmmo(maxAmmo);
      hexOverchargedRef.current = false;
      setHexOvercharged(false);
    } else if (operativeClass === 'ENVOY') {
      applyVeilFlux(fluxOverloadThreshold - veilFluxRef.current);
      envoyOverloadedRef.current = false;
      envoySilencedRef.current = false;
      setEnvoyOverloaded(false);
      setEnvoySilenced(false);
    } else {
      abyssalRef.current = mutationModsRef.current.abyssalCap;
      setAbyssalReserve(mutationModsRef.current.abyssalCap);
    }
    sessionExtrasRef.current.playerDebuffs = [];
    sessionExtrasRef.current.structuredDebuffs = [];
  };

  useEffect(() => {
    cycleRef.current = cycleState; enemyRef.current = enemy;
    operativeHpRef.current = operativeHp; staminaRef.current = stamina;
    abyssalRef.current = abyssalReserve;
    counterRef.current = counterPrepActive || wraithParryRef.current;
    isPlayerTurnRef.current = isPlayerTurn;
    playerApRef.current = playerActionPoints;
  }, [cycleState, enemy, operativeHp, stamina, abyssalReserve, counterPrepActive, isPlayerTurn, playerActionPoints]);

  const combatTurnPhase = useMemo((): CombatTurnPhase => {
    if (cycleState === 'RESOLUTION') return 'RESOLUTION';
    if (cycleState === 'DEFEND_PARRY') return 'PARRY_WINDOW';
    if (cycleState === 'OFFENSE_SLICE') return 'SLICE';
    if (!isPlayerTurn && enemyActionStage === 'reading') return 'ENEMY_WINDUP';
    if (!isPlayerTurn) return 'ENEMY_ACTION';
    return 'PLAYER_COMMAND';
  }, [cycleState, enemyActionStage, isPlayerTurn]);

  if (combatTurnPhase !== 'RESOLUTION') {
    lastActiveTurnPhaseRef.current = combatTurnPhase;
  }

  const setCombatTurnState = combatTurn?.setCombatTurnState;

  useEffect(() => {
    if (!setCombatTurnState) return;
    setCombatTurnState({
      isPlayerTurn: isPlayerTurn && cycleState === 'TEXT_COMBAT',
      phase: combatTurnPhase,
      canUseCargo: isPlayerTurn && cycleState === 'TEXT_COMBAT',
      playerActionPoints,
      runCredits,
    });
  }, [combatTurnPhase, cycleState, isPlayerTurn, playerActionPoints, runCredits, setCombatTurnState]);


  const resolveActingEnemyId = (): string | null =>
    enemyActionQueueRef.current[0] ?? focusedUnitIdRef.current ?? null;

  const resolvePortraitGlow = (unitId: string, intent: EnemyIntent): EnemyPortraitGlow => {
    if (
      !isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && enemyActionStageRef.current != null
    ) {
      const actingId = resolveActingEnemyId();
      if (actingId === unitId) {
        if (isEnemyChargeIntent(intent)) return 'enemy-charging';
        if (isEnemyDamageIntent(intent)) return 'enemy-attacking';
      }
    }
    if (
      isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && selectedTargetIdRef.current === unitId
    ) {
      return 'player-selected';
    }
    return 'none';
  };

  const resolvePortraitAnim = (unitId: string, intent: EnemyIntent): EnemyPortraitAnim => {
    if (
      !isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && enemyActionStageRef.current != null
      && resolveActingEnemyId() === unitId
    ) {
      if (isEnemySiphonIntent(intent)) return 'shimmy';
      if (
        enemyActionStageRef.current === 'executing'
        && isEnemyDamageIntent(intent)
      ) {
        return 'lunge';
      }
    }
    return 'none';
  };

  const resolveIntentShimmer = (unitId: string, u: EnemyCombatProfile): EnemyIntentShimmer | null => {
    if (u.evadeActive || u.intent === 'EVADE') return 'evade';
    if ((u.fortifyTurnsRemaining ?? 0) > 0) return 'fortify';
    if (
      u.intent === 'FORTIFY'
      && !isPlayerTurnRef.current
      && cycleRef.current === 'TEXT_COMBAT'
      && enemyActionStageRef.current != null
      && resolveActingEnemyId() === unitId
    ) {
      return 'fortify';
    }
    return null;
  };

  const publishSquadUi = (nextSquad: EnemyCombatProfile[]) => {
    if (!onSquadUiChange) return;
    if (nextSquad.length === 0) return;
    const staged = selectedAbility;
    const targetMode = staged ? classAbilityTargetMode(operativeClass, staged) : 'NONE';
    const playerSelecting = canPlayerCommand();
    const abilityTargeting = staged != null && targetMode === 'SINGLE';
    const targetingActive = playerSelecting || abilityTargeting;
    const validTargets = staged && abilityTargeting
      ? validTargetsForClassAbility(operativeClass, nextSquad, staged)
      : [];
    const validIds = new Set(validTargets.map((u) => u.unitId));
    onSquadUiChange({
      squadSize: aliveUnits(nextSquad).length,
      targetingActive,
      stagedAbilityId: staged,
      turnOrder: buildCombatTurnOrder({
        squad: nextSquad,
        operativeClass,
        phase: combatTurnPhase,
        enemyQueue: enemyActionQueueRef.current,
      }),
      units: nextSquad.map((u) => {
        const unitId = u.unitId ?? u.designation;
        const threatTier = resolveEnemyThreatTier({
          isBoss: u.isBoss,
          isApex: u.isApex,
          rosterId: u.rosterId,
        });
        const hookValid = staged != null && isUnitHookValidForClass(operativeClass, staged, u);
        const alive = isUnitAlive(u);
        const targetable = targetingActive && alive && (
          !staged || !abilityTargeting || validIds.has(u.unitId!) || hookValid
        );
        const blocked = staged != null && abilityTargeting
          && isUnitBlockedForClassAbility(operativeClass, nextSquad, staged, unitId)
          && !hookValid;
        const motionOptions = { arenaLayout: true, gridSlot: u.gridSlot ?? null };
        const isActiveActor = resolveActingEnemyId() === unitId
          && enemyActionStageRef.current != null
          && !isPlayerTurnRef.current
          && cycleRef.current === 'TEXT_COMBAT';
        const actingIntent = isActiveActor ? resolveEffectiveEnemyIntent(u) : u.intent;
        const motionKind = classifyEnemyTurnMotion(actingIntent, motionOptions);
        const turnPhase = isActiveActor
          ? resolveEnemyTurnPhase(actingIntent, enemyActionStageRef.current, motionOptions)
          : null;
        const sensoryJammed = hasStructuredDebuff(sessionExtrasRef.current, 'SENSORY_JAMMED');
        const displayIntent = sensoryJammed ? ('SENSORY_JAM' as EnemyIntent) : u.intent;
        return {
          unitId,
          slot: u.gridSlot ?? 'FL_0',
          designation: u.designation,
          currentHp: u.currentHp,
          maxHp: u.maxHp,
          intent: displayIntent,
          intentLabel: sensoryJammed ? 'STATIC // JAMMED' : formatIntentReadout(u.intent),
          fractureGauge: u.fractureGauge ?? 0,
          fractureMax: u.fractureMax ?? 100,
          kineticArmor: u.kineticArmor ?? 0,
          occultWards: u.occultWards ?? 0,
          combatTags: u.combatTags ?? [],
          evadeActive: u.evadeActive,
          fortifyTurnsRemaining: u.fortifyTurnsRemaining ?? 0,
          chargeTurns: u.chargeTurns ?? 0,
          doomedStacks: u.doomedStacks ?? 0,
          activeStatuses: resolveActiveEnemyStatuses({
            combatTags: u.combatTags ?? [],
            evadeActive: u.evadeActive,
            intent: u.intent,
            fortifyTurnsRemaining: u.fortifyTurnsRemaining ?? 0,
            doomedStacks: u.doomedStacks ?? 0,
            isEnraged: u.isEnraged ?? false,
          }),
          isBoss: u.isBoss,
          isApex: u.isApex,
          isAlpha: u.isAlpha === true,
          isElite: threatTier === 'ELITE' || threatTier === 'APEX' || u.isAlpha === true,
          isVeilStalker: u.isVeilStalker,
          enemyClass: u.class,
          rosterId: u.rosterId,
          isDead: !isUnitAlive(u),
          isSelected: selectedTargetIdRef.current === u.unitId
            || focusedUnitIdRef.current === u.unitId,
          isTargetable: targetable,
          isFocused: focusedUnitIdRef.current === u.unitId,
          isActingEnemy: isActiveActor,
          isExecutingAttack: isActiveActor
            && enemyActionStageRef.current === 'executing'
            && motionKind !== 'buff',
          turnPhase,
          statusFloatSeq: statusFloatSeqRef.current[unitId] ?? 0,
          statusFloatLabel: lifecycleFloatLabelsRef.current[unitId]
            ?? (isActiveActor && motionKind === 'buff' && enemyActionStageRef.current === 'executing'
              ? getEnemyBuffFloatLabel(u.intent)
              : undefined),
          statusFloatTone: lifecycleFloatLabelsRef.current[unitId]
            ? 'fortify'
            : getStatusFloatTone(u.intent),
          isBacklineDashing: backlineDashActiveRef.current[unitId] === true,
          backlineMeleeDashSeq: backlineDashSeqRef.current[unitId] ?? 0,
          isBlocked: blocked,
          isHookValid: hookValid,
          isFractured: isEnemyFractured(u),
          portraitGlow: resolvePortraitGlow(unitId, u.intent),
          portraitAnim: resolvePortraitAnim(unitId, u.intent),
          intentShimmer: resolveIntentShimmer(unitId, u),
          critImpactSeq: critImpactSeqRef.current[unitId]?.seq ?? 0,
          critImpactChannel: critImpactSeqRef.current[unitId]?.channel,
          evadeImpactSeq: evadeImpactSeqRef.current[unitId] ?? 0,
          immuneFloatSeq: sessionExtrasRef.current.immunePopupSeq[unitId] ?? 0,
          immuneFloatLabel: (sessionExtrasRef.current.immunePopupSeq[unitId] ?? 0) > 0 ? 'IMMUNE' : undefined,
          hitFlashSeq: hitFlashSeqRef.current[unitId] ?? 0,
          classImpactFxSeq: classImpactFxRef.current[unitId]?.seq ?? 0,
          classImpactFxKind: classImpactFxRef.current[unitId]?.kind,
          isEnraged: u.isEnraged ?? false,
          dissolveSeq: dissolveSeqRef.current[unitId] ?? 0,
          dissolveHidden: dissolvedHiddenRef.current.has(unitId),
        };
      }),
    });
  };

  const allDeadUnitsDissolved = (squad: EnemyCombatProfile[]) =>
    squad.every((u) => {
      if (isUnitAlive(u)) return true;
      const id = u.unitId ?? u.designation;
      return dissolvedHiddenRef.current.has(id);
    });

  const tryResolvePendingVictory = () => {
    if (
      resolutionRef.current != null
      || !allUnitsDefeated(squadRef.current)
      || !allDeadUnitsDissolved(squadRef.current)
    ) {
      return false;
    }
    if (victoryFallbackTimerRef.current) {
      clearTimeout(victoryFallbackTimerRef.current);
      victoryFallbackTimerRef.current = null;
    }
    pendingVictoryRef.current = false;
    resolveVictoryRef.current();
    return true;
  };

  const ensureDeadUnitsDissolving = () => {
    for (const unit of squadRef.current) {
      if (!unit.unitId || isUnitAlive(unit)) continue;
      if ((dissolveSeqRef.current[unit.unitId] ?? 0) > 0) continue;
      beginDissolveForUnit(unit.unitId, unit, 0);
    }
  };

  const clearVictoryBlockers = () => {
    combatPausedRef.current = false;
    setFractureBreakUnitId(null);
    setZeroProtocolVisible(false);
    zeroProtocolActiveRef.current = false;
    setCataclysmSigilVisible(false);
  };

  const scheduleCombatVictoryResolution = () => {
    if (resolutionRef.current != null || !allUnitsDefeated(squadRef.current)) return;
    pendingVictoryRef.current = true;
    wasEnemyTurnAtVictoryRef.current = !isPlayerTurnRef.current;
    clearVictoryBlockers();
    ensureDeadUnitsDissolving();

    if (victoryFallbackTimerRef.current) {
      clearTimeout(victoryFallbackTimerRef.current);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryResolvePendingVictory();
      });
    });

    victoryFallbackTimerRef.current = setTimeout(() => {
      victoryFallbackTimerRef.current = null;
      if (resolutionRef.current != null || !allUnitsDefeated(squadRef.current)) return;
      for (const unit of squadRef.current) {
        if (isUnitAlive(unit)) continue;
        const id = unit.unitId ?? unit.designation;
        dissolvedHiddenRef.current.add(id);
      }
      publishSquadUi(squadRef.current);
      tryResolvePendingVictory();
    }, ASHEN_DISSOLVE_TOTAL_MS + 250);
  };

  const handleUnitDissolveComplete = (unitId: string) => {
    dissolvedHiddenRef.current.add(unitId);
    publishSquadUi(squadRef.current);

    if (!allUnitsDefeated(squadRef.current)) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(tryResolvePendingVictory);
    });
  };

  const handleUnitDissolveCompleteRef = useRef(handleUnitDissolveComplete);
  handleUnitDissolveCompleteRef.current = handleUnitDissolveComplete;

  useEffect(() => {
    registerDissolveCompleteHandler?.((unitId) => handleUnitDissolveCompleteRef.current(unitId));
  }, [registerDissolveCompleteHandler]);

  const beginDissolveForUnit = (
    unitId: string,
    profile: EnemyCombatProfile,
    hp: number,
  ) => {
    if (hp > 0) return;
    const bump = (id: string) => {
      dissolveSeqRef.current[id] = (dissolveSeqRef.current[id] ?? 0) + 1;
      backlineDashActiveRef.current[id] = false;
    };
    bump(unitId);
    if (profile.sharedBossPool) {
      squadRef.current.forEach((unit) => {
        if (unit.unitId && unit.sharedBossPool) bump(unit.unitId);
      });
    }
    publishSquadUi(squadRef.current);
  };

  const focusEnemy = (unit: EnemyCombatProfile | null) => {
    enemyRef.current = unit;
    setEnemy(unit);
    if (unit?.unitId) focusedUnitIdRef.current = unit.unitId;
    publishSquadUi(squadRef.current);
  };

  const syncSquad = (next: EnemyCombatProfile[]) => {
    const tagged = next.map((unit) => patchEnemyTagsFromExtras(unit, sessionExtrasRef.current));
    squadRef.current = tagged;
    setSquad(tagged);
    const focusId = focusedUnitIdRef.current ?? selectedTargetIdRef.current;
    const focused = (focusId ? getUnitById(tagged, focusId) : null) ?? primaryAliveUnit(tagged);
    if (focused?.unitId) focusedUnitIdRef.current = focused.unitId;
    focusEnemy(focused);
    publishSquadUi(tagged);
  };

  const patchUnit = (unitId: string, patch: Partial<EnemyCombatProfile>) => {
    const prev = getUnitById(squadRef.current, unitId);
    const wasFractured = prev ? isEnemyFractured(prev) : false;
    const nextSquad = patchSquadUnit(squadRef.current, unitId, patch);
    const next = getUnitById(nextSquad, unitId);
    if (next && !wasFractured && isEnemyFractured(next)) {
      Vibration.vibrate(40);
    }
    syncSquad(nextSquad);
  };

  const syncEnemy = (e: EnemyCombatProfile) => {
    if (e.unitId) patchUnit(e.unitId, e);
    else focusEnemy(e);
  };

  const selectTarget = useCallback((unitId: string) => {
    if (!canPlayerCommand()) return;
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit || !isUnitAlive(unit)) return;

    const staged = selectedAbility;
    if (staged && classAbilityRequiresTarget(operativeClass, staged)) {
      if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId)) {
        log('[TARGET] >> Line of sight blocked — clear the frontline column first.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    selectedTargetIdRef.current = unitId;
    setSelectedTargetId(unitId);
    focusedUnitIdRef.current = unitId;
    enemyRef.current = unit;
    setEnemy(unit);
    publishSquadUi(squadRef.current);
  }, [selectedAbility, log]);
  const focusIntelTarget = useCallback((unitId: string) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit || !isUnitAlive(unit)) return;

    focusedUnitIdRef.current = unitId;
    selectedTargetIdRef.current = unitId;
    setSelectedTargetId(unitId);
    enemyRef.current = unit;
    setEnemy(unit);

    if (canPlayerCommand()) {
      const staged = selectedAbility;
      if (staged && classAbilityRequiresTarget(operativeClass, staged)) {
        if (!canTargetWithClassAbility(operativeClass, squadRef.current, staged, unitId)) {
          log('[TARGET] >> Line of sight blocked — clear the frontline column first.');
          publishSquadUi(squadRef.current);
          return;
        }
      }
    }

    publishSquadUi(squadRef.current);
  }, [log, operativeClass, selectedAbility]);
  const emitCombatFeedback = useCallback((event: CombatFeedbackEvent) => {
    feedbackNonceRef.current += 1;
    setCombatFeedback({ nonce: feedbackNonceRef.current, event });
  }, []);

  const chargeAr = (amt: number, _targetFractured = false) => {
    const scaled = amt;
    if (hasMutation(leyLineMutations, 'UMBRAL_CARAPACE') && scaled > 0) {
      const heal = Math.floor(maxSoulAnchor * 0.02 * mutationModsRef.current.healMultiplier);
      if (heal > 0) {
        setOperativeHp((p) => {
          const n = Math.min(p + heal, maxSoulAnchor);
          operativeHpRef.current = n;
          return n;
        });
      }
    }
    setAbyssalReserve((p) => {
      const n = Math.min(p + scaled, mutationModsRef.current.abyssalCap);
      abyssalRef.current = n;
      return n;
    });
  };
  const primeWardStrikeBonus = () => {
    wardStrikeBonusRef.current = true;
    setStrikeArPrimed(true);
  };
  const consumeWardStrikeBonus = () => {
    const primed = wardStrikeBonusRef.current;
    wardStrikeBonusRef.current = false;
    setStrikeArPrimed(false);
    return primed;
  };
  const scaleSlice = (d: number) => sliceDamagePenalty > 0 ? Math.floor(d * (1 - sliceDamagePenalty)) : d;

  const clearSliceTimers = () => {
    const s = sliceSessionRef.current;
    if (s.segmentTimer) { clearTimeout(s.segmentTimer); s.segmentTimer = null; }
    if (s.hitFlashTimer) { clearTimeout(s.hitFlashTimer); s.hitFlashTimer = null; }
  };

  const showStrikeFeedback = (variant: EnemyDeckStrikeVariant) => {
    playerViewportRef?.current?.triggerDamageEffect(variant);
  };

  const flash = (color: string, done?: () => void) => {
    setScreenFlashColor(color); setScreenFlashActive(true); screenFlashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(screenFlashAnim, { toValue: 0.38, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(screenFlashAnim, { toValue: 0.26, duration: 160, useNativeDriver: true }),
      Animated.timing(screenFlashAnim, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { setScreenFlashActive(false); done?.(); });
  };

  const clearParryHaloTimer = () => {
    if (parryHaloTimerRef.current) {
      clearTimeout(parryHaloTimerRef.current);
      parryHaloTimerRef.current = null;
    }
  };

  const syncParryBurstChrome = (active: boolean, arena: ParryArenaLayout | null, epoch: number) => {
    const chrome = enemyChromeRef.current;
    if (!chrome) return;
    chrome.parryBurstLiveRef.current = { active, arena, epoch };
    queueMicrotask(() => {
      const liveChrome = enemyChromeRef.current;
      if (!liveChrome) return;
      liveChrome.notifyParryChromeChange();
    });
  };

  const clearParrySuccessBurst = () => {
    clearParryHaloTimer();
    syncParryBurstChrome(false, null, 0);
    setParrySuccessBurstActive(false);
    setParryBurstArena(null);
    parryBurstCompleteRef.current = null;
  };

  const startParrySuccessBurst = (onComplete: () => void) => {
    const arena = parryArenaRef.current;
    if (!arena) {
      onComplete();
      return;
    }
    parryBurstEpochRef.current += 1;
    const epoch = parryBurstEpochRef.current;
    parryBurstCompleteRef.current = onComplete;
    syncParryBurstChrome(true, arena, epoch);
    setParryBurstEpoch(epoch);
    setParryBurstArena(arena);
    setParrySuccessBurstActive(true);
    clearParryHaloTimer();
    parryHaloTimerRef.current = setTimeout(() => {
      parryHaloTimerRef.current = null;
      syncParryBurstChrome(false, null, 0);
      setParrySuccessBurstActive(false);
      setParryBurstArena(null);
      const done = parryBurstCompleteRef.current;
      parryBurstCompleteRef.current = null;
      done?.();
    }, PARRY_HALO_DURATION_MS);
  };

  const clearEnemyTurnTimers = () => {
    if (enemyTurnTimerRef.current) {
      clearTimeout(enemyTurnTimerRef.current);
      enemyTurnTimerRef.current = null;
    }
    if (enemyTurnGapTimerRef.current) {
      clearTimeout(enemyTurnGapTimerRef.current);
      enemyTurnGapTimerRef.current = null;
    }
    if (enemyStrikeTimerRef.current) {
      clearTimeout(enemyStrikeTimerRef.current);
      enemyStrikeTimerRef.current = null;
    }
    voidAmbushWindowRef.current = null;
    setEnemyActionStage(null);
    preAppliedHpStrikeRef.current = 0;
  };

  const abortCombatMinigames = () => {
    clearParrySuccessBurst();
    clearSliceTimers();
    const s = sliceSessionRef.current;
    s.evaluated = true;
    activeSliceRef.current = -1;
    setActiveSliceIndex(-1);
    setEviscerateTargetUnitId(null);
    crossedRef.current = false;
    sliceTouchStartRef.current = null;
    clearEnemyTurnTimers();
    cancelAnimation(parryScaleSV);
    parryResolvedRef.current = true;
    parryTapPendingRef.current = false;
    parrySessionRef.current += 1;
  };

  const resolve = (victory: boolean) => {
    if (resolutionRef.current != null) return;
    if (victoryFallbackTimerRef.current) {
      clearTimeout(victoryFallbackTimerRef.current);
      victoryFallbackTimerRef.current = null;
    }
    if (operativeHpRef.current <= 0) victory = false;
    if (victory) {
      wasEnemyTurnAtVictoryRef.current = !isPlayerTurnRef.current;
    }
    abortCombatMinigames();
    cycleRef.current = 'RESOLUTION';
    setCycleState('RESOLUTION');
    if (victory) {
      resolutionRef.current = 'VICTORY';
      if (env.combatObjective === 'SURVIVE_TURNS') {
        log('[DEFEND THE RIFT] >> Evac conduit stabilized. Hostile interdiction repelled.');
      } else {
        log('[EXORCISED] >> Hostile neutralized. Incursion sealed.');
      }
      setResolutionOutcome('VICTORY');
      awardCurrencies(750, 25);
    } else {
      resolutionRef.current = 'DEFEAT';
      setResolutionOutcome('DEFEAT');
      log('[CRITICAL] >> Operative soul anchor severed. Veil sync lost.');
      flash(P.defeat);
    }
  };

  const resolveVictoryRef = useRef(() => resolve(true));
  resolveVictoryRef.current = () => resolve(true);

  useEffect(() => {
    registerKillResolver?.(() => {});
  }, [registerKillResolver]);

  const applyHealRef = useRef((amount: number) => {
    setOperativeHp((p) => {
      const n = Math.min(p + amount, maxSoulAnchor);
      operativeHpRef.current = n;
      return n;
    });
  });
  applyHealRef.current = (amount: number) => {
    setOperativeHp((p) => {
      const n = Math.min(p + amount, maxSoulAnchor);
      operativeHpRef.current = n;
      return n;
    });
  };

  useEffect(() => {
    registerHealHandler?.((amount: number) => applyHealRef.current(amount));
  }, [registerHealHandler, maxSoulAnchor]);

  const interruptsWorldEnderChannel = (e: EnemyCombatProfile) =>
    e.intent === 'CHARGE' || e.intent === 'WORLD_ENDER' || e.chargeTurns > 0;

  const applyVeilShardFracture = () => {
    const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
    const e = targetId ? getUnitById(squadRef.current, targetId) : enemyRef.current;
    if (!e?.unitId) return;
    if (interruptsWorldEnderChannel(e)) {
      patchUnit(e.unitId, applyFracturedState({
        ...e,
        intent: 'STRIKE',
        chargeTurns: 0,
        evadeActive: false,
      }));
      log('>> WORLD-ENDER CHANNEL SHATTERED — hostile fracture maxed.');
      return;
    }
    patchUnit(e.unitId, applyFracturedState(e));
    log(`>> VEIL SHARD — ${e.designation} fracture maxed.`);
  };

  const applyConsumableRef = useRef((_result: IncursionConsumableUseResult) => {});
  applyConsumableRef.current = (result: IncursionConsumableUseResult) => {
    if (!canPlayerCommand()) return;
    const apCost = result.apCost ?? COMBAT_CONSUMABLE_AP_COST;
    if (playerApRef.current < apCost) {
      log('[REJECTED] >> Insufficient action points for cargo deploy.');
      return;
    }
    const healAmt = Math.floor(result.healAmount * mutationModsRef.current.healMultiplier);
    if (healAmt > 0) applyHealRef.current(healAmt);
    if (result.stunsEnemy) applyVeilShardFracture();
    if (result.shatterKineticArmor) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        patchUnit(unit.unitId, {
          kineticArmor: Math.max(0, (unit.kineticArmor ?? 0) - result.shatterKineticArmor),
        });
      }
    }
    if (result.stripOccultWards) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        patchUnit(unit.unitId, {
          occultWards: Math.max(0, (unit.occultWards ?? 0) - result.stripOccultWards),
        });
      }
    }
    if (result.clearPlayerDebuffs && result.clearPlayerDebuffs.length > 0) {
      sessionExtrasRef.current.structuredDebuffs = sessionExtrasRef.current.structuredDebuffs.filter(
        (d) => {
          if (d.type !== 'BLEEDING' && d.type !== 'FRACTURED') return true;
          return !result.clearPlayerDebuffs!.includes(d.type);
        },
      );
      sessionExtrasRef.current.playerDebuffs = sessionExtrasRef.current.structuredDebuffs.map((d) => d.type);
    }
    if (result.frontlineBlindTurns && result.frontlineBlindTurns > 0) {
      const blindResult = applyFrontlineBlinded(
        squadRef.current,
        sessionExtrasRef.current,
        result.frontlineBlindTurns,
      );
      blindResult.logLines.forEach((line) => log(line));
    }
    if (result.clearDebuffs) {
      const targetId = selectedTargetIdRef.current ?? primaryAliveUnit(squadRef.current)?.unitId;
      const unit = targetId ? getUnitById(squadRef.current, targetId) : null;
      if (unit?.unitId) {
        patchUnit(unit.unitId, { combatTags: [] });
      }
    }
    if (result.maxAbyssalReserve) {
      abyssalRef.current = mutationModsRef.current.abyssalCap;
      setAbyssalReserve(mutationModsRef.current.abyssalCap);
    }
    if (result.grantBonusAp) {
      combatBuffRef.current.bonusApThisTurn += result.grantBonusAp;
      playerApRef.current += result.grantBonusAp;
      setPlayerActionPoints(playerApRef.current);
    }
    if (result.restoreStaminaPct) {
      applyStamina(Math.floor(maxStamina * (result.restoreStaminaPct / 100)));
    }
    if (result.absorbNextHit) {
      mutationEncounterRef.current.spallWeaveActive = true;
    }
    if (result.enableGodMode) {
      godModeRef.current = true;
      applyGodModeResources();
    }
    log(result.logLine);
    playerApRef.current = Math.max(0, playerApRef.current - apCost);
    setPlayerActionPoints(playerApRef.current);
    setSelectedAbility(null);
    publishSquadUi(squadRef.current);
  };

  useEffect(() => {
    registerConsumableHandler?.((result) => applyConsumableRef.current(result));
  }, [registerConsumableHandler]);

  useEffect(() => {
    registerCanDeployCargoHandler?.((itemId: CargoItemId) => (
      canPlayerCommand()
      && playerApRef.current >= combatConsumableApCost(itemId)
    ));
  }, [registerCanDeployCargoHandler]);

  useEffect(() => {
    registerTargetHandler?.(selectTarget);
  }, [registerTargetHandler, selectTarget]);

  useEffect(() => {
    registerIntelTargetHandler?.(focusIntelTarget);
  }, [registerIntelTargetHandler, focusIntelTarget]);

  const resolveIncomingHpStrike = (e: EnemyCombatProfile): { raw: number; unblockable: boolean } | null => {
    const effectiveIntent = resolveEffectiveEnemyIntent(e);
    if (getEnemyDeckStrikeVariant(effectiveIntent) !== 'hp') return null;
    if (e.isBoss && bossRuntimeRef.current) {
      const dmg = bossStrikeDamage(bossRuntimeRef.current, bossPhaseRef.current);
      if (e.intent === 'OVERDRIVE_DISCHARGE') {
        return { raw: dmg, unblockable: !counterRef.current };
      }
      return { raw: dmg, unblockable: false };
    }
    const { dmg, unblockable } = attackDmg(e);
    return { raw: dmg, unblockable: e.intent === 'WORLD_ENDER' ? true : unblockable };
  };

  const applyHpStrikeOnDeckImpact = (e: EnemyCombatProfile) => {
    const strike = resolveIncomingHpStrike(e);
    if (!strike || strike.raw <= 0) return;
    let dmg = strike.raw;
    if (!strike.unblockable && abyssalWardRef.current) {
      dmg = Math.floor(dmg * (1 - COMBAT_ACTION.ABYSSAL_WARD_BLOCK_PCT));
      abyssalWardRef.current = false;
      setAbyssalWardActive(false);
      const attacker = enemyRef.current;
      if (attacker) markAttackerDoomed(attacker);
    }
    if (dmg <= 0) return;
    preAppliedHpStrikeRef.current = dmg;
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = strike.unblockable;
    Vibration.vibrate([0, 32, 48, 28]);
  };

  const commitPendingPlayerDamage = (unblockable = false, msg?: string, attacker?: EnemyCombatProfile) => {
    const pending = preAppliedHpStrikeRef.current > 0
      ? preAppliedHpStrikeRef.current
      : pendingDmgRef.current;
    if (pending <= 0) return false;
    preAppliedHpStrikeRef.current = 0;
    hurtPlayer(pending, unblockable || pendingUnblockRef.current, msg, {
      skipStrikeFx: true,
      attacker: attacker ?? enemyRef.current ?? undefined,
    });
    return true;
  };

  const hurtPlayer = (
    raw: number,
    unblockable = false,
    msg?: string,
    options?: {
      skipStrikeFx?: boolean;
      attacker?: EnemyCombatProfile;
      rollEvade?: boolean;
      rollCrit?: boolean;
    },
  ) => {
    if (godModeRef.current) return;
    if (
      isGhostCamoBlockingAttacks(classCombatRef.current)
      && raw > 0
      && options?.attacker
    ) {
      log('[GHOST-GRID CAMO] >> Operative phased — attack whiffed.');
      return;
    }
    if (mutationEncounterRef.current.spallWeaveActive && raw > 0) {
      mutationEncounterRef.current.spallWeaveActive = false;
      log('[SPALL-WEAVE] >> Vest absorbed incoming damage.');
      return;
    }
    if (
      operativeClass === 'ENVOY'
      && riftWardReadyRef.current
      && raw > 0
      && options?.attacker?.unitId
    ) {
      const wardBoonCtx = {
        boons: envoyBoons,
        log,
        applyVeilFlux,
        refundAp: (amount = 1) => {
          playerApRef.current += amount;
          setPlayerActionPoints(playerApRef.current);
        },
        grantUntargetable: (turns: number) => {
          classCombatRef.current.ghostCamoTurnsRemaining = Math.max(
            classCombatRef.current.ghostCamoTurnsRemaining,
            turns,
          );
        },
      };
      if (unblockable) {
        riftWardReadyRef.current = false;
        runEnvoyRiftWardFailBoons(wardBoonCtx);
        return;
      }
      riftWardReadyRef.current = false;
      const reflect = Math.floor(raw * 0.5);
      if (reflect > 0) {
        hurtEnemy(reflect, '[RIFT-WARD]', 'STRIKE', {
          channel: 'OCCULT',
          rollCrit: false,
          targetId: options.attacker.unitId,
        });
      }
      applyVeilFlux(15);
      runEnvoyRiftWardSuccessBoons(wardBoonCtx);
      log('[RIFT-WARD] >> Intrinsic ward flares — hit absorbed, pain mirrored.');
      return;
    }
    if (mutationEncounterRef.current.juggernautShield && raw > 0) {
      mutationEncounterRef.current.juggernautShield = false;
      log('[JUGGERNAUT PLATING] >> Shadow Step shield absorbed the hit.');
      return;
    }
    let dmg = raw;
    if (
      options?.attacker
      && hasStructuredDebuff(sessionExtrasRef.current, 'TARGET_LOCKED')
      && raw > 0
    ) {
      const tier = resolveEnemyThreatTier(options.attacker);
      const heavyHit = isHeavyArchetype(options.attacker.rosterId) || tier === 'ELITE' || tier === 'APEX';
      if (heavyHit) {
        dmg = applyCritMultiplier(dmg, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER);
        removeStructuredDebuff(sessionExtrasRef.current, 'TARGET_LOCKED');
        log(`[TARGET LOCKED] >> Heavy strike — critical hit for ${dmg}.`);
      }
    }
    const extras = sessionExtrasRef.current;
    if (extras.playerShield > 0 && dmg > 0) {
      const absorbed = Math.min(extras.playerShield, dmg);
      extras.playerShield -= absorbed;
      dmg -= absorbed;
      log(`[SHIELD] >> ${absorbed} damage absorbed (${extras.playerShield} remaining).`);
    }
    if (playerKineticArmorBonus > 0 && dmg > 0) {
      const beforeArmor = dmg;
      dmg = absorbByArmor(dmg, playerKineticArmorBonus);
      const absorbed = beforeArmor - dmg;
      if (absorbed > 0) {
        log(`[KINETIC ARMOR] >> ${absorbed} absorbed (${playerKineticArmorBonus} layer${playerKineticArmorBonus === 1 ? '' : 's'}).`);
      }
    }
    const envoyBulwarkArmor = operativeClass === 'ENVOY'
      ? resolveEnvoyAethericBulwarkArmor(envoyBoons, envoyBoonModsRef.current, veilFluxRef.current)
      : 0;
    if (envoyBulwarkArmor > 0 && dmg > 0) {
      const beforeArmor = dmg;
      dmg = absorbByArmor(dmg, envoyBulwarkArmor);
      const absorbed = beforeArmor - dmg;
      if (absorbed > 0) {
        log(`[AETHERIC BULWARK] >> ${absorbed} absorbed (${envoyBulwarkArmor} flux-forged layer${envoyBulwarkArmor === 1 ? '' : 's'}).`);
      }
    }
    if (!unblockable && abyssalWardRef.current && !bloodBoundCarapaceRef.current) {
      dmg = Math.floor(dmg * (1 - COMBAT_ACTION.ABYSSAL_WARD_BLOCK_PCT));
      abyssalWardRef.current = false;
      setAbyssalWardActive(false);
      const attacker = enemyRef.current;
      if (attacker) markAttackerDoomed(attacker);
    }
    const chanceState = combatChanceRef.current;
    if (
      raw > 0
      && options?.rollEvade !== false
      && options?.attacker
    ) {
      const hit = resolveEnemyAttackHit(
        {
          shadowStepEvadeActive: chanceState.shadowStepEvadeActive,
          gridGhostEvadeStacks: chanceState.gridGhostEvadeStacks,
          momentumShiftEvadeDisabled: chanceState.momentumShiftEvadeDisabled,
        },
        { attacker: options.attacker },
      );
      if (hit.evaded) {
        emitCombatFeedback({ kind: 'PLAYER_EVADE' });
        playerViewportRef?.current?.triggerEvadeAfterimage();
        log(msg?.replace(/— \d+.*/, '') ?? `>> ${options.attacker.designation} STRIKES — [ MISS ]`);
        log('[EVADE] >> Operative afterimage — attack whiffed.');
        if (hasMutation(leyLineMutations, 'GRID_GHOST')) {
          const refund = Math.floor(maxStamina * COMBAT_CHANCE.GRID_GHOST_STAMINA_REFUND_PCT);
          if (refund > 0) applyStamina(staminaRef.current + refund);
          if (chanceState.gridGhostEvadeStacks < COMBAT_CHANCE.GRID_GHOST_MAX_STACKS) {
            chanceState.gridGhostEvadeStacks += 1;
          }
          log(`[GRID GHOST] >> Evade successful — +${refund} stamina, +5% evade (${chanceState.gridGhostEvadeStacks}/${COMBAT_CHANCE.GRID_GHOST_MAX_STACKS}).`);
        }
        runEnvoyEvadeSuccessBoons(envoyBoons, log, (amount = 1) => {
          playerApRef.current += amount;
          setPlayerActionPoints(playerApRef.current);
        });
        return;
      }
      if (options.rollCrit !== false && hit.critical) {
        dmg = applyCritMultiplier(dmg, hit.critMultiplier);
        emitCombatFeedback({ kind: 'ENEMY_CRIT' });
        playerViewportRef?.current?.triggerEnemyCritVignette();
        log(`[CRITICAL WOUND] >> ${options.attacker.designation} — ${dmg} damage.`);
      } else {
        log(msg ?? `>> ENEMY STRIKE — ${dmg} DAMAGE DEALT`);
      }
    } else {
      log(msg ?? `>> ENEMY STRIKE — ${dmg} DAMAGE DEALT`);
    }
    if (dmg > 0) {
      if (
        bloodBoundCarapaceRef.current
        && options?.attacker?.unitId
      ) {
        const attacker = options.attacker;
        const attackerId = attacker.unitId;
        if (attackerId) {
          hurtEnemy(dmg, '[CARAPACE SPIKE]', 'STRIKE', {
            channel: 'TRUE',
            abilityId: 'BLOOD_BOUND_CARAPACE',
            rollCrit: false,
            targetId: attackerId,
          });
          const refreshed = getUnitById(squadRef.current, attackerId);
          if (refreshed?.unitId) {
            patchUnit(attackerId, applyFracturedState(refreshed));
          }
          log(`>> [BLOOD-BOUND CARAPACE] — ${dmg} True reflected, attacker Fractured.`);
        }
      }
      if (
        hasStructuredDebuff(sessionExtrasRef.current, 'SEARING')
        && options?.attacker?.rosterId !== 'splinter'
      ) {
        const splinter = aliveUnits(squadRef.current).find((u) => u.rosterId === 'splinter');
        const searingMult = splinter
          ? getAlphaMechanic(splinter, 'searingDamageMultiplier', 1)
          : 1;
        if (searingMult > 1) {
          const extra = Math.floor(dmg * (searingMult - 1));
          dmg += extra;
          log(`[SEARING] >> Damage tripled — +${extra} damage.`);
        } else {
          dmg += 8;
          log('[SEARING] >> Secondary burst — +8 damage.');
        }
      }
      Vibration.vibrate([0, 32, 48, 28]);
      if (!options?.skipStrikeFx) {
        playerViewportRef?.current?.triggerDamageEffect('hp');
      }
    }
    mutationEncounterRef.current.damageTakenThisTurn = dmg > 0;
    if (
      dmg > 0
      && hasMutation(leyLineMutations, 'ADRENALINE_SPIKE')
      && !mutationEncounterRef.current.adrenalineSpikeUsed
    ) {
      mutationEncounterRef.current.adrenalineSpikeUsed = true;
      playerApRef.current += 1;
      setPlayerActionPoints(playerApRef.current);
      log('[ADRENALINE SPIKE] >> Damage taken — +1 AP refunded.');
    }
    runClassTakeDamageBoons({
      hexBoons: hexShotBoons,
      envoyBoons,
      damageDealt: dmg,
      log,
      applyVeilFlux,
      grantReactiveCamo: () => {
        if (classCombatRef.current.reactiveCamoUsed) return false;
        classCombatRef.current.reactiveCamoUsed = true;
        classCombatRef.current.ghostCamoTurnsRemaining = 1;
        return true;
      },
    });
    if (dmg > 0 && classCombatRef.current.soulTetherUnitId) {
      const tetherId = classCombatRef.current.soulTetherUnitId;
      classCombatRef.current.soulTetherUnitId = null;
      const mirror = Math.floor(dmg * 0.5);
      if (mirror > 0) {
        hurtEnemy(mirror, '[SOUL-TETHER]', 'STRIKE', {
          channel: 'TRUE',
          targetId: tetherId,
          rollCrit: false,
        });
        log(`[SOUL-TETHER] >> ${mirror} True pain mirrored to tether.`);
      }
    }
    setOperativeHp((p) => {
      const n = Math.max(p - dmg, 0);
      operativeHpRef.current = n;
      if (n <= 0 && options?.attacker?.designation) {
        onLethalEnemyStrike?.(options.attacker.designation);
      }
      if (
        n > 0
        && n / maxSoulAnchor <= 0.1
        && hasMutation(leyLineMutations, 'SECOND_WIND')
        && !mutationEncounterRef.current.secondWindUsed
      ) {
        mutationEncounterRef.current.secondWindUsed = true;
        applyStamina(maxStamina);
        combatBuffRef.current.bonusApThisTurn += 2;
        playerApRef.current += 2;
        setPlayerActionPoints(playerApRef.current);
        log('[SECOND WIND] >> Emergency surge — stamina and AP restored.');
      }
      if (n <= 0) resolve(false);
      return n;
    });
  };

  const hurtEnemy = (
    raw: number,
    tag: string,
    source?: KineticDamageSource,
    options?: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      fractureGain?: number;
      targetId?: string;
      abilityId?: AegisAbilityId;
      rollCrit?: boolean;
      echoHit?: boolean;
      /** Burn/bleed/DoT — skip operative attack pose; still flash the damaged unit. */
      indirectDamage?: boolean;
    },
  ): boolean => {
    const rawTargetId = options?.targetId
      ?? selectedTargetIdRef.current
      ?? primaryAliveUnit(squadRef.current)?.unitId;
    const interceptAbility = options?.abilityId ?? 'STRIKE';
    const targetId = rawTargetId
      ? resolveWardenInterceptTarget(squadRef.current, interceptAbility, rawTargetId)
      : rawTargetId;
    const e = targetId
      ? getUnitById(squadRef.current, targetId)
      : enemyRef.current;
    if (!e || !e.unitId) return false;
    if (
      rawTargetId
      && targetId
      && rawTargetId !== targetId
      && e.rosterId === 'warden'
    ) {
      log(`${tag} >> WARDEN INTERCEPT — backline strike redirected.`);
    }
    const shroudMissChance = env.eliteModifier === 'PHASE_SHROUD' ? 0.25 : 0.2;
    if (env.isEnemyPhaseShrouded && Math.random() < shroudMissChance) {
      log(`${tag} >> PHASE SHROUD — ATTACK WHIFFED (${Math.round(shroudMissChance * 100)}% miss).`);
      return false;
    }
    if (
      e.isUntargetable
      && options?.channel !== 'OCCULT'
      && options?.channel !== 'TRUE'
    ) {
      log(`${tag} >> PHASED — ${e.designation} cannot be targeted by physical channel.`);
      return false;
    }
    if ((e.veilBarrierCharges ?? 0) > 0 && raw > 0) {
      const nextCharges = (e.veilBarrierCharges ?? 0) - 1;
      patchUnit(e.unitId, {
        veilBarrierCharges: nextCharges > 0 ? nextCharges : undefined,
      });
      log(`${tag} >> VEIL BARRIER — hit absorbed (${nextCharges} charge${nextCharges === 1 ? '' : 's'} left).`);
      publishSquadUi(squadRef.current);
      return false;
    }
    let working = e;
    let critical = false;
    let ignoreDefenses = false;
    let hexForceCrit = false;
    if (operativeClass === 'HEX_SHOT' && source && !options?.echoHit) {
      const hexAbilityId = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
      if (hexAbilityId) {
        const critOverrides = getHexShotCritOverrides(
          hexShotBoons,
          hexAbilityId,
          working,
          classBoonEncounterRef.current,
        );
        hexForceCrit = critOverrides.forceCrit;
        if (critOverrides.ignoreDefenses) ignoreDefenses = true;
      }
    }
    const hexOverchargedStrike = operativeClass === 'HEX_SHOT'
      && hexOverchargedRef.current
      && Boolean(source)
      && source !== 'COUNTER'
      && !options?.echoHit;
    const narrativeOvercharged = Boolean(
      source && sessionExtrasRef.current.overchargedActive,
    );
    const bypassAllMitigation = narrativeOvercharged;
    if (hexForceCrit) {
      critical = true;
      ignoreDefenses = true;
    } else if (source && source !== 'COUNTER' && !options?.echoHit && options?.rollCrit !== false) {
      const hit = resolvePlayerAttackHit(
        { defender: working, bypassPostureEvade: bypassAllMitigation },
        {
          abilityId: options?.abilityId,
          target: working,
          factionCritBonus: playerCritChanceBonus + (
            operativeClass === 'HEX_SHOT'
            && hasHexShotBoon(hexShotBoons, 'DEAD_EYE')
            && currentAmmoRef.current >= maxAmmo
              ? hexShotBoonModsRef.current.ballisticCritBonusFullMag
              : 0
          ) + (
            operativeClass === 'ENVOY'
            && hasEnvoyBoon(envoyBoons, 'OVERLOAD_MASTERY')
            && Math.round(veilFluxRef.current) === 99
              ? 100
              : 0
          ),
          hasShatterPoint: hasMutation(leyLineMutations, 'SHATTER_POINT'),
          guaranteedCrits: combatBuffRef.current.crimsonPactCharges,
        },
      );
      if (hit.evaded) {
        const evadeUnitId = working.unitId!;
        evadeImpactSeqRef.current[evadeUnitId] = (evadeImpactSeqRef.current[evadeUnitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        apparitionRef?.current?.triggerStatEvade();
        log(`${tag} >> [ EVADED ] — ${working.designation} phased through the strike.`);
        return false;
      }
      if (hit.ignoreDefenses && combatBuffRef.current.crimsonPactCharges > 0) {
        combatBuffRef.current.crimsonPactCharges -= 1;
        log('[CRIMSON PACT] >> Guaranteed critical hit — defenses ignored.');
      }
      critical = hit.critical;
      ignoreDefenses = hit.ignoreDefenses;
    }
    if (hexOverchargedStrike && raw > 0) {
      ignoreDefenses = true;
    }
    if (narrativeOvercharged) {
      ignoreDefenses = true;
    }
    if (
      hexShotBoonModsRef.current.ballisticArmorPierce > 0
      && options?.abilityId
      && operativeClass === 'HEX_SHOT'
      && boonMatchesHexAction(hexShotBoons, 'DEPLETED_URANIUM_TIPS', options.abilityId)
      && options?.channel === 'KINETIC'
    ) {
      working = {
        ...working,
        kineticArmor: Math.max(0, (working.kineticArmor ?? 0) - hexShotBoonModsRef.current.ballisticArmorPierce),
      };
    }
    if (
      mutationModsRef.current.strikeArmorPierce > 0
      && boonMatchesAction(
        leyLineMutations,
        'SHARPENED',
        (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef(),
      )
      && options?.channel === 'KINETIC'
    ) {
      working = {
        ...working,
        kineticArmor: Math.max(0, (working.kineticArmor ?? 0) - mutationModsRef.current.strikeArmorPierce),
      };
    }
    if (mutationEncounterRef.current.masochistBuff && source) {
      mutationEncounterRef.current.masochistBuff = false;
    }
    const fractureGain = options?.fractureGain ?? 0;
    const graftPlanForFracture = activeGraftPlanRef.current;
    if (
      fractureGain > 0
      && (!graftPlanForFracture || graftPlanForFracture.effectiveTags.includes('FRACTURE'))
    ) {
      if (willFractureBreak(working, fractureGain) && !fractureBreakUnitId) {
        working = applyFractureDamage(working, fractureGain, { deferBreak: true });
        patchUnit(e.unitId, working);
        combatPausedRef.current = true;
        triggerHitstop(200);
        triggerShake('heavy');
        setFractureBreakUnitId(e.unitId);
        log(`>> FRACTURE BREAK — ${working.designation} stagger threshold breached.`);
      } else {
        working = applyFractureDamage(working, fractureGain);
        patchUnit(e.unitId, working);
      }
    }
    let dmg = raw;
    let pendingEnvoyKineticSplash: number | undefined;
    if (operativeClass === 'HEX_SHOT' && dmg > 0) {
      dmg = Math.floor(dmg * hexShotBoonModsRef.current.damageMultiplier);
      const hexAbilityId = options?.abilityId ?? lastPlayerAbilityRef.current;
      if (
        hexAbilityId
        && isEnemyFractured(working)
        && boonMatchesHexAction(hexShotBoons, 'SHATTER_RIFLING', hexAbilityId)
      ) {
        dmg = Math.floor(dmg * (1 + hexShotBoonModsRef.current.ballisticFracturedDamagePct / 100));
      }
      if (
        hexAbilityId
        && currentAmmoRef.current === 1
        && boonMatchesHexAction(hexShotBoons, 'EXECUTIONERS_CLIP', hexAbilityId)
      ) {
        dmg = Math.floor(dmg * 2);
        log("[EXECUTIONER'S CLIP] >> Final round — double damage.");
      }
      const hexAdjust = hexAbilityId
        ? adjustHexShotOutgoingDamage({
          boons: hexShotBoons,
          mods: hexShotBoonModsRef.current,
          abilityId: hexAbilityId as HexShotAbilityId,
          target: working,
          damage: dmg,
          channel: options?.channel,
          encounter: classBoonEncounterRef.current,
          log,
        })
        : null;
      if (hexAdjust) {
        dmg = hexAdjust.damage;
        if (hexAdjust.channel) options = { ...options, channel: hexAdjust.channel };
        if (hexAdjust.ignoreDefenses) ignoreDefenses = true;
        if (hexAdjust.forceCrit) critical = true;
      }
    }
    if (operativeClass === 'ENVOY' && dmg > 0) {
      let envoyMult = envoyBoonModsRef.current.damageMultiplier;
      const envoyAbilityId = options?.abilityId ?? lastPlayerAbilityRef.current;
      if (
        envoyAbilityId
        && hasEnvoyBoon(envoyBoons, 'VOID_TOUCHED')
        && veilFluxRef.current > 50
        && getEnvoyAbilityTags(envoyAbilityId as EnvoyAbilityId).includes('SPELL')
      ) {
        envoyMult *= 1 + envoyBoonModsRef.current.spellDamageFluxBonusPct / 100;
      }
      dmg = Math.floor(dmg * envoyMult);
      const envoyAbilityIdCast = (options?.abilityId ?? lastPlayerAbilityRef.current) as EnvoyAbilityId | null;
      const envoyAdjust = envoyAbilityIdCast
        ? adjustEnvoyOutgoingDamage({
          boons: envoyBoons,
          mods: envoyBoonModsRef.current,
          abilityId: envoyAbilityIdCast,
          target: working,
          damage: dmg,
          channel: options?.channel,
          encounter: classBoonEncounterRef.current,
          log,
        })
        : null;
      if (envoyAdjust) {
        dmg = envoyAdjust.damage;
        if (envoyAdjust.channel) options = { ...options, channel: envoyAdjust.channel };
        if (envoyAdjust.executeKill) dmg = working.currentHp;
        pendingEnvoyKineticSplash = envoyAdjust.kineticConversionSplash;
      }
    }
    if (hexOverchargedStrike && dmg > 0) {
      dmg = Math.floor(dmg * 1.5);
    }
    const graftPlan = operativeClass === 'AEGIS'
      ? activeGraftPlanRef.current
      : activeClassGraftPlanRef.current;
    if (graftPlan && dmg > 0) {
      if (operativeClass === 'AEGIS') {
        dmg = scaleGraftDamage(dmg, graftPlan as GraftCastPlan, activeGraftStaminaSpentRef.current);
      }
      if (graftPlan.forceTrueDamage) {
        options = { ...options, channel: 'TRUE' };
      }
      if (graftPlan.executeThreshold && working.maxHp > 0 && !working.isBoss) {
        const hpRatio = working.currentHp / working.maxHp;
        if (hpRatio <= graftPlan.executeThreshold) {
          dmg = working.currentHp;
          log(`>> [${graftPlan.graftName.toUpperCase()}] EXECUTE — sub-threshold cull.`);
        }
      }
    }
    if (
      source === 'STRIKE'
      && kineticBatteryChargedRef.current
      && dmg > 0
    ) {
      kineticBatteryChargedRef.current = false;
      const boosted = Math.floor(dmg * 1.4);
      log(`${tag} >> [KINETIC BATTERY] — ${dmg} → ${boosted}.`);
      dmg = boosted;
    }
    if (source && equippedBlueprintId) {
      const fireResult = runOnFireHooks(equippedBlueprintId, {
        blueprintId: equippedBlueprintId,
        player: {
          hp: operativeHpRef.current,
          maxHp: maxSoulAnchor,
          shield: sessionExtrasRef.current.playerShield,
          shieldTurnsRemaining: sessionExtrasRef.current.playerShieldTurnsRemaining,
          debuffs: [...sessionExtrasRef.current.playerDebuffs],
        },
        target: working,
        squad: squadRef.current,
        damage: { raw: dmg, channel: options?.channel, multiplier: 1 },
        source,
      });
      fireResult.logLines.forEach((line) => log(line));
      if (fireResult.playerHpDelta && fireResult.playerHpDelta < 0) {
        const hpCost = Math.abs(fireResult.playerHpDelta);
        setOperativeHp((p) => {
          const n = Math.max(p - hpCost, 0);
          operativeHpRef.current = n;
          return n;
        });
      }
    }
    if (
      hasMutation(leyLineMutations, 'FINAL_STAND')
      && playerApRef.current === 1
      && staminaRef.current === 0
      && source
    ) {
      options = { ...options, channel: 'TRUE' };
    }
    if (source) {
      const activeAbility = (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef();
      if (
        modifierForAction(leyLineMutations, 'ABYSSAL_RESONANCE', activeAbility, mutationModsRef.current.abyssalResonancePctPer10Stam) > 0
        && dmg > 0
      ) {
        const bonus = Math.floor(staminaRef.current / 10) * mutationModsRef.current.abyssalResonancePctPer10Stam;
        dmg = Math.floor(dmg * (1 + bonus / 100));
      }
      if (
        mutationEncounterRef.current.voidResonanceOccultBonus
        && activeAbility
        && dmg > 0
      ) {
        mutationEncounterRef.current.voidResonanceOccultBonus = false;
        dmg = Math.floor(dmg * 1.15);
        log('[VOID RESONANCE] >> Alternating channel — +15% damage.');
      }
      if (mutationEncounterRef.current.masochistBuff) {
        dmg = Math.floor(dmg * 1.5);
      }
      const scaled = scaleKineticDamage(dmg, 0);
      if (!narrativeOvercharged && scaled !== dmg) {
        log(`${tag} >> Kinetic scaling ${dmg} → ${scaled}.`);
      }
      dmg = scaled;
    }
    if (options?.channel === 'TRUE' || bypassAllMitigation) {
      dmg = applyDamageWithFractureBonus(dmg, working);
    } else if (options?.channel) {
      const hit = resolveHostileHpHit(working, dmg, options.channel, { ignoreDefenses });
      working = hit.enemy;
      dmg = hit.hpDamage;
    }
    if (!bypassAllMitigation && (env.enemyDamageReductionPct ?? 0) > 0) {
      dmg = Math.floor(dmg * (1 - (env.enemyDamageReductionPct ?? 0) / 100));
    }
    if (critical && dmg > 0 && !options?.echoHit) {
      dmg = applyCritMultiplier(dmg, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER);
      if (operativeClass === 'ENVOY') {
        const envoyAbilityIdCrit = (options?.abilityId ?? lastPlayerAbilityRef.current) as EnvoyAbilityId | null;
        const volatileBonus = getEnvoyVolatileMagicCritBonus(envoyBoons, envoyAbilityIdCrit, true);
        if (volatileBonus > 0) {
          dmg = Math.floor(dmg * (1 + volatileBonus));
          log('[VOLATILE MAGIC] >> AoE critical rupture amplified.');
        }
      }
      const classGraftCrit = activeClassGraftPlanRef.current;
      if (classGraftCrit?.refundApOnCrit && operativeClass !== 'AEGIS') {
        playerApRef.current += 1;
        setPlayerActionPoints(playerApRef.current);
        log(`>> [${classGraftCrit.graftName.toUpperCase()}] — critical hit refunds 1 AP.`);
      }
      const critChannel = options?.channel ?? 'KINETIC';
      if (e.unitId) {
        const prev = critImpactSeqRef.current[e.unitId]?.seq ?? 0;
        critImpactSeqRef.current[e.unitId] = { seq: prev + 1, channel: critChannel };
        publishSquadUi(squadRef.current);
        onPlayerCritImpact?.({ unitId: e.unitId, channel: critChannel });
      }
      apparitionRef?.current?.triggerPlayerCritSunder(critChannel === 'OCCULT' ? 'OCCULT' : 'KINETIC');
    }
    if (!bypassAllMitigation) {
      dmg = Math.floor(dmg * getEnemyDamageTakenMultiplier(working, sessionExtrasRef.current));
    }

    const projectedHpAfter = Math.max(working.currentHp - dmg, 0);
    if (source && options?.channel) {
      const hitLifecycle = CombatLifecycleManager.runOnHitTaken(
        working,
        {
          raw: dmg,
          channel: options.channel,
          source,
          projectedHpAfter,
        },
        buildLifecycleContext(),
      );
      hitLifecycle.logLines.forEach((line) => log(line));
      applyLifecycleExtras(hitLifecycle.extras);
      applyLifecyclePlayerDelta(hitLifecycle.playerHpDelta);
      applyLifecycleStaminaDelta(hitLifecycle.playerStaminaDelta);
      if (hitLifecycle.squad.length > 0) syncSquad(hitLifecycle.squad);
      working = getUnitById(squadRef.current, e.unitId!) ?? working;
      if (hitLifecycle.negateDamage) dmg = 0;
      else if (hitLifecycle.damageOverride != null) dmg = hitLifecycle.damageOverride;
      if (hitLifecycle.showImmunePopup && hitLifecycle.immunePopupUnitId) {
        publishSquadUi(squadRef.current);
      }
    }

    const hadFortify = !bypassAllMitigation && (working.fortifyTurnsRemaining ?? 0) > 0 && dmg > 0;
    if (hadFortify) {
      dmg = Math.floor(dmg * 0.5);
      log(`${tag} >> FORTIFIED — 50% (${dmg}).`);
    }
    if (!hadFortify) {
      if (critical) {
        log(`${tag} >> [ CRITICAL ] ${dmg} damage.`);
      } else {
        log(`${tag} >> ${dmg} damage.`);
      }
    }
    if ((hexOverchargedStrike || narrativeOvercharged) && source && dmg > 0) {
      if (hexOverchargedStrike) {
        hexOverchargedRef.current = false;
        setHexOvercharged(false);
        log('[OVERCHARGED] >> Perfect reload proc — +50% damage, armor ignored.');
      }
      if (narrativeOvercharged) {
        sessionExtrasRef.current.overchargedActive = false;
        log('[OVERCHARGED BOON] >> First strike bypassed all mitigation.');
      }
    }
    if (source && dmg > 0 && e.unitId) {
      trackVoidAmbushInterruptDamage(e.unitId, dmg);
    }
    const activeAbility = (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef();
    if (source && dmg > 0 && activeAbility && e.unitId) {
      if (
        boonMatchesAction(leyLineMutations, 'EXECUTIONERS_STRIDE', activeAbility)
        && targetIsExposed(working)
        && !mutationEncounterRef.current.executionerStrideUsed
      ) {
        mutationEncounterRef.current.executionerStrideUsed = true;
        playerApRef.current += 1;
        setPlayerActionPoints(playerApRef.current);
        log("[EXECUTIONER'S STRIDE] >> Exposed melee hit — +1 AP.");
      }
      if (
        boonMatchesAction(leyLineMutations, 'SUNDER_WEAVE', activeAbility)
        && mutationModsRef.current.sunderWeaveArmorShred > 0
      ) {
        working = {
          ...working,
          kineticArmor: Math.max(0, (working.kineticArmor ?? 0) - mutationModsRef.current.sunderWeaveArmorShred),
          occultWards: Math.max(0, (working.occultWards ?? 0) - 1),
        };
        patchUnit(e.unitId, working);
        log('[SUNDER-WEAVE] >> Dual-channel strike — 1 armor layer shattered.');
      }
      if (boonMatchesAction(leyLineMutations, 'TAR_TRAPPED', activeAbility)) {
        mutationEncounterRef.current.tarTrappedUnits[e.unitId] = 2;
        patchUnit(e.unitId, { evadeChance: 0, evadeActive: false });
        log('[TAR-TRAPPED] >> Target cannot evade for 2 turns.');
      }
      if (
        modifierForAction(
          leyLineMutations,
          'ABYSSAL_ERUPTION',
          activeAbility,
          mutationModsRef.current.abyssalEruptionPerHit,
        ) > 0
      ) {
        chargeAr(mutationModsRef.current.abyssalEruptionPerHit);
        log(`[ABYSSAL ERUPTION] >> +${mutationModsRef.current.abyssalEruptionPerHit} reserve from AoE hit.`);
      }
    }
    if (
      source
      && dmg > 0
      && working.factionTrait === 'COLD_VACUUM'
      && (options?.channel === 'KINETIC' || options?.channel === 'TRUE')
    ) {
      applyStamina(staminaRef.current - LEGION_COLD_VACUUM_STAMINA);
      log(`${tag} >> COLD VACUUM — +${LEGION_COLD_VACUUM_STAMINA} stamina tax.`);
    }
    if (source && dmg > 0 && !options?.indirectDamage && !options?.echoHit) {
      if (operativeClass === 'AEGIS') {
        const targetSlot = (working.gridSlot ?? 'FL_0') as CombatGridSlotId;
        const arenaHeight = Math.max(
          windowHeight * 0.52,
          200,
        );
        const lungeDelta = playerAttackLungeDelta(
          targetSlot,
          arenaLayoutModeRef.current,
          width,
          arenaHeight,
          arenaGridVariant,
        );
        playerViewportRef?.current?.triggerAttackLunge(lungeDelta);
      } else {
        playerViewportRef?.current?.triggerRangedAttack();
      }
    }
    const poolHp = working.sharedBossPool && bossRuntimeRef.current
      ? Math.max(bossRuntimeRef.current.currentHp - dmg, 0)
      : Math.max(working.currentHp - dmg, 0);
    const hp = poolHp;

    if (hp <= 0 && e.unitId && source && options?.channel) {
      const killGraft = operativeClass === 'AEGIS'
        ? activeGraftPlanRef.current
        : activeClassGraftPlanRef.current;
      if (killGraft?.refundApOnKill && operativeClass === 'AEGIS') {
        const refund = activeGraftApCostRef.current + 1;
        playerApRef.current += refund;
        setPlayerActionPoints(playerApRef.current);
        log(`>> [${killGraft.graftName.toUpperCase()}] — kill confirmed, AP refunded (+${refund}).`);
      }
      const deathLifecycle = CombatLifecycleManager.runOnDeath(
        working,
        { channel: options.channel, damage: dmg, source: source ?? undefined },
        buildLifecycleContext(),
      );
      deathLifecycle.logLines.forEach((line) => log(line));
      applyLifecycleExtras(deathLifecycle.extras);
      applyLifecyclePlayerDelta(deathLifecycle.playerHpDelta);
      if (deathLifecycle.squad.length > 0) syncSquad(deathLifecycle.squad);
      working = getUnitById(squadRef.current, e.unitId) ?? working;

      if (deathLifecycle.enterSlump) {
        patchUnit(e.unitId, working);
        return true;
      }

      if (deathLifecycle.ashTokenSlot) {
        sessionExtrasRef.current.ashTokens = {
          ...sessionExtrasRef.current.ashTokens,
          [deathLifecycle.ashTokenSlot]: { turnsRemaining: 1 },
        };
      }

      if (deathLifecycle.triggerRetributionParry) {
        pendingDissolveRef.current = { unitId: e.unitId, profile: working, hp: 0 };
        retributionParryRef.current = deathLifecycle.triggerRetributionParry;
        pendingDmgRef.current = deathLifecycle.triggerRetributionParry.occultDamage;
        pendingUnblockRef.current = false;
        cycleRef.current = 'DEFEND_PARRY';
        setCycleState('DEFEND_PARRY');
        startParryRing();
        patchUnit(e.unitId, { ...working, currentHp: 0 });
        return true;
      }
    }

    if (dmg > 0 && e.unitId && (source || options?.indirectDamage)) {
      const tetheredId = hookWeaverTetheredUnitId();
      if (source && tetheredId && tetheredId === e.unitId) {
        const weaver = activeHookWeaver();
        const penalty = weaver
          ? getAlphaMechanic(weaver, 'tetherStaminaPenalty', 10)
          : 10;
        applyStamina(Math.max(0, staminaRef.current - penalty));
        log(`>> HOOK WEAVER TETHER — ${penalty} stamina siphoned.`);
      }
      hitFlashSeqRef.current[e.unitId] = (hitFlashSeqRef.current[e.unitId] ?? 0) + 1;
      if (source && !options?.indirectDamage && !options?.echoHit) {
        const impactKind = operativeClass === 'AEGIS'
          ? 'AEGIS_SLICE' as const
          : operativeClass === 'HEX_SHOT'
            ? 'HEX_BULLET' as const
            : 'ENVOY_BURST' as const;
        const prevImpact = classImpactFxRef.current[e.unitId]?.seq ?? 0;
        classImpactFxRef.current[e.unitId] = { seq: prevImpact + 1, kind: impactKind };
      }
      Vibration.vibrate(18);
      if (equippedBlueprintId) {
        const hitResult = runOnHitHooks(equippedBlueprintId, {
          blueprintId: equippedBlueprintId,
          player: {
            hp: operativeHpRef.current,
            maxHp: maxSoulAnchor,
            shield: sessionExtrasRef.current.playerShield,
            shieldTurnsRemaining: sessionExtrasRef.current.playerShieldTurnsRemaining,
            debuffs: [...sessionExtrasRef.current.playerDebuffs],
          },
          target: working,
          squad: squadRef.current,
          damage: { raw: dmg, channel: options?.channel, multiplier: 1 },
          source,
        }, sessionExtrasRef.current);
        hitResult.logLines.forEach((line) => log(line));
      }
    }

    if (working.sharedBossPool && bossRuntimeRef.current) {
      if (hp <= 0 && e.unitId) beginDissolveForUnit(e.unitId, working, hp);
      bossRuntimeRef.current = { ...bossRuntimeRef.current, currentHp: hp };
      syncSquad(squadRef.current.map((u) =>
        u.sharedBossPool ? { ...u, currentHp: hp } : u,
      ));
    } else {
      if (hp <= 0 && e.unitId) beginDissolveForUnit(e.unitId, working, hp);
      patchUnit(e.unitId, syncRosterCombatState({ ...working, currentHp: hp }));
    }

    if (
      operativeClass === 'HEX_SHOT'
      && source
      && dmg > 0
      && !options?.echoHit
      && e.unitId
    ) {
      const hexAbilityId = (options?.abilityId ?? lastPlayerAbilityRef.current) as HexShotAbilityId | null;
      runHexShotOnHitBoons({
        boons: hexShotBoons,
        abilityId: hexAbilityId,
        target: working,
        damageDealt: dmg,
        critical,
        squad: squadRef.current,
        encounter: classBoonEncounterRef.current,
        log,
        patchUnit,
        splashDamage: (raw, targetId, splashTag) => {
          hurtEnemy(raw, splashTag, 'STRIKE', {
            channel: options?.channel ?? 'KINETIC',
            targetId,
            abilityId: hexAbilityId as AegisAbilityId | undefined,
            rollCrit: false,
            echoHit: true,
          });
        },
        healOperative: (amount) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        maxHp: maxSoulAnchor,
      });
    }

    if (
      operativeClass === 'ENVOY'
      && source
      && dmg > 0
      && !options?.echoHit
      && e.unitId
    ) {
      const envoyAbilityIdHit = (options?.abilityId ?? lastPlayerAbilityRef.current) as EnvoyAbilityId | null;
      runEnvoyOnHitBoons({
        boons: envoyBoons,
        abilityId: envoyAbilityIdHit,
        target: working,
        damageDealt: dmg,
        log,
        patchUnit,
        healOperative: (amount) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        encounter: classBoonEncounterRef.current,
      });
      if (pendingEnvoyKineticSplash && e.unitId) {
        hurtEnemy(pendingEnvoyKineticSplash, '[KINETIC CONVERSION]', 'STRIKE', {
          channel: 'KINETIC',
          targetId: e.unitId,
          abilityId: envoyAbilityIdHit as AegisAbilityId | undefined,
          rollCrit: false,
          echoHit: true,
        });
      }
    }

    if (source && env.bloodFrenzyActive && dmg > 0) {
      const heal = computeBloodFrenzyHeal(dmg, true);
      if (heal > 0) {
        setOperativeHp((p) => {
          const n = Math.min(p + heal, maxSoulAnchor);
          operativeHpRef.current = n;
          return n;
        });
        log(`[BLOOD FRENZY] >> Runic flare restores ${heal} soul anchor.`);
      }
    }
    if (graftPlan && source && dmg > 0) {
      if (graftPlan.healOnDamagePct > 0) {
        const graftHeal = Math.floor(dmg * graftPlan.healOnDamagePct);
        if (graftHeal > 0) {
          applyHealRef.current(graftHeal);
          log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftHeal} HP siphoned from damage.`);
        }
      }
      if (hp > 0 && operativeClass !== 'AEGIS') {
        const classPlan = activeClassGraftPlanRef.current;
        if (classPlan?.selfDebuffOnSurvive) {
          applyPlayerGraftDebuff(resolveClassGraftSurviveDebuff(classPlan.selfDebuffOnSurvive));
          log(`>> [${classPlan.graftName.toUpperCase()}] — target survived, operative debuffed.`);
        }
      }
    }
    if (working.isBoss && bossRuntimeRef.current && shouldShiftBossPhase(bossRuntimeRef.current, hp)) {
      bossPhaseRef.current = 2;
      const updatedBoss = { ...bossRuntimeRef.current, currentHp: hp, currentPhase: 2 };
      bossRuntimeRef.current = updatedBoss;
      if (working.sharedBossPool) {
        syncSquad(squadRef.current.map((u) =>
          u.isBoss ? { ...u, currentHp: hp, bossPhase: 2, intent: 'OVERDRIVE_DISCHARGE' as EnemyIntent } : u,
        ));
      } else {
        patchUnit(e.unitId, { ...working, currentHp: hp, bossPhase: 2, intent: 'OVERDRIVE_DISCHARGE' });
      }
      setPhaseAlert('>> WARNING: ANOMALY ANCHOR CRACKED // PHASE 2 INITIATED');
      log('>> WARNING: ANOMALY ANCHOR CRACKED // PHASE 2 INITIATED');
      onBossPhaseShift?.(2);
      setTimeout(() => setPhaseAlert(null), 2400);
    }

    if (allUnitsDefeated(squadRef.current)) {
      if (cycleRef.current === 'DEFEND_PARRY') {
        pendingVictoryRef.current = true;
        ensureDeadUnitsDissolving();
        return true;
      }
      if (cycleRef.current === 'OFFENSE_SLICE') {
        abortCombatMinigames();
        cycleRef.current = 'TEXT_COMBAT';
        setCycleState('TEXT_COMBAT');
      }
      scheduleCombatVictoryResolution();
      return true;
    }

    if (
      hp <= 0
      && source
      && isEnemyFractured(working)
      && hasMutation(leyLineMutations, 'RELENTLESS_MOMENTUM')
    ) {
      applyStamina(staminaRef.current + Math.floor(maxStamina * 0.2));
      log('[RELENTLESS MOMENTUM] >> Fractured kill — 20% stamina restored.');
    }
    const killingAbility = (options?.abilityId as AegisAbilityId | undefined) ?? lastAegisAbilityRef();
    if (
      hp <= 0
      && killingAbility
      && boonMatchesAction(leyLineMutations, 'EXECUTIONERS_HIGH', killingAbility)
      && !mutationEncounterRef.current.executionerHighUsed
    ) {
      mutationEncounterRef.current.executionerHighUsed = true;
      combatBuffRef.current.bonusApThisTurn += 1;
      playerApRef.current += 1;
      setPlayerActionPoints(playerApRef.current);
      log("[EXECUTIONER'S HIGH] >> Kinetic kill — +1 AP.");
    }
    if (
      hp <= 0
      && killingAbility
      && boonMatchesAction(leyLineMutations, 'VOIDS_TOLL', killingAbility)
    ) {
      mutationEncounterRef.current.voidsTollApBonus += 1;
      log("[VOID'S TOLL] >> Ultimate kill — +1 max AP this incursion (−15% max HP).");
    }
    if (
      critical
      && !options?.echoHit
      && source
      && mutationModsRef.current.phantomCritSplitPct > 0
    ) {
      const echoTarget = aliveUnits(squadRef.current).find((u) => u.unitId !== e.unitId);
      if (echoTarget?.unitId) {
        log('[PHANTOM STRIKES] >> Crit void energy splits to secondary target.');
        hurtEnemy(
          Math.floor(dmg * mutationModsRef.current.phantomCritSplitPct),
          '[PHANTOM]',
          source,
          {
            channel: options?.channel ?? 'KINETIC',
            targetId: echoTarget.unitId,
            echoHit: true,
            rollCrit: false,
          },
        );
      }
    }

    if (hp <= 0) {
      const killAbility = options?.abilityId ?? lastPlayerAbilityRef.current;
      const killCtx = {
        abilityId: killAbility,
        log,
        maxHp: maxSoulAnchor,
        currentHp: operativeHpRef.current,
        refundAmmo: (amount: number) => setMagazineAmmo(Math.min(maxAmmo, currentAmmoRef.current + amount)),
        refundAp: () => {
          playerApRef.current += 1;
          setPlayerActionPoints(playerApRef.current);
        },
        healOperative: (amount: number) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        restoreStamina: () => applyStamina(maxStamina),
        fillMagazine: () => setMagazineAmmo(maxAmmo),
      };
      if (operativeClass === 'HEX_SHOT') {
        runHexShotKillBoons(hexShotBoons, killCtx);
        runHexShotKillBurstBoons({
          boons: hexShotBoons,
          abilityId: killAbility as HexShotAbilityId | null,
          killedUnitId: e.unitId,
          lastDamage: dmg,
          squad: squadRef.current,
          log,
          splashDamage: (raw, targetId, splashTag) => {
            hurtEnemy(raw, splashTag, 'STRIKE', {
              channel: options?.channel ?? 'KINETIC',
              targetId,
              abilityId: killAbility as AegisAbilityId | undefined,
              rollCrit: false,
              echoHit: true,
            });
          },
        });
      } else if (operativeClass === 'ENVOY') {
        runEnvoyKillBoonsExtended({
          boons: envoyBoons,
          abilityId: killAbility as EnvoyAbilityId | null,
          killedUnitId: e.unitId,
          squad: squadRef.current,
          classState: classCombatRef.current,
          encounter: classBoonEncounterRef.current,
          log,
          healOperative: (amount) => {
            setOperativeHp((p) => {
              const n = Math.min(maxSoulAnchor, p + amount);
              operativeHpRef.current = n;
              return n;
            });
          },
          maxHp: maxSoulAnchor,
          currentHp: operativeHpRef.current,
          applyCurseToUnit: (unitId) => {
            markEnemyCursed(unitId, classBoonEncounterRef.current, 2);
            classCombatRef.current.entropyHexTurns[unitId] = 2;
          },
        });
      }
      const nextFocus = primaryAliveUnit(squadRef.current);
      if (nextFocus?.unitId) selectTarget(nextFocus.unitId);
    } else {
      playerViewportRef?.current?.triggerDamageEffect('hp');
    }
    return false;
  };

  markPlayerDefendedRef.current = () => {
    sessionExtrasRef.current.playerDefendedThisTurn = true;
    if (kineticBatteryActive && !kineticBatteryChargedRef.current) {
      kineticBatteryChargedRef.current = true;
      log('[KINETIC BATTERY] >> Defense lattice charged — next strike +40%.');
    }
    if (hasStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF')) {
      removeStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF');
      log('>> ECHO DISSIPATED — defensive posture absorbed the aftershock.');
    }
  };

  resolvePlayerTurnEndDebuffsRef.current = () => {
    const echo = sessionExtrasRef.current.structuredDebuffs.find((d) => d.type === 'ECHO_DEBUFF');
    if (!echo) return;
    if (sessionExtrasRef.current.playerDefendedThisTurn) {
      removeStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF');
      return;
    }
    const echoDmg = echo.amount ?? 0;
    if (echoDmg > 0 && operativeHpRef.current > 0) {
      hurtPlayer(echoDmg, false, `>> KINETIC ECHO — ${echoDmg}`, { rollEvade: false, rollCrit: false });
      log('>> KINETIC AFTERSHOCK — delayed rupture lands.');
    }
    removeStructuredDebuff(sessionExtrasRef.current, 'ECHO_DEBUFF');
  };

  const markAttackerDoomed = (attacker: EnemyCombatProfile) => {
    if (!attacker.unitId) return;
    const stacked = stackDoomedTag(attacker);
    patchUnit(attacker.unitId, stacked);
    log('[ASHEN MANTLE] >> Mantle absorbed 50% — attacker marked Doomed.');
    if (hasMutation(leyLineMutations, 'NULL_ZONE')) {
      const hpDrain = Math.max(1, Math.floor(attacker.maxHp * 0.1));
      hurtEnemy(hpDrain, '[NULL-ZONE]', 'STRIKE', {
        channel: 'OCCULT',
        targetId: attacker.unitId,
      });
      log('[NULL-ZONE] >> Mantle backlash — attacker hemorrhaging.');
    }
  };

  const tickMutationHazardsOnEnemyPhase = () => {
    const mods = mutationModsRef.current;
    if (mods.ruinDotFracture > 0) {
      for (const unitId of mutationEncounterRef.current.venomousRuinUnits) {
        const unit = getUnitById(squadRef.current, unitId);
        if (!unit?.unitId || !isUnitAlive(unit)) continue;
        const next = applyFractureDamage(unit, mods.ruinDotFracture);
        patchUnit(unit.unitId, next);
        log(`[VENOMOUS RUIN] >> ${unit.designation} — +${mods.ruinDotFracture} fracture hazard.`);
      }
    }
    if (mods.voidContagionDamage > 0) {
      for (const unit of aliveUnits(squadRef.current)) {
        if (!unit.unitId || doomedPulseStacks(unit) <= 0) continue;
        const pulse = mods.voidContagionDamage * doomedPulseStacks(unit);
        hurtEnemy(pulse, '[VOID CONTAGION]', undefined, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          indirectDamage: true,
        });
        log(`[VOID CONTAGION] >> ${unit.designation} — ${pulse} occult pulse.`);
      }
    }
    if (mods.corruptedBloodDamage > 0) {
      for (const unitId of mutationEncounterRef.current.corruptedBloodUnits) {
        const unit = getUnitById(squadRef.current, unitId);
        if (!unit?.unitId || !isUnitAlive(unit)) continue;
        hurtEnemy(mods.corruptedBloodDamage, '[CORRUPTED BLOOD]', undefined, {
          channel: 'OCCULT',
          targetId: unit.unitId,
          indirectDamage: true,
        });
        log(`[CORRUPTED BLOOD] >> ${unit.designation} — void bleed.`);
      }
    }
    const trapped = mutationEncounterRef.current.tarTrappedUnits;
    for (const [unitId, turns] of Object.entries(trapped)) {
      if (turns <= 1) {
        delete trapped[unitId];
      } else {
        trapped[unitId] = turns - 1;
      }
    }
    if (mutationEncounterRef.current.veilTarTurnsRemaining > 0) {
      for (const unit of aliveUnits(squadRef.current)) {
        if (!unit.unitId) continue;
        patchUnit(unit.unitId, {
          evadeChance: 0,
          evadeActive: false,
          enemyActionPoints: 0,
        });
      }
      log(`>> VEIL-TAR HAZARD — hostiles rooted (${mutationEncounterRef.current.veilTarTurnsRemaining} turn(s) left).`);
    }
    const bleedUnits = mutationEncounterRef.current.reaveBleedUnits;
    for (const [unitId, turns] of Object.entries({ ...bleedUnits })) {
      const unit = getUnitById(squadRef.current, unitId);
      if (!unit?.unitId || !isUnitAlive(unit)) {
        delete bleedUnits[unitId];
        continue;
      }
      hurtEnemy(8, '[REAVE BLEED]', undefined, {
        channel: 'KINETIC',
        targetId: unit.unitId,
        rollCrit: false,
        indirectDamage: true,
      });
      if (turns <= 1) {
        delete bleedUnits[unitId];
      } else {
        bleedUnits[unitId] = turns - 1;
      }
      log(`[REAVE BLEED] >> ${unit.designation} — jagged debris (${bleedUnits[unitId] ?? 0} turn(s) left).`);
    }
    classCombatRef.current.brimstoneBleedTurns = applyBrimstoneBleedDot(
      squadRef.current,
      classCombatRef.current.brimstoneBleedTurns,
      (raw, tag, options, targetId) => hurtEnemy(raw, tag, undefined, {
        channel: options?.channel ?? 'OCCULT',
        targetId: options?.targetId ?? targetId,
        rollCrit: options?.rollCrit,
        indirectDamage: true,
      }),
      log,
    );
    classBoonEncounterRef.current.voidBleedTurns = applyVoidBleedDot(
      squadRef.current,
      classBoonEncounterRef.current.voidBleedTurns,
      (raw, tag, targetId) => hurtEnemy(raw, tag, undefined, {
        channel: 'OCCULT',
        targetId,
        rollCrit: false,
        indirectDamage: true,
      }),
      log,
    );
    classBoonEncounterRef.current.chemicalWarfareTurns = tickHexShotChemicalWarfare(
      squadRef.current,
      classBoonEncounterRef.current.chemicalWarfareTurns,
      patchUnit,
      log,
    );
  };

  const applyEviscerateAftermath = () => {
    const mods = mutationModsRef.current;
    abyssalRef.current = 0;
    setAbyssalReserve(0);
    setSuccessfulParryCount(0);
    classCombatRef.current.successfulParryCount = 0;
    for (const unit of aliveUnits(squadRef.current)) {
      if (!unit.unitId) continue;
      patchUnit(unit.unitId, {
        kineticArmor: 0,
        occultWards: 0,
        baseKineticArmor: 0,
        baseOccultWards: 0,
      });
      if (mods.corruptedBloodDamage > 0) {
        mutationEncounterRef.current.corruptedBloodUnits.add(unit.unitId);
      }
    }
    if (mods.corruptedBloodDamage > 0) {
      log('[CORRUPTED BLOOD] >> Survivors marked for void bleed.');
    }
    log('[EVISCERATE] >> Reserve vented — survivor armor shattered.');
  };

  const applyTetanusGlitch = () => {
    if (!env.hasTetanusGlitch) return;
    log('[TETANUS GLITCH] >> Soul Anchor hemorrhage — 3 HP lost on exhaustion.');
    Vibration.vibrate([0, 32, 48, 28]);
    setOperativeHp((p) => {
      const n = Math.max(p - 3, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
  };

  const markExhausted = () => {
    skipRegenRef.current = true;
    applyStamina(0);
    applyTetanusGlitch();
  };
  const adjustedStaminaCost = (cost: number) => {
    const reduction = 0;
    if (reduction <= 0) return cost;
    return Math.max(1, Math.floor(cost * (1 - reduction / 100)));
  };

  const spendActionPoints = (cost: number): boolean => {
    if (playerApRef.current < cost) return false;
    const next = playerApRef.current - cost;
    playerApRef.current = next;
    setPlayerActionPoints(next);
    return true;
  };

  const spendStam = (cost: number, overdraw = false): boolean => {
    const effectiveCost = adjustedStaminaCost(cost);
    if (staminaRef.current < effectiveCost) {
      if (!overdraw) return false;
      markExhausted();
      return true;
    }
    const n = applyStamina(staminaRef.current - effectiveCost);
    if (n <= 0) {
      skipRegenRef.current = true;
      applyTetanusGlitch();
    }
    return true;
  };

  const attackDmg = (e: EnemyCombatProfile) => {
    if (e.intent === 'WORLD_ENDER') {
      return { dmg: Math.floor(e.baseDamage * 2.5), unblockable: true };
    }
    if (isRosterSpecificIntent(e.intent) || e.rosterId === 'echoing-brute') {
      return {
        dmg: resolveRosterEnemyDamage(e, e.intent),
        unblockable: false,
      };
    }
    return { dmg: e.baseDamage, unblockable: false };
  };

  const applyFractureHoundShieldDrain = (attacker: EnemyCombatProfile) => {
    if (attacker.rosterId !== 'fracture-hound' || attacker.isEnraged) return;
    const extras = sessionExtrasRef.current;
    if (extras.playerShield <= 0) return;
    const drainAmt = getAlphaMechanic(
      attacker,
      'shieldDamage',
      ROSTER_AI_WEIGHTS.FRACTURE_HOUND_SHIELD_DRAIN,
    );
    const drain = Math.min(extras.playerShield, drainAmt);
    extras.playerShield -= drain;
    log(`>> FRACTURE HOUND — ${drain} shield integrity siphoned.`);
  };

  const applyStaminaDrainLeap = (attacker: EnemyCombatProfile) => {
    const drain = getAlphaMechanic(attacker, 'staminaDrain', 20);
    const beforeStamina = staminaRef.current;
    applyStamina(beforeStamina - drain);
    log(`>> ${attacker.designation} STAMINA DRAIN LEAP — stamina siphoned (-${drain}).`);
    if (getAlphaMechanic(attacker, 'appliesBleed', false)) {
      if (!sessionExtrasRef.current.playerDebuffs.includes('BLEEDING')) {
        sessionExtrasRef.current.playerDebuffs = [
          ...sessionExtrasRef.current.playerDebuffs,
          'BLEEDING',
        ];
      }
      log('>> PLAGUE SWARM — operative bleeding.');
    }
    if (beforeStamina > 0 && staminaRef.current <= 0) {
      sessionExtrasRef.current.playerApPenaltyNextTurn += 1;
      log('>> MIASMA FATIGUE — operative AP reduced next turn.');
    }
  };

  const closeVoidAmbushWindow = () => {
    voidAmbushWindowRef.current = null;
    setIsPlayerTurn(false);
  };

  const finalizeNullShadeVoidAmbush = (enemy: EnemyCombatProfile) => {
    if (!enemy.unitId || enemy.rosterId !== 'null-shade' || enemy.intent !== 'VOID_AMBUSH') return;
    patchUnit(enemy.unitId, nullShadeVoidAmbushCleanupPatch(enemy));
    publishSquadUi(squadRef.current);
  };

  const interruptVoidAmbush = (unitId: string) => {
    if (!voidAmbushWindowRef.current || voidAmbushWindowRef.current.unitId !== unitId) return;

    if (enemyTurnTimerRef.current) {
      clearTimeout(enemyTurnTimerRef.current);
      enemyTurnTimerRef.current = null;
    }
    if (enemyStrikeTimerRef.current) {
      clearTimeout(enemyStrikeTimerRef.current);
      enemyStrikeTimerRef.current = null;
    }

    closeVoidAmbushWindow();
    setEnemyActionStage(null);

    const shade = getUnitById(squadRef.current, unitId);
    if (shade?.unitId && isUnitAlive(shade)) {
      patchUnit(shade.unitId, {
        ...nullShadeVoidAmbushCleanupPatch({ ...shade, intent: 'VOID_AMBUSH' }),
        intent: 'STRIKE',
      });
    }

    log(`>> VOID AMBUSH INTERRUPTED — ${VOID_AMBUSH_INTERRUPT_THRESHOLD}+ damage dealt. Shade forced material.`);

    if (enemyActionQueueRef.current[0] === unitId) {
      enemyActionQueueRef.current.shift();
    }

    publishSquadUi(squadRef.current);

    if (enemyActionQueueRef.current.length > 0) {
      scheduleNextEnemyAction(false);
    } else if (!allUnitsDefeated(squadRef.current)) {
      endEnemyTurn(true);
    }
  };

  const scheduleNextEnemyAction = (countering: boolean) => {
    if (isCombatTerminal() || enemyActionQueueRef.current.length === 0) return;
    if (isHitstopActive() || combatPausedRef.current) {
      setTimeout(() => scheduleNextEnemyAction(countering), 50);
      return;
    }
    if (enemyTurnGapTimerRef.current) {
      clearTimeout(enemyTurnGapTimerRef.current);
    }
    enemyTurnGapTimerRef.current = setTimeout(() => {
      enemyTurnGapTimerRef.current = null;
      if (isCombatTerminal()) return;
      runEnemyActionAnimation(countering);
    }, ENEMY_TURN_GAP_MS);
  };

  const trackVoidAmbushInterruptDamage = (unitId: string, hpDamage: number) => {
    const window = voidAmbushWindowRef.current;
    if (!window || window.unitId !== unitId || hpDamage <= 0) return;
    window.damageDealt += hpDamage;
    if (window.damageDealt >= VOID_AMBUSH_INTERRUPT_THRESHOLD) {
      setTimeout(() => interruptVoidAmbush(unitId), 0);
    }
  };

  const execIntent = (e: EnemyCombatProfile) => {
    const intent = resolveEffectiveEnemyIntent(e);
    const blindPenalty = getEnemyAccuracyPenalty(e, sessionExtrasRef.current);
    if (blindPenalty > 0 && isAttackIntent(intent) && Math.random() < blindPenalty) {
      log(`>> ${e.designation} BLINDED — attack whiffed (−${Math.round(blindPenalty * 100)}% accuracy).`);
      return;
    }
    if (e.isBoss && bossRuntimeRef.current) {
      const phase = bossPhaseRef.current;
      if (intent === 'OVERDRIVE_DISCHARGE') {
        const dmg = bossStrikeDamage(bossRuntimeRef.current, phase);
        log(`>> ${e.designation} OVERDRIVE DISCHARGE — ${dmg} DMG`);
        hurtPlayer(dmg, !counterRef.current, `>> OVERDRIVE HIT — ${dmg}`, { attacker: e, rollCrit: false });
        return;
      }
      const dmg = bossStrikeDamage(bossRuntimeRef.current, phase);
      hurtPlayer(dmg, false, `>> ${e.designation} STRIKES — ${dmg}`, { attacker: e, rollCrit: false });
      return;
    }
    switch (intent) {
      case 'STRIKE': {
        const { dmg, unblockable } = attackDmg(e);
        if (e.rosterId === 'fracture-hound' && !e.isEnraged) applyFractureHoundShieldDrain(e);
        if (e.rosterId === 'breacher') {
          const staminaShred = getAlphaMechanic(e, 'concussiveDamageToStamina', BREACHER_STAMINA_DRAIN);
          applyStamina(staminaRef.current - staminaShred);
          log(`>> ${e.designation} BREACH STRIKE — ${staminaShred} stamina shredded (${dmg} HP).`);
          hurtPlayer(dmg, unblockable, `>> BREACH STRIKE — ${dmg}`, { attacker: e, rollCrit: false });
          break;
        }
        hurtPlayer(dmg, unblockable, `>> ${e.designation} STRIKES — ${dmg}`, { attacker: e });
        break;
      }
      case 'WORLD_ENDER': {
        const { dmg } = attackDmg(e);
        log(`>> ${e.designation} WORLD-ENDER — ${dmg} UNBLOCKABLE`);
        hurtPlayer(dmg, true, undefined, { attacker: e, rollCrit: false });
        break;
      }
      case 'STRIP_STAMINA':
        log(`>> ${e.designation} STRIPS STAMINA (-20).`);
        applyStamina(staminaRef.current - 20);
        break;
      case 'SIPHON_ABYSSAL': {
        const { nextAbyssal, siphoned } = applyAbyssalSiphon(
          abyssalRef.current,
          ENEMY_ABYSSAL_SIPHON_REQUEST,
        );
        log(formatAbyssalSiphonLog(e.designation, ENEMY_ABYSSAL_SIPHON_REQUEST, siphoned));
        abyssalRef.current = nextAbyssal;
        setAbyssalReserve(nextAbyssal);
        break;
      }
      case 'EVADE':
        log(`>> ${e.designation} EVADE posture — 50% evasion chance.`);
        break;
      case 'FORTIFY': {
        log(`>> ${e.designation} FORTIFY — kinetic shell hardened (2 turns).`);
        if (e.unitId) {
          patchUnit(e.unitId, { fortifyTurnsRemaining: 2 });
          publishSquadUi(squadRef.current);
        }
        break;
      }
      case 'FIELD_REPAIR': {
        if (!e.unitId) break;
        const district = fixerDistrictFromProfile(e);
        const healAmt = rollFixerRepairAmount(district);
        if (e.fixerAoEHeal) {
          let healedAny = false;
          for (const ally of aliveUnits(squadRef.current)) {
            if (ally.unitId === e.unitId || ally.currentHp >= ally.maxHp) continue;
            if (isEnemyHealBlocked(classCombatRef.current, ally.unitId!, hasEnvoyBoon(envoyBoons, 'FLESH_ROT'))) {
              continue;
            }
            const pct = e.alphaMechanics?.healPercent ?? 0.15;
            const amount = Math.max(1, Math.floor(ally.maxHp * pct));
            const healed = Math.min(ally.maxHp, ally.currentHp + amount);
            const applied = healed - ally.currentHp;
            if (applied <= 0) continue;
            patchUnit(ally.unitId!, { currentHp: healed });
            statusFloatSeqRef.current[ally.unitId!] = (statusFloatSeqRef.current[ally.unitId!] ?? 0) + 1;
            healedAny = true;
            log(`>> ${e.designation} FIELD REPAIR — ${ally.designation} +${applied} HP (board heal).`);
          }
          if (healedAny) publishSquadUi(squadRef.current);
          else log(`>> ${e.designation} FIELD REPAIR — no valid targets.`);
          break;
        }
        const target = fixerRepairTarget(squadRef.current, e.unitId);
        if (!target?.unitId || target.currentHp >= target.maxHp) {
          log(`>> ${e.designation} FIELD REPAIR — no valid target.`);
          break;
        }
        if (isEnemyHealBlocked(classCombatRef.current, target.unitId, hasEnvoyBoon(envoyBoons, 'FLESH_ROT'))) {
          log(`>> ${e.designation} FIELD REPAIR BLOCKED — ${target.designation} flesh-warped.`);
          break;
        }
        const healed = Math.min(target.maxHp, target.currentHp + healAmt);
        const applied = healed - target.currentHp;
        patchUnit(target.unitId, { currentHp: healed });
        statusFloatSeqRef.current[target.unitId] = (statusFloatSeqRef.current[target.unitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        log(`>> ${e.designation} FIELD REPAIR — ${target.designation} +${applied} HP (D${district}).`);
        break;
      }
      case 'CHARGE': log(`>> ${e.designation} CHARGING world-ender (${e.chargeTurns + 1}/3).`); break;
      case 'PAVEMENT_CRUSHER_CHARGE':
        log(`>> ${e.designation} PAVEMENT CRUSHER CHARGE — structural wind-up engaged.`);
        break;
      case 'PAVEMENT_CRUSHER': {
        const dmg = resolveRosterEnemyDamage(e, 'PAVEMENT_CRUSHER');
        log(`>> ${e.designation} PAVEMENT CRUSHER — ${dmg} kinetic rupture.`);
        hurtPlayer(dmg, true, `>> PAVEMENT CRUSHER — ${dmg}`, { attacker: e, rollCrit: false });
        break;
      }
      case 'OCCULT_TETHER': {
        const tether = applyLeySirenTetherAction(squadRef.current, e);
        syncSquad(tether.squad);
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          leySirenTetheredUnitIds: tether.tetheredIds,
          leySirenSourceUnitId: e.unitId ?? null,
        };
        tether.logLines.forEach((line) => log(line));
        break;
      }
      case 'SWARM_BITE':
        applyStaminaDrainLeap(e);
        break;
      case 'STAMINA_DRAIN_LEAP':
        applyStaminaDrainLeap(e);
        break;
      case 'DOUBLE_STRIKE': {
        const dmg = resolveRosterEnemyDamage(e, 'DOUBLE_STRIKE');
        const strikeCount = e.rosterId === 'fracture-hound'
          ? getAlphaMechanic(e, 'attacksPerTurn', 2)
          : 2;
        if (e.isEnraged) {
          log(`>> ${e.designation} DOUBLE STRIKE — enraged true occult cleave.`);
          for (let i = 0; i < strikeCount && operativeHpRef.current > 0; i += 1) {
            hurtPlayer(dmg, true, `>> DOUBLE STRIKE ${i + 1} — ${dmg} TRUE OCCULT`, { attacker: e, rollCrit: false });
          }
        } else {
          if (e.rosterId === 'fracture-hound') applyFractureHoundShieldDrain(e);
          log(`>> ${e.designation} DOUBLE STRIKE — ${strikeCount > 2 ? 'rabid flurry' : 'twin cleave'}.`);
          for (let i = 0; i < strikeCount && operativeHpRef.current > 0; i += 1) {
            hurtPlayer(
              dmg,
              false,
              `>> DOUBLE STRIKE ${i + 1} — ${dmg}`,
              { attacker: e, rollCrit: i > 0 ? false : undefined },
            );
          }
        }
        break;
      }
      case 'VEIL_STATIC':
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          playerApCapNextTurn: 2,
        };
        log(`>> ${e.designation} VEIL STATIC — operative AP capped next turn (2/3).`);
        break;
      case 'PREMATURE_IGNITION': {
        log(`>> ${e.designation} PREMATURE IGNITION — occult backlash imminent.`);
        if (e.unitId) {
          pendingDissolveRef.current = { unitId: e.unitId, profile: e, hp: 0 };
          retributionParryRef.current = { unitId: e.unitId, occultDamage: 15 };
          pendingDmgRef.current = 15;
          pendingUnblockRef.current = false;
          cycleRef.current = 'DEFEND_PARRY';
          setCycleState('DEFEND_PARRY');
          startParryRing();
          patchUnit(e.unitId, syncRosterCombatState({ ...e, currentHp: 0 }));
        }
        break;
      }
      case 'RESONANCE_OVERLOAD': {
        const dmg = resolveRosterEnemyDamage(e, 'RESONANCE_OVERLOAD');
        log(`>> ${e.designation} RESONANCE OVERLOAD — dual-channel rupture.`);
        hurtPlayer(dmg, false, `>> RESONANCE KINETIC — ${dmg}`, { attacker: e });
        if (operativeHpRef.current > 0) {
          hurtPlayer(dmg, false, `>> RESONANCE OCCULT — ${dmg}`, { attacker: e, rollCrit: false });
        }
        break;
      }
      case 'SINKING_INTO_GRID':
        log(`>> ${e.designation} SINKING INTO THE GRID — physical targeting suppressed.`);
        break;
      case 'VOID_AMBUSH': {
        const base = resolveRosterEnemyDamage(e, 'VOID_AMBUSH');
        const critRoll = Math.random() < VOID_AMBUSH_CRIT_CHANCE;
        const dmg = critRoll ? applyCritMultiplier(base, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER) : base;
        log(`>> ${e.designation} VOID AMBUSH — ${critRoll ? 'CRITICAL ' : ''}${dmg} occult rupture.`);
        hurtPlayer(dmg, false, `>> VOID AMBUSH — ${dmg}`, { attacker: e, rollCrit: false });
        if (e.unitId) {
          patchUnit(e.unitId, nullShadeVoidAmbushCleanupPatch(e));
          publishSquadUi(squadRef.current);
        }
        break;
      }
      case 'KINETIC_AFTERSHOCK': {
        const dmg = resolveRosterEnemyDamage(e, 'STRIKE');
        log(`>> ${e.designation} KINETIC AFTERSHOCK — ${dmg} impact + echo primed.`);
        hurtPlayer(dmg, false, `>> KINETIC AFTERSHOCK — ${dmg}`, { attacker: e });
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ECHO_DEBUFF',
          amount: dmg,
          turnsRemaining: 1,
        });
        break;
      }
      case 'SCAVENGE': {
        if (!e.unitId) break;
        consumeAshToken();
        if (isEnemyHealBlocked(classCombatRef.current, e.unitId, hasEnvoyBoon(envoyBoons, 'FLESH_ROT'))) {
          log(`>> ${e.designation} SCAVENGE BLOCKED — flesh-warp seal.`);
          break;
        }
        const healAmt = Math.max(1, Math.floor(e.maxHp * 0.2));
        const healed = Math.min(e.maxHp, e.currentHp + healAmt);
        patchUnit(e.unitId, { currentHp: healed });
        statusFloatSeqRef.current[e.unitId] = (statusFloatSeqRef.current[e.unitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        log(`>> ${e.designation} SCAVENGES ASH — +${healed - e.currentHp} HP.`);
        break;
      }
      case 'SENSORY_JAM': {
        const jamTurns = Math.random() < 0.5 ? 1 : 2;
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'SENSORY_JAMMED',
          turnsRemaining: jamTurns,
        });
        log(`>> ${e.designation} SENSORY JAM — hostile intents obscured (${jamTurns} turn${jamTurns > 1 ? 's' : ''}).`);
        break;
      }
      case 'VEIL_BARRIER': {
        const isAoeBarrier = getAlphaMechanic<string>(e, 'shieldCastTarget', 'SINGLE') === 'AOE';
        const charges = 2;
        if (isAoeBarrier) {
          for (const ally of aliveUnits(squadRef.current)) {
            if (!ally.unitId) continue;
            patchUnit(ally.unitId, { veilBarrierCharges: charges });
          }
          log(`>> ${e.designation} VEIL BARRIER — board-wide ${charges} hit charges.`);
        } else if (e.unitId) {
          patchUnit(e.unitId, { veilBarrierCharges: charges });
          log(`>> ${e.designation} VEIL BARRIER — ${charges} hit charges active.`);
        }
        break;
      }
      case 'TARGET_LOCK': {
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'TARGET_LOCKED',
          turnsRemaining: 2,
        });
        if (e.unitId && e.rosterId === 'spotter') {
          patchUnit(e.unitId, { spotterLockedOn: true, isCharging: true });
        }
        log(`>> ${e.designation} LOCKED ON — artillery primed.`);
        break;
      }
      case 'ASHEN_ROT': {
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ASHEN_ROT',
          turnsRemaining: 2,
        });
        log(`>> ${e.designation} ASHEN ROT — buff/defend actions cost stamina.`);
        break;
      }
      case 'ARTILLERY_CHARGE':
        if (e.rosterId === 'coil-spike-sniper' && (e.laserLockTurnsRemaining ?? 0) > 0) {
          log(`>> ${e.designation} CHARGING TRUE SHOT — ${e.laserLockTurnsRemaining} cycle(s) remaining.`);
        } else {
          log(`>> ${e.designation} ARTILLERY CHARGE — ordnance priming.`);
        }
        break;
      case 'LASER_SIGHT': {
        const lockTurns = e.rosterId === 'coil-spike-sniper'
          ? getAlphaMechanic(e, 'lockOnTurns', 2)
          : 1;
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'LASER_SIGHT',
          turnsRemaining: lockTurns,
        });
        log(
          e.rosterId === 'coil-spike-sniper' && lockTurns > 1
            ? `>> ${e.designation} LASER SIGHT — true damage lock acquired (${lockTurns}-turn wind-up).`
            : `>> ${e.designation} LASER SIGHT — true damage lock acquired.`,
        );
        break;
      }
      case 'ARTILLERY_FIRE': {
        const isSapper = e.rosterId === 'sapper';
        const isSniper = e.rosterId === 'coil-spike-sniper';
        const isSpotter = e.rosterId === 'spotter';
        const dmg = isSpotter ? SPOTTER_ARTILLERY_TRUE_DAMAGE : resolveRosterEnemyDamage(e, 'ARTILLERY_FIRE');
        if (isSpotter && e.unitId) {
          patchUnit(e.unitId, { spotterLockedOn: false, isCharging: false });
        }
        if (isSapper) {
          sessionExtrasRef.current.playerShield = 0;
          sessionExtrasRef.current.playerShieldTurnsRemaining = 0;
          log(`>> ${e.designation} BUNKER BUSTER — shields stripped, ${dmg} unblockable.`);
          hurtPlayer(dmg, true, `>> BUNKER BUSTER — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (isSniper) {
          log(`>> ${e.designation} TRUE SHOT — ${dmg} (armor bypassed).`);
          hurtPlayer(dmg, true, `>> TRUE SHOT — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (isSpotter) {
          log(`>> ${e.designation} ARTILLERY BURST — ${dmg} TRUE.`);
          hurtPlayer(dmg, true, `>> ARTILLERY BURST — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (e.rosterId === 'splinter') {
          const chip = Math.max(4, Math.floor(dmg * 0.35));
          hurtPlayer(chip, false, `>> SEARING LASER — ${chip}`, { attacker: e });
          addStructuredDebuff(sessionExtrasRef.current, {
            type: 'SEARING',
            turnsRemaining: 3,
          });
          log(`>> ${e.designation} SEARING MARK applied.`);
        } else {
          log(`>> ${e.designation} ARTILLERY FIRE — ${dmg}.`);
          hurtPlayer(dmg, false, `>> ARTILLERY — ${dmg}`, { attacker: e });
        }
        break;
      }
      case 'TAR_BIND': {
        const dmg = resolveRosterEnemyDamage(e, 'TAR_BIND');
        const rootDuration = getAlphaMechanic(e, 'rootDuration', 1);
        hurtPlayer(dmg, false, `>> TAR BIND — ${dmg}`, { attacker: e });
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ROOTED',
          turnsRemaining: rootDuration,
        });
        log(`>> ${e.designation} ROOTED — defend/evade disabled (${rootDuration} turn${rootDuration > 1 ? 's' : ''}).`);
        break;
      }
      case 'STAMINA_TETHER': {
        const tether = applyHookWeaverTetherAction(squadRef.current, e);
        syncSquad(tether.squad);
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          hookWeaverTetheredUnitId: tether.tetheredId,
        };
        tether.logLines.forEach((line) => log(line));
        break;
      }
      case 'JAM_AUGMENT': {
        const slotCount = getAlphaMechanic(e, 'disabledAugmentCount', 1);
        const duration = getAlphaMechanic(e, 'disableDuration', 2);
        const slots: number[] = [];
        while (slots.length < Math.min(slotCount, 3)) {
          const slot = Math.floor(Math.random() * 3);
          if (!slots.includes(slot)) slots.push(slot);
        }
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          jammedAugmentSlot: slots[0] ?? null,
          jammedAugmentSlots: slots,
        };
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'JAMMED_AUGMENT',
          turnsRemaining: duration,
        });
        log(`>> ${e.designation} JAMMED AUGMENT — loadout slot(s) ${slots.map((s) => s + 1).join(', ')} disabled (${duration} turn${duration > 1 ? 's' : ''}).`);
        break;
      }
      default: break;
    }
    const rosterPatch = patchRosterAfterIntentExec(e, intent);
    if (e.unitId && Object.keys(rosterPatch).length > 0 && intent !== 'VOID_AMBUSH') {
      patchUnit(e.unitId, rosterPatch);
    }
  };

  const endEnemyTurn = (advanceIntent = true) => {
    if (isCombatTerminal()) return;
    if (operativeHpRef.current <= 0) return;
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
      return;
    }
    if (mutationEncounterRef.current.veilTarTurnsRemaining > 0) {
      mutationEncounterRef.current.veilTarTurnsRemaining -= 1;
    }
    if (env.combatObjective === 'SURVIVE_TURNS') {
      survivedEnemyTurnsRef.current += 1;
      const required = env.survivalTurnsRequired ?? 3;
      log(`>> RIFT DEFENSE — hostile cycle ${survivedEnemyTurnsRef.current}/${required} endured.`);
      if (survivedEnemyTurnsRef.current >= required) {
        resolve(true);
        return;
      }
    }
    if (advanceIntent) {
      syncSquad(squadRef.current.map((unit) => {
        if (!isUnitAlive(unit)) return unit;
        if (unit.isBoss && bossRuntimeRef.current) {
          const phase = bossPhaseRef.current;
          const nextIntent = rollBossIntent(phase);
          return { ...unit, intent: nextIntent, bossPhase: phase };
        }
        return advanceEnemyIntent(
          unit,
          combatDistrict,
          buildPlayerAIState(),
          squadRef.current,
          { hasAshToken: hasAshOnBoard() },
        );
      }));
    }
    enemyActionQueueRef.current = [];
    const nextTarget = nextDefaultTarget(squadRef.current);
    if (nextTarget) selectTarget(nextTarget);
    startPlayerTurn(primaryAliveUnit(squadRef.current)!);
  };

  const startPlayerTurn = (_e: EnemyCombatProfile) => {
    if (isCombatTerminal()) return;
    lifecycleFloatLabelsRef.current = {};
    tickCombatSessionExtras(sessionExtrasRef.current);
    combatChanceRef.current.shadowStepEvadeActive = false;
    if (staminaRef.current > 0) {
      combatChanceRef.current.momentumShiftEvadeDisabled = false;
    }
    setCounterPrepActive(false);
    counterRef.current = false;
    wraithParryRef.current = false;
    bloodBoundCarapaceRef.current = false;
    riftWardReadyRef.current = operativeClass === 'ENVOY';
    if (operativeClass === 'ENVOY') {
      const cursedCount = aliveUnits(squadRef.current).filter(
        (u) => (u.combatTags ?? []).some((t) => t.includes('CURSE') || t === 'DOOMED'),
      ).length;
      runEnvoyTurnStartBoons(
        envoyBoons,
        cursedCount,
        log,
        (amount) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
      );
    }
    if (combatBuffRef.current.demonLungCooldown > 0) {
      combatBuffRef.current.demonLungCooldown -= 1;
    }
    if (mutationEncounterRef.current.flawlessConduitPending) {
      combatBuffRef.current.bonusApThisTurn += 1;
      mutationEncounterRef.current.flawlessConduitPending = false;
      log('[FLAWLESS CONDUIT] >> Perfect parry — +1 AP this turn.');
    }
    if (mutationEncounterRef.current.momentumShiftPending) {
      combatBuffRef.current.bonusApThisTurn += 1;
      mutationEncounterRef.current.momentumShiftPending = false;
      log('[MOMENTUM SHIFT] >> Zero stamina end — +1 AP this turn. Evade disabled until stamina returns.');
    }
    if (mutationEncounterRef.current.bloodTitheCooldown > 0) {
      mutationEncounterRef.current.bloodTitheCooldown -= 1;
    }
    if (mutationEncounterRef.current.ashenMantleCooldown > 0) {
      mutationEncounterRef.current.ashenMantleCooldown -= 1;
    }
    mutationEncounterRef.current.adrenalineSpikeUsed = false;
    mutationEncounterRef.current.executionerHighUsed = false;
    mutationEncounterRef.current.bloodForTimeUsed = false;
    Object.keys(graftCooldownsRef.current).forEach((abilityId) => {
      const key = abilityId as AegisAbilityId;
      const remaining = graftCooldownsRef.current[key] ?? 0;
      if (remaining > 0) {
        graftCooldownsRef.current[key] = remaining - 1;
      }
    });
    const bonusAp = combatBuffRef.current.bonusApThisTurn;
    combatBuffRef.current.bonusApThisTurn = 0;
    const apPenalty = sessionExtrasRef.current.playerApPenaltyNextTurn;
    const apCap = sessionExtrasRef.current.playerApCapNextTurn;
    if (apPenalty > 0) {
      sessionExtrasRef.current.playerApPenaltyNextTurn = 0;
      log(`>> MIASMA FATIGUE — −${apPenalty} AP this turn.`);
    }
    if (apCap != null) {
      sessionExtrasRef.current.playerApCapNextTurn = null;
      log(`>> VEIL STATIC RESIDUE — operative AP capped at ${apCap}.`);
    }
    const baseAp = PLAYER_ACTION_POINTS_PER_TURN + bonusAp - apPenalty;
    playerApRef.current = apCap != null
      ? Math.max(0, Math.min(apCap, baseAp))
      : Math.max(0, baseAp);
    setPlayerActionPoints(playerApRef.current);
    if (operativeClass === 'HEX_SHOT') {
      hexReloadUsedThisTurnRef.current = false;
      setHexReloadUsedThisTurn(false);
      const panic = tryHexShotPanicButton(
        hexShotBoons,
        classBoonEncounterRef.current,
        currentAmmoRef.current,
        playerApRef.current,
        maxAmmo,
        log,
      );
      if (panic) {
        setMagazineAmmo(Math.min(maxAmmo, currentAmmoRef.current + panic.ammo));
        playerApRef.current += panic.ap;
        setPlayerActionPoints(playerApRef.current);
      }
    }
    if (operativeClass === 'ENVOY') {
      classBoonEncounterRef.current.voidsBargainFirstStrike = true;
      classBoonEncounterRef.current.hexBreakerCurseTurns = tickEnvoyHexBreaker(
        squadRef.current,
        classBoonEncounterRef.current.hexBreakerCurseTurns,
        (raw, targetId) => hurtEnemy(raw, '[HEX-BREAKER]', 'STRIKE', {
          channel: 'OCCULT',
          targetId,
          rollCrit: false,
        }),
        log,
      );
    }
    setIsPlayerTurn(true);
    if (!skipRegenRef.current) {
      applyStamina(staminaRef.current + COMBAT_ACTION.STAMINA_REGEN);
    } else if (staminaRef.current === 0) {
      log('[EXHAUSTED] >> Stamina regen suppressed — reserves at 0.');
    } else {
      log('[OVEREXERTION] >> Stamina regen suppressed this turn.');
    }
    skipRegenRef.current = false;
    if (godModeRef.current) {
      applyGodModeResources();
    } else if (staminaRef.current <= 0) {
      applyStamina(15);
      log('[STAMINA REBOUND] >> Zero reserves at turn start — operative enters at 15 STAM.');
    }
    if (
      operativeClass === 'ENVOY'
      && veilFluxRef.current > fluxOverloadThreshold
      && !cataclysmReadyUi
      && !godModeRef.current
    ) {
      if (!envoyOverloadedRef.current) {
        envoyOverloadedRef.current = true;
        const masochistic = envoyBoonModsRef.current.masochisticChannel;
        envoySilencedRef.current = !masochistic;
        setEnvoyOverloaded(true);
        setEnvoySilenced(!masochistic);
        log(masochistic
          ? '>> [VEIL OVERLOAD] — masochistic channel open // SILENCE waived.'
          : '>> [VEIL OVERLOAD] — flux cascade // SILENCED until dump below threshold.');
        runEnvoyOverloadEntryBoons({
          boons: envoyBoons,
          encounter: classBoonEncounterRef.current,
          firstOverloadThisTurn: true,
          log,
          resetCooldowns: () => {
            graftCooldownsRef.current = {};
          },
          dealOccultAoE: (amount) => {
            for (const unit of aliveUnits(squadRef.current)) {
              if (!unit.unitId) continue;
              hurtEnemy(amount, '[EMERGENCY VENT]', 'STRIKE', {
                channel: 'OCCULT',
                targetId: unit.unitId,
                rollCrit: false,
              });
            }
          },
        });
      }
      const overloadDmg = envoyBoonModsRef.current.masochisticChannel
        ? 15
        : ENVOY_OVERLOAD_SELF_DAMAGE;
      hurtPlayer(
        overloadDmg,
        true,
        `>> [VEIL OVERLOAD] — ${overloadDmg} TRUE self-damage.`,
      );
    }
    tickHexShotClassState(classCombatRef.current);
    classCombatRef.current.entropyHexTurns = applyEntropyHexDot(
      squadRef.current,
      classCombatRef.current.entropyHexTurns,
      (raw, tag, options, targetId) => hurtEnemy(raw, tag, undefined, {
        channel: options?.channel ?? 'OCCULT',
        targetId: options?.targetId ?? targetId,
        rollCrit: options?.rollCrit,
        indirectDamage: true,
      }),
    );
    setCycleState('TEXT_COMBAT');
    log('>> OPERATIVE TURN // Command deck online.');
  };

  const resolvePendingAttackDamage = (e: EnemyCombatProfile) => {
    const dmg = e.isBoss && bossRuntimeRef.current
      ? bossStrikeDamage(bossRuntimeRef.current, bossPhaseRef.current)
      : attackDmg(e).dmg;
    let unblockable = e.intent === 'OVERDRIVE_DISCHARGE' ? false : attackDmg(e).unblockable;
    if (e.intent === 'OVERDRIVE_DISCHARGE') unblockable = false;
    return { dmg, unblockable };
  };

  const canOfferReactiveParry = () =>
    operativeClass === 'AEGIS'
    && !isExhausted
    && abyssalRef.current >= COMBAT_ACTION.COUNTER_ABYSSAL_MIN
    && staminaRef.current >= COMBAT_ACTION.COUNTER_STAMINA;

  const resolveEnemyAction = (countering: boolean) => {
    if (isCombatTerminal()) return;
    const currentEnemy = enemyRef.current;
    if (!currentEnemy || operativeHpRef.current <= 0) {
      setEnemyActionStage(null);
      return;
    }
    if (!isUnitAlive(currentEnemy)) {
      setEnemyActionStage(null);
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
      else if (!allUnitsDefeated(squadRef.current)) endEnemyTurn(true);
      return;
    }
    setEnemyActionStage(null);
    const enemyId = currentEnemy.unitId;
    if (enemyId) {
      classCombatRef.current.riftSnareUnits = detonateRiftSnareOnUnit(
        enemyId,
        currentEnemy.designation,
        classCombatRef.current.riftSnareUnits,
        (raw, tag, options, targetId) => hurtEnemy(raw, tag, 'STRIKE', {
          channel: options?.channel ?? 'KINETIC',
          targetId: options?.targetId ?? targetId,
          rollCrit: options?.rollCrit,
        }),
        log,
      );
    }
    if (
      operativeClass === 'HEX_SHOT'
      && classCombatRef.current.panopticonActive
      && enemyId
    ) {
      classCombatRef.current.panopticonActive = false;
      const overwatchMastery = isOverwatchMasteryActive(hexShotBoons);
      if (currentAmmoRef.current > 0 || overwatchMastery) {
        if (!overwatchMastery) {
          setMagazineAmmo(currentAmmoRef.current - 1);
        } else {
          log('[OVERWATCH MASTERY] >> Panopticon interrupt — 0 Ammo spent.');
        }
        patchUnit(enemyId, addCombatTag(currentEnemy, 'CONCUSSED'));
        const panopticonDmg = overwatchMastery ? 16 : 8;
        hurtEnemy(panopticonDmg, '[PANOPTICON]', 'STRIKE', {
          channel: 'KINETIC',
          targetId: enemyId,
          abilityId: 'PANOPTICON_PROTOCOL' as AegisAbilityId,
          rollCrit: false,
        });
        log('[PANOPTICON] >> Overwatch interrupt — hostile concussed, attack cancelled.');
        if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
        else if (!allUnitsDefeated(squadRef.current)) endEnemyTurn(true);
        return;
      }
      log('[PANOPTICON] >> Overwatch failed — magazine empty.');
    }
    if (countering && openParryWindow(currentEnemy, true)) return;
    if (!countering && operativeClass === 'ENVOY' && openEnvoyWardWindow(currentEnemy)) return;
    if (!countering && operativeClass === 'AEGIS' && openParryWindow(currentEnemy, false)) return;
    const hpStrikeResolved = commitPendingPlayerDamage(false, undefined, currentEnemy);
    if (hpStrikeResolved && currentEnemy.intent === 'VOID_AMBUSH') {
      finalizeNullShadeVoidAmbush(currentEnemy);
    } else if (!hpStrikeResolved) {
      execIntent(currentEnemy);
    }
    if (cycleRef.current === 'DEFEND_PARRY') return;
    if (cycleRef.current === 'DEFEND_WARD') return;
    if (operativeHpRef.current <= 0) return;
    if (enemyActionQueueRef.current.length > 0) {
      scheduleNextEnemyAction(countering);
      return;
    }
    if (!allUnitsDefeated(squadRef.current)) endEnemyTurn();
  };

  const runEnemyActionAnimation = (countering: boolean) => {
    const unitId = enemyActionQueueRef.current[0];
    const unit = unitId ? getUnitById(squadRef.current, unitId) : enemyRef.current;
    if (!unit) {
      enemyActionQueueRef.current.shift();
      if (enemyActionQueueRef.current.length > 0) runEnemyActionAnimation(countering);
      else endEnemyTurn(true);
      return;
    }
    focusedUnitIdRef.current = unit.unitId ?? null;
    focusEnemy(unit);
    if (unit.unitId) {
      applyEnemyApDrainAtTurnStart(
        unit.unitId,
        unit.designation,
        classCombatRef.current,
        reduceEnemyAp,
        log,
      );
      applyEnvoyHeavyGravityApDrain(
        unit.unitId,
        classBoonEncounterRef.current,
        reduceEnemyAp,
        unit.designation,
        log,
      );
      runAgonizingHexOnEnemyTurn(
        envoyBoons,
        unit,
        classCombatRef.current,
        classBoonEncounterRef.current,
        (raw, targetId) => hurtEnemy(raw, '[AGONIZING HEX]', 'STRIKE', {
          channel: 'TRUE',
          targetId,
          rollCrit: false,
        }),
        log,
      );
    }
    const turnStart = CombatLifecycleManager.runOnTurnStart(unit, buildLifecycleContext());
    turnStart.logLines.forEach((line) => log(line));
    applyLifecycleExtras(turnStart.extras);
    applyLifecyclePlayerDelta(turnStart.playerHpDelta);
    applyLifecycleStaminaDelta(turnStart.playerStaminaDelta);
    if (turnStart.squad.length > 0) syncSquad(turnStart.squad);
    if (turnStart.statusFloatLabel && turnStart.statusFloatUnitId) {
      statusFloatSeqRef.current[turnStart.statusFloatUnitId] =
        (statusFloatSeqRef.current[turnStart.statusFloatUnitId] ?? 0) + 1;
      lifecycleFloatLabelsRef.current[turnStart.statusFloatUnitId] = turnStart.statusFloatLabel;
      publishSquadUi(squadRef.current);
    }
    if (
      unit.rosterId === 'fracture-hound'
      && unit.intent === 'STRIKE'
      && unit.unitId
      && enemyActionQueueRef.current[0] === unit.unitId
    ) {
      const attacksPerTurn = getAlphaMechanic(unit, 'attacksPerTurn', 0);
      const queuedSame = enemyActionQueueRef.current.filter((id) => id === unit.unitId).length;
      if (attacksPerTurn >= 2 && unit.isAlpha && queuedSame === 1) {
        const extra = attacksPerTurn - 1;
        enemyActionQueueRef.current.splice(1, 0, ...Array(extra).fill(unit.unitId));
        log(`>> ${unit.designation} RABID FLURRY — ${attacksPerTurn} strikes queued.`);
      } else if (
        enemyActionQueueRef.current[1] !== unit.unitId
        && Math.random() < FRACTURE_HOUND_DOUBLE_STRIKE_CHANCE
      ) {
        enemyActionQueueRef.current.splice(1, 0, unit.unitId);
        log(`>> ${unit.designation} DOUBLE STRIKE — twin cleave queued.`);
      }
    }
    setIsPlayerTurn(false);
    setEnemyActionStage('reading');
    log(`>> HOSTILE TURN // ${unit.designation} — ${formatIntentReadout(unit.intent)}`);

    if (isNullShadeVoidAmbush(unit) && unit.unitId) {
      voidAmbushWindowRef.current = { unitId: unit.unitId, damageDealt: 0 };
      patchUnit(unit.unitId, { isUntargetable: false });
      selectedTargetIdRef.current = unit.unitId;
      setSelectedTargetId(unit.unitId);
      setIsPlayerTurn(true);
      log(`>> VOID AMBUSH TELEGRAPH — deal ${VOID_AMBUSH_INTERRUPT_THRESHOLD} damage to interrupt.`);
      publishSquadUi(squadRef.current);
    }

    enemyTurnTimerRef.current = setTimeout(() => {
      enemyTurnTimerRef.current = null;
      if (isCombatTerminal()) return;

      if (voidAmbushWindowRef.current?.unitId === unitId) {
        closeVoidAmbushWindow();
      }

      const acting = unitId ? getUnitById(squadRef.current, unitId) : null;
      if (!acting || !isUnitAlive(acting) || operativeHpRef.current <= 0) {
        enemyActionQueueRef.current.shift();
        setEnemyActionStage(null);
        if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
        else endEnemyTurn(true);
        return;
      }
      focusEnemy(acting);
      setEnemyActionStage('executing');

      const effectiveIntent = resolveEffectiveEnemyIntent(acting);
      const motionOptions = { arenaLayout: true, gridSlot: acting.gridSlot ?? null };
      const motionKind = classifyEnemyTurnMotion(effectiveIntent, motionOptions);
      const overlayVariant = getEnemyDeckStrikeVariant(effectiveIntent);
      const isBacklineMelee = acting.gridSlot?.startsWith('BL') === true
        && motionKind === 'melee';
      const isFrontlineMelee = acting.gridSlot?.startsWith('FL') === true
        && motionKind === 'melee'
        && !isBacklineMelee;
      const actingUnitId = acting.unitId ?? acting.designation;

      let animDurationMs = ENEMY_RANGED_ANIM_MS;

      if (motionKind === 'buff') {
        statusFloatSeqRef.current[actingUnitId] = (statusFloatSeqRef.current[actingUnitId] ?? 0) + 1;
        publishSquadUi(squadRef.current);
        animDurationMs = ENEMY_BUFF_ANIM_MS;
      } else {
        apparitionRef?.current?.triggerAttackEffect();

        if (isBacklineMelee && acting.unitId) {
          const dashUnitId = acting.unitId;
          backlineDashSeqRef.current[dashUnitId] = (backlineDashSeqRef.current[dashUnitId] ?? 0) + 1;
          backlineDashActiveRef.current[dashUnitId] = true;
          publishSquadUi(squadRef.current);
          animDurationMs = ENEMY_BACKLINE_MELEE_ANIM_MS;

          setTimeout(() => {
            if (isCombatTerminal()) return;
            if (overlayVariant) {
              showStrikeFeedback(overlayVariant);
              if (overlayVariant === 'hp') applyHpStrikeOnDeckImpact(acting);
            }
          }, BACKLINE_MELEE_DASH_IMPACT_MS);

          setTimeout(() => {
            backlineDashActiveRef.current[dashUnitId] = false;
            publishSquadUi(squadRef.current);
          }, BACKLINE_MELEE_DASH_TOTAL_MS);
        } else if (overlayVariant) {
          const applyStrike = () => {
            showStrikeFeedback(overlayVariant);
            if (overlayVariant === 'hp') applyHpStrikeOnDeckImpact(acting);
          };
          if (isFrontlineMelee) {
            animDurationMs = ENEMY_MELEE_ANIM_MS;
            setTimeout(() => {
              if (isCombatTerminal()) return;
              applyStrike();
            }, FRONTLINE_MELEE_IMPACT_MS);
          } else {
            animDurationMs = ENEMY_RANGED_ANIM_MS;
            applyStrike();
          }
        } else if (motionKind === 'melee') {
          animDurationMs = ENEMY_MELEE_ANIM_MS;
        }
      }

      enemyStrikeTimerRef.current = setTimeout(() => {
        enemyStrikeTimerRef.current = null;
        enemyActionQueueRef.current.shift();
        resolveEnemyAction(countering);
      }, animDurationMs);
    }, ENEMY_INTENT_READ_MS);
  };

  const resolveEnvoyWardSpeed = (enemy: EnemyCombatProfile): EnvoyWardExpansionSpeed => {
    const archetype = (enemy.spawnArchetype ?? 'MELEE') as EnemySpawnArchetype;
    if (archetype === 'HEAVY' || archetype === 'ARTILLERY') return 'slow';
    if (enemy.rosterId === 'scuttler' || enemy.rosterId === 'fracture-hound') return 'fast';
    return 'normal';
  };

  const openEnvoyWardWindow = (e: EnemyCombatProfile): boolean => {
    if (operativeClass !== 'ENVOY' || isExhausted) return false;
    const effectiveIntent = resolveEffectiveEnemyIntent(e);
    if (!isAttackIntent(effectiveIntent)) return false;
    const { dmg, unblockable } = resolvePendingAttackDamage(e);
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = unblockable;
    setEnvoyWardSpeed(resolveEnvoyWardSpeed(e));
    cycleRef.current = 'DEFEND_WARD';
    setCycleState('DEFEND_WARD');
    log('[VOID WARD] >> Hold to charge — release on ring overlap.');
    return true;
  };

  const finalizeEnvoyWard = (overlapRatio: number) => {
    const perfect = Math.abs(overlapRatio - 1.0) <= 0.05;
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
    if (perfect) {
      triggerHitstop(100);
      triggerHaptic('impactHeavy');
      applyVeilFlux(-30);
      preAppliedHpStrikeRef.current = 0;
      log('[VOID WARD] >> Perfect overlap — 100% negated, −30 flux.');
    } else {
      triggerShake('light');
      triggerHaptic('notificationError');
      applyVeilFlux(15);
      const mitigated = Math.max(1, Math.floor(pendingDmgRef.current * 0.5));
      hurtPlayer(
        mitigated,
        pendingUnblockRef.current,
        `[VOID WARD] >> Imperfect seal — ${mitigated} damage, +15 flux.`,
        { rollCrit: false },
      );
      log('[VOID WARD] >> Ward cracked — partial impact.');
    }
    if (operativeHpRef.current <= 0) return;
    if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(false);
    else if (!allUnitsDefeated(squadRef.current)) endEnemyTurn(true);
  };

  const openParryWindow = (e: EnemyCombatProfile, fromCounterStance: boolean): boolean => {
    const effectiveIntent = resolveEffectiveEnemyIntent(e);
    if (effectiveIntent === 'WORLD_ENDER') {
      if (fromCounterStance) {
        log('[COUNTER FAILED] >> World-Ender cannot be parried.');
        counterRef.current = false;
        setCounterPrepActive(false);
      }
      return false;
    }
    if (!isAttackIntent(effectiveIntent)) {
      if (fromCounterStance) {
        log('[COUNTER WASTED] >> No attack channel.');
        counterRef.current = false;
        setCounterPrepActive(false);
      }
      return false;
    }
    if (!fromCounterStance) {
      if (!canOfferReactiveParry()) return false;
      if (!spendStam(COMBAT_ACTION.COUNTER_STAMINA)) return false;
      log('[REACTIVE PARRY] >> Hostile attack incoming — counter window open.');
    }
    const { dmg, unblockable } = resolvePendingAttackDamage(e);
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = unblockable;
    cycleRef.current = 'DEFEND_PARRY';
    setCycleState('DEFEND_PARRY');
    startParryRing();
    return true;
  };

  const passToEnemy = (countering = false) => {
    if (isCombatTerminal()) return;
    resolvePlayerTurnEndDebuffsRef.current();
    tickCombatSessionExtras(sessionExtrasRef.current);
    setSelectedAbility(null);
    syncSquad(squadRef.current.map((unit) => {
      const remaining = unit.fortifyTurnsRemaining ?? 0;
      if (remaining <= 0) return unit;
      return { ...unit, fortifyTurnsRemaining: remaining - 1 };
    }));
    clearEnemyTurnTimers();
    counteringEnemyRef.current = countering;
    tickMutationHazardsOnEnemyPhase();

    if (squadHasFracturedUnits()) {
      syncSquad(recoverFracturedUnits(squadRef.current));
      log('>> FRACTURED HOSTILES — turn cycle forfeited. Armor layers rebuilding.');
      endEnemyTurn(true);
      return;
    }

    if (enemyStunPendingRef.current) {
      enemyStunPendingRef.current = false;
      log('>> HOSTILE STUNNED — Veil interference; turn forfeited.');
      endEnemyTurn(false);
      return;
    }

    const budget = threatBudgetRef.current;
    const picks = pickThreatBudgetActions(squadRef.current, budget);
    if (picks.length === 0) {
      endEnemyTurn(true);
      return;
    }
    enemyActionQueueRef.current = picks.map((pick) => pick.unitId);
    runEnemyActionAnimation(countering);
  };

  const squadHasFracturedUnits = () =>
    aliveUnits(squadRef.current).some((u) => isEnemyFractured(u));

  const initCombat = () => {
    let initialSquad = enemySquad?.length
      ? normalizeSquad(enemySquad)
      : enemyProfile
        ? squadFromSingleEnemy(initEnemyCombatLayers(enemyProfile))
        : spawnCombatSquad({ nodeIndex, district: combatDistrict });

    if (narrativeCombatBoons?.scouted) {
      initialSquad = initialSquad.map((unit) => ({
        ...unit,
        currentHp: Math.max(1, Math.floor(unit.currentHp * 0.9)),
      }));
    }

    threatBudgetRef.current = threatBudget
      ?? (initialSquad.length >= 3 ? THREAT_BUDGET_ELITE : THREAT_BUDGET_STANDARD);
    arenaLayoutModeRef.current = resolveArenaLayoutMode(initialSquad.length);
    syncSquad(initialSquad);
    if (equippedBlueprintId) {
      const startHooks = runOnCombatStartHooks(equippedBlueprintId, {
        blueprintId: equippedBlueprintId,
        player: {
          hp: initialOperativeHp,
          maxHp: maxSoulAnchor,
          shield: 0,
          shieldTurnsRemaining: 0,
          debuffs: [],
        },
        squad: initialSquad,
      }, sessionExtrasRef.current);
      startHooks.logLines.forEach((line) => log(line));
    }
    const defaultTarget = nextDefaultTarget(initialSquad);
    if (defaultTarget) selectTarget(defaultTarget);
    operativeHpRef.current = initialOperativeHp; staminaRef.current = initialStamina;
    const entryAr = Math.max(
      startingAbyssalReservePercent,
      mutationModsRef.current.startingAbyssalPercent,
    );
    abyssalRef.current = entryAr;
    skipRegenRef.current = false;
    abyssalWardRef.current = false;
    wardStrikeBonusRef.current = false;
    setStrikeArPrimed(false);
    counterRef.current = false;
    resolutionRef.current = null; dismissedRef.current = false;
    applyStamina(initialStamina);
    setAbyssalReserve(entryAr);
    setOperativeHp(initialOperativeHp);
    setAbyssalWardActive(false);
    setCounterPrepActive(false);
    wraithParryRef.current = false;
    riftWardReadyRef.current = operativeClass === 'ENVOY';
    combatBuffRef.current = {
      demonLungCooldown: 0,
      crimsonPactCharges: 0,
      bonusApThisTurn: 0,
      initiativeQueued: false,
    };
    setInitiativeQueued(false);
    setInitiativeProcSeq(0);
    setApRollupDisplay(null);
    shadowstepProcRef.current = false;
    setShadowstepProcActive(false);
    mutationModsRef.current = aggregateMutationModifiers(leyLineMutations);
    mutationEncounterRef.current = createDefaultBoonEncounterState();
    classBoonEncounterRef.current = createDefaultClassBoonEncounterState();
    lastPlayerAbilityRef.current = null;
    sessionExtrasRef.current = createDefaultCombatSessionExtras();
    kineticBatteryChargedRef.current = false;
    combatChanceRef.current = createDefaultCombatChanceState();
    setMagazineAmmo(maxAmmo);
    hexOverchargedRef.current = false;
    setHexOvercharged(false);
    applyVeilFlux(-veilFluxRef.current);
    envoyOverloadedRef.current = false;
    envoySilencedRef.current = false;
    setEnvoyOverloaded(false);
    setEnvoySilenced(false);
    setActiveReloadVisible(false);
    hexReloadUsedThisTurnRef.current = false;
    setHexReloadUsedThisTurn(false);
    setZeroProtocolVisible(false);
    zeroProtocolActiveRef.current = false;
    setCataclysmSigilVisible(false);
    setFractureBreakUnitId(null);
    setPerfectReloadCount(0);
    setSuccessfulParryCount(0);
    setCataclysmReadyUi(false);
    combatPausedRef.current = false;
    classCombatRef.current = createDefaultClassCombatEncounterState();
    if (narrativeCombatBoons?.veilWard) {
      sessionExtrasRef.current.playerShield = 15;
      sessionExtrasRef.current.narrativeVeilWardActive = true;
    }
    if (narrativeCombatBoons?.overcharged) {
      sessionExtrasRef.current.overchargedActive = true;
    }
    const preLockedSniper = initialSquad.find(
      (unit) => unit.rosterId === 'coil-spike-sniper'
        && unit.isAlpha
        && unit.isCharging
        && (unit.laserLockTurnsRemaining ?? 0) === 0,
    );
    if (preLockedSniper) {
      addStructuredDebuff(sessionExtrasRef.current, {
        type: 'LASER_SIGHT',
        turnsRemaining: getAlphaMechanic(preLockedSniper, 'lockOnTurns', 1),
      });
      log(`>> ${preLockedSniper.designation} EXECUTIONER LOCK — target pre-acquired.`);
    }
    const ghostedAp = narrativeCombatBoons?.ghosted ? 1 : 0;
    const entryAp = PLAYER_ACTION_POINTS_PER_TURN + Math.max(0, firstTurnBonusAp) + ghostedAp;
    playerApRef.current = entryAp;
    setPlayerActionPoints(entryAp);
    setSelectedAbility(null);
    setResolutionOutcome(null);
    setIsPlayerTurn(true);
    setCycleState('TEXT_COMBAT');
    setEnemyActionStage(null);
    preAppliedHpStrikeRef.current = 0;
    enemyStunPendingRef.current = false;
    log('>> COMBAT LINK ESTABLISHED');
    if (narrativeCombatBoons?.scouted) {
      log('>> SCOUTED BOON — hostile grid entered at −10% current HP.');
    }
    if (narrativeCombatBoons?.veilWard) {
      log('>> VEIL WARD BOON — +15 shield capacity active for this encounter.');
    }
    if (narrativeCombatBoons?.overcharged) {
      log('>> OVERCHARGED BOON — first damaging strike ignores all mitigation.');
    }
    if (firstTurnBonusAp > 0) {
      log(`>> ADRENALINE PRIMER — FIRST-TURN +${firstTurnBonusAp} AP.`);
    }
    if (ghostedAp > 0) {
      log('>> GHOSTED BOON — +1 AP on operative first turn.');
    }
    log('>> OPERATIVE TURN // Command deck online.');
    log(`>> WEAPON LINK: ${strikeStats.label} // STRIKE ${strikeStats.strikeDamage} DMG / ${strikeStats.strikeStaminaCost} STAM`);
    if (env.isPlayerBlinded) log('>> ENV: OPERATIVE BLINDED — Counter Stance window tightened 15%.');
    if (env.hasTetanusGlitch) log('>> ENV: TETANUS GLITCH ACTIVE — exhaustion triggers 3 HP bleed.');
    if (env.startingStaminaPenalty > 0) log(`>> ENV: STAMINA PENALTY — entry ceiling reduced to 50.`);
    if (env.isEnemyPhaseShrouded) log('>> ENV: ENEMY PHASE SHROUDED — 20% miss chance on strikes.');
    if (env.bloodFrenzyActive) log('>> BLOOD FRENZY ACTIVE — melee damage leeches 15% to soul anchor.');
    if (env.combatObjective === 'SURVIVE_TURNS') {
      log(`>> DEFEND THE RIFT — survive ${env.survivalTurnsRequired ?? 3} hostile turn cycles.`);
    }
    if (env.eliteModifier) log(`>> ELITE MODIFIER ACTIVE — ${env.eliteModifier.replace(/_/g, ' ')}`);
    log(`>> HOSTILE GRID — ${initialSquad.length} unit(s) // threat budget ${threatBudgetRef.current}`);
    initialSquad.forEach((unit) => {
      log(`>> LOCK ${unit.gridSlot}: ${unit.designation} // CLASS ${unit.class}`);
    });
    if (entryAr > 0 && operativeClass === 'AEGIS') {
      log(`>> Abyssal reserve pre-charged to ${entryAr}%.`);
    }
    if (operativeClass === 'HEX_SHOT') {
      log(`>> MAGAZINE LOADED — ${maxAmmo}/${maxAmmo} rounds chambered.`);
      if (hexShotBoonMods.autoLoaderOnStart) {
        hexOverchargedRef.current = true;
        setHexOvercharged(true);
        log('>> [AUTO-LOADER DECK] — full magazine, OVERCHARGED primed.');
      }
    }
    if (operativeClass === 'ENVOY') {
      log(`>> VEIL-FLUX CHANNEL ONLINE — overload threshold ${fluxOverloadThreshold}%.`);
      if (envoyBoonMods.startingFlux > 0) {
        applyVeilFlux(envoyBoonMods.startingFlux);
        log(`>> [DEEP RESERVES] — entry flux ${envoyBoonMods.startingFlux}%.`);
      }
      applyVoidsBargainStartBleed(
        envoyBoons,
        (amount) => {
          setOperativeHp((p) => {
            const n = Math.max(1, p - amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        log,
      );
    }
    if (operativeClass === 'HEX_SHOT' && hexShotBoons.length > 0) {
      log(`>> HEX-SHOT BOONS ACTIVE — ${hexShotBoons.length} stacked.`);
    }
    if (operativeClass === 'ENVOY' && envoyBoons.length > 0) {
      log(`>> ENVOY BOONS ACTIVE — ${envoyBoons.length} stacked.`);
    }
    if (leyLineMutations.length > 0) {
      log(`>> LEY-LINE MUTATIONS ACTIVE — ${leyLineMutations.length} stacked.`);
    }
    bossRuntimeRef.current = bossProfile;
    bossPhaseRef.current = bossProfile?.currentPhase ?? 1;
    if (godModeActive) {
      godModeRef.current = true;
      applyGodModeResources();
      log('>> GOD MODE ACTIVE — operative resources locked at maximum.');
    }
  };
  useEffect(() => { initCombat(); }, []);

  const applyLethalRetaliation = (dmg: number) => {
    if (godModeRef.current) return;
    if ((env.lethalRetaliationDamage ?? 0) <= 0 || dmg <= 0) return;
    const feedback = env.lethalRetaliationDamage ?? 0;
    log(`[LETHAL RETALIATION] >> Hostile feedback — ${feedback} HP.`);
    if (feedback > 0) {
      playerViewportRef?.current?.triggerDamageEffect('hp');
    }
    setOperativeHp((p) => {
      const n = Math.max(p - feedback, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
  };

  const applyAbilityResolvedBoons = (abilityId: AegisAbilityId) => {
    lastPlayerAbilityRef.current = abilityId;
    const prevTags = mutationEncounterRef.current.lastActionTags;
    const tags = getAbilityTags(abilityId);
    if (hasMutation(leyLineMutations, 'VOID_RESONANCE')) {
      if (tags.includes('OCCULT') && prevTags.includes('KINETIC')) {
        mutationEncounterRef.current.voidResonanceOccultBonus = true;
        log('[VOID RESONANCE] >> Occult follow-up primed (+15%).');
      } else if (tags.includes('KINETIC') && prevTags.includes('OCCULT')) {
        mutationEncounterRef.current.voidResonanceOccultBonus = true;
        log('[VOID RESONANCE] >> Kinetic follow-up primed (+15%).');
      }
    }
    mutationEncounterRef.current.lastActionTags = tags;
    if (boonMatchesAction(leyLineMutations, 'MOMENTUM_TRANSFER', abilityId)) {
      mutationEncounterRef.current.nextKineticApDiscount = 1;
      log('[MOMENTUM TRANSFER] >> Next [KINETIC] action −1 AP.');
    }
  };

  const buildHexHurtEnemy = () => (
    raw: number,
    tag: string,
    options?: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      fractureGain?: number;
      targetId?: string;
      abilityId?: HexShotAbilityId;
      rollCrit?: boolean;
      forceCrit?: boolean;
    },
    targetId?: string,
  ): boolean => {
    const tid = options?.targetId ?? targetId ?? selectedTargetIdRef.current ?? undefined;
    let rollCrit = options?.rollCrit;
    if (options?.forceCrit) rollCrit = true;
    const astralLock = resolveAstralLockCrit(
      tid,
      options?.abilityId,
      options?.abilityId != null && getHexShotAbilityTags(options.abilityId).includes('BALLISTIC'),
      classCombatRef.current,
    );
    if (astralLock.forceCrit) {
      rollCrit = true;
      if (astralLock.consumeLock) {
        classCombatRef.current.astralLockUnitId = null;
        log('[ASTRAL TARGET-LOCK] >> Guaranteed ballistic critical.');
      }
    }
    const plan = activeClassGraftPlanRef.current;
    const scaleCtx = {
      currentAmmo: currentAmmoRef.current,
      maxAmmo,
      veilFlux: veilFluxRef.current,
    };
    const scaled = plan ? scaleClassGraftDamage(raw, plan, scaleCtx) : raw;
    let channel = options?.channel ?? 'KINETIC';
    if (plan?.forceTrueDamage) channel = 'TRUE';
    if (plan?.guaranteedCrit) rollCrit = true;

    const pickTarget = (preferred?: string) => {
      if (plan?.randomTarget) {
        const pool = aliveUnits(squadRef.current);
        return pool[Math.floor(Math.random() * pool.length)]?.unitId ?? preferred;
      }
      return preferred;
    };

    let killed = false;
    const hits = plan?.hitCount ?? 1;
    const strikeTargets = resolveClassGraftStrikeTargetIds(plan, squadRef.current, tid);
    const targetLoop = strikeTargets.length > 0 ? strikeTargets : [pickTarget(tid)].filter(Boolean) as string[];
    for (const strikeTarget of targetLoop) {
      for (let hit = 0; hit < hits; hit += 1) {
        killed = hurtEnemy(scaled, tag, 'STRIKE', {
          channel,
          fractureGain: options?.fractureGain,
          targetId: strikeTarget,
          abilityId: options?.abilityId as AegisAbilityId,
          rollCrit,
        }) || killed;
      }
    }
    if (plan && plan.duplicateCastRatio > 0) {
      const echoTarget = pickTarget(tid);
      if (echoTarget) {
        hurtEnemy(
          Math.floor(scaled * plan.duplicateCastRatio),
          tag,
          'STRIKE',
          {
            channel,
            targetId: echoTarget,
            abilityId: options?.abilityId as AegisAbilityId,
            rollCrit: false,
            echoHit: true,
          },
        );
      }
    }
    return killed;
  };

  const buildEnvoyHurtEnemy = () => (
    raw: number,
    tag: string,
    options?: {
      channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
      fractureGain?: number;
      targetId?: string;
      abilityId?: EnvoyAbilityId;
      rollCrit?: boolean;
    },
    targetId?: string,
  ): boolean => {
    const tid = options?.targetId ?? targetId ?? selectedTargetIdRef.current ?? undefined;
    const plan = activeClassGraftPlanRef.current;
    const scaleCtx = {
      currentAmmo: currentAmmoRef.current,
      maxAmmo,
      veilFlux: veilFluxRef.current,
    };
    const scaled = plan ? scaleClassGraftDamage(raw, plan, scaleCtx) : raw;
    let strikeRaw = scaled;
    if (options?.abilityId === 'CATACLYSM_SIGIL') {
      strikeRaw += getCataclysmicEchoDamageBonus(classBoonEncounterRef.current);
    }
    let channel = options?.channel ?? 'OCCULT';
    if (plan?.forceTrueDamage) channel = 'TRUE';
    let rollCrit = options?.rollCrit;
    if (plan?.guaranteedCrit) rollCrit = true;

    const pickTarget = (preferred?: string) => {
      if (plan?.randomTarget) {
        const pool = aliveUnits(squadRef.current);
        return pool[Math.floor(Math.random() * pool.length)]?.unitId ?? preferred;
      }
      return preferred;
    };

    let killed = false;
    const hits = plan?.hitCount ?? 1;
    const strikeTargets = resolveClassGraftStrikeTargetIds(plan, squadRef.current, tid);
    const targetLoop = strikeTargets.length > 0 ? strikeTargets : [pickTarget(tid)].filter(Boolean) as string[];
    for (const strikeTarget of targetLoop) {
      for (let hit = 0; hit < hits; hit += 1) {
        killed = hurtEnemy(strikeRaw, tag, 'STRIKE', {
          channel,
          fractureGain: options?.fractureGain,
          targetId: strikeTarget,
          abilityId: options?.abilityId as AegisAbilityId,
          rollCrit,
        }) || killed;
      }
    }
    if (plan && plan.duplicateCastRatio > 0) {
      const echoTarget = pickTarget(tid);
      if (echoTarget) {
        hurtEnemy(
          Math.floor(strikeRaw * plan.duplicateCastRatio),
          tag,
          'STRIKE',
          {
            channel,
            targetId: echoTarget,
            abilityId: options?.abilityId as AegisAbilityId,
            rollCrit: false,
            echoHit: true,
          },
        );
      }
    }
    return killed;
  };

  const applyPlayerGraftDebuff = (debuff: ReturnType<typeof resolveClassGraftFailDebuff>) => {
    if (debuff.playerConcussed) {
      log('>> GRAFT BACKLASH — operative CONCUSSED.');
    }
    if (debuff.playerExposed) {
      log('>> GRAFT BACKLASH — operative EXPOSED.');
    }
  };

  const applyClassGraftCastSetup = (
    graftPlan: ClassGraftCastPlan,
    targetId?: string | null,
  ): boolean => {
    if (graftPlan.extraStaminaCost > 0 && !spendStam(graftPlan.extraStaminaCost)) {
      log('[REJECTED] >> Insufficient stamina for graft tax.');
      return false;
    }
    if (graftPlan.hpCostPct > 0) {
      const hpCost = Math.ceil(maxSoulAnchor * (graftPlan.hpCostPct / 100));
      if (operativeHpRef.current <= hpCost) {
        log('[REJECTED] >> Insufficient soul anchor for graft HP cost.');
        return false;
      }
      setOperativeHp((p) => {
        const n = Math.max(p - hpCost, 0);
        operativeHpRef.current = n;
        return n;
      });
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${hpCost} HP tithe on cast.`);
    }
    if (graftPlan.evadeBuffPct > 0) {
      combatChanceRef.current.shadowStepEvadeActive = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — +${graftPlan.evadeBuffPct}% evade until next turn.`);
    }
    if (graftPlan.selfDebuff) {
      log(`>> [${graftPlan.graftName.toUpperCase()}] — operative afflicted (${graftPlan.selfDebuff}).`);
    }
    if (graftPlan.dealSelfDamage > 0) {
      hurtPlayer(
        graftPlan.dealSelfDamage,
        true,
        `>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.dealSelfDamage} self-damage.`,
      );
    }
    const sideEffects = collectClassGraftCastSideEffects(graftPlan, targetId);
    if (sideEffects.grantGhostCamoTurns) {
      classCombatRef.current.ghostCamoTurnsRemaining = Math.max(
        classCombatRef.current.ghostCamoTurnsRemaining,
        sideEffects.grantGhostCamoTurns,
      );
      log(`>> [${graftPlan.graftName.toUpperCase()}] — operative untargetable ${sideEffects.grantGhostCamoTurns} turn(s).`);
    }
    if (sideEffects.playerBleedDamage) {
      hurtPlayer(
        sideEffects.playerBleedDamage,
        true,
        `>> [${graftPlan.graftName.toUpperCase()}] — ${sideEffects.playerBleedDamage} bleed tithe.`,
      );
    }
    for (const { unitId, patch } of sideEffects.targetPatches) {
      const unit = getUnitById(squadRef.current, unitId);
      if (!unit) continue;
      patchUnit(unitId, applyClassGraftTargetPatch(unit, patch));
    }
    applyClassGraftEnemyApDrains(classCombatRef.current, sideEffects.enemyApDrainNextTurn);
    for (const drain of sideEffects.enemyApDrainNextTurn) {
      log(`>> [${graftPlan.graftName.toUpperCase()}] >> Target AP drain primed (−${drain.amount}).`);
    }
    return true;
  };

  const applyClassGraftLootDrop = (kind: string) => {
    onGraftLootDrop?.(kind);
  };

  const finalizeHexShotAbilityResult = (
    result: import('../data/hexShotAbilityExecutor').HexShotExecutionResult,
    graftPlan: ClassGraftCastPlan,
    squadBefore: Array<{ id: string | undefined; hp: number }>,
    abilityId: HexShotAbilityId,
  ) => {
    if (!result.ok) {
      playerApRef.current += result.refundAp;
      setPlayerActionPoints(playerApRef.current);
      if (result.refundAmmo) setMagazineAmmo(currentAmmoRef.current + result.refundAmmo);
    } else {
      finalizeClassGraftAfterAbility(
        graftPlan,
        squadBefore,
        squadRef.current,
        log,
        {
          applyFailDebuff: (debuff) => applyPlayerGraftDebuff(resolveClassGraftFailDebuff(debuff)),
          refundAmmo: () => setMagazineAmmo(Math.min(maxAmmo, currentAmmoRef.current + 1)),
          refundAp: () => {
            playerApRef.current += 1;
            setPlayerActionPoints(playerApRef.current);
          },
          dropLoot: applyClassGraftLootDrop,
        },
      );
    }
    if (result.ok) {
      runHexShotOnAbilityResolveBoons({
        boons: hexShotBoons,
        abilityId,
        ok: true,
        squad: squadRef.current,
        encounter: classBoonEncounterRef.current,
        maxStamina,
        currentAmmo: currentAmmoRef.current,
        log,
        restoreStamina: (amount) => applyStamina(staminaRef.current + amount),
        patchUnit,
        grantGuerillaEvade: () => {
          combatChanceRef.current.shadowStepEvadeActive = true;
        },
        dealHotSwapOccult: (amount) => {
          const pool = aliveUnits(squadRef.current);
          const target = pool[Math.floor(Math.random() * pool.length)];
          if (target?.unitId) {
            hurtEnemy(amount, '[HOT-SWAP]', 'STRIKE', {
              channel: 'OCCULT',
              targetId: target.unitId,
              abilityId: abilityId as AegisAbilityId,
              rollCrit: false,
            });
          }
        },
      });
    }
    activeClassGraftPlanRef.current = null;
    publishSquadUi(squadRef.current);
  };

  const executeHexShotClassAbility = (abilityId: HexShotAbilityId) => {
    if (abilityId === 'ZERO_PROTOCOL') {
      log('[REJECTED] >> Zero-Protocol procs from perfect reload mastery — use the ping.');
      return;
    }
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    const graftId = hexShotAbilityGraftsRef.current[abilityId];
    const graftPlan = buildClassGraftCastPlan('HEX_SHOT', abilityId, graftId);
    activeClassGraftPlanRef.current = graftPlan;
    const cost = resolveClassAbilityCost('HEX_SHOT', abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false);
    if (ultimateSealed && cost.isUltimate) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    const effectiveAp = applyHexShotTacticalReloadDiscount(
      hexShotBoons,
      abilityId,
      graftPlan.apCost,
      classBoonEncounterRef.current,
      log,
    );
    if (!spendActionPoints(effectiveAp)) {
      log('[REJECTED] >> Insufficient action points.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    activeClassGraftApCostRef.current = effectiveAp;
    if (!applyClassGraftCastSetup(graftPlan, selectedTargetIdRef.current)) {
      playerApRef.current += effectiveAp;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    const squadBefore = squadRef.current.map((unit) => ({ id: unit.unitId, hp: unit.currentHp }));
    lastPlayerAbilityRef.current = abilityId;
    const ammoOverride = effectiveGraftAmmoCost(graftPlan, currentAmmoRef.current);

    const runExecutor = (ultimatePerformance?: number) => {
      const execResult = executeHexShotAbility({
        abilityId,
        squad: squadRef.current,
        targetId: selectedTargetIdRef.current,
        strikeStats,
        currentAmmo: currentAmmoRef.current,
        maxAmmo,
        maxSoulAnchor,
        classState: classCombatRef.current,
        log,
        apCostOverride: graftPlan.apCost,
        ammoCostOverride: ammoOverride,
        ultimatePerformance,
        spendAmmo: (amount: number) => {
          if (
            amount > 0
            && hasHexShotBoon(hexShotBoons, 'VOID_BANDOLEER')
            && getHexShotAbilityTags(abilityId).includes('VOID_AMMO')
          ) {
            const hpCost = Math.max(
              1,
              Math.floor(maxSoulAnchor * (hexShotBoonModsRef.current.voidAmmoHpCostPct / 100)),
            );
            setOperativeHp((p) => {
              const n = Math.max(1, p - hpCost);
              operativeHpRef.current = n;
              return n;
            });
            log('[VOID-BANDOLEER] >> Void shot fueled by soul anchor — 0 Ammo spent.');
            return true;
          }
          return spendAmmo(amount);
        },
        spendStamina: spendStam,
        spendStaminaPct: (pct) => {
          let effectivePct = pct;
          if (
            hasHexShotBoon(hexShotBoons, 'RECOIL_HARNESS')
            && getHexShotAbilityTags(abilityId).includes('BALLISTIC')
          ) {
            effectivePct = pct * (1 - hexShotBoonModsRef.current.ballisticStaminaDiscountPct / 100);
          }
          const costStam = Math.floor(staminaRef.current * (effectivePct / 100));
          return costStam > 0 && spendStam(costStam);
        },
        hurtEnemy: buildHexHurtEnemy(),
        patchUnit,
        syncSquad,
        healOperative: (amount) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        setShadowStepEvadeActive: (active) => {
          combatChanceRef.current.shadowStepEvadeActive = active;
        },
        reduceEnemyAp,
        emptyMagazine,
      });
      finalizeHexShotAbilityResult(execResult, graftPlan, squadBefore, abilityId);
    };

    runExecutor();
  };

  const executeEnvoyClassAbility = (abilityId: EnvoyAbilityId) => {
    if (abilityId === 'CATACLYSM_SIGIL') {
      log('[REJECTED] >> Cataclysm Sigil procs at Flux 100 — use the mastery ping.');
      return;
    }
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand()) return;
    const graftId = envoyAbilityGraftsRef.current[abilityId];
    const graftPlan = buildClassGraftCastPlan('ENVOY', abilityId, graftId);
    activeClassGraftPlanRef.current = graftPlan;
    const cost = resolveClassAbilityCost('ENVOY', abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false);
    if (ultimateSealed && cost.isUltimate) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    if (envoySilencedRef.current && cost.isFluxGen && !graftPlan.effectiveTags.includes('FLUX_DUMP')) {
      log('[REJECTED] >> SILENCED — flux generation blocked until dump below threshold.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    let effectiveAp = applyEnvoyWardWeaverApDiscount(
      envoyBoons,
      abilityId,
      graftPlan.apCost,
      classBoonEncounterRef.current,
      log,
    );
    const bloodMagic = tryEnvoyBloodMagicCast(
      envoyBoons,
      effectiveAp,
      playerApRef.current,
      maxSoulAnchor,
      operativeHpRef.current,
      log,
    );
    let apSpent = effectiveAp;
    if (bloodMagic) {
      apSpent = 0;
      setOperativeHp((p) => {
        const n = Math.max(1, p - bloodMagic.hpCost);
        operativeHpRef.current = n;
        return n;
      });
    } else if (!spendActionPoints(effectiveAp)) {
      log('[REJECTED] >> Insufficient action points.');
      activeClassGraftPlanRef.current = null;
      return;
    }
    activeClassGraftApCostRef.current = apSpent;
    if (!applyClassGraftCastSetup(graftPlan, selectedTargetIdRef.current)) {
      playerApRef.current += apSpent;
      setPlayerActionPoints(playerApRef.current);
      activeClassGraftPlanRef.current = null;
      return;
    }
    const squadBefore = squadRef.current.map((unit) => ({ id: unit.unitId, hp: unit.currentHp }));
    lastPlayerAbilityRef.current = abilityId;

    const runExecutor = (ultimatePerformance?: number) => {
      const execResult = executeEnvoyAbility({
        abilityId,
        squad: squadRef.current,
        targetId: selectedTargetIdRef.current,
        veilFlux: veilFluxRef.current,
        maxSoulAnchor,
        classState: classCombatRef.current,
        log,
        apCostOverride: graftPlan.apCost,
        fluxGenOverride: graftPlan.fluxGen,
        fluxCostOverride: graftPlan.fluxCost,
        ultimatePerformance,
        spendStamina: spendStam,
        applyFluxDelta: (delta) => applyVeilFlux(delta),
        hurtEnemy: buildEnvoyHurtEnemy(),
        patchUnit,
        syncSquad,
        healOperative: (amount) => {
          setOperativeHp((p) => {
            const n = Math.min(maxSoulAnchor, p + amount);
            operativeHpRef.current = n;
            return n;
          });
        },
        setShadowStepEvadeActive: (active) => {
          combatChanceRef.current.shadowStepEvadeActive = active;
        },
        reduceEnemyAp,
        cancelEnemyPreparedAttack: (unitId) => {
          if (enemyRef.current?.unitId === unitId && enemyActionStageRef.current === 'reading') {
            setEnemyActionStage(null);
            log('[MIND-SUNDER] >> Prepared attack cancelled.');
          }
        },
      });
      if (!execResult.ok) {
        playerApRef.current += execResult.refundAp;
        setPlayerActionPoints(playerApRef.current);
      } else {
        let fluxDelta = execResult.fluxDelta ?? 0;
        fluxDelta = runEnvoyOnAbilityResolveBoons({
          boons: envoyBoons,
          abilityId,
          ok: true,
          squad: squadRef.current,
          targetId: selectedTargetIdRef.current,
          classState: classCombatRef.current,
          encounter: classBoonEncounterRef.current,
          fluxDelta,
          log,
          patchUnit,
          applyOccultShield: (amount) => {
            sessionExtrasRef.current.playerShield = (sessionExtrasRef.current.playerShield ?? 0) + amount;
          },
          healOperative: (amount) => {
            setOperativeHp((p) => {
              const n = Math.min(maxSoulAnchor, p + amount);
              operativeHpRef.current = n;
              return n;
            });
          },
          echoSpellDamage: (amount, targetId) => {
            hurtEnemy(amount, '[ECHOING AETHER]', 'STRIKE', {
              channel: 'OCCULT',
              targetId,
              abilityId: abilityId as AegisAbilityId,
              rollCrit: false,
              echoHit: true,
            });
          },
          stripAllKineticArmor: () => {
            for (const unit of aliveUnits(squadRef.current)) {
              if (!unit.unitId) continue;
              patchUnit(unit.unitId, { kineticArmor: 0, baseKineticArmor: 0 });
            }
          },
        });
        if (fluxDelta !== 0) applyVeilFlux(fluxDelta);
        finalizeClassGraftAfterAbility(
          graftPlan,
          squadBefore,
          squadRef.current,
          log,
          {
            applyFailDebuff: (debuff) => applyPlayerGraftDebuff(resolveClassGraftFailDebuff(debuff)),
            refundAp: () => {
              playerApRef.current += 1;
              setPlayerActionPoints(playerApRef.current);
            },
            dropLoot: applyClassGraftLootDrop,
          },
        );
      }
      activeClassGraftPlanRef.current = null;
      publishSquadUi(squadRef.current);
    };

    runExecutor();
  };

  const executeOperativeAbility = (abilityId: string) => {
    if (operativeClass === 'HEX_SHOT') {
      executeHexShotClassAbility(abilityId as HexShotAbilityId);
      return;
    }
    if (operativeClass === 'ENVOY') {
      executeEnvoyClassAbility(abilityId as EnvoyAbilityId);
      return;
    }
    executeAbility(abilityId as AegisAbilityId);
  };

  const executeAbility = (abilityId: AegisAbilityId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand() || !enemyRef.current) return;
    if (
      encounterUltimateDisabled
      && getAbilityTags(abilityId).includes('ULTIMATE')
    ) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      return;
    }
    if (
      hasStructuredDebuff(sessionExtrasRef.current, 'ASHEN_ROT')
      && isBuffOrDefendAbility(abilityId)
    ) {
      const rotCost = 50;
      applyStamina(Math.max(0, staminaRef.current - rotCost));
      log(`>> ROT TRIGGERED! −${rotCost} Stamina`);
    }
    const def = getAbilityDefinition(abilityId);
    const graftId = abilityGraftsRef.current[abilityId];
    const graftPlan = buildGraftCastPlan(abilityId, graftId);
    activeGraftPlanRef.current = graftPlan;
    activeGraftApCostRef.current = graftPlan.apCost;

    const graftCooldown = graftCooldownsRef.current[abilityId] ?? 0;
    if (graftCooldown > 0) {
      log(`[REJECTED] >> Graft cooldown active (${graftCooldown} turn${graftCooldown === 1 ? '' : 's'}).`);
      activeGraftPlanRef.current = null;
      return;
    }

    let apCost = graftPlan.apCost;
    if (
      mutationEncounterRef.current.nextKineticApDiscount > 0
      && graftPlan.effectiveTags.includes('KINETIC')
    ) {
      apCost = Math.max(0, apCost - mutationEncounterRef.current.nextKineticApDiscount);
      mutationEncounterRef.current.nextKineticApDiscount = 0;
    }
    if (!spendActionPoints(apCost)) {
      log('[REJECTED] >> Insufficient action points.');
      activeGraftPlanRef.current = null;
      return;
    }

    if (graftPlan.hpCostPct > (def.hpCostPct ?? 0)) {
      const extraHpPct = graftPlan.hpCostPct - (def.hpCostPct ?? 0);
      const hpCost = Math.ceil(maxSoulAnchor * (extraHpPct / 100));
      if (operativeHpRef.current <= hpCost) {
        log('[REJECTED] >> Insufficient soul anchor for graft HP cost.');
        playerApRef.current += apCost;
        setPlayerActionPoints(playerApRef.current);
        activeGraftPlanRef.current = null;
        return;
      }
      setOperativeHp((p) => {
        const n = Math.max(p - hpCost, 0);
        operativeHpRef.current = n;
        if (n <= 0) resolve(false);
        return n;
      });
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${hpCost} HP tithe on cast.`);
    }

    activeGraftStaminaSpentRef.current = 0;
    if (graftPlan.consumeAllStamina) {
      activeGraftStaminaSpentRef.current = staminaRef.current;
      applyStamina(0);
      log(`>> [${graftPlan.graftName.toUpperCase()}] — all stamina consumed (${activeGraftStaminaSpentRef.current}).`);
    } else if (graftPlan.extraStaminaCost > 0 && !spendStam(graftPlan.extraStaminaCost)) {
      log('[REJECTED] >> Insufficient stamina for graft tax.');
      playerApRef.current += apCost;
      setPlayerActionPoints(playerApRef.current);
      activeGraftPlanRef.current = null;
      return;
    }

    if (graftPlan.grantShieldHits > 0) {
      mutationEncounterRef.current.juggernautShield = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — ${graftPlan.grantShieldHits}-hit graft shield online.`);
    }
    if (graftPlan.evadeBuffPct > 0) {
      combatChanceRef.current.shadowStepEvadeActive = true;
      log(`>> [${graftPlan.graftName.toUpperCase()}] — +${graftPlan.evadeBuffPct}% evade until next turn.`);
    }
    if (graftPlan.cooldownTurns > 0) {
      graftCooldownsRef.current[abilityId] = graftPlan.cooldownTurns;
    }

    const squadBeforeAbility = squadRef.current.map((unit) => ({ ...unit, currentHp: unit.currentHp }));
    applyAbilityResolvedBoons(abilityId);

    switch (abilityId) {
      case 'STRIKE': {
        if (godModeRef.current) {
          const kinetic = GOD_MODE_STRIKE_DAMAGE;
          const eradicated = hurtEnemy(kinetic, '[STRIKE]', 'STRIKE', {
            channel: 'KINETIC',
            fractureGain: 25,
            abilityId: 'STRIKE',
          });
          const struck = enemyRef.current;
          chargeAr(15, struck != null && isEnemyFractured(struck));
          if (struck && fractureRatio(struck) > 0.5) {
            syncEnemy(addCombatTag(struck, 'CONCUSSED'));
          }
          applyLethalRetaliation(kinetic);
          applyGodModeResources();
          if (eradicated) return;
          break;
        }
        let strikeStaminaCost = strikeStats.strikeStaminaCost;
        const strikeTarget = enemyRef.current;
        const smogCaller = smogCallerActive();
        if (smogCaller && strikeTarget?.gridSlot?.startsWith('FL')) {
          const meleeMult = getAlphaMechanic(smogCaller, 'meleeStaminaMultiplier', 2);
          strikeStaminaCost *= meleeMult;
          log(`>> SMOG CALLER — choking hazard ×${meleeMult} melee stamina cost.`);
        }
        const overdraw = staminaRef.current < strikeStaminaCost;
        if (overdraw) {
          markExhausted();
          log(`[EXHAUSTED] >> Overexertion strike — ${strikeStats.exhaustedStrikeDamage} damage.`);
        } else if (!spendStam(strikeStaminaCost)) {
          log('[REJECTED] >> Insufficient stamina.');
          playerApRef.current += def.apCost;
          setPlayerActionPoints(playerApRef.current);
          return;
        }
        const exhausted = overdraw || staminaRef.current === 0;
        const kinetic = exhausted ? strikeStats.exhaustedStrikeDamage : strikeStats.strikeDamage;
        const eradicated = hurtEnemy(kinetic, '[STRIKE]', 'STRIKE', {
          channel: 'KINETIC',
          fractureGain: 25,
          abilityId: 'STRIKE',
        });
        const struck = enemyRef.current;
        chargeAr(15, struck != null && isEnemyFractured(struck));
        if (struck && fractureRatio(struck) > 0.5) {
          syncEnemy(addCombatTag(struck, 'CONCUSSED'));
        }
        applyLethalRetaliation(kinetic);
        if (eradicated) return;
        break;
      }
      case 'VEIL_PIERCER': {
        if (!spendStam(def.staminaCost)) {
          log('[REJECTED] >> Insufficient stamina.');
          playerApRef.current += def.apCost;
          setPlayerActionPoints(playerApRef.current);
          return;
        }
        const occult = Math.max(8, Math.floor(strikeStats.strikeDamage * 0.85));
        chargeAr(20);
        const eradicated = hurtEnemy(occult, '[VEIL-PIERCER]', 'STRIKE', {
          channel: 'OCCULT',
          fractureGain: 15,
          abilityId: 'VEIL_PIERCER',
        });
        if (eradicated) return;
        break;
      }
      case 'WRAITH_PARRY': {
        const stamCost = Math.floor(staminaRef.current * ((def.staminaCostPct ?? 0) / 100));
        if (stamCost <= 0 || !spendStam(stamCost)) {
          log('[REJECTED] >> Insufficient stamina for Wraith Parry.');
          playerApRef.current += def.apCost;
          setPlayerActionPoints(playerApRef.current);
          return;
        }
        wraithParryRef.current = true;
        counterRef.current = true;
        setCounterPrepActive(true);
        markPlayerDefendedRef.current();
        log('[WRAITH PARRY] >> Stance armed — next physical hit reflects 100% as fracture.');
        break;
      }
      case 'ASHEN_MANTLE': {
        const freeWard = mutationModsRef.current.ashenMantleFree;
        if (!freeWard && mutationEncounterRef.current.ashenMantleCooldown > 0) {
          log(`[REJECTED] >> Ashen Mantle on cooldown (${mutationEncounterRef.current.ashenMantleCooldown} turns).`);
          playerApRef.current += def.apCost;
          setPlayerActionPoints(playerApRef.current);
          return;
        }
        if (!freeWard && !spendStam(def.staminaCost)) {
          log('[REJECTED] >> Insufficient stamina.');
          playerApRef.current += def.apCost;
          setPlayerActionPoints(playerApRef.current);
          return;
        }
        if (freeWard) {
          mutationEncounterRef.current.ashenMantleCooldown = 3;
          playerApRef.current += def.apCost;
          setPlayerActionPoints(playerApRef.current);
        }
        abyssalWardRef.current = true;
        setAbyssalWardActive(true);
        markPlayerDefendedRef.current();
        log('[ASHEN MANTLE] >> Mantle armed — blocks 50% next hit. Attackers gain Doomed.');
        break;
      }
      case 'RUIN':
      case 'GRAVE_BIND':
      case 'SHADOW_STEP':
      case 'NAIL_TO_GRID':
      case 'BLOOD_TITHE':
      case 'DEMONS_LUNG':
      case 'CRIMSON_PACT':
      case 'DEVASTATE':
      case 'ABYSSAL_FAULT':
      case 'BLOOD_BOUND_CARAPACE':
      case 'REAVE': {
        const result = executeExtendedAbility({
          abilityId,
          squad: squadRef.current,
          targetId: selectedTargetIdRef.current,
          strikeStats,
          stamina: staminaRef.current,
          abyssalReserve: abyssalRef.current,
          operativeHp: operativeHpRef.current,
          maxSoulAnchor,
          buffState: combatBuffRef.current,
          log,
          spendStamina: (cost) => spendStam(cost),
          spendStaminaPct: (pct) => {
            const cost = Math.floor(staminaRef.current * (pct / 100));
            return cost > 0 && spendStam(cost);
          },
          hurtEnemy: (raw, tag, source, opts, targetId) =>
            hurtEnemy(raw, tag, source as KineticDamageSource | undefined, {
              ...opts,
              targetId: targetId ?? opts?.targetId,
            }),
          patchUnit,
          syncSquad,
          chargeAr,
          consumeAbyssalPct: (pct) => {
            const consumed = Math.floor(abyssalRef.current * (pct / 100));
            const next = Math.max(0, abyssalRef.current - consumed);
            abyssalRef.current = next;
            setAbyssalReserve(next);
            return consumed;
          },
          healOperative: (amount) => applyHealRef.current(amount),
          sacrificeHpPct: (pct) => {
            const cost = Math.ceil(maxSoulAnchor * (pct / 100));
            if (operativeHpRef.current <= cost) return false;
            setOperativeHp((p) => {
              const n = Math.max(p - cost, 0);
              operativeHpRef.current = n;
              if (n <= 0) resolve(false);
              return n;
            });
            return true;
          },
          grantBonusAp: (amount) => {
            combatBuffRef.current.bonusApThisTurn += amount;
            playerApRef.current += amount;
            setPlayerActionPoints(playerApRef.current);
          },
          restoreStaminaPct: (pct) => {
            const restored = Math.floor(maxStamina * (pct / 100));
            applyStamina(staminaRef.current + restored);
          },
          reduceEnemyAp: (unitId, amount) => {
            const unit = getUnitById(squadRef.current, unitId);
            if (!unit) return;
            const nextAp = Math.max(0, (unit.enemyActionPoints ?? 1) - amount);
            patchUnit(unitId, { enemyActionPoints: nextAp });
          },
          ownedBoons: leyLineMutations,
          mutationMods: mutationModsRef.current,
          bloodTitheCooldown: mutationEncounterRef.current.bloodTitheCooldown,
          setVeilTarTurns: (turns) => {
            mutationEncounterRef.current.veilTarTurnsRemaining = turns;
          },
          activateBloodBoundCarapace: () => {
            bloodBoundCarapaceRef.current = true;
          },
          applyReaveBleed: (unitId, turns) => {
            mutationEncounterRef.current.reaveBleedUnits[unitId] = turns;
          },
          setShadowStepEvadeActive: (active) => {
            combatChanceRef.current.shadowStepEvadeActive = active;
          },
        });
        if (
          result.ok
          && boonMatchesAction(leyLineMutations, 'VENOMOUS_RUIN', abilityId)
          && mutationModsRef.current.ruinDotFracture > 0
        ) {
          for (const unit of aliveUnits(squadRef.current)) {
            if (unit.unitId) mutationEncounterRef.current.venomousRuinUnits.add(unit.unitId);
          }
          log('[VENOMOUS RUIN] >> Lingering fracture hazard seeded.');
        }
        if (result.ok && boonMatchesAction(leyLineMutations, 'JUGGERNAUT_PLATING', abilityId)) {
          mutationEncounterRef.current.juggernautShield = true;
          log('[JUGGERNAUT PLATING] >> Mobility shield primed.');
        }
        if (abilityId === 'SHADOW_STEP' && result.ok) {
          setInitiativeQueued(combatBuffRef.current.initiativeQueued);
        }
        if (!result.ok) {
          playerApRef.current += result.refundAp;
          setPlayerActionPoints(playerApRef.current);
        } else if (result.squad) {
          syncSquad(result.squad);
        }
        break;
      }
      default:
        log('[REJECTED] >> Ability not available.');
        playerApRef.current += apCost;
        setPlayerActionPoints(playerApRef.current);
        break;
    }

    const anyHostileKilled = squadBeforeAbility.some((before) => {
      if (!before.unitId) return false;
      const after = getUnitById(squadRef.current, before.unitId);
      return before.currentHp > 0 && (after == null || after.currentHp <= 0);
    });
    if (graftPlan.failDebuff && !anyHostileKilled) {
      log(`>> [${graftPlan.graftName.toUpperCase()}] — non-lethal cast, operative CONCUSSED.`);
    }
    if (graftPlan.reserveGenerationBonus > 0) {
      const reserveGain = Math.floor(
        graftPlan.reserveGenerationBonus * graftPlan.reserveGenerationMultiplier,
      );
      if (reserveGain > 0) {
        chargeAr(reserveGain);
        log(`>> [${graftPlan.graftName.toUpperCase()}] — +${reserveGain} Abyssal Reserve.`);
      }
    }

    activeGraftPlanRef.current = null;
    activeGraftStaminaSpentRef.current = 0;
  };

  const onInitiativeProcComplete = useCallback(() => {
    setApRollupDisplay(null);
    shadowstepProcRef.current = false;
    setShadowstepProcActive(false);
  }, []);

  useEffect(() => () => {
    if (apRollupFrameRef.current != null) {
      cancelAnimationFrame(apRollupFrameRef.current);
    }
  }, []);

  const runShadowstepInitiativeProc = useCallback(() => {
    if (shadowstepProcRef.current || isCombatTerminal()) return;
    shadowstepProcRef.current = true;
    setShadowstepProcActive(true);
    combatBuffRef.current.initiativeQueued = false;
    setInitiativeQueued(false);
    setSelectedAbility(null);

    const startAp = playerApRef.current;
    const maxAp = PLAYER_ACTION_POINTS_PER_TURN;
    setApRollupDisplay(startAp);
    setInitiativeProcSeq((seq) => seq + 1);

    const rollupMs = 300;
    const startTime = Date.now();
    let peakFired = false;

    const tickApRollup = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / rollupMs);
      const displayed = Math.round(startAp + (maxAp - startAp) * t);
      setApRollupDisplay(displayed);

      if (t >= 1 && !peakFired) {
        peakFired = true;
        playerApRef.current = maxAp;
        setPlayerActionPoints(maxAp);
        Vibration.vibrate([0, 12, 24, 48]);
        log('[SHADOW STEP] >> Initiative seized — bonus turn active.');
      }

      if (t < 1) {
        apRollupFrameRef.current = requestAnimationFrame(tickApRollup);
      } else {
        apRollupFrameRef.current = null;
      }
    };

    apRollupFrameRef.current = requestAnimationFrame(tickApRollup);
  }, [log]);

  const onEndTurn = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current || activeReloadVisible) return;
    Vibration.vibrate(12);
    if (combatBuffRef.current.initiativeQueued) {
      if (hasMutation(leyLineMutations, 'MOMENTUM_SHIFT') && staminaRef.current === 0) {
        mutationEncounterRef.current.momentumShiftPending = true;
        combatChanceRef.current.momentumShiftEvadeDisabled = true;
      }
      runShadowstepInitiativeProc();
      return;
    }
    if (hasMutation(leyLineMutations, 'MOMENTUM_SHIFT') && staminaRef.current === 0) {
      mutationEncounterRef.current.momentumShiftPending = true;
      combatChanceRef.current.momentumShiftEvadeDisabled = true;
    }
    passToEnemy(wraithParryRef.current);
  };

  const onUltimatePing = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (encounterUltimateDisabled) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      return;
    }
    if (zeroProtocolReady) {
      zeroProtocolActiveRef.current = true;
      setZeroProtocolVisible(true);
      combatPausedRef.current = true;
      log('>> [ZERO-PROTOCOL] >> Rapid execution grid online.');
      return;
    }
    if (cataclysmReady) {
      setCataclysmSigilVisible(true);
      combatPausedRef.current = true;
      log('>> [CATACLYSM SIGIL] >> Trace the void pattern.');
      return;
    }
    if (sliceReady) onSlice();
  };

  const handleZeroProtocolTap = () => {
    if (!zeroProtocolActiveRef.current) return;
    const targets = aliveUnits(squadRef.current);
    if (targets.length === 0) return;
    const pick = targets[Math.floor(Math.random() * targets.length)];
    if (!pick.unitId) return;
    hurtEnemy(ZERO_PROTOCOL_DAMAGE_PER_TAP, '[ZERO-PROTOCOL]', 'STRIKE', {
      channel: 'TRUE',
      targetId: pick.unitId,
      rollCrit: false,
    });
    triggerHaptic('impactLight');
    triggerShake('micro');
  };

  const finishZeroProtocol = (tapCount: number) => {
    zeroProtocolActiveRef.current = false;
    setZeroProtocolVisible(false);
    combatPausedRef.current = false;
    setPerfectReloadCount(0);
    classCombatRef.current.perfectReloadCount = 0;
    log(`>> [ZERO-PROTOCOL] >> ${tapCount} impact(s) delivered.`);
  };

  const handleCataclysmResolve = (success: boolean) => {
    setCataclysmSigilVisible(false);
    combatPausedRef.current = false;
    setCataclysmReadyUi(false);
    classCombatRef.current.cataclysmReady = false;
    const aoe = success ? CATACLYSM_SUCCESS_AOE : CATACLYSM_FAIL_AOE;
    for (const unit of aliveUnits(squadRef.current)) {
      if (!unit.unitId) continue;
      hurtEnemy(aoe, '[CATACLYSM SIGIL]', 'STRIKE', {
        channel: 'TRUE',
        targetId: unit.unitId,
        rollCrit: false,
      });
    }
    if (success) {
      applyVeilFlux(-veilFluxRef.current);
      triggerHitstop(150);
      triggerShake('heavy');
      triggerHaptic('impactHeavy');
      log('>> [CATACLYSM SIGIL] >> Pattern locked — 50 TRUE to all hostiles, flux vented.');
    } else {
      applyVeilFlux(CATACLYSM_FAIL_FLUX - veilFluxRef.current);
      hurtPlayer(
        CATACLYSM_FAIL_BACKLASH,
        true,
        `>> SIGIL BACKLASH — ${CATACLYSM_FAIL_BACKLASH} TRUE.`,
        { rollCrit: false },
      );
      triggerShake('light');
      triggerHaptic('notificationError');
      log('>> [CATACLYSM SIGIL] >> Pattern failed — partial detonation, flux at 50%.');
    }
  };

  const expireFractureBreak = (unitId: string) => {
    setFractureBreakUnitId(null);
    combatPausedRef.current = false;
    const unit = getUnitById(squadRef.current, unitId);
    if (unit?.unitId) {
      patchUnit(unit.unitId, applyFracturedState(unit));
      log(`>> FRACTURE BREAK EXPIRED — ${unit.designation} enters FRACTURED state.`);
    }
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
    }
  };

  const executeFractureBreak = (unitId: string) => {
    const unit = getUnitById(squadRef.current, unitId);
    if (!unit?.unitId) {
      setFractureBreakUnitId(null);
      combatPausedRef.current = false;
      return;
    }
    const plan = planFractureBreachStrike(operativeClass, strikeStats);
    for (let i = 0; i < plan.hitCount; i += 1) {
      hurtEnemy(plan.damagePerHit, plan.tag, 'STRIKE', {
        channel: plan.channel,
        targetId: unit.unitId,
        rollCrit: plan.rollCrit,
      });
      triggerHaptic('impactLight');
    }
    if (operativeClass === 'ENVOY') {
      triggerShake('heavy');
      triggerHitstop(120);
    } else if (operativeClass === 'AEGIS') {
      patchUnit(unit.unitId, applyFracturedState(unit));
      enemyStunPendingRef.current = true;
      triggerHitstop(100);
      triggerHaptic('impactHeavy');
    } else {
      triggerHitstop(80);
    }
    const refreshed = getUnitById(squadRef.current, unit.unitId);
    if (
      refreshed?.unitId
      && isUnitAlive(refreshed)
      && operativeClass !== 'AEGIS'
    ) {
      patchUnit(refreshed.unitId, applyFracturedState(refreshed));
    }
    setFractureBreakUnitId(null);
    combatPausedRef.current = false;
    log(`>> FRACTURE BREACH — ${unit.designation} executed (${plan.hitCount} hit(s)).`);
    if (allUnitsDefeated(squadRef.current)) {
      scheduleCombatVictoryResolution();
    }
  };

  const onSlice = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (encounterUltimateDisabled) {
      log('[REJECTED] >> Ultimate channel sealed by Apex Graft.');
      return;
    }
    if (isExhausted) { log('[REJECTED] >> Exhausted — eviscerate offline.'); return; }
    if (playerApRef.current < EVISCERATE_AP_COST) {
      log(`[REJECTED] >> Eviscerate requires ${EVISCERATE_AP_COST} AP.`);
      return;
    }
    if (!spendActionPoints(EVISCERATE_AP_COST)) {
      log(`[REJECTED] >> Insufficient action points for Eviscerate.`);
      return;
    }
    log('[EVISCERATE] >> Execution aperture open.');
    triggerSlice();
  };

  const onBloodForTime = () => {
    if (!hasMutation(leyLineMutations, 'BLOOD_FOR_TIME')) return;
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (mutationEncounterRef.current.bloodForTimeUsed) {
      log('[REJECTED] >> Blood for Time already spent this turn.');
      return;
    }
    const cost = Math.max(1, Math.ceil(operativeHpRef.current * 0.15));
    if (operativeHpRef.current <= cost) {
      log('[REJECTED] >> Insufficient Soul Anchor for Blood for Time.');
      return;
    }
    mutationEncounterRef.current.bloodForTimeUsed = true;
    setOperativeHp((p) => {
      const n = Math.max(p - cost, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
    playerApRef.current += 1;
    setPlayerActionPoints(playerApRef.current);
    log(`[BLOOD FOR TIME] >> ${cost} HP tithed — +1 AP granted.`);
  };

  const onCombatReload = () => {
    if (operativeClass !== 'HEX_SHOT') return;
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current) return;
    if (activeReloadVisible || hexReloadUsedThisTurnRef.current) {
      if (hexReloadUsedThisTurnRef.current) {
        log('[REJECTED] >> Combat reload already spent this turn.');
      }
      return;
    }
    hexReloadUsedThisTurnRef.current = true;
    setHexReloadUsedThisTurn(true);
    setActiveReloadVisible(true);
    log('>> [COMBAT RELOAD] — active reload window open.');
  };

  const handleActiveReloadResolve = (result: ActiveReloadResult) => {
    setActiveReloadVisible(false);
    log(activeReloadLogLine(result));
    switch (result) {
      case 'PERFECT':
        setMagazineAmmo(maxAmmo);
        hexOverchargedRef.current = true;
        setHexOvercharged(true);
        markHexShotTacticalReloadPending(hexShotBoons, classBoonEncounterRef.current, log);
        triggerHitstop(80);
        triggerHaptic('impactHeavy');
        {
          const nextPerfect = perfectReloadCount + 1;
          setPerfectReloadCount(nextPerfect);
          classCombatRef.current.perfectReloadCount = nextPerfect;
        }
        if (hasHexShotBoon(hexShotBoons, 'FLAWLESS_DRILL') && hexShotBoonMods.perfectReloadApBonus) {
          playerApRef.current += 1;
          setPlayerActionPoints(playerApRef.current);
          log('[FLAWLESS DRILL] >> Perfect reload — +1 AP.');
        }
        if (hasHexShotBoon(hexShotBoons, 'ETHEREAL_MAGAZINES')) {
          sessionExtrasRef.current.playerShield = (sessionExtrasRef.current.playerShield ?? 0) + 10;
          log('[ETHEREAL MAGAZINES] >> Occult shield grafted to operative.');
        }
        break;
      case 'STANDARD':
        setMagazineAmmo(maxAmmo);
        markHexShotTacticalReloadPending(hexShotBoons, classBoonEncounterRef.current, log);
        triggerHaptic('impactLight');
        if (playerApRef.current > 0) {
          playerApRef.current -= 1;
          setPlayerActionPoints(playerApRef.current);
        }
        break;
      case 'JAM':
        setMagazineAmmo(Math.min(2, maxAmmo));
        playerApRef.current = 0;
        setPlayerActionPoints(0);
        triggerShake('light');
        triggerHaptic('notificationError');
        if (isPlayerTurnRef.current && cycleRef.current === 'TEXT_COMBAT') {
          passToEnemy(false);
        }
        break;
      default:
        break;
    }
  };

  const registerParryArena = (layout: ParryArenaLayout) => {
    parryArenaRef.current = layout;
  };

  const registerSliceArena = (layout: SliceArenaSize) => {
    sliceArenaRef.current = layout;
  };

  const hideParryOverlay = () => {
    setIsSuccessState(false);
    setIsFailureState(false);
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
  };

  const finishParryKillAfterHalo = () => {
    abortCombatMinigames();
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
    scheduleCombatVictoryResolution();
    return;
  };

  /** Exactly one parry outcome — counter damage and parry block cannot diverge. */
  const finalizeParry = (passed: boolean, unmitigatedOnFail: boolean) => {
    if (parryResolvedRef.current || cycleRef.current !== 'DEFEND_PARRY') return;
    parryResolvedRef.current = true;
    parryTapPendingRef.current = false;
    cancelAnimation(parryScaleSV);

    const retribution = retributionParryRef.current;
    if (retribution) {
      if (!passed) {
        hurtPlayer(
          retribution.occultDamage,
          false,
          `>> ASH DETONATION — ${retribution.occultDamage} occult`,
          { rollCrit: false },
        );
      } else {
        log('[PARRY LOCKED] >> Ash detonation contained.');
      }
      const pending = pendingDissolveRef.current;
      hideParryOverlay();
      retributionParryRef.current = null;
      pendingDissolveRef.current = null;
      if (pending) beginDissolveForUnit(pending.unitId, pending.profile, 0);
      if (operativeHpRef.current <= 0) return;
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(false);
      else if (!allUnitsDefeated(squadRef.current)) endEnemyTurn(true);
      return;
    }

    if (passed) {
      Vibration.vibrate(15);
      triggerHitstop(100);
      triggerHaptic('impactHeavy');
      {
        const nextParries = successfulParryCount + 1;
        setSuccessfulParryCount(nextParries);
        classCombatRef.current.successfulParryCount = nextParries;
      }
      preAppliedHpStrikeRef.current = 0;
      counterRef.current = false;
      setCounterPrepActive(false);
      let killed = false;
      if (wraithParryRef.current) {
        const reflect = pendingDmgRef.current;
        wraithParryRef.current = false;
        const e = enemyRef.current;
        if (e?.unitId) {
          const fractured = applyFractureDamage(e, reflect);
          patchUnit(e.unitId, fractured);
          log(`[WRAITH PARRY] >> Parry locked — ${reflect} fracture reflected.`);
          const reflectPct = mutationModsRef.current.parryReflectPct;
          if (reflectPct > 0) {
            const hpReflect = Math.floor(pendingDmgRef.current * (reflectPct / 100));
            if (hpReflect > 0) {
              hurtEnemy(hpReflect, '[SPIKED WARD]', 'STRIKE', {
                channel: 'KINETIC',
                targetId: e.unitId,
              });
              log(`[SPIKED WARD] >> ${hpReflect} HP retaliation.`);
            }
          }
        }
      } else {
        const cd = Math.floor(COMBAT_ACTION.COUNTER_DAMAGE * (1 + parryMultiplierBonus));
        log(`[PERFECT COUNTER] >> Parry locked — ${cd} retaliation damage.`);
        killed = hurtEnemy(cd, '[COUNTER HIT]', 'COUNTER', { rollCrit: false });
      }
      if (hasMutation(leyLineMutations, 'PERFECTED_FORM')) {
        const heal = Math.floor(maxSoulAnchor * 0.1 * mutationModsRef.current.healMultiplier);
        if (heal > 0) applyHealRef.current(heal);
        log('[PERFECTED FORM] >> Perfect parry — 10% Soul Anchor restored.');
      }
      if (hasMutation(leyLineMutations, 'FLAWLESS_CONDUIT')) {
        mutationEncounterRef.current.flawlessConduitPending = true;
      }
      hideParryOverlay();
      startParrySuccessBurst(() => {
        if (killed) finishParryKillAfterHalo();
        else endEnemyTurn();
      });
      return;
    }
    hideParryOverlay();
    if (hasMutation(leyLineMutations, 'MASOCISTS_JOY')) {
      mutationEncounterRef.current.masochistBuff = true;
      log("[MASOCHIST'S JOY] >> Failed parry — next attack empowered.");
    }
    log(unmitigatedOnFail ? '[PARRY FAILED] >> Mistimed — 100% unmitigated damage.' : '[PARRY FAILED] >> Guard collapsed.');
    commitPendingPlayerDamage(unmitigatedOnFail);
    counterRef.current = false;
    setCounterPrepActive(false);
    if (operativeHpRef.current > 0) endEnemyTurn();
  };

  const finalizeParryRef = useRef(finalizeParry);
  finalizeParryRef.current = finalizeParry;

  const handleParryTimeout = (session: number) => {
    if (parryResolvedRef.current) return;
    if (session !== parrySessionRef.current || parryTapPendingRef.current) return;
    finalizeParryRef.current(false, false);
  };

  const adjudicateParryTap = (scale: number, tapX: number, tapY: number, session: number) => {
    parryTapPendingRef.current = false;
    if (session !== parrySessionRef.current || parryResolvedRef.current) return;
    const passed = isParryAttemptSuccessful(
      scale,
      tapX,
      tapY,
      parryArenaRef.current,
      parryTimingWindowBonus,
      parryTimingBlindPenalty,
    );
    finalizeParryRef.current(passed, true);
  };

  const adjudicateParryTapRef = useRef(adjudicateParryTap);
  adjudicateParryTapRef.current = adjudicateParryTap;

  const runAdjudicateParryTap = (scale: number, tapX: number, tapY: number, session: number) => {
    adjudicateParryTapRef.current(scale, tapX, tapY, session);
  };

  const startParryRing = () => {
    cancelAnimation(parryScaleSV);
    parrySessionRef.current += 1;
    const session = parrySessionRef.current;
    parryResolvedRef.current = false;
    parryTapPendingRef.current = false;
    clearParrySuccessBurst();
    setIsSuccessState(false);
    setIsFailureState(false);
    parryScaleSV.value = PARRY_RING_SCALE_START;
    requestAnimationFrame(() => {
      if (cycleRef.current !== 'DEFEND_PARRY' || session !== parrySessionRef.current) return;
      parryScaleSV.value = withTiming(
        PARRY_RING_SCALE_END,
        { duration: PARRY_DURATION, easing: ReanimatedEasing.linear },
        (finished) => {
          'worklet';
          if (finished) runOnJS(handleParryTimeout)(session);
        },
      );
    });
  };

  const onParryTap = (tapX: number, tapY: number) => {
    if (cycleRef.current !== 'DEFEND_PARRY' || parryResolvedRef.current || parryTapPendingRef.current) return;
    parryTapPendingRef.current = true;
    const session = parrySessionRef.current;
    runOnUI((x: number, y: number, s: number) => {
      'worklet';
      const scale = parryScaleSV.value;
      cancelAnimation(parryScaleSV);
      runOnJS(runAdjudicateParryTap)(scale, x, y, s);
    })(tapX, tapY, session);
  };

  const evaluateSlice = () => {
    if (isCombatTerminal()) return;
    const s = sliceSessionRef.current; if (s.evaluated) return;
    s.evaluated = true; clearSliceTimers(); activeSliceRef.current = -1; setActiveSliceIndex(-1);
    const hits = s.hitCount;
    if (hits === 0) {
      log('[EXECUTION FAILED] >> 0 damage.');
      cycleRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      setEviscerateTargetUnitId(null);
      passToEnemy(false);
      return;
    }
    const base = scaleSlice(COMBAT_ACTION.EVISCERATE_DAMAGE);
    const dmg = hits === 3 ? base : Math.floor(base * (hits / 3));
    log(hits === 3
      ? `[EXECUTION SEVERANCE] >> Perfect [3/3] — ${dmg} damage.`
      : `[EXECUTION SEVERANCE] >> [${hits}/3] — ${dmg} damage.`);
    const eradicated = hurtEnemy(dmg, '[EVISCERATE]', 'EVISCERATE', { channel: 'TRUE' });
    if (!eradicated) applyEviscerateAftermath();
    if (eradicated) return;
    cycleRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');
    setEviscerateTargetUnitId(null);
    passToEnemy(false);
  };

  const queueSlice = (idx: number) => {
    if (isCombatTerminal()) return;
    if (idx >= 3) { evaluateSlice(); return; }
    activeSliceRef.current = idx; setActiveSliceIndex(idx);
    crossedRef.current = false;
    sliceTouchStartRef.current = null;
    const s = sliceSessionRef.current;
    if (s.segmentTimer) clearTimeout(s.segmentTimer);
    s.segmentTimer = setTimeout(() => { s.segmentTimer = null; sliceHandlersRef.current.queueNext(idx + 1); }, 1200);
  };

  const pulseSliceHitHaptic = () => {
    Vibration.vibrate(SLICE_HIT_HAPTIC_MS);
  };

  const registerSliceHit = (idx: number): boolean => {
    const s = sliceSessionRef.current;
    if (s.slicedIds.has(idx)) return false;
    s.slicedIds.add(idx);
    s.hitCount += 1;
    setSliceLines(s.lines.map((l) => (l.id === idx ? { ...l, isSliced: true } : l)));
    pulseSliceHitHaptic();
    apparitionRef?.current?.triggerDamageEffect();
    return true;
  };

  const tryValidateSliceSwipe = (x0: number, y0: number, x1: number, y1: number) => {
    if (isCombatTerminal()) return;
    const idx = activeSliceRef.current;
    if (idx === -1 || crossedRef.current || cycleRef.current !== 'OFFENSE_SLICE') return;

    const line = sliceSessionRef.current.lines.find((l) => l.id === idx);
    const arena = sliceArenaRef.current;
    if (!line || arena.width <= 0 || arena.height <= 0) return;

    const segment = getSliceLineSegment(line, arena);
    if (!segment || !swipeHitsSliceLine(x0, y0, x1, y1, segment)) return;

    validateSlice();
  };

  const validateSlice = () => {
    if (isCombatTerminal()) return;
    const idx = activeSliceRef.current;
    if (idx === -1 || crossedRef.current || cycleRef.current !== 'OFFENSE_SLICE') return;
    if (!sliceSessionRef.current.lines.some((l) => l.id === idx)) return;
    crossedRef.current = true;
    clearSliceTimers();
    registerSliceHit(idx);
    if (sliceSessionRef.current.hitFlashTimer) clearTimeout(sliceSessionRef.current.hitFlashTimer);
    sliceSessionRef.current.hitFlashTimer = setTimeout(() => {
      sliceSessionRef.current.hitFlashTimer = null;
      crossedRef.current = false;
      sliceTouchStartRef.current = null;
      sliceHandlersRef.current.queueNext(idx + 1);
    }, 180);
  };

  const triggerSlice = () => {
    if (isCombatTerminal()) return;
    clearSliceTimers();
    sliceSessionRef.current = { lines: [], hitCount: 0, slicedIds: new Set(), segmentTimer: null, hitFlashTimer: null, evaluated: false };
    crossedRef.current = false;
    sliceTouchStartRef.current = null;
    const angles = generateVariedSliceAngles(3);
    const lines: SliceLineConfig[] = angles.map((angleDeg, i) => ({
      id: i,
      centerXRatio: 0.5 + (Math.random() - 0.5) * ORIGIN_JITTER,
      centerYRatio: 0.5 + (Math.random() - 0.5) * ORIGIN_JITTER,
      angleDeg,
      isSliced: false,
    }));
    sliceSessionRef.current.lines = lines; setSliceLines(lines);
    activeSliceRef.current = 0; setActiveSliceIndex(0);
    const targetId = selectedTargetIdRef.current
      ?? focusedUnitIdRef.current
      ?? enemyRef.current?.unitId
      ?? null;
    setEviscerateTargetUnitId(targetId);
    cycleRef.current = 'OFFENSE_SLICE'; setCycleState('OFFENSE_SLICE'); queueSlice(0);
  };
  sliceHandlersRef.current = { queueNext: queueSlice, validate: validateSlice, evaluate: evaluateSlice, trigger: triggerSlice };
  useEffect(() => () => {
    clearSliceTimers();
    clearParrySuccessBurst();
    if (enemyTurnTimerRef.current) clearTimeout(enemyTurnTimerRef.current);
    if (enemyTurnGapTimerRef.current) clearTimeout(enemyTurnGapTimerRef.current);
    if (enemyStrikeTimerRef.current) clearTimeout(enemyStrikeTimerRef.current);
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => cycleRef.current === 'OFFENSE_SLICE',
    onMoveShouldSetPanResponder: () => cycleRef.current === 'OFFENSE_SLICE',
    onPanResponderGrant: (e) => {
      if (cycleRef.current !== 'OFFENSE_SLICE' || crossedRef.current) return;
      sliceTouchStartRef.current = {
        x: e.nativeEvent.locationX,
        y: e.nativeEvent.locationY,
      };
    },
    onPanResponderMove: (e) => {
      if (cycleRef.current !== 'OFFENSE_SLICE' || crossedRef.current || activeSliceRef.current === -1) return;
      const start = sliceTouchStartRef.current;
      if (!start) return;
      tryValidateSliceSwipe(
        start.x,
        start.y,
        e.nativeEvent.locationX,
        e.nativeEvent.locationY,
      );
    },
    onPanResponderRelease: (e) => {
      if (cycleRef.current === 'OFFENSE_SLICE' && !crossedRef.current && activeSliceRef.current !== -1) {
        const start = sliceTouchStartRef.current;
        if (start) {
          tryValidateSliceSwipe(
            start.x,
            start.y,
            e.nativeEvent.locationX,
            e.nativeEvent.locationY,
          );
        }
      }
      sliceTouchStartRef.current = null;
    },
  })).current;

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    const hp = operativeHpRef.current;
    onCombatComplete?.({
      victory: resolutionRef.current === 'VICTORY' && hp > 0,
      remainingHp: hp,
      remainingStamina: staminaRef.current,
    });
  }, [onCombatComplete]);

  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;
  const resolutionSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onResolutionPanelChange) return;
    const syncKey =
      cycleState === 'RESOLUTION' && resolutionOutcome
        ? resolutionOutcome
        : 'idle';
    if (resolutionSyncKeyRef.current === syncKey) return;
    resolutionSyncKeyRef.current = syncKey;
    if (syncKey === 'idle') {
      onResolutionPanelChange(null);
      return;
    }
    onResolutionPanelChange({
      outcome: resolutionOutcome as 'VICTORY' | 'DEFEAT',
      onDismiss: () => dismissRef.current(),
    });
  }, [cycleState, resolutionOutcome, onResolutionPanelChange]);

  const isOperativeAbilityEnabled = (abilityId: string): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) return false;
    if (operativeClass === 'HEX_SHOT' && isHexShotProcUltimate(abilityId)) return false;
    if (operativeClass === 'ENVOY' && isEnvoyProcUltimate(abilityId)) return false;
    const cost = resolveClassAbilityCost(operativeClass, abilityId);
    const ultimateSealed = encounterUltimateDisabled
      || (operativeClass === 'HEX_SHOT'
        ? isClassUltimateDisabledForEncounter('HEX_SHOT', hexShotAbilityGraftsRef.current, {}, false)
        : operativeClass === 'ENVOY'
          ? isClassUltimateDisabledForEncounter('ENVOY', {}, envoyAbilityGraftsRef.current, false)
          : false);
    if (ultimateSealed && cost.isUltimate) return false;
    if (operativeClass === 'HEX_SHOT') {
      const graftPlan = buildClassGraftCastPlan(
        'HEX_SHOT',
        abilityId,
        hexShotAbilityGraftsRef.current[abilityId as HexShotAbilityId],
      );
      if (playerActionPoints < graftPlan.apCost) return false;
      return isHexShotAbilityEnabled(
        abilityId as HexShotAbilityId,
        currentAmmo,
        maxAmmo,
        stamina,
        classCombatRef.current,
        effectiveGraftAmmoCost(graftPlan, currentAmmo),
      );
    }
    if (operativeClass === 'ENVOY') {
      const graftPlan = buildClassGraftCastPlan(
        'ENVOY',
        abilityId,
        envoyAbilityGraftsRef.current[abilityId as EnvoyAbilityId],
      );
      if (playerActionPoints < graftPlan.apCost) return false;
      if (envoySilencedRef.current && cost.isFluxGen && !graftPlan.effectiveTags.includes('FLUX_DUMP')) {
        return false;
      }
      return isEnvoyAbilityEnabled(
        abilityId as EnvoyAbilityId,
        veilFlux,
        stamina,
        envoySilenced,
        graftPlan.fluxCost,
      );
    }
    if (playerActionPoints < cost.apCost) return false;
    return isAbilityEnabled(abilityId as AegisAbilityId);
  };

  const isAbilityEnabled = (abilityId: AegisAbilityId): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) return false;
    if (
      encounterUltimateDisabled
      && getAbilityTags(abilityId).includes('ULTIMATE')
    ) {
      return false;
    }
    if (hasStructuredDebuff(sessionExtrasRef.current, 'ROOTED')
      && (abilityId === 'WRAITH_PARRY' || abilityId === 'SHADOW_STEP')) {
      return false;
    }
    const jammedSlots = sessionExtrasRef.current.jammedAugmentSlots?.length
      ? sessionExtrasRef.current.jammedAugmentSlots
      : sessionExtrasRef.current.jammedAugmentSlot != null
        ? [sessionExtrasRef.current.jammedAugmentSlot]
        : [];
    if (jammedSlots.some((slot) => aegisLoadout[slot] === abilityId)) return false;
    const def = getAbilityDefinition(abilityId);
    const graftPlan = buildGraftCastPlan(abilityId, abilityGraftsRef.current[abilityId]);
    if ((graftCooldownsRef.current[abilityId] ?? 0) > 0) return false;
    if (playerActionPoints < graftPlan.apCost) return false;
    switch (abilityId) {
      case 'STRIKE':
        return true;
      case 'VEIL_PIERCER':
        return stamina >= def.staminaCost;
      case 'WRAITH_PARRY': {
        const stamCost = Math.floor(stamina * ((def.staminaCostPct ?? 0) / 100));
        return !isExhausted && stamCost > 0 && stamina >= stamCost;
      }
      case 'ASHEN_MANTLE':
        if (mutationModsRef.current.ashenMantleFree) {
          return mutationEncounterRef.current.ashenMantleCooldown <= 0;
        }
        return stamina >= def.staminaCost;
      case 'RUIN':
      case 'GRAVE_BIND':
      case 'SHADOW_STEP':
      case 'NAIL_TO_GRID':
      case 'BLOOD_TITHE':
      case 'DEMONS_LUNG':
      case 'CRIMSON_PACT':
      case 'DEVASTATE':
      case 'ABYSSAL_FAULT':
      case 'BLOOD_BOUND_CARAPACE':
      case 'REAVE':
        return isExtendedAbilityEnabled(
          abilityId,
          stamina,
          abyssalReserve,
          operativeHp,
          maxSoulAnchor,
          combatBuffRef.current,
        );
      default:
        return false;
    }
  };

  const getAbilityAccent = (abilityId: string): string | undefined => {
    if (operativeClass !== 'AEGIS') return undefined;
    const aegisId = abilityId as AegisAbilityId;
    const graftId = abilityGraftsRef.current[aegisId];
    if (graftId) return getVeilGraftDefinition(graftId).accentColor;
    if (aegisId === 'WRAITH_PARRY' && wraithParryRef.current) return P.parry;
    if (aegisId === 'ASHEN_MANTLE' && abyssalWardActive) return WARD_STRIKE_ACCENT;
    return undefined;
  };

  const getStagedHeader = (abilityId: string): string => {
    const name = resolveClassAbilityCost(operativeClass, abilityId).label.replace(/^\[|\]$/g, '').trim();
    if (operativeClass === 'AEGIS') {
      const aegisId = abilityId as AegisAbilityId;
      const graftId = abilityGraftsRef.current[aegisId];
      if (graftId) {
        return `GRAFT READY // ${getVeilGraftDefinition(graftId).name.toUpperCase()} // ${name}`;
      }
    }
    return `SYSTEM READY // ${name} SELECTED`;
  };

  const getStagedCostImpact = (abilityId: string): string => {
    const cost = resolveClassAbilityCost(operativeClass, abilityId);
    return `COST: ${formatClassAbilityCostLine(operativeClass, abilityId)}\n${cost.description}`;
  };

  const confirmSelectedAbility = () => {
    if (!selectedAbility) return;
    if (classAbilityRequiresTarget(operativeClass, selectedAbility)) {
      const targetId = selectedTargetIdRef.current;
      if (!targetId || !canTargetWithClassAbility(operativeClass, squadRef.current, selectedAbility, targetId)) {
        log('[TARGET] >> Select a valid hostile on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    executeOperativeAbility(selectedAbility);
    setSelectedAbility(null);
    publishSquadUi(squadRef.current);
  };

  useEffect(() => {
    enemyActionStageRef.current = enemyActionStage;
    publishSquadUi(squadRef.current);
  }, [enemyActionStage]);

  useEffect(() => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT') {
      setSelectedAbility(null);
    }
    publishSquadUi(squadRef.current);
  }, [isPlayerTurn, cycleState, selectedAbility, selectedTargetId, combatTurnPhase]);

  useEffect(() => {
    onWardPrimedChange?.(abyssalWardActive);
  }, [abyssalWardActive, onWardPrimedChange]);

  useEffect(() => {
    onAbilityPrimedChange?.(selectedAbility != null);
  }, [selectedAbility, onAbilityPrimedChange]);

  useEffect(() => {
    if (!onOperativeTelemetryChange) return;
    onOperativeTelemetryChange({
      operativeClass,
      operativeHp,
      maxSoulAnchor,
      abyssalReserve,
      stamina,
      maxStamina,
      counterReady,
      currentAmmo,
      maxAmmo,
      overcharged: hexOvercharged,
      veilFlux,
      envoyOverloaded,
      envoySilenced,
    });
  }, [
    onOperativeTelemetryChange,
    operativeClass,
    operativeHp,
    maxSoulAnchor,
    abyssalReserve,
    stamina,
    maxStamina,
    counterReady,
    currentAmmo,
    maxAmmo,
    hexOvercharged,
    veilFlux,
    envoyOverloaded,
    envoySilenced,
  ]);

  const enemyAlive = (enemy?.currentHp ?? 0) > 0;
  const bloodForTimeOwned = hasMutation(leyLineMutations, 'BLOOD_FOR_TIME');

  const commandDeck = (
    <CombatCommandDeck
      loadout={activeLoadout}
      selectedAbility={selectedAbility}
      onSelectAbility={setSelectedAbility}
      onConfirm={confirmSelectedAbility}
      onAbort={() => setSelectedAbility(null)}
      onEndTurn={onEndTurn}
      actionPoints={playerActionPoints}
      displayActionPoints={apRollupDisplay}
      initiativeQueued={initiativeQueued}
      initiativeProcSeq={initiativeProcSeq}
      onInitiativeProcComplete={onInitiativeProcComplete}
      isActionEnabled={isOperativeAbilityEnabled}
      getAbilityLabel={(abilityId) => formatAbilityLabel(operativeClass, abilityId)}
      canEndTurn={isPlayerTurn && cycleState === 'TEXT_COMBAT' && !shadowstepProcActive}
      getStagedHeader={getStagedHeader}
      getStagedCostImpact={getStagedCostImpact}
      getActionAccent={getAbilityAccent}
      bloodForTimeAvailable={bloodForTimeOwned}
      bloodForTimeEnabled={
        bloodForTimeOwned
        && isPlayerTurn
        && cycleState === 'TEXT_COMBAT'
        && !mutationEncounterRef.current.bloodForTimeUsed
      }
      onBloodForTime={onBloodForTime}
      combatReloadAvailable={operativeClass === 'HEX_SHOT'}
      combatReloadEnabled={
        operativeClass === 'HEX_SHOT'
        && isPlayerTurn
        && cycleState === 'TEXT_COMBAT'
        && !shadowstepProcActive
        && !activeReloadVisible
        && !hexReloadUsedThisTurn
      }
      onCombatReload={onCombatReload}
      borderColor={theme.borderColor}
      primaryColor={theme.primaryColor}
      mutedColor={theme.mutedColor}
      frameless
      dashboardLayout
    />
  );

  const holdVictoryChrome =
    cycleState === 'RESOLUTION' && resolutionOutcome === 'VICTORY';

  const resolutionActive =
    cycleState === 'RESOLUTION' && resolutionOutcome != null;

  const renderCommandDeckDimOverlay = () =>
    resolutionActive ? (
      <View style={styles.commandDeckDimOverlay} pointerEvents="none" />
    ) : null;

  const renderStatusFeed = () => (
    <View
      style={styles.statusFeedSlotStacked}
      pointerEvents="none"
    >
      {cycleState === 'TEXT_COMBAT' ? (
        <>
          {phaseAlert ? (
            <Text style={[styles.phaseAlert, { color: '#ef4444' }]}>{phaseAlert}</Text>
          ) : null}
          {isExhausted ? (
            <Text style={styles.exhaustedBanner}>
              {operativeClass === 'AEGIS'
                ? 'EXHAUSTED — COUNTER/SLICE OFFLINE'
                : 'EXHAUSTED — REACTIVE DEFENSE OFFLINE'}
            </Text>
          ) : null}
          {env.isPlayerBlinded ? (
            <Text style={[styles.exhaustedBanner, { color: '#fbbf24' }]}>
              BLINDED — COUNTER WINDOW -15%
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const renderEnemyTurnPanel = () => {
    const intentLabel = enemy ? formatIntentReadout(enemy.intent) : 'RESOLVING';
    const isReading = enemyActionStage === 'reading';
    return (
      <View style={[styles.enemyTurnPanel, { borderColor: P.enemyHp }]}>
        <Text style={[styles.enemyTurnTitle, { color: P.enemyHp }]}>
          {isReading
            ? `>> HOSTILE CHANNEL // ${intentLabel}`
            : `>> HOSTILE ATTACK // ${intentLabel}`}
        </Text>
        <Text style={[styles.enemyTurnHint, { color: theme.mutedColor }]}>
          {isReading
            ? 'Read incoming intent — command deck offline'
            : 'Strike channel active — brace for impact'}
        </Text>
      </View>
    );
  };

  const showCommandDeck =
    (cycleState === 'TEXT_COMBAT' && isPlayerTurn)
    || (holdVictoryChrome && !wasEnemyTurnAtVictoryRef.current);

  const showEnemyTurnPanel =
    (cycleState === 'TEXT_COMBAT' && !isPlayerTurn)
    || (holdVictoryChrome && wasEnemyTurnAtVictoryRef.current);

  const renderCommandDeckSlot = () => (
    <View style={styles.commandDeckAnchor}>
      {showCommandDeck ? commandDeck : null}
      {showEnemyTurnPanel ? renderEnemyTurnPanel() : null}
    </View>
  );

  const useEnemyArenaChrome = enemyChrome != null;

  const chromeSnapshot = useMemo(
    () => ({
      ultimatePingVisible: ultimatePingReady && enemyAlive,
      ultimatePingReady: ultimatePingReady && enemyAlive,
      ultimatePingDisabled: !isPlayerTurn
        || cycleState !== 'TEXT_COMBAT'
        || isExhausted
        || combatPausedRef.current
        || (sliceReady && playerApRef.current < EVISCERATE_AP_COST),
      ultimatePingVariant: ultimatePingVariant,
      masteryProgressVisible: masteryProgress.visible && isPlayerTurn && cycleState === 'TEXT_COMBAT',
      masteryProgressCurrent: masteryProgress.current,
      masteryProgressRequired: masteryProgress.required,
      masteryProgressAccent: masteryProgress.accent,
      onUltimatePing,
      parryVisible: cycleState === 'DEFEND_PARRY',
      wardVisible: cycleState === 'DEFEND_WARD',
      envoyWardSpeed,
      onEnvoyWardRelease: finalizeEnvoyWard,
      parryShrinkScale: parryScaleSV,
      parrySuccess: isSuccessState,
      parryFailure: isFailureState,
      parrySuccessBurstVisible: parrySuccessBurstActive,
      parryBurstArena,
      onParryTap,
      registerParryArena,
      registerSliceArena,
      sliceVisible: cycleState === 'OFFENSE_SLICE',
      eviscerateTargetUnitId,
      sliceLines,
      activeSliceIndex,
      slicePanHandlers: panResponder.panHandlers as Record<string, unknown>,
    }),
    [
      cycleState,
      parrySuccessBurstActive,
      parryBurstArena,
      ultimatePingReady,
      ultimatePingVariant,
      masteryProgress,
      sliceReady,
      enemyAlive,
      isPlayerTurn,
      isExhausted,
      envoyWardSpeed,
      isSuccessState,
      isFailureState,
      eviscerateTargetUnitId,
      sliceLines,
      activeSliceIndex,
      onUltimatePing,
      onParryTap,
      panResponder.panHandlers,
    ],
  );

  const fractureBreakUnit = fractureBreakUnitId
    ? getUnitById(squadRef.current, fractureBreakUnitId)
    : null;

  const renderHubOverlays = () => (
    <>
      {!useEnemyArenaChrome ? (
        <>
          <ParryMatrixOverlay
            visible={cycleState === 'DEFEND_PARRY'}
            shrinkScale={parryScaleSV}
            success={false}
            failure={false}
            onTap={onParryTap}
            onArenaLayout={registerParryArena}
          />
          {parrySuccessBurstActive && parryBurstArena ? (
            <View style={styles.parryBurstHost} pointerEvents="none">
              <View
                style={{
                  width: parryBurstArena.width,
                  height: parryBurstArena.height,
                }}
              >
                <ParrySuccessBurstOverlay
                  key={parryBurstEpoch}
                  burstEpoch={parryBurstEpoch}
                  arena={parryBurstArena}
                />
              </View>
            </View>
          ) : null}
          <VectorSliceOverlay
            visible={cycleState === 'OFFENSE_SLICE'}
            lines={sliceLines}
            activeIndex={activeSliceIndex}
            panHandlers={panResponder.panHandlers}
            onArenaLayout={registerSliceArena}
          />
        </>
      ) : null}

      {cycleState === 'RESOLUTION' && resolutionOutcome === 'DEFEAT' && (
        <View style={styles.resolutionOverlay}>
          <View style={styles.resolution}>
          <Text style={[styles.resTitle, { color: P.enemyHp }]}>
            OPERATIVE SOUL DISCONNECTED
          </Text>
          <Pressable
            onPress={() => {
              Vibration.vibrate(12);
              dismiss();
            }}
            style={[styles.resBtn, { borderColor: P.enemyHp }]}
          >
            <Text style={[styles.resBtnText, { color: P.enemyHp }]}>
              [ INCURSION FAILED ]
            </Text>
          </Pressable>
          </View>
        </View>
      )}
      <ActiveReloadOverlay
        visible={activeReloadVisible}
        perfectWindowScale={hexShotBoonMods.gunsmithsCurseActive ? 0.5 : 1}
        onResolve={handleActiveReloadResolve}
      />
      <ZeroProtocolGridOverlay
        visible={zeroProtocolVisible}
        onTap={handleZeroProtocolTap}
        onComplete={finishZeroProtocol}
      />
      <CataclysmSigilOverlay
        visible={cataclysmSigilVisible}
        onResolve={handleCataclysmResolve}
      />
      <FractureBreakPrompt
        visible={fractureBreakUnitId != null}
        designation={fractureBreakUnit?.designation}
        onBreach={() => {
          if (fractureBreakUnitId) executeFractureBreak(fractureBreakUnitId);
        }}
        onExpire={() => {
          if (fractureBreakUnitId) expireFractureBreak(fractureBreakUnitId);
        }}
      />
      {!useEnemyArenaChrome && cycleState === 'DEFEND_WARD' ? (
        <EnvoyWardOverlay
          visible
          expansionSpeed={envoyWardSpeed}
          onRelease={finalizeEnvoyWard}
        />
      ) : null}
    </>
  );

  return (
    <View style={[styles.rootStacked, { borderColor: theme.borderColor }]}>
      {useEnemyArenaChrome ? <CombatChromeBridge {...chromeSnapshot} /> : null}
      {screenFlashActive && (
        <View style={styles.flashWrapStacked} pointerEvents="none">
          <VignetteFlashOverlay color={screenFlashColor} opacityAnim={screenFlashAnim} />
        </View>
      )}
      <View style={styles.commandDeckRow}>
        {renderStatusFeed()}
        {renderCommandDeckSlot()}
        {renderCommandDeckDimOverlay()}
      </View>
      <CombatArenaOverlaySink>
        {renderHubOverlays()}
        <CombatFloatingFeedback
          key={combatFeedback?.nonce ?? 'idle'}
          event={combatFeedback?.event ?? null}
          onComplete={() => setCombatFeedback(null)}
        />
      </CombatArenaOverlaySink>
    </View>
  );
}

const abs = StyleSheet.absoluteFillObject;
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', alignSelf: 'stretch', minHeight: 0 },
  rootStacked: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 4,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  combatOverlayLayer: {
    ...abs,
    zIndex: 25,
  },
  parryBurstHost: {
    ...abs,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 26,
  },
  operativeGaugePanel: {
    width: '100%',
    flexShrink: 0,
    gap: 2,
    paddingVertical: 4,
  },
  commandDeckRow: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    gap: 3,
    backgroundColor: 'transparent',
  },
  commandDeckDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    zIndex: 8,
  },
  statusFeedSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    minHeight: 52,
    maxHeight: 52,
    justifyContent: 'flex-end',
    gap: 4,
    paddingBottom: 4,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  statusFeedSlotStacked: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    minHeight: 40,
    maxHeight: 40,
    justifyContent: 'flex-end',
    gap: 2,
    paddingBottom: 2,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  commandDeckAnchor: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  enemyTurnPanel: {
    width: '100%',
    minHeight: COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 11, 15, 0.96)',
  },
  enemyTurnTitle: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  enemyTurnHint: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.5,
  },
  statusFeedCompact: {
    flexShrink: 0,
    width: '100%',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionStageStacked: {
    flexShrink: 0,
    width: '100%',
    position: 'relative',
    minHeight: 48,
  },
  flashWrapStacked: {
    ...abs,
    zIndex: 100,
    overflow: 'hidden',
  },
  panel: { flex: 1, borderWidth: 2, padding: 16, width: '100%', overflow: 'hidden', flexDirection: 'column', minHeight: 0 },
  panelStacked: {
    flexShrink: 0,
    borderWidth: 2,
    padding: 12,
    width: '100%',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: { borderBottomWidth: 1, paddingBottom: 6, marginBottom: 8, flexShrink: 0 },
  headerText: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, flexShrink: 1, flexWrap: 'wrap' },
  telemetryStack: {
    flexShrink: 0,
    width: '100%',
    marginBottom: 8,
    backgroundColor: '#000000',
  },
  threatMatrix: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  threatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  threatId: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 12,
  },
  threatHp: {
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    lineHeight: 12,
    textAlign: 'right',
    maxWidth: '38%',
  },
  intentReadout: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.5,
    lineHeight: 10,
    opacity: 0.55,
    width: '100%',
  },
  telemetryDivider: {
    height: 1,
    width: '100%',
    backgroundColor: TELEMETRY_DIVIDER,
  },
  operativeCore: {
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  telemetryLine: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 12,
    paddingVertical: 4,
    width: '100%',
  },
  tacticsStage: { flex: 1, minHeight: 0, marginBottom: 8 },
  tacticsStageStacked: { flexShrink: 0, marginBottom: 0 },
  canvas: {
    position: 'relative',
    flex: 1,
    minHeight: 120,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  canvasStacked: {
    flexShrink: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  statusFeed: {
    flexShrink: 0,
    width: '100%',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionStage: {
    flexShrink: 0,
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
    backgroundColor: '#000000',
  },
  flashWrap: { ...abs, zIndex: 100, overflow: 'hidden' },
  phaseAlert: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'left',
    letterSpacing: 0.8,
    width: '100%',
  },
  exhaustedBanner: {
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 1,
    lineHeight: 12,
    textAlign: 'left',
    color: P.enemyHp,
    width: '100%',
  },
  aegisBanner: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 1,
    lineHeight: 12,
    textAlign: 'left',
    width: '100%',
  },
  combatOverlayLayerLegacy: {
    ...abs,
    zIndex: 25,
  },
  resolutionOverlay: {
    ...abs,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 50,
  },
  resolution: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 8, alignItems: 'center', width: '90%' },
  resTitle: { fontFamily: MONO, fontSize: 12, fontWeight: 'bold', marginBottom: 8, letterSpacing: 0.5 },
  resBtn: { borderWidth: 1, paddingVertical: 8, width: '80%', alignItems: 'center' },
  resBtnText: { fontFamily: MONO, fontSize: 10, fontWeight: 'bold' },
});
