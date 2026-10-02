// buildings-3d -- building footprints extruded to their height on a tilted MapLibre map.
//   geojson: [url, ...]     polygon features (Polygon / MultiPolygon)
//   height: <property>      metres (default "height");  height_scale: multiplier;  base: <property> floor
//   color: '#hex'           flat colour;  color_by: {property, classes, breaks, ramp, categories, label, unit}
//   orbit: true             slow camera turn until the reader touches the map (not under reduced motion)
//   pitch / bearing / terrain / basemap / legend
window.STORY_BLOCKS['buildings-3d'] = async function (el, config) {
  const S = window.STORY;
  const host = S.slot(el, 'map');
  if (!host) return;
  const map = S.makeMap(host, { basemap: config.basemap, ...S.threeD(config) });
  el.storyMap = map;

  const urls = [].concat(config.geojson || []);
  const fetched = await Promise.all(urls.map(u => fetch(u).then(r => {
    if (!r.ok) throw new Error(`GeoJSON ${u}: HTTP ${r.status}`);
    return r.json();
  })));
  const features = fetched.flatMap(c => c.features || []).filter(f => /Polygon/.test(f.geometry?.type));
  if (!features.length) { host.textContent = 'No building footprints to draw'; return; }

  const metric = config.color_by || null;
  const scale = metric && S.makeScale(features.map(f => (f.properties || {})[metric.property]), metric);
  const flat = config.color || '#d9d4c8';
  const data = {
    type: 'FeatureCollection',
    features: features.map(f => ({
      ...f,
      properties: { ...f.properties, color: (scale && scale.color((f.properties || {})[metric.property])) || (scale ? S.NO_DATA : flat) },
    })),
  };

  const coords = [];
  const walk = v => (Array.isArray(v[0]) ? v.forEach(walk) : coords.push(v));
  features.forEach(f => walk(f.geometry.coordinates));
  const box = S.bbox(coords);
  if (box && !config.center) map.fitBounds(box, { padding: 40, maxZoom: 17, duration: 0 });
  await S.mapLoaded(map);

  const metres = key => ['*', ['to-number', ['get', key], 0], config.height_scale ?? 1];
  map.addSource('b3d', { type: 'geojson', data });
  map.addLayer({
    id: 'b3d', type: 'fill-extrusion', source: 'b3d',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': metres(config.height || 'height'),
      'fill-extrusion-base': config.base ? metres(config.base) : 0,
      'fill-extrusion-opacity': .92,
    },
  });

  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
  const card = p => {
    const h = Number(p[config.height || 'height']);
    const m = metric && !S.isBlank(p[metric.property])
      ? `<br>${S.esc(metric.label || metric.property)}: <strong>${S.esc(S.isNumeric(p[metric.property]) ? S.fmtNum(p[metric.property]) : p[metric.property])}${metric.unit ? ' ' + S.esc(metric.unit) : ''}</strong>` : '';
    return `<strong>${S.esc(p.name || p.title || 'Building')}</strong>`
      + (Number.isFinite(h) ? `<br>Height: <strong>${S.esc(S.fmtNum(Math.round(h * 10) / 10))} m</strong>` : '') + m;
  };
  map.on('mousemove', 'b3d', e => {
    map.getCanvas().style.cursor = 'pointer';
    if (e.features[0]) tip.setLngLat(e.lngLat).setHTML(card(e.features[0].properties)).addTo(map);
  });
  map.on('mouseleave', 'b3d', () => { map.getCanvas().style.cursor = ''; tip.remove(); });

  if (config.legend && scale) {
    S.legend(el, `<h4>${S.esc(metric.label || metric.property)}</h4>`
      + scale.items.map(i => `<div class="legend-row"><span class="swatch" style="background:${S.esc(i.color)}"></span>${S.esc(i.label)}</div>`).join(''));
  }

  // orbit: one frame at a time, stopped by the reader's first touch and paused off-screen
  if (config.orbit && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let on = false, visible = true, last = 0;
    const frame = t => {
      if (!on) return;
      if (visible && last) map.setBearing(map.getBearing() + (t - last) * 0.006);
      last = t;
      requestAnimationFrame(frame);
    };
    const stop = () => { on = false; };
    ['mousedown', 'touchstart', 'wheel', 'keydown'].forEach(ev => host.addEventListener(ev, stop, { once: true, passive: true }));
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = 0; }).observe(host);
    on = true;
    requestAnimationFrame(frame);
  }
};
