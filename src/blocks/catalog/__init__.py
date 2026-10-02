"""
The block catalog: every block type's config shape and the lookup / normalisation entry
points. Block definitions are split by concern into :mod:`.text`, :mod:`.media`,
:mod:`.domain` (live earthquake-risk blocks), :mod:`.maps` and :mod:`.data`; the validation
rules live in :mod:`storyblocks.blocks.validators`.

A story (``<content>/<id>/story.yaml``) is ``{meta, blocks: [{type, config}]}``. Every
block ``type`` is one entry in ``BLOCKS``, one Jinja partial (``templates/stories/blocks/
<type>.html``), and -- if it needs live data -- one hydrator (``static/story/blocks/
<type>.js``, registered as ``window.STORY_BLOCKS[type]``). Improve a block by editing those
three files; nothing else has to know.

``BLOCKS`` is the single source of truth for what a block's config accepts. The build
library (``storyblocks/authoring``) validates authored config against it; the blueprint
normalises config (fills defaults) before rendering. ``plain`` fields are autoescaped in the
partial, ``rich`` fields are rendered ``| safe`` -- keep the partial in step.
"""

from ..model import BlockError
from ..validators import VALIDATORS
from . import data, domain, maps, media, text

BLOCKS = {
    bt.name: bt
    for bt in [
        *text.BLOCKS,
        *media.BLOCKS,
        *domain.BLOCKS,
        *maps.BLOCKS,
        *data.BLOCKS,
    ]
}


for _block in BLOCKS.values():
    _block.validators = tuple(
        validator for names, validator in VALIDATORS if _block.name in names
    )


def get_block(name):
    try:
        return BLOCKS[name]
    except KeyError:
        raise BlockError(
            f"unknown block type {name!r} -- known: {sorted(BLOCKS)}"
        ) from None


def normalise_block(block):
    """``{type, config}`` -> ``{type, config}`` with the type's defaults merged in."""

    bt = get_block(block.get("type"))
    return {"type": bt.name, "config": bt.normalise(block.get("config"))}
