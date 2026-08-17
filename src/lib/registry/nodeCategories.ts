/**
 * Palette grouping.
 *
 * The groups and their order come from the `nodeCategories` option set, and
 * each node type carries the group it belongs to. Neither is declared here, so
 * adding a group — or moving a node into one — is a backend edit.
 */

import type { Option } from '@/lib/registry/optionSets';
import type { NodeTypeDef } from '@/types/registry';

export interface NodeGroup {
  value: string;
  label: string;
  types: NodeTypeDef[];
}

/**
 * Node types under their declared group, in the order the option set gives.
 *
 * A declared group with nothing in it is kept — that is how a group reserved
 * for later shows up at all. A node type whose category is missing or unknown
 * goes into the first group rather than disappearing, since a palette that
 * silently omits a node type is worse than one that files it oddly.
 */
export function groupNodeTypes(
  types: NodeTypeDef[],
  categories: Option[],
): NodeGroup[] {
  if (categories.length === 0) return [];

  const groups: NodeGroup[] = categories.map((category) => ({
    value: category.value,
    label: category.label,
    types: [],
  }));
  const byValue = new Map(groups.map((group) => [group.value, group]));

  for (const definition of types) {
    (byValue.get(definition.category ?? '') ?? groups[0]).types.push(definition);
  }

  return groups;
}
