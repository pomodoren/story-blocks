"""
A very small Markdown -> HTML renderer for story prose.

A story's ``rich`` fields -- a ``text`` block's ``body``, a ``guided-tour`` step's ``text``,
a ``cover``'s ``text`` -- are authored as Markdown and turned into HTML here at request
time, then dropped into the block partial through the ``markdown`` / ``md_inline`` Jinja
filters (registered in :mod:`.blueprint`).

It is intentionally tiny, but its output is sanitised before being marked safe. A conservative
allowlist preserves ordinary prose markup while removing executable tags, event handlers, and
unsafe URL schemes. What this adds on top is *structure*:

- blank-line-separated paragraphs (``<p>``);
- ATX headings ``#`` .. ``######`` -> ``<h1>`` .. ``<h6>``;
- ``-`` / ``*`` / ``+`` bullet lists and ``1.`` / ``1)`` ordered lists;
- ``---`` / ``***`` horizontal rules;
- inline ``**bold**`` / ``__bold__``, ``*italic*`` / ``_italic_``, ``` `code` ``` and
  ``[text](url "title")`` links; ``[text](map:lon,lat,zoom)`` is a map action (flies a map there).

A line that begins with a block-level HTML tag is kept as its own block before the final
sanitisation pass.
"""

import re

from markupsafe import Markup, escape

from .sanitize import safe_url, sanitize_html

_INLINE_CODE = re.compile(r"`([^`]+?)`")
_LINK = re.compile(r"\[([^\]]+)\]\((\S+?)(?:\s+\"([^\"]*)\")?\)")
_BOLD = re.compile(r"(\*\*|__)(?=\S)(.+?)(?<=\S)\1")
_ITALIC = re.compile(r"(?<![\w*])([*_])(?=\S)(.+?)(?<=\S)\1(?![\w*])")
_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_ULI = re.compile(r"^[-*+]\s+(.*)$")
_OLI = re.compile(r"^\d+[.)]\s+(.*)$")
_HR = re.compile(r"^(?:-{3,}|\*{3,}|_{3,})$")
_BLOCK_HTML = re.compile(
    r"^<\s*/?\s*(?:div|section|article|figure|figcaption|table|thead|tbody|tr|td|th|"
    r"ul|ol|li|p|h[1-6]|blockquote|pre|hr|img|iframe|video|audio|details|summary)\b",
    re.IGNORECASE,
)


_MAP_ACTION = re.compile(
    r"^map:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d{1,2}(?:\.\d+)?))?$"
)


def _attr(value: str) -> str:
    """Make ``value`` safe inside a double-quoted attribute without touching entities."""

    return value.replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def _link(m: re.Match[str]) -> str:
    """``[text](url)``; ``[text](map:lon,lat[,zoom])`` is a *map action* -- clicking it flies the
    story's map there (story.js)."""

    title = f' title="{_attr(m.group(3))}"' if m.group(3) else ""
    if action := _MAP_ACTION.match(m.group(2)):
        data = ",".join(g for g in action.groups() if g)
        return f'<a href="#map" data-map-action="{data}"{title}>{m.group(1)}</a>'
    return f'<a href="{_attr(safe_url(m.group(2)))}"{title}>{m.group(1)}</a>'


def _inline(text: str) -> str:
    """Inline spans. Code spans are stashed first so nothing else touches their contents."""

    stash: list[str] = []

    def _keep_code(match: re.Match[str]) -> str:
        stash.append(f"<code>{escape(match.group(1))}</code>")
        return f"\x00{len(stash) - 1}\x00"

    text = _INLINE_CODE.sub(_keep_code, text)
    text = _LINK.sub(_link, text)
    text = _BOLD.sub(lambda m: f"<strong>{m.group(2)}</strong>", text)
    text = _ITALIC.sub(lambda m: f"<em>{m.group(2)}</em>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: stash[int(m.group(1))], text)


def _render(src: object, *, inline_only: bool) -> str:
    if not src:
        return ""
    lines = str(src).replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out: list[str] = []
    para: list[str] = []
    i = 0

    def flush_para() -> None:
        if para:
            joined = _inline(" ".join(part.strip() for part in para).strip())
            if joined:
                out.append(joined if inline_only else f"<p>{joined}</p>")
            para.clear()

    if inline_only:
        return _inline(" ".join(line.strip() for line in lines if line.strip()).strip())

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            flush_para()
            i += 1
        elif _BLOCK_HTML.match(stripped):
            flush_para()
            out.append(line)
            i += 1
        elif heading := _HEADING.match(stripped):
            flush_para()
            hashes, body = heading.groups()
            out.append(f"<h{len(hashes)}>{_inline(body)}</h{len(hashes)}>")
            i += 1
        elif _HR.match(stripped):
            flush_para()
            out.append("<hr>")
            i += 1
        elif _ULI.match(stripped):
            flush_para()
            items = []
            while i < len(lines) and (uli := _ULI.match(lines[i].strip())):
                items.append(_inline(uli.group(1)))
                i += 1
            out.append("<ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>")
        elif _OLI.match(stripped):
            flush_para()
            items = []
            while i < len(lines) and (oli := _OLI.match(lines[i].strip())):
                items.append(_inline(oli.group(1)))
                i += 1
            out.append("<ol>" + "".join(f"<li>{x}</li>" for x in items) + "</ol>")
        else:
            para.append(line)
            i += 1

    flush_para()
    return "\n".join(out)


def render_markdown(src: object) -> Markup:
    """Block-level Markdown -> HTML (paragraphs, headings, lists, rules)."""

    return Markup(sanitize_html(_render(src, inline_only=False)))


def render_inline(src: object) -> Markup:
    """Inline-only Markdown -> HTML: one line, no ``<p>`` wrapper (interludes, captions)."""

    return Markup(sanitize_html(_render(src, inline_only=True)))
