// stat-cards -- big-number cards (slider.html's "key names" journey). Desktop: the stage pins
// and scrolling walks a focus card through the deck, counting its number up; past the last card
// they all open into a grid. Phone: a swipeable row with dots. Without this script the block is
// just the grid (the CSS default), so the content never depends on it.
//
// config: { cards: [{value, unit, title, text, tag, image}] }
window.STORY_BLOCKS['stat-cards'] = function (el) {
  const S = window.STORY;
  const journey = el.querySelector('.sc-journey');
  const stage = el.querySelector('.sc-stage');
  const row = el.querySelector('.sc-cards');
  const cards = [...el.querySelectorAll('.sc-card')];
  const dotsHost = S.slot(el, 'dots');
  const narrow = matchMedia('(max-width: 700px)');
  const values = cards.map(c => c.querySelector('.sc-value'));

  // ---------------------------------------------------------------- phone: swipe row + dots
  const dots = [];
  if (dotsHost && cards.length > 1) {
    cards.forEach((card, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Card ${i + 1}`);
      dot.addEventListener('click', () => {
        if (narrow.matches) {
          card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: S.REDUCED ? 'auto' : 'smooth' });
        } else if (journey.classList.contains('is-live')) {
          // jump the pinned journey to the middle of this card's stretch of scroll
          const pinned = Math.max(1, journey.offsetHeight - innerHeight);
          const top = scrollY + journey.getBoundingClientRect().top + (i + 0.5) * pinned / (cards.length + 1);
          scrollTo({ top, behavior: S.REDUCED ? 'auto' : 'smooth' });
        }
      });
      dotsHost.appendChild(dot);
      dots.push(dot);
    });
    dotsHost.hidden = false;
  }
  const paintDots = i => dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  const nearestCard = () => {
    const mid = row.scrollLeft + row.clientWidth / 2;
    let best = 0, dist = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  };
  row.addEventListener('scroll', () => { if (narrow.matches) paintDots(nearestCard()); }, { passive: true });

  // ---------------------------------------------------------------- desktop: the pinned journey
  let focus = -2;      // -1 = grid revealed, 0..n-1 = that card is the focus
  const setFocus = next => {
    if (next === focus) return;
    focus = next;
    const grid = next === -1;
    stage.classList.toggle('is-grid', grid);
    cards.forEach((c, i) => c.classList.toggle('is-focus', i === next));
    paintDots(grid ? -1 : next);
    if (grid) { values.forEach(v => { v.textContent = v.dataset.raw || v.textContent; }); return; }
    if (next >= 0) S.countUp(values[next]);
  };

  const place = () => {
    if (narrow.matches || !journey.classList.contains('is-live')) return;
    const r = journey.getBoundingClientRect();
    const pinned = Math.max(1, journey.offsetHeight - innerHeight);
    const progress = Math.min(Math.max(-r.top, 0), pinned);
    // n segments for the cards, one more for the open grid at the end
    const seg = Math.min(cards.length, Math.floor(progress / (pinned / (cards.length + 1))));
    setFocus(seg >= cards.length ? -1 : seg);
  };

  const sync = () => {
    const live = !narrow.matches && cards.length > 1;
    journey.classList.toggle('is-live', live);
    if (live) { focus = -2; place(); }
    else {
      stage.classList.remove('is-grid');
      cards.forEach(c => c.classList.remove('is-focus'));
      values.forEach(v => { v.textContent = v.dataset.raw || v.textContent; });
      focus = -2;
      paintDots(nearestCard());
    }
  };
  narrow.addEventListener('change', sync);

  let raf = 0;
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place(); }); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  // remember each number's rendered text before any count-up rewrites it
  values.forEach(v => { v.dataset.raw = v.textContent.trim(); });
  sync();
};
