"""
Compile Markdown spines (``<content>/<id>/story.md``) into built artifacts
(``story.yaml`` beside it). No database, no preview: ``build()`` only serialises and validates.

    python -m storyblocks.authoring.build                  # every spine
    python -m storyblocks.authoring.build my-place          # just one (by story id)
    python -m storyblocks.authoring.build --draft my-place  # -> <content>/my-place/story.draft.yaml (?draft=1)
"""

import sys
from pathlib import Path

from ..content import content_dir, spine_ids, spine_path
from .spine import load_spine


def build_one(name: str, *, draft: bool = False) -> None:
    spine = spine_path(name)
    if not spine.is_file():
        sys.exit(f"no spine for {name!r} in {content_dir()}")
    story = load_spine(spine)
    written = story.build(publish=not draft)
    for warning in story.warnings:
        print(f"    ! {warning}")
    try:
        shown = written.relative_to(Path.cwd())
    except ValueError:
        shown = written
    print(
        f"  {name:22} -> {shown}  ({len(story.to_dict()['blocks'])} blocks{', draft' if draft else ''})"
    )


def main(argv: list[str]) -> int:
    draft = "--draft" in argv
    names = [a for a in argv if a != "--draft"]
    if draft and not names:
        sys.exit("--draft needs at least one story id")
    for name in names or spine_ids():
        build_one(name, draft=draft)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
