import type { CheckStatus } from '../types/game';

type ChoiceKey = 'A' | 'B';

export interface CityStreetsMatrixTemplate {
  id: string;
  title: string;
  scenarioText: string;
  choiceA: { label: string; requirement: string };
  choiceB: { label: string; requirement: string };
  interactionMode: 'standard' | 'conditional';
}

/** Depth 0 — alleyway / street-grid narrative pool only. */
export const CITY_STREETS_DEPTH_ZERO_POOL: readonly string[] = [
  'city-07',
  'city-08',
  'city-09',
  'city-10',
  'city-11',
  'city-12',
  'city-13',
  'city-14',
  'city-15',
  'city-16',
  'city-17',
  'city-18',
  'city-19',
  'city-20',
] as const;

export const CITY_STREETS_ALLEY_MATRIX_EVENTS: Record<string, CityStreetsMatrixTemplate> = {
  'city-07': {
    id: 'city-07',
    title: 'RUMMAGING THE SCRAP',
    scenarioText:
      'A rusted municipal dumpster overflows with damp cardboard. Beneath the trash, a rhythmic scratching claws at the plastic lining — accompanied by a cold, copper stench like fresh blood.',
    choiceA: { label: '[ A ] CLASS BLUEPRINT EXTRACTION', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] THE BLIND GRAB', requirement: 'CHAIN ANCHOR B' },
    interactionMode: 'standard',
  },
  'city-08': {
    id: 'city-08',
    title: 'GRAVITY INVERSION',
    scenarioText:
      'A low hum vibrates through your teeth. The sky yawns beneath your boots as the asphalt ceiling hangs above you — the alleyway has inverted, leaving you balanced on rusted fire-escape railings.',
    choiceA: { label: '[ A ] ANCHOR THE WEIGHT', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] RIDE THE DESCENT', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-09': {
    id: 'city-09',
    title: 'SCURRY',
    scenarioText:
      'A grease-stained pizza box sits under a flickering street lamp. Oversized rats with bioluminescent purple eyes drain its color, leaving an ash-white husk.',
    choiceA: { label: '[ A ] DISPERSE WITH FORCE', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] COMMUNE WITH THE VOID', requirement: 'CHAIN ANCHOR B' },
    interactionMode: 'standard',
  },
  'city-10': {
    id: 'city-10',
    title: 'LIVING SLUDGE',
    scenarioText:
      'Wet cardboard, medical waste, and torn plastic crawl together into a crude four-legged shape. Your HUD flashes: ORGANIC MASS CONVERGENCE DETECTED.',
    choiceA: { label: '[ A ] INCINERATE THE MASS', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] DISRUPT THE STRUCTURE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-11': {
    id: 'city-11',
    title: 'THE INFINITE STROBE',
    scenarioText:
      'Every traffic signal along the avenue turns blood-red at once. Plastic casings melt, dripping boiling tar onto the crosswalk as the lights hum a low Gregorian chant.',
    choiceA: { label: '[ A ] THE RHYTHM TRACE', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SPRINT THE INTERSECTION', requirement: 'CHAIN ANCHOR B' },
    interactionMode: 'standard',
  },
  'city-12': {
    id: 'city-12',
    title: 'THE GHOST MARCH',
    scenarioText:
      'A silent crowd blockades the intersection — hundreds of translucent civilians hold unlit candles, faces blank, marching backward in a slow, agonizing loop.',
    choiceA: { label: '[ A ] BLEND IN', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] DISRUPT THE LINE', requirement: 'CHAIN ANCHOR B' },
    interactionMode: 'standard',
  },
  'city-13': {
    id: 'city-13',
    title: 'GRIDLOCK',
    scenarioText:
      'Hundreds of rusted sedans and buses clog the highway. Fused horns scream an endless chord. Calcified ash statues grip melted steering wheels.',
    choiceA: { label: '[ A ] MUFFLE THE FREQUENCY', requirement: 'CHAIN ANCHOR A' },
    choiceB: { label: '[ B ] SALVAGE FUEL CELLS', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-14': {
    id: 'city-14',
    title: 'NON-EUCLIDEAN BOULEVARD',
    scenarioText:
      'The road bends vertically into the clouds. Street signs and telephone poles repeat in impossible patterns. Your interface prints: PARALYSIS WARNING — ARCHITECTURAL DEFECT.',
    choiceA: { label: '[ A ] ENFORCE MATERIAL LAW', requirement: 'CHAIN ANCHOR A' },
    choiceB: { label: '[ B ] WALK THE SHIFTING LINE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-15': {
    id: 'city-15',
    title: 'THE SPIRAL PATH',
    scenarioText:
      'Concrete sidewalk tiles peel up like ribbons, spinning into a helical maze that shifts every time you blink. Your navigation marker spins wildly, unable to lock an exit.',
    choiceA: { label: '[ A ] TRACE THE GRID', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] BRUTE FORCE THE MAZE', requirement: 'CHAIN ANCHOR B' },
    interactionMode: 'standard',
  },
  'city-16': {
    id: 'city-16',
    title: 'HIGHWAY MADNESS',
    scenarioText:
      'Two translucent burning cars are locked in a perpetual high-speed T-bone. Phantom drivers scream curses as spectral shockwaves warp the air around them.',
    choiceA: { label: '[ A ] QUENCH THE FLAME', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] SIPHON THE FRICTION', requirement: 'CHAIN ANCHOR A' },
    interactionMode: 'standard',
  },
  'city-17': {
    id: 'city-17',
    title: 'EMERGENCY PROTOCOL',
    scenarioText:
      'A vintage ambulance sits crooked on the median, cherry lights spinning silently. Glowing green ectoplasm pumps from the gurney and spills across the concrete.',
    choiceA: { label: '[ A ] HARVEST THE FLUID', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] PURIFY THE VEHICLE', requirement: 'CHAIN ANCHOR A' },
    interactionMode: 'standard',
  },
  'city-18': {
    id: 'city-18',
    title: 'SECTOR LOCKDOWN',
    scenarioText:
      'Abandoned police cruisers form a V-shaped blockade. Dashboard radios loop synthesized voices reading names and birth dates of people not yet born.',
    choiceA: { label: '[ A ] OVERRIDE THE CONSOLE', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] FORCIBLY BREACH THE LINE', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
  'city-19': {
    id: 'city-19',
    title: 'EXTERNAL IGNITION',
    scenarioText:
      'A fire engine is wrapped around a utility pole. Ruptured hoses suck freezing shadows from storm drains and spray them into the air.',
    choiceA: { label: '[ A ] SEVER THE HOSES', requirement: 'D20 CALIBRATION' },
    choiceB: { label: '[ B ] RE-ROUTE THE PUMP', requirement: 'CHAIN ANCHOR A' },
    interactionMode: 'standard',
  },
  'city-20': {
    id: 'city-20',
    title: 'THE CURIO BAZAAR',
    scenarioText:
      'Folding tables line the plaza — family photos, pocket watches, jars of teeth. No vendors remain. A hand-painted sign reads: THE PRICE IS YOUR RESOLVE.',
    choiceA: { label: '[ A ] BUY A MYSTERIOUS ARTIFACT', requirement: 'CHAIN ANCHOR B' },
    choiceB: { label: '[ B ] LOOT THE OPEN REGISTERS', requirement: 'D20 CALIBRATION' },
    interactionMode: 'standard',
  },
};

export interface AlleyResolutionSnapshot {
  maxSoulAnchor: number;
  soulAnchorIntegrity: number;
  maxStamina: number;
  currentStamina: number;
  startingAbyssalReservePercent: number;
}

export interface AlleyResolutionPatch {
  progressPatch: {
    narrativeModifiers?: Partial<{
      nextCombatEnemyHpBonusPct: number;
      nextCombatDamageBonusPct: number;
      bossArmorPiercePct: number;
      nodeNineCalibrationBonusPct: number;
      bossShieldBypassPct: number;
    }>;
    cryptoGlimmerGrantPct?: number;
    pendingCombatAmbush?: boolean;
  };
  flags: string[];
  outcome: string;
  status: CheckStatus;
}

type AlleyApplyFns = {
  applyMaxShield: (pct: number) => void;
  applyCurrentShield: (pct: number) => void;
  applyMaxHp: (pct: number) => void;
  applyCurrentHp: (pct: number) => void;
  applyCurrentEnergy: (pct: number) => void;
  applyMaxStamina: (pct: number) => void;
  applyCurrentStamina: (pct: number) => void;
};

export function isCityStreetsAlleyEvent(matrixId: string): boolean {
  return matrixId in CITY_STREETS_ALLEY_MATRIX_EVENTS;
}

export function resolveCityStreetsAlleyEvent(
  matrixId: string,
  choice: ChoiceKey,
  success: boolean,
  apply: AlleyApplyFns,
): AlleyResolutionPatch | null {
  if (!isCityStreetsAlleyEvent(matrixId)) return null;

  let progressPatch: AlleyResolutionPatch['progressPatch'] = {};
  const flags: string[] = [];
  let outcome = '';
  let status: CheckStatus = success ? 'SUCCESS' : 'FAILURE';

  switch (matrixId) {
    case 'city-07':
      if (choice === 'A') {
        if (success) {
          apply.applyCurrentShield(15);
          outcome = '>> BLUEPRINT EXTRACTION SUCCESS — Curdling Elixir absorbed. +15% Shield Integrity.';
        } else {
          apply.applyCurrentHp(-10);
          outcome = '>> BLUEPRINT EXTRACTION FAILURE — Lid snapped shut. -10% Current HP.';
        }
      } else {
        apply.applyMaxStamina(-5);
        flags.push('shattered_focus_lens');
        outcome = '>> BLIND GRAB — Shattered Focus Lens recovered. -5% Max Stamina. FLAG: shattered_focus_lens.';
        status = 'SUCCESS';
      }
      break;

    case 'city-08':
      if (choice === 'A') {
        if (success) {
          apply.applyCurrentEnergy(20);
          outcome = '>> ANCHOR SUCCESS — Ectoplasmic residue collected. +20% Energy.';
        } else {
          apply.applyCurrentHp(-15);
          outcome = '>> ANCHOR FAILURE — Dropped onto street signs. -15% Current HP.';
        }
      } else if (success) {
        progressPatch = { narrativeModifiers: { nextCombatDamageBonusPct: 10 } };
        outcome = '>> KINETIC DRIFT — +10% critical strike damage next 3 combats.';
      } else {
        progressPatch = { cryptoGlimmerGrantPct: -30 };
        outcome = '>> KINETIC DRIFT FAILURE — Tactical pack lost to the void. -30% Crypto-Glimmer.';
      }
      break;

    case 'city-09':
      if (choice === 'A') {
        if (success) {
          progressPatch = { cryptoGlimmerGrantPct: 20 };
          outcome = '>> VERMIN DISPERSED — Luxury goods scavenged. +20% Crypto-Glimmer.';
        } else {
          apply.applyCurrentHp(-5);
          apply.applyCurrentShield(-10);
          outcome = '>> SWARM PANIC — -5% Current HP / -10% Current Shield.';
        }
      } else {
        apply.applyCurrentHp(15);
        outcome = '>> VOID COMMUNE — Rats transfer vitality. +15% Current HP.';
        status = 'SUCCESS';
      }
      break;

    case 'city-10':
      if (choice === 'A') {
        if (success) {
          apply.applyCurrentShield(20);
          outcome = '>> INCINERATION SUCCESS — Molten ingot restores +20% Shield Integrity.';
        } else {
          progressPatch = { pendingCombatAmbush: true };
          outcome = '>> INCINERATION FAILURE — Vile Convergence spirit manifests. Combat ambush.';
        }
      } else if (success) {
        flags.push('scavengers_eye');
        outcome = '>> LEYLINE TRACE SUCCESS — Scavenger\'s Eye unlocked. FLAG: scavengers_eye.';
      } else {
        progressPatch = { pendingCombatAmbush: true };
        outcome = '>> LEYLINE TRACE FAILURE — Vile Convergence spirit attacks. Combat ambush.';
      }
      break;

    case 'city-11':
      if (choice === 'A') {
        if (success) {
          flags.push('focused_sight');
          outcome = '>> RHYTHM TRACE SUCCESS — Focused Sight active. FLAG: focused_sight.';
        } else {
          outcome = '>> RHYTHM TRACE FAILURE — Illusion persists. No reward.';
          status = 'FAILURE';
        }
      } else {
        apply.applyCurrentStamina(-15);
        progressPatch = { narrativeModifiers: { nextCombatDamageBonusPct: 15 } };
        outcome = '>> SPRINT SUCCESS — Iron Will primed. -15% Stamina / +15% stability next 2 combats.';
        status = 'SUCCESS';
      }
      break;

    case 'city-12':
      if (choice === 'A') {
        if (success) {
          flags.push('hallowed_rosary');
          outcome = '>> BLEND IN SUCCESS — Hallowed Rosary recovered. FLAG: hallowed_rosary.';
        } else {
          apply.applyCurrentHp(-15);
          progressPatch = { pendingCombatAmbush: true };
          outcome = '>> BLEND IN FAILURE — Horde screams. -15% HP. Combat ambush.';
        }
      } else {
        flags.push('haunted_echo');
        apply.applyCurrentHp(10);
        progressPatch = { narrativeModifiers: { nextCombatEnemyHpBonusPct: 10 } };
        outcome = '>> LINE DISRUPTED — Haunted Echo curse. +10 HP / enemies +10% damage next 3 nodes.';
        status = 'SUCCESS';
      }
      break;

    case 'city-13':
      if (choice === 'A') {
        apply.applyMaxHp(15);
        outcome = '>> FREQUENCY MUFFLED — Absolute stillness. +15% Max Shield.';
        status = 'SUCCESS';
      } else if (success) {
        apply.applyCurrentEnergy(30);
        outcome = '>> FUEL CELLS SALVAGED — +30% Energy injection.';
      } else {
        apply.applyCurrentHp(-10);
        apply.applyCurrentShield(-10);
        outcome = '>> BATTERY CHAIN REACTION — -10% Current HP / -10% Current Shield.';
      }
      break;

    case 'city-14':
      if (choice === 'A') {
        apply.applyMaxStamina(20);
        outcome = '>> MATERIAL LAW ENFORCED — Street restored. +20% Max Stamina.';
        status = 'SUCCESS';
      } else if (success) {
        flags.push('void_weft_tonal');
        outcome = '>> SHIFTING LINE TRAVERSED — Void-Weft Tonal active. FLAG: void_weft_tonal.';
      } else {
        apply.applyCurrentHp(-15);
        outcome = '>> ARCHITECTURAL TEAR — -15% Current HP.';
      }
      break;

    case 'city-15':
      if (choice === 'A') {
        if (success) {
          apply.applyCurrentEnergy(10);
          outcome = '>> GRID TRACED — Static exit revealed. +10% Energy.';
        } else {
          outcome = '>> GRID TRACE FAILURE — Maze tightens. No reward.';
          status = 'FAILURE';
        }
      } else {
        progressPatch = { cryptoGlimmerGrantPct: 15 };
        apply.applyCurrentStamina(-15);
        outcome = '>> MAZE SHATTERED — +15 Crypto-Glimmer / -15% Current Stamina.';
        status = 'SUCCESS';
      }
      break;

    case 'city-16':
      if (choice === 'A') {
        if (success) {
          apply.applyCurrentShield(20);
          progressPatch = { cryptoGlimmerGrantPct: 30 };
          outcome = '>> COUNTER POSTURE SUCCESS — +20% Shield / +30% Crypto-Glimmer.';
        } else {
          apply.applyCurrentHp(-15);
          outcome = '>> COUNTER POSTURE FAILURE — Ghost collision. -15% Current HP.';
        }
      } else {
        apply.applyCurrentEnergy(30);
        outcome = '>> FRICTION SIPHONED — Weapon overloaded. +30% Energy.';
        status = 'SUCCESS';
      }
      break;

    case 'city-17':
      if (choice === 'A') {
        if (success) {
          apply.applyMaxHp(10);
          outcome = '>> FLUID HARVESTED — +10% Max HP.';
        } else {
          apply.applyMaxStamina(-10);
          outcome = '>> TOXIC VAPOR — Chemical lung irritation. -10% Max Stamina.';
        }
      } else {
        progressPatch = { cryptoGlimmerGrantPct: 40 };
        outcome = '>> VEHICLE PURIFIED — Corporate grid wire. +40% Crypto-Glimmer.';
        status = 'SUCCESS';
      }
      break;

    case 'city-18':
      if (choice === 'A') {
        if (success) {
          flags.push('intel_override');
          outcome = '>> CONSOLE OVERRIDE — Intel Override active. FLAG: intel_override.';
        } else {
          apply.applyCurrentShield(-10);
          outcome = '>> CORRUPT UPLOAD — Scan radar blinded next node. -10% Current Shield.';
        }
      } else if (success) {
        apply.applyMaxStamina(20);
        outcome = '>> BREACH SUCCESS — Tactical munitions recovered. +20% Max Stamina.';
      } else {
        outcome = '>> BREACH FAILURE — Cruiser doors hold. No reward.';
        status = 'FAILURE';
      }
      break;

    case 'city-19':
      if (choice === 'A') {
        if (success) {
          apply.applyMaxHp(15);
          outcome = '>> HOSES SEVERED — Shadow mist cleared. +15% Max Shield.';
        } else {
          apply.applyCurrentHp(-10);
          outcome = '>> SHADOW SPRAY — -10% Current HP.';
        }
      } else {
        apply.applyCurrentEnergy(25);
        outcome = '>> PUMP INVERTED — Residual frequency captured. +25% Energy.';
        status = 'SUCCESS';
      }
      break;

    case 'city-20':
      if (choice === 'A') {
        apply.applyCurrentShield(-10);
        progressPatch = { narrativeModifiers: { nextCombatDamageBonusPct: 15 } };
        outcome = '>> ARTIFACT PURCHASED — Soul-Weft Inscription. -10% Current Shield / +15% boss damage.';
        status = 'SUCCESS';
      } else if (success) {
        progressPatch = { cryptoGlimmerGrantPct: 50 };
        outcome = '>> REGISTERS LOOTED — +50% Crypto-Glimmer.';
      } else {
        progressPatch = { pendingCombatAmbush: true };
        outcome = '>> CARETAKERS ALERTED — Grave-Bound specter ambush.';
      }
      break;

    default:
      return null;
  }

  return { progressPatch, flags, outcome, status };
}
