/**
 * Shared select-option lists, fetched from the backend.
 *
 * The source hard-coded these three times over — in `node_registry.py`, again
 * in `dynamic_fields.js` where each list widget built its own `<select>`, and a
 * third time in the page template. They now live in one JSON resource on the
 * server and are read from here, so adding an option is a one-line backend edit
 * with no frontend change at all.
 *
 * `useOptions` returns an empty array while the request is in flight, which
 * renders an empty `<select>` rather than a wrong one.
 */

'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export type Option = { value: string; label: string };
export type OptionSets = Record<string, Option[]>;

/** Keys the UI asks for. Named so a typo is a type error, not a silent empty list. */
export type OptionSetName =
  | 'mappingTypes'
  | 'stateOps'
  | 'schemaTypes'
  | 'messageRoles'
  | 'invocationTypes'
  | 'semanticDomains';

export function useOptionSets() {
  return useQuery({
    queryKey: ['option-sets'],
    queryFn: api.getOptionSets,
    // Reference data: fetch once and keep it for the session.
    staleTime: Infinity,
  });
}

export function useOptions(name: OptionSetName): Option[] {
  const { data } = useOptionSets();
  return data?.[name] ?? [];
}
