/**
 * Localised strings. Replaces core/constants.py + the Django context processor;
 * adding a locale adds a file, not code.
 */
export const messages = {
  WORKFLOW_BUILDER: 'InSite Agent Workflow Builder',
  AGENT_EXPLORER: 'Agent Explorer',
  AGENT_LIBRARY: 'Agent Library',
  NODE_PROPERTIES: 'Node Properties',
  RELATIONSHIP_MAP: 'Relationship Map',
  VALIDATION_RESULT: 'Validation Result',
} as const;

export type MessageKey = keyof typeof messages;
