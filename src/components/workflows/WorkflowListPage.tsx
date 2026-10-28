'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

import { UserMenu } from '@/components/auth/UserMenu';
import { BrandMark } from '@/components/brand/BrandMark';
import { ImportDialog } from '@/components/dialogs/ImportDialog';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import {
  DEFAULT_SORT,
  nextSort,
  pageCount,
  pageOf,
  visibleRows,
  workflowLabel,
  type SortField,
  type SortState,
} from '@/lib/workflows/listModel';
import type { AgentSummary } from '@/types/agent';

/** Where a workflow opens: the builder, on that workflow. */
export const workflowHref = (id: string) => `/builder?id=${encodeURIComponent(id)}`;
const NEW_WORKFLOW_HREF = '/builder?new=1';

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');

interface Column {
  field: SortField;
  label: string;
  /** Numbers read better right-aligned. */
  numeric?: boolean;
  /** Short values (a badge, a date) stay on one line. */
  nowrap?: boolean;
  cell: (row: AgentSummary) => ReactNode;
}

const COLUMNS: Column[] = [
  {
    field: 'displayName',
    label: 'Name',
    cell: (row) => (
      <Link
        href={workflowHref(row.agenticWorkflowId)}
        className="font-semibold text-accent hover:underline focus-visible:underline focus-visible:outline-none"
      >
        {workflowLabel(row)}
      </Link>
    ),
  },
  { field: 'name', label: 'System name', cell: (row) => <span className="font-mono text-[12px]">{row.name || '—'}</span> },
  {
    field: 'isRoot',
    label: 'Role',
    nowrap: true,
    cell: (row) =>
      row.isRoot ? (
        <span className="rounded-full border border-accent/50 bg-accent/15 px-2 py-0.5 text-[11px] text-accent">Root</span>
      ) : (
        <span className="text-text-muted">Sub-agent</span>
      ),
  },
  { field: 'nodeCount', label: 'Nodes', numeric: true, cell: (row) => row.nodeCount },
  { field: 'edgeCount', label: 'Connections', numeric: true, cell: (row) => row.edgeCount },
  { field: 'environment', label: 'Environment', nowrap: true, cell: (row) => row.environment || '—' },
  { field: 'updatedAt', label: 'Updated', nowrap: true, cell: (row) => formatDate(row.updatedAt) },
];

function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="text-[13px] font-semibold text-text-primary">{title}</p>
      {children}
    </div>
  );
}

/**
 * Every agent workflow (`GET /api/v1/agents`), after the Strands Visual Builder's
 * list: search, sortable columns and pages. A name opens the workflow in the
 * builder; New workflow starts a blank canvas and Import uploads a package.
 */
export function WorkflowListPage() {
  const router = useRouter();
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.listAgents });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);

  const all = useMemo(() => agents.data ?? [], [agents.data]);
  const rows = useMemo(() => visibleRows(all, query, sort), [all, query, sort]);
  const pages = pageCount(rows.length);
  const current = Math.min(page, pages);
  const shown = pageOf(rows, current);

  const search = (text: string) => {
    setQuery(text);
    setPage(1);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
        <BrandMark />
        <span className="text-[13px] font-semibold text-text-primary">Agent Workflow Builder</span>
        <span className="ml-auto" />
        <UserMenu />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Agent Workflows</h1>
            <p className="mt-1 text-[13px] text-text-muted">
              Every agent workflow. Open one to edit it in the builder, or start a new one.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-icon"
              onClick={() => void agents.refetch()}
              aria-label="Refresh"
              title="Refresh"
            >
              <i className={cn('bi-arrow-clockwise', agents.isFetching && 'inline-block animate-spin')} />
            </button>
            <button type="button" className="btn-sm" onClick={() => setImporting(true)}>
              <i className="bi-upload" /> Import
            </button>
            <Link href={NEW_WORKFLOW_HREF} className="btn-primary">
              <i className="bi-plus-lg" /> New workflow
            </Link>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-panel" aria-labelledby="workflow-table-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 id="workflow-table-title" className="text-[14px] font-semibold text-text-primary">
              {agents.isError ? 'Workflows could not be loaded' : 'All workflows'}
              {agents.data && <span className="ml-1.5 font-normal text-text-muted">({all.length})</span>}
            </h2>
            <div className="flex items-center gap-2">
              <label className="relative">
                <span className="sr-only">Find workflows</span>
                <i className="bi-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-text-muted" />
                <input
                  type="search"
                  className="prop-input w-72 pl-8"
                  placeholder="Find workflows"
                  value={query}
                  onChange={(event) => search(event.target.value)}
                />
              </label>
              {query && (
                <span className="text-[12px] text-text-muted" aria-live="polite">
                  {rows.length} {rows.length === 1 ? 'match' : 'matches'}
                </span>
              )}
            </div>
          </div>

          {agents.isPending ? (
            <Empty title="Loading workflows…" />
          ) : agents.isError ? (
            <Empty title={(agents.error as Error).message}>
              <button type="button" className="btn-sm" onClick={() => void agents.refetch()}>
                Try again
              </button>
            </Empty>
          ) : all.length === 0 ? (
            <Empty title="No workflows yet">
              <Link href={NEW_WORKFLOW_HREF} className="btn-primary">
                New workflow
              </Link>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty title="No workflow matches the search">
              <button type="button" className="btn-sm" onClick={() => search('')}>
                Clear the search
              </button>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    {COLUMNS.map((column) => {
                      const active = sort.field === column.field;
                      return (
                        <th
                          key={column.field}
                          scope="col"
                          aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : 'none'}
                          className={cn('px-4 py-2.5 font-semibold text-text-muted', column.numeric && 'text-right')}
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-text-primary focus-visible:text-text-primary"
                            onClick={() => {
                              setSort(nextSort(sort, column.field));
                              setPage(1);
                            }}
                          >
                            {column.label}
                            <i
                              aria-hidden
                              className={cn(
                                'text-[10px]',
                                active ? (sort.descending ? 'bi-caret-down-fill' : 'bi-caret-up-fill') : 'bi-chevron-expand opacity-50',
                              )}
                            />
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr
                      key={row.agenticWorkflowId}
                      className="cursor-pointer border-b border-border/60 last:border-b-0 hover:bg-accent/5"
                      onClick={(event) => {
                        // The name is a link; elsewhere in the row a click opens the workflow too.
                        if ((event.target as HTMLElement).closest('a')) return;
                        router.push(workflowHref(row.agenticWorkflowId));
                      }}
                    >
                      {COLUMNS.map((column) => (
                        <td
                          key={column.field}
                          className={cn(
                            'px-4 py-2.5 text-text-primary',
                            column.numeric && 'whitespace-nowrap text-right tabular-nums',
                            column.nowrap && 'whitespace-nowrap',
                          )}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length > 0 && pages > 1 && (
            <nav className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5 text-[12px] text-text-muted" aria-label="Pages">
              <button
                type="button"
                className="btn-icon disabled:opacity-40"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                aria-label="Previous page"
              >
                <i className="bi-chevron-left" />
              </button>
              <span>
                Page {current} of {pages}
              </span>
              <button
                type="button"
                className="btn-icon disabled:opacity-40"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
                aria-label="Next page"
              >
                <i className="bi-chevron-right" />
              </button>
            </nav>
          )}
        </section>
      </main>

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={async (rootId) => {
          setImporting(false);
          await agents.refetch();
          router.push(workflowHref(rootId));
        }}
      />
    </div>
  );
}
