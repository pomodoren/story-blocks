"""The committed export in examples/site must still match what the stories produce."""

from pathlib import Path

from storyblocks import registry
from storyblocks.export import (
    LIVE_TYPES,  # noqa: F401  (import check: exporter is wired up)
)

SITE = Path(__file__).resolve().parents[1] / "examples" / "site"


def test_every_static_story_is_in_the_committed_export():
    exported = {p.parent.name for p in SITE.glob("*/index.html")}
    missing = {e["id"] for e in registry.EXAMPLES} - exported
    assert not missing, (
        f"re-run `storyblocks export --content examples/stories --out examples/site`: missing {sorted(missing)}"
    )


def test_gallery_cards_have_thumbnails_and_features():
    from storyblocks.loader import story_cards

    cards = {c["id"]: c for c in story_cards(registry.EXAMPLES)}
    assert cards["deck-demo"]["image"].endswith("Narta-Zvernec.webp")
    assert cards["format-showcase"]["features"]
    index = (SITE / "index.html").read_text(encoding="utf-8")
    assert 'class="story-tile-thumb"' in index
    assert '<img src="assets/stories/deck-demo/assets/' in index
    assert 'href="deck-demo/index.html"' in index


def test_gallery_has_navbar_filters_settings_and_explanations():
    index = (SITE / "index.html").read_text(encoding="utf-8")
    assert 'class="gallery-nav"' in index
    assert 'data-collection="Reference"' in index
    assert 'id="gallery-settings"' in index
    assert 'id="how-it-works"' in index and 'id="reading-the-numbers"' in index
    assert 'href="/story-editor/' not in index
    assert (SITE / "assets/story/gallery.js").is_file()


def test_gallery_cards_report_counts():
    from storyblocks.loader import story_cards

    card = next(c for c in story_cards(registry.EXAMPLES) if c["id"] == "deck-demo")
    assert card["block_count"] >= card["type_count"] >= 1
    assert card["section_count"] >= 1
    assert card["languages"] >= 1
    index = (SITE / "index.html").read_text(encoding="utf-8")
    assert 'class="gallery-summary"' in index
    assert 'class="story-tile-stats"' in index
