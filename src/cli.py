"""Command-line interface for building and exporting communication products."""

import argparse
import os
from pathlib import Path

from .content import ContentError, require_content_dir


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="storyblocks")
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="compile Markdown spines")
    build.add_argument(
        "--content",
        type=Path,
        required=True,
        help="folder containing story directories",
    )
    build.add_argument("stories", nargs="*")
    build.add_argument("--draft", action="store_true")
    export = commands.add_parser("export", help="export static HTML pages")
    export.add_argument(
        "--content",
        type=Path,
        required=True,
        help="folder containing story directories",
    )
    export.add_argument("stories", nargs="*")
    export.add_argument("--out", default="dist/site")
    export.add_argument("--cache")
    export.add_argument(
        "--offline",
        action="store_true",
        help="fail if any story needs the network at view time",
    )
    serve = commands.add_parser("serve", help="preview stories locally")
    serve.add_argument(
        "--content",
        type=Path,
        required=True,
        help="folder containing story directories",
    )
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=9001)
    args = parser.parse_args(argv)
    previous_content = os.environ.get("STORYBLOCKS_CONTENT")
    os.environ["STORYBLOCKS_CONTENT"] = str(args.content.resolve())
    try:
        return _run(args)
    except ContentError as exc:
        raise SystemExit(str(exc)) from exc
    finally:
        if previous_content is None:
            os.environ.pop("STORYBLOCKS_CONTENT", None)
        else:
            os.environ["STORYBLOCKS_CONTENT"] = previous_content


def _run(args: argparse.Namespace) -> int:
    """Execute a parsed command while its content directory is active."""
    require_content_dir()
    if args.command == "build":
        from .authoring.build import main as build_main

        return build_main((["--draft"] if args.draft else []) + args.stories)
    if args.command == "export":
        from .export.build import build as export_static

        return (
            1
            if export_static(
                args.out, args.stories, cache=args.cache, offline=args.offline
            )
            else 0
        )
    from .web.app import create_app

    create_app().run(host=args.host, port=args.port, threaded=True)
    return 0
