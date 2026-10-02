# Features

This file is the product inventory and roadmap. The README is the quick start and `reference.md` the syntax reference;
`bugs.csv` tracks reproducible defects.

## Product workflow

| Capability | Status | Interface |
|---|---|---|
| Markdown story authoring | Stable | `<id>/story.md`, fenced YAML blocks |
| Deterministic YAML artifacts | Stable | `storyblocks build --content ROOT [id ...]` |
| Draft builds | Stable | `storyblocks build --content ROOT --draft <id>` |
| Local preview | Stable | `storyblocks serve --content ROOT` |
| Visual block editor | Stable, local-only | `/story-editor/` |
| Static multi-page export | Stable for static-native blocks | `storyblocks export --content ROOT [id ...] --out DIR` |
| Static portability audit | Stable | `storyblocks.export.audit()` |
| Custom content roots | Stable when configured before process start | `STORYBLOCKS_CONTENT=/path` |
| Installable wheel | Stable | Engine and web assets install; content root is explicit |
| Fully offline pages | Stable for static-native blocks | App assets are vendored; export prints a per-story network report; `--offline` rejects remote dependencies; `basemap: offline` on `map` / `map-tour` / `guided-tour` draws the bundled world borders with no tile server |

## Authoring and delivery

- Typed block catalog with defaults, required fields, allowed keys, and item validation.
- Markdown front matter, prose, headings, interludes, fenced blocks, and scrollytelling steps.
- Seven themes, story accents, logos, collections, language variants, and branded covers.
- Responsive reading, presentation mode, keyboard navigation, table of contents, sharing, and print.
- Accessibility guardrails for image alt text, plain-text fields, and reduced motion.
- Translation siblings using `<id>/story.<lang>.md` and a generated language switcher.
- Relative static URLs suitable for subpaths, object storage, and GitHub Pages.

## Static-native blocks

These can be exported without a Storyblocks API backend, although individual authored URLs may
still reference remote media or map services:

- Narrative: `cover`, `heading`, `text`, `interlude`, `quote`, `callout`, `credits`.
- Media: `image-card`, `gallery`, `photo-scenes`, `swipe` in divider mode (a picture and/or an
  authored map per side), `video`, `audio`.
- Data: `kpi`, `stat-cards`, `chart`, `scroll-chart`, `network`, `ranking`, `table`.
- Structure: `timeline`, `process-board`, `divider`, `button`, `code`.
- Spatial: `map`, `map-tour`, `deck-tour` (3D), `buildings-3d` (extruded footprints), and authored-data `guided-tour` (metric / highlight / fit / layer steps, `size_by`, `heatmap`).
- Network-backed: `embed` and hosted map layers export, but are not offline-native.

## StoryMaps parity

The target: stories can do what ArcGIS StoryMaps does. Status: ✅ have · 🟡 partial · ⬜ gap
(the gaps feed the roadmap).

**Narrative blocks**

| StoryMaps feature | Status | Here |
|---|---|---|
| Text: headings, paragraphs, lists, links, bold/italic | ✅ | `text`, `heading`, Markdown prose |
| Quote / pull quote | ✅ | `quote` |
| Callout / note | ✅ | `callout` (`note` / `method` / `warning`) |
| Code listing | ✅ | `code` |
| Divider / separator | ✅ | `divider` (`line` / `dots` / `space`) |
| Button / call-to-action link | ✅ | `button` |
| Table | ✅ | `table` (search, sort, `filters`, `page_size`, `locate` row → map; `map` `from_table`) |
| Image with caption and credit | ✅ | `image-card` |
| Image gallery | ✅ | `gallery` (grid / mosaic / strip, lightbox) |
| Before/after comparison (swipe) | ✅ | `swipe`: `mode: divider` wipes between a picture and/or an authored map per side (static-native); `mode: data-lon` wipes between two scenario loss layers (live) |
| Video | ✅ | `video` (mp4/webm file, or a YouTube / Vimeo link; `autoplay` for a muted loop) |
| Audio | ✅ | `audio` |
| Embed (web page, app, dashboard) | ✅ | `embed` (needs network, not static) |
| Charts / data figures | ✅ | `chart`, `kpi`, `stat-cards` |
| Timeline | ✅ | `timeline` |
| Credits / attribution | ✅ | `credits` (with partner `logos`), image `credit` |

**Maps and immersive storytelling**

| StoryMaps feature | Status | Here |
|---|---|---|
| Map block (markers, GeoJSON, legend) | ✅ | `map` |
| Guided tour (map flies step to step) | ✅ | `guided-tour` |
| Sidecar (docked / floating narrative panels over media) | ✅ | `guided-tour` (`layout: overlay` / `split`), `photo-scenes`, immersive mode |
| Immersive slideshow (full-bleed media per step) | ✅ | `photo-scenes`, `stat-cards` |
| Map actions (text link moves the map) | ✅ | `[text](map:lon,lat,zoom)` in any prose flies the nearest `map` or `guided-tour` block |
| Map tour (numbered places with photos) | ✅ | `map-tour` (numbered pins, photo + text card, prev / next, keyboard) |
| Basemap choice, layer toggles | ✅ | reader setting (Settings > Map: OpenStreetMap default, OpenFreeMap, Streets, Light, Satellite, Offline outlines; auto-fallback OSM -> OpenFreeMap -> outlines); `map`: `layers:` with legend checkboxes (not the guided tour) |
| Web map / hosted layers (ArcGIS content) | 🟡 | `map` `layers:` of kind `arcgis-feature` (FeatureServer), `arcgis-tiles` (tiled MapServer), `raster` (any XYZ tile server, e.g. GeoServer gwc), `wms` (any WMS server, e.g. GeoServer), `vector` (any XYZ MVT server, e.g. pg_tileserv / Martin / TileServer GL / GeoServer vector tiles), or hosted `geojson`; `webmap:` imports a public ArcGIS web map by item id (feature / tiled / WMS / web-tiled layers + extent); no auth, and vector-tile, CSV and inline-collection layers are skipped |
| 3D scenes | ✅ | `map`, `map-tour`, `guided-tour`: `pitch`, `bearing`, `terrain` (real elevation), `buildings` (extruded OSM); `deck-tour` for extruded data, `buildings-3d` for a single extruded-footprint scene |
| Data source credit under a map | ✅ | `source:` (inline Markdown) on `map`, `map-tour`, `guided-tour`; basemap / terrain credits come from the map's attribution control |

**Structure, navigation and delivery**

| StoryMaps feature | Status | Here |
|---|---|---|
| Cover with media and title | ✅ | `cover` |
| Story navigation / table of contents | ✅ | fixed section bar plus a ☰ Contents drawer (key `c`) listing every section |
| Themes and branding | ✅ | 8 themes (editorial, slate, newsprint, midnight, forest, sunrise, flamingo, cyber), chosen per story or per reader (`?theme=` or the ⚙ reading-settings panel at the right of the story navbar, which also sets text size, line spacing, reading width, font, accent colour, high contrast, calm motion, the progress line, optional subtle section colour shifts and available story languages, remembered per browser); per story `accent: "#hex"`, `logo:` (+ `logo_alt`, `logo_link`) in the front matter |
| Briefing / presentation mode | ✅ | Present: slide deck (see above) |
| Collections (a gallery of stories) | ✅ | `collection: Name` in the front matter groups stories in the gallery and adds a "More in …" list at the foot of each |
| Gallery navbar, search, filters and settings | ✅ | Sticky navbar, search (`/`), collection chips, sort, grid/list, light/dark/system, density and card toggles saved per browser; works in the static export; "How a story is made" and "Reading the numbers" explain the page |
| Mobile-friendly layout | ✅ | responsive, swipe in the deck |
| Print / PDF | ✅ | cover's print action |
| Publish, share | ✅ | static-site export, share button |
| Draft preview before publishing | ✅ | `?draft=1` |
| Alt text on media | ✅ | `alt="…"` (or `decorative=true`) on every image; the build warns about any image without one |
| Translation / multiple languages | ✅ | a translation is its own spine `<id>/story.<lang>.md` (`id: <id>.<lang>`, `lang: de`); a language switcher links the siblings, `<html lang>` follows, static export builds each |
| Visual builder (no-code editor) | ✅ | `/story-editor/` (local): block outline with insert-between gaps, forms generated from the catalog, live preview (debounced draft autosave, toggleable), save draft / publish; Markdown spines still work |
| Collaboration, comments, version history | ⬜ | git is the history |
| Analytics (views, reading time) | ⬜ | |


## Static, transferable building blocks

`storyblocks` should work on **any** data, not only one organization's. These blocks were lifted from the
generic mechanics of a dashboard app's pages: each takes plain data authored in the
story (GeoJSON, rows, series) and needs no database, no `/api/*` and no exposure schema, so it
publishes to the static site as-is. Domain blocks (`exposure-*`, `taxonomy-*`, `hazard`,
`vulnerability`, `risk`) stay a separate, optional layer.

| Feature | Status | Lifted from | Here |
|---|---|---|---|
| Choropleth / data-driven colour | ✅ | Districts page map | `map` `color_by:` — a GeoJSON property, quantile or fixed `breaks`, a colour `ramp`, or categories; auto legend and a hover card |
| Filter on authored GeoJSON | ✅ | Exposure Filter | `map` `filter:` — a `property op value` expression (`and`-joined) evaluated in the browser |
| Relationship network | ✅ | Dossier dependency network | `network` block: `nodes`, `edges`, `colors`, `layout`; Cytoscape, click-to-highlight neighbourhood, label search, layout switch; connection list without JS |
| Ranked bar list | ✅ | Districts "top N" | `ranking` block: `rows: [{name, value, note}]`, `unit`, `top`, `sort`; plain HTML first, prints without JS |
| Metric / variant chips | ✅ | Scenario magnitude switch, Districts metric pills | `color_by: [..]` on `map`, `metrics:` on `ranking`, `variants:` on `chart` — a chip per metric swaps the data in place |
| Stories-owned base styles | ✅ | `common.css` tokens + `.page` shell | `src/web/static/story/base.css` styles the standalone shell; `lib.js` has its own `esc` / `fmtNum`; no `/css` / `/js` routes, no host-app files in the static site |
| World / coverage map | ✅ | Availability page | `src/web/static/story/world-borders.geojson` (Natural Earth 110m, public domain) ships with the engine; `color_by` works on it, and it is the `basemap: offline` layer |
| Data-story tour steps | ✅ | Exposure / heritage storytelling | `guided-tour` over authored GeoJSON: per-step `metric`, `highlight`, `fit` (frame matching features), `show` (layer toggles), legend follows the step; static-native |
| Proportional symbols, heatmap | ✅ | Exposure maps | `size_by` (point area ~ value, nested-circle legend) and `heatmap` (weighted density) on `map` and `guided-tour` |
| 3D data tour with click-through | ✅ | Exposure storytelling | `deck-tour`: deck.gl layers on the shared MapLibre basemap, pitched flying camera, extruded cells / buildings (`color_by` `height`), per-step `select`; click a feature for a panel with peer ranking, click an area to summarise and x-ray what is inside it |
| Per-cell status chips in `table` | ✅ | Availability tables | `{label, chip: ok / warn / bad}` cells; the label stays the cell text, so search, sort and filters still work |
| Popups follow the theme | ✅ | (fix) | map popups use the theme's surface / text colours, so they read on dark themes |

Still dependent on a host app: `export.py` and the live domain blocks
(`exposure-*`, `taxonomy-*`, `hazard`, `vulnerability`, `risk`). The next step is to move those behind
an optional pack so the core has no host-app dependency.

## Quality gates

- Every sample spine must equal its committed YAML artifact.
- Every spine must serialize and parse without information loss.
- Every built sample must render successfully.
- Referenced sample media and GeoJSON must exist.
- Every public catalog block must appear in at least one public sample story; unpublished domain blocks are tracked explicitly.
- Internal story URLs in static output must be relative.

Current baseline: 126 tests passing.

## Roadmap

| Priority | Work | Outcome | Tracking |
|---|---|---|---|
| P0 | Make installed-package content configuration explicit | Fresh wheel installs can initialize or target content without repository files | `SB-001` |
| P0 | Make static publication atomic | Failed downloads/renders never destroy the last good site | `SB-002` |
| P1 | Offline policy and dependency report (done: report, `--offline`, `basemap: offline`) | Publishers can reject remote embeds, tiles, video, and hosted layers | `SB-003` |
| P1 | Add `storyblocks init` | Scaffold a content root with a starter story folder |
| P2 | Freeze selected live API payloads during export | Domain stories can become backend-free artifacts |
| P2 | Add schema/version metadata and migrations | Artifacts remain compatible as blocks evolve |
| P2 | Add deployment recipes | Document GitHub Pages, S3-compatible storage, and common CI flows |
| P3 | Add authenticated hosted layers and 3D scenes | Close remaining parity gaps |
