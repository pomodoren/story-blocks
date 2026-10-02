// table -- search, per-column filters, pagination, click-to-sort headers and row -> map links,
// all layered on the server-rendered <table> (which prints and reads without JS).
window.STORY_BLOCKS['table'] = function (el, config) {
  const S = window.STORY;
  const table = el.querySelector('table.tb');
  const body = table && table.tBodies[0];
  if (!body) return;
  const rows = [...body.rows];
  const tools = S.slot(el, 'tools');
  const heads = [...table.tHead.rows[0].cells].map(th => th.textContent.trim());
  const col = name => heads.indexOf(name);
  const text = (r, i) => r.cells[i].textContent.trim();

  // search + per-column dropdown filters + pagination all feed one apply() over the rows
  const state = { q: '', filters: {}, page: 0 };
  const size = config.page_size || 0;
  let count = null, pager = null;
  const apply = () => {
    const hits = rows.filter(r => (!state.q || r.textContent.toLowerCase().includes(state.q))
      && Object.entries(state.filters).every(([i, v]) => !v || text(r, +i) === v));
    const pages = size ? Math.max(1, Math.ceil(hits.length / size)) : 1;
    state.page = Math.min(state.page, pages - 1);
    const from = size ? state.page * size : 0, to = size ? from + size : hits.length;
    const visible = new Set(hits.slice(from, to));
    rows.forEach(r => { r.hidden = !visible.has(r); });
    if (count) count.textContent = hits.length === rows.length ? '' : `${hits.length} of ${rows.length}`;
    if (pager) {
      pager.hidden = pages < 2;
      pager.querySelector('[data-role=label]').textContent = `Page ${state.page + 1} of ${pages}`;
      pager.querySelector('[data-role=prev]').disabled = state.page === 0;
      pager.querySelector('[data-role=next]').disabled = state.page >= pages - 1;
    }
  };

  const filterCols = (config.filters || []).map(col).filter(i => i >= 0);
  const wantSearch = config.search !== false && rows.length > 6;
  if (tools && (wantSearch || filterCols.length)) {
    tools.hidden = false;
    tools.innerHTML = (wantSearch ? `<input type="search" class="tb-search" placeholder="Search ${rows.length} rows" aria-label="Search table" />` : '')
      + filterCols.map(i => `<select class="tb-filter" data-col="${i}" aria-label="Filter by ${S.esc(heads[i])}"><option value="">All ${S.esc(heads[i])}</option>${
        [...new Set(rows.map(r => text(r, i)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(v => `<option>${S.esc(v)}</option>`).join('')}</select>`).join('')
      + '<span class="tb-count" aria-live="polite"></span>';
    count = tools.querySelector('.tb-count');
    const input = tools.querySelector('input');
    if (input) input.addEventListener('input', () => { state.q = input.value.trim().toLowerCase(); state.page = 0; apply(); });
    tools.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => { state.filters[sel.dataset.col] = sel.value; state.page = 0; apply(); }));
  }
  if (size && rows.length > size) {
    pager = document.createElement('div');
    pager.className = 'tb-pager';
    pager.innerHTML = '<button type="button" data-role="prev">&larr; Prev</button><span data-role="label" aria-live="polite"></span><button type="button" data-role="next">Next &rarr;</button>';
    table.closest('.tb-scroll').after(pager);
    pager.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b) { state.page += b.dataset.role === 'next' ? 1 : -1; apply(); }
    });
  }
  apply();

  // `locate`: a row click flies the nearest map to the row's coordinates
  const loc = config.locate;
  if (loc && col(loc.lon) >= 0 && col(loc.lat) >= 0) {
    table.classList.add('tb--locate');
    const go = r => {
      const lon = parseFloat(text(r, col(loc.lon))), lat = parseFloat(text(r, col(loc.lat)));
      if (Number.isFinite(lon) && Number.isFinite(lat)) S.flyNearest(el, lon, lat, loc.zoom || 14);
    };
    rows.forEach(r => {
      r.tabIndex = 0;
      r.addEventListener('click', () => go(r));
      r.addEventListener('keydown', e => { if (e.key === 'Enter') go(r); });
    });
  }

  if (config.sortable !== false) {
    const num = v => parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    [...table.tHead.rows[0].cells].forEach((th, col) => {
      th.tabIndex = 0;
      th.setAttribute('role', 'columnheader');
      const sort = () => {
        const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        [...table.tHead.rows[0].cells].forEach(c => c.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', dir);
        const isNum = th.dataset.num === '1';
        const key = r => { const t = r.cells[col].textContent.trim(); return isNum ? num(t) : t.toLowerCase(); };
        rows.sort((a, b) => {
          const x = key(a), y = key(b);
          const c = isNum ? (isNaN(x) ? -Infinity : x) - (isNaN(y) ? -Infinity : y) : x.localeCompare(y, undefined, { numeric: true });
          return dir === 'ascending' ? c : -c;
        });
        rows.forEach(r => body.appendChild(r));
      };
      th.addEventListener('click', sort);
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
    });
  }
};
