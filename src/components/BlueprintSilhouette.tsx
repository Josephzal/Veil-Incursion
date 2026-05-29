import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions, Pressable, Vibration, ScrollView, PanResponder } from 'react-native';
import { useTerminal } from '../context/TerminalContext';

const { width } = Dimensions.get('window');
const TARGET_SIZE = 80;
const TARGET_RADIUS = TARGET_SIZE / 2;

type IncursionState = 'SCANNING' | 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'OFFENSE_SLICE' | 'RESOLUTION';

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

export default function BlueprintSilhouette(): React.JSX.Element {
  const { theme, profile, awardCurrencies } = useTerminal();
  
  const contextWeaponId = profile?.operative_profile?.payload_manifest?.active_slots?.weapon_id || 'kinetic_glaive';
  const activeWeapon = WEAPON_REGISTRY[contextWeaponId] || WEAPON_REGISTRY['kinetic_glaive'];

  // Lifecycle State Machines
  const [cycleState, setCycleState] = useState<IncursionState>('SCANNING');
  const [threat, setThreat] = useState<ThreatProfile | null>(null);
  const threatRef = useRef<ThreatProfile | null>(null);
  const [combatLog, setCombatLog] = useState<string>('SYS: LEY-LINE RADAR NOMINAL. SCANNING VECTOR TIERS.');
  const [terminalFeed, setTerminalFeed] = useState<string[]>([]);
  
  useEffect(() => {
      threatRef.current = threat;
    }, [threat]);

  // Turn-Based Resource Trackers
  const [isPlayerTurn, setIsPlayerTurn] = useState<boolean>(true);
  const [counterPrepActive, setCounterPrepActive] = useState<boolean>(false);
  const [operativeHp, setOperativeHp] = useState<number>(100);
  const [stamina, setStamina] = useState<number>(10);
  const [energy, setEnergy] = useState<number>(10);

  // Mini-game Win/Loss Visual Flags
  const [isSuccessState, setIsSuccessState] = useState<boolean>(false);
  const [isFailureState, setIsFailureState] = useState<boolean>(false);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);

  // Animations
  const shrinkAnim = useRef(new Animated.Value(2.5)).current;
  const scanningPulseAnim = useRef(new Animated.Value(0.3)).current;
  const scrollRef = useRef<ScrollView>(null);
  
  // Swipe Slice Geometry
  const [activeSliceIndex, setActiveSliceIndex] = useState<number>(-1);
  const sliceStartXRef = useRef<number | null>(null);
  const crossedRef = useRef<boolean>(false);
  const CANVAS_WIDTH = width - 32;
  const [sliceLines, setSliceLines] = useState<SliceLineConfig[]>([]);

  useEffect(() => { cycleStateRef.current = cycleState; }, [cycleState]);

  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleStateRef = useRef<IncursionState>('SCANNING');
  const activeSliceIndexRef = useRef<number>(-1);

  useEffect(() => { cycleStateRef.current = cycleState; }, [cycleState]);
  useEffect(() => { activeSliceIndexRef.current = activeSliceIndex; }, [activeSliceIndex]);
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

  // Ambient Radar Scanner Loops
  useEffect(() => {
    if (cycleState === 'SCANNING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanningPulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanningPulseAnim, { toValue: 0.3, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = setTimeout(() => initiateVeilIncursion(), 2500);
    }
    return () => { if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current); };
  }, [cycleState]);

  const pushTerminalText = (text: string) => {
    setTerminalFeed((prev) => [...prev, text]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const initiateVeilIncursion = () => {
    const initialThreat: ThreatProfile = {
      designation: `APPARITION_UNIT_[${Math.floor(1000 + Math.random() * 9000)}]`,
      maxHp: 100,
      currentHp: 100,
      stability: 100, // Starts fully fortified
    };
    setThreat(initialThreat);
    setOperativeHp(100);
    setStamina(10);
    setEnergy(15);
    setCounterPrepActive(false);
    setIsPlayerTurn(true);
    setTerminalFeed([
      `>> CROSSING THE VEIL... ATTACHING SOUL ANCHORS TO URBAN LEY-LINES.`,
      `>> AEGIS COMBAT HARDWARE ENGAGED: ${activeWeapon.name}`,
      `>> TARGET SIGNATURE MARKED: ${initialThreat.designation}`
    ]);
    setCycleState('TEXT_COMBAT');
    setCombatLog(`YOUR TURN: CHOOSE COGNITIVE ACTIONS OR COUTNER VECTOR OVERRIDES.`);
  };

  // --- ⚔️ SYSTEM 1: TURN-BASED ACTIONS ⚔️ ---

  const handleBasicStrike = () => {
    if (cycleState !== 'TEXT_COMBAT' || !threat || !isPlayerTurn) return;
    if (stamina < 1) {
      pushTerminalText(`[REJECTED] >> Stamina depleted. Rest stance required.`);
      return;
    }

    setStamina((prev) => Math.max(prev - 1, 0));
    setEnergy((prev) => Math.min(prev + 12, 100));

    // Chip away at enemy stability meter
    const nextStability = Math.max(threat.stability - activeWeapon.stabilityChipping, 0);
    const updatedThreat = { ...threat, stability: nextStability };
    
    pushTerminalText(`[STRIKE] >> Slashed at ${threat.designation} with ${activeWeapon.name} (-1 STAM).`);
    
    if (nextStability <= 0) {
      // THE EARNED OPENING: Posture crushed, trigger Laser-Slice execution window instantly!
      setThreat(updatedThreat);
      pushTerminalText(`[CRITICAL APERTURE] >> Specter stability collapsed! Spectral plane fracturing!`);
      setCombatLog(`EXECUTION PHASE: SLICE LINES CONCURRENTLY TO SECURE BONUS DAMAGE.`);
      triggerSliceMiniGame();
    } else {
      // Process standard damage to HP
      const nextHp = Math.max(threat.currentHp - activeWeapon.strikeDamage, 0);
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

  const handlePrepareCounter = () => {
    if (cycleState !== 'TEXT_COMBAT' || !threat || !isPlayerTurn) return;
    if (stamina < 1) {
      pushTerminalText(`[REJECTED] >> Insufficient Stamina to array defense shields.`);
      return;
    }

    setStamina((prev) => Math.max(prev - 1, 0));
    setCounterPrepActive(true); // Trap is loaded!
    pushTerminalText(`[COUNTER MATRIX ARMED] >> Bracing weapon guard plane. Manual interception vectors locked.`);
    
    passTurnToEnemy(threat, true);
  };

  // --- 👹 SYSTEM 2: ENEMY TURN RESOLUTION ENGINE ---

  // 🛑 CHANGE THIS LINE: Add the isCountering parameter
  const passTurnToEnemy = (currentThreatState: ThreatProfile, isCountering: boolean = false) => {
    setIsPlayerTurn(false);
    setCombatLog(`HOSTILE INCOMING: WAITING FOR ENEMY VECTOR COMPUTATION...`);

    setTimeout(() => {
      if (currentThreatState.currentHp <= 0) return;

      // 🛑 CHANGE THIS LINE: Read the direct parameter instead of the state hook
      if (isCountering) {
        // TRIGGER REAL-TIME PARRY REFLEX HOOK
        pushTerminalText(`[INTERCEPT ALERT] >> ${currentThreatState.designation} lashes forward with a heavy strike vector!`);
        setCycleState('DEFEND_PARRY');
        setCombatLog(`REFLEX PARRY REQUIREMENT: CONVERGE SHIELD ON SWEET SPOT.`);
        executeRingPass();
      } else {
        // STANDARD AUTO-TEXT ATTACK
        const rawIncomingDmg = Math.floor(12 + Math.random() * 8);
        pushTerminalText(`[AUTO-COMBAT LOG] >> ${currentThreatState.designation} claws your aura layer, infliciting ${rawIncomingDmg} structural damage.`);
        
        setOperativeHp((prev) => {
          const nextHp = Math.max(prev - rawIncomingDmg, 0);
          if (nextHp <= 0) {
            handleIncursionResolution(false);
          } else {
            returnToPlayerTurn();
          }
          return nextHp;
        });
      }
    }, 1200);
  };

  const returnToPlayerTurn = () => {
    setCounterPrepActive(false);
    setIsPlayerTurn(true);
    // Recharge 1 stamina per turn cycle automatically like classic RPGs
    setStamina((prev) => Math.min(prev + 1, 10)); 
    setCycleState('TEXT_COMBAT');
    setCombatLog(`YOUR TURN: INPUT COMMAND STRATEGEMS.`);
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
          // Parry missed completely or user let ring lapse
          setIsFailureState(true);
          pushTerminalText(`[CRITICAL DEFENSE FAULT] >> Guard completely bypassed! Soul Anchor cracked.`);
          setOperativeHp((prev) => {
            const nextHp = Math.max(prev - 30, 0); // Enormous unblocked damage punishment
            if (nextHp <= 0) handleIncursionResolution(false);
            else returnToPlayerTurn();
            return nextHp;
          });
        }
      });
    });
  };

  const handleParryTap = () => {
    if (cycleStateRef.current !== 'DEFEND_PARRY' || isSuccessState || isFailureState) return;

    shrinkAnim.stopAnimation((currentScaleValue) => {
      const targetScale = 1.0;
      const deviation = Math.abs(currentScaleValue - targetScale);

      if (deviation <= activeWeapon.tolerance) {
        setIsSuccessState(true);
        setEnergy(100); // SUCCESS BONUSES: Instant absolute Energy maximum flood!
        pushTerminalText(`[PERFECT COUNTER] >> Absorb matrices locked! Negated 100% damage and flooded energy cores.`);
        Vibration.vibrate(activeWeapon.hapticDuration);
        
        // Stagger their health bar back in retaliation
        if (threat) {
          const staggerHp = Math.max(threat.currentHp - 15, 0);
          setThreat({ ...threat, currentHp: staggerHp });
          if (staggerHp <= 0) {
            handleIncursionResolution(true);
            return;
          }
        }
        returnToPlayerTurn();
      } else {
        setIsFailureState(true);
        pushTerminalText(`[DEFLECTION REFRACTED] >> Off-rhythm collision! Guard collapsed.`);
        setOperativeHp((prev) => {
          const nextHp = Math.max(prev - 25, 0);
          if (nextHp <= 0) handleIncursionResolution(false);
          else returnToPlayerTurn();
          return nextHp;
        });
      }
    });
  };


  // ---  SKILL EVENT 2: KINETIC STABILITY SLICE FINISHER ---


  const triggerSliceMiniGame = () => {
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
        fadeAnim: new Animated.Value(0)
      });
    }

    setSliceLines(randomizedConfigurations);
    setActiveSliceIndex(0);
    setCycleState('OFFENSE_SLICE');

    // Clear any leftover system clock timers before building the new chain
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    
    // Seed the first lifecycled line countdown frame
    queueNextSliceSegment(0);
  };

  const queueNextSliceSegment = (targetIndex: number) => {
    // If we've run through all 3 tracks, run evaluation math immediately
    if (targetIndex >= 3) {
      evaluateSlicePerformance();
      return;
    }

    setActiveSliceIndex(targetIndex);

    // Set a natural 1.2s timeout window for the player to react
    cycleTimeoutRef.current = setTimeout(() => {
      crossedRef.current = false;
      sliceStartXRef.current = null;
      queueNextSliceSegment(targetIndex + 1);
    }, 1200);
  };

  // 📍 REPLACE YOUR ENTIRE CURRENT validateLineCompletion FUNCTION WITH THIS COMBINED HOOK:
  const validateLineCompletion = () => {
    Vibration.vibrate(10);
    const currentIdx = activeSliceIndexRef.current;
    if (currentIdx === -1 || crossedRef.current) return;
    
    crossedRef.current = true; // Block duplicate swipes on this line instance

    // 1. KILL THE TIMEOUT: Freeze the timer clock immediately so it holds still
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);

    // 2. STAMP STATE SEVER: Turn this specific line deep red in state tracking
    setSliceLines((prevLines) => 
      prevLines.map((line) => line.id === currentIdx ? { ...line, isSliced: true } : line)
    );

    // 3. HIT-FLASH FREEZE DELAY: Wait 180ms to let the red flash register, then advance
    setTimeout(() => {
      sliceStartXRef.current = null;
      crossedRef.current = false;
      
      // Advance to the next line or end the minigame
      queueNextSliceSegment(currentIdx + 1);
    }, 180); 
  };

  // 📍 PASTE THIS ENTIRE NEW DAMAGE RESOLUTION MODULE IMMEDIATELY BELOW validateLineCompletion:
  const evaluateSlicePerformance = () => {
    setActiveSliceIndex(-1);
    const activeThreat = threatRef.current;
    
    if (!activeThreat) {
      returnToPlayerTurn();
      return;
    }

    // Direct configuration scan: access mutated slice tracking metrics inside state hooks
    // Filter down to get an absolute true tally of perfect hits
    let correctStrikes = 0;
    setSliceLines((latestLines) => {
      correctStrikes = latestLines.filter(l => l.isSliced).length;
      return latestLines;
    });

    // Execute variable output logic paths based on performance tiers
    if (correctStrikes === 0) {
      pushTerminalText(`[EXECUTION FAILED] >>> You failed to slice any vector vectors in time! 0 damage dealt.`);
      
      const resetThreat = { ...activeThreat, stability: 100 };
      setThreat(resetThreat);
      threatRef.current = resetThreat;
      passTurnToEnemy(resetThreat, false);
      return;
    }

    // Scaled performance modifier math: 1 hit = base, 2 hits = medium, 3 hits = massive multiplier
    const scalingFactor = correctStrikes === 3 ? 3.5 : correctStrikes === 2 ? 2.0 : 1.0;
    const finalDamage = Math.floor(activeWeapon.strikeDamage * scalingFactor);
    const postCritHp = Math.max(activeThreat.currentHp - finalDamage, 0);

    pushTerminalText(`[EXECUTION SEVERANCE] >>> Connected [${correctStrikes}/3] vector cuts! Inflicted ${finalDamage} damage.`);

    if (postCritHp <= 0) {
      setThreat({ ...activeThreat, currentHp: 0, stability: 100 });
      handleIncursionResolution(true);
      return;
    }

    const freshThreatState = {
      ...activeThreat,
      currentHp: postCritHp,
      stability: 100
    };

    setThreat(freshThreatState);
    threatRef.current = freshThreatState;

    // Transition back into standard automated text loop combat processing turns
    setIsPlayerTurn(false);
    setCycleState('TEXT_COMBAT');
    setCombatLog(`HOSTILE INCOMING: VEIL ANOMALY RE-STABILIZING...`);

    setTimeout(() => {
      const rawIncomingDmg = Math.floor(10 + Math.random() * 6);
      pushTerminalText(`[AUTO-COMBAT] >> ${freshThreatState.designation} recovers from stagger, dealing ${rawIncomingDmg} damage.`);
      
      setOperativeHp((prev) => {
        const nextHp = Math.max(prev - rawIncomingDmg, 0);
        if (nextHp <= 0) {
          handleIncursionResolution(false);
        } else {
          setCounterPrepActive(false);
          setIsPlayerTurn(true);
          setStamina((prevStam) => Math.min(prevStam + 1, 10)); 
          setCombatLog(`YOUR TURN: INPUT COMMAND STRATEGEMS.`);
        }
        return nextHp;
      });
    }, 1200);
  };

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
      // 📍 REPLACE THE ENTIRE onPanResponderMove INTERNALS INSIDE YOUR PANRESPONDER WITH THIS:
      onPanResponderMove: (evt, gestureState) => {
        const currentIdx = activeSliceIndexRef.current;
        if (cycleStateRef.current !== 'OFFENSE_SLICE' || sliceStartXRef.current === null || crossedRef.current || currentIdx === -1) return;

        // 1. Resolve target layout coordinates safely
        let targetLineY = 100;
        setSliceLines((currentLines) => {
          const activeLineData = currentLines.find(l => l.id === currentIdx);
          if (activeLineData) targetLineY = activeLineData.topY;
          return currentLines;
        });

        // 🚨 FIXED SPATIAL PROXIMITY CHECK
        // gestureState.dy tracks how far your finger has drifted vertically since the swipe started.
        // If you are cutting straight across horizontally, dy stays close to 0. If you drag wildly up/down, it blocks it.
        const verticalDrift = Math.abs(gestureState.dy);
        if (verticalDrift > 90) return; // Forgiving vertical deviation threshold lock

        const currentX = gestureState.moveX;
        const startX = sliceStartXRef.current;
        const center = CANVAS_WIDTH / 2;
        const MIN_SLICE_DISTANCE = 60; // Slightly shortened swipe requirement for faster performance response

        if (startX < center && currentX > (startX + MIN_SLICE_DISTANCE)) {
          validateLineCompletion();
        } 
        else if (startX > center && currentX < (startX - MIN_SLICE_DISTANCE)) {
          validateLineCompletion();
        }
      },
      onPanResponderRelease: () => {
        sliceStartXRef.current = null;
        crossedRef.current = false;
      },
    })
  ).current;

  const handleIncursionResolution = (victory: boolean) => {
    shrinkAnim.stopAnimation();
    setCycleState('RESOLUTION');
    if (victory) {
      setResolutionOutcome('VICTORY');
      setCombatLog('SYS: APPARITION CONDENSED // CORE BOUND AND SECURED.');
      if (awardCurrencies) awardCurrencies(750, 25);
    } else {
      setResolutionOutcome('DEFEAT');
      setCombatLog('CRITICAL SYNC BREAKDOWN: VEIL CONSUMED OPERATIVE ANCHOR.');
    }
  };

  return (
    <View style={[styles.blueprintContainer, { borderColor: theme.borderColor }]}>
      <View style={[styles.panelHeader, { borderBottomColor: theme.borderColor }]}>
        <Text style={[styles.panelTitle, { color: theme.mutedColor }]}>
          VEIL INTERCEPT SYSTEM // CONSOLE: AEGIS_MAPPING // UNIT: {activeWeapon.name}
        </Text>
      </View>

      {/* --- REAL-TIME GRAPHICS CANVAS MATRIX --- */}
      <View style={styles.vectorCanvas}>
        {cycleState === 'SCANNING' && (
          <Animated.View style={[styles.radarSweepFrame, { borderColor: theme.primaryColor, opacity: scanningPulseAnim }]}>
            <Text style={[styles.radarText, { color: theme.primaryColor }]}>LOCATING ECTOPLASMIC COORD FIELDS...</Text>
          </Animated.View>
        )}

        {/* COMPONENT LAYER A: TABLETOP TEXT SHELL */}
        {cycleState === 'TEXT_COMBAT' && (
          <View style={styles.textCombatInterface}>
            <ScrollView ref={scrollRef} style={styles.terminalScrollBox}>
              {terminalFeed.map((line, idx) => (
                <Text key={idx} style={[styles.terminalLineText, { color: theme.primaryColor }]}>{line}</Text>
              ))}
            </ScrollView>
            
            {/* ACTION DASHBOARD CONTROLS */}
            <View style={styles.actionDashboardRow}>
              <Pressable 
                onPress={handleBasicStrike} 
                disabled={!isPlayerTurn}
                style={[styles.textActionNode, { borderColor: isPlayerTurn ? theme.primaryColor : theme.borderColor }]}
              >
                <Text style={[styles.btnLabelText, { color: isPlayerTurn ? theme.primaryColor : theme.mutedColor }]}>
                  [ WEAPON STRIKE (-1 STAM) ]
                </Text>
              </Pressable>
              
              <Pressable 
                onPress={handlePrepareCounter} 
                disabled={!isPlayerTurn}
                style={[styles.textActionNode, { borderColor: isPlayerTurn ? '#3b82f6' : theme.borderColor }]}
              >
                <Text style={[styles.btnLabelText, { color: isPlayerTurn ? '#3b82f6' : theme.mutedColor }]}>
                  [ PARRY REDIRECT METHOD ]
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* COMPONENT LAYER B: PARRY OVERRIDE ELEMENT */}
        <View style={[styles.combatLayoutWrapper, { display: cycleState === 'DEFEND_PARRY' ? 'flex' : 'none' }]}>
          <Pressable onPress={handleParryTap} style={styles.ringAnchorContainer} delayLongPress={0}>
            <View style={[styles.innerTargetVector, { borderColor: theme.primaryColor }]} />
            <Animated.View style={[styles.outerPerimeterRing, { borderColor: theme.primaryColor, transform: [{ scale: shrinkAnim }] }]} pointerEvents="none" />
          </Pressable>
          <Text style={[styles.reflexIndicatorOverlayText, { color: theme.primaryColor }]}>ACTIVE COUNTER CHANNELS OPEN</Text>
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

              // Dynamic color interpolation calculated directly from state values
              const glowColor = line.isSliced ? '#5c0606' : '#ef4444'; // Deep dark red on hit, bright red on active
              const filamentColor = line.isSliced ? '#800c0c' : '#ffffff'; // Dark core vs vibrant core

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
                  {/* Outer Shroud using dynamic color vectors */}
                  <View style={[styles.laserGlowBackdrop, { backgroundColor: glowColor, shadowColor: glowColor }]} />
                  
                  {/* Filament Inner Core using dynamic color vectors */}
                  <View style={[styles.laserFilamentCore, { backgroundColor: filamentColor, shadowColor: filamentColor }]} />
                  
                 
                </Animated.View>
              );
            })}
          </View>
        )}

        {cycleState === 'RESOLUTION' && (
          <View style={styles.resolutionFrame}>
            <Text style={[styles.victoryHeader, { color: resolutionOutcome === 'VICTORY' ? '#22c55e' : '#ef4444' }]}>
              {resolutionOutcome === 'VICTORY' ? 'INTRUSION DECONSTRUCTED' : 'OPERATIVE SOUL DISCONNECTED'}
            </Text>
            <Pressable onPress={() => setCycleState('SCANNING')} style={[styles.dismissButton, { borderColor: theme.primaryColor }]}>
              <Text style={[styles.dismissButtonText, { color: theme.primaryColor }]}>[ SYNC LOCAL SECTOR RADAR ]</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* --- METER TRACKS STATUS DISPLAY --- */}
      {threat && (cycleState !== 'SCANNING' && cycleState !== 'RESOLUTION') && (
        <View style={[styles.threatStatusSection, { borderColor: theme.borderColor }]}>
          <View style={styles.meterTextRow}>
            <Text style={[styles.meterLabel, { color: '#ef4444' }]}>{threat.designation}:</Text>
            <Text style={[styles.meterValue, { color: '#ef4444' }]}>{threat.currentHp} HP // {threat.stability}% STABILITY</Text>
          </View>
          <View style={[styles.meterTrack, { borderColor: '#ef4444', marginBottom: 4 }]}>
            <View style={[styles.meterFill, { backgroundColor: '#ef4444', width: `${threat.currentHp}%` }]} />
          </View>
          <View style={[styles.meterTrack, { borderColor: '#eab308' }]}>
            <View style={[styles.meterFill, { backgroundColor: '#eab308', width: `${threat.stability}%` }]} />
          </View>
        </View>
      )}

      <View style={[styles.readoutFeed, { backgroundColor: theme.backgroundColor === '#000000' ? '#0d0d0d' : '#141619' }]}>
        <Text style={[styles.feedText, { color: theme.primaryColor }]}>{combatLog}</Text>
      </View>

      <View style={styles.meterSection}>
        <View style={styles.meterTextRow}>
          <Text style={[styles.meterLabel, { color: theme.mutedColor }]}>SOUL ANCHOR INTEGRITY:</Text>
          <Text style={[styles.meterValue, { color: theme.primaryColor }]}>{operativeHp}%</Text>
        </View>
        <View style={[styles.meterTrack, { borderColor: theme.borderColor }]}><View style={[styles.meterFill, { backgroundColor: theme.primaryColor, width: `${operativeHp}%` }]} /></View>
      </View>

      <View style={styles.dualStatsRowGrid}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={[styles.meterLabel, { color: theme.mutedColor }]}>STAMINA CORE: {stamina}/10</Text>
          <View style={[styles.meterTrack, { borderColor: theme.borderColor }]}><View style={[styles.meterFill, { backgroundColor: '#22c55e', width: `${stamina * 10}%` }]} /></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.meterLabel, { color: theme.mutedColor }]}>KINETIC RESERVOIR: {energy}%</Text>
          <View style={[styles.meterTrack, { borderColor: theme.borderColor }]}><View style={[styles.meterFill, { backgroundColor: '#eab308', width: `${energy}%` }]} /></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blueprintContainer: { borderWidth: 2, padding: 16, width: width - 32, alignSelf: 'center', marginTop: 16 },
  panelHeader: { borderBottomWidth: 1, paddingBottom: 6, marginBottom: 12 },
  panelTitle: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 0.5 },
  vectorCanvas: { 
    height: 200, 
    position: 'relative', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 12,
    overflow: 'hidden', 
    backgroundColor: '#000000' // Dark backing makes neon stand out cleanly
  },
  radarSweepFrame: { width: '100%', height: '100%', borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  radarText: { fontFamily: 'monospace', fontSize: 10, letterSpacing: 1 },
  textCombatInterface: { width: '100%', height: '100%', justifyContent: 'space-between' },
  terminalScrollBox: { flex: 1, width: '100%', marginBottom: 6 },
  terminalLineText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 14, marginBottom: 1 },
  actionDashboardRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  textActionNode: { borderWidth: 1, paddingVertical: 8, flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  laserFilamentCore: {
    position: 'absolute',
    width: '55%',
    alignSelf: 'center',
    height: 2,
    backgroundColor: '#ffffff', // High intensity center line
    borderRadius: 1,
    elevation: 8,
    shadowColor: '#ffffff',
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
  readoutFeed: { padding: 8, minHeight: 40, justifyContent: 'center', marginBottom: 8 },
  feedText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 13 },
  meterSection: { marginBottom: 6 },
  dualStatsRowGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meterTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  meterLabel: { fontFamily: 'monospace', fontSize: 9, marginBottom: 2 },
  meterValue: { fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold' },
  meterTrack: { height: 6, borderWidth: 1, padding: 1, backgroundColor: 'transparent' },
  meterFill: { height: '100%' },
  resolutionFrame: { justifyContent: 'center', alignItems: 'center', width: '100%' },
  victoryHeader: { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', marginBottom: 12 },
  dismissButton: { borderWidth: 1, paddingVertical: 8, width: '80%', alignItems: 'center' },
  dismissButtonText: { fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }
});