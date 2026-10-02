"""Authored-data maps: guided-tour data steps, size_by and heatmap validation."""

import pytest

from storyblocks.blocks import BlockError, get_block

TOUR = {
    "geojson": ["/story-assets/stories/x/assets/a.geojson"],
    "color_by": [
        {"property": "kind", "label": "Kind", "categories": {"a": "#111111"}},
        {"property": "score", "label": "Score"},
    ],
    "layers": [
        {"label": "Flood", "geojson": "/story-assets/stories/x/assets/f.geojson"}
    ],
    "steps": [
        {
            "title": "One",
            "metric": "Score",
            "highlight": "score >= 5",
            "fit": "kind == a",
            "show": "Flood",
        }
    ],
}


def norm(name, **config):
    return get_block(name).normalise(config)


def test_authored_tour_defaults_to_no_live_view():
    assert norm("guided-tour", **TOUR)["view"] == "none"
    assert norm("guided-tour", steps=[{"title": "x"}])["view"] == "risk"
    assert norm("guided-tour", **{**TOUR, "view": "risk"})["view"] == "risk"


@pytest.mark.parametrize(
    "step",
    [
        {"title": "x", "metric": "Nope"},
        {"title": "x", "highlight": "not a filter"},
        {"title": "x", "fit": "also bad"},
        {"title": "x", "show": "Flood, Missing"},
    ],
)
def test_tour_step_references_are_checked(step):
    with pytest.raises(BlockError):
        norm("guided-tour", **{**TOUR, "steps": [step]})


def test_tour_layers_are_geojson_only_and_labelled():
    with pytest.raises(BlockError, match="layer kind"):
        norm(
            "guided-tour",
            **{
                **TOUR,
                "layers": [
                    {"label": "T", "kind": "raster", "tiles": ["/t/{z}/{x}/{y}.png"]}
                ],
            },
        )
    with pytest.raises(BlockError, match="needs a label"):
        norm("guided-tour", **{**TOUR, "layers": [{"geojson": "/x.geojson"}]})


def test_vector_layer_needs_tiles_and_source_layer():
    cfg = norm(
        "map",
        title="t",
        layers=[
            {
                "label": "Parcels",
                "kind": "vector",
                "tiles": ["/t/public.parcels/{z}/{x}/{y}.pbf"],
                "source_layer": "public.parcels",
            }
        ],
    )
    assert cfg["layers"][0]["source_layer"] == "public.parcels"
    with pytest.raises(BlockError, match="source_layer"):
        norm(
            "map",
            title="t",
            layers=[
                {"label": "Parcels", "kind": "vector", "tiles": ["/t/{z}/{x}/{y}.pbf"]}
            ],
        )
    with pytest.raises(BlockError, match="source url"):
        norm(
            "map",
            title="t",
            layers=[
                {"label": "Parcels", "kind": "vector", "source_layer": "public.parcels"}
            ],
        )


@pytest.mark.parametrize("name", ["map", "guided-tour"])
def test_size_by_and_heatmap_are_normalised(name):
    extra = {"steps": [{"title": "x"}]} if name == "guided-tour" else {"title": "t"}
    cfg = norm(name, size_by="value", heatmap="value", **extra)
    assert cfg["size_by"] == {"property": "value"}
    assert cfg["heatmap"] == {"weight": "value"}
    assert norm(name, heatmap=True, **extra)["heatmap"] == {}


@pytest.mark.parametrize(
    "bad",
    [
        {"size_by": {"property": "v", "min": 10, "max": 5}},
        {"size_by": {"property": "v", "color": "red"}},
        {"size_by": {"property": "v", "bogus": 1}},
        {"heatmap": {"radius": -1}},
        {"heatmap": {"ramp": "rainbow"}},
        {"heatmap": 5},
    ],
)
def test_bad_point_styles_are_rejected(bad):
    with pytest.raises(BlockError):
        norm("map", title="t", **bad)


DECK = {
    "geojson": ["/story-assets/stories/x/assets/a.geojson"],
    "color_by": [{"property": "v", "label": "V", "height": "v", "height_scale": 2}],
    "steps": [
        {
            "title": "One",
            "metric": "V",
            "select": "name ~ x",
            "focus": {"pitch": 60, "bearing": -20},
        }
    ],
}


def test_deck_tour_accepts_heights_select_and_camera():
    cfg = norm("deck-tour", **DECK)
    assert "basemap" not in cfg
    assert cfg["color_by"][0]["height_scale"] == 2


@pytest.mark.parametrize(
    "bad",
    [
        {"basemap": "osm"},
        {"basemap": "dark"},
        {"terrain": True},
        {"pitch": 120},
        {"fields": {"v": {"colour": "red"}}},
        {"color_by": [{"property": "v", "label": "V", "height_scale": 0}]},
        {"steps": [{"title": "x", "select": "not a filter"}]},
        {"steps": [{"title": "x", "metric": "Nope"}]},
    ],
)
def test_deck_tour_rejects_bad_config(bad):
    with pytest.raises(BlockError):
        norm("deck-tour", **{**DECK, **bad})


def test_deck_tour_needs_data():
    with pytest.raises(BlockError, match="missing required"):
        norm("deck-tour", steps=[{"title": "x"}])
