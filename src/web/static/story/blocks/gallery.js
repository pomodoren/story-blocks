// gallery -- click a photo to open it in a lightbox (arrows / swipe / Esc, caption underneath).
window.STORY_BLOCKS['gallery'] = function (el, config) {
  const S = window.STORY;
  const items = [...el.querySelectorAll('.ga-item')];
  if (!items.length) return;
  let box = null, at = 0;

  const show = i => {
    at = (i + items.length) % items.length;
    const fig = items[at];
    const img = fig.querySelector('img');
    const cap = fig.querySelector('figcaption');
    box.querySelector('img').src = img.currentSrc || img.src;
    box.querySelector('img').alt = img.alt;
    box.querySelector('.ga-cap').innerHTML = cap ? cap.innerHTML : '';
    box.querySelector('.ga-count').textContent = `${at + 1} / ${items.length}`;
  };
  const close = () => {
    if (!box) return;
    document.removeEventListener('keydown', onKey);
    box.remove(); box = null;
    document.body.classList.remove('ga-locked');
    items[at].querySelector('.ga-open').focus({ preventScroll: true });
  };
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(at + 1);
    else if (e.key === 'ArrowLeft') show(at - 1);
  };
  const open = i => {
    box = document.createElement('div');
    box.className = 'ga-box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<button type="button" class="ga-x" aria-label="Close">✕</button>
      <button type="button" class="ga-nav ga-prev" aria-label="Previous">‹</button>
      <figure><img alt="" /><figcaption><div class="ga-cap"></div><small class="ga-count"></small></figcaption></figure>
      <button type="button" class="ga-nav ga-next" aria-label="Next">›</button>`;
    // #story owns the theme tokens, so the box lives inside it
    document.getElementById('story').appendChild(box);
    document.body.classList.add('ga-locked');
    box.addEventListener('click', e => {
      if (e.target.closest('.ga-x') || e.target === box) close();
      else if (e.target.closest('.ga-prev')) show(at - 1);
      else if (e.target.closest('.ga-next')) show(at + 1);
    });
    let x0 = null;
    box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', onKey);
    show(i);
    box.querySelector('.ga-x').focus();
  };
  items.forEach((fig, i) => fig.querySelector('.ga-open').addEventListener('click', () => open(i)));
};
