// kpi -- count each figure up once when the row scrolls into view.
window.STORY_BLOCKS['kpi'] = function (el) {
  const S = window.STORY;
  const values = [...el.querySelectorAll('.kp-value')];
  if (!values.length) return;
  if (S.REDUCED || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(records => {
    if (!records.some(r => r.isIntersecting)) return;
    io.disconnect();
    values.forEach(v => S.countUp(v));
  }, { threshold: .35 });
  io.observe(el.querySelector('.kp-row'));
};
