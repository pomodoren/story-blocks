"""
Static-site export: render every publishable story with the same templates the Flask reader
serves, vendor its CDN/font dependencies, rewrite URLs to be relative, and audit the result.

Split by concern: :mod:`.config` (defaults and classification constants), :mod:`.dependencies`
(which blocks are live or still reach the network), :mod:`.vendor` (CDN/font downloading),
:mod:`.rewrite` (URL rewriting and the portability audit), and :mod:`.build` (preflight
validation, the build orchestration, and the ``python -m storyblocks.export.build`` CLI).

``build()`` and ``rewrite()`` share their names with the submodules that define them, so they
are reached as ``storyblocks.export.build.build()`` and ``storyblocks.export.rewrite.rewrite()``
rather than re-exported here -- re-exporting them under the same name would shadow the
submodule itself for anyone importing it.
"""

from .build import preflight
from .config import LIVE_TYPES
from .dependencies import remote_dependencies
from .rewrite import audit

__all__ = [
    "LIVE_TYPES",
    "audit",
    "preflight",
    "remote_dependencies",
]
