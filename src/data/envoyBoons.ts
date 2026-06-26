import type { ClassBoonDefinition, EnvoyBoonId } from '../types/classBoon';

const TIER_LABEL: Record<string, string> = {
  TIER_1: 'TIER 1 // AETHERIC',
  TIER_2: 'TIER 2 // ENTROPY',
  TIER_3: 'TIER 3 // ECONOMY',
  TIER_4: 'TIER 4 // SYNAPTIC',
};

function env(
  id: EnvoyBoonId,
  tier: ClassBoonDefinition['tier'],
  name: string,
  description: string,
  effect: string,
  hook: ClassBoonDefinition['hook'],
  tags?: { tagAll?: readonly string[]; tagAny?: readonly string[] },
): ClassBoonDefinition {
  return {
    id,
    classId: 'ENVOY',
    name,
    tier,
    tierLabel: TIER_LABEL[tier] ?? tier,
    description,
    effect,
    hook,
    tagAll: tags?.tagAll,
    tagAny: tags?.tagAny,
  };
}

export const ENVOY_BOON_CATALOG: Record<EnvoyBoonId, ClassBoonDefinition> = {
  VOID_TOUCHED: env('VOID_TOUCHED', 'TIER_1', 'Void-Touched', 'Spells deal +15% base damage while Veil-Flux is above 50%.', 'SPELL + Flux >50% // +15% damage', 'onDamageDeal', { tagAll: ['SPELL'] }),
  SHATTER_CAST: env('SHATTER_CAST', 'TIER_1', 'Shatter-Cast', 'Spells automatically destroy 1 layer of enemy shielding.', 'SPELL // shred 1 shield layer', 'onDamageDeal', { tagAll: ['SPELL'] }),
  ECHOING_AETHER: env('ECHOING_AETHER', 'TIER_1', 'Echoing Aether', '15% chance to duplicate a spell on the same target (0 AP / 0 Flux).', 'SPELL // 15% duplicate cast', 'onAbilityResolve', { tagAll: ['SPELL'] }),
  LEYLINE_SURGE: env('LEYLINE_SURGE', 'TIER_1', 'Ley-Line Surge', 'Entering Void-Siphoned instantly resets all ability cooldowns.', 'Void-Siphoned entry // reset cooldowns', 'passive'),
  ASTRAL_PIERCER: env('ASTRAL_PIERCER', 'TIER_1', 'Astral Piercer', 'Ranged spells deal +30% damage to back-row targets.', 'RANGED backline // +30% damage', 'onDamageDeal', { tagAll: ['RANGED'] }),
  VOLATILE_MAGIC: env('VOLATILE_MAGIC', 'TIER_1', 'Volatile Magic', 'AoE spells gain +25% critical hit multiplier.', 'AOE // +25% crit multiplier', 'onCriticalHit', { tagAll: ['AOE'] }),
  FLUX_CAPACITOR: env('FLUX_CAPACITOR', 'TIER_1', 'Flux-Capacitor', 'Increases max Veil-Flux capacity to 120%.', 'Passive // 120% flux cap', 'passive'),
  KINETIC_CONVERSION: env('KINETIC_CONVERSION', 'TIER_1', 'Kinetic Conversion', 'Spells convert 20% Occult damage to Kinetic for Fracture.', 'SPELL // 20% occult → kinetic', 'onDamageDeal', { tagAll: ['SPELL'] }),
  EXECUTIONERS_SPELL: env('EXECUTIONERS_SPELL', 'TIER_1', "Executioner's Spell", 'Spells instantly execute non-boss targets below 20% HP.', 'Target <20% HP // execute', 'onDamageDeal', { tagAll: ['SPELL'] }),
  RESIDUAL_ENERGY: env('RESIDUAL_ENERGY', 'TIER_1', 'Residual Energy', 'Regenerating Flux grants a temporary 1-hit Occult Shield (stacks to 2).', 'RESTORE // occult shield stack', 'onAbilityResolve', { tagAll: ['RESTORE'] }),
  CONTAGIOUS_HEX: env('CONTAGIOUS_HEX', 'TIER_2', 'Contagious Hex', 'If a rot-infected target dies, their Veil Rot stacks jump to a random adjacent enemy.', 'CURSE kill // rot spreads', 'onKill', { tagAll: ['CURSE'] }),
  WITHERED_VIGOR: env('WITHERED_VIGOR', 'TIER_2', 'Withered Vigor', 'Targets with Veil Rot permanently lose 10% base damage.', 'Veil Rot // −10% target base damage', 'onAbilityResolve', { tagAll: ['CURSE'] }),
  PARASITIC_LINK: env('PARASITIC_LINK', 'TIER_2', 'Parasitic Link', 'Heal 2 HP at turn start for each rot-infected enemy.', 'Rot-infected // +2 HP/turn each', 'onTurnStart'),
  HEAVY_GRAVITY: env('HEAVY_GRAVITY', 'TIER_2', 'Heavy Gravity', 'Rooted or Concussed enemies lose 1 AP next turn.', 'CONTROL // −1 AP rooted/concussed', 'onAbilityResolve', { tagAll: ['CONTROL'] }),
  DOOMED_FLESH: env('DOOMED_FLESH', 'TIER_2', 'Doomed Flesh', 'Debuffs you apply last 1 additional turn.', 'DEBUFF // +1 turn duration', 'onAbilityResolve', { tagAll: ['DEBUFF'] }),
  MIND_PLAGUE: env('MIND_PLAGUE', 'TIER_2', 'Mind-Plague', 'Concussed enemies take double Occult damage.', 'CONCUSSED // 2× occult damage', 'onDamageDeal'),
  CURSE_EATER: env('CURSE_EATER', 'TIER_2', 'Curse-Eater', 'Killing a rot-infected target restores 20% of missing HP.', 'Veil Rot kill // heal 20% missing HP', 'onKill', { tagAll: ['CURSE'] }),
  FLESH_ROT: env('FLESH_ROT', 'TIER_2', 'Flesh-Rot', 'Rot-infected targets lose 1 Kinetic Armor per active stack.', 'Veil Rot // −1 KA per stack', 'passive'),
  VOID_MARKED: env('VOID_MARKED', 'TIER_2', 'Void-Marked', 'Applying a curse removes all defensive buffs from the target.', 'CURSE // strip defensive buffs', 'onAbilityResolve', { tagAll: ['CURSE'] }),
  AGONIZING_HEX: env('AGONIZING_HEX', 'TIER_2', 'Agonizing Hex', 'Rot-infected targets take 5 True Damage when spending AP.', 'Veil Rot // 5 true on AP spend', 'passive'),
  PERFECTED_WARD: env('PERFECTED_WARD', 'TIER_3', 'Perfected Ward', 'Perfect Rift-Ward restores 50% Flux (instead of 30%) and refunds 1 AP.', 'Perfect ward // +50% flux, +1 AP', 'onDefensiveSuccess', { tagAll: ['DEFENSIVE'] }),
  MASOCHISTIC_CHANNEL: env('MASOCHISTIC_CHANNEL', 'TIER_3', 'Masochistic Channel', 'While Void-Siphoned you are no longer Silenced, but take 20 True self-damage per turn.', 'Void-Siphoned // unsilenced, 20 self dmg', 'passive'),
  SAFETY_VALVE: env('SAFETY_VALVE', 'TIER_3', 'Safety Valve', 'Casting while Flux is below 20% heals 1% Max HP per 5% Flux consumed.', 'Low flux cast // heal per flux spent', 'onAbilityResolve'),
  ADRENALINE_CHANNEL: env('ADRENALINE_CHANNEL', 'TIER_3', 'Adrenaline Channel', 'Taking damage past shields instantly restores +20% Flux.', 'Damage taken // +20% flux', 'onTakeDamage'),
  PHASE_SHIFT: env('PHASE_SHIFT', 'TIER_3', 'Phase-Shift', 'Evading an attack restores 1 AP.', 'Evade success // +1 AP', 'onEvadeSuccess', { tagAll: ['MOBILITY'] }),
  EMERGENCY_VENT: env('EMERGENCY_VENT', 'TIER_3', 'Emergency Vent', 'First time Flux hits 0% per encounter, vent 20 Occult AoE damage.', '0% flux // 20 occult AoE once', 'passive'),
  DEEP_RESERVES: env('DEEP_RESERVES', 'TIER_3', 'Deep Reserves', 'Start combat with a 1-hit Kinetic Shield.', 'Encounter start // 1-hit kinetic shield', 'onEncounterStart'),
  GLASS_CANNON: env('GLASS_CANNON', 'TIER_3', 'Glass Cannon', 'All damage +40%, Max HP −25%.', 'Passive // +40% dmg, −25% max HP', 'passive'),
  BLOOD_MAGIC: env('BLOOD_MAGIC', 'TIER_3', 'Blood Magic', 'At 0 AP, 1 AP abilities cost 15% Max HP instead.', '0 AP // cast via HP', 'passive'),
  AETHERIC_BULWARK: env('AETHERIC_BULWARK', 'TIER_3', 'Aetheric Bulwark', 'Gain +1 Kinetic Armor while Flux is above 80%.', 'Flux >80% // +1 kinetic armor', 'passive'),
  PENDULUM_SHIFT: env('PENDULUM_SHIFT', 'TIER_4', 'Pendulum Shift', 'Casting RESTORE immediately after a SPELL grants +50% damage to your next attack.', 'RESTORE after SPELL // +50% next hit', 'onDamageDeal'),
  CURSED_AETHER: env('CURSED_AETHER', 'TIER_4', 'Cursed Aether', 'SPELLs on rot-infected targets consume 50% less Flux.', 'SPELL on rot // −50% flux cost', 'onAbilityResolve', { tagAll: ['SPELL'] }),
  WARD_WEAVER: env('WARD_WEAVER', 'TIER_4', 'Ward-Weaver', 'After DEFENSIVE, your next CURSE costs 0 AP.', 'DEFENSIVE // next CURSE 0 AP', 'onAbilityResolve', { tagAll: ['DEFENSIVE'] }),
  CATACLYSMIC_ECHO: env('CATACLYSMIC_ECHO', 'TIER_4', 'Cataclysmic Echo', 'Ultimate kills permanently increase base Ultimate damage by +2.', 'ULTIMATE kill // +2 base ultimate dmg', 'onKill', { tagAll: ['ULTIMATE'] }),
  SINGULARITY_COLLAPSE: env('SINGULARITY_COLLAPSE', 'TIER_4', 'Singularity Collapse', 'AoE RESTORE spells strip 100% Kinetic Armor from all targets hit.', 'AOE + RESTORE // strip all kinetic armor', 'onAbilityResolve', { tagAll: ['AOE', 'RESTORE'] }),
  VAMPIRIC_STEP: env('VAMPIRIC_STEP', 'TIER_4', 'Vampiric Step', 'After MOBILITY, your next attack heals for 50% of damage dealt.', 'MOBILITY // next hit 50% lifesteal', 'onAbilityResolve', { tagAll: ['MOBILITY'] }),
  HEX_BREAKER: env('HEX_BREAKER', 'TIER_4', 'Hex-Breaker', 'When Veil Rot is purged from a target, they take 15 Occult burst damage.', 'Rot purge // 15 occult burst', 'passive'),
  OVERLOAD_MASTERY: env('OVERLOAD_MASTERY', 'TIER_4', 'Overload Mastery', 'At exactly 1% Flux, all abilities have 100% Crit Chance.', 'Exactly 1% flux // 100% crit', 'passive'),
  RIFT_WALKER: env('RIFT_WALKER', 'TIER_4', 'Rift-Walker', 'Triggering Rift-Ward grants +15% Evade on the next turn.', 'Rift-Ward trigger // +15% evade', 'onDefensiveSuccess', { tagAll: ['DEFENSIVE'] }),
  VOIDS_BARGAIN: env('VOIDS_BARGAIN', 'TIER_4', "The Void's Bargain", 'First attack each turn deals double damage, but you start every encounter missing 25% Flux.', 'Passive // 2× first hit, −25% start flux', 'passive'),
};

export const ALL_ENVOY_BOON_IDS = Object.keys(ENVOY_BOON_CATALOG) as EnvoyBoonId[];

export function getEnvoyBoon(id: EnvoyBoonId): ClassBoonDefinition {
  return ENVOY_BOON_CATALOG[id];
}

export function pickRandomEnvoyBoons(
  count: number,
  owned: readonly EnvoyBoonId[] = [],
): ClassBoonDefinition[] {
  const ownedSet = new Set(owned);
  const pool = ALL_ENVOY_BOON_IDS.filter((id) => !ownedSet.has(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((id) => ENVOY_BOON_CATALOG[id]);
}
