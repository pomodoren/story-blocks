// deck-tour -- a scrolling data story on a 3D map: deck.gl layers drawn over the shared MapLibre map
// (so it uses the reader's basemap choice, like every other map). Same step vocabulary as the
// authored-data guided-tour, plus extruded buildings / columns and a click-through detail panel.
//
// config: { geojson: [url, ...], basemap: online|offline, pitch, bearing, legend, intro,
//           color_by: [{property, label, unit, breaks|classes|categories, ramp,
//                       height: <property>, height_scale: <metres per unit>}],
//           size_by: {property, label, unit, color, min, max}, heatmap: {weight, radius, ramp, points},
//           layers: [{label, geojson, color, visible}],
//           fields: {<property>: {label, unit, sum, hide}},
//           steps: [{title, text, stats, focus: {center, zoom, pitch, bearing}, metric, highlight, fit,
//                    show, symbols, select, legend}] }
//   metric     which color_by entry paints (and extrudes) the areas; areas without its property are hidden
//   highlight  dim every feature that does not match (a filter: "era == 'Before 1975'")
//   fit        frame the matching features        select  open the first match in the detail panel
// Click anything: the panel lists its properties (with where it ranks among its peers); click an area
// and it also summarises -- and outlines -- the features of the other files that sit inside it.
window.STORY_BLOCKS['deck-tour'] = async function (el, config) {
  const S = window.STORY;
  const host = S.slot(el, 'map');
  if (!host || !window.deck) { if (host) host.textContent = 'deck.gl failed to load'; return; }
  const D = window.deck;
  if (!D.MapboxOverlay) { host.textContent = 'deck.gl failed to load'; return; }
  const basePitch = config.pitch ?? 50, baseBearing = config.bearing ?? 0;
  const map = S.makeMap(host, { ...S.threeD(config), basemap: config.basemap, pitch: basePitch, bearing: baseBearing });

  // ---------------------------------------------------------------- data
  const urls = [].concat(config.geojson || []);
  const layerSpecs = config.layers || [];
  const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(`GeoJSON ${u}: HTTP ${r.status}`); return r.json(); });
  const [sources, layerData] = await Promise.all([Promise.all(urls.map(getJSON)), Promise.all(layerSpecs.map(l => getJSON(l.geojson || l.url)))]);
  const isPoly = f => /Polygon/.test(f.geometry?.type);
  const isPoint = f => f.geometry?.type === 'Point';
  const ring = f => (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]);
  const centroidOf = f => {
    if (isPoint(f)) return f.geometry.coordinates;
    const r = ring(f); return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
  };
  const files = sources.map((c, i) => (c.features || []).map(f => { f._src = i; f._c = centroidOf(f); return f; }));
  const features = files.flat();
  const P = f => f.properties || (f.properties = {});

  const metrics = [].concat(config.color_by || []).map(c => (typeof c === 'string' ? { property: c } : c));
  const metricName = sp => sp.label || sp.property;
  const scales = metrics.map(sp => S.makeScale(features.filter(f => isPoly(f) && sp.property in P(f)).map(f => P(f)[sp.property]), sp));
  const size = config.size_by || null, heat = config.heatmap || null;
  const pointFeatures = features.filter(isPoint);
  const sizeTop = size ? Math.max(1e-9, ...pointFeatures.map(f => Number(P(f)[size.property])).filter(Number.isFinite)) : 1;
  const radiusOf = f => { const lo = size.min ?? 4, hi = size.max ?? 24; return lo + (hi - lo) * Math.sqrt(Math.max(0, Number(P(f)[size.property]) || 0) / sizeTop); };
  const fields = config.fields || {};

  // ---------------------------------------------------------------- state
  let cur = 0, hl = null, symbolsOff = false, selected = null, version = 0;
  let contained = new Set();
  const layerOn = layerSpecs.map(l => l.visible !== false);
  const spec = () => metrics[cur];
  const carries = f => !metrics.length || spec().property in P(f);
  const hidden = f => isPoly(f) && !carries(f) && !contained.has(f);   // a selected area x-rays what is inside it
  const dimmed = f => hl && hl.keys.some(k => !S.isBlank(P(f)[k])) && !hl(P(f));
  const rgb = (hex, a = 255) => { const h = String(hex || '#37b6c9').replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, a]; };
  const accent = () => rgb((getComputedStyle(el).getPropertyValue('--s-accent') || '#e8590c').trim() || '#e8590c');
  const colorOf = f => {
    if (isPoint(f)) return P(f).color || size?.color || '#e01e26';
    if (metrics.length) {
      const v = P(f)[spec().property];
      return S.isBlank(v) ? S.NO_DATA : scales[cur].color(v) || S.NO_DATA;
    }
    return P(f).color || '#37b6c9';
  };
  const heightOf = f => {
    if (!metrics.length || hidden(f)) return 0;
    // a feature the metric does not cover (but a selection reveals) borrows the height of one that does
    const sp = carries(f) ? spec() : metrics.find(m => m.height && m.property in P(f));
    if (!sp || !sp.height) return 0;
    return Math.max(0, Number(P(f)[sp.height]) || 0) * (sp.height_scale ?? 1) * (dimmed(f) ? .25 : 1);
  };
  const extruded = () => Boolean(metrics.length && (spec().height || contained.size));

  // ---------------------------------------------------------------- camera
  const bboxOf = list => {
    const c = []; list.forEach(f => { const w = v => (Array.isArray(v[0]) ? v.forEach(w) : c.push(v)); f.geometry && w(f.geometry.coordinates); });
    return S.bbox(c);
  };
  const inset = () => (innerWidth > 900 ? { left: Math.min(440, innerWidth * .34) } : null);
  // the camera that frames `box` (clear of a floating card on the left when `extra` says so)
  const fitView = (box, extra, pitch, bearing, maxZoom = 17) => {
    const pad = extra ? { top: 60, right: 60, bottom: 60, left: 60 + extra.left } : 60;
    const v = map.cameraForBounds(box, { padding: pad, maxZoom, bearing });
    return v && { center: v.center, zoom: v.zoom, pitch, bearing };
  };
  const all = bboxOf([...features, ...layerData.flatMap(c => c.features || [])]);
  const fly = (v, ms = 1400) => map.flyTo({ ...v, duration: S.cameraMs(ms), speed: 1.2, essential: true });
  const start = all && fitView(all, null, basePitch, baseBearing);
  if (start) map.jumpTo(start);
  // ---------------------------------------------------------------- layers
  const ms = S.cameraMs(550);
  const build = () => {
    const ex = extruded(), acc = accent();
    const out = [];
    layerSpecs.forEach((l, i) => out.push(new D.GeoJsonLayer({
      id: `dk-layer-${i}`, data: layerData[i], visible: layerOn[i], pickable: true, filled: true, stroked: true,
      getFillColor: rgb(l.color || '#37b6c9', Math.round(255 * (l.opacity ?? .28))), getLineColor: rgb(l.color || '#37b6c9', 230),
      lineWidthMinPixels: 2, getPointRadius: 6, pointRadiusUnits: 'pixels',
    })));
    files.forEach((list, i) => {
      const polys = list.filter(isPoly);
      if (polys.length) out.push(new D.GeoJsonLayer({
        id: `dk-areas-${i}`, data: polys, pickable: polys.some(f => !hidden(f)), autoHighlight: true, highlightColor: [255, 255, 255, 70],
        filled: true, stroked: !ex, extruded: ex, wireframe: false, lineWidthMinPixels: 1,
        getFillColor: f => {
          if (hidden(f)) return [0, 0, 0, 0];
          if (f === selected || (contained.has(f) && !carries(f))) return acc.slice(0, 3).concat(245);
          const c = rgb(dimmed(f) ? S.NO_DATA : colorOf(f)); c[3] = dimmed(f) ? 40 : ex ? 235 : 205; return c;
        },
        getLineColor: f => (contained.has(f) ? acc : [255, 255, 255, hidden(f) ? 0 : 70]),
        getElevation: heightOf,
        material: { ambient: .55, diffuse: .6, shininess: 28, specularColor: [90, 90, 90] },
        transitions: ms ? { getFillColor: ms, getElevation: ms + 150 } : {},
        updateTriggers: { getFillColor: [version, contained.size, selected], getLineColor: [version, contained.size], getElevation: [version, contained.size] },
      }));
    });
    // the chosen area / contained buildings stay outlined and a touch taller, above everything else
    if (selected && isPoly(selected)) out.push(new D.GeoJsonLayer({
      id: 'dk-selected', data: [selected], pickable: false, filled: false, stroked: true, extruded: false,
      getLineColor: acc, lineWidthMinPixels: 3,
    }));
    if (heat) out.push(new D.HeatmapLayer({
      id: 'dk-heat', data: pointFeatures, visible: !symbolsOff, getPosition: f => f.geometry.coordinates,
      getWeight: f => (heat.weight ? Number(P(f)[heat.weight]) || 0 : 1), radiusPixels: heat.radius ?? 40,
      intensity: heat.intensity ?? 1, threshold: .04, opacity: heat.opacity ?? .85,
      colorRange: S.rampColors(heat.ramp || 'warm', 6).map(c => rgb(c).slice(0, 3)),
    }));
    if (pointFeatures.length && (!heat || heat.points)) out.push(new D.ScatterplotLayer({
      id: 'dk-points', data: pointFeatures, visible: !symbolsOff, pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 120],
      getPosition: f => f.geometry.coordinates, radiusUnits: 'pixels', getRadius: f => (size ? radiusOf(f) : 7),
      getFillColor: f => { const c = rgb(dimmed(f) ? S.NO_DATA : colorOf(f)); c[3] = dimmed(f) ? 40 : 205; return c; },
      stroked: true, getLineColor: f => (f === selected ? acc : [255, 255, 255, dimmed(f) ? 40 : 230]),
      getLineWidth: f => (f === selected ? 3 : 1), lineWidthUnits: 'pixels',
      transitions: ms ? { getRadius: ms, getFillColor: ms } : {},
      updateTriggers: { getFillColor: [version], getLineColor: [version, selected], getLineWidth: [selected] },
    }));
    return out;
  };

  // ---------------------------------------------------------------- tooltip + panel
  const num = v => (S.isNumeric(v) ? S.fmtNum(Math.round(Number(v) * 100) / 100) : S.esc(v));
  const humanize = k => k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  const labelOf = k => fields[k]?.label || humanize(k);
  const shown = f => Object.keys(P(f)).filter(k => !k.startsWith('_') && !['kind', 'color', 'name', 'title', 'text', 'label_coordinates', 'overview'].includes(k) && !fields[k]?.hide && !S.isBlank(P(f)[k]));
  const titleOf = f => P(f).name || P(f).title || (P(f).occupancy ? `${P(f).occupancy} building` : P(f).kind ? humanize(P(f).kind) : 'Feature');
  const tip = info => {
    const f = info.object;
    if (!f || (isPoly(f) && hidden(f)) || (dimmed(f) && !isPoint(f))) return null;
    const m = metrics.length && isPoly(f) && !S.isBlank(P(f)[spec().property]) ? `<br>${S.esc(metricName(spec()))}: <b>${num(P(f)[spec().property])}${spec().unit ? ' ' + S.esc(spec().unit) : ''}</b>` : '';
    const s = size && isPoint(f) ? `<br>${S.esc(size.label || size.property)}: <b>${num(P(f)[size.property])}${size.unit ? ' ' + S.esc(size.unit) : ''}</b>` : '';
    return { html: `<strong>${S.esc(titleOf(f))}</strong>${m}${s}`, className: 'dk-tip', style: { background: 'var(--s-surface,#fff)', color: 'var(--s-fg,#111)', fontSize: '12px', borderRadius: '8px', padding: '8px 10px', boxShadow: '0 4px 18px #0004' } };
  };
  const rankCache = {};
  const rank = (f, k) => {
    const id = `${f._src}:${k}`;
    const vals = rankCache[id] || (rankCache[id] = files[f._src].map(g => Number(P(g)[k])).filter(Number.isFinite).sort((a, b) => a - b));
    const v = Number(P(f)[k]);
    if (!Number.isFinite(v) || vals.length < 5) return null;
    let lo = 0; while (lo < vals.length && vals[lo] < v) lo++;
    return Math.round(100 * lo / vals.length);
  };
  const inside = (pt, f) => { const r = ring(f); let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < (r[j][0] - r[i][0]) * (pt[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
  const breakdown = group => {
    const n = group.length;
    const cats = {}; group.forEach(g => Object.entries(P(g)).forEach(([k, v]) => { if (typeof v === 'string' && !k.startsWith('_') && !['name', 'kind', 'text', 'parish'].includes(k)) (cats[k] ||= {})[v] = (cats[k][v] || 0) + 1; }));
    const html = Object.entries(cats).filter(([, c]) => Object.keys(c).length <= 8 && Object.values(c).reduce((a, b) => a + b, 0) >= n / 2).slice(0, 3).map(([k, c]) => {
      const total = Object.values(c).reduce((a, b) => a + b, 0), pal = metrics.find(m => m.property === k)?.categories || {};
      return `<h5>${S.esc(labelOf(k))}</h5><div class="dk-stack">${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([v, cnt], i) => `<i style="flex:${cnt};background:${S.esc(pal[v] || S.rampColors('blue', 6)[i % 6])}" title="${S.esc(v)}: ${cnt}"></i>`).join('')}</div>`
        + `<div class="dk-keys">${Object.entries(c).sort((a, b) => b[1] - a[1]).map(([v, cnt]) => `<span>${S.esc(v)} <b>${Math.round(100 * cnt / total)}%</b></span>`).join('')}</div>`;
    }).join('');
    const sums = Object.keys(fields).filter(k => fields[k].sum).map(k => {
      const t = group.reduce((a, g) => a + (Number(P(g)[k]) || 0), 0);
      return t ? `<div class="dk-row"><span>${S.esc(labelOf(k))}</span><b>${num(t)}${fields[k].unit ? ' ' + S.esc(fields[k].unit) : ''}</b></div>` : '';
    }).join('');
    return sums + html;
  };
  const panel = S.slot(el, 'panel');
  const paintPanel = () => {
    if (!panel) return;
    if (!selected) { panel.hidden = true; return; }
    const f = selected, p = P(f);
    const rows = shown(f).map(k => {
      const r = typeof p[k] === 'number' ? rank(f, k) : null;
      return `<div class="dk-row"><span>${S.esc(labelOf(k))}</span><b>${num(p[k])}${fields[k]?.unit ? ' ' + S.esc(fields[k].unit) : ''}</b></div>`
        + (r != null ? `<div class="dk-rank" title="Higher than ${r}% of its peers"><i style="width:${Math.max(3, r)}%"></i></div>` : '');
    }).join('');
    const groups = {};
    if (isPoly(f)) contained.forEach(g => (groups[P(g).kind || (isPoint(g) ? 'point' : 'feature')] ||= []).push(g));
    const within = Object.entries(groups).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
    panel.innerHTML = `<button type="button" class="dk-x" aria-label="Close details">×</button>`
      + `<p class="dk-kind">${S.esc(p.kind ? humanize(p.kind) : 'Selected')}</p><h4>${S.esc(titleOf(f))}</h4>${p.text ? `<p class="dk-text">${S.esc(p.text)}</p>` : ''}`
      + within.map(([kind, g]) => `<div class="dk-within"><b>${S.fmtNum(g.length)}</b> ${S.esc(kind)}${g.length === 1 ? '' : 's'} inside${breakdown(g)}</div>`).join('')
      + `<div class="dk-rows">${rows}</div>`
      + `<button type="button" class="dk-zoom">Zoom here</button>`;
    panel.hidden = false;
    const lg = S.slot(el, 'legend');
    panel.style.maxHeight = `${Math.max(180, (lg && !lg.hidden ? lg.offsetTop : host.clientHeight) - 62 - 14)}px`;
    panel.querySelector('.dk-x').addEventListener('click', () => select(null));
    panel.querySelector('.dk-zoom').addEventListener('click', () => {
      const b = bboxOf([f]); const [lon, lat] = f._c;
      fly(isPoly(f) && b ? fitView(b, inset(), Math.max(map.getPitch(), 45), map.getBearing(), 15.6) : { center: [lon, lat], zoom: 17 });
    });
  };
  const select = (f, { move = false } = {}) => {
    selected = f || null;
    contained = new Set();
    if (f && isPoly(f)) files.forEach((list, i) => { if (i !== f._src) list.forEach(g => { if (inside(g._c, f)) contained.add(g); }); });
    version++; draw(); paintPanel();
    if (f && move) { const b = bboxOf([f]); fly(isPoly(f) && b ? fitView(b, inset(), Math.max(map.getPitch(), 45), map.getBearing(), 15.6) : { center: f._c, zoom: 16.5 }, 1200); }
  };

  // ---------------------------------------------------------------- deck
  const draw = () => deck.setProps({ layers: build() });
  const deck = new D.MapboxOverlay({ interleaved: false, layers: [], getTooltip: tip });
  map.addControl(deck);
  // MapLibre reports a click only when the pointer did not drag, so this picks the feature under it
  map.on('click', e => {
    const info = deck.pickObject({ x: e.point.x, y: e.point.y, radius: 3 });
    const f = info && info.object;
    if (!f) { select(null); return; }
    if ((isPoly(f) && hidden(f)) || (dimmed(f) && !isPoint(f))) return;
    select(f);
  });
  map.on('mousemove', e => {
    const info = deck.pickObject({ x: e.point.x, y: e.point.y, radius: 3 });
    map.getCanvas().style.cursor = info && info.object ? 'pointer' : '';
  });
  el.storyDeck = { deck, features };   // for scripts and tests: pick a feature
  addEventListener('keydown', e => { if (e.key === 'Escape' && selected && el.contains(document.activeElement)) select(null); });
  // `[text](map:lon,lat,zoom)` links fly this map too
  el.storyMap = map;

  // ---------------------------------------------------------------- legend
  const legendFor = () => {
    const rows = [];
    if (metrics.length) {
      const sp = spec();
      rows.push(`<h4>${S.esc(metricName(sp))}${sp.height ? ' <small>· height</small>' : ''}</h4>`, ...scales[cur].items.map(i => `<div class="legend-row"><span class="swatch" style="background:${S.esc(i.color)}"></span>${S.esc(i.label)}</div>`));
      if (features.some(f => isPoly(f) && sp.property in P(f) && S.isBlank(P(f)[sp.property]))) rows.push(`<div class="legend-row"><span class="swatch" style="background:${S.NO_DATA}"></span>no data</div>`);
    }
    if (!symbolsOff) {
      if (size && pointFeatures.length) rows.push(S.sizeScale(pointFeatures, size).legend());
      if (heat) rows.push(S.heatLegend(heat));
    }
    layerSpecs.forEach((l, i) => { if (layerOn[i]) rows.push(`<div class="legend-row"><span class="swatch" style="background:${S.esc(l.color || '#37b6c9')}"></span>${S.esc(l.label)}</div>`); });
    return rows.join('');
  };

  // ---------------------------------------------------------------- steps
  const stepEls = [...el.querySelectorAll('.gt-step')], specs = config.steps || [];
  let active = -1;
  const hud = S.slot(el, 'hud'), dots = [];
  if (hud && stepEls.length > 1) {
    hud.innerHTML = '<span class="gt-hud-count"></span><span class="gt-hud-dots"></span>';
    const dh = hud.querySelector('.gt-hud-dots');
    stepEls.forEach((step, i) => { const d = document.createElement('button'); d.type = 'button'; d.setAttribute('aria-label', `Step ${i + 1}`); d.addEventListener('click', () => S.scrollTo(step, 'center')); dh.appendChild(d); dots.push(d); });
    hud.hidden = false;
  }
  const safe = (expr, what) => { try { return S.parseFilter(expr); } catch (e) { console.warn('deck-tour', what, e.message); return null; } };

  const activate = i => {
    if (i === active || i < 0 || i >= stepEls.length) return;
    active = i;
    stepEls.forEach((s, k) => s.classList.toggle('is-active', k === i));
    if (hud && dots.length) { hud.querySelector('.gt-hud-count').textContent = `${i + 1} / ${stepEls.length}`; dots.forEach((d, k) => d.classList.toggle('is-active', k === i)); }
    const st = specs[i] || {};
    cur = Math.max(0, metrics.findIndex(sp => metricName(sp) === st.metric));
    symbolsOff = st.symbols === 'off';
    const expr = st.highlight || st.fit;
    hl = expr ? safe(expr, 'highlight') : null;
    const wanted = st.show ? String(st.show).split(',').map(s => s.trim()) : null;
    layerSpecs.forEach((l, k) => { layerOn[k] = wanted ? wanted.includes(l.label) : l.visible !== false; });
    selected = null; contained = new Set(); version++;
    const f = st.focus || {};
    const pitch = f.pitch ?? basePitch, bearing = f.bearing ?? baseBearing;
    const keep = st.fit ? safe(st.fit, 'fit') : null;
    const box = keep && bboxOf(features.filter(g => keep(P(g))));
    if (box) fly(fitView(box, inset(), pitch, bearing));
    else if (f.center) fly({ center: f.center, zoom: f.zoom ?? 13, pitch, bearing });
    else if (all) fly(fitView(all, inset(), pitch, bearing), 1100);
    draw();
    const pick = st.select ? safe(st.select, 'select') : null;
    const hit = pick && features.find(g => !hidden(g) && pick(P(g)));
    if (hit) select(hit, { move: !box && !f.center }); else paintPanel();
    S.legend(el, st.legend != null ? st.legend : (config.legend ? legendFor() : null));
    stepEls[i].querySelectorAll('.gt-stat b').forEach(b => S.countUp(b));
  };
  S.watchSteps(stepEls, activate);
  draw();
  if (stepEls.length) activate(0); else S.legend(el, config.legend ? legendFor() : null);
};
