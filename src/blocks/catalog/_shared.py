"""Catalog fragments shared by more than one concern module."""

from typing import TypedDict


class _TextConfig(TypedDict):
    plain: tuple[str, str]


#: Shared ``plain`` fields for blocks whose only escaped fields are eyebrow + title;
#: spread with ``**_TEXT`` so each entry's keyword args stay precisely typed.
_TEXT: _TextConfig = {"plain": ("eyebrow", "title")}
