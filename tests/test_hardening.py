"""Editor and exporter hardening: host guard, uploads, payloads, rollback, atomic export."""

import pytest

from storyblocks.export import build as export_build
from storyblocks.export import vendor as export_vendor
from storyblocks.web import editor
from storyblocks.web.app import create_app

STORY = "deck-demo"


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = False
    return app.test_client()


def _headers(**extra):
    return {"X-Story-Editor": "1", **extra}


def test_editor_rejects_non_loopback_host(client):
    response = client.get("/story-editor/", headers={"Host": "evil.example.com"})
    assert response.status_code == 403


def test_editor_accepts_loopback_and_allow_listed_hosts(client, monkeypatch):
    assert (
        client.get("/story-editor/", headers={"Host": "localhost:9001"}).status_code
        == 200
    )
    assert (
        client.get("/story-editor/", headers={"Host": "[::1]:9001"}).status_code == 200
    )
    monkeypatch.setenv("STORYBLOCKS_ALLOWED_HOSTS", "stories.example.org")
    assert editor.trusted_host("stories.example.org")
    assert not editor.trusted_host("other.example.org")


def test_svg_upload_is_rejected(client):
    response = client.post(
        f"/story-editor/api/{STORY}/media",
        data=b"<svg onload=alert(1)/>",
        headers=_headers(**{"X-Filename": "x.svg"}),
    )
    assert response.status_code == 422
    assert ".svg" not in response.get_json()["error"]


def test_story_assets_are_sandboxed(client):
    media = client.get(f"/story-editor/api/{STORY}/media").get_json()["files"]
    response = client.get(media[0]["url"])
    assert response.status_code == 200
    assert response.headers["Content-Security-Policy"] == "sandbox"


@pytest.mark.parametrize("payload", [[], {"blocks": "text"}, {"blocks": [1]}, None])
def test_malformed_payload_is_a_clean_error(client, payload):
    response = client.put(
        f"/story-editor/api/{STORY}/draft", json=payload, headers=_headers()
    )
    assert response.status_code == 422
    assert response.get_json()["ok"] is False


def test_publish_restores_spine_on_unexpected_error(client, monkeypatch, tmp_path):
    spine = tmp_path / "story.md"
    spine.write_text("original", encoding="utf-8")
    monkeypatch.setattr(editor, "spine_path", lambda _id: spine)
    monkeypatch.setattr(editor, "draft_path", lambda _id: tmp_path / "draft.yaml")

    def boom(_path):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr("storyblocks.authoring.load_spine", boom)
    payload = {
        "meta": {"title": "T"},
        "blocks": [{"type": "text", "config": {"body": "hi"}}],
    }
    response = client.post(f"/story-editor/api/{STORY}/publish", json=payload)
    assert response.status_code == 500
    assert spine.read_text(encoding="utf-8") == "original"


def test_failed_export_keeps_previous_site(tmp_path, monkeypatch):
    final = tmp_path / "site"
    final.mkdir()
    (final / "marker.txt").write_text("deployed", encoding="utf-8")

    def boom(*_args):
        raise OSError("network down")

    monkeypatch.setattr(export_build, "_build_into", boom)
    with pytest.raises(OSError):
        export_build.build(final, [STORY])
    assert (final / "marker.txt").read_text(encoding="utf-8") == "deployed"
    assert not (tmp_path / ".site.building").exists()


def test_swap_in_replaces_final_and_cleans_up(tmp_path):
    final, built = tmp_path / "site", tmp_path / ".site.building"
    final.mkdir()
    (final / "old").write_text("x", encoding="utf-8")
    built.mkdir()
    (built / "new").write_text("y", encoding="utf-8")
    export_build._swap_in(built, final)
    assert [p.name for p in final.iterdir()] == ["new"]
    assert not built.exists() and not (tmp_path / ".site.previous").exists()


def test_failed_download_leaves_no_cache_entry(tmp_path, monkeypatch):
    def refuse(*_args, **_kwargs):
        raise OSError("network down")

    monkeypatch.setattr(export_vendor.urllib.request, "urlopen", refuse)
    with pytest.raises(OSError):
        export_vendor._download("https://cdn.example.com/lib.js", tmp_path)
    assert not any(p.is_file() for p in tmp_path.rglob("*"))


@pytest.mark.parametrize(
    "target",
    [
        "javascript:alert(1)",
        "JaVa&#x73;cript:alert(1)",
        "data:text/html,x",
        "vbscript:x",
    ],
)
def test_markdown_links_drop_unsafe_schemes(target):
    from storyblocks.web.markdown import render_inline

    assert 'href="#"' in render_inline(f"[x]({target})")


def test_markdown_links_keep_safe_targets_and_escape_titles():
    from storyblocks.web.markdown import render_inline

    html = render_inline('[a](https://e.org/?q=1&amp;r=2 "a<b") [b](assets/x.png)')
    assert 'href="https://e.org/?q=1&amp;r=2"' in html
    assert 'title="a&lt;b"' in html
    assert 'href="assets/x.png"' in html


def test_content_root_is_read_on_every_call(tmp_path, monkeypatch):
    from storyblocks import content, registry

    story = tmp_path / "one"
    story.mkdir()
    (story / "story.yaml").write_text(
        "meta: {label: One}\nblocks: []\n", encoding="utf-8"
    )
    monkeypatch.setenv("STORYBLOCKS_CONTENT", str(tmp_path))
    assert content.content_dir() == tmp_path
    assert [e["id"] for e in registry.EXAMPLES] == ["one"]


def test_cli_fails_fast_without_a_content_folder(tmp_path, monkeypatch):
    from storyblocks import cli

    missing = tmp_path / "missing"
    with pytest.raises(SystemExit) as info:
        cli.main(["build", "--content", str(missing)])
    assert "content folder not found" in str(info.value)


def test_upload_never_overwrites_an_existing_file(client, monkeypatch, tmp_path):
    monkeypatch.setattr(editor, "assets_dir", lambda _id: tmp_path)
    (tmp_path / "pic.png").write_bytes(b"original")
    response = client.post(
        f"/story-editor/api/{STORY}/media",
        data=b"new",
        headers=_headers(**{"X-Filename": "pic.png"}),
    )
    assert response.get_json()["url"].endswith("/pic-2.png")
    assert (tmp_path / "pic.png").read_bytes() == b"original"
    assert (tmp_path / "pic-2.png").read_bytes() == b"new"


def test_cli_uses_explicit_content_folder(tmp_path, monkeypatch):
    import os

    from storyblocks import cli
    from storyblocks.authoring import build

    monkeypatch.setenv("STORYBLOCKS_CONTENT", "old-value")
    seen = []

    def run_build(args):
        seen.append((args, os.environ["STORYBLOCKS_CONTENT"]))
        return 23

    monkeypatch.setattr(build, "main", run_build)

    result = cli.main(["build", "--content", str(tmp_path)])

    assert result == 23
    assert seen == [([], str(tmp_path.resolve()))]
    assert os.environ["STORYBLOCKS_CONTENT"] == "old-value"


def test_cli_requires_content_folder():
    from storyblocks import cli

    with pytest.raises(SystemExit) as info:
        cli.main(["export"])

    assert info.value.code == 2


def test_authoring_has_no_host_resource_accessors():
    import importlib.util

    import storyblocks.authoring as authoring

    assert importlib.util.find_spec("storyblocks.authoring.resources") is None
    assert not hasattr(authoring, "ResourceError")
    assert not hasattr(authoring.Story("x"), "exposure")
