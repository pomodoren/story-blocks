"""Regression tests for defects found during the October 2026 code audit."""

from pathlib import Path

import pytest

from storyblocks.authoring import Story, StoryError
from storyblocks.blocks import BlockError, normalise_block
from storyblocks.export.rewrite import rewrite
from storyblocks.export.vendor import vendor_cdn


@pytest.mark.parametrize("name", ["../story.md", "nested/pic.png", r"nested\pic.png"])
def test_freeze_rejects_asset_path_traversal(name):
    story = Story("safe")

    with pytest.raises(StoryError, match="asset name must be a filename"):
        story.freeze(b"data", name)


def test_cdn_query_variants_get_distinct_files(tmp_path, monkeypatch):
    downloads = tmp_path / "downloads"
    downloads.mkdir()

    def download(url: str, _cache: Path) -> Path:
        target = downloads / str(len(list(downloads.iterdir())))
        target.write_text(url, encoding="utf-8")
        return target

    monkeypatch.setattr("storyblocks.export.vendor._download", download)
    urls = {
        "https://cdn.example.test/lib.js",
        "https://cdn.example.test/lib.js?v=1",
        "https://cdn.example.test/lib.js?v=2",
    }
    vendor = tmp_path / "vendor"

    mapping = vendor_cdn(urls, vendor, tmp_path / "cache")

    assert len(set(mapping.values())) == 3
    assert all((vendor / relative).is_file() for relative in mapping.values())
    rewritten = rewrite(" ".join(urls), "", mapping, fonts_css="fonts.css")
    assert "https://cdn.example.test" not in rewritten


@pytest.mark.parametrize("layers", ["not-a-list", ["not-a-mapping"]])
def test_map_layers_require_a_list_of_mappings(layers):
    with pytest.raises(BlockError, match="layer"):
        normalise_block({"type": "map", "config": {"title": "Map", "layers": layers}})


def test_ranking_top_rejects_boolean():
    with pytest.raises(BlockError, match="whole number"):
        normalise_block(
            {
                "type": "ranking",
                "config": {
                    "title": "Ranking",
                    "rows": [{"name": "A", "value": 1}],
                    "top": True,
                },
            }
        )
