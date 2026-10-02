"""
The one place a built story artifact (``<content>/<id>/story.yaml``, ``{meta, blocks}``) is
serialised. The builder writes it with :func:`dumps`, the loader reads it with :func:`loads`,
and the byte-for-byte staleness test compares against :func:`dumps` -- so the committed file is
deterministic. YAML (not JSON) so long Markdown prose stays readable and diffable, and so the
same files can be read as-is by a static-site generator's content collection.
"""

import yaml


class _Dumper(yaml.SafeDumper):
    """Block style; multi-line strings as literal ``|`` blocks."""


def _str(dumper, value):
    style = "|" if "\n" in value else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style=style)


_Dumper.add_representer(str, _str)


def dumps(data) -> str:
    return yaml.dump(
        data,
        Dumper=_Dumper,
        sort_keys=False,
        allow_unicode=True,
        width=100,
        default_flow_style=False,
    )


def loads(text: str):
    return yaml.safe_load(text)
