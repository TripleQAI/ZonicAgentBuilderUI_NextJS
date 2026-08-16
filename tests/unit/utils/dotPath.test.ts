import { describe, expect, it } from 'vitest';

import { getDotPath, setDotPath } from '@/lib/utils/dotPath';

/**
 * Dot-paths are the spine of the schema-driven forms: a field's `key`
 * ("config.model") is simultaneously its react-hook-form name, the place its
 * value is read from, and the place edits are written back to. Everything in
 * the properties panel depends on these two functions behaving.
 */

describe('getDotPath', () => {
  const node = {
    id: 'n1',
    config: { model: 'claude', nested: { deep: { value: 42 } }, list: [1, 2, 3] },
  };

  it('reads a top-level key', () => {
    expect(getDotPath(node, 'id')).toBe('n1');
  });

  it('reads through several levels', () => {
    expect(getDotPath(node, 'config.nested.deep.value')).toBe(42);
  });

  it('returns arrays and objects intact', () => {
    expect(getDotPath(node, 'config.list')).toEqual([1, 2, 3]);
  });

  it('returns undefined for a path that does not exist', () => {
    expect(getDotPath(node, 'config.missing')).toBeUndefined();
    expect(getDotPath(node, 'config.missing.deeper')).toBeUndefined();
  });

  it('stops at a non-object rather than throwing', () => {
    expect(getDotPath(node, 'config.model.length')).toBeUndefined();
  });

  it('handles null and undefined input', () => {
    expect(getDotPath(null, 'a.b')).toBeUndefined();
    expect(getDotPath(undefined, 'a')).toBeUndefined();
  });
});

describe('setDotPath', () => {
  it('writes a top-level key', () => {
    const target: Record<string, unknown> = {};
    setDotPath(target, 'name', 'Start');
    expect(target).toEqual({ name: 'Start' });
  });

  it('creates the intermediate objects it needs', () => {
    const target: Record<string, unknown> = {};
    setDotPath(target, 'config.retry.attempts', 3);
    expect(target).toEqual({ config: { retry: { attempts: 3 } } });
  });

  it('overwrites without disturbing its siblings', () => {
    const target: Record<string, unknown> = { config: { model: 'a', temperature: 0.7 } };
    setDotPath(target, 'config.model', 'b');
    expect(target.config).toEqual({ model: 'b', temperature: 0.7 });
  });

  it('replaces a non-object standing in the way', () => {
    // A field whose value used to be a scalar and is now a group.
    const target: Record<string, unknown> = { config: 'not-an-object' };
    setDotPath(target, 'config.model', 'x');
    expect(target).toEqual({ config: { model: 'x' } });
  });

  it('stores arrays and objects by reference', () => {
    const target: Record<string, unknown> = {};
    const rules = [{ ruleId: 'r1' }];
    setDotPath(target, 'config.rules', rules);
    expect(getDotPath(target, 'config.rules')).toBe(rules);
  });

  it('can write undefined, which is how a field is cleared', () => {
    const target: Record<string, unknown> = { config: { model: 'a' } };
    setDotPath(target, 'config.model', undefined);
    expect((target.config as Record<string, unknown>).model).toBeUndefined();
  });
});

describe('round trip', () => {
  it('reads back exactly what was written, at any depth', () => {
    const target: Record<string, unknown> = {};
    const cases: [string, unknown][] = [
      ['config.model', 'claude-sonnet-4-6'],
      ['config.messages', [{ role: 'user', content: 'hi' }]],
      ['config.advanced.temperature', 0.2],
      ['config.advanced.tools.0.name', 'search'],
    ];
    for (const [path, value] of cases) setDotPath(target, path, value);
    for (const [path, value] of cases) expect(getDotPath(target, path)).toEqual(value);
  });
});
