// Visual story builder. State is {meta, blocks:[{type, config}]}; the left column is the outline
// (drag to reorder), the middle a form generated from the block catalog, the right a live preview
// of the saved draft. Form edits mutate the state in place (no re-render, so focus survives);
// structural edits (add / move / delete) re-render the outline and form.
(function () {
  const root = document.getElementById('editor');
  const $ = (sel, node = root) => node.querySelector(sel);
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => node.append(c));
    return node;
  };

  const iframe = $('.ed-preview iframe');
  const frame = $('.ed-frame');
  const toastEl = $('.ed-toast');
  const dirtyDot = $('.ed-dirty');
  let state, catalog, themes, dirty = false, at = -1, toastTimer = 0, liveTimer = 0, saving = false;
  // Live preview: edits are saved to the draft a moment after you stop typing (remembered per browser).
  let live = true;
  try { live = localStorage.getItem('sb-live') !== '0'; } catch { /* storage blocked */ }

  const CATS = {
    text: ['text', 'heading', 'interlude', 'quote', 'callout', 'button', 'divider', 'code'],
    media: ['image-card', 'gallery', 'video', 'audio', 'photo-scenes', 'embed'],
    data: ['kpi', 'chart', 'scroll-chart', 'network', 'ranking', 'table', 'stat-cards', 'timeline', 'process-board', 'exposure-stats', 'taxonomy-stats', 'vulnerability', 'hazard', 'risk'],
    maps: ['map', 'map-tour', 'guided-tour', 'deck-tour', 'buildings-3d', 'exposure-map', 'taxonomy-map', 'swipe'],
    structure: ['cover', 'credits'],
  };
  const CAT_LABEL = { text: 'Text & structure', media: 'Photos, video & embeds', data: 'Figures & data', maps: 'Maps', structure: 'Cover & credits' };
  const catOf = type => Object.keys(CATS).find(c => CATS[c].includes(type)) || 'structure';

  function toast(text, kind = '', ms = 4200) {
    clearTimeout(toastTimer);
    toastEl.textContent = text; toastEl.className = 'ed-toast ' + kind; toastEl.hidden = false;
    if (ms) toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
  }
  const touch = () => {
    dirty = true; dirtyDot.hidden = false; dirtyDot.classList.remove('is-error'); dirtyDot.title = 'Unsaved changes';
    clearTimeout(liveTimer);
    if (live) liveTimer = setTimeout(() => save(false, true), 1200);
  };
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  const api = (url, method, body, headers = {}) => fetch(url, {
    method,
    headers: { 'X-Story-Editor': '1', ...(body && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
  }).then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

  // ---------------------------------------------------------------- values
  const isEmpty = v => v === '' || v == null || (Array.isArray(v) && !v.length);
  function clean(value) {                    // drop empty strings / nulls before saving
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).filter(([, v]) => !isEmpty(v)).map(([k, v]) => [k, clean(v)]));
    }
    return value;
  }
  const payload = () => clean({ meta: state.meta, blocks: state.blocks });

  // ---------------------------------------------------------------- modals
  function modal(title, build) {
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const search = el('input', { type: 'search', placeholder: title, autofocus: true });
    const body = el('div', { class: 'body' });
    const back = el('div', { class: 'ed-modal', onclick: e => { if (e.target === back) close(); } },
      el('div', { class: 'ed-dialog', role: 'dialog', 'aria-label': title },
        el('header', {}, search, el('button', { type: 'button', onclick: close }, 'Close')), body));
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    build({ body, search, close });
    search.focus();
  }

  function paletteModal(pos) {
    modal('Search blocks…', ({ body, search, close }) => {
      const draw = () => {
        const q = search.value.trim().toLowerCase();
        body.replaceChildren();
        for (const cat of Object.keys(CATS)) {
          const types = CATS[cat].filter(t => catalog[t] && (!q || (t + ' ' + catalog[t].summary).toLowerCase().includes(q)));
          if (!types.length) continue;
          body.append(el('h4', {}, CAT_LABEL[cat]), el('div', { class: 'ed-palette' }, types.map(t =>
            el('button', { type: 'button', class: 'ed-card', onclick: () => { close(); addBlock(t, pos); } },
              el('b', { 'data-cat': cat }, el('i', { class: 'ed-dot' }), t), el('span', {}, catalog[t].summary)))));
        }
        if (!body.children.length) body.append(el('p', { class: 'ed-empty' }, 'No block matches.'));
      };
      search.addEventListener('input', draw);
      draw();
    });
  }

  function mediaModal(onPick) {
    modal('Filter media…', async ({ body, search, close }) => {
      const file = el('input', { type: 'file', accept: 'image/*,video/*,audio/*', hidden: true });
      const up = el('button', { type: 'button', onclick: () => file.click() }, 'Upload…');
      search.after(up, file);
      file.addEventListener('change', async () => {
        const f = file.files[0];
        if (!f) return;
        toast('Uploading…', '', 0);
        const { ok, data } = await api(`${root.dataset.mediaApi}`, 'POST', f, { 'X-Filename': f.name, 'Content-Type': 'application/octet-stream' });
        if (!ok) return toast(data.error || 'Upload failed', 'is-error');
        toast('Uploaded', 'is-ok');
        close(); onPick(data.url);
      });
      const { data } = await api(root.dataset.mediaApi, 'GET');
      const files = data.files || [];
      const draw = () => {
        const q = search.value.trim().toLowerCase();
        const grid = el('div', { class: 'ed-media-grid' }, files.filter(f => !q || (f.folder + '/' + f.name).toLowerCase().includes(q)).map(f => {
          const isImg = /\.(webp|png|jpe?g|gif|svg|avif)$/i.test(f.name);
          return el('button', { type: 'button', title: f.url, onclick: () => { close(); onPick(f.url); } },
            isImg ? el('img', { src: f.url, alt: '', loading: 'lazy' }) : el('div', { class: 'ph' }, f.name.split('.').pop()),
            el('span', {}, f.folder === '.' ? f.name : `${f.folder}/${f.name}`));
        }));
        body.replaceChildren(files.length ? grid : el('p', { class: 'ed-empty' }, 'No media yet — upload a file.'));
      };
      search.addEventListener('input', draw);
      draw();
    });
  }

  // ---------------------------------------------------------------- field widgets
  const MEDIA_KEYS = new Set(['image', 'alt_image', 'poster', 'logo']);
  const isImageUrl = v => typeof v === 'string' && /\.(webp|png|jpe?g|gif|svg|avif)(\?|$)/i.test(v);

  function field(holder, key, { label, required, long, json, hint, media } = {}) {
    const v = holder[key];
    const wrap = el('div', { class: 'ed-field' });
    const id = 'f' + Math.random().toString(36).slice(2, 8);
    wrap.append(el('label', { for: id }, label || key, required ? el('i', {}, ' *') : '', hint ? el('small', {}, '  ' + hint) : ''));
    let input;
    const kind = json || (v !== null && typeof v === 'object') ? 'json'
      : typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? 'number'
      : (long || (typeof v === 'string' && (v.length > 70 || v.includes('\n')))) ? 'area' : 'text';
    if (kind === 'json') {
      input = el('textarea', { id, class: 'json', spellcheck: 'false' });
      input.value = isEmpty(v) ? '' : JSON.stringify(v, null, 1);
      input.addEventListener('input', () => {
        const raw = input.value.trim();
        if (!raw) { delete holder[key]; input.classList.remove('is-bad'); return touch(); }
        try { holder[key] = JSON.parse(raw); input.classList.remove('is-bad'); touch(); }
        catch { input.classList.add('is-bad'); }
      });
    } else if (kind === 'bool') {
      input = el('input', { id, type: 'checkbox' });
      input.checked = !!v;
      input.addEventListener('change', () => { holder[key] = input.checked; touch(); });
    } else if (kind === 'number') {
      input = el('input', { id, type: 'number', step: 'any' });
      input.value = v;
      input.addEventListener('input', () => { if (input.value === '') delete holder[key]; else holder[key] = Number(input.value); touch(); });
    } else {
      input = kind === 'area' ? el('textarea', { id }) : el('input', { id, type: 'text' });
      input.value = v == null ? '' : v;
      input.addEventListener('input', () => { holder[key] = input.value; touch(); if (thumb) { thumb.src = input.value; thumb.hidden = !isImageUrl(input.value); } });
    }
    let thumb = null;
    if (media && kind === 'text') {
      thumb = el('img', { class: 'ed-thumb', alt: '', src: v || '', hidden: !isImageUrl(v) });
      const pick = el('button', { type: 'button', onclick: () => mediaModal(url => {
        input.value = url; holder[key] = url; thumb.src = url; thumb.hidden = !isImageUrl(url); touch();
      }) }, 'Browse…');
      wrap.append(el('div', { class: 'ed-media' }, thumb, input, pick));
    } else wrap.append(input);
    return wrap;
  }

  // ---------------------------------------------------------------- meta
  function renderMeta() {
    const box = $('[data-role="meta"]');
    box.replaceChildren();
    const m = state.meta;
    if (m.title == null) m.title = '';
    box.append(field(m, 'title'));
    const sel = el('select', {}, themes.map(o => el('option', { value: o, selected: m.theme === o }, o)));
    sel.addEventListener('change', () => { m.theme = sel.value; touch(); });
    box.append(el('div', { class: 'ed-field' }, el('label', {}, 'theme'), sel));
    ['lang', 'collection', 'accent', 'logo_alt', 'logo_link'].forEach(k => {
      if (m[k] == null) m[k] = '';
      box.append(field(m, k, { hint: k === 'accent' ? '#rrggbb' : '' }));
    });
    if (m.logo == null) m.logo = '';
    box.append(field(m, 'logo', { media: true }));
  }

  // ---------------------------------------------------------------- outline
  const snippet = b => {
    const c = b.config || {};
    const first = (c.steps || c.scenes || c.cards || c.places || c.images || c.events || c.figures || [])[0];
    return String(c.title || c.text || c.body || c.eyebrow || (first && (first.title || first.value)) || '').replace(/\s+/g, ' ').slice(0, 64);
  };

  let dragFrom = -1;
  function renderOutline() {
    const ol = $('[data-role="blocks"]');
    const gap = pos => el('li', { class: 'ed-gap', role: 'presentation' },
      el('button', { type: 'button', title: 'Insert a block here', onclick: e => { e.stopPropagation(); paletteModal(pos); } }, '+ insert'));
    ol.replaceChildren(...state.blocks.flatMap((b, i) => {
      const btn = (txt, title, fn) => el('button', { type: 'button', title, onclick: e => { e.stopPropagation(); fn(); } }, txt);
      const li = el('li', { class: i === at ? 'is-on' : '', draggable: 'true', 'data-cat': catOf(b.type), onclick: () => select(i) },
        el('span', { class: 'ed-grip', 'aria-hidden': 'true' }, '⋮⋮'), el('i', { class: 'ed-dot' }),
        el('div', { class: 't' }, el('b', {}, `${i + 1} · ${b.type}`), el('span', {}, snippet(b) || '—')),
        el('div', { class: 'acts' }, btn('↑', 'Move up', () => move(i, -1)), btn('↓', 'Move down', () => move(i, 1)),
          btn('⧉', 'Duplicate', () => dup(i)), btn('✕', 'Delete', () => del(i))));
      li.addEventListener('dragstart', e => { dragFrom = i; li.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); });
      li.addEventListener('dragend', () => { li.classList.remove('is-dragging'); ol.querySelectorAll('.is-over').forEach(n => n.classList.remove('is-over')); });
      li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('is-over'); });
      li.addEventListener('dragleave', () => li.classList.remove('is-over'));
      li.addEventListener('drop', e => {
        e.preventDefault();
        if (dragFrom < 0 || dragFrom === i) return;
        const [item] = state.blocks.splice(dragFrom, 1);
        state.blocks.splice(i, 0, item);
        at = i; dragFrom = -1; touch(); renderOutline(); select(i);
      });
      return [gap(i), ...(i === state.blocks.length - 1 ? [li, gap(i + 1)] : [li])];
    }));
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.blocks.length) return;
    [state.blocks[i], state.blocks[j]] = [state.blocks[j], state.blocks[i]];
    at = j; touch(); renderOutline();
  }
  function dup(i) { state.blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(state.blocks[i]))); at = i + 1; touch(); renderOutline(); renderForm(); }
  function del(i) {
    if (!confirm(`Delete block ${i + 1} (${state.blocks[i].type})?`)) return;
    state.blocks.splice(i, 1); at = Math.min(at, state.blocks.length - 1); touch(); renderOutline(); renderForm();
  }
  function select(i) {
    at = i; renderOutline(); renderForm();
    try { const t = iframe.contentDocument.querySelectorAll('.story-flow > .sb')[i]; if (t) t.scrollIntoView({ block: 'start' }); } catch { /* not loaded yet */ }
  }

  // ---------------------------------------------------------------- block form
  const section = (title, open = true) => {
    const body = el('div', {});
    return { node: el('details', { class: 'ed-sec', open }, el('summary', {}, title), body), body };
  };

  function renderForm() {
    const form = $('[data-role="form"]');
    form.replaceChildren();
    const b = state.blocks[at];
    if (!b) { form.append(el('p', { class: 'ed-empty' }, state.blocks.length ? 'Select a block to edit it.' : 'No blocks yet — add one.')); return; }
    const bt = catalog[b.type];
    b.config = b.config || {};
    const cfg = b.config;
    form.append(el('div', { class: 'ed-form-head' },
      el('h3', { 'data-cat': catOf(b.type) }, el('i', { class: 'ed-dot' }), b.type), el('p', {}, bt.summary)));

    const used = new Set();
    const mediaKey = k => MEDIA_KEYS.has(k) || (k === 'src' && ['image-card', 'video', 'audio'].includes(b.type));
    const add = (into, key, opts) => { used.add(key); into.append(field(cfg, key, { required: bt.required.includes(key), media: mediaKey(key), ...opts })); };

    const content = section('Content');
    bt.plain.forEach(k => { if (k in cfg || bt.required.includes(k) || ['title', 'eyebrow'].includes(k)) { if (cfg[k] == null) cfg[k] = ''; add(content.body, k); } });
    bt.rich.forEach(k => { if (cfg[k] == null) cfg[k] = ''; add(content.body, k, { long: true, hint: 'Markdown' }); });
    if (content.body.children.length) form.append(content.node);

    if (bt.items) { used.add(bt.items); form.append(itemsEditor(cfg, bt, b.type)); }

    const options = section('Options', !bt.items);
    Object.keys(cfg).filter(k => !used.has(k) && !bt.plain.includes(k)).forEach(k => add(options.body, k));
    const spare = bt.keys.filter(k => !(k in cfg) && !used.has(k) && !bt.plain.includes(k) && !bt.rich.includes(k) && k !== bt.items);
    if (spare.length) {
      const pick = el('select', {}, el('option', { value: '' }, '+ add option…'), spare.map(k => el('option', { value: k }, k)));
      pick.addEventListener('change', () => { if (!pick.value) return; cfg[pick.value] = bt.defaults[pick.value] ?? ''; touch(); renderForm(); });
      options.body.append(el('div', { class: 'ed-field' }, pick));
    }
    if (options.body.children.length) form.append(options.node);
  }

  const LONG_ITEM = new Set(['text', 'caption', 'intro']);
  const JSON_ITEM = new Set(['focus', 'stats']);
  function itemsEditor(cfg, bt, type) {
    const list = cfg[bt.items] = cfg[bt.items] || [];
    const sec = section(`${bt.items} (${list.length})`);
    const draw = () => {
      sec.body.replaceChildren();
      sec.node.querySelector('summary').textContent = `${bt.items} (${list.length})`;
      list.forEach((item, i) => {
        const swap = d => { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; touch(); draw(); };
        const head = el('summary', {}, el('span', {}, `${i + 1}. ${item.title || item.label || item.value || '(untitled)'}`),
          el('button', { type: 'button', title: 'Up', onclick: e => { e.preventDefault(); swap(-1); } }, '↑'),
          el('button', { type: 'button', title: 'Down', onclick: e => { e.preventDefault(); swap(1); } }, '↓'),
          el('button', { type: 'button', title: 'Remove', onclick: e => { e.preventDefault(); list.splice(i, 1); touch(); draw(); } }, '✕'));
        const inner = el('div', {});
        bt.item_keys.forEach(k => {
          if (item[k] == null) item[k] = JSON_ITEM.has(k) ? undefined : '';
          inner.append(field(item, k, { long: LONG_ITEM.has(k), json: JSON_ITEM.has(k), hint: k === 'text' ? 'Markdown' : '',
            media: MEDIA_KEYS.has(k) || k === 'src' }));
        });
        sec.body.append(el('details', { class: 'ed-item', open: list.length <= 3 }, head, inner));
      });
      sec.body.append(el('button', { type: 'button', class: 'ed-add-item', onclick: () => { list.push({}); touch(); draw(); } }, `+ Add to ${bt.items}`));
    };
    draw();
    return sec.node;
  }

  // ---------------------------------------------------------------- actions
  function addBlock(type, pos = at + 1) {
    const bt = catalog[type];
    const config = JSON.parse(JSON.stringify(bt.defaults || {}));
    if (bt.items && !config[bt.items]) config[bt.items] = [{}];
    state.blocks.splice(pos, 0, { type, config });
    at = pos; touch(); renderOutline(); renderForm();
    toast(`Added ${type} — fill in the starred fields`, '', 2500);
  }

  // `quiet` is the live-preview autosave: no toasts, and a half-finished block only marks the dot red.
  async function save(publish, quiet = false) {
    clearTimeout(liveTimer);
    if (saving) { if (quiet) liveTimer = setTimeout(() => save(false, true), 600); return; }
    saving = true;
    if (!quiet) toast(publish ? 'Publishing…' : 'Saving…', '', 0);
    const body = payload(), sent = JSON.stringify(body);
    const { ok, data } = await api(publish ? root.dataset.publishApi : root.dataset.draftApi, publish ? 'POST' : 'PUT', body);
    saving = false;
    if (!ok) {
      if (!quiet) return toast(data.error || 'Could not save', 'is-error', 9000);
      dirtyDot.classList.add('is-error'); dirtyDot.title = data.error || 'Could not save the draft';
      return;
    }
    if (JSON.stringify(payload()) === sent) { dirty = false; dirtyDot.hidden = true; }   // edits made mid-save stay dirty
    const warn = (data.warnings || []).length ? ` · ${data.warnings.length} warning(s): ${data.warnings[0]}` : '';
    if (!quiet || warn) toast((publish ? 'Published' : 'Draft saved') + warn, 'is-ok');
    iframe.src = `${root.dataset.preview}?draft=${publish ? 0 : 1}&_=${Date.now()}`;
    iframe.onload = () => { if (at >= 0) { try { const t = iframe.contentDocument.querySelectorAll('.story-flow > .sb')[at]; if (t) t.scrollIntoView(); } catch { /* ignore */ } } };
  }

  root.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'add') paletteModal();
    else if (act === 'draft') save(false);
    else if (act === 'publish') { if (confirm('Rewrite this story\'s Markdown spine and rebuild it?')) save(true); }
    else if (act === 'discard') {
      if (!confirm('Discard the unpublished draft? (The published story is untouched.)')) return;
      await api(root.dataset.draftApi, 'DELETE', {});
      dirty = false; location.reload();
    }
    const device = e.target.closest('[data-device]');
    if (e.target.matches('[data-live]')) {
      live = e.target.checked;
      try { localStorage.setItem('sb-live', live ? '1' : '0'); } catch { /* storage blocked */ }
      if (live && dirty) save(false, true);
    }
    if (device) {
      root.querySelectorAll('[data-device]').forEach(b => b.classList.toggle('is-on', b === device));
      frame.style.width = device.dataset.device || '100%';
    }
  });
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); }
  });

  // ---------------------------------------------------------------- boot
  const liveBox = $('[data-live]');
  if (liveBox) liveBox.checked = live;
  fetch(root.dataset.api).then(r => r.json()).then(data => {
    state = { meta: data.meta || {}, blocks: data.blocks || [] };
    catalog = data.catalog; themes = data.themes;
    renderMeta(); renderOutline(); renderForm();
    toast(data.draft ? 'Editing the unpublished draft' : 'Editing the published story', '', 2500);
    iframe.src = `${root.dataset.preview}?draft=${data.draft ? 1 : 0}`;
    iframe.onload = () => { if (at < 0 && state.blocks.length) select(0); };
  });
})();
