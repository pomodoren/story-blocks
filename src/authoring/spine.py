"""
The Markdown spine: ``<content>/<id>/story.md`` is the authoring front-end for a story.

    ---
    id: my-place
    title: "{label}, one step at a time"
    theme: slate
    iso3: AAA
    scenario: demo-earthquake
    ---

    ```block
    type: cover
    eyebrow: "Story · prototype"
    text: >-
      Scroll to walk {label} through the risk pipeline ...
    ```

    # A main title, standing on its own

    ## How well is it mapped   {.icon-checklist eyebrow="Completeness"}

    Prose after a `## heading` (and no fence) is a `text` block. It is rendered as
    **Markdown** at request time -- blank lines split paragraphs, `##`/`-`/`1.` and the
    usual inline spans work -- and raw HTML and `{label}` still pass straight through.

    ## What's in harm's way   {.icon-buildings}

    ```block
    type: exposure-map
    legend: true
    ```

    > A blockquote is an `interlude` block.

- ``## Title {.icon-<name> eyebrow="..."}`` titles the block that follows: prose -> a
  `text` block, or a ``` ```block ``` ``` fence -> that block, with the heading filling in
  `title` / `eyebrow` / `icon`.
- A heading with nothing to title becomes a standalone ``heading`` block: ``#`` -> a
  level-1 main title, ``## Title`` with a blank line / another heading / a `>` after it ->
  level 2, ``### Title`` (and deeper) -> always standalone at that level.
- **Step blocks** (``guided-tour``, ``photo-scenes``, ``stat-cards`` -- the catalog types that
  declare ``items``) can be written as Markdown instead of a YAML ``steps:`` list. A ``block``
  fence with no items key *opens* the block; the prose that follows is its ``intro`` and every
  ``### Title {attrs}`` section after it is one step / scene / card, its body the step's
  ``text``. A ``#`` / ``##`` heading, another fence, a ``>`` line or an explicit
  ``<!-- end -->`` line closes the block (the marker is only needed before bare prose or a
  ``###`` heading that should *not* become another step)::

      ```block
      type: guided-tour
      view: risk
      ```

      Optional intro prose ...

      ### The single worst {worst=0 zoom=17 stat="4.2 M|estimated loss"}
      One entity carries the largest slice of the loss.

  Attribute grammar: ``key=value`` / ``key="two words"``. ``worst`` / ``zoom`` / ``pitch`` /
  ``center=lon,lat`` fold into the step's ``focus``; each ``stat="value|label"`` (repeatable)
  becomes a ``stats`` row; any other key is a plain step field (``pos=bl``, ``image=...``,
  ``value=2700``). Unknown keys fail the build.
- ``dump_spine(story)`` renders a ``Story`` back to this format (used to port + regenerate;
  the regeneration test guards spine <-> JSON).
"""

import re
from typing import Any

import yaml

from ..content import asset_url
from ._validate import StoryError
from .story import Story

_FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n?(.*)$", re.DOTALL)
_HEADING = re.compile(
    r"^(?P<hashes>#{1,6})\s+(?P<title>.*?)(?:\s*\{(?P<attrs>[^}]*)\})?\s*$"
)
_ATTR_ICON = re.compile(r"\.icon-(\S+)")
_ATTR_EYEBROW = re.compile(r'eyebrow="([^"]*)"')

_META_KEYS = (
    "id",
    "label",
    "title",
    "theme",
    "iso3",
    "scenario",
    "lang",
    "collection",
    "accent",
    "logo",
    "logo_link",
    "logo_alt",
)

# `### Title {worst=0 zoom=17 stat="4.2 M|loss"}` -- the attribute list of a step heading
_STEP_ATTR = re.compile(r'(?P<key>[A-Za-z_][\w-]*)=(?:"(?P<q>[^"]*)"|(?P<b>[^\s"]+))')
_FOCUS_KEYS = ("worst", "center", "zoom", "pitch", "bearing")
_END_MARKER = "<!-- end -->"
_BARE = re.compile(r'^[^\s"}=|]+$')


def _items_key(block_type):
    """The config key a step block keeps its items under (``steps`` / ``scenes`` / ``cards``),
    or ``None`` for an ordinary block -- straight from the catalog."""

    from ..blocks import BLOCKS

    bt = BLOCKS.get(block_type)
    return bt.items if bt else None


def load_spine(path):
    text = _read(path)
    match = _FRONTMATTER.match(text)
    if not match:
        raise StoryError(f"{path}: missing or malformed --- front matter --- block")
    meta = yaml.safe_load(match.group(1)) or {}
    if not meta.get("id"):
        raise StoryError(f"{path}: front matter needs an 'id'")

    story = Story(
        meta["id"],
        iso3=meta.get("iso3"),
        scenario=meta.get("scenario"),
        title=meta.get("title"),
        theme=meta.get("theme"),
    )
    story.meta(
        **{
            k: meta.get(k)
            for k in (
                "label",
                "lang",
                "collection",
                "accent",
                "logo",
                "logo_link",
                "logo_alt",
            )
        }
    )
    for unit in _units(match.group(2), where=str(path)):
        story.block(
            unit["type"], **_walk(unit["config"], lambda s: _resolve_asset(s, story.id))
        )
    return story


def _resolve_asset(value, story_id):
    """``assets/x.webp`` -> the URL the reader serves it at (only at the start of a string)."""

    return (
        asset_url(story_id, value[len("assets/") :])
        if value.startswith("assets/")
        else value
    )


def _relativise_asset(value, story_id):
    """The inverse of :func:`_resolve_asset`, so a dumped spine stays portable."""

    prefix = asset_url(story_id)
    return "assets/" + value[len(prefix) :] if value.startswith(prefix) else value


def _walk(value, fn):
    if isinstance(value, str):
        return fn(value)
    if isinstance(value, dict):
        return {k: _walk(v, fn) for k, v in value.items()}
    if isinstance(value, list):
        return [_walk(v, fn) for v in value]
    return value


def _units(body, *, where):
    units: list[dict[str, Any]] = []
    heading = None  # a pending `## ...` line: {"title", "level", "eyebrow"?, "icon"?}
    prose: list[str] = []
    in_fence = False
    fence_lines: list[str] = []
    bq_run = False
    open_unit = (
        None  # a step block whose fence had no items: waiting for its `###` sections
    )
    open_intro: list[str] = []  # prose between that fence and its first `###`
    open_steps = []  # finished step dicts
    open_step = (
        None  # {"parsed": heading, "lines": [...]} while a `###` body is being read
    )

    def finish_step():
        nonlocal open_step
        if open_step is None:
            return
        text = "\n".join(open_step["lines"]).strip()
        open_steps.append(_step_from_heading(open_step["parsed"], text, where=where))
        open_step = None

    def close_open():
        """The step block ends here: fold its intro + `###` sections into its config."""
        nonlocal open_unit, open_intro, open_steps
        if open_unit is None:
            return
        finish_step()
        config = open_unit["config"]
        intro = "\n".join(open_intro).strip()
        if intro:
            if "intro" in config:
                raise StoryError(
                    f"{where}: {open_unit['type']} has an 'intro' in its fence and prose after it"
                )
            config["intro"] = intro
        config[_items_key(open_unit["type"])] = open_steps
        open_unit, open_intro, open_steps = None, [], []

    def _prose_text():
        return "\n".join(prose).strip()

    def flush_text():
        nonlocal heading, prose
        text = _prose_text()
        if text:
            config = {"body": text}
            if heading:
                _merge_heading(config, heading)
            units.append({"type": "text", "config": config})
            heading = None
        prose = []

    def flush_heading():
        """A ``## ...`` line with no prose (and no fenced block) after it becomes a
        standalone ``heading`` block, rather than being silently dropped."""
        nonlocal heading
        if heading and not _prose_text():
            units.append({"type": "heading", "config": _heading_config(heading)})
        heading = None

    for raw in body.splitlines():
        line = raw.rstrip("\n")

        if in_fence:
            if line.strip() == "```":
                fence = yaml.safe_load("\n".join(fence_lines)) or {}
                block_type = fence.pop("type", None)
                if not block_type:
                    raise StoryError(f"{where}: a ```block fence needs a 'type'")
                if heading:
                    _merge_heading(fence, heading, defaults=True)
                    heading = None
                unit = {"type": block_type, "config": fence}
                units.append(unit)
                in_fence = False
                key = _items_key(block_type)
                if key and key not in fence:
                    open_unit = unit
            else:
                fence_lines.append(line)
            continue

        if open_unit is not None:
            # inside a step block: `###`+ headings are its steps, everything else is step
            # (or intro) prose -- until a `#`/`##` heading, a fence or a `>` closes it.
            match = _HEADING.match(line) if line.startswith("#") else None
            if match and len(match.group("hashes")) >= 3:
                finish_step()
                open_step = {"parsed": _parse_heading(match), "lines": []}
                continue
            if line.strip() == _END_MARKER:
                close_open()
                continue
            if not (match or line.strip() == "```block" or line.startswith(">")):
                (open_step["lines"] if open_step else open_intro).append(line)
                continue
            close_open()

        if line.strip() == "```block":
            flush_text()  # a heading with no prose stays pending for this fence
            in_fence, fence_lines, bq_run = True, [], False
            continue

        match = _HEADING.match(line) if line.startswith("#") else None
        if match:
            flush_text()
            parsed = _parse_heading(match)
            flush_heading()  # a prior `## ...` with nothing to decorate stands alone
            if parsed["level"] == 2:
                # level 2 keeps the "title the block that follows" behaviour
                heading = parsed
            else:
                # `#` (main title) and `### ...`+ (section header) are always standalone
                units.append({"type": "heading", "config": _heading_config(parsed)})
            bq_run = False
            continue

        if line.startswith(">"):
            flush_text()
            flush_heading()
            text = line[1:].strip()
            if bq_run and units and units[-1]["type"] == "interlude":
                units[-1]["config"]["text"] += f" {text}"
            else:
                units.append({"type": "interlude", "config": {"text": text}})
            bq_run = True
            continue

        if not line.strip():
            bq_run = False
            if prose:
                prose.append(line)  # keep blank lines -> Markdown paragraph breaks
            continue
        prose.append(line)

    close_open()
    flush_text()
    flush_heading()
    return units


def _step_from_heading(parsed, text, *, where):
    """``### Title {worst=0 stat="4|loss"}`` + body -> one step / scene / card mapping."""

    step = {"title": parsed["title"]}
    focus, stats = {}, []
    for m in _STEP_ATTR.finditer(parsed.get("attrs") or ""):
        key = m.group("key").replace("-", "_")
        raw = m.group("q") if m.group("q") is not None else m.group("b")
        if key == "stat":
            value, bar, label = raw.partition("|")
            stats.append(
                {"value": value.strip(), **({"label": label.strip()} if bar else {})}
            )
        elif key in _FOCUS_KEYS:
            focus[key] = _focus_value(
                key, raw, where=f"{where}: step {parsed['title']!r}"
            )
        else:
            step[key] = raw
    if focus:
        step["focus"] = focus
    if stats:
        step["stats"] = stats
    if text:
        step["text"] = text
    return step


def _focus_value(key, raw, *, where):
    try:
        if key == "center":
            lon, lat = (float(x) for x in raw.split(","))
            return [lon, lat]
        number = float(raw)
        return int(number) if number.is_integer() and "." not in raw else number
    except ValueError:
        want = "lon,lat" if key == "center" else "a number"
        raise StoryError(f"{where}: {key}= expects {want}, got {raw!r}") from None


def _merge_heading(config, heading, *, defaults=False):
    put = config.setdefault if defaults else config.__setitem__
    put("title", heading["title"])
    for key in ("eyebrow", "icon"):
        if heading.get(key):
            put(key, heading[key])


def _heading_config(heading):
    """A parsed ``## ...`` line -> the config of a standalone ``heading`` block."""

    config = {"text": heading["title"], "level": heading["level"]}
    for key in ("eyebrow", "icon"):
        if heading.get(key):
            config[key] = heading[key]
    return config


def _parse_heading(match):
    attrs = match.group("attrs") or ""
    out = {
        "title": match.group("title").strip(),
        "level": len(match.group("hashes")),
        "attrs": attrs,
    }
    if icon := _ATTR_ICON.search(attrs):
        out["icon"] = icon.group(1)
    if eyebrow := _ATTR_EYEBROW.search(attrs):
        out["eyebrow"] = eyebrow.group(1)
    return out


def _read(path):
    try:
        return path.read_text(encoding="utf-8")
    except AttributeError:
        from pathlib import Path

        return Path(path).read_text(encoding="utf-8")


# --------------------------------------------------------------------------- dump


def dump_spine(story):
    """Render an assembled :class:`~storyblocks.authoring.Story` back to spine Markdown."""

    data = story.to_dict()
    front = {k: data["meta"][k] for k in _META_KEYS if data["meta"].get(k) is not None}
    out = ["---", _yaml(front).rstrip(), "---", ""]

    blocks = data["blocks"]
    for index, block in enumerate(blocks):
        btype = block["type"]
        cfg = _walk(dict(block["config"]), lambda s: _relativise_asset(s, story.id))

        if btype == "interlude":
            out += [f"> {cfg['text']}", ""]
            continue

        if btype == "heading":
            level = cfg.get("level", 2)
            attrs = []
            if cfg.get("icon"):
                attrs.append(f".icon-{cfg['icon']}")
            if cfg.get("eyebrow"):
                attrs.append(f'eyebrow="{cfg["eyebrow"]}"')
            out += [
                "#" * level
                + f" {cfg['text']}"
                + (f"   {{{' '.join(attrs)}}}" if attrs else ""),
                "",
            ]
            continue

        title = cfg.pop("title", None)
        eyebrow = cfg.pop("eyebrow", None)
        icon = cfg.pop("icon", None)
        if title:
            attrs = []
            if icon:
                attrs.append(f".icon-{icon}")
            if eyebrow:
                attrs.append(f'eyebrow="{eyebrow}"')
            out += [f"## {title}" + (f"   {{{' '.join(attrs)}}}" if attrs else ""), ""]
        else:
            if eyebrow:
                cfg["eyebrow"] = eyebrow
            if icon:
                cfg["icon"] = icon

        if btype == "text" and set(cfg) <= {
            "body"
        }:  # extra config (`variant`) needs a fence
            out += [cfg.get("body", ""), ""]
            continue

        if _items_key(btype):
            steps_md = _dump_steps(btype, cfg)
            if steps_md is not None:
                head, body = steps_md
                out += [
                    "```block",
                    _yaml({"type": btype, **head}).rstrip(),
                    "```",
                    "",
                    *body,
                    "",
                ]
                if _would_be_absorbed(
                    blocks[index + 1] if index + 1 < len(blocks) else None
                ):
                    out += [_END_MARKER, ""]
                continue

        # the rest of the authored config, verbatim (the rich prose field included)
        out += ["```block", _yaml({"type": btype, **cfg}).rstrip(), "```", ""]

    return "\n".join(out).rstrip() + "\n"


def _yaml(value):
    return yaml.safe_dump(value, sort_keys=False, allow_unicode=True, width=100)


def _dump_steps(btype, cfg):
    """A step block as ``(fence config, Markdown lines)`` -- or ``None`` when some item can't be
    written in the ``###`` grammar (nested config, a ``|`` in a stat, a ``#`` line in a body ...),
    in which case the caller falls back to a plain YAML ``steps:`` list. Every candidate is
    parsed back and compared, so the ``###`` form is only used when it is lossless."""

    key = _items_key(btype)
    head = {k: v for k, v in cfg.items() if k not in (key, "intro")}
    lines = []
    intro = cfg.get("intro")
    if intro:
        lines += [intro, ""]
    for item in cfg[key]:
        heading = _step_heading(item)
        if heading is None:
            return None
        lines += [heading, ""]
        if item.get("text"):
            lines += [item["text"], ""]
    lines = lines[:-1] if lines and lines[-1] == "" else lines

    probe = "\n".join(
        ["```block", _yaml({"type": btype, **head}).rstrip(), "```", "", *lines]
    )
    try:
        units = _units(probe, where="dump")
    except StoryError:
        return None
    if not (
        len(units) == 1 and units[0]["type"] == btype and units[0]["config"] == cfg
    ):
        return None
    return head, lines


def _step_heading(item):
    """``### Title {attrs}`` for one item, or ``None`` if it has keys the grammar can't carry."""

    title = item.get("title")
    if not title or "{" in title or "\n" in title:
        return None
    attrs = []
    for k, v in item.items():
        if k in ("title", "text"):
            continue
        if k == "focus":
            if not isinstance(v, dict) or not set(v) <= set(_FOCUS_KEYS):
                return None
            for fk in _FOCUS_KEYS:
                if fk not in v:
                    continue
                fv = v[fk]
                if fk == "center":
                    if not (isinstance(fv, list) and len(fv) == 2):
                        return None
                    attrs.append("center=" + ",".join(repr(float(x)) for x in fv))
                elif isinstance(fv, (int, float)) and not isinstance(fv, bool):
                    attrs.append(f"{fk}={fv}")
                else:
                    return None
        elif k == "stats":
            for stat in v:
                value, label = str(stat["value"]), stat.get("label")
                text = value if label is None else f"{value}|{label}"
                if "|" in value or '"' in text or "}" in text:
                    return None
                attrs.append(f'stat="{text}"')
        elif (
            isinstance(v, str) and v and '"' not in v and "}" not in v and "\n" not in v
        ):
            attrs.append(f"{k}={v}" if _BARE.match(v) else f'{k}="{v}"')
        else:
            return None
    return f"### {title}" + (f" {{{' '.join(attrs)}}}" if attrs else "")


def _would_be_absorbed(block):
    """Would ``block``, written right after a ``###``-style step block, read as more of that
    block? Bare prose (an untitled ``text`` block) and ``###``+ headings would."""

    if block is None:
        return False
    cfg = block["config"]
    if block["type"] == "text":
        return not cfg.get("title")
    if block["type"] == "heading":
        return cfg.get("level", 2) >= 3
    return False
