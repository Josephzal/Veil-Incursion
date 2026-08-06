import type { WeaponFamilyId } from '../types/weapon';
import type { WeaponIdentityProfile } from '../types/weaponIdentity';
import { ALL_WEAPON_FAMILY_IDS, getWeaponFamily } from './weaponRegistry';

/**
 * Phase 3C unlock notes + Phase 3F mechanical/affinity tags.
 * Registry IDs and live display names are preserved; planned renames are recorded only.
 */
export const WEAPON_IDENTITY_PROFILES: Record<WeaponFamilyId, WeaponIdentityProfile> = {
  'aegis-runed-longsword': {
    id: 'aegis-runed-longsword',
    classId: 'AEGIS',
    liveDisplayName: 'Runed Longsword',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Build Fracture through steady melee, survive with parry, cash out with Reserve.',
    primaryRole: 'Starter / balanced fracture setup',
    unlock: {
      band: 'STARTER',
      pacingNote: 'Available on Run 1 for Aegis.',
      resourceCosts: [],
    },
    mechanicalTags: ['MELEE', 'KINETIC', 'FRACTURE', 'RESERVE_GEN'],
    affinityTags: ['MELEE', 'FRACTURE', 'RESERVE', 'PARRY'],
    meterSummary: 'Steady Abyssal Reserve on hits; natural Parry integration.',
    uniqueBasicSummary: '1 AP kinetic strike — moderate damage, reliable Fracture, small Reserve.',
    drawbackSummary: 'Weak backline access; not best burst or hard control.',
  },
  'aegis-rift-edge': {
    id: 'aegis-rift-edge',
    classId: 'AEGIS',
    liveDisplayName: 'Paired Blades',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Bank tempo from evade/parry, then pay off with an Occult rider finish.',
    primaryRole: 'Tempo / evade / execution',
    unlock: {
      band: 'MID',
      pacingNote: 'Unlock around sector 2 / early class progression.',
      resourceCosts: [
        { resourceId: 'ossified-ley-knot', quantity: 2 },
        { resourceId: 'resonant-filament', quantity: 2 },
        { resourceId: 'echo-glass-shard', quantity: 6 },
      ],
    },
    mechanicalTags: ['MELEE', 'KINETIC', 'EXECUTION', 'EVADE'],
    affinityTags: ['MELEE', 'EVADE', 'EXECUTION', 'OCCULT', 'RESERVE'],
    meterSummary: 'Reserve favored from tempo payoffs; weak chip Reserve vs Longsword.',
    uniqueBasicSummary: 'Fast kinetic basic; Occult rider only when riftEdgeTempoArmed.',
    drawbackSummary: 'Poor armor cracking without setup; weak vs swarms.',
    debugNotes: 'Tempo is weapon-scoped state, not a global status.',
  },
  'aegis-claymore-blade': {
    id: 'aegis-claymore-blade',
    classId: 'AEGIS',
    liveDisplayName: 'Unmaker',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Spend stamina on heavy Fracture pressure and cash out on breaks.',
    primaryRole: 'Heavy Fracture-break cashout',
    unlock: {
      band: 'LATE',
      pacingNote: 'Unlock around midgame / Breach Grade II–III pacing.',
      resourceCosts: [
        { resourceId: 'legion-blood-iron', quantity: 3 },
        { resourceId: 'rail-capacitor', quantity: 2 },
        { resourceId: 'combustion-cylinder', quantity: 2 },
      ],
    },
    mechanicalTags: ['MELEE', 'KINETIC', 'HEAVY', 'FRACTURE', 'STAMINA_HEAVY'],
    affinityTags: ['MELEE', 'FRACTURE', 'CONTROL', 'RESERVE'],
    meterSummary: 'Major Reserve on Fracture break; weak Reserve on chip hits.',
    uniqueBasicSummary: 'Heavy 1 AP strike — high Fracture, high stamina, modest base damage.',
    drawbackSummary: 'Stamina hungry; punished by drain and fast multi-attacker pressure.',
  },
  'hex-silver-core-sidearm': {
    id: 'hex-silver-core-sidearm',
    classId: 'HEX_SHOT',
    liveDisplayName: 'Silver-Core Sidearm',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Efficient shots, frequent reloads, precise finishes, steady Protocol Charge.',
    primaryRole: 'Starter / precision reload-tempo',
    unlock: {
      band: 'STARTER',
      pacingNote: 'Available on Run 1 for Hex Shot.',
      resourceCosts: [],
    },
    mechanicalTags: ['BALLISTIC', 'RANGED', 'KINETIC', 'RELOAD'],
    affinityTags: ['BALLISTIC', 'RELOAD', 'EXECUTION'],
    meterSummary: 'Standard magazine; Perfect Reload → Protocol Charge → weapon ultimate.',
    uniqueBasicSummary: '1 AP / 1 ammo precise shot; inherits loaded ammo payload.',
    drawbackSummary: 'Does not specialize hard — needs boons/grafts to explode.',
    debugNotes: 'Legacy presentation alias: Revolver. Persistent ID unchanged.',
  },
  'hex-pulse-rifle': {
    id: 'hex-pulse-rifle',
    classId: 'HEX_SHOT',
    liveDisplayName: 'Ash Shotgun',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Dump ammo into frontline clusters; treat reload as a burst window.',
    primaryRole: 'Close-range AoE / crowd clear',
    unlock: {
      band: 'LATE',
      pacingNote: 'Unlock around sector 3 pacing; resource gate already on registry.',
      resourceCosts: [
        { resourceId: 'encrypted-grid-drive', quantity: 3 },
        { resourceId: 'rail-capacitor', quantity: 2 },
        { resourceId: 'containment-seal', quantity: 1 },
        { resourceId: 'nullcrete-shard', quantity: 4 },
      ],
    },
    mechanicalTags: ['BALLISTIC', 'RANGED', 'KINETIC', 'AOE', 'RELOAD'],
    affinityTags: ['BALLISTIC', 'AOE', 'RELOAD', 'FRACTURE'],
    meterSummary: 'Tighter mag; frequent reload; empty-mag is part of the loop.',
    uniqueBasicSummary: 'Repeatable short-range spread (primary + adjacent) — not Ash-Jacket Salvo.',
    drawbackSummary: 'Poor backline; weak vs isolated priority targets; ammo inefficient.',
    debugNotes: 'Legacy presentation alias: Carbine / Pulse Rifle. Zero Protocol binds to this family only.',
  },
  'hex-void-cannon': {
    id: 'hex-void-cannon',
    classId: 'HEX_SHOT',
    liveDisplayName: 'Nullbreach',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Spend scarce ammo to crack Kinetic Armor and delete priority tanks.',
    primaryRole: 'Armor-breach single-target burst',
    unlock: {
      band: 'MID',
      pacingNote: 'Unlock around sector 2 pacing.',
      resourceCosts: [
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
        { resourceId: 'combustion-cylinder', quantity: 2 },
        { resourceId: 'rail-capacitor', quantity: 1 },
        { resourceId: 'breach-thread', quantity: 1 },
      ],
    },
    mechanicalTags: ['BALLISTIC', 'RANGED', 'KINETIC', 'ARMOR_PIERCE', 'HEAVY'],
    affinityTags: ['BALLISTIC', 'ARMOR_PIERCE', 'HIGH_RISK'],
    meterSummary: 'Small magazine; reloads are commitment; misses are expensive.',
    uniqueBasicSummary: 'High-impact single-target shot; pierce from weapon mods + ammo payload.',
    drawbackSummary: 'Weak crowd handling; ammo hungry.',
    debugNotes: 'Legacy presentation alias: Black Door / Void Cannon. Not an overwatch weapon.',
  },
  'envoy-null-conduit': {
    id: 'envoy-null-conduit',
    classId: 'ENVOY',
    liveDisplayName: 'Scythe',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Cycle Flux cleanly and sequence Catalyst dumps without brink gambling.',
    primaryRole: 'Clean Flux / Catalyst specialist',
    unlock: {
      band: 'MID',
      pacingNote: 'Unlock around mid sector pacing; former Vambrace resource gate.',
      resourceCosts: [
        { resourceId: 'echo-glass-shard', quantity: 8 },
        { resourceId: 'resonant-filament', quantity: 3 },
        { resourceId: 'encrypted-grid-drive', quantity: 1 },
        { resourceId: 'sanguine-ampoule', quantity: 1 },
      ],
    },
    mechanicalTags: ['SPELL', 'OCCULT', 'RANGED', 'FLUX_GEN'],
    affinityTags: ['OCCULT', 'FLUX', 'CLEAN_CYCLE'],
    meterSummary: 'Standard Flux spend/restore; rewards controlled cycling.',
    uniqueBasicSummary: 'Efficient Veil Splinter — moderate Flux cost, light Rot, stable occult chip.',
    drawbackSummary: 'Lower peak than Prism; needs discipline vs jam/silence.',
    debugNotes: 'Former Envoy starter (Null Conduit). Display name Scythe; Clean Cycle soft affinity only.',
  },
  'envoy-echo-lantern': {
    id: 'envoy-echo-lantern',
    classId: 'ENVOY',
    liveDisplayName: 'Vambrace',
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Stack Rot, delay detonation, then dump Flux for a board payoff.',
    primaryRole: 'Starter / Rot / curse / detonation',
    unlock: {
      band: 'STARTER',
      pacingNote: 'Available on Run 1 for Envoy.',
      resourceCosts: [],
    },
    mechanicalTags: ['SPELL', 'OCCULT', 'CURSE', 'DEBUFF', 'FLUX_DUMP'],
    affinityTags: ['OCCULT', 'CURSE', 'CONTROL', 'FLUX'],
    meterSummary: 'Dumps scale with Rot density; weaker raw chip.',
    uniqueBasicSummary: 'Low damage Splinter variant that applies extra Rot; rewards setup.',
    drawbackSummary: 'Poor when enemies die too fast for setup.',
    debugNotes: 'New Envoy starter (was Echo Lantern). Permanent ID envoy-echo-lantern unchanged.',
  },
  'envoy-sanguine-prism': {
    id: 'envoy-sanguine-prism',
    classId: 'ENVOY',
    liveDisplayName: "Heart's Due",
    plannedDisplayName: null,
    oneSentencePlaystyle: 'Spend capped HP and skim Brink Flux for spike casts, then vent.',
    primaryRole: 'Sacrifice / Brink',
    unlock: {
      band: 'LATE',
      pacingNote: 'Unlock around later sector pacing.',
      resourceCosts: [
        { resourceId: 'sanguine-ampoule', quantity: 3 },
        { resourceId: 'mycelial-ichor', quantity: 1 },
        { resourceId: 'ossified-ley-knot', quantity: 2 },
      ],
    },
    mechanicalTags: ['SPELL', 'OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX_DUMP'],
    affinityTags: ['OCCULT', 'SACRIFICE', 'HIGH_RISK', 'FLUX'],
    meterSummary: 'Bonus near low Flux / Void-Siphoned brink; no overfill overload.',
    uniqueBasicSummary: 'Higher damage Splinter with capped HP sacrifice + brink amp.',
    drawbackSummary: 'Self-harm risk; bad in attrition without vents.',
  },
};

export function getWeaponIdentityProfile(id: WeaponFamilyId): WeaponIdentityProfile {
  return WEAPON_IDENTITY_PROFILES[id];
}

export function listWeaponIdentityProfiles(): WeaponIdentityProfile[] {
  return ALL_WEAPON_FAMILY_IDS.map((id) => WEAPON_IDENTITY_PROFILES[id]);
}

/** Debug inspect: affinity + mechanical tags + planned rename. */
export function formatWeaponIdentityDebug(id: WeaponFamilyId): string {
  const p = getWeaponIdentityProfile(id);
  const live = getWeaponFamily(id);
  return [
    `weapon=${id}`,
    `liveName=${live.name}`,
    `plannedName=${p.plannedDisplayName ?? '—'}`,
    `role=${p.primaryRole}`,
    `unlock=${p.unlock.band}`,
    `mechanical=[${p.mechanicalTags.join(',')}]`,
    `affinity=[${p.affinityTags.join(',')}]`,
    `meter=${p.meterSummary}`,
    `basic=${p.uniqueBasicSummary}`,
    `drawback=${p.drawbackSummary}`,
  ].join(' // ');
}

export function validateWeaponIdentityProfiles(): string[] {
  const issues: string[] = [];
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const p = WEAPON_IDENTITY_PROFILES[id];
    if (!p) {
      issues.push(`Missing identity profile for ${id}`);
      return;
    }
    if (p.id !== id) issues.push(`${id} profile id mismatch`);
    if (p.mechanicalTags.length < 2) issues.push(`${id} needs ≥2 mechanical tags`);
    if (p.affinityTags.length < 1) issues.push(`${id} needs affinity tags`);
    if (!p.oneSentencePlaystyle.trim()) issues.push(`${id} missing playstyle`);
  });
  return issues;
}
