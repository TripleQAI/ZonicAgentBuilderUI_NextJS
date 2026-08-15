/**
 * Node registry types.
 *
 * These mirror what `GET /api/v1/node-types` returns. The registry drives the
 * palette, the canvas nodes and every properties form, so it is the most
 * important contract in the UI: adding a node type must stay a data-only change.
 */

export interface FormField {
  /** Dot-path relative to the node root, e.g. "config.model". Doubles as the
   *  react-hook-form field name, which is what removes all path plumbing. */
  key: string;
  label?: string;
  type: string;
  required?: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  rows?: number;
  min?: number;
  max?: number;
  step?: number;
  language?: string;
  addLabel?: string;
  placeholderKey?: string;
  placeholderVal?: string;
  showType?: boolean;
  [extra: string]: unknown;
}

export interface FormSection {
  /** Plain sections use `title`; accordions use `type: "accordion"` + `label`. */
  title?: string;
  label?: string;
  type?: 'accordion';
  defaultOpen?: boolean;
  fields: FormField[];
}

export interface HandleDef {
  id: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  label?: string;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  defaultNamePrefix: string;
  defaultConfig: Record<string, unknown>;
  handles: { sources?: HandleDef[]; targets?: HandleDef[] };
  formSchema: { sections?: FormSection[] };
  outputSchema: Record<string, unknown>;
  validationSchema: { rules?: unknown[] };
  sortOrder: number;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  toolType: 'function' | 'handoff' | 'ui_view' | 'mcp' | string;
  schema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
}
