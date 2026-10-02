"""Validators for authored-data blocks: ``table``, ``ranking``, ``network`` and ``chart``."""

from ..model import BlockError
from .common import HEX_COLOR

NETWORK_LAYOUTS = ("cose", "concentric", "breadthfirst", "circle", "grid")
CHIP_TONES = ("ok", "warn", "bad")


def check_table(config):
    """``filters`` / ``locate`` must name real columns; ``page_size`` a positive integer."""

    labels = [c.get("label") if isinstance(c, dict) else c for c in config["columns"]]
    for name in config.get("filters") or []:
        if name not in labels:
            raise BlockError(f"block 'table': filters column {name!r} not in {labels}")
    size = config.get("page_size")
    if size is not None and (
        not isinstance(size, int) or isinstance(size, bool) or size < 1
    ):
        raise BlockError(
            f"block 'table': page_size must be a positive integer, got {size!r}"
        )
    locate = config.get("locate")
    if locate is not None:
        if not isinstance(locate, dict) or not {"lon", "lat"} <= set(locate) <= {
            "lon",
            "lat",
            "zoom",
        }:
            raise BlockError(
                "block 'table': locate must be {lon, lat[, zoom]} (column labels)"
            )
        for key in ("lon", "lat"):
            if locate[key] not in labels:
                raise BlockError(
                    f"block 'table': locate.{key} column {locate[key]!r} not in {labels}"
                )
    for row in config["rows"]:
        if len(row) != len(labels):
            raise BlockError(
                f"block 'table': row {row!r} has {len(row)} cells, expected {len(labels)}"
            )
        for cell in row:
            if isinstance(cell, dict):
                if not isinstance(cell.get("label"), str) or set(cell) - {
                    "label",
                    "chip",
                }:
                    raise BlockError(
                        f"block 'table': a cell mapping is {{label, chip}}, got {cell!r}"
                    )
                if cell.get("chip") not in (None, *CHIP_TONES):
                    raise BlockError(
                        f"block 'table': chip {cell['chip']!r} not in {list(CHIP_TONES)}"
                    )


def check_ranking(config):
    """``ranking`` needs ``rows`` or ``metrics``; every row a name and a non-negative number."""

    def check_rows(rows, where):
        if not isinstance(rows, list) or not rows:
            raise BlockError(f"block 'ranking': {where} needs a non-empty rows list")
        for row in rows:
            value = row.get("value") if isinstance(row, dict) else None
            if (
                not isinstance(row, dict)
                or not str(row.get("name") or "").strip()
                or isinstance(value, bool)
                or not isinstance(value, (int, float))
                or value < 0
            ):
                raise BlockError(
                    f"block 'ranking': {where} row {row!r} needs a name and a non-negative numeric value"
                )

    if config.get("sort") not in ("desc", "asc", "none"):
        raise BlockError(
            f"block 'ranking': sort must be desc / asc / none, got {config.get('sort')!r}"
        )
    top = config.get("top")
    if top is not None and not (
        isinstance(top, int) and not isinstance(top, bool) and top >= 1
    ):
        raise BlockError(
            f"block 'ranking': top must be a whole number >= 1, got {top!r}"
        )
    if config.get("metrics"):
        for metric in config["metrics"]:
            if not isinstance(metric, dict) or not metric.get("label"):
                raise BlockError("block 'ranking': every metric needs a label")
            check_rows(metric.get("rows"), f"metric {metric.get('label')!r}")
    else:
        check_rows(config.get("rows"), "the block")


def check_network(config):
    """Validate a ``network`` block's nodes, edges and layout.

    Raises:
        BlockError: on a duplicate or missing node id, an edge naming an unknown node,
            a negative or non-numeric size or weight, a non-hex colour or an unknown
            layout.
    """

    def check_color(value, where):
        if value is not None and not (
            isinstance(value, str) and HEX_COLOR.fullmatch(value)
        ):
            raise BlockError(
                f"block 'network': {where} colour must be hex, got {value!r}"
            )

    def check_number(value, where):
        if value is not None and (
            isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0
        ):
            raise BlockError(
                f"block 'network': {where} must be a non-negative number, got {value!r}"
            )

    ids = set()
    for node in config["nodes"]:
        if not isinstance(node, dict):
            raise BlockError(f"block 'network': a node is a mapping, got {node!r}")
        node_id = node.get("id")
        if not isinstance(node_id, (str, int)) or not str(node_id).strip():
            raise BlockError(f"block 'network': node {node!r} needs an id")
        if str(node_id) in ids:
            raise BlockError(f"block 'network': duplicate node id {node_id!r}")
        ids.add(str(node_id))
        check_number(node.get("size"), f"node {node_id!r} size")
        check_color(node.get("color"), f"node {node_id!r}")
    for edge in config["edges"]:
        if not isinstance(edge, dict):
            raise BlockError(f"block 'network': an edge is a mapping, got {edge!r}")
        for end in ("source", "target"):
            if str(edge.get(end)) not in ids:
                raise BlockError(
                    f"block 'network': edge {edge!r} {end} is not a node id"
                )
        check_number(edge.get("weight"), f"edge {edge!r} weight")
    for group, color in (config.get("colors") or {}).items():
        check_color(color, f"group {group!r}")
    if config.get("layout") not in NETWORK_LAYOUTS:
        raise BlockError(
            f"block 'network': layout must be one of {list(NETWORK_LAYOUTS)}, "
            f"got {config.get('layout')!r}"
        )


def _check_chart_variants(name, merged, given):
    for variant in merged.get("variants") or []:
        if (
            not isinstance(variant, dict)
            or not variant.get("label")
            or not variant.get("series")
        ):
            raise BlockError("block 'chart': every variant needs a label and series")
