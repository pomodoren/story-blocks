"""Validators for the map and map-tour block family: ``map``, ``map-tour``, ``guided-tour``,
``deck-tour`` and ``buildings-3d`` -- basemap mode, authored layers, choropleth / filter data
and the tour-specific extras.
"""

import re

from ..model import BlockError
from .common import HEX_COLOR, check_color_by, check_filter

BASEMAP_MODES = {"online", "offline"}
LAYER_KINDS = {"geojson", "arcgis-feature", "raster", "arcgis-tiles", "wms", "vector"}
MAP_3D_BLOCKS = ("map", "map-tour", "guided-tour", "deck-tour", "buildings-3d")
TOUR_BLOCKS = ("guided-tour", "deck-tour")


def _check_guided_tour_view(name, merged, given):
    if "view" not in given and (merged.get("geojson") or merged.get("layers")):
        merged["view"] = "none"  # authored data: no live domain view


def _check_basemap(name, merged, given):
    if merged.get("basemap", "online") not in BASEMAP_MODES:
        raise BlockError(
            f"block {name!r}: basemap must be one of {sorted(BASEMAP_MODES)}, got {merged['basemap']!r}"
        )


def _check_layers(name, merged, given):
    layers = merged.get("layers") or []
    if not isinstance(layers, list):
        raise BlockError(f"block {name!r}: layers must be a list of mappings")
    for layer in layers:
        if not isinstance(layer, dict):
            raise BlockError(
                f"block {name!r}: a layer must be a mapping, got {layer!r}"
            )
        kind = layer.get("kind", "geojson")
        if kind not in LAYER_KINDS or (name in TOUR_BLOCKS and kind != "geojson"):
            raise BlockError(
                f"block {name!r}: layer kind {kind!r} not in "
                f"{['geojson'] if name in TOUR_BLOCKS else sorted(LAYER_KINDS)}"
            )
        source = (
            layer.get("tiles")
            if kind in ("raster", "vector")
            else layer.get("url") or layer.get("geojson")
        )
        for url in (
            [] if source is None else [source] if isinstance(source, str) else source
        ):
            if not str(url).startswith(("/", "http://", "https://")):
                raise BlockError(
                    f"block {name!r}: layer {layer.get('label')!r} needs an http(s) url or site path, got {url!r}"
                )
        if source is None:
            raise BlockError(
                f"block {name!r}: layer {layer.get('label')!r} ({kind}) needs a source url"
            )
        if kind == "vector" and not str(layer.get("source_layer") or "").strip():
            raise BlockError(
                f"block {name!r}: layer {layer.get('label')!r} (vector) needs a source_layer "
                "(the layer name inside the vector tiles, e.g. a pg_tileserv/Martin table name)"
            )


def _check_map_data(name, merged, given):
    if merged.get("filter"):
        check_filter(merged["filter"], "map")
    if not merged.get("color_by"):
        return
    specs = (
        merged["color_by"]
        if isinstance(merged["color_by"], list)
        else [merged["color_by"]]
    )
    if not specs:
        raise BlockError("block 'map': color_by list is empty")
    checked = [check_color_by(spec, "map") for spec in specs]
    if len(checked) > 1 and not all(spec.get("label") for spec in checked):
        raise BlockError(
            "block 'map': every color_by entry needs a label when there are several (they become the chips)"
        )
    merged["color_by"] = checked if isinstance(merged["color_by"], list) else checked[0]


def _check_webmap(name, merged, given):
    if merged.get("webmap") and not re.fullmatch(
        r"[0-9a-f]{32}|https://[\w.-]+/(?:sharing/rest/content/items|home/item\.html\?id=)[/=]?[0-9a-f]{32}\S*",
        str(merged["webmap"]),
    ):
        raise BlockError(
            f"block {name!r}: webmap must be an ArcGIS item id or item URL, got {merged['webmap']!r}"
        )


def check_tour_data(config, block="guided-tour"):
    """Validate the authored-data side of a ``guided-tour``: ``color_by`` metrics, ``layers`` and the
    per-step ``metric`` / ``highlight`` / ``fit`` / ``show`` that refer back to them."""

    metrics = config.get("color_by")
    labels = set()
    if metrics:
        specs = metrics if isinstance(metrics, list) else [metrics]
        checked = [check_color_by(spec, block) for spec in specs]
        if len(checked) > 1 and not all(spec.get("label") for spec in checked):
            raise BlockError(
                f"block {block!r}: every color_by entry needs a label when there are several (a step picks one by label)"
            )
        labels = {spec.get("label") or spec["property"] for spec in checked}
        config["color_by"] = checked if isinstance(metrics, list) else checked[0]
    layer_labels = {layer.get("label") for layer in config.get("layers") or []}
    if None in layer_labels or "" in layer_labels:
        raise BlockError(
            f"block {block!r}: every layer needs a label (a step shows it by name)"
        )
    for step in config.get("steps") or []:
        where = f"step {step.get('title')!r}"
        if step.get("metric") is not None and step["metric"] not in labels:
            raise BlockError(
                f"block {block!r}: {where} metric {step['metric']!r} is not a color_by label {sorted(labels)}"
            )
        for key in ("highlight", "fit"):
            if step.get(key) is not None:
                check_filter(step[key], f"{block} {where} {key}")
        if step.get("symbols") not in (None, "on", "off"):
            raise BlockError(
                f"block {block!r}: {where} symbols must be 'on' or 'off', got {step['symbols']!r}"
            )
        if step.get("show") is not None:
            unknown = [
                n.strip()
                for n in str(step["show"]).split(",")
                if n.strip() not in layer_labels
            ]
            if unknown:
                raise BlockError(
                    f"block {block!r}: {where} show names unknown layers {unknown} (have {sorted(layer_labels)})"
                )


def check_deck_tour(config):
    """Validate the ``deck-tour`` extras: no ``terrain``, ``fields``, per-step ``select``."""

    if config.get("terrain"):
        raise BlockError(
            "block 'deck-tour': terrain is not supported (the deck.gl layers would not follow the relief)"
        )
    for name, spec in (config.get("fields") or {}).items():
        if not isinstance(spec, dict) or set(spec) - {"label", "unit", "sum", "hide"}:
            raise BlockError(
                f"block 'deck-tour': fields.{name} must be a mapping of label / unit / sum / hide"
            )
    for sp in config.get("color_by") or []:
        sp = sp if isinstance(sp, dict) else {}
        scale = sp.get("height_scale")
        if scale is not None and (
            isinstance(scale, bool) or not isinstance(scale, (int, float)) or scale <= 0
        ):
            raise BlockError(
                "block 'deck-tour': color_by height_scale must be a positive number"
            )
    for step in config.get("steps") or []:
        if step.get("select") is not None:
            check_filter(step["select"], f"deck-tour step {step.get('title')!r} select")


def check_buildings_3d(config):
    """Validate ``buildings-3d``: the ``height`` / ``base`` property names, ``height_scale``,
    ``orbit``, ``color`` and the optional ``color_by`` metric (one: the viewer has no steps).

    Raises:
        BlockError: when any of those keys has the wrong shape.
    """

    for key in ("height", "base"):
        if key in config and not (isinstance(config[key], str) and config[key].strip()):
            raise BlockError(
                f"block 'buildings-3d': {key} must be a property name, got {config[key]!r}"
            )
    scale = config.get("height_scale")
    if scale is not None and (
        isinstance(scale, bool) or not isinstance(scale, (int, float)) or scale <= 0
    ):
        raise BlockError("block 'buildings-3d': height_scale must be a positive number")
    if not isinstance(config.get("orbit", False), bool):
        raise BlockError(
            f"block 'buildings-3d': orbit must be true or false, got {config['orbit']!r}"
        )
    files = config["geojson"]
    if isinstance(files, str):
        files = [files]
    if not files or not all(isinstance(f, str) and f.strip() for f in files):
        raise BlockError(
            "block 'buildings-3d': geojson must be a file or a list of files"
        )
    color = config.get("color")
    if color is not None and not (
        isinstance(color, str) and HEX_COLOR.fullmatch(color)
    ):
        raise BlockError(
            f"block 'buildings-3d': color must be a #hex colour, got {color!r}"
        )
    metric = config.get("color_by")
    if metric is not None:
        if isinstance(metric, list):
            raise BlockError(
                "block 'buildings-3d': color_by takes one metric, not a list"
            )
        config["color_by"] = check_color_by(metric, "buildings-3d")
