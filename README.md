# Storyblocks

Write a story in Markdown, built from typed blocks (text, maps, charts, galleries, timelines, …),
and publish it as a static website. Pages use relative links, so they work on GitHub Pages,
object storage, or straight from disk.

## Quick start

```bash
git clone <repository-url> storyblocks
cd storyblocks
python -m pip install .

storyblocks build --content stories/                 # story.md -> story.yaml
storyblocks serve --content stories/                 # preview at http://localhost:9001
storyblocks export --content stories/ --out dist/site
storyblocks export --content stories/ --offline      # reject runtime network dependencies
python -m http.server -d dist/site 9100
```

The sample output of every publishable story is already in [`examples/site/`](examples/site/).

## A story is one folder

```
examples/stories/my-place/
  story.md        what you write: front matter + Markdown + block fences
  story.yaml      built from story.md (generated, committed)
  story.de.md     optional translation, served as my-place.de
  assets/         the story's images, audio, video and GeoJSON, used as `assets/photo.webp`
```

Stories never share files; copy an image into each folder that uses it. Pass the content root
to every command with `--content stories/`. `STORYBLOCKS_CONTENT` remains available to the
Python API, but the CLI requires the explicit option so it cannot export the wrong directory.

## Writing a story

````markdown
---
id: my-place
label: My Place
title: "{label}, one step at a time"
theme: editorial
---

```block
type: cover
text: A one-paragraph blurb in **Markdown**.
```

## What happened   {eyebrow="Context"}

Prose after a `##` heading becomes a text block.

> A quote line becomes a short interlude.

```block
type: map
geojson: [assets/area.geojson]
```
````

Run `storyblocks build --content stories/ my-place`, then
`storyblocks serve --content stories/` and open `/story/my-place`
(add `?draft=1` to preview an editor draft).

- **Which blocks exist?** `src/blocks/implementation.py` is the catalog. Start with the
  [`format-showcase`](examples/stories/format-showcase/story.md) example, which uses every
  static block, and see [dev/reference.md](dev/reference.md) for the syntax.
- **Static export** runs a preflight before creating output. It reports missing or invalid
  `story.yaml` artifacts, missing or cross-story assets, unsupported live blocks, and (with
  `--offline`) remote dependencies together. Rendering starts only when preflight succeeds.
- **Visual editor:** `storyblocks serve --content stories/`, then open `/story-editor/` (local use only).

## Where things are

| Path | What |
|---|---|
| `src/` | the engine: block catalog, authoring, Flask preview/editor, static exporter |
| `examples/stories/` | sample stories, one folder each |
| `examples/site/` | their static export |
| [dev/reference.md](dev/reference.md) | spine syntax, block catalog, editor |
| [dev/FEATURES.md](dev/FEATURES.md) | supported features and roadmap |
| [dev/bugs.csv](dev/bugs.csv) | known defects |
| [AGENTS.md](AGENTS.md) | contribution rules |

## Use from Python

```python
import os

from storyblocks import load_spine

os.environ["STORYBLOCKS_CONTENT"] = "examples/stories"
story = load_spine("examples/stories/my-place/story.md")
story.build()  # writes examples/stories/my-place/story.yaml
```

The core authoring modules do not import Flask, although Flask is installed by default so the
`serve` and `export` commands always work.

## Development

```bash
python -m pip install -e ".[dev]"
ruff check . && ruff format --check .   # lint + formatting (config in pyproject.toml)
python -m pytest -q                      # tests
```
