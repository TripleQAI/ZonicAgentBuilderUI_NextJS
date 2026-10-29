# Zonic Agent Builder — UI (Next.js) V2

Visual orchestration editor for multi-agent AI workflows. Replaces the
server-rendered jQuery page from the Django monolith with a Next.js App Router
client that talks to
[ZonicAgentBuilderServer_FastAPI](https://github.com/TripleQAI/ZonicAgentBuilderServer_FastAPI)
over JSON.

The design is described under [Technical design](#technical-design). Comments
in the code cite sections of the migration plan (`MIGRATION_PLAN.md`), which is
kept outside this repository.

---

## Nebius x NVIDIA Global AI Hackathon

This repository is part of the Zonic agent platform, our entry in the Nebius x NVIDIA Global AI Hackathon (Best Apps and Agents track). The platform's agents run on NVIDIA Nemotron models served by Nebius Token Factory. How that is wired, and which model does what, is in the runtime's README: [NVIDIA Nemotron on Nebius Token Factory](https://github.com/TripleQAI/ZonicAgentRuntimeBackend_Python_LangGraph#nvidia-nemotron-on-nebius-token-factory).

**This repository's part:** The model list of every LLM and Agent node, swarm members included, offers the Nemotron models (`nemotron-3-nano`, `-super`, `-ultra`, `nemotron-3.5-super-vl`). The chosen code is saved in the workflow, and the runtime resolves it to a Token Factory model. The Energy, Facilities, Risk and All Agents workflows were designed here.

**Live demo:** the chat at https://dev.tripleq.ai/agent-runtime-lg and the agent builder at https://dev.tripleq.ai/agent-visual-builder-lg/workflows. Both sign in with Amazon Cognito; the test accounts are in the hackathon submission's testing instructions.

| Repository | Role |
|---|---|
| **ZonicAgentBuilderUI_NextJS** (this repository) | The visual builder: design a workflow and pick a Nemotron model for each node |
| [ZonicAgentBuilderServer_FastAPI](https://github.com/TripleQAI/ZonicAgentBuilderServer_FastAPI) | The builder's API: validation, import and export, the node registry and model options |
| [ZonicAgentRuntimeBackend_Python_LangGraph](https://github.com/TripleQAI/ZonicAgentRuntimeBackend_Python_LangGraph) | Runs the workflows on LangGraph and calls Nemotron through Token Factory |
| [ZonicAgentRuntimeUI_NextJS_For_LangGraph](https://github.com/TripleQAI/ZonicAgentRuntimeUI_NextJS_For_LangGraph) | The chat app people use the agents in |
| [ZonicMCPServer_FastAPI](https://github.com/TripleQAI/ZonicMCPServer_FastAPI) | The agents' tools over open data |
| [ZonicPostgresqlServer_FastAPI](https://github.com/TripleQAI/ZonicPostgresqlServer_FastAPI) | The PostgreSQL gateway every service stores data through (Neon) |

---

## Technical design

The full technical design is in [docs/technical-design.md](docs/technical-design.md):

- [Architecture](docs/technical-design.md#architecture)
- [Registry-driven editing](docs/technical-design.md#registry-driven-editing)
- [State and data flow](docs/technical-design.md#state-and-data-flow)
- [The canvas](docs/technical-design.md#the-canvas)
- [The local test runner](docs/technical-design.md#the-local-test-runner)
- [Auth and deployment](docs/technical-design.md#auth-and-deployment)
- [Testing](docs/technical-design.md#testing)
- [Key design decisions](docs/technical-design.md#key-design-decisions)
- [Styling](docs/technical-design.md#styling)

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
- **Properties panel** — resizable with persisted width, expand / collapse all,
  schema-driven sections and accordions. With nothing selected it sits closed as
  a rail and gives its width to the canvas; the rail opens agent settings, and
  selecting a node opens the panel on that node
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

213 tests covering the parts most likely to break silently: the `raw_json`
overlay round trip (unknown keys must survive), the mock engine's traversal,
branch selection, human-input suspension and loop guard, handle derivation, the
handoff invariant, swarm membership, flow variable definitions, the MCP schema's
visibility and validation rules, and a registry test that asserts the widget set
matches the source's `_buildField` switch exactly (plus `member_list`).

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

## License

Licensed under the Apache License 2.0; see [LICENSE](LICENSE).
