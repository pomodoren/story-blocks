"""
Small line-icon set for story block headings, one per pipeline stage. Part of the reusable
rendering engine, not per-story content -- a "buildings" icon looks the same wherever it is
referenced by name (see the block partials in templates/stories/blocks/). Plain geometric
shapes, not photos.
"""

ICONS = {
    "buildings": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">
        <rect x="6" y="20" width="10" height="22" /><rect x="19" y="10" width="10" height="32" />
        <rect x="32" y="26" width="10" height="16" /><line x1="4" y1="42" x2="44" y2="42" />
      </svg>
    """,
    "checklist": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="6" width="23" height="30" rx="2" /><line x1="13" y1="14" x2="24" y2="14" />
        <line x1="13" y1="21" x2="24" y2="21" /><line x1="13" y1="28" x2="19" y2="28" />
        <circle cx="32" cy="32" r="7" /><line x1="37" y1="37" x2="42" y2="42" />
      </svg>
    """,
    "curve": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6,40 42,40" /><polyline points="6,40 6,6" />
        <path d="M8 38 C 16 38, 20 30, 24 20 C 28 10, 34 8, 40 8" />
      </svg>
    """,
    "waves": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none" />
        <circle cx="24" cy="24" r="10" opacity=".8" /><circle cx="24" cy="24" r="16" opacity=".5" />
        <circle cx="24" cy="24" r="22" opacity=".25" />
      </svg>
    """,
    "shield": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 5 L40 11 V22 C40 33 33 40 24 43 C15 40 8 33 8 22 V11 Z" />
        <line x1="24" y1="16" x2="24" y2="26" /><circle cx="24" cy="32" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    """,
    "timeline": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="10" width="36" height="30" rx="2" /><line x1="6" y1="18" x2="42" y2="18" />
        <line x1="14" y1="6" x2="14" y2="14" /><line x1="34" y1="6" x2="34" y2="14" />
        <circle cx="16" cy="27" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="24" cy="27" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="32" cy="27" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    """,
    "swipe": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="8" width="36" height="32" rx="2" /><line x1="24" y1="8" x2="24" y2="40" />
        <path d="M18 24 L14 24 M14 24 L17 21 M14 24 L17 27" />
        <path d="M30 24 L34 24 M34 24 L31 21 M34 24 L31 27" />
      </svg>
    """,
    "pin-list": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 44 C24 44 12 30 12 19 C12 11.8 17.8 6 24 6 C30.2 6 36 11.8 36 19 C36 30 24 44 24 44 Z" />
        <circle cx="24" cy="19" r="5" />
      </svg>
    """,
    "tag": """
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round">
        <path d="M6 8 H26 L42 24 L26 40 L6 24 Z" />
        <circle cx="14" cy="16" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    """,
}
