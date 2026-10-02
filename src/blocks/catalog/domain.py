"""Live earthquake-risk domain blocks: exposure, taxonomy, vulnerability, hazard and risk.
Each hydrates from the story's scenario at view time.
"""

from ..model import BlockType
from ._shared import _TEXT

BLOCKS = [
    BlockType(
        "exposure-map",
        summary="Live building footprints + boundary for the story's country.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"legend": True, "camera": "country", "popup": "Entity {id}"},
    ),
    BlockType(
        "exposure-stats",
        summary="Stat tiles + a mini-chart for the country's exposure set.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"tiles": "default", "chart": "construction-period"},
    ),
    BlockType(
        "taxonomy-map",
        summary="Entities coloured by a taxonomy attribute, with period chips.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"attribute": "date", "legend": True},
    ),
    BlockType(
        "taxonomy-stats",
        summary="A distribution panel + bar for one taxonomy attribute.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"attribute": "OCC"},
    ),
    BlockType(
        "vulnerability",
        summary="The scenario's most-assigned structural fragility curves.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"count": 3},
    ),
    BlockType(
        "hazard",
        summary="A synthetic ground-motion grid for the scenario's mid magnitude.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"legend": True},
    ),
    BlockType(
        "risk",
        summary="Per-entity structural loss, with a worst-hit list and a snapshot.",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title",),
        defaults={"tour": True, "snapshot": True},
    ),
]
