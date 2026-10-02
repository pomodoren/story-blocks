// process-board -- pick a project chip; a wire is drawn through the steps it touched (in order,
// numbered) and every other step dims. Columns are phases; nodes are steps.
window.STORY_BLOCKS['process-board'] = function (el, config) {
  const S = window.STORY;
  const picker = S.slot(el, 'picker'), note = S.slot(el, 'note');
  const board = S.slot(el, 'board'), svg = S.slot(el, 'wires');
  const nodes = Object.fromEntries([...el.querySelectorAll('.pb-node')].map(n => [n.dataset.n, n]));
  const projects = config.projects || [];
  if (!picker || !board || !projects.length) return;
  let current = null;

  picker.innerHTML = `<span class="pb-lbl">${S.esc(config.picker_label || 'Project')}</span>`
    + projects.map(p => `<button type="button" class="pb-chip" data-p="${S.esc(p.id)}" aria-pressed="false">${S.esc(p.name)}</button>`).join('')
    + '<button type="button" class="pb-chip pb-reset" data-p="" aria-label="Clear" hidden>✕</button>';

  const center = (n, box) => { const r = n.getBoundingClientRect(); return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2, r]; };
  const draw = path => {
    svg.innerHTML = '';
    const stacked = getComputedStyle(board).getPropertyValue('--pb-cols').trim() === '1';
    if (stacked || path.length < 2) return;
    const box = board.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const pts = path.map(id => nodes[id]).filter(Boolean).map(n => center(n, box));
    let d = '';
    pts.forEach(([x, y, r], i) => {
      if (!i) { d = `M${x},${y}`; return; }
      const [px, , pr] = pts[i - 1];
      const fromX = px + (x >= px ? pr.width / 2 : -pr.width / 2), toX = x + (x >= px ? -r.width / 2 : r.width / 2);
      const sameCol = Math.abs(x - px) < 8;
      const a = sameCol ? [px, pts[i - 1][1] + pr.height / 2] : [fromX, pts[i - 1][1]];
      const b = sameCol ? [x, y - r.height / 2] : [toX, y];
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      d += ` M${a[0]},${a[1]} C${sameCol ? a[0] : mx},${sameCol ? my : a[1]} ${sameCol ? b[0] : mx},${sameCol ? my : b[1]} ${b[0]},${b[1]}`;
    });
    svg.innerHTML = `<path class="pb-wire" d="${d}" pathLength="1" />`;
  };

  const pick = id => {
    current = projects.find(p => p.id === id) || null;
    const path = current ? current.path : [];
    picker.querySelectorAll('.pb-chip[data-p]').forEach(b => { const on = b.dataset.p === id && id; b.classList.toggle('is-on', !!on); b.setAttribute('aria-pressed', String(!!on)); });
    picker.querySelector('.pb-reset').hidden = !current;
    Object.entries(nodes).forEach(([nid, n]) => {
      const i = path.indexOf(nid);
      n.classList.toggle('is-on', i >= 0);
      n.classList.toggle('is-dim', !!current && i < 0);
      n.querySelector('.pb-ord').textContent = i >= 0 ? String(i + 1) : '';
    });
    note.textContent = current && current.note ? current.note : '';
    board.classList.toggle('has-pick', !!current);
    requestAnimationFrame(() => draw(path));
  };
  picker.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) pick(b.dataset.p); });
  new ResizeObserver(() => current && draw(current.path)).observe(board);
};
