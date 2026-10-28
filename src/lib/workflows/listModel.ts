/**
 * What the workflow list shows: the workflows matching the search text, in the
 * chosen order, one page at a time. Pure, so the rules are tested without React.
 */

import type { AgentSummary } from '@/types/agent';

export type SortField = 'displayName' | 'name' | 'isRoot' | 'nodeCount' | 'edgeCount' | 'environment' | 'updatedAt';

export interface SortState {
  field: SortField;
  descending: boolean;
}

/** Newest first, as the Strands builder's list opens. */
export const DEFAULT_SORT: SortState = { field: 'updatedAt', descending: true };

/** Rows per page. */
export const PAGE_SIZE = 20;

/** The name a row shows: its display name, else its system name, else its ID. */
export const workflowLabel = (row: AgentSummary): string =>
  row.displayName || row.name || row.agenticWorkflowId;

/** Matches the display name, system name, ID or environment, ignoring case. */
export function matches(row: AgentSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.displayName, row.name, row.agenticWorkflowId, row.environment].some((text) =>
    (text ?? '').toLowerCase().includes(needle),
  );
}

function compare(a: AgentSummary, b: AgentSummary, field: SortField): number {
  switch (field) {
    case 'displayName':
      return workflowLabel(a).localeCompare(workflowLabel(b), undefined, { sensitivity: 'base' });
    case 'name':
    case 'environment':
      return (a[field] ?? '').localeCompare(b[field] ?? '', undefined, { sensitivity: 'base' });
    case 'isRoot':
      return Number(a.isRoot) - Number(b.isRoot);
    case 'nodeCount':
    case 'edgeCount':
      return (a[field] ?? 0) - (b[field] ?? 0);
    case 'updatedAt':
      // A workflow never saved sorts as the oldest.
      return (a.updatedAt ? Date.parse(a.updatedAt) : 0) - (b.updatedAt ? Date.parse(b.updatedAt) : 0);
  }
}

/** The matching rows in order; ties keep the name order, so the list is stable. */
export function visibleRows(rows: readonly AgentSummary[], query: string, sort: SortState): AgentSummary[] {
  return rows
    .filter((row) => matches(row, query))
    .sort((a, b) => {
      const order = compare(a, b, sort.field) * (sort.descending ? -1 : 1);
      return order !== 0 ? order : compare(a, b, 'displayName');
    });
}

/** Clicking a column sorts by it ascending; clicking it again reverses it. */
export function nextSort(current: SortState, field: SortField): SortState {
  return current.field === field ? { field, descending: !current.descending } : { field, descending: false };
}

export function pageCount(total: number, size: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/** One page of rows; a page past the end shows the last page. */
export function pageOf<T>(rows: readonly T[], page: number, size: number = PAGE_SIZE): T[] {
  const last = pageCount(rows.length, size);
  const index = Math.min(Math.max(page, 1), last) - 1;
  return rows.slice(index * size, index * size + size);
}
