"""
The block catalog, data model: the :class:`BlockType` contract and :class:`BlockError`.

A block type declares its config shape (plain / rich / required / defaults / allowed / items)
and carries ``validators``: hooks that validate or rewrite a merged config. The concrete catalog
(``BLOCKS``) and its per-block rules live in :mod:`storyblocks.blocks.catalog`.
"""

from collections.abc import Callable, Iterable

#: ``(name, merged, given) -> None``: validates ``merged`` (and may rewrite it in place).
ValidatorHook = Callable[[str, dict[str, object], dict[str, object]], None]


class BlockError(ValueError):
    """A block's config is invalid. Raised at build time, never at request time."""


class BlockType:
    """One entry in the catalog: how a block's config is shaped and where it renders."""

    def __init__(
        self,
        name: str,
        *,
        summary: str,
        layout: str = "split",
        hydrate: bool = False,
        plain: Iterable[str] = (),
        rich: Iterable[str] = (),
        required: Iterable[str] = (),
        defaults: dict[str, object] | None = None,
        allowed: Iterable[str] | None = None,
        items: str | None = None,
        item_keys: Iterable[str] = (),
    ) -> None:
        self.name = name
        self.summary = summary
        #: "full" (text only), "split" (text + media), "split-wide", "hero" (cover), "band",
        #: "tour" (guided-tour), "stage" (photo-scenes / stat-cards: pinned full-bleed stage).
        self.layout = layout
        #: True when static/story/blocks/<name>.js must load to fill live data.
        self.hydrate = hydrate
        self.plain = tuple(plain)  # autoescaped in the partial
        self.rich = tuple(rich)  # rendered | safe
        self.required = tuple(required)
        self.defaults = dict(defaults or {})
        #: When set, config keys are restricted to this set (plus plain/rich/required/defaults).
        self.allowed = set(allowed) if allowed is not None else None
        #: Step-style blocks (guided-tour / photo-scenes / stat-cards) carry a list of items under
        #: this config key. The spine can author them as ``### Title {attrs}`` sections instead
        #: of YAML, and the validator checks every item against ``item_keys``.
        self.items = items
        self.item_keys = frozenset(item_keys)
        #: ``(name, merged, given) -> None`` hooks run by :meth:`normalise` after the required-key
        #: check; they validate and may rewrite ``merged``. Set by the catalog module.
        self.validators: tuple[ValidatorHook, ...] = ()

    @property
    def known_keys(self) -> set[str]:
        keys = (
            set(self.plain) | set(self.rich) | set(self.required) | set(self.defaults)
        )
        if self.items:
            keys.add(self.items)
        if self.allowed is not None:
            keys |= self.allowed
        return keys

    def normalise(self, config: dict[str, object] | None) -> dict[str, object]:
        """Merge defaults, run the type's validators and (if restricted) reject unknown keys.
        Does *not* run the text guardrails -- see ``storyblocks.authoring._validate``.

        Parameters:
            config: the authored config mapping (or ``None``).

        Returns:
            The merged config, with defaults filled in and validator rewrites applied.

        Raises:
            BlockError: a required key is missing, a validator fails or an unknown key is given.
        """

        given = config or {}
        merged = {**self.defaults, **given}
        missing = [key for key in self.required if merged.get(key) in (None, "", [])]
        if missing:
            raise BlockError(f"block {self.name!r}: missing required config {missing}")
        for validate in self.validators:
            validate(self.name, merged, given)
        if self.allowed is not None:
            unknown = set(merged) - self.known_keys
            if unknown:
                raise BlockError(
                    f"block {self.name!r}: unknown config {sorted(unknown)} "
                    f"(accepts {sorted(self.known_keys)})"
                )
        return merged
