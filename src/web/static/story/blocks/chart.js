// chart -- an authored chart (bar / hbar / line / doughnut) from `labels` + `series`.
//   variant: "Mw 6.5", variants: [{label, series, labels?, unit?}]   chips that swap the data; the
//   top-level labels / series are the first view
window.STORY_BLOCKS['chart'] = function (el, config) {
  const S = window.STORY;
  const css = name => getComputedStyle(document.getElementById('story')).getPropertyValue(name).trim();
  const ink = css('--s-fg') || '#222', muted = css('--s-muted') || '#777', line = css('--s-border') || '#ddd';
  const palette = [S.accent(), '#37b6c9', '#f2b53c', '#8a8f98', '#a64ac9', '#3c9d5d'];
  const kind = config.kind || 'bar';
  const pie = kind === 'doughnut';
  const views = [{ label: config.variant || 'Default', labels: config.labels, series: config.series, unit: config.unit },
    ...(config.variants || []).map(v => ({ ...v, labels: v.labels || config.labels, unit: v.unit ?? config.unit }))];

  const draw = view => {
  const unit = view.unit ? ` ${view.unit}` : '';
  const datasets = (view.series || []).map((s, i) => {
    const color = s.color || palette[i % palette.length];
    return pie
      ? { label: s.name, data: s.data, backgroundColor: view.labels.map((_, k) => palette[k % palette.length]), borderColor: css('--s-surface') || '#fff', borderWidth: 2 }
      : { label: s.name, data: s.data, backgroundColor: kind === 'line' ? color + '33' : color, borderColor: color, borderWidth: kind === 'line' ? 2.5 : 0, tension: .3, pointRadius: kind === 'line' ? 3 : 0, fill: false, borderRadius: 3 };
  });
  const showLegend = pie || datasets.length > 1;
  S.chart(el, {
    type: pie ? 'doughnut' : kind === 'hbar' ? 'bar' : kind,
    data: { labels: view.labels, datasets },
    options: {
      responsive: true, animation: S.REDUCED ? false : { duration: 700 }, indexAxis: kind === 'hbar' ? 'y' : 'x',
      plugins: {
        legend: { display: showLegend, position: 'bottom', labels: { color: ink, boxWidth: 12 } },
        title: { display: !!config.title, text: config.title, color: ink, align: 'start', font: { size: 14, weight: '600' } },
        tooltip: { callbacks: { label: c => `${c.dataset.label ? c.dataset.label + ': ' : ''}${S.fmtNum(pie ? c.parsed : (kind === 'hbar' ? c.parsed.x : c.parsed.y))}${unit}` } },
      },
      scales: pie ? {} : {
        x: { stacked: !!config.stacked, beginAtZero: true, ticks: { color: muted }, grid: { color: kind === 'hbar' ? line : 'transparent' } },
        y: { stacked: !!config.stacked, beginAtZero: true, ticks: { color: muted, callback: v => S.fmtNum(v) }, grid: { color: kind === 'hbar' ? 'transparent' : line } },
      },
    },
  });
  };
  draw(views[0]);
  S.pills(el, views.map(v => v.label), i => draw(views[i]));
};
