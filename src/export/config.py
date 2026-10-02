"""
Export-wide configuration: default locations and the classification constants that decide
which blocks can be exported and which URLs count as runtime dependencies. Kept in one place
so tuning the exporter (a new live block, a new loaded config key, a different default output
folder) touches a single file.
"""

from pathlib import Path

#: Written by default when `--out` is not given.
DEFAULT_OUT = Path.cwd() / "dist" / "site"
#: This package's CSS, themes, and block-hydrator scripts, copied into every export.
STATIC_STORY = Path(__file__).resolve().parent.parent / "web" / "static" / "story"

# Blocks that hydrate from live /api/* endpoints. `swipe` is live only in its two-map mode.
LIVE_TYPES = {
    "exposure-stats",
    "exposure-map",
    "taxonomy-stats",
    "taxonomy-map",
    "vulnerability",
    "hazard",
    "risk",
}

#: Blocks whose config (or, for `swipe`, divider panel) carries a map camera/basemap setup.
MAP_TYPES = {"map", "guided-tour", "map-tour", "deck-tour", "buildings-3d"}
#: Config keys whose http(s) value is loaded by the page (links in prose or a `button` are
#: navigation, not a load, so they are not listed here).
LOADED_KEYS = {"src", "url", "tiles", "image", "poster", "logo", "geojson", "webmap"}

#: Only the glyph subsets these stories use (English, Albanian, Spanish, Turkish, German...).
FONT_SUBSETS = {"latin", "latin-ext"}
#: A browser UA makes Google Fonts answer with woff2 files.
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)
