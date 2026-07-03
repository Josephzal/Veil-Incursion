import type { EchoEliteTemplate } from '../types/echoElite';

function echo(
  id: string,
  displayName: string,
  designation: string,
  tier: EchoEliteTemplate['tier'],
  allowedDepths: EchoEliteTemplate['allowedDepths'],
  roster: EchoEliteTemplate['roster'],
  engageLogLine: string,
  extras?: Partial<EchoEliteTemplate>,
): EchoEliteTemplate {
  return {
    id,
    displayName,
    designation,
    tier,
    allowedDepths,
    roster,
    engageLogLine,
    ...extras,
  };
}

export const ECHO_ELITE_CATALOG: readonly EchoEliteTemplate[] = [
  echo(
    'ECHO_WARDEN_TRACE',
    'Warden Trace',
    'ECHO // WARDEN TRACE',
    'STANDARD',
    [1],
    [{ type: 'WARDEN', pos: 'FRONT_CENTER', isAlpha: true }],
    'Residual warden silhouette — kinetic echo bound to threshold drift.',
    { allowedDepthStages: ['THRESHOLD'], hpScale: 1.12 },
  ),
  echo(
    'ECHO_HOUND_PACK',
    'Hound Residue',
    'ECHO // HOUND RESIDUE',
    'STANDARD',
    [1],
    [
      { type: 'FRACTURE_HOUND', pos: 'FRONT_LEFT', isAlpha: true },
      { type: 'FRACTURE_HOUND', pos: 'FRONT_RIGHT', isAlpha: true },
    ],
    'Twin fracture hounds replaying a prior breach — scent trail still hot.',
    { allowedDepthStages: ['THRESHOLD', 'BREACH'] },
  ),
  echo(
    'ECHO_GARGOYLE_SHELL',
    'Gargoyle Shell',
    'ECHO // GARGOYLE SHELL',
    'STANDARD',
    [1, 2],
    [{ type: 'CONCRETE_GARGOYLE', pos: 'FRONT_CENTER', isAlpha: true }],
    'Concrete gargoyle shell animated by echo residue.',
    { eliteModifier: 'KINETIC_SHIELDING', hpScale: 1.18 },
  ),
  echo(
    'ECHO_BRUTE_REPLAY',
    'Brute Replay',
    'ECHO // BRUTE REPLAY',
    'STANDARD',
    [2],
    [{ type: 'ECHOING_BRUTE', pos: 'FRONT_CENTER', isAlpha: true }],
    'Echoing brute replaying a prior operative strike pattern.',
    { allowedDepthStages: ['BREACH'], damageScale: 1.12 },
  ),
  echo(
    'ECHO_SIREN_CHORUS',
    'Siren Chorus',
    'ECHO // SIREN CHORUS',
    'STANDARD',
    [2],
    [
      { type: 'AMALGAM', pos: 'FRONT_CENTER' },
      { type: 'LEY_SIREN', pos: 'BACK_CENTER', isAlpha: true },
    ],
    'Ley siren chorus phasing through amalgam tissue — breach-layer echo.',
    { allowedDepthStages: ['BREACH', 'DEEP_VEIL'], eliteModifier: 'PHASE_SHROUD' },
  ),
  echo(
    'ECHO_GOLEM_MEMORY',
    'Golem Memory',
    'ECHO // GOLEM MEMORY',
    'STANDARD',
    [2, 3],
    [{ type: 'GOLEM', pos: 'FRONT_CENTER', isAlpha: true }],
    'Golem memory imprint — slow, heavy, still marching.',
    { hpScale: 1.2 },
  ),
  echo(
    'ECHO_NULL_SHADE',
    'Null Shade Ghost',
    'ECHO // NULL SHADE',
    'LEGENDARY',
    [3],
    [{ type: 'NULL_SHADE', pos: 'FRONT_CENTER', isAlpha: true }],
    'Legendary null shade ghost — deep veil residue coalesced.',
    {
      allowedDepthStages: ['DEEP_VEIL'],
      eliteModifier: 'PHASE_SHROUD',
      hpScale: 1.35,
      damageScale: 1.18,
    },
  ),
  echo(
    'ECHO_GLITCH_TWINS',
    'Glitch Twins',
    'ECHO // GLITCH TWINS',
    'LEGENDARY',
    [3],
    [
      { type: 'SPATIAL_GLITCH', pos: 'FRONT_LEFT', isAlpha: true },
      { type: 'SPATIAL_GLITCH', pos: 'FRONT_RIGHT', isAlpha: true },
    ],
    'Legendary spatial glitch twins — synchronized phase tear.',
    {
      allowedDepthStages: ['DEEP_VEIL'],
      eliteModifier: 'LETHAL_RETALIATION',
      hpScale: 1.28,
      damageScale: 1.15,
    },
  ),
  echo(
    'ECHO_MEMORY_LEECH',
    'Memory Leech',
    'ECHO // MEMORY LEECH',
    'STANDARD',
    [3],
    [{ type: 'MEMORY_LEECH', pos: 'FRONT_CENTER', isAlpha: true }],
    'Memory leech echo feeding on prior run telemetry.',
    { allowedDepthStages: ['DEEP_VEIL'], damageScale: 1.1 },
  ),
  echo(
    'ECHO_IRON_MAIDEN',
    'Iron Maiden Residue',
    'ECHO // IRON MAIDEN',
    'LEGENDARY',
    [3],
    [{ type: 'IRON_MAIDEN', pos: 'FRONT_CENTER', isAlpha: true }],
    'Legendary iron maiden residue — sanguine atrium bleed-through.',
    {
      allowedDepthStages: ['DEEP_VEIL'],
      eliteModifier: 'KINETIC_SHIELDING',
      hpScale: 1.4,
      damageScale: 1.2,
    },
  ),
];

const ECHO_BY_ID = new Map(ECHO_ELITE_CATALOG.map((entry) => [entry.id, entry]));

export function getEchoEliteTemplate(id: string): EchoEliteTemplate | null {
  return ECHO_BY_ID.get(id) ?? null;
}
