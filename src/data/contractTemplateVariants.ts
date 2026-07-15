import type { ContractObjectiveKind } from '../types/contract';
import type { CabalEmployerId } from '../types/worldState';

export interface ContractTextVariants {
  titleVariants: readonly string[];
  descriptionVariants: readonly string[];
}

export const CONTRACT_TEXT_VARIANTS: Record<ContractObjectiveKind, ContractTextVariants> = {
  EXTRACT_STABLE_RESOURCE: {
    titleVariants: [
      'Recover {resource} from {sector}',
      'Harvest {resource} Samples',
      'Survey {sector} Material Flow',
      'Extract Distorted {resource}',
      'Map the {resource} Bloom',
      'Secure {resource} Stockpiles',
    ],
    descriptionVariants: [
      '{sponsor} needs {quantity} {resource} from {sector} while {operation} remains active.',
      'Extract {quantity} {resource} before anchor bleed collapses the route.',
      'Stable material signatures spike near {anchor}. Recover {quantity} {resource}.',
      'Sector survey flagged {resource} density in {sector}. Extract {quantity} units.',
      '{sponsor} authorized a harvest run for {quantity} {resource} under current veil pressure.',
      'Pull {quantity} {resource} from {sector} before the extraction window closes.',
    ],
  },
  EXTRACT_SPONSOR_RESOURCE: {
    titleVariants: [
      '{sponsor}: Requisition {resource}',
      'Sponsor Mandate — {resource}',
      'Recover Choir-Tuned {resource}',
      'Priority {resource} Recovery',
      '{sponsor} Material Sweep',
      'Authorized {resource} Pull',
    ],
    descriptionVariants: [
      '{sponsor} has flagged {resource} movement around {anchor}. Extract {quantity} before {operation} collapses the signal.',
      'Sponsor requisition: {quantity} {resource} from {sector}.',
      'Recover {resource} aligned with {sponsor} priorities while operating in {sector}.',
      '{sponsor} wants proof-of-custody for {quantity} {resource} extracted under current crisis.',
      'Priority sponsor cargo: {quantity} {resource}. Depth {depth}+ preferred.',
      'Extract {quantity} {resource} from recommended {sector} routes.',
    ],
  },
  RECOVER_INTEL: {
    titleVariants: [
      'Recover Grid Evidence',
      'Validate {anchor} Containment Codes',
      'Grid Signal Audit — {sector}',
      'Extract Encrypted Evidence',
      'Containment Data Sweep',
      'Authorize Grid Recovery',
    ],
    descriptionVariants: [
      '{sponsor} requires 1 Encrypted Grid-Drive from {sector} for containment validation.',
      'Grid intel must be recovered before {anchor} overwrites sector telemetry.',
      'Extract encrypted evidence tied to {anchor} pressure in {sector}.',
      '{sponsor} authorized a grid evidence pull while {operation} is active.',
      'Recover scanner-grade intel before harmonic lock completes.',
      'Pull grid evidence from {sector} under sponsor authorization.',
    ],
  },
  RECOVER_ECONOMY_INTEL: {
    titleVariants: [
      'Ledger Sweep',
      'Fence Economy Intel',
      'Recover Contraband Ledgers',
      'Dog Tag Accounting',
      'Smuggler Trail Audit',
      'Black Market Paper Trail',
    ],
    descriptionVariants: [
      '{sponsor} wants economy intel recovered from {sector} — ledger or dog tags.',
      'Extract smuggler ledgers or dog tags before routes go cold.',
      'Recover fence-grade intel while {operation} distracts sector patrols.',
      'Economy sweep authorized in {sector}. Extract ledger or tag evidence.',
      '{sponsor} flagged untracked cargo flows near {anchor}.',
      'Pull economy intel from {sector} under sponsor contract.',
    ],
  },
  EXTRACT_UNSTABLE_CARGO: {
    titleVariants: [
      'Volatile Harvest — {sector}',
      'Recover Unstable {resource}',
      'Occult Sample Recovery',
      'Distill {resource} Under Pressure',
      'Harvest the Bloom',
      'Unstable Cargo Mandate',
    ],
    descriptionVariants: [
      '{sponsor} wants unstable material from {sector}. Extract {resource} before it decays.',
      'Volatile cargo signatures near {anchor}. Recover 1 unstable unit.',
      'Extract unstable cargo while {operation} keeps sector scanners busy.',
      'Harvest {resource} or equivalent unstable material from Depth {depth}+.',
      '{sponsor} authorized volatile recovery under elevated echo activity.',
      'Pull unstable samples from {sector} before harmonic collapse.',
    ],
  },
  RECOVER_APEX_CARGO: {
    titleVariants: [
      'Core Mandate',
      'Apex Sample Recovery',
      'Anomalous Core Pull',
      'Deep Core Authorization',
      'Recover the Apex Signal',
      'Communion Core Harvest',
    ],
    descriptionVariants: [
      '{sponsor} authorized a Depth 3 core recovery in {sector}.',
      'Extract 1 Anomalous Core before {anchor} reabsorbs the bloom.',
      'Apex cargo mandate — highest risk, highest payout.',
      'Recover anomalous core material while sector crisis peaks.',
      '{sponsor} wants proof of apex extraction from {sector}.',
      'Depth 3 core pull authorized under {operation}.',
    ],
  },
  RECOVER_CONTRABAND: {
    titleVariants: [
      'Casket Recovery',
      'Fence {anchor} Debris',
      'Contraband Sweep',
      'Sealed Cargo Recovery',
      'Specimen Jar Mandate',
      'Blackline Contraband Pull',
    ],
    descriptionVariants: [
      '{sponsor} wants sealed contraband recovered from {sector}.',
      'Extract a Sealed Containment Casket or Blacksite Specimen Jar.',
      'Contraband signatures near {anchor}. Recover sealed cargo.',
      '{sponsor} authorized contraband recovery under current sector crisis.',
      'Pull fence-grade sealed cargo from {sector}.',
      'Recover contraband before patrol routes reseal.',
    ],
  },
  DEFEAT_ELITE: {
    titleVariants: [
      'Execute Anchor Carriers',
      'Elite Suppression — {sector}',
      'Cull High-Value Targets',
      'Break the Kill Chain',
      'Suppress Elite Surge',
      'Hunt the Route Guardians',
    ],
    descriptionVariants: [
      '{sponsor} wants {quantity} elite encounters suppressed in {sector}.',
      'Defeat elite threats before extracting. Bonus if cleared in Depth {depth}+.',
      'Anchor-tagged elites patrol {sector}. Neutralize {quantity} before extract.',
      '{sponsor} authorized elite cull while {operation} is active.',
      'Suppress elite surge tied to {anchor} pressure.',
      'Eliminate high-risk elites guarding {sector} routes.',
    ],
  },
  COMPLETE_EMERGENCY_RECALL: {
    titleVariants: [
      'No Clean Exit',
      'Survive Dirty Recall',
      'Emergency Recall Proof',
      'Prove the Extraction Window',
      'Dirty Route Stabilization',
      'Recall Under Fire',
    ],
    descriptionVariants: [
      '{sponsor} wants proof of Emergency Recall extraction from {sector}.',
      'Complete an Emergency Recall while {operation} keeps routes volatile.',
      'Survive dirty extraction protocol under {anchor} pressure.',
      'Legion-standard recall mandate — no clean exit required.',
      'Execute emergency recall before sector lockdown.',
      'Prove recall viability while crisis escalates in {sector}.',
    ],
  },
  DEFEAT_DEPTH_BOSS: {
    titleVariants: [
      'Boss Breaker',
      'Suppress Depth Boss',
      'Hunt the Boss-Signature',
      'Break the {sector} Kill Chain',
      'Depth Boss Mandate',
      'Eliminate the Breach Keeper',
    ],
    descriptionVariants: [
      '{sponsor} wants a depth boss suppressed in {sector} before extract.',
      'Defeat the depth boss guarding critical routes.',
      'Boss suppression authorized while {operation} is active.',
      'Clear depth boss threat in {sector}. High risk, high payout.',
      '{sponsor} flagged boss signature near {anchor}.',
      'Neutralize depth boss before harmonic lock.',
    ],
  },
  REACH_DEPTH_AND_EXTRACT: {
    titleVariants: [
      'Bring Back Proof from the Breach',
      'Deep Breach — Depth {depth}',
      'Extract Past the Threshold',
      'Recover a Deep Signal',
      'Survive a Corrupted Route',
      'Take Samples Where the Scanner Lies',
    ],
    descriptionVariants: [
      'Reach Depth {depth} in {sector} and extract alive.',
      '{sponsor} wants proof of deep breach while {operation} is active.',
      'Penetrate to Depth {depth}+ and survive extraction.',
      'Deep contract — higher risk corridor through {sector}.',
      'Extract from Depth {depth} before routes collapse.',
      '{sponsor} authorized deep breach under {anchor} pressure.',
    ],
  },
  CLEAR_OPERATION_TARGET: {
    titleVariants: [
      'Grid Signal Sweep',
      'Cut a {anchor} Signal',
      'Pressure the {anchor} Front',
      'Secure Anchor Evidence',
      'Operation Target Mandate',
      'Clear the Scanner Bloom',
    ],
    descriptionVariants: [
      'Clear 1 Operation Target or Anchor Signal node in {sector} before extracting.',
      '{sponsor} wants operation targets cleared while {operation} is active.',
      'Suppress scanner bloom signatures tied to {anchor}.',
      'Clear operation target nodes supporting {operation}.',
      '{sponsor} authorized signal sweep in {sector}.',
      'Neutralize operation target overlay before extract.',
    ],
  },
};

export const SPONSOR_TITLE_PREFIXES: Record<CabalEmployerId, string[]> = {
  TERRAN_GRID: ['Grid Mandate:', 'Containment Order:', 'Authorized Sweep:', 'Validation Protocol:'],
  LEGION: ['Legion Order:', 'Suppression Directive:', 'Combat Mandate:', 'Field Execution:'],
  SOLARIS: ['Solaris Rite:', 'Occult Mandate:', 'Communion Order:', 'Revelation Protocol:'],
};

export const SOURCE_REASON_LABELS: Record<string, string> = {
  OPERATION_ALIGNED: 'Operation-Aligned',
  ANCHOR_ALIGNED: 'Anchor-Aligned',
  SECTOR_RESOURCE: 'Sector Resource',
  SPONSOR_PREFERENCE: 'Sponsor Priority',
  DEPTH_PRESSURE: 'Deep Contract',
  WILDCARD: 'High Risk',
};

export interface ContractPlaceholderContext {
  sector: string;
  sponsor: string;
  anchor: string;
  resource: string;
  secondaryResource: string;
  operation: string;
  operationKind: string;
  depth: string;
  threat: string;
  target: string;
  quantity: string;
  reward: string;
  signal: string;
  risk: string;
  verb: string;
}

export function fillContractTemplate(
  template: string,
  ctx: ContractPlaceholderContext,
): string {
  const qty = parseInt(ctx.quantity, 10);
  const pluralSuffix = Number.isFinite(qty) && qty > 1 ? 's' : '';
  return template
    .replace(/\{quantity,plural\}/g, pluralSuffix)
    .replace(/\{sector\}/g, ctx.sector)
    .replace(/\{sponsor\}/g, ctx.sponsor)
    .replace(/\{anchor\}/g, ctx.anchor)
    .replace(/\{resource\}/g, ctx.resource)
    .replace(/\{secondaryResource\}/g, ctx.secondaryResource)
    .replace(/\{operation\}/g, ctx.operation)
    .replace(/\{operationKind\}/g, ctx.operationKind)
    .replace(/\{depth\}/g, ctx.depth)
    .replace(/\{threat\}/g, ctx.threat)
    .replace(/\{target\}/g, ctx.target)
    .replace(/\{quantity\}/g, ctx.quantity)
    .replace(/\{reward\}/g, ctx.reward)
    .replace(/\{signal\}/g, ctx.signal)
    .replace(/\{risk\}/g, ctx.risk)
    .replace(/\{verb\}/g, ctx.verb);
}

const PLACEHOLDER_PATTERN = /\{[a-z_,]+\}/i;

export function hasUnresolvedPlaceholders(text: string): boolean {
  return PLACEHOLDER_PATTERN.test(text);
}

export function hashContractTitle(title: string): string {
  let h = 0;
  const normalized = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < normalized.length; i += 1) {
    h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
  }
  return `ct-${Math.abs(h).toString(36)}`;
}
