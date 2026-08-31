const state = {
  year: 2026,
  vision: 'real',
  compare: 'budget',
  tab: 'cash',
  page0: null,
  page4: null,
};

const fmtK = (n) => {
  if (n === null || n === undefined) return 'n.d.';
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n/1000000).toLocaleString('fr-FR', {maximumFractionDigits: 2}) + ' M€';
  if (abs >= 1000) return (n/1000).toLocaleString('fr-FR', {maximumFractionDigits: 0}) + ' k€';
  return n.toLocaleString('fr-FR') + ' €';
};

const MONTH_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

async function loadData() {
  const [p0, p4, pCash, pPerf, pPerfMonthly, pGraph1, pGraph2, pGraph3, pMM12, pPerfKpi] = await Promise.all([
    fetch('data/page0.json').then(r => r.json()),
    fetch('data/page4.json').then(r => r.json()),
    fetch('data/page_cash.json').then(r => r.json()),
    fetch('data/page_perf.json').then(r => r.json()),
    fetch('data/page_perf_monthly.json').then(r => r.json()),
    fetch('data/page_graph1.json').then(r => r.json()),
    fetch('data/page_graph2.json').then(r => r.json()),
    fetch('data/page_graph3.json').then(r => r.json()),
    fetch('data/page_mm12.json').then(r => r.json()),
    fetch('data/page_perf_kpi.json').then(r => r.json()),
  ]);
  state.page0 = p0;
  state.page4 = p4;
  state.pageCash = pCash;
  state.pagePerf = pPerf;
  state.pagePerfMonthly = pPerfMonthly;
  state.pageGraph1 = pGraph1;
  state.pageGraph2 = pGraph2;
  state.pageGraph3 = pGraph3;
  state.pageMM12 = pMM12;
  state.pagePerfKpi = pPerfKpi;
}

const MONTH_LABELS_FR = ['Jan','Fev','Mar','Avr','Mai','Juin','Juil','Aout','Sep','Oct','Nov','Dec'];
function bucketLabel(key) {
  if (key === 'N-1' || key === 'N-2' || key === 'Unknown') return key;
  const m = parseInt(key, 10);
  return MONTH_LABELS_FR[m - 1] || key;
}

// Grouped bar chart (2 bar series + optional dashed target line), used by the Graphiques tab.
// categories: array of display labels. seriesN1/seriesN: arrays of numbers (may include negatives).
// opts.lineSeries: optional array of numbers (e.g. Budget), drawn as a dashed line with labels.
// Fixed viewBox shared by every call so the 3 chart rectangles render at the exact same
// size (same aspect ratio, scaled to fit the panel width — no scrolling). Categories always
// spread out to fill this fixed width, so a chart with fewer categories (graph 3, 12) gets
// wider per-category slots than one with more (graph 1, 15) rather than a narrower chart.
const GRAPH_VB_W = 1500, GRAPH_VB_H = 340;

function groupedBarChartSVG(categories, seriesN1, seriesN, opts) {
  opts = opts || {};
  const w = GRAPH_VB_W, h = GRAPH_VB_H, padL = 24, padR = 24, padT = 56, padB = 34;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const allVals = [...seriesN1, ...seriesN, ...(opts.lineSeries || [])].map(v => v || 0);
  const minVal = Math.min(0, ...allVals);
  const maxVal = Math.max(...allVals, 1) * 1.2;
  const range = (maxVal - minVal) || 1;
  const n = categories.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.32, 40);
  const yFor = (v) => padT + innerH - ((v - minVal) / range) * innerH;
  const y0 = yFor(0);

  // Rough text metrics for the bold 9.5px bar/line labels, used only for collision avoidance.
  const estW = (s) => s.length * 6.1;
  const LABEL_H = 13;
  const boxFor = (x, y, text, anchor) => {
    const tw = estW(text);
    const x0 = anchor === 'start' ? x : anchor === 'end' ? x - tw : x - tw / 2;
    return { x0, x1: x0 + tw, y0: y - LABEL_H, y1: y + 3 };
  };
  const overlaps = (a, b) => a.x0 < b.x1 + 2 && a.x1 > b.x0 - 2 && a.y0 < b.y1 + 2 && a.y1 > b.y0 - 2;

  let bars = '';
  const linePoints = [];
  const barLabelBoxes = [];
  categories.forEach((cat, i) => {
    const cx = padL + slot * i + slot / 2;
    const v1 = seriesN1[i] || 0, v2 = seriesN[i] || 0;
    const x1 = cx - barW - 2, x2 = cx + 2;
    if (v1) {
      const y1 = yFor(v1), by1 = Math.min(y1, y0), bh1 = Math.abs(y1 - y0);
      const lx = x1 + barW / 2, ly2 = by1 - 6, txt = fmtK(v1);
      bars += `<rect x="${x1.toFixed(1)}" y="${by1.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh1.toFixed(1)}" rx="2" fill="var(--series-1-light)"/>
        <text class="bar-chart-bar-label" x="${lx.toFixed(1)}" y="${ly2.toFixed(1)}" fill="var(--series-1-light)">${txt}</text>`;
      barLabelBoxes.push(boxFor(lx, ly2, txt, 'middle'));
    }
    if (v2) {
      const y2 = yFor(v2), by2 = Math.min(y2, y0), bh2 = Math.abs(y2 - y0);
      const lx = x2 + barW / 2, ly2 = by2 - 6, txt = fmtK(v2);
      bars += `<rect x="${x2.toFixed(1)}" y="${by2.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh2.toFixed(1)}" rx="2" fill="var(--series-1)"/>
        <text class="bar-chart-bar-label" x="${lx.toFixed(1)}" y="${ly2.toFixed(1)}" fill="var(--series-1)">${txt}</text>`;
      barLabelBoxes.push(boxFor(lx, ly2, txt, 'middle'));
    }
    bars += `<text class="bar-chart-cat-label" x="${cx.toFixed(1)}" y="${(h - 8).toFixed(1)}">${cat}</text>`;
    if (opts.lineSeries) {
      const lv = opts.lineSeries[i];
      if (lv !== null && lv !== undefined) {
        linePoints.push({ x: cx, y: yFor(lv), v: lv, x1, x2 });
      }
    }
  });

  // Place budget labels avoiding collisions with any bar label (own column or a
  // neighbouring one) and with budget labels already placed for earlier points.
  const placedBoxes = [];
  linePoints.forEach((p) => {
    const txt = fmtK(p.v);
    const candidates = [
      { x: p.x, y: p.y - 14, anchor: 'middle' },
      { x: p.x, y: p.y - 30, anchor: 'middle' },
      { x: p.x2 + barW + 6, y: p.y + 3, anchor: 'start' },
      { x: p.x1 - 6, y: p.y + 3, anchor: 'end' },
      { x: p.x, y: p.y - 46, anchor: 'middle' },
    ];
    let chosen = candidates[0];
    for (const c of candidates) {
      const box = boxFor(c.x, c.y, txt, c.anchor);
      const hit = barLabelBoxes.some(b => overlaps(box, b)) || placedBoxes.some(b => overlaps(box, b));
      if (!hit) { chosen = c; break; }
    }
    placedBoxes.push(boxFor(chosen.x, chosen.y, txt, chosen.anchor));
    p.tx = chosen.x; p.ty = chosen.y; p.anchor = chosen.anchor;
  });

  let lineSvg = '';
  if (linePoints.length) {
    const path = linePoints.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    lineSvg = `<path d="${path}" fill="none" stroke="var(--series-2)" stroke-width="2.5" stroke-dasharray="6 4"/>` +
      linePoints.map(p => `<text class="bar-chart-bar-label" x="${p.tx.toFixed(1)}" y="${p.ty.toFixed(1)}" style="text-anchor:${p.anchor}" fill="var(--series-2)">${fmtK(p.v)}</text>`).join('');
  }

  return `<div class="bar-chart-wrap"><svg class="bar-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <line class="gridline" x1="${padL}" x2="${w - padR}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" />
    ${bars}
    ${lineSvg}
  </svg></div>`;
}

// Generic vertical bar chart (SVG), used by the "Graphiques" tab.
// items: [{label, value, color}]
function barChartSVG(items) {
  const w = 900, h = 240, padL = 20, padR = 20, padT = 30, padB = 34;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxVal = Math.max(...items.map(i => i.value || 0), 1) * 1.15;
  const n = items.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.5, 90);
  const bars = items.map((it, i) => {
    const cx = padL + slot * i + slot / 2;
    const bh = ((it.value || 0) / maxVal) * innerH;
    const y = padT + innerH - bh;
    return `<rect x="${(cx - barW/2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(bh,0).toFixed(1)}" rx="3" fill="${it.color}" />
      <text class="bar-chart-bar-label" x="${cx.toFixed(1)}" y="${(y - 8).toFixed(1)}">${fmtK(it.value)}</text>
      <text class="bar-chart-cat-label" x="${cx.toFixed(1)}" y="${(h - 10).toFixed(1)}">${it.label}</text>`;
  }).join('');
  return `<div class="bar-chart-wrap"><svg class="bar-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <line class="gridline" x1="${padL}" x2="${w - padR}" y1="${padT + innerH}" y2="${padT + innerH}" />
    ${bars}
  </svg></div>`;
}

function currentSlice() {
  return state.page0[`${state.year}_${state.vision}`];
}

function currentSlice4() {
  return state.page4[`${state.year}_${state.vision}`];
}

function kpiTile(label, value, deltaText, deltaClass, valueClass) {
  return `<div class="kpi-tile">
    <div class="label">${label}</div>
    <div class="value${valueClass ? ' ' + valueClass : ''}">${value}</div>
    ${deltaText ? `<div class="delta ${deltaClass || 'muted'}">${deltaText}</div>` : ''}
  </div>`;
}

function budgetDelta(ca, budget) {
  if (budget === null || budget === undefined || budget === 0) {
    return { text: 'Budget n.d.', cls: 'muted' };
  }
  const pct = (ca / budget) * 100;
  const cls = pct >= 100 ? 'good' : (pct >= 80 ? 'muted' : 'critical');
  return { text: `${pct.toFixed(0)}% du budget`, cls };
}

// Generic CA vs. reference-value (budget OR N-1) comparison, used by the gauge rows.
// A null/zero/negative reference (e.g. N-1 net of avoirs on a small catch-all line) has no
// meaningful ratio, so it's treated as "n.d." rather than rendering a nonsensical percentage.
function compareDelta(ca, ref) {
  if (ref === null || ref === undefined || ref <= 0) {
    return { pct: null, text: 'n.d.', cls: 'muted' };
  }
  const pct = (ca / ref) * 100;
  const cls = pct >= 100 ? 'good' : (pct >= 80 ? 'muted' : 'critical');
  return { pct, text: `${pct.toFixed(0)}%`, cls };
}

function compareLabel() {
  return state.compare === 'budget' ? 'Budget' : `N-1 (${state.year - 1})`;
}

// Item 2 — pure KPI synthesis, Réalisé only, no per-spécialité (AT) detail.
// Each typology gets one gauge row showing CA against BOTH Budget and N-1 at once
// (two markers on the same track), stacked vertically per Kevin's request.
function renderSynthese() {
  const d = state.page0[`${state.year}_real`];
  const n1 = d.n1 || {};
  const budgetTotals = d.budget_totals || {};

  // Le CA Digital affiché ici agrège "CA Digital Axis/Len" et "CA Digital Bewink" — soit la ligne
  // "Chiffre d'affaires Digital" du fichier source. Les 4 typologies bouclent ainsi sur le CA total.
  const sumKeys = (o, keys) => {
    const vals = keys.map(k => o[k]).filter(v => typeof v === 'number');
    return vals.length ? vals.reduce((s, v) => s + v, 0) : undefined;
  };
  const DIGITAL_KEYS = ['digital_total', 'bewink'];

  const typologies = [
    { key: 'total_ca', label: 'CA total', total: true },
    { keys: DIGITAL_KEYS, label: 'CA Digital' },
    { key: 'presse_total', label: 'CA Presse' },
    { key: 'congres_total', label: 'CA Congrès' },
    { key: 'ds_total', label: 'CA DS' },
  ];

  const rows = typologies.map(t => {
    const ca = (t.keys ? sumKeys(d, t.keys) : d[t.key]) || 0;
    const budget = t.keys ? sumKeys(budgetTotals, t.keys) : budgetTotals[t.key];
    const n1v = t.keys ? sumKeys(n1, t.keys) : n1[t.key];
    const maxVal = Math.max(ca, budget || 0, n1v || 0, 1) * 1.15;
    const caPct = Math.max((ca / maxVal) * 100, 0);
    const budgetPct = (budget && budget > 0) ? (budget / maxVal) * 100 : null;
    const n1Pct = (n1v && n1v > 0) ? (n1v / maxVal) * 100 : null;
    const bd = compareDelta(ca, budget);
    const n1d = compareDelta(ca, n1v);
    const overTarget = budget && budget > 0 && ca >= budget;
    return `<div class="gauge-row dual-marker${t.total ? ' total-row-first' : ''}">
      <div class="gauge-name">${t.label}</div>
      <div class="gauge-track">
        <div class="gauge-fill${t.total ? ' total-fill' : (overTarget ? ' over-target' : '')}" style="width:${caPct}%"></div>
        ${budgetPct !== null ? `<div class="gauge-target budget-marker" style="left:${budgetPct}%"><span class="gauge-target-label">Budget ${fmtK(budget)}</span></div>` : ''}
        ${n1Pct !== null ? `<div class="gauge-target n1-marker" style="left:${n1Pct}%"><span class="gauge-target-label n1-label">N-1 ${fmtK(n1v)}</span></div>` : ''}
      </div>
      <div class="gauge-stats">
        <div class="gauge-ca">${fmtK(ca)}</div>
        <div class="gauge-cmp">vs Budget : ${bd.text} · vs N-1 : ${n1d.text}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('main').innerHTML = `
    <div class="panel">
      <h2>Synthèse CA Global — Réalisé</h2>
      <div class="panel-sub">${state.year} — vue d'ensemble par typologie, comparée à Budget et N-1</div>
      <div class="legend">
        <div class="item"><span class="swatch" style="background:var(--series-1)"></span>CA réalisé</div>
        <div class="item"><span class="swatch" style="background:var(--good)"></span>CA ≥ Budget</div>
        <div class="item"><span class="swatch" style="background:var(--series-2)"></span>Budget (repère)</div>
        <div class="item"><span class="swatch" style="background:var(--series-4)"></span>N-1 (repère)</div>
        <div class="item"><span class="swatch" style="background:var(--total-color)"></span>CA total (somme des lignes ci-dessus)</div>
      </div>
      ${rows}
      <div class="footnote">
        ${d.source === 'computed_fallback_no_master_tab'
          ? `Cette combinaison n'existe pas encore dans le fichier maître — chiffres calculés depuis "Source Reporting commercial 2026" en attendant.`
          : `Chiffres, Budget et N-1 repris directement de l'onglet "0. Synthèse CA Global ${state.year}" du fichier "Reporting Commercial 2026" (colonnes G, I et K). La ligne "CA Digital" agrège "CA Digital Axis/Len" et "CA Digital Bewink", soit la ligne "Chiffre d'affaires Digital" du fichier source ; le détail par aire thérapeutique, qui porte sur le seul périmètre Axis/Len, est dans l'onglet "CA Digital par AT".`}
      </div>
    </div>
  `;
}

// Item 1 — weekly cash position tracker, from "00.Position Cash".
function renderCash() {
  const series = state.pageCash;
  const latest = series[series.length - 1];
  const w = 1000, h = 260, padL = 60, padR = 10, padT = 16, padB = 28;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxVal = Math.max(...series.map(s => s.total), 1) * 1.05;
  const n = series.length;
  const x = (i) => padL + (i / (n - 1)) * innerW;
  const y = (v) => padT + innerH - (v / maxVal) * innerH;

  const linePath = series.map((s, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(s.total).toFixed(1)).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const yy = padT + innerH * (1 - f);
    return `<line class="gridline" x1="${padL}" x2="${w - padR}" y1="${yy}" y2="${yy}" />
      <text class="axis-label" x="${padL - 8}" y="${yy + 3}" text-anchor="end">${fmtK(maxVal * f)}</text>`;
  }).join('');

  const xLabels = series.map((s, i) => {
    const [yy, mm] = s.date.split('-');
    if (mm !== '01' || i === 0) return '';
    if (i !== 0 && series[i-1].date.split('-')[0] === yy) return '';
    return `<text class="axis-label" x="${x(i)}" y="${h - 8}" text-anchor="middle">${yy}</text>`;
  }).join('');

  // Génération de cash sur N mois glissants : delta entre la dernière position connue et
  // le point hebdomadaire le plus proche de "aujourd'hui - N mois" dans la série.
  const closestEntry = (targetDate) => {
    let best = null, bestDiff = Infinity;
    for (const s of series) {
      const diff = Math.abs(new Date(s.date + 'T00:00:00Z') - targetDate);
      if (diff < bestDiff) { bestDiff = diff; best = s; }
    }
    return best;
  };
  const latestDate = new Date(latest.date + 'T00:00:00Z');
  const generation = (months) => {
    const target = new Date(latestDate);
    target.setUTCMonth(target.getUTCMonth() - months);
    if (target < new Date(series[0].date + 'T00:00:00Z')) return null;
    const ref = closestEntry(target);
    return latest.total - ref.total;
  };

  const genTile = (label, months) => {
    const delta = generation(months);
    if (delta === null) return kpiTile(label, 'n.d.', 'historique insuffisant', 'muted');
    const cls = delta >= 0 ? 'good' : 'warn';
    return kpiTile(label, `${delta >= 0 ? '+' : ''}${fmtK(delta)}`, null, null, cls);
  };

  const kpis = [
    kpiTile('Position Cash', fmtK(latest.total), `au ${new Date(latest.date).toLocaleDateString('fr-FR')}`, 'muted'),
    genTile('Génération cash 12 mois', 12),
    genTile('Génération cash 6 mois', 6),
    genTile('Génération cash 3 mois', 3),
  ];

  document.getElementById('main').innerHTML = `
    <div class="kpi-row">${kpis.join('')}</div>
    <div class="panel">
      <h2>Position Cash — tendance hebdomadaire</h2>
      <div class="panel-sub">Trésorerie totale, suivi hebdomadaire depuis 2023</div>
      <div class="chart-wrap">
        <svg class="line-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
          ${gridLines}
          <path d="${linePath}" fill="none" stroke="var(--series-1)" stroke-width="2" />
          ${xLabels}
        </svg>
      </div>
      <div class="footnote">
        Repris directement de l'onglet "00.Position Cash" du fichier "Reporting Commercial 2026" (mise à jour hebdomadaire côté fichier maître).
        Génération cash = écart entre la position actuelle et la position à la date la plus proche il y a 12/6/3 mois.
      </div>
    </div>
  `;
}

function renderGlobal() {
  const d = currentSlice();
  const visionLabel = state.vision === 'real' ? 'Réalisé' : 'Commandé';
  const cmpLabel = compareLabel();

  const refField = state.compare === 'budget' ? 'budget' : 'n1';
  const totalRef = state.compare === 'budget'
    ? (d.digital_by_spe.reduce((s, r) => s + (r.budget || 0), 0) || null)
    : (d.digital_n1_total || null);
  const digitalDelta = compareDelta(d.digital_total, totalRef);

  // Petites vignettes : position à date + avancement vs N-1 et vs Budget, toujours affichés
  // ensemble (indépendamment du toggle vs Budget/vs N-1 qui ne pilote que le repère des jauges).
  const totalBudgetDigital = d.digital_by_spe.reduce((s, r) => s + (r.budget || 0), 0) || null;
  const n1AdvanceDelta = compareDelta(d.digital_total, d.digital_n1_total);
  const budgetAdvanceDelta = compareDelta(d.digital_total, totalBudgetDigital);
  const kpis = [
    kpiTile('Position à date — CA Digital', fmtK(d.digital_total), `Vision ${visionLabel} · ${state.year}`, 'muted'),
    kpiTile('Avancement vs N-1', n1AdvanceDelta.text, d.digital_n1_total ? fmtK(d.digital_n1_total) : 'N-1 n.d.', n1AdvanceDelta.cls),
    kpiTile('Avancement vs Budget', budgetAdvanceDelta.text, totalBudgetDigital ? fmtK(totalBudgetDigital) : 'Budget n.d.', budgetAdvanceDelta.cls),
  ];

  // Le total a sa propre échelle (comme chaque ligne de l'onglet Synthèse) : sa couleur foncée le
  // distingue des barres par AT ci-dessous, qui partagent entre elles une échelle commune.
  const maxValTotal = Math.max(d.digital_total, totalRef || 0, 1) * 1.06;
  const totalCaPct = Math.max((d.digital_total / maxValTotal) * 100, 0);
  const totalRefPct = (totalRef && totalRef > 0) ? (totalRef / maxValTotal) * 100 : null;
  const totalRow = `<div class="gauge-row total-row-first">
    <div class="gauge-name">CA Digital total</div>
    <div class="gauge-track">
      <div class="gauge-fill total-fill" style="width:${totalCaPct}%"></div>
      ${totalRefPct !== null ? `<div class="gauge-target" style="left:${totalRefPct}%"><span class="gauge-target-label">${fmtK(totalRef)}</span></div>` : ''}
    </div>
    <div class="gauge-stats">
      <div class="gauge-ca">${fmtK(d.digital_total)}</div>
      <div class="gauge-cmp">${cmpLabel} : ${totalRef !== null && totalRef !== undefined ? fmtK(totalRef) : 'n.d.'}</div>
    </div>
    <div class="gauge-pct ${digitalDelta.cls}">${digitalDelta.text}</div>
  </div>`;

  const maxVal = Math.max(...d.digital_by_spe.map(r => Math.max(r.ca, r[refField] || 0)), 1) * 1.06;

  const gaugeRows = d.digital_by_spe.map(r => {
    const ref = r[refField];
    const caPct = Math.max((r.ca / maxVal) * 100, 0);
    const refPct = (ref && ref > 0) ? (ref / maxVal) * 100 : null;
    const delta = compareDelta(r.ca, ref);
    const overTarget = ref !== null && ref !== undefined && ref > 0 && r.ca >= ref;
    return `<div class="gauge-row">
      <div class="gauge-name">${r.spe}</div>
      <div class="gauge-track">
        <div class="gauge-fill${overTarget ? ' over-target' : ''}" style="width:${caPct}%"></div>
        ${refPct !== null ? `<div class="gauge-target" style="left:${refPct}%"><span class="gauge-target-label">${fmtK(ref)}</span></div>` : ''}
      </div>
      <div class="gauge-stats">
        <div class="gauge-ca">${fmtK(r.ca)}</div>
        <div class="gauge-cmp">${cmpLabel} : ${ref !== null && ref !== undefined ? fmtK(ref) : 'n.d.'}</div>
      </div>
      <div class="gauge-pct ${delta.cls}">${delta.text}</div>
    </div>`;
  }).join('');

  // Bewink : entité suivie à part dans le fichier source (section "BEWINK", distincte du bloc
  // "DIGITAL"). Elle n'est pas une spécialité médicale et n'entre pas dans "CA Digital Axis/Len",
  // d'où une ligne dédiée, hors du total ci-dessus.
  const bewinkCa = d.bewink;
  const bewinkRef = state.compare === 'budget'
    ? (d.budget_totals || {}).bewink
    : (d.n1 || {}).bewink;
  let bewinkRow = '';
  if (bewinkCa !== undefined && bewinkCa !== null) {
    // Même échelle que les lignes par AT ci-dessus : une jauge à l'échelle propre donnerait à
    // Bewink (62 k€) une barre plus longue qu'une AT à 200 k€, ce qui est trompeur.
    const bCaPct = Math.max((bewinkCa / maxVal) * 100, 0);
    const bRefPct = (bewinkRef && bewinkRef > 0) ? Math.min((bewinkRef / maxVal) * 100, 100) : null;
    const bDelta = compareDelta(bewinkCa, bewinkRef);
    bewinkRow = `<div class="gauge-row total-row-first">
      <div class="gauge-name">Bewink <span style="opacity:.6;font-weight:400">(hors total)</span></div>
      <div class="gauge-track">
        <div class="gauge-fill" style="width:${bCaPct}%"></div>
        ${bRefPct !== null ? `<div class="gauge-target" style="left:${bRefPct}%"><span class="gauge-target-label">${fmtK(bewinkRef)}</span></div>` : ''}
      </div>
      <div class="gauge-stats">
        <div class="gauge-ca">${fmtK(bewinkCa)}</div>
        <div class="gauge-cmp">${cmpLabel} : ${bewinkRef !== null && bewinkRef !== undefined ? fmtK(bewinkRef) : 'n.d.'}</div>
      </div>
      <div class="gauge-pct ${bDelta.cls}">${bDelta.text}</div>
    </div>`;
  }

  document.getElementById('main').innerHTML = `
    <div class="kpi-row">${kpis.join('')}</div>

    <div class="panel">
      <h2>CA Digital par spécialité médicale</h2>
      <div class="panel-sub">Vision ${visionLabel} — ${state.year} · comparé à : ${cmpLabel}</div>
      <div class="legend">
        <div class="item"><span class="swatch" style="background:var(--total-color)"></span>CA Digital total</div>
        <div class="item"><span class="swatch" style="background:var(--series-1)"></span>CA ${visionLabel.toLowerCase()}</div>
        <div class="item"><span class="swatch" style="background:var(--good)"></span>CA ≥ ${cmpLabel}</div>
        <div class="item"><span class="swatch" style="background:var(--series-2)"></span>${cmpLabel} (repère)</div>
      </div>
      ${totalRow}
      ${gaugeRows}
      ${bewinkRow}
      <div class="footnote">
        ${bewinkRow ? `Bewink n'est pas une spécialité médicale : c'est une section distincte du fichier source, hors du "CA Digital total" ci-dessus qui porte sur le seul périmètre Axis/Len. Elle est en revanche bien intégrée à la ligne "CA Digital" de l'onglet "Synthèse CA Global". ` : ''}
        ${d.source === 'computed_fallback_no_master_tab'
          ? `Le fichier "Reporting Commercial 2026" ne contient pas encore de vue "Commandé" pour 2027 — ces chiffres sont recalculés depuis "Source Reporting commercial 2026" en attendant.`
          : `Ces chiffres sont repris directement des onglets "${state.vision === 'real' ? '0. Synthèse CA Global ' + state.year : 'test 0. Synthèse CA Global 2026'}" du fichier "Reporting Commercial 2026" (CA, N-1 et budget par spécialité, colonnes G/K/I).`}
        ${state.vision === 'cde' && d.source !== 'computed_fallback_no_master_tab' ? ` Presse/Congrès n'ont pas de date de commande dans le fichier maître : ils affichent 0 en vision Commandé, conformément à cet onglet. Le détail Presse/Congrès/DS est disponible dans l'onglet "Synthèse CA Global".` : ''}
      </div>
    </div>
  `;
}

// Item 4 — the 3 bar-graph tab ("graph bâton"), rebuilt from deal-level rows in the master's
// GESTION sheets (2026GESTION / 2025GESTION), per Kevin's exact spec walkthrough :
//
// Graph 1 — "CA commandé sécurisé sur N" : pour les commandes dont la réalisation tombe en
// année N, ventilées par mois de COMMANDE si la commande a aussi été passée en N (Jan-Déc),
// ou regroupées en bloc "N-1"/"N-2" si la commande a été passée l'année d'avant / plus tôt.
// Deux séries : N (2026, depuis "2026GESTION") et N-1 (2025, depuis "2025GESTION"), chacune
// calculée avec sa propre année de référence.
//
// Graph 2 — "CA Digital réalisé sur N" : CA ventilé par mois de RÉALISATION, peu importe la
// date de commande. Le bucket "Unknown" = CA déjà commandé mais dont la réalisation tombe sur
// une année future (au-delà de N), confirmé par Kevin.
//
// Graph 3 — Prise de commande mensuelle Digital 2025 vs 2026 + Budget 2026 en courbe, repris
// directement du bloc "TOTAL DIGITAL" de l'onglet "2. Synthèse Digital Perf Com" (lignes R25/B26/R26).
//
// Ces 3 graphes sont fixés sur 2025/2026 (le fichier maître n'a pas d'onglet GESTION 2027) —
// pas de toggle année sur cet onglet.
function renderGraphs() {
  const g1 = state.pageGraph1;
  const g2 = state.pageGraph2;
  const g3 = state.pageGraph3;

  const g1Cats = g1.buckets.map(bucketLabel);
  const g2Cats = g2.buckets.map(bucketLabel);
  const g3Cats = MONTH_LABELS_FR;

  document.getElementById('main').innerHTML = `
    <div class="panel graph-panel">
      <h2>CA commandé sécurisé sur ${g1.year_n}</h2>
      <div class="panel-sub">Ventilé par mois de commande (si commande et réalisation tombent sur la même année) ; N-1/N-2 = commandes plus anciennes dont la réalisation tombe sur ${g1.year_n}</div>
      <div class="legend">
        <div class="item"><span class="swatch" style="background:var(--series-1-light)"></span>Digital ${g1.year_n1}</div>
        <div class="item"><span class="swatch" style="background:var(--series-1)"></span>Digital ${g1.year_n}</div>
      </div>
      ${groupedBarChartSVG(g1Cats, g1.n1, g1.n)}
      <div class="footnote">Reconstruit à partir des lignes de commande Digital des onglets "2026GESTION" et "2025GESTION" (date commande / date de réalisation).</div>
    </div>

    <div class="panel graph-panel">
      <h2>CA Digital réalisé sur ${g2.year_n}</h2>
      <div class="panel-sub">Ventilé par mois de réalisation, quelle que soit la date de commande. "Unknown" = CA déjà commandé dont la réalisation est prévue sur une année future.</div>
      <div class="legend">
        <div class="item"><span class="swatch" style="background:var(--series-1-light)"></span>Digital ${g2.year_n1}</div>
        <div class="item"><span class="swatch" style="background:var(--series-1)"></span>Digital ${g2.year_n}</div>
      </div>
      ${groupedBarChartSVG(g2Cats, g2.n1, g2.n)}
      <div class="footnote">Reconstruit à partir des lignes de commande Digital des onglets "2026GESTION" et "2025GESTION" (date de réalisation).</div>
    </div>

    <div class="panel graph-panel">
      <h2>Prise de commande Digital mensuelle</h2>
      <div class="panel-sub">Digital ${g3.year_n1} vs ${g3.year_n}, comparé au Budget ${g3.year_n}</div>
      <div class="legend">
        <div class="item"><span class="swatch" style="background:var(--series-1-light)"></span>Digital ${g3.year_n1}</div>
        <div class="item"><span class="swatch" style="background:var(--series-1)"></span>Digital ${g3.year_n}</div>
        <div class="item"><span class="swatch" style="background:var(--series-2)"></span>Budget ${g3.year_n} (courbe)</div>
      </div>
      ${groupedBarChartSVG(g3Cats, g3.n1, g3.n, { lineSeries: g3.budget })}
      <div class="footnote">Repris directement du bloc "TOTAL DIGITAL" de l'onglet "2. Synthèse Digital Perf Com" du fichier "Reporting Commercial 2026".</div>
    </div>
  `;
}

// Item 5 — Perf. Commerciale: one zone per commercial (MA/PG/JV/JE), each with the same
// bar+budget-curve chart as "Synthèse CA Digital" graph 3 (Digital, monthly, own data) plus
// 4 badges: Total Digital (reste à commander ce mois + fin d'année, overlaid on the chart
// itself), and 3 tiles above — Presse, Congrès, Total combiné (couleur différente). Presse/
// Congrès n'existent pas ventilés par commercial dans le fichier maître "Reporting Commercial
// 2026" (Digital seul y est détaillé par personne) — ces chiffres viennent de l'onglet "KPI"
// du fichier séparé "KPI 2026" (celui qui alimente l'onglet KPI Hebdo par importrange), qui
// lui répartit Presse/Congrès par commercial. Reste à commander = Budget − CA déjà commandé
// (recalculé nous-mêmes à partir de CA/Budget pour éviter une incohérence de signe entre les
// blocs Digital et Congrès de ce fichier source).
function monthlyArrays(monthsList) {
  const r25 = new Array(12).fill(0), r26 = new Array(12).fill(0), b26 = new Array(12).fill(0);
  monthsList.forEach(m => { r25[m.m - 1] = m.r25; r26[m.m - 1] = m.r26; b26[m.m - 1] = m.b26; });
  return { r25, r26, b26 };
}

function perfTiles(kpi) {
  return `
    <div class="kpi-tile">
      <div class="label">CA Digital (FY)</div>
      <div class="value">${fmtK(kpi.digital.caFY)}</div>
      <div class="delta accent">Reste à commander fin d'année : ${fmtK(kpi.digital.resteFY)}</div>
    </div>
    <div class="kpi-tile">
      <div class="label">CA Presse (FY)</div>
      <div class="value">${fmtK(kpi.presse.caFY)}</div>
      <div class="delta accent">Reste à commander fin d'année : ${fmtK(kpi.presse.resteFY)}</div>
    </div>
    <div class="kpi-tile">
      <div class="label">CA Congrès (FY)</div>
      <div class="value">${fmtK(kpi.congres.caFY)}</div>
      <div class="delta accent">Reste à commander fin d'année : ${fmtK(kpi.congres.resteFY)}</div>
    </div>
    <div class="kpi-tile total-tile">
      <div class="label">Total (Digital + Presse + Congrès)</div>
      <div class="value">${fmtK(kpi.digital.caFY + kpi.presse.caFY + kpi.congres.caFY)}</div>
      <div class="delta accent">Reste à commander : ${fmtK(kpi.total.resteFY)} fin d'année · ${fmtK(kpi.total.resteADate)} à date</div>
    </div>
  `;
}

function perfDigitalBadge(kpi) {
  return `<div class="perf-digital-badge">
    <div class="pdb-title">Total Digital — reste à commander</div>
    <div class="pdb-row"><span>À date</span><b class="accent">${fmtK(kpi.digital.resteADate)}</b></div>
    <div class="pdb-row"><span>Fin d'année</span><b class="accent">${fmtK(kpi.digital.resteFY)}</b></div>
  </div>`;
}

function perfZone(title, sub, color, r25, r26, b26, kpi) {
  return `
    <div class="perf-zone">
      <div class="perf-zone-header">
        <span class="perf-zone-dot" style="background:${color}"></span>
        <span class="perf-zone-title">${title}</span>
        <span class="perf-zone-sub">${sub}</span>
      </div>
      <div class="kpi-row">${perfTiles(kpi)}</div>
      <div class="panel perf-chart-panel">
        <h2>Prise de commande digital mensuelle détail</h2>
        <div class="panel-sub">Digital 2025 vs 2026, comparé au Budget 2026</div>
        <div class="legend">
          <div class="item"><span class="swatch" style="background:var(--series-1-light)"></span>Digital 2025</div>
          <div class="item"><span class="swatch" style="background:var(--series-1)"></span>Digital 2026</div>
          <div class="item"><span class="swatch" style="background:var(--series-2)"></span>Budget 2026 (courbe)</div>
        </div>
        ${perfDigitalBadge(kpi)}
        ${groupedBarChartSVG(MONTH_LABELS_FR, r25, r26, { lineSeries: b26 })}
      </div>
    </div>
  `;
}

function renderPerf() {
  const monthly = state.pagePerfMonthly;
  const kpiData = state.pagePerfKpi;
  const perfColors = { MA: 'var(--series-1)', PG: 'var(--series-2)', JV: 'var(--series-3)', JE: 'var(--series-4)' };
  const names = { MA: 'Marine Abaziou', PG: 'Pascale Gerbault', JV: 'Jessica Varrall', JE: 'Jérémy Eman' };

  const zones = ['MA', 'PG', 'JV', 'JE'].map(code => {
    const m = monthly.find(p => p.code === code);
    const { r25, r26, b26 } = monthlyArrays(m.months);
    return perfZone(`${names[code]} (${code})`, 'Digital 2026', perfColors[code], r25, r26, b26, kpiData[code]);
  }).join('');

  document.getElementById('main').innerHTML = `
    ${zones}
    <div class="panel">
      <div class="footnote" style="margin:0;">
        Digital repris de "2. Synthèse Digital Perf Com" (fichier maître "Reporting Commercial 2026"). Presse, Congrès et le reste à commander (RAF) budget repris de l'onglet "KPI" du fichier "KPI 2026" — mois en cours : ${MONTH_LABELS_FR[kpiData.TOTAL.moisEnCours - 1]}. Reste à date = Budget cumulé jusqu'au mois en cours − CA commandé à date. Reste fin d'année = Budget annuel total − CA commandé à date.
      </div>
    </div>
  `;
}

function renderPerfTotal() {
  const g3 = state.pageGraph3;
  const kpi = state.pagePerfKpi.TOTAL;
  document.getElementById('main').innerHTML = `
    ${perfZone('Perf Commerciale Totale', 'Consolidé — 4 commerciaux', 'var(--total-color)', g3.n1, g3.n, g3.budget, kpi)}
    <div class="panel">
      <div class="footnote" style="margin:0;">
        Digital repris du bloc "TOTAL DIGITAL" de "2. Synthèse Digital Perf Com" (fichier maître) — ce bloc inclut la ligne budget "Sécu" en plus des 4 commerciaux, d'où un total différent de la simple somme des 4 zones ci-dessus. Presse et Congrès repris de l'onglet "KPI" du fichier "KPI 2026" — mois en cours : ${MONTH_LABELS_FR[kpi.moisEnCours - 1]}. Reste à date = Budget cumulé jusqu'au mois en cours − CA commandé à date. Reste fin d'année = Budget annuel total − CA commandé à date.
      </div>
    </div>
  `;
}

// Smooth spline through a series of {x,y} points (Catmull-Rom -> cubic Bezier),
// matching the "courbe souple" look Kevin wants for the MM12 tab.
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} `;
  }
  return d;
}

// Round grid-step chooser (100k / 200k / 250k / 500k...) so the Y axis reads cleanly
// regardless of the data range, similar to a spreadsheet auto-scaled axis.
function niceStep(range, targetTicks) {
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const norm = rough / mag;
  let mult = 10;
  if (norm < 1.5) mult = 1;
  else if (norm < 3) mult = 2;
  else if (norm < 7) mult = 5;
  return mult * mag;
}

function renderTendance() {
  const points = state.pageMM12.points.map(p => ({ ...p, t: p.year + (p.month - 1) / 12 }));
  const w = 1200, h = 520, padL = 76, padR = 24, padT = 24, padB = 40;
  const innerW = w - padL - padR, innerH = h - padT - padB;

  const minT = points[0].t, maxT = points[points.length - 1].t;
  const vals = points.map(p => p.mm12);
  const minVal = Math.min(...vals), maxVal = Math.max(...vals);
  const step = niceStep(maxVal - minVal || 1, 5);
  const gridMin = Math.floor(minVal / step) * step - step;
  const gridMax = Math.ceil(maxVal / step) * step + step;

  const x = (t) => padL + ((t - minT) / (maxT - minT)) * innerW;
  const y = (v) => padT + innerH - ((v - gridMin) / (gridMax - gridMin)) * innerH;

  const ticks = [];
  for (let v = gridMin; v <= gridMax + 1; v += step) ticks.push(v);
  const gridLines = ticks.map(v => {
    const yy = y(v);
    return `<line class="gridline" x1="${padL}" x2="${w - padR}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" />
      <text class="axis-label" x="${padL - 10}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${fmtK(v)}</text>`;
  }).join('');

  const xLabels = points.map((p, i) => {
    if (p.month !== 1 && i !== 0 && i !== points.length - 1) return '';
    const xx = x(p.t);
    return `<line class="gridline" x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${padT}" y2="${h - padB}" />
      <text class="axis-label" x="${xx.toFixed(1)}" y="${h - padB + 20}" text-anchor="middle">${p.month === 1 ? 'Janvier ' + p.year : MONTH_LABELS_FR[p.month - 1] + ' ' + String(p.year).slice(2)}</text>`;
  }).join('');

  const linePts = points.map(p => ({ x: x(p.t), y: y(p.mm12) }));

  document.getElementById('main').innerHTML = `
    <div class="panel">
      <h2>MM 12 Commande Digital</h2>
      <div class="panel-sub">Moyenne mobile 12 mois du CA commandé Digital — mois d'août exclu du calcul</div>
      <div class="chart-wrap">
        <svg class="line-chart mm12-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
          ${gridLines}
          ${xLabels}
          <path d="${smoothPath(linePts)}" fill="none" stroke="var(--series-1)" stroke-width="2.5" />
          <text class="axis-title" x="${-(h/2).toFixed(1)}" y="18" text-anchor="middle" transform="rotate(-90)">MM 12 Mois</text>
          <text class="axis-title" x="${(padL + innerW/2).toFixed(1)}" y="${h - 4}" text-anchor="middle">Date</text>
        </svg>
      </div>
      <div class="footnote">
        Repris directement de l'onglet "5.MM 12 mois" du fichier "Reporting Commercial 2026" — moyenne mobile calculée sur 12 mois de CA commandé Digital (mois de commande), le mois d'août n'étant pas retenu dans le calcul.
      </div>
    </div>
  `;
}

function updateControlsVisibility() {
  // Cash, Perf. Commerciale and Graphiques have no year dimension in the master file today
  // (Perf and Graphiques are fixed 2025/2026, no GESTION 2027 sheet exists yet); Synthèse
  // Globale is fixed to Réalisé (no vision or comparatif toggle) and Tendance has no
  // comparatif — hide what doesn't apply rather than leaving controls visible but inert.
  const yearSeg = document.getElementById('year-seg');
  const visionSeg = document.getElementById('vision-seg');
  const compareSeg = document.getElementById('compare-seg');
  yearSeg.style.display = (state.tab === 'cash' || state.tab === 'perf' || state.tab === 'perfTotal' || state.tab === 'graphs') ? 'none' : '';
  visionSeg.style.display = (state.tab === 'cash' || state.tab === 'synthese' || state.tab === 'perf' || state.tab === 'perfTotal' || state.tab === 'graphs') ? 'none' : '';
  compareSeg.style.display = (state.tab === 'global' || state.tab === 'clients') ? '' : 'none';
}

function render() {
  updateControlsVisibility();
  document.getElementById('main').classList.toggle('wide-main', state.tab === 'graphs');
  if (state.tab === 'cash') renderCash();
  else if (state.tab === 'synthese') renderSynthese();
  else if (state.tab === 'global') renderGlobal();
  else if (state.tab === 'clients') renderClients();
  else if (state.tab === 'graphs') renderGraphs();
  else if (state.tab === 'tendance') renderTendance();
  else if (state.tab === 'perf') renderPerf();
  else if (state.tab === 'perfTotal') renderPerfTotal();
}

function renderClients() {
  const d = currentSlice4();
  const visionLabel = state.vision === 'real' ? 'Réalisé' : 'Commandé';
  const cmpLabel = compareLabel();
  const refField = state.compare === 'budget' ? 'budget' : 'n1';
  const maxVal = Math.max(...d.top_clients.map(r => Math.max(r.ca, r[refField] || 0)), 1) * 1.06;

  const rows = d.top_clients.map(r => {
    const ref = r[refField];
    const caPct = Math.max((r.ca / maxVal) * 100, 0);
    const refPct = (ref && ref > 0) ? (ref / maxVal) * 100 : null;
    const delta = compareDelta(r.ca, ref);
    const overTarget = ref !== null && ref !== undefined && ref > 0 && r.ca >= ref;
    return `<div class="gauge-row">
      <div class="gauge-name">${r.client}</div>
      <div class="gauge-track">
        <div class="gauge-fill${overTarget ? ' over-target' : ''}" style="width:${caPct}%"></div>
        ${refPct !== null ? `<div class="gauge-target" style="left:${refPct}%"><span class="gauge-target-label">${fmtK(ref)}</span></div>` : ''}
      </div>
      <div class="gauge-stats">
        <div class="gauge-ca">${fmtK(r.ca)}</div>
        <div class="gauge-cmp">${cmpLabel} : ${ref !== null && ref !== undefined ? fmtK(ref) : 'n.d.'}</div>
      </div>
      <div class="gauge-pct ${delta.cls}">${delta.text}</div>
    </div>`;
  }).join('');

  const totalRef = d.top_clients.reduce((s, r) => s + (r[refField] || 0), 0) || null;
  const totalDelta = compareDelta(d.total, totalRef);

  const kpis = [
    kpiTile('CA Digital total', fmtK(d.total), totalRef !== null ? `${totalDelta.text} vs ${cmpLabel} (${fmtK(totalRef)})` : `${cmpLabel} n.d.`, totalDelta.cls),
    kpiTile('Farming (clients existants)', fmtK(d.total_farming), null),
    kpiTile('Chasse (nouveaux deals)', fmtK(d.total_chasse), null),
  ];

  document.getElementById('main').innerHTML = `
    <div class="kpi-row">${kpis.join('')}</div>
    <div class="panel">
      <h2>Top clients — CA Digital</h2>
      <div class="panel-sub">Vision ${visionLabel} — ${state.year} · comparé à : ${cmpLabel}</div>
      <div class="legend">
        <div class="item"><span class="swatch" style="background:var(--series-1)"></span>CA ${visionLabel.toLowerCase()}</div>
        <div class="item"><span class="swatch" style="background:var(--good)"></span>CA ≥ ${cmpLabel}</div>
        <div class="item"><span class="swatch" style="background:var(--series-2)"></span>${cmpLabel} (repère)</div>
      </div>
      ${rows}
      <div class="footnote">
        ${d.source === 'computed_fallback_no_master_tab'
          ? `Le fichier "Reporting Commercial 2026" ne contient pas encore d'onglet Client pour 2027 — ces chiffres sont recalculés depuis "Source Reporting commercial 2026" en attendant.`
          : `Repris directement de l'onglet "${state.vision === 'real' ? 'test 4. Synthèse Digital Client' : '4. Synthèse Digital Client'}" du fichier "Reporting Commercial 2026". Farming/Chasse = répartition telle que calculée dans ce même onglet. Le budget par client n'est disponible que sur certaines visions selon ce que contient le fichier maître.`}
      </div>
    </div>
  `;
}

function wireControls() {
  document.getElementById('year-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-year]');
    if (!btn) return;
    state.year = Number(btn.dataset.year);
    [...document.querySelectorAll('#year-seg button')].forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
  document.getElementById('vision-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-vision]');
    if (!btn) return;
    state.vision = btn.dataset.vision;
    [...document.querySelectorAll('#vision-seg button')].forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
  document.getElementById('compare-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-compare]');
    if (!btn) return;
    state.compare = btn.dataset.compare;
    [...document.querySelectorAll('#compare-seg button')].forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn || btn.disabled) return;
    state.tab = btn.dataset.tab;
    [...document.querySelectorAll('#tabs button[data-tab]')].forEach(b => b.classList.toggle('active', b === btn));
    render();
  });
}

(async function init() {
  wireControls();
  document.getElementById('main').innerHTML = '<div class="coming-soon">Chargement…</div>';
  await loadData();
  render();
})();
