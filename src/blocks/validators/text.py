"""Validators for plain text/layout blocks: ``button`` (href) and the ``style`` token list
shared by ``divider`` and ``button``.
"""

from ..model import BlockError

STYLE_VALUES = {
    "divider": ("line", "dots", "space"),
    "button": ("primary", "ghost", "large", "small", "block"),
}


def normalise_style(block: str, value: object) -> list[str]:
    """``style`` as a de-duplicated list of known values: ``"primary large"``, ``"primary, large"``
    and ``[primary, large]`` all become ``["primary", "large"]``."""

    if value is None:
        tokens = []
    elif isinstance(value, str):
        tokens = value.replace(",", " ").split()
    elif isinstance(value, (list, tuple)) and all(isinstance(v, str) for v in value):
        tokens = [t for v in value for t in v.replace(",", " ").split()]
    else:
        raise BlockError(
            f"block {block!r}: style must be a string or a list of strings, got {value!r}"
        )
    bad = [t for t in tokens if t not in STYLE_VALUES[block]]
    if bad:
        raise BlockError(
            f"block {block!r}: unknown style {bad} (accepts {list(STYLE_VALUES[block])})"
        )
    return list(dict.fromkeys(tokens))


def _check_button_href(
    name: str, merged: dict[str, object], given: dict[str, object]
) -> None:
    if not str(merged["href"]).startswith(("/", "#", "http://", "https://")):
        raise BlockError(
            f"block 'button': href must be http(s), a site path or #anchor, got {merged['href']!r}"
        )


def _check_style(
    name: str, merged: dict[str, object], given: dict[str, object]
) -> None:
    merged["style"] = normalise_style(name, merged.get("style"))
