"""Map and map-tour blocks: the authored/live ``map``, extruded ``buildings-3d``, the
scroll-driven ``map-tour``, ``guided-tour`` and 3D ``deck-tour``.
"""

from ..model import BlockType

BLOCKS = [
    BlockType(
        "guided-tour",
        summary="A pinned map that flies step to step as the reader scrolls -- numbered "
        "step cards (optionally with stat rows) float over it. With authored data (`geojson:`, "
        "`layers: [{label, geojson, color}]`) each step also re-states the map: "
        "`metric: <color_by label>` re-colours the choropleth, `highlight: <filter>` dims the rest, "
        "`fit: <filter>` frames the matching features, `show: A, B` switches layers, `symbols: off` hides the size / heat points. `size_by` "
        "(proportional symbols) and `heatmap` suit exposure points. Static-native.",
        layout="tour",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro", "source"),
        required=("steps",),
        defaults={"view": "risk", "legend": True, "layout": "overlay"},
        items="steps",
        item_keys=(
            "title",
            "text",
            "focus",
            "stats",
            "legend",
            "metric",
            "highlight",
            "fit",
            "show",
            "symbols",
        ),
    ),
    BlockType(
        "deck-tour",
        summary="The guided-tour on a deck.gl 3D map: extruded buildings and columns "
        "(`color_by: [{property, height, height_scale}]` sets the height), a pitched, "
        "flying camera (`focus` takes `pitch` / `bearing`), and click-through details -- "
        "click a feature for a side panel of its properties and how it ranks, click an area "
        "to summarise and outline the features of the other files inside it. Same step "
        "attributes as guided-tour (`metric`, `highlight`, `fit`, `show`, `symbols`) plus "
        "`select: <filter>` to open a feature's panel from a step. The layers sit on the same "
        "basemap as every other map (the reader's Settings > Map; `basemap: offline` for none); "
        "`buildings: true` adds OSM buildings; `fields:` labels, units and sums for the panel. "
        "Authored data only, so it publishes static.",
        layout="tour",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro", "source"),
        required=("steps", "geojson"),
        defaults={"legend": True, "layout": "overlay"},
        items="steps",
        item_keys=(
            "title",
            "text",
            "focus",
            "stats",
            "legend",
            "metric",
            "highlight",
            "fit",
            "show",
            "symbols",
            "select",
        ),
        allowed={
            "geojson",
            "layers",
            "color_by",
            "size_by",
            "heatmap",
            "basemap",
            "pitch",
            "bearing",
            "fields",
            "layout",
            "legend",
            "icon",
        },
    ),
    BlockType(
        "map",
        summary="A map authored in the story: GeoJSON files and/or `markers` "
        "({title, text, center, color}) with a legend; no scrolling steps "
        "(use guided-tour for those). `webmap: <ArcGIS item id>` imports a public web map's layers and extent; "
        "`layers: [{label, kind, url|geojson|tiles, color}]` add legend "
        "checkboxes that show / hide each layer -- hosted GeoJSON, ArcGIS "
        "FeatureServer / tile MapServer, a generic XYZ raster or WMS endpoint "
        "(GeoServer, MapServer, or any other standards-based tile/WMS server), or "
        "`kind: vector` (XYZ MVT tiles plus `source_layer`, for pg_tileserv, Martin, "
        "TileServer GL or GeoServer's vector-tile output); the basemap is a reader setting "
        "(Settings > Map). Markers may carry `value` (disc size, "
        "area ~ value) and `group`; `groups: [{label, color}]` colours them by group and adds "
        "toggle chips with an 'N of M active' status; `grayscale: true` mutes the basemap; "
        "`basemap: offline` swaps the tiles for a bundled world-borders map (no network; also on "
        "map-tour and guided-tour). "
        "`size_by: {property, min, max, color, unit}` draws GeoJSON points as proportional symbols and "
        "`heatmap: {weight, radius, ramp, points}` as a density surface (exposure data). "
        "`from_table: true` adds a marker for every row of a `table` block that has `locate`. "
        "`source:` credits the data under the map. 3D: `pitch` / `bearing` tilt and turn the "
        "camera, `terrain: true` (or an exaggeration) drapes the map over real elevation, "
        "`buildings: true` extrudes OpenStreetMap buildings (also on map-tour and guided-tour).",
        layout="split",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("text", "source"),
        required=("title",),
        allowed={
            "pitch",
            "bearing",
            "terrain",
            "buildings",
            "geojson",
            "markers",
            "center",
            "zoom",
            "legend",
            "icon",
            "layers",
            "basemap",
            "webmap",
            "color_by",
            "filter",
            "groups",
            "grayscale",
            "from_table",
            "size_by",
            "heatmap",
        },
    ),
    BlockType(
        "buildings-3d",
        summary="Building footprints extruded to their height on a tilted MapLibre map -- one "
        "inline 3D scene, no scrolling steps (use deck-tour for a tour with a detail panel). "
        "`geojson:` takes polygon features; `height:` names the metres property (default "
        "`height`, scaled by `height_scale`), `base:` an optional floor height for "
        "buildings that float or sit on a slope. Colour them flat with `color: '#hex'` or by a "
        "property with `color_by: {property, classes, breaks, ramp, categories, label, unit}` "
        "(legend + hover tooltip). `orbit: true` slowly turns the camera (never under "
        "reduced motion); `pitch` / `bearing` / `terrain` set the view. Plain MapLibre, so "
        "the deck.gl bundle is not loaded. Authored data only, so it publishes static.",
        layout="split",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("text", "source"),
        required=("title", "geojson"),
        defaults={"height": "height", "pitch": 55, "legend": True},
        allowed={
            "base",
            "height_scale",
            "color",
            "color_by",
            "orbit",
            "bearing",
            "terrain",
            "basemap",
            "icon",
        },
    ),
    BlockType(
        "map-tour",
        summary="A numbered tour of places on a map: each place has a photo, a title and "
        "text; previous / next (or a numbered pin) flies the map there. "
        "Items `### Title {center=lon,lat zoom=14 image=… credit=…}`. Authored in "
        "the story, so it publishes static.",
        layout="split-wide",
        hydrate=True,
        plain=("eyebrow", "title"),
        rich=("intro", "source"),
        required=("places",),
        items="places",
        item_keys=(
            "title",
            "text",
            "focus",
            "image",
            "credit",
            "alt",
            "decorative",
        ),
        allowed={"basemap", "icon", "pitch", "bearing", "terrain", "buildings"},
    ),
]
