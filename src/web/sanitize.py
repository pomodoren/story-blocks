"""Allowlist sanitization for HTML produced from untrusted authored rich text."""

import html
import re
from html.parser import HTMLParser

ALLOWED_TAGS = frozenset(
    {
        "a",
        "blockquote",
        "br",
        "code",
        "div",
        "em",
        "figcaption",
        "figure",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "hr",
        "img",
        "li",
        "ol",
        "p",
        "pre",
        "section",
        "span",
        "strong",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
    }
)
DROP_WITH_CONTENT = frozenset({"audio", "iframe", "script", "style", "svg", "video"})
GLOBAL_ATTRIBUTES = frozenset({"class", "title"})
TAG_ATTRIBUTES = {
    "a": frozenset({"data-map-action", "href", "rel", "target"}),
    "img": frozenset({"alt", "height", "loading", "src", "width"}),
}
URL_ATTRIBUTES = frozenset({"href", "src"})
SAFE_SCHEMES = frozenset({"http", "https", "mailto", "tel"})
SCHEME = re.compile(r"^([a-z][a-z0-9+.-]*):")
VOID_TAGS = frozenset({"br", "hr", "img"})


def safe_url(value: str) -> str:
    """Return a relative or safe-scheme URL, replacing dangerous URLs with ``#``."""
    decoded = re.sub(r"[\x00-\x20\x7f]+", "", html.unescape(value)).lower()
    scheme = SCHEME.match(decoded)
    return "#" if scheme and scheme.group(1) not in SAFE_SCHEMES else value


class _Sanitizer(HTMLParser):
    """Rebuild HTML using the small set of elements supported in authored prose."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.output: list[str] = []
        self._dropped: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self._dropped:
            if tag in DROP_WITH_CONTENT:
                self._dropped.append(tag)
            return
        if tag in DROP_WITH_CONTENT:
            self._dropped.append(tag)
            return
        if tag not in ALLOWED_TAGS:
            return
        allowed = GLOBAL_ATTRIBUTES | TAG_ATTRIBUTES.get(tag, frozenset())
        clean: list[tuple[str, str]] = []
        for name, value in attrs:
            name = name.lower()
            if name not in allowed or value is None:
                continue
            if name in URL_ATTRIBUTES:
                value = safe_url(value)
            if name == "target" and value not in {"_blank", "_self"}:
                continue
            clean.append((name, value))
        if tag == "a" and ("target", "_blank") in clean:
            clean = [(name, value) for name, value in clean if name != "rel"]
            clean.append(("rel", "noopener noreferrer"))
        attributes = "".join(
            f' {name}="{html.escape(value, quote=True)}"' for name, value in clean
        )
        self.output.append(f"<{tag}{attributes}>")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._dropped:
            if tag == self._dropped[-1]:
                self._dropped.pop()
            return
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.output.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self._dropped:
            self.output.append(html.escape(data, quote=False))

    def handle_entityref(self, name: str) -> None:
        if not self._dropped:
            self.output.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if not self._dropped:
            self.output.append(f"&#{name};")


def sanitize_html(value: str) -> str:
    """Return allowlisted HTML safe to mark as trusted in a template."""
    parser = _Sanitizer()
    parser.feed(value)
    parser.close()
    return "".join(parser.output)
