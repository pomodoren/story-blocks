"""
The Stories reader as its own Flask app (``python -m storyblocks``, http://localhost:9001/).

No database and no host-app import: it serves the ``/stories/`` gallery and ``/story/<id>``
from the built ``data/*.yaml``. Blocks that hydrate from live ``/api/*`` endpoints need the
dashboard (or another host of those APIs) and show their "not available" state without it; static
blocks render fully. Its own ``templates/stories/base.html`` is a plain shell styled by
``static/story/base.css``, used here and wherever this blueprint is mounted.
"""

import os

from flask import Flask, redirect

from .blueprint import bp


def create_app():
    """Builds the standalone Stories application."""

    app = Flask(__name__, static_folder=None)
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    # the visual builder writes spines / drafts, so it is on only for this local app
    app.config["STORIES_EDITOR"] = os.getenv("STORYBLOCKS_EDITOR", "1") != "0"
    app.register_blueprint(bp)

    @app.get("/")
    def index():
        return redirect("/stories/", code=302)

    @app.context_processor
    def _shell_context():
        return {
            "nav_items": [],
            "maptiler_key": os.getenv("STORYBLOCKS_MAPTILER_KEY", ""),
        }

    return app


def main():
    host = os.getenv("STORYBLOCKS_HOST", "127.0.0.1")
    port = int(os.getenv("STORYBLOCKS_PORT", "9001"))
    print(f"Storyblocks  ->  http://localhost:{port}/")
    create_app().run(host=host, port=port, threaded=True)


if __name__ == "__main__":
    main()
