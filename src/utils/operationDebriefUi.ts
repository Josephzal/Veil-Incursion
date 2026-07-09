export function computeTotalContributionThisRun(
  extractContributionTotal: number,
  midRunTransmitted: number | undefined,
  extractedSuccessfully: boolean,
): number {
  const extractPoints = extractedSuccessfully ? extractContributionTotal : 0;
  return (midRunTransmitted ?? 0) + extractPoints;
}

export function formatProgressThisRunLine(opts: {
  totalContributionThisRun: number;
  progressBeforePct: number;
  progressAfterPct: number;
  midRunTransmitted?: number;
  extractedSuccessfully: boolean;
}): string {
  if (opts.totalContributionThisRun <= 0) {
    return 'No operation progress generated this run.';
  }

  const pctChanged = opts.progressBeforePct !== opts.progressAfterPct;
  if (pctChanged) {
    return `+${opts.totalContributionThisRun} progress this run (${opts.progressBeforePct}% → ${opts.progressAfterPct}%)`;
  }

  if ((opts.midRunTransmitted ?? 0) > 0 && !opts.extractedSuccessfully) {
    return `+${opts.totalContributionThisRun} progress this run (transmitted mid-incursion)`;
  }

  return `+${opts.totalContributionThisRun} progress this run (${opts.progressAfterPct}%)`;
}

export function formatCommunityProgressLine(
  progressBeforePct: number,
  progressAfterPct: number,
): string {
  if (progressBeforePct === progressAfterPct) {
    return `${progressAfterPct}% community progress`;
  }
  return `${progressBeforePct}% → ${progressAfterPct}% community progress`;
}

/** Strip operational noise from completion log lines for debrief display. */
export function filterDebriefCompletionEffectLines(logLines: string[]): string[] {
  return logLines.filter((line) =>
    line.startsWith('>>')
    && !line.includes('OPERATION CONTRIBUTION')
    && !line.includes('CHECK OPERATIONAL')
    && !/OPERATION COMPLETE —/i.test(line),
  );
}
