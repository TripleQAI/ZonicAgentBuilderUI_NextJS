# Tests

```
tests/
  setup.ts                      resets the Zustand store between tests
  unit/
    agent/        flowVariables.test.ts    variable definitions ⇄ editor rows
    api/          endpoints.test.ts        proxied vs direct URL building
    mcp/          schema.test.ts           MCP visibility, validation, drafts
    components/   fieldRegistry.test.ts    all 25 widget types resolve
                  propertiesPanel.test.ts  expand / collapse all sections
                  schemaForm.test.tsx      the properties form generator
    registry/     nodeHandles.test.ts      which handles a node renders
    runtime/      mockEngine.test.ts       graph traversal, branches, loop guard
    serialization/agentDocument.test.ts    the raw_json overlay round trip
    store/        canvasEditing.test.ts    node and edge editing
                  handoff.test.ts          config ↔ canvas edge invariant
    utils/        dotPath.test.ts          the dot-path read/write primitives
```

The tree under `unit/` mirrors `src/`, so a module's tests are where you would
guess. They live here rather than beside the source so `src/**` contains
application code only — the production build, the bundle analyser and every
glob over `src` see nothing else.

```bash
npm test              # once
npm run test:watch    # on change
npm run test:coverage # v8 coverage over src/
```

Imports use the `@/` alias, never a relative path, so a test does not care
where it sits.

## What is worth testing here

These are unit tests over the parts where a mistake is silent:

- **The overlay contract.** `toAgentJson`/`fromAgentJson` must preserve keys no
  model knows about — `originalBpc`, `freezeRelease`, `createdBy`. Losing one
  corrupts a document with no error anywhere.
- **Handle derivation.** React Flow drops an edge whose handle id is missing
  without logging anything; the connection just is not drawn. Six of the sample
  workflow's twenty-three edges disappeared that way.
- **The handoff invariant.** A handoff is an entry in the node's config *and* a
  wire on the canvas. Either half alone is a bug, and the backend derives a
  relationship per entry, so drift reaches the database.
- **Dot-paths.** A field's `key` is its form name, its read path and its write
  path at once. Everything in the properties panel rides on those two
  functions.
- **The MCP schema.** Its tests read the real backend resource rather than a
  fixture, so a field added without a default, or a `showWhen` pointing at a key
  that does not exist, fails here instead of rendering nothing in the dialog.
  Validation is derived from the same schema the form renders, which is the
  property being pinned: the source kept the two apart and they drifted.
- **Variable definitions.** Both directions are lossy if written carelessly:
  the stored object is keyed by name, so a duplicate drops a variable, and
  rebuilding a definition from the four displayed fields discards whatever else
  it carried. Opening a drawer must never cost you data.

Most components are deliberately not covered. They are thin — read the
registry, call a store action — so a DOM test would mostly assert that React
renders. `SchemaForm` is the exception and does have render tests: it generates
every properties panel from the schema, so a mistake there misconfigures all 17
node types at once rather than breaking something visible.

That is why line coverage sits around 23% while branch coverage is 75%: the
decisions are tested, the markup mostly is not. Chasing the first number by
rendering presentational components would add tests that fail only when the
markup changes.

## Conventions

- One `describe` per behaviour, not per method; the name says what should be
  true.
- Fixtures are the smallest shape that exercises the rule. Where a case came
  from real data — `fsh-energy-agent`'s five-branch Rule node, its three
  handoffs — the comment says so, because those are the shapes that broke.
- A regression test names the bug it prevents, so a later reader knows why the
  case is odd rather than deleting it as redundant.
