import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SORT,
  nextSort,
  pageCount,
  pageOf,
  visibleRows,
  workflowLabel,
} from '@/lib/workflows/listModel';
import type { AgentSummary } from '@/types/agent';

/** The workflow list's rules: search, order and pages, without React. */

const row = (id: string, fields: Partial<AgentSummary> = {}): AgentSummary => ({
  agenticWorkflowId: id,
  name: id,
  displayName: '',
  isRoot: true,
  nodeCount: 0,
  edgeCount: 0,
  environment: '',
  updatedAt: null,
  ...fields,
});

const ROWS = [
  row('a', {
    displayName: 'Travel Concierge',
    name: 'travel-concierge',
    nodeCount: 13,
    updatedAt: '2026-10-28T16:00:00Z',
  }),
  row('b', {
    displayName: 'Facility Operations',
    name: 'facility-operations',
    nodeCount: 23,
    updatedAt: '2026-10-23T10:00:00Z',
  }),
  row('c', { name: 'quick-pay-assistant', isRoot: false, environment: 'DEV', updatedAt: '2026-10-27T10:00:00Z' }),
  row('d', { name: 'never-saved' }),
];
const ids = (rows: AgentSummary[]) => rows.map((r) => r.agenticWorkflowId);

describe('the workflow list', () => {
  it('names a row by its display name, else its system name, else its ID', () => {
    expect(workflowLabel(ROWS[0])).toBe('Travel Concierge');
    expect(workflowLabel(ROWS[2])).toBe('quick-pay-assistant');
    expect(workflowLabel(row('x', { name: '' }))).toBe('x');
  });

  it('opens newest first; a workflow never saved is last', () => {
    expect(ids(visibleRows(ROWS, '', DEFAULT_SORT))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('searches the display name, system name, ID and environment, ignoring case', () => {
    expect(ids(visibleRows(ROWS, 'concierge', DEFAULT_SORT))).toEqual(['a']);
    expect(ids(visibleRows(ROWS, 'QUICK-PAY', DEFAULT_SORT))).toEqual(['c']);
    expect(ids(visibleRows(ROWS, 'dev', DEFAULT_SORT))).toEqual(['c']);
    expect(visibleRows(ROWS, 'nothing like this', DEFAULT_SORT)).toEqual([]);
  });

  it('sorts by a column ascending, then descending when clicked again', () => {
    const byNodes = nextSort(DEFAULT_SORT, 'nodeCount');
    expect(byNodes).toEqual({ field: 'nodeCount', descending: false });
    // c and d tie on node count: ties keep the name order (never-saved, quick-pay-assistant).
    expect(ids(visibleRows(ROWS, '', byNodes))).toEqual(['d', 'c', 'a', 'b']);
    expect(ids(visibleRows(ROWS, '', nextSort(byNodes, 'nodeCount')))).toEqual(['b', 'a', 'd', 'c']);
    expect(ids(visibleRows(ROWS, '', { field: 'displayName', descending: false }))).toEqual([
      'b',
      'd',
      'c',
      'a',
    ]);
  });

  it('pages twenty rows at a time; a page past the end shows the last page', () => {
    const many = Array.from({ length: 45 }, (_, i) => i);
    expect(pageCount(many.length)).toBe(3);
    expect(pageCount(0)).toBe(1);
    expect(pageOf(many, 1)).toHaveLength(20);
    expect(pageOf(many, 3)).toEqual([40, 41, 42, 43, 44]);
    expect(pageOf(many, 9)).toEqual([40, 41, 42, 43, 44]);
  });
});
