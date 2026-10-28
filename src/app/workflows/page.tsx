import type { Metadata } from 'next';

import { WorkflowListPage } from '@/components/workflows/WorkflowListPage';

export const metadata: Metadata = { title: 'Agent Workflows · TripleQ Agent Workflow Builder' };

/** Every agent workflow; each one opens in the builder. */
export default function WorkflowsPage() {
  return <WorkflowListPage />;
}
