// scroll-chart -- the red fill grows and a marker rides the line as the figure travels up the
// viewport (the "scrubbed" chart from whoownsthealbaniancoast.com). The SVG is server-rendered;
// this only clips the fill to a growing rect, so without JS (or with reduced motion) the whole
// line shows. Progress is eased toward its target every frame, so wheel notches never jerk it.
window.STORY_BLOCKS['scroll-chart'] = function (el) {
  const S = window.STORY;
  const fig = el.querySelector('.sx-chart');
  const svg = fig && fig.querySelector('.sx-svg');
  const clipped = svg && svg.querySelector('.sx-fill-clip');
  if (!clipped || S.REDUCED) return;

  let pts = [];
  try { pts = JSON.parse(fig.dataset.pts); } catch { /* chart still draws, marker stays put */ }
  const W = Number(fig.dataset.w) || 1000;
  const H = svg.viewBox.baseVal.height;
  const NS = 'http://www.w3.org/2000/svg';
  const id = `sx-clip-${Math.random().toString(36).slice(2, 8)}`;
  const clip = document.createElementNS(NS, 'clipPath');
  const rect = document.createElementNS(NS, 'rect');
  clip.id = id;
  rect.setAttribute('height', H);
  rect.setAttribute('width', 0);
  clip.appendChild(rect);
  svg.insertBefore(clip, svg.firstChild);
  clipped.setAttribute('clip-path', `url(#${id})`);
  const mark = svg.querySelector('.sx-mark');
  fig.classList.add('is-live');

  const target = () => {
    const vh = innerHeight || 800;
    const top = fig.getBoundingClientRect().top;
    const start = vh * .98, end = vh * .1;
    return Math.min(1, Math.max(0, (start - top) / (start - end)));
  };

  let shown = target(), goal = shown, raf = 0, visible = false;
  const paint = () => {
    raf = 0;
    shown += (goal - shown) * .14;                 // ease: smooth, never lags more than a few frames
    if (Math.abs(goal - shown) < .0005) shown = goal;
    const cx = shown * W;
    rect.setAttribute('width', cx.toFixed(1));
    if (mark && pts.length) {
      let cy = pts[0][1];
      for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] >= cx) {
          const a = pts[i - 1], b = pts[i];
          cy = a[1] + (b[1] - a[1]) * ((cx - a[0]) / ((b[0] - a[0]) || 1));
          break;
        }
        cy = pts[i][1];
      }
      mark.setAttribute('cx', cx.toFixed(1));
      mark.setAttribute('cy', cy.toFixed(1));
      mark.style.opacity = shown > .004 && shown < .996 ? '1' : '0';
    }
    if (visible && shown !== goal) raf = requestAnimationFrame(paint);
  };
  const onScroll = () => { goal = target(); if (!raf) raf = requestAnimationFrame(paint); };

  // only listen while the figure is near the viewport
  new IntersectionObserver(records => {
    visible = records[0].isIntersecting;
    if (visible) onScroll();
  }, { rootMargin: '20% 0px' }).observe(fig);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  paint();
};
