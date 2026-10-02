// ranking -- the ranked bar list is server-rendered; this only wires the metric chips
// (`metrics: [{label, unit, rows}]`) and redraws the rows. Keep the markup in step with
// templates/stories/blocks/ranking.html.
window.STORY_BLOCKS['ranking'] = function (el, config) {
  const S = window.STORY;
  const metrics = config.metrics || [];
  const list = S.slot(el, 'rows');
  if (!list || metrics.length < 2) return;

  const fmt = v => Number(v).toLocaleString(undefined, config.decimals != null
    ? { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals }
    : { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(+v) ? 0 : 1 });
  const draw = metric => {
    const unit = metric.unit || config.unit;
    let rows = metric.rows.slice();
    if (config.sort !== 'none') rows.sort((a, b) => (config.sort === 'asc' ? a.value - b.value : b.value - a.value));
    if (config.top) rows = rows.slice(0, config.top);
    const top = Math.max(0, ...rows.map(r => r.value));
    list.innerHTML = rows.map((r, i) => `<li class="rk__row">
      <span class="rk__rank">${i + 1}</span>
      <span class="rk__name">${S.esc(r.name)}${r.note ? `<small>${S.esc(r.note)}</small>` : ''}</span>
      <span class="rk__bar"><i style="--w: ${top ? +(6 + 94 * r.value / top).toFixed(1) : 0}%"></i></span>
      <span class="rk__val">${fmt(r.value)}${unit ? ` <small>${S.esc(unit)}</small>` : ''}</span>
    </li>`).join('');
  };
  S.pills(el, metrics.map(m => m.label), i => draw(metrics[i]));
};
