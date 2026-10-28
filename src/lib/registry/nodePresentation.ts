/**
 * Presentation fallbacks for a node type the registry does not describe.
 *
 * One definition instead of the same literals repeated in RegistryNode,
 * FlowCanvas, LeftSidebar and PropertiesPanel — where a change to the fallback
 * colour previously meant four edits and a chance to miss one.
 */

import type { DerivedHandle } from '@/lib/registry/nodeHandles';
import type { NodeTypeDef } from '@/types/registry';

/** Matches the grey the source used for an unknown node type. */
export const FALLBACK_NODE_COLOR = '#6b7280';
export const FALLBACK_NODE_ICON = 'bi-circle';
/** Shown by the properties panel when nothing is selected — its rail and its
 *  header. Deliberately not `bi-diagram-3`: that is the Relationship Map
 *  button, so on the rail it read as that rather than as agent settings. */
export const AGENT_SETTINGS_ICON = 'bi-sliders';

/** Handle ring colour by kind: plain, a Rule branch, or an Agent handoff. */
export const HANDLE_COLORS: Record<DerivedHandle['kind'], string> = {
  default: 'var(--node-select)',
  branch: 'var(--warning)',
  handoff: 'var(--accent-2)',
};

export function nodeColor(definition?: NodeTypeDef | null): string {
  return definition?.color || FALLBACK_NODE_COLOR;
}

export function nodeIcon(definition?: NodeTypeDef | null): string {
  return definition?.icon || FALLBACK_NODE_ICON;
}
