import { describe, expect, it } from 'vitest';

import {
  duplicateNames,
  newRow,
  toRows,
  toVariables,
  type FlowVariableRow,
} from '@/lib/agent/flowVariables';

/**
 * The flow variable editor's translation between the stored object and the rows
 * it edits. Worth testing because both directions are lossy if written
 * carelessly: the stored shape is keyed by name, so a duplicate silently drops
 * a variable, and rebuilding a definition from the four displayed fields
 * discards anything else it carried.
 */

const row = (over: Partial<FlowVariableRow> = {}): FlowVariableRow => ({
  ...newRow('string'),
  name: 'tenantId',
  ...over,
});

describe('reading stored variables', () => {
  it('reads the four displayed fields', () => {
    const rows = toRows({
      tenantId: { type: 'string', default: 'FSH', description: 'Which tenant' },
    });

    expect(rows).toEqual([
      { name: 'tenantId', type: 'string', default: 'FSH', description: 'Which tenant', rest: {} },
    ]);
  });

  it('falls back to the given type when the definition has none', () => {
    expect(toRows({ tenantId: {} }, 'string')[0].type).toBe('string');
  });

  it('keeps a type the option set does not list', () => {
    // Serving a shorter list must not rewrite a document that predates it.
    expect(toRows({ x: { type: 'geojson' } }, 'string')[0].type).toBe('geojson');
  });

  it('renders a non-string default as text, since the editor is one input', () => {
    expect(toRows({ retries: { type: 'integer', default: 0 } })[0].default).toBe('0');
    expect(toRows({ on: { type: 'boolean', default: false } })[0].default).toBe('false');
  });

  it('treats a bare value as the default rather than dropping it', () => {
    // `{ "x": "hello" }` instead of `{ "x": { "type": ... } }`.
    expect(toRows({ greeting: 'hello' }, 'string')).toEqual([
      { name: 'greeting', type: 'string', default: 'hello', description: '', rest: {} },
    ]);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', [] as unknown],
  ])('returns no rows for %s', (_label, input) => {
    expect(toRows(input as Record<string, unknown> | null | undefined)).toEqual([]);
  });
});

describe('writing rows back', () => {
  it('keys the object by name', () => {
    expect(toVariables([row({ default: 'FSH' })])).toEqual({
      tenantId: { type: 'string', default: 'FSH' },
    });
  });

  it('omits an empty default and description rather than storing ""', () => {
    expect(toVariables([row()])).toEqual({ tenantId: { type: 'string' } });
  });

  it('drops a row with no name', () => {
    expect(toVariables([row({ name: '  ' })])).toEqual({});
  });

  it('trims the name', () => {
    expect(Object.keys(toVariables([row({ name: '  spaced  ' })]))).toEqual(['spaced']);
  });

  it('preserves definition keys the editor does not show', () => {
    // Regression: the source rebuilt each definition from its four inputs, so
    // opening the drawer and saving discarded anything else — an enum's values,
    // a required flag — with no error anywhere.
    const stored = {
      status: { type: 'enum', enumValues: ['new', 'done'], required: true, default: 'new' },
    };

    expect(toVariables(toRows(stored))).toEqual(stored);
  });

  it('lets an edited field win over the stored one', () => {
    const [original] = toRows({ tenantId: { type: 'string', default: 'FSH' } });

    expect(toVariables([{ ...original, type: 'integer' }])).toEqual({
      tenantId: { type: 'integer', default: 'FSH' },
    });
  });

  it('round-trips an untouched document', () => {
    const stored = {
      tenantId: { type: 'string', default: 'FSH', description: 'Which tenant' },
      retries: { type: 'integer' },
    };

    expect(toVariables(toRows(stored))).toEqual(stored);
  });
});

describe('duplicate names', () => {
  it('reports a name used twice', () => {
    expect(duplicateNames([row(), row()])).toEqual(['tenantId']);
  });

  it('reports each clashing name once, in order of first appearance', () => {
    const rows = [row({ name: 'b' }), row({ name: 'a' }), row({ name: 'b' }), row({ name: 'a' })];
    expect(duplicateNames(rows)).toEqual(['b', 'a']);
  });

  it('compares trimmed names, since saving trims them', () => {
    expect(duplicateNames([row(), row({ name: ' tenantId ' })])).toEqual(['tenantId']);
  });

  it('ignores unnamed rows, which are dropped anyway', () => {
    expect(duplicateNames([row({ name: '' }), row({ name: '' })])).toEqual([]);
  });

  it('finds nothing in a valid set', () => {
    expect(duplicateNames([row({ name: 'a' }), row({ name: 'b' })])).toEqual([]);
  });
});
