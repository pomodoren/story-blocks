"""
The `Story` accumulator: a spine parses into ``.meta(...)`` + a run of ``.block(type, ...)``
calls, then ``.build()`` writes ``<content>/<id>/story.yaml`` (``{meta, blocks}``).

Placeholders are left verbatim -- ``{label}`` and friends are substituted at *load* time by
``storyblocks.loader``, so a spine writes ``"{label}, one step at a time"`` straight
through.
"""

import io
from pathlib import Path

from .. import artifact
from ..content import asset_url, assets_dir, built_path, draft_path
from ._validate import StoryError, validate_story


def md(path):
    """Read a prose file."""

    return Path(path).read_text(encoding="utf-8").strip()


class Story:
    """One story: ``meta`` + an ordered list of typed blocks."""

    def __init__(self, story_id, *, iso3=None, scenario=None, title=None, theme=None):
        if not story_id or "/" in story_id or story_id != story_id.strip():
            raise StoryError(f"story id must be a clean slug, got {story_id!r}")
        self.id = story_id
        #: Subject binding, written to ``meta`` so the reader's hydrators know which country /
        #: scenario.
        self.iso3 = iso3
        self.scenario = scenario
        self._meta = {"id": story_id}
        for key, value in (
            ("title", title),
            ("theme", theme),
            ("iso3", iso3),
            ("scenario", scenario),
        ):
            if value is not None:
                self._meta[key] = value
        self._blocks = []
        self._assets = {}  # name -> bytes, flushed to <story>/assets/ on build()

    # ---------------------------------------------------------------- assembly

    def meta(self, **fields):
        """Merge story-level fields -- ``title``, ``theme``, ``iso3``, ``scenario``."""

        for key, value in fields.items():
            if value is not None:
                self._meta[key] = value
        if "iso3" in fields:
            self.iso3 = fields["iso3"]
        if "scenario" in fields:
            self.scenario = fields["scenario"]
        return self

    def block(self, block_type, **config):
        """Append one block. ``config`` is validated against the catalog at ``.to_dict()``."""

        self._blocks.append(
            {
                "type": block_type,
                "config": {k: v for k, v in config.items() if v is not None},
            }
        )
        return self

    def freeze(self, source, name):
        """Record a static asset (for an ``image-card`` block) and return the URL for it.
        ``source`` is raw ``bytes``, a path, or a matplotlib figure."""

        if (
            not isinstance(name, str)
            or not name
            or name in {".", ".."}
            or "/" in name
            or "\\" in name
        ):
            raise StoryError(f"asset name must be a filename, got {name!r}")

        if isinstance(source, (bytes, bytearray)):
            data = bytes(source)
        elif hasattr(source, "savefig"):
            buffer = io.BytesIO()
            source.savefig(buffer, format="png", dpi=144, bbox_inches="tight")
            data = buffer.getvalue()
        else:
            data = Path(source).read_bytes()
        self._assets[name] = data
        return asset_url(self.id, name)

    # ---------------------------------------------------------------- output

    def to_dict(self):
        self.warnings = validate_story(self._meta, self._blocks)
        return {"meta": dict(self._meta), "blocks": self._blocks}

    def _write(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(artifact.dumps(self.to_dict()), encoding="utf-8")
        if self._assets:
            asset_dir = assets_dir(self.id)
            asset_dir.mkdir(parents=True, exist_ok=True)
            for name, data in self._assets.items():
                (asset_dir / name).write_bytes(data)
        return path

    def build(self, *, publish=True):
        """Write the story: ``publish=True`` -> ``<content>/<id>/story.yaml`` (served);
        ``publish=False`` -> ``story.draft.yaml`` beside it (git-ignored, ``?draft=1``)."""

        return self._write((built_path if publish else draft_path)(self.id))

    # ---------------------------------------------------------------- preview

    def preview(self, *, draft=False):
        """Author's-eye view: the block list, with a one-line data summary for live blocks."""

        lines = [
            f"# {self._meta.get('title', self.id)}  ({self._meta.get('theme', 'editorial')})",
            "",
        ]
        for i, block in enumerate(self._blocks, 1):
            cfg = block["config"]
            head = f"{i:2}. `{block['type']}`"
            if cfg.get("title"):
                head += f" — {cfg['title']}"
            lines.append(head)
            body = cfg.get("body") or cfg.get("text") or cfg.get("explanation")
            if body:
                lines.append(f"    {body[:100]}")
        lines.append(
            f"\n---\n{len(self._blocks)} blocks"
            + (f" · assets: {', '.join(self._assets)}" if self._assets else "")
        )
        blob = "\n".join(lines)
        if draft:
            blob += f"\n\ndraft: `{self.build(publish=False)}`"
        try:
            from IPython.display import Markdown, display

            display(Markdown(blob))
        except ImportError:
            print(blob)
