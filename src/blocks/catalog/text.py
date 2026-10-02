"""Plain text and layout blocks: headings, prose, quotes, timelines, callouts, code,
dividers, buttons and the closing credits.
"""

from ..model import BlockType

BLOCKS = [
    BlockType(
        "cover",
        summary="Story title, blurb and the present / immerse / share / print actions.",
        layout="hero",
        plain=("eyebrow", "title"),
        rich=("text",),
        required=("title",),
        defaults={"actions": ["present", "immerse", "share", "print"]},
    ),
    BlockType(
        "text",
        summary="A prose passage with an optional eyebrow + heading.",
        layout="full",
        plain=("eyebrow", "title"),
        rich=("body",),
        required=("body",),
    ),
    BlockType(
        "heading",
        summary="A standalone heading in the story flow -- a main title or a section header.",
        layout="full",
        plain=("eyebrow", "text"),
        required=("text",),
        defaults={"level": 2},
        allowed={"text", "level", "eyebrow", "icon"},
    ),
    BlockType(
        "interlude",
        summary="A short connective line between blocks.",
        layout="band",
        rich=("text",),
        required=("text",),
    ),
    BlockType(
        "quote",
        summary="A pull quote with its speaker and source, optionally beside a portrait.",
        layout="full",
        plain=("cite", "source", "eyebrow"),
        rich=("text",),
        required=("text",),
        allowed={"image", "icon", "alt", "decorative"},
    ),
    BlockType(
        "timeline",
        summary="A vertical dated sequence. Items: title, text, date, tag, image.",
        layout="full",
        plain=("eyebrow", "title"),
        rich=("intro",),
        required=("events",),
        items="events",
        item_keys=("title", "text", "date", "tag", "image", "alt", "decorative"),
    ),
    BlockType(
        "callout",
        summary="A set-apart note: `tone` note / method / warning.",
        layout="full",
        plain=("title", "eyebrow"),
        rich=("text",),
        required=("text",),
        defaults={"tone": "note"},
        allowed={"tone", "icon"},
    ),
    BlockType(
        "code",
        summary="A code or config listing (YAML, Python, JSON ...) in a monospaced panel -- "
        "`code` is shown literally, never interpreted. `language:` labels it.",
        layout="full-wide",
        plain=("eyebrow", "title", "caption"),
        required=("code",),
        allowed={"code", "language", "icon"},
    ),
    BlockType(
        "divider",
        summary="A break between parts: `style` line / dots / space (one or several, e.g. `[line, space]`).",
        layout="band",
        allowed={"style"},
        defaults={"style": "line"},
    ),
    BlockType(
        "button",
        summary="A call-to-action link: `text` (label), `href` (http(s), a site path or a "
        "#anchor), `style` one or more of primary / ghost / large / small / block, optional `note` beneath.",
        layout="band",
        plain=("text", "note"),
        required=("text", "href"),
        defaults={"style": "primary"},
        allowed={"href", "style"},
    ),
    BlockType(
        "credits",
        summary="Sources / methodology lines, partner / funder `logos` "
        "({src, alt, href}) and the 'keep exploring' links.",
        layout="full",
        required=("items",),
        defaults={
            "title": "Where these numbers come from",
            "links": [],
            "logos": [],
        },
        allowed={"items", "links", "logos"},
    ),
]
