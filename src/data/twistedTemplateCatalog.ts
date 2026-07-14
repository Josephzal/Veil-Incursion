import type {
  DeepVeilLawId,
  TwistedChoiceOption,
  TwistedTemplateId,
  VeilDistortionId,
} from '../types/depthIdentity';
import type { ProceduralNodeType } from '../types/proceduralRunTree';

export interface TwistedTemplateDefinition {
  id: TwistedTemplateId;
  displayName: string;
  fantasy: string;
  effectSummary: string;
  telegraph: string;
  allowedDepths: readonly (1 | 2 | 3)[];
  favoredDistortions: readonly VeilDistortionId[];
  favoredLaws: readonly DeepVeilLawId[];
  eligibleNodeTypes: readonly ProceduralNodeType[];
  /** Max times this template may appear in one run. */
  maxPerRun: number;
  /** Requires a player choice overlay (false for combat-only stamps). */
  requiresChoice: boolean;
  prompt: string;
  warnings: readonly string[];
  options: readonly TwistedChoiceOption[];
}

export const TWISTED_TEMPLATE_DEFINITIONS: Record<TwistedTemplateId, TwistedTemplateDefinition> = {
  CORRUPTED_SANCTUARY: {
    id: 'CORRUPTED_SANCTUARY',
    displayName: 'Corrupted Sanctuary',
    fantasy: 'A safe place still exists, but it asks for something back.',
    effectSummary: 'Sanctuary rest with telegraphed tradeoffs.',
    telegraph: 'Sanctuary signature warped — every mercy has a cost.',
    allowedDepths: [2],
    favoredDistortions: ['BLEEDING_ARCHITECTURE', 'RITUAL_PRESSURE'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY'],
    eligibleNodeTypes: ['SANCTUARY'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'The re-tune conduit bleeds wrong. How do you approach it?',
    warnings: [
      'Costs apply immediately on confirm.',
      'This is not a clean sanctuary — leave is always safe.',
    ],
    options: [
      {
        value: 'REST',
        label: 'Rest',
        detail: 'Restore ~25% Soul Anchor. Next combat High-Risk chance rises.',
      },
      {
        value: 'PURGE',
        label: 'Purge',
        detail: 'Bleed 40 CR (or skip if broke) to vent unstable cargo pressure.',
      },
      {
        value: 'LISTEN',
        label: 'Listen',
        detail: 'Gain operation intel / progress. No heal.',
      },
      {
        value: 'LEAVE',
        label: 'Leave',
        detail: 'Walk away. No heal. No cost.',
      },
    ],
  },
  FALSE_EXTRACTION_SIGNAL: {
    id: 'FALSE_EXTRACTION_SIGNAL',
    displayName: 'False Extraction Signal',
    fantasy: 'The scanner finds an extraction route, but the Veil is imitating it.',
    effectSummary: 'Extraction that may force a high-risk intercept fight.',
    telegraph: 'Extraction lock may be a Veil imitation — not guaranteed safe.',
    allowedDepths: [2],
    favoredDistortions: ['PREDATORY_GEOMETRY'],
    favoredLaws: ['THE_ROADS_ARE_LOOPING', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['EXTRACTION'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'The evac conduit sings in two voices. Which signal do you trust?',
    warnings: [
      'Attempting a false lock can force elite intercept combat.',
      'Ignoring keeps all remaining exits intact — no soft-lock.',
    ],
    options: [
      {
        value: 'ATTEMPT',
        label: 'Attempt Extraction',
        detail: 'Force high-risk intercept. If you win, emergency extract opens with bonus payout.',
      },
      {
        value: 'STABILIZE',
        label: 'Stabilize Signal',
        detail: 'Spend 60 CR to convert this into a clean safe-anchor review.',
      },
      {
        value: 'IGNORE',
        label: 'Ignore Signal',
        detail: 'Abort this fake route and continue the incursion.',
      },
    ],
  },
  RESOURCE_BLOOM: {
    id: 'RESOURCE_BLOOM',
    displayName: 'Resource Bloom',
    fantasy: 'A resource vein has overgrown into something alive.',
    effectSummary: 'Greed harvest with unstable cargo and operation forks.',
    telegraph: 'Living vein — careful take, overharvest, or burn for the op.',
    allowedDepths: [2],
    favoredDistortions: ['UNSTABLE_MATTER'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['RESOURCE', 'ANOMALY'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'The vein pulses like a living artery. How hard do you cut?',
    warnings: [
      'Overharvest can spawn unstable cargo pressure.',
      'Leave yields nothing.',
    ],
    options: [
      {
        value: 'HARVEST_CAREFUL',
        label: 'Harvest Carefully',
        detail: 'Stable ley-slag cargo. Low risk.',
      },
      {
        value: 'OVERHARVEST',
        label: 'Overharvest',
        detail: 'Unstable cargo + rare material. Next engagement High-Risk rises.',
      },
      {
        value: 'BURN_SEAL',
        label: 'Burn / Seal It',
        detail: 'Operation contribution. No cargo.',
      },
      {
        value: 'LEAVE',
        label: 'Leave',
        detail: 'Abandon the vein. No reward.',
      },
    ],
  },
  MIRROR_COMBAT: {
    id: 'MIRROR_COMBAT',
    displayName: 'Mirror Combat',
    fantasy: 'The Veil reflects the player\'s violence back into the arena.',
    effectSummary: 'Combat stamped with the MIRRORED encounter modifier.',
    telegraph: 'Mirror rule online — first kill leaves a retaliatory scar.',
    allowedDepths: [2],
    favoredDistortions: ['MEMORY_CONTAMINATION'],
    favoredLaws: ['THE_VEIL_REMEMBERS'],
    eligibleNodeTypes: ['COMBAT', 'ELITE'],
    maxPerRun: 1,
    requiresChoice: false,
    prompt: '',
    warnings: [],
    options: [],
  },
  ANCHOR_VEIN: {
    id: 'ANCHOR_VEIN',
    displayName: 'Anchor Vein',
    fantasy: 'An exposed vein of the active Anchor bleeds through the sector shell.',
    effectSummary: 'Sever / harvest / stabilize forks tied to Anchor Assault.',
    telegraph: 'Anchor vein exposed — sever for ops, harvest for cargo, or stabilize.',
    allowedDepths: [2],
    favoredDistortions: ['RITUAL_PRESSURE', 'BLEEDING_ARCHITECTURE'],
    favoredLaws: ['THE_MACHINE_IS_PRAYING', 'THE_VEIL_REMEMBERS'],
    eligibleNodeTypes: ['ANOMALY', 'RESOURCE', 'COMBAT', 'ELITE'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'An Anchor vein lies open. Cut, take, calm, or leave it?',
    warnings: [
      'Sever costs Soul Anchor integrity.',
      'Harvest raises next High-Risk pressure.',
    ],
    options: [
      {
        value: 'SEVER',
        label: 'Sever It',
        detail: '−12 Soul Anchor. Strong operation contribution toward Anchor Assault.',
      },
      {
        value: 'HARVEST',
        label: 'Harvest It',
        detail: 'Anchor-related cargo. Next High-Risk chance rises.',
      },
      {
        value: 'STABILIZE',
        label: 'Stabilize It',
        detail: 'Spend 50 CR to vent route pressure (clears pending High-Risk).',
      },
      {
        value: 'IGNORE',
        label: 'Ignore It',
        detail: 'Leave the vein untouched.',
      },
    ],
  },
  ANCHOR_CORE_BREACH: {
    id: 'ANCHOR_CORE_BREACH',
    displayName: 'Anchor Core Breach',
    fantasy: 'The player reaches the active Anchor\'s core expression.',
    effectSummary: 'Dangerous Anchor-core moment with ops contribution and greed forks.',
    telegraph: 'ANCHOR CORE exposed — extreme danger, extreme contribution.',
    allowedDepths: [3],
    favoredDistortions: ['RITUAL_PRESSURE'],
    favoredLaws: ['THE_VEIL_REMEMBERS', 'THE_MACHINE_IS_PRAYING', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['ELITE', 'ANOMALY', 'COMBAT'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'The Anchor core yawns open. Breach it, skim residue, or withdraw?',
    warnings: [
      'Max one Core Breach per Deep Veil run.',
      'Does not replace the district boss.',
    ],
    options: [
      {
        value: 'BREACH',
        label: 'Breach the Core',
        detail: '−18 Soul Anchor. Large operation contribution. Next fight High-Risk guaranteed.',
      },
      {
        value: 'SKIM',
        label: 'Skim Residue',
        detail: 'Unstable cargo + echo-glass. Raises next High-Risk pressure.',
      },
      {
        value: 'WITHDRAW',
        label: 'Withdraw',
        detail: 'Leave the core untouched. No reward. No soft-lock.',
      },
    ],
  },
  VEIL_PROPER_CACHE: {
    id: 'VEIL_PROPER_CACHE',
    displayName: 'Veil Proper Cache',
    fantasy: 'The Veil is offering something it should not have.',
    effectSummary: 'Depth 3 greed cache with unstable / rare cargo forks.',
    telegraph: 'Illegal Veil cache — take, stabilize, destroy, or leave.',
    allowedDepths: [3],
    favoredDistortions: ['UNSTABLE_MATTER'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['RESOURCE', 'ANOMALY'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'A cache that should not exist blooms in the Deep Veil. Claim it?',
    warnings: [
      'Never guarantees Apex cargo.',
      'Take raises next-encounter danger.',
    ],
    options: [
      {
        value: 'TAKE',
        label: 'Take the Cache',
        detail: 'Unstable cargo now; small chance of Anomalous Core or Sealed Casket. High-Risk next.',
      },
      {
        value: 'STABILIZE',
        label: 'Stabilize First',
        detail: 'Spend 80 CR. Safer stable slag only.',
      },
      {
        value: 'DESTROY',
        label: 'Destroy It',
        detail: 'Operation contribution. No cargo.',
      },
      {
        value: 'LEAVE',
        label: 'Leave',
        detail: 'Walk away. No reward.',
      },
    ],
  },
  NO_EXIT_SANCTUARY: {
    id: 'NO_EXIT_SANCTUARY',
    displayName: 'No-Exit Sanctuary',
    fantasy: 'A sanctuary exists, but it may not be for the player.',
    effectSummary: 'Harsher Deep Veil sanctuary with heal-for-pressure tradeoffs.',
    telegraph: 'Sanctuary with no clean exit — rest exacts a Deep Veil toll.',
    allowedDepths: [3],
    favoredDistortions: ['BLEEDING_ARCHITECTURE', 'RITUAL_PRESSURE'],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY', 'THE_ROADS_ARE_LOOPING'],
    eligibleNodeTypes: ['SANCTUARY'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'This chapel was built for something else. How do you treat it?',
    warnings: [
      'Harsher than a Corrupted Sanctuary.',
      'Leave is always available — never mandatory.',
    ],
    options: [
      {
        value: 'REST',
        label: 'Rest',
        detail: 'Restore ~35% Soul Anchor. Deep Veil consequence: next High-Risk + pending pressure.',
      },
      {
        value: 'BARGAIN',
        label: 'Bargain',
        detail: '−20 Soul Anchor + spend 70 CR. Temporary edge: clear pending pressure, +12 ops.',
      },
      {
        value: 'CUT_POWER',
        label: 'Cut the Power',
        detail: 'No heal. Vent High-Risk pressure. Mild ops progress.',
      },
      {
        value: 'LEAVE',
        label: 'Leave',
        detail: 'Withdraw. No heal. No cost.',
      },
    ],
  },
  FINAL_ROUTE_FRACTURE: {
    id: 'FINAL_ROUTE_FRACTURE',
    displayName: 'Final Route Fracture',
    fantasy: 'The extraction route exists, but the Veil is trying to close it.',
    effectSummary: 'High-stakes Deep Veil extraction with intercept premium.',
    telegraph: 'Evac conduit fracturing — force exit, burn credits to hold it, or abort.',
    allowedDepths: [3],
    favoredDistortions: ['PREDATORY_GEOMETRY'],
    favoredLaws: ['THE_ROADS_ARE_LOOPING', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['EXTRACTION'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'The exit is closing. Force the fracture, hold it open, or abandon?',
    warnings: [
      'Does not remove boss path or soft-lock the run.',
      'Forcing exit means elite intercept before dirty extract.',
    ],
    options: [
      {
        value: 'FORCE',
        label: 'Force Extraction',
        detail: 'Elite intercept. Survive for emergency extract + large CR bonus.',
      },
      {
        value: 'HOLD',
        label: 'Hold the Route',
        detail: 'Spend 90 CR to stabilize a clean safe-anchor review.',
      },
      {
        value: 'ABORT',
        label: 'Abort Exit',
        detail: 'Leave the fracture. Continue the incursion.',
      },
    ],
  },
  REALITY_TAX: {
    id: 'REALITY_TAX',
    displayName: 'Reality Tax',
    fantasy: 'The Veil demands a payment for continuing.',
    effectSummary: 'Pay health, credits, cargo — or refuse and eat High-Risk.',
    telegraph: 'Reality levy due — pay or refuse into danger.',
    allowedDepths: [3],
    favoredDistortions: ['MEMORY_CONTAMINATION', 'RITUAL_PRESSURE'],
    favoredLaws: ['THE_VEIL_REMEMBERS', 'THE_MACHINE_IS_PRAYING'],
    eligibleNodeTypes: ['ANOMALY'],
    maxPerRun: 1,
    requiresChoice: true,
    prompt: 'The Veil invoices your existence. How do you pay?',
    warnings: [
      'Refuse escalates next-node High-Risk.',
      'Does not auto-consume contract-critical cargo without this confirm.',
    ],
    options: [
      {
        value: 'PAY_HEALTH',
        label: 'Pay Health',
        detail: '−15 Soul Anchor. Clears pending High-Risk. Small ops progress.',
      },
      {
        value: 'PAY_CREDITS',
        label: 'Pay Credits',
        detail: 'Spend 75 CR. Clears pending High-Risk.',
      },
      {
        value: 'PAY_STABLE',
        label: 'Pay Stable Resource',
        detail: 'Consume ley-slag / echo-glass if carried. Safer next node.',
      },
      {
        value: 'PAY_UNSTABLE',
        label: 'Pay Unstable Cargo',
        detail: 'Vent one unstable item if present. Stronger ops progress.',
      },
      {
        value: 'REFUSE',
        label: 'Refuse and Fight',
        detail: 'No payment. Next engagement High-Risk pressure spikes.',
      },
    ],
  },
  APEX_SHADOW: {
    id: 'APEX_SHADOW',
    displayName: 'Apex Shadow',
    fantasy: 'Something enormous is nearby but not fully manifested.',
    effectSummary: 'Elite-pressure combat foreshadowing the Deep Veil boss (not a full boss).',
    telegraph: 'APEX SHADOW — elite pressure, CORE-SICK surge, optional high reward fight.',
    allowedDepths: [3],
    favoredDistortions: [],
    favoredLaws: ['THE_WALLS_ARE_HUNGRY', 'THE_VEIL_REMEMBERS', 'THE_SKY_IS_UNDERGROUND'],
    eligibleNodeTypes: ['ELITE', 'COMBAT'],
    maxPerRun: 1,
    requiresChoice: false,
    prompt: '',
    warnings: [],
    options: [],
  },
};

export const ALL_TWISTED_TEMPLATE_IDS = Object.keys(
  TWISTED_TEMPLATE_DEFINITIONS,
) as TwistedTemplateId[];

export function getTwistedTemplateDefinition(
  id: TwistedTemplateId,
): TwistedTemplateDefinition {
  return TWISTED_TEMPLATE_DEFINITIONS[id];
}

/** Base chance a valid node rolls a twisted template. */
export const TWISTED_TEMPLATE_BASE_CHANCE: Record<1 | 2 | 3, number> = {
  1: 0,
  2: 0.22,
  3: 0.3,
};
