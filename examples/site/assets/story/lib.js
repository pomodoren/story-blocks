// Shared helpers for story block hydrators (window.STORY). Each block's own file
// (static/story/blocks/<type>.js) registers window.STORY_BLOCKS[type] = (el, config, ctx)
// and builds its map / chart inside `el` using these. Self-contained: no dashboard scripts needed.

window.STORY = (function () {
  const EXPORT = window.STORY_EXPORT || null;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = v => Number(v || 0).toLocaleString();
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function api(path) {
    if (EXPORT) {
      if (!(path in EXPORT.responses)) { console.warn('export: no frozen response for', path); return null; }
      return EXPORT.responses[path];
    }
    try { const r = await fetch(path); return r.ok ? r.json() : null; } catch { return null; }
  }

  // The basemap is a reader setting (Settings > Map), shared by every map on the page and kept in
  // localStorage. OpenStreetMap is the default. tile.openstreetmap.org refuses hotlinking without a
  // Referer (it answers 403 on file:// and some static hosts); the Esri entries are the keyless
  // fallback there. A MapTiler key -- STORYBLOCKS_MAPTILER_KEY at serve / export time -- switches
  // Streets and Satellite to MapTiler. CARTO's free tiles now return an "API KEY REQUIRED" tile.
  const keyMeta = document.querySelector('meta[name="maptiler-key"]');
  const MT_KEY = keyMeta ? keyMeta.content : '';
  const esri = layer => [`https://server.arcgisonline.com/ArcGIS/rest/services/${layer}/MapServer/tile/{z}/{y}/{x}`];
  const ESRI_ATTR = 'Tiles &copy; Esri';
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const MT_ATTR = '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> ' + OSM_ATTR;
  // Country outlines from a file shipped beside this script -- no tile server. It is the
  // `basemap: 'offline'` map, a Settings choice, and the automatic fallback when OSM refuses a tile.
  const ASSETS = document.currentScript.src.replace(/[^/]*$/, '');
  const OFFLINE_SOURCES = { world: { type: 'geojson', data: ASSETS + 'world-borders.geojson', attribution: '<a href="https://www.naturalearthdata.com">Natural Earth</a>' } };
  const OFFLINE_LAYERS = [
    { id: 'offline-sea', type: 'background', paint: { 'background-color': '#dde6ec' } },
    { id: 'offline-land', type: 'fill', source: 'world', paint: { 'fill-color': '#f3f0e8' } },
    { id: 'offline-borders', type: 'line', source: 'world', paint: { 'line-color': '#b4afa3', 'line-width': .7 } },
  ];
  const BASEMAPS = [
    { id: 'osm', label: 'OpenStreetMap', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: OSM_ATTR },
    { id: 'ofm', label: 'OpenFreeMap' },
    MT_KEY
      ? { id: 'streets', label: 'Streets', tiles: [`https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MT_KEY}`], attribution: MT_ATTR }
      : { id: 'streets', label: 'Streets', tiles: esri('World_Street_Map'), attribution: ESRI_ATTR },
    { id: 'light', label: 'Light', tiles: esri('Canvas/World_Light_Gray_Base'), attribution: ESRI_ATTR },
    MT_KEY
      ? { id: 'sat', label: 'Satellite', tiles: [`https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=${MT_KEY}`], attribution: MT_ATTR }
      : { id: 'sat', label: 'Satellite', tiles: esri('World_Imagery'), attribution: ESRI_ATTR },
    { id: 'offline', label: 'Offline (country outlines)' },
  ];

  // OpenFreeMap serves OpenStreetMap data as vector tiles with no key and no Referer rule. Its
  // style is fetched once, and only when a map first shows it, then added under the story's own
  // layers with an `ofm-` prefix so it toggles like any other basemap. The icon sprite is dropped
  // (its URL is content-hashed): roads, water, buildings and place labels remain.
  const OFM_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
  const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
  const OFM = 'ofm-';
  let ofmStyle = null;
  let ofmLayerIds = [];
  const loadOfmStyle = () => ofmStyle || (ofmStyle = fetch(OFM_STYLE_URL).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(style => {
    // Liberty's own extrusion would sit coplanar with the `buildings` layer and z-fight with it.
    style.layers = style.layers.filter(l => l.type !== 'fill-extrusion');
    ofmLayerIds = style.layers.map(l => OFM + l.id);
    return style;
  }).catch(err => { ofmStyle = null; throw err; }));
  function addOfm(map) {
    return loadOfmStyle().then(style => {
      Object.entries(style.sources).forEach(([id, src]) => map.getSource(OFM + id) || map.addSource(OFM + id, src));
      const below = OFFLINE_LAYERS[0].id;
      style.layers.forEach(l => {
        if (map.getLayer(OFM + l.id)) return;
        const { 'icon-image': _icon, ...layout } = l.layout || {};
        map.addLayer({ ...l, id: OFM + l.id, source: OFM + l.source, layout: { ...layout, visibility: 'none' } }, below);
      });
    });
  }
  const layerIds = b => (b.id === 'ofm' ? ofmLayerIds : b.tiles ? [b.id] : OFFLINE_LAYERS.map(l => l.id));
  const BASEMAP_KEY = 'oxm-story-basemap';
  const readBasemap = () => {
    try { const id = localStorage.getItem(BASEMAP_KEY); return BASEMAPS.some(b => b.id === id) ? id : BASEMAPS[0].id; } catch { return BASEMAPS[0].id; }
  };
  let basemapId = readBasemap();
  const maps = new Set();
  const loadedMaps = new WeakSet();
  // Every basemap lives in each map's style from the start (hidden), so switching never drops the
  // story's own layers: `showBasemap` just flips which one is visible.
  const baseStyle = active => ({
    version: 8,
    glyphs: OFM_GLYPHS,
    sources: {
      ...OFFLINE_SOURCES,
      ...Object.fromEntries(BASEMAPS.filter(b => b.tiles).map(b => [b.id, { type: 'raster', tiles: b.tiles, tileSize: 256, attribution: b.attribution }])),
    },
    layers: [
      ...OFFLINE_LAYERS.map(l => ({ ...l, layout: { visibility: active === 'offline' ? 'visible' : 'none' } })),
      ...BASEMAPS.filter(b => b.tiles).map(b => ({ id: b.id, type: 'raster', source: b.id, layout: { visibility: b.id === active ? 'visible' : 'none' } })),
    ],
  });
  function showBasemap(map, id) {
    if (id === 'ofm' && !map.getLayer(ofmLayerIds[0])) {
      const ready = () => addOfm(map).then(() => showBasemap(map, id), err => {
        console.warn('OpenFreeMap unavailable (' + err.message + '); showing offline outlines.');
        showBasemap(map, 'offline');
      });
      // isStyleLoaded() turns false again whenever tiles are pending, and 'load' fires only once
      if (loadedMaps.has(map)) ready(); else map.once('load', ready);
      return;
    }
    BASEMAPS.forEach(b => layerIds(b).forEach(l => map.getLayer(l) && map.setLayoutProperty(l, 'visibility', b.id === id ? 'visible' : 'none')));
  }
  function setBasemap(id) {
    if (!BASEMAPS.some(b => b.id === id)) return;
    basemapId = id;
    try { localStorage.setItem(BASEMAP_KEY, id); } catch { /* private mode */ }
    maps.forEach(m => showBasemap(m, id));
  }

  // OSM answers 403 to pages without a Referer (file://, some static hosts), and that reply often
  // carries no CORS headers, so the browser reports a bare network error with no status. After a
  // few failed OSM tiles this map drops to OpenFreeMap (and from there to the offline outlines);
  // the reader's saved choice is left alone.
  const OSM_FAILURES = 3;
  function fallBackWhenRefused(map) {
    let failed = 0;
    map.on('error', e => {
      if (failed >= OSM_FAILURES || basemapId !== 'osm' || e.sourceId !== 'osm') return;
      if (++failed < OSM_FAILURES) return;
      console.warn('OpenStreetMap tiles unavailable; showing OpenFreeMap. Pick another map in Settings.');
      showBasemap(map, 'ofm');
    });
  }

  // 3D: `pitch` / `bearing` tilt and turn the camera; `terrain` drapes the map over real elevation
  // (keyless Terrarium tiles on AWS; true or a vertical exaggeration); `buildings` extrudes
  // OpenStreetMap buildings from OpenFreeMap's vector tiles once zoomed in. Both sit beneath the
  // story's own layers because they are added before the block adds any.
  const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const DEM_ATTR = 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS Terrain Tiles</a>';
  const OFM_TILES = 'https://tiles.openfreemap.org/planet';
  const OFM_ATTR = '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  function enable3d(map, { terrain, buildings }) {
    map.once('load', () => {
      if (terrain) {
        map.addSource('sb-dem', { type: 'raster-dem', tiles: [DEM_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 15, attribution: DEM_ATTR });
        map.setTerrain({ source: 'sb-dem', exaggeration: terrain === true ? 1.5 : terrain });
      }
      if (buildings) {
        if (!map.getSource(OFM + 'openmaptiles')) map.addSource(OFM + 'openmaptiles', { type: 'vector', url: OFM_TILES, attribution: OFM_ATTR });
        map.addLayer({
          id: 'sb-buildings', type: 'fill-extrusion', source: OFM + 'openmaptiles', 'source-layer': 'building', minzoom: 14,
          paint: {
            'fill-extrusion-color': '#d9d4c8', 'fill-extrusion-opacity': .85,
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          },
        });
      }
    });
  }
  // The 3D keys a block's config carries, ready to spread into `makeMap` options.
  const threeD = c => Object.fromEntries(['pitch', 'bearing', 'terrain', 'buildings'].filter(k => c[k] != null).map(k => [k, c[k]]));

  function makeMap(el, { basemap, terrain, buildings, ...opts } = {}) {
    const offline = basemap === 'offline';
    const is3d = !!(terrain || buildings || opts.pitch);
    const map = new maplibregl.Map({
      container: el, style: baseStyle(offline ? 'offline' : basemapId === 'ofm' ? null : basemapId), center: [10, 30], zoom: 2,
      preserveDrawingBuffer: true, maxPitch: 85, ...opts,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: is3d, visualizePitch: is3d }), 'bottom-right');
    map.once('load', () => loadedMaps.add(map));
    if (terrain || buildings) enable3d(map, { terrain, buildings });
    // the media column is sticky; keep the canvas sized as the block scrolls / stacks
    new ResizeObserver(() => map.resize()).observe(el);
    if (!offline) {
      maps.add(map);
      if (basemapId === 'ofm') showBasemap(map, 'ofm');
      map.once('remove', () => maps.delete(map));
      fallBackWhenRefused(map);
    }
    return map;
  }

  const cameraMs = ms => (REDUCED ? 0 : ms);
  // `base` px on every side, plus `extra` ({left}) where a card floats over the map
  const fitPadding = (base, extra) => (extra ? { top: base, right: base, bottom: base, left: base + (extra.left || 0) } : base);
  const tileURL = (fn, iso3) =>
    `${location.origin}/tiles/${fn}/{z}/{x}/{y}/tile.pbf?iso3=${encodeURIComponent(iso3)}`;

  function bbox(coords) {
    const v = coords.filter(c => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (!v.length) return null;
    const lon = v.map(c => c[0]), lat = v.map(c => c[1]);
    return [[Math.min(...lon), Math.min(...lat)], [Math.max(...lon), Math.max(...lat)]];
  }

  function fitCountry(map, iso3) {
    return api(`/api/bounds/${iso3}`).then(b => {
      if (b) map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: 44, duration: cameraMs(900) });
      return b;
    });
  }

  function popup(map, layer, template) {
    const onClick = e => {
      const f = e.features && e.features[0];
      if (!f) return;
      const html = String(template).replace(/\{(\w+)\}/g, (_, k) => {
        const v = f.properties ? f.properties[k] : undefined;
        return esc(v == null || v === '' ? '—' : v);
      });
      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    map.on('click', layer, onClick);
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  }

  const slot = (block, role) => block.querySelector(`[data-role="${role}"]`);

  function prose(block, html) {
    const el = slot(block, 'prose');
    if (el) { el.innerHTML = `<p>${html}</p>`; el.hidden = false; }
  }
  function legend(block, html) {
    const el = slot(block, 'legend');
    if (el) { el.innerHTML = html || ''; el.hidden = !html; }
  }
  function controls(block) {
    const el = slot(block, 'controls');
    if (el) el.hidden = false;
    return el;
  }
  // A row of chips in the block's controls slot; `onPick(index)` fires on a click. For switching
  // between authored variants / metrics (map `color_by` lists, ranking `metrics`, chart `variants`).
  function pills(block, labels, onPick, start = 0) {
    const el = labels.length > 1 ? controls(block) : null;
    if (!el) return null;
    el.innerHTML = `<div class="sb-chips" role="group">${labels.map((l, i) =>
      `<button type="button" class="sb-chip${i === start ? ' is-active' : ''}" aria-pressed="${i === start}" data-i="${i}">${esc(l)}</button>`).join('')}</div>`;
    el.addEventListener('click', e => {
      const chip = e.target.closest('.sb-chip');
      if (!chip) return;
      el.querySelectorAll('.sb-chip').forEach(c => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-pressed', c === chip); });
      onPick(Number(chip.dataset.i));
    });
    return el;
  }
  function chart(block, spec) {
    const host = slot(block, 'chart');
    if (!host) return null;
    let canvas = host.querySelector('canvas');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.height = 200; host.appendChild(canvas); }
    host.__chart?.destroy();
    host.__chart = new Chart(canvas, spec);
    return host.__chart;
  }

  function fmtCurrency(value, currency) {
    if (value == null) return 'unknown';
    const amount = fmtNum(Math.round(value));
    return currency && currency !== 'unspecified' ? `${amount} ${currency}` : amount;
  }

  // the active theme's accent, for chart series that read as "brand" rather than semantic
  function accent() {
    const v = getComputedStyle(document.getElementById('story')).getPropertyValue('--s-accent').trim();
    return v || '#0b8a73';
  }

  const _scenario = {};
  const scenario = slug => slug ? (_scenario[slug] ??= api(`/api/catalog/${slug}`)) : Promise.resolve(null);
  const _loss = {};
  const loss = (slug, mw) =>
    (_loss[`${slug}:${mw}`] ??= api(`/api/catalog/${slug}/loss.geojson?magnitude=${encodeURIComponent(mw)}`)
      .then(d => d || { available: false }));
  const pickMag = s => (s?.magnitudes || [])[Math.floor(((s?.magnitudes || []).length - 1) / 2)] || null;

  // Resolves once the map's style is ready enough to add sources/layers. Keyed on
  // `isStyleLoaded()` (permanently true once the style is up) rather than `loaded()` (goes
  // false again during every camera animation / source fetch), so calling this on a map
  // that has been alive a while -- e.g. the immersive shared map switching views -- never
  // hangs waiting for a `load` event that already fired.
  const mapLoaded = map => {
    if (map.isStyleLoaded()) return Promise.resolve();
    return new Promise(res => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        map.off('styledata', poll);
        map.off('load', finish);
        map.off('idle', finish);
        clearInterval(iv);
        res();
      };
      const poll = () => { if (map.isStyleLoaded()) finish(); };
      map.on('styledata', poll);
      map.on('load', finish);
      map.on('idle', finish);
      const iv = setInterval(poll, 200);   // belt-and-braces: never wait on an event that won't come
      setTimeout(finish, 8000);            // last resort so a caller can't hang forever
    });
  };

  // Reusable map bases for the `guided-tour` block: add the layers + a base camera + legend,
  // and hand back the pieces the tour needs to fly step to step. Each returns null when the
  // story is not bound to the data it needs.
  const mapViews = {
    async exposure(map, ctx) {
      if (!ctx.iso3) return null;
      const bounds = await api(`/api/bounds/${ctx.iso3}`);
      await mapLoaded(map);
      if (!EXPORT) {
        map.addSource('gt-ent', { type: 'vector', tiles: [tileURL('oxm_viewer_entities_tiles', ctx.iso3)] });
        map.addLayer({ id: 'gt-ent', type: 'fill', source: 'gt-ent', 'source-layer': 'default',
          paint: { 'fill-color': '#ed8a1c', 'fill-opacity': .55 } });
        popup(map, 'gt-ent', 'Entity {id}');
      }
      const overview = bounds && [[bounds.west, bounds.south], [bounds.east, bounds.north]];
      return {
        legendHTML: '<h4>Exposure</h4><div class="legend-row"><span class="swatch" style="background:#ed8a1c"></span>Modelled entities</div>',
        fit: extra => overview && map.fitBounds(overview, { padding: fitPadding(50, extra), duration: cameraMs(1000) }),
        resolve: focus => (focus && focus.center ? { center: focus.center, zoom: focus.zoom || 15, pitch: focus.pitch } : null),
      };
    },
    async risk(map, ctx) {
      const s = await scenario(ctx.scenario);
      const chosen = pickMag(s);
      if (!chosen || !chosen.has_loss_layer) return null;
      const data = await loss(ctx.scenario, chosen.mw);
      if (!data.available) return null;

      const maxLoss = Math.max(1, ...data.features.map(f => f.properties.loss_value));
      const sorted = [...data.features].sort((a, b) => b.properties.loss_value - a.properties.loss_value);
      const overview = bbox(data.features.map(f => f.geometry.coordinates));
      await mapLoaded(map);
      map.addSource('gt-loss', { type: 'geojson', data });
      map.addLayer({ id: 'gt-loss', type: 'circle', source: 'gt-loss', paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'loss_value'], 0, 2, maxLoss, 12],
        'circle-opacity': .82,
        'circle-color': ['interpolate', ['linear'], ['get', 'loss_value'], 0, '#e6b91e', maxLoss, '#c81d25'],
      } });
      popup(map, 'gt-loss', '<strong>Entity {entity_id}</strong><br>{loss_value} loss');

      const at = focus => (focus && focus.worst != null ? sorted[focus.worst] : null);
      return {
        currency: chosen.currency,
        magnitude: chosen.mw,
        legendHTML: `<h4>Estimated structural loss</h4>
          <div class="legend-gradient" style="background:linear-gradient(90deg,#e6b91e,#c81d25)"></div>
          <div class="legend-range"><span>0</span><span>${fmtCurrency(maxLoss, chosen.currency)}</span></div>`,
        fit: extra => overview && map.fitBounds(overview, { padding: fitPadding(60, extra), duration: cameraMs(1000) }),
        resolve: focus => {
          const f = at(focus);
          if (f) return { center: f.geometry.coordinates, zoom: (focus && focus.zoom) || 16 };
          if (focus && focus.center) return { center: focus.center, zoom: focus.zoom || 15 };
          return null;
        },
        feature: at,
      };
    },
    // Entities coloured by construction period -- what the `taxonomy-map` block shows.
    async taxonomy(map, ctx) {
      if (!ctx.iso3) return null;
      const data = await api(`/api/entities/dates?iso3=${encodeURIComponent(ctx.iso3)}`);
      if (!data || !data.buckets || !data.buckets.length) return null;
      const maxIndex = Math.max(1, data.buckets.length - 1);
      const overview = bbox(data.features.map(f => f.geometry.coordinates));
      await mapLoaded(map);
      map.addSource('gt-dates', { type: 'geojson', data: { type: 'FeatureCollection', features: data.features } });
      map.addLayer({ id: 'gt-dates', type: 'circle', source: 'gt-dates', paint: {
        'circle-radius': 4, 'circle-opacity': .8,
        'circle-color': ['interpolate', ['linear'], ['get', 'bucket_index'], 0, '#2374ab', maxIndex, '#c81d25'],
      } });
      popup(map, 'gt-dates', 'Built {bucket}');
      const oldest = data.buckets[0].label, newest = data.buckets[data.buckets.length - 1].label;
      return {
        legendHTML: `<h4>Construction date</h4>
          <div class="legend-gradient" style="background:linear-gradient(90deg,#2374ab,#c81d25)"></div>
          <div class="legend-range"><span>${esc(oldest)}</span><span>${esc(newest)}</span></div>`,
        fit: extra => overview && map.fitBounds(overview, { padding: fitPadding(55, extra), duration: cameraMs(1000) }),
        resolve: focus => (focus && focus.center ? { center: focus.center, zoom: focus.zoom || 15 } : null),
      };
    },
    // Synthetic ground-motion (PGA) grid -- what the `hazard` block shows.
    async hazard(map, ctx) {
      const s = await scenario(ctx.scenario);
      if (!s) return null;
      const chosen = pickMag(s);
      const points = (s.ground_motion[chosen && chosen.mw] || []).filter(p => p.lon != null && p.lat != null);
      if (!points.length) return null;
      const pga = points.map(p => p.PGA).filter(v => v != null);
      const lo = Math.min(...pga), hi = Math.max(...pga, lo + 1e-6);
      const overview = bbox(points.map(p => [p.lon, p.lat]));
      await mapLoaded(map);
      map.addSource('gt-pga', { type: 'geojson', data: { type: 'FeatureCollection',
        features: points.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: p })) } });
      map.addLayer({ id: 'gt-pga', type: 'circle', source: 'gt-pga', paint: {
        'circle-radius': 7, 'circle-opacity': .85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff',
        'circle-color': ['interpolate', ['linear'], ['coalesce', ['get', 'PGA'], lo], lo, '#2374ab', (lo + hi) / 2, '#e6b91e', hi, '#c81d25'],
      } });
      popup(map, 'gt-pga', 'PGA {PGA} g');
      let marker = null;
      if (s.epicenter && s.epicenter.lon != null) {
        marker = new maplibregl.Marker({ color: '#17212b' }).setLngLat([s.epicenter.lon, s.epicenter.lat]).addTo(map);
      }
      return {
        legendHTML: `<h4>Peak ground acceleration</h4>
          <div class="legend-gradient" style="background:linear-gradient(90deg,#2374ab,#e6b91e,#c81d25)"></div>
          <div class="legend-range"><span>${lo.toFixed(2)} g</span><span>${hi.toFixed(2)} g</span></div>`,
        fit: extra => overview && map.fitBounds(overview, { padding: fitPadding(50, extra), duration: cameraMs(1000) }),
        resolve: focus => (focus && focus.center ? { center: focus.center, zoom: focus.zoom || 13 } : null),
        cleanup: () => marker && marker.remove(),
      };
    },
  };

  // Animate a stat number from 0 to its rendered value (countUp.js, loaded in story.html).
  // "$4.2M", "12.5%", "1,234 entities" and "Mw 7" keep their prefix / suffix; replayable (the
  // original text is remembered in data-raw); a no-op when the lib is absent, the text has no
  // number in it, or reduced motion is asked for.
  const NUMBER = /^(\D*?)(-?\d[\d,]*(?:\.\d+)?)([\s\S]*)$/;
  function countUp(el, options = {}) {
    const raw = (el.dataset.raw ??= (el.textContent || '').trim());
    el.textContent = raw;
    const m = raw.match(NUMBER);
    const CountUp = window.countUp && window.countUp.CountUp;
    if (!CountUp || !m || REDUCED) return;
    const digits = m[2];
    const cu = new CountUp(el, parseFloat(digits.replace(/,/g, '')), {
      startVal: 0, duration: 1.5,
      separator: digits.includes(',') ? ',' : '',
      decimalPlaces: (digits.split('.')[1] || '').length,
      prefix: m[1], suffix: m[3],
      ...options,
    });
    if (!cu.error) cu.start();
  }

  // Scroll-driven steps (guided-tour / photo-scenes): call `onActive(index)` for the step whose
  // box crosses the middle band of the viewport. One observer, one rule, for every step block.
  function watchSteps(stepEls, onActive, band = '-42% 0px -42% 0px') {
    const io = new IntersectionObserver(entries => {
      const front = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (front) onActive(stepEls.indexOf(front.target));
    }, { rootMargin: band, threshold: [0, 0.5, 1] });
    stepEls.forEach(el => io.observe(el));
    return io;
  }

  // ---- data-driven colour + filters (map `color_by` / `filter`) ---------------------------
  // Generic: they read the properties of authored GeoJSON and know nothing about any
  // particular host's data.
  const RAMPS = {
    teal: ['#e3f4f0', '#0b6b5c'], warm: ['#fff1d6', '#b42318'], blue: ['#e6effb', '#1b4a9c'],
    diverging: ['#2a7de1', '#f3f1ea', '#c2410c'],
  };
  const QUALITATIVE = ['#2a7de1', '#e8590c', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#c92a2a', '#5c7cfa'];
  const NO_DATA = '#cfd6dd';
  const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  // `n` colours along a named ramp or an explicit list of hex colours (a list of exactly n is used as is)
  function rampColors(ramp, n) {
    if (Array.isArray(ramp) && ramp.length === n) return ramp.slice();
    const stops = (Array.isArray(ramp) ? ramp : RAMPS[ramp] || RAMPS.teal).map(rgb);
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : i / (n - 1) * (stops.length - 1);
      const k = Math.min(Math.floor(t), stops.length - 2), f = t - k;
      return hex(stops[k].map((c, j) => c + (stops[k + 1][j] - c) * f));
    });
  }
  const isBlank = v => v == null || v === '';
  const isNum = v => !isBlank(v) && Number.isFinite(Number(v));
  const short = v => Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? +(v / 1e3).toFixed(1) + 'k' : +(+v).toFixed(2) + '';
  // spec: {property, classes, breaks, ramp, categories, unit}. Numbers are classed by `breaks`
  // (or quantiles of `values`); anything non-numeric, or an explicit `categories` map, is categorical.
  function makeScale(values, spec) {
    const unit = spec.unit ? ' ' + spec.unit : '';
    if (spec.categories || values.some(v => !isBlank(v) && !isNum(v))) {
      const cats = spec.categories || Object.fromEntries([...new Set(values.filter(v => !isBlank(v)))].sort()
        .map((v, i) => [v, QUALITATIVE[i % QUALITATIVE.length]]));
      return { kind: 'categories', color: v => cats[v] || null, items: Object.entries(cats).map(([label, color]) => ({ label, color })) };
    }
    let breaks = spec.breaks ? spec.breaks.map(Number) : null;
    if (!breaks) {
      const sorted = values.filter(isNum).map(Number).sort((a, b) => a - b), k = spec.classes || 5;
      breaks = [...new Set(Array.from({ length: k - 1 }, (_, i) => sorted[Math.floor((i + 1) / k * sorted.length)]).filter(v => v != null))];
    }
    const colors = rampColors(spec.ramp || 'teal', breaks.length + 1);
    const klass = v => breaks.filter(b => Number(v) >= b).length;
    const items = colors.map((color, i) => ({
      color,
      label: !breaks.length ? 'all values' : i === 0 ? `< ${short(breaks[0])}${unit}` : i === breaks.length ? `≥ ${short(breaks[i - 1])}${unit}` : `${short(breaks[i - 1])} – ${short(breaks[i])}${unit}`,
    }));
    return { kind: 'steps', breaks, color: v => (isNum(v) ? colors[klass(v)] : null), items };
  }
  // "pop >= 1000 and kind == 'school' and name ~ bridge" -> props => bool. Terms are ANDed;
  // ==, != compare as numbers when both are numeric; > >= < <= need numbers; ~ is a case-insensitive "contains".
  const FILTER_TERM = /^\s*([A-Za-z_][\w .-]*?)\s*(==|!=|>=|<=|>|<|~)\s*(.+?)\s*$/;
  function parseFilter(expr) {
    const terms = String(expr).split(/\s+and\s+/i).map(t => {
      const m = t.match(FILTER_TERM);
      if (!m) throw new Error(`filter: cannot read "${t}" (use: property op value)`);
      let v = m[3];
      if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1); else if (isNum(v)) v = Number(v);
      return { k: m[1], op: m[2], v };
    });
    const test = props => terms.every(({ k, op, v }) => {
      const x = props ? props[k] : undefined;
      if (op === '~') return String(x ?? '').toLowerCase().includes(String(v).toLowerCase());
      if (op === '==' || op === '!=') { const eq = isNum(x) && isNum(v) ? Number(x) === Number(v) : String(x) === String(v); return op === '==' ? eq : !eq; }
      if (!isNum(x) || !isNum(v)) return false;
      const a = Number(x), b = Number(v);
      return op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : a <= b;
    });
    test.keys = terms.map(t => t.k);   // the properties it reads (a tour dims only features that carry one)
    return test;
  }

  // ---- exposure-style point layers (map + guided-tour) ---------------------------------------
  // `size_by: {property, min, max, color, label, unit}` -> proportional symbols (area ~ value).
  // `heatmap: {weight, radius, intensity, opacity, ramp, points}` -> a density surface.
  const pointValues = (features, prop) => features
    .filter(f => f.geometry && /Point/.test(f.geometry.type))
    .map(f => Number((f.properties || {})[prop])).filter(Number.isFinite);
  function sizeScale(features, spec) {
    const top = Math.max(1e-9, ...pointValues(features, spec.property));
    const lo = spec.min ?? 4, hi = spec.max ?? 24;
    const radius = ['interpolate', ['linear'], ['sqrt', ['max', 0, ['to-number', ['get', spec.property], 0]]], 0, lo, Math.sqrt(top), hi];
    const at = v => lo + (hi - lo) * Math.sqrt(v / top);
    const unit = spec.unit ? ' ' + spec.unit : '';
    const col = esc(spec.color || '#e01e26');
    const legend = () => `<h4>${esc(spec.label || spec.property)}</h4>` + [top, top / 4, top / 16].map(v =>
      `<div class="legend-row"><span class="swatch" style="width:${2 * at(v)}px;height:${2 * at(v)}px;border-radius:50%;background:${col}55;border-color:${col}"></span>${esc(fmtNum(+v.toPrecision(2)))}${esc(unit)}</div>`).join('');
    return { radius, legend };
  }
  function heatPaint(features, spec) {
    const top = Math.max(1e-9, ...(spec.weight ? pointValues(features, spec.weight) : [1]));
    const ramp = rampColors(spec.ramp || 'warm', 5);
    return {
      'heatmap-weight': spec.weight ? ['interpolate', ['linear'], ['to-number', ['get', spec.weight], 0], 0, 0, top, 1] : 1,
      'heatmap-radius': spec.radius ?? 28, 'heatmap-intensity': spec.intensity ?? 1, 'heatmap-opacity': spec.opacity ?? .85,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', ...ramp.flatMap((c, i) => [(i + 1) / 5, c])],
    };
  }
  const heatLegend = spec => `<h4>${esc(spec.label || (spec.weight ? spec.weight + ' density' : 'Density'))}</h4>`
    + `<div class="legend-row"><span class="swatch" style="width:80px;background:linear-gradient(90deg,${rampColors(spec.ramp || 'warm', 5).join(',')})"></span>low → high</div>`;

  // ---- authored map rendering (map block, and each swipe divider-mode map panel) -------------
  // `webmap: <item id | item URL>` -- import a *public* ArcGIS web map: its operational layers
  // become `layers` entries (FeatureLayer -> arcgis-feature, tiled / map service -> arcgis-tiles,
  // WebTiledLayer -> raster, WMS -> wms) and the item's extent frames the map. Layer types that
  // can't be drawn (vector tiles, CSV, inline feature collections, ...) are skipped, and the
  // caller lists them in a note beneath the map.
  async function importWebMap(ref) {
    const id = String(ref).match(/[0-9a-f]{32}/)[0];
    const origin = /^https:\/\/[^/]+/.test(ref) ? ref.match(/^https:\/\/[^/]+/)[0] : 'https://www.arcgis.com';
    const base = `${origin}/sharing/rest/content/items/${id}`;
    const get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
    const [data, info] = await Promise.all([get(`${base}/data?f=json`), get(`${base}?f=json`)]);
    const layers = [];
    const skipped = [];
    ((data && data.operationalLayers) || []).forEach(l => {
      const common = { label: l.title || l.id || 'Layer', opacity: l.opacity, visible: l.visibility !== false };
      if (l.layerType === 'ArcGISFeatureLayer' && l.url) layers.push({ ...common, kind: 'arcgis-feature', url: l.url });
      else if (['ArcGISTiledMapServiceLayer', 'ArcGISMapServiceLayer'].includes(l.layerType) && l.url) layers.push({ ...common, kind: 'arcgis-tiles', url: l.url });
      else if (l.layerType === 'WebTiledLayer' && l.templateUrl) {
        const sub = (l.subDomains || ['a'])[0];
        layers.push({ ...common, kind: 'raster', tiles: [l.templateUrl.replace('{level}', '{z}').replace('{col}', '{x}').replace('{row}', '{y}').replace('{subDomain}', sub)], attribution: l.copyright || '' });
      } else if (l.layerType === 'WMS' && l.url) layers.push({ ...common, kind: 'wms', url: l.url, wms_layers: (l.visibleLayers || (l.layers || []).map(x => x.name)).join(',') });
      else {
        skipped.push(`${common.label} (${l.layerType || 'unknown type'})`);
        console.warn('webmap: skipped layer', common.label, l.layerType);
      }
    });
    const e = info && info.extent;
    const extent = Array.isArray(e) && e.length === 2 ? e : null;
    if (!layers.length) console.warn('webmap: no drawable layers (is the item public?)', id);
    return { layers, extent, skipped };
  }

  // Draws an authored map's content (GeoJSON + markers + hosted layers) into a *loaded* `map`
  // mounted on `host`, and fits the camera unless `config.center` is fixed. Shared by the `map`
  // block and each `swipe` divider-mode map panel. Returns the pieces the caller renders into its
  // own legend / controls slots: `legendRows()`, `pins` ({m, dot}), `groups`, and `setCur` / a
  // fresh `colored()` snapshot for switching between several `color_by` metrics.
  async function paintMap(host, map, config) {
    const urls = [].concat(config.geojson || []);
    const fetched = await Promise.all(urls.map(u => fetch(u).then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }))));
    const features = fetched.flatMap(c => c.features || []);
    // `filter` hides features; `color_by` classes the *whole* set first so a filter never shifts the colours.
    let shown = features;
    if (config.filter) {
      try { const keep = parseFilter(config.filter); shown = features.filter(f => keep(f.properties)); }
      catch (e) { console.warn('map', e.message); }
    }
    const specs = [].concat(config.color_by || []).map(c => (typeof c === 'string' ? { property: c } : c));
    const scales = features.length ? specs.map(sp => makeScale(features.map(f => (f.properties || {})[sp.property]), sp)) : [];
    let cur = 0;
    const scale = () => scales[cur], spec = () => specs[cur];
    const colored = () => (scales.length
      ? shown.map(f => ({ ...f, properties: { ...f.properties, color: scale().color((f.properties || {})[spec().property]) || NO_DATA } }))
      : shown);
    const size = config.size_by && shown.length ? sizeScale(shown, config.size_by) : null;
    const canHover = matchMedia('(hover: hover)').matches;
    const markers = (config.markers || []).filter(m => Array.isArray(m.center));
    await mapLoaded(map);

    const pop = (lngLat, html) => new maplibregl.Popup({ offset: 12 }).setLngLat(lngLat).setHTML(html).addTo(map);
    const sizeRow = p => (config.size_by && p[config.size_by.property] != null
      ? `<br>${esc(config.size_by.label || config.size_by.property)}: <strong>${esc(fmtNum(p[config.size_by.property]))}${config.size_by.unit ? ' ' + esc(config.size_by.unit) : ''}</strong>` : '');
    const card = p => `<strong>${esc(p.name || p.title || '')}</strong>${p.text ? `<br>${esc(p.text)}` : ''}${sizeRow(p)}`
      + (scales.length && p[spec().property] != null ? `<br>${esc(spec().label || spec().property)}: <strong>${esc(isNum(p[spec().property]) ? fmtNum(p[spec().property]) : p[spec().property])}${spec().unit ? ' ' + esc(spec().unit) : ''}</strong>` : '');

    if (shown.length) {
      map.addSource('geo', { type: 'geojson', data: { type: 'FeatureCollection', features: colored() } });
      const color = fallback => ['coalesce', ['get', 'color'], fallback];
      map.addLayer({ id: 'geo-fill', type: 'fill', source: 'geo', filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': color('#37b6c9'), 'fill-opacity': scales.length ? .78 : .22, 'fill-outline-color': scales.length ? '#ffffff' : color('#37b6c9') } });
      map.addLayer({ id: 'geo-line', type: 'line', source: 'geo', filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': color('#e01e26'), 'line-width': 3, 'line-opacity': .85 } });
      if (config.heatmap) map.addLayer({ id: 'geo-heat', type: 'heatmap', source: 'geo', filter: ['==', ['geometry-type'], 'Point'], paint: heatPaint(shown, config.heatmap) });
      map.addLayer({ id: 'geo-pt', type: 'circle', source: 'geo', filter: ['==', ['geometry-type'], 'Point'],
        layout: config.heatmap && !config.heatmap.points ? { visibility: 'none' } : {},
        paint: { 'circle-radius': size ? size.radius : 7, 'circle-color': color(config.size_by?.color || '#e01e26'), 'circle-opacity': size ? .75 : 1,
          'circle-stroke-color': '#fff', 'circle-stroke-width': size ? 1 : 2 } });
      // a choropleth reads best on hover; touch screens (no hover) keep the tap popup
      const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      if (scales.length && canHover) {
        map.on('mousemove', 'geo-fill', e => e.features[0] && tip.setLngLat(e.lngLat).setHTML(card(e.features[0].properties)).addTo(map));
        map.on('mouseleave', 'geo-fill', () => tip.remove());
      }
      ['geo-fill', 'geo-line', 'geo-pt'].forEach(id => {
        if (!(scales.length && canHover && id === 'geo-fill')) map.on('click', id, e => e.features[0] && pop(e.lngLat, card(e.features[0].properties)));
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      });
    }
    // hosted / toggleable layers. Each `layers` item is one legend checkbox. `kind`:
    //   geojson (default)  `geojson` or `url`: a GeoJSON file, local or hosted (needs CORS)
    //   arcgis-feature     `url`: an ArcGIS FeatureServer layer (.../FeatureServer/0), queried as GeoJSON
    //   raster             `tiles`: an XYZ template like https://host/{z}/{x}/{y}.png (GeoServer gwc, etc.)
    //   arcgis-tiles       `url`: an ArcGIS MapServer with a tile cache (.../MapServer)
    //   wms                `url` + `wms_layers`: any WMS endpoint (GeoServer, MapServer, ArcGIS, ...)
    //   vector             `tiles` + `source_layer`: XYZ MVT/pbf tiles, e.g. pg_tileserv
    //                      (`/<schema>.<table>/{z}/{x}/{y}.pbf`), Martin or TileServer GL
    // optional on all: `color`, `opacity`, `attribution`, `visible: false` (starts hidden).
    const web = config.webmap ? await importWebMap(config.webmap) : { layers: [], extent: null, skipped: [] };
    const layerSpecs = [...web.layers, ...(config.layers || [])];
    const empty = { features: [] };
    const getJSON = u => fetch(u).then(r => r.ok ? r.json() : empty).catch(() => empty);
    const rasterTiles = l => {
      if (l.kind === 'arcgis-tiles') return [`${l.url.replace(/\/$/, '')}/tile/{z}/{y}/{x}`];
      if (l.kind === 'wms') {
        const q = `service=WMS&request=GetMap&version=1.1.1&layers=${encodeURIComponent(l.wms_layers || '')}&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}`;
        return [`${l.url}${l.url.includes('?') ? '&' : '?'}${q}`];
      }
      return [].concat(l.tiles || []);
    };
    const layerData = await Promise.all(layerSpecs.map(l => {
      if (l.kind === 'arcgis-feature') return getJSON(`${l.url.replace(/\/$/, '')}/query?where=1%3D1&outFields=*&outSR=4326&resultRecordCount=2000&f=geojson`);
      if (['raster', 'arcgis-tiles', 'wms', 'vector'].includes(l.kind)) return Promise.resolve(empty);
      return getJSON(l.geojson || l.url);
    }));
    const layerCoords = [];
    const layerIds = layerSpecs.map(() => []);
    layerSpecs.forEach((l, i) => {
      const id = `layer-${i}`, color = l.color || '#37b6c9';
      if (['raster', 'arcgis-tiles', 'wms'].includes(l.kind)) {
        map.addSource(id, { type: 'raster', tiles: rasterTiles(l), tileSize: 256, attribution: l.attribution || '' });
        map.addLayer({ id: `${id}-r`, type: 'raster', source: id, paint: { 'raster-opacity': l.opacity ?? .8 } });
        layerIds[i].push(`${id}-r`);
        return;
      }
      const srcLayer = l.kind === 'vector' ? { 'source-layer': l.source_layer } : {};
      if (l.kind === 'vector') {
        map.addSource(id, { type: 'vector', tiles: [].concat(l.tiles || []), attribution: l.attribution || '' });
      } else {
        map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: layerData[i].features || [] } });
      }
      map.addLayer({ id: `${id}-fill`, type: 'fill', source: id, ...srcLayer, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': l.opacity ?? .25, 'fill-outline-color': color } });
      map.addLayer({ id: `${id}-line`, type: 'line', source: id, ...srcLayer, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': color, 'line-width': 3 } });
      map.addLayer({ id: `${id}-pt`, type: 'circle', source: id, ...srcLayer, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 6, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      layerIds[i].push(`${id}-fill`, `${id}-line`, `${id}-pt`);
      layerIds[i].forEach(lid => map.on('click', lid, e => e.features[0] && pop(e.lngLat, card(e.features[0].properties))));
      if (l.kind === 'vector') return;
      const walk = v => Array.isArray(v[0]) ? v.forEach(walk) : layerCoords.push(v);
      (layerData[i].features || []).forEach(f => f.geometry && walk(f.geometry.coordinates));
    });
    // `groups` colour markers by their `group` and become toggle chips; `value` sizes the disc
    // (area ~ value, like the flamingo community map). Hidden groups drop their markers.
    const groups = config.groups || [];
    const groupColor = Object.fromEntries(groups.map(g => [g.label, g.color]));
    const pins = markers.map(m => {
      const dot = document.createElement('button');
      dot.type = 'button'; dot.className = 'sb-pin'; dot.setAttribute('aria-label', m.title || 'Marker');
      dot.style.setProperty('--pin', m.color || groupColor[m.group] || 'var(--s-accent)');
      if (Number.isFinite(Number(m.value))) {
        const d = 2 * Math.min(22, 7 + Math.sqrt(Math.max(0, Number(m.value))) * 3.4);
        dot.classList.add('sb-pin--sized'); dot.style.width = dot.style.height = `${d}px`;
      }
      dot.addEventListener('click', () => pop(m.center, card(m)));
      new maplibregl.Marker({ element: dot }).setLngLat(m.center).addTo(map);
      return { m, dot };
    });
    if (config.grayscale) host.classList.add('sb__map--gray');
    if (web.skipped.length) {
      const note = document.createElement('p');
      note.className = 'sb__map-note';
      note.setAttribute('role', 'status');
      note.textContent = `Not shown (unsupported layer type): ${web.skipped.join('; ')}`;
      host.insertAdjacentElement('afterend', note);
    }
    if (!config.center) {
      const coords = [];
      const walk = v => Array.isArray(v[0]) ? v.forEach(walk) : coords.push(v);
      shown.forEach(f => f.geometry && walk(f.geometry.coordinates));
      layerCoords.forEach(c => coords.push(c));
      markers.forEach(m => coords.push(m.center));
      const box = web.extent || bbox(coords);
      if (box) map.fitBounds(box, { padding: 56, maxZoom: 14, duration: 0 });
    }
    layerSpecs.forEach((l, i) => { if (l.visible === false) layerIds[i].forEach(lid => map.setLayoutProperty(lid, 'visibility', 'none')); });
    const hidden = layerSpecs.map(l => l.visible === false);
    const legendRows = () => {
      const rows = [];
      if (scales.length) {
        const sp = spec();
        rows.push(`<h4>${esc(sp.label || sp.property)}</h4>`, ...scale().items.map(i => `<div class="legend-row"><span class="swatch" style="background:${esc(i.color)}"></span>${esc(i.label)}</div>`));
        if (features.some(f => isBlank((f.properties || {})[sp.property]))) rows.push(`<div class="legend-row"><span class="swatch" style="background:${NO_DATA}"></span>no data</div>`);
      }
      if (size) rows.push(size.legend());
      if (config.heatmap) rows.push(heatLegend(config.heatmap));
      rows.push(...(config.legend || []).map(l => `<div class="legend-row"><span class="swatch" style="background:${esc(l.color)}"></span>${esc(l.label)}</div>`));
      layerSpecs.forEach((l, i) => rows.push(`<label class="legend-row"><input type="checkbox" data-layer="${i}"${hidden[i] ? '' : ' checked'}><span class="swatch" style="background:${esc(l.color || '#37b6c9')}"></span>${esc(l.label)}</label>`));
      return rows;
    };
    return { pins, groups, scales, specs, layerIds, hidden, colored, setCur: v => { cur = v; }, legendRows };
  }

  const pad2 = n => String(n).padStart(2, '0');

  // scrolling helper; story.js swaps in its Lenis-aware version once the page is up
  const api_ = {
    scrollTo: (el, block = 'center') =>
      el && el.scrollIntoView({ block, behavior: REDUCED ? 'auto' : 'smooth' }),
  };

  return {
    api, makeMap, threeD, BASEMAPS, setBasemap, getBasemap: () => basemapId, tileURL, cameraMs, bbox, fitCountry, popup, slot, prose, legend, controls,
    chart, fmtCurrency, scenario, loss, pickMag, accent, mapLoaded, mapViews, countUp,
    watchSteps, pad2, fitPadding, esc, fmtNum, REDUCED,
    makeScale, parseFilter, rampColors, sizeScale, heatPaint, heatLegend, NO_DATA, isNumeric: isNum, isBlank, pills,
    paintMap,
    get scrollTo() { return api_.scrollTo; }, set scrollTo(fn) { api_.scrollTo = fn; },
  };
})();
