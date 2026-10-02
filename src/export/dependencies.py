"""
Classify what a story still needs at view time: which block types require the Flask
backend (so cannot be exported) and which otherwise-static blocks still reach the network
once exported (basemap tiles, 3D terrain/building tiles, and ``config``/``meta`` values that
load an external URL). Vendored libraries and fonts are not counted here -- :mod:`.vendor`
ships those with the site.
"""

import re
from urllib.parse import urlparse

from .config import LIVE_TYPES, LOADED_KEYS, MAP_TYPES


def live_blocks(story):
    """Block types in ``story`` that need the backend at view time."""
    found = set()
    for block in story["blocks"]:
        kind = block["type"]
        if kind in LIVE_TYPES or (
            kind == "swipe" and block["config"].get("mode") != "divider"
        ):
            found.add(kind)
    return sorted(found)


def _loaded_urls(value, key=None):
    if isinstance(value, dict):
        for k, v in value.items():
            yield from _loaded_urls(v, k)
    elif isinstance(value, list):
        for v in value:
            yield from _loaded_urls(v, key)
    elif (
        isinstance(value, str) and key in LOADED_KEYS and re.match(r"https?://", value)
    ):
        yield value


def _map_configs(kind, config):
    """The map camera configs a block's rendering touches: the block's own config for a
    ``MAP_TYPES`` block, or each authored-map ``swipe`` divider panel (a picture panel has no
    basemap)."""
    if kind in MAP_TYPES:
        yield config
    elif kind == "swipe" and config.get("mode", "data-lon") == "divider":
        for panel in (config.get("before"), config.get("after")):
            if isinstance(panel, dict) and "src" not in panel:
                yield panel


def remote_dependencies(story):
    """What ``story`` still fetches over the network once exported, as ``(block type, host)`` pairs
    (the vendored libraries and fonts are not counted -- those ship with the site)."""
    found = set()
    for block in story["blocks"]:
        kind, config = block["type"], block["config"]
        for map_config in _map_configs(kind, config):
            if map_config.get("basemap") != "offline":
                found.add(
                    (
                        kind,
                        "basemap tiles (tile.openstreetmap.org by default; "
                        "tiles.openfreemap.org as fallback; server.arcgisonline.com or "
                        "api.maptiler.com on request)",
                    )
                )
            if map_config.get("terrain"):
                found.add((kind, "3D terrain tiles (s3.amazonaws.com)"))
            if map_config.get("buildings"):
                found.add((kind, "3D building tiles (tiles.openfreemap.org)"))
        for url in _loaded_urls(config):
            found.add((kind, urlparse(url).netloc))
    for url in _loaded_urls(story.get("meta", {})):
        found.add(("meta", urlparse(url).netloc))
    return sorted(found)
