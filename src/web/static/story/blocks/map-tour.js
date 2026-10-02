// map-tour -- numbered places on a map. The places are server-rendered as an <ol>; this adds the
// map, a numbered pin per place, previous / next (buttons, pins, arrow keys) and flies the map.
window.STORY_BLOCKS['map-tour'] = async function (el, config) {
  const S = window.STORY;
  const host = S.slot(el, 'map');
  if (!host) return;
  const places = [...el.querySelectorAll('.mt-place')];
  const located = places.map(p => (p.dataset.lon ? [Number(p.dataset.lon), Number(p.dataset.lat)] : null));
  // presentation mode walks the places (up / down) through these; inert until the places are wired
  let walk = null;
  el.tourStep = delta => walk ? walk(delta) : false;
  el.tourEnter = last => { S.scrollTo(el, 'center'); if (walk) walk(null, last); };
  const map = S.makeMap(host, { basemap: config.basemap, ...S.threeD(config) });
  el.storyMap = map;
  await S.mapLoaded(map);

  const nav = el.querySelector('[data-role="nav"]');
  const count = el.querySelector('.mt-count');
  let at = -1;
  const pins = places.map((place, i) => {
    if (!located[i]) return null;
    const pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'mt-pin'; pin.textContent = String(i + 1);
    pin.setAttribute('aria-label', `Place ${i + 1}`);
    pin.addEventListener('click', () => go(i));
    new maplibregl.Marker({ element: pin }).setLngLat(located[i]).addTo(map);
    return pin;
  });

  function go(i) {
    at = (i + places.length) % places.length;
    places.forEach((p, k) => { p.hidden = k !== at; });
    pins.forEach((pin, k) => pin && pin.classList.toggle('is-on', k === at));
    count.textContent = `${at + 1} / ${places.length}`;
    if (located[at]) {
      const zoom = Number(places[at].dataset.zoom) || 13;
      map.flyTo({ center: located[at], zoom, duration: S.cameraMs(1200), essential: true });
    }
  }

  walk = (delta, last) => {
    const n = delta === null ? (last ? places.length - 1 : 0) : at + delta;
    if (n < 0 || n >= places.length) return false;
    go(n);
    return true;
  };

  nav.hidden = places.length < 2;
  nav.querySelectorAll('button').forEach(b => b.addEventListener('click', () => go(at + Number(b.dataset.dir))));
  el.tabIndex = 0;
  el.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea') || document.body.classList.contains('story-presenting')) return;
    if (e.key === 'ArrowRight') go(at + 1); else if (e.key === 'ArrowLeft') go(at - 1);
  });

  const box = S.bbox(located.filter(Boolean));
  if (box) map.fitBounds(box, { padding: 56, maxZoom: 14, duration: 0 });
  go(0);
};
