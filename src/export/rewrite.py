"""
Make a rendered page's URLs relative (so the site works from any path with no server
configuration), decide which hydrator scripts no published page needs, and audit a finished
export for anything that still points at the dashboard or a CDN.
"""

import re

from .vendor import FONTS_LINK

PRECONNECT = re.compile(r'<link[^>]*rel="preconnect"[^>]*/?>\s*')
BLOCK_JS = re.compile(r"blocks/([\w-]+)\.js")


def _unused_block_js(html_pages, candidates):
    """Which of ``candidates`` (hydrator type names) no page in ``html_pages`` references.

    ``swipe`` is live only in its two-map mode: a divider-mode story is publishable and its
    page does reference ``blocks/swipe.js``, so it should only be dropped when no published
    page needs it (unlike the always-skipped ``LIVE_TYPES``).
    """
    used = {m.group(1) for html in html_pages for m in BLOCK_JS.finditer(html)}
    return candidates - used


def rewrite(html, prefix, vendor_map, *, fonts_css):
    """Make every URL in a rendered page relative. ``prefix`` is ``''`` at the site root and
    ``'../'`` one folder down."""
    html = PRECONNECT.sub("", html)
    html = FONTS_LINK.sub(
        f'<link rel="stylesheet" href="{prefix}assets/vendor/{fonts_css}" />', html
    )
    for url, rel in sorted(
        vendor_map.items(), key=lambda item: len(item[0]), reverse=True
    ):
        html = html.replace(url, f"{prefix}assets/vendor/{rel}")
    if 'rel="icon"' not in html:
        html = html.replace(
            "</head>", '<link rel="icon" href="data:," />\n</head>', 1
        )  # no favicon request
    html = html.replace("/story-assets/", f"{prefix}assets/")
    html = re.sub(
        r'(href|src)="/story/([^"/?#]+)"',
        lambda match: f'{match.group(1)}="{prefix}{match.group(2)}/index.html"',
        html,
    )
    html = html.replace('href="/stories/"', f'href="{prefix}index.html"')
    return html


def audit(out):
    """Anything in the built site that still points at the dashboard or a CDN."""
    problems = []
    needle = re.compile(
        r"""(?:src|href)=["']/(?!/)|["'(]/(?:story-assets|api|css|js)/|https?://(?:unpkg|cdn\.jsdelivr|cdnjs|fonts\.g)"""
    )
    for file in sorted(out.rglob("*")):
        if file.suffix in (".html", ".css", ".js") and "vendor" not in file.parts:
            for number, line in enumerate(
                file.read_text(encoding="utf-8", errors="ignore").splitlines(), 1
            ):
                if needle.search(line):
                    problems.append(
                        f"{file.relative_to(out)}:{number}: {line.strip()[:110]}"
                    )
    return problems
