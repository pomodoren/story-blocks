"""The block catalog validators: per-block configuration rules, split by concern into
:mod:`.common` (shared filter / color_by / 3D helpers), :mod:`.maps` (map and tour blocks),
:mod:`.media` (embed / video / audio / swipe), :mod:`.data` (table / ranking / network / chart)
and :mod:`.text` (button / style), plus ``VALIDATORS``, the registry that assigns validators to
block types.
"""

from collections.abc import Callable

from .common import check_3d, check_point_styles
from .data import _check_chart_variants, check_network, check_ranking, check_table
from .maps import (
    MAP_3D_BLOCKS,
    TOUR_BLOCKS,
    _check_basemap,
    _check_guided_tour_view,
    _check_layers,
    _check_map_data,
    _check_webmap,
    check_buildings_3d,
    check_deck_tour,
    check_tour_data,
)
from .media import _check_embed_src, _check_media_src, _check_swipe
from .text import STYLE_VALUES, _check_button_href, _check_style

__all__ = ["VALIDATORS"]

#: ``(name, merged, given) -> None``: the hook signature every validator below is adapted to.
_Hook = Callable[[str, dict[str, object], dict[str, object]], None]


def _merged_only(check: Callable[[dict[str, object]], None]) -> _Hook:
    """Adapt ``check(merged)`` to the ``(name, merged, given)`` hook signature."""
    return lambda name, merged, given: check(merged)


def _named(check: Callable[[dict[str, object], str], None]) -> _Hook:
    """Adapt ``check(merged, name)`` to the ``(name, merged, given)`` hook signature."""
    return lambda name, merged, given: check(merged, name)


#: ``(block names, validator)``, applied in order to each named block.
VALIDATORS: tuple[tuple[tuple[str, ...], _Hook], ...] = (
    (("guided-tour",), _check_guided_tour_view),
    (("embed",), _check_embed_src),
    (("map", "map-tour", "guided-tour", "deck-tour"), _check_basemap),
    (("map", *TOUR_BLOCKS), _check_layers),
    (("map",), _check_map_data),
    (("map",), _check_webmap),
    (MAP_3D_BLOCKS, _named(check_3d)),
    (("map", *TOUR_BLOCKS), _named(check_point_styles)),
    (TOUR_BLOCKS, _named(check_tour_data)),
    (("swipe",), _check_swipe),
    (("deck-tour",), _merged_only(check_deck_tour)),
    (("buildings-3d",), _merged_only(check_buildings_3d)),
    (("table",), _merged_only(check_table)),
    (("ranking",), _merged_only(check_ranking)),
    (("network",), _merged_only(check_network)),
    (("chart",), _check_chart_variants),
    (("button",), _check_button_href),
    (("video", "audio"), _check_media_src),
    (tuple(STYLE_VALUES), _check_style),
)
