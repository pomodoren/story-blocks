// Story orchestrator: hand each [data-block] to its registered hydrator, then wire the
// cover actions and presentation mode. Everything block-specific lives in
// static/story/blocks/<type>.js; this file only knows the block frame + the shell.

(function () {
  const root = document.querySelector('[data-story]');
  if (!root) return;

  const ctx = {
    id: root.dataset.id,
    label: root.dataset.title || 'this example',
    iso3: root.dataset.iso3 || null,
    scenario: root.dataset.scenario || null,
    theme: root.dataset.theme,
  };

  // Reader preferences (style, text size, calm motion) live in localStorage and are applied
  // before the blocks hydrate. An explicit ?theme= override wins over the stored style.
  const themeLink = document.getElementById('storyTheme');
  const THEMES = ((themeLink && themeLink.dataset.themes) || '').split(',').filter(Boolean);
  const THEME_KEY = 'oxm-story-theme', PREFS_KEY = 'oxm-story-prefs';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const readPrefs = () => { try { return JSON.parse(store.get(PREFS_KEY)) || {}; } catch { return {}; } };
  const prefs = readPrefs();

  function applyTheme(name) {
    if (!themeLink || !THEMES.includes(name) || name === ctx.theme) return;
    themeLink.href = (themeLink.dataset.themeBase || '') + name + '.css';
    ctx.theme = name;
    root.dataset.theme = name;
    applyPrefs();   // size / measure scale the new theme's own values
  }
  const FONTS = {
    serif: 'Georgia, "Iowan Old Style", Palatino, serif',
    sans: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  };
  // Every preference is an override on top of the active theme's tokens, so they compose with
  // every style. Size / measure scale the theme's own value; the rest replace or add a token.
  function applyPrefs() {
    ['--s-body', '--s-measure', '--s-font', '--s-accent', '--s-accent-ink'].forEach(k => root.style.removeProperty(k));
    root.style.removeProperty('line-height');
    const cs = getComputedStyle(root);
    const scale = Number(prefs.size) || 1;
    if (scale !== 1) root.style.setProperty('--s-body', ((parseFloat(cs.getPropertyValue('--s-body')) || 16) * scale).toFixed(2) + 'px');
    const width = Number(prefs.width) || 1;
    if (width !== 1) root.style.setProperty('--s-measure', `calc(${cs.getPropertyValue('--s-measure').trim() || '44rem'} * ${width})`);
    if (FONTS[prefs.font]) root.style.setProperty('--s-font', FONTS[prefs.font]);
    if (Number(prefs.leading)) root.style.lineHeight = String(prefs.leading);
    if (/^#[0-9a-f]{6}$/i.test(prefs.accent || '')) {
      root.style.setProperty('--s-accent', prefs.accent);
      root.style.setProperty('--s-accent-ink', prefs.accent);
    }
    document.body.classList.toggle('story-calm', !!prefs.calm);
    document.body.classList.toggle('story-contrast', !!prefs.contrast);
    document.body.classList.toggle('story-no-progress', !!prefs.noProgress);
    document.body.classList.toggle('story-section-tint', !!prefs.sectionTint);
  }

  if (!new URLSearchParams(location.search).has('theme')) applyTheme(store.get(THEME_KEY));
  if (themeLink) themeLink.addEventListener('load', applyPrefs);
  applyPrefs();

  // hydrators (step dots, "jump to step") scroll through the same Lenis-aware helper the nav uses
  window.STORY.scrollTo = (el, block) => scrollToEl(el, block);

  document.querySelectorAll('[data-block]').forEach(el => {
    const type = el.dataset.block;
    const hydrate = window.STORY_BLOCKS[type];
    if (!hydrate) return;
    let config = {};
    const raw = el.querySelector('[data-block-config]');
    if (raw) {
      try { config = JSON.parse(raw.textContent); } catch (e) { console.error('block config', type, e); }
    }
    try { hydrate(el, config, ctx); } catch (e) { console.error('block', type, e); }
  });

  // ------------------------------------------------------------ smooth scroll (Lenis) + count-ups

  let lenis = null;

  buildStoryNav();
  wireProgress();
  wireReveal();
  wireFold();
  wireCover();
  wirePresentation();
  wireImmersive();
  wireSmoothScroll();
  wireStatCountUp();

  function wireSmoothScroll() {
    if (!window.Lenis || window.STORY.REDUCED || prefs.calm) return;
    // exponential ease-out: a wheel notch glides and settles instead of stepping; touch stays native
    lenis = new Lenis({
      duration: 1.2,
      easing: x => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
      smoothWheel: true,
      wheelMultiplier: .9,
      // opt-in: any scrollable panel marked data-lenis-prevent keeps its own wheel behaviour
      prevent: node => !!node.closest('[data-lenis-prevent]'),
    });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  // scroll helper the nav / step controls use -- Lenis when it's on, native otherwise
  function scrollToEl(el, block = 'start') {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: block === 'center' ? -(innerHeight - el.offsetHeight) / 2 : -8 });
    else el.scrollIntoView({ block, behavior: window.STORY.REDUCED ? 'auto' : 'smooth' });
  }

  // Count the stat tiles (`.sb-tile b`) up from zero the first time their block is on screen.
  function wireStatCountUp() {
    if (!window.countUp) return;
    const done = new WeakSet();
    const run = block => block.querySelectorAll('.sb-tile b').forEach(b => {
      if (done.has(b)) return;
      done.add(b);
      window.STORY.countUp(b);
    });
    const io = new IntersectionObserver(records => records.forEach(r => {
      if (!r.isIntersecting) return;
      run(r.target);
      // tiles are filled by an async hydrator -- retry briefly until they show up
      let tries = 16;
      const iv = setInterval(() => {
        run(r.target);
        if (--tries <= 0 || r.target.querySelector('.sb-tile b')) clearInterval(iv);
      }, 250);
    }), { threshold: 0.35 });
    document.querySelectorAll('[data-block]').forEach(el => {
      if (el.querySelector('[data-role="chart"]')) io.observe(el);
    });
  }

  // ------------------------------------------------------------ page chrome (slider.html)

  // A thin reading-progress line under the section jumper.
  function wireProgress() {
    const bar = document.createElement('div');
    bar.className = 'story-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i>';
    root.appendChild(bar);   // inside #story: the theme tokens are scoped to it
    const fill = bar.firstChild;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      fill.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0})`;
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    addEventListener('resize', paint, { passive: true });
    paint();
  }

  // Reveal-on-scroll: a block's heading / prose / media fade up one after another the first time
  // they come into view. Step blocks (tour / stage) choreograph themselves, so they're skipped;
  // immersive / print / reduced-motion show everything (see core.css `.rv`).
  function wireReveal() {
    if (window.STORY.REDUCED || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(records => records.forEach(r => {
      if (!r.isIntersecting) return;
      r.target.classList.add('rv-in');
      io.unobserve(r.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('.story-flow > .sb').forEach(block => {
      if (block.matches('.sb--tour, .sb--stage, .sb--cover')) return;
      const parts = block.querySelectorAll(':scope > .sb__body > *, :scope > .sb__media, :scope > .sb__heading-text');
      parts.forEach((part, i) => {
        part.classList.add('rv');
        part.style.transitionDelay = `${Math.min(i, 4) * 70}ms`;
        io.observe(part);
      });
    });
  }

  // Phones: a data block's long explanation folds behind a "Read more" toggle so the chart / map
  // it describes isn't pushed a screen down. Text-only blocks are the story itself -- never folded.
  function wireFold() {
    if (!matchMedia('(max-width: 700px)').matches) return;
    document.querySelectorAll('.sb--split .sb__prose, .sb--split-wide .sb__prose').forEach(prose => {
      if ((prose.textContent || '').trim().length < 380) return;
      prose.classList.add('is-folded');
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sb-fold-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Read more';
      toggle.addEventListener('click', () => {
        const open = prose.classList.toggle('is-folded') === false;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Show less' : 'Read more';
      });
      prose.after(toggle);
    });
  }

  // ------------------------------------------------------------ story section jumper (top bar)

  function buildStoryNav() {
    const flow = document.querySelector('.story-flow');
    if (!flow) return;
    const S = window.STORY;

    const sections = [...flow.querySelectorAll('[data-block]')].filter(el =>
      el.dataset.block === 'cover'
      || el.dataset.block === 'credits'
      || el.querySelector('.sb__title, .sb__heading-text')
    );
    if (sections.length < 2) return;

    const entries = sections.map((el, i) => {
      if (!el.id) el.id = 'sec-' + i;
      let label;
      if (el.dataset.block === 'cover') label = 'Overview';
      else if (el.dataset.block === 'credits') label = 'Sources';
      else label = (el.querySelector('.sb__eyebrow')
        || el.querySelector('.sb__title, .sb__heading-text')).textContent.trim();
      return { el, id: el.id, label };
    });

    // 10+ sections: the link strip slides horizontally inside a fixed-width window, keeping the
    // current section centred with its neighbours peeking in at the edges. Fewer than that and
    // they all fit, so the strip is centred and static (only the underline moves).
    const windowed = entries.length >= 10;

    const nav = document.createElement('nav');
    nav.className = 'story-nav' + (windowed ? ' is-windowed' : '');
    nav.setAttribute('aria-label', 'Story sections');
    nav.innerHTML =
      '<button type="button" class="story-nav-arrow" data-dir="-1" aria-label="Previous section">‹</button>'
      + '<div class="story-nav-window"><div class="story-nav-track" role="list" data-title="' + S.esc(root.dataset.title || '') + '">'
      + entries.map((e, i) =>
        `<a href="#${e.id}" role="listitem" data-idx="${i}">${S.esc(e.label)}</a>`).join('')
      + '</div></div>'
      + '<button type="button" class="story-nav-arrow" data-dir="1" aria-label="Next section">›</button>';
    root.appendChild(nav);   // inside #story: the theme tokens (--s-bg ...) are scoped to it

    const win = nav.querySelector('.story-nav-window');
    const track = nav.querySelector('.story-nav-track');
    const prev = nav.querySelector('[data-dir="-1"]');
    const next = nav.querySelector('[data-dir="1"]');
    const anchors = [...track.querySelectorAll('a')];
    let current = 0;

    const go = i => scrollToEl(entries[Math.max(0, Math.min(entries.length - 1, i))].el, 'start');

    // Contents: a drawer listing every section, opened by the ☰ button (or `c`).
    const toc = document.createElement('div');
    toc.className = 'story-toc';
    toc.hidden = true;
    toc.innerHTML = '<nav aria-label="Contents"><h2>' + S.esc(root.dataset.title || 'Contents') + '</h2><ol>'
      + entries.map((e, i) => `<li><a href="#${e.id}" data-idx="${i}">${S.esc(e.label)}</a></li>`).join('') + '</ol></nav>';
    root.appendChild(toc);
    const tocBtn = document.createElement('button');
    tocBtn.type = 'button';
    tocBtn.className = 'story-toc-btn';
    tocBtn.setAttribute('aria-label', 'Contents');
    tocBtn.setAttribute('aria-expanded', 'false');
    tocBtn.textContent = '☰';
    nav.insertBefore(tocBtn, nav.firstChild);
    const setToc = open => { toc.hidden = !open; tocBtn.setAttribute('aria-expanded', String(open)); };
    tocBtn.addEventListener('click', () => setToc(toc.hidden));
    toc.addEventListener('click', event => {
      const link = event.target.closest('a[data-idx]');
      if (link) { event.preventDefault(); setToc(false); go(Number(link.dataset.idx)); }
      else if (event.target === toc) setToc(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !toc.hidden) setToc(false);
      else if ((event.key === 'c' || event.key === 'C') && !event.metaKey && !event.ctrlKey && !event.altKey
        && !/input|textarea|select/i.test(event.target.tagName || '') && !document.body.classList.contains('story-presenting')) setToc(toc.hidden);
    });

    function paint() {
      root.dataset.sectionTone = String(current % 4);
      anchors.forEach((a, i) => {
        a.classList.toggle('is-current', i === current);
        a.toggleAttribute('aria-current', i === current);
      });
      prev.disabled = current <= 0;
      next.disabled = current >= entries.length - 1;
      if (!windowed) return;
      // slide the strip so the current link sits in the middle of the window, without
      // revealing empty space past either end
      const a = anchors[current];
      const centred = win.clientWidth / 2 - (a.offsetLeft + a.offsetWidth / 2);
      const x = Math.min(0, Math.max(win.clientWidth - track.scrollWidth, centred));
      track.style.transform = `translateX(${x}px)`;
    }

    track.addEventListener('click', event => {
      const link = event.target.closest('a[data-idx]');
      if (!link) return;
      event.preventDefault();
      go(Number(link.dataset.idx));
    });
    prev.addEventListener('click', () => go(current - 1));
    next.addEventListener('click', () => go(current + 1));
    addEventListener('resize', paint, { passive: true });

    // the current section is the last one whose start is above the reading line (so a long
    // section stays current while its start is off screen, as in presentation mode)
    let queued = false;
    const locate = () => {
      queued = false;
      const line = innerHeight * .45;
      let i = 0;
      entries.forEach((e, k) => { if (e.el.getBoundingClientRect().top <= line) i = k; });
      if (i !== current) { current = i; paint(); }
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(locate); } }, { passive: true });
    locate();

    wireSettings(nav);
    paint();
    requestAnimationFrame(paint);   // re-centre once fonts/widths settle
  }

  // ------------------------------------------------------------ settings (right end of the top bar)

  function wireSettings(nav) {
    const S = window.STORY;
    const label = n => n.charAt(0).toUpperCase() + n.slice(1);
    const languageLinks = [...document.querySelectorAll('.story-langs a')];
    const languageOptions = languageLinks.map(link =>
      `<option value="${S.esc(link.href)}"${link.hasAttribute('aria-current') ? ' selected' : ''}>${S.esc(link.textContent.trim())}</option>`
    ).join('');
    const wrap = document.createElement('div');
    wrap.className = 'story-settings' + (languageLinks.length > 1 ? ' has-languages' : '');
    wrap.innerHTML =
      '<button type="button" class="story-settings-btn" aria-label="Reading settings" aria-expanded="false" aria-haspopup="dialog"><span aria-hidden="true">⚙</span> Settings</button>'
      + '<div class="story-settings-panel" role="dialog" aria-label="Reading settings" hidden>'
      + '<h2>Reading settings</h2>'
      + (languageLinks.length > 1
        ? '<label class="story-settings-label" for="ssLanguage">Language</label><select id="ssLanguage">' + languageOptions + '</select>'
        : '')
      + '<p class="story-settings-label" id="ssStyle">Style</p>'
      + '<div class="story-settings-themes" role="radiogroup" aria-labelledby="ssStyle">'
      + THEMES.map(t => `<button type="button" role="radio" data-theme-pick="${S.esc(t)}" aria-checked="false">${S.esc(label(t))}</button>`).join('')
      + '</div>'
      + '<label class="story-settings-label" for="ssMap">Map</label>'
      + '<select id="ssMap">' + S.BASEMAPS.map(b => `<option value="${S.esc(b.id)}">${S.esc(b.label)}</option>`).join('') + '</select>'
      + '<label class="story-settings-label" for="ssSize">Text size <output data-out="size"></output></label>'
      + '<input type="range" id="ssSize" data-pref="size" min="0.85" max="1.5" step="0.05" />'
      + '<label class="story-settings-label" for="ssLead">Line spacing <output data-out="leading"></output></label>'
      + '<input type="range" id="ssLead" data-pref="leading" min="1.3" max="2" step="0.1" />'
      + '<label class="story-settings-label" for="ssWidth">Reading width <output data-out="width"></output></label>'
      + '<input type="range" id="ssWidth" data-pref="width" min="0.7" max="1.4" step="0.05" />'
      + '<label class="story-settings-label" for="ssFont">Font</label>'
      + '<select id="ssFont"><option value="">Theme default</option><option value="serif">Serif</option><option value="sans">Sans-serif</option><option value="mono">Monospace</option></select>'
      + '<label class="story-settings-label" for="ssAccent">Accent colour</label>'
      + '<input type="color" id="ssAccent" />'
      + '<label class="story-settings-check"><input type="checkbox" data-pref="contrast" /> High contrast</label>'
      + '<label class="story-settings-check"><input type="checkbox" data-pref="calm" /> Calm motion (no animations or smooth scroll)</label>'
      + '<label class="story-settings-check"><input type="checkbox" data-pref="noProgress" /> Hide reading-progress line</label>'
      + '<label class="story-settings-check"><input type="checkbox" data-pref="sectionTint" /> Subtle colour shift between sections</label>'
      + '<button type="button" class="story-settings-reset">Reset to story default</button>'
      + '</div>';
    nav.appendChild(wrap);

    const btn = wrap.querySelector('.story-settings-btn');
    const panel = wrap.querySelector('.story-settings-panel');
    const picks = [...wrap.querySelectorAll('[data-theme-pick]')];
    const language = wrap.querySelector('#ssLanguage');
    const font = wrap.querySelector('#ssFont');
    const mapPick = wrap.querySelector('#ssMap');
    const accent = wrap.querySelector('#ssAccent');
    const defaultTheme = ctx.theme;

    const DEFAULTS = { size: 1, leading: 1.6, width: 1 };
    const sync = () => {
      picks.forEach(b => b.setAttribute('aria-checked', String(b.dataset.themePick === ctx.theme)));
      wrap.querySelectorAll('input[type="range"][data-pref]').forEach(r => {
        const k = r.dataset.pref;
        r.value = Number(prefs[k]) || DEFAULTS[k];
        wrap.querySelector(`[data-out="${k}"]`).textContent = k === 'leading' ? r.value : Math.round(r.value * 100) + '%';
      });
      wrap.querySelectorAll('input[type="checkbox"][data-pref]').forEach(c => { c.checked = !!prefs[c.dataset.pref]; });
      font.value = prefs.font || '';
      mapPick.value = S.getBasemap();
      accent.value = prefs.accent || getComputedStyle(root).getPropertyValue('--s-accent').trim().replace(/^(#[0-9a-f]{3})$/i, (m, h) => '#' + [...h.slice(1)].map(c => c + c).join('')) || '#000000';
    };
    const savePrefs = () => store.set(PREFS_KEY, JSON.stringify(prefs));
    const setOpen = open => { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };

    btn.addEventListener('click', () => setOpen(panel.hidden));
    document.addEventListener('click', e => { if (!panel.hidden && !wrap.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); } });
    picks.forEach(b => b.addEventListener('click', () => {
      applyTheme(b.dataset.themePick);
      store.set(THEME_KEY, ctx.theme);
      sync();
    }));
    const change = (key, value) => { if (value === '' || value == null || value === false) delete prefs[key]; else prefs[key] = value; savePrefs(); applyPrefs(); sync(); };
    wrap.querySelectorAll('input[type="range"][data-pref]').forEach(r => r.addEventListener('input', () => change(r.dataset.pref, Number(r.value))));
    wrap.querySelectorAll('input[type="checkbox"][data-pref]').forEach(c => c.addEventListener('change', () => change(c.dataset.pref, c.checked)));
    if (language) language.addEventListener('change', () => window.location.assign(language.value));
    font.addEventListener('change', () => change('font', font.value));
    mapPick.addEventListener('change', () => S.setBasemap(mapPick.value));
    accent.addEventListener('input', () => change('accent', accent.value));
    wrap.querySelector('.story-settings-reset').addEventListener('click', () => {
      Object.keys(prefs).forEach(k => delete prefs[k]);
      store.set(PREFS_KEY, null);
      store.set(THEME_KEY, null);
      S.setBasemap(S.BASEMAPS[0].id);
      applyTheme(defaultTheme);
      applyPrefs();
      sync();
    });
    sync();
  }

  // ------------------------------------------------------------ cover: readtime + actions

  function wireCover() {
    const cover = document.querySelector('[data-block="cover"]');
    if (!cover) return;

    const readtime = cover.querySelector('[data-role="readtime"]');
    const estimate = () => {
      const words = (document.querySelector('.story-flow')?.textContent.match(/\S+/g) || []).length;
      if (readtime) readtime.textContent = `~${Math.max(1, Math.round(words / 220))} min read`;
    };
    estimate();
    setTimeout(estimate, 4000);

    cover.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        if (action === 'print') { window.print(); return; }
        if (action === 'present') { togglePresent(); return; }
        if (action === 'immerse') { toggleImmersive(); return; }
        if (action === 'share') {
          try {
            if (navigator.share) await navigator.share({ title: document.title, url: location.href });
            else {
              await navigator.clipboard.writeText(location.href);
              const label = button.textContent;
              button.textContent = 'Link copied';
              setTimeout(() => { button.textContent = label; }, 1800);
            }
          } catch { /* cancelled / denied -- not an error */ }
        }
      });
    });
  }

  // ------------------------------------------------------------ map actions
  // `[text](map:lon,lat,zoom)` in any prose becomes <a data-map-action>; clicking it flies the
  // nearest `map` / `guided-tour` block (same block first, else the closest one on the page) and scrolls to it.
  // fly the nearest map to lon/lat: the one in `own` if it is one, else the closest on the page
  function flyNearest(own, lon, lat, zoom, y = own.getBoundingClientRect().top) {
    const maps = [...document.querySelectorAll('.sb--map, .sb--guided-tour, .sb--deck-tour, .sb--buildings-3d, .sb--map-tour')].filter(el => el.storyMap);
    if (!maps.length) return;
    const target = maps.includes(own) ? own : maps.reduce((a, b) =>
      Math.abs(a.getBoundingClientRect().top - y) <= Math.abs(b.getBoundingClientRect().top - y) ? a : b);
    if (target !== own) scrollToEl(target, 'center');
    target.storyMap.flyTo({ center: [lon, lat], zoom: Number.isFinite(zoom) ? zoom : Math.max(target.storyMap.getZoom(), 12), essential: true });
  }
  window.STORY.flyNearest = flyNearest;

  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('a[data-map-action]');
    if (!link) return;
    event.preventDefault();
    const [lon, lat, zoom] = link.dataset.mapAction.split(',').map(Number);
    flyNearest(link.closest('.sb'), lon, lat, zoom, link.getBoundingClientRect().top);
  });

  // ------------------------------------------------------------ presentation mode
  //
  // A slide deck over the same flow (reveal.js-style): every block is a slide, and a cover or a
  // level-1/2 heading opens a new *section* (a column). <- / -> move between sections, up / down
  // (and Space) walk every block in order. O = overview grid, F = fullscreen, B = blackout,
  // ? = help, Esc = close the overview / exit. `#/N` deep-links to slide N and opens the deck;
  // a horizontal swipe changes section on touch. Blocks keep scrolling normally (the pinned
  // scrolly stages need it), the deck only snaps the view to the chosen block.

  let presentUI = null;

  const isPresenting = () => document.body.classList.contains('story-presenting');
  function blocks() { return [...document.querySelectorAll('.sb')]; }

  function nearestBlock() {
    const target = window.innerHeight / 2;
    let best = 0, bestDist = Infinity;
    blocks().forEach((b, i) => {
      const r = b.getBoundingClientRect();
      // a tall block (a scroll tour) that spans the centre line is the current one
      const d = r.top <= target && r.bottom >= target ? 0 : Math.abs(r.top + r.height / 2 - target);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  // sections: arrays of block indexes; a new one starts at the first block, a cover, or a
  // heading of level 1-2.
  function sections() {
    const out = [];
    blocks().forEach((b, i) => {
      // a `## Title {eyebrow=...}` merges into the block it titles, so an eyebrow marks a section too
      const opens = i === 0 || b.dataset.block === 'cover' || b.querySelector('.sb__eyebrow') ||
        (b.dataset.block === 'heading' && /sb--heading-[12]\b/.test(b.className));
      if (opens || !out.length) out.push([]);
      out[out.length - 1].push(i);
    });
    return out;
  }
  const sectionOf = i => Math.max(0, sections().findIndex(sec => sec.includes(i)));

  function slideTitle(b) {
    const t = b.querySelector('.sb__title, .co-title, h1, h2, h3, blockquote, p');
    return (t ? t.textContent : b.dataset.block).trim().replace(/\s+/g, ' ').slice(0, 90);
  }

  // The smallest step inside a block: a scroll tour's step cards, or a map tour's places (through
  // its `tourStep` / `tourEnter` hooks). Read from the DOM so it works before a block has hydrated.
  const tourSteps = block => [...block.querySelectorAll('.gt-step')];
  let lastStep = null;                        // { el, at }: smooth scrolling is still under way
  function currentStep(steps) {
    if (lastStep && Date.now() - lastStep.at < 2500 && steps.includes(lastStep.el)) return steps.indexOf(lastStep.el);
    const target = window.innerHeight / 2;
    let best = 0, bestDist = Infinity;
    steps.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - target);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }

  // `last` = arriving from below: a tour block then opens on its last step, not its first
  function goTo(i, last = false) {
    const list = blocks();
    if (!list.length) return;
    const block = list[Math.min(list.length - 1, Math.max(0, i))];
    const steps = tourSteps(block);
    if (block.tourEnter) block.tourEnter(last);
    else if (steps.length) {
      lastStep = { el: steps[last ? steps.length - 1 : 0], at: Date.now() };
      scrollToEl(lastStep.el, 'center');
    }
    else scrollToEl(block, 'center');
    setTimeout(progress, 380);
  }

  // up / down: the next smallest step -- a tour's step or place, else the next block
  function step(delta) {
    const block = blocks()[nearestBlock()];
    const steps = block ? tourSteps(block) : [];
    if (steps.length) {
      const n = currentStep(steps) + delta;
      if (n >= 0 && n < steps.length) {
        lastStep = { el: steps[n], at: Date.now() };
        scrollToEl(steps[n], 'center'); setTimeout(progress, 380); return;
      }
    } else if (block && block.tourStep && block.tourStep(delta)) { setTimeout(progress, 380); return; }
    goTo(nearestBlock() + delta, delta < 0);
  }

  function hop(delta) {                       // left / right: between sections
    const secs = sections(), at = sectionOf(nearestBlock());
    goTo(secs[Math.min(secs.length - 1, Math.max(0, at + delta))][0]);
  }

  function progress() {
    if (!presentUI) return;
    const i = nearestBlock(), total = blocks().length;
    const secs = sections(), s = sectionOf(i);
    presentUI.querySelector('.story-present-progress').textContent =
      `${i + 1} / ${total} · §${s + 1}/${secs.length}`;
    const bar = presentUI.querySelector('.story-present-bar i');
    if (bar) bar.style.transform = `scaleX(${total > 1 ? i / (total - 1) : 1})`;
    if (isPresenting()) history.replaceState(null, '', `#/${i + 1}`);
  }

  function toggleOverview(force) {
    let ov = document.querySelector('.story-overview');
    const open = force === undefined ? !ov : force;
    if (!open) { if (ov) ov.remove(); return; }
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'story-overview';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Slide overview');
    const list = blocks(), here = nearestBlock();
    sections().forEach((sec, si) => {
      const col = document.createElement('div');
      col.className = 'story-overview-col';
      sec.forEach(i => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'story-overview-card' + (i === here ? ' is-current' : '');
        card.innerHTML = '<small></small><span></span>';
        card.querySelector('small').textContent = `${i + 1} · ${list[i].dataset.block}`;
        card.querySelector('span').textContent = slideTitle(list[i]);
        card.onclick = () => { toggleOverview(false); goTo(i); };
        col.appendChild(card);
      });
      ov.appendChild(col);
    });
    ov.addEventListener('click', e => { if (e.target === ov) toggleOverview(false); });
    document.getElementById('story').appendChild(ov);
    const cur = ov.querySelector('.is-current');
    if (cur) cur.scrollIntoView({ block: 'center', inline: 'center' });
  }

  function toggleHelp(force) {
    let h = document.querySelector('.story-help');
    const open = force === undefined ? !h : force;
    if (!open) { if (h) h.remove(); return; }
    if (h) return;
    h = document.createElement('div');
    h.className = 'story-help';
    h.innerHTML = '<div><h3>Keyboard</h3><dl>' + [
      ['← →', 'previous / next section'], ['↑ ↓ · Space', 'previous / next slide'],
      ['Home · End', 'first / last slide'], ['O', 'overview'], ['F', 'fullscreen'],
      ['B · .', 'blackout'], ['?', 'this help'], ['Esc', 'close · exit'],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl></div>';
    h.onclick = () => toggleHelp(false);
    document.getElementById('story').appendChild(h);
  }

  function toggleBlackout() {
    const el = document.querySelector('.story-blackout');
    if (el) el.remove();
    else {
      const b = document.createElement('div');
      b.className = 'story-blackout';
      b.onclick = toggleBlackout;
      document.body.appendChild(b);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }

  function setPresent(on, at) {
    if (on && document.body.classList.contains('story-immersive')) setImmersive(false);
    document.body.classList.toggle('story-presenting', on);
    const button = document.querySelector('[data-action="present"]');
    if (button) { button.textContent = on ? 'Exit presentation' : 'Present'; button.setAttribute('aria-pressed', String(on)); }
    presentUI = document.querySelector('.story-present-ui');
    if (presentUI) {
      presentUI.hidden = !on;
      presentUI.querySelector('.story-present-exit').onclick = () => setPresent(false);
      for (const [role, fn] of [['prev', () => step(-1)], ['next', () => step(1)],
                                ['overview', () => toggleOverview()], ['fullscreen', toggleFullscreen]]) {
        const el = presentUI.querySelector(`[data-present="${role}"]`);
        if (el) el.onclick = fn;
      }
    }
    if (!on) {
      toggleOverview(false); toggleHelp(false);
      const bo = document.querySelector('.story-blackout'); if (bo) bo.remove();
      if (document.fullscreenElement) document.exitFullscreen();
      if (/^#\/\d+$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    if (at !== undefined) goTo(at); else progress();
  }
  const togglePresent = () => setPresent(!isPresenting());

  function wirePresentation() {
    document.addEventListener('keydown', event => {
      if (!isPresenting() || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'iframe'].includes(tag)) return;
      const k = event.key;
      if (k === 'Escape') {
        if (document.querySelector('.story-help')) toggleHelp(false);
        else if (document.querySelector('.story-overview')) toggleOverview(false);
        else if (document.querySelector('.story-blackout')) toggleBlackout();
        else setPresent(false);
        return;
      }
      if (k === 'o' || k === 'O') toggleOverview();
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else if (k === 'b' || k === 'B' || k === '.') toggleBlackout();
      else if (k === '?') toggleHelp();
      else if (document.querySelector('.story-overview')) return;
      else if (k === 'ArrowRight') hop(1);
      else if (k === 'ArrowLeft') hop(-1);
      else if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !event.shiftKey)) step(1);
      else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && event.shiftKey)) step(-1);
      else if (k === 'Home') goTo(0);
      else if (k === 'End') goTo(9999);
      else return;
      event.preventDefault();
    });

    window.addEventListener('scroll', () => { if (isPresenting()) progress(); }, { passive: true });

    let tx = 0, ty = 0;                       // horizontal swipe = next / previous section
    document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!isPresenting() || document.querySelector('.story-overview')) return;
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 70 && Math.abs(dx) > 1.6 * Math.abs(dy)) hop(dx < 0 ? 1 : -1);
    }, { passive: true });

    // `#/N` or `?present` opens the deck (at slide N)
    const m = location.hash.match(/^#\/(\d+)$/);
    const auto = new URLSearchParams(location.search).has('present');
    if (m || auto) window.addEventListener('load', () => setTimeout(() => setPresent(true, m ? Number(m[1]) - 1 : 0), 400));
  }

  // ------------------------------------------------------------ immersive mode
  //
  // The story as a dashboard. Nothing is moved: each step (a block, or one step of a guided-tour /
  // photo-scenes / stat-cards) is shown in place as a panel over a full-viewport stage. The stage
  // is the shared MapLibre map once a step asks for one (a `focus`, a mapped block type, or the
  // story's `immerse` view) and then stays, flying where steps tell it; with no map the step's own
  // picture fills the background. Wheel, arrow keys and the `‹ N/M ›` bar walk the steps.

  let scene = null;           // { map, base, view }
  let steps = [];             // [{ block, part }]
  let at = -1;
  let immerseBar = null;
  let sceneSeq = 0;
  let wheelAt = 0;

  const isImmersive = () => document.body.classList.contains('story-immersive');

  // block type -> which S.mapViews preset the shared map shows for it
  const SCENE_VIEW = {
    'exposure-map': 'exposure', 'taxonomy-map': 'taxonomy',
    'risk': 'risk', 'hazard': 'hazard', 'swipe': 'risk',
  };

  const blockConfig = block => {
    const raw = block.querySelector(':scope > [data-block-config]');
    try { return raw ? JSON.parse(raw.textContent) : {}; } catch { return {}; }
  };

  function viewFor({ block }) {
    const type = block.dataset.block;
    return type === 'guided-tour' ? blockConfig(block).view || 'risk' : SCENE_VIEW[type] || null;
  }

  function focusFor({ block, part }) {
    if (part && part.dataset.focus) {
      try { return JSON.parse(part.dataset.focus); } catch { /* malformed -- ignore */ }
    }
    return part ? null : blockConfig(block).focus || null;
  }

  async function buildScene() {
    if (scene) return scene;
    const host = document.createElement('div');
    host.id = 'story-scene';
    root.appendChild(host);
    const map = window.STORY.makeMap(host);
    map.keyboard.disable();   // arrow keys walk the steps; they don't pan the map
    scene = { map, base: null, view: null };
    await sceneView(root.dataset.immerse || (ctx.scenario ? 'risk' : ctx.iso3 ? 'exposure' : ''));
    return scene;
  }

  // Swap the map to another S.mapViews preset: drop what the previous one added, build the new
  // one. `scene.view` is claimed up front so a burst of steps doesn't race two builds.
  async function sceneView(name) {
    if (!name || name === scene.view) return;
    const S = window.STORY;
    scene.view = name;
    try { scene.base && scene.base.cleanup && scene.base.cleanup(); } catch { /* ignore */ }
    for (const id of ['gt-loss', 'gt-ent', 'gt-dates', 'gt-pga']) {
      if (scene.map.getLayer(id)) scene.map.removeLayer(id);
      if (scene.map.getSource(id)) scene.map.removeSource(id);
    }
    let base = null;
    try { base = S.mapViews[name] ? await S.mapViews[name](scene.map, ctx) : null; }
    catch (e) { console.error('scene view', name, e); }
    if (scene.view !== name) return;   // a newer step already moved on
    scene.base = base;
    scene.map.getContainer().classList.toggle('is-empty', !base);
    if (base && base.fit) base.fit();
  }

  // No map: the step's own picture fills the background behind its panel.
  function paintBackdrop(el) {
    const img = el && el.querySelector('img[src]');
    const src = img && (img.currentSrc || img.src);
    let back = document.getElementById('story-backdrop');
    if (!src) { if (back) back.remove(); return; }
    if (!back) {
      back = document.createElement('div');
      back.id = 'story-backdrop';
      back.setAttribute('aria-hidden', 'true');
      root.insertBefore(back, root.firstChild);
    }
    back.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
  }

  async function showStep(i) {
    if (!steps.length) return;
    const prev = steps[at];
    if (prev) { prev.block.classList.remove('imm-on'); prev.part && prev.part.classList.remove('imm-current'); }
    at = Math.min(steps.length - 1, Math.max(0, i));
    const step = steps[at], el = step.part || step.block;
    step.block.classList.add('imm-on');
    if (step.part) step.part.classList.add('imm-current');
    paintCount();

    const view = viewFor(step), focus = focusFor(step);
    const wants = Boolean(view || focus || root.dataset.immerse);
    const mapped = wants || Boolean(scene && scene.base);
    document.body.classList.toggle('imm-map', mapped);
    document.body.classList.toggle('imm-wide', !step.part && Boolean(el.querySelector('canvas, table, .sb__figure')));
    paintBackdrop(mapped ? null : el);
    if (!wants) return;

    const seq = ++sceneSeq;
    try {
      await buildScene();
      if (seq !== sceneSeq) return;
      await sceneView(view);
      if (seq !== sceneSeq) return;   // a later step already took over
      const cam = scene.base && scene.base.resolve ? scene.base.resolve(focus) : (focus && focus.center ? focus : null);
      if (cam) scene.map.flyTo({ ...cam, duration: window.STORY.cameraMs(1200) });
      else if (scene.base && scene.base.fit) scene.base.fit();
    } catch (e) { console.error('immersive step', e); }
  }

  const stepBy = delta => showStep(at + delta);

  function paintCount() {
    immerseBar.querySelector('.story-immerse-count').textContent = `${at + 1} / ${steps.length}`;
    immerseBar.querySelector('[data-go="-1"]').disabled = at <= 0;
    immerseBar.querySelector('[data-go="1"]').disabled = at >= steps.length - 1;
  }

  function buildBar() {
    const bar = document.createElement('div');
    bar.className = 'story-immerse-ui';
    bar.hidden = true;
    bar.innerHTML =
      '<button type="button" data-go="-1" aria-label="Previous step">‹</button>'
      + '<span class="story-immerse-count" aria-live="polite"></span>'
      + '<button type="button" data-go="1" aria-label="Next step">›</button>'
      + '<button type="button" data-go="exit" class="story-immerse-exit">Exit ✕</button>';
    bar.addEventListener('click', event => {
      const hit = event.target.closest('[data-go]');
      if (!hit) return;
      if (hit.dataset.go === 'exit') setImmersive(false); else stepBy(Number(hit.dataset.go));
    });
    document.body.appendChild(bar);
    return bar;
  }

  function setImmersive(on) {
    if (on && isPresenting()) setPresent(false);
    if (on === isImmersive()) return;
    immerseBar = immerseBar || buildBar();
    document.body.classList.toggle('story-immersive', on);
    const button = document.querySelector('[data-action="immerse"]');
    if (button) {
      button.textContent = on ? 'Exit immersive' : 'Immersive';
      button.setAttribute('aria-pressed', String(on));
    }
    immerseBar.hidden = !on;
    if (lenis) { if (on) lenis.stop(); else lenis.start(); }   // the stage owns the wheel

    if (!on) {
      sceneSeq++;
      document.querySelectorAll('.imm-on, .imm-current').forEach(el => el.classList.remove('imm-on', 'imm-current'));
      document.body.classList.remove('imm-map', 'imm-wide');
      paintBackdrop(null);
      return;
    }
    steps = [...document.querySelectorAll('.story-flow > .sb')].flatMap(block => {
      const parts = [...block.querySelectorAll('[data-imm-step]')];
      return parts.length ? parts.map(part => ({ block, part })) : [{ block, part: null }];
    });
    const near = blocks()[nearestBlock()];
    at = -1;
    showStep(Math.max(0, steps.findIndex(s => s.block === near)));
  }
  const toggleImmersive = () => setImmersive(!isImmersive());

  function wireImmersive() {
    document.addEventListener('keydown', event => {
      if (!isImmersive() || event.metaKey || event.ctrlKey || event.altKey) return;
      if (['input', 'textarea', 'select'].includes((event.target.tagName || '').toLowerCase())) return;
      const k = event.key;
      if (k === 'Escape') setImmersive(false);
      else if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(k) || (k === ' ' && !event.shiftKey)) stepBy(1);
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k) || (k === ' ' && event.shiftKey)) stepBy(-1);
      else if (k === 'Home') showStep(0);
      else if (k === 'End') showStep(steps.length - 1);
      else return;
      event.preventDefault();
    });

    // wheel steps through the story, except over the map (zoom) or a panel that can still scroll
    document.addEventListener('wheel', event => {
      if (!isImmersive() || event.target.closest('#story-scene, [data-lenis-prevent]')) return;
      const panel = event.target.closest('.imm-on');
      const down = event.deltaY > 0;
      if (panel && (down ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1 : panel.scrollTop > 0)) return;
      event.preventDefault();
      if (Math.abs(event.deltaY) < 8 || event.timeStamp - wheelAt < 600) return;
      wheelAt = event.timeStamp;
      stepBy(down ? 1 : -1);
    }, { passive: false });
  }
})();
