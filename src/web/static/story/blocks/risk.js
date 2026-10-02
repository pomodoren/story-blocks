// risk -- per-entity structural loss: a coloured/sized point layer, a worst-hit list, and
// (once) a map snapshot of the highest-loss cluster dropped into the text column.
window.STORY_BLOCKS['risk'] = async function (el, config, ctx) {
  const S = window.STORY;
  const scenario = await S.scenario(ctx.scenario);
  if (!scenario) { S.prose(el, `No risk result is registered for ${S.esc(ctx.label)} yet.`); return; }

  const chosen = S.pickMag(scenario);
  if (!chosen.has_loss_layer) {
    S.prose(el, `Portfolio structural loss at Mw ${S.esc(chosen.mw)}: <strong>${S.fmtCurrency(chosen.scenario_structural_loss, chosen.currency)}</strong> (${S.esc(chosen.loss_ratio_pct)}% of exposed value). No per-entity CSV to map.`);
    return;
  }
  const loss = await S.loss(ctx.scenario, chosen.mw);
  if (!loss.available) { S.prose(el, loss.reason || 'Loss results are not available for this magnitude.'); return; }

  S.prose(el, `At Mw ${S.esc(chosen.mw)}, ${S.fmtNum(loss.totals.entities)} entities lose an estimated <strong>${S.fmtCurrency(loss.totals.loss_value, chosen.currency)}</strong> (${(loss.totals.loss_ratio * 100).toFixed(1)}% of exposed value). Darker, bigger points lost more.`);

  const maxLoss = Math.max(1, ...loss.features.map(f => f.properties.loss_value));
  const map = S.makeMap(S.slot(el, 'map'));
  map.on('load', () => {
    map.addSource('loss', { type: 'geojson', data: loss });
    map.addLayer({ id: 'loss', type: 'circle', source: 'loss', paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'loss_value'], 0, 2, maxLoss, 11],
      'circle-opacity': .8,
      'circle-color': ['interpolate', ['linear'], ['get', 'loss_value'], 0, '#e6b91e', maxLoss, '#c81d25'],
    } });
    S.popup(map, 'loss', '<strong>Entity {entity_id}</strong><br>{loss_value} loss');

    const top = [...loss.features].sort((a, b) => b.properties.loss_value - a.properties.loss_value).slice(0, 5);
    if (config.tour) {
      const controls = S.controls(el);
      if (controls) {
        controls.innerHTML = `<ol class="sb-list">${top.map((f, i) => `<li><button type="button" data-i="${i}"><strong>Entity ${S.esc(f.properties.entity_id)}</strong><span>${S.fmtCurrency(f.properties.loss_value, chosen.currency)}</span></button></li>`).join('')}</ol>`;
        controls.addEventListener('click', event => {
          const button = event.target.closest('[data-i]');
          if (!button) return;
          const f = top[Number(button.dataset.i)];
          controls.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === button));
          map.flyTo({ center: f.geometry.coordinates, zoom: 17, duration: S.cameraMs(900) });
          new maplibregl.Popup({ closeButton: true }).setLngLat(f.geometry.coordinates)
            .setHTML(`<strong>Entity ${S.esc(f.properties.entity_id)}</strong><br>${S.fmtCurrency(f.properties.loss_value, chosen.currency)} loss`).addTo(map);
        });
      }
    }
    const b = S.bbox((config.tour ? top : loss.features).map(f => f.geometry.coordinates));
    if (b) map.fitBounds(b, { padding: 70, duration: S.cameraMs(1000) });

    if (config.snapshot && loss.features.length) {
      const worst = loss.features.reduce((a, b2) => (b2.properties.loss_value > a.properties.loss_value ? b2 : a));
      map.once('idle', () => {
        const prose = S.slot(el, 'prose');
        if (prose && !prose.querySelector('img')) {
          const img = document.createElement('img');
          img.alt = 'Map snapshot of the highest-loss cluster';
          img.style.cssText = 'display:block;width:100%;margin-top:12px;border-radius:8px';
          img.src = map.getCanvas().toDataURL('image/png');
          prose.appendChild(img);
        }
      });
      map.flyTo({ center: worst.geometry.coordinates, zoom: 16, duration: S.cameraMs(1200) });
    }
  });

  S.legend(el, `<h4>Estimated structural loss</h4>
    <div class="legend-gradient" style="background:linear-gradient(90deg,#e6b91e,#c81d25)"></div>
    <div class="legend-range"><span>0</span><span>${S.fmtCurrency(maxLoss, chosen.currency)}</span></div>
    <p class="legend-note">Point size also scales with loss.</p>`);
};
