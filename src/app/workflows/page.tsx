import type { Metadata } from 'next';
import { Suspense } from 'react';

import { RequireAuth } from '@/components/auth/AuthProvider';
import { WorkflowListPage } from '@/components/workflows/WorkflowListPage';

export const metadata: Metadata = { title: 'Agent Workflows · TripleQ Agent Workflow Builder' };

/** Every agent workflow, for a signed-in user; each one opens in the builder. */
export default function WorkflowsPage() {
  return (
    <Suspense>
      <RequireAuth>
        <WorkflowListPage />
      </RequireAuth>
    </Suspense>
  );
}
