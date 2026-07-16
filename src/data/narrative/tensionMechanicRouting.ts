/**
 * Narrative tension mechanic routing helpers.
 *
 * Naming (do not confuse these):
 * - Dead-Man's Switch = Hex Shot *combat graft* on Phase-Shift Reload — not a narrative minigame.
 * - Mechanic_ScavengeBar = old narrative loot/scavenge tension (InstabilityProtocol UI).
 * - Mechanic_CipherRite = narrative hacking / occult decryption (Cipher Rite UI).
 * - Mechanic_ConcealSlider = player-facing Scanner Sweep (1D blind-zone tracking + sweep pulses).
 * - Mechanic_SigilTrace = player-facing Ritual Echo (occult pattern + forbidden beats).
 * - Mechanic_SignalAlignment = player-facing Veil Lock (limited rotatable glyph-key lock routing).
 *
 * Priority for generation:
 * 1. Stealth → Scanner Sweep
 * 2. Tech / encrypted terminal → Cipher Rite
 * 3. Rift / ley / stabilize / extraction vector → Signal Alignment
 * 4. Ritual / sigil sequence → Ritual Echo
 * 5. Plain stash → none
 */

import type { Tag, TensionMechanic } from '../../types/narrativeAssembly';

export const KNOWN_TENSION_MECHANICS: readonly TensionMechanic[] = [
  'Mechanic_ScavengeBar',
  'Mechanic_ConcealSlider',
  'Mechanic_SigilTrace',
  'Mechanic_CipherRite',
  'Mechanic_SignalAlignment',
] as const;

/** Mechanics allowed in new procedural generation (excludes deprecated ScavengeBar). */
export const ACTIVE_GENERATION_TENSION_MECHANICS: readonly TensionMechanic[] = [
  'Mechanic_ConcealSlider',
  'Mechanic_SigilTrace',
  'Mechanic_CipherRite',
  'Mechanic_SignalAlignment',
] as const;

export function isKnownTensionMechanic(
  value: string | null | undefined,
): value is TensionMechanic {
  return (
    value === 'Mechanic_ScavengeBar'
    || value === 'Mechanic_ConcealSlider'
    || value === 'Mechanic_SigilTrace'
    || value === 'Mechanic_CipherRite'
    || value === 'Mechanic_SignalAlignment'
  );
}

const STEALTH_RE = /stealth|conceal|surveillance|patrol|watched|sneak|blind.?spot|creep|mask your|slip through|patrol route|sentry|vanguard|toll|security.?sweep|echo.?gaze|rival.?search|watched.?cache/i;
/** Ritual Echo — sequence/memory occult; excludes stabilize/ley-align fiction. */
const OCCULT_RE = /occult|ritual|sigil|anomaly|ethereal|ward|spectral|memory|untangle|glyph|veil.?pulse|blood-?rite|echo.?pattern/i;
const TECH_CIPHER_RE = /terminal|encrypted|console|vault|grid.?secur|black.?site|locked.?cache|munitions.?lock|dead-?man|hack|firmware|uplink|IFF|targeting|decrypt|cipher|firewall|biometric|schematic|security.?console|data.?archive|scanner.?lock|sealed.?tech|intel.?vault/i;
const SIGNAL_ALIGN_RE = /stabilize|stabilis|rift|ley.?line|leyline|extraction.?vector|scanner.?repair|signal.?calibr|veil.?frequen|breach.?vector|fracture.?seal|telemetry|attune|anchor.?attun|bind the tear|folding|phase.?shift|humming|calibrat|tune the|align the|vector/i;
/** Plain loot / stash / dead-runner pickup — usually no tension minigame. */
const PLAIN_STASH_RE = /stash|scavenge|loot|salvage|dead.?runner|fallen.?runner|resource.?cache|pickup|grab the|strip the|pocket the|claim the|empty the crate|open the crate|open the cache/i;

export interface TensionRemapContext {
  /** Free text from option / complication / scenario. */
  flavorText?: string;
  tags?: readonly Tag[];
  /** Resolver set id (e.g. RES_13) for catalog-specific TODOs. */
  resolverSetId?: string;
}

function isPlainStashContext(text: string, tags: readonly Tag[]): boolean {
  if (
    STEALTH_RE.test(text)
    || OCCULT_RE.test(text)
    || TECH_CIPHER_RE.test(text)
    || SIGNAL_ALIGN_RE.test(text)
  ) {
    return false;
  }
  if (
    tags.includes('occult')
    || tags.includes('void')
    || tags.includes('cosmic')
    || tags.includes('militarized')
    || tags.includes('tech')
  ) {
    return false;
  }
  return PLAIN_STASH_RE.test(text);
}

function isCipherRiteContext(text: string, tags: readonly Tag[]): boolean {
  if (TECH_CIPHER_RE.test(text)) return true;
  if (tags.includes('tech') && !STEALTH_RE.test(text) && !SIGNAL_ALIGN_RE.test(text) && !OCCULT_RE.test(text)) {
    return true;
  }
  return false;
}

function isSignalAlignmentContext(text: string, tags: readonly Tag[]): boolean {
  if (SIGNAL_ALIGN_RE.test(text)) return true;
  // Void/cosmic without stealth/tech/ritual sequence → often rift calibration.
  if ((tags.includes('void') || tags.includes('cosmic')) && !STEALTH_RE.test(text) && !TECH_CIPHER_RE.test(text)) {
    return true;
  }
  return false;
}

function isRitualEchoContext(text: string, tags: readonly Tag[]): boolean {
  if (OCCULT_RE.test(text)) return true;
  if (tags.includes('occult') && !SIGNAL_ALIGN_RE.test(text)) return true;
  return false;
}

/**
 * Remap deprecated Mechanic_ScavengeBar for normal generation / catalog normalization.
 * Returns null when the situation should have no tension minigame (plain stash / loot).
 */
export function remapDeprecatedScavengeBar(
  mechanic: TensionMechanic | undefined,
  ctx: TensionRemapContext = {},
): TensionMechanic | null {
  if (mechanic == null) return null;
  if (mechanic !== 'Mechanic_ScavengeBar') return mechanic;

  const text = ctx.flavorText ?? '';
  const tags = ctx.tags ?? [];

  if (tags.includes('militarized') || STEALTH_RE.test(text)) {
    return 'Mechanic_ConcealSlider';
  }
  if (isCipherRiteContext(text, tags)) {
    return 'Mechanic_CipherRite';
  }
  if (isSignalAlignmentContext(text, tags)) {
    return 'Mechanic_SignalAlignment';
  }
  if (isRitualEchoContext(text, tags)) {
    return 'Mechanic_SigilTrace';
  }
  if (isPlainStashContext(text, tags)) {
    return null;
  }

  // Deprecated ScavengeBar remap with no clear fiction → careful passage only if needed.
  // Prefer no forced busywork for unmatched plain content.
  return null;
}

/**
 * Pick a generation mechanic from tags/text without ever selecting ScavengeBar.
 * Returns null for plain stash / loot situations (no tension minigame).
 */
export function pickActiveGenerationTensionMechanic(
  _seedHash: number,
  ctx: TensionRemapContext = {},
): TensionMechanic | null {
  const text = ctx.flavorText ?? '';
  const tags = ctx.tags ?? [];

  if (tags.includes('militarized') || STEALTH_RE.test(text)) {
    return 'Mechanic_ConcealSlider';
  }
  if (isCipherRiteContext(text, tags)) {
    return 'Mechanic_CipherRite';
  }
  if (isSignalAlignmentContext(text, tags)) {
    return 'Mechanic_SignalAlignment';
  }
  if (isRitualEchoContext(text, tags)) {
    return 'Mechanic_SigilTrace';
  }
  if (isPlainStashContext(text, tags)) {
    return null;
  }

  // No matching fiction — do not force a random minigame (Phase 5).
  return null;
}
