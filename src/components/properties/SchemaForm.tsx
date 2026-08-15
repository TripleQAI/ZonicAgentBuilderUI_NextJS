'use client';

import { useEffect, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { resolveFieldComponent } from '@/components/fields';
import { cn } from '@/lib/utils/cn';
import { setDotPath } from '@/lib/utils/dotPath';
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

/** Pushes every form change into the store as a dot-path patch. */
function FormSync({ node }: { node: WorkflowNode }) {
  const values = useWatch();
  const updateNodePath = useWorkflowStore((s) => s.updateNodePath);

  useEffect(() => {
    if (!values || typeof values !== 'object') return;
    // The form is flat by dot-path, so each top-level key is one patch.
    for (const [path, value] of Object.entries(values as Record<string, unknown>)) {
      updateNodePath(node.id, path, value);
    }
  }, [node.id, updateNodePath, values]);

  return null;
}

export function SchemaForm({ node }: { node: WorkflowNode }) {
  const definition = useWorkflowStore((s) => s.getNodeTypeDef(node.type));
  const sections = definition?.formSchema?.sections ?? [];

  // Seed react-hook-form with the node's current values, keyed by dot-path.
  const defaultValues: Record<string, unknown> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      const scratch: Record<string, unknown> = {};
      setDotPath(scratch, field.key, undefined);
      let cursor: unknown = node;
      for (const key of field.key.split('.')) {
        cursor =
          cursor && typeof cursor === 'object'
            ? (cursor as Record<string, unknown>)[key]
            : undefined;
      }
      defaultValues[field.key] = cursor ?? field.defaultValue ?? emptyFor(field.type);
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
        <FormSync node={node} />
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
