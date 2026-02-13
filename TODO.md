# Ontology Playground — Feature Roadmap

> The goal: build the best community resource site for learning about ontologies
> and Microsoft Fabric IQ Ontologies. Fully static, deployable to Azure Static
> Web Apps or GitHub Pages.

---

## 1. RDF Import / Export (with full test coverage)

The current RDF export is inline in `ImportExportModal.tsx` and there is no RDF
**import**. RDF should become a first-class serialization format.

### 1.1 Extract RDF serialization module
- [ ] Create `src/lib/rdf/serializer.ts` — move the existing `exportAsRDF()`
  logic out of `ImportExportModal.tsx` into a pure function
  `serializeToRDF(ontology, bindings) → string`
- [ ] Create `src/lib/rdf/parser.ts` — implement `parseRDF(rdfXmlString) →
  { ontology, bindings }` using a lightweight XML parser (browser
  `DOMParser`; no heavy deps)
- [ ] Support OWL classes → EntityTypes, DatatypeProperties → Properties,
  ObjectProperties → Relationships
- [ ] Round-trip fidelity: `parse(serialize(ontology))` must produce an
  equivalent ontology

### 1.2 Wire RDF import into UI
- [ ] In `ImportExportModal.tsx`, accept `.rdf` and `.owl` files in the file
  input
- [ ] Detect format by extension and/or XML prologue, route to the RDF parser
- [ ] Show validation errors inline if the RDF is malformed

### 1.3 Full test battery
- [ ] Set up Vitest (`vitest`, `@testing-library/react`,
  `@testing-library/jest-dom`)
- [ ] Unit tests for `serializer.ts`:
  - Empty ontology
  - Ontology with all property types (string, integer, decimal, date, etc.)
  - Ontology with relationship attributes
  - XML special character escaping (& < > " ')
  - Data bindings preservation in comments
- [ ] Unit tests for `parser.ts`:
  - Valid RDF/OWL input → correct Ontology shape
  - Missing required fields → descriptive error
  - Namespace handling (custom prefixes, default namespace)
  - Malformed XML → graceful error
- [ ] Round-trip tests: serialize → parse → deep-equal for every sample ontology
  in `sampleOntologies.ts` and `cosmicCoffeeOntology`
- [ ] Integration test: import an RDF file via the modal, verify store state
- [ ] Add `"test": "vitest run"` and `"test:watch": "vitest"` to
  `package.json` scripts

---

## 2. Fully static site (Azure Static Web Apps + GitHub Pages)

The app currently proxies `/api` to an Azure Functions backend. The site must
work as a pure static build with zero server-side dependencies.

### 2.1 Remove runtime API dependency
- [ ] The Azure OpenAI feature is already behind `VITE_ENABLE_AI_BUILDER` — confirm
  the build produces zero `/api` calls when the flag is off
- [ ] Audit all `fetch()` calls; ensure none target a dynamic backend when
  running in static mode
- [ ] Remove or guard the Vite dev proxy (`server.proxy`) so it doesn't confuse
  static deployments

### 2.2 GitHub Pages deployment
- [ ] Add a GitHub Actions workflow `.github/workflows/deploy-ghpages.yml`:
  - Trigger on push to `main`
  - `npm ci && npm run build`
  - Deploy `build/` to `gh-pages` branch via `actions/deploy-pages`
- [ ] Set `base` in `vite.config.ts` dynamically from an env var
  (`VITE_BASE_PATH`) so it works both at `/` (Azure) and
  `/<repo-name>/` (GitHub Pages)
- [ ] Add `build/404.html` copy for SPA fallback on GitHub Pages

### 2.3 Azure Static Web Apps deployment
- [ ] Verify `staticwebapp.config.json` is correct for the static-only build
- [ ] Add a GitHub Actions workflow `.github/workflows/deploy-azure-swa.yml`
  (or document the SWA CLI workflow)
- [ ] Document both deployment paths in README

---

## 3. Ontology catalogue — official + community contributed

A curated + community-driven catalogue of ontologies, compiled at build time
into a static JSON file.

### 3.1 Catalogue file structure
- [ ] Create `catalogue/` directory at repo root
- [ ] Define a folder convention:
  ```
  catalogue/
    official/
      cosmic-coffee.rdf
      e-commerce.rdf
      ...
    community/
      <github-username>/
        <ontology-slug>.rdf
        metadata.json    ← { name, description, author, tags, ... }
  ```
- [ ] Create a JSON Schema for `metadata.json` to validate contributions
- [ ] Existing sample ontologies in `src/data/sampleOntologies.ts` should be
  migrated to `catalogue/official/` as RDF files with metadata

### 3.2 Build-time catalogue compilation
- [ ] Write a build script (`scripts/compile-catalogue.ts`) that:
  1. Reads all `catalogue/**/*.rdf` files
  2. Parses each via the RDF parser from §1
  3. Reads associated `metadata.json`
  4. Emits `public/catalogue.json` — a single JSON file with all ontologies,
     metadata, and category info
- [ ] Add an npm script: `"catalogue:build": "tsx scripts/compile-catalogue.ts"`
- [ ] Integrate into `npm run build`:
  `"build": "npm run catalogue:build && tsc -b && vite build"`
- [ ] On build failure (invalid RDF, missing metadata), fail loudly with a
  helpful error message

### 3.3 Community contribution workflow
- [ ] Write `CONTRIBUTING.md` with instructions:
  - Fork → add RDF + `metadata.json` under `catalogue/community/<username>/`
  - Open PR → CI validates the RDF and metadata schema
  - On merge, the next build includes the new ontology
- [ ] Add a GitHub Actions CI job that validates PRs touching `catalogue/`:
  - Parse RDF, verify round-trip, check metadata schema
  - Run the full test suite
- [ ] Consider also accepting GitHub Gist URLs in `metadata.json`
  (`"source": "gist:<gist-id>"`) and fetching them at build time
  (optional, evaluate complexity vs. value)

### 3.4 Catalogue UI (upgrade GalleryModal)
- [ ] Refactor `GalleryModal` to load from `catalogue.json` instead of
  hardcoded `sampleOntologies.ts`
- [ ] Add category filters: Official / Community, plus domain tags (retail,
  healthcare, etc.)
- [ ] Add search/filter by name, author, tags
- [ ] Show author + contributor info for community ontologies
- [ ] Add "View RDF source" button for each ontology (links to the raw file
  in the repo or displays inline)
- [ ] Add pagination or virtual scroll if the catalogue grows large

---

## 4. Embeddable ontology widget

Allow embedding an interactive ontology viewer in external pages (blogs,
tutorials, docs) — similar to how CodePen or GitHub Gist embeds work.

### 4.1 Standalone embed build
- [ ] Create a separate Vite entry point `src/embed.tsx` that renders a
  minimal, self-contained ontology viewer:
  - Cytoscape graph visualization (read-only)
  - Entity/relationship inspector on click
  - Tab to toggle between graph view and RDF source view
  - Accepts ontology data via:
    - `data-ontology-url` attribute (URL to a `.rdf` or `.json` file)
    - `data-ontology-inline` attribute (inline JSON, base64-encoded)
    - `data-catalogue-id` attribute (loads from the published `catalogue.json`)
- [ ] Build as a single JS + CSS bundle: `ontology-embed.js` + `ontology-embed.css`
- [ ] Add Vite build config for the embed target:
  ```ts
  // vite.config.embed.ts
  build: {
    lib: { entry: 'src/embed.tsx', formats: ['iife'], name: 'OntologyEmbed' },
    rollupOptions: { output: { assetFileNames: 'ontology-embed.[ext]' } }
  }
  ```
- [ ] Keep bundle size under 150KB gzipped (Cytoscape is ~90KB gz, must
  account for it)

### 4.2 Embed API & usage
- [ ] Usage pattern for external pages:
  ```html
  <div class="ontology-embed"
       data-catalogue-id="cosmic-coffee"
       data-theme="dark"
       data-height="500px">
  </div>
  <script src="https://<site>/ontology-embed.js"></script>
  ```
- [ ] Support configuration: theme (light/dark), height, initial zoom,
  read-only mode
- [ ] Provide a "Copy embed code" button in the main app's gallery for each
  ontology

### 4.3 RDF source tab
- [ ] In the embed widget, add a tabbed view: "Graph" | "RDF Source"
- [ ] RDF source tab shows syntax-highlighted RDF/XML (use a lightweight
  highlighter or simple regex-based coloring — no heavy deps)
- [ ] Add a "Copy RDF" button

---

## 5. Complementary features

These enhance the overall experience for a community learning resource.

### 5.1 Deep linking / URL routing
- [ ] Add client-side routing (e.g., lightweight hash-based router)
- [ ] Support routes:
  - `/#/` — home (current default ontology)
  - `/#/catalogue` — opens gallery
  - `/#/catalogue/<ontology-id>` — loads and displays a specific ontology
  - `/#/embed/<ontology-id>` — full-page embed view (useful for iframes)
- [ ] Shareable URLs: loading the app with a route pre-selects the ontology

### 5.2 Ontology diffing
- [ ] When loading a new ontology, optionally show a diff view:
  "You'll add 3 entities, remove 1 relationship..."
- [ ] Useful for reviewing community PRs or comparing versions

### 5.3 Accessibility & responsive design
- [ ] Audit and fix keyboard navigation across all modals and panels
- [ ] Add ARIA labels to the graph visualization
- [ ] Ensure the app is usable on tablet-sized screens (responsive breakpoints)
- [ ] Test with screen readers (VoiceOver, NVDA)

### 5.4 Offline support (PWA)
- [ ] Add a service worker + web app manifest
- [ ] Cache `catalogue.json` and the main app shell for offline use
- [ ] Users can browse the full catalogue without a network connection

### 5.5 Analytics & feedback (privacy-respecting)
- [ ] Add optional, privacy-respecting analytics (e.g., Plausible, or simple
  custom event tracking to a static endpoint)
- [ ] "Was this ontology helpful?" thumbs up/down on each catalogue entry
- [ ] Track which ontologies are most loaded to surface popular ones

### 5.6 Documentation site / learning content
- [ ] Add a `/learn` section with markdown-rendered educational content:
  - "What is an ontology?"
  - "Understanding RDF and OWL"
  - "Microsoft Fabric IQ Ontology concepts"
  - "Building your first ontology"
- [ ] Content stored as `.md` files in `content/learn/`, compiled at build time
- [ ] Each tutorial can embed an interactive ontology widget (from §4)

---

## Priority order (suggested)

| Phase | Items | Rationale |
|-------|-------|-----------|
| **Phase 1** | §1 (RDF), §2 (Static), §3.1–3.2 (Catalogue structure + build) | Foundation: proper serialization, static deploy, catalogue pipeline |
| **Phase 2** | §3.3–3.4 (Community workflow + UI), §5.1 (Deep linking) | Community: accept contributions, browse catalogue, share links |
| **Phase 3** | §4 (Embed widget), §5.6 (Learning content) | Growth: embeddable widgets drive adoption, docs help newcomers |
| **Phase 4** | §5.2–5.5 (Diff, A11y, PWA, Analytics) | Polish: robustness, accessibility, offline, usage insights |
