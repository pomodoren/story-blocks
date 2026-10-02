// taxonomy-stats -- a distribution panel + bar for one GEM taxonomy attribute.
window.STORY_BLOCKS['taxonomy-stats'] = async function (el, config, ctx) {
  const S = window.STORY;
  if (!ctx.iso3) { S.prose(el, `${S.esc(ctx.label)} has no exposure data prepared yet.`); return; }

  const data = await S.api(`/api/taxonomy?iso3=${encodeURIComponent(ctx.iso3)}`);
  if (!data) { S.prose(el, 'Could not load taxonomy data for this section.'); return; }

  const key = config.attribute || 'OCC';
  const attr = data.attributes[key] || { known: 0, buckets: [] };
  const parsedPct = data.total ? Math.round((100 * data.parsed) / data.total) : 0;
  S.prose(el, `<strong>${S.fmtNum(data.parsed)}</strong> of ${S.fmtNum(data.total)} entities carry a parsed GEM taxonomy (${parsedPct}%). ${S.esc(key)} is known for <strong>${S.fmtNum(attr.known)}</strong>. The mix:`);

  const host = S.slot(el, 'chart');
  if (host) {
    host.innerHTML = `<div class="sb-tiles">
      <div class="sb-tile"><b>${S.fmtNum(data.total)}</b><span>Entities</span></div>
      <div class="sb-tile"><b>${parsedPct}%</b><span>Parsed</span></div>
      <div class="sb-tile"><b>${S.fmtNum(attr.known)}</b><span>${S.esc(key)} known</span></div>
    </div>`;
  }
  if (!attr.buckets.length) return;
  S.chart(el, {
    type: 'bar',
    data: { labels: attr.buckets.map(b => b.label), datasets: [{ label: 'Entities', data: attr.buckets.map(b => b.count), backgroundColor: S.accent() }] },
    options: { responsive: true, animation: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  });
};
