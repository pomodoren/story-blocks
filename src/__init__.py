"""Build block-based communication products and publish them as static pages.

The core authoring API does not import Flask. Web preview and static export are available through
the ``storyblocks`` command, and their dependencies are included in the default installation.
"""

from .authoring import Story, StoryError, dump_spine, load_spine
from .blocks import BLOCKS, BlockError, BlockType, get_block, normalise_block

__all__ = [
    "BLOCKS",
    "BlockError",
    "BlockType",
    "Story",
    "StoryError",
    "dump_spine",
    "get_block",
    "load_spine",
    "normalise_block",
]
