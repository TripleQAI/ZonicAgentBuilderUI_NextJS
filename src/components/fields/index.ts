/**
 * FIELD_COMPONENTS — the registry that replaces the 27-branch switch in
 * dynamic_fields.js (MIGRATION_PLAN.md §9.6).
 *
 * Adding a widget type is one entry here plus one component. Unknown types fall
 * back to text, exactly as the source's `default:` case did, so a registry that
 * declares a field type the UI has not implemented yet degrades instead of
 * crashing.
 */

import type { ComponentType } from 'react';

import {
  MultiSelectField,
  NodeMultiSelectField,
  NodeSelectField,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
  TextareaField,
} from '@/components/fields/basic';
import {
  CodeField,
  ExpressionField,
  JsonField,
  MarkdownField,
  TargetRefField,
  VariableRefField,
  ViewTemplateField,
} from '@/components/fields/editors';
import {
  ConditionBuilderField,
  KeyValueListField,
  MappingListField,
  MessageListField,
  QueryVarListField,
  SchemaBuilderField,
  StateUpdateListField,
  ToolListField,
} from '@/components/fields/lists';
import { AgentSelectorField, RelationshipStatusField } from '@/components/fields/relations';
import type { FieldProps } from '@/components/fields/primitives';

export const FIELD_COMPONENTS: Record<string, ComponentType<FieldProps>> = {
  text: TextField,
  textarea: TextareaField,
  number: NumberField,
  switch: SwitchField,
  select: SelectField,
  node_select: NodeSelectField,
  node_multiselect: NodeMultiSelectField,
  multi_select: MultiSelectField,
  code: CodeField,
  markdown: MarkdownField,
  json: JsonField,
  variable_reference: VariableRefField,
  target_reference: TargetRefField,
  expression: ExpressionField,
  view_template: ViewTemplateField,
  key_value_list: KeyValueListField,
  message_list: MessageListField,
  mapping_list: MappingListField,
  state_update_list: StateUpdateListField,
  tool_list: ToolListField,
  condition_builder: ConditionBuilderField,
  schema_builder: SchemaBuilderField,
  query_var_list: QueryVarListField,
  agentic_workflow_selector: AgentSelectorField,
  relationship_status: RelationshipStatusField,
};

export function resolveFieldComponent(type: string): ComponentType<FieldProps> {
  return FIELD_COMPONENTS[type] ?? TextField;
}

export type { FieldProps };
