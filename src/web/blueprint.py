"""
The stories Flask blueprint: the ``/stories/`` gallery and the ``/story/<id>`` reader.

Self-contained -- its own templates (``templates/stories/``), assets (``static/story/``,
served at ``/story-assets/``), case-study list (:mod:`..registry`) and block catalog
(:mod:`.blocks`). Its templates extend ``stories/base.html``, this package's own shell, both
standalone (``python -m storyblocks``) and when mounted in another Flask app -- the namespaced
path keeps that host's own ``templates/base.html`` from shadowing it.
Register it with ``app.register_blueprint(bp)``.
"""

from flask import Blueprint, abort, render_template, request, send_from_directory

from .. import registry
from ..blocks import BLOCKS
from ..config import THEMES
from ..content import assets_dir, split_id
from ..icons import ICONS
from ..loader import draft_available, load_story, story_cards, translations
from .markdown import render_inline, render_markdown

bp = Blueprint(
    "stories",
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/story-assets",
)

from .editor import editor_bp  # noqa: E402  (circular: needs `bp` above)

bp.register_blueprint(editor_bp)


@bp.get("/story-assets/stories/<story_id>/assets/<path:filename>")
def story_asset(story_id, filename):
    """A story's own images, media and GeoJSON live in its folder (see :mod:`..content`)."""

    response = send_from_directory(assets_dir(story_id), filename)
    # an SVG opened directly must not run script on the app's origin; <img> use is unaffected
    response.headers["Content-Security-Policy"] = "sandbox"
    return response


# Prose in a story's `rich` fields is authored as Markdown -- see web/markdown.py.
bp.add_app_template_filter(render_markdown, "markdown")
bp.add_app_template_filter(render_inline, "md_inline")


def _collection_mates(base_id):
    """The other stories in this story's ``meta.collection`` (empty if it has none)."""

    cards = story_cards(registry.EXAMPLES)
    mine = next((c for c in cards if c["id"] == base_id), None)
    if not mine or not mine["collection"]:
        return None
    return {
        "name": mine["collection"],
        "stories": [
            c
            for c in cards
            if c["collection"] == mine["collection"] and c["id"] != base_id
        ],
    }


@bp.get("/stories/")
def gallery():
    return render_template(
        "stories/gallery.html",
        active="story",
        title="Stories",
        cards=story_cards(registry.EXAMPLES),
    )


@bp.get("/story/<story_id>")
def reader(story_id):
    base_id, _lang = split_id(story_id)
    example = next((e for e in registry.EXAMPLES if e["id"] == base_id), None)
    if example is None:
        abort(404)

    draft = request.args.get("draft") == "1"
    theme = request.args.get("theme")
    story = load_story(story_id, example, draft=draft, theme=theme)
    if story is None:
        abort(404, f"No story authored for {story_id!r} yet.")

    # Only ship the hydrator for block types this story actually uses.
    hydrate_types = sorted(
        {b["type"] for b in story["blocks"] if BLOCKS[b["type"]].hydrate}
    )
    return render_template(
        "stories/story.html",
        active="story",
        title=f"Story · {story['meta']['title']}",
        example=example,
        meta=story["meta"],
        blocks=story["blocks"],
        theme=story["meta"]["theme"],
        themes=THEMES,
        hydrate_types=hydrate_types,
        icons=ICONS,
        is_draft=draft and draft_available(story_id),
        languages=translations(base_id),
        collection=_collection_mates(base_id),
    )
