import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions, Pressable, Vibration, PanResponder } from 'react-native';
import { deriveCombatStatusEffects } from '../utils/combatResourceState';
import { useTerminal } from '../context/TerminalContext';
import VignetteFlashOverlay from './VignetteFlashOverlay';

const { width } = Dimensions.get('window');
const TARGET_SIZE = 80;
const TARGET_RADIUS = TARGET_SIZE / 2;

const ABYSSAL_RESERVE_CHARGE_PER_HIT = 15;
const KINETIC_RESERVOIR_CAP = 100;
const KINETIC_PARRY_UNLOCK = 50;
const KINETIC_PARRY_COST = 50;
const PARRY_COUNTER_MULTIPLIER = 1.5;
const STAMINA_ATTACK_COST = 20;
const STAMINA_REGEN_PER_TURN = 15;
const FORTIFY_DAMAGE_MULTIPLIER = 0.5;

type EnemyCombatMode = 'ATTACKING' | 'FORTIFYING';

const COMBAT_PALETTE = {
  enemyHp: '#ef4444',
  unitTitle: '#ffffff',
  enemyPosture: '#fde68a',
  enemyPostureBorder: '#ca8a04',
  abyssalReserve: '#bae6fd',
  abyssalReserveBorder: '#7dd3fc',
  parryActive: '#00ff33',
  parryVignette: '#00ff33',
  defeatVignette: '#5c0606',
};

const VIGNETTE_FLASH_PEAK = 0.38;
const VIGNETTE_FLASH_HOLD = 0.26;

type CombatPhase = 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'OFFENSE_SLICE' | 'RESOLUTION';

interface BlueprintSilhouetteProps {
  onCombatComplete?: (result: {
    victory: boolean;
    remainingHp: number;
    remainingStamina: number;
  }) => void;
  initialOperativeHp?: number;
  initialStamina?: number;
  maxStamina?: number;
  maxSoulAnchor?: number;
  startingAbyssalReservePercent?: number;
  parryMultiplierBonus?: number;
  parryWindowBonus?: number;
  sliceDamagePenalty?: number;
  onTerminalLog?: (text: string) => void;
  onCycleStateChange?: (phase: CombatPhase) => void;
}

interface ThreatProfile {
  designation: string;
  maxHp: number;
  currentHp: number;
  stability: number; // Shaving this to 0 triggers the Laser-Slice Execution phase
}

interface SliceLineConfig {
  id: number;
  topY: number;      // Random layout position
  rotation: string;  // Random directional angle (e.g., '12deg', '-8deg')
  isSliced: boolean;
  fadeAnim: Animated.Value;
}

interface WeaponConfig {
  name: string;
  duration: number;
  tolerance: number;
  hapticDuration: number;
  strikeDamage: number;
  stabilityChipping: number;
}

const WEAPON_REGISTRY: Record<string, WeaponConfig> = {
  'kinetic_glaive': { name: 'KINETIC GLAIVE', duration: 1200, tolerance: 0.09, hapticDuration: 15, strikeDamage: 20, stabilityChipping: 25 },
  'thermal_claymore': { name: 'THERMAL CLAYMORE', duration: 1600, tolerance: 0.14, hapticDuration: 45, strikeDamage: 35, stabilityChipping: 20 },
  'monomolecular_katana': { name: 'MONOMOLECULAR KATANA', duration: 900, tolerance: 0.06, hapticDuration: 12, strikeDamage: 15, stabilityChipping: 34 },
};

export default function BlueprintSilhouette({
  onCombatComplete,
  initialOperativeHp = 100,
  initialStamina = 100,
  maxStamina = 100,
  maxSoulAnchor = 100,
  startingAbyssalReservePercent = 0,
  parryMultiplierBonus = 0,
  parryWindowBonus = 0,
  sliceDamagePenalty = 0,
  onTerminalLog,
  onCycleStateChange,
}: BlueprintSilhouetteProps): React.JSX.Element {
  const { theme, profile, awardCurrencies } = useTerminal();
  
  const contextWeaponId = profile?.operative_profile?.payload_manifest?.active_slots?.weapon_id || 'kinetic_glaive';
  const activeWeapon = WEAPON_REGISTRY[contextWeaponId] || WEAPON_REGISTRY['kinetic_glaive'];

  // Lifecycle State Machines
  const [cycleState, setCycleState] = useState<CombatPhase>('TEXT_COMBAT');
  const [threat, setThreat] = useState<ThreatProfile | null>(null);
  const threatRef = useRef<ThreatProfile | null>(null);
  
  useEffect(() => {
      threatRef.current = threat;
    }, [threat]);

  // Turn-Based Resource Trackers
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);
  const [counterPrepActive, setCounterPrepActive] = useState<boolean>(false);
  const [operativeHp, setOperativeHp] = useState<number>(initialOperativeHp);
  const [stamina, setStamina] = useState<number>(initialStamina);
  const [abyssalReserve, setAbyssalReserve] = useState<number>(startingAbyssalReservePercent);
  const abyssalReserveRef = useRef<number>(startingAbyssalReservePercent);
  const isKineticParryRef = useRef<boolean>(false);
  const [enemyMode, setEnemyMode] = useState<EnemyCombatMode>('ATTACKING');
  const enemyModeRef = useRef<EnemyCombatMode>('ATTACKING');
  const operativeHpRef = useRef(initialOperativeHp);
  const staminaRef = useRef(initialStamina);
  const [statusEffects, setStatusEffects] = useState<import('../types/run').CombatStatusEffect[]>(() =>
    deriveCombatStatusEffects(initialStamina),
  );
  const skipStaminaRegenRef = useRef<boolean>(false);

  // Mini-game Win/Loss Visual Flags
  const [isSuccessState, setIsSuccessState] = useState<boolean>(false);
  const [isFailureState, setIsFailureState] = useState<boolean>(false);
  const [screenFlashActive, setScreenFlashActive] = useState<boolean>(false);
  const [screenFlashColor, setScreenFlashColor] = useState<string>(COMBAT_PALETTE.defeatVignette);
  const [kineticParryActive, setKineticParryActive] = useState<boolean>(false);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const resolutionOutcomeRef = useRef<'VICTORY' | 'DEFEAT' | null>(null);
  const resolutionDismissedRef = useRef(false);

  // Animations
  const shrinkAnim = useRef(new Animated.Value(2.5)).current;
  const screenFlashAnim = useRef(new Animated.Value(0)).current;
  
  // Swipe Slice Geometry
  const [activeSliceIndex, setActiveSliceIndex] = useState<number>(-1);
  const sliceStartXRef = useRef<number | null>(null);
  const crossedRef = useRef<boolean>(false);
  const [sliceLines, setSliceLines] = useState<SliceLineConfig[]>([]);
  const sliceSessionRef = useRef({
    lines: [] as SliceLineConfig[],
    hitCount: 0,
    slicedIds: new Set<number>(),
    segmentTimer: null as ReturnType<typeof setTimeout> | null,
    hitFlashTimer: null as ReturnType<typeof setTimeout> | null,
    evaluated: false,
  });

  const cycleStateRef = useRef<CombatPhase>('TEXT_COMBAT');
  const activeSliceIndexRef = useRef<number>(-1);

  useEffect(() => { cycleStateRef.current = cycleState; }, [cycleState]);
  useEffect(() => { onCycleStateChange?.(cycleState); }, [cycleState, onCycleStateChange]);
  useEffect(() => { abyssalReserveRef.current = abyssalReserve; }, [abyssalReserve]);
  useEffect(() => { operativeHpRef.current = operativeHp; }, [operativeHp]);
  useEffect(() => { staminaRef.current = stamina; }, [stamina]);
  useEffect(() => {
    setStatusEffects(deriveCombatStatusEffects(stamina));
  }, [stamina]);
  const isExhausted = statusEffects.includes('EXHAUSTED');
  useEffect(() => { enemyModeRef.current = enemyMode; }, [enemyMode]);
  // 📍 REPLACE THE PREVIOUS ANIMATION useEffect BLOCK WITH THIS ONE:
  useEffect(() => {
    if (cycleState === 'OFFENSE_SLICE' && activeSliceIndex >= 0 && sliceLines[activeSliceIndex]) {
      const currentActiveLine = sliceLines[activeSliceIndex];
      
      // Zero out to guarantee clear start parameters
      currentActiveLine.fadeAnim.setValue(0);
      
      // 300ms linear ease-out makes the line visibly draw/grow into view
      Animated.timing(currentActiveLine.fadeAnim, {
        toValue: 1,
        duration: 300, 
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [activeSliceIndex, cycleState, sliceLines]);

  useEffect(() => {
    initiateVeilIncursion();
  }, []);

  const pushTerminalText = (text: string) => {
    onTerminalLog?.(text);
  };

  const parryCounterMultiplier = PARRY_COUNTER_MULTIPLIER + parryMultiplierBonus;

  const scaleDamageForEnemyMode = (damage: number): number => {
    let scaled = damage;
    if (enemyModeRef.current === 'FORTIFYING') {
      scaled = Math.floor(scaled * FORTIFY_DAMAGE_MULTIPLIER);
    }
    if (sliceDamagePenalty > 0) {
      scaled = Math.floor(scaled * (1 - sliceDamagePenalty));
    }
    return scaled;
  };

  const chargeKineticReservoir = (amount: number = ABYSSAL_RESERVE_CHARGE_PER_HIT) => {
    setAbyssalReserve((prev) => {
      const next = Math.min(prev + amount, KINETIC_RESERVOIR_CAP);
      abyssalReserveRef.current = next;
      return next;
    });
  };

  const triggerVignetteFlash = (color: string, onComplete?: () => void) => {
    setScreenFlashColor(color);
    setScreenFlashActive(true);
    screenFlashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(screenFlashAnim, {
        toValue: VIGNETTE_FLASH_PEAK,
        duration: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(screenFlashAnim, {
        toValue: VIGNETTE_FLASH_HOLD,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(screenFlashAnim, {
        toValue: 0,
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setScreenFlashActive(false);
      onComplete?.();
    });
  };

  const applyEnemyDamage = (rawDamage: number) => {
    const designation = threatRef.current?.designation ?? 'APPARITION';
    pushTerminalText(`>> ${designation} EXECUTES ENEMY STRIKE — ${rawDamage} DAMAGE DEALT`);

    setOperativeHp((prev) => {
      const nextHp = Math.max(prev - rawDamage, 0);
      operativeHpRef.current = nextHp;
      if (nextHp <= 0) {
        handleIncursionResolution(false);
      } else {
        returnToPlayerTurn();
      }
      return nextHp;
    });
  };

  const initiateVeilIncursion = () => {
    const initialThreat: ThreatProfile = {
      designation: `APPARITION_UNIT_[${Math.floor(1000 + Math.random() * 9000)}]`,
      maxHp: 100,
      currentHp: 100,
      stability: 100,
    };
    setThreat(initialThreat);
    setOperativeHp(initialOperativeHp);
    operativeHpRef.current = initialOperativeHp;
    setStamina(initialStamina);
    staminaRef.current = initialStamina;
    setAbyssalReserve(startingAbyssalReservePercent);
    abyssalReserveRef.current = startingAbyssalReservePercent;
    setEnemyMode('ATTACKING');
    enemyModeRef.current = 'ATTACKING';
    setStatusEffects(deriveCombatStatusEffects(initialStamina));
    skipStaminaRegenRef.current = false;
    resolutionOutcomeRef.current = null;
    resolutionDismissedRef.current = false;
    setResolutionOutcome(null);
    isKineticParryRef.current = false;
    setKineticParryActive(false);
    setCounterPrepActive(false);
    setIsPlayerTurn(true);
    pushTerminalText(`>> CROSSING THE VEIL... ATTACHING SOUL ANCHORS TO URBAN LEY-LINES.`);
    pushTerminalText(`>> AEGIS COMBAT HARDWARE ENGAGED: ${activeWeapon.name}`);
    pushTerminalText(`>> TARGET SIGNATURE MARKED: ${initialThreat.designation}`);
    if (startingAbyssalReservePercent > 0) {
      pushTerminalText(`>> BATTERY BOON: Kinetic reservoir pre-charged to ${startingAbyssalReservePercent}%.`);
    }
    setCycleState('TEXT_COMBAT');
  };

  // --- ⚔️ SYSTEM 1: TURN-BASED ACTIONS ⚔️ ---

  const handleBasicStrike = () => {
    if (cycleState !== 'TEXT_COMBAT' || !threat || !isPlayerTurn) return;

    const exhaustedAttack = stamina < STAMINA_ATTACK_COST;
    if (exhaustedAttack) {
      skipStaminaRegenRef.current = true;
      staminaRef.current = 0;
      setStamina(0);
      pushTerminalText('[EXHAUSTED] >> Overexertion strike — 50% damage, stamina regen paused.');
    } else {
      setStamina((prev) => {
        const next = prev - STAMINA_ATTACK_COST;
        staminaRef.current = next;
        return next;
      });
    }
    chargeKineticReservoir(ABYSSAL_RESERVE_CHARGE_PER_HIT);

    const nextStability = Math.max(threat.stability - activeWeapon.stabilityChipping, 0);
    const updatedThreat = { ...threat, stability: nextStability };

    let rawDamage = scaleDamageForEnemyMode(activeWeapon.strikeDamage);
    if (exhaustedAttack) rawDamage = Math.floor(rawDamage * 0.5);
    const fortifyNote = enemyModeRef.current === 'FORTIFYING' ? ' (FORTIFY: 50% reduced)' : '';
    const stamNote = exhaustedAttack ? '' : ` (-${STAMINA_ATTACK_COST} STAM)`;
    pushTerminalText(`[STRIKE] >> Slashed at ${threat.designation} with ${activeWeapon.name}${stamNote}${fortifyNote}.`);

    if (nextStability <= 0) {
      setThreat(updatedThreat);
      threatRef.current = updatedThreat;
      if (exhaustedAttack) {
        pushTerminalText('[EXHAUSTED] >> Eviscerate unavailable — posture aperture wasted.');
        const nextHp = Math.max(threat.currentHp - rawDamage, 0);
        updatedThreat.currentHp = nextHp;
        setThreat(updatedThreat);
        if (nextHp <= 0) handleIncursionResolution(true);
        else passTurnToEnemy(updatedThreat);
        return;
      }
      pushTerminalText(`[CRITICAL APERTURE] >> Specter stability collapsed! Spectral plane fracturing!`);
      triggerSliceMiniGame();
    } else {
      const nextHp = Math.max(threat.currentHp - rawDamage, 0);
      updatedThreat.currentHp = nextHp;
      setThreat(updatedThreat);

      if (nextHp <= 0) {
        pushTerminalText(`[EXORCISED] >> Apparition shattered back into raw mist lines.`);
        handleIncursionResolution(true);
      } else {
        // Safe, pass context over to the automated Enemy turn engine cleanly
        passTurnToEnemy(updatedThreat);
      }
    }
  };

  const parryReady = abyssalReserve >= KINETIC_PARRY_UNLOCK;

  const handlePrepareCounter = () => {
    if (cycleState !== 'TEXT_COMBAT' || !threat || !isPlayerTurn) return;
    if (isExhausted) {
      pushTerminalText('[REJECTED] >> Exhausted — parry channels offline.');
      return;
    }
    if (!parryReady) return;
    if (enemyModeRef.current === 'FORTIFYING') {
      pushTerminalText('[REJECTED] >> Apparition is fortifying — no attack channel to parry.');
      return;
    }

    setAbyssalReserve((prev) => {
      const next = Math.max(prev - KINETIC_PARRY_COST, 0);
      abyssalReserveRef.current = next;
      return next;
    });
    setCounterPrepActive(true);
    isKineticParryRef.current = true;
    setKineticParryActive(true);
    pushTerminalText(`[KINETIC PARRY ARMED] >> Reservoir discharged (-${KINETIC_PARRY_COST}% KR). Counter channel primed.`);

    passTurnToEnemy(threat, true);
  };

  const handleRestStance = () => {
    if (cycleState !== 'TEXT_COMBAT' || !threat || !isPlayerTurn) return;
    pushTerminalText('[REST STANCE] >> Holding defensive posture to recover stamina reserves.');
    passTurnToEnemy(threat, false);
  };

  const advanceEnemyMode = (): EnemyCombatMode => {
    const next: EnemyCombatMode = enemyModeRef.current === 'ATTACKING' ? 'FORTIFYING' : 'ATTACKING';
    enemyModeRef.current = next;
    setEnemyMode(next);
    return next;
  };

  // --- 👹 SYSTEM 2: ENEMY TURN RESOLUTION ENGINE ---

  const passTurnToEnemy = (currentThreatState: ThreatProfile, isCountering: boolean = false) => {
    setIsPlayerTurn(false);

    setTimeout(() => {
      if (currentThreatState.currentHp <= 0) return;

      if (isCountering) {
        if (enemyModeRef.current !== 'ATTACKING') {
          pushTerminalText('[ABORT] >> Fortifying apparition offers no parry window.');
          returnToPlayerTurn();
          return;
        }
        cycleStateRef.current = 'DEFEND_PARRY';
        setCycleState('DEFEND_PARRY');
        executeRingPass();
      } else if (enemyModeRef.current === 'FORTIFYING') {
        advanceEnemyMode();
        pushTerminalText('[FORTIFY] >> Apparition hardens ectoplasmic shell — your strikes deal 50% damage next phase.');
        returnToPlayerTurn();
      } else {
        advanceEnemyMode();
        const rawIncomingDmg = Math.floor(12 + Math.random() * 8);
        applyEnemyDamage(rawIncomingDmg);
      }
    }, 600);
  };

  const returnToPlayerTurn = () => {
    setCounterPrepActive(false);
    setKineticParryActive(false);
    isKineticParryRef.current = false;
    setIsPlayerTurn(true);
    if (!skipStaminaRegenRef.current) {
      setStamina((prev) => {
        const next = Math.min(prev + STAMINA_REGEN_PER_TURN, maxStamina);
        staminaRef.current = next;
        return next;
      });
    }
    skipStaminaRegenRef.current = false;
    setCycleState('TEXT_COMBAT');
  };

  // --- 🛡️ SKILL EVENT 1: MANUAL PARRY RING OVERRIDE ---

  const executeRingPass = () => {
    shrinkAnim.stopAnimation();
    setIsSuccessState(false);
    setIsFailureState(false);
    shrinkAnim.setValue(2.5);

    requestAnimationFrame(() => {
      if (cycleStateRef.current !== 'DEFEND_PARRY') return;

      Animated.timing(shrinkAnim, {
        toValue: 0.5,
        duration: activeWeapon.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsFailureState(true);
          const fallbackDamage = 30;
          pushTerminalText(`[CRITICAL DEFENSE FAULT] >> Guard completely bypassed! Soul Anchor cracked.`);

          if (isKineticParryRef.current) {
            pushTerminalText(`[PARRY FAILED] >> Kinetic counter collapsed — absorbing ${fallbackDamage} damage.`);
          }

          isKineticParryRef.current = false;
          setKineticParryActive(false);
          applyEnemyDamage(fallbackDamage);
        }
      });
    });
  };

  const handleParryTap = () => {
    if (cycleStateRef.current !== 'DEFEND_PARRY' || isSuccessState || isFailureState) return;

    shrinkAnim.stopAnimation((currentScaleValue) => {
      const targetScale = 1.0;
      const deviation = Math.abs(currentScaleValue - targetScale);

      const parryTolerance = activeWeapon.tolerance * (1 + parryWindowBonus);
      if (deviation <= parryTolerance) {
        setIsSuccessState(true);
        Vibration.vibrate(activeWeapon.hapticDuration);

        if (isKineticParryRef.current) {
          triggerVignetteFlash(COMBAT_PALETTE.parryVignette);
          const counterDamage = Math.floor(activeWeapon.strikeDamage * parryCounterMultiplier);
          pushTerminalText(
            `[PERFECT KINETIC PARRY] >> 0 damage taken! Counter-strike inflicted ${counterDamage} damage (${Math.round(parryCounterMultiplier * 100)}% weapon output).`,
          );

          const activeThreat = threatRef.current;
          if (activeThreat) {
            const counterHp = Math.max(activeThreat.currentHp - counterDamage, 0);
            const updatedThreat = { ...activeThreat, currentHp: counterHp };
            setThreat(updatedThreat);
            threatRef.current = updatedThreat;

            isKineticParryRef.current = false;
            setKineticParryActive(false);

            if (counterHp <= 0) {
              setTimeout(() => handleIncursionResolution(true), 600);
              return;
            }
          } else {
            isKineticParryRef.current = false;
            setKineticParryActive(false);
          }

          setTimeout(() => returnToPlayerTurn(), 600);
          return;
        }

        chargeKineticReservoir(ABYSSAL_RESERVE_CHARGE_PER_HIT);
        pushTerminalText(`[PERFECT COUNTER] >> Absorb matrices locked! Negated 100% damage.`);

        if (threat) {
          const staggerHp = Math.max(threat.currentHp - 15, 0);
          const updatedThreat = { ...threat, currentHp: staggerHp };
          setThreat(updatedThreat);
          threatRef.current = updatedThreat;
          if (staggerHp <= 0) {
            handleIncursionResolution(true);
            return;
          }
        }
        returnToPlayerTurn();
      } else {
        setIsFailureState(true);
        const fallbackDamage = 25;
        pushTerminalText(`[DEFLECTION REFRACTED] >> Off-rhythm collision! Guard collapsed.`);

        if (isKineticParryRef.current) {
          pushTerminalText(`[PARRY FAILED] >> Kinetic counter mistimed — absorbing ${fallbackDamage} damage.`);
        }

        isKineticParryRef.current = false;
        setKineticParryActive(false);
        applyEnemyDamage(fallbackDamage);
      }
    });
  };


  // ---  SKILL EVENT 2: KINETIC STABILITY SLICE FINISHER ---

  const sliceHandlersRef = useRef({
    queueNextSliceSegment: (_targetIndex: number) => {},
    validateLineCompletion: () => {},
    evaluateSlicePerformance: () => {},
    triggerSliceMiniGame: () => {},
  });

  const clearSliceTimers = () => {
    const session = sliceSessionRef.current;
    if (session.segmentTimer) {
      clearTimeout(session.segmentTimer);
      session.segmentTimer = null;
    }
    if (session.hitFlashTimer) {
      clearTimeout(session.hitFlashTimer);
      session.hitFlashTimer = null;
    }
  };

  const syncSliceLinesState = (lines: SliceLineConfig[]) => {
    sliceSessionRef.current.lines = lines;
    setSliceLines(lines);
  };

  const registerSliceHit = (lineId: number): boolean => {
    const session = sliceSessionRef.current;
    if (session.slicedIds.has(lineId)) return false;

    session.slicedIds.add(lineId);
    session.hitCount += 1;

    const updatedLines = session.lines.map((line) =>
      line.id === lineId ? { ...line, isSliced: true } : line
    );
    syncSliceLinesState(updatedLines);
    return true;
  };

  const evaluateSlicePerformance = () => {
    const session = sliceSessionRef.current;
    if (session.evaluated) return;
    session.evaluated = true;

    clearSliceTimers();
    activeSliceIndexRef.current = -1;
    setActiveSliceIndex(-1);

    const activeThreat = threatRef.current;
    const correctStrikes = session.hitCount;

    if (!activeThreat) {
      session.evaluated = false;
      cycleStateRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      returnToPlayerTurn();
      return;
    }

    if (correctStrikes === 0) {
      pushTerminalText(`[EXECUTION FAILED] >>> You failed to slice any vector vectors in time! 0 damage dealt.`);

      const resetThreat = { ...activeThreat, stability: 100 };
      setThreat(resetThreat);
      threatRef.current = resetThreat;
      cycleStateRef.current = 'TEXT_COMBAT';
      setCycleState('TEXT_COMBAT');
      passTurnToEnemy(resetThreat, false);
      return;
    }

    const baseDamage = activeWeapon.strikeDamage;
    const scaledBase = scaleDamageForEnemyMode(baseDamage);
    const finalDamage = correctStrikes === 3
      ? Math.floor(scaledBase * 3.5)
      : Math.floor(scaledBase * (correctStrikes / 3));
    const postCritHp = Math.max(activeThreat.currentHp - finalDamage, 0);

    const severanceLabel = correctStrikes === 3
      ? `[EXECUTION SEVERANCE] >>> Perfect trifecta! [3/3] vector cuts — CRITICAL x3.5! Inflicted ${finalDamage} damage.`
      : `[EXECUTION SEVERANCE] >>> Connected [${correctStrikes}/3] vector cuts! Inflicted ${finalDamage} damage.`;
    pushTerminalText(severanceLabel);

    if (postCritHp <= 0) {
      setThreat({ ...activeThreat, currentHp: 0, stability: 100 });
      handleIncursionResolution(true);
      return;
    }

    const freshThreatState = {
      ...activeThreat,
      currentHp: postCritHp,
      stability: 100,
    };

    setThreat(freshThreatState);
    threatRef.current = freshThreatState;

    setIsPlayerTurn(false);
    cycleStateRef.current = 'TEXT_COMBAT';
    setCycleState('TEXT_COMBAT');

    setTimeout(() => {
      const rawIncomingDmg = Math.floor(10 + Math.random() * 6);
      applyEnemyDamage(rawIncomingDmg);
    }, 600);
  };

  const queueNextSliceSegment = (targetIndex: number) => {
    if (targetIndex >= 3) {
      evaluateSlicePerformance();
      return;
    }

    activeSliceIndexRef.current = targetIndex;
    setActiveSliceIndex(targetIndex);
    crossedRef.current = false;
    sliceStartXRef.current = null;

    const session = sliceSessionRef.current;
    if (session.segmentTimer) clearTimeout(session.segmentTimer);
    session.segmentTimer = setTimeout(() => {
      session.segmentTimer = null;
      sliceHandlersRef.current.queueNextSliceSegment(targetIndex + 1);
    }, 1200);
  };

  const scheduleSliceAdvance = (nextIndex: number) => {
    const session = sliceSessionRef.current;
    if (session.hitFlashTimer) clearTimeout(session.hitFlashTimer);
    session.hitFlashTimer = setTimeout(() => {
      session.hitFlashTimer = null;
      crossedRef.current = false;
      sliceStartXRef.current = null;
      sliceHandlersRef.current.queueNextSliceSegment(nextIndex);
    }, 180);
  };

  const validateLineCompletion = () => {
    const currentIdx = activeSliceIndexRef.current;
    if (currentIdx === -1 || crossedRef.current) return;
    if (cycleStateRef.current !== 'OFFENSE_SLICE') return;
    if (!sliceSessionRef.current.lines.some((line) => line.id === currentIdx)) return;

    crossedRef.current = true;
    clearSliceTimers();

    const registeredNewHit = registerSliceHit(currentIdx);
    if (registeredNewHit) {
      Vibration.vibrate(10);
      chargeKineticReservoir(ABYSSAL_RESERVE_CHARGE_PER_HIT);
    }

    scheduleSliceAdvance(currentIdx + 1);
  };

  const triggerSliceMiniGame = () => {
    clearSliceTimers();

    const freshSession = {
      lines: [] as SliceLineConfig[],
      hitCount: 0,
      slicedIds: new Set<number>(),
      segmentTimer: null as ReturnType<typeof setTimeout> | null,
      hitFlashTimer: null as ReturnType<typeof setTimeout> | null,
      evaluated: false,
    };
    sliceSessionRef.current = freshSession;

    crossedRef.current = false;
    sliceStartXRef.current = null;

    const randomizedConfigurations: SliceLineConfig[] = [];
    for (let i = 0; i < 3; i++) {
      const clampedRandomY = 60 + Math.floor(Math.random() * 80);
      const completelyRandomAngle = Math.floor(Math.random() * 130) - 65;

      randomizedConfigurations.push({
        id: i,
        topY: clampedRandomY,
        rotation: `${completelyRandomAngle}deg`,
        isSliced: false,
        fadeAnim: new Animated.Value(0),
      });
    }

    freshSession.lines = randomizedConfigurations;
    setSliceLines(randomizedConfigurations);
    activeSliceIndexRef.current = 0;
    setActiveSliceIndex(0);
    cycleStateRef.current = 'OFFENSE_SLICE';
    setCycleState('OFFENSE_SLICE');
    queueNextSliceSegment(0);
  };

  sliceHandlersRef.current = {
    queueNextSliceSegment,
    validateLineCompletion,
    evaluateSlicePerformance,
    triggerSliceMiniGame,
  };

  useEffect(() => {
    return () => clearSliceTimers();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        if (cycleStateRef.current === 'OFFENSE_SLICE') {
          sliceStartXRef.current = gestureState.x0;
          crossedRef.current = false;
        }
      },
     
      onPanResponderMove: (evt, gestureState) => {
        const currentIdx = activeSliceIndexRef.current;
        if (cycleStateRef.current !== 'OFFENSE_SLICE' || sliceStartXRef.current === null || crossedRef.current || currentIdx === -1) return;
        if (!sliceSessionRef.current.lines.some((line) => line.id === currentIdx)) return;

        const verticalDrift = Math.abs(gestureState.dy);
        if (verticalDrift > 90) return;

        if (Math.abs(gestureState.dx) >= 60) {
          sliceHandlersRef.current.validateLineCompletion();
        }
      },
      onPanResponderRelease: () => {
        if (cycleStateRef.current !== 'OFFENSE_SLICE') return;
        sliceStartXRef.current = null;
      },
    })
  ).current;

  const handleIncursionResolution = (victory: boolean) => {
    if (operativeHpRef.current <= 0) {
      victory = false;
    }
    shrinkAnim.stopAnimation();
    if (victory) {
      resolutionOutcomeRef.current = 'VICTORY';
      pushTerminalText('[EXORCISED] >> Apparition neutralized. Incursion sealed.');
      setCycleState('RESOLUTION');
      setResolutionOutcome('VICTORY');
      if (awardCurrencies) awardCurrencies(750, 25);
    } else {
      resolutionOutcomeRef.current = 'DEFEAT';
      setResolutionOutcome('DEFEAT');
      pushTerminalText('[CRITICAL] >> Operative soul anchor severed. Veil sync lost.');
      triggerVignetteFlash(COMBAT_PALETTE.defeatVignette, () => {
        setCycleState('RESOLUTION');
      });
    }
  };

  const handleDismissResolution = () => {
    if (resolutionDismissedRef.current) return;
    resolutionDismissedRef.current = true;
    const hp = operativeHpRef.current;
    const victory = resolutionOutcomeRef.current === 'VICTORY' && hp > 0;
    onCombatComplete?.({
      victory,
      remainingHp: hp,
      remainingStamina: staminaRef.current,
    });
  };

  return (
    <View style={styles.combatHubRoot}>
      <View style={[styles.blueprintContainer, { borderColor: theme.borderColor }]}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.borderColor }]}>
        <Text style={[styles.panelTitle, { color: theme.mutedColor }]}>
          VEIL INTERCEPT SYSTEM // CONSOLE: AEGIS_MAPPING // UNIT: {activeWeapon.name}
        </Text>
      </View>

      {/* --- REAL-TIME GRAPHICS CANVAS MATRIX --- */}
      <View style={styles.vectorCanvas}>
        {screenFlashActive && (
          <View style={styles.arenaFlashContainer} pointerEvents="none">
            <VignetteFlashOverlay color={screenFlashColor} opacityAnim={screenFlashAnim} />
          </View>
        )}

        {cycleState === 'TEXT_COMBAT' && isExhausted && (
          <Text style={[styles.exhaustedBanner, { color: '#ef4444' }]}>EXHAUSTED — SLICE/PARRY OFFLINE</Text>
        )}

        {cycleState === 'TEXT_COMBAT' && (
          <View style={styles.actionDashboardRow} pointerEvents="box-none">
            <Pressable
              onPress={handleBasicStrike}
              disabled={!isPlayerTurn}
              style={[styles.textActionNode, { borderColor: isPlayerTurn ? theme.primaryColor : theme.borderColor }]}
            >
              <Text style={[styles.btnLabelText, { color: isPlayerTurn ? theme.primaryColor : theme.mutedColor }]}>
                {stamina < STAMINA_ATTACK_COST
                  ? '[ WEAPON STRIKE (EXHAUSTED) ]'
                  : `[ WEAPON STRIKE (-${STAMINA_ATTACK_COST} STAM) ]`}
              </Text>
            </Pressable>

            <Pressable
              onPress={handlePrepareCounter}
              disabled={!isPlayerTurn || abyssalReserve < KINETIC_PARRY_UNLOCK || isExhausted}
              style={[
                styles.textActionNode,
                {
                  borderColor: parryReady && isPlayerTurn && !isExhausted ? COMBAT_PALETTE.parryActive : theme.borderColor,
                  opacity: parryReady && isPlayerTurn && !isExhausted ? 1 : 0.45,
                },
              ]}
            >
              <Text style={[
                styles.btnLabelText,
                { color: parryReady && isPlayerTurn && !isExhausted ? COMBAT_PALETTE.parryActive : theme.mutedColor },
              ]}>
                [ PARRY (-{KINETIC_PARRY_COST}% KR) ]
              </Text>
            </Pressable>

            <Pressable
              onPress={handleRestStance}
              disabled={!isPlayerTurn}
              style={[styles.textActionNode, { borderColor: theme.borderColor, opacity: isPlayerTurn ? 1 : 0.45 }]}
            >
              <Text style={[styles.btnLabelText, { color: theme.mutedColor }]}>
                [ REST STANCE (+{STAMINA_REGEN_PER_TURN} STAM) ]
              </Text>
            </Pressable>
          </View>
        )}


        {/* COMPONENT LAYER B: PARRY OVERRIDE ELEMENT */}
        <View style={[styles.combatLayoutWrapper, { display: cycleState === 'DEFEND_PARRY' ? 'flex' : 'none' }]}>
          <Pressable onPress={handleParryTap} style={styles.ringAnchorContainer} delayLongPress={0}>
            <View style={[styles.innerTargetVector, { borderColor: theme.primaryColor }]} />
            <Animated.View style={[styles.outerPerimeterRing, { borderColor: theme.primaryColor, transform: [{ scale: shrinkAnim }] }]} pointerEvents="none" />
          </Pressable>
          <Text style={[styles.reflexIndicatorOverlayText, { color: theme.primaryColor }]}>
            {kineticParryActive ? 'KINETIC PARRY CHANNEL OPEN' : 'ACTIVE COUNTER CHANNELS OPEN'}
          </Text>
        </View>

        {/* COMPONENT LAYER C: DRAG FINISHER FIELDS (HITBOX STABILIZATION) */}
        {cycleState === 'OFFENSE_SLICE' && (
          <View 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 999 }]} 
            {...panResponder.panHandlers}
          >
            {sliceLines.map((line) => {
              const isActive = activeSliceIndex === line.id;
              if (!isActive) return null;

              const isSliced = line.isSliced;
              const neonCrimson = '#ff1744';
              const bloomCore = '#ffe4e8';
              const glowColor = isSliced ? neonCrimson : '#ef4444';
              const filamentColor = isSliced ? bloomCore : '#ffffff';

              return (
                <Animated.View 
                  key={line.id}
                  style={[
                    styles.swipeLaserLineTrack, 
                    { 
                      top: line.topY,
                      opacity: line.fadeAnim, 
                      transform: [{ rotate: line.rotation }]
                    }
                  ]}
                  pointerEvents="none"
                >
                  {isSliced && (
                    <>
                      <View style={[styles.sliceAuraHalo, styles.sliceAuraHaloOuter, { backgroundColor: '#5c0606' }]} />
                      <View style={[styles.sliceAuraHalo, styles.sliceAuraHaloMid, { backgroundColor: '#c41010' }]} />
                      <View style={[styles.sliceAuraHalo, styles.sliceAuraHaloInner, { backgroundColor: neonCrimson }]} />
                    </>
                  )}

                  <View
                    style={[
                      isSliced ? styles.laserGlowBackdropSliced : styles.laserGlowBackdrop,
                      { backgroundColor: glowColor, shadowColor: glowColor },
                    ]}
                  />

                  <View
                    style={[
                      isSliced ? styles.laserFilamentCoreSliced : styles.laserFilamentCore,
                      { backgroundColor: filamentColor, shadowColor: isSliced ? neonCrimson : filamentColor },
                    ]}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        {cycleState === 'RESOLUTION' && (
          <View style={styles.resolutionBanner}>
            <Text style={[styles.victoryHeader, { color: resolutionOutcome === 'VICTORY' ? '#22c55e' : COMBAT_PALETTE.enemyHp }]}>
              {resolutionOutcome === 'VICTORY' ? 'HOSTILE NEUTRALIZED' : 'OPERATIVE SOUL DISCONNECTED'}
            </Text>
            <Pressable onPress={handleDismissResolution} style={[styles.dismissButton, { borderColor: resolutionOutcome === 'VICTORY' ? theme.primaryColor : COMBAT_PALETTE.enemyHp }]}>
              <Text style={[styles.dismissButtonText, { color: resolutionOutcome === 'VICTORY' ? theme.primaryColor : COMBAT_PALETTE.enemyHp }]}>
                {resolutionOutcome === 'VICTORY' ? '[ CONTINUE RUN ]' : '[ INCURSION FAILED ]'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* --- METER TRACKS STATUS DISPLAY --- */}
      {threat && (
        <View style={[styles.threatStatusSection, { borderColor: theme.borderColor }]}>
          <View style={styles.meterTextRow}>
            <Text style={[styles.meterLabel, { color: COMBAT_PALETTE.unitTitle }]}>{threat.designation}:</Text>
            <Text style={[styles.meterValue, { color: COMBAT_PALETTE.enemyHp }]}>
              {threat.currentHp} HP // {threat.stability}% POSTURE // {enemyMode}
            </Text>
          </View>
          <View style={[styles.meterTrack, { borderColor: COMBAT_PALETTE.enemyHp, marginBottom: 4 }]}>
            <View style={[styles.meterFill, { backgroundColor: COMBAT_PALETTE.enemyHp, width: `${threat.currentHp}%` }]} />
          </View>
          <View style={[styles.meterTrack, { borderColor: COMBAT_PALETTE.enemyPostureBorder }]}>
            <View style={[styles.meterFill, { backgroundColor: COMBAT_PALETTE.enemyPosture, width: `${threat.stability}%` }]} />
          </View>
        </View>
      )}

      <View style={[styles.operativeHeaderSection, { borderColor: theme.borderColor }]}>
        <View style={styles.meterTextRow}>
          <Text style={[styles.meterLabel, { color: COMBAT_PALETTE.unitTitle }]}>OPERATIVE UNIT:</Text>
          <Text style={[styles.meterValue, { color: COMBAT_PALETTE.enemyHp }]}>SOUL ANCHOR ACTIVE</Text>
        </View>
      </View>

      <View style={styles.meterSection}>
        <View style={styles.meterTextRow}>
          <Text style={[styles.meterLabel, { color: theme.mutedColor }]}>SOUL ANCHOR INTEGRITY:</Text>
          <Text style={[styles.meterValue, { color: COMBAT_PALETTE.enemyHp }]}>{operativeHp}/{maxSoulAnchor}</Text>
        </View>
        <View style={[styles.meterTrack, { borderColor: COMBAT_PALETTE.enemyHp }]}>
          <View style={[styles.meterFill, { backgroundColor: COMBAT_PALETTE.enemyHp, width: `${(operativeHp / maxSoulAnchor) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.meterSection}>
        <View style={styles.meterTextRow}>
          <Text style={[styles.meterLabel, { color: COMBAT_PALETTE.abyssalReserveBorder }]}>ABYSSAL RESERVE:</Text>
          <Text style={[styles.meterValue, { color: COMBAT_PALETTE.abyssalReserve }]}>
            {abyssalReserve}%{parryReady ? ' // PARRY READY' : ''}
          </Text>
        </View>
        <View style={[styles.meterTrack, { borderColor: COMBAT_PALETTE.abyssalReserveBorder }]}>
          <View style={[styles.meterFill, { backgroundColor: COMBAT_PALETTE.abyssalReserve, width: `${abyssalReserve}%` }]} />
        </View>
      </View>

      <View style={styles.dualStatsRowGrid}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.meterLabel, { color: theme.mutedColor }]}>STAMINA CORE: {stamina}/{maxStamina}</Text>
          <View style={[styles.meterTrack, { borderColor: theme.borderColor }]}>
            <View style={[styles.meterFill, { backgroundColor: '#22c55e', width: `${(stamina / maxStamina) * 100}%` }]} />
          </View>
        </View>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  combatHubRoot: {
    width: '100%',
    maxWidth: width - 16,
    alignSelf: 'center',
  },
  blueprintContainer: { borderWidth: 2, padding: 16, width: '100%', overflow: 'hidden' },
  operativeHeaderSection: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginBottom: 8,
  },
  arenaFlashContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    overflow: 'hidden',
  },
  panelHeader: { borderBottomWidth: 1, paddingBottom: 6, marginBottom: 12 },
  panelTitle: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
  vectorCanvas: { 
    minHeight: 200,
    height: 200,
    position: 'relative', 
    justifyContent: 'flex-end', 
    marginBottom: 12,
    overflow: 'hidden', 
    backgroundColor: '#000000',
  },
  radarSweepFrame: { width: '100%', height: '100%', borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  radarText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  exhaustedBanner: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 6,
  },
  actionDashboardRow: { flexDirection: 'column', gap: 6 },
  textActionNode: { borderWidth: 1, paddingVertical: 8, width: '100%', alignItems: 'center', justifyContent: 'center' },
  btnLabelText: { fontFamily: 'monospace', fontSize: 8, fontWeight: 'bold' },
  combatLayoutWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  reflexIndicatorOverlayText: { fontFamily: 'monospace', fontSize: 9, marginTop: 8, letterSpacing: 1 },
  sliceCanvasContainer: { 
    ...StyleSheet.absoluteFillObject, 
    position: 'relative', 
    width: '100%', 
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)' // Dim canvas to let neon pop
  },
  swipeLaserLineTrack: { 
    position: 'absolute', 
    left: 24,
    right: 24, 
    height: 40, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  laserGlowBackdrop: {
    position: 'absolute',
    width: '55%',
    alignSelf: 'center',
    height: 6,
    backgroundColor: '#ef4444',
    opacity: 0.45,
    borderRadius: 3,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  laserGlowBackdropSliced: {
    position: 'absolute',
    width: '62%',
    alignSelf: 'center',
    height: 8,
    opacity: 0.95,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 32,
    elevation: 16,
  },
  laserFilamentCore: {
    position: 'absolute',
    width: '55%',
    alignSelf: 'center',
    height: 2,
    backgroundColor: '#ffffff',
    borderRadius: 1,
    elevation: 8,
    shadowColor: '#ffffff',
  },
  laserFilamentCoreSliced: {
    position: 'absolute',
    width: '58%',
    alignSelf: 'center',
    height: 3,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 20,
  },
  sliceAuraHalo: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
  },
  sliceAuraHaloOuter: {
    width: '98%',
    height: 36,
    opacity: 0.14,
    shadowColor: '#5c0606',
    shadowRadius: 48,
  },
  sliceAuraHaloMid: {
    width: '82%',
    height: 22,
    opacity: 0.32,
    shadowColor: '#ff0033',
    shadowRadius: 36,
  },
  sliceAuraHaloInner: {
    width: '68%',
    height: 14,
    opacity: 0.55,
    shadowColor: '#ff1744',
    shadowRadius: 24,
  },
  swipeLineAlertLabelText: { 
    fontFamily: 'monospace', 
    fontSize: 7, 
    color: '#ffffff', 
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: '#000000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginTop: 18 // Keeps UI instructions tucked beneath the blade filament
  },
  ringAnchorContainer: { width: TARGET_SIZE, height: TARGET_SIZE, borderRadius: TARGET_RADIUS, justifyContent: 'center', alignItems: 'center' },
  innerTargetVector: { width: TARGET_SIZE, height: TARGET_SIZE, borderRadius: TARGET_RADIUS, borderWidth: 5, position: 'absolute' },
  outerPerimeterRing: { width: TARGET_SIZE, height: TARGET_SIZE, borderRadius: TARGET_RADIUS, borderWidth: 1.5, borderStyle: 'dashed', position: 'absolute' },
  threatStatusSection: { borderTopWidth: 1, paddingTop: 6, marginBottom: 8 },
  meterSection: { marginBottom: 6 },
  dualStatsRowGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meterTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  meterLabel: { fontFamily: 'monospace', fontSize: 9, marginBottom: 2 },
  meterValue: { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold' },
  meterTrack: { height: 6, borderWidth: 1, padding: 1, backgroundColor: 'transparent' },
  meterFill: { height: '100%' },
  resolutionBanner: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 8,
    alignItems: 'center',
    width: '100%',
  },
  victoryHeader: { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', marginBottom: 8, letterSpacing: 0.5 },
  dismissButton: { borderWidth: 1, paddingVertical: 8, width: '80%', alignItems: 'center' },
  dismissButtonText: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }
});