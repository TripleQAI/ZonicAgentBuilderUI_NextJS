'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { FlowCanvas } from '@/components/canvas/FlowCanvas';
import { DialogHost, type DialogName } from '@/components/dialogs/DialogHost';
import { AppHeader } from '@/components/layout/AppHeader';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { ReadOnlyBanner } from '@/components/layout/ReadOnlyBanner';
import { PropertiesPanel } from '@/components/properties/PropertiesPanel';
import { api } from '@/lib/api/client';
import { toAgentJson } from '@/lib/serialization/agentDocument';
import { useWorkflowStore } from '@/store/useWorkflowStore';

/**
 * The builder shell: header, sidebar, canvas, properties panel, dialogs.
 *
 * It owns the few actions that span more than one region — load, save, export —
 * and passes everything else down. Regions subscribe to the store directly, so
 * this component re-renders rarely.
 */
export function BuilderShell() {
  const [dialog, setDialog] = useState<DialogName | null>(null);

  const setNodeRegistry = useWorkflowStore((s) => s.setNodeRegistry);
  const loadAgent = useWorkflowStore((s) => s.loadAgent);
  const registerAgent = useWorkflowStore((s) => s.registerAgent);
  const setRelationshipMap = useWorkflowStore((s) => s.setRelationshipMap);
  const setRootId = useWorkflowStore((s) => s.setRootId);
  const markClean = useWorkflowStore((s) => s.markClean);
  const newAgent = useWorkflowStore((s) => s.newAgent);

  // The registry drives the palette, the canvas and every form, so it is the
  // one thing that must be loaded before anything else renders usefully.
  const registry = useQuery({
    queryKey: ['node-types'],
    queryFn: api.getNodeTypes,
  });

  useEffect(() => {
    if (registry.data) setNodeRegistry(registry.data);
  }, [registry.data, setNodeRegistry]);

  const agents = useQuery({ queryKey: ['agents'], queryFn: api.listAgents });

  const openAgent = useCallback(
    async (agenticWorkflowId: string, { asRoot = false } = {}) => {
      try {
        const document = await api.getAgent(agenticWorkflowId);
        loadAgent(document);
        if (asRoot) setRootId(agenticWorkflowId);
        try {
          const map = await api.getRelationships(agenticWorkflowId);
          setRelationshipMap(map);
          // Cache child summaries so Sub Flow nodes can label themselves.
          map.resolved.forEach((entry) => {
            if (entry.childAgent) {
              registerAgent({
                agenticWorkflowId: entry.childAgent.agenticWorkflowId,
                name: entry.childAgent.name,
                displayName: entry.childAgent.displayName,
              });
            }
          });
        } catch {
          setRelationshipMap(null);
        }
      } catch (error) {
        toast.error(`Could not load workflow: ${(error as Error).message}`);
      }
    },
    [loadAgent, registerAgent, setRelationshipMap, setRootId],
  );

  // Open the most recently updated workflow on first load, as the source did.
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => {
    if (bootstrapped || !agents.data) return;
    setBootstrapped(true);
    if (agents.data.length > 0) {
      const root = agents.data.find((a) => a.isRoot) ?? agents.data[0];
      void openAgent(root.agenticWorkflowId, { asRoot: true });
    } else {
      newAgent();
    }
  }, [agents.data, bootstrapped, newAgent, openAgent]);

  const save = useCallback(async () => {
    const agent = useWorkflowStore.getState().currentAgent;
    if (!agent) return;
    try {
      const result = await api.saveAgent(agent.agenticWorkflowId, toAgentJson(agent));
      markClean();
      toast.success(
        `Saved · ${result.nodeCount} nodes, ${result.edgeCount} edges, ` +
          `${result.relationshipCount} relationships`,
      );
      void agents.refetch();
      const map = await api.getRelationships(agent.agenticWorkflowId).catch(() => null);
      setRelationshipMap(map);
    } catch (error) {
      toast.error(`Save failed: ${(error as Error).message}`);
    }
  }, [agents, markClean, setRelationshipMap]);

  if (registry.isError) {
    return (
      <div className="grid h-screen place-items-center p-8 text-center">
        <div>
          <i className="bi-plug text-4xl text-danger" />
          <h1 className="mt-3 text-lg font-semibold">Cannot reach the API</h1>
          <p className="mt-1 max-w-md text-[13px] text-text-muted">
            {(registry.error as Error).message}. Start the backend on{' '}
            <code>{process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'}</code>{' '}
            and reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <AppHeader onOpenDialog={setDialog} onSave={save} agents={agents.data ?? []} onOpenAgent={openAgent} />
      <ReadOnlyBanner />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar agents={agents.data ?? []} onOpenAgent={openAgent} />
        <main className="min-w-0 flex-1">
          <FlowCanvas onOpenSubFlow={(childId) => void openAgent(childId)} />
        </main>
        <PropertiesPanel />
      </div>
      <DialogHost
        open={dialog}
        onClose={() => setDialog(null)}
        onImported={async (rootId) => {
          setDialog(null);
          await agents.refetch();
          await openAgent(rootId, { asRoot: true });
        }}
      />
    </div>
  );
}
