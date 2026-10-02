// photo-scenes -- a pinned full-bleed photo that changes as each scene card scrolls past
// (`mode: float`, the default), or a pinned tile grid that scrubs one scene into a big focus
// card and then reveals the whole grid as a hoverable gallery (`mode: grid`). Pure DOM: photos
// are <img>s already in the markup, cross-faded / dimmed by class; nothing here needs an API.
//
// config: { mode: "float"|"grid", scenes: [{title, text, image, alt_image, pos, tag, accent,
//           caption, stat, stat_unit}] }
window.STORY_BLOCKS['photo-scenes'] = function (el, config) {
  const S = window.STORY;
  if (config && config.mode === 'grid') wireGrid(el, S);
  else wireFloat(el, S);
};

function wireFloat(el, S) {
  const stage = el.querySelector('.ps-stage');
  const scenes = [...el.querySelectorAll('.ps-scene')];
  const rail = S.slot(el, 'rail');
  const dots = [];

  if (rail && scenes.length > 1) {
    scenes.forEach((scene, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Scene ${i + 1}`);
      dot.addEventListener('click', () => S.scrollTo(scene, 'center'));
      rail.appendChild(dot);
      dots.push(dot);
    });
  }

  const showPhoto = (i, alt) => {
    el.querySelectorAll('.ps-bg').forEach(fig => {
      fig.classList.toggle('is-on', Number(fig.dataset.i) === i && Number(fig.dataset.a) === (alt ? 1 : 0));
    });
  };

  let active = -1;
  const activate = i => {
    if (i === active || i < 0) return;
    active = i;
    scenes.forEach((s, k) => s.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
    const alt = scenes[i].querySelector('.ps-alt');
    showPhoto(i, alt && alt.getAttribute('aria-pressed') === 'true');
    // the accent follows the scene: rail, number and card edge all read --acc
    const acc = scenes[i].style.getPropertyValue('--acc');
    if (acc) stage.style.setProperty('--acc', acc); else stage.style.removeProperty('--acc');
    stage.classList.toggle('is-past-first', i > 0);
  };

  el.querySelectorAll('.ps-alt').forEach(btn => btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Back to the first photo' : 'Show the other photo';
    showPhoto(Number(btn.dataset.i), on);
  }));

  el.classList.add('is-live');   // cards start hidden only once this script is driving them
  S.watchSteps(scenes, activate);
  activate(0);
}

// Grid-reveal-focus: a tall pinned stage scrubs through two phases as the reader scrolls its
// `.pg-spacer` sibling -- first one tile at a time into a big `.pg-focus` overlay (with a
// count-up stat, if the scene has one), then a "reveal" phase where every tile fades up to full
// opacity and becomes a hoverable/tappable gallery. Desktop only (see wireGrid's early return) --
// phones get the plain stacked-card fallback already handled by core.css.
function wireGrid(el, S) {
  if (matchMedia('(max-width: 700px)').matches) return;   // static stacked layout, no pin needed

  const journey = el.querySelector('.pg-journey');
  const stage = el.querySelector('.pg-stage');
  const grid = S.slot(el, 'grid');
  const focus = S.slot(el, 'focus');
  const tiles = [...el.querySelectorAll('.pg-tile')];
  if (!journey || !stage || !grid || !focus || !tiles.length) return;

  tiles.forEach(tile => tile.addEventListener('click', () => {
    if (grid.classList.contains('is-reveal')) tile.classList.toggle('is-open');
  }));

  function setFocus(tile) {
    const img = tile.querySelector('img');
    const tag = tile.querySelector('.pg-tile-tag');
    const title = tile.querySelector('.pg-tile-title');
    const note = tile.querySelector('.pg-tile-note');
    const stat = tile.dataset.stat;
    focus.innerHTML =
      (img ? `<div class="pg-focus-port"><img src="${S.esc(img.getAttribute('src'))}" alt=""></div>` : '')
      + '<div class="pg-focus-info">'
      + (tag ? `<div class="pg-focus-tag">${S.esc(tag.textContent)}</div>` : '')
      + (stat ? `<p class="pg-focus-big"><b class="pg-focus-num">${S.esc(stat)}</b><span>${S.esc(tile.dataset.statUnit || '')}</span></p>` : '')
      + (title ? `<h3 class="pg-focus-title">${S.esc(title.textContent)}</h3>` : '')
      + (note ? `<div class="pg-focus-note">${note.innerHTML}</div>` : '')
      + '</div>';
    const num = focus.querySelector('.pg-focus-num');
    if (num) S.countUp(num);
  }

  function highlight(i) {
    tiles.forEach((tile, k) => tile.classList.toggle('is-hot', k === i));
  }

  let revealed = false;
  function setReveal(on) {
    if (on === revealed) return;
    revealed = on;
    focus.classList.toggle('is-gone', on);
    grid.classList.toggle('is-reveal', on);
    stage.classList.toggle('is-revealed', on);
  }

  let cur = -1;
  function place() {
    const r = journey.getBoundingClientRect();
    const vh = innerHeight;
    const h = journey.offsetHeight;
    if (r.top >= 0) { stage.classList.remove('is-fixed', 'is-bottom'); }
    else if (r.bottom <= vh) { stage.classList.remove('is-fixed'); stage.classList.add('is-bottom'); }
    else { stage.classList.add('is-fixed'); stage.classList.remove('is-bottom'); }

    const pinned = Math.max(1, h - vh);
    const prog = Math.min(Math.max(-r.top, 0), pinned);
    const revStart = Math.max(1, pinned - vh);
    if (prog >= revStart) { setReveal(true); return; }
    setReveal(false);
    const per = Math.max(0, Math.min(tiles.length - 1, Math.floor(prog / (revStart / tiles.length))));
    if (per !== cur) { cur = per; setFocus(tiles[per]); highlight(per); }
  }

  let running = false;
  function loop() { if (!running) return; place(); requestAnimationFrame(loop); }
  if ('IntersectionObserver' in window) {
    // only run the per-frame pin math while the stage is anywhere near the viewport
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { if (!running) { running = true; requestAnimationFrame(loop); } }
      else { running = false; place(); }
    }), { rootMargin: '60% 0px 60% 0px' });
    io.observe(journey);
  } else {
    addEventListener('scroll', place, { passive: true });
    addEventListener('resize', place);
  }

  el.classList.add('is-live');
  setFocus(tiles[0]);
  highlight(0);
  place();
}
