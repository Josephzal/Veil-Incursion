export type IncursionConsumableId = 'soul-core' | 'veil-shard' | 'target-fragment' | 'spectral-salt';

export type IncursionConsumableEffect = 'heal' | 'stun' | 'unimplemented';

export interface IncursionConsumable {
  id: IncursionConsumableId;
  name: string;
  description: string;
  quantity: number;
  effect: IncursionConsumableEffect;
  /** Percent of max Soul Anchor restored — heal items only. */
  healPercent?: number;
}

export interface IncursionInventoryState {
  items: IncursionConsumable[];
}

export type PlayerCombatDebuffId = 'BLEEDING' | 'FRACTURED';

export interface IncursionConsumableUseResult {
  itemId: IncursionConsumableId | import('./cargoGrid').CargoItemId;
  healAmount: number;
  stunsEnemy: boolean;
  shatterKineticArmor?: number;
  stripOccultWards?: number;
  clearDebuffs?: boolean;
  clearPlayerDebuffs?: PlayerCombatDebuffId[];
  /** Clear any supported player debuffs present in session extras. */
  clearSupportedPlayerDebuffs?: boolean;
  frontlineBlindTurns?: number;
  maxAbyssalReserve?: boolean;
  grantBonusAp?: number;
  restoreStaminaPct?: number;
  absorbNextHit?: boolean;
  /** Spall-Weave — deal this damage to attacker when vest breaks. */
  spallShrapnelDamage?: number;
  enableGodMode?: boolean;
  /** Crit Potion — force 100% player crit chance for the remainder of the run/combat. */
  enableFullCrit?: boolean;
  /** Force Soul Anchor integrity to this absolute value (combat + run state). */
  setSoulAnchorTo?: number;
  apCost?: number;
  /** Temporary HP shield points (CombatSessionExtras.playerShield). */
  grantTemporaryShield?: number;
  /** Apply EXPOSED to selected/primary target for N turns (tag only). */
  applyExposed?: boolean;
  /** Root up to N living enemies (evadeChance 0 + ROOTED tag). */
  applyRootedToUpTo?: number;
  /** Apply FRACTURED to selected target. */
  applyFracture?: boolean;
  /** Interrupt charging/channeling target; else minor fracture only. */
  interruptChargingTarget?: boolean;
  /** Lose this much stamina at start of next player turn. */
  staminaLossNextTurn?: number;
  /** Survive lethal hit at 1 HP once this combat. */
  bloodwireLethalPrevention?: boolean;
  /** Untargetable until next enemy action resolves; then dump stamina. */
  nullSpaceUntargetable?: boolean;
  /** Redirect next single-target attack to decoy. */
  voidglassDecoy?: boolean;
  /** Place delayed AoE marker on selected target. */
  delayedCylinder?: boolean;
  /** Echo last non-ultimate offensive ability at half power. */
  mirrorSaltEcho?: boolean;
  /** Stamina lost immediately on armor-break misfire. */
  misfireStaminaLoss?: number;
  /** Require ≥1 kinetic armor stripped before applying Exposed. */
  exposedRequiresArmorStripped?: number;
  logLine: string;
  secondaryLogLine?: string;
}
