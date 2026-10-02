/* Stories gallery: search, collection filter, sort, layout and display settings.
   Everything is client-side so the same page works in the static export. */
(function () {
  "use strict";

  var KEY = "storyblocks.gallery";
  var DEFAULTS = {
    scheme: "auto", view: "grid", density: "comfortable",
    thumbs: true, features: true, stats: true, sort: "authored",
  };
  var root = document.documentElement;
  var grid = document.getElementById("story-grid");
  var settings = Object.assign({}, DEFAULTS);
  var state = { query: "", collection: "" };

  function load() {
    try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { /* storage blocked or corrupt: keep defaults */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); }
    catch (e) { /* storage blocked: settings last for this visit only */ }
  }

  function applySettings() {
    if (settings.scheme === "auto") delete root.dataset.scheme;
    else root.dataset.scheme = settings.scheme;
    root.dataset.density = settings.density;
    root.dataset.view = settings.view;
    root.dataset.hide = ["thumbs", "features", "stats"]
      .filter(function (k) { return !settings[k]; }).join(" ");
    document.querySelectorAll("[data-view]").forEach(function (b) {
      if (b.tagName === "BUTTON") b.setAttribute("aria-pressed", String(b.dataset.view === settings.view));
    });
    var sort = document.getElementById("gallery-sort");
    if (sort) sort.value = settings.sort;
  }

  function render() {
    if (!grid) return;
    var tiles = Array.prototype.slice.call(grid.children);
    var order = {
      authored: function (a, b) { return a.dataset.order - b.dataset.order; },
      title: function (a, b) { return a.dataset.title.localeCompare(b.dataset.title); },
      blocks: function (a, b) { return b.dataset.blocks - a.dataset.blocks; },
    }[settings.sort] || null;
    if (order) tiles.sort(order).forEach(function (t) { grid.appendChild(t); });

    var shown = 0;
    tiles.forEach(function (t) {
      var ok = (!state.collection || t.dataset.collection === state.collection) &&
        (!state.query || t.dataset.search.indexOf(state.query) !== -1);
      t.hidden = !ok;
      if (ok) shown += 1;
    });
    document.getElementById("gallery-empty").hidden = shown !== 0;
    document.getElementById("gallery-result").textContent =
      shown + " of " + tiles.length + " stor" + (tiles.length === 1 ? "y" : "ies");
  }

  function syncDialog() {
    var form = document.querySelector("#gallery-settings form");
    ["scheme", "view", "density"].forEach(function (name) {
      form.querySelectorAll('input[name="' + name + '"]').forEach(function (i) {
        i.checked = i.value === settings[name];
      });
    });
    ["thumbs", "features", "stats"].forEach(function (name) {
      form.elements[name].checked = settings[name];
    });
  }

  function update(patch) {
    Object.assign(settings, patch);
    save(); applySettings(); render(); syncDialog();
  }

  load();
  applySettings();
  if (!grid) return;

  document.getElementById("gallery-search").addEventListener("input", function (e) {
    state.query = e.target.value.trim().toLowerCase(); render();
  });
  document.getElementById("gallery-sort").addEventListener("change", function (e) {
    update({ sort: e.target.value });
  });
  document.querySelectorAll(".gallery-chips .chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.collection = chip.dataset.collection;
      document.querySelectorAll(".gallery-chips .chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });
      render();
    });
  });
  document.querySelectorAll(".gallery-view button").forEach(function (b) {
    b.addEventListener("click", function () { update({ view: b.dataset.view }); });
  });

  var dialog = document.getElementById("gallery-settings");
  document.querySelector("[data-open-settings]").addEventListener("click", function () {
    syncDialog(); dialog.showModal();
  });
  dialog.addEventListener("change", function (e) {
    var t = e.target;
    update(t.type === "checkbox" ? Object.fromEntries([[t.name, t.checked]]) : Object.fromEntries([[t.name, t.value]]));
  });
  dialog.querySelector("[data-reset-settings]").addEventListener("click", function () {
    update(DEFAULTS);
  });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close();  // click on the backdrop
  });

  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === "/" && !typing && !dialog.open) {
      e.preventDefault(); document.getElementById("gallery-search").focus();
    }
  });

  render();
})();
