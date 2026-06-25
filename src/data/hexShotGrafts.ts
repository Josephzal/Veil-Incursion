import type { ClassGraftDefinition, HexShotGraftId } from '../types/classGraft';

function hex(
  id: HexShotGraftId,
  name: string,
  cost: number,
  description: string,
  accentColor: string,
  extras: Partial<Omit<ClassGraftDefinition, 'id' | 'classId' | 'name' | 'cost' | 'description' | 'accentColor'>>,
): ClassGraftDefinition {
  return { id, classId: 'HEX_SHOT', name, cost, description, accentColor, ...extras };
}

export const HEX_SHOT_GRAFT_DATABASE: Record<HexShotGraftId, ClassGraftDefinition> = {
  WIDOW_CHOKE_GRAFT: hex(
    'WIDOW_CHOKE_GRAFT',
    'Widow-Choke Graft',
    20,
    'Converts AoE to single-target. Damage ×2.5.',
    '#f87171',
    { modifyTagFrom: 'AOE', modifyTagTo: 'SINGLE_TARGET', damageMultiplier: 2.5 },
  ),
  HELL_FIRE_COMPENSATOR: hex(
    'HELL_FIRE_COMPENSATOR',
    'Hell-Fire Compensator',
    15,
    'Applies 2-stack Bleed. Costs 10% Max HP to fire.',
    '#fb923c',
    { applyDebuffToTarget: 'BLEED_2', addHpCost: 0.10 },
  ),
  SILENT_VOID_SUPPRESSOR: hex(
    'SILENT_VOID_SUPPRESSOR',
    'Silent-Void Suppressor',
    25,
    'Grants UNTARGETABLE after cast. Base damage −30%.',
    '#818cf8',
    { addBuff: 'UNTARGETABLE', reduceDamage: 0.3 },
  ),
  SPLITTER_BARREL_GRAFT: hex(
    'SPLITTER_BARREL_GRAFT',
    'Splitter-Barrel Graft',
    20,
    'Duplicates cast at 50% power. Ammo cost ×2.',
    '#a78bfa',
    { duplicateCast: 0.5, ammoCostMultiplier: 2 },
  ),
  BLOOD_MAG_GRAFT: hex(
    'BLOOD_MAG_GRAFT',
    'Blood-Mag Graft',
    20,
    'Ammo cost → 0. Drains 15% Max HP on cast.',
    '#dc2626',
    { setAmmoCost: 0, addHpCost: 0.15 },
  ),
  ECHO_RECEIVER_GRAFT: hex(
    'ECHO_RECEIVER_GRAFT',
    'Echo-Receiver Graft',
    25,
    'Kills refund 1 Ammo. Non-lethal casts EXPOSE the operative.',
    '#c084fc',
    { refundAmmoOnKill: true, selfDebuffOnFail: 'EXPOSED' },
  ),
  BOTTOMLESS_DRUM_GRAFT: hex(
    'BOTTOMLESS_DRUM_GRAFT',
    'Bottomless-Drum Graft',
    30,
    '+1 AP cost. Damage ×1.5.',
    '#fbbf24',
    { addApCost: 1, damageMultiplier: 1.5 },
  ),
  SCAVENGER_BOLT_GRAFT: hex(
    'SCAVENGER_BOLT_GRAFT',
    'Scavenger-Bolt Graft',
    15,
    'Kills drop credits. +1 Ammo cost.',
    '#4ade80',
    { dropLootOnKill: 'CREDITS', addAmmoCost: 1 },
  ),
  OMNI_LENS_GRAFT: hex(
    'OMNI_LENS_GRAFT',
    'Omni-Lens Graft',
    20,
    'Converts damage to True. Survivors CONCUSS the operative.',
    '#67e8f9',
    { convertToTrueDamage: true, applySelfDebuffOnSurvive: 'CONCUSSED' },
  ),
  ASTRAL_SIGHT_GRAFT: hex(
    'ASTRAL_SIGHT_GRAFT',
    'Astral-Sight Graft',
    15,
    '100% crit chance. Executes below 15% HP. Base damage −50%.',
    '#38bdf8',
    { setCritChance: 100, executeThreshold: 0.15, baseDamageMultiplier: 0.5 },
  ),
  GHOST_BEAM_GRAFT: hex(
    'GHOST_BEAM_GRAFT',
    'Ghost-Beam Graft',
    25,
    'Adds ARMOR_PIERCE tag. +1 AP cost.',
    '#22d3ee',
    { addTag: 'ARMOR_PIERCE', addApCost: 1 },
  ),
  PRECOGNITIVE_SCOPE_GRAFT: hex(
    'PRECOGNITIVE_SCOPE_GRAFT',
    'Precognitive-Scope Graft',
    20,
    '+20% Evade until next turn. Removes FRACTURE tag.',
    '#2dd4bf',
    { addBuff: 'EVADE_20', removeTags: ['FRACTURE'] },
  ),
  RICOCHET_DEFLECTOR_GRAFT: hex(
    'RICOCHET_DEFLECTOR_GRAFT',
    'Ricochet-Deflector Graft',
    25,
    '2 hits at random targets. Damage ×0.7.',
    '#f472b6',
    { hitCount: 2, randomTarget: true, damageMultiplier: 0.7 },
  ),
  NEUTRON_SEAR_GRAFT: hex(
    'NEUTRON_SEAR_GRAFT',
    'Neutron-Sear Graft',
    30,
    'Consumes all ammo. Damage scales with missing rounds.',
    '#e879f9',
    { consumeAllAmmo: true, damageScale: 'MISSING_AMMO' },
  ),
  PARASITE_GRIP_GRAFT: hex(
    'PARASITE_GRIP_GRAFT',
    'Parasite-Grip Graft',
    20,
    'Heal 30% of damage dealt. −5% Max HP for the run.',
    '#f43f5e',
    { healPercentageOfDamage: 0.3, reduceMaxHp: 0.05 },
  ),
  APEX_TRIGGER_GRAFT: hex(
    'APEX_TRIGGER_GRAFT',
    'Apex-Trigger Graft',
    45,
    'Crits refund 1 AP. Disables Ultimate this encounter.',
    '#fde047',
    { refundApOnCrit: true, disableUltimate: true },
  ),
  DEAD_MAN_SWITCH_GRAFT: hex(
    'DEAD_MAN_SWITCH_GRAFT',
    "Dead-Man's Switch Graft",
    25,
    'Manual reload ejects all rounds as kinetic AoE (10 dmg each). Never grants overcharge.',
    '#ef4444',
    { deadMansSwitchOnReload: true },
  ),
};

export const ALL_HEX_SHOT_GRAFT_IDS = Object.keys(HEX_SHOT_GRAFT_DATABASE) as HexShotGraftId[];

export function getHexShotGraftDefinition(id: HexShotGraftId): ClassGraftDefinition {
  return HEX_SHOT_GRAFT_DATABASE[id];
}

export function pickRandomHexShotGraftOffers(count = 3): HexShotGraftId[] {
  const pool = [...ALL_HEX_SHOT_GRAFT_IDS];
  const offers: HexShotGraftId[] = [];
  while (offers.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    offers.push(pool.splice(index, 1)[0]);
  }
  return offers;
}
