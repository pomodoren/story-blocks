"""Validators for media blocks: ``embed``, ``video``, ``audio`` sources and the ``swipe``
before/after comparison (a picture, or an authored map panel reusing the ``map`` block's rules).
"""

import re

from ..model import BlockError
from .common import check_3d, check_color_by, check_filter, check_point_styles
from .maps import _check_basemap, _check_layers, _check_webmap

YOUTUBE_URL = re.compile(
    r"^https?://(?:www\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})"
)
VIMEO_URL = re.compile(r"^https?://(?:www\.)?vimeo\.com/(?:video/)?(\d+)")

#: swipe divider-mode panel keys: a picture, or an authored map (mirrors the `map` block).
SWIPE_MODES = ("data-lon", "divider")
SWIPE_PANEL_IMAGE_KEYS = {"src", "alt", "decorative"}
SWIPE_PANEL_MAP_KEYS = {
    "geojson",
    "markers",
    "center",
    "zoom",
    "legend",
    "layers",
    "basemap",
    "webmap",
    "color_by",
    "filter",
    "groups",
    "grayscale",
    "size_by",
    "heatmap",
    "pitch",
    "bearing",
    "terrain",
    "buildings",
}


def video_embed_url(src: str) -> str | None:
    """The privacy-friendly iframe URL for a YouTube / Vimeo link, else ``None`` (a plain file)."""

    if m := YOUTUBE_URL.match(src):
        return f"https://www.youtube-nocookie.com/embed/{m.group(1)}"
    if m := VIMEO_URL.match(src):
        return f"https://player.vimeo.com/video/{m.group(1)}"
    return None


def _check_embed_src(
    name: str, merged: dict[str, object], given: dict[str, object]
) -> None:
    if not str(merged["src"]).startswith(("/", "http://", "https://")):
        raise BlockError(
            f"block 'embed': src must be http(s) or a site path, got {merged['src']!r}"
        )


def _check_media_src(
    name: str, merged: dict[str, object], given: dict[str, object]
) -> None:
    src = str(merged["src"])
    if not src.startswith(("/", "http://", "https://")):
        raise BlockError(
            f"block {name!r}: src must be http(s) or a site path, got {src!r}"
        )
    if name == "video":
        merged["embed_url"] = video_embed_url(src)


def _check_swipe_panel(panel: object, where: str) -> None:
    """Validate one ``swipe`` divider-mode panel: a picture (``src``, ``alt``, ``decorative``)
    or an authored map, the same shape the ``map`` block accepts.

    Raises:
        BlockError: the panel is not a mapping, carries an unknown key, a picture has no
            ``src`` (or no ``alt`` when it isn't ``decorative``), a map config has neither
            content nor a camera, or a nested map key (``filter``, ``color_by``, ``layers``,
            ``webmap``, 3D, ``size_by`` / ``heatmap``) is invalid.
    """

    if not isinstance(panel, dict):
        raise BlockError(f"block 'swipe': {where} must be a mapping")
    name = f"swipe {where}"
    if "src" in panel:
        unknown = set(panel) - SWIPE_PANEL_IMAGE_KEYS
        if unknown:
            raise BlockError(
                f"block {name!r}: unknown picture config {sorted(unknown)} "
                f"(accepts {sorted(SWIPE_PANEL_IMAGE_KEYS)})"
            )
        if not str(panel.get("src") or "").strip():
            raise BlockError(f"block {name!r}: picture needs a non-empty src")
        if not panel.get("decorative") and not str(panel.get("alt") or "").strip():
            raise BlockError(
                f"block {name!r}: picture needs alt text (or decorative: true)"
            )
        return
    unknown = set(panel) - SWIPE_PANEL_MAP_KEYS
    if unknown:
        raise BlockError(
            f"block {name!r}: unknown map config {sorted(unknown)} "
            f"(accepts {sorted(SWIPE_PANEL_MAP_KEYS)})"
        )
    if not (
        panel.get("geojson")
        or panel.get("markers")
        or panel.get("webmap")
        or panel.get("layers")
        or panel.get("center")
    ):
        raise BlockError(
            f"block {name!r}: needs src (a picture) or a map config "
            "(geojson / markers / webmap / layers / center)"
        )
    _check_basemap(name, panel, panel)
    _check_layers(name, panel, panel)
    if panel.get("filter"):
        check_filter(panel["filter"], name)
    if panel.get("color_by"):
        specs = (
            panel["color_by"]
            if isinstance(panel["color_by"], list)
            else [panel["color_by"]]
        )
        checked = [check_color_by(spec, name) for spec in specs]
        if len(checked) > 1 and not all(spec.get("label") for spec in checked):
            raise BlockError(
                f"block {name!r}: every color_by entry needs a label when there are several"
            )
        panel["color_by"] = (
            checked if isinstance(panel["color_by"], list) else checked[0]
        )
    _check_webmap(name, panel, panel)
    check_3d(panel, name)
    check_point_styles(panel, name)


def _check_swipe(
    name: str, merged: dict[str, object], given: dict[str, object]
) -> None:
    """``mode`` must be known; a ``divider`` panel is a picture or an authored map."""

    mode = merged.get("mode", "data-lon")
    if mode not in SWIPE_MODES:
        raise BlockError(
            f"block 'swipe': mode must be one of {list(SWIPE_MODES)}, got {mode!r}"
        )
    if mode != "divider":
        return
    for key in ("before", "after"):
        _check_swipe_panel(merged[key], key)
