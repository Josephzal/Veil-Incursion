import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from './worldStateHelpers';

export interface OperationProgressProvider {
  getOperationProgress(operationId: string): Promise<number>;
  applyContribution(operationId: string, amount: number): Promise<number>;
}

/** In-memory + persisted snapshot backing for v1 local progress. */
export class LocalOperationProgressProvider implements OperationProgressProvider {
  private progress: Record<string, number>;

  constructor(initial: Record<string, number> = {}) {
    this.progress = { ...initial };
  }

  snapshot(): Record<string, number> {
    return { ...this.progress };
  }

  hydrate(progress: Record<string, number>): void {
    this.progress = { ...progress };
  }

  async getOperationProgress(operationId: string): Promise<number> {
    return this.progress[operationId] ?? 0;
  }

  async applyContribution(operationId: string, amount: number): Promise<number> {
    const next = Math.max(0, (this.progress[operationId] ?? 0) + amount);
    this.progress[operationId] = next;
    return next;
  }
}

/** Stub for future server-backed community progress — returns local value + small simulated bump. */
export class SimulatedGlobalOperationProgressProvider implements OperationProgressProvider {
  constructor(private local: LocalOperationProgressProvider) {}

  async getOperationProgress(operationId: string): Promise<number> {
    const local = await this.local.getOperationProgress(operationId);
    const simulatedCommunity = Math.floor(local * 0.15);
    return Math.min(DEFAULT_OPERATION_PROGRESS_REQUIRED, local + simulatedCommunity);
  }

  async applyContribution(operationId: string, amount: number): Promise<number> {
    return this.local.applyContribution(operationId, amount);
  }
}
