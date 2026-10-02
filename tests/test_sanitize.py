"""The HTML allowlist sanitizer: the last line of defense before `| safe` rendering."""

import pytest

from storyblocks.web.sanitize import safe_url, sanitize_html


@pytest.mark.parametrize(
    "value",
    [
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "  javascript:alert(1)",
        "java\tscript:alert(1)",
        "java\x00script:alert(1)",
    ],
)
def test_safe_url_rejects_dangerous_schemes(value):
    assert safe_url(value) == "#"


@pytest.mark.parametrize(
    "value",
    [
        "https://example.com/x",
        "http://example.com/x",
        "mailto:a@example.com",
        "tel:+15555550100",
        "/relative/path",
        "assets/pic.png",
        "#anchor",
    ],
)
def test_safe_url_keeps_relative_and_allow_listed_schemes(value):
    assert safe_url(value) == value


def test_sanitize_keeps_allowed_tags_and_escapes_text():
    out = sanitize_html("<p>a <strong>b</strong> & <em>c</em></p>")
    assert out == "<p>a <strong>b</strong> &amp; <em>c</em></p>"


@pytest.mark.parametrize("tag", ["script", "style", "iframe", "svg", "video", "audio"])
def test_sanitize_drops_dangerous_tags_and_their_content(tag):
    out = sanitize_html(f"<p>before</p><{tag}>payload<b>nested</b></{tag}><p>after</p>")
    assert "payload" not in out
    assert tag not in out
    assert out == "<p>before</p><p>after</p>"


def test_sanitize_drops_unknown_tags_but_keeps_their_text():
    assert sanitize_html("<marquee>x</marquee>") == "x"
    assert sanitize_html('<img onerror="alert(1)" src="a.png">') == '<img src="a.png">'


def test_sanitize_drops_disallowed_attributes():
    out = sanitize_html('<p onclick="alert(1)" style="color:red" class="ok">hi</p>')
    assert "onclick" not in out
    assert 'style="color:red"' not in out
    assert 'class="ok"' in out


def test_sanitize_cleans_url_attributes():
    out = sanitize_html('<a href="javascript:alert(1)">x</a>')
    assert 'href="#"' in out
    out = sanitize_html('<img src="javascript:alert(1)" alt="x">')
    assert 'src="#"' in out


def test_sanitize_only_allows_known_attributes_per_tag():
    out = sanitize_html('<p href="https://evil.example.com">x</p>')
    assert "href" not in out
    out = sanitize_html('<a width="10">x</a>')
    assert "width" not in out


def test_sanitize_forces_safe_rel_on_blank_target():
    out = sanitize_html('<a href="https://e.org" target="_blank" rel="opener">x</a>')
    assert 'rel="noopener noreferrer"' in out
    assert 'rel="opener"' not in out


def test_sanitize_rejects_unknown_target_values():
    out = sanitize_html('<a href="https://e.org" target="_top">x</a>')
    assert "target" not in out


def test_sanitize_closes_only_allowed_tags_and_skips_void_tags():
    out = sanitize_html("<p>x</p><br><hr>")
    assert out == "<p>x</p><br><hr>"
    assert "</br>" not in out and "</hr>" not in out


def test_sanitize_preserves_entity_and_character_references():
    assert sanitize_html("a &amp; b") == "a &amp; b"
    assert sanitize_html("a &#65; b") == "a &#65; b"


def test_sanitize_handles_unclosed_dangerous_tags_without_leaking_content():
    out = sanitize_html("<p>before</p><script>alert(1)")
    assert out == "<p>before</p>"


def test_sanitize_escapes_attribute_values_with_quotes():
    out = sanitize_html('<a href="https://e.org/?a=1&b=2" title="a &quot; b">x</a>')
    assert 'title="a &quot; b"' in out
