import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowListPage } from '@/components/workflows/WorkflowListPage';
import { api } from '@/lib/api/client';
import type { AgentSummary } from '@/types/agent';

/** The workflow list page over a mocked API: rows, links into the builder, search and sorting. */

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ROWS: AgentSummary[] = [
  {
    agenticWorkflowId: 'wf-travel',
    name: 'travel-concierge',
    displayName: 'Travel Concierge',
    isRoot: true,
    nodeCount: 13,
    edgeCount: 8,
    environment: '',
    updatedAt: '2026-10-28T16:00:00Z',
  },
  {
    agenticWorkflowId: 'wf-pay',
    name: 'quick-pay-assistant',
    displayName: 'Quick Pay',
    isRoot: false,
    nodeCount: 4,
    edgeCount: 3,
    environment: 'DEV',
    updatedAt: '2026-10-27T10:00:00Z',
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkflowListPage />
    </QueryClientProvider>,
  );
}

const bodyRows = () => screen.getAllByRole('row').slice(1);
const firstCell = (row: HTMLElement) => within(row).getAllByRole('cell')[0];

beforeEach(() => {
  push.mockReset();
  vi.spyOn(api, 'listAgents').mockResolvedValue(ROWS);
});

describe('the workflow list page', () => {
  it('lists every workflow, newest first, each linking into the builder', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Travel Concierge' })).toHaveAttribute(
      'href',
      '/builder?id=wf-travel',
    );
    expect(screen.getByRole('heading', { name: /All workflows/ })).toHaveTextContent('(2)');
    expect(bodyRows().map((r) => firstCell(r).textContent)).toEqual(['Travel Concierge', 'Quick Pay']);
    expect(within(bodyRows()[0]).getByText('Root')).toBeInTheDocument();
    expect(within(bodyRows()[1]).getByText('Sub-agent')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New workflow/ })).toHaveAttribute('href', '/builder?new=1');
  });

  it('filters by the search text and says when nothing matches', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Travel Concierge' });
    const search = screen.getByPlaceholderText('Find workflows');
    fireEvent.change(search, { target: { value: 'pay' } });
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('1 match')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No workflow matches the search')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(bodyRows()).toHaveLength(2);
  });

  it('sorts by a column header and marks the sorted column', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Travel Concierge' });
    fireEvent.click(screen.getByRole('button', { name: 'Nodes' }));
    expect(screen.getByRole('columnheader', { name: 'Nodes' })).toHaveAttribute('aria-sort', 'ascending');
    expect(firstCell(bodyRows()[0])).toHaveTextContent('Quick Pay');
  });

  it('opens a workflow when its row is clicked', async () => {
    renderPage();
    await screen.findByRole('link', { name: 'Travel Concierge' });
    fireEvent.click(within(bodyRows()[1]).getByText('quick-pay-assistant'));
    expect(push).toHaveBeenCalledWith('/builder?id=wf-pay');
  });

  it('shows the API error with a retry', async () => {
    vi.spyOn(api, 'listAgents').mockRejectedValue(new Error('Cannot reach the API.'));
    renderPage();
    expect(await screen.findByText('Cannot reach the API.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
