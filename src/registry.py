"""
The case studies the app builds its ``/story/<id>`` walkthroughs from: one per story folder in
the content directory (see :mod:`.content`), described by the ``meta`` of its built artifact.

- ``label`` -- the place's name (``{label}`` in the story's text).
- ``iso3`` -- exposure data in PostGIS (the ``exposure-*`` / ``taxonomy-*`` blocks).
- ``scenario_slug`` -- a database-free scenario on disk (vulnerability, hazard, risk blocks).

Either can be empty: a story with neither is entirely static, and each live block shows its own
"not available for this example" state instead of pretending to have data.
"""

from . import artifact
from .content import built_path, story_ids


def _load():
    examples = []
    for story_id in story_ids():
        meta = artifact.loads(built_path(story_id).read_text(encoding="utf-8")).get(
            "meta", {}
        )
        examples.append(
            {
                "id": story_id,
                "label": meta.get("label") or story_id,
                "iso3": meta.get("iso3"),
                "scenario_slug": meta.get("scenario"),
            }
        )
    return examples


def __getattr__(name):
    """``EXAMPLES`` is computed on access, so new builds and content-root changes show up."""

    if name == "EXAMPLES":
        return _load()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
