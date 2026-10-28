/**
 * Agent and canvas types.
 *
 * The node/edge shapes are the ones stored in the database and exported to
 * agent.json — React Flow consumes them almost unchanged, which is why the
 * canvas needed no data translation layer.
 */

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  position: Position;
  positionAbsolute?: Position;
  config: Record<string, unknown>;
  /** The container (swarm) this node is a member of; its position is then relative to it. */
  parentId?: string;
  properties?: Record<string, unknown>;
  variableUpdates?: unknown[];
  selected?: boolean;
  dragging?: boolean;
  deletable?: boolean;
  width?: number;
  height?: number;
  style?: Record<string, unknown>;
  [extra: string]: unknown;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: {
    sourceType?: string | null;
    targetType?: string | null;
    /** The user-dragged bezier bend. Persisted with the edge. */
    offset?: Position;
    /** Marks the wire as the visible half of an Agent's config.handoffTarget,
     *  so deleting it also removes the target. Set by the source app too. */
    handoff?: boolean;
  };
  style?: Record<string, unknown>;
  selected?: boolean;
  deletable?: boolean;
  [extra: string]: unknown;
}

export interface SystemParam {
  name: string;
  value?: string;
  description?: string;
}

/** The in-editor working copy of an agent. */
export interface AgentDraft {
  agenticWorkflowId: string;
  name: string;
  displayName: string;
  description: string;
  bpc: string;
  editAs: string;
  invocationType: string;
  isDisabled: boolean;
  isAvailableForMigration: boolean;
  enableForAutoInvoke: boolean;
  includeThoughts: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  interface: Record<string, unknown>;
  skills: unknown[];
  publishChannels: unknown[];
  security: Record<string, unknown>;
  /** The complete original document. Unknown keys must survive a round trip. */
  rawJson: Record<string, unknown>;
  semanticSearchEnabled: boolean;
  semanticDomain: string;
  semanticKeywords: string;
  semanticUseCases: string;
  systemParams: SystemParam[];
}

export interface AgentSummary {
  agenticWorkflowId: string;
  name: string;
  displayName: string;
  isRoot: boolean;
  nodeCount: number;
  edgeCount: number;
  environment: string;
  updatedAt: string | null;
}

export interface ChildAgentRef {
  agenticWorkflowId: string;
  name: string;
  displayName: string;
  nodeCount: number;
  edgeCount: number;
}

export interface RelationshipEntry {
  sourceNodeId: string;
  sourceNodeName: string;
  childAgenticWorkflowId: string;
  isResolved: boolean;
  childAgent?: ChildAgentRef | null;
  validationMessage?: string | null;
}

export interface RelationshipMap {
  rootAgentId: string;
  rootAgentName: string;
  resolvedCount: number;
  unresolvedCount: number;
  resolved: RelationshipEntry[];
  unresolved: RelationshipEntry[];
  unreferencedSubAgents: { agenticWorkflowId: string; name: string; displayName: string }[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  node_count: number;
  edge_count: number;
}

export interface ImportResult {
  root_agent_id: string;
  sub_agent_ids: string[];
  relationship_count: number;
  warnings: string[];
  parent_package_id: string;
}

export interface SaveResult {
  status: string;
  agenticWorkflowId: string;
  relationshipCount: number;
  nodeCount: number;
  edgeCount: number;
}

/** The raw JSON document as stored/exported — an agent plus arbitrary extras. */
export type AgentDocument = Record<string, unknown>;
