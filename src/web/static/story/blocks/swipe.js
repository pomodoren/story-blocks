// swipe -- a before/after comparison.
//   mode "divider" : before/after clipped left/right of a draggable line. Each side is a
//                    picture ({src, alt, decorative}) or an authored map (same shape as the
//                    `map` block -- geojson, markers, layers, color_by, size_by, heatmap, 3D...).
//   mode "data-lon": two synced MapLibre maps split by a draggable handle
//                    (@maplibre/maplibre-gl-compare) -- one per magnitude of the scenario.
window.STORY_BLOCKS['swipe'] = async function (el, config, ctx) {
  const S = window.STORY;
  const [labelA, labelB] = config.labels || ['Before', 'After'];

  // ---------------------------------------------------------------- divider mode (picture and/or map)
  if (config.mode === 'divider') {
    const host = S.slot(el, 'swipe');
    const panelOf = spec => {
      if (!spec || typeof spec !== 'object') return null;
      return 'src' in spec ? { kind: 'image', ...spec } : { kind: 'map', ...spec };
    };
    const before = panelOf(config.before);
    const after = panelOf(config.after);
    if (!host || !before || !after) {
      S.prose(el, 'This swipe needs a <code>before</code> and an <code>after</code> picture (<code>src</code>) or map.');
      return;
    }
    S.prose(el, `Drag the slider (or the divider) to wipe between <strong>${S.esc(labelA)}</strong> and <strong>${S.esc(labelB)}</strong>.`);
    host.hidden = false;
    host.dataset.a = labelA; host.dataset.b = labelB;
    const anyMap = before.kind === 'map' || after.kind === 'map';
    host.classList.toggle('sb__swipe--panes', anyMap);
    const imgTag = (panel, label, cls) =>
      `<img class="${cls}" ${panel.decorative ? 'aria-hidden="true" alt=""' : `alt="${S.esc(panel.alt || label)}"`} src="${S.esc(panel.src)}" />`;
    host.innerHTML = anyMap
      ? `<div class="swipe-pane" data-role="before"></div>
         <div class="swipe-pane swipe-pane-after" data-role="after"></div>
         <div class="swipe-line" aria-hidden="true"></div>
         <input class="swipe-range" type="range" min="0" max="100" value="50" aria-label="Wipe" />`
      : `${imgTag(before, labelA, 'swipe-img')}
         ${imgTag(after, labelB, 'swipe-img swipe-img-after')}
         <div class="swipe-line" aria-hidden="true"></div>
         <input class="swipe-range" type="range" min="0" max="100" value="50" aria-label="Wipe" />`;
    const range = host.querySelector('.swipe-range');
    const paint = pct => host.style.setProperty('--split', `${pct}%`);
    range.addEventListener('input', () => paint(range.value));

    const controls = S.controls(el);
    if (controls) {
      controls.innerHTML = `<input type="range" class="sb-slider" min="0" max="100" value="50" aria-label="Wipe" />
        <div class="sb-slider-actions">
          <button type="button" data-pct="0">${S.esc(labelA)}</button>
          <button type="button" data-pct="50">Split</button>
          <button type="button" data-pct="100">${S.esc(labelB)}</button>
        </div>`;
      const slider = controls.querySelector('.sb-slider');
      const set = pct => { pct = Math.max(0, Math.min(100, Number(pct) || 0)); slider.value = pct; range.value = pct; paint(pct); };
      slider.addEventListener('input', () => set(slider.value));
      controls.addEventListener('click', e => { const b = e.target.closest('[data-pct]'); if (b) set(b.dataset.pct); });
    }
    paint(50);

    if (anyMap) {
      // Each map pane paints independently (no synced camera -- author matching `center`/`zoom`,
      // or let geojson/markers fit their own bounds); legends stack under "Before" / "After".
      const renderPane = async (role, panel, label) => {
        const paneEl = host.querySelector(`[data-role="${role}"]`);
        if (panel.kind === 'image') {
          paneEl.innerHTML = imgTag(panel, label, 'swipe-pane-img');
          return null;
        }
        const map = S.makeMap(paneEl, panel.center
          ? { center: panel.center, zoom: panel.zoom || 8, basemap: panel.basemap, ...S.threeD(panel) }
          : { basemap: panel.basemap, ...S.threeD(panel) });
        const painted = await S.paintMap(paneEl, map, panel);
        const rows = painted.legendRows();
        return rows.length ? `<h4>${S.esc(label)}</h4>${rows.join('')}` : null;
      };
      const [legendA, legendB] = await Promise.all([
        renderPane('before', before, labelA),
        renderPane('after', after, labelB),
      ]);
      const legendHtml = [legendA, legendB].filter(Boolean).join('');
      if (legendHtml) S.legend(el, legendHtml);
    }
    return;
  }

  // ---------------------------------------------------------------- data-lon mode (two maps)
  const scenario = await S.scenario(ctx.scenario);
  if (!scenario) { S.prose(el, `No scenario is registered for ${S.esc(ctx.label)} yet.`); return; }
  const mags = scenario.magnitudes;
  const pick = spec => spec.magnitude === 'min' ? mags[0]
    : spec.magnitude === 'max' ? mags[mags.length - 1]
    : mags.find(m => m.mw === String(spec.magnitude));
  const low = pick(config.before), high = pick(config.after);
  if (!low || !high || low.mw === high.mw || !low.has_loss_layer || !high.has_loss_layer) {
    S.prose(el, 'Not enough magnitudes with mapped loss to compare.');
    return;
  }
  S.prose(el, `Drag the handle to compare estimated structural loss at <strong>${S.esc(labelA)}</strong> (Mw ${S.esc(low.mw)}) and <strong>${S.esc(labelB)}</strong> (Mw ${S.esc(high.mw)}). The two maps pan and zoom together.`);

  const [lowLoss, highLoss] = await Promise.all([S.loss(ctx.scenario, low.mw), S.loss(ctx.scenario, high.mw)]);
  if (!lowLoss.available || !highLoss.available) { S.prose(el, 'Loss results are not available for one of these magnitudes.'); return; }

  const container = S.slot(el, 'compare');
  if (!container || !window.maplibregl.Compare) { S.prose(el, 'The comparison view could not load.'); return; }
  container.dataset.a = `${labelA} · Mw ${low.mw}`; container.dataset.b = `${labelB} · Mw ${high.mw}`;
  const beforeEl = container.querySelector('.cmp-before');
  const afterEl = container.querySelector('.cmp-after');

  const feats = [...lowLoss.features, ...highLoss.features];
  const maxV = Math.max(1, ...feats.map(f => f.properties.loss_value));
  const bb = S.bbox(feats.map(f => f.geometry.coordinates));
  const radius = ['interpolate', ['linear'], ['get', 'loss_value'], 0, 2, maxV, 12];
  const lossLayer = (map, data, hot) => {
    map.addSource('loss', { type: 'geojson', data });
    map.addLayer({ id: 'loss', type: 'circle', source: 'loss', paint: {
      'circle-radius': radius, 'circle-opacity': .84,
      'circle-color': ['interpolate', ['linear'], ['get', 'loss_value'],
        0, hot ? '#f2b53c' : '#8ecae6', maxV, hot ? '#c81d25' : '#1d6fa5'],
    } });
    S.popup(map, 'loss', '<strong>Entity {entity_id}</strong><br>{loss_value} loss');
  };

  const opts = bb ? { bounds: bb, fitBoundsOptions: { padding: 40 } } : {};
  const mBefore = S.makeMap(beforeEl, opts);
  const mAfter = S.makeMap(afterEl, opts);
  // S.mapLoaded resolves whether or not the map's `load` already fired (a two-map race that
  // left maplibregl.Compare -- and so the whole slider -- uninitialised).
  Promise.all([S.mapLoaded(mBefore), S.mapLoaded(mAfter)]).then(() => {
    lossLayer(mBefore, lowLoss, false);
    lossLayer(mAfter, highLoss, true);
    // eslint-disable-next-line no-new
    new maplibregl.Compare(mBefore, mAfter, container, {});
  });

  S.legend(el, `<h4>Estimated structural loss</h4>
    <div class="legend-row"><span class="swatch" style="background:#1d6fa5"></span>${S.esc(labelA)} — Mw ${S.esc(low.mw)} (left)</div>
    <div class="legend-row"><span class="swatch" style="background:#c81d25"></span>${S.esc(labelB)} — Mw ${S.esc(high.mw)} (right)</div>`);
};
