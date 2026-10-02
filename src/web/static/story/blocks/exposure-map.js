// exposure-map -- live building footprints + boundary for the story's country.
window.STORY_BLOCKS['exposure-map'] = async function (el, config, ctx) {
  const S = window.STORY;
  const mapEl = S.slot(el, 'map');
  if (!ctx.iso3) { S.prose(el, `${S.esc(ctx.label)} has no exposure data prepared yet.`); return; }

  const map = S.makeMap(mapEl, { pitch: 45, bearing: -14 });
  const EXPORT = window.STORY_EXPORT || null;

  map.on('load', async () => {
    if (!EXPORT) {
      map.addSource('boundaries', { type: 'vector', tiles: [S.tileURL('oxm_viewer_boundaries_tiles', ctx.iso3)] });
      map.addSource('entities', { type: 'vector', tiles: [S.tileURL('oxm_viewer_entities_tiles', ctx.iso3)] });
      map.addLayer({ id: 'boundary', type: 'line', source: 'boundaries', 'source-layer': 'default',
        paint: { 'line-color': '#087f6b', 'line-width': 2 } });
      map.addLayer({ id: 'entities', type: 'fill', source: 'entities', 'source-layer': 'default',
        paint: { 'fill-color': '#ed8a1c', 'fill-opacity': .55 } });
      map.addSource('buildings', { type: 'vector', tiles: [S.tileURL('oxm_viewer_buildings_3d_tiles', ctx.iso3)], promoteId: 'id', minzoom: 13 });
      map.addLayer({ id: 'buildings', type: 'fill-extrusion', source: 'buildings', 'source-layer': 'default', paint: {
        'fill-extrusion-color': '#ed8a1c',
        'fill-extrusion-height': ['case', ['has', 'extrusion_height'], ['max', ['to-number', ['get', 'extrusion_height']], 2], 6],
        'fill-extrusion-base': ['to-number', ['get', 'extrusion_base'], 0],
        'fill-extrusion-opacity': .85,
      } });
      S.popup(map, 'entities', config.popup || 'Entity {id}');
      S.popup(map, 'buildings', 'Building {id}<br>{extrusion_height} m tall');
    }

    const [countries, bounds] = await Promise.all([S.api('/api/countries'), S.api(`/api/bounds/${ctx.iso3}`)]);
    const row = (countries || []).find(r => r.iso3 === ctx.iso3);
    S.prose(el, row
      ? `<strong>${S.fmtNum(row.entities)}</strong> modeled entities across <strong>${S.fmtNum(row.assets)}</strong> asset types, live from PostGIS. Zoom in to see modelled building heights; click a footprint for its id.`
      : `No exposure data loaded for ${S.esc(ctx.iso3)} in this database yet.`);
    if (bounds) map.fitBounds([[bounds.west, bounds.south], [bounds.east, bounds.north]],
      { padding: 50, pitch: 45, bearing: -14, duration: S.cameraMs(1000) });
    if (config.legend) S.legend(el, `<h4>Exposure</h4>
      <div class="legend-row"><span class="swatch" style="background:#087f6b"></span>Boundary</div>
      <div class="legend-row"><span class="swatch" style="background:#ed8a1c"></span>Modelled entities</div>`);
  });
};
