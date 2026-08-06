import type { ClassBoonDefinition, HexShotBoonId } from '../types/classBoon';

const TIER_LABEL: Record<string, string> = {
  TIER_1: 'TIER 1 // BALLISTIC',
  TIER_2: 'TIER 2 // VOID AMMO',
  TIER_3: 'TIER 3 // TACTICAL',
  TIER_4: 'TIER 4 // SYNAPTIC',
};

function hex(
  id: HexShotBoonId,
  tier: ClassBoonDefinition['tier'],
  name: string,
  description: string,
  effect: string,
  hook: ClassBoonDefinition['hook'],
  tags?: { tagAll?: readonly string[]; tagAny?: readonly string[] },
): ClassBoonDefinition {
  return {
    id,
    classId: 'HEX_SHOT',
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

export const HEX_SHOT_BOON_CATALOG: Record<HexShotBoonId, ClassBoonDefinition> = {
  HAIR_TRIGGER: hex('HAIR_TRIGGER', 'TIER_1', 'Hair-Trigger', 'Ballistic kills refund 1 Ammo.', 'BALLISTIC kill // refund 1 Ammo', 'onKill', { tagAll: ['BALLISTIC'] }),
  EXTENDED_MAGS: hex('EXTENDED_MAGS', 'TIER_1', 'Extended Mags', 'Max Magazine +2.', 'Passive // Max Magazine +2', 'passive'),
  DEPLETED_URANIUM_TIPS: hex('DEPLETED_URANIUM_TIPS', 'TIER_1', 'Depleted-Uranium Tips', 'Ballistic attacks pierce 1 layer of Kinetic Armor.', 'BALLISTIC // pierce 1 kinetic armor', 'onDamageDeal', { tagAll: ['BALLISTIC'] }),
  RECOIL_HARNESS: hex('RECOIL_HARNESS', 'TIER_1', 'Recoil Harness', 'Ballistic attacks deal +20% damage while overcharge is active.', 'Overcharge active // +20% ballistic damage', 'passive', { tagAll: ['BALLISTIC'] }),
  SHRAPNEL_BLOOM: hex('SHRAPNEL_BLOOM', 'TIER_1', 'Shrapnel Bloom', 'Ballistic crits splash 25% damage to adjacent enemies.', 'BALLISTIC crit // 25% adjacent splash', 'onCriticalHit', { tagAll: ['BALLISTIC'] }),
  SHATTER_RIFLING: hex('SHATTER_RIFLING', 'TIER_1', 'Shatter-Rifling', 'Ballistic attacks deal +30% damage to Fractured targets.', 'Target FRACTURED // +30% ballistic damage', 'onDamageDeal', { tagAll: ['BALLISTIC'] }),
  SUPPRESSIVE_FIRE: hex('SUPPRESSIVE_FIRE', 'TIER_1', 'Suppressive Fire', 'Ballistic hits reduce target next-attack damage by 15%.', 'BALLISTIC // −15% target next attack', 'onDamageDeal', { tagAll: ['BALLISTIC'] }),
  DEAD_EYE: hex('DEAD_EYE', 'TIER_1', 'Dead-Eye', '+15% Crit Chance while Magazine is full.', 'Passive // +15% crit at full mag', 'passive'),
  EXECUTIONERS_CLIP: hex('EXECUTIONERS_CLIP', 'TIER_1', "Executioner's Clip", 'Final bullet in the Magazine deals double damage.', 'Magazine at 1 Ammo // 2× damage', 'onDamageDeal', { tagAll: ['BALLISTIC'] }),
  HOLLOW_POINT_DEBRIS: hex('HOLLOW_POINT_DEBRIS', 'TIER_1', 'Hollow-Point Debris', 'Ballistic kills trigger an AoE physical explosion.', 'BALLISTIC kill // AoE physical burst', 'onKill', { tagAll: ['BALLISTIC'] }),
  VOID_BANDOLEER: hex('VOID_BANDOLEER', 'TIER_2', 'Void-Bandoleer', 'Void Ammo costs 0 Ammo but drains 10% Max HP per shot.', 'VOID_AMMO // 0 ammo, −10% max HP', 'onAbilityResolve', { tagAll: ['VOID_AMMO'] }),
  CORRUPTED_CASINGS: hex('CORRUPTED_CASINGS', 'TIER_2', 'Corrupted Casings', 'Void Ammo applies 1 stack Void-Bleed.', 'VOID_AMMO // +1 Void-Bleed', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  SIPHON_CHOKE: hex('SIPHON_CHOKE', 'TIER_2', 'Siphon-Choke', 'Void Ammo crits heal 5% Max HP.', 'VOID_AMMO crit // heal 5% max HP', 'onCriticalHit', { tagAll: ['VOID_AMMO'] }),
  ABYSSAL_PRIMERS: hex('ABYSSAL_PRIMERS', 'TIER_2', 'Abyssal Primers', 'Void Ammo converts 50% Kinetic damage to Occult.', 'VOID_AMMO // 50% kinetic → occult', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  ETHEREAL_MAGAZINES: hex('ETHEREAL_MAGAZINES', 'TIER_2', 'Ethereal Magazines', 'Reloading grants a temporary 1-hit Occult Shield.', 'Reload // 1-hit occult shield', 'onAbilityResolve', { tagAll: ['RELOAD'] }),
  EVENT_HORIZON_ROUNDS: hex('EVENT_HORIZON_ROUNDS', 'TIER_2', 'Event Horizon Rounds', 'Void Ammo permanently reduces target Evade to 0%.', 'VOID_AMMO // target evade → 0%', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  CURSED_BALLISTICS: hex('CURSED_BALLISTICS', 'TIER_2', 'Cursed Ballistics', 'Void Ammo vs Void-Marked bypasses all defensive buffs.', 'VOID_MARKED // bypass defenses', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  PHANTOM_TRACER: hex('PHANTOM_TRACER', 'TIER_2', 'Phantom Tracer', 'Void Ammo marks targets +10% damage for the encounter.', 'VOID_AMMO // +10% damage taken', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  LEYLINE_PENETRATOR: hex('LEYLINE_PENETRATOR', 'TIER_2', 'Ley-Line Penetrator', 'Void Ammo deals +50% damage to back-row targets.', 'VOID_AMMO backline // +50% damage', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  ECHOING_GUNFIRE: hex('ECHOING_GUNFIRE', 'TIER_2', 'Echoing Gunfire', 'Void Ammo has 20% chance to duplicate at a random target.', 'VOID_AMMO // 20% echo shot', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  FLAWLESS_DRILL: hex('FLAWLESS_DRILL', 'TIER_3', 'Flawless Drill', 'Perfect Active Reload instantly grants +1 AP.', 'Perfect reload // +1 AP', 'onAbilityResolve', { tagAll: ['RELOAD'] }),
  CHEMICAL_WARFARE: hex('CHEMICAL_WARFARE', 'TIER_3', 'Chemical Warfare', 'Trap/AoE explosions reduce enemy Armor by 1 per turn.', 'TRAP/AOE // −1 armor per turn', 'onAbilityResolve', { tagAny: ['TRAP', 'AOE'] }),
  ADRENALINE_INJECTOR: hex('ADRENALINE_INJECTOR', 'TIER_3', 'Adrenaline Injector', 'Tactical abilities restore 20% Stamina.', 'TACTICAL // +20% stamina', 'onAbilityResolve', { tagAll: ['TACTICAL'] }),
  REACTIVE_CAMO: hex('REACTIVE_CAMO', 'TIER_3', 'Reactive Camo', 'Taking damage applies UNTARGETABLE for 1 turn (once per encounter).', 'onTakeDamage // UNTARGETABLE 1 turn', 'onTakeDamage'),
  GRID_SCRAMBLER: hex('GRID_SCRAMBLER', 'TIER_3', 'Grid-Scrambler', 'Trap damage has 50% chance to Stun the target.', 'TRAP // 50% stun', 'onDamageDeal', { tagAll: ['TRAP'] }),
  AUTO_LOADER_DECK: hex('AUTO_LOADER_DECK', 'TIER_3', 'Auto-Loader Deck', 'Start combat with a full Magazine.', 'onEncounterStart // full mag', 'onEncounterStart'),
  PANIC_BUTTON: hex('PANIC_BUTTON', 'TIER_3', 'Panic Button', 'Empty mag + 0 AP: load 2 Ammo and gain 1 AP (once per run).', 'Empty mag + 0 AP // +2 ammo, +1 AP', 'passive'),
  FLASH_BLIND_OPTICS: hex('FLASH_BLIND_OPTICS', 'TIER_3', 'Flash-Blind Optics', 'Applying EXPOSED reduces target base damage by 20%.', 'EXPOSED // −20% target base damage', 'onAbilityResolve', { tagAll: ['DEBUFF'] }),
  KINETIC_DAMPENERS: hex('KINETIC_DAMPENERS', 'TIER_3', 'Kinetic Dampeners', 'Defensive abilities increase Max HP by +10%.', 'DEFENSIVE passive // +10% max HP', 'passive', { tagAll: ['DEFENSIVE'] }),
  SURVIVALIST: hex('SURVIVALIST', 'TIER_3', 'Survivalist', 'Sanctuary Bio-Stim healing effectiveness +50%.', 'Bio-Stim // +50% heal', 'passive'),
  TACTICAL_RELOAD: hex('TACTICAL_RELOAD', 'TIER_4', 'Tactical Reload', 'After Reload, next TACTICAL ability costs 0 AP.', 'RELOAD // next TACTICAL 0 AP', 'onAbilityResolve', { tagAll: ['RELOAD'] }),
  BREACH_AND_CLEAR: hex('BREACH_AND_CLEAR', 'TIER_4', 'Breach and Clear', 'Ballistic after AoE deals +40% damage.', 'BALLISTIC after AOE // +40% damage', 'onDamageDeal', { tagAll: ['BALLISTIC'] }),
  OCCULT_ASSASSIN: hex('OCCULT_ASSASSIN', 'TIER_4', 'Occult Assassin', 'Void Ammo vs EXPOSED is a guaranteed Crit.', 'VOID_AMMO + EXPOSED // guaranteed crit', 'onDamageDeal', { tagAll: ['VOID_AMMO'] }),
  GUERILLA_WARFARE: hex('GUERILLA_WARFARE', 'TIER_4', 'Guerilla Warfare', 'Trap abilities grant 15% Evade for 1 turn.', 'TRAP // +15% evade 1 turn', 'onAbilityResolve', { tagAll: ['TRAP'] }),
  GUN_FU: hex('GUN_FU', 'TIER_4', 'Gun-Fu', 'TACTICAL immediately after BALLISTIC refunds 15% Stamina.', 'TACTICAL after BALLISTIC // +15% stamina', 'onAbilityResolve', { tagAll: ['TACTICAL'] }),
  ZERO_POINT_EXTRACTION: hex('ZERO_POINT_EXTRACTION', 'TIER_4', 'Zero-Point Extraction', 'Ultimate kills fully restore Magazine and Stamina.', 'ULTIMATE kill // full mag + stamina', 'onKill', { tagAll: ['ULTIMATE'] }),
  HOT_SWAP: hex('HOT_SWAP', 'TIER_4', 'Hot-Swap', 'Emptying Magazine: next TACTICAL deals 20 Occult to random enemy.', 'Empty mag // next TACTICAL 20 occult', 'passive'),
  CURSED_SHRAPNEL: hex('CURSED_SHRAPNEL', 'TIER_4', 'Cursed Shrapnel', 'Ballistic AoE applies Void-Bleed to all hit.', 'BALLISTIC + AOE // Void-Bleed all hit', 'onDamageDeal', { tagAll: ['BALLISTIC', 'AOE'] }),
  OVERWATCH_MASTERY: hex('OVERWATCH_MASTERY', 'TIER_4', 'Overwatch Mastery', 'Panopticon Watch interrupt deals double damage (16 Kinetic).', 'Panopticon interrupt // 2× damage', 'onAbilityResolve'),
  GUNSMITHS_CURSE: hex('GUNSMITHS_CURSE', 'TIER_4', "The Gunsmith's Curse", 'All damage +30%, but Perfect Reload window is 50% smaller.', 'Passive // +30% dmg, tighter reload', 'passive'),
  SILVER_DISCIPLINE: hex('SILVER_DISCIPLINE', 'TIER_2', 'Silver Discipline', 'First Silver-Core shot after a Perfect reload strips +1 Kinetic Armor and deals +15 Fracture.', 'Perfect reload → Silver-Core // +15 Fracture, +1 armor strip', 'passive'),
  WRAITHGLASS_ETCHING: hex('WRAITHGLASS_ETCHING', 'TIER_2', 'Wraithglass Etching', 'Wraithglass shots vs Void-Marked targets deal +8 Occult.', 'WRAITHGLASS vs VOID_MARKED // +8 occult', 'passive'),
  COLD_CHAMBER: hex('COLD_CHAMBER', 'TIER_2', 'Cold Chamber', 'First Stasis-Lock shot after a Perfect reload applies AP −2 instead of AP −1.', 'Perfect reload → Stasis-Lock // AP −2', 'passive'),
};

export const ALL_HEX_SHOT_BOON_IDS = Object.keys(HEX_SHOT_BOON_CATALOG) as HexShotBoonId[];

export function getHexShotBoon(id: HexShotBoonId): ClassBoonDefinition {
  return HEX_SHOT_BOON_CATALOG[id];
}

export function pickRandomHexShotBoons(
  count: number,
  owned: readonly HexShotBoonId[] = [],
): ClassBoonDefinition[] {
  const ownedSet = new Set(owned);
  const pool = ALL_HEX_SHOT_BOON_IDS.filter((id) => !ownedSet.has(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((id) => HEX_SHOT_BOON_CATALOG[id]);
}
