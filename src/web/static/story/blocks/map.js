// map -- an authored map: GeoJSON files and/or markers, a legend, popups, fit to what's drawn.
//   geojson: [url, ...]            features may carry properties {name, color, text}
//   markers: [{title, text, center: [lon, lat], color}]
//   center + zoom                  fixed camera instead of fitting the data
//   legend:  [{label, color}]
//   layers:  [{label, kind, ...}]    hosted / toggleable layers, a legend checkbox each (see below)
//   webmap:  <ArcGIS item id>        import a public web map's layers + extent (see S.paintMap)
//   color_by: <property> | {property, classes, breaks, ramp, categories, label, unit} | [that, ...]
//                                    choropleth: colour `geojson` features by a property (numbers ->
//                                    quantile / fixed `breaks`, text -> categories), legend + hover tooltip;
//                                    a list adds a chip per metric that re-colours the map
//   size_by: {property, min, max, color, label, unit}   proportional symbols for Point features (area ~ value)
//   heatmap: {weight, radius, intensity, opacity, ramp, points}   a density surface for Point features
//   from_table: true                 a marker per row of every `table` block that has `locate` (title = first cell)
//   filter:  "pop >= 1000 and kind == 'school'"   draw only the `geojson` features that match
// The actual drawing (GeoJSON, markers, hosted/webmap layers, legend rows) lives in `S.paintMap`,
// shared with each `swipe` divider-mode map panel.
window.STORY_BLOCKS['map'] = async function (el, config) {
  const S = window.STORY;
  const host = S.slot(el, 'map');
  if (!host) return;
  const map = S.makeMap(host, config.center ? { center: config.center, zoom: config.zoom || 8, basemap: config.basemap, ...S.threeD(config) } : { basemap: config.basemap, ...S.threeD(config) });
  el.storyMap = map;                       // map actions (story.js) fly this map

  const tableMarkers = config.from_table ? [...document.querySelectorAll('.sb--table')].flatMap(t => {
    const cfg = JSON.parse((t.querySelector('script[data-block-config]') || { textContent: '{}' }).textContent), loc = cfg.locate;
    if (!loc) return [];
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const lon = heads.indexOf(loc.lon), lat = heads.indexOf(loc.lat);
    return [...t.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent.trim()))
      .map(c => ({ title: c[0], text: c.slice(1).filter((_, i) => i + 1 !== lon && i + 1 !== lat).join(' · '), center: [parseFloat(c[lon]), parseFloat(c[lat])] }))
      .filter(m => m.center.every(Number.isFinite));
  }) : [];
  const painted = await S.paintMap(host, map, { ...config, markers: [...(config.markers || []), ...tableMarkers] });

  // `groups` colour markers by their `group` and become toggle chips; `value` (handled in
  // S.paintMap) sizes the disc. Hidden groups drop their markers.
  const off = new Set();
  if (painted.groups.length > 1) {
    const groups = painted.groups;
    const bar = S.controls(el);
    if (bar) {
      bar.classList.add('sb-groups');
      const draw = () => {
        bar.innerHTML = `<div class="sb-groups__head"><span class="eyebrow">Show on map</span><span class="sb-groups__status">${groups.length - off.size} of ${groups.length} active</span></div>`
          + `<div class="sb-chips" role="group">${groups.map(g => `<button type="button" class="sb-chip${off.has(g.label) ? '' : ' is-active'}" aria-pressed="${!off.has(g.label)}" data-g="${S.esc(g.label)}"><i class="sb-chip__dot" style="background:${S.esc(g.color)}"></i>${S.esc(g.label)}</button>`).join('')}</div>`;
      };
      draw();
      bar.addEventListener('click', e => {
        const chip = e.target.closest('.sb-chip');
        if (!chip) return;
        const g = chip.dataset.g;
        if (off.has(g)) off.delete(g); else off.add(g);
        painted.pins.forEach(({ m, dot }) => { dot.style.display = off.has(m.group) ? 'none' : ''; });
        draw();
      });
    }
  }

  const drawLegend = () => {
    const rows = painted.legendRows();
    if (!rows.length) return;
    S.legend(el, rows.join(''));
    el.querySelectorAll('input[data-layer]').forEach(box => box.addEventListener('change', () => {
      painted.hidden[box.dataset.layer] = !box.checked;
      painted.layerIds[box.dataset.layer].forEach(lid => map.setLayoutProperty(lid, 'visibility', box.checked ? 'visible' : 'none'));
    }));
  };
  drawLegend();
  if (painted.scales.length > 1) {
    S.pills(el, painted.specs.map(sp => sp.label || sp.property), i => {
      painted.setCur(i);
      if (map.getSource('geo')) map.getSource('geo').setData({ type: 'FeatureCollection', features: painted.colored() });
      drawLegend();
    });
  }
};
