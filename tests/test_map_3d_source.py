"""3D map keys (pitch, bearing, terrain, buildings) and the map data `source` credit."""

import pytest

from storyblocks.blocks import BlockError, normalise_block
from storyblocks.export import remote_dependencies
from storyblocks.web.app import create_app


def _map(**config):
    return normalise_block({"type": "map", "config": {"title": "T", **config}})


@pytest.mark.parametrize("block", ["map", "map-tour", "guided-tour"])
def test_3d_keys_are_accepted_on_every_map_block(block):
    config = {"pitch": 60, "bearing": -20, "terrain": True, "buildings": True}
    if block == "map-tour":
        config["places"] = [{"title": "A", "focus": {"center": [1, 2]}}]
    if block == "guided-tour":
        config["steps"] = [{"title": "A"}]
    out = normalise_block({"type": block, "config": {"title": "T", **config}})
    assert out["config"]["pitch"] == 60


@pytest.mark.parametrize(
    "bad",
    [
        {"pitch": 90},
        {"pitch": -1},
        {"pitch": "steep"},
        {"bearing": True},
        {"terrain": 0},
        {"terrain": 11},
        {"terrain": "yes"},
        {"buildings": "yes"},
    ],
)
def test_invalid_3d_keys_are_rejected(bad):
    with pytest.raises(BlockError):
        _map(**bad)


def test_terrain_accepts_an_exaggeration():
    assert _map(terrain=2.5)["config"]["terrain"] == 2.5


def test_3d_options_are_reported_as_remote_dependencies():
    story = {
        "meta": {},
        "blocks": [
            {
                "type": "map",
                "config": {"basemap": "offline", "terrain": True, "buildings": True},
            }
        ],
    }
    hosts = {host for _, host in remote_dependencies(story)}
    assert hosts == {
        "3D terrain tiles (s3.amazonaws.com)",
        "3D building tiles (tiles.openfreemap.org)",
    }


def test_source_is_rendered_under_the_map_as_inline_markdown():
    client = create_app().test_client()
    html = client.get("/story/format-showcase").get_data(as_text=True)
    assert 'class="sb__map-source"' in html
    assert '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' in html


def _buildings(**config):
    return normalise_block(
        {
            "type": "buildings-3d",
            "config": {"title": "T", "geojson": "assets/b.geojson", **config},
        }
    )


def test_buildings_3d_fills_defaults():
    config = _buildings()["config"]
    assert (config["height"], config["pitch"], config["legend"]) == ("height", 55, True)


def test_buildings_3d_accepts_a_full_config():
    config = _buildings(
        height="h",
        base="z0",
        height_scale=1.3,
        color="#abc",
        orbit=True,
        terrain=True,
        color_by={"property": "risk", "categories": {"low": "#38bdf8"}},
    )["config"]
    assert config["color_by"]["property"] == "risk"


@pytest.mark.parametrize(
    "bad",
    [
        {"geojson": []},
        {"geojson": [""]},
        {"height": ""},
        {"base": 3},
        {"height_scale": 0},
        {"height_scale": True},
        {"orbit": "yes"},
        {"color": "red"},
        {"color_by": [{"property": "a"}]},
        {"color_by": {"property": "a", "classes": 1}},
        {"buildings": True},
        {"pitch": 90},
    ],
)
def test_invalid_buildings_3d_config_is_rejected(bad):
    with pytest.raises(BlockError):
        _buildings(**bad)


def test_buildings_3d_requires_geojson():
    with pytest.raises(BlockError):
        normalise_block({"type": "buildings-3d", "config": {"title": "T"}})


def test_buildings_3d_reports_basemap_and_terrain_dependencies():
    story = {
        "meta": {},
        "blocks": [{"type": "buildings-3d", "config": {"terrain": True}}],
    }
    hosts = {host for _, host in remote_dependencies(story)}
    assert "3D terrain tiles (s3.amazonaws.com)" in hosts
