"""
Guardrails a story artifact must pass before it is written.

- Every block's ``type`` must be in the catalog (``storyblocks.blocks.BLOCKS``) and its
  config must satisfy that type's required keys.
- A block's ``plain`` config fields are autoescaped in the partial -- an HTML tag or entity
  there renders literally -- so they must be plain text. ``rich`` fields are rendered
  ``| safe``.
- ``config.icon``, when given, must be a key in ``storyblocks.icons`` ``ICONS``.
- A story has at least one block; at most one ``cover``, and if present it is first.
"""

import re

_POSITIONS = ("tl", "tr", "ml", "mc", "mr", "bl", "br")
# a colour a scene may take as its accent: hex, a bare colour name or a theme var -- never free
# CSS, since it lands in a `style` attribute.
_ACCENT = re.compile(r"^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|var\(--[a-z0-9-]+\))$")
_URL = re.compile(r"^(/|https?://|data:image/)")
_ENTITY = re.compile(r"&(#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);")
_TAGISH = re.compile(r"<\s*/?\s*[A-Za-z!]")


class StoryError(ValueError):
    """A story failed validation. Raised at build time, never at request time."""


def ensure_plain(where, value):
    """`value` must be a non-empty string with no HTML tags or character entities."""

    if not isinstance(value, str) or not value.strip():
        raise StoryError(f"{where}: expected a non-empty string, got {value!r}")
    if _TAGISH.search(value) or _ENTITY.search(value):
        raise StoryError(
            f"{where}: this field is autoescaped in the block partial, so HTML tags and "
            f"entities show up literally. Use plain text with literal characters. Got: {value!r}"
        )
    return value


def ensure_richtext(where, value):
    """`value` must be a non-empty string. HTML is allowed (the slot is ``| safe``)."""

    if not isinstance(value, str) or not value.strip():
        raise StoryError(f"{where}: expected a non-empty string, got {value!r}")
    return value


_IMAGE_KEYS = ("image", "src", "alt_image")


def _truthy(value):
    return str(value).lower() in ("true", "1", "yes")


def _missing_alt(tag, bt, config):
    """Accessibility warnings: every image needs ``alt`` text (or ``decorative: true``).
    The cover's backdrop and a ``photo-scenes`` alternate photo are decorative by design."""

    out = []

    def check(where, holder, key):
        if (
            holder.get(key)
            and not holder.get("alt")
            and not _truthy(holder.get("decorative"))
        ):
            out.append(
                f'{where}: image {holder[key]!r} has no alt text (add alt="..." or decorative=true)'
            )

    if bt.name == "image-card":
        check(tag, config, "src")
    elif bt.name == "quote":
        check(tag, config, "image")
    elif bt.items:
        for i, item in enumerate(config.get(bt.items) or []):
            if isinstance(item, dict):
                for key in ("image", "src"):
                    check(f"{tag}.{bt.items}[{i}]", item, key)
    return out


_HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


def validate_story(meta, blocks):
    """Raise ``StoryError`` for a broken story; return a list of non-fatal warnings."""

    warnings = []
    from ..blocks import BlockError, get_block
    from ..icons import ICONS

    if not meta.get("id"):
        raise StoryError("story meta needs an 'id'")
    if not blocks:
        raise StoryError("a story needs at least one block")
    if meta.get("accent") and not _HEX.match(str(meta["accent"])):
        raise StoryError(
            f"meta accent must be a #rgb / #rrggbb colour, got {meta['accent']!r}"
        )
    for key in ("logo", "logo_link"):
        if meta.get(key) and not re.match(r"^(/|https?://)", str(meta[key])):
            raise StoryError(
                f"meta {key} must be http(s) or a site path, got {meta[key]!r}"
            )
    if meta.get("collection"):
        ensure_plain("meta.collection", str(meta["collection"]))

    covers = [i for i, b in enumerate(blocks) if b.get("type") == "cover"]
    if len(covers) > 1:
        raise StoryError("a story has at most one 'cover' block")
    if covers and covers[0] != 0:
        raise StoryError("the 'cover' block must be first")

    for position, block in enumerate(blocks, start=1):
        tag = f"block {position} ({block.get('type', '?')!r})"
        try:
            bt = get_block(block.get("type"))
            config = bt.normalise(block.get("config"))
        except BlockError as exc:
            raise StoryError(f"{tag}: {exc}") from None

        for key in bt.plain:
            if key in config:
                ensure_plain(f"{tag}.{key}", config[key])
        for key in bt.rich:
            if key in config:
                ensure_richtext(f"{tag}.{key}", config[key])

        icon = config.get("icon")
        if icon is not None and icon not in ICONS:
            raise StoryError(
                f"{tag}: unknown icon {icon!r} -- expected one of {sorted(ICONS)}"
            )

        if bt.name == "heading":
            level = config.get("level", 2)
            if (
                not isinstance(level, int)
                or isinstance(level, bool)
                or not 1 <= level <= 6
            ):
                raise StoryError(
                    f"{tag}: heading 'level' must be an integer 1-6, got {level!r}"
                )

        if bt.name == "credits":
            for i, item in enumerate(config.get("items", [])):
                if (
                    not isinstance(item, dict)
                    or "label" not in item
                    or "html" not in item
                ):
                    raise StoryError(f"{tag}: credits item {i} needs {{label, html}}")
                ensure_richtext(f"{tag}.items[{i}].label", item["label"])
                ensure_richtext(f"{tag}.items[{i}].html", item["html"])

            for i, logo in enumerate(config.get("logos") or []):
                where = f"{tag}.logos[{i}]"
                if not isinstance(logo, dict) or not set(logo) <= {
                    "src",
                    "alt",
                    "href",
                }:
                    raise StoryError(f"{where}: needs {{src, alt[, href]}}")
                if not _URL.match(str(logo.get("src", ""))):
                    raise StoryError(f"{where}.src: expected a /path or http(s):// URL")
                if not str(logo.get("alt", "")).strip():
                    raise StoryError(f"{where}: logo has no alt text (add alt=...)")
                ensure_plain(f"{where}.alt", str(logo["alt"]))
                if logo.get("href") and not re.match(
                    r"^(/|https?://)", str(logo["href"])
                ):
                    raise StoryError(
                        f"{where}.href: expected a /path or http(s):// URL"
                    )

        if bt.items:
            _validate_items(tag, bt, config)
        warnings += _missing_alt(tag, bt, config)

    return warnings


def _validate_items(tag, bt, config):
    """Steps / scenes / cards: a non-empty list of mappings that only use the keys the block
    type declares (so a typo'd ``{zom=17}`` in the spine fails the build, not silently)."""

    items = config.get(bt.items)
    if not isinstance(items, list) or not items:
        raise StoryError(f"{tag}: {bt.name} needs a non-empty {bt.items!r} list")
    for i, item in enumerate(items):
        where = f"{tag}.{bt.items}[{i}]"
        if not isinstance(item, dict):
            raise StoryError(f"{where}: must be a mapping")
        unknown = set(item) - bt.item_keys
        if unknown:
            raise StoryError(
                f"{where}: unknown key(s) {sorted(unknown)} -- {bt.name} items accept "
                f"{sorted(bt.item_keys)}"
            )
        if item.get("title"):
            ensure_plain(f"{where}.title", str(item["title"]))
        if item.get("text"):
            ensure_richtext(f"{where}.text", item["text"])
        for key in ("tag", "caption", "unit", "value"):
            if item.get(key) is not None:
                ensure_plain(f"{where}.{key}", str(item[key]))

        focus = item.get("focus")
        if focus is not None and not isinstance(focus, dict):
            raise StoryError(f"{where}: 'focus' must be a mapping")
        stats = item.get("stats")
        if stats is not None:
            if not isinstance(stats, list) or not all(
                isinstance(x, dict) and set(x) <= {"value", "label"} and "value" in x
                for x in stats
            ):
                raise StoryError(f"{where}: 'stats' must be a list of {{value, label}}")
            for x in stats:
                ensure_plain(f"{where}.stats.value", str(x["value"]))
                if x.get("label"):
                    ensure_plain(f"{where}.stats.label", str(x["label"]))
        for key in ("image", "alt_image"):
            if item.get(key) is not None and not _URL.match(str(item[key])):
                raise StoryError(
                    f"{where}.{key}: expected a /path, an http(s):// URL or a data:image URI, "
                    f"got {item[key]!r}"
                )
        if item.get("pos") is not None and item["pos"] not in _POSITIONS:
            raise StoryError(
                f"{where}.pos: expected one of {list(_POSITIONS)}, got {item['pos']!r}"
            )
        if item.get("accent") is not None and not _ACCENT.match(str(item["accent"])):
            raise StoryError(
                f"{where}.accent: expected #hex, a colour name or var(--x), got {item['accent']!r}"
            )
    if bt.name == "stat-cards" and not all(
        item.get("value") is not None for item in items
    ):
        raise StoryError(f"{tag}: every stat-cards card needs a 'value'")
