"""
Reads a built story artifact for the blueprint.

``<content>/<id>/story.yaml`` is ``{meta, blocks}`` (produced by ``storyblocks build``
from a Markdown spine). ``load_story`` merges each block's catalog defaults, substitutes
``{label}`` from the example, and picks a theme; ``?draft=1`` prefers an unpublished
``story.draft.yaml`` when one exists.
"""

from typing import Any

from . import artifact
from .blocks import normalise_block
from .config import DEFAULT_THEME, LANGUAGE_NAMES, THEMES
from .content import (
    built_path,
    draft_path,
    story_dir,
)  # drafts: /story/<id>?draft=1

#: A normalised ``{type, config}`` block, as produced by ``normalise_block``. ``config`` is
#: parsed, block-specific data -- too heterogeneous across block types to type precisely here.
Block = dict[str, Any]


def translations(base_id: str):
    """``[{id, lang, name}]`` -- the story itself and every ``<base>.<lang>`` sibling that is
    built, base first. Empty unless there is more than one language."""

    def lang_of(path, default):
        raw = artifact.loads(path.read_text(encoding="utf-8")).get("meta", {})
        return raw.get("lang") or default

    base_path = built_path(base_id)
    if not base_path.is_file():
        return []
    out = [{"id": base_id, "lang": lang_of(base_path, "en")}]
    for path in sorted(story_dir(base_id).glob("story.*.yaml")):
        suffix = path.name[len("story.") : -len(".yaml")]
        if suffix != "draft" and not suffix.endswith(".draft"):
            out.append({"id": f"{base_id}.{suffix}", "lang": lang_of(path, suffix)})
    for item in out:
        item["name"] = LANGUAGE_NAMES.get(item["lang"], item["lang"].upper())
    return out if len(out) > 1 else []


def draft_available(story_id: str) -> bool:
    return draft_path(story_id).is_file()


def _read(story_id: str, draft: bool):
    if draft and draft_available(story_id):
        return draft_path(story_id)
    path = built_path(story_id)
    return path if path.is_file() else None


def _substitute(value, params):
    if isinstance(value, str):
        for key, replacement in params.items():
            value = value.replace(f"{{{key}}}", replacement)
        return value
    if isinstance(value, dict):
        return {k: _substitute(v, params) for k, v in value.items()}
    if isinstance(value, list):
        return [_substitute(v, params) for v in value]
    return value


def load_story(
    story_id: str,
    example: dict[str, object],
    *,
    draft: bool = False,
    theme: str | None = None,
):
    """The built story with catalog defaults merged, ``{label}`` substituted and a theme
    chosen -- or ``None`` if nothing is authored for ``story_id``."""

    path = _read(story_id, draft)
    if path is None:
        return None
    raw = artifact.loads(path.read_text(encoding="utf-8"))

    meta = {**raw.get("meta", {}), "id": story_id}
    meta.setdefault("lang", "en")
    meta.setdefault("title", example.get("label", story_id))
    meta.setdefault("iso3", example.get("iso3"))
    meta.setdefault("scenario", example.get("scenario_slug"))
    # an explicit ?theme= wins, then the story's own `theme:`, then the default
    picked = theme or meta.get("theme") or DEFAULT_THEME
    meta["theme"] = picked if picked in THEMES else DEFAULT_THEME

    blocks = [normalise_block(block) for block in raw.get("blocks", [])]

    # The visible cover is authoritative across metadata, masthead and gallery.
    cover: Block = next((b["config"] for b in blocks if b["type"] == "cover"), {})
    meta["title"] = (
        cover.get("title") or meta.get("title") or example.get("label", story_id)
    )
    meta["subtitle"] = cover.get("text") or meta.get("subtitle", "")
    meta["eyebrow"] = cover.get("eyebrow") or meta.get("eyebrow", "")

    params = {"label": example.get("label", story_id)}
    return {"meta": _substitute(meta, params), "blocks": _substitute(blocks, params)}


_PLAIN_TYPES = {"cover", "text", "heading", "interlude", "credits", "callout", "button"}


def _thumbnail(blocks):
    """The cover image, else the first image any block carries (``None`` if the story has none)."""
    cover: Block = next((b["config"] for b in blocks if b["type"] == "cover"), {})
    if cover.get("image"):
        return cover["image"]
    for block in blocks:
        if block["config"].get("image"):
            return block["config"]["image"]
    return None


def _features(blocks, limit=3):
    """The first few distinct non-prose block types, as short highlights for a gallery card."""
    seen = []
    for block in blocks:
        if block["type"] not in _PLAIN_TYPES and block["type"] not in seen:
            seen.append(block["type"])
    return [name.replace("-", " ") for name in seen[:limit]]


def _stats(blocks: list[Block]) -> dict[str, int]:
    """Counts shown on a gallery card: blocks, distinct block types, sections, images and
    interactive (non-prose) blocks."""
    types = [b["type"] for b in blocks]
    return {
        "block_count": len(blocks),
        "type_count": len(set(types)),
        "section_count": sum(
            1
            for b in blocks
            if b["type"] == "cover"
            or (b["type"] == "heading" and b["config"].get("level", 1) <= 2)
        ),
        "image_count": sum(1 for b in blocks if b["config"].get("image")),
        "rich_count": sum(1 for t in types if t not in _PLAIN_TYPES),
    }


def story_cards(examples):
    """One summary card per example that has a built story -- for the gallery."""

    cards = []
    for example in examples:
        story = load_story(example["id"], example)
        if story is None:
            continue
        blocks = story["blocks"]
        cards.append(
            {
                "id": example["id"],
                "eyebrow": story["meta"]["eyebrow"],
                "title": story["meta"]["title"],
                "blurb": story["meta"]["subtitle"],
                "theme": story["meta"]["theme"],
                "collection": story["meta"].get("collection") or "",
                **_stats(blocks),
                "languages": len(translations(example["id"])) or 1,
                "image": _thumbnail(blocks),
                "features": _features(blocks),
                "iso3": example.get("iso3"),
                "scenario": example.get("scenario_slug"),
            }
        )
    return cards
