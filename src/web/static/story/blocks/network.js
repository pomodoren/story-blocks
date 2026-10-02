// network -- an authored relationship network (Cytoscape) from `nodes` + `edges`.
//   node: {id, label, group, size, color, note}   edge: {source, target, label, weight}
//   colors: {group: "#hex"}   layout: cose | concentric | breadthfirst | circle | grid
// Click a node to highlight its neighbourhood; the typed text filters by label. Without
// Cytoscape the server-rendered connection list stays visible.
window.STORY_BLOCKS['network'] = function (el, config) {
  if (!window.cytoscape) return;
  const S = window.STORY;
  const root = el.querySelector('[data-role="network"]');
  const bar = root.querySelector('.sb-net__bar');
  const canvas = root.querySelector('.sb-net__canvas');
  const details = root.querySelector('.sb-net__details');
  const css = name => getComputedStyle(document.getElementById('story')).getPropertyValue(name).trim();
  const ink = css('--s-fg') || '#222', muted = css('--s-muted') || '#777', line = css('--s-border') || '#ccc';
  const palette = [S.accent(), '#37b6c9', '#f2b53c', '#8a8f98', '#a64ac9', '#3c9d5d'];
  const groupColor = {};
  const colorOf = node => node.color || (groupColor[node.group] ??= (config.colors || {})[node.group]
    || palette[Object.keys(groupColor).length % palette.length]);

  const degree = {};
  for (const e of config.edges) {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  }
  const elements = [
    ...config.nodes.map(n => ({ data: {
      id: String(n.id), label: n.label || String(n.id), group: n.group || '', note: n.note || '',
      color: colorOf(n), size: n.size ?? Math.round(14 + Math.min(22, Math.sqrt(degree[n.id] || 0) * 6)) } })),
    ...config.edges.map((e, i) => ({ data: {
      id: `e${i}`, source: String(e.source), target: String(e.target), label: e.label || '', weight: e.weight ?? 1 } })),
  ];

  root.querySelector('.sb-net__list').hidden = true;
  bar.hidden = canvas.hidden = details.hidden = false;
  const cy = cytoscape({
    container: canvas, elements, minZoom: 0.2, maxZoom: 3, wheelSensitivity: 0.18,
    style: [
      { selector: 'node', style: { label: 'data(label)', 'font-size': 10, color: ink, 'text-wrap': 'ellipsis', 'text-max-width': 90,
        'text-valign': 'bottom', 'text-margin-y': 4, 'background-color': 'data(color)', width: 'data(size)', height: 'data(size)',
        'border-width': 1.5, 'border-color': css('--s-surface') || '#fff' } },
      { selector: 'edge', style: { width: 'mapData(weight, 0, 10, 1, 5)', 'line-color': line, opacity: 0.8, 'curve-style': 'bezier' } },
      { selector: '.faded', style: { opacity: 0.12, 'text-opacity': 0.15 } },
      { selector: 'node.focused', style: { 'border-width': 3, 'border-color': ink } },
      { selector: 'edge.focused', style: { 'line-color': muted, opacity: 1, label: 'data(label)', 'font-size': 9, color: ink,
        'text-rotation': 'autorotate', 'text-background-color': css('--s-surface') || '#fff', 'text-background-opacity': 0.9 } },
      { selector: '.hit', style: { 'border-width': 4, 'border-color': S.accent() } },
    ],
  });

  const layout = (name, fit = true) => {
    const options = { name, fit, padding: 30, animate: !S.REDUCED && cy.nodes().length < 150, animationDuration: 400 };
    if (name === 'cose') Object.assign(options, { nodeRepulsion: 9000, idealEdgeLength: 70, randomize: true });
    if (name === 'concentric') Object.assign(options, { concentric: n => n.degree(), levelWidth: () => 2 });
    if (name === 'breadthfirst') Object.assign(options, { directed: false, roots: cy.nodes().sort((a, b) => b.degree() - a.degree()).slice(0, 1) });
    cy.layout(options).run();
  };
  const reset = () => {
    cy.elements().removeClass('faded focused');
    details.textContent = 'Click a node to highlight its connections.';
  };
  const focus = node => {
    cy.elements().addClass('faded').removeClass('focused');
    node.closedNeighborhood().removeClass('faded').addClass('focused');
    const parts = [node.data('group'), `${node.degree()} connection${node.degree() === 1 ? '' : 's'}`, node.data('note')];
    const title = document.createElement('strong');
    title.textContent = node.data('label');
    details.replaceChildren(title, ` ${parts.filter(Boolean).join(' · ')}`);
  };

  cy.on('tap', 'node', e => focus(e.target));
  cy.on('tap', e => { if (e.target === cy) reset(); });
  root.querySelector('.sb-net__layout').addEventListener('change', e => layout(e.target.value));
  root.querySelector('.sb-net__search')?.addEventListener('input', e => {
    const query = e.target.value.trim().toLowerCase();
    cy.nodes().removeClass('hit');
    if (!query) return;
    const hits = cy.nodes().filter(n => n.data('label').toLowerCase().includes(query));
    hits.addClass('hit');
    if (hits.length) cy.animate({ fit: { eles: hits, padding: 80 }, duration: S.REDUCED ? 0 : 250 });
  });
  new ResizeObserver(() => cy.resize()).observe(canvas);
  reset();
  layout(config.layout);
};
