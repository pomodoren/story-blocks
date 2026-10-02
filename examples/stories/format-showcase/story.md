---
id: format-showcase
label: Every story format
title: Every story format, on one page
theme: midnight
collection: Reference
---

## Every story format, on one page   {eyebrow="Reference · block catalog"}

```block
type: cover
image: assets/Narta-Zvernec.webp
image_credit: Photo reused from the slider story · Who Owns the Albanian Coast
text: 'A good story switches format as the argument changes: a sentence, a photo, a number, a table, a map. This page shows each one. **All figures here are illustrative** — it demonstrates the formats, not a dataset.'
```

## Start with the argument   {eyebrow="Text"}

```block
type: text
variant: lede
body: 'A story is a sequence of **formats**, each chosen for what it does best. Prose carries the argument; a figure makes one number unforgettable; a map shows where; a table lets the reader check.'
```

## Text, set for reading   {eyebrow="Text"}

The default text block is a reading column with a short measure and a larger first paragraph, so the opening sentence does the work of a standfirst.

Later paragraphs settle into body size. Use **bold** for the one thing a skimming reader must keep, and a link for the source.

> A single line between blocks is an interlude: a breath, not a chapter.

```block
type: quote
text: A number is an argument only once someone can see what it is a number *of*.
cite: A reviewer's rule
source: Story style guide · illustrative
```

```block
type: callout
tone: method
title: How to read this page
text: 'Every block below is authored as YAML or Markdown in the spine. Nothing is fetched when the page opens, so the same page publishes as a static site.'
```

## One number, then several   {eyebrow="Figures"}

```block
type: kpi
figures:
- value: "1,240"
  label: Sample buildings
  text: Figure shown large, counted up once on entry.
- value: "62"
  unit: "%"
  label: Residential
  text: A share reads best with its unit beside it.
- value: "3.1"
  unit: "M"
  label: Illustrative loss
  text: Keep the label short and the note shorter.
```

## A chart, with the sentence that explains it   {eyebrow="Chart"}

```block
type: chart
kind: bar
labels: ["Before 1960", "1960–79", "1980–99", "2000+"]
series:
- name: Sample buildings
  data: [120, 340, 510, 270]
unit: buildings
source: Illustrative data.
variant: Sample buildings
variants:
- label: Residential share
  unit: "%"
  series:
  - {name: Residential share, data: [88, 74, 61, 55]}
text: A chart sits beside **one** sentence saying what to see in it. Bars, horizontal bars, lines and doughnuts are all authored inline, with no data file. Give it `variants` and chips swap the data.
```

## A network, when the links are the story   {eyebrow="Network"}

```block
type: network
layout: cose
colors: {Agency: "#37b6c9", Contractor: "#f2b53c"}
source: Illustrative data.
nodes:
- {id: ministry, label: Ministry, group: Agency, note: Awards the contracts}
- {id: roads, label: Roads authority, group: Agency}
- {id: acme, label: Acme Build, group: Contractor}
- {id: bolt, label: Bolt Works, group: Contractor}
- {id: city, label: City hall, group: Agency, size: 30}
edges:
- {source: ministry, target: roads, label: oversees}
- {source: roads, target: acme, label: contract, weight: 6}
- {source: roads, target: bolt, label: contract, weight: 3}
- {source: city, target: acme, label: contract, weight: 4}
- {source: city, target: ministry, label: reports to}
text: A network is authored as `nodes` and `edges`. **Click** a node to light up what it touches, type to find one, and switch the layout. Without JavaScript it prints as a plain list of connections.
```

## A ranking, when order is the point   {eyebrow="Ranking"}

```block
type: ranking
unit: buildings
top: 4
source: Illustrative data.
text: A ranked list with inline bars -- plain HTML, so it prints and reads without JavaScript. With `metrics`, chips switch what is ranked.
metrics:
- label: Buildings
  rows:
  - {name: Old town, value: 420, note: walled centre}
  - {name: Riverside, value: 310}
  - {name: Harbour, value: 275}
  - {name: Hillside, value: 190}
  - {name: Market, value: 165}
- label: Residential share
  unit: "%"
  rows:
  - {name: Hillside, value: 83}
  - {name: Old town, value: 71}
  - {name: Riverside, value: 58}
  - {name: Harbour, value: 44}
  - {name: Market, value: 36}
```

## A table, for the reader who wants to check   {eyebrow="Table"}

```block
type: table
intro: Columns sort on click, and a search box appears once there are enough rows to need one.
caption: Illustrative data.
columns:
- District
- {label: Buildings, num: true}
- {label: Share residential, num: true}
rows:
- [Old town, 420, 71%]
- [Riverside, 310, 58%]
- [Harbour, 275, 44%]
- [Hillside, 190, 83%]
- [Market, 165, 36%]
- [Station, 140, 52%]
- [Campus, 95, 61%]
- [Industrial, 60, 12%]
```

## Photos, together   {eyebrow="Gallery"}

```block
type: gallery
mode: mosaic
columns: 3
intro: Click any photo to open it large, with its caption, and use the arrow keys to move through the set.
```

### Narta and Zvërnec {src=assets/Narta-Zvernec.webp credit="Who Owns the Albanian Coast" alt="Aerial view of the Narta lagoon, outlined in blue, ringed by pine forest with land-parcel boundaries marked in orange"}
The lagoon, pine forest and dunes read as one coastal system.

### Blue Borgo {src=assets/Blue-Borgo.webp alt="Aerial view of a gridded plot layout cleared in the dunes beside the sea, with parcel lines traced in gold"}
A proposed resort on land with unresolved ownership claims.

### Sushica {src=assets/Sushica.webp alt="The Sushica river valley: a braided stony riverbed outlined in blue below a road embankment and forested slopes"}
The river corridor inland of the coast.

### Vlorë airport {src=assets/Aeropuerto-de-Vlora.webp wide=true alt="Aerial view of a long new airport runway on flat land, with the surrounding plots outlined"}
A wide frame for a wide subject.

### Vlorë port {src=assets/Puerto-de-Vlora.webp alt="Aerial view of Vlorë port crowded with boats and ships, with property lines traced in gold and red"}
The port from above.

## One figure, explained   {eyebrow="Image card"}

```block
type: image-card
src: assets/Puerto-de-Vlora.webp
alt: Aerial view of Vlorë port crowded with boats and ships, with property lines traced in gold and red
caption: Vlorë port, with parcel boundaries traced.
align: media-left
explanation: A single figure beside the text that explains it -- use it for a frozen snapshot or a diagram, `align` flips the side.
```

## A map, without the scrolling   {eyebrow="Map"}

```block
type: map
layers:
- {label: Mapped boundaries, geojson: assets/flamingo-coast-osm.geojson, color: "#37b6c9"}
- {label: Esri topographic (hosted tiles), kind: arcgis-tiles, url: "https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer", opacity: 0.7, visible: false}
- {label: Country outlines (vector tiles), kind: vector, tiles: ["https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf"], source_layer: countries, color: "#9b5de5", opacity: 0.35, visible: false}
markers:
- title: Narta lagoon
  text: An example marker; click for its card.
  center: [19.4237892, 40.5316622]
legend:
- {label: Example marker, color: "#e01e26"}
source: 'Mapped boundaries: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; hosted topographic layer: Esri; country-outline vector tiles: [MapLibre demo tiles](https://demotiles.maplibre.org).'
text: 'Use a plain map when the reader only needs to see *where*. A link can move the map too -- fly to [the Narta lagoon](map:19.4237892,40.5316622,13) or back out to [the whole coast](map:19.45,40.45,9). For a map that flies from place to place as the story scrolls, use a guided tour.'
```

## A layered map   {eyebrow="Map"}

```block
type: map
title: Cities, sized and grouped
grayscale: true
center: [14, 46]
zoom: 3.4
groups:
- {label: Western Balkans, color: "#744761"}
- {label: Central Europe, color: "#2f6f8f"}
- {label: Nordics, color: "#b98545"}
markers:
- {title: Tirana, text: 120 members, center: [19.82, 41.33], group: Western Balkans, value: 120}
- {title: Prishtina, text: 40 members, center: [21.16, 42.67], group: Western Balkans, value: 40}
- {title: Munich, text: 25 members, center: [11.58, 48.14], group: Central Europe, value: 25}
- {title: Zurich, text: 18 members, center: [8.54, 47.37], group: Central Europe, value: 18}
- {title: Stockholm, text: 9 members, center: [18.07, 59.33], group: Nordics, value: 9}
source: Illustrative member counts, not real data.
text: 'Marker `value` sizes each disc, `groups` colours them and adds toggle chips, `grayscale` mutes the basemap -- the flamingo website map. Best with `theme: flamingo`.'
```


```block
type: divider
style: dots
```

## A choropleth, from any GeoJSON   {eyebrow="Map"}

```block
type: map
geojson:
- assets/showcase-districts.geojson
basemap: offline
color_by:
- {property: buildings, label: Buildings, unit: buildings, classes: 4}
- {property: share_res, label: Residential share, unit: "%", breaks: [50, 75], ramp: warm}
- {property: setting, label: Setting, categories: {urban: "#2a7de1", coastal: "#0c8599", rural: "#2f9e44"}}
source: Illustrative district figures.
text: '`color_by` colours the features of any GeoJSON by a property -- quantile classes, fixed `breaks` or categories -- with a legend and a hover card. `basemap: offline` draws the bundled world borders instead of fetching tiles, so this block needs no network. A list adds a chip per metric. `filter: "buildings >= 250"` would draw only the matching districts.'
```

## Before and after, side by side   {.icon-swipe eyebrow="Swipe"}

```block
type: swipe
mode: divider
title: A picture, wiped against a map
labels:
- Photo
- Mapped today
before:
  src: assets/Puerto-de-Vlora.webp
  alt: Aerial view of Vlorë port crowded with boats and ships, with property lines traced in gold and red
after:
  geojson:
  - assets/showcase-districts.geojson
  basemap: offline
  color_by: {property: buildings, label: Buildings, unit: buildings, classes: 4}
text: 'Drag to wipe between the two sides. `before`/`after` each take a picture (`src`, `alt`, `decorative`) or an authored map -- the same shape as the `map` block (`geojson`, `markers`, `layers`, `color_by`, `size_by`, `heatmap`, 3D) -- so a side can be either, or both sides can be maps. `mode: data-lon` instead wipes between two scenario loss layers, live.'
```

## A data story on one map   {eyebrow="Map"}

```block
type: guided-tour
legend: true
basemap: offline
geojson:
- assets/showcase-heritage.geojson
- assets/showcase-exposure.geojson
layers:
- {label: 1-in-100 flood extent, geojson: assets/showcase-flood.geojson, color: "#2a7de1", opacity: 0.25, visible: false}
color_by:
- {property: designation, label: Designation, categories: {Ramsar wetland: "#0c8599", Nature reserve: "#2f9e44", Protected landscape: "#b98545"}}
- {property: pressure, label: Pressure index, unit: "/100", breaks: [30, 50, 65], ramp: warm}
size_by: {property: value_m, label: Exposed value, unit: M EUR, color: "#e01e26"}
source: Illustrative protected-area and exposure data.
intro: Nature and exposure on the same map. Each step re-states the map -- a metric, a highlight, a layer -- instead of only moving the camera. Illustrative data.
```

### Protected areas {metric=Designation}
Five sites, coloured by how they are protected. Circles are the assets around them, sized by exposed value.

### Where pressure bites {metric="Pressure index" highlight="pressure >= 50"}
The same polygons recoloured by a development-pressure index; only the sites at or above 50 stay lit.

### The flood footprint {metric=Designation show="1-in-100 flood extent"}
Switch on the 1-in-100 flood extent: the layer arrives with the step and leaves with it.

### What the water reaches {show="1-in-100 flood extent" highlight="flood_m >= 2" fit="flood_m >= 2"}
Only assets with at least 2 m of modelled flood depth stay lit, and the camera frames them.

### The wetland itself {metric=Designation fit="designation == 'Ramsar wetland'"}
`fit` frames every feature that matches a filter, so no coordinates are needed.

```block
type: map
title: Exposure as a density surface
basemap: offline
geojson:
- assets/showcase-exposure.geojson
heatmap: {weight: value_m, radius: 40, ramp: warm, points: true, label: Exposed value}
size_by: {property: flood_m, label: Flood depth, unit: m, color: "#2a7de1", min: 3, max: 12}
source: Illustrative exposure points.
text: '`heatmap` turns GeoJSON points into a density surface weighted by a property; `points: true` keeps the discs, and `size_by` sizes them (here by modelled flood depth). Illustrative data.'
```

## Moving pictures and sound   {eyebrow="Video and audio"}

```block
type: video
title: A video, from a file or a link
src: https://www.youtube.com/watch?v=dQw4w9WgXcQ
caption: 'A YouTube or Vimeo link embeds the player; an mp4/webm path plays natively, and `autoplay: true` loops it muted like a moving photo. Illustrative link.'
```

```block
type: audio
title: An audio clip
src: assets/tone.wav
text: Interviews, ambient sound, a read-aloud passage.
caption: A two-second test tone.
```

## A tour of places   {eyebrow="Map tour"}

```block
type: map-tour
source: 'Aerial photos: Who Owns the Albanian Coast. Coordinates are approximate.'
intro: Numbered places, each with a photo and a few words. Use the arrows (or the pins) to move the map from place to place.
```

### Narta and Zvërnec {center=19.4237892,40.5316622 zoom=13 image=assets/Narta-Zvernec.webp credit="Who Owns the Albanian Coast" alt="Aerial view of the Narta lagoon, outlined in blue, ringed by pine forest with land-parcel boundaries marked in orange"}
Lagoon, pine forest and dunes read as one coastal system.

### Vlorë port {center=19.4902,40.4467 zoom=14 image=assets/Puerto-de-Vlora.webp alt="Aerial view of Vlorë port crowded with boats and ships, with property lines traced in gold and red"}
The port, seen from above.

### Vlorë airport {center=19.4,40.6 zoom=12 image=assets/Aeropuerto-de-Vlora.webp alt="Aerial view of a long new airport runway on flat land, with the surrounding plots outlined"}
A proposed airport beside the lagoon. Coordinates are approximate and illustrative.

## A sequence in time   {eyebrow="Timeline"}

```block
type: timeline
intro: Dated events, in order, each with as much or as little as it needs.
```

### Draft {date="Step 1"}
Write the argument first, in prose.

### Choose formats {date="Step 2"}
For each claim, pick the format that shows it fastest.

### Check {date="Step 3" tag=Review}
Put the numbers in a table so a reader can check them.

<!-- end -->

## Follow one path through a process   {eyebrow="Process board"}

```block
type: process-board
intro: Pick an example and follow the steps it passed through. Illustrative.
phases:
- title: Collect
  nodes:
  - {id: a, title: Source data, text: Gather the inputs.}
  - {id: b, title: Clean, text: Fix what is broken.}
- title: Model
  nodes:
  - {id: c, title: Estimate, text: Fill the gaps.}
  - {id: d, title: Validate, text: Check against a reference.}
- title: Publish
  nodes:
  - {id: e, title: Review, text: Someone else reads it.}
  - {id: f, title: Release, text: It goes out.}
projects:
- {id: p1, name: Case one, path: [a, b, c, e, f], note: Straight through, with review.}
- {id: p2, name: Case two, path: [a, c, d, f], note: Skips cleaning; validated instead.}
- {id: p3, name: Case three, path: [a, b, d, e], note: Never released.}
```

```block
type: button
text: Read the authoring guide
href: https://github.com/
note: A call to action -- a link styled as a button.
```

```block
type: credits
title: About this page
items:
- label: Purpose
  html: A live reference for the story block catalog; all data is illustrative.
- label: Imagery
  html: Reused from the slider story, <a href="https://whoownsthealbaniancoast.com/" target="_blank" rel="noopener">Who Owns the Albanian Coast</a>.
logos:
- {src: assets/logo-partner-a.svg, alt: Partner A, href: "https://example.com/a"}
- {src: assets/logo-partner-b.svg, alt: Funder B}
```

## A chart that draws as you scroll   {eyebrow="Chart"}

```block
type: scroll-chart
caption: Illustrative figures -- a point with a `note` gets a stem and a legend entry.
points:
- {label: "2015", value: 12, note: Reform one}
- {label: "2016", value: 20}
- {label: "2017", value: 34}
- {label: "2018", value: 51}
- {label: "2019", value: 47}
- {label: "2020", value: 60}
- {label: "2021", value: 88, note: Reform two}
- {label: "2022", value: 120}
- {label: "2023", value: 150}
- {label: "2024", value: 96, note: Reform three}
```

## Big numbers, one at a time   {eyebrow="Stat cards"}

```block
type: stat-cards
```

Each `###` heading becomes a card; the number counts up while its card is on screen.

### Signature threshold {value=50,000 unit="signatures" tag="Illustrative"}
A prefix or suffix on the value (`$4.2M`, `12.5%`) is kept while it counts.

### Share of coast {value=12.5% unit="of the shoreline" tag="Illustrative"}
All figures on this page are made up.

```block
type: photo-scenes
mode: float
intro: A pinned full-bleed photo with one text card per scene.
scenes:
- title: Narta and Zvërnec
  tag: Lagoon
  image: assets/Narta-Zvernec.webp
  alt: Aerial view of a lagoon ringed by pine forest
  pos: bl
  accent: '#ef476f'
  text: Lagoon, dunes and forest read as one connected coastal system.
- title: Vlora
  tag: Harbour
  image: assets/Puerto-de-Vlora.webp
  alt: Aerial view of Vlora harbour
  pos: tr
  accent: '#f59e0b'
  text: A second scene replaces the first as you scroll.
```

## A table that drives a map   {eyebrow="Table + map"}

```block
type: table
intro: 'Pick a type, search, or page through; click a row and the map below flies there. A cell written `{label, chip: ok|warn|bad}` shows as a status chip.'
caption: Illustrative data.
filters: [Type]
page_size: 5
locate: {lon: Lon, lat: Lat, zoom: 15}
columns:
- Place
- Type
- {label: Lon, num: true}
- {label: Lat, num: true}
- Status
rows:
- [Old town, Market, 19.8187, 41.3275, {label: Open, chip: ok}]
- [Riverside, Park, 19.8250, 41.3300, {label: Flooded, chip: bad}]
- [Harbour, Port, 19.4500, 41.3200, {label: Partial, chip: warn}]
- [Hillside, Housing, 19.8100, 41.3350, {label: Open, chip: ok}]
- [Market hall, Market, 19.8200, 41.3260, {label: Open, chip: ok}]
- [Station, Transit, 19.8300, 41.3190, {label: Partial, chip: warn}]
- [Campus, School, 19.8050, 41.3220, Unknown]
- [Lagoon, Park, 19.4100, 40.9200, {label: Closed, chip: bad}]
```

```block
type: map
title: Every row of the table above
from_table: true
source: Illustrative table rows.
text: Each marker comes from a table row with coordinates; no GeoJSON needed.
```
