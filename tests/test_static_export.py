from storyblocks.export.rewrite import rewrite


def test_story_links_are_relative_from_exported_page():
    html = '<a href="/story/next">Next</a><iframe src="/story/chart"></iframe>'
    result = rewrite(html, "../", {}, fonts_css="fonts.css")
    assert 'href="../next/index.html"' in result
    assert 'src="../chart/index.html"' in result
    assert 'href="../index.html"' in rewrite(
        'href="/stories/"', "../", {}, fonts_css="fonts.css"
    )


def test_remote_dependencies_reports_network_blocks():
    from storyblocks.export import remote_dependencies

    story = {
        "meta": {},
        "blocks": [
            {"type": "text", "config": {"text": "see [x](https://example.org)"}},
            {"type": "map", "config": {}},
            {"type": "embed", "config": {"url": "https://dash.example.com/x"}},
            {"type": "image-card", "config": {"src": "https://img.example.net/a.png"}},
        ],
    }
    hosts = {host for _, host in remote_dependencies(story)}
    assert hosts == {
        "basemap tiles (tile.openstreetmap.org by default; "
        "tiles.openfreemap.org as fallback; server.arcgisonline.com or "
        "api.maptiler.com on request)",
        "dash.example.com",
        "img.example.net",
    }
    assert (
        remote_dependencies({"meta": {}, "blocks": [{"type": "text", "config": {}}]})
        == []
    )


def test_offline_basemap_is_not_a_remote_dependency():
    from storyblocks.export import remote_dependencies

    def deps(config):
        return remote_dependencies(
            {"meta": {}, "blocks": [{"type": "map", "config": config}]}
        )

    assert deps({"basemap": "offline"}) == []
    assert deps({}) != []


def test_swipe_divider_map_panel_is_a_remote_dependency():
    from storyblocks.export import remote_dependencies

    def deps(before, after):
        return remote_dependencies(
            {
                "meta": {},
                "blocks": [
                    {
                        "type": "swipe",
                        "config": {"mode": "divider", "before": before, "after": after},
                    }
                ],
            }
        )

    picture = {"src": "/before.jpg", "alt": "Before"}
    assert deps(picture, {"src": "/after.jpg", "alt": "After"}) == []
    hosts = {host for _, host in deps({"center": [1, 2]}, picture)}
    assert "basemap tiles (tile.openstreetmap.org by default; " in next(iter(hosts))
    assert deps({"center": [1, 2], "basemap": "offline"}, picture) == []


def test_swipe_data_lon_panels_are_not_scanned_as_maps():
    from storyblocks.export import remote_dependencies

    # data-lon panels are scenario specs ({view, magnitude}), not map configs
    assert (
        remote_dependencies(
            {
                "meta": {},
                "blocks": [
                    {
                        "type": "swipe",
                        "config": {
                            "mode": "data-lon",
                            "before": {"view": "risk", "magnitude": "min"},
                            "after": {"view": "risk", "magnitude": "max"},
                        },
                    }
                ],
            }
        )
        == []
    )


def test_unused_block_js_keeps_only_what_no_page_references():
    from storyblocks.export.rewrite import _unused_block_js

    pages = ['<script src="/assets/story/blocks/swipe.js"></script>']
    assert _unused_block_js(pages, {"risk", "swipe"}) == {"risk"}
    assert _unused_block_js([], {"risk", "swipe"}) == {"risk", "swipe"}


def test_basemap_mode_is_validated():
    import pytest

    from storyblocks.blocks import BlockError, normalise_block

    assert normalise_block(
        {"type": "map", "config": {"title": "T", "basemap": "offline"}}
    )
    with pytest.raises(BlockError):
        normalise_block(
            {"type": "map", "config": {"title": "T", "basemap": "satellite"}}
        )


def test_table_status_chips_render_and_validate():
    import pytest

    from storyblocks.blocks import BlockError, normalise_block

    def table(cell):
        return {
            "type": "table",
            "config": {"columns": ["Name", "Status"], "rows": [["A", cell]]},
        }

    assert normalise_block(table({"label": "Open", "chip": "ok"}))
    assert normalise_block(table({"label": "Plain"}))
    for bad in (
        {"label": "x", "chip": "purple"},
        {"chip": "ok"},
        {"label": "x", "color": "red"},
    ):
        with pytest.raises(BlockError):
            normalise_block(table(bad))


def test_export_preflight_reports_all_missing_inputs_before_rendering(
    tmp_path, monkeypatch
):
    import pytest

    from storyblocks.export import build as export_build

    missing_artifact = tmp_path / "missing-artifact"
    missing_artifact.mkdir()
    broken_asset = tmp_path / "broken-asset"
    broken_asset.mkdir()
    (broken_asset / "story.yaml").write_text(
        "meta: {label: Broken}\n"
        "blocks:\n"
        "- type: cover\n"
        "  config:\n"
        "    title: Broken\n"
        "    image: /story-assets/stories/broken-asset/assets/missing.webp\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("STORYBLOCKS_CONTENT", str(tmp_path))
    monkeypatch.setattr(
        export_build,
        "create_app",
        lambda: pytest.fail("renderer started before preflight completed"),
    )

    with pytest.raises(SystemExit) as info:
        export_build.build(tmp_path / "site")

    message = str(info.value)
    assert "export preflight failed" in message
    assert "missing-artifact: missing story.yaml" in message
    assert "broken-asset: missing assets/missing.webp" in message
    assert "export was not started" in message
    assert not (tmp_path / ".site.building").exists()


def test_export_preflight_accepts_complete_story(tmp_path, monkeypatch):
    from storyblocks.export import preflight

    story = tmp_path / "complete"
    assets = story / "assets"
    assets.mkdir(parents=True)
    (assets / "cover.webp").write_bytes(b"image")
    (story / "story.yaml").write_text(
        "meta: {label: Complete}\n"
        "blocks:\n"
        "- type: cover\n"
        "  config:\n"
        "    title: Complete\n"
        "    image: /story-assets/stories/complete/assets/cover.webp\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("STORYBLOCKS_CONTENT", str(tmp_path))

    publishable, skipped, remote = preflight()

    assert [item[0]["id"] for item in publishable] == ["complete"]
    assert skipped == []
    assert remote == {"complete": []}
