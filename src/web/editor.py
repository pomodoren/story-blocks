"""
The **visual story builder**: edit a story in the browser instead of in its Markdown spine.

    /story-editor/              pick a story
    /story-editor/<id>          the editor: block outline, a form per block (generated from the
                                block catalog in :mod:`storyblocks.blocks`), meta, live preview

It edits the *built* story (``{meta, blocks}``). **Save draft** validates it with the same
authoring library the build uses and writes ``<id>/story.draft.yaml`` (previewed at
``/story/<id>?draft=1``). **Publish** regenerates the Markdown spine (``<id>/story.md``) and
rebuilds ``<id>/story.yaml`` from it, so git keeps one source of truth -- and refuses if the
spine would not round-trip to exactly what was edited.

It writes files on the machine running the app, so it is **off unless enabled**: the
standalone ``python -m storyblocks`` turns it on (localhost only by default); a host app that
mounts this blueprint elsewhere must set ``STORYBLOCKS_EDITOR=1`` itself. Requests must be
same-origin JSON, and the ``Host`` header must be
a loopback name unless it is listed in ``STORYBLOCKS_ALLOWED_HOSTS`` (comma-separated), which
stops DNS-rebinding pages from driving the editor.
"""

import os
from pathlib import Path
from urllib.parse import urlparse

from flask import Blueprint, abort, current_app, jsonify, render_template, request

from .. import artifact, registry
from ..blocks import BLOCKS
from ..config import THEMES
from ..content import (
    asset_url,
    assets_dir,
    built_path,
    draft_path,
    spine_path,
    split_id,
)
from ..icons import ICONS
from ..loader import translations

META_KEYS = (
    "label",
    "title",
    "theme",
    "lang",
    "collection",
    "accent",
    "logo",
    "logo_alt",
    "logo_link",
    "iso3",
    "scenario",
)

editor_bp = Blueprint("story_editor", __name__, url_prefix="/story-editor")


def editor_enabled():
    return (
        bool(current_app.config.get("STORIES_EDITOR"))
        or os.getenv("STORYBLOCKS_EDITOR") == "1"
    )


LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def trusted_host(host: str) -> bool:
    """Whether a ``Host`` header names this machine or a host in ``STORYBLOCKS_ALLOWED_HOSTS``."""

    name = urlparse(f"//{host}").hostname or ""
    extra = {
        h.strip().lower() for h in os.getenv("STORYBLOCKS_ALLOWED_HOSTS", "").split(",")
    }
    return name.lower() in LOOPBACK_HOSTS | extra


@editor_bp.before_request
def _guard():
    if not editor_enabled():
        abort(404)
    if not trusted_host(request.host):
        abort(
            403, "the editor only answers to localhost (see STORYBLOCKS_ALLOWED_HOSTS)"
        )
    if request.method != "GET":
        origin = request.headers.get("Origin")
        # a custom header or a JSON body can't be sent cross-site without a CORS preflight
        if not (request.is_json or request.headers.get("X-Story-Editor")) or (
            origin and urlparse(origin).netloc != request.host
        ):
            abort(403, "the editor only accepts same-origin requests from its own page")


def _known(story_id):
    base, _ = split_id(story_id)
    if not any(e["id"] == base for e in registry.EXAMPLES):
        abort(404)
    return base


def catalog():
    out = {}
    for name, bt in BLOCKS.items():
        out[name] = {
            "name": name,
            "summary": bt.summary,
            "layout": bt.layout,
            "hydrate": bt.hydrate,
            "plain": list(bt.plain),
            "rich": list(bt.rich),
            "required": list(bt.required),
            "defaults": bt.defaults,
            "items": bt.items,
            "item_keys": sorted(bt.item_keys),
            "keys": sorted(bt.known_keys),
        }
    return out


def _load(story_id):
    for path in (draft_path(story_id), built_path(story_id)):
        if path.is_file():
            raw = artifact.loads(path.read_text(encoding="utf-8"))
            return {
                "meta": raw.get("meta", {}),
                "blocks": raw.get("blocks", []),
                "draft": path == draft_path(story_id),
            }
    return None


def _assemble(story_id, payload):
    """Payload ``{meta, blocks}`` -> a validated :class:`Story`; raises ``StoryError``."""

    from ..authoring import Story

    if not isinstance(payload, dict):
        raise ValueError("expected a JSON object with `meta` and `blocks`")
    blocks = payload.get("blocks") or []
    if not isinstance(blocks, list) or not all(isinstance(b, dict) for b in blocks):
        raise ValueError("`blocks` must be a list of {type, config} objects")
    meta = {
        k: v
        for k, v in (payload.get("meta") or {}).items()
        if k in META_KEYS and v not in (None, "")
    }
    story = Story(story_id)
    story.meta(**meta)
    for block in blocks:
        story.block(block.get("type"), **(block.get("config") or {}))
    story.to_dict()
    return story


@editor_bp.get("/")
def index():
    rows = []
    for e in registry.EXAMPLES:
        for item in [
            e["id"],
            *(t["id"] for t in translations(e["id"]) if t["id"] != e["id"]),
        ]:
            rows.append({"id": item, "draft": draft_path(item).is_file()})
    return render_template(
        "stories/editor_index.html", active="story", title="Story builder", rows=rows
    )


@editor_bp.get("/<story_id>")
def editor(story_id):
    _known(story_id)
    return render_template(
        "stories/editor.html",
        active="story",
        title=f"Edit {story_id}",
        story_id=story_id,
    )


@editor_bp.get("/api/<story_id>")
def api_get(story_id):
    _known(story_id)
    data = _load(story_id)
    if data is None:
        abort(404, f"no story built for {story_id!r}")
    return jsonify(
        {**data, "catalog": catalog(), "themes": list(THEMES), "icons": sorted(ICONS)}
    )


MEDIA_EXT = {
    ".webp",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".avif",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".ogg",
}
UPLOAD_EXT = MEDIA_EXT - {
    ".svg"
}  # an SVG can carry script; author them by hand instead
MAX_UPLOAD = 15 * 1024 * 1024


@editor_bp.get("/api/<story_id>/media")
def api_media(story_id):
    """Every image / video / audio file in this story's ``assets/`` folder, for the media picker."""

    _known(story_id)
    folder = assets_dir(story_id)
    files = (
        [
            {
                "url": asset_url(story_id, p.relative_to(folder).as_posix()),
                "name": p.name,
                "folder": "",
            }
            for p in sorted(folder.rglob("*"))
            if p.is_file() and p.suffix.lower() in MEDIA_EXT
        ]
        if folder.is_dir()
        else []
    )
    return jsonify({"files": files})


@editor_bp.post("/api/<story_id>/media")
def api_upload(story_id):
    """Raw body = the file; ``X-Filename`` = its name. Saved in the story's ``assets/`` folder."""

    _known(story_id)
    import re

    name = re.sub(
        r"[^A-Za-z0-9._-]+", "-", Path(request.headers.get("X-Filename", "")).name
    ).strip(".-")
    if not name or Path(name).suffix.lower() not in UPLOAD_EXT:
        return _error(
            f"unsupported file type (allowed: {', '.join(sorted(UPLOAD_EXT))})"
        )
    data = request.get_data()
    if not data or len(data) > MAX_UPLOAD:
        return _error("empty file, or larger than 15 MB")
    folder = assets_dir(story_id)
    folder.mkdir(parents=True, exist_ok=True)
    target = _free_name(folder, name)
    target.write_bytes(data)
    return jsonify({"ok": True, "url": asset_url(story_id, target.name)})


def _free_name(folder: Path, name: str) -> Path:
    """``folder/name``, or ``name-2``, ``name-3`` ... so an upload never replaces a file."""

    target = folder / name
    stem, suffix = target.stem, target.suffix
    counter = 2
    while target.exists():
        target = folder / f"{stem}-{counter}{suffix}"
        counter += 1
    return target


def _error(exc):
    return jsonify({"ok": False, "error": str(exc)}), 422


@editor_bp.put("/api/<story_id>/draft")
def api_draft(story_id):
    from ..authoring import StoryError

    _known(story_id)
    try:
        story = _assemble(story_id, request.get_json(silent=True))
    except (StoryError, ValueError, TypeError) as exc:
        return _error(exc)
    path = story.build(publish=False)
    return jsonify({"ok": True, "warnings": story.warnings, "path": str(path.name)})


@editor_bp.delete("/api/<story_id>/draft")
def api_discard(story_id):
    _known(story_id)
    draft_path(story_id).unlink(missing_ok=True)
    return jsonify({"ok": True})


@editor_bp.post("/api/<story_id>/publish")
def api_publish(story_id):
    from ..authoring import StoryError, dump_spine, load_spine

    _known(story_id)
    try:
        story = _assemble(story_id, request.get_json(silent=True))
        text = dump_spine(story)
        spine = spine_path(story_id)
        previous = spine.read_text(encoding="utf-8") if spine.is_file() else None
        spine.write_text(text, encoding="utf-8")
        committed = False
        try:
            rebuilt = load_spine(spine)
            if rebuilt.to_dict() != story.to_dict():
                raise StoryError(
                    "this story does not round-trip through its Markdown spine "
                    "(a field the spine format cannot carry) -- saved as a draft only"
                )
            committed = True
        finally:
            if not committed:
                if previous is None:
                    spine.unlink(missing_ok=True)
                else:
                    spine.write_text(previous, encoding="utf-8")
    except (StoryError, ValueError, TypeError) as exc:
        return _error(exc)
    rebuilt.build(publish=True)
    draft_path(story_id).unlink(missing_ok=True)
    return jsonify({"ok": True, "warnings": rebuilt.warnings})
