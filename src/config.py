"""
Reader-facing configuration shared across the loader and the web layer: the available
themes, the default theme and the display name shown for each language code.
"""

THEMES = (
    "editorial",
    "slate",
    "newsprint",
    "midnight",
    "forest",
    "sunrise",
    "flamingo",
    "cyber",
)
DEFAULT_THEME = "editorial"

LANGUAGE_NAMES = {
    "en": "English",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "it": "Italiano",
    "tr": "Türkçe",
    "sq": "Shqip",
    "ca": "Català",
    "pt": "Português",
    "nl": "Nederlands",
}
