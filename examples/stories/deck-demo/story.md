---
id: deck-demo
label: Story as a slide deck
title: A story that is also a talk
theme: midnight
collection: Reference
accent: "#2a7de1"
---

## A story that is also a talk   {eyebrow="Demo · slide-deck mode"}

```block
type: cover
image: assets/Narta-Zvernec.webp
image_credit: Photo reused from the slider story · Who Owns the Albanian Coast
text: 'Press **Present** and this page becomes a slide deck. Every block is a slide; each section is a column. **All figures are illustrative.** Try `→`, `↓`, `O`, `F`, `B`, `?`.'
```

# Section 1 · Navigate   {eyebrow="Sections"}

A `cover` or a level-1/2 heading opens a **section**. Press `→` to jump to the next one.

## Two kinds of movement   {eyebrow="Text"}

`←` `→` move between sections. `↑` `↓` and Space walk every slide in order. `Home` and `End` jump to the ends.

```block
type: callout
tone: note
title: Deep links
text: 'The address bar tracks `#/N` while presenting, so any slide can be linked. Opening `?present` starts the deck straight away.'
```

```block
type: quote
text: A deck is just a story you are allowed to interrupt.
cite: A presenter's rule
source: Illustrative
```

# Section 2 · Show   {eyebrow="Figures"}

```block
type: kpi
figures:
- value: "17"
  label: Block types
  text: Counted up on entry.
- value: "5"
  unit: "keys"
  label: To drive a talk
  text: Arrows, O, F, B, ?
- value: "100"
  unit: "%"
  label: Static-publishable
  text: Except live embeds.
```

```block
type: chart
kind: hbar
labels: ["Text", "Chart", "Table", "Map", "Code", "Embed"]
series:
- name: Slides in this talk
  data: [4, 1, 1, 1, 2, 1]
unit: slides
source: Illustrative data.
text: Charts, tables and maps are authored inline, so they work in a deck without any server.
```

```block
type: table
columns:
- Key
- {label: Does, num: false}
rows:
- ["O", "Overview grid of every slide"]
- ["F", "Fullscreen"]
- ["B", "Blackout the screen"]
- ["?", "Show the shortcuts"]
- ["Esc", "Close, then exit"]
caption: Search and sort still work while presenting.
```

```block
type: map
title: A map is a slide too
markers:
- title: Narta lagoon
  text: Click a marker for its card.
  center: [19.4237892, 40.5316622]
legend:
- {label: Example marker, color: "#e01e26"}
source: Illustrative marker.
text: Maps are slides too; drag and zoom them during the talk.
```

# Section 3 · Tell   {eyebrow="Code and live pages"}

```block
type: code
title: A slide is a block
language: yaml
code: |
  type: callout
  tone: note
  title: Deep links
  text: 'Any block can be a slide.'
caption: Code is shown literally, never interpreted.
```

```block
type: embed
title: A live page inside a slide
src: /story/format-showcase
height: 65
caption: An embed frames any http(s) page or site path. It needs the network, so it is skipped in the static export.
```

```block
type: timeline
intro: How the talk would run.
```

### Open {date="0:00" tag=Intro}
Cover slide, then press `→`.

### Show {date="0:05" tag=Demo}
Figures, chart, table, map.

### Tell {date="0:15" tag=Wrap}
Code, a live page, questions.

```block
type: credits
items:
- label: Format
  html: 'Illustrative demo of the story deck mode; no real data.'
```
