"""Validation helpers shared by more than one block concern (maps, media): filter
expressions, ``color_by`` choropleth specs, exposure-style point layers (``size_by`` /
``heatmap``) and the 3D camera / relief keys.
"""

import re

from ..model import BlockError

#: One term of a ``filter`` expression: ``property op value`` (terms are joined with ``and``).
#: Mirrors ``parseFilter`` in static/story/lib.js.
FILTER_TERM = re.compile(r"^\s*([A-Za-z_][\w .-]*?)\s*(==|!=|>=|<=|>|<|~)\s*(.+?)\s*$")
HEX_COLOR = re.compile(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})")
RAMP_NAMES = ("teal", "warm", "blue", "diverging")


def check_filter(expr, block):
    """Raise ``BlockError`` unless ``expr`` is ``"prop op value [and prop op value ...]"``."""

    if not isinstance(expr, str):
        raise BlockError(
            f"block {block!r}: filter must be a string like \"pop >= 1000 and kind == 'school'\""
        )
    for term in re.split(r"\s+and\s+", expr, flags=re.IGNORECASE):
        if not FILTER_TERM.match(term):
            raise BlockError(
                f"block {block!r}: cannot read filter term {term!r} (use: property op value; ops == != > >= < <= ~)"
            )


def check_color_by(spec, block):
    """Validate ``color_by`` (a property name, or a mapping) and return it as a mapping."""

    if isinstance(spec, str):
        spec = {"property": spec}
    if not isinstance(spec, dict) or not str(spec.get("property") or "").strip():
        raise BlockError(f"block {block!r}: color_by needs a property name")
    unknown = set(spec) - {
        "property",
        "classes",
        "breaks",
        "ramp",
        "categories",
        "label",
        "unit",
        "height",
        "height_scale",
    }
    if unknown:
        raise BlockError(f"block {block!r}: unknown color_by keys {sorted(unknown)}")
    classes = spec.get("classes")
    if classes is not None and not (isinstance(classes, int) and 2 <= classes <= 9):
        raise BlockError(
            f"block {block!r}: color_by classes must be a whole number from 2 to 9, got {classes!r}"
        )
    breaks = spec.get("breaks")
    if breaks is not None and (
        not isinstance(breaks, list)
        or not breaks
        or any(isinstance(b, bool) or not isinstance(b, (int, float)) for b in breaks)
        or breaks != sorted(breaks)
    ):
        raise BlockError(
            f"block {block!r}: color_by breaks must be a non-empty ascending list of numbers, got {breaks!r}"
        )
    ramp = spec.get("ramp")
    if ramp is not None:
        ok = (
            ramp in RAMP_NAMES
            if isinstance(ramp, str)
            else (
                isinstance(ramp, list)
                and len(ramp) >= 2
                and all(isinstance(c, str) and HEX_COLOR.fullmatch(c) for c in ramp)
            )
        )
        if not ok:
            raise BlockError(
                f"block {block!r}: color_by ramp must be one of {list(RAMP_NAMES)} or a list of 2+ #hex colours, got {ramp!r}"
            )
    categories = spec.get("categories")
    if categories is not None and (
        not isinstance(categories, dict)
        or not categories
        or not all(
            isinstance(c, str) and HEX_COLOR.fullmatch(c) for c in categories.values()
        )
    ):
        raise BlockError(
            f"block {block!r}: color_by categories must map each value to a #hex colour"
        )
    return spec


def check_point_styles(config, block):
    """Validate ``size_by`` / ``heatmap`` (exposure-style point layers) and normalise both to mappings."""

    size_by = config.get("size_by")
    if size_by is not None:
        if isinstance(size_by, str):
            size_by = {"property": size_by}
        if (
            not isinstance(size_by, dict)
            or not str(size_by.get("property") or "").strip()
        ):
            raise BlockError(f"block {block!r}: size_by needs a property name")
        unknown = set(size_by) - {"property", "min", "max", "color", "label", "unit"}
        if unknown:
            raise BlockError(f"block {block!r}: unknown size_by keys {sorted(unknown)}")
        lo, hi = size_by.get("min", 4), size_by.get("max", 24)
        if (
            not all(
                isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0
                for v in (lo, hi)
            )
            or lo >= hi
        ):
            raise BlockError(
                f"block {block!r}: size_by min / max must be positive numbers with min < max"
            )
        if size_by.get("color") is not None and not HEX_COLOR.fullmatch(
            str(size_by["color"])
        ):
            raise BlockError(f"block {block!r}: size_by color must be a #hex colour")
        config["size_by"] = size_by
    heatmap = config.get("heatmap")
    if heatmap is not None and heatmap is not False:
        if heatmap is True:
            heatmap = {}
        elif isinstance(heatmap, str):
            heatmap = {"weight": heatmap}
        if not isinstance(heatmap, dict):
            raise BlockError(
                f"block {block!r}: heatmap must be true, a weight property or a mapping"
            )
        unknown = set(heatmap) - {
            "weight",
            "radius",
            "intensity",
            "opacity",
            "ramp",
            "points",
            "label",
        }
        if unknown:
            raise BlockError(f"block {block!r}: unknown heatmap keys {sorted(unknown)}")
        for key in ("radius", "intensity", "opacity"):
            v = heatmap.get(key)
            if v is not None and (
                isinstance(v, bool) or not isinstance(v, (int, float)) or v <= 0
            ):
                raise BlockError(
                    f"block {block!r}: heatmap {key} must be a positive number"
                )
        ramp = heatmap.get("ramp")
        if (
            ramp is not None
            and ramp not in RAMP_NAMES
            and not (
                isinstance(ramp, list)
                and len(ramp) >= 2
                and all(isinstance(c, str) and HEX_COLOR.fullmatch(c) for c in ramp)
            )
        ):
            raise BlockError(
                f"block {block!r}: heatmap ramp must be one of {list(RAMP_NAMES)} or a list of 2+ #hex colours"
            )
        config["heatmap"] = heatmap
    elif heatmap is False:
        config.pop("heatmap")


def check_3d(config, block):
    """Validate the 3D camera / relief keys: ``pitch`` (0-85 degrees), ``bearing`` (degrees),
    ``terrain`` (``true`` or a vertical exaggeration above 0 and up to 10) and ``buildings`` (bool).

    Raises:
        BlockError: when a key has the wrong type or is out of range.
    """

    def number(key):
        value = config.get(key)
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise BlockError(f"block {block!r}: {key} must be a number, got {value!r}")
        return value

    pitch = number("pitch")
    if pitch is not None and not 0 <= pitch <= 85:
        raise BlockError(f"block {block!r}: pitch must be 0-85, got {pitch!r}")
    number("bearing")
    terrain = config.get("terrain")
    if terrain is not None and not isinstance(terrain, bool):
        exaggeration = number("terrain")
        if not 0 < exaggeration <= 10:
            raise BlockError(
                f"block {block!r}: terrain must be true or an exaggeration above 0 "
                f"and up to 10, got {terrain!r}"
            )
    if not isinstance(config.get("buildings", False), bool):
        raise BlockError(
            f"block {block!r}: buildings must be true or false, got {config['buildings']!r}"
        )
