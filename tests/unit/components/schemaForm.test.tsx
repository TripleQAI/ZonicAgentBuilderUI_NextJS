import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { SchemaForm } from '@/components/properties/SchemaForm';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { AgentDocument, WorkflowNode } from '@/types/agent';
import type { NodeTypeDef } from '@/types/registry';

/**
 * The properties panel is generated entirely from the node type's form schema —
 * this component is the generator. It is the one piece of UI worth a render
 * test, because a mistake here misconfigures every node type at once rather
 * than breaking something visible.
 */

const DEFINITION: NodeTypeDef = {
  type: 'llm',
  label: 'LLM',
  icon: '',
  color: '',
  description: '',
  defaultNamePrefix: 'LLM',
  defaultConfig: {},
  handles: {},
  formSchema: {
    sections: [
      {
        title: 'Definition',
        fields: [
          {
            key: 'config.model',
            label: 'Model',
            type: 'select',
            required: true,
            options: [
              { value: 'claude-sonnet-4-6', label: 'Sonnet' },
              { value: 'claude-haiku-4-5', label: 'Haiku' },
            ],
          },
          { key: 'config.systemPrompt', label: 'System Prompt', type: 'textarea' },
        ],
      },
      {
        type: 'accordion',
        label: 'Advanced',
        defaultOpen: false,
        fields: [{ key: 'config.maxTokens', label: 'Max Tokens', type: 'number' }],
      },
    ],
  },
  outputSchema: {},
  validationSchema: {},
  sortOrder: 2,
};

const NODE: WorkflowNode = {
  id: 'llm_1',
  type: 'llm',
  name: 'LLM_1',
  config: { model: 'claude-sonnet-4-6', systemPrompt: 'You are helpful.' },
  position: { x: 0, y: 0 },
};

const DOCUMENT: AgentDocument = {
  agenticWorkflowId: 'wf-1',
  name: 'demo',
  nodes: [NODE],
  edges: [],
};

const store = () => useWorkflowStore.getState();
const storedNode = () => store().currentAgent!.nodes[0];

beforeEach(() => {
  useWorkflowStore.setState({ nodeRegistry: [DEFINITION] });
  store().loadAgent(structuredClone(DOCUMENT));
  store().selectNode('llm_1');
});

describe('rendering from the schema', () => {
  it('renders a control per declared field', () => {
    render(<SchemaForm node={storedNode()} />);

    expect(screen.getByLabelText(/Model/)).toBeInTheDocument();
    expect(screen.getByLabelText(/System Prompt/)).toBeInTheDocument();
  });

  it('seeds each control from the node', () => {
    render(<SchemaForm node={storedNode()} />);

    expect(screen.getByLabelText(/Model/)).toHaveValue('claude-sonnet-4-6');
    expect(screen.getByLabelText(/System Prompt/)).toHaveValue('You are helpful.');
  });

  it('shows a section title and marks a required field', () => {
    const { container } = render(<SchemaForm node={storedNode()} />);

    expect(screen.getByText('Definition')).toBeInTheDocument();
    expect(container.querySelector('.text-danger')).toBeInTheDocument();
  });

  it('keeps a collapsed accordion closed until it is opened', async () => {
    render(<SchemaForm node={storedNode()} />);

    // defaultOpen is false, so the field inside is not mounted yet.
    expect(screen.queryByLabelText(/Max Tokens/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Advanced'));
    expect(screen.getByLabelText(/Max Tokens/)).toBeInTheDocument();
  });

  it('says so when the registry has no entry for the node type', () => {
    render(<SchemaForm node={{ ...storedNode(), type: 'mystery' }} />);
    expect(screen.getByText(/No registry entry/)).toBeInTheDocument();
  });
});

describe('writing edits back', () => {
  it('stores an edit at the field key as a dot-path', async () => {
    render(<SchemaForm node={storedNode()} />);

    await userEvent.selectOptions(screen.getByLabelText(/Model/), 'claude-haiku-4-5');

    // config.model, not a flat "config.model" key.
    expect((storedNode().config as { model: string }).model).toBe('claude-haiku-4-5');
  });

  it('marks the workflow unsaved', async () => {
    render(<SchemaForm node={storedNode()} />);
    expect(store().isDirty).toBe(false);

    await userEvent.selectOptions(screen.getByLabelText(/Model/), 'claude-haiku-4-5');

    expect(store().isDirty).toBe(true);
  });

  it('leaves the other fields untouched', async () => {
    render(<SchemaForm node={storedNode()} />);

    await userEvent.selectOptions(screen.getByLabelText(/Model/), 'claude-haiku-4-5');

    expect((storedNode().config as { systemPrompt: string }).systemPrompt).toBe(
      'You are helpful.',
    );
  });
});
