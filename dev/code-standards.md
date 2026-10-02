# Code standards

Engineering conventions for code in `src/` and its browser assets and templates. `AGENTS.md`
covers repository structure, required checks, and content/process workflows; this file covers how
code itself is written and organized. Both apply to every change.

## Code organization

Use this order inside Python modules:

1. Module docstring.
2. Standard-library imports.
3. Third-party imports.
4. Local imports.
5. Module-level constants.
6. Data classes, protocols, type aliases, and exceptions.
7. Public functions and classes.
8. Private helpers.
9. Dispatch tables or registries that depend on previously defined callables.
10. CLI entry-point guard, when applicable.

Additional rules:

- Group all ordinary constants directly after imports; use `UPPER_CASE` names.
- A registry may remain near the bottom only when constructing it requires functions defined in
  the same module. Add a short comment explaining that dependency.
- Organize modules by responsibility, not vague layers. Prefer names such as `catalog`, `model`,
  and `validators` over `implementation`, `abstract`, `helpers`, or `utils`.
- Keep the public API in package `__init__.py` files small and deliberate.
- Avoid circular imports and import-time filesystem writes, network requests, or application
  creation.
- Do not introduce compatibility wrappers unless a supported public import requires one.

## File size limits

Treat these row counts (the whole file, comments and blank lines included) as the refactor
trigger, measured with `wc -l`:

| File type | Max rows |
|---|---|
| Python (`.py`) | 400 |
| JavaScript (`.js`) | 400 |
| HTML/Jinja (`.html`) | 300 |
| CSS (`.css`) | 500 |
| Any other script or source file | 400 |

Rules:

- A file that exceeds its limit must be split: when a Python file passes 400 rows (or any other
  file type passes its row limit above), separate it by responsibility in the same change rather
  than letting it keep growing.
- These are maximums, not targets. A file well under its limit needs no preemptive splitting;
  see Architecture rules on avoiding speculative abstraction.
- When a change pushes a file over its limit, refactor it in that same change by extracting a
  cohesive concern into a sibling file, following Code organization's "organize by
  responsibility" rule. Do not dodge the limit by moving code without a real responsibility
  boundary, and do not shrink the count by deleting comments or collapsing lines.
- If splitting the file is out of scope for the current change, do not grow it further; file a
  row in `bugs.csv` referencing the file and tracking the split instead.
- This limit is enforced through code review, not an automated check; `ruff`, `mypy`, and
  `pytest` do not gate on file size.
- `src/authoring/spine.py`, `src/web/static/story/story.js`, `src/web/static/story/lib.js`, and
  `src/web/static/story/core.css` already exceed their limit as of this rule's introduction. Do
  not add further growth to them; shrink them toward the limit as you touch them.
  `src/blocks/catalog.py` and `src/blocks/validators.py` were split this way too (`SB-019`,
  closed): each is now a package (`src/blocks/catalog/`, `src/blocks/validators/`) with block
  definitions and validators grouped by concern (maps, media, domain, data, text) into sibling
  modules, none over the limit. `src/static_site.py` was split the same way: it is now the
  `src/export/` package, grouped by concern (`config`, `dependencies`, `vendor`, `rewrite`,
  `build`), none over the limit.

## Python style

- Target Python 3.10 or newer and follow the Ruff configuration in `pyproject.toml`.
- Use 4-space indentation and an 88-character target line length. Long prose or data literals may
  exceed it where splitting would reduce readability.
- Use descriptive `snake_case` names, `PascalCase` classes, and `UPPER_CASE` constants.
- Prefer guard clauses over deeply nested branches.
- Keep functions focused. Extract a helper when it gives a rule a meaningful name or removes
  duplication; do not fragment straightforward logic into one-line helpers.
- Use comprehensions only while they remain easier to read than an explicit loop.
- Use immutable defaults. Never use a mutable object as a parameter default.
- Use `pathlib.Path` for filesystem paths and context managers for files and resources.
- Avoid wildcard imports, dead code, commented-out code, and broad utility modules.
- `print` is reserved for a CLI command's own user-facing progress or summary output (e.g.
  `storyblocks build`/`export`'s per-story lines); never leave it, or any other debugging output
  (`pdb`, ad hoc `repr` dumps), in request-handling (Flask) code or in validators and other
  shared library internals that do not themselves implement a CLI command.
- No `TODO`/`FIXME`/`XXX` comments. File a row in `bugs.csv` or open an issue and reference its
  ID in the comment instead, so deferred work stays tracked instead of silently rotting.
- Comments should explain constraints or intent, not restate the next line.

## Types and public APIs

- Annotate every new or changed function, method, and class attribute — public and private.
  A changed function with an incomplete signature does not pass review; finish annotating it
  rather than leaving the gap for the next change to find.
- Give every parameter a concrete type and every mutable generic its type arguments
  (`dict[str, object]`, `list[Path]`, never a bare `dict` or `list`); use `T | None` instead of
  an implicit optional.
- Avoid `Any`. Contain it at the specific boundary where untyped framework or parsed data enters
  (a YAML/JSON load, a Flask request object) and give the surrounding function a precise
  signature; `Any` must not leak past that boundary into callers.
- A function body mypy cannot check (an unannotated def) is not exempt from correctness; prefer
  annotating it over relying on `check_untyped_defs` to merely report what it finds.
- Public functions and classes need concise docstrings describing behavior. Document parameters,
  return values, and exceptions when they are not evident from the signature.
- Do not change a public import, CLI option, artifact field, or block configuration silently.
  Update documentation and add a compatibility or migration plan when required.

## Validation and errors

- Validate data at the boundary where it enters the system: spine parsing, block normalization,
  editor requests, and export preflight.
- Validators should be deterministic and free of filesystem, network, Flask, or rendering side
  effects. They may normalize the supplied configuration only when that transformation is part of
  the documented block contract.
- Raise `BlockError` for block configuration problems and `StoryError` for story-level authoring
  problems. Error messages must identify the block or field and explain the accepted shape.
- Library code must raise exceptions rather than terminate the process.
- CLI code may convert known exceptions into concise messages and non-zero exit codes.
- Never use a bare `except` or silently suppress unexpected exceptions. Catch the specific
  exception type you can act on; `except Exception` is only acceptable at a documented top-level
  boundary (a CLI entry point, a Flask error handler) that must stay up, and it must re-raise or
  log anything it did not expect, never discard it.
- Preserve the original exception as the cause when translating errors unless exposing it would
  leak sensitive data.

## Web and security

- Keep top-level and authoring imports framework-neutral; Flask belongs under `src/web/` or static
  export code.
- Treat all authored strings, uploaded filenames, URLs, JSON, and YAML as untrusted input.
- Escape plain template fields by default. Any use of `|safe`, `innerHTML`, or raw style values
  requires validation or sanitization at the boundary and a regression test.
- Reject path traversal before joining paths. Uploaded files must never overwrite existing files.
- Keep the editor local-only. Preserve loopback host checks, same-origin checks, upload restrictions,
  and sandboxed asset responses.
- Do not log secrets, credentials, private content, or URLs containing tokens.
- Browser code must support keyboard use, reduced motion, and meaningful accessible labels.

## Architecture rules

- Core authoring and static-native blocks must work without a database or host application.
- Keep domain-specific live APIs outside the framework-neutral core.
- Prefer authored static data when a feature should survive static export.
- Preserve the stable top-level API exposed by `storyblocks.__init__` and
  `storyblocks.blocks.__init__`.
- Prefer explicit dependencies and data flow over global mutable state. Environment configuration
  must be read through the content/configuration boundary rather than cached unpredictably.
- Avoid speculative abstractions. Introduce a new layer only when it removes demonstrated
  duplication or establishes a necessary boundary.
