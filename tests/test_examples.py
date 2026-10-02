"""The sample stories in examples/stories are the living spec: every one must load and render,
every asset it points at must exist, and every block type should be shown by one."""

import re
from pathlib import Path

import pytest
from flask import render_template

from storyblocks import registry
from storyblocks.blocks import BLOCKS
from storyblocks.content import assets_dir
from storyblocks.loader import load_story
from storyblocks.web.app import create_app

IDS = [e["id"] for e in registry.EXAMPLES]
ASSET = re.compile(r"/story-assets/stories/([^/]+)/assets/([^\s'\"),\]]+)")


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


def _story(story_id):
    return load_story(
        story_id, next(e for e in registry.EXAMPLES if e["id"] == story_id)
    )


def test_registry_is_not_empty():
    assert IDS


def test_empty_gallery_uses_current_build_command():
    with create_app().test_request_context("/stories/"):
        html = render_template(
            "stories/gallery.html", active="story", title="Stories", cards=[]
        )
    assert "storyblocks build" in html
    assert "make stories" not in html


@pytest.mark.parametrize("story_id", IDS)
def test_story_renders(client, story_id):
    assert _story(story_id) is not None
    assert client.get(f"/story/{story_id}").status_code == 200


@pytest.mark.parametrize("story_id", IDS)
def test_story_assets_exist(client, story_id):
    html = client.get(f"/story/{story_id}").get_data(as_text=True)
    for owner, name in set(ASSET.findall(html)):
        assert owner == story_id, (
            f"{story_id} uses {owner}'s assets -- keep each story self-contained"
        )
        assert (assets_dir(story_id) / name).is_file(), (
            f"{story_id}: missing assets/{name}"
        )


def test_every_public_block_type_is_exercised():
    used = {b["type"] for i in IDS for b in _story(i)["blocks"]}
    unpublished = {
        "buildings-3d",
        "deck-tour",
        "exposure-map",
        "exposure-stats",
        "hazard",
        "risk",
        "swipe",
        "taxonomy-map",
        "taxonomy-stats",
        "vulnerability",
    }
    assert set(BLOCKS) - used <= unpublished, (
        f"public examples do not exercise: {sorted(set(BLOCKS) - used - unpublished)}"
    )


def test_immersive_map_is_opt_in_per_slide():
    static = Path(__file__).resolve().parents[1] / "src" / "web" / "static" / "story"
    script = (static / "story.js").read_text(encoding="utf-8")
    css = (static / "core.css").read_text(encoding="utf-8")

    assert "const mapped = wants || Boolean(scene && scene.base)" in script
    assert "if (!wants) return" in script
    assert "story-immersive.imm-map #story-scene" in css


def test_settings_button_is_labelled_and_squarish():
    static = Path(__file__).resolve().parents[1] / "src" / "web" / "static" / "story"
    script = (static / "story.js").read_text(encoding="utf-8")
    css = (static / "core.css").read_text(encoding="utf-8")

    assert 'aria-hidden="true">⚙</span> Settings' in script
    assert ".story-settings-btn { display: inline-flex" in css
    assert "border-radius: 8px" in css


def test_language_switcher_is_available_in_reader_settings():
    script = (
        Path(__file__).resolve().parents[1]
        / "src"
        / "web"
        / "static"
        / "story"
        / "story.js"
    ).read_text(encoding="utf-8")

    assert "document.querySelectorAll('.story-langs a')" in script
    assert 'for="ssLanguage">Language' in script
    assert "window.location.assign(language.value)" in script


def test_section_colour_shift_is_a_persisted_reader_setting():
    static = Path(__file__).resolve().parents[1] / "src" / "web" / "static" / "story"
    script = (static / "story.js").read_text(encoding="utf-8")
    css = (static / "core.css").read_text(encoding="utf-8")

    assert 'data-pref="sectionTint"' in script
    assert "!!prefs.sectionTint" in script
    assert "root.dataset.sectionTone = String(current % 4)" in script
    assert "body.story-section-tint" in css


def test_table_options_are_validated():
    import pytest

    from storyblocks.blocks import BlockError, normalise_block

    base = {
        "columns": ["A", {"label": "Lon", "num": True}, "Lat"],
        "rows": [["x", "1", "2"]],
    }
    ok = normalise_block(
        {
            "type": "table",
            "config": {
                **base,
                "filters": ["A"],
                "page_size": 5,
                "locate": {"lon": "Lon", "lat": "Lat"},
            },
        }
    )
    assert ok["config"]["page_size"] == 5
    for bad in (
        {"filters": ["Nope"]},
        {"page_size": 0},
        {"locate": {"lon": "Lon", "lat": "Nope"}},
    ):
        with pytest.raises(BlockError):
            normalise_block({"type": "table", "config": {**base, **bad}})


def test_credits_logos_need_alt_text():
    import pytest

    from storyblocks.authoring import StoryError
    from storyblocks.authoring._validate import validate_story

    def story(logo):
        return validate_story(
            {"id": "t"},
            [
                {
                    "type": "credits",
                    "config": {"items": [{"label": "a", "html": "b"}], "logos": [logo]},
                }
            ],
        )

    story({"src": "/x.svg", "alt": "Partner"})
    with pytest.raises(StoryError, match="alt"):
        story({"src": "/x.svg"})


def test_map_block_reports_skipped_webmap_layers():
    from pathlib import Path

    # shared by the `map` block and each `swipe` divider-mode map panel -- see S.paintMap
    js = (
        Path(__file__).resolve().parents[1] / "src/web/static/story/lib.js"
    ).read_text(encoding="utf-8")
    assert "skipped.push(" in js and "sb__map-note" in js
