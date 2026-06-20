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
  VOID_TOUCHED: env('VOID_TOUCHED', 'TIER_1', 'Void-Touched', 'Spells deal +15% damage when Flux is above 50.', 'SPELL + Flux >50 // +15% damage', 'onDamageDeal', { tagAll: ['SPELL'] }),
  SHATTER_CAST: env('SHATTER_CAST', 'TIER_1', 'Shatter-Cast', 'Spells destroy 1 layer of enemy shielding.', 'SPELL // shred 1 shield layer', 'onDamageDeal', { tagAll: ['SPELL'] }),
  ECHOING_AETHER: env('ECHOING_AETHER', 'TIER_1', 'Echoing Aether', '15% chance to duplicate a spell for 0 AP/0 Flux.', 'SPELL // 15% duplicate cast', 'onAbilityResolve', { tagAll: ['SPELL'] }),
  LEYLINE_SURGE: env('LEYLINE_SURGE', 'TIER_1', 'Ley-Line Surge', 'Entering Overload instantly resets all Cooldowns.', 'Overload entry // reset cooldowns', 'passive'),
  ASTRAL_PIERCER: env('ASTRAL_PIERCER', 'TIER_1', 'Astral Piercer', 'Ranged spells deal +30% damage to back-row targets.', 'RANGED backline // +30% damage', 'onDamageDeal', { tagAll: ['RANGED'] }),
  VOLATILE_MAGIC: env('VOLATILE_MAGIC', 'TIER_1', 'Volatile Magic', 'AoE spells gain +25% critical hit multiplier.', 'AOE // +25% crit multiplier', 'onCriticalHit', { tagAll: ['AOE'] }),
  FLUX_CAPACITOR: env('FLUX_CAPACITOR', 'TIER_1', 'Flux-Capacitor', 'Overload threshold increased from 100 to 120 Flux.', 'Passive // overload at 120 flux', 'passive'),
  KINETIC_CONVERSION: env('KINETIC_CONVERSION', 'TIER_1', 'Kinetic Conversion', 'Spells convert 20% Occult damage to Kinetic.', 'SPELL // 20% occult → kinetic', 'onDamageDeal', { tagAll: ['SPELL'] }),
  EXECUTIONERS_SPELL: env('EXECUTIONERS_SPELL', 'TIER_1', "Executioner's Spell", 'Spells instantly execute targets below 20% HP.', 'Target <20% HP // execute', 'onDamageDeal', { tagAll: ['SPELL'] }),
  RESIDUAL_ENERGY: env('RESIDUAL_ENERGY', 'TIER_1', 'Residual Energy', 'Generating Flux grants 1-hit Occult Shield (stacks to 2).', 'FLUX_GEN // occult shield stack', 'onAbilityResolve', { tagAll: ['FLUX_GEN'] }),
  CONTAGIOUS_HEX: env('CONTAGIOUS_HEX', 'TIER_2', 'Contagious Hex', 'If a cursed target dies, curses jump to an adjacent enemy.', 'CURSE kill // curse spreads', 'onKill', { tagAll: ['CURSE'] }),
  WITHERED_VIGOR: env('WITHERED_VIGOR', 'TIER_2', 'Withered Vigor', 'Applying a curse permanently reduces target base damage by 10%.', 'CURSE // −10% target base damage', 'onAbilityResolve', { tagAll: ['CURSE'] }),
  PARASITIC_LINK: env('PARASITIC_LINK', 'TIER_2', 'Parasitic Link', 'Heal 2 HP per turn for each cursed enemy.', 'Cursed enemy // +2 HP/turn', 'onTurnStart'),
  HEAVY_GRAVITY: env('HEAVY_GRAVITY', 'TIER_2', 'Heavy Gravity', 'Displaced/Rooted enemies lose 1 AP next turn.', 'CONTROL displacement // −1 AP', 'onAbilityResolve', { tagAll: ['CONTROL'] }),
  DOOMED_FLESH: env('DOOMED_FLESH', 'TIER_2', 'Doomed Flesh', 'Debuffs last 1 additional turn.', 'DEBUFF // +1 turn duration', 'onAbilityResolve', { tagAll: ['DEBUFF'] }),
  MIND_PLAGUE: env('MIND_PLAGUE', 'TIER_2', 'Mind-Plague', 'Concussed enemies take double Occult damage.', 'CONCUSSED // 2× occult damage', 'onDamageDeal'),
  CURSE_EATER: env('CURSE_EATER', 'TIER_2', 'Curse-Eater', 'Killing a cursed target restores 20% missing HP.', 'Cursed kill // heal 20% missing HP', 'onKill', { tagAll: ['CURSE'] }),
  FLESH_ROT: env('FLESH_ROT', 'TIER_2', 'Flesh-Rot', 'Enemies with Occult DoT cannot heal.', 'Occult DoT // heal blocked', 'passive'),
  VOID_MARKED: env('VOID_MARKED', 'TIER_2', 'Void-Marked', 'Applying a curse removes enemy defensive buffs.', 'CURSE // strip defensive buffs', 'onAbilityResolve', { tagAll: ['CURSE'] }),
  AGONIZING_HEX: env('AGONIZING_HEX', 'TIER_2', 'Agonizing Hex', 'Cursed targets take 5 True Damage when spending AP.', 'Cursed // 5 true on AP spend', 'passive'),
  PERFECTED_WARD: env('PERFECTED_WARD', 'TIER_3', 'Perfected Ward', 'Perfect Rift-Ward drops 50 Flux and refunds 1 AP.', 'Perfect ward // −50 flux, +1 AP', 'onDefensiveSuccess', { tagAll: ['DEFENSIVE'] }),
  MASOCHISTIC_CHANNEL: env('MASOCHISTIC_CHANNEL', 'TIER_3', 'Masochistic Channel', 'In Overload: no longer Silenced, but Overload deals 15 True Damage.', 'Overload // unsilenced, 15 self dmg', 'passive'),
  SAFETY_VALVE: env('SAFETY_VALVE', 'TIER_3', 'Safety Valve', 'Flux-Dump abilities heal 1% Max HP per 10 Flux consumed.', 'FLUX_DUMP // heal per flux spent', 'onAbilityResolve', { tagAll: ['FLUX_DUMP'] }),
  ADRENALINE_CHANNEL: env('ADRENALINE_CHANNEL', 'TIER_3', 'Adrenaline Channel', 'Taking health damage instantly reduces Flux by 20.', 'Damage past shields // −20 flux', 'onTakeDamage'),
  PHASE_SHIFT: env('PHASE_SHIFT', 'TIER_3', 'Phase-Shift', 'Evading an attack restores 1 AP.', 'Evade success // +1 AP', 'onEvadeSuccess', { tagAll: ['MOBILITY'] }),
  EMERGENCY_VENT: env('EMERGENCY_VENT', 'TIER_3', 'Emergency Vent', 'First Overload per encounter releases 20 Occult AoE damage.', 'First overload // 20 occult AoE', 'passive'),
  DEEP_RESERVES: env('DEEP_RESERVES', 'TIER_3', 'Deep Reserves', 'Start combat with 50 Flux.', 'onEncounterStart // 50 flux', 'onEncounterStart'),
  GLASS_CANNON: env('GLASS_CANNON', 'TIER_3', 'Glass Cannon', 'All damage +40%, Max HP −25%.', 'Passive // +40% dmg, −25% max HP', 'passive'),
  BLOOD_MAGIC: env('BLOOD_MAGIC', 'TIER_3', 'Blood Magic', 'At 0 AP, 1 AP abilities cost 15% Max HP instead.', '0 AP // cast via HP', 'passive'),
  AETHERIC_BULWARK: env('AETHERIC_BULWARK', 'TIER_3', 'Aetheric Bulwark', 'Gain +1 Kinetic Armor per 25 Flux held.', 'Passive // +1 armor per 25 flux', 'passive'),
  PENDULUM_SHIFT: env('PENDULUM_SHIFT', 'TIER_4', 'Pendulum Shift', 'FLUX_DUMP after FLUX_GEN deals +50% damage.', 'FLUX_DUMP after FLUX_GEN // +50% damage', 'onDamageDeal', { tagAll: ['FLUX_DUMP'] }),
  CURSED_AETHER: env('CURSED_AETHER', 'TIER_4', 'Cursed Aether', 'Spells on cursed targets generate 50% less Flux.', 'SPELL on cursed // −50% flux gen', 'onAbilityResolve', { tagAll: ['SPELL'] }),
  WARD_WEAVER: env('WARD_WEAVER', 'TIER_4', 'Ward-Weaver', 'After DEFENSIVE, next CURSE costs 0 AP.', 'DEFENSIVE // next CURSE 0 AP', 'onAbilityResolve', { tagAll: ['DEFENSIVE'] }),
  CATACLYSMIC_ECHO: env('CATACLYSMIC_ECHO', 'TIER_4', 'Cataclysmic Echo', 'Ultimate kills permanently increase base Ultimate damage by +2.', 'ULTIMATE kill // +2 base ultimate dmg', 'onKill', { tagAll: ['ULTIMATE'] }),
  SINGULARITY_COLLAPSE: env('SINGULARITY_COLLAPSE', 'TIER_4', 'Singularity Collapse', 'AoE Flux-Dump removes all Kinetic Armor from targets.', 'AOE + FLUX_DUMP // strip all kinetic armor', 'onAbilityResolve', { tagAny: ['AOE', 'FLUX_DUMP'] }),
  VAMPIRIC_STEP: env('VAMPIRIC_STEP', 'TIER_4', 'Vampiric Step', 'After MOBILITY, next attack heals for 50% damage dealt.', 'MOBILITY // next hit 50% lifesteal', 'onAbilityResolve', { tagAll: ['MOBILITY'] }),
  HEX_BREAKER: env('HEX_BREAKER', 'TIER_4', 'Hex-Breaker', 'When a curse expires, target takes 15 Occult burst damage.', 'Curse expire // 15 occult burst', 'onTurnStart'),
  OVERLOAD_MASTERY: env('OVERLOAD_MASTERY', 'TIER_4', 'Overload Mastery', 'At exactly 99 Flux, all abilities have 100% Crit Chance.', 'Exactly 99 flux // 100% crit', 'passive'),
  RIFT_WALKER: env('RIFT_WALKER', 'TIER_4', 'Rift-Walker', 'Rift-Ward teleports to safe tile if shield breaks.', 'Rift-Ward break // teleport safe', 'onDefensiveFail', { tagAll: ['DEFENSIVE'] }),
  VOIDS_BARGAIN: env('VOIDS_BARGAIN', 'TIER_4', "The Void's Bargain", 'First attack each turn deals double damage; start encounter with 1 Bleed.', 'Passive // 2× first hit, start bleed', 'passive'),
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
