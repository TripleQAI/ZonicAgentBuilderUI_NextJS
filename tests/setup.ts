/**
 * Runs before every test file.
 *
 * Zustand's store is a module-level singleton, so state written by one test
 * would otherwise leak into the next. Resetting it here keeps tests order-
 * independent, which is what makes a failure mean something.
 */

import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

import { useWorkflowStore } from '@/store/useWorkflowStore';

const PRISTINE = useWorkflowStore.getState();

beforeEach(() => {
  useWorkflowStore.setState(
    {
      currentAgent: null,
      rootAgenticWorkflowId: null,
      allAgentsById: {},
      relationshipMap: null,
      nodeRegistry: [],
      nodeSemantics: {},
      selectedNodeId: null,
      selectedEdgeId: null,
      isReadOnly: false,
      isDirty: false,
      formEpoch: 0,
    },
    false,
  );
  // Actions are recreated by `create`, so restore them alongside the data.
  useWorkflowStore.setState(PRISTINE, false);
  useWorkflowStore.setState({ currentAgent: null, isDirty: false }, false);
});
