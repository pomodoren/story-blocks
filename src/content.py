"""
Where the story *content* lives -- kept apart from the package so the engine ships without it.

Every story is one self-contained folder::

    <content>/<id>/
        story.md          the Markdown spine you write (front matter holds label, theme, ...)
        story.yaml        the built artifact (``storyblocks build``)
        story.<lang>.md   optional translation, built to story.<lang>.yaml, served as <id>.<lang>
        assets/           every image, video, audio and GeoJSON file the story uses
        story.draft.yaml  unpublished editor build (git-ignored)

The content folder defaults to the sample stories in ``examples/stories``; point
``STORYBLOCKS_CONTENT`` at your own folder to use another. A story's files reference its assets
as ``assets/<name>``, which resolves to ``/story-assets/stories/<id>/assets/<name>``.
"""

import os
from pathlib import Path

DEFAULT_CONTENT_DIR = Path(__file__).resolve().parents[1] / "examples" / "stories"
ASSET_URL = "/story-assets/stories"


class ContentError(ValueError):
    """The configured content root cannot be used."""


def content_dir() -> Path:
    """The content root: ``STORYBLOCKS_CONTENT`` if set (read on every call), else the samples."""

    return Path(os.getenv("STORYBLOCKS_CONTENT") or DEFAULT_CONTENT_DIR)


def require_content_dir() -> Path:
    """Return the content root or raise ``ContentError`` with configuration guidance."""

    root = content_dir()
    if not root.is_dir():
        raise ContentError(
            f"content folder not found: {root}\n"
            "Set STORYBLOCKS_CONTENT=/absolute/path to a folder of story directories "
            "(each with a story.md)."
        )
    return root


def __getattr__(name: str) -> Path:
    if name == "CONTENT_DIR":  # kept for callers that predate content_dir()
        return content_dir()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def split_id(story_id: str) -> tuple[str, str]:
    """``"deck-demo.de"`` -> ``("deck-demo", "de")`` when ``deck-demo`` is a story folder;
    a plain id is its own base."""

    base, dot, lang = story_id.rpartition(".")
    if dot and (content_dir() / base).is_dir():
        return base, lang
    return story_id, ""


def story_dir(story_id: str) -> Path:
    return content_dir() / split_id(story_id)[0]


def _file(story_id: str, suffix: str) -> Path:
    lang = split_id(story_id)[1]
    return story_dir(story_id) / (f"story.{lang}{suffix}" if lang else f"story{suffix}")


def spine_path(story_id: str) -> Path:
    return _file(story_id, ".md")


def built_path(story_id: str) -> Path:
    return _file(story_id, ".yaml")


def draft_path(story_id: str) -> Path:
    return _file(story_id, ".draft.yaml")


def assets_dir(story_id: str) -> Path:
    return story_dir(story_id) / "assets"


def asset_url(story_id: str, name: str = "") -> str:
    return f"{ASSET_URL}/{split_id(story_id)[0]}/assets/{name}"


def story_ids() -> list[str]:
    """Every base story id that has a built artifact, in alphabetical order."""

    if not content_dir().is_dir():
        return []
    return sorted(
        p.name
        for p in content_dir().iterdir()
        if not p.name.startswith((".", "_")) and (p / "story.yaml").is_file()
    )


def spine_ids() -> list[str]:
    """Every story id with a spine -- translations included (``deck-demo.de``)."""

    ids: list[str] = []
    for folder in (
        sorted(
            p
            for p in content_dir().iterdir()
            if p.is_dir() and not p.name.startswith((".", "_"))
        )
        if content_dir().is_dir()
        else []
    ):
        for spine in sorted(folder.glob("story*.md")):
            lang = (
                spine.name[len("story.") : -len(".md")]
                if spine.name != "story.md"
                else ""
            )
            ids.append(f"{folder.name}.{lang}" if lang else folder.name)
    return ids
