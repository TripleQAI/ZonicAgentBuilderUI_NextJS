import { describe, expect, it } from 'vitest';

import { groupNodeTypes } from '@/lib/registry/nodeCategories';
import type { Option } from '@/lib/registry/optionSets';
import type { NodeTypeDef } from '@/types/registry';

/**
 * Palette grouping. The rule that matters is that nothing can fall out of the
 * palette: a node type whose category is missing, empty or unrecognised still
 * has to appear somewhere, because a silently absent node type looks like the
 * registry failed to load.
 */

const CATEGORIES: Option[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' },
];

const type = (name: string, category?: string): NodeTypeDef =>
  ({ type: name, label: name.toUpperCase(), category }) as NodeTypeDef;

const shape = (types: NodeTypeDef[], categories = CATEGORIES) =>
  groupNodeTypes(types, categories).map((group) => [
    group.label,
    group.types.map((t) => t.type),
  ]);

describe('grouping node types', () => {
  it('files each type under its declared category', () => {
    expect(shape([type('llm', 'basic'), type('mesh', 'advanced')])).toEqual([
      ['Basic', ['llm']],
      ['Advanced', ['mesh']],
    ]);
  });

  it('keeps a declared category that has nothing in it', () => {
    // This is what makes a group reserved for later visible at all.
    expect(shape([type('llm', 'basic')])).toEqual([
      ['Basic', ['llm']],
      ['Advanced', []],
    ]);
  });

  it('follows the order the option set gives, not the order of the types', () => {
    const reversed = [...CATEGORIES].reverse();
    expect(shape([type('llm', 'basic')], reversed).map(([label]) => label)).toEqual([
      'Advanced',
      'Basic',
    ]);
  });

  it.each([
    ['no category', undefined],
    ['an empty category', ''],
    ['an unrecognised category', 'experimental'],
  ])('puts a type with %s in the first group rather than dropping it', (_label, category) => {
    expect(shape([type('llm', category)])).toEqual([
      ['Basic', ['llm']],
      ['Advanced', []],
    ]);
  });

  it('preserves registry order within a group', () => {
    const types = [type('c', 'basic'), type('a', 'basic'), type('b', 'basic')];
    expect(shape(types)).toEqual([
      ['Basic', ['c', 'a', 'b']],
      ['Advanced', []],
    ]);
  });

  it('groups nothing while the option set is still loading', () => {
    // useOptions returns [] until the request lands; rendering one unlabelled
    // group of everything and then reflowing would be worse than a blank beat.
    expect(groupNodeTypes([type('llm', 'basic')], [])).toEqual([]);
  });
});
