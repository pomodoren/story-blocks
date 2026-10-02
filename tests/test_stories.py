"""Spines are the source of truth: committed artifacts must match them, and they must round-trip."""

import pytest

from storyblocks import artifact
from storyblocks.authoring import dump_spine, load_spine
from storyblocks.content import built_path, spine_ids, spine_path

SPINES = spine_ids()


@pytest.mark.parametrize("spine", SPINES, ids=str)
def test_artifact_matches_spine(spine):
    built = load_spine(spine_path(spine)).to_dict()
    committed = artifact.loads(built_path(spine).read_text(encoding="utf-8"))
    assert built == committed, f"{spine}: spine changed -- run `storyblocks build`"


@pytest.mark.parametrize("spine", SPINES, ids=str)
def test_spine_round_trips(spine):
    story = load_spine(spine_path(spine))
    again = load_spine_from_text(dump_spine(story), spine_path(spine))
    assert again.to_dict() == story.to_dict()


def load_spine_from_text(text, original):
    copy = original.with_name(f"_roundtrip_{original.name}")
    copy.write_text(text, encoding="utf-8")
    try:
        return load_spine(copy)
    finally:
        copy.unlink()


def test_every_block_has_an_editor_palette_category():
    import re
    from pathlib import Path

    from storyblocks.blocks import BLOCKS

    js = (
        Path(__file__).resolve().parents[1] / "src/web/static/story/editor.js"
    ).read_text(encoding="utf-8")
    cats = re.search(r"const CATS = \{(.*?)\n  \};", js, re.S).group(1)
    assert [name for name in BLOCKS if f"'{name}'" not in cats] == []
