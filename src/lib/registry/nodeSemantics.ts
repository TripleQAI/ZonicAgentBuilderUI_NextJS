/**
 * Structural roles per node type, served from /api/v1/node-semantics.
 *
 * The same declaration the backend reads, so the canvas and the relationship
 * resolver cannot disagree about which node type points at a child, hands off,
 * or fans out into branches.
 */

'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export interface BranchSpec {
  /** Dot-path to the array of branches, e.g. "config.rules". */
  path: string;
  /** Key within a branch that identifies it, e.g. "ruleId". */
  idField: string;
}

export interface NodeSemantics {
  /** node type -> dot-path holding the child workflow id. */
  childReference?: Record<string, string>;
  /** node type -> dot-path holding sibling node ids to hand off to. */
  handoffTargets?: Record<string, string>;
  /** node type -> where its branches live. */
  branches?: Record<string, BranchSpec>;
}

export const EMPTY_SEMANTICS: NodeSemantics = {};

export function useNodeSemantics(): NodeSemantics {
  const { data } = useQuery({
    queryKey: ['node-semantics'],
    queryFn: api.getNodeSemantics,
    staleTime: Infinity,
  });
  return data ?? EMPTY_SEMANTICS;
}
