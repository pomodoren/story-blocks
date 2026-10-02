"""The tiny Markdown -> HTML renderer for story prose: block structure, inline spans, map
actions, and its sanitization pass over authored (untrusted) content."""

import pytest

from storyblocks.web.markdown import render_inline, render_markdown


def test_blank_line_separated_text_becomes_paragraphs():
    html = render_markdown("first line\nstill first\n\nsecond paragraph")
    assert html == "<p>first line still first</p>\n<p>second paragraph</p>"


@pytest.mark.parametrize("hashes", ["#", "##", "###", "####", "#####", "######"])
def test_atx_headings_become_heading_tags(hashes):
    html = render_markdown(f"{hashes} Title")
    level = len(hashes)
    assert html == f"<h{level}>Title</h{level}>"


def test_heading_strips_trailing_hashes():
    assert render_markdown("## Title ##") == "<h2>Title</h2>"


@pytest.mark.parametrize("rule", ["---", "***", "___", "----", "******"])
def test_horizontal_rule_variants(rule):
    html = render_markdown(f"before\n\n{rule}\n\nafter")
    assert "<hr>" in html
    assert html.split("\n") == ["<p>before</p>", "<hr>", "<p>after</p>"]


@pytest.mark.parametrize("bullet", ["-", "*", "+"])
def test_bullet_lists(bullet):
    html = render_markdown(f"{bullet} one\n{bullet} two")
    assert html == "<ul><li>one</li><li>two</li></ul>"


@pytest.mark.parametrize("marker", ["1.", "1)"])
def test_ordered_lists(marker):
    html = render_markdown(f"{marker} one\n2. two")
    assert html == "<ol><li>one</li><li>two</li></ol>"


def test_block_level_html_lines_pass_through_as_their_own_block():
    html = render_markdown("before\n\n<div>raw</div>\n\nafter")
    assert html == "<p>before</p>\n<div>raw</div>\n<p>after</p>"


def test_block_level_html_is_still_sanitized():
    html = render_markdown('<iframe src="https://evil.example.com"></iframe>')
    assert "iframe" not in html


def test_empty_source_renders_to_empty_string():
    assert render_markdown("") == ""
    assert render_markdown(None) == ""


# ---- inline spans -------------------------------------------------------------------------


def test_bold_and_italic_markers():
    assert (
        render_inline("**bold** and *italic*")
        == "<strong>bold</strong> and <em>italic</em>"
    )
    assert (
        render_inline("__bold__ and _italic_")
        == "<strong>bold</strong> and <em>italic</em>"
    )


def test_italic_marker_does_not_fire_inside_a_word():
    assert render_inline("snake_case_var") == "snake_case_var"


def test_inline_code_is_escaped_and_untouched_by_other_markup():
    html = render_inline("`*not bold*` is not bold")
    assert html == "<code>*not bold*</code> is not bold"


def test_plain_text_is_html_escaped():
    assert render_inline("a < b & c > d") == "a &lt; b &amp; c &gt; d"


# ---- links ---------------------------------------------------------------------------------


def test_link_renders_href_and_optional_title():
    html = render_inline('[docs](https://example.com/docs "Read the docs")')
    assert html == '<a href="https://example.com/docs" title="Read the docs">docs</a>'


def test_link_title_is_attribute_escaped():
    html = render_inline('[x](https://e.org "a\'<b>")')
    assert 'title="a&#x27;&lt;b&gt;"' in html


@pytest.mark.parametrize(
    "target, data",
    [
        ("map:1.5,2.5", "1.5,2.5"),
        ("map:1.5,2.5,10", "1.5,2.5,10"),
        ("map:-1.5,-2.5", "-1.5,-2.5"),
    ],
)
def test_map_action_links_carry_coordinates_as_data_attributes(target, data):
    html = render_inline(f"[fly]({target})")
    assert html == f'<a href="#map" data-map-action="{data}">fly</a>'


def test_non_map_colon_target_is_treated_as_a_normal_url():
    html = render_inline("[x](mailto:a@b.com)")
    assert 'href="mailto:a@b.com"' in html
    assert "data-map-action" not in html
