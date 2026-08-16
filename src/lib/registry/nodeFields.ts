/**
 * Finding a field in a node type's form schema by what kind of editor it uses.
 *
 * Some editors are more than a control: `node_multiselect` is the handoff
 * editor, and each entry it holds is also a wire on the canvas. Code outside
 * the form needs to know where that list lives — the canvas, to draw a handle
 * per target; the store, to drop a target when its wire is deleted.
 *
 * The registry already answers that: the field's own `key` is the dot-path.
 * Looking it up beats naming `config.handoffTarget` in three places, and it
 * keeps working if the schema ever moves the field.
 */

import type { FormField, NodeTypeDef } from '@/types/registry';

/** The editor that manages handoff targets. One per agent-like node type. */
export const HANDOFF_FIELD_TYPE = 'node_multiselect';

export function findFieldByType(
  definition: NodeTypeDef | undefined,
  fieldType: string,
): FormField | undefined {
  for (const section of definition?.formSchema?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.type === fieldType) return field;
    }
  }
  return undefined;
}

/**
 * Dot-path to a node type's handoff-target list, or undefined when that type
 * has no handoff editor (which is most of them).
 */
export function handoffPathFor(definition: NodeTypeDef | undefined): string | undefined {
  return findFieldByType(definition, HANDOFF_FIELD_TYPE)?.key;
}
