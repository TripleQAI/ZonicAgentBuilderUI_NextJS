# Zonic Agent Builder — UI (Next.js) V2

Visual orchestration editor for multi-agent AI workflows. Replaces the
server-rendered jQuery page from the Django monolith with a Next.js App Router
client that talks to
[ZonicAgentBuilderServer_FastAPI](../ZonicAgentBuilderServer_FastAPI) over JSON.

See [MIGRATION_PLAN.md](../MIGRATION_PLAN.md) §9 for the design.

---

## Setup

```powershell
npm install
copy .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev                          # http://localhost:3000/builder
```

The backend must be running first — the node registry drives the palette, the
canvas and every properties form, so the UI shows a connection error rather than
an empty shell if it cannot reach the API.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run api:gen` | Regenerate API types from the backend's OpenAPI document |

---

## Architecture

```
app/builder            route shell
  BuilderShell         owns load / save / export; everything else subscribes
    AppHeader          name, counts, breadcrumb, toolbar, agent explorer
    LeftSidebar        node palette (HTML5 drag source)
    FlowCanvas         React Flow: RegistryNode, BendableEdge, minimap
    PropertiesPanel    resizable; SchemaForm or AgentSettingsPanel
    DialogHost         all modal and drawer surfaces

store/useWorkflowStore   Zustand + immer — the analogue of workflow_store.js
lib/api                  fetch client; one error envelope
lib/serialization        the raw_json overlay contract, both directions
lib/runtime              mock engine + one executor per node type
components/fields        FIELD_COMPONENTS registry — 25 widget types
```

### Three ideas carry most of the weight

**The registry drives everything.** `GET /node-types` returns 17 node types with
their icons, colours, handles and form schemas. One `RegistryNode` component
renders all of them, and one `SchemaForm` renders every properties panel. Adding
a node type is a backend JSON file — no component, no CSS, no switch statement.

**`field.key` is the form field name.** The schema declares dot-paths like
`config.model`; react-hook-form registers exactly that string. This is why the
1,760-line `dynamic_fields.js` becomes a ~70-line renderer plus small components
with a uniform `{field, name}` contract.

**React Flow replaces the hand-rolled canvas**, except for one piece: the source
let users drag the midpoint of a bezier edge and persisted the displacement in
`edge.data.offset`. `BendableEdge` reproduces the original path and midpoint
formulas so saved workflows reopen with their curves intact.

### Styling

Design tokens in `src/styles/globals.css` are ported 1:1 from the source's
`workflow_builder.css` `:root` block, expressed as RGB channels so Tailwind's
opacity modifiers (`bg-accent/15`) work. The palette is unchanged; the 1,798
lines of bespoke component CSS are gone.

---

## Feature parity

Everything the Django UI did:

- **Header** — editable name, copyable workflow id, node/edge badges, unsaved
  dot, `Root › Child` breadcrumb, Agent Explorer dropdown with search and New
  Workflow (the source's left-column agent list, kept in one place)
- **Toolbar** — flow variables (typed declarations: name, type, default,
  description), system parameters, JSON viewer, relationship map, validate,
  mock run, semantic search config, snapshot, save, import, export agent /
  package / debug
- **Canvas** — pan, zoom, fit, dot grid, minimap, node drag, connect with
  preview, draggable edge bend, hover an edge for its delete button, keyboard
  delete, double-click a Sub Flow node to open its child
- **Properties panel** — resizable with persisted width, collapse-all,
  schema-driven sections and accordions, agent settings when nothing is selected
- **Tools** — a card per attached tool (name, type, description), Add Tool,
  Browse Catalog, and the MCP configurator behind an `mcp` row: server
  transport, and database / HTTP / function tools with their parameter mapping,
  result settings and cache keys
- **Mock runtime** — client-side, all node types, Human Input suspends the walk

---

## Tests

```powershell
npm test
```

167 tests covering the parts most likely to break silently: the `raw_json`
overlay round trip (unknown keys must survive), the mock engine's traversal,
branch selection, human-input suspension and loop guard, handle derivation, the
handoff invariant, flow variable definitions, the MCP schema's visibility and
validation rules, and a registry test that asserts the widget set matches the
source's `_buildField` switch exactly.

See [tests/README.md](tests/README.md) for the layout and what each file is for.

---

## Known gaps

- **No Playwright suite yet.** Plan §12.3 calls for an E2E canvas test; the
  interaction paths are currently covered by unit tests and manual verification
  only.
- **`npm run api:gen` has not been run**, so `lib/api/endpoints.ts` is
  hand-declared rather than generated. Paths are still in one place, but they
  are not yet pinned to the backend's OpenAPI document.
- **Code and markdown fields are plain textareas.** The plan specifies
  CodeMirror 6 and a markdown editor; the textarea versions round-trip values
  correctly but have no syntax highlighting.
- **Code and payload editors in the MCP configurator are textareas too**, for
  the same reason as above — the source used CodeMirror for the SQL script and
  the JSON body/payload templates.
