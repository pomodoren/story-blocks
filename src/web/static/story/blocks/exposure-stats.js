// exposure-stats -- stat tiles + a construction-period bar for the country's exposure set.
window.STORY_BLOCKS['exposure-stats'] = async function (el, config, ctx) {
  const S = window.STORY;
  if (!ctx.iso3) { S.prose(el, `${S.esc(ctx.label)} has no exposure data prepared yet.`); return; }

  const [tax, dates] = await Promise.all([
    S.api(`/api/taxonomy?iso3=${encodeURIComponent(ctx.iso3)}`),
    S.api(`/api/entities/dates?iso3=${encodeURIComponent(ctx.iso3)}`),
  ]);
  S.prose(el, "Totals straight from the dashboard's own read-only APIs — the same ones every block below uses.");

  const host = S.slot(el, 'chart');
  if (host && tax) {
    const occ = tax.attributes.OCC || { known: 0 };
    host.innerHTML = `<div class="sb-tiles">
      <div class="sb-tile"><b>${S.fmtNum(tax.total)}</b><span>Modeled entities</span></div>
      <div class="sb-tile"><b>${S.fmtNum(tax.parsed)}</b><span>Parsed taxonomy</span><small>machine-readable string</small></div>
      <div class="sb-tile"><b>${S.fmtNum(occ.known)}</b><span>Occupancy classified</span></div>
      <div class="sb-tile"><b>${S.fmtNum(dates ? dates.unknown_count : 0)}</b><span>Undated entities</span><small>no GEM DAT</small></div>
    </div>`;
  }
  if (dates && dates.buckets && dates.buckets.length) {
    S.chart(el, {
      type: 'bar',
      data: { labels: dates.buckets.map(b => b.label), datasets: [{ data: dates.buckets.map(b => b.count), backgroundColor: S.accent() }] },
      options: {
        responsive: true, animation: false, indexAxis: 'y',
        plugins: { legend: { display: false }, title: { display: true, text: 'Entities by construction period' } },
        scales: { x: { beginAtZero: true } },
      },
    });
  }
};
