"""Story-level authoring guardrails: plain/rich field rules, cover placement, meta fields,
icons, item-list shape, and the non-fatal missing-alt-text warnings."""

import pytest

from storyblocks.authoring import StoryError
from storyblocks.authoring._validate import (
    ensure_plain,
    ensure_richtext,
    validate_story,
)

TEXT_BLOCK = {"type": "text", "config": {"body": "hello"}}


def _story(blocks, **meta):
    return validate_story({"id": "t", **meta}, blocks)


# ---- ensure_plain / ensure_richtext ----------------------------------------------------------


@pytest.mark.parametrize("value", ["<b>x</b>", "a &amp; b", "<script>x</script>", ""])
def test_ensure_plain_rejects_html_tags_entities_and_blanks(value):
    with pytest.raises(StoryError):
        ensure_plain("field", value)


def test_ensure_plain_accepts_literal_text():
    assert ensure_plain("field", "Rates & Risk - 2024") == "Rates & Risk - 2024"


def test_ensure_plain_rejects_non_strings():
    with pytest.raises(StoryError, match="non-empty string"):
        ensure_plain("field", None)


@pytest.mark.parametrize("value", ["", "   ", None, 5])
def test_ensure_richtext_rejects_blank_or_non_string_values(value):
    with pytest.raises(StoryError, match="non-empty string"):
        ensure_richtext("field", value)


def test_ensure_richtext_allows_html():
    assert ensure_richtext("field", "<p>ok</p>") == "<p>ok</p>"


# ---- block-level plain / rich enforcement, via validate_story ---------------------------------


def test_plain_field_with_html_fails_the_story():
    with pytest.raises(StoryError, match="autoescaped"):
        _story([{"type": "text", "config": {"eyebrow": "<b>x</b>", "body": "hi"}}])


def test_rich_field_accepts_html():
    warnings = _story([{"type": "text", "config": {"body": "<p>hi</p>"}}])
    assert warnings == []


def test_unknown_block_type_is_reported_with_position():
    with pytest.raises(StoryError, match=r"block 1 \('bogus'\)"):
        _story([{"type": "bogus", "config": {}}])


def test_block_config_errors_are_wrapped_as_story_errors():
    with pytest.raises(StoryError, match="missing required config"):
        _story([{"type": "text", "config": {}}])


# ---- story shape: id, at most one cover, cover first ------------------------------------------


def test_story_needs_an_id():
    with pytest.raises(StoryError, match="needs an 'id'"):
        validate_story({}, [TEXT_BLOCK])


def test_story_needs_at_least_one_block():
    with pytest.raises(StoryError, match="at least one block"):
        _story([])


def test_at_most_one_cover_block():
    cover = {"type": "cover", "config": {"title": "T"}}
    with pytest.raises(StoryError, match="at most one"):
        _story([cover, cover])


def test_cover_must_be_first():
    cover = {"type": "cover", "config": {"title": "T"}}
    with pytest.raises(StoryError, match="must be first"):
        _story([TEXT_BLOCK, cover])


def test_single_leading_cover_is_accepted():
    cover = {"type": "cover", "config": {"title": "T"}}
    assert _story([cover, TEXT_BLOCK]) == []


# ---- meta fields ------------------------------------------------------------------------------


@pytest.mark.parametrize("accent", ["#fff", "#ffffff", "#ABCDEF"])
def test_valid_accent_colors_are_accepted(accent):
    assert _story([TEXT_BLOCK], accent=accent) == []


@pytest.mark.parametrize("accent", ["red", "#ff", "ffffff", "#gggggg"])
def test_invalid_accent_colors_are_rejected(accent):
    with pytest.raises(StoryError, match="accent"):
        _story([TEXT_BLOCK], accent=accent)


@pytest.mark.parametrize("key", ["logo", "logo_link"])
def test_meta_logo_fields_must_be_site_paths_or_http(key):
    with pytest.raises(StoryError, match="http"):
        _story([TEXT_BLOCK], **{key: "javascript:alert(1)"})
    assert _story([TEXT_BLOCK], **{key: "/logo.png"}) == []


def test_meta_collection_is_plain_text():
    with pytest.raises(StoryError, match="autoescaped"):
        _story([TEXT_BLOCK], collection="<b>x</b>")


# ---- icon validation ----------------------------------------------------------------------


def test_unknown_icon_is_rejected():
    with pytest.raises(StoryError, match="unknown icon"):
        _story([{"type": "text", "config": {"body": "hi", "icon": "not-a-real-icon"}}])


def test_known_icon_is_accepted():
    from storyblocks.icons import ICONS

    icon = next(iter(ICONS))
    assert _story([{"type": "text", "config": {"body": "hi", "icon": icon}}]) == []


# ---- heading level ------------------------------------------------------------------------


@pytest.mark.parametrize("level", [0, 7, -1, "2", True])
def test_heading_level_must_be_an_integer_from_1_to_6(level):
    with pytest.raises(StoryError, match="level"):
        _story([{"type": "heading", "config": {"text": "H", "level": level}}])


def test_heading_level_defaults_to_2():
    assert _story([{"type": "heading", "config": {"text": "H"}}]) == []


# ---- credits items / logos -----------------------------------------------------------------


def test_credits_items_need_label_and_html():
    with pytest.raises(StoryError, match=r"needs \{label, html\}"):
        _story([{"type": "credits", "config": {"items": [{"label": "a"}]}}])


def test_credits_logo_rejects_unsafe_src_and_unknown_keys():
    def story(logo):
        return _story(
            [
                {
                    "type": "credits",
                    "config": {"items": [{"label": "a", "html": "b"}], "logos": [logo]},
                }
            ]
        )

    with pytest.raises(StoryError, match="src"):
        story({"src": "javascript:alert(1)", "alt": "x"})
    with pytest.raises(StoryError, match="needs"):
        story({"src": "/x.svg", "alt": "x", "bogus": 1})
    with pytest.raises(StoryError, match="http"):
        story({"src": "/x.svg", "alt": "x", "href": "javascript:alert(1)"})


# ---- item-list validation (guided-tour steps, map-tour places, ...) --------------------------


def test_items_block_needs_a_non_empty_list():
    with pytest.raises(StoryError, match="missing required config"):
        _story([{"type": "guided-tour", "config": {"steps": []}}])


def test_item_rejects_unknown_keys():
    with pytest.raises(StoryError, match="unknown key"):
        _story(
            [{"type": "guided-tour", "config": {"steps": [{"title": "x", "zom": 1}]}}]
        )


def test_item_focus_must_be_a_mapping():
    with pytest.raises(StoryError, match="'focus' must be a mapping"):
        _story(
            [
                {
                    "type": "map-tour",
                    "config": {"places": [{"title": "x", "focus": "nope"}]},
                }
            ]
        )


@pytest.mark.parametrize(
    "stats",
    ["not-a-list", [{"label": "no value"}], [{"value": 1, "bogus": 2}]],
)
def test_item_stats_must_be_a_list_of_value_label_mappings(stats):
    with pytest.raises(StoryError, match="'stats' must be"):
        _story(
            [
                {
                    "type": "guided-tour",
                    "config": {"steps": [{"title": "x", "stats": stats}]},
                }
            ]
        )


def test_item_stats_accepts_value_and_optional_label():
    assert (
        _story(
            [
                {
                    "type": "guided-tour",
                    "config": {
                        "steps": [
                            {"title": "x", "stats": [{"value": "12", "label": "pop"}]}
                        ]
                    },
                }
            ]
        )
        == []
    )


@pytest.mark.parametrize("key", ["image", "alt_image"])
def test_item_image_fields_must_look_like_urls(key):
    with pytest.raises(StoryError, match="expected a /path"):
        _story(
            [
                {
                    "type": "photo-scenes",
                    "config": {"scenes": [{"title": "x", key: "no-scheme"}]},
                }
            ]
        )


def test_item_pos_must_be_a_known_token():
    with pytest.raises(StoryError, match="pos: expected one of"):
        _story(
            [
                {
                    "type": "photo-scenes",
                    "config": {"scenes": [{"title": "x", "pos": "center"}]},
                }
            ]
        )


@pytest.mark.parametrize("accent", ["red", "#abc", "var(--brand)"])
def test_item_accent_accepts_names_hex_and_css_vars(accent):
    assert (
        _story(
            [
                {
                    "type": "photo-scenes",
                    "config": {"scenes": [{"title": "x", "accent": accent}]},
                }
            ]
        )
        == []
    )


def test_item_accent_rejects_free_css():
    with pytest.raises(StoryError, match="accent: expected"):
        _story(
            [
                {
                    "type": "photo-scenes",
                    "config": {
                        "scenes": [{"title": "x", "accent": "red; background: url(x)"}]
                    },
                }
            ]
        )


def test_stat_cards_require_a_value_on_every_card():
    with pytest.raises(StoryError, match="needs a 'value'"):
        _story([{"type": "stat-cards", "config": {"cards": [{"title": "x"}]}}])


# ---- missing alt-text warnings (non-fatal) -----------------------------------------------------


def test_image_card_without_alt_or_decorative_warns():
    warnings = _story(
        [{"type": "image-card", "config": {"src": "/a.png", "explanation": "x"}}]
    )
    assert len(warnings) == 1
    assert "alt text" in warnings[0]


def test_image_card_with_decorative_true_has_no_warning():
    warnings = _story(
        [
            {
                "type": "image-card",
                "config": {"src": "/a.png", "explanation": "x", "decorative": True},
            }
        ]
    )
    assert warnings == []


def test_item_image_without_alt_warns_with_its_index():
    warnings = _story(
        [
            {
                "type": "gallery",
                "config": {
                    "images": [{"src": "/a.png"}, {"src": "/b.png", "alt": "B"}]
                },
            }
        ]
    )
    assert len(warnings) == 1
    assert "images[0]" in warnings[0]
