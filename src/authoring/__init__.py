"""
Build-time story-authoring library.

`storyblocks.authoring` is *not* imported by the running dashboard. ``storyblocks/authoring/build.py`` parses a
Markdown spine (``<content>/<id>/story.md``, via :mod:`~storyblocks.authoring.spine`) into a
:class:`Story` -- ``meta`` + a run of typed **blocks** -- and calls ``.build()``, which
writes ``<content>/<id>/story.yaml`` (``{meta, blocks}``) for the blueprint to serve.

Everything here is content assembly + validation against the block catalog
(:mod:`storyblocks.blocks`). Dependencies: the standard library, the block
catalog + icons, and ``PyYAML`` (spine front matter + fences).
"""

from ._validate import StoryError
from .spine import dump_spine, load_spine
from .story import Story, md

__all__ = [
    "Story",
    "StoryError",
    "dump_spine",
    "load_spine",
    "md",
]
