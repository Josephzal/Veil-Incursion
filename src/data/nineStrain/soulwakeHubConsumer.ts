/**
 * Live Hub consumer for Soulwake Stage D.2 effects.
 * Mutates operative AP / Barrier / HP / Current / cooldown once, then clears result flags
 * so save/resume cannot replay them.
 */

export interface SoulwakeHubLiveState {
  playerAp: number;
  playerHp: number;
  playerShield: number;
  abyssalReserve: number;
  veilFlux: number;
  ammo: number;
  maxAmmo: number;
  /** Remaining cooldown turns for the ability that just committed, if any. */
  committedAbilityCooldown: number | null;
  classId: 'AEGIS' | 'HEX_SHOT' | 'ENVOY';
}

export interface SoulwakeHubEffectFlags {
  lastApRefund: number;
  lastCooldownAdvanced: boolean;
  lastBarrierGranted: number;
  playerHp: number;
  openConduitGain: number;
  openConduitPreserved: number;
}

export interface SoulwakeHubApplyResult {
  live: SoulwakeHubLiveState;
  applied: {
    apRefund: number;
    cooldownAdvanced: boolean;
    barrier: number;
    hpSynced: boolean;
    currentGain: number;
    currentPreserved: number;
  };
  /** Flags that must be written back to soulwake runtime (zeroed). */
  clearedFlags: SoulwakeHubEffectFlags;
}

/**
 * Apply pending Soulwake presentation flags to live Hub resources exactly once.
 * Always returns clearedFlags with refunds/barrier/cooldown zeroed.
 */
export function applySoulwakeHubEffects(
  live: SoulwakeHubLiveState,
  flags: SoulwakeHubEffectFlags,
): SoulwakeHubApplyResult {
  let playerAp = live.playerAp;
  let playerHp = live.playerHp;
  let playerShield = live.playerShield;
  let abyssalReserve = live.abyssalReserve;
  let veilFlux = live.veilFlux;
  let ammo = live.ammo;
  let committedAbilityCooldown = live.committedAbilityCooldown;

  const apRefund = Math.max(0, Math.floor(flags.lastApRefund));
  if (apRefund > 0) playerAp += apRefund;

  let cooldownAdvanced = false;
  if (flags.lastCooldownAdvanced && committedAbilityCooldown != null && committedAbilityCooldown > 0) {
    committedAbilityCooldown = Math.max(0, committedAbilityCooldown - 1);
    cooldownAdvanced = true;
  }

  const barrier = Math.max(0, Math.floor(flags.lastBarrierGranted));
  if (barrier > 0) playerShield += barrier;

  let hpSynced = false;
  if (flags.playerHp > 0 && flags.playerHp < playerHp) {
    playerHp = flags.playerHp;
    hpSynced = true;
  }

  const gain = Math.max(0, Math.floor(flags.openConduitGain));
  const preserved = Math.max(0, Math.floor(flags.openConduitPreserved));
  if (live.classId === 'AEGIS') {
    if (gain > 0) abyssalReserve += gain;
    if (preserved > 0) abyssalReserve += preserved;
  } else if (live.classId === 'ENVOY') {
    if (gain > 0) veilFlux += gain;
    if (preserved > 0) veilFlux += preserved;
  } else if (live.classId === 'HEX_SHOT') {
    if (gain > 0) ammo = Math.min(live.maxAmmo, ammo + gain);
    if (preserved > 0) ammo = Math.min(live.maxAmmo, ammo + preserved);
  }

  return {
    live: {
      ...live,
      playerAp,
      playerHp,
      playerShield,
      abyssalReserve,
      veilFlux,
      ammo,
      committedAbilityCooldown,
    },
    applied: {
      apRefund,
      cooldownAdvanced,
      barrier,
      hpSynced,
      currentGain: gain,
      currentPreserved: preserved,
    },
    clearedFlags: {
      lastApRefund: 0,
      lastCooldownAdvanced: false,
      lastBarrierGranted: 0,
      playerHp: flags.playerHp,
      openConduitGain: 0,
      openConduitPreserved: 0,
    },
  };
}
