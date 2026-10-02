"""Block validators without their own focused test file: ranking, chart, button, video,
audio, embed, divider style normalization, swipe's divider-mode panels, and the shared
`filter` expression grammar."""

import pytest

from storyblocks.blocks import BlockError, normalise_block


def _block(block_type, **config):
    return normalise_block({"type": block_type, "config": config})["config"]


# ---- ranking -----------------------------------------------------------------------------


def test_ranking_fills_defaults_and_accepts_rows():
    config = _block(
        "ranking",
        title="Top",
        rows=[{"name": "A", "value": 3}, {"name": "B", "value": 1}],
    )
    assert config["sort"] == "desc"
    assert config["rows"][0]["name"] == "A"


def test_ranking_accepts_metrics_with_their_own_labelled_rows():
    config = _block(
        "ranking",
        title="Top",
        metrics=[
            {"label": "2024", "rows": [{"name": "A", "value": 1}]},
            {"label": "2025", "rows": [{"name": "A", "value": 2}]},
        ],
    )
    assert [m["label"] for m in config["metrics"]] == ["2024", "2025"]


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"sort": "random"}, "sort must be"),
        ({"top": 0}, "whole number"),
        ({"top": -1}, "whole number"),
        ({"rows": []}, "non-empty rows list"),
        ({"rows": [{"name": "", "value": 1}]}, "needs a name"),
        ({"rows": [{"name": "A", "value": -1}]}, "non-negative"),
        ({"rows": [{"name": "A", "value": "lots"}]}, "non-negative"),
        ({"rows": [{"name": "A", "value": True}]}, "non-negative"),
        ({"metrics": [{"rows": [{"name": "A", "value": 1}]}]}, "needs a label"),
        ({"metrics": [{"label": "2024", "rows": []}]}, "non-empty rows list"),
    ],
)
def test_ranking_rejects_invalid_config(overrides, message):
    base = {"title": "Top", "rows": [{"name": "A", "value": 1}]}
    with pytest.raises(BlockError, match=message):
        _block("ranking", **{**base, **overrides})


# ---- chart --------------------------------------------------------------------------------


def test_chart_accepts_variants_with_labels_and_series():
    config = _block(
        "chart",
        labels=["a", "b"],
        series=[{"name": "S", "data": [1, 2]}],
        variants=[{"label": "V1", "series": [{"name": "S2", "data": [3, 4]}]}],
    )
    assert config["variants"][0]["label"] == "V1"


@pytest.mark.parametrize(
    "variant",
    [
        {"series": [{"name": "S", "data": [1]}]},
        {"label": "V1"},
        {"label": "V1", "series": []},
        "not-a-mapping",
    ],
)
def test_chart_rejects_incomplete_variants(variant):
    with pytest.raises(BlockError, match="every variant needs a label and series"):
        _block(
            "chart",
            labels=["a"],
            series=[{"name": "S", "data": [1]}],
            variants=[variant],
        )


# ---- button -------------------------------------------------------------------------------


@pytest.mark.parametrize("href", ["/path", "#anchor", "http://e.org", "https://e.org"])
def test_button_accepts_site_relative_and_http_hrefs(href):
    assert _block("button", text="Go", href=href)["href"] == href


@pytest.mark.parametrize("href", ["javascript:alert(1)", "mailto:a@b.com", "ftp://x"])
def test_button_rejects_other_schemes(href):
    with pytest.raises(BlockError, match="href must be"):
        _block("button", text="Go", href=href)


# ---- video / audio --------------------------------------------------------------------------


@pytest.mark.parametrize("name", ["video", "audio"])
def test_media_blocks_reject_unsafe_src_schemes(name):
    with pytest.raises(BlockError, match="src must be"):
        _block(name, src="javascript:alert(1)")


@pytest.mark.parametrize(
    "src, embed_url",
    [
        (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "youtube-nocookie.com/embed/dQw4w9WgXcQ",
        ),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube-nocookie.com/embed/dQw4w9WgXcQ"),
        (
            "https://www.youtube.com/shorts/dQw4w9WgXcQ",
            "youtube-nocookie.com/embed/dQw4w9WgXcQ",
        ),
        ("https://vimeo.com/12345678", "player.vimeo.com/video/12345678"),
        ("https://vimeo.com/video/12345678", "player.vimeo.com/video/12345678"),
    ],
)
def test_video_block_detects_youtube_and_vimeo_links(src, embed_url):
    config = _block("video", src=src)
    assert config["embed_url"] is not None
    assert embed_url in config["embed_url"]


def test_video_block_leaves_plain_files_unembedded():
    config = _block("video", src="/assets/clip.mp4")
    assert config["embed_url"] is None


def test_audio_block_has_no_embed_url_key():
    config = _block("audio", src="/assets/clip.mp3")
    assert "embed_url" not in config


# ---- embed --------------------------------------------------------------------------------


@pytest.mark.parametrize("src", ["/dashboard", "https://dash.example.com"])
def test_embed_accepts_site_paths_and_http_urls(src):
    assert _block("embed", src=src)["src"] == src


def test_embed_rejects_unsafe_src():
    with pytest.raises(BlockError, match="src must be"):
        _block("embed", src="javascript:alert(1)")


# ---- divider / button style normalisation --------------------------------------------------


@pytest.mark.parametrize(
    "value, expected",
    [
        ("line", ["line"]),
        ("line dots", ["line", "dots"]),
        ("line, dots", ["line", "dots"]),
        (["line", "dots"], ["line", "dots"]),
        (["line dots"], ["line", "dots"]),
        ("line line", ["line"]),
        (None, []),
    ],
)
def test_divider_style_is_normalised_to_a_deduplicated_list(value, expected):
    config = _block("divider", style=value) if value is not None else _block("divider")
    assert config["style"] == (expected or ["line"])


def test_divider_rejects_unknown_style_tokens():
    with pytest.raises(BlockError, match="unknown style"):
        _block("divider", style="zigzag")


def test_divider_rejects_non_string_style():
    with pytest.raises(BlockError, match="style must be"):
        _block("divider", style=5)


def test_button_style_accepts_several_tokens_and_rejects_unknown_ones():
    config = _block("button", text="Go", href="/x", style="primary large")
    assert config["style"] == ["primary", "large"]
    with pytest.raises(BlockError, match="unknown style"):
        _block("button", text="Go", href="/x", style="primary huge")


# ---- filter expression grammar (shared by map / guided-tour / deck-tour) --------------------


@pytest.mark.parametrize("op", ["==", "!=", ">", ">=", "<", "<=", "~"])
def test_filter_accepts_every_supported_operator(op):
    config = _block(
        "guided-tour",
        steps=[{"title": "x", "highlight": f"pop {op} 5"}],
    )
    assert config["steps"][0]["highlight"] == f"pop {op} 5"


def test_filter_accepts_multiple_terms_joined_with_and():
    config = _block(
        "guided-tour",
        steps=[{"title": "x", "highlight": "pop >= 5 and kind == school"}],
    )
    assert "and" in config["steps"][0]["highlight"]


@pytest.mark.parametrize(
    "expr",
    ["not a filter", "1pop == 5", "pop >", ""],
)
def test_filter_rejects_malformed_expressions(expr):
    with pytest.raises(BlockError):
        _block("guided-tour", steps=[{"title": "x", "highlight": expr}])


def test_filter_rejects_non_string_expressions():
    with pytest.raises(BlockError, match="filter must be a string"):
        _block("guided-tour", steps=[{"title": "x", "highlight": 5}])


# ---- swipe ---------------------------------------------------------------------------------


def _swipe(mode, before, after, **extra):
    return _block(
        "swipe",
        title="Compare",
        mode=mode,
        before=before,
        after=after,
        labels=["Before", "After"],
        **extra,
    )


def test_swipe_rejects_unknown_mode():
    with pytest.raises(BlockError, match="mode must be"):
        _swipe("wipe", {"src": "/a.jpg", "alt": "A"}, {"src": "/b.jpg", "alt": "B"})


def test_swipe_data_lon_mode_does_not_validate_panel_shape():
    # data-lon panels are scenario specs ({view, magnitude}), not pictures or maps
    config = _swipe(
        "data-lon",
        {"view": "risk", "magnitude": "min"},
        {"view": "risk", "magnitude": "max"},
    )
    assert config["mode"] == "data-lon"


def test_swipe_divider_accepts_two_pictures():
    config = _swipe(
        "divider",
        {"src": "/before.jpg", "alt": "Before"},
        {"src": "/after.jpg", "decorative": True},
    )
    assert config["before"]["src"] == "/before.jpg"
    assert config["after"]["decorative"] is True


def test_swipe_divider_picture_needs_alt_or_decorative():
    with pytest.raises(BlockError, match="alt text"):
        _swipe("divider", {"src": "/before.jpg"}, {"src": "/after.jpg", "alt": "After"})


def test_swipe_divider_picture_rejects_unknown_keys():
    with pytest.raises(BlockError, match="unknown picture config"):
        _swipe(
            "divider",
            {"src": "/b.jpg", "alt": "B", "caption": "x"},
            {"src": "/a.jpg", "alt": "A"},
        )


def test_swipe_divider_accepts_an_authored_map_panel():
    config = _swipe(
        "divider",
        {
            "geojson": ["/story-assets/stories/x/assets/a.geojson"],
            "color_by": "kind",
        },
        {"src": "/after.jpg", "alt": "After"},
    )
    assert config["after"]["src"] == "/after.jpg"
    assert config["before"]["color_by"]["property"] == "kind"


def test_swipe_divider_map_panel_needs_content_or_camera():
    with pytest.raises(BlockError, match="needs src"):
        _swipe("divider", {}, {"src": "/after.jpg", "alt": "After"})


def test_swipe_divider_map_panel_rejects_unknown_keys():
    with pytest.raises(BlockError, match="unknown map config"):
        _swipe(
            "divider",
            {"markers": [{"center": [1, 2]}], "oops": True},
            {"src": "/a.jpg", "alt": "A"},
        )


def test_swipe_divider_map_panel_validates_nested_basemap():
    with pytest.raises(BlockError, match="basemap must be"):
        _swipe(
            "divider",
            {"center": [1, 2], "basemap": "weird"},
            {"src": "/a.jpg", "alt": "A"},
        )


def test_swipe_divider_map_panel_validates_webmap_format():
    with pytest.raises(BlockError, match="webmap must be"):
        _swipe("divider", {"webmap": "not-an-id"}, {"src": "/a.jpg", "alt": "A"})


def test_swipe_divider_map_panel_validates_3d_pitch_range():
    with pytest.raises(BlockError, match="pitch must be"):
        _swipe(
            "divider",
            {"center": [1, 2], "pitch": 120},
            {"src": "/a.jpg", "alt": "A"},
        )


def test_swipe_divider_rejects_non_mapping_panel():
    with pytest.raises(BlockError, match="must be a mapping"):
        _swipe("divider", "not-a-panel", {"src": "/a.jpg", "alt": "A"})
