# AGENTS.md

## Purpose

Storyblocks is a Python library and CLI for authoring block-based communication products,
previewing them with Flask, and exporting portable static sites. Keep the engine in `src/`
independent from the product content in `examples/stories/`.

## Repository map

- `src/blocks/model.py`: `BlockType` and `BlockError`.
- `src/blocks/catalog/`: canonical block definitions and public lookup functions (`BLOCKS`,
  `get_block`, `normalise_block` in `__init__.py`), split by concern into sibling modules
  (`text.py`, `media.py`, `domain.py`, `maps.py`, `data.py`).
- `src/blocks/validators/`: block configuration validators and the `VALIDATORS` dispatch
  registry (`__init__.py`), with shared helpers in `common.py` and per-concern validators in
  sibling modules (`maps.py`, `media.py`, `data.py`, `text.py`).
- `src/authoring/`: Markdown parsing, serialization, artifact validation, and builds.
- `src/web/`: Flask preview/editor, Jinja templates, and browser assets.
- `src/export/`: static export, split by concern (`config.py` for defaults and classification
  constants, `dependencies.py` for live/remote-dependency reporting, `vendor.py` for CDN/font
  vendoring, `rewrite.py` for URL rewriting and the portability audit, `build.py` for preflight
  validation and build orchestration).
- `src/content.py`: explicit content-root and story-path handling.
- `src/config.py`: reader-facing configuration shared across the loader and web layer
  (themes, default theme, language display names).
- `src/registry.py`: discovers stories from built artifact metadata.
- `examples/stories/`: sample products, each in a self-contained folder.
- `examples/site/`: committed static export of publishable samples.
- `tests/`: unit, integration, rendering, security, and export regression tests.
- `dev/reference.md`: authoring and block syntax reference.
- `dev/code-standards.md`: code organization, style, typing, validation, security, and
  architecture conventions.
- `dev/FEATURES.md`: supported capabilities and roadmap.
- `dev/bugs.csv`: defect history and verification records.

## Required checks

Set up the development environment with:

```bash
python -m pip install -e ".[dev]"
```

Before handing off a code change, run:

```bash
ruff check .
ruff format --check .
mypy src
pytest -q
```

All four must report zero errors and zero warnings, not merely exit non-fatally. Do not
narrow a failing check's scope (excluding a file, dropping a selected rule, loosening a mypy
flag) to make it pass; fix the underlying code, or get sign-off before changing the check
itself. Suppressions (`# noqa`, `# type: ignore`) require the specific code
(`# noqa: F401`, `# type: ignore[attr-defined]`) and a trailing comment giving the reason;
a bare suppression is a lint failure in its own right.

For changes to templates, browser assets, URL handling, or export behavior, also run:

```bash
storyblocks export --content examples/stories deck-demo --out /tmp/storyblocks-site
```

The export must complete without audit failures. Do not commit caches, virtual environments,
`dist/`, vendor caches, or `story.draft.yaml` files.

## Code standards

Code organization, file size limits, Python style, typing and public-API rules, validation and
error handling, web/security practices, and architecture rules live in
[`dev/code-standards.md`](dev/code-standards.md). Read it before making a code change; it
applies alongside this file, not instead of it.

## Block changes

`src/blocks/catalog/` is the single source of truth for block definitions. When adding or
changing a block:

1. Update its catalog definition in the concern module it belongs to (`text.py`, `media.py`,
   `domain.py`, `maps.py` or `data.py`), or add a new concern module if none fits.
2. Add or update validation in the matching concern module under `src/blocks/validators/`.
3. Add or update `src/web/templates/stories/blocks/<type>.html`.
4. Add `src/web/static/story/blocks/<type>.js` only when client hydration is required.
5. Exercise the block in a public sample, normally
   `examples/stories/format-showcase/story.md`, unless it is intentionally unpublished.
6. Rebuild the affected `story.yaml` artifact.
7. Update `dev/reference.md` and `dev/FEATURES.md` when behavior changes.
8. Add focused tests for valid configuration, invalid boundaries, and normalization.

Keep plain fields escaped. Render only declared rich fields as Markdown/HTML. Validate URLs,
CSS-like values, nested item keys, numeric ranges, and enumerated choices before rendering.
Meaningful images require alt text; use `decorative: true` only for decorative media.

## Content contract

A content root contains one folder per product:

```text
<id>/
  story.md               # source of truth
  story.yaml             # generated and committed
  story.<lang>.md        # optional translation source
  story.<lang>.yaml      # generated translation artifact
  story.draft.yaml       # generated and uncommitted
  assets/                # media and GeoJSON owned by this product
```

Rules:

- Always pass the content root explicitly with `--content` in CLI examples and automation.
- Never hand-edit generated `story*.yaml` artifacts.
- After changing a spine, run `storyblocks build --content <root> <id>` and commit the adjacent
  artifact.
- Story assets must remain inside that story's `assets/` folder. Do not reference another story's
  files; copy genuinely shared media into each owner.
- Ignore directories whose names begin with `.` or `_`; these are private or draft content.
- Preserve deterministic serialization and spine round-tripping.

## Static export guarantees

- Export only after preflight validation succeeds.
- Never replace the last successful output until rendering, vendoring, rewriting, and audit all
  pass in a temporary directory.
- Internal links and asset URLs must be relative and work without directory-index routing.
- Vendor required application libraries and report remaining runtime network dependencies.
- `--offline` must reject any remaining remote dependency.
- Do not silently export a live block as a broken page; skip or fail with an actionable message.
- Keep generated output deterministic where source inputs are unchanged.

## Testing standards

- Add a regression test before fixing a reproducible defect.
- Test observable behavior and public contracts, not incidental implementation details.
- Cover the successful path, invalid boundary values, and the failure mode relevant to the change.
- Use temporary directories for generated files. Tests must not modify committed examples unless
  the test explicitly verifies the build artifact and restores all state.
- Mock external network and database boundaries; do not make tests depend on service availability.
- Keep security regression tests for path traversal, unsafe URLs/HTML, hostile uploads, malformed
  payloads, host validation, and output replacement.
- Keep sample-story gates: artifact freshness, round-trip parsing, rendering, asset ownership,
  public block coverage, and committed export coverage.

## Bug workflow

Use stable IDs such as `SB-001` in `dev/bugs.csv`. New defects start as `open`; use `in_progress`,
`blocked`, or `closed` as work advances. Record severity, reproduction, workaround, target, and
verification. Keep closed rows for history, and do not mark a bug closed without a regression test
or a concrete verification command.

## Definition of done

A change is complete when:

- The requested behavior works through its public interface.
- Ruff, formatting, mypy, and pytest pass.
- No touched file exceeds the row-count limits in
  [`dev/code-standards.md`](dev/code-standards.md#file-size-limits) without a tracked
  follow-up.
- Relevant static export completes and audits cleanly.
- Generated artifacts match their sources.
- Security and accessibility implications have been checked.
- User-facing behavior is documented.
- `dev/FEATURES.md` and `dev/bugs.csv` reflect any changed capability or defect status.
- No caches, temporary outputs, private drafts, secrets, or unrelated files are included.
