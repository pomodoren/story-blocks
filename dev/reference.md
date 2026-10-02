# Reference: spines, blocks and the editor

The detailed authoring reference. For a quick start see the [README](../README.md).

> **Where things live:** `src/` is the engine. Each product is a self-contained folder under
> `examples/stories/<id>/` containing `story.md`, generated `story.yaml`, and optional
> `assets/`. Set `STORYBLOCKS_CONTENT=/path/to/products` before starting a command to use
> another content root. Tests render every example and exercise every block.
>
> `examples/site/` holds the produced output: the static export of every sample story
> (`storyblocks export --content examples/stories --out examples/site`). Open `examples/site/index.html` over any static server.

A story is a scrollable, block-built walkthrough served at `/story/<id>`. This package holds
**both** halves -- the reader and the authoring tools; the reader only reads the built
artifact `<id>/story.yaml`.

```
<id>/story.md      you write this           (the Markdown spine)
        │  storyblocks build --content <root>
        ▼
<id>/story.yaml    built artifact, committed   {meta, blocks:[{type,config}]}
        │  Flask blueprint (src/)
        ▼
/story/<id>                 the reader page
```

- `src/authoring/` — the build-time library (spine parser + `Story` accumulator +
  validation against the block catalog), driven by `src/authoring/build.py`. Never imported
  by the running reader.
- `src/web/` — the Flask reader and visual editor (blueprint, templates, static assets).
- `src/export/` — `storyblocks export`, the static-site generator, split by concern
  (`config`, `dependencies`, `vendor`, `rewrite`, `build`).
- `src/content.py` / `src/registry.py` / `src/loader.py` — content paths, discovery from built metadata, and artifact loading.
- `src/blocks/implementation.py` — the **block catalog**, the single source of truth for what
  every block's `config` accepts.
- `src/web/markdown.py` — the tiny Markdown renderer prose is rendered through at request
  time.

---

## 1. Add the spine

Create `examples/stories/<id>/story.md`. `<id>` is the URL slug (`/story/<id>`).

```markdown
---
id: my-place
title: "{label}, one step at a time"
theme: editorial          # editorial | slate | newsprint | midnight | forest | sunrise | flamingo | cyber
iso3: AAA                 # optional — unlocks the live exposure/taxonomy blocks
scenario: demo-earthquake         # optional — unlocks the live hazard/vulnerability/risk blocks
---

# {label}: the whole picture

```block
type: cover
text: A one-paragraph blurb. Rendered as Markdown, so **bold**, *italic*, `code`,
  [links](https://example.org) and blank-line paragraphs all work.
```

## What is exposed   {.icon-buildings eyebrow="Exposure"}

Prose right after a `## heading` becomes a **text** block, with the heading as its title.
Leave a blank line and keep writing for a second paragraph.

- Markdown lists work too
- so do `##` sub-headings inside a prose run

> A blockquote line is an *interlude* — a short connective beat between blocks.

## How much could it cost   {.icon-shield eyebrow="Risk"}

```block
type: risk
snapshot: true
```
```

### Spine grammar

| You write | You get |
|---|---|
| front-matter `--- … ---` | `meta` (`id`, `title`, `theme`, `iso3`, `scenario`) |
| `# Title` | standalone **heading** block, level 1 (a main title) |
| `### Title` (or deeper) | standalone **heading** block, level 3+ (a section header) |
| `## Title` then prose | a **text** block titled `Title` |
| `## Title` then a ` ```block ` fence | that block, titled `Title` |
| `## Title` with a blank line / another heading / `>` after it | standalone **heading**, level 2 |
| `## Title {.icon-<name> eyebrow="…"}` | the icon + eyebrow ride along onto that block |
| a plain paragraph | a **text** block (Markdown) |
| `> line` | an **interlude** block (consecutive `>` lines merge) |
| ` ```block ` + YAML + ` ``` ` | one block of `type:`, config from the YAML |

Icons (`.icon-<name>`): `buildings`, `checklist`, `curve`, `pin-list`, `shield`, `swipe`,
`tag`, `timeline`, `waves` (see `src/icons.py`).

`{label}` anywhere in the spine is replaced at load time with the example's label.

### The block catalog

| type | needs | notes |
|---|---|---|
| `cover` | `title` | must be first; `text` is the blurb; `actions: [present, share, print]` |
| `heading` | `text` | `level:` 1–6; standalone section/main title |
| `text` | `body` | Markdown prose; optional `title` / `eyebrow` / `icon`; `variant: lede` (centred summary) or `columns` (needs a ` ```block ` fence) |
| `interlude` | `text` | one connective line |
| `image-card` | `src`, `explanation` | a frozen figure; `align: media-left`/`media-right` |
| `exposure-map` | `title` | **live**, needs `iso3` |
| `exposure-stats` | `title` | **live**, needs `iso3` |
| `taxonomy-map` | `title` | **live**, needs `iso3`; `attribute: date` |
| `taxonomy-stats` | `title` | **live**, needs `iso3`; `attribute: OCC` |
| `vulnerability` | `title` | **live**, needs `scenario` |
| `hazard` | `title` | **live**, needs `scenario` |
| `risk` | `title` | **live**, needs `scenario`; `snapshot:`, `tour:` |
| `swipe` | `title`, `before`, `after`, `labels` | `mode: data-lon` (needs `scenario`, live) or `mode: divider` (static-native): each of `before`/`after` is a picture (`src`, `alt`, `decorative`) or an authored map -- the same shape as the `map` block (`geojson`, `markers`, `layers`, `webmap`, `color_by`, `size_by`, `heatmap`, 3D) |
| `guided-tour` | `steps` | pinned map that flies step to step; `view: risk`/`exposure`/`taxonomy`/`hazard`, `layout: overlay` (default) / `split` — see §1b; with authored `geojson:` / `layers:` it is a static data story: `color_by`, `size_by`, `heatmap`, and per-step `metric` / `highlight` / `fit` / `show` (see *Data stories on a map*) |
| `deck-tour` | `steps`, `geojson` | the data-story tour on a deck.gl 3D map, with extruded buildings and a click-through detail panel -- see *3D data tours* |
| `buildings-3d` | `title`, `geojson` | building footprints extruded to a `height` property on a tilted MapLibre map, coloured flat or by `color_by`; optional `orbit` -- see *3D buildings* |
| `photo-scenes` | `scenes` | pinned full-bleed photo, a text card per scene — see §1b |
| `stat-cards` | `cards` (each needs `value`) | big numbers counting up one card at a time, then a grid — see §1b |
| `gallery` | `images` (each needs `src`) | photos as `mode: grid` / `mosaic` / `strip`, each opening in a lightbox; `columns:`; items `### Title {src=… credit=… wide=true}` |
| `table` | `columns`, `rows` | authored table with search + click-to-sort; a column is a label or `{label, num: true}`; a cell is text or `{label, chip: ok|warn|bad}` (a status chip, with a glyph so colour is not the only cue); `caption:`; `filters: [column, …]` adds a dropdown per column; `page_size: N` paginates; `locate: {lon: Col, lat: Col, zoom: 14}` makes a row click fly the nearest map |
| `chart` | `labels`, `series` | `kind: bar`/`hbar`/`line`/`doughnut`; series `{name, data, color}`; `unit:`, `stacked:`, `source:`; `variants:` adds chips that swap the data; `text` beside it |
| `network` | `nodes` (each `{id, label, group, size, color, note}`), `edges` (each `{source, target, label, weight}`) | a Cytoscape relationship network; click a node to highlight its connections; `layout:` cose/concentric/breadthfirst/circle/grid, `colors: {group: '#hex'}`, `search:`, `source:`; `text` beside it; falls back to a connection list without JS |
| `ranking` | `title`, `rows` or `metrics` | a ranked list with inline bars; `unit:`, `top:`, `sort:`, `decimals:`, `source:`; `metrics: [{label, unit, rows}]` adds chips; prints without JS |
| `kpi` | `figures` (each needs `value`) | a row of big figures that count up; items `### 62 {unit=% label="Residential"}` |
| `scroll-chart` | `points` (each `{label, value, note}`) | a line chart that draws itself as the reader scrolls; a point with a `note` is stemmed and listed in the legend |
| `quote` | `text` | pull quote; `cite:`, `source:`, optional `image:` portrait |
| `timeline` | `events` | vertical dated sequence; items `### Title {date="2 Feb" tag=… image=…}` |
| `map` | `title` | an authored map: `geojson: [urls]`, `markers: [{title, text, center: [lon, lat]}]`, `legend:`; `center:`+`zoom:` to fix the camera; `color_by:` / `filter:` make it a choropleth; `size_by:` sizes GeoJSON points by a property (area ~ value) and `heatmap:` draws them as a density surface; marker `value` sizes discs, `groups:` colours + toggles them, `grayscale: true` mutes the basemap; `basemap: offline` draws bundled world borders instead of fetching tiles; `source:` (inline Markdown) credits the data under the map; 3D: `pitch:` (0-85), `bearing:`, `terrain:` (`true` or an exaggeration) and `buildings: true` (also on `map-tour` and `guided-tour`) |
| `map-tour` | `places` (each needs `title`) | numbered places on a map; `source:` credit and the 3D keys of `map`; items `### Title {center=lon,lat zoom=14 image=… credit=…}` |
| `callout` | `text` | a set-apart note; `tone: note`/`method`/`warning` |
| `video` | `src` | a file or a YouTube / Vimeo link; `poster:`, `autoplay: true` (muted loop), `caption:` |
| `audio` | `src` | an audio clip with `title:`, `text:`, `caption:` |
| `divider` | — | a break; `style: line`/`dots`/`space` (combine: `style: [line, space]`) |
| `button` | `text`, `href` | a call-to-action link; `style:` any of `primary`/`ghost`/`large`/`small`/`block` (`style: primary large`), `note:` |
| `code` | `code` | a literal code / config listing (never interpreted); `language:`, `title:`, `caption:` |
| `embed` | `src` | a live page in a frame (`http(s)` or a site path); `height:` in vh; needs the network, so not static-native |
| `process-board` | `phases`, `projects` | phased steps + project chips that draw a path through them |
| `credits` | `items` (`[{label, html}]`) | sources + `links: [{href, text}]`; `logos: [{src, alt, href}]` shows partner / funder logos (alt required) |

`plain` fields (`title`, `eyebrow`, and `heading.text`) are autoescaped — write literal
`—` / `×` / `ü`, no HTML, no `&mdash;`. `rich` fields (`body`, `text`, step `text`,
`intro`, `explanation`, credits `html`) are Markdown / HTML.


### 1b. Scrolly blocks: write the steps as Markdown

`guided-tour`, `photo-scenes` and `stat-cards` (the "step blocks", from the `slider.html`
scroll-story) are lists of steps. Instead of a YAML `steps:` list, open the block with a bare
fence and write each step as a `###` section:

```markdown
## Which entities carry the most loss   {.icon-pin-list eyebrow="Worst-hit"}

```block
type: guided-tour
view: risk
```

Optional intro prose — it becomes the block's `intro`.

### The whole field {stat="Mw 7|scenario shown"}
Every modelled entity, sized by its estimated loss.

### The single worst {worst=0 zoom=17}
One entity carries the largest slice on its own.
```

The block ends at the next `#` / `##` heading, fence or `>` line. To follow it with bare prose
(or a standalone `###` heading) put `<!-- end -->` on its own line first — `storyblocks build --content <root>` /
`dump_spine` insert it for you when needed.

`### Title {attrs}`: the title is the step's `title`, the body is its Markdown `text`, and the
`{key=value}` list carries the rest (`key="two words"` to quote):

| block | attributes | what they do |
|---|---|---|
| `guided-tour` | `worst=N`, `zoom=`, `pitch=`, `center=lon,lat` | camera target — the Nth costliest entity, or an explicit point (no attributes = back to the overview) |
| | `stat="value\|label"` (repeat for more) | a big-number row in the card; the number counts up when the step becomes active |
| | block-level `layout: overlay` (default) / `split`, `view:`, `legend:` | set in the fence, not per step |
| `photo-scenes` | `image=`, `alt_image=` | the photo (`/path`, `https://…` or `data:image/…`); `alt_image` adds a "show the other photo" toggle. No image → a tinted gradient |
| | `pos=` | where the card sits over the photo: `tl tr ml mc mr bl br` (default alternates `bl` / `tr`) |
| | `tag=`, `accent=`, `caption=` | small label, scene colour (`#hex`, a colour name or `var(--x)`), photo credit |
| `stat-cards` | `value=` (required), `unit=`, `tag=`, `image=` | the number keeps its prefix / suffix (`$4.2M`, `12.5%`, `Mw 7`) while it counts up |

A typo (`zom=17`), a bad `pos`, or free CSS in `accent` fails `storyblocks build --content <root>` with the step it
came from. Anything the attribute grammar can't carry (a `#` line inside a step's text, a `|` in
a stat) still works — write that block with a YAML `steps:` / `scenes:` / `cards:` list instead,
and `dump_spine` does the same automatically.

Behaviour you get for free: on a phone the pinned photo drops away and each scene is photo +
card, the stat-cards become a swipeable row with dots, the guided-tour's map pins above the cards;
immersive mode turns every step into its own slide; reduced-motion turns the animation off.
Every story also gets the page chrome — a reading-progress line, headings/prose/media that fade
up as they scroll into view, and (on phones) long explanations beside a chart or map folded
behind "Read more".

---

## 2. Say what data it uses (optional)

There is no registry: a story exists when its folder has a built `story.yaml`, and the gallery
lists every such folder. A story is fully static unless its front matter binds it to data:

```yaml
---
id: my-place
label: My Place          # the place's name -- {label} in the text
iso3: AAA                # optional -- exposure/taxonomy in PostGIS
scenario: demo-earthquake        # optional -- a scenario in tests/fixtures/registry/runs.csv
---
```

| field | data source | lights up |
|---|---|---|
| `iso3` | the configured exposure provider | `exposure-*`, `taxonomy-*`, the map/catalog/stats pages |
| `scenario` | the configured scenario provider | `vulnerability`, `hazard`, `risk`, `swipe` (data-lon), `guided-tour` |

A field can be `None`/`[]` — the matching blocks then render their honest "not available
for this example" state instead of failing. The `title`/`iso3`/`scenario` in the spine's
front matter are the story's own copy.

---

## 3. Build and preview

```bash
storyblocks build --content examples/stories --draft my-place     # -> examples/stories/my-place/story.draft.yaml  (git-ignored)
storyblocks serve --content examples/stories                    # then open /story/my-place?draft=1
```

`?draft=1` shows a "Draft preview" ribbon and prefers the draft artifact. Iterate on the
spine, re-run `storyblocks build --content examples/stories --draft my-place`, refresh.

When it's ready:

```bash
storyblocks build --content examples/stories  # rebuild every spine -> examples/stories/*/story.yaml
git add examples/stories/my-place
```

### The staleness gate

`tests/test_stories.py` fails if a committed `story.yaml` no longer matches what its spine
builds -- i.e. you edited a spine but forgot to rebuild. Fix it by running `storyblocks build --content <root>`
and committing the regenerated artifact. It also asserts every spine round-trips through
`dump_spine`, so the Markdown spine stays a lossless front-end for the YAML artifact.

---

## 4. Publish as a static website

```bash
storyblocks export --content examples/stories # -> dist/site/  (gallery + a folder per story)
storyblocks export --content examples/stories deck-demo
python -m http.server -d dist/site 9100   # then http://localhost:9100/
```

```
dist/site/
  index.html              the gallery
  <story-id>/index.html   one page per story
  assets/story/           engine CSS, themes, and block scripts
  assets/stories/         each exported story's owned assets
  assets/vendor/          MapLibre, Lenis, CountUp + fonts (downloaded once, then cached)
```

It renders the same templates the Flask reader serves and rewrites every URL to be
*relative*, so the folder works from any host or path with no server setup (GitHub Pages,
S3, `file://` for the text-only stories). No CDN is used. The only network dependency left
is the public basemap tiles -- `storyblocks export --content <root> --offline` lists and rejects them, and
`basemap: offline` on a map swaps them for the bundled world borders.

**Only static-native blocks publish**: `cover`, `heading`, `text`, `interlude`, `credits`,
`image-card`, `guided-tour`, `photo-scenes`, `stat-cards`, `gallery`, `table`, `chart`, `kpi`,
`quote`, `timeline`, `map`, `callout`, `process-board` and `swipe` in `divider` mode.
A story that uses a block fetching live `/api/*` data (exposure / taxonomy / vulnerability /
hazard / risk, the two-map swipe) is skipped -- or fails the build if you name it. Freezing
those payloads at build time is on the roadmap (see FEATURES.md).

The published YAML artifacts (`examples/stories/<id>/story.yaml`) hold only `{meta, blocks}` and
root-relative asset URLs, so a static-site generator (Astro content collection, etc.) can read
them unchanged; only the block templates in `src/web/templates/stories/blocks/` would need
porting.

---

## 5. Choosing a format

`format-showcase` (`examples/stories/format-showcase/story.md`, at `/story/format-showcase`) shows
every static-native block with illustrative data -- start there. A good story switches format
as the argument changes:

| the reader needs to… | use |
|---|---|
| follow the argument | `text` (`variant: lede` for the opening), `interlude`, `quote`, `callout` |
| feel one number | `kpi`, `stat-cards` |
| see a pattern | `chart` |
| check the figures | `table` |
| see the place | `map` (one view) · `guided-tour` (flies step to step) |
| look at the evidence | `image-card` (one) · `gallery` (many) · `photo-scenes` (full-bleed, scroll-driven) |
| follow a sequence | `timeline` (dated) · `process-board` (branching paths) |


### Presenting as a slide deck

The cover's **Present** button (or `?present`, or a `#/N` link) turns any story into a deck:
every block is a slide, and a `cover` or level-1/2 `heading` opens a new *section*.
`←`/`→` move between sections, `↑`/`↓`/Space walk every slide, `O` is the overview grid,
`F` fullscreen, `B` blackout, `?` help, `Esc` closes/exits; swiping sideways changes section
on touch. The address bar tracks `#/N`, so a slide can be linked. Use `code` and `embed`
blocks for the listings and live-app frames a talk needs.


## Features and roadmap

What is supported -- block coverage against ArcGIS StoryMaps, the static, transferable blocks, and
the roadmap -- is tracked in [FEATURES.md](FEATURES.md); known defects are in
[bugs.csv](bugs.csv).

```yaml
type: map
geojson: [assets/districts.geojson]   # features carry the numbers as properties
filter: "buildings >= 250 and setting != 'rural'"        # draw only these (colours stay put)
color_by:                                                # one spec, or a list -> a chip per metric
- {property: buildings, label: Buildings, unit: buildings, classes: 4}          # quantiles
- {property: share_res, label: Residential share, unit: "%", breaks: [50, 75], ramp: warm}
- {property: setting, label: Setting, categories: {urban: "#2a7de1", rural: "#2f9e44"}}
```

`ramp` is `teal` (default), `warm`, `blue`, `diverging`, or a list of `#hex` colours; `classes`
is 2–9. A text property (or `categories`) colours by category. Filter operators: `==` `!=`
`>` `>=` `<` `<=` and `~` (case-insensitive contains). Features with no value are grey ("no data").
Typos in either fail the build. Touch screens (no hover) get a tap popup instead of the hover card.

```yaml
type: ranking
unit: buildings
top: 5                          # keep the first 5 after sorting (sort: desc | asc | none)
metrics:                        # or a plain `rows:` list; the first metric is drawn on the server
- label: Buildings
  rows: [{name: Old town, value: 420, note: walled centre}, {name: Riverside, value: 310}]
- label: Residential share
  unit: "%"
  rows: [{name: Hillside, value: 83}, {name: Old town, value: 71}]
```

`chart` takes `variant: <name of the top-level data>` plus `variants: [{label, series, labels?, unit?}]`;
the chips swap the data. See the "Every story format" showcase for all of these live.

### Hosted layers and translations

`map` `layers:` items load from anywhere on the network (the host must allow CORS):

```yaml
layers:
- {label: Parcels, kind: arcgis-feature, url: "https://…/FeatureServer/0"}
- {label: Topo, kind: arcgis-tiles, url: "https://…/MapServer", opacity: 0.7, visible: false}
- {label: Flood, kind: wms, url: "https://…/geoserver/wms", wms_layers: "flood_100"}
- {label: Basemap, kind: raster, tiles: ["https://h/{z}/{x}/{y}.png"], attribution: "…"}
- {label: Parcels (PostGIS), kind: vector, tiles: ["https://h/public.parcels/{z}/{x}/{y}.pbf"], source_layer: "public.parcels"}
```

`wms` and `raster` are plain WMS / XYZ raster endpoints -- any server that speaks the standard works
(GeoServer, MapServer, ArcGIS, etc.), not only Esri's. `vector` is for XYZ vector tiles (MVT / `.pbf`):
`tiles` is the tile template and `source_layer` is the layer name inside the tile (pg_tileserv serves
`<schema>.<table>`; Martin and TileServer GL use the source id). It renders fill / line / point styling
by feature geometry, same as a `geojson` layer.

To translate `my-place`, copy `my-place/story.md` to `my-place/story.de.md`, set
`id: my-place.de` and `lang: de` in the front matter and translate the text. It is served at
`/story/my-place.de`, listed beside the original in the language switcher, and kept out of the
gallery. Block structure and data (maps, charts) should match the original; only words change.

`map` also takes `webmap: <ArcGIS item id or item URL>`: it fetches the public web map's JSON in
the browser and draws its layers (feature, tiled / map service, web-tiled, WMS), toggleable in
the legend and framed by the item's extent. Private items need a token and are not supported.


### Front matter: collections, branding, language

```yaml
---
id: my-place
title: My Place
collection: Reference     # groups stories in the gallery + "More in Reference" footer
accent: "#2a7de1"         # this story's accent colour (#rgb / #rrggbb)
logo: assets/logo.svg   # fixed top-left; logo_alt:, logo_link: optional
lang: en
---
```

Every image should carry `alt="…"` (items: `### Title {image=… alt="…"}`) or `decorative=true`;
`storyblocks build --content <root>` prints a `!` warning for any that don't.


### The visual builder

`storyblocks serve --content <root>`, then open <http://localhost:9001/story-editor/> and pick a story.

- **Left:** story settings (title, theme, language, collection, accent, logo) and the block
  outline -- reorder (drag or ↑ ↓), duplicate, delete, and add any block from the catalog,
  at the end of the selection or at any gap (hover between two blocks, **+ insert**).
- **Middle:** a form for the selected block, generated from `src/blocks/implementation.py` -- plain
  fields as inputs, Markdown fields as text areas, step / scene / place / image lists as
  repeatable cards, everything else as typed fields or JSON. Required fields are starred.
- **Right:** a live preview. With *Live preview* on (the default) the draft is saved a moment
  after you stop typing; the dot beside the story name turns red when the draft does not validate yet.
  *Save draft* validates (same rules as the build) and writes
  `story.draft.yaml`, previewed at `?draft=1`; selecting a block scrolls the preview to it.
- **Publish** rewrites `story.md`, rebuilds `story.yaml` from it and drops the draft,
  so git still has one source of truth. It refuses (and restores the spine) if the story would
  not round-trip through the Markdown format. Commit the result as usual.

It writes files, so it is only on in the standalone app (`STORYBLOCKS_EDITOR=0` turns it off); it accepts same-origin JSON only and only answers to loopback `Host` names (add others with
`STORYBLOCKS_ALLOWED_HOSTS=a.example,b.example`). SVG cannot be uploaded; story assets are served
with a `sandbox` CSP. Run it on localhost -- do not expose it. Creating a brand-new story means adding a folder with a `story.md` and running `storyblocks build --content <root>`.


## Data stories on a map

A `guided-tour` over authored GeoJSON (no live view, so it exports static; `view` defaults to `none`
when `geojson` or `layers` is set) can re-state the map at every step, which suits exposure and
natural-heritage data -- protected areas, habitats, assets at risk, hazard footprints:

```yaml
type: guided-tour
geojson: [assets/areas.geojson, assets/assets.geojson]   # polygons and points may share a tour
color_by:                                                # metrics; a step picks one by label
- {property: designation, label: Designation, categories: {Ramsar wetland: "#0c8599"}}
- {property: pressure, label: Pressure, breaks: [30, 50, 65], ramp: warm}
size_by: {property: value_m, label: Exposed value, unit: M EUR}   # proportional symbols for points
heatmap: {weight: value_m, radius: 40, ramp: warm, points: true}   # or a density surface
layers:                                                  # GeoJSON a step can show / hide
- {label: Flood extent, geojson: assets/flood.geojson, color: "#2a7de1", visible: false}
```

| Step attribute | Effect |
|---|---|
| `metric="Pressure"` | re-colour the polygons by that `color_by` label (default: the first); the legend follows |
| `highlight="pressure >= 50"` | dim the features that do not match (same `property op value` filter as `map`); a feature without the property is left alone, so a filter can single out points without greying the areas beneath |
| `fit="designation == 'Ramsar wetland'"` | frame the matching features (and highlight them) -- no coordinates to author |
| `show="Flood extent, …"` | the layers visible at this step (none given = each layer's own `visible`) |
| `symbols=off` | hide the `size_by` / `heatmap` points for this step |

A `color_by` metric colours only the areas that carry its property; areas from another metric's file are hidden for that step, so cells (`value_m`) and footprints (`era`) can live in one tour. Use distinct property names across files. `size_by` and `heatmap` also work on a plain `map` block. Immersive mode shows the tour's camera
only, not these per-step map states.

## 3D data tours

`deck-tour` is the `guided-tour` data story with [deck.gl](https://deck.gl) layers drawn over the same
MapLibre map (so it shares the basemap choice, fallback and attribution of every other map):
a pitched, flying camera, buildings and cells extruded to their real height or to a value, and a
detail panel on click. It shares the step vocabulary (`metric`, `highlight`, `fit`, `show`,
`symbols`) and `color_by` / `size_by` / `heatmap` / `layers`; it is authored data only, so it exports static.

```yaml
type: deck-tour
basemap: dark            # dark | light | streets | satellite | offline (no tiles)
pitch: 50                # camera tilt (0-85); bearing: rotation
geojson: [assets/grid.geojson, assets/buildings.geojson]
color_by:
- {property: value_m, label: Replacement value, breaks: [1, 5, 15, 30], ramp: warm, height: value_m, height_scale: 12}
- {property: era, label: Construction era, categories: {Before 1975: "#ff4d6d"}, height: height_m, height_scale: 1.5}
fields:                  # how the panel names and totals a property
  value_k: {label: Replacement cost, unit: k, sum: true}
  kind: {hide: true}
```

| | |
|---|---|
| `height` / `height_scale` (on a `color_by` entry) | extrude the areas that carry that metric: metres per unit of `height` |
| step `focus` | `center`, `zoom`, `pitch`, `bearing` (`### Title {center=1.5,42.5 zoom=14.6 pitch=62 bearing=-25}`) |
| step `select="name ~ cell 7"` | open the first matching feature's panel from the story |
| **click** a feature | a panel with its properties, a bar for where each number ranks among its peers in the same file, and *Zoom here* |
| **click an area** | the panel also sums and breaks down (era, material, ...) the features of the other files inside it, and draws them (x-ray), even if the current metric hides them |
| hover | a tooltip with the name and the current metric |

Areas that do not carry the current metric's property are hidden for that step, so a grid and its
building footprints can share one tour; keep property names distinct across files. The basemap
is the reader's choice like on any map (`basemap: offline` draws none); `terrain:` is not supported
here because the deck.gl layers would not follow the relief. The deck.gl bundle (~1.4 MB) is only loaded by
stories that use the block, and the exporter vendors it like the other libraries.

## 3D buildings

`buildings-3d` is one inline 3D scene: polygon footprints extruded to their height on a tilted MapLibre
map. It has no steps or panel (for those, use `deck-tour`) and is plain MapLibre, so the deck.gl bundle
is not loaded. Authored data only, so it exports static.

```yaml
type: buildings-3d
title: Central district, extruded
geojson: [assets/buildings.geojson]
height: height           # metres property (default "height"); height_scale multiplies it
base: z0                 # optional floor height property, for buildings on a slope
color_by: {property: era, label: Construction period, categories: {Before 1975: "#b5543c"}}
orbit: true              # slow camera turn until the reader touches the map; off under reduced motion
pitch: 60
```

| | |
|---|---|
| `geojson` | Polygon / MultiPolygon features; other geometries are ignored |
| `height`, `height_scale`, `base` | property names (metres) and a positive multiplier |
| `color` or `color_by` | a flat `#hex`, or one metric (`classes`, `breaks`, `ramp`, `categories`, `label`, `unit`) with a legend |
| `orbit`, `pitch`, `bearing`, `terrain`, `basemap` | the camera and 3D options of any map block |
| hover | a tooltip with the name, height and the colour metric |

## 3D maps and sources

`pitch`, `bearing`, `terrain` and `buildings` turn a `map`, `map-tour` or `guided-tour` into a 3D
scene. `terrain: true` (or a vertical exaggeration, default 1.5) drapes the map over real elevation
from the keyless Mapzen / AWS Terrain Tiles; `buildings: true` extrudes OpenStreetMap buildings
from OpenFreeMap's vector tiles once the reader zooms past level 14. A compass appears so the
reader can reset the tilt. Both fetch remote tiles, so the static export lists them in its network
report. For your own building footprints use `buildings-3d`; for extruded values and a flying camera, `deck-tour`.

Every map credits its basemap through the corner attribution control. Say where the *data* came
from with `source:` on the block -- inline Markdown, so it can link to the dataset. It renders
under the map (over it, bottom right, on a guided tour). Keep it for the data you drew: the
basemap and terrain credits are added for you.

## Basemaps

The basemap is a reader setting, not an authored one: **Settings > Map** switches every map on the page between OpenStreetMap (the default),
OpenFreeMap, Streets, Light, Satellite and offline outlines, and the choice is remembered in the
browser. All map blocks, `deck-tour` included, draw on the one MapLibre basemap. Streets, Light and Satellite are Esri tiles and need no key. CARTO's free tiles are
not used: they now return an "API KEY REQUIRED" placeholder. `tile.openstreetmap.org` answers 403 to
pages served without a Referer (`file://`, some static hosts); pick another map in Settings there. When OSM refuses its tiles the map falls back to OpenFreeMap by itself (the saved choice is kept), and to the bundled "Offline (country outlines)" map if that is unreachable too. OpenFreeMap serves OpenStreetMap data as keyless vector tiles; it is also a Settings choice. Its icon sprite is not used, so points of interest show as labels only.
To use MapTiler for Streets and Satellite, set a key when you serve or export:

```bash
STORYBLOCKS_MAPTILER_KEY=your-key storyblocks export --content examples/stories --out dist/site
```

Restrict the key to your site's domain in the MapTiler dashboard, since it ships in the page.

A `map` with `from_table: true` draws a marker for every row of each `table` block that has
`locate`; the first cell is the marker title.
