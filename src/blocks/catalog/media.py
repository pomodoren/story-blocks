"""Media and pinned-stage blocks: pictures, galleries, audio/video, embeds, the ``swipe``
comparison, and the scroll-pinned ``photo-scenes`` / ``stat-cards`` / ``process-board`` stages.
"""

from ..model import BlockType
from ._shared import _TEXT

BLOCKS = [
    BlockType(
        "image-card",
        summary="A figure (frozen snapshot or diagram) beside an explanation.",
        layout="split",
        plain=("eyebrow", "title", "caption"),
        rich=("explanation",),
        required=("src", "explanation"),
        defaults={"align": "media-right"},
    ),
    BlockType(
        "swipe",
        summary="Before/after wipe. `mode: divider` (static-native): `before`/`after` each a "
        "picture (`src`, `alt`, `decorative`) and/or an authored map (same shape as the "
        "`map` block -- `geojson`, `markers`, `layers`, `webmap`, `color_by`, `size_by`, "
        "`heatmap`, 3D). `mode: data-lon` (the default, live): two synced loss layers by "
        "scenario magnitude.",
        layout="split-wide",
        hydrate=True,
        **_TEXT,
        rich=("text",),
        required=("title", "before", "after", "labels"),
        defaults={"mode": "data-lon"},
    ),
    BlockType(
        "photo-scenes",
        summary="A pinned full-bleed photo that changes scene by scene; each scene is a "
        "text card placed over it (and an optional alternate photo). "
        "`mode: grid` instead pins a dimmed tile grid that scrubs one scene into a "
        "big focus card, then reveals the whole grid as a hoverable gallery.",
        layout="stage",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro",),
        required=("scenes",),
        items="scenes",
        item_keys=(
            "title",
            "text",
            "image",
            "alt_image",
            "pos",
            "tag",
            "accent",
            "caption",
            "stat",
            "stat_unit",
            "alt",
            "decorative",
        ),
        defaults={"mode": "float"},
    ),
    BlockType(
        "stat-cards",
        summary="A pinned stage where one big-number card at a time counts up, then every "
        "card opens into a grid (a swipeable row on phones).",
        layout="stage",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro",),
        required=("cards",),
        items="cards",
        item_keys=(
            "title",
            "text",
            "value",
            "unit",
            "tag",
            "image",
            "alt",
            "decorative",
        ),
    ),
    BlockType(
        "process-board",
        summary="A pinned wire-diagram: phased columns of named steps: pick a project chip "
        "and an animated SVG line draws through the steps its path touched, dimming "
        "the rest.",
        layout="stage",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro",),
        required=("phases", "projects"),
        # `phases`/`projects` are nested (phase -> [node, ...], project -> [node id, ...])
        # so they don't fit the single-flat-list `items=`/`item_keys=` mechanism -- same
        # precedent as `credits`' free-form `items`/`links`, validated only at this top level.
        allowed={"eyebrow", "title", "icon", "intro", "phases", "projects"},
    ),
    # ---- static-native formats: everything they show is authored in the story, nothing is
    # fetched at view time, so they publish to the static site as-is.
    BlockType(
        "gallery",
        summary="A set of photos -- a grid, a mosaic or a horizontal strip -- each opening "
        "in a lightbox with its caption. Items: src, title, text (caption), credit, "
        "wide.",
        layout="full-wide",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro",),
        required=("images",),
        items="images",
        item_keys=("title", "text", "src", "credit", "wide", "alt", "decorative"),
        defaults={"mode": "grid", "columns": 3},
    ),
    BlockType(
        "embed",
        summary="A live page in a frame (another app, a dashboard, a notebook): `src` "
        "(http(s) or a site path), `height:` in vh. Needs the network at view time, "
        "so it is not static-native.",
        layout="full-wide",
        plain=("eyebrow", "title", "caption"),
        required=("src",),
        defaults={"height": 70},
        allowed={"src", "height", "icon"},
    ),
    BlockType(
        "video",
        summary="A video: a file (`src`, mp4/webm, optional `poster`) or a YouTube / Vimeo "
        "link. `autoplay: true` plays it muted and looping, like a moving photo.",
        layout="full-wide",
        plain=("eyebrow", "title", "caption"),
        rich=("text",),
        required=("src",),
        allowed={"src", "poster", "autoplay", "icon", "embed_url"},
    ),
    BlockType(
        "audio",
        summary="An audio clip (`src`) with a title, optional text and caption.",
        layout="full",
        plain=("eyebrow", "title", "caption"),
        rich=("text",),
        required=("src",),
        allowed={"src", "icon"},
    ),
]
