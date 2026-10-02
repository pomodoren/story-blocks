// taxonomy-map -- entities coloured by construction period, with clickable period chips.
window.STORY_BLOCKS['taxonomy-map'] = async function (el, config, ctx) {
  const S = window.STORY;
  if (!ctx.iso3) { S.prose(el, `${S.esc(ctx.label)} has no exposure data prepared yet.`); return; }

  const data = await S.api(`/api/entities/dates?iso3=${encodeURIComponent(ctx.iso3)}`);
  if (!data || !data.buckets || !data.buckets.length) {
    S.prose(el, 'No construction-date coverage for this section.');
    return;
  }
  const { total, unknown_count: unknown, buckets, features } = data;
  const known = total ? Math.round((100 * (total - unknown)) / total) : 0;
  const oldest = buckets[0].label, newest = buckets[buckets.length - 1].label;
  S.prose(el, `<strong>${known}%</strong> of ${S.fmtNum(total)} entities carry a known construction date (GEM <code>DAT</code>), ${S.esc(oldest)} to ${S.esc(newest)}. Click a period to filter.`);

  const map = S.makeMap(S.slot(el, 'map'));
  const maxIndex = Math.max(1, buckets.length - 1);
  map.on('load', () => {
    map.addSource('dates', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    map.addLayer({ id: 'dates', type: 'circle', source: 'dates', paint: {
      'circle-radius': 4, 'circle-opacity': .78,
      'circle-color': ['interpolate', ['linear'], ['get', 'bucket_index'], 0, '#2374ab', maxIndex, '#c81d25'],
    } });
    S.popup(map, 'dates', 'Built {bucket}');
    const b = S.bbox(features.map(f => f.geometry.coordinates));
    if (b) map.fitBounds(b, { padding: 50, duration: S.cameraMs(1000) });
  });

  const controls = S.controls(el);
  if (controls) {
    controls.innerHTML = `<div class="sb-chips">
      <button type="button" class="sb-chip is-active" data-bucket="">All</button>
      ${buckets.map(b => `<button type="button" class="sb-chip" data-bucket="${b.index}">${S.esc(b.label)}<small>${S.fmtNum(b.count)}</small></button>`).join('')}
    </div>`;
    controls.addEventListener('click', event => {
      const chip = event.target.closest('.sb-chip');
      if (!chip || !map.getLayer('dates')) return;
      controls.querySelectorAll('.sb-chip').forEach(c => c.classList.toggle('is-active', c === chip));
      const bucket = chip.dataset.bucket;
      map.setFilter('dates', bucket === '' ? null : ['==', ['get', 'bucket_index'], Number(bucket)]);
    });
  }

  if (config.legend) S.legend(el, `<h4>Construction date</h4>
    <div class="legend-gradient" style="background:linear-gradient(90deg,#2374ab,#c81d25)"></div>
    <div class="legend-range"><span>${S.esc(oldest)}</span><span>${S.esc(newest)}</span></div>`);
};
