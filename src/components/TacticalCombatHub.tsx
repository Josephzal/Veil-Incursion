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
  shouldChronoStunOnKineticHit,
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
import { COMBAT_CONSUMABLE_AP_COST, resolveHostileHpHit } from '../data/aegisAbilityResolver';
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
  hasMutation,
  type MutationCombatModifiers,
} from '../data/leyLineMutationEngine';
import type { LeyLineMutationId } from '../types/leyLineMutation';
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
} from '../data/combatTargeting';
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
import type { PlayerCombatState } from '../types/combatLifecycle';
import type { CombatSessionExtras } from '../types/combatHooks';
import { createDefaultCombatSessionExtras, addStructuredDebuff, hasStructuredDebuff, removeStructuredDebuff } from '../types/combatHooks';
import { isHeavyArchetype } from '../data/enemyCombatConfig';
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
import { BossRuntimeProfile, EnvironmentalModifiers } from '../types/game';
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
import {
  type CombatTurnPhase,
  useCombatTurnOptional,
} from '../context/CombatTurnContext';
import CombatTurnBanner from './combat/CombatTurnBanner';
import CombatDeckStrikeOverlay from './combat/CombatDeckStrikeOverlay';
import {
  type CombatEnemyTelemetry,
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
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
} from '../utils/combatTelemetryFormat';
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

const DEFEND_ABILITIES: AegisAbilityId[] = ['WRAITH_PARRY', 'ASHEN_MANTLE'];
const BUFF_ABILITIES: AegisAbilityId[] = ['DEMONS_LUNG', 'CRIMSON_PACT'];

const { width, height: windowHeight } = Dimensions.get('window');

/** Screen-right inset to stacked hub inner content (center gutter + paddingHorizontal). */
export const TACTICAL_HUB_STACKED_RIGHT_INSET = 16;
const MONO = 'monospace';
const P = {
  enemyHp: '#ef4444', unitTitle: '#ffffff', enemyPosture: '#fde68a',
  kr: '#bae6fd', krBorder: '#7dd3fc', parry: '#00ff33', defeat: '#5c0606',
};
const PARRY_DURATION = 1000;
const SLICE_HIT_HAPTIC_MS = 15;
const WARD_STRIKE_ACCENT = '#fde68a';
type CombatPhase = 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'OFFENSE_SLICE' | 'RESOLUTION';

interface TacticalCombatHubProps {
  /** Combat screen stack: operative metrics + deck only; hostile row lives on CombatScreen. */
  stackedLayout?: boolean;
  /** Pokemon-style arena: gauges on CombatScreen, strike FX on player sprite. */
  arenaLayout?: boolean;
  onEnemyTelemetryChange?: (enemy: CombatEnemyTelemetry | null) => void;
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
  leyLineMutations?: LeyLineMutationId[];
  combatDistrict?: 1 | 2 | 3;
  /** Spectral Salt in cargo — kinetic strikes bypass spectral resistance. */
  spectralSaltActive?: boolean;
  /** Bound requisition first-turn AP bonus (Adrenaline Primer). */
  firstTurnBonusAp?: number;
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
  stackedLayout = false,
  arenaLayout = false,
  onEnemyTelemetryChange,
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
  leyLineMutations = [],
  combatDistrict = 1,
  spectralSaltActive = false,
  firstTurnBonusAp = 0,
  narrativeCombatBoons,
  equippedBlueprintId = null,
  playerCritChanceBonus = 0,
  onPlayerCritImpact,
  godModeActive = false,
}: TacticalCombatHubProps): React.JSX.Element {
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
  const weaponLabel = (profile?.operative_profile?.payload_manifest?.active_slots?.weapon_id ?? 'kinetic_glaive')
    .replace(/_/g, ' ').toUpperCase();

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
  const [selectedAbility, setSelectedAbility] = useState<AegisAbilityId | null>(null);
  const [playerActionPoints, setPlayerActionPoints] = useState(PLAYER_ACTION_POINTS_PER_TURN);
  const [initiativeQueued, setInitiativeQueued] = useState(false);
  const [initiativeProcSeq, setInitiativeProcSeq] = useState(0);
  const [apRollupDisplay, setApRollupDisplay] = useState<number | null>(null);
  const [shadowstepProcActive, setShadowstepProcActive] = useState(false);
  const [enemyActionStage, setEnemyActionStage] = useState<EnemyActionStage>(null);
  const enemyActionStageRef = useRef<EnemyActionStage>(null);
  const [eviscerateTargetUnitId, setEviscerateTargetUnitId] = useState<string | null>(null);
  const [deckStrikeOverlay, setDeckStrikeOverlay] = useState<EnemyDeckStrikeVariant | null>(null);

  const operativeHpRef = useRef(initialOperativeHp);
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
  const counterRef = useRef(false);
  const pendingDmgRef = useRef(0);
  const pendingUnblockRef = useRef(false);
  /** HP already applied when the red deck strike overlay appeared. */
  const preAppliedHpStrikeRef = useRef(0);
  const enemyStunPendingRef = useRef(false);
  const hitFlashSeqRef = useRef<Record<string, number>>({});
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
  const mutationEncounterRef = useRef({
    adrenalineSpikeUsed: false,
    executionerHighUsed: false,
    flawlessConduitPending: false,
    gridGhostPending: false,
    momentumShiftPending: false,
    damageTakenThisTurn: false,
    secondWindUsed: false,
    unstoppableFractureUsed: false,
    masochistBuff: false,
    juggernautShield: false,
    spallWeaveActive: false,
    bloodTitheCooldown: 0,
    ashenMantleCooldown: 0,
    venomousRuinUnits: new Set<string>(),
    corruptedBloodUnits: new Set<string>(),
    bloodForTimeUsed: false,
  });

  const isCombatTerminal = () =>
    resolutionRef.current != null || operativeHpRef.current <= 0;

  const canPlayerCommand = () =>
    cycleRef.current === 'TEXT_COMBAT'
    && !shadowstepProcRef.current
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
    extras: sessionExtrasRef.current,
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

  const smogCallerActive = () =>
    aliveUnits(squadRef.current).some((u) => u.rosterId === 'smog-caller');

  const hookWeaverTetheredUnitId = () => {
    const weaver = aliveUnits(squadRef.current).find((u) => u.rosterId === 'hook-weaver');
    return weaver?.tetheredAllyUnitId ?? sessionExtrasRef.current.hookWeaverTetheredUnitId;
  };

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
  const counterReady = abyssalReserve >= COMBAT_ACTION.COUNTER_ABYSSAL_MIN && !isExhausted;
  const sliceReady = abyssalReserve >= mutationModsRef.current.abyssalCap && !isExhausted;
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

  const applyGodModeResources = () => {
    operativeHpRef.current = maxSoulAnchor;
    setOperativeHp(maxSoulAnchor);
    applyStamina(maxStamina);
    abyssalRef.current = mutationModsRef.current.abyssalCap;
    setAbyssalReserve(mutationModsRef.current.abyssalCap);
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
    const targetMode = staged ? abilityTargetMode(staged) : 'NONE';
    const playerSelecting = canPlayerCommand();
    const abilityTargeting = staged != null && targetMode === 'SINGLE';
    const targetingActive = playerSelecting || abilityTargeting;
    const validTargets = staged && abilityTargeting ? validTargetsForAbility(nextSquad, staged) : [];
    const validIds = new Set(validTargets.map((u) => u.unitId));
    onSquadUiChange({
      squadSize: aliveUnits(nextSquad).length,
      targetingActive,
      stagedAbilityId: staged,
      units: nextSquad.map((u) => {
        const unitId = u.unitId ?? u.designation;
        const threatTier = resolveEnemyThreatTier({
          isBoss: u.isBoss,
          isApex: u.isApex,
          rosterId: u.rosterId,
        });
        const hookValid = staged != null && isUnitHookValid(staged, u);
        const alive = isUnitAlive(u);
        const targetable = targetingActive && alive && (
          !staged || !abilityTargeting || validIds.has(u.unitId!) || hookValid
        );
        const blocked = staged != null && abilityTargeting
          && isUnitBlockedForAbility(nextSquad, staged, unitId)
          && !hookValid;
        const motionOptions = { arenaLayout, gridSlot: u.gridSlot ?? null };
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
          affinity: u.affinity,
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
          isElite: threatTier === 'ELITE' || threatTier === 'APEX',
          isVeilStalker: u.isVeilStalker,
          enemyClass: u.class,
          rosterId: u.rosterId,
          isDead: !isUnitAlive(u),
          isSelected: isPlayerTurnRef.current && selectedTargetIdRef.current === u.unitId,
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
    pendingVictoryRef.current = false;
    resolveVictoryRef.current();
    return true;
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
    if (staged && abilityRequiresTarget(staged)) {
      if (!canTargetWithAbility(squadRef.current, staged, unitId)) {
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
    if (arenaLayout) {
      playerViewportRef?.current?.triggerDamageEffect(variant);
      return;
    }
    setDeckStrikeOverlay(variant);
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
    setDeckStrikeOverlay(null);
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
    registerKillResolver?.(() => {
      if (arenaLayout) return;
      resolveVictoryRef.current();
    });
  }, [arenaLayout, registerKillResolver]);

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

  const resolveIncomingHpStrike = (e: EnemyCombatProfile): { raw: number; unblockable: boolean } | null => {
    if (getEnemyDeckStrikeVariant(e.intent) !== 'hp') return null;
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
      skipStrikeFx: arenaLayout,
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
    if (mutationEncounterRef.current.spallWeaveActive && raw > 0) {
      mutationEncounterRef.current.spallWeaveActive = false;
      log('[SPALL-WEAVE] >> Vest absorbed incoming damage.');
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
    if (!unblockable && abyssalWardRef.current) {
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
        hasStructuredDebuff(sessionExtrasRef.current, 'SEARING')
        && options?.attacker?.rosterId !== 'splinter'
      ) {
        const burst = 8;
        dmg += burst;
        log(`[SEARING] >> Secondary burst — +${burst} damage.`);
      }
      Vibration.vibrate([0, 32, 48, 28]);
      if (arenaLayout && !options?.skipStrikeFx) {
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
    },
  ): boolean => {
    const targetId = options?.targetId
      ?? selectedTargetIdRef.current
      ?? primaryAliveUnit(squadRef.current)?.unitId;
    const e = targetId
      ? getUnitById(squadRef.current, targetId)
      : enemyRef.current;
    if (!e || !e.unitId) return false;
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
    const overchargedStrike = Boolean(
      source && sessionExtrasRef.current.overchargedActive,
    );
    if (source && source !== 'COUNTER' && !options?.echoHit && options?.rollCrit !== false) {
      const hit = resolvePlayerAttackHit(
        { defender: working },
        {
          abilityId: options?.abilityId,
          target: working,
          factionCritBonus: playerCritChanceBonus,
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
    if (overchargedStrike) {
      ignoreDefenses = true;
    }
    if (
      source === 'STRIKE'
      && options?.channel === 'KINETIC'
      && mutationModsRef.current.strikeArmorPierce > 0
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
    if (fractureGain > 0) {
      working = applyFractureDamage(working, fractureGain);
    }
    let dmg = raw;
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
      if (mutationModsRef.current.abyssalResonancePctPer10Stam > 0 && source === 'STRIKE') {
        const bonus = Math.floor(staminaRef.current / 10) * mutationModsRef.current.abyssalResonancePctPer10Stam;
        dmg = Math.floor(dmg * (1 + bonus / 100));
      }
      if (mutationEncounterRef.current.masochistBuff) {
        dmg = Math.floor(dmg * 1.5);
      }
      const scaled = scaleKineticDamage(
        dmg,
        working.affinity,
        0,
        spectralSaltActive,
      );
      if (!overchargedStrike) {
        if (scaled !== dmg) {
          const imbueNote = spectralSaltActive && working.affinity === 'SPECTRAL'
            ? ' // SPECTRAL SALT IMBUE'
            : '';
          log(`${tag} >> Kinetic scaling ${dmg} → ${scaled}.${imbueNote}`);
        }
        dmg = scaled;
      }
      if (
        equippedBlueprintId === 'riftshot_pulse_rifle'
        && working.affinity === 'SPECTRAL'
        && source
      ) {
        dmg = Math.floor(dmg * 2);
        log(`${tag} >> Pulse rifle spectral resonance — 2× (${dmg}).`);
      }
    }
    if (options?.channel === 'TRUE' || overchargedStrike) {
      dmg = applyDamageWithFractureBonus(dmg, working);
    } else if (options?.channel) {
      const hit = resolveHostileHpHit(working, dmg, options.channel, { ignoreDefenses });
      working = hit.enemy;
      dmg = hit.hpDamage;
    }
    if (!overchargedStrike && (env.enemyDamageReductionPct ?? 0) > 0) {
      dmg = Math.floor(dmg * (1 - (env.enemyDamageReductionPct ?? 0) / 100));
    }
    if (critical && dmg > 0 && !options?.echoHit) {
      dmg = applyCritMultiplier(dmg, COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER);
      const critChannel = options?.channel ?? 'KINETIC';
      if (e.unitId) {
        const prev = critImpactSeqRef.current[e.unitId]?.seq ?? 0;
        critImpactSeqRef.current[e.unitId] = { seq: prev + 1, channel: critChannel };
        publishSquadUi(squadRef.current);
        onPlayerCritImpact?.({ unitId: e.unitId, channel: critChannel });
      }
      apparitionRef?.current?.triggerPlayerCritSunder(critChannel === 'OCCULT' ? 'OCCULT' : 'KINETIC');
    }
    if (!overchargedStrike) {
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
      if (hitLifecycle.squad.length > 0) syncSquad(hitLifecycle.squad);
      working = getUnitById(squadRef.current, e.unitId!) ?? working;
      if (hitLifecycle.negateDamage) dmg = 0;
      else if (hitLifecycle.damageOverride != null) dmg = hitLifecycle.damageOverride;
      if (hitLifecycle.showImmunePopup && hitLifecycle.immunePopupUnitId) {
        publishSquadUi(squadRef.current);
      }
    }

    const hadEvadePosture = !overchargedStrike && working.evadeActive && dmg > 0;
    const hadFortify = !overchargedStrike && (working.fortifyTurnsRemaining ?? 0) > 0 && dmg > 0;
    if (hadEvadePosture) {
      dmg = Math.floor(dmg * 0.5);
      log(`${tag} >> EVADE POSTURE — 50% (${dmg}).`);
    }
    if (hadFortify) {
      dmg = Math.floor(dmg * 0.5);
      log(`${tag} >> FORTIFIED — 50% (${dmg}).`);
    }
    if (!hadEvadePosture && !hadFortify) {
      if (critical) {
        log(`${tag} >> [ CRITICAL ] ${dmg} damage.`);
      } else {
        log(`${tag} >> ${dmg} damage.`);
      }
    }
    if (overchargedStrike && source && dmg > 0) {
      sessionExtrasRef.current.overchargedActive = false;
      log('[OVERCHARGED BOON] >> First strike bypassed all mitigation.');
    }
    if (source && dmg > 0 && e.unitId) {
      trackVoidAmbushInterruptDamage(e.unitId, dmg);
    }
    if (source && arenaLayout) {
      const targetSlot = (working.gridSlot ?? 'FL_0') as CombatGridSlotId;
      const arenaHeight = Math.max(windowHeight * 0.28, 200);
      const lungeDelta = playerAttackLungeDelta(
        targetSlot,
        arenaLayoutModeRef.current,
        width,
        arenaHeight,
      );
      playerViewportRef?.current?.triggerAttackLunge(lungeDelta);
    }
    const poolHp = working.sharedBossPool && bossRuntimeRef.current
      ? Math.max(bossRuntimeRef.current.currentHp - dmg, 0)
      : Math.max(working.currentHp - dmg, 0);
    const hp = poolHp;

    if (hp <= 0 && e.unitId && source && options?.channel) {
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

    if (source && dmg > 0 && e.unitId) {
      const tetheredId = hookWeaverTetheredUnitId();
      if (tetheredId && tetheredId === e.unitId) {
        applyStamina(Math.max(0, staminaRef.current - 10));
        log('>> HOOK WEAVER TETHER — 10 stamina siphoned.');
      }
      hitFlashSeqRef.current[e.unitId] = (hitFlashSeqRef.current[e.unitId] ?? 0) + 1;
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
    if (source && shouldChronoStunOnKineticHit(working.affinity, source) && dmg > 0) {
      enemyStunPendingRef.current = true;
      log('[CHRONO SHATTER] >> Temporal sync fractured — hostile turn forfeited.');
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

    const viewport = apparitionRef?.current;

    if (allUnitsDefeated(squadRef.current)) {
      if (cycleRef.current === 'DEFEND_PARRY') {
        if (arenaLayout) pendingVictoryRef.current = true;
        return true;
      }
      if (cycleRef.current === 'OFFENSE_SLICE') {
        abortCombatMinigames();
        cycleRef.current = 'TEXT_COMBAT';
        setCycleState('TEXT_COMBAT');
      }
      if (arenaLayout) {
        pendingVictoryRef.current = true;
        return true;
      }
      if (viewport) {
        viewport.triggerEradication();
        return true;
      }
      resolve(true);
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
    if (
      hp <= 0
      && source
      && options?.channel === 'KINETIC'
      && hasMutation(leyLineMutations, 'EXECUTIONERS_HIGH')
      && !mutationEncounterRef.current.executionerHighUsed
    ) {
      mutationEncounterRef.current.executionerHighUsed = true;
      combatBuffRef.current.bonusApThisTurn += 1;
      playerApRef.current += 1;
      setPlayerActionPoints(playerApRef.current);
      log("[EXECUTIONER'S HIGH] >> Physical kill — +1 AP.");
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
      const nextFocus = primaryAliveUnit(squadRef.current);
      if (nextFocus?.unitId) selectTarget(nextFocus.unitId);
    } else {
      viewport?.triggerDamageEffect();
    }
    return false;
  };

  markPlayerDefendedRef.current = () => {
    sessionExtrasRef.current.playerDefendedThisTurn = true;
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
        });
        log(`[CORRUPTED BLOOD] >> ${unit.designation} — void bleed.`);
      }
    }
  };

  const applyEviscerateAftermath = () => {
    const mods = mutationModsRef.current;
    abyssalRef.current = 0;
    setAbyssalReserve(0);
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
    const drain = Math.min(extras.playerShield, ROSTER_AI_WEIGHTS.FRACTURE_HOUND_SHIELD_DRAIN);
    extras.playerShield -= drain;
    log(`>> FRACTURE HOUND — ${drain} shield integrity siphoned.`);
  };

  const applyStaminaDrainLeap = (attacker: EnemyCombatProfile) => {
    const beforeStamina = staminaRef.current;
    applyStamina(beforeStamina - 20);
    log(`>> ${attacker.designation} STAMINA DRAIN LEAP — stamina siphoned (-20).`);
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
        log(`>> ${e.designation} EVADE posture — strikes deal 50%.`);
        break;
      case 'FORTIFY': {
        log(`>> ${e.designation} FORTIFY — kinetic shell hardened (2 turns).`);
        if (e.unitId) {
          patchUnit(e.unitId, { fortifyTurnsRemaining: 2 });
          publishSquadUi(squadRef.current);
        }
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
        if (e.isEnraged) {
          log(`>> ${e.designation} DOUBLE STRIKE — enraged true occult cleave.`);
          hurtPlayer(dmg, true, `>> DOUBLE STRIKE 1 — ${dmg} TRUE OCCULT`, { attacker: e, rollCrit: false });
          if (operativeHpRef.current > 0) {
            hurtPlayer(dmg, true, `>> DOUBLE STRIKE 2 — ${dmg} TRUE OCCULT`, { attacker: e, rollCrit: false });
          }
        } else {
          if (e.rosterId === 'fracture-hound') applyFractureHoundShieldDrain(e);
          log(`>> ${e.designation} DOUBLE STRIKE — twin cleave.`);
          hurtPlayer(dmg, false, `>> DOUBLE STRIKE 1 — ${dmg}`, { attacker: e });
          if (operativeHpRef.current > 0) {
            hurtPlayer(dmg, false, `>> DOUBLE STRIKE 2 — ${dmg}`, { attacker: e, rollCrit: false });
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
        if (!e.unitId) break;
        patchUnit(e.unitId, { veilBarrierCharges: 2 });
        log(`>> ${e.designation} VEIL BARRIER — 2 hit charges active.`);
        break;
      }
      case 'TARGET_LOCK': {
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'TARGET_LOCKED',
          turnsRemaining: 2,
        });
        log(`>> ${e.designation} TARGET LOCK — heavy strikes will crit.`);
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
        log(`>> ${e.designation} ARTILLERY CHARGE — ordnance priming.`);
        break;
      case 'LASER_SIGHT': {
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'LASER_SIGHT',
          turnsRemaining: 1,
        });
        log(`>> ${e.designation} LASER SIGHT — true damage lock acquired.`);
        break;
      }
      case 'ARTILLERY_FIRE': {
        const isSapper = e.rosterId === 'sapper';
        const isSniper = e.rosterId === 'coil-spike-sniper';
        const dmg = resolveRosterEnemyDamage(e, 'ARTILLERY_FIRE');
        if (isSapper) {
          sessionExtrasRef.current.playerShield = 0;
          sessionExtrasRef.current.playerShieldTurnsRemaining = 0;
          log(`>> ${e.designation} BUNKER BUSTER — shields stripped, ${dmg} unblockable.`);
          hurtPlayer(dmg, true, `>> BUNKER BUSTER — ${dmg}`, { attacker: e, rollCrit: false });
        } else if (isSniper) {
          log(`>> ${e.designation} TRUE SHOT — ${dmg} (armor bypassed).`);
          hurtPlayer(dmg, true, `>> TRUE SHOT — ${dmg}`, { attacker: e, rollCrit: false });
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
        hurtPlayer(dmg, false, `>> TAR BIND — ${dmg}`, { attacker: e });
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'ROOTED',
          turnsRemaining: 1,
        });
        log(`>> ${e.designation} ROOTED — defend/evade disabled.`);
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
        const slot = Math.floor(Math.random() * 3);
        sessionExtrasRef.current = {
          ...sessionExtrasRef.current,
          jammedAugmentSlot: slot,
        };
        addStructuredDebuff(sessionExtrasRef.current, {
          type: 'JAMMED_AUGMENT',
          turnsRemaining: 2,
        });
        log(`>> ${e.designation} JAMMED AUGMENT — loadout slot ${slot + 1} disabled.`);
        break;
      }
      default: break;
    }
    const rosterPatch = patchRosterAfterIntentExec(e, e.intent);
    if (e.unitId && Object.keys(rosterPatch).length > 0 && e.intent !== 'VOID_AMBUSH') {
      patchUnit(e.unitId, rosterPatch);
    }
  };

  const endEnemyTurn = (advanceIntent = true) => {
    if (isCombatTerminal()) return;
    if (operativeHpRef.current <= 0 || allUnitsDefeated(squadRef.current)) return;
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
    !isExhausted
    && abyssalRef.current >= COMBAT_ACTION.COUNTER_ABYSSAL_MIN
    && staminaRef.current >= COMBAT_ACTION.COUNTER_STAMINA;

  const resolveEnemyAction = (countering: boolean) => {
    if (isCombatTerminal()) return;
    const currentEnemy = enemyRef.current;
    if (!currentEnemy || operativeHpRef.current <= 0) {
      setEnemyActionStage(null);
      setDeckStrikeOverlay(null);
      return;
    }
    if (!isUnitAlive(currentEnemy)) {
      setEnemyActionStage(null);
      setDeckStrikeOverlay(null);
      if (enemyActionQueueRef.current.length > 0) scheduleNextEnemyAction(countering);
      else if (!allUnitsDefeated(squadRef.current)) endEnemyTurn(true);
      return;
    }
    setEnemyActionStage(null);
    setDeckStrikeOverlay(null);
    if (countering && openParryWindow(currentEnemy, true)) return;
    if (!countering && openParryWindow(currentEnemy, false)) return;
    const hpStrikeResolved = commitPendingPlayerDamage(false, undefined, currentEnemy);
    if (hpStrikeResolved && currentEnemy.intent === 'VOID_AMBUSH') {
      finalizeNullShadeVoidAmbush(currentEnemy);
    } else if (!hpStrikeResolved) {
      execIntent(currentEnemy);
    }
    if (cycleRef.current === 'DEFEND_PARRY') return;
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
    const turnStart = CombatLifecycleManager.runOnTurnStart(unit, buildLifecycleContext());
    turnStart.logLines.forEach((line) => log(line));
    applyLifecycleExtras(turnStart.extras);
    applyLifecyclePlayerDelta(turnStart.playerHpDelta);
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
      && enemyActionQueueRef.current[1] !== unit.unitId
      && Math.random() < FRACTURE_HOUND_DOUBLE_STRIKE_CHANCE
    ) {
      enemyActionQueueRef.current.splice(1, 0, unit.unitId);
      log(`>> ${unit.designation} DOUBLE STRIKE — twin cleave queued.`);
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
      const motionOptions = { arenaLayout, gridSlot: acting.gridSlot ?? null };
      const motionKind = classifyEnemyTurnMotion(effectiveIntent, motionOptions);
      const overlayVariant = getEnemyDeckStrikeVariant(effectiveIntent);
      const isBacklineMelee = arenaLayout
        && acting.gridSlot?.startsWith('BL') === true
        && motionKind === 'melee';
      const isFrontlineMelee = arenaLayout
        && acting.gridSlot?.startsWith('FL') === true
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

  const openParryWindow = (e: EnemyCombatProfile, fromCounterStance: boolean): boolean => {
    if (e.intent === 'WORLD_ENDER') {
      if (fromCounterStance) {
        log('[COUNTER FAILED] >> World-Ender cannot be parried.');
        counterRef.current = false;
        setCounterPrepActive(false);
      }
      return false;
    }
    if (!isAttackIntent(e.intent)) {
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
    mutationEncounterRef.current = {
      adrenalineSpikeUsed: false,
      executionerHighUsed: false,
      flawlessConduitPending: false,
      gridGhostPending: false,
      momentumShiftPending: false,
      damageTakenThisTurn: false,
      secondWindUsed: false,
      unstoppableFractureUsed: false,
      masochistBuff: false,
      juggernautShield: false,
      spallWeaveActive: false,
      bloodTitheCooldown: 0,
      ashenMantleCooldown: 0,
      venomousRuinUnits: new Set<string>(),
      corruptedBloodUnits: new Set<string>(),
      bloodForTimeUsed: false,
    };
    sessionExtrasRef.current = createDefaultCombatSessionExtras();
    combatChanceRef.current = createDefaultCombatChanceState();
    if (narrativeCombatBoons?.veilWard) {
      sessionExtrasRef.current.playerShield = 15;
      sessionExtrasRef.current.narrativeVeilWardActive = true;
    }
    if (narrativeCombatBoons?.overcharged) {
      sessionExtrasRef.current.overchargedActive = true;
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
    setDeckStrikeOverlay(null);
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
      if (unit.affinity) log(`>> AFFINITY // ${unit.affinity}`);
    });
    if (entryAr > 0) log(`>> Abyssal reserve pre-charged to ${entryAr}%.`);
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
    if (arenaLayout && feedback > 0) {
      playerViewportRef?.current?.triggerDamageEffect('hp');
    }
    setOperativeHp((p) => {
      const n = Math.max(p - feedback, 0);
      operativeHpRef.current = n;
      if (n <= 0) resolve(false);
      return n;
    });
  };

  const executeAbility = (abilityId: AegisAbilityId) => {
    if (cycleState !== 'TEXT_COMBAT' || !canPlayerCommand() || !enemyRef.current) return;
    if (
      hasStructuredDebuff(sessionExtrasRef.current, 'ASHEN_ROT')
      && isBuffOrDefendAbility(abilityId)
    ) {
      const rotCost = 50;
      applyStamina(Math.max(0, staminaRef.current - rotCost));
      log(`>> ROT TRIGGERED! −${rotCost} Stamina`);
    }
    const def = getAbilityDefinition(abilityId);
    if (!spendActionPoints(def.apCost)) {
      log('[REJECTED] >> Insufficient action points.');
      return;
    }

    switch (abilityId) {
      case 'STRIKE': {
        if (godModeRef.current) {
          const kinetic = GOD_MODE_STRIKE_DAMAGE;
          const eradicated = hurtEnemy(kinetic, '[STRIKE]', 'STRIKE', { channel: 'KINETIC', fractureGain: 25 });
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
        if (smogCallerActive() && strikeTarget?.gridSlot?.startsWith('FL')) {
          strikeStaminaCost *= 2;
          log('>> SMOG CALLER — choking hazard doubles melee stamina cost.');
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
        const eradicated = hurtEnemy(kinetic, '[STRIKE]', 'STRIKE', { channel: 'KINETIC', fractureGain: 25 });
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
      case 'CRIMSON_PACT': {
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
          mutationMods: mutationModsRef.current,
          bloodTitheCooldown: mutationEncounterRef.current.bloodTitheCooldown,
          setShadowStepEvadeActive: (active) => {
            combatChanceRef.current.shadowStepEvadeActive = active;
          },
        });
        if (abilityId === 'RUIN' && result.ok && mutationModsRef.current.ruinDotFracture > 0) {
          for (const unit of aliveUnits(squadRef.current)) {
            if (unit.unitId) mutationEncounterRef.current.venomousRuinUnits.add(unit.unitId);
          }
          log('[VENOMOUS RUIN] >> Lingering fracture hazard seeded.');
        }
        if (abilityId === 'SHADOW_STEP' && result.ok && hasMutation(leyLineMutations, 'JUGGERNAUT_PLATING')) {
          mutationEncounterRef.current.juggernautShield = true;
          log('[JUGGERNAUT PLATING] >> Shadow Step shield primed.');
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
        playerApRef.current += def.apCost;
        setPlayerActionPoints(playerApRef.current);
        break;
    }
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
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || shadowstepProcRef.current) return;
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

  const onSlice = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (isExhausted) { log('[REJECTED] >> Exhausted — eviscerate offline.'); return; }
    if (playerApRef.current < EVISCERATE_AP_COST) {
      log(`[REJECTED] >> Eviscerate requires ${EVISCERATE_AP_COST} AP.`);
      return;
    }
    const cap = mutationModsRef.current.abyssalCap;
    if (abyssalRef.current < cap) {
      log(`[REJECTED] >> AR below ${cap}%.`);
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
    if (arenaLayout) {
      pendingVictoryRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(tryResolvePendingVictory);
      });
      return;
    }
    const viewport = apparitionRef?.current;
    if (viewport) {
      viewport.triggerEradication();
      return;
    }
    resolve(true);
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
    if (!stackedLayout || !onResolutionPanelChange) return;
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
  }, [stackedLayout, cycleState, resolutionOutcome, onResolutionPanelChange]);

  const isAbilityEnabled = (abilityId: AegisAbilityId): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT' || shadowstepProcRef.current) return false;
    if (hasStructuredDebuff(sessionExtrasRef.current, 'ROOTED')
      && (abilityId === 'WRAITH_PARRY' || abilityId === 'SHADOW_STEP')) {
      return false;
    }
    const jammedSlot = sessionExtrasRef.current.jammedAugmentSlot;
    if (jammedSlot != null && aegisLoadout[jammedSlot] === abilityId) return false;
    const def = getAbilityDefinition(abilityId);
    if (playerActionPoints < def.apCost) return false;
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

  const getAbilityAccent = (abilityId: AegisAbilityId): string | undefined => {
    if (abilityId === 'WRAITH_PARRY' && wraithParryRef.current) return P.parry;
    if (abilityId === 'ASHEN_MANTLE' && abyssalWardActive) return WARD_STRIKE_ACCENT;
    return undefined;
  };

  const getStagedHeader = (abilityId: AegisAbilityId): string => {
    const name = getAbilityDefinition(abilityId).label.replace(/^\[|\]$/g, '').trim();
    return `SYSTEM READY // ${name} SELECTED`;
  };

  const getStagedCostImpact = (abilityId: AegisAbilityId): string => {
    const def = getAbilityDefinition(abilityId);
    return `COST: ${def.apCost} AP // ${def.staminaCost > 0 ? `${def.staminaCost} STAM` : def.staminaCostPct ? `${def.staminaCostPct}% STAM` : '0 STAM'}\n${def.description}`;
  };

  const confirmSelectedAbility = () => {
    if (!selectedAbility) return;
    if (abilityRequiresTarget(selectedAbility)) {
      const targetId = selectedTargetIdRef.current;
      if (!targetId || !canTargetWithAbility(squadRef.current, selectedAbility, targetId)) {
        log('[TARGET] >> Select a valid hostile on the grid.');
        publishSquadUi(squadRef.current);
        return;
      }
    }
    executeAbility(selectedAbility);
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
  }, [isPlayerTurn, cycleState, selectedAbility, selectedTargetId]);

  useEffect(() => {
    if (!stackedLayout || !onEnemyTelemetryChange) return;
    if (!enemy) {
      onEnemyTelemetryChange(null);
      return;
    }
    onEnemyTelemetryChange({
      designation: enemy.designation,
      currentHp: enemy.currentHp,
      maxHp: enemy.maxHp,
      intent: enemy.intent,
      affinity: enemy.affinity,
      fractureGauge: enemy.fractureGauge ?? 0,
      fractureMax: enemy.fractureMax ?? 100,
      kineticArmor: enemy.kineticArmor ?? 0,
      occultWards: enemy.occultWards ?? 0,
      combatTags: enemy.combatTags ?? [],
    });
  }, [
    stackedLayout,
    onEnemyTelemetryChange,
    enemy?.designation,
    enemy?.currentHp,
    enemy?.maxHp,
    enemy?.intent,
    enemy?.affinity,
    enemy?.fractureGauge,
    enemy?.fractureMax,
    enemy?.kineticArmor,
    enemy?.occultWards,
    enemy?.combatTags,
  ]);

  useEffect(() => {
    onWardPrimedChange?.(abyssalWardActive);
  }, [abyssalWardActive, onWardPrimedChange]);

  useEffect(() => {
    onAbilityPrimedChange?.(selectedAbility != null);
  }, [selectedAbility, onAbilityPrimedChange]);

  useEffect(() => {
    if (!stackedLayout || !arenaLayout || !onOperativeTelemetryChange) return;
    onOperativeTelemetryChange({
      operativeHp,
      maxSoulAnchor,
      abyssalReserve,
      stamina,
      maxStamina,
      counterReady,
    });
  }, [
    stackedLayout,
    arenaLayout,
    onOperativeTelemetryChange,
    operativeHp,
    maxSoulAnchor,
    abyssalReserve,
    stamina,
    maxStamina,
    counterReady,
  ]);

  const enemyAlive = (enemy?.currentHp ?? 0) > 0;
  const soulAnchorRatio = maxSoulAnchor > 0 ? operativeHp / maxSoulAnchor : 0;
  const abyssalCap = mutationModsRef.current.abyssalCap;
  const abyssalRatio = abyssalCap > 0 ? abyssalReserve / abyssalCap : 0;
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;
  const bloodForTimeOwned = hasMutation(leyLineMutations, 'BLOOD_FOR_TIME');

  const commandDeck = (
    <CombatCommandDeck
      loadout={aegisLoadout}
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
      isActionEnabled={isAbilityEnabled}
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
      borderColor={theme.borderColor}
      primaryColor={theme.primaryColor}
      mutedColor={theme.mutedColor}
      frameless={stackedLayout}
    />
  );

  const stackedOperativeMetrics = (
    <View style={styles.operativeGaugePanel} pointerEvents="none">
      <CombatTelemetryGaugeRow
        label={`SOUL ANCHOR INTEGRITY // ${operativeHp}/${maxSoulAnchor}`}
        labelColor={P.enemyHp}
        fillColor={GAUGE_SOUL_ANCHOR}
        ratio={soulAnchorRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
      />
      <CombatTelemetryGaugeRow
        label={`ABYSSAL RESERVE // ${abyssalReserve}/${abyssalCap}%${counterReady ? ' // COUNTER READY' : ''}`}
        labelColor={P.kr}
        fillColor={GAUGE_ABYSSAL}
        ratio={abyssalRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
      />
      <CombatTelemetryGaugeRow
        label={`STAMINA CORE // ${stamina}/${maxStamina}`}
        labelColor={theme.primaryColor}
        fillColor={GAUGE_STAMINA}
        ratio={staminaRatio}
        trackBorderColor={GAUGE_TRACK_BORDER}
      />
    </View>
  );

  const legacyTelemetryBlock = (
    <View style={styles.telemetryStack} pointerEvents="none">
      {enemy ? (
        <View style={styles.threatMatrix}>
          <View style={styles.threatRow}>
            <Text
              style={[styles.threatId, { color: P.unitTitle }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {`HOSTILE_ID // ${formatHostileId(enemy.designation)}`}
            </Text>
            <Text style={[styles.threatHp, { color: P.enemyHp }]} numberOfLines={1}>
              {`HP: ${enemy.currentHp}/${enemy.maxHp}`}
            </Text>
          </View>
          <Text
            style={[styles.intentReadout, { color: theme.mutedColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {`INTENT // ${formatIntentReadout(enemy.intent)}`}
          </Text>
        </View>
      ) : null}
      <View style={styles.telemetryDivider} />
      <View style={styles.operativeCore}>
        <Text style={[styles.telemetryLine, { color: P.enemyHp }]} numberOfLines={1}>
          {`SOUL ANCHOR INTEGRITY // ${operativeHp}/${maxSoulAnchor}`}
        </Text>
        <Text style={[styles.telemetryLine, { color: P.kr }]} numberOfLines={1} ellipsizeMode="tail">
          {`ABYSSAL RESERVE // ${abyssalReserve}%${counterReady ? ' // COUNTER READY' : ''}`}
        </Text>
        <Text style={[styles.telemetryLine, { color: theme.primaryColor }]} numberOfLines={1}>
          {`STAMINA CORE // ${stamina}/${maxStamina}`}
        </Text>
      </View>
    </View>
  );

  const holdVictoryChrome =
    cycleState === 'RESOLUTION' && resolutionOutcome === 'VICTORY';

  const resolutionActive =
    cycleState === 'RESOLUTION' && resolutionOutcome != null;

  const renderCommandDeckDimOverlay = () =>
    resolutionActive ? (
      <View style={styles.commandDeckDimOverlay} pointerEvents="none" />
    ) : null;

  const renderTurnBanner = () => (
    <CombatTurnBanner
      phase={holdVictoryChrome ? lastActiveTurnPhaseRef.current : combatTurnPhase}
      primaryColor={theme.primaryColor}
      mutedColor={theme.mutedColor}
      enemyIntent={enemy?.intent}
    />
  );

  const renderStatusFeed = () => (
    <View
      style={stackedLayout ? styles.statusFeedSlotStacked : styles.statusFeedSlot}
      pointerEvents="none"
    >
      {cycleState === 'TEXT_COMBAT' ? (
        <>
          {phaseAlert ? (
            <Text style={[styles.phaseAlert, { color: '#ef4444' }]}>{phaseAlert}</Text>
          ) : null}
          {isExhausted ? (
            <Text style={styles.exhaustedBanner}>EXHAUSTED — COUNTER/SLICE OFFLINE</Text>
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
      {deckStrikeOverlay && !arenaLayout ? <CombatDeckStrikeOverlay variant={deckStrikeOverlay} /> : null}
    </View>
  );

  const useEnemyArenaChrome = stackedLayout && enemyChrome != null;

  const chromeSnapshot = useMemo(
    () => ({
      slicePingVisible: sliceReady && enemyAlive,
      slicePingReady: sliceReady && enemyAlive,
      slicePingDisabled: !isPlayerTurn
        || cycleState !== 'TEXT_COMBAT'
        || isExhausted
        || playerApRef.current < EVISCERATE_AP_COST
        || abyssalRef.current < mutationModsRef.current.abyssalCap,
      onSlicePing: onSlice,
      parryVisible: cycleState === 'DEFEND_PARRY',
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
      stackedLayout,
      cycleState,
      parrySuccessBurstActive,
      parryBurstArena,
      sliceReady,
      enemyAlive,
      isPlayerTurn,
      isExhausted,
      isSuccessState,
      isFailureState,
      eviscerateTargetUnitId,
      sliceLines,
      activeSliceIndex,
      onSlice,
      onParryTap,
      panResponder.panHandlers,
    ],
  );

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

      {cycleState === 'RESOLUTION' && (!stackedLayout || resolutionOutcome === 'DEFEAT') && (
        <View style={styles.resolutionOverlay}>
          <View style={styles.resolution}>
          <Text style={[styles.resTitle, { color: resolutionOutcome === 'VICTORY' ? '#22c55e' : P.enemyHp }]}>
            {resolutionOutcome === 'VICTORY' ? 'HOSTILE NEUTRALIZED' : 'OPERATIVE SOUL DISCONNECTED'}
          </Text>
          <Pressable
            onPress={() => {
              Vibration.vibrate(12);
              dismiss();
            }}
            style={[styles.resBtn, { borderColor: resolutionOutcome === 'VICTORY' ? theme.primaryColor : P.enemyHp }]}
          >
            <Text style={[styles.resBtnText, { color: resolutionOutcome === 'VICTORY' ? theme.primaryColor : P.enemyHp }]}>
              {resolutionOutcome === 'VICTORY' ? '[ CONTINUE RUN ]' : '[ INCURSION FAILED ]'}
            </Text>
          </Pressable>
          </View>
        </View>
      )}
    </>
  );

  if (stackedLayout) {
    return (
      <View style={[styles.rootStacked, { borderColor: theme.borderColor }]}>
        {useEnemyArenaChrome ? <CombatChromeBridge {...chromeSnapshot} /> : null}
        {screenFlashActive && (
          <View style={styles.flashWrapStacked} pointerEvents="none">
            <VignetteFlashOverlay color={screenFlashColor} opacityAnim={screenFlashAnim} />
          </View>
        )}
        {!arenaLayout ? stackedOperativeMetrics : null}
        <View style={styles.commandDeckRow}>
          {renderStatusFeed()}
          {renderTurnBanner()}
          {renderCommandDeckSlot()}
          {renderCommandDeckDimOverlay()}
        </View>
        <View style={styles.combatOverlayLayer} pointerEvents="box-none">
          {renderHubOverlays()}
          <CombatFloatingFeedback
            key={combatFeedback?.nonce ?? 'idle'}
            event={combatFeedback?.event ?? null}
            onComplete={() => setCombatFeedback(null)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.panel, { borderColor: theme.borderColor }]}>
        <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
          <Text style={[styles.headerText, { color: theme.mutedColor }]}>
            TACTICAL COMBAT HUB // AEGIS // {weaponLabel}
          </Text>
        </View>

        {legacyTelemetryBlock}

        <View style={styles.tacticsStage}>
          <View style={styles.canvas}>
            {screenFlashActive && (
              <View style={styles.flashWrap} pointerEvents="none">
                <VignetteFlashOverlay color={screenFlashColor} opacityAnim={screenFlashAnim} />
              </View>
            )}
            <View style={styles.actionStage}>
              {renderStatusFeed()}
              {renderTurnBanner()}
              {renderCommandDeckSlot()}
              {renderCommandDeckDimOverlay()}
            </View>
            <View style={styles.combatOverlayLayerLegacy} pointerEvents="box-none">
              {renderHubOverlays()}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const abs = StyleSheet.absoluteFillObject;
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: width - 16, alignSelf: 'center', minHeight: 0 },
  rootStacked: {
    flexShrink: 0,
    width: '100%',
    maxWidth: width - 16,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 6,
    overflow: 'hidden',
    backgroundColor: '#000000',
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
    flexShrink: 0,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000000',
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
    flexShrink: 0,
    width: '100%',
    minHeight: COMMAND_DECK_MIN_HEIGHT_WITH_ULTIMATE,
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
