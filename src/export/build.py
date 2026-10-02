"""
Build the Stories as a static website: a gallery plus one folder per story.

    python -m storyblocks.export.build [--out dist/site] [story-id ...]

    dist/site/
      index.html                 the gallery
      <story-id>/index.html      one page per story
      assets/story/              this package's CSS, themes, block scripts, media, data
      assets/vendor/             MapLibre, Lenis, CountUp and the fonts -- vendored, no CDN

It renders the very same templates the Flask reader serves (through an in-process client), so
there is one renderer, and rewrites every URL to be *relative*: the site works from any path
(GitHub Pages project sites, an S3 prefix, ``file://``) with no server configuration.

The story artifacts it reads (``<id>/story.yaml``, ``{meta, blocks}``) are plain YAML with
relative-to-root asset URLs, so the same files can later feed a static-site generator's content
collection unchanged.
"""

import argparse
import logging
import re
import shutil
import sys
from pathlib import Path

import yaml
from flask import render_template

from .. import artifact
from ..blocks import BlockError
from ..content import assets_dir, built_path, content_dir, split_id
from ..loader import load_story, story_cards, translations
from ..web.app import create_app
from .config import DEFAULT_OUT, LIVE_TYPES, STATIC_STORY
from .dependencies import live_blocks, remote_dependencies
from .rewrite import _unused_block_js, audit, rewrite
from .vendor import CDN, FONTS_LINK, vendor_cdn, vendor_fonts

logger = logging.getLogger(__name__)


def _local_assets(value: object):
    """Yield ``(owner, name)`` pairs for local story-asset URLs in nested data."""
    if isinstance(value, dict):
        for nested in value.values():
            yield from _local_assets(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _local_assets(nested)
    elif isinstance(value, str):
        match = re.fullmatch(
            r"/story-assets/stories/([^/]+)/assets/([^?#]+)(?:[?#].*)?", value
        )
        if match:
            yield match.group(1), match.group(2)


def _artifact_variants(story_id: str) -> list[Path]:
    """Return the base artifact and its built translations, excluding drafts."""
    base = built_path(story_id)
    variants = [base]
    variants.extend(
        path
        for path in sorted(base.parent.glob("story.*.yaml"))
        if path.name != "story.draft.yaml" and not path.name.endswith(".draft.yaml")
    )
    return variants


def preflight(
    story_ids: list[str] | None = None, offline: bool = False
) -> tuple[
    list[tuple[dict[str, object], list[str]]],
    list[tuple[dict[str, object], list[str]]],
    dict[str, list[tuple[str, str]]],
]:
    """Validate export inputs before rendering or writing output.

    Parameters:
        story_ids: Optional story IDs to export. All story folders are checked by default.
        offline: Whether remote runtime dependencies should fail validation.

    Returns:
        A tuple containing publishable stories, skipped live stories, and remote dependencies.

    Raises:
        SystemExit: If artifacts, referenced assets, story data, or offline requirements are
            invalid. All detected input problems are reported together.
    """
    wanted = list(story_ids or [])
    root = content_dir()
    available = sorted(
        path.name
        for path in root.iterdir()
        if path.is_dir() and not path.name.startswith((".", "_"))
    )
    selected = wanted or available
    problems = []
    examples = []

    for story_id in selected:
        folder = root / story_id
        path = built_path(story_id)
        if not folder.is_dir():
            problems.append(f"{story_id}: story folder is missing")
            continue
        if not path.is_file():
            problems.append(
                f"{story_id}: missing story.yaml (run `storyblocks build {story_id}`)"
            )
            continue
        try:
            raw = artifact.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                raise TypeError("top level must be a mapping")
            meta = raw.get("meta", {})
            if not isinstance(meta, dict):
                raise TypeError("meta must be a mapping")
            example = {
                "id": story_id,
                "label": meta.get("label") or story_id,
                "iso3": meta.get("iso3"),
                "scenario_slug": meta.get("scenario"),
            }
            story = load_story(story_id, example)
            if story is None:
                raise TypeError("story artifact could not be loaded")
            examples.append((example, story))
        except (
            OSError,
            UnicodeError,
            yaml.YAMLError,
            BlockError,
            TypeError,
            KeyError,
        ) as exc:
            problems.append(f"{story_id}: invalid story.yaml: {exc}")
            continue

        base_id = split_id(story_id)[0]
        for variant_path in _artifact_variants(story_id):
            try:
                variant = artifact.loads(variant_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, yaml.YAMLError) as exc:
                problems.append(f"{story_id}: invalid {variant_path.name}: {exc}")
                continue
            for owner, name in sorted(set(_local_assets(variant))):
                if owner != base_id:
                    problems.append(
                        f"{story_id}: {variant_path.name} uses another story asset: "
                        f"{owner}/assets/{name}"
                    )
                elif not (assets_dir(base_id) / name).is_file():
                    problems.append(f"{story_id}: missing assets/{name}")

    publishable: list[tuple[dict[str, object], list[str]]] = []
    skipped: list[tuple[dict[str, object], list[str]]] = []
    remote: dict[str, list[tuple[str, str]]] = {}
    for example, story in examples:
        live = live_blocks(story)
        (skipped if live else publishable).append((example, live))
        if not live:
            example_id = str(example["id"])
            remote[example_id] = remote_dependencies(story)

    if wanted:
        for example, live in skipped:
            example_id = str(example["id"])
            live_names = ", ".join(live)
            problems.append(
                f"{example_id}: needs live data ({live_names}); "
                "only static-native blocks can be exported"
            )
    if offline:
        for story_id, dependencies in remote.items():
            for kind, host in dependencies:
                problems.append(f"{story_id}: remote dependency: {kind} -> {host}")
    if not publishable and not problems:
        problems.append("nothing to publish")
    if problems:
        details = "\n".join(f"  - {problem}" for problem in problems)
        raise SystemExit(f"export preflight failed:\n{details}\nexport was not started")
    return publishable, skipped, remote


def _swap_in(built, final):
    """Replace ``final`` with ``built`` so a deployed site is never left half-written."""
    previous = final.with_name(f".{final.name}.previous")
    shutil.rmtree(previous, ignore_errors=True)
    if final.exists():
        final.rename(previous)
    built.rename(final)
    shutil.rmtree(previous, ignore_errors=True)


def build(out, story_ids=None, cache=None, offline=False):
    """Export the stories into ``out``; return the audit problems (empty when portable).

    The site is assembled in a sibling directory and only replaces ``out`` once the audit is
    clean, so a failed download or a bad story leaves the previous build intact.
    """
    final = Path(out)
    out = final.with_name(f".{final.name}.building")
    cache = Path(cache) if cache else final.parent / ".vendor-cache"
    publishable, skipped, remote = preflight(story_ids, offline)
    for example, live in skipped:
        story_id = example["id"]
        live_names = ", ".join(live)
        message = f"{story_id}: needs live data ({live_names})"
        print(f"  skipped  {message}")
    needs_network = {i: deps for i, deps in remote.items() if deps}
    for story_id, deps in needs_network.items():
        print(
            f"  network  {story_id}: "
            + "; ".join(f"{kind} -> {host}" for kind, host in deps)
        )

    app = create_app()

    shutil.rmtree(out, ignore_errors=True)
    try:
        return _build_into(out, final, cache, app, publishable)
    except BaseException:
        shutil.rmtree(out, ignore_errors=True)
        raise


def _build_into(out, final, cache, app, publishable):
    client = app.test_client()
    (out / "assets").mkdir(parents=True)

    # --- render every page first, so we know which CDN files to vendor ---------------
    pages = {}
    for example, _ in publishable:
        # the story plus its built translations (<id>.<lang>), each its own page
        for variant in [
            {"id": example["id"]},
            *[t for t in translations(example["id"]) if t["id"] != example["id"]],
        ]:
            response = client.get(f"/story/{variant['id']}")
            if response.status_code != 200:
                raise SystemExit(
                    f"/story/{variant['id']} -> HTTP {response.status_code}"
                )
            pages[variant["id"]] = response.get_data(as_text=True)
    with app.test_request_context("/stories/"):
        cards = story_cards([e for e, _ in publishable])
        gallery = render_template(
            "stories/gallery.html",
            active="story",
            title="Stories",
            cards=cards,
            static_site=True,
        )
    cdn_urls = {u for html in [gallery, *pages.values()] for u in CDN.findall(html)}
    fonts_url = next(iter(FONTS_LINK.findall(next(iter(pages.values())))), None)

    # --- assets ------------------------------------------------------------------------
    vendor = out / "assets" / "vendor"
    vendor.mkdir(parents=True)
    vendor_map = vendor_cdn(cdn_urls, vendor, cache)
    if fonts_url:
        vendor_fonts(fonts_url.replace("&amp;", "&"), vendor, cache)
    shutil.copytree(
        STATIC_STORY,
        out / "assets" / "story",
        ignore=shutil.ignore_patterns(
            *(
                f"{t}.js"
                for t in _unused_block_js(pages.values(), LIVE_TYPES | {"swipe"})
            )
        ),
    )
    for example, _ in publishable:  # each story ships only its own assets/ folder
        source = assets_dir(example["id"])
        if source.is_dir():
            shutil.copytree(
                source, out / "assets" / "stories" / example["id"] / "assets"
            )
    for theme in (out / "assets" / "story" / "themes").glob("*.css"):
        # the theme pulls its fonts with an @import; fonts.css (vendored) already covers them
        theme.write_text(
            re.sub(
                r"@import url\([^)]*fonts\.googleapis[^)]*\);\n?", "", theme.read_text()
            ),
            encoding="utf-8",
        )
    (out / ".nojekyll").write_text("", encoding="utf-8")

    # --- pages -------------------------------------------------------------------------
    (out / "index.html").write_text(
        rewrite(gallery, "", vendor_map, fonts_css="fonts.css"), encoding="utf-8"
    )
    for story_id, html in pages.items():
        folder = out / story_id
        folder.mkdir()
        (folder / "index.html").write_text(
            rewrite(html, "../", vendor_map, fonts_css="fonts.css"), encoding="utf-8"
        )

    size = sum(f.stat().st_size for f in out.rglob("*") if f.is_file()) / 1e6
    problems = audit(out)
    for line in problems:
        logger.error("leftover  %s", line)
    if problems:
        shutil.rmtree(out)
        logger.error("not published: %s is unchanged", final)
        return problems
    _swap_in(out, final)
    print(f"  built {len(pages)} stories -> {final}  ({size:.1f} MB)")
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "stories", nargs="*", help="story ids (default: every publishable story)"
    )
    parser.add_argument(
        "--out", default=DEFAULT_OUT, help="output folder (default: dist/site)"
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="fail if any story needs the network at view time",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(format="  %(message)s")
    problems = build(args.out, args.stories, offline=args.offline)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
