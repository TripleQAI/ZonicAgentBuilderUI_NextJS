import { describe, expect, it } from 'vitest';

import { FIELD_COMPONENTS, resolveFieldComponent } from './index';

/**
 * The registry must cover every widget type the node registry can declare.
 * This list is the `_buildField` switch from the source's dynamic_fields.js —
 * if the backend adds a type the UI has not implemented, this fails here rather
 * than rendering a silently wrong control in production.
 */
const SOURCE_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'switch',
  'select',
  'node_select',
  'node_multiselect',
  'multi_select',
  'code',
  'markdown',
  'json',
  'variable_reference',
  'target_reference',
  'expression',
  'view_template',
  'key_value_list',
  'message_list',
  'mapping_list',
  'state_update_list',
  'tool_list',
  'condition_builder',
  'schema_builder',
  'query_var_list',
  'agentic_workflow_selector',
  'relationship_status',
];

describe('field component registry', () => {
  it.each(SOURCE_FIELD_TYPES)('has a component for %s', (type) => {
    expect(FIELD_COMPONENTS[type]).toBeTypeOf('function');
  });

  it('covers exactly the source widget set, with no extras', () => {
    expect(Object.keys(FIELD_COMPONENTS).sort()).toEqual([...SOURCE_FIELD_TYPES].sort());
  });

  it('falls back to text for an unknown type, as the source default case did', () => {
    expect(resolveFieldComponent('something_new')).toBe(FIELD_COMPONENTS.text);
  });
});
