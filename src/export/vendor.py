"""
Vendor the CDN libraries and Google Fonts a rendered page references, so the exported site
serves them from ``assets/vendor/`` with no runtime CDN dependency.
"""

import hashlib
import re
import shutil
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from .config import FONT_SUBSETS, USER_AGENT

CDN = re.compile(
    r"https://(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)/[^\"')\s]+"
)
FONTS_LINK = re.compile(
    r'<link[^>]*href="(https://fonts\.googleapis\.com/css2[^"]*)"[^>]*/?>'
)


def _download(url, cache):
    """Fetch ``url`` once into ``cache`` (keyed by host + path) and return the local path."""
    parsed = urlparse(url)
    name = re.sub(r"[^A-Za-z0-9._@-]+", "_", parsed.path.strip("/")) or "index"
    if parsed.query:
        name += "_" + re.sub(r"[^A-Za-z0-9]+", "", parsed.query)[:40]
    target = cache / parsed.netloc / name
    if not target.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        partial = target.with_name(target.name + ".part")
        with urllib.request.urlopen(request, timeout=60) as reply:
            partial.write_bytes(reply.read())
        partial.replace(target)
    return target


def vendor_fonts(css_url, out_vendor, cache):
    """Download the Google Fonts CSS + its woff2 files; write ``vendor/fonts.css``."""
    css = _download(css_url, cache).read_text(encoding="utf-8")
    keep = []
    for subset, face in re.findall(
        r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css
    ):
        if subset not in FONT_SUBSETS:
            continue

        def local(match):
            file = _download(match.group(1), cache)
            dest = out_vendor / "fonts" / f"{file.parent.name}-{file.name}"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file, dest)
            return f"url(fonts/{dest.name})"

        keep.append(re.sub(r"url\((https://[^)]+)\)", local, face))
    (out_vendor / "fonts.css").write_text("\n".join(keep) + "\n", encoding="utf-8")


def vendor_cdn(urls, out_vendor, cache):
    """Copy each CDN file to ``vendor/<host>/<path>``; return {url: relative-to-vendor path}."""
    mapping = {}
    for url in sorted(urls):
        parsed = urlparse(url)
        file = _download(url, cache)
        rel = f"{parsed.netloc}/{parsed.path.strip('/')}"
        if parsed.query:
            path = Path(rel)
            digest = hashlib.sha256(parsed.query.encode()).hexdigest()[:12]
            rel = str(path.with_name(f"{path.stem}-{digest}{path.suffix}"))
        dest = out_vendor / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, dest)
        mapping[url] = rel
    return mapping
