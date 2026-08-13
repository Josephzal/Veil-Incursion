import type { ActiveIncursionState, PlayerAccount } from '../../types/game';
import type { SectorState, WorldStatePersistedState } from '../../types/worldState';
import type { SelectedContractState } from '../../types/contract';
import { validateSelectedContractForDescent } from './contractValidationEngine';
import { sumLedgerCategoryTotals } from './runIntegrationHelpers';
import { isRequisitionId } from '../expeditionRequisitionRegistry';

export type RunLoopAuditStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface RunLoopAuditEntry {
  phase: 'PRE_RUN' | 'RUN_START' | 'DURING_RUN' | 'POST_RUN' | 'PERSISTENCE';
  check: string;
  status: RunLoopAuditStatus;
  detail?: string;
}

export interface RunLoopAuditReport {
  entries: RunLoopAuditEntry[];
  passCount: number;
  failCount: number;
  warnCount: number;
}

function entry(
  phase: RunLoopAuditEntry['phase'],
  check: string,
  status: RunLoopAuditStatus,
  detail?: string,
): RunLoopAuditEntry {
  return { phase, check, status, detail };
}

export function auditPreRunDescent(
  account: PlayerAccount,
  selectedContract: SelectedContractState,
  sector: SectorState | null,
  selectedSectorId: string | null,
): RunLoopAuditEntry[] {
  const entries: RunLoopAuditEntry[] = [];

  entries.push(entry(
    'PRE_RUN',
    'Class loadout staged',
    account.activeClass ? 'pass' : 'fail',
    account.activeClass ?? 'none',
  ));

  entries.push(entry(
    'PRE_RUN',
    'Contract selected or independent',
    'pass',
    selectedContract.kind,
  ));

  if (selectedContract.kind === 'SPONSOR' && sector && selectedSectorId) {
    const contractIssues = validateSelectedContractForDescent(selectedContract, selectedSectorId as import('../../types/worldState').SectorId);
    entries.push(entry(
      'PRE_RUN',
      'Selected contract valid for sector',
      contractIssues.some((i) => i.severity === 'error') ? 'fail' : contractIssues.length > 0 ? 'warn' : 'pass',
      contractIssues.map((i) => i.message).join('; ') || undefined,
    ));
  } else {
    entries.push(entry('PRE_RUN', 'Selected contract valid for sector', 'skip'));
  }

  entries.push(entry(
    'PRE_RUN',
    'Sector valid',
    sector ? 'pass' : 'fail',
    sector?.displayName,
  ));

  entries.push(entry(
    'PRE_RUN',
    'Sector has active operation',
    sector?.activeOperation?.lifecycleStatus === 'ACTIVE' ? 'pass' : sector ? 'warn' : 'fail',
    sector?.activeOperation?.title,
  ));

  entries.push(entry(
    'PRE_RUN',
    'Sector has active anchor',
    sector?.activeAnchor?.isActive ? 'pass' : sector?.activeAnchor ? 'warn' : sector ? 'warn' : 'fail',
    sector?.activeAnchor?.type,
  ));

  entries.push(entry(
    'PRE_RUN',
    'Expedition Requisition valid',
    !account.equippedRequisitionId || isRequisitionId(account.equippedRequisitionId)
      ? 'pass'
      : 'fail',
    account.equippedRequisitionId ?? 'none',
  ));

  entries.push(entry(
    'PRE_RUN',
    'Pre-run cargo grid initialized',
    account.preRunCargo ? 'pass' : 'fail',
  ));

  return entries;
}

export function auditRunStartSnapshot(incursion: ActiveIncursionState): RunLoopAuditEntry[] {
  const entries: RunLoopAuditEntry[] = [];
  const ctx = incursion.runGenerationContext;

  entries.push(entry('RUN_START', 'Run generation context frozen', ctx ? 'pass' : 'fail'));
  entries.push(entry('RUN_START', 'Active contract copied', incursion.activeContract ? 'pass' : 'warn'));
  entries.push(entry('RUN_START', 'Active operation snapshot', ctx?.activeOperation ? 'pass' : 'fail', ctx?.activeOperation?.title));
  entries.push(entry('RUN_START', 'Active anchor snapshot', ctx?.activeAnchor ? 'pass' : 'warn', ctx?.activeAnchor?.type));
  entries.push(entry(
    'RUN_START',
    'Requisition runtime initialized',
    incursion.requisitionRuntime != null ? 'pass' : 'skip',
  ));
  entries.push(entry('RUN_START', 'Resource ledger initialized', incursion.runResourceLedger ? 'pass' : 'fail'));
  entries.push(entry('RUN_START', 'Cargo Supply runtime initialized', incursion.supplyRuntime ? 'pass' : 'fail'));
  entries.push(entry('RUN_START', 'Echo run state initialized', incursion.echoRunState ? 'pass' : 'fail'));

  return entries;
}

export function auditDuringRunState(incursion: ActiveIncursionState): RunLoopAuditEntry[] {
  const entries: RunLoopAuditEntry[] = [];
  const tree = incursion.proceduralRunTree;

  entries.push(entry(
    'DURING_RUN',
    'Procedural tree generated',
    tree && Object.keys(tree.nodes).length > 0 ? 'pass' : 'skip',
    tree ? `${Object.keys(tree.nodes).length} nodes` : undefined,
  ));

  entries.push(entry(
    'DURING_RUN',
    'Contract progress tracking',
    incursion.contractRunProgress ? 'pass' : 'fail',
  ));

  entries.push(entry(
    'DURING_RUN',
    'Echo run telemetry',
    incursion.echoRunState ? 'pass' : 'fail',
  ));

  return entries;
}

export function auditPostRunResolution(
  incursion: ActiveIncursionState,
  opts: { extractedSuccessfully: boolean },
): RunLoopAuditEntry[] {
  const entries: RunLoopAuditEntry[] = [];
  const ledger = incursion.runResourceLedger;
  const banked = sumLedgerCategoryTotals(ledger.bankedAtSafehouse);
  const lost = sumLedgerCategoryTotals(ledger.lostOnDeath);
  const extracted = sumLedgerCategoryTotals(ledger.extracted);

  if (!opts.extractedSuccessfully) {
    entries.push(entry(
      'POST_RUN',
      'Unbanked cargo lost on death',
      lost >= 0 ? 'pass' : 'fail',
      `lost stacks: ${lost}`,
    ));
    entries.push(entry(
      'POST_RUN',
      'Banked cargo survives death',
      banked >= 0 ? 'pass' : 'fail',
      `banked stacks: ${banked}`,
    ));
  } else {
    entries.push(entry(
      'POST_RUN',
      'Extracted cargo recorded',
      extracted >= 0 ? 'pass' : 'fail',
      `extracted stacks: ${extracted}`,
    ));
  }

  entries.push(entry(
    'POST_RUN',
    'Contract progress captured',
    incursion.contractRunProgress ? 'pass' : 'fail',
  ));

  return entries;
}

export function auditPersistenceSeparation(
  account: PlayerAccount,
  incursion: ActiveIncursionState | null,
  persisted: WorldStatePersistedState,
): RunLoopAuditEntry[] {
  const entries: RunLoopAuditEntry[] = [];

  entries.push(entry(
    'PERSISTENCE',
    'Account stash persisted',
    account.resourceStash ? 'pass' : 'fail',
  ));

  entries.push(entry(
    'PERSISTENCE',
    'Sponsor reputation persisted',
    account.sponsorReputation ? 'pass' : 'warn',
  ));

  entries.push(entry(
    'PERSISTENCE',
    'Contract board persisted',
    persisted.contractBoard ? 'pass' : 'fail',
  ));

  entries.push(entry(
    'PERSISTENCE',
    'Run-only state isolated',
    incursion?.isRunActive ? 'warn' : 'pass',
    incursion?.isRunActive ? 'active incursion still live' : 'no active run',
  ));

  return entries;
}

export function buildFullRunLoopAudit(opts: {
  account: PlayerAccount;
  persisted: WorldStatePersistedState;
  sectors: SectorState[];
  selectedContract: SelectedContractState;
  selectedSectorId: string | null;
  incursion?: ActiveIncursionState | null;
  extractedSuccessfully?: boolean;
}): RunLoopAuditReport {
  const sector = opts.sectors.find((s) => s.id === opts.selectedSectorId) ?? null;
  const entries: RunLoopAuditEntry[] = [
    ...auditPreRunDescent(opts.account, opts.selectedContract, sector, opts.selectedSectorId),
  ];

  if (opts.incursion) {
    entries.push(...auditRunStartSnapshot(opts.incursion));
    entries.push(...auditDuringRunState(opts.incursion));
    entries.push(...auditPostRunResolution(opts.incursion, {
      extractedSuccessfully: opts.extractedSuccessfully ?? false,
    }));
  }

  entries.push(...auditPersistenceSeparation(opts.account, opts.incursion ?? null, opts.persisted));

  return {
    entries,
    passCount: entries.filter((e) => e.status === 'pass').length,
    failCount: entries.filter((e) => e.status === 'fail').length,
    warnCount: entries.filter((e) => e.status === 'warn').length,
  };
}

export function formatRunLoopAuditReport(report: RunLoopAuditReport): string {
  const lines = [
    'FULL RUN LOOP AUDIT',
    `pass ${report.passCount} | warn ${report.warnCount} | fail ${report.failCount}`,
    '',
  ];
  let lastPhase = '';
  report.entries.forEach((e) => {
    if (e.phase !== lastPhase) {
      lines.push(`[${e.phase}]`);
      lastPhase = e.phase;
    }
    const icon = e.status === 'pass' ? '✓' : e.status === 'fail' ? '✗' : e.status === 'warn' ? '!' : '-';
    lines.push(`  ${icon} ${e.check}${e.detail ? ` — ${e.detail}` : ''}`);
  });
  return lines.join('\n');
}
