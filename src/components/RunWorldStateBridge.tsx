import { useEffect } from 'react';
import { useRun } from '../context/RunContext';
import { useWorldState } from '../context/WorldStateContext';

/** Bridges run-time node clears to hub operation community progress. */
export default function RunWorldStateBridge(): null {
  const { registerOperationContributionApplier } = useRun();
  const { applyOperationContribution } = useWorldState();

  useEffect(() => {
    registerOperationContributionApplier(async (operationId, amount) => {
      await applyOperationContribution(operationId, amount);
    });
    return () => registerOperationContributionApplier(null);
  }, [applyOperationContribution, registerOperationContributionApplier]);

  return null;
}
