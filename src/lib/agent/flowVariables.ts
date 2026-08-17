/**
 * Flow variables: the stored shape ⇄ the editor's rows.
 *
 * A workflow stores variables as an object keyed by name, each value a
 * definition — `{ "tenantId": { "type": "string", "default": "FSH" } }` — while
 * the editor needs an ordered list it can append to and reorder. These two
 * functions are that translation, kept out of the component so the rules are
 * testable on their own.
 *
 * The source's `_rowsToVars` rebuilt each definition from the four fields it
 * displayed, which silently dropped anything else the definition carried. Here
 * the unrecognised keys are held on the row and written back, the same overlay
 * rule `toAgentJson` follows for the document as a whole.
 */

/** The four fields the editor surfaces, plus whatever it does not understand. */
export interface FlowVariableRow {
  name: string;
  type: string;
  /** Held as text: the editor is one input, so `0` and `"0"` are the same keystroke. */
  default: string;
  description: string;
  /** Definition keys the editor does not show, preserved across a save. */
  rest: Record<string, unknown>;
}

const EDITED_KEYS = ['type', 'default', 'description'];

export function newRow(type: string): FlowVariableRow {
  return { name: '', type, default: '', description: '', rest: {} };
}

/** Stored object → editor rows. `fallbackType` fills a definition without one. */
export function toRows(
  variables: Record<string, unknown> | undefined | null,
  fallbackType = '',
): FlowVariableRow[] {
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return [];

  return Object.entries(variables).map(([name, definition]) => {
    // A bare value rather than a definition object — `{ "x": "hello" }`. Read it
    // as the default so opening the editor does not discard it.
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      return {
        name,
        type: fallbackType,
        default: definition == null ? '' : String(definition),
        description: '',
        rest: {},
      };
    }

    const record = definition as Record<string, unknown>;
    const rest = Object.fromEntries(
      Object.entries(record).filter(([key]) => !EDITED_KEYS.includes(key)),
    );

    return {
      name,
      type: typeof record.type === 'string' ? record.type : fallbackType,
      default: record.default == null ? '' : String(record.default),
      description: typeof record.description === 'string' ? record.description : '',
      rest,
    };
  });
}

/** Editor rows → stored object. Unnamed rows are dropped, as the source did. */
export function toVariables(rows: FlowVariableRow[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;

    // Unknown keys first, so an edited field always wins over its stored value.
    const definition: Record<string, unknown> = { ...row.rest, type: row.type };
    // Empty is absent, not an empty string — the source omitted both, and an
    // empty default would otherwise read as a deliberate "".
    if (row.default !== '') definition.default = row.default;
    if (row.description !== '') definition.description = row.description;

    out[name] = definition;
  }

  return out;
}

/**
 * Names used more than once, in order of first appearance.
 *
 * Saving cannot merge them: the stored shape is keyed by name, so the last row
 * would silently win and the earlier one would vanish.
 */
export function duplicateNames(rows: FlowVariableRow[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) continue;
    if (seen.has(name)) {
      if (!duplicates.includes(name)) duplicates.push(name);
    } else {
      seen.add(name);
    }
  }

  return duplicates;
}
