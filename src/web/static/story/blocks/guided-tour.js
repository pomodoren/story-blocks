// guided-tour -- one pinned map that flies step to step as the reader scrolls (the
// slider.html "coast" mechanism, opt-in per block).
//
// config: { view: "risk"|"exposure"|"taxonomy"|"hazard"|"none", layout: "overlay"|"split", legend, intro,
//           steps: [{title, text, stats: [{value, label}], focus, legend, metric, highlight, fit, show, symbols}] }
//   authored data (view "none"): geojson, color_by, size_by, heatmap, layers -- see below.
//   focus: {worst: N} (risk: the Nth highest-loss entity) | {center: [lon,lat], zoom, pitch}
//   a step with no focus returns the map to the overview.
// Per step: the camera flies (clear of the floating card in `overlay` layout), a pulse marks the
// target, the step's stat numbers count up, and the HUD's progress dots follow along.
window.STORY_BLOCKS['guided-tour'] = async function (el, config, ctx) {
  const S = window.STORY;
  const map = S.makeMap(S.slot(el, 'map'), { basemap: config.basemap, ...S.threeD(config) });
  el.storyMap = map;                       // map actions (story.js) fly this map

  const overlay = config.layout !== 'split';
  // keep the flight target clear of the card floating over the left of a wide map
  const inset = () => (overlay && innerWidth > 900 ? { left: Math.min(440, innerWidth * .34) } : null);

  // Authored GeoJSON turns a data-free guided tour into a reusable data story. Beyond the camera,
  // each step can re-state the map (all optional, all static):
  //   block:  geojson, color_by (a list = metrics), size_by, heatmap, layers: [{label, geojson, color}]
  //   step:   metric="<color_by label>"  highlight="<filter>"  fit="<filter>"  show="Layer A,Layer B"  symbols=off
  // `highlight` dims every feature that does not match; `fit` also frames the matches.
  const geoURLs = config.geojson ? (Array.isArray(config.geojson) ? config.geojson : [config.geojson]) : [];
  const layerSpecs = config.layers || [];
  const getJSON = url => fetch(url).then(response => {
    if (!response.ok) throw new Error(`GeoJSON ${url}: HTTP ${response.status}`);
    return response.json();
  });
  let geoBase = null;
  if (geoURLs.length || layerSpecs.length) {
    const [collections, layerData] = await Promise.all([
      Promise.all(geoURLs.map(getJSON)),
      Promise.all(layerSpecs.map(l => getJSON(l.geojson || l.url))),
    ]);
    const features = collections.flatMap(item => item.features || []);
    const data = { type: 'FeatureCollection', features };
    await S.mapLoaded(map);

    const metrics = [].concat(config.color_by || []).map(c => (typeof c === 'string' ? { property: c } : c));
    const scales = features.length ? metrics.map(sp => S.makeScale(features.filter(f => /Polygon/.test(f.geometry?.type) && sp.property in (f.properties || {})).map(f => f.properties[sp.property]), sp)) : [];
    const metricName = sp => sp.label || sp.property;
    const size = config.size_by && features.length ? S.sizeScale(features, config.size_by) : null;
    const heat = config.heatmap || null;
    let cur = 0, hl = null, symbolsOff = false;
    const dim = (on, off) => ['case', ['==', ['get', '_dim'], 1], off, on];
    const color = fallback => ['coalesce', ['get', 'color'], fallback];

    map.addSource('story-geo', { type: 'geojson', data });
    map.addLayer({
      id: 'story-areas', type: 'fill', source: 'story-geo',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': color('#37b6c9'),
        'fill-opacity': ['case', ['==', ['get', '_hide'], 1], 0, ['==', ['get', '_dim'], 1], .1, scales.length ? .78 : .2],
        'fill-outline-color': scales.length ? '#ffffff' : color('#37b6c9'),
      },
    });
    map.addLayer({
      id: 'story-route', type: 'line', source: 'story-geo',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': color('#e01e26'),
        'line-width': 3, 'line-opacity': dim(.8, .12), 'line-dasharray': [2, 1.5],
      },
    });
    if (heat) {
      map.addLayer({ id: 'story-heat', type: 'heatmap', source: 'story-geo', filter: ['==', ['geometry-type'], 'Point'], paint: S.heatPaint(features, heat) });
    }
    map.addLayer({
      id: 'story-points', type: 'circle', source: 'story-geo',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: heat && !heat.points ? { visibility: 'none' } : {},
      paint: {
        'circle-radius': size ? size.radius : 7,
        'circle-color': color(config.size_by?.color || '#e01e26'),
        'circle-opacity': dim(size ? .75 : 1, .1),
        'circle-stroke-color': '#fff', 'circle-stroke-width': size ? 1 : 2,
        'circle-stroke-opacity': dim(1, .1),
      },
    });

    // each hosted `layers` item is a flat-styled GeoJSON that a step can show or hide
    const layerIds = layerSpecs.map((l, i) => {
      const id = `story-layer-${i}`, c = l.color || '#37b6c9';
      map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: layerData[i].features || [] } });
      map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c, 'fill-opacity': l.opacity ?? .3, 'fill-outline-color': c } });
      map.addLayer({ id: `${id}-line`, type: 'line', source: id, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': c, 'line-width': 3 } });
      map.addLayer({ id: `${id}-pt`, type: 'circle', source: id, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': c, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      return [`${id}-fill`, `${id}-line`, `${id}-pt`];
    });
    const layerOn = layerSpecs.map(l => l.visible !== false);
    const paintLayers = () => layerIds.forEach((ids, i) => ids.forEach(lid => map.setLayoutProperty(lid, 'visibility', layerOn[i] ? 'visible' : 'none')));
    paintLayers();

    const paint = () => map.getSource('story-geo').setData({
      type: 'FeatureCollection',
      features: features.map(f => {
        const p = { ...f.properties };
        // colour what carries the metric; areas without it read as "no data", points keep their own colour
        // (an area that does not carry the metric's property at all belongs to another metric: hidden)
        p._hide = 0;
        if (scales.length) {
          const poly = /Polygon/.test(f.geometry?.type);
          if (poly && !(metrics[cur].property in p)) p._hide = 1;
          else {
            const c = S.isBlank(p[metrics[cur].property]) ? null : scales[cur].color(p[metrics[cur].property]);
            if (c) p.color = c; else if (poly) p.color = S.NO_DATA; else delete p.color;
          }
        }
        // a highlight only dims features that carry a property it reads (so it can single out points
        // without greying the areas beneath, and vice versa)
        p._dim = hl && hl.keys.some(k => !S.isBlank(f.properties?.[k])) && !hl(f.properties) ? 1 : 0;
        return { ...f, properties: p };
      }),
    });
    if (scales.length) paint();

    const card = p => {
      const rows = [];
      if (scales.length && p[metrics[cur].property] != null) rows.push([metricName(metrics[cur]), p[metrics[cur].property], metrics[cur].unit]);
      if (config.size_by && p[config.size_by.property] != null) rows.push([config.size_by.label || config.size_by.property, p[config.size_by.property], config.size_by.unit]);
      return `<strong>${S.esc(p.name || p.title || '')}</strong>`
        + rows.map(([k, v, u]) => `<br>${S.esc(k)}: <strong>${S.esc(S.isNumeric(v) ? S.fmtNum(v) : v)}${u ? ' ' + S.esc(u) : ''}</strong>`).join('');
    };
    ['story-areas', 'story-points'].forEach(lid => {
      map.on('click', lid, e => e.features[0] && (e.features[0].properties.name || e.features[0].properties.title) &&
        new maplibregl.Popup({ offset: 12 }).setLngLat(e.lngLat).setHTML(card(e.features[0].properties)).addTo(map));
      map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
    });

    data.features.filter(feature => feature.properties?.label_coordinates).forEach(feature => {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'story-geo-label';
      label.textContent = feature.properties?.name || 'Location';
      label.addEventListener('click', () => new maplibregl.Popup({ offset: 12 })
        .setLngLat(feature.properties.label_coordinates)
        .setHTML(`<strong>${S.esc(feature.properties?.name)}</strong><br>${S.esc(feature.properties?.kind || "")}<br><a href="${S.esc(feature.properties?.osm_url)}" target="_blank" rel="noopener">View on OpenStreetMap</a>`)
        .addTo(map));
      new maplibregl.Marker({ element: label, anchor: 'left', offset: [10, 0] })
        .setLngLat(feature.properties.label_coordinates).addTo(map);
    });

    const collect = (coords, value) => Array.isArray(value?.[0]) ? value.forEach(v => collect(coords, v)) : coords.push(value);
    const boundsOf = list => { const coords = []; list.forEach(f => f.geometry && collect(coords, f.geometry.coordinates)); return S.bbox(coords); };
    const bounds = boundsOf([...features, ...layerData.flatMap(c => c.features || [])].filter(f => f.properties?.overview !== false));
    const padding = extra => (extra ? { top: 44, right: 44, bottom: 44, left: 44 + extra.left } : 44);
    const safe = (expr, what) => { try { return S.parseFilter(expr); } catch (e) { console.warn('guided-tour', what, e.message); return null; } };

    const legendFor = () => {
      const rows = [];
      if (scales.length) {
        const sp = metrics[cur];
        rows.push(`<h4>${S.esc(metricName(sp))}</h4>`, ...scales[cur].items.map(i => `<div class="legend-row"><span class="swatch" style="background:${S.esc(i.color)}"></span>${S.esc(i.label)}</div>`));
        if (features.some(f => /Polygon/.test(f.geometry?.type) && sp.property in (f.properties || {}) && S.isBlank(f.properties[sp.property]))) rows.push(`<div class="legend-row"><span class="swatch" style="background:${S.NO_DATA}"></span>no data</div>`);
      }
      if (!symbolsOff) { if (size) rows.push(size.legend()); if (heat) rows.push(S.heatLegend(heat)); }
      layerSpecs.forEach((l, i) => { if (layerOn[i]) rows.push(`<div class="legend-row"><span class="swatch" style="background:${S.esc(l.color || '#37b6c9')}"></span>${S.esc(l.label)}</div>`); });
      return rows.length ? rows.join('') : geoBase.legendHTML;
    };

    geoBase = {
      resolve: focus => focus?.center ? focus : null,
      fit: extra => bounds && map.fitBounds(bounds, { padding: padding(extra), duration: S.cameraMs(900) }),
      // re-state the map for a step; true when it also moved the camera (`fit`)
      apply(spec, extra) {
        cur = Math.max(0, metrics.findIndex(sp => metricName(sp) === spec.metric));
        symbolsOff = spec.symbols === 'off';
        const expr = spec.highlight || spec.fit;
        hl = expr ? safe(expr, 'highlight') : null;
        const wanted = spec.show ? String(spec.show).split(',').map(s => s.trim()) : null;
        layerSpecs.forEach((l, i) => { layerOn[i] = wanted ? wanted.includes(l.label) : l.visible !== false; });
        if (features.length && (scales.length || hl || this.dirty)) { paint(); this.dirty = Boolean(hl); }
        ['story-points', 'story-heat'].forEach(lid => map.getLayer(lid) && map.setLayoutProperty(lid, 'visibility',
          spec.symbols === 'off' || (lid === 'story-points' && heat && !heat.points) ? 'none' : 'visible'));
        paintLayers();
        const keep = spec.fit ? safe(spec.fit, 'fit') : null;
        const box = keep && boundsOf(features.filter(f => keep(f.properties)));
        if (!box) return false;
        map.fitBounds(box, { padding: padding(extra), maxZoom: spec.focus?.zoom || 14, duration: S.cameraMs(1100) });
        return true;
      },
      legendFor,
      legendHTML: '<h4>Story map</h4><div class="legend-row"><span class="swatch" style="background:#e01e26"></span>Mapped story locations</div><div class="legend-row"><span class="swatch" style="background:#37b6c9"></span>OSM-mapped boundaries</div>',
    };
  }

  const view = S.mapViews[config.view];
  const base = view ? await view(map, ctx, config) : geoBase;
  const legendFor = spec => {
    if (spec.legend != null) return spec.legend;
    if (!config.legend || !base) return null;
    return base.legendFor ? base.legendFor(spec) : base.legendHTML;
  };

  const stepEls = [...el.querySelectorAll('.gt-step')];
  const specs = config.steps || [];
  let active = -1;
  let popup = null;
  let pulse = null;

  // ---- HUD: "2 / 4" + one dot per step (click to jump)
  const hud = S.slot(el, 'hud');
  const dots = [];
  if (hud && stepEls.length > 1) {
    hud.innerHTML = '<span class="gt-hud-count"></span><span class="gt-hud-dots"></span>';
    const dotHost = hud.querySelector('.gt-hud-dots');
    stepEls.forEach((step, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Step ${i + 1}`);
      dot.addEventListener('click', () => S.scrollTo(step, 'center'));
      dotHost.appendChild(dot);
      dots.push(dot);
    });
    hud.hidden = false;
  }
  const paintHud = i => {
    if (!hud || !dots.length) return;
    hud.querySelector('.gt-hud-count').textContent = `${i + 1} / ${stepEls.length}`;
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  };

  const activate = i => {
    if (i === active || i < 0 || i >= stepEls.length) return;
    active = i;
    stepEls.forEach((s, k) => s.classList.toggle('is-active', k === i));
    paintHud(i);

    const spec = specs[i] || {};
    // without a bound view there is nothing for `worst` to resolve -- only an explicit centre flies
    const moved = base && base.apply ? base.apply(spec, inset()) : false;
    const camera = moved ? null : base && base.resolve ? base.resolve(spec.focus) : (spec.focus && spec.focus.center ? spec.focus : null);
    if (camera) map.flyTo({ ...camera, padding: inset() || { left: 0 }, duration: S.cameraMs(1100) });
    else if (!moved && base && base.fit) base.fit(inset());

    S.legend(el, legendFor(spec));

    popup?.remove();
    pulse?.remove();
    popup = pulse = null;
    const feature = base && base.feature ? base.feature(spec.focus) : null;
    if (feature) {
      const detail = base.currency
        ? `<strong>Entity ${S.esc(feature.properties.entity_id)}</strong><br>${S.fmtCurrency(feature.properties.loss_value, base.currency)} loss`
        : `<strong>Entity ${S.esc(feature.properties.entity_id ?? feature.properties.id)}</strong>`;
      popup = new maplibregl.Popup({ closeButton: true, offset: 14 }).setLngLat(feature.properties.label_coordinates).setHTML(detail).addTo(map);
    }
    if (camera && camera.center) {
      const ring = document.createElement('div');
      ring.className = 'gt-pulse';
      pulse = new maplibregl.Marker({ element: ring }).setLngLat(camera.center).addTo(map);
    }

    stepEls[i].querySelectorAll('.gt-stat b').forEach(b => S.countUp(b));
  };

  S.watchSteps(stepEls, activate);

  if (stepEls.length) activate(0);
  else S.legend(el, legendFor({}));
};
