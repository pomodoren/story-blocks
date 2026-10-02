"""The ``network`` block: validation of nodes, edges, colours and layout."""

import pytest

from storyblocks.blocks import BlockError, normalise_block

NODES = [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}]
EDGES = [{"source": "a", "target": "b", "label": "knows"}]


def _network(**config):
    config = {"nodes": NODES, "edges": EDGES, **config}
    return normalise_block({"type": "network", "config": config})["config"]


def test_defaults_are_merged():
    config = _network()

    assert config["layout"] == "cose"
    assert config["search"] is True


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"nodes": [*NODES, {"id": "a", "label": "dup"}]}, "duplicate node id"),
        ({"nodes": [{"label": "no id"}]}, "needs an id"),
        ({"edges": [{"source": "a", "target": "zzz"}]}, "target is not a node id"),
        ({"nodes": [{"id": "a", "size": -1}, {"id": "b"}]}, "non-negative"),
        ({"edges": [{"source": "a", "target": "b", "weight": "heavy"}]}, "weight"),
        ({"colors": {"g": "red"}}, "must be hex"),
        ({"layout": "spiral"}, "layout must be one of"),
        ({"nope": 1}, "unknown config"),
    ],
)
def test_invalid_config_is_rejected(overrides, message):
    with pytest.raises(BlockError, match=message):
        _network(**overrides)


def test_numeric_ids_match_edges_by_string():
    config = _network(
        nodes=[{"id": 1, "label": "One"}, {"id": 2, "label": "Two"}],
        edges=[{"source": 1, "target": "2"}],
    )

    assert len(config["edges"]) == 1
