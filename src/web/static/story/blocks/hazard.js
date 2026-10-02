// hazard -- a synthetic ground-motion (PGA) grid for the scenario's mid magnitude.
window.STORY_BLOCKS['hazard'] = async function (el, config, ctx) {
  const S = window.STORY;
  const scenario = await S.scenario(ctx.scenario);
  if (!scenario) { S.prose(el, `No hazard scenario is registered for ${S.esc(ctx.label)} yet.`); return; }

  const chosen = S.pickMag(scenario);
  const points = (scenario.ground_motion[chosen.mw] || []).filter(p => p.lon != null && p.lat != null);
  S.prose(el, `A synthetic <strong>Mw ${S.esc(chosen.mw)}</strong> scenario near the epicentre (${S.esc(scenario.epicenter.basis)}). Colour is peak ground acceleration; click a node for its value.`);

  const geojson = { type: 'FeatureCollection', features: points.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: p })) };
  const pga = points.map(p => p.PGA).filter(v => v != null);
  const lo = Math.min(...pga), hi = Math.max(...pga, lo + 1e-6);

  const map = S.makeMap(S.slot(el, 'map'));
  map.on('load', () => {
    map.addSource('pga', { type: 'geojson', data: geojson });
    map.addLayer({ id: 'pga', type: 'circle', source: 'pga', paint: {
      'circle-radius': 7, 'circle-opacity': .85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff',
      'circle-color': ['interpolate', ['linear'], ['coalesce', ['get', 'PGA'], lo], lo, '#2374ab', (lo + hi) / 2, '#e6b91e', hi, '#c81d25'],
    } });
    S.popup(map, 'pga', 'PGA {PGA} g');
    if (scenario.epicenter.lon != null) {
      new maplibregl.Marker({ color: '#17212b' }).setLngLat([scenario.epicenter.lon, scenario.epicenter.lat]).addTo(map);
    }
    const b = S.bbox(points.map(p => [p.lon, p.lat]));
    if (b) map.fitBounds(b, { padding: 50, duration: S.cameraMs(1000) });
  });

  if (config.legend) S.legend(el, `<h4>Peak ground acceleration</h4>
    <div class="legend-gradient" style="background:linear-gradient(90deg,#2374ab,#e6b91e,#c81d25)"></div>
    <div class="legend-range"><span>${lo.toFixed(2)} g</span><span>${hi.toFixed(2)} g</span></div>`);
};
