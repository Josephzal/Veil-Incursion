import React, { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions, Pressable, Vibration, PanResponder } from 'react-native';
import {
  cancelAnimation,
  Easing as ReanimatedEasing,
  runOnJS,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTerminal } from '../context/TerminalContext';
import { INITIAL_SECTOR_POOL } from '../data/regions';
import { advanceEnemyIntent, spawnEnemyProfile } from '../data/enemies';
import { bossStrikeDamage, rollBossIntent, shouldShiftBossPhase } from '../data/bossCombat';
import { COMBAT_ACTION, ENEMY_ABYSSAL_SIPHON_REQUEST, EnemyCombatProfile, EnemyIntent } from '../types/run';

import { ResolvedWeaponCombatStats } from '../data/inventory';
import { BossRuntimeProfile, EnvironmentalModifiers } from '../types/game';
import CombatTelemetryGaugeRow from './combat/CombatHorizontalGauge';
import type { ApparitionViewportRef } from './combat/ApparitionViewport';
import CombatCommandDeck, {
  DECK_ACTION_LABELS,
  strikeDeckLabel,
  type CombatDeckAction,
} from './CombatCommandDeck';
import ParryMatrixOverlay from './combat/ParryMatrixOverlay';
import VectorSliceOverlay, { ORIGIN_JITTER } from './combat/VectorSliceOverlay';
import {
  CombatChromeBridge,
  useCombatEnemyChromeOptional,
} from '../context/CombatEnemyChromeContext';
import {
  type CombatEnemyTelemetry,
  formatHostileId,
  formatIntentReadout,
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
  computeParryArenaLayout,
  isParryRingsMeet,
  isTapOnParryCenter,
  PARRY_RING_SCALE_END,
  PARRY_RING_SCALE_START,
  type ParryArenaLayout,
} from '../utils/parryCollision';

const TELEMETRY_DIVIDER = 'rgba(139, 92, 246, 0.2)';

const { width } = Dimensions.get('window');
const MONO = 'monospace';
const P = {
  enemyHp: '#ef4444', unitTitle: '#ffffff', enemyPosture: '#fde68a',
  kr: '#bae6fd', krBorder: '#7dd3fc', parry: '#00ff33', defeat: '#5c0606',
};
const PARRY_DURATION = 2400;
const WARD_STRIKE_ACCENT = '#fde68a';
type CombatPhase = 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'OFFENSE_SLICE' | 'RESOLUTION';

interface TacticalCombatHubProps {
  /** Combat screen stack: operative metrics + deck only; hostile row lives on CombatScreen. */
  stackedLayout?: boolean;
  onEnemyTelemetryChange?: (enemy: CombatEnemyTelemetry | null) => void;
  apparitionRef?: RefObject<ApparitionViewportRef | null>;
  /** Registers callback invoked after eradication dissolve completes (victory). */
  registerKillResolver?: (resolver: () => void) => void;
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

export default function TacticalCombatHub({
  stackedLayout = false,
  onEnemyTelemetryChange,
  apparitionRef,
  registerKillResolver,
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
  /** True after Aegis blocks — next Kinetic Strike gets bonus KR (deck highlight). */
  const [strikeArPrimed, setStrikeArPrimed] = useState(false);
  const [counterPrepActive, setCounterPrepActive] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [isFailureState, setIsFailureState] = useState(false);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const [screenFlashColor, setScreenFlashColor] = useState(P.defeat);
  const [phaseAlert, setPhaseAlert] = useState<string | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const bossPhaseRef = useRef(bossProfile?.currentPhase ?? 1);
  const bossRuntimeRef = useRef<BossRuntimeProfile | null>(bossProfile);
  const [activeSliceIndex, setActiveSliceIndex] = useState(-1);
  const [sliceLines, setSliceLines] = useState<SliceLineConfig[]>([]);
  const [selectedAction, setSelectedAction] = useState<CombatDeckAction | null>(null);

  const operativeHpRef = useRef(initialOperativeHp);
  const staminaRef = useRef(initialStamina);
  const abyssalRef = useRef(startingAbyssalReservePercent);
  const skipRegenRef = useRef(false);
  const abyssalWardRef = useRef(false);
  const wardStrikeBonusRef = useRef(false);
  const counterRef = useRef(false);
  const pendingDmgRef = useRef(0);
  const pendingUnblockRef = useRef(false);
  const resolutionRef = useRef<'VICTORY' | 'DEFEAT' | null>(null);
  const dismissedRef = useRef(false);
  const cycleRef = useRef<CombatPhase>('TEXT_COMBAT');
  const parryScaleSV = useSharedValue(2.5);
  const parryResolvedRef = useRef(false);
  const parryStartedAtRef = useRef(0);
  const parryArenaRef = useRef<ParryArenaLayout | null>(null);
  const screenFlashAnim = useRef(new Animated.Value(0)).current;
  const activeSliceRef = useRef(-1);
  const sliceStartXRef = useRef<number | null>(null);
  const crossedRef = useRef(false);
  const sliceSessionRef = useRef({
    lines: [] as SliceLineConfig[], hitCount: 0, slicedIds: new Set<number>(),
    segmentTimer: null as ReturnType<typeof setTimeout> | null,
    hitFlashTimer: null as ReturnType<typeof setTimeout> | null, evaluated: false,
  });
  const sliceHandlersRef = useRef({
    queueNext: (_i: number) => {}, validate: () => {}, evaluate: () => {}, trigger: () => {},
  });

  const log = (t: string) => onTerminalLog?.(t);
  const parryTimingWindowBonus = parryWindowBonus * 0.02;
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
  }, [cycleState, enemy, operativeHp, stamina, abyssalReserve, counterPrepActive]);


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

  const flash = (color: string, done?: () => void) => {
    setScreenFlashColor(color); setScreenFlashActive(true); screenFlashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(screenFlashAnim, { toValue: 0.38, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(screenFlashAnim, { toValue: 0.26, duration: 160, useNativeDriver: true }),
      Animated.timing(screenFlashAnim, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start(() => { setScreenFlashActive(false); done?.(); });
  };

  const resolve = (victory: boolean) => {
    if (operativeHpRef.current <= 0) victory = false;
    cancelAnimation(parryScaleSV);
    if (victory) {
      resolutionRef.current = 'VICTORY'; log('[EXORCISED] >> Hostile neutralized. Incursion sealed.');
      setCycleState('RESOLUTION'); setResolutionOutcome('VICTORY'); awardCurrencies(750, 25);
    } else {
      resolutionRef.current = 'DEFEAT'; setResolutionOutcome('DEFEAT');
      log('[CRITICAL] >> Operative soul anchor severed. Veil sync lost.');
      flash(P.defeat, () => setCycleState('RESOLUTION'));
    }
  };

  useEffect(() => {
    registerKillResolver?.(() => resolve(true));
  }, [registerKillResolver]);

  const hurtPlayer = (raw: number, unblockable = false, msg?: string) => {
    let dmg = raw;
    if (!unblockable && abyssalWardRef.current) {
      dmg = Math.floor(dmg * (1 - COMBAT_ACTION.ABYSSAL_WARD_BLOCK_PCT));
      abyssalWardRef.current = false;
      setAbyssalWardActive(false);
      primeWardStrikeBonus();
      log(`[ABYSSAL WARD] >> Barrier absorbed 50% — abyssal overcharge primed (+${COMBAT_ACTION.ABYSSAL_WARD_STRIKE_BONUS}% AR next strike).`);
    }
    log(msg ?? `>> ENEMY STRIKE — ${dmg} DAMAGE DEALT`);
    setOperativeHp((p) => { const n = Math.max(p - dmg, 0); operativeHpRef.current = n; if (n <= 0) resolve(false); return n; });
  };

  const hurtEnemy = (raw: number, tag: string): boolean => {
    const e = enemyRef.current; if (!e) return false;
    if (env.isEnemyPhaseShrouded && Math.random() < 0.2) {
      log(`${tag} >> PHASE SHROUD — ATTACK WHIFFED (20% miss).`);
      return false;
    }
    let dmg = raw;
    if (e.evadeActive) { dmg = Math.floor(dmg * 0.5); log(`${tag} >> EVADE — 50% (${dmg}).`); }
    else log(`${tag} >> ${dmg} damage.`);
    const hp = Math.max(e.currentHp - dmg, 0);
    syncEnemy({ ...e, currentHp: hp });

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

    apparitionRef?.current?.triggerDamageEffect();

    if (hp <= 0) {
      if (apparitionRef?.current) {
        apparitionRef.current.triggerEradication();
        return true;
      }
      resolve(true);
      return true;
    }
    return false;
  };

  const applyTetanusGlitch = () => {
    if (!env.hasTetanusGlitch) return;
    log('[TETANUS GLITCH] >> Soul Anchor hemorrhage — 3 HP lost on exhaustion.');
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
  const spendStam = (cost: number, overdraw = false): boolean => {
    if (staminaRef.current < cost) {
      if (!overdraw) return false;
      markExhausted();
      return true;
    }
    const n = applyStamina(staminaRef.current - cost);
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

  const endEnemyTurn = () => {
    const e = enemyRef.current;
    if (!e || operativeHpRef.current <= 0) return;
    if (e.isBoss && bossRuntimeRef.current) {
      const phase = bossPhaseRef.current;
      const nextIntent = rollBossIntent(phase);
      syncEnemy({ ...e, intent: nextIntent, bossPhase: phase });
      startPlayerTurn(enemyRef.current!);
      return;
    }
    syncEnemy(advanceEnemyIntent(e));
    startPlayerTurn(enemyRef.current!);
  };

  const startPlayerTurn = (e: EnemyCombatProfile) => {
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
  };

  const passToEnemy = (countering = false) => {
    setSelectedAction(null);
    setIsPlayerTurn(false);
    setTimeout(() => {
      const e = enemyRef.current;
      if (!e || e.currentHp <= 0 || operativeHpRef.current <= 0) return;
      if (countering) {
        if (e.intent === 'WORLD_ENDER' || e.intent === 'OVERDRIVE_DISCHARGE') {
          if (e.intent === 'WORLD_ENDER') {
            log('[COUNTER FAILED] >> World-Ender cannot be parried.');
            counterRef.current = false; setCounterPrepActive(false);
            execIntent(e); if (operativeHpRef.current > 0) endEnemyTurn(); return;
          }
        }
        if (isAttackIntent(e.intent)) {
          let dmg = e.isBoss && bossRuntimeRef.current
            ? bossStrikeDamage(bossRuntimeRef.current, bossPhaseRef.current)
            : attackDmg(e).dmg;
          let unblockable = e.intent === 'OVERDRIVE_DISCHARGE' ? false : attackDmg(e).unblockable;
          if (e.intent === 'OVERDRIVE_DISCHARGE') unblockable = false;
          pendingDmgRef.current = dmg; pendingUnblockRef.current = unblockable;
          cycleRef.current = 'DEFEND_PARRY'; setCycleState('DEFEND_PARRY'); startParryRing(); return;
        }
        log('[COUNTER WASTED] >> No attack channel.'); counterRef.current = false; setCounterPrepActive(false);
      }
      execIntent(e);
      if (operativeHpRef.current > 0 && e.currentHp > 0) endEnemyTurn();
    }, 600);
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
    setResolutionOutcome(null); setIsPlayerTurn(true); setCycleState('TEXT_COMBAT');
    log('>> TACTICAL COMBAT LINK ESTABLISHED — ABYSSAL WARDS ONLINE.');
    log(`>> WEAPON LINK: ${strikeStats.label} // STRIKE ${strikeStats.strikeDamage} DMG / ${strikeStats.strikeStaminaCost} STAM`);
    if (env.isPlayerBlinded) log('>> ENV: OPERATIVE BLINDED — Counter Stance window tightened 15%.');
    if (env.hasTetanusGlitch) log('>> ENV: TETANUS GLITCH ACTIVE — exhaustion triggers 3 HP bleed.');
    if (env.startingStaminaPenalty > 0) log(`>> ENV: STAMINA PENALTY — entry ceiling reduced to 50.`);
    if (env.isEnemyPhaseShrouded) log('>> ENV: ENEMY PHASE SHROUDED — 20% miss chance on strikes.');
    log(`>> TARGET LOCK: ${e.designation} // CLASS ${e.class}`);
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
    if (hurtEnemy(dmg, arPrimed ? '[ABYSSAL STRIKE]' : '[STRIKE]')) return;
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

  const resolveParrySuccess = () => {
    if (parryResolvedRef.current || cycleRef.current !== 'DEFEND_PARRY') return;
    parryResolvedRef.current = true;
    setIsSuccessState(true);
    Vibration.vibrate(15);
    const cd = Math.floor(COMBAT_ACTION.COUNTER_DAMAGE * (1 + parryMultiplierBonus));
    log(`[PERFECT COUNTER] >> Staggered! ${cd} retaliation damage.`);
    counterRef.current = false;
    setCounterPrepActive(false);
    if (hurtEnemy(cd, '[COUNTER HIT]')) return;
    setTimeout(() => endEnemyTurn(), 400);
  };

  const resolveParryFail = (unmitigated: boolean) => {
    if (parryResolvedRef.current || cycleRef.current !== 'DEFEND_PARRY') return;
    parryResolvedRef.current = true;
    setIsFailureState(true);
    log(unmitigated ? '[PARRY FAILED] >> 100% unmitigated damage.' : '[PARRY FAILED] >> Guard collapsed.');
    hurtPlayer(pendingDmgRef.current, unmitigated);
    counterRef.current = false;
    setCounterPrepActive(false);
    if (operativeHpRef.current > 0) endEnemyTurn();
  };

  const handleParryTimeout = () => {
    resolveParryFail(false);
  };

  const parryScaleAtTap = () => {
    const elapsed = Date.now() - parryStartedAtRef.current;
    const progress = Math.min(1, Math.max(0, elapsed / PARRY_DURATION));
    return (
      PARRY_RING_SCALE_START
      + (PARRY_RING_SCALE_END - PARRY_RING_SCALE_START) * progress
    );
  };

  const applyParryTap = (scale: number, tapX: number, tapY: number) => {
    if (parryResolvedRef.current || cycleRef.current !== 'DEFEND_PARRY') return;
    const arena = parryArenaRef.current;
    const centerHit = arena != null && isTapOnParryCenter(tapX, tapY, arena);
    const timingHit = isParryRingsMeet(scale, parryTimingWindowBonus, parryTimingBlindPenalty);
    if (centerHit && timingHit) {
      resolveParrySuccess();
    } else {
      resolveParryFail(true);
    }
  };

  const applyParryTapRef = useRef(applyParryTap);
  applyParryTapRef.current = applyParryTap;

  const startParryRing = () => {
    cancelAnimation(parryScaleSV);
    parryResolvedRef.current = false;
    setIsSuccessState(false);
    setIsFailureState(false);
    const screen = Dimensions.get('screen');
    const viewportH = Math.round(screen.height * 0.37);
    parryArenaRef.current = computeParryArenaLayout(screen.width, viewportH);
    parryScaleSV.value = PARRY_RING_SCALE_START;
    requestAnimationFrame(() => {
      if (cycleRef.current !== 'DEFEND_PARRY') return;
      parryStartedAtRef.current = Date.now();
      parryScaleSV.value = withTiming(
        PARRY_RING_SCALE_END,
        { duration: PARRY_DURATION, easing: ReanimatedEasing.linear },
        (finished) => {
          if (!finished || parryResolvedRef.current) return;
          runOnJS(handleParryTimeout)();
        },
      );
    });
  };

  const onParryTap = (tapX: number, tapY: number) => {
    if (cycleRef.current !== 'DEFEND_PARRY' || parryResolvedRef.current) return;
    cancelAnimation(parryScaleSV);
    applyParryTapRef.current(parryScaleAtTap(), tapX, tapY);
  };

  const clearSliceTimers = () => {
    const s = sliceSessionRef.current;
    if (s.segmentTimer) { clearTimeout(s.segmentTimer); s.segmentTimer = null; }
    if (s.hitFlashTimer) { clearTimeout(s.hitFlashTimer); s.hitFlashTimer = null; }
  };

  const evaluateSlice = () => {
    const s = sliceSessionRef.current; if (s.evaluated) return;
    s.evaluated = true; clearSliceTimers(); activeSliceRef.current = -1; setActiveSliceIndex(-1);
    const hits = s.hitCount;
    if (hits === 0) { log('[EXECUTION FAILED] >> 0 damage.'); setCycleState('TEXT_COMBAT'); passToEnemy(false); return; }
    const base = scaleSlice(COMBAT_ACTION.EVISCERATE_DAMAGE);
    const dmg = hits === 3 ? base : Math.floor(base * (hits / 3));
    log(hits === 3 ? `[EXECUTION SEVERANCE] >> Perfect [3/3] — ${dmg} damage.` : `[EXECUTION SEVERANCE] >> [${hits}/3] — ${dmg} damage.`);
    if (hurtEnemy(dmg, '[EVISCERATE]')) return;
    setCycleState('TEXT_COMBAT'); passToEnemy(false);
  };

  const queueSlice = (idx: number) => {
    if (idx >= 3) { evaluateSlice(); return; }
    activeSliceRef.current = idx; setActiveSliceIndex(idx);
    crossedRef.current = false; sliceStartXRef.current = null;
    const s = sliceSessionRef.current;
    if (s.segmentTimer) clearTimeout(s.segmentTimer);
    s.segmentTimer = setTimeout(() => { s.segmentTimer = null; sliceHandlersRef.current.queueNext(idx + 1); }, 1200);
  };

  const validateSlice = () => {
    const idx = activeSliceRef.current;
    if (idx === -1 || crossedRef.current || cycleRef.current !== 'OFFENSE_SLICE') return;
    if (!sliceSessionRef.current.lines.some((l) => l.id === idx)) return;
    crossedRef.current = true; clearSliceTimers();
    const s = sliceSessionRef.current;
    if (!s.slicedIds.has(idx)) {
      s.slicedIds.add(idx); s.hitCount += 1;
      setSliceLines(s.lines.map((l) => (l.id === idx ? { ...l, isSliced: true } : l)));
      Vibration.vibrate(10);
    }
    if (s.hitFlashTimer) clearTimeout(s.hitFlashTimer);
    s.hitFlashTimer = setTimeout(() => {
      s.hitFlashTimer = null; crossedRef.current = false; sliceStartXRef.current = null;
      sliceHandlersRef.current.queueNext(idx + 1);
    }, 180);
  };

  const triggerSlice = () => {
    clearSliceTimers();
    sliceSessionRef.current = { lines: [], hitCount: 0, slicedIds: new Set(), segmentTimer: null, hitFlashTimer: null, evaluated: false };
    crossedRef.current = false; sliceStartXRef.current = null;
    const lines: SliceLineConfig[] = Array.from({ length: 3 }, (_, i) => ({
      id: i,
      centerXRatio: 0.5 + (Math.random() - 0.5) * ORIGIN_JITTER,
      centerYRatio: 0.5 + (Math.random() - 0.5) * ORIGIN_JITTER,
      angleDeg: Math.floor(Math.random() * 360),
      isSliced: false,
    }));
    sliceSessionRef.current.lines = lines; setSliceLines(lines);
    activeSliceRef.current = 0; setActiveSliceIndex(0);
    cycleRef.current = 'OFFENSE_SLICE'; setCycleState('OFFENSE_SLICE'); queueSlice(0);
  };
  sliceHandlersRef.current = { queueNext: queueSlice, validate: validateSlice, evaluate: evaluateSlice, trigger: triggerSlice };
  useEffect(() => () => clearSliceTimers(), []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_e, g) => { if (cycleRef.current === 'OFFENSE_SLICE') { sliceStartXRef.current = g.x0; crossedRef.current = false; } },
    onPanResponderMove: (_e, g) => {
      if (cycleRef.current !== 'OFFENSE_SLICE' || sliceStartXRef.current === null || crossedRef.current || activeSliceRef.current === -1) return;
      if (Math.abs(g.dy) > 90) return;
      if (Math.abs(g.dx) >= 44) sliceHandlersRef.current.validate();
    },
    onPanResponderRelease: () => { if (cycleRef.current === 'OFFENSE_SLICE') sliceStartXRef.current = null; },
  })).current;

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    const hp = operativeHpRef.current;
    onCombatComplete?.({ victory: resolutionRef.current === 'VICTORY' && hp > 0, remainingHp: hp, remainingStamina: staminaRef.current });
  };

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

  const getDeckActionGlow = (action: CombatDeckAction): boolean =>
    action === 'STRIKE' && isPlayerTurn && strikeWardPrimed;

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
    });
  }, [
    stackedLayout,
    onEnemyTelemetryChange,
    enemy?.designation,
    enemy?.currentHp,
    enemy?.maxHp,
    enemy?.intent,
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
      getActionGlow={getDeckActionGlow}
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

  const renderStatusFeed = () => {
    if (cycleState !== 'TEXT_COMBAT') return null;
    return (
      <View style={stackedLayout ? styles.statusFeedCompact : styles.statusFeed}>
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
      </View>
    );
  };

  const enemyChrome = useCombatEnemyChromeOptional();
  const useEnemyArenaChrome = stackedLayout && enemyChrome != null;

  const chromeSnapshot = useMemo(
    () => ({
      slicePingVisible: cycleState === 'TEXT_COMBAT' && sliceReady,
      slicePingReady: sliceReady,
      slicePingDisabled: !isPlayerTurn,
      onSlicePing: onSlice,
      parryVisible: cycleState === 'DEFEND_PARRY',
      parryShrinkScale: parryScaleSV,
      parrySuccess: isSuccessState,
      parryFailure: isFailureState,
      onParryTap,
      registerParryArena,
      sliceVisible: cycleState === 'OFFENSE_SLICE',
      sliceLines,
      activeSliceIndex,
      slicePanHandlers: panResponder.panHandlers as Record<string, unknown>,
    }),
    [
      cycleState,
      sliceReady,
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
            success={isSuccessState}
            failure={isFailureState}
            onTap={onParryTap}
            onArenaLayout={registerParryArena}
          />
          <VectorSliceOverlay
            visible={cycleState === 'OFFENSE_SLICE'}
            lines={sliceLines}
            activeIndex={activeSliceIndex}
            panHandlers={panResponder.panHandlers}
          />
        </>
      ) : null}

      {cycleState === 'RESOLUTION' && (
        <View style={styles.resolutionOverlay}>
          <View style={styles.resolution}>
          <Text style={[styles.resTitle, { color: resolutionOutcome === 'VICTORY' ? '#22c55e' : P.enemyHp }]}>
            {resolutionOutcome === 'VICTORY' ? 'INTRUSION DECONSTRUCTED' : 'OPERATIVE SOUL DISCONNECTED'}
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
        {stackedOperativeMetrics}
        <View style={styles.commandDeckRow}>
          {renderStatusFeed()}
          {cycleState === 'TEXT_COMBAT' ? commandDeck : null}
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
            {renderStatusFeed()}
            <View style={styles.actionStage}>
              {cycleState === 'TEXT_COMBAT' ? commandDeck : null}
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
    paddingVertical: 0,
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
