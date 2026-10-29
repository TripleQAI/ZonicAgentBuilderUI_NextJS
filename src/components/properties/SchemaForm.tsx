'use client';

import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { resolveFieldComponent } from '@/components/fields';
import { cn } from '@/lib/utils/cn';
import { getDotPath, setDotPath } from '@/lib/utils/dotPath';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { WorkflowNode } from '@/types/agent';
import type { FormField, FormSection } from '@/types/registry';

/**
 * The entire properties form renderer.
 *
 * Around seventy lines replace 1,760 in dynamic_fields.js. Two things make that
 * possible: `field.key` is already a dot-path, so it doubles as the
 * react-hook-form field name and no get/set plumbing is needed; and the widget
 * lookup is a registry rather than a switch.
 */

/** Paths whose value changes the form's own shape, so the tree must re-render.
 *  Same list the source watched in `_REFRESH_PATHS`. */
const RESHAPING_PATHS = ['config.rules', 'config.toolType', 'config.responseFormat'];

function FieldRenderer({ field }: { field: FormField }) {
  const Component = resolveFieldComponent(field.type);
  return <Component field={field} name={field.key} />;
}

function SectionRenderer({ section }: { section: FormSection }) {
  const isAccordion = section.type === 'accordion';
  const [open, setOpen] = useState(!isAccordion || Boolean(section.defaultOpen));
  const title = section.title ?? section.label ?? '';

  if (!isAccordion) {
    return (
      <div className="border-b border-border px-3 py-3">
        {title && <div className="prop-section-title">{title}</div>}
        {section.fields.map((field) => (
          <FieldRenderer key={field.key} field={field} />
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-border">
      <button
        type="button"
        className="readonly-allowed flex w-full items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
        data-accordion-open={open}
      >
        <span className="prop-section-title mb-0">{title}</span>
        <i
          className={cn(
            'bi-chevron-down text-[10px] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="px-3 pb-3">
          {section.fields.map((field) => (
            <FieldRenderer key={field.key} field={field} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Pushes form changes into the store as dot-path patches, one per form field. */
function FormSync({ node, paths }: { node: WorkflowNode; paths: string[] }) {
  const values = useWatch();
  const updateNodePath = useWorkflowStore((s) => s.updateNodePath);
  /** What the store already holds, so only real edits are written. */
  const synced = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    if (!values || typeof values !== 'object') return;
    const current = Object.fromEntries(paths.map((path) => [path, getDotPath(values, path)]));

    // First pass is the form seeding itself from the node. Writing then would
    // mark the workflow unsaved just for opening a node, and the "unsaved
    // changes" dot would appear without the user touching anything.
    if (synced.current === null) {
      synced.current = Object.fromEntries(
        Object.entries(current).map(([path, value]) => [path, JSON.stringify(value ?? null)]),
      );
      return;
    }

    // Each field's dot-path is one patch. Only the ones that actually changed
    // are pushed — a keystroke in one field must not rewrite every other field.
    for (const [path, value] of Object.entries(current)) {
      const encoded = JSON.stringify(value ?? null);
      if (synced.current[path] === encoded) continue;
      synced.current[path] = encoded;
      updateNodePath(node.id, path, value);
    }
  }, [node.id, paths, updateNodePath, values]);

  return null;
}

export function SchemaForm({ node }: { node: WorkflowNode }) {
  const definition = useWorkflowStore((s) => s.getNodeTypeDef(node.type));
  const sections = definition?.formSchema?.sections ?? [];

  // Seed react-hook-form with the node's current values, nested by dot-path:
  // react-hook-form reads a name such as `config.messages.0.content` as a path,
  // so a list row's inputs only find their values in a nested object.
  const defaultValues: Record<string, unknown> = {};
  const paths: string[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      paths.push(field.key);
      const value = getDotPath(node, field.key);
      setDotPath(defaultValues, field.key, value ?? field.defaultValue ?? emptyFor(field.type));
    }
  }

  const methods = useForm({ defaultValues, mode: 'onChange' });
  const reshaping = useWatch({ control: methods.control, name: RESHAPING_PATHS });

  if (!definition) {
    return (
      <div className="p-3 text-[12px] text-text-muted">
        No registry entry for node type <code>{node.type}</code>.
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={(event) => event.preventDefault()}>
        <FormSync node={node} paths={paths} />
        {sections.map((section, index) => (
          <SectionRenderer
            // Re-key on the reshaping values so a rule-branch change rebuilds
            // the dependent parts of the form, as the source's refresh did.
            key={`${section.title ?? section.label ?? index}-${String(reshaping)}`}
            section={section}
          />
        ))}
      </form>
    </FormProvider>
  );
}

function emptyFor(type: string): unknown {
  if (type.endsWith('_list') || type === 'schema_builder' || type === 'condition_builder') {
    return [];
  }
  if (type === 'json') return {};
  if (type === 'switch') return false;
  if (type === 'number') return undefined;
  if (type === 'node_multiselect' || type === 'multi_select') return [];
  return '';
}
