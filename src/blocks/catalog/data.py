"""Authored-data visualization blocks: ``table``, ``chart``, ``network``, ``scroll-chart``,
``ranking`` and ``kpi``. All static-native -- everything shown is authored in the story.
"""

from ..model import BlockType
from ._shared import _TEXT

BLOCKS = [
    BlockType(
        "table",
        summary="An authored table (`columns` + `rows`) with search and sortable columns. "
        "Renders as plain HTML first, so it prints and works without JS. "
        "`filters: [column, ...]` adds a dropdown per column, `page_size: N` paginates, and "
        "`locate: {lon, lat, zoom}` (column labels) makes a row click fly the nearest map.",
        layout="full-wide",
        hydrate=True,
        plain=("eyebrow", "title", "caption"),
        rich=("intro",),
        required=("columns", "rows"),
        defaults={"search": True, "sortable": True},
        allowed={"filters", "page_size", "locate"},
    ),
    BlockType(
        "chart",
        summary="A chart authored in the story: `kind` bar / hbar / line / doughnut, `labels`, "
        "and one or more `series` ({name, data, color}). Text beside it.",
        layout="split",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("labels", "series"),
        defaults={"kind": "bar"},
        allowed={
            "kind",
            "labels",
            "series",
            "unit",
            "stacked",
            "source",
            "icon",
            "variant",
            "variants",
        },
    ),
    BlockType(
        "network",
        summary="A relationship network (Cytoscape) from authored `nodes` "
        "({id, label, group, size, color, note}) and `edges` ({source, target, label, "
        "weight}). Click a node to highlight its connections; search, layout chips "
        "and group colours (`colors: {group: '#hex'}`). Text beside it.",
        layout="split-wide",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("nodes", "edges"),
        defaults={"layout": "cose", "search": True},
        allowed={"colors", "source", "icon", "search"},
    ),
    BlockType(
        "scroll-chart",
        summary="A line chart that draws itself as the reader scrolls: `points` "
        "({label, value, note}); a point with a `note` is marked and listed in the "
        "legend. Renders as plain SVG first, so it prints and works without JS.",
        layout="full-wide",
        hydrate=True,
        plain=("eyebrow", "title", "caption"),
        rich=("intro",),
        required=("points",),
        allowed={"points", "unit", "source", "icon"},
    ),
    BlockType(
        "ranking",
        summary='A ranked list with inline bars ("top N by value") from authored `rows` '
        "({name, value, note}). `metrics: [{label, unit, rows}]` adds a chip per "
        "metric. Renders as plain HTML first, so it prints and works without JS.",
        layout="split",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"sort": "desc"},
        allowed={
            "rows",
            "metrics",
            "unit",
            "top",
            "sort",
            "decimals",
            "source",
            "icon",
        },
    ),
    BlockType(
        "kpi",
        summary="A row of big figures that count up -- the lightweight cousin of stat-cards. "
        "Items: value, unit, label, text.",
        layout="full-wide",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro",),
        required=("figures",),
        items="figures",
        item_keys=("title", "text", "value", "unit", "label"),
    ),
]
