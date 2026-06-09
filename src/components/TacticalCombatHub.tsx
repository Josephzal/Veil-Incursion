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
import { INITIAL_SECTOR_POOL } from '../data/regions';
import { advanceEnemyIntent, spawnEnemyProfile } from '../data/enemies';
import {
  computeBloodFrenzyHeal,
  scaleKineticDamage,
  shouldChronoStunOnKineticHit,
  type KineticDamageSource,
} from '../data/combatEnvironmentEngine';
import { bossStrikeDamage, rollBossIntent, shouldShiftBossPhase } from '../data/bossCombat';
import { COMBAT_ACTION, ENEMY_ABYSSAL_SIPHON_REQUEST, EnemyCombatProfile, EnemyIntent } from '../types/run';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';

import { ResolvedWeaponCombatStats } from '../data/inventory';
import { BossRuntimeProfile, EnvironmentalModifiers } from '../types/game';
import CombatTelemetryGaugeRow from './combat/CombatHorizontalGauge';
import type { ApparitionViewportRef } from './combat/ApparitionViewport';
import type { CombatPlayerViewportRef } from './combat/CombatPlayerViewport';
import type { CombatOperativeTelemetry } from './combat/CombatOperativeHud';
import CombatCommandDeck, {
  COMMAND_DECK_MIN_HEIGHT,
  DECK_ACTION_LABELS,
  strikeDeckLabel,
  type CombatDeckAction,
} from './CombatCommandDeck';
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
  type EnemyDeckStrikeVariant,
  formatHostileId,
  formatIntentReadout,
  getEnemyDeckStrikeVariant,
  GAUGE_ABYSSAL,
  GAUGE_SOUL_ANCHOR,
  GAUGE_STAMINA,
  GAUGE_TRACK_BORDER,
} from '../utils/combatTelemetryFormat';
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

const { width } = Dimensions.get('window');

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
  apparitionRef?: RefObject<ApparitionViewportRef | null>;
  playerViewportRef?: RefObject<CombatPlayerViewportRef | null>;
  /** Registers callback invoked after eradication dissolve completes (victory). */
  registerKillResolver?: (resolver: () => void) => void;
  /** Registers callback to apply mid-combat healing from incursion consumables. */
  registerHealHandler?: (handler: (amount: number) => void) => void;
  /** Registers callback when a field consumable is deployed during combat. */
  registerConsumableHandler?: (handler: (result: IncursionConsumableUseResult) => void) => void;
  /** Stacked layout: victory/defeat panel in the apparition viewport (hub keeps deck + gauges). */
  onResolutionPanelChange?: (
    panel: { outcome: 'VICTORY' | 'DEFEAT'; onDismiss: () => void } | null,
  ) => void;
  onCombatComplete?: (r: { victory: boolean; remainingHp: number; remainingStamina: number }) => void;
  initialOperativeHp?: number; initialStamina?: number; maxStamina?: number; maxSoulAnchor?: number;
  startingAbyssalReservePercent?: number; parryMultiplierBonus?: number; parryWindowBonus?: number;
  sliceDamagePenalty?: number; onTerminalLog?: (text: string) => void;
  enemyProfile?: EnemyCombatProfile | null; nodeIndex?: number;
  weaponCombatStats?: ResolvedWeaponCombatStats;
  environmentalModifiers?: EnvironmentalModifiers;
  bossProfile?: BossRuntimeProfile | null;
  onBossPhaseShift?: (phase: number) => void;
}
interface SliceLineConfig {
  id: number;
  centerXRatio: number;
  centerYRatio: number;
  angleDeg: number;
  isSliced: boolean;
}

const isAttackIntent = (i: EnemyIntent) =>
  i === 'STRIKE' || i === 'WORLD_ENDER' || i === 'OVERDRIVE_DISCHARGE';

const ENEMY_INTENT_READ_MS = 2500;
const ENEMY_ATTACK_ANIM_MS = 1500;

type EnemyActionStage = 'reading' | 'executing' | null;

export default function TacticalCombatHub({
  stackedLayout = false,
  arenaLayout = false,
  onEnemyTelemetryChange,
  onOperativeTelemetryChange,
  onWardPrimedChange,
  apparitionRef,
  playerViewportRef,
  registerKillResolver,
  registerHealHandler,
  registerConsumableHandler,
  onResolutionPanelChange,
  onCombatComplete, initialOperativeHp = 100, initialStamina = 100, maxStamina = 100,
  maxSoulAnchor = 100, startingAbyssalReservePercent = 0, parryMultiplierBonus = 0,
  parryWindowBonus = 0, sliceDamagePenalty = 0, onTerminalLog,
  enemyProfile = null, nodeIndex = 0,
  weaponCombatStats,
  environmentalModifiers,
  bossProfile = null,
  onBossPhaseShift,
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
  const [enemy, setEnemy] = useState<EnemyCombatProfile | null>(null);
  const enemyRef = useRef<EnemyCombatProfile | null>(null);
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
  const [selectedAction, setSelectedAction] = useState<CombatDeckAction | null>(null);
  const [enemyActionStage, setEnemyActionStage] = useState<EnemyActionStage>(null);
  const [deckStrikeOverlay, setDeckStrikeOverlay] = useState<EnemyDeckStrikeVariant | null>(null);

  const operativeHpRef = useRef(initialOperativeHp);
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
  const enemyStrikeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCombatTerminal = () =>
    resolutionRef.current != null || operativeHpRef.current <= 0;

  const log = (t: string) => onTerminalLog?.(t);
  const parryTimingWindowBonus = parryWindowBonus * 0.02 + ((env.parryWindowBonusPct ?? 0) * 0.01);
  const parryTimingBlindPenalty = env.isPlayerBlinded ? 0.015 : 0;
  const counterReady = abyssalReserve >= COMBAT_ACTION.COUNTER_ABYSSAL_MIN && !isExhausted;
  const sliceReady = abyssalReserve >= COMBAT_ACTION.ABYSSAL_RESERVE_CAP && !isExhausted;
  const strikeWardPrimed = strikeArPrimed || wardStrikeBonusRef.current;

  const applyStamina = (next: number) => {
    const clamped = Math.max(0, Math.min(next, maxStamina));
    staminaRef.current = clamped;
    setStamina(clamped);
    return clamped;
  };

  useEffect(() => {
    cycleRef.current = cycleState; enemyRef.current = enemy;
    operativeHpRef.current = operativeHp; staminaRef.current = stamina;
    abyssalRef.current = abyssalReserve;
    counterRef.current = counterPrepActive;
    isPlayerTurnRef.current = isPlayerTurn;
  }, [cycleState, enemy, operativeHp, stamina, abyssalReserve, counterPrepActive, isPlayerTurn]);

  const combatTurnPhase = useMemo((): CombatTurnPhase => {
    if (cycleState === 'RESOLUTION') return 'RESOLUTION';
    if (cycleState === 'DEFEND_PARRY') return 'PARRY_WINDOW';
    if (cycleState === 'OFFENSE_SLICE') return 'SLICE';
    if (!isPlayerTurn && enemyActionStage === 'reading') return 'ENEMY_WINDUP';
    if (!isPlayerTurn) return 'ENEMY_ACTION';
    return 'PLAYER_COMMAND';
  }, [cycleState, enemyActionStage, isPlayerTurn]);

  const setCombatTurnState = combatTurn?.setCombatTurnState;

  useEffect(() => {
    if (!setCombatTurnState) return;
    setCombatTurnState({
      isPlayerTurn: isPlayerTurn && cycleState === 'TEXT_COMBAT',
      phase: combatTurnPhase,
      canUseCargo: isPlayerTurn && cycleState === 'TEXT_COMBAT',
    });
  }, [combatTurnPhase, cycleState, isPlayerTurn, setCombatTurnState]);


  const syncEnemy = (e: EnemyCombatProfile) => { enemyRef.current = e; setEnemy(e); };
  const chargeAr = (amt: number) => setAbyssalReserve((p) => {
    const n = Math.min(p + amt, COMBAT_ACTION.ABYSSAL_RESERVE_CAP); abyssalRef.current = n; return n;
  });
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
    chrome.updateUI({
      parrySuccessBurstVisible: active,
      parryBurstArena: arena,
    });
    chrome.notifyParryChromeChange();
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
    if (enemyStrikeTimerRef.current) {
      clearTimeout(enemyStrikeTimerRef.current);
      enemyStrikeTimerRef.current = null;
    }
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
    registerKillResolver?.(() => resolveVictoryRef.current());
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

  const applyVeilShardStun = () => {
    const e = enemyRef.current;
    if (!e) return;
    if (interruptsWorldEnderChannel(e)) {
      syncEnemy({
        ...e,
        intent: 'STRIKE',
        chargeTurns: 0,
        evadeActive: false,
      });
      log('>> WORLD-ENDER CHANNEL SHATTERED — charge dispersed.');
    }
    enemyStunPendingRef.current = true;
  };

  const applyConsumableRef = useRef((_result: IncursionConsumableUseResult) => {});
  applyConsumableRef.current = (result: IncursionConsumableUseResult) => {
    if (cycleRef.current !== 'TEXT_COMBAT' || !isPlayerTurnRef.current) return;
    if (result.healAmount > 0) applyHealRef.current(result.healAmount);
    if (result.stunsEnemy) applyVeilShardStun();
    passToEnemy(false);
  };

  useEffect(() => {
    registerConsumableHandler?.((result) => applyConsumableRef.current(result));
  }, [registerConsumableHandler]);

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
      primeWardStrikeBonus();
      log(`[ABYSSAL WARD] >> Barrier absorbed 50% — abyssal overcharge primed (+${COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS}% AR next strike).`);
    }
    if (dmg <= 0) return;
    preAppliedHpStrikeRef.current = dmg;
    pendingDmgRef.current = dmg;
    pendingUnblockRef.current = strike.unblockable;
    Vibration.vibrate([0, 32, 48, 28]);
  };

  const commitPendingPlayerDamage = (unblockable = false, msg?: string) => {
    const pending = preAppliedHpStrikeRef.current > 0
      ? preAppliedHpStrikeRef.current
      : pendingDmgRef.current;
    if (pending <= 0) return false;
    preAppliedHpStrikeRef.current = 0;
    hurtPlayer(pending, unblockable || pendingUnblockRef.current, msg, { skipStrikeFx: arenaLayout });
    return true;
  };

  const hurtPlayer = (
    raw: number,
    unblockable = false,
    msg?: string,
    options?: { skipStrikeFx?: boolean },
  ) => {
    let dmg = raw;
    if (!unblockable && abyssalWardRef.current) {
      dmg = Math.floor(dmg * (1 - COMBAT_ACTION.ABYSSAL_WARD_BLOCK_PCT));
      abyssalWardRef.current = false;
      setAbyssalWardActive(false);
      primeWardStrikeBonus();
      log(`[ABYSSAL WARD] >> Barrier absorbed 50% — abyssal overcharge primed (+${COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS}% AR next strike).`);
    }
    log(msg ?? `>> ENEMY STRIKE — ${dmg} DAMAGE DEALT`);
    if (dmg > 0) {
      Vibration.vibrate([0, 32, 48, 28]);
      if (arenaLayout && !options?.skipStrikeFx) {
        playerViewportRef?.current?.triggerDamageEffect('hp');
      }
    }
    setOperativeHp((p) => { const n = Math.max(p - dmg, 0); operativeHpRef.current = n; if (n <= 0) resolve(false); return n; });
  };

  const hurtEnemy = (raw: number, tag: string, source?: KineticDamageSource): boolean => {
    const e = enemyRef.current; if (!e) return false;
    const shroudMissChance = env.eliteModifier === 'PHASE_SHROUD' ? 0.25 : 0.2;
    if (env.isEnemyPhaseShrouded && Math.random() < shroudMissChance) {
      log(`${tag} >> PHASE SHROUD — ATTACK WHIFFED (${Math.round(shroudMissChance * 100)}% miss).`);
      return false;
    }
    let dmg = source
      ? scaleKineticDamage(raw, e.affinity, env.meleeDamageBonusPct ?? 0)
      : raw;
    if ((env.enemyDamageReductionPct ?? 0) > 0) {
      dmg = Math.floor(dmg * (1 - (env.enemyDamageReductionPct ?? 0) / 100));
    }
    if (source && dmg !== raw) {
      log(`${tag} >> Kinetic scaling ${raw} → ${dmg}.`);
    }
    if (e.evadeActive) { dmg = Math.floor(dmg * 0.5); log(`${tag} >> EVADE — 50% (${dmg}).`); }
    else log(`${tag} >> ${dmg} damage.`);
    const hp = Math.max(e.currentHp - dmg, 0);
    syncEnemy({ ...e, currentHp: hp });

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
    if (source && shouldChronoStunOnKineticHit(e.affinity, source) && dmg > 0) {
      enemyStunPendingRef.current = true;
      log('[CHRONO SHATTER] >> Temporal sync fractured — hostile turn forfeited.');
    }

    if (e.isBoss && bossRuntimeRef.current && shouldShiftBossPhase(bossRuntimeRef.current, hp)) {
      bossPhaseRef.current = 2;
      const updatedBoss = { ...bossRuntimeRef.current, currentHp: hp, currentPhase: 2 };
      bossRuntimeRef.current = updatedBoss;
      syncEnemy({ ...e, currentHp: hp, bossPhase: 2, intent: 'OVERDRIVE_DISCHARGE' });
      setPhaseAlert('>> WARNING: ANOMALY ANCHOR CRACKED // PHASE 2 INITIATED');
      log('>> WARNING: ANOMALY ANCHOR CRACKED // PHASE 2 INITIATED');
      onBossPhaseShift?.(2);
      setTimeout(() => setPhaseAlert(null), 2400);
    }

    const viewport = apparitionRef?.current;

    if (hp <= 0) {
      if (cycleRef.current === 'DEFEND_PARRY') {
        return true;
      }
      if (cycleRef.current === 'OFFENSE_SLICE') {
        abortCombatMinigames();
        cycleRef.current = 'TEXT_COMBAT';
        setCycleState('TEXT_COMBAT');
      }
      if (viewport) {
        viewport.triggerEradication();
        return true;
      }
      resolve(true);
      return true;
    }

    viewport?.triggerDamageEffect();
    return false;
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
    const reduction = env.staminaCostReductionPct ?? 0;
    if (reduction <= 0) return cost;
    return Math.max(1, Math.floor(cost * (1 - reduction / 100)));
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

  const attackDmg = (e: EnemyCombatProfile) =>
    e.intent === 'WORLD_ENDER'
      ? { dmg: Math.floor(e.baseDamage * 2.5), unblockable: true }
      : { dmg: e.baseDamage, unblockable: false };

  const execIntent = (e: EnemyCombatProfile) => {
    if (e.isBoss && bossRuntimeRef.current) {
      const phase = bossPhaseRef.current;
      if (e.intent === 'OVERDRIVE_DISCHARGE') {
        const dmg = bossStrikeDamage(bossRuntimeRef.current, phase);
        log(`>> ${e.designation} OVERDRIVE DISCHARGE — ${dmg} DMG`);
        hurtPlayer(dmg, !counterRef.current, `>> OVERDRIVE HIT — ${dmg}`);
        return;
      }
      const dmg = bossStrikeDamage(bossRuntimeRef.current, phase);
      hurtPlayer(dmg, false, `>> ${e.designation} STRIKES — ${dmg}`);
      return;
    }
    switch (e.intent) {
      case 'STRIKE': { const { dmg, unblockable } = attackDmg(e); hurtPlayer(dmg, unblockable, `>> ${e.designation} STRIKES — ${dmg}`); break; }
      case 'WORLD_ENDER': { const { dmg } = attackDmg(e); log(`>> ${e.designation} WORLD-ENDER — ${dmg} UNBLOCKABLE`); hurtPlayer(dmg, true); break; }
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
      case 'EVADE': log(`>> ${e.designation} EVADE posture — strikes deal 50%.`); break;
      case 'CHARGE': log(`>> ${e.designation} CHARGING world-ender (${e.chargeTurns + 1}/3).`); break;
      default: break;
    }
  };

  const endEnemyTurn = (advanceIntent = true) => {
    if (isCombatTerminal()) return;
    const e = enemyRef.current;
    if (!e || operativeHpRef.current <= 0) return;
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
      if (e.isBoss && bossRuntimeRef.current) {
        const phase = bossPhaseRef.current;
        const nextIntent = rollBossIntent(phase);
        syncEnemy({ ...e, intent: nextIntent, bossPhase: phase });
      } else {
        syncEnemy(advanceEnemyIntent(e));
      }
    }
    startPlayerTurn(enemyRef.current!);
  };

  const startPlayerTurn = (_e: EnemyCombatProfile) => {
    if (isCombatTerminal()) return;
    setCounterPrepActive(false);
    counterRef.current = false;
    setIsPlayerTurn(true);
    if (!skipRegenRef.current) {
      applyStamina(staminaRef.current + COMBAT_ACTION.STAMINA_REGEN);
    } else if (staminaRef.current === 0) {
      log('[EXHAUSTED] >> Stamina regen suppressed — reserves at 0.');
    } else {
      log('[OVEREXERTION] >> Stamina regen suppressed this turn.');
    }
    skipRegenRef.current = false;
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
    if (!currentEnemy || currentEnemy.currentHp <= 0 || operativeHpRef.current <= 0) {
      setEnemyActionStage(null);
      setDeckStrikeOverlay(null);
      return;
    }
    setEnemyActionStage(null);
    setDeckStrikeOverlay(null);
    if (countering && openParryWindow(currentEnemy, true)) return;
    if (!countering && openParryWindow(currentEnemy, false)) return;
    if (!commitPendingPlayerDamage()) {
      execIntent(currentEnemy);
    }
    if (operativeHpRef.current > 0 && currentEnemy.currentHp > 0) endEnemyTurn();
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
    setSelectedAction(null);
    const skipEnemyTurn = enemyStunPendingRef.current;
    clearEnemyTurnTimers();
    if (skipEnemyTurn) {
      enemyStunPendingRef.current = false;
      log('>> HOSTILE STUNNED — Veil interference; turn forfeited.');
      endEnemyTurn(false);
      return;
    }
    setIsPlayerTurn(false);
    setEnemyActionStage('reading');
    const e = enemyRef.current;
    if (e) {
      log(`>> HOSTILE TURN // ${formatIntentReadout(e.intent)}`);
    }
    enemyTurnTimerRef.current = setTimeout(() => {
      enemyTurnTimerRef.current = null;
      if (isCombatTerminal()) return;
      const currentEnemy = enemyRef.current;
      if (!currentEnemy || currentEnemy.currentHp <= 0 || operativeHpRef.current <= 0) {
        setEnemyActionStage(null);
        return;
      }
      setEnemyActionStage('executing');
      apparitionRef?.current?.triggerAttackEffect();
      const overlayVariant = getEnemyDeckStrikeVariant(currentEnemy.intent);
      if (overlayVariant) {
        showStrikeFeedback(overlayVariant);
        if (overlayVariant === 'hp') applyHpStrikeOnDeckImpact(currentEnemy);
      }
      enemyStrikeTimerRef.current = setTimeout(() => {
        enemyStrikeTimerRef.current = null;
        resolveEnemyAction(countering);
      }, ENEMY_ATTACK_ANIM_MS);
    }, ENEMY_INTENT_READ_MS);
  };

  const initCombat = () => {
    const e = enemyProfile ?? spawnEnemyProfile(INITIAL_SECTOR_POOL[0], nodeIndex, false);
    syncEnemy({ ...e });
    operativeHpRef.current = initialOperativeHp; staminaRef.current = initialStamina;
    abyssalRef.current = startingAbyssalReservePercent; skipRegenRef.current = false;
    abyssalWardRef.current = false;
    wardStrikeBonusRef.current = false;
    setStrikeArPrimed(false);
    counterRef.current = false;
    resolutionRef.current = null; dismissedRef.current = false;
    applyStamina(initialStamina);
    setAbyssalReserve(startingAbyssalReservePercent);
    setOperativeHp(initialOperativeHp);
    setAbyssalWardActive(false);
    setCounterPrepActive(false);
    setSelectedAction(null);
    setResolutionOutcome(null);
    setIsPlayerTurn(true);
    setCycleState('TEXT_COMBAT');
    setEnemyActionStage(null);
    setDeckStrikeOverlay(null);
    preAppliedHpStrikeRef.current = 0;
    enemyStunPendingRef.current = false;
    log('>> COMBAT LINK ESTABLISHED');
    log('>> OPERATIVE TURN // Command deck online.');
    log(`>> WEAPON LINK: ${strikeStats.label} // STRIKE ${strikeStats.strikeDamage} DMG / ${strikeStats.strikeStaminaCost} STAM`);
    if (env.isPlayerBlinded) log('>> ENV: OPERATIVE BLINDED — Counter Stance window tightened 15%.');
    if (env.hasTetanusGlitch) log('>> ENV: TETANUS GLITCH ACTIVE — exhaustion triggers 3 HP bleed.');
    if (env.startingStaminaPenalty > 0) log(`>> ENV: STAMINA PENALTY — entry ceiling reduced to 50.`);
    if (env.isEnemyPhaseShrouded) log('>> ENV: ENEMY PHASE SHROUDED — 20% miss chance on strikes.');
    if (env.environmentType) log(`>> ENV ANCHOR: ${env.environmentType.replace(/_/g, ' ')}`);
    if ((env.meleeDamageBonusPct ?? 0) > 0) log(`>> ENV BONUS: melee damage +${env.meleeDamageBonusPct}%.`);
    if ((env.staminaCostReductionPct ?? 0) > 0) log(`>> ENV BONUS: melee stamina cost −${env.staminaCostReductionPct}%.`);
    if ((env.parryWindowBonusPct ?? 0) > 0) log(`>> ENV BONUS: counter window +${env.parryWindowBonusPct}%.`);
    if (env.bloodFrenzyActive) log('>> BLOOD FRENZY ACTIVE — melee damage leeches 15% to soul anchor.');
    if (env.combatObjective === 'SURVIVE_TURNS') {
      log(`>> DEFEND THE RIFT — survive ${env.survivalTurnsRequired ?? 3} hostile turn cycles.`);
    }
    if (env.eliteModifier) log(`>> ELITE MODIFIER ACTIVE — ${env.eliteModifier.replace(/_/g, ' ')}`);
    log(`>> TARGET LOCK: ${e.designation} // CLASS ${e.class}`);
    if (e.affinity) log(`>> AFFINITY LOCK: ${e.affinity}`);
    if (startingAbyssalReservePercent > 0) log(`>> Abyssal reserve pre-charged to ${startingAbyssalReservePercent}%.`);
    bossRuntimeRef.current = bossProfile;
    bossPhaseRef.current = bossProfile?.currentPhase ?? 1;
  };
  useEffect(() => { initCombat(); }, []);

  const onStrike = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn || !enemyRef.current) return;
    const overdraw = staminaRef.current < strikeStats.strikeStaminaCost;
    if (overdraw) {
      markExhausted();
      log(`[EXHAUSTED] >> Overexertion strike — ${strikeStats.exhaustedStrikeDamage} damage.`);
    } else {
      spendStam(strikeStats.strikeStaminaCost);
    }
    const exhausted = overdraw || staminaRef.current === 0;
    if (abyssalWardRef.current) {
      abyssalWardRef.current = false;
      setAbyssalWardActive(false);
    }
    const arPrimed = consumeWardStrikeBonus();
    const arGain = arPrimed
      ? COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS
      : strikeStats.abyssalChargePerStrike;
    chargeAr(arGain);
    if (arPrimed) {
      log(`[ABYSSAL WARD OVERCHARGE] >> Abyssal reserve +${COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS}%.`);
    }
    const dmg = exhausted ? strikeStats.exhaustedStrikeDamage : strikeStats.strikeDamage;
    if (arenaLayout) playerViewportRef?.current?.triggerAttackLunge();
    const eradicated = hurtEnemy(dmg, arPrimed ? '[ABYSSAL STRIKE]' : '[STRIKE]', 'STRIKE');
    if ((env.lethalRetaliationDamage ?? 0) > 0 && dmg > 0) {
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
    }
    if (eradicated) return;
    passToEnemy(false);
  };

  const onAbyssalWard = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (!spendStam(COMBAT_ACTION.ABYSSAL_WARD_STAMINA)) { log('[REJECTED] >> Insufficient stamina.'); return; }
    abyssalWardRef.current = true;
    setAbyssalWardActive(true);
    primeWardStrikeBonus();
    log(
      `[ABYSSAL WARD] >> Barrier armed — blocks 50% next hit. Next Abyssal Strike +${COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS}% AR.`,
    );
    passToEnemy(false);
  };

  const onCounter = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (isExhausted) { log('[REJECTED] >> Exhausted — counter offline.'); return; }
    if (abyssalRef.current < COMBAT_ACTION.COUNTER_ABYSSAL_MIN) { log('[REJECTED] >> AR below 50%.'); return; }
    if (!spendStam(COMBAT_ACTION.COUNTER_STAMINA)) { log('[REJECTED] >> Insufficient stamina.'); return; }
    counterRef.current = true; setCounterPrepActive(true);
    log('[COUNTER STANCE] >> Parry matrix armed.'); passToEnemy(true);
  };

  const onVent = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    applyStamina(staminaRef.current + COMBAT_ACTION.BREATHING_TECHNIQUE_RESTORE);
    log(`[BREATHING TECHNIQUE] >> Stamina restored (+${COMBAT_ACTION.BREATHING_TECHNIQUE_RESTORE}).`); passToEnemy(false);
  };

  const onSlice = () => {
    if (cycleState !== 'TEXT_COMBAT' || !isPlayerTurn) return;
    if (isExhausted) { log('[REJECTED] >> Exhausted — eviscerate offline.'); return; }
    if (abyssalRef.current < COMBAT_ACTION.ABYSSAL_RESERVE_CAP) { log('[REJECTED] >> AR below 100%.'); return; }
    log('[EVISCERATE] >> Execution aperture open.'); triggerSlice();
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
    if (passed) {
      Vibration.vibrate(15);
      preAppliedHpStrikeRef.current = 0;
      const cd = Math.floor(COMBAT_ACTION.COUNTER_DAMAGE * (1 + parryMultiplierBonus));
      log(`[PERFECT COUNTER] >> Parry locked — ${cd} retaliation damage.`);
      counterRef.current = false;
      setCounterPrepActive(false);
      const killed = hurtEnemy(cd, '[COUNTER HIT]', 'COUNTER');
      hideParryOverlay();
      startParrySuccessBurst(() => {
        if (killed) finishParryKillAfterHalo();
        else endEnemyTurn();
      });
      return;
    }
    hideParryOverlay();
    log(unmitigatedOnFail ? '[PARRY FAILED] >> Mistimed — 100% unmitigated damage.' : '[PARRY FAILED] >> Guard collapsed.');
    commitPendingPlayerDamage(unmitigatedOnFail);
    counterRef.current = false;
    setCounterPrepActive(false);
    if (operativeHpRef.current > 0) endEnemyTurn();
  };

  const finalizeParryRef = useRef(finalizeParry);
  finalizeParryRef.current = finalizeParry;

  const handleParryTimeout = (session: number) => {
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
          if (!finished || parryResolvedRef.current) return;
          runOnJS(handleParryTimeout)(session);
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
    if (hits === 0) { log('[EXECUTION FAILED] >> 0 damage.'); setCycleState('TEXT_COMBAT'); passToEnemy(false); return; }
    const base = scaleSlice(COMBAT_ACTION.EVISCERATE_DAMAGE);
    const dmg = hits === 3 ? base : Math.floor(base * (hits / 3));
    log(hits === 3 ? `[EXECUTION SEVERANCE] >> Perfect [3/3] — ${dmg} damage.` : `[EXECUTION SEVERANCE] >> [${hits}/3] — ${dmg} damage.`);
    if (hurtEnemy(dmg, '[EVISCERATE]', 'EVISCERATE')) return;
    setCycleState('TEXT_COMBAT'); passToEnemy(false);
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
    cycleRef.current = 'OFFENSE_SLICE'; setCycleState('OFFENSE_SLICE'); queueSlice(0);
  };
  sliceHandlersRef.current = { queueNext: queueSlice, validate: validateSlice, evaluate: evaluateSlice, trigger: triggerSlice };
  useEffect(() => () => {
    clearSliceTimers();
    clearParrySuccessBurst();
    if (enemyTurnTimerRef.current) clearTimeout(enemyTurnTimerRef.current);
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

  const isDeckActionEnabled = (action: CombatDeckAction): boolean => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT') return false;
    switch (action) {
      case 'STRIKE':
        return true;
      case 'ABYSSAL_WARD':
        return stamina >= COMBAT_ACTION.ABYSSAL_WARD_STAMINA;
      case 'BREATHING_TECHNIQUE':
        return true;
      case 'COUNTER_STANCE':
        return counterReady && stamina >= COMBAT_ACTION.COUNTER_STAMINA;
      default:
        return false;
    }
  };

  const getDeckActionLabel = (action: CombatDeckAction): string => {
    if (action === 'STRIKE') return strikeDeckLabel(strikeWardPrimed);
    return DECK_ACTION_LABELS[action];
  };

  const getDeckActionAccent = (action: CombatDeckAction): string | undefined => {
    if (action === 'STRIKE' && isPlayerTurn && strikeWardPrimed) {
      return WARD_STRIKE_ACCENT;
    }
    if (action === 'COUNTER_STANCE' && counterReady) return P.parry;
    return undefined;
  };

  const getStagedHeader = (action: CombatDeckAction): string => {
    const name = getDeckActionLabel(action).replace(/^\[|\]$/g, '').trim();
    return `SYSTEM READY // ${name} SELECTED`;
  };

  const getStagedCostImpact = (action: CombatDeckAction): string => {
    switch (action) {
      case 'STRIKE': {
        const overdraw = isExhausted || stamina < strikeStats.strikeStaminaCost;
        const dmg = overdraw ? strikeStats.exhaustedStrikeDamage : strikeStats.strikeDamage;
        const cost = overdraw ? 'OVERDRAW' : String(strikeStats.strikeStaminaCost);
        return `COST: ${cost} ENERGY // EXPECTED IMPACT: ${dmg} DAMAGE`;
      }
      case 'ABYSSAL_WARD':
        return `COST: ${COMBAT_ACTION.ABYSSAL_WARD_STAMINA} STAM // 50% BLOCK\nNEXT ABYSSAL STRIKE +${COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS}% ABYSSAL ENERGY`;
      case 'BREATHING_TECHNIQUE':
        return `COST: 0 ENERGY // EXPECTED IMPACT: +${COMBAT_ACTION.BREATHING_TECHNIQUE_RESTORE} STAMINA`;
      case 'COUNTER_STANCE':
        return `COST: ${COMBAT_ACTION.COUNTER_STAMINA} ENERGY + ${COMBAT_ACTION.COUNTER_ABYSSAL_MIN}% ABYSSAL // EXPECTED IMPACT: PARRY + ${Math.floor(COMBAT_ACTION.COUNTER_DAMAGE * (1 + parryMultiplierBonus))} RETALIATION`;
      default:
        return '';
    }
  };

  const confirmSelectedAction = () => {
    if (!selectedAction) return;
    switch (selectedAction) {
      case 'STRIKE':
        onStrike();
        break;
      case 'ABYSSAL_WARD':
        onAbyssalWard();
        break;
      case 'BREATHING_TECHNIQUE':
        onVent();
        break;
      case 'COUNTER_STANCE':
        onCounter();
        break;
      default:
        break;
    }
    setSelectedAction(null);
  };

  useEffect(() => {
    if (!isPlayerTurn || cycleState !== 'TEXT_COMBAT') {
      setSelectedAction(null);
    }
  }, [isPlayerTurn, cycleState]);

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
    });
  }, [
    stackedLayout,
    onEnemyTelemetryChange,
    enemy?.designation,
    enemy?.currentHp,
    enemy?.maxHp,
    enemy?.intent,
    enemy?.affinity,
  ]);

  useEffect(() => {
    onWardPrimedChange?.(abyssalWardActive);
  }, [abyssalWardActive, onWardPrimedChange]);

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

  const soulAnchorRatio = maxSoulAnchor > 0 ? operativeHp / maxSoulAnchor : 0;
  const abyssalRatio = abyssalReserve / 100;
  const staminaRatio = maxStamina > 0 ? stamina / maxStamina : 0;

  const commandDeck = (
    <CombatCommandDeck
      selectedAction={selectedAction}
      onSelectAction={setSelectedAction}
      onConfirm={confirmSelectedAction}
      onAbort={() => setSelectedAction(null)}
      isActionEnabled={isDeckActionEnabled}
      getStagedHeader={getStagedHeader}
      getStagedCostImpact={getStagedCostImpact}
      getActionAccent={getDeckActionAccent}
      getActionLabel={getDeckActionLabel}
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
        label={`ABYSSAL RESERVE // ${abyssalReserve}%${counterReady ? ' // COUNTER READY' : ''}`}
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

  const renderTurnBanner = () => (
    <CombatTurnBanner
      phase={combatTurnPhase}
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

  const renderCommandDeckSlot = () => (
    <View style={styles.commandDeckAnchor}>
      {showCommandDeck ? commandDeck : null}
      {cycleState === 'TEXT_COMBAT' && !isPlayerTurn ? renderEnemyTurnPanel() : null}
      {deckStrikeOverlay && !arenaLayout ? <CombatDeckStrikeOverlay variant={deckStrikeOverlay} /> : null}
    </View>
  );

  const showCommandDeck =
    (cycleState === 'TEXT_COMBAT' && isPlayerTurn)
    || (cycleState === 'RESOLUTION' && resolutionOutcome === 'VICTORY');

  const useEnemyArenaChrome = stackedLayout && enemyChrome != null;

  const enemyAlive = (enemy?.currentHp ?? 0) > 0;

  const chromeSnapshot = useMemo(
    () => ({
      slicePingVisible: cycleState === 'TEXT_COMBAT' && sliceReady && isPlayerTurn && enemyAlive,
      slicePingReady: sliceReady && enemyAlive,
      slicePingDisabled: !isPlayerTurn,
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
      isSuccessState,
      isFailureState,
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
            <ParrySuccessBurstOverlay
              key={parryBurstEpoch}
              burstEpoch={parryBurstEpoch}
              arena={parryBurstArena}
            />
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
            onPress={dismiss}
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
        </View>
        <View style={styles.combatOverlayLayer} pointerEvents="box-none">
          {renderHubOverlays()}
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
    paddingTop: 0,
    paddingBottom: 6,
    gap: 6,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  combatOverlayLayer: {
    ...abs,
    zIndex: 25,
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
    minHeight: COMMAND_DECK_MIN_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  enemyTurnPanel: {
    width: '100%',
    minHeight: COMMAND_DECK_MIN_HEIGHT,
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
