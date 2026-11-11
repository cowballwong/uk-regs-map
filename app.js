/* v4 dark theme. UK Building Regulations Map (England), v2 (10 Nov 2026: first look, alert mode, search-first, spec check; v3 full text of BR 2010 and the 24 ADs). Forked from the HK Building Regulations Map engine (S7). AW Design.
   Classic script (works from file://): libraries come in by dynamic import() from cdn.jsdelivr.net.
   Desktop: 3d-force-graph (three.js). Phones (<= 768px): force-graph 2D canvas. Same data, same panel. */
(async function () {
  'use strict';
  const H = window.HKMAP;
  if (!H) { document.getElementById('loading').textContent = 'data.js did not load'; return; }
  const N = H.nodes, E = H.solid, BR = H.dashed, GR = H.groups, DOM = H.domains, SUBJ = H.subjects;
  // v4 dark theme: colours lifted toward white until they reach 4.5:1 against the map
  const DKBG = '#070a10';
  const dkLum = c => { const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const dkCr = (a, b) => { const x = dkLum(a), y = dkLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const dkMix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) + (parseInt(b.slice(i, i + 2), 16) - parseInt(a.slice(i, i + 2), 16)) * t).toString(16).padStart(2, '0')).join('');
  const lift = (c, m) => { let x = c; for (let k = 0; k < 40 && dkCr(x, DKBG) < (m || 4.5); k++) x = dkMix(x, '#ffffff', .07); return x; };
  Object.values(GR).forEach(g => { g.color = lift(g.color); }); Object.values(DOM).forEach(d => { d.color = lift(d.color); });
  const MOBILE = window.matchMedia('(max-width:768px)').matches;
  const narrow = () => window.matchMedia('(max-width:768px)').matches; // the layout on screen now (MOBILE is fixed at load)
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[\s().,\-/'’"“”_:;·&]/g, '');
  const fmt = n => n.toLocaleString('en-GB');
  const HIDE_K = new Set(['section', 'schedule_section', 'division']);
  const LEGK = new Set(['ordinance', 'regulation', 'part', 'division', 'schedule', 'section', 'schedule_section']);
  const KIND = {
    ordinance: ['Act of Parliament', ''], regulation: ['Statutory instrument', ''], part: ['Building Regulations provision', ''], division: ['Division', ''],
    schedule: ['Schedule', ''], section: ['Section', ''], schedule_section: ['Schedule section', ''],
    external_ordinance: ['Other legislation', ''], document_stub: ['Citation only: number, title and edition', ''], document: ['Guidance document', '']
  };
  const REL = { x: ['Explains', '', 'Explained by', ''], a: ['Amends', '', 'Amended by', ''], s: ['Supersedes', '', 'Superseded by', ''], i: ['Implements', '', 'Implemented by', ''], m: ['Made under', '', 'Enabling instrument for', ''] };
  const DSHORT = { D1: ['Building control system', ''], D2: ['Fire safety', ''], D3: ['Structure, site, materials', ''], D4: ['Construction H&S (CDM)', ''],
    D5: ['Health, sound, services', ''], D6: ['Energy and infrastructure', ''], D7: ['Access, safety, security', ''], D8: ['Higher-risk buildings (BSA)', ''] };
  const ST_ZH = { superseded: '', repealed: '', omitted: '', obsolete: '' };
  const stWord = n => { const s = String(n.st || '').toLowerCase(); if (n.dup != null) return ['Duplicate', '']; if (s.startsWith('cancelled')) return ['Cancelled', '']; return ST_ZH[s] ? [s[0].toUpperCase() + s.slice(1), ST_ZH[s]] : null; };
  // full-text concept index (search.js, pipeline/s8_search_index.py): per concept, [node, mentions] pairs; falls back to AI tags
  const HS = window.HKSEARCH && window.HKSEARCH.nodes === N.length && window.HKSEARCH.c.length === H.concepts.length ? window.HKSEARCH : null;
  const cDocs = ci => { const f = HS && HS.c[ci]; if (f) { const r = []; for (let k = 0; k < f.length; k += 2) r.push([f[k], f[k + 1]]); return r; } return H.concepts[ci][3].map(i => [i, null]); };
  const cCount = ci => HS ? HS.c[ci].length / 2 : H.concepts[ci][3].length;
  const SG = new Map(); N.forEach((n, i) => { if (n.sg) { if (!SG.has(n.sg)) SG.set(n.sg, []); SG.get(n.sg).push(i); } });
  $('loadt').textContent = `Arranging ${fmt(N.length)} documents…`;

  // ---------------- About (wired first, so it works even if the graph library cannot load) ----------------
  (function about() {
    const C = H.counts || {}, box = $('about'); if (!box) return;
    const bySer = C.by_series || {};
    box.querySelectorAll('[data-s]').forEach(el => { el.textContent = fmt(el.dataset.s.split(',').reduce((a, k) => a + (bySer[k] || 0), 0)); });
    box.querySelectorAll('[data-c]').forEach(el => { el.textContent = fmt(C[el.dataset.c] ?? 0); });
    box.querySelectorAll('[data-k]').forEach(el => { const ks = el.dataset.k.split(','); el.textContent = fmt(N.filter(n => ks.includes(n.k)).length); });
    box.querySelectorAll('[data-g]').forEach(el => { el.textContent = fmt(N.filter(n => n.g === el.dataset.g).length); });
    const open = () => { box.classList.add('open'); $('abtx').focus(); }, close = () => { box.classList.remove('open'); $('abtb').focus(); };
    $('abtb').onclick = open; $('abtx').onclick = close;
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) { e.stopImmediatePropagation(); close(); } }, true);
  })();

  // ---------------- graph wiring ----------------
  N.forEach((n, i) => { n.i = i; n.out = []; n.inn = []; n.kids = []; n.br = []; n.adj = []; });
  E.forEach(e => { N[e.s].out.push(e); N[e.t].inn.push(e); });
  N.forEach(n => { if (n.pa != null) N[n.pa].kids.push(n.i); });
  BR.forEach(b => { N[b.s].br.push(b); N[b.t].br.push(b); });
  const BYID = new Map(N.map(n => [n.id, n]));
  const BYCODE = new Map(); N.forEach(n => { const k = norm(n.c); if (!BYCODE.has(k) || n.k === 'document') BYCODE.set(k, n); });
  const vAnc = n => { let m = n; while (m && HIDE_K.has(m.k) && m.pa != null) m = N[m.pa]; return m; };
  const pk = (a, b) => a < b ? a + '-' + b : b + '-' + a;

  const L = [];
  N.forEach(n => { if (n.pa != null) L.push({ s0: n.pa, t0: n.i, kind: 'tree' }); });
  const direct = new Set();
  E.forEach(e => { L.push({ s0: e.s, t0: e.t, kind: 'cite', e, faint: !!(e.f || e.ix) }); direct.add(pk(e.s, e.t)); });
  const roll = new Map(); // when section nodes are hidden, their citations roll up to the nearest visible Part / regulation
  E.forEach(e => {
    const a = N[e.s], b = N[e.t]; if (!HIDE_K.has(a.k) && !HIDE_K.has(b.k)) return;
    const A = vAnc(a), B = vAnc(b); if (A === B) return; const k = pk(A.i, B.i); if (direct.has(k)) return;
    let r = roll.get(k); if (!r) { r = { s0: A.i, t0: B.i, kind: 'roll', n: 0 }; roll.set(k, r); L.push(r); } r.n++;
  });
  BR.forEach(b => L.push({ s0: b.s, t0: b.t, kind: 'bridge', b }));
  L.forEach(l => { l.source = l.s0; l.target = l.t0; N[l.s0].adj.push(l); N[l.t0].adj.push(l); });

  // ---------------- state ----------------
  const isNC = n => !!(n.bsx && n.bsx.s === 'not checked');
  const S = { mode: 'domain', altT: 0, burst: false, burstT: 0, noHaloAll: false, bsAll: false, zoomIn: false, rev: new Set(), alert: false, hero: false, sideBy: null, leg: false, bridges: true, dept: Object.fromEntries(Object.keys(GR).map(k => [k, true])), dom: 'all', sel: null, concept: null, hiN: new Set(), hiL: new Set(), pv: null, pvX: new Set(), pvXL: new Set(), rowsM: null, col: false };
  const shownN = n => S.dept[n.g] && (S.dom === 'all' || n.dm === S.dom) && (S.leg || !HIDE_K.has(n.k)) && (!isNC(n) || S.bsAll || S.zoomIn || S.rev.has(n.i));
  function applyFilter() {
    N.forEach(n => { n.vis = shownN(n); });
    L.forEach(l => {
      const a = N[l.s0], b = N[l.t0];
      l.vis = a.vis && b.vis && (l.kind === 'roll' ? !S.leg : l.kind === 'bridge' ? S.bridges : true);
    });
    const vn = N.reduce((s, n) => s + (n.vis ? 1 : 0), 0);
    const hid = N.reduce((s, n) => s + (isNC(n) && !n.vis && S.dept.BS ? 1 : 0), 0);
    $('stats').textContent = `${fmt(vn)} of ${fmt(N.length)} shown${hid ? ` (${fmt(hid)} unchecked standards appear when you zoom in)` : ''} · ${fmt(E.length)} quoted citations · ${BR.length} AI links`;
  }
  applyFilter();

  // ---------------- colours + sizes ----------------
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const _lum = c => { const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const chipBg = c => { let x = c; for (let k = 0; k < 30 && 1.05 / (_lum(x) + .05) < 4.6; k++) x = '#' + [1, 3, 5].map(i => Math.round(parseInt(x.slice(i, i + 2), 16) * .93).toString(16).padStart(2, '0')).join(''); return x; };
  const BSC = { superseded: '#b0231c', withdrawn: '#7b3f98', mixed: '#6b5500', current: '#005a8c', 'not checked': '#8f877b' };
  const BSCD = { superseded: '#ff6257', withdrawn: '#c79bff', mixed: '#e6c34a', current: '#45b4ff', 'not checked': '#8592a3' }; // status dots on the dark map
  const BSW = { superseded: 'Newer edition exists', withdrawn: 'Cited edition withdrawn', mixed: 'Depends on citing AD', current: 'Cited edition current', 'not checked': 'Status not checked' };
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pulsing = () => S.alert && !RM.matches && performance.now() - S.altT < 6500;
  const pulseF = () => RM.matches || performance.now() - S.altT >= 6000 ? 1.45 : 1.2 + .25 * Math.sin((performance.now() - S.altT) / 240);
  const bursting = () => !!S.burst && !RM.matches && performance.now() < S.burstT + 1100;
  const burstF = () => { if (RM.matches) return 1.35; const t = (performance.now() - S.burstT) / 900; return t <= 0 ? 1 : t >= 1 ? 1.35 : 1 + .35 * t + .45 * Math.sin(Math.PI * t); };
  const HALO = DKBG, haloOn = n => !!(n.vis && !n.noHalo && !S.noHaloAll && n.bsx && n.bsx.s !== 'not checked' && (!S.hiN.size || S.hiN.has(n.i)) && !(S.pvX && S.pvX.has(n.i)) && n.i !== S.sel && n.i !== S.pv);
  const ALC = BSC.superseded;
  const LEGCOL = { ordinance: '#3f332a', regulation: '#5a4c40', part: '#8d7f70', schedule: '#8d7f70', division: '#a99c8c', section: '#afa293', schedule_section: '#b8ac9e' };
  Object.keys(LEGCOL).forEach(k => { LEGCOL[k] = lift(LEGCOL[k]); });
  N.forEach(n => {
    let cd, cm;
    if (LEGCOL[n.k]) cd = cm = LEGCOL[n.k];
    else if (n.k === 'external_ordinance') cd = cm = lift('#9a8d7e');
    else { cd = GR[n.g].color; cm = (DOM[n.dm] || {}).color || '#8b7355'; if (n.k === 'document_stub') { cd = mix(cd, '#1a2230', .5); cm = mix(cm, '#1a2230', .5); } }
    if (n.fd) { cd = mix(cd, '#1a2230', .5); cm = mix(cm, '#1a2230', .5); }
    n.cD = cd; n.cM = cm;
    if (n.bsx) { n.cD = n.cM = BSCD[n.bsx.s] || BSCD['not checked']; }
    n.alt = !!(n.bsx && (n.bsx.s === 'superseded' || n.bsx.s === 'withdrawn'));
    const d = n.deg || 0;
    n.v0 = (n.fd ? .55 : 1) * Math.min(90, { ordinance: 70, regulation: 9 + d * .25, part: 1.4 + d * .2, schedule: 1.4 + d * .2, division: .6, section: .35 + d * .18, schedule_section: .35 + d * .18, external_ordinance: .9 + d * .3, document_stub: .5 + d * .25 }[n.k] ?? (1.8 + d * .42));
    if (n.bsx && n.bsx.s !== 'not checked') n.v0 = Math.max(n.v0, MOBILE ? 3.2 : 3); // C7-01 / V1C-04: checked dots never sub-pixel
  });
  const colOf = n => S.mode === 'dept' ? n.cD : n.cM;
  const ALT = N.filter(n => n.alt);
  const DIM = '#1b2330';
  const softC = new Map(); // a colour washed halfway to the dim tone, for the extension neighbours of a previewed dot
  const soft = c => { let v = softC.get(c); if (!v) { const a = hex(c), d = hex(DIM); v = '#' + a.map((x, k) => Math.round(x * .5 + d[k] * .5).toString(16).padStart(2, '0')).join(''); softC.set(c, v); } return v; };
  const nodeColor = n => n.i === S.pv ? colOf(n) : S.pvX.has(n.i) ? soft(colOf(n)) : (S.hiN.size && !S.hiN.has(n.i)) ? DIM : colOf(n);
  const nodeVal0 = n => S.alert && n.alt ? (n.i === S.pv ? n.v0 * 2 + 7 : (n.v0 * 1.6 + 2.5) * pulseF()) : S.alert && n.bsx && n.bsx.s === 'mixed' ? n.v0 * 1.3 + 1.5 : n.i === S.pv ? n.v0 * 1.7 + 5 : S.pvX.has(n.i) ? n.v0 * .7 + 1.2 : S.hiN.size ? (n.i === S.sel ? n.v0 * 2.2 + 6 : S.hiN.has(n.i) ? n.v0 * 1.25 : n.v0 * .05) : n.v0;
  const nodeVal = n => { const v = nodeVal0(n); return S.burst && S.sel != null && n.i !== S.sel && S.hiN.has(n.i) && !S.alert ? v * burstF() : v; };
  const tip = n => { const w = n.bsx ? [BSW[n.bsx.s], ''] : n.fd && stWord(n); return `<div class="tip"><b>${esc(n.c)}</b>${w ? ` <span class="z">· ${esc(w[0])}</span>` : ''}<br>${esc(n.te || '')}${n.bsx && n.bsx.pa && n.bsx.pa.length > 1 ? `<div class="z">${esc(n.bsx.pa.map(r => `${r[0]} ${r[2]}: ${BSW[r[1]]}`).join(' · '))}</div>` : n.vd && n.bsx ? `<div class="z">${esc(n.vd)}</div>` : ''}</div>`; };
  const ADSUB = {"AD A": "Structure", "AD B Vol 1": "Fire safety, dwellings", "AD B Vol 2": "Fire safety, other buildings", "AD C": "Site, contaminants, moisture", "AD D": "Toxic substances", "AD E": "Sound", "AD F Vol 1": "Ventilation, dwellings", "AD F Vol 2": "Ventilation, other buildings", "AD G": "Sanitation, hot water, water use", "AD H": "Drainage and waste", "AD J": "Combustion appliances, fuel", "AD K": "Falling, collision, impact", "AD L Vol 1": "Fuel and power, dwellings", "AD L Vol 2": "Fuel and power, other buildings", "AD M Vol 1": "Access, dwellings", "AD M Vol 2": "Access, other buildings", "AD O": "Overheating", "AD P": "Electrical safety, dwellings", "AD Q": "Security, dwellings", "AD R Vol 1": "Broadband, new dwellings", "AD R Vol 2": "Broadband infrastructure", "AD S": "EV charging", "AD T": "Toilets", "AD Reg 7": "Materials, workmanship"};
  const adSub = n => ADSUB[n.c] || '';
  const shortZh = n => { const t = (n.tz || '').replace(/[]/g, ''); return t.length > 16 ? t.slice(0, 15) + '…' : t; };

  // ---------------- primary subject (the "by subject" layout) ----------------
  // A document's primary subject is the first of its subjects (sb). Legislation, other ordinances and cited stubs have none,
  // so they take the primary subject most of their citing / cited documents share (at least 2 votes and a third of them);
  // anything left sits in a neutral Legislation area in the middle.
  const SLEG = 'LEGAREA';
  (function subjects() {
    N.forEach(n => { n.sj = n.k === 'document' && n.sb && n.sb.length && SUBJ[n.sb[0]] ? n.sb[0] : null; });
    const votes = N.map(() => ({}));
    E.forEach(e => { const a = N[e.s], b = N[e.t]; if (a.sj && !b.sj && b.k !== 'document') votes[b.i][a.sj] = (votes[b.i][a.sj] || 0) + 1; if (b.sj && !a.sj && a.k !== 'document') votes[a.i][b.sj] = (votes[a.i][b.sj] || 0) + 1; });
    N.forEach(n => {
      if (n.sj) return;
      const v = Object.entries(votes[n.i]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)), tot = v.reduce((s, x) => s + x[1], 0);
      if (n.k !== 'ordinance' && v.length && v[0][1] >= 2 && v[0][1] / tot >= 1 / 3) { n.sj = v[0][0]; n.sji = 1; } else n.sj = SLEG;
    });
  })();

  // ---------------- clusters (topic regions) ----------------
  const CENTRES = {
    dept: { LEG: [-230, 0, -40], AD: [60, 0, 20], HSE: [-330, 70, 230], BS: [330, 20, 120] },
    domain: {}, subject: {}, subject2: {}
  };
  const DRING = ['D1', 'D7', 'D8', 'D6', 'D4', 'D3', 'D5', 'D2'];
  DRING.forEach((d, k) => { const a = k * Math.PI / 4; CENTRES.domain[d] = [Math.cos(a) * 340, (k % 2 ? 45 : -45), Math.sin(a) * 340]; });
  // by subject: each domain is a super-region on a wide ring; its subjects sit around the domain centre, on a small
  // Fibonacci sphere in 3D (so they spread out from any viewing angle) and a sunflower disc in 2D; Legislation in the middle
  (function subjectCentres() {
    const GA = Math.PI * (3 - Math.sqrt(5)), size = {};
    N.forEach(n => { size[n.sj] = (size[n.sj] || 0) + 1; });
    DRING.forEach((d, k) => {
      const a = k * Math.PI / 4, ks = Object.keys(SUBJ).filter(s => SUBJ[s][2] === d).sort((p, q) => (size[q] || 0) - (size[p] || 0) || (p < q ? -1 : 1)), m = ks.length;
      const c3 = [Math.cos(a) * 640, (k % 2 ? 60 : -60), Math.sin(a) * 640], c2 = [Math.cos(a) * 600, 0, Math.sin(a) * 600];
      const r3 = 70 + 15 * m, r2 = 62 + 13 * m;
      ks.forEach((s, j) => {
        const yy = m === 1 ? 0 : 1 - 2 * (j + .5) / m, rr = Math.sqrt(1 - yy * yy), th = GA * j;
        CENTRES.subject[s] = [c3[0] + Math.cos(th) * rr * r3, c3[1] + yy * r3 * .8, c3[2] + Math.sin(th) * rr * r3];
        const rd = r2 * Math.sqrt((j + .6) / m), t2 = GA * j + a;
        CENTRES.subject2[s] = [c2[0] + Math.cos(t2) * rd, 0, c2[2] + Math.sin(t2) * rd];
      });
    });
    CENTRES.subject[SLEG] = [0, 0, 0]; CENTRES.subject2[SLEG] = [0, 0, 0];
  })();
  const centres = (mode, dim) => mode === 'subject' && dim === 2 ? CENTRES.subject2 : CENTRES[mode];
  const keyOf = (n, mode) => mode === 'dept' ? n.g : mode === 'subject' ? n.sj : n.dm;
  const ckey = n => keyOf(n, S.mode);
  const cinfo = k => {
    if (S.mode === 'dept') return { en: GR[k].en, zh: GR[k].zh, color: k === 'LEG' ? '#6d5e50' : k === 'EXT' ? '#9a8d7e' : GR[k].color };
    if (S.mode === 'subject') return k === SLEG ? { en: 'Legislation', zh: '', color: '#6d5e50', leg: 1 } : { en: SUBJ[k][0], zh: SUBJ[k][1], color: (DOM[SUBJ[k][2]] || {}).color || '#8b7355', sub: 1 };
    return { en: (DSHORT[k] || [DOM[k].en])[0], zh: (DSHORT[k] || [0, DOM[k].zh])[1], color: DOM[k].color };
  };
  let clusters = [], GC = { x: 0, y: 0, z: 0 };
  function updateClusters() {
    const acc = {};
    N.forEach(n => { if (!n.vis || n.x == null) return; const k = ckey(n); (acc[k] = acc[k] || []).push(n); });
    let gx = 0, gy = 0, gz = 0, gn = 0; N.forEach(n => { if (n.vis && n.x != null) { gx += n.x; gy += n.y; gz += n.z || 0; gn++; } });
    GC = gn ? { x: gx / gn, y: gy / gn, z: gz / gn } : { x: 0, y: 0, z: 0 };
    clusters = Object.entries(acc).filter(([, ns]) => ns.length >= (S.mode === 'subject' ? 1 : 3)).map(([k, ns]) => {
      let x = 0, y = 0, z = 0; ns.forEach(n => { x += n.x; y += n.y; z += n.z || 0; }); x /= ns.length; y /= ns.length; z /= ns.length;
      const ds = ns.map(n => Math.hypot(n.x - x, n.y - y, (n.z || 0) - z)).sort((a, b) => a - b);
      return { k, x, y, z, r: ds[Math.floor(ds.length * .8)] || 30, n: ns.length, info: cinfo(k) };
    });
    // labels are placed in this order and a label that would overlap one already placed is skipped: biggest subjects first
    if (S.mode === 'subject') clusters.sort((a, b) => (b.k === SLEG) - (a.k === SLEG) || b.n - a.n);
  }
  function clusterForce(alpha) {
    const C = centres(S.mode, SIMDIM);
    for (const n of N) {
      const c = C[ckey(n)]; if (!c) continue;
      const k = (LEGK.has(n.k) ? .1 : .19) * alpha;
      n.vx += (c[0] - n.x) * k;
      if (SIMDIM === 2) { n.vy += (c[2] - n.y) * k; } else { n.vy += (c[1] - n.y) * k; n.vz += (c[2] - n.z) * k; }
    }
  }
  // ---- layouts: baked offline (layout.js, made by pipeline/s6_bake_layout.py with ?bake) using these same forces ----
  let SIMDIM = MOBILE ? 2 : 3;
  function seedPositions(mode, dim) {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - .5;
    N.forEach(n => { n.x = n.y = n.z = undefined; n.vx = n.vy = n.vz = 0; });
    N.forEach(n => { if (n.pa != null) return; const c = centres(mode, dim)[keyOf(n, mode)] || [0, 0, 0]; n.x = c[0] + rnd() * 90; if (dim === 2) n.y = c[2] + rnd() * 90; else { n.y = c[1] + rnd() * 90; n.z = c[2] + rnd() * 90; } });
    const place = n => { if (n.x != null) return; const p = N[n.pa]; place(p); n.x = p.x + rnd() * 20; n.y = p.y + rnd() * 20; if (dim === 3) n.z = p.z + rnd() * 20; };
    N.forEach(place);
  }
  const LAY = window.HKLAYOUT;
  function applyLayout(mode) { const dim = SIMDIM, arr = layArr(mode); N.forEach((n, i) => { n.x = arr[i * dim]; n.y = arr[i * dim + 1]; n.z = dim === 3 ? arr[i * dim + 2] : 0; }); }
  const _lay = {};
  function layArr(mode) { // phones are portrait: stretch the 2D layout vertically so it fills the screen
    if (SIMDIM === 3) return LAY.d3[mode];
    return _lay[mode] || (_lay[mode] = LAY.d2[mode].map((v, i) => i % 2 ? v * 1.45 : v));
  }
  let morph = null;
  function morphTo(mode, ms = 2000) { const dim = SIMDIM; morph = { t0: performance.now(), ms, dim, from: N.map(n => [n.x, n.y, n.z]), to: layArr(mode), f: 0 }; }
  function stepMorph() { // returns true while nodes are moving
    if (!morph) return false;
    const k = Math.min(1, (performance.now() - morph.t0) / morph.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, d = morph.dim, to = morph.to;
    N.forEach((n, i) => { const f = morph.from[i]; n.x = f[0] + (to[i * d] - f[0]) * e; n.y = f[1] + (to[i * d + 1] - f[1]) * e; if (d === 3) n.z = f[2] + (to[i * d + 2] - f[2]) * e; });
    if (++morph.f % 5 === 0 || k >= 1) updateClusters();
    if (k >= 1) { morph = null; onMorphEnd && onMorphEnd(); }
    return true;
  }
  let onMorphEnd = null;
  const linkStr = l => {
    const a = N[l.s0], b = N[l.t0];
    if (l.kind === 'tree') return S.mode === 'dept' ? .7 : .04;
    if (l.kind === 'roll') return 0;
    if (l.kind === 'bridge') return .02;
    if (l.faint) return .01;
    return ckey(a) === ckey(b) ? .22 : .012;
  };
  const linkDist = l => l.kind === 'tree' ? (N[l.t0].k === 'part' || N[l.t0].k === 'regulation' ? 22 : 9) : l.kind === 'bridge' ? 90 : (ckey(N[l.s0]) === ckey(N[l.t0]) ? 30 : 80);

  // ---------------- renderer ----------------
  const stage = $('stage');
  if (/[?&]bake/.test(location.search)) { await bake(); return; }
  if (!LAY) { $('loading').innerHTML = '<span>layout.js is missing. Run pipeline/s6_bake_layout.py.</span>'; return; }
  applyLayout(S.mode);
  let R;
  async function bake() {
    const D3 = await import('https://cdn.jsdelivr.net/npm/d3-force-3d@3.0.6/+esm');
    const out = { built: H.built, d3: {}, d2: {} }, t0 = performance.now();
    for (const dim of [3, 2]) for (const mode of ['dept', 'domain', 'subject']) {
      SIMDIM = dim; S.mode = mode; seedPositions(mode, dim);
      const sim = D3.forceSimulation(N, dim).alphaDecay(.0115).velocityDecay(.4)
        .force('link', D3.forceLink(L).id(n => n.i).distance(linkDist).strength(linkStr))
        .force('charge', D3.forceManyBody().strength(dim === 3 ? -24 : -18).distanceMax(dim === 3 ? 170 : 150))
        .force('cluster', clusterForce).stop();
      for (let i = 0; i < 400; i++) sim.tick();
      const arr = []; N.forEach(n => { arr.push(Math.round(n.x * 10) / 10, Math.round(n.y * 10) / 10); if (dim === 3) arr.push(Math.round(n.z * 10) / 10); });
      out['d' + dim][mode] = arr;
    }
    out.seconds = Math.round((performance.now() - t0) / 1000);
    window.BAKED = out;
  }
  try { R = MOBILE ? await make2D() : await make3D(); }
  catch (err) { $('loading').innerHTML = '<span>Could not load the graph library. Check the connection and reload.</span>'; console.error(err); return; }
  window.addEventListener('resize', () => R.resize());

  async function make3D() {
    // Batched renderer: one instanced mesh for every node, one vertex-coloured line buffer for every citation,
    // one dashed buffer for the AI bridges, fat lines only for the highlighted set. d3-force-3d runs the layout.
    const T = 'https://cdn.jsdelivr.net/npm/three@0.183.2/';
    const [THREE, OC, LS2, LSG, LM] = await Promise.all([
      import(T + '+esm'), import(T + 'examples/jsm/controls/OrbitControls.js/+esm'),
      import(T + 'examples/jsm/lines/LineSegments2.js/+esm'), import(T + 'examples/jsm/lines/LineSegmentsGeometry.js/+esm'),
      import(T + 'examples/jsm/lines/LineMaterial.js/+esm')]);
    let SW = stage.clientWidth, SH = stage.clientHeight; const W = () => SW, Hh = () => SH, reSize = () => { SW = stage.clientWidth; SH = stage.clientHeight; };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W(), Hh()); renderer.setClearColor(DKBG, 1);
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, W() / Hh(), 1, 30000); cam.position.set(0, 330, 1150);
    scene.add(cam);
    const controls = new OC.OrbitControls(cam, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: .12, autoRotate: false, autoRotateSpeed: .45, screenSpacePanning: true, minDistance: 12, maxDistance: 5000 });
    // auto-rotate: orbits controls.target, which is the graph centre, or the selected node once one is picked.
    // Pauses while the user drags, zooms or the camera flies, and resumes after 3 s idle if the toggle is on.
    let rotOn = true;
    try { const v = localStorage.getItem('ukmap_rotate'); if (v === '0') rotOn = false; else if (v !== '1' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) rotOn = false; } catch (e) { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) rotOn = false; }
    let rotIdle = -1e9, dragging = false;
    controls.addEventListener('start', () => { dragging = true; rotIdle = performance.now(); });
    controls.addEventListener('end', () => { dragging = false; rotIdle = performance.now(); });
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const dl = new THREE.DirectionalLight(0xffffff, 1.3); dl.position.set(250, 350, 500); cam.add(dl);

    // ---- nodes ----
    const REL = 2.3;
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshLambertMaterial(), N.length);
    inst.frustumCulled = false; scene.add(inst);
    const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: HALO, transparent: true, depthTest: false, depthWrite: false }), N.length); halo.frustumCulled = false; halo.renderOrder = 10; scene.add(halo); const hArr = halo.instanceMatrix.array;
    const topc = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshLambertMaterial({ transparent: true, depthTest: false, depthWrite: false }), N.length); topc.frustumCulled = false; topc.renderOrder = 11; scene.add(topc); const tArr = topc.instanceMatrix.array;
    N.forEach(n => topc.setColorAt(n.i, new THREE.Color('#000000')));
    const mArr = inst.instanceMatrix.array, col = new THREE.Color();
    N.forEach(n => inst.setColorAt(n.i, col.set('#000000')));
    // ---- lines ----
    const baseL = L.filter(l => l.kind !== 'bridge'), brL = L.filter(l => l.kind === 'bridge');
    function lineLayer(list, mat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.length * 6), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(list.length * 8), 4));
      const o = new THREE.LineSegments(g, mat); o.frustumCulled = false; scene.add(o); return o;
    }
    const bLines = lineLayer(baseL, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    const dLines = lineLayer(brL, new THREE.LineDashedMaterial({ vertexColors: true, transparent: true, depthWrite: false, dashSize: 3.2, gapSize: 2.4 }));
    const hiMat = new LM.LineMaterial({ vertexColors: true, linewidth: 1.8, transparent: true, depthWrite: false });
    const hiBrMat = new LM.LineMaterial({ color: 0xeef3f9, linewidth: 1.6, dashed: true, dashSize: 3.2, gapSize: 2.4, transparent: true, depthWrite: false });
    const hiLines = new LS2.LineSegments2(new LSG.LineSegmentsGeometry(), hiMat); hiLines.frustumCulled = false; scene.add(hiLines);
    const hiBr = new LS2.LineSegments2(new LSG.LineSegmentsGeometry(), hiBrMat); hiBr.frustumCulled = false; scene.add(hiBr);
    // extension lines: a previewed dot's links that lead outside the search set, dashed and faint
    const xMat = new LM.LineMaterial({ color: 0xf0a463, linewidth: 1.3, dashed: true, dashSize: 4, gapSize: 3, transparent: true, opacity: .55, depthWrite: false });
    const xLn = new LS2.LineSegments2(new LSG.LineSegmentsGeometry(), xMat); xLn.frustumCulled = false; xLn.visible = false; scene.add(xLn);
    hiMat.resolution.set(W(), Hh()); hiBrMat.resolution.set(W(), Hh()); xMat.resolution.set(W(), Hh());
    let hiList = [], hiBrList = [], xList = [];
    const LC = {
      cite: ['#6f8db5', .30], roll: ['#6f8db5', .26], faint: ['#56677e', .16], tree: ['#8796ad', .40], bridge: ['#e8eef6', .72],
      dim: ['#2a3443', .14], dimBr: ['#8b9bb0', .16]
    };
    const rgba = {}; Object.entries(LC).forEach(([k, [c, a]]) => { col.set(c); rgba[k] = [col.r, col.g, col.b, a]; });
    const HI = { cite: new THREE.Color('#ff9d55'), tree: new THREE.Color('#a9b8cc'), red: new THREE.Color('#ff5a4f'), mix: new THREE.Color('#e6c34a') };

    function writeState() {
      const hi = S.hiN.size > 0;
      N.forEach(n => { inst.setColorAt(n.i, col.set(nodeColor(n))); topc.setColorAt(n.i, col); n.cv = n.vis ? Math.cbrt(nodeVal(n)) * REL : 0; });
      inst.instanceColor.needsUpdate = true; topc.instanceColor.needsUpdate = true;
      const bc = bLines.geometry.attributes.color.array;
      baseL.forEach((l, j) => {
        const c = !l.vis || (hi && S.hiL.has(l)) || S.pvXL.has(l) ? null : hi ? rgba.dim : rgba[l.kind === 'cite' ? (l.faint ? 'faint' : 'cite') : l.kind];
        const o = j * 8; if (!c) { bc[o + 3] = bc[o + 7] = 0; return; }
        bc[o] = bc[o + 4] = c[0]; bc[o + 1] = bc[o + 5] = c[1]; bc[o + 2] = bc[o + 6] = c[2]; bc[o + 3] = bc[o + 7] = c[3];
      });
      bLines.geometry.attributes.color.needsUpdate = true;
      const dc = dLines.geometry.attributes.color.array;
      brL.forEach((l, j) => {
        const c = !l.vis || (hi && S.hiL.has(l)) || S.pvXL.has(l) ? null : hi ? rgba.dimBr : rgba.bridge; const o = j * 8;
        if (!c) { dc[o + 3] = dc[o + 7] = 0; return; }
        dc[o] = dc[o + 4] = c[0]; dc[o + 1] = dc[o + 5] = c[1]; dc[o + 2] = dc[o + 6] = c[2]; dc[o + 3] = dc[o + 7] = c[3];
      });
      dLines.geometry.attributes.color.needsUpdate = true;
      hiList = hi ? [...S.hiL].filter(l => l.vis && l.kind !== 'bridge') : [];
      hiBrList = hi ? [...S.hiL].filter(l => l.vis && l.kind === 'bridge') : [];
      const hc = new Float32Array(hiList.length * 6);
      hiList.forEach((l, j) => { const c = l.kind === 'tree' ? HI.tree : S.alert ? (N[l.s0].alt || N[l.t0].alt ? HI.red : HI.mix) : HI.cite; for (let k = 0; k < 2; k++) { hc[j * 6 + k * 3] = c.r; hc[j * 6 + k * 3 + 1] = c.g; hc[j * 6 + k * 3 + 2] = c.b; } });
      hiLines.geometry.dispose(); hiLines.geometry = new LSG.LineSegmentsGeometry();
      if (hiList.length) { hiLines.geometry.setPositions(new Float32Array(hiList.length * 6)); hiLines.geometry.setColors(hc); }
      hiBr.geometry.dispose(); hiBr.geometry = new LSG.LineSegmentsGeometry();
      if (hiBrList.length) hiBr.geometry.setPositions(new Float32Array(hiBrList.length * 6));
      hiLines.visible = hiList.length > 0; hiBr.visible = hiBrList.length > 0;
      xList = [...S.pvXL].filter(l => l.vis); xLn.geometry.dispose(); xLn.geometry = new LSG.LineSegmentsGeometry(); xLn.visible = xList.length > 0;
      dkState();
    }
    const seg = (arr, list) => list.forEach((l, j) => { const a = N[l.s0], b = N[l.t0], o = j * 6; arr[o] = a.x; arr[o + 1] = a.y; arr[o + 2] = a.z; arr[o + 3] = b.x; arr[o + 4] = b.y; arr[o + 5] = b.z; });
    function writePositions() {
      for (const n of N) { const o = n.i * 16, hl = !!(n.cv && haloOn(n)), c0 = n.noCore ? 0 : n.cv, r = hl ? 0 : c0, t = hl ? c0 : 0, h = hl ? n.cv + 3.2 : 0;
        mArr[o] = r; mArr[o + 5] = r; mArr[o + 10] = r; mArr[o + 12] = n.x; mArr[o + 13] = n.y; mArr[o + 14] = n.z; mArr[o + 15] = 1;
        tArr[o] = t; tArr[o + 5] = t; tArr[o + 10] = t; tArr[o + 12] = n.x; tArr[o + 13] = n.y; tArr[o + 14] = n.z; tArr[o + 15] = 1;
        hArr[o] = h; hArr[o + 5] = h; hArr[o + 10] = h; hArr[o + 12] = n.x; hArr[o + 13] = n.y; hArr[o + 14] = n.z; hArr[o + 15] = 1; }
      inst.instanceMatrix.needsUpdate = true; halo.instanceMatrix.needsUpdate = true; topc.instanceMatrix.needsUpdate = true;
      seg(bLines.geometry.attributes.position.array, baseL); bLines.geometry.attributes.position.needsUpdate = true;
      seg(dLines.geometry.attributes.position.array, brL); dLines.geometry.attributes.position.needsUpdate = true; dLines.computeLineDistances();
      if (hiList.length) { const a = new Float32Array(hiList.length * 6); seg(a, hiList); hiLines.geometry.setPositions(a); }
      if (hiBrList.length) { const a = new Float32Array(hiBrList.length * 6); seg(a, hiBrList); hiBr.geometry.setPositions(a); hiBr.computeLineDistances(); }
      if (xList.length) { const a = new Float32Array(xList.length * 6); seg(a, xList); xLn.geometry.setPositions(a); xLn.computeLineDistances(); }
      dkPos();
    }
    // setPositions on LineSegmentsGeometry resets colours, so colours are re-applied after each position write
    const _wp = writePositions;
    const writeAll = () => { _wp(); if (hiList.length) { const hc = new Float32Array(hiList.length * 6); hiList.forEach((l, j) => { const c = l.kind === 'tree' ? HI.tree : S.alert ? (N[l.s0].alt || N[l.t0].alt ? HI.red : HI.mix) : HI.cite; for (let k = 0; k < 2; k++) { hc[j * 6 + k * 3] = c.r; hc[j * 6 + k * 3 + 1] = c.g; hc[j * 6 + k * 3 + 2] = c.b; } }); hiLines.geometry.setColors(hc); } };

    // ---- regions ----
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); const regions = new Map();
    function syncRegions() {
      const keep = new Set();
      clusters.forEach(c => {
        keep.add(c.k); let sp = regions.get(c.k);
        if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.renderOrder = -1; scene.add(sp); regions.set(c.k, sp); }
        sp.material.color.set(c.info.color); sp.material.opacity = S.hiN.size ? .05 : .26;
        sp.position.set(c.x, c.y, c.z); const s = c.r * 2.9 + 40; sp.scale.set(s, s, 1); sp.visible = true;
      });
      regions.forEach((sp, k) => { if (!keep.has(k)) sp.visible = false; });
    }

    // ---- camera moves ----
    let tween = null, panelShift = 0, heroShift = 0, heroX = 0, fit0 = 0;
    const V = new THREE.Vector3();
    function flyCam(p, t, ms) { tween = { t0: performance.now(), ms: Math.max(1, ms), p0: cam.position.clone(), p1: new THREE.Vector3(p.x, p.y, p.z), q0: controls.target.clone(), q1: new THREE.Vector3(t.x, t.y, t.z) }; }
    function stepTween() { const k = Math.min(1, (performance.now() - tween.t0) / tween.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; cam.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.q0, tween.q1, e); if (k >= 1) tween = null; }
    const legendShift = () => $('side').classList.contains('min') ? 0 : -165;
    function applyOffset() { const s = panelShift + legendShift() + heroX, y = heroShift; if (s || y) cam.setViewOffset(W(), Hh(), s, y, W(), Hh()); else cam.clearViewOffset(); cam.updateProjectionMatrix(); }
    $('sideh').addEventListener('click', () => setTimeout(applyOffset, 0));
    const stopRot = () => { rotIdle = performance.now(); };
    function frameSet(ns, focus, ms, tight, elev) {
      if (!ns.length) return;
      const c = { x: 0, y: 0, z: 0 };
      if (tight) { ns.forEach(m => { c.x += m.x; c.y += m.y; c.z += m.z; }); ['x', 'y', 'z'].forEach(a => c[a] /= ns.length); }
      else ['x', 'y', 'z'].forEach(a => { let lo = Infinity, hi = -Infinity; ns.forEach(m => { lo = Math.min(lo, m[a]); hi = Math.max(hi, m[a]); }); c[a] = (lo + hi) / 2; });
      const small = ns.length <= 24;
      if (focus) ['x', 'y', 'z'].forEach(a => c[a] = focus[a]); // orbit centre = the selected node
      const ds = ns.map(m => Math.hypot(m.x - c.x, m.y - c.y, m.z - c.z)).sort((a, b) => a - b);
      const r = Math.max(tight ? 30 : 60, ds[Math.min(ds.length - 1, Math.floor(ds.length * (tight ? (small ? 1 : .9) : .985)))] || 0);
      // v2: fit into the space the panel, legend and start panel leave free, not the whole canvas (the panel no longer covers the burst)
      const fov = cam.fov * Math.PI / 180, fw = Math.max(240, W() - (panelShift ? 440 : 0) - (legendShift() ? 300 : 0) + 2 * heroX), fh = Math.max(200, Hh() + 2 * heroShift);
      const fv = 2 * Math.atan(Math.tan(fov / 2) * fh / Hh()), fz = 2 * Math.atan(Math.tan(fov / 2) * fw / Hh());
      const dist = r / Math.sin(Math.min(fv, fz) / 2) * (tight ? 1.05 : elev != null && elev > .6 ? .8 : heroX || W() < 1100 ? .8 : .7) + 20;
      if (!tight && !focus) fit0 = dist;
      const d = V.copy(cam.position).sub(controls.target); if (d.length() < 1) d.set(0, .3, 1); d.normalize();
      if (elev != null) { const az = Math.atan2(d.x, d.z); d.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)); } // by subject looks down more steeply, so the wide ring of domains opens up
      flyCam({ x: c.x + d.x * dist, y: c.y + d.y * dist, z: c.z + d.z * dist }, c, ms);
    }

    // ---- picking + hover ----
    const dom = renderer.domElement; let down = null;
    const tipEl = document.createElement('div'); tipEl.style.cssText = 'position:fixed;z-index:22;pointer-events:none;display:none'; document.body.appendChild(tipEl);
    function pickAt(cx, cy, only) {
      const rect = dom.getBoundingClientRect(), x = cx - rect.left, y = cy - rect.top, w = W(), h = Hh();
      const f = h / 2 / Math.tan(cam.fov * Math.PI / 360); let best = null, bs = Infinity;
      for (const n of N) {
        if (!n.vis || (only && !canClick(n.i))) continue; V.set(n.x, n.y, n.z).project(cam); if (V.z > 1 || V.z < -1) continue;
        const sx = (V.x + 1) / 2 * w, sy = (1 - V.y) / 2 * h, dx = sx - x, dy = sy - y; if (Math.abs(dx) > 40 || Math.abs(dy) > 40) continue;
        const sr = n.cv * f / cam.position.distanceTo(V.set(n.x, n.y, n.z)), d = Math.hypot(dx, dy);
        if (d > sr + 5) continue; const s = d - sr - (S.hiN.has(n.i) ? 3 : 0); if (s < bs) { bs = s; best = n; }
      }
      return best;
    }
    dom.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; stopRot(); tween = null; });
    dom.addEventListener('pointerup', e => {
      if (!down) return; const mv = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (mv > 5 || e.button !== 0) return;
      const n = pickAt(e.clientX, e.clientY, true); if (n) nodeClick(n.i); else if (!pickAt(e.clientX, e.clientY, false)) bgClick();
    });
    dom.addEventListener('wheel', () => { stopRot(); tween = null; }, { passive: true });
    let lastHover = 0;
    dom.addEventListener('pointermove', e => {
      if (down || performance.now() - lastHover < 50) return; lastHover = performance.now();
      const n = pickAt(e.clientX, e.clientY, true); dom.style.cursor = n ? 'pointer' : 'grab';
      if (n) { tipEl.innerHTML = tip(n); tipEl.style.display = 'block'; tipEl.style.left = (e.clientX + 14) + 'px'; tipEl.style.top = (e.clientY + 14) + 'px'; } else tipEl.style.display = 'none';
    });
    dom.addEventListener('pointerleave', () => { tipEl.style.display = 'none'; });

    // ---- v4 dark theme: a glow point per node and the flowing citations (shader-driven: no per-frame CPU work) ----
    const DKRANK = n => n.g === 'BS' ? 3 : (n.g === 'AD' || n.g === 'HSE') ? 2 : n.k === 'ordinance' || n.k === 'external_ordinance' ? 0 : n.k === 'regulation' ? 1 : 1.5;
    const gVS = `attribute float sz; attribute vec3 cl; attribute float al; uniform float uS; varying vec3 vC; varying float vA;
      void main(){ vC = cl; vA = al; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = al > 0.0 ? clamp(sz * uS / max(1.0, -mv.z), 0.0, 160.0) : 0.0; gl_Position = projectionMatrix * mv; }`;
    const gFS = `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - vec2(.5)) * 2.0; if (d > 1.0) discard; float a = (1.0 - d); a = a * a * vA; gl_FragColor = vec4(vC * a, a); }`;
    const fVS = `attribute vec3 pa; attribute vec3 pb; attribute float ph; attribute float sp; attribute vec3 cl; attribute float al; uniform float uT; uniform float uS; uniform float uP; varying vec3 vC; varying float vA;
      void main(){ float k = fract(uT * sp + ph); vec3 p = mix(pa, pb, k); vC = cl; vA = al * sin(3.14159 * k); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = al > 0.0 ? clamp(uP * uS / max(1.0, -mv.z), 1.6, 8.0) : 0.0; gl_Position = projectionMatrix * mv; }`;
    const fFS = `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - vec2(.5)) * 2.0; if (d > 1.0) discard; float a = (1.0 - d * d) * vA; gl_FragColor = vec4(vC * a * 1.3, a); }`;
    const dkMat = (vs, fs, u) => new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: u, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    const gGeo = new THREE.BufferGeometry(), gp = new Float32Array(N.length * 3), gs = new Float32Array(N.length), gc = new Float32Array(N.length * 3), ga = new Float32Array(N.length);
    [['position', gp, 3], ['sz', gs, 1], ['cl', gc, 3], ['al', ga, 1]].forEach(([k, v, n]) => gGeo.setAttribute(k, new THREE.BufferAttribute(v, n)));
    const gMat = dkMat(gVS, gFS, { uS: { value: 1 } }), DKG = new THREE.Points(gGeo, gMat); DKG.frustumCulled = false; DKG.renderOrder = 9; scene.add(DKG);
    const flowL = baseL, FP = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 2, flowN = flowL.length * FP;
    const fGeo = new THREE.BufferGeometry(), fa = new Float32Array(flowN * 3), fb = new Float32Array(flowN * 3), fph = new Float32Array(flowN), fsp = new Float32Array(flowN), fc = new Float32Array(flowN * 3), fal = new Float32Array(flowN);
    for (let j = 0; j < flowN; j++) { fph[j] = ((j * 0.6180339887) % 1); fsp[j] = .10 + ((j * 7919) % 97) / 97 * .06; }
    [['position', new Float32Array(flowN * 3), 3], ['pa', fa, 3], ['pb', fb, 3], ['ph', fph, 1], ['sp', fsp, 1], ['cl', fc, 3], ['al', fal, 1]].forEach(([k, v, n]) => fGeo.setAttribute(k, new THREE.BufferAttribute(v, n)));
    const fMat = dkMat(fVS, fFS, { uT: { value: 0 }, uS: { value: 1 }, uP: { value: 2.6 } }), DKF = new THREE.Points(fGeo, fMat); DKF.frustumCulled = false; DKF.renderOrder = 8; scene.add(DKF);
    // knock-out (11 Nov, R5 T2): every status dot with a halo gets a soft map-colour surround, opaque at the halo edge and fading out over
    // 8 screen px, drawn after the glow / nebula / flow and before the halo and cores, so the clouds and lines never sit right against a dot
    const kVS = `attribute float kr; uniform float uS; uniform float uPad; varying float vIn;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float rs = kr * uS / max(1.0, -mv.z), R = rs + uPad; vIn = rs / R; gl_PointSize = kr > 0.0 ? 2.0 * R : 0.0; gl_Position = projectionMatrix * mv; }`;
    const kFS = `uniform vec3 uC; varying float vIn; void main(){ float d = length(gl_PointCoord - vec2(.5)) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(uC, d <= vIn ? 1.0 : 1.0 - smoothstep(vIn, 1.0, d)); }`;
    const kGeo = new THREE.BufferGeometry(), kr = new Float32Array(N.length); kGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3)); kGeo.setAttribute('kr', new THREE.BufferAttribute(kr, 1));
    const kMat = new THREE.ShaderMaterial({ vertexShader: kVS, fragmentShader: kFS, uniforms: { uS: { value: 1 }, uPad: { value: 8 }, uC: { value: new THREE.Vector3(7 / 255, 10 / 255, 16 / 255) } }, transparent: true, depthWrite: false, depthTest: false });
    const DKK = new THREE.Points(kGeo, kMat); DKK.frustumCulled = false; DKK.renderOrder = 9.5; scene.add(DKK);
    const DKC = new THREE.Color(), DKRED = new THREE.Color('#ff4b3e'), DKORG = new THREE.Color('#ffab6b');
    let dkActive = 0, dkRed = 0, dkLastIn = performance.now(), dkForce = false;
    ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { dkLastIn = performance.now(); }, { passive: true }));
    function dkState() {
      const hi = S.hiN.size > 0;
      N.forEach(n => { const o = n.i * 3; DKC.set(nodeColor(n)); gc[o] = DKC.r; gc[o + 1] = DKC.g; gc[o + 2] = DKC.b;
        ga[n.i] = !n.vis || n.noCore ? 0 : S.alert ? (n.alt ? .3 : hi && S.hiN.has(n.i) ? .25 : .04) : hi && !S.hiN.has(n.i) ? .05 : .22 + .5 * Math.min(1, (n.deg || 0) / 45); });
      gGeo.attributes.cl.needsUpdate = true; gGeo.attributes.al.needsUpdate = true;
      dkActive = 0; dkRed = 0;
      flowL.forEach((l, j) => {
        let al = 0, c = null;
        if (l.vis) {
          const A = N[l.s0], B = N[l.t0];
          if (S.alert) { if (S.hiL.has(l) && l.kind === 'cite' && (A.alt || B.alt)) { al = 1; c = DKRED; dkRed++; } }
          else if (hi) { if (S.hiL.has(l)) { al = .95; c = DKORG; } }
          else { al = l.faint ? .16 : l.kind === 'tree' ? .32 : .5; c = DKC.set(colOf(DKRANK(A) <= DKRANK(B) ? A : B)); }
        }
        if (al) dkActive++;
        for (let p = 0; p < FP; p++) { const k = j * FP + p; fal[k] = al; if (c) { fc[k * 3] = c.r; fc[k * 3 + 1] = c.g; fc[k * 3 + 2] = c.b; } }
      });
      fGeo.attributes.cl.needsUpdate = true; fGeo.attributes.al.needsUpdate = true;
    }
    function dkPos() {
      N.forEach(n => { const o = n.i * 3; gp[o] = n.x; gp[o + 1] = n.y; gp[o + 2] = n.z; gs[n.i] = n.cv ? n.cv * 3.4 + 3 : 0; kr[n.i] = n.cv && haloOn(n) ? n.cv + 3.2 : 0; });
      gGeo.attributes.position.needsUpdate = true; gGeo.attributes.sz.needsUpdate = true; kGeo.attributes.position.needsUpdate = true; kGeo.attributes.kr.needsUpdate = true;
      flowL.forEach((l, j) => { let A = N[l.s0], B = N[l.t0]; if (DKRANK(A) > DKRANK(B)) [A, B] = [B, A];
        for (let p = 0; p < FP; p++) { const k = (j * FP + p) * 3; fa[k] = A.x; fa[k + 1] = A.y; fa[k + 2] = A.z; fb[k] = B.x; fb[k + 1] = B.y; fb[k + 2] = B.z; } });
      fGeo.attributes.pa.needsUpdate = true; fGeo.attributes.pb.needsUpdate = true;
    }
    function dkTick() {
      const now = performance.now(), s = SH / (2 * Math.tan(cam.fov * Math.PI / 360)) * renderer.getPixelRatio();
      gMat.uniforms.uS.value = s; fMat.uniforms.uS.value = s; kMat.uniforms.uS.value = s; kMat.uniforms.uPad.value = 8 * renderer.getPixelRatio();
      DKF.visible = !dkForce && !RM.matches && !document.hidden && now - dkLastIn < 60000 && dkActive > 0;
      if (DKF.visible) fMat.uniforms.uT.value = (now / 1000) % 1000;
    }

    // ---- loop ----
    let dirtyState = true, dirtyPos = true;
    function loop() {
      requestAnimationFrame(loop);
      if (stepMorph()) { dirtyPos = true; syncRegions(); }
      if (tween) stepTween();
      if (pulsing() || (S.alert && performance.now() - S.altT < 7000)) { for (const n of ALT) if (n.vis) n.cv = Math.cbrt(nodeVal(n)) * REL; dirtyPos = true; }
      if (bursting() || (S.burst && performance.now() < S.burstT + 1300)) { for (const i of S.hiN) { const n = N[i]; if (n.vis) n.cv = Math.cbrt(nodeVal(n)) * REL; } dirtyPos = true; }
      controls.autoRotate = rotOn && !tween && !dragging && performance.now() - rotIdle > 3000;
      controls.autoRotateSpeed = S.sel != null ? .6 : .45;
      controls.update();
      // clip whatever sits in the front part of the way to the focus, so a close-up is never hidden behind other nodes
      const near = Math.max(1, cam.position.distanceTo(controls.target) * (S.hiN.size ? .42 : .08));
      if (Math.abs(near - cam.near) > .5) { cam.near = near; cam.updateProjectionMatrix(); }
      if (dirtyState) { writeState(); dirtyState = false; dirtyPos = true; }
      if (dirtyPos) { writeAll(); dirtyPos = false; }
      dkTick(); renderer.render(scene, cam);
    }
    updateClusters(); syncRegions(); frameSet(N.filter(n => n.vis), null, 0, false);
    requestAnimationFrame(loop);
    return {
      dk: () => ({ mode: '3d', flow: DKF.visible, active: dkActive, red: dkRed, n: flowN, glow: DKG.visible, rm: RM.matches }),
      dkIdle(ms) { dkLastIn = performance.now() - ms; }, dkSet(o) { if ('glow' in o) DKG.visible = !!o.glow; if ('neb' in o) regions.forEach(sp => { sp.material.opacity = o.neb ? .26 : 0; }); if ('flow' in o) dkForce = !o.flow; },
      controls, stopRot,
      rotate(on) { if (on == null) return rotOn; rotOn = !!on; if (on) rotIdle = -1e9; else { controls.autoRotate = false; controls.enableDamping = false; controls.update(); controls.enableDamping = true; } try { localStorage.setItem('ukmap_rotate', on ? '1' : '0'); } catch (e) { } return rotOn; },
      target: () => ({ x: controls.target.x, y: controls.target.y, z: controls.target.z }), camPos: () => ({ x: cam.position.x, y: cam.position.y, z: cam.position.z }),
      refresh() { dirtyState = true; syncRegions(); },
      moved() { dirtyPos = true; syncRegions(); },
      toScreen(n, out) { V.set(n.x, n.y, n.z).project(cam); if (V.z > 1 || V.z < -1) return false; out.x = (V.x + 1) / 2 * W(); out.y = (1 - V.y) / 2 * Hh(); out.d = V.z; return true; },
      rad(n) { const r = (n.cv || 0) + (haloOn(n) ? 3.2 : 0); if (!r) return 0; const d = cam.position.distanceTo(V.set(n.x, n.y, n.z)); return r * Hh() / (2 * Math.tan(cam.fov * Math.PI / 360)) / Math.max(1, d); },
      clusterScreen(c, out) {
        V.set(GC.x, GC.y, GC.z).project(cam); out.gx = (V.x + 1) / 2 * W(); out.gy = (1 - V.y) / 2 * Hh();
        V.set(c.x, c.y, c.z).project(cam); if (V.z > 1) return false; out.x = (V.x + 1) / 2 * W(); out.y = (1 - V.y) / 2 * Hh();
        out.r = c.r * (Hh() / 2 / Math.tan(cam.fov * Math.PI / 360)) / cam.position.distanceTo(V.set(c.x, c.y, c.z)); return true;
      },
      panel(open) { panelShift = open ? Math.round((($('panel').offsetWidth || 420) + 8) / 2) : 0; applyOffset(); },
      hero(dx, dy) { heroX = -Math.round(dx || 0); heroShift = -Math.round(dy || 0); applyOffset(); },
      zr: () => fit0 ? cam.position.distanceTo(controls.target) / fit0 : 1,
      flyTo(ids, focus) { stopRot(); frameSet([...ids].map(i => N[i]).filter(n => n.vis), focus != null ? N[focus] : null, 1500, true); },
      fitAll(ms = 800, elev) { frameSet(N.filter(n => n.vis), null, ms, false, elev); },
      zoom(f) { stopRot(); const t = controls.target, p = cam.position; flyCam({ x: t.x + (p.x - t.x) * f, y: t.y + (p.y - t.y) * f, z: t.z + (p.z - t.z) * f }, t.clone(), 350); },
      resize() { reSize(); renderer.setSize(W(), Hh()); cam.aspect = W() / Hh(); applyOffset(); hiMat.resolution.set(W(), Hh()); hiBrMat.resolution.set(W(), Hh()); xMat.resolution.set(W(), Hh()); },
      info: () => renderer.info.render
    };
  }

  async function make2D() {
    const FG = (await import('https://cdn.jsdelivr.net/npm/force-graph@1.51.4/+esm')).default;
    const linkCol = l => {
      if (S.pvXL.has(l)) return 'rgba(240,164,99,.6)';
      if (S.hiN.size) { if (!S.hiL.has(l)) return 'rgba(42,52,67,.35)'; return l.kind === 'bridge' ? '#eef3f9' : l.kind === 'tree' ? 'rgba(169,184,204,.8)' : S.alert ? (N[l.s0].alt || N[l.t0].alt ? 'rgba(255,90,79,.95)' : 'rgba(230,195,74,.85)') : 'rgba(255,157,85,.95)'; }
      return l.kind === 'bridge' ? 'rgba(232,238,246,.75)' : l.kind === 'tree' ? 'rgba(135,150,173,.42)' : l.faint ? 'rgba(86,103,126,.2)' : 'rgba(111,141,181,.34)';
    };
    const G = new FG(stage)
      .backgroundColor('rgba(245,237,228,0)').nodeId('i').nodeRelSize(2.1)
      .nodeVal(nodeVal).nodeColor(nodeColor).nodeVisibility(n => n.vis).nodeLabel(null)
      .linkVisibility(l => l.vis).linkColor(linkCol).linkWidth(l => S.hiL.has(l) ? 1.3 : S.pvXL.has(l) ? 1 : .45).linkLineDash(l => S.pvXL.has(l) ? [4, 3] : l.kind === 'bridge' ? [3, 2.4] : null)
      .linkDirectionalParticles(l => RM.matches || l.kind === 'bridge' || !l.vis ? 0 : S.alert ? (S.hiL.has(l) && l.kind === 'cite' && (N[l.s0].alt || N[l.t0].alt) ? 2 : 0) : S.hiN.size && S.hiL.has(l) ? 1 : 0)
      .linkDirectionalParticleColor(() => S.alert ? '#ff5a4f' : '#ffab6b').linkDirectionalParticleWidth(2.2).linkDirectionalParticleSpeed(.006)
      .enableNodeDrag(false)
      .nodeCanvasObjectMode(n => haloOn(n) || n.noCore ? 'replace' : undefined)
      .nodeCanvasObject((n, ctx, k) => { if (haloOn(n)) return; const r = Math.max(Math.sqrt(Math.max(0, nodeVal(n) || 1)) * 2.1, 2.2 / (k || 1)); if ((n.deg || 0) > 18 && !n.noCore && !(S.hiN.size && !S.hiN.has(n.i))) { ctx.globalAlpha = .16; ctx.fillStyle = nodeColor(n); ctx.beginPath(); ctx.arc(n.x, n.y, r * 2.6, 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1; } if (!n.noCore) { ctx.fillStyle = nodeColor(n); ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fill(); } })
      .onRenderFramePost((ctx, k) => { const kk = k || 1; ctx.strokeStyle = HALO; ctx.lineWidth = 2.2 / kk; for (const n of N) { if (n.x == null || !haloOn(n)) continue; const r = Math.max(Math.sqrt(Math.max(0, nodeVal(n) || 1)) * 2.1, 2.2 / kk); if (!n.noCore) { ctx.fillStyle = nodeColor(n); ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fill(); } ctx.beginPath(); ctx.arc(n.x, n.y, r + 1.1 / kk, 0, 2 * Math.PI); ctx.stroke(); } })
      // in a search view grey dots have no hit area, and lines never do, so neither reacts to a hover or a click
      .nodePointerAreaPaint((n, c, ctx) => { if (!canClick(n.i)) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(n.x, n.y, Math.sqrt(Math.max(0, nodeVal(n))) * 2.1 + 1, 0, 2 * Math.PI); ctx.fill(); })
      .linkPointerAreaPaint(() => { })
      .onNodeClick(n => { if (canClick(n.i)) nodeClick(n.i); }).onBackgroundClick(ev => { const n = ev && pick2(ev, true); if (n) nodeClick(n.i); else if (!(ev && pick2(ev, false))) bgClick(); })
      .onRenderFramePre((ctx, k) => {
        if (!stepMorph() && !pulsing() && !bursting() && !(S.alert && performance.now() - S.altT < 7000) && !(S.burst && performance.now() < S.burstT + 1300) && G.autoPauseRedraw && !G.autoPauseRedraw()) G.autoPauseRedraw(true);
        clusters.forEach(c => {
          const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.45 + 20);
          const [r, gg, b] = hex(c.info.color); const a = S.hiN.size ? .05 : .13;
          g.addColorStop(0, `rgba(${r},${gg},${b},${a})`); g.addColorStop(.6, `rgba(${r},${gg},${b},${a * .45})`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.45 + 20, 0, 7); ctx.fill();
        });
      })
      .warmupTicks(0).cooldownTicks(0);
    // force-graph finds its hover target in the render loop, so a quick tap with no hover before it arrives as a
    // background click. Hit-test those ourselves, with a finger-sized margin.
    function pick2(ev, only) {
      const rc = stage.getBoundingClientRect(), x = ev.clientX - rc.left, y = ev.clientY - rc.top, z = G.zoom(); let best = null, bs = Infinity;
      for (const n of N) {
        if (!n.vis || n.x == null || (only && !canClick(n.i))) continue; const p = G.graph2ScreenCoords(n.x, n.y), dx = p.x - x, dy = p.y - y;
        if (Math.abs(dx) > 40 || Math.abs(dy) > 40) continue;
        const sr = Math.sqrt(Math.max(0, nodeVal(n))) * 2.1 * z, d = Math.hypot(dx, dy); if (d > sr + 10) continue;
        const sc = d - sr - (S.hiN.has(n.i) ? 4 : 0); if (sc < bs) { bs = sc; best = n; }
      }
      return best;
    }
    G.d3Force('charge', null); G.d3Force('link', null); G.d3Force('center', null);
    G.graphData({ nodes: N, links: L });
    let HB = 0, z0 = 0;
    function fitBand(ms) { // fit the visible map into the band below the start panel (phones)
      const vs = N.filter(n => n.vis && n.x != null); if (!vs.length) return; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      vs.forEach(n => { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
      const W = stage.clientWidth, Hs = stage.clientHeight, bh = Math.max(140, Hs - HB - 54), k = Math.max(.1, Math.min(W / (x1 - x0 + 36), bh / (y1 - y0 + 36)));
      const mid = HB + bh / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; G.zoom(k, ms); G.centerAt(cx, cy - (mid - Hs / 2) / k, ms); z0 = k;
    }
    updateClusters(); setTimeout(() => { if (HB) fitBand(0); else { G.zoomToFit(0, 18, n => n.vis); z0 = G.zoom(); } }, 30);
    const sheetH = () => $('panel').classList.contains('open') ? $('panel').offsetHeight : 0;
    return {
      G, stopRot() { },
      dk: () => ({ mode: '2d', flow: false, active2d: G.graphData().links.filter(l => (G.linkDirectionalParticles())(l) > 0).length, rm: RM.matches }),
      refresh(what) { G.linkDirectionalParticles(G.linkDirectionalParticles()); G.nodeColor(G.nodeColor()).nodeVal(G.nodeVal()).linkColor(G.linkColor()).linkWidth(G.linkWidth()).linkLineDash(G.linkLineDash()).nodePointerAreaPaint(G.nodePointerAreaPaint()); if (what === 'vis') G.nodeVisibility(G.nodeVisibility()).linkVisibility(G.linkVisibility()); },
      moved() { G.autoPauseRedraw(false); },
      toScreen(n, out) { const p = G.graph2ScreenCoords(n.x, n.y); out.x = p.x; out.y = p.y; out.d = 0; return true; },
      rad(n) { const k = G.zoom() || 1; return Math.max(Math.sqrt(Math.max(0, nodeVal(n) || 1)) * 2.1 * k, 2.2) + (haloOn(n) ? 1.1 : 0); },
      clusterScreen(c, out) { const g = G.graph2ScreenCoords(GC.x, GC.y), p = G.graph2ScreenCoords(c.x, c.y); out.gx = g.x; out.gy = g.y; out.x = p.x; out.y = p.y; out.r = c.r * G.zoom(); return true; },
      panel() { },
      flyTo(ids, focus) {
        const fam = [...ids].map(i => N[i]).filter(n => n.vis); if (!fam.length) return;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        fam.forEach(n => { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
        const W = stage.clientWidth, Hh = stage.clientHeight - Math.max(sheetH(), Hh0() * .58) + 10;
        const k = Math.max(.35, Math.min(4, Math.min(W / (x1 - x0 + 60), Math.max(120, Hh - 90) / (y1 - y0 + 60)) * .92));
        const f = focus != null ? N[focus] : null;
        const cx = f && fam.length > 1 ? (x0 + x1) / 2 * .5 + f.x * .5 : (x0 + x1) / 2, cy = f && fam.length > 1 ? (y0 + y1) / 2 * .5 + f.y * .5 : (y0 + y1) / 2;
        // centre the family in the band between the search bar and the bottom sheet
        const bandMid = 56 + (Hh - 56) / 2, shift = (stage.clientHeight / 2 - bandMid) / k;
        G.centerAt(cx, cy + shift, 800); G.zoom(k, 800);
      },
      fitAll(ms = 600) { if (HB) return fitBand(ms); G.zoomToFit(ms, 18, n => n.vis); setTimeout(() => { z0 = G.zoom(); }, ms + 40); },
      hero(dx, dy) { HB = Math.round(dy || 0); }, zr: () => z0 ? z0 / G.zoom() : 1,
      zoom(f) { G.zoom(G.zoom() * f, 300); },
      resize() { G.width(stage.clientWidth).height(stage.clientHeight); }
    };
  }
  function Hh0() { return stage.clientHeight; }

  // ---------------- labels overlay (HTML, decluttered each frame) ----------------
  const LB = $('labels'); const lbCache = new Map(); const clCache = new Map();
  function lbEl(n) {
    let o = lbCache.get(n.i);
    if (!o) { const el = document.createElement('div'); el.className = 'lb'; const sub = shortZh(n) || (n.g === 'AD' ? adSub(n) : ''); el.innerHTML = `<b>${esc(n.c)}</b>${sub ? `<span class="en">${esc(sub)}</span>` : ''}`; el.style.display = 'none'; LB.appendChild(el); o = { el, w: 0, h: 0, on: false }; lbCache.set(n.i, o); }
    return o;
  }
  function clEl(c) {
    let o = clCache.get(S.mode + c.k);
    if (!o) { const el = document.createElement('div'); el.className = c.info.sub ? 'cl sj' : 'cl'; if (c.info.sub) el.style.color = mix(c.info.color, '#ffffff', .3); el.innerHTML = `<b>${esc(c.info.en)}</b><span>${esc(c.info.zh)}</span>`; el.style.display = 'none'; LB.appendChild(el); o = { el, w: 0, h: 0, on: false }; clCache.set(S.mode + c.k, o); }
    return o;
  }
  let cands = [];
  function updateCands() {
    const lim = MOBILE ? 9 : 30;
    if (S.hiN.size) cands = [...S.hiN].map(i => N[i]).filter(n => n.vis).sort((a, b) => (b.i === S.sel) - (a.i === S.sel) || b.deg - a.deg).slice(0, MOBILE ? 10 : 26);
    else cands = N.filter(n => n.h && n.vis).sort((a, b) => a.h - b.h).slice(0, lim);
    if (S.pv != null) { // the previewed dot is labelled first, then the strongest results, then a few extension neighbours
      const rest = cands.filter(n => n.i !== S.pv), ext = [...S.pvX].map(i => N[i]).filter(n => n.vis).sort((a, b) => b.deg - a.deg).slice(0, MOBILE ? 3 : 8);
      cands = [N[S.pv], ...rest.slice(0, MOBILE ? 4 : 12), ...ext, ...rest.slice(MOBILE ? 4 : 12)];
    }
    lbCache.forEach(o => { if (o.on) { o.el.style.display = 'none'; o.on = false; } });
    cands.forEach(n => { const el = lbEl(n).el; el.classList.toggle('sel', n.i === S.sel); el.classList.toggle('pvl', n.i === S.pv); el.classList.toggle('xl', S.pvX.has(n.i)); });
  }
  const pt = { x: 0, y: 0, d: 0 };
  const ring = document.createElement('div'); ring.className = 'pvring'; LB.appendChild(ring); let ringOn = false;
  let frames = 0, fpsT = performance.now(); const fpsHist = [];
  const showFps = /[?&]fps/.test(location.search);
  function show(o, on) { if (o.on !== on) { o.el.style.display = on ? 'block' : 'none'; o.on = on; if (on && !o.w) { o.w = o.el.offsetWidth; o.h = o.el.offsetHeight; } } }
  function frame() {
    requestAnimationFrame(frame);
    frames++; const now = performance.now();
    if (now - fpsT > 1000) { const f = frames * 1000 / (now - fpsT); fpsHist.push(f); if (fpsHist.length > 30) fpsHist.shift(); frames = 0; fpsT = now; if (showFps) $('fps').textContent = f.toFixed(0) + ' fps'; }
    if (!window.APP || !window.APP.ready) return;
    zoomCheck(now);
    const W = stage.clientWidth, Hs = stage.clientHeight, placed = [];
    const hit = (x, y, w, h) => { for (const p of placed) if (x < p[0] + p[2] && x + w > p[0] && y < p[1] + p[3] && y + h > p[1]) return true; return false; };
    if (S.pv != null && N[S.pv].x != null && R.toScreen(N[S.pv], pt)) { ring.style.transform = `translate(${(pt.x - 17) | 0}px,${(pt.y - 17) | 0}px)`; if (!ringOn) { ring.style.display = 'block'; ringOn = true; } }
    else if (ringOn) { ring.style.display = 'none'; ringOn = false; }
    const rightEdge = (!MOBILE && $('panel').classList.contains('open') && !S.col) ? W - ($('panel').offsetWidth + 20) : W;
    const leftEdge = (!MOBILE && !$('side').classList.contains('min')) ? 290 : (S.hero && !MOBILE ? Math.round($('hero').getBoundingClientRect().right) + 6 : 0);
    // cluster labels first
    const seen = new Set();
    clusters.forEach(c => {
      const o = clEl(c); seen.add(o);
      if (!R.clusterScreen(c, pt)) { show(o, false); return; }
      show(o, true);
      if (c.info.sub) { // by subject: the label sits on its own sub-cluster, centred just above the middle
        const x = pt.x - o.w / 2, y = pt.y - o.h * .75, top = MOBILE ? 118 : 6;
        if (x < leftEdge + 4 || x + o.w > rightEdge - 4 || y < top || y + o.h > Hs - 4 || hit(x, y, o.w, o.h)) { show(o, false); return; }
        placed.push([x - 3, y - 2, o.w + 6, o.h + 4]); o.el.style.transform = `translate(${x | 0}px,${y | 0}px)`; o.el.style.opacity = S.hiN.size ? .66 : 1; return;
      }
      let ux = pt.x - pt.gx, uy = pt.y - pt.gy; const ul = Math.hypot(ux, uy); if (ul < 1) { ux = 0; uy = -1; } else { ux /= ul; uy /= ul; }
      const ax = pt.x + ux * (pt.r * .9 + 10), ay = pt.y + uy * (pt.r * .9 + 10);
      let x = ax - o.w / 2 + ux * o.w * .35, y = uy < 0 ? ay - o.h : ay;
      const top = MOBILE ? 118 : 6;
      const cx0 = x; x = Math.max(leftEdge + 6, Math.min(rightEdge - o.w - 6, x));
      if (Math.abs(x - cx0) > 40) { y = pt.y - pt.r * .9 - 10 - o.h; x = Math.max(leftEdge + 6, Math.min(rightEdge - o.w - 6, pt.x - o.w / 2)); }
      y = Math.max(top, Math.min(Hs - o.h - 6, y));
      if (hit(x, y, o.w, o.h)) { show(o, false); return; }
      placed.push([x - 6, y - 4, o.w + 12, o.h + 8]); o.el.style.transform = `translate(${x | 0}px,${y | 0}px)`;
      o.el.style.opacity = 1;
    });
    clCache.forEach(o => { if (!seen.has(o)) show(o, false); });
    for (const n of cands) {
      const o = lbEl(n);
      if (!n.vis || n.x == null || !R.toScreen(n, pt)) { show(o, false); continue; }
      show(o, true);
      const rr = R.rad ? R.rad(n) : 0, x = pt.x - o.w / 2, y = pt.y + Math.max(n.i === S.sel ? 12 : 7, rr + (n.i === S.sel ? 6 : 3));
      if (x < leftEdge || x + o.w > rightEdge || y < 2 || y + o.h > Hs - 2 || hit(x, y, o.w, o.h)) { show(o, false); continue; }
      placed.push([x - 3, y - 1, o.w + 6, o.h + 2]); o.el.style.transform = `translate(${x | 0}px,${y | 0}px)`;
    }
  }
  requestAnimationFrame(frame);

  // ---------------- navigation history (Back button + browser back) ----------------
  const NAV = { cur: null, stack: [], pushed: 0, restoring: false, skipPop: 0 };
  const sameNav = (a, b) => a && b && a.t === b.t && a.v === b.v;
  function navTo(st) {
    if (!NAV.restoring && NAV.cur && !sameNav(NAV.cur, st)) {
      NAV.stack.push(NAV.cur); if (NAV.stack.length > 60) NAV.stack.shift();
      try { history.pushState({ hkmap: NAV.stack.length }, ''); NAV.pushed++; } catch (e) { }
    }
    NAV.cur = st; backUi();
  }
  function backUi() { const b = $('pback'); if (b) b.hidden = !NAV.stack.length; const b2 = $('pback2'); if (b2) b2.hidden = !NAV.stack.length || !S.col; }
  function goBack() {
    const st = NAV.stack.pop(); if (!st) return; NAV.restoring = true;
    try { if (st.t === 'n') select(st.v); else if (st.t === 'c') selectConcept(st.v); else if (st.t === 'k') selectKeyword(st.v); else if (st.t === 'f') ftSearchView(st.v.q, st.v.only, true); } finally { NAV.restoring = false; }
    NAV.cur = st; backUi();
    if (st.pv != null && S.concept) preview(st.pv, false); // back in the search view: re-mark the document that was opened from it
  }
  function navReset() {
    NAV.stack = []; NAV.cur = null; backUi();
    if (NAV.pushed > 0) { NAV.skipPop++; const k = NAV.pushed; NAV.pushed = 0; try { history.go(-k); } catch (e) { NAV.skipPop--; } }
  }
  window.addEventListener('popstate', () => {
    if (NAV.skipPop > 0) { NAV.skipPop--; return; }
    if (NAV.pushed > 0) NAV.pushed--;
    if (NAV.stack.length) goBack();
  });
  $('pback').onclick = () => { if (!NAV.stack.length) return; if (NAV.pushed > 0) { try { history.back(); return; } catch (e) { } } goBack(); };
  $('pback2').onclick = () => $('pback').onclick();

  // ---------------- selection ----------------
  function setHi(nodes, links) { S.hiN = nodes; S.hiL = links; R.refresh(); updateCands(); }
  function select(i, fly = true) {
    const n = N[i]; if (!n) return;
    if (S.alert) { S.alert = false; S.concept = null; noPv(); alertUi(); }
    heroDone(false);
    navTo({ t: 'n', v: i });
    let changed = false;
    if (HIDE_K.has(n.k) && !S.leg) { S.leg = true; changed = true; }
    if (!S.dept[n.g]) { S.dept[n.g] = true; changed = true; }
    if (S.dom !== 'all' && n.dm !== S.dom) { S.dom = 'all'; changed = true; }
    if (changed) { applyFilter(); R.refresh('vis'); buildSide(); updateClusters(); }
    const rv = new Set(); if (isNC(n)) rv.add(i); n.adj.forEach(l => { const o = l.s0 === i ? l.t0 : l.s0; if (isNC(N[o])) rv.add(o); });
    if (rv.size !== S.rev.size || [...rv].some(x => !S.rev.has(x))) { S.rev = rv; applyFilter(); R.refresh('vis'); updateClusters(); }
    S.sel = i; S.concept = null; noPv(); S.rowsM = null;
    const ns = new Set([i]), ls = new Set();
    n.adj.forEach(l => { if (!l.vis) return; ls.add(l); ns.add(l.s0 === i ? l.t0 : l.s0); });
    setHi(ns, ls);
    Panel.node(n); if (document.activeElement !== $('q')) $('q').value = n.c;
    foldSide(true, 'sel');
    S.burst = false; if (fly) burstAt(i, changed ? 900 : 0);
    if (fly) setTimeout(() => R.flyTo(ns, i), changed ? 900 : 0);
  }
  function lightSet(rows) { // rows: [[node, mentions], ...]
    if (S.alert) { S.alert = false; noPv(); alertUi(); }
    heroDone(false);
    S.burst = false; S.sel = null; noPv(); S.rowsM = new Map(rows); S.rev = new Set(rows.map(r => r[0]).filter(i => isNC(N[i])));
    rows.forEach(([i]) => { if (!N[i].vis && !S.dept[N[i].g]) S.dept[N[i].g] = true; });
    if (S.dom !== 'all') S.dom = 'all';
    applyFilter(); R.refresh('vis'); buildSide();
    const ns = new Set(rows.map(r => r[0]).filter(i => N[i].vis)), ls = new Set();
    L.forEach(l => { if (l.vis && ns.has(l.s0) && ns.has(l.t0)) ls.add(l); });
    setHi(ns, ls); R.flyTo(ns, null);
  }
  function selectConcept(ci) {
    const c = H.concepts[ci]; if (!c) return;
    navTo({ t: 'c', v: ci });
    const rows = cDocs(ci);
    lightSet(rows); S.concept = c;
    Panel.concept(c, rows); if (document.activeElement !== $('q')) $('q').value = c[1];
  }
  // free-text fallback: every node whose title or summary contains the words
  function kwRows(qs) {
    const v = qs.trim().toLowerCase(); if (!v) return [];
    const out = [];
    N.forEach(n => {
      const t = [n.te, n.tz, n.se, n.sz].map(x => String(x || '').toLowerCase()).join(' | ');
      let k = 0, p = t.indexOf(v); while (p >= 0) { k++; p = t.indexOf(v, p + v.length); }
      if (k) out.push([n.i, k]);
    });
    return out.sort((a, b) => b[1] - a[1] || (N[b[0]].deg || 0) - (N[a[0]].deg || 0));
  }
  function selectKeyword(qs) {
    const rows = kwRows(qs); if (!rows.length) return;
    navTo({ t: 'k', v: qs.trim() });
    lightSet(rows); S.concept = { kw: qs.trim() };
    Panel.keyword(qs.trim(), rows); if (document.activeElement !== $('q')) $('q').value = qs.trim();
  }
  function clearSel() {
    if (S.alert) { S.alert = false; alertUi(); foldSide(false, 'alert'); }
    if (S.rev.size) { S.rev = new Set(); applyFilter(); R.refresh('vis'); updateClusters(); }
    S.burst = false; S.sel = null; S.concept = null; noPv(); S.rowsM = null; setHi(new Set(), new Set()); Panel.close(); navReset(); foldSide(false, 'sel');
  }
  // In a search result view (concept or keyword) a click on a dot or a result row only previews that document:
  // the highlight and camera stay put, and only the Open button switches to the document's own link view.
  const inSearch = () => !!S.concept && S.sel == null;
  // what may answer a click or hover: everything outside a search view; inside one, only the lit results,
  // the previewed dot and its extension neighbours. Grey dots and all lines stay inert.
  function canClick(i) { return !inSearch() || S.hiN.has(i) || i === S.pv || S.pvX.has(i); }
  function noPv() { S.pv = null; S.pvX = new Set(); S.pvXL = new Set(); }
  // a previewed dot's links that leave the search set: drawn dashed and faint, their far ends lit lightly
  function extOf(i) {
    const X = new Set(), XL = new Set(), inSet = S.hiN.has(i);
    N[i].adj.forEach(l => {
      if (!l.vis) return; const o = l.s0 === i ? l.t0 : l.s0;
      if (S.hiN.has(o)) { if (!inSet) XL.add(l); return; } // inside the set the solid search lines already show it
      X.add(o); XL.add(l);
    });
    return { X, XL };
  }
  function nodeClick(i) { if (S.alert) { if (N[i].alt) alertCard(i); else select(i); return; } if (inSearch()) preview(i); else select(i); }
  function bgClick() { if (S.alert) { if (S.pv != null) alertList(); return; } if (S.pv != null) unpreview(); else if (S.sel != null || S.concept) clearSel(); }
  function preview(i, reveal = true) {
    const n = N[i]; if (!n || !inSearch()) return;
    const x = extOf(i); S.pv = i; S.pvX = x.X; S.pvXL = x.XL; R.refresh(); updateCands();
    if (reveal) { if (narrow()) Panel.setMini(false); else Panel.setCol(false); } // a click must put the Open button on screen
    Panel.preview(n, S.rowsM ? S.rowsM.get(i) : undefined);
  }
  function unpreview() { if (S.pv == null) return; noPv(); R.refresh(); updateCands(); Panel.preview(null); }
  function openPreview() { const i = S.pv; if (i == null) return; if (NAV.cur) NAV.cur.pv = i; select(i); }

  // ---------------- side panel ----------------
  const Panel = {
    open() { $('panel').classList.add('open'); document.body.classList.add('panel-open'), $('panel').inert = false; R.panel(!S.col); sheetVar(); },
    close() { this.preview(null); ftWide(false); $('panel').classList.remove('open', 'full', 'faded', 'mini'); $('q').value = ''; document.body.classList.remove('panel-open'), $('panel').inert = true; this.setCol(false); R.panel(false); sheetVar(); },
    // desktop and tablet: slide the panel out to a slim rail; the state holds while you move between documents
    setCol(on) {
      if (narrow()) return; S.col = !!on;
      $('panel').classList.toggle('col', S.col); document.body.classList.toggle('panel-col', S.col);
      const t = $('ptab'); t.setAttribute('aria-expanded', !S.col); t.title = S.col ? 'Expand panel' : 'Collapse panel';
      t.querySelector('.ar').textContent = S.col ? '‹' : '›'; t.querySelector('.rl').textContent = S.col ? 'Open' : 'Hide';
      R.panel($('panel').classList.contains('open') && !S.col); backUi(); placePvSoon();
    },
    // phones: minimise the bottom sheet to a bar with the title
    setMini(on) {
      if (!MOBILE) return; const p = $('panel'); p.classList.toggle('mini', !!on); if (on) p.classList.remove('full');
      const b = $('pmin'); b.textContent = on ? '︿' : '−'; b.setAttribute('aria-label', on ? 'Expand' : 'Minimise'); b.setAttribute('aria-expanded', !on);
      sheetVar();
    },
    // the preview is a floating card over the map (placePv puts it clear of the legend, panel and controls);
    // the panel keeps the result table, with the previewed row lit and its links tabled under it
    preview(n, m) {
      const box = $('ppv'), body = $('pbody');
      body.querySelectorAll('li.pvr').forEach(li => li.classList.remove('pvr'));
      body.querySelectorAll('.pvt').forEach(t => t.remove());
      if (!n) { box.hidden = true; box.innerHTML = ''; box.classList.remove('off', 'c'); placePv(); sheetVar(); return; }
      const g = GR[n.g] || { en: 'Other ordinances', zh: '' }, kw = !!(S.concept && S.concept.kw), w = n.fd && stWord(n);
      const ment = m === undefined ? `<span>Not in these results </span>`
        : m === null ? '' : m === 0 ? `<span>Tagged by AI, the exact words are not in the text  AI </span>`
        : kw ? `<span>Matches in title and summary <b>${fmt(m)}</b></span>` : `<span>Mentions <b>${fmt(m)}</b></span>`;
      box.innerHTML = `<div class="pvh"><div class="pvk"><span class="sw" style="background:${colOf(n)}"></span><span>Preview  · ${esc(g.en)} <span class="zh">${esc(g.zh)}</span>${w ? ` · ${esc(w[0])} <span class="zh">${esc(w[1])}</span>` : ''}</span></div>` +
        `<button class="pvtg" type="button"></button><button class="pvcx" type="button" aria-label="Close preview" title="Close">×</button>` +
        `<div class="pvc">${esc(n.c)}</div>${n.te && n.te !== n.c ? `<div class="pve">${esc(n.te)}</div>` : ''}${n.tz ? `<div class="pvz">${esc(n.tz)}</div>` : ''}` +
        (ment ? `<div class="pvm">${ment}</div>` : '') +
        `<div class="pvb"><button class="pvo" type="button"> Open ›</button><button class="pvx" type="button">Keep searching </button></div></div>` +
        `<div class="pvsc">${this.pvSum(n)}</div>`;
      box.hidden = false; box.classList.remove('off'); box.querySelector('.pvsc').scrollTop = 0;
      box.querySelector('.pvo').onclick = openPreview; box.querySelector('.pvx').onclick = unpreview; box.querySelector('.pvcx').onclick = unpreview;
      // phones: the card folds to one line (the choice holds while you move between results)
      const tg = box.querySelector('.pvtg');
      tg.onclick = e => { e.stopPropagation(); S.pvCol = !box.classList.contains('c'); placePv(); };
      box.querySelector('.pvh').onclick = e => { if (box.classList.contains('c') && !e.target.closest('button')) tg.click(); };
      // mark its row in the result list, expanding a "Show all" group if the row is folded away
      let li = body.querySelector(`li[data-i="${n.i}"]`);
      if (!li) for (const [id, r] of Object.entries(this._rest || {})) { const more = body.querySelector(`button.more[data-more="${id}"]`); if (more && r.rows.some(x => x.o === n.i)) { more.click(); li = body.querySelector(`li[data-i="${n.i}"]`); break; } }
      if (li) {
        li.classList.add('pvr'); li.insertAdjacentHTML('beforeend', this.pvTable(n, false));
        const a = (li.querySelector('.m') || li).getBoundingClientRect(), b = body.getBoundingClientRect();
        if (a.top < b.top || a.bottom > b.bottom) body.scrollTop += a.top - b.top - Math.max(8, (b.height - a.height) / 4);
      } else body.insertAdjacentHTML('afterbegin', this.pvTable(n, true)); // an extension document: its table leads the list
      // a table row previews that document, so the search view still stays put
      body.querySelectorAll('.pvt button.pvn').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (canClick(i)) preview(i, false); });
      sheetVar(); placePv();
    },
    // the card: bilingual summary, a one-line extension note, the official link
    pvSum(n) {
      let h = '';
      if (n.se) h += `<p class="pvs">${esc(n.se)}</p>`;
      if (n.sz) h += `<p class="pvs zh">${esc(n.sz)}</p>`;
      const nx = S.pvX.size;
      h += `<p class="pvxl">${nx ? `<span class="dash"></span>${fmt(nx)} linked outside these results, dashed on the map · <span class="zh">${fmt(nx)} </span>`
        : `No links outside these results · `}</p>`;
      if (n.u) h += `<p class="pvu"><a href="${esc(n.u)}" target="_blank" rel="noopener">Official source  ↗</a></p>`;
      return h;
    },
    // the panel: the previewed document's cites / cited-by as a table (code | title | relation | in results or extension)
    pvTable(n, top) {
      const rel = new Map(), put = (i, en, zh, k) => { if (i === n.i) return; const r = rel.get(i); if (r) { if (!r.l.some(x => x[0] === en)) r.l.push([en, zh]); r.k = Math.min(r.k, k); } else rel.set(i, { l: [[en, zh]], k }); };
      n.out.forEach(e => { if (e.y === 'c' || e.y === 'r') put(e.t, 'Cites', '', 0); else { const d = REL[e.y] || ['Related', '']; put(e.t, d[0], d[1], 2); } });
      n.inn.forEach(e => { if (e.y === 'c' || e.y === 'r') put(e.s, 'Cited by', '', 1); else { const d = REL[e.y] || ['Related', '', 'Related', '']; put(e.s, d[2], d[3], 2); } });
      n.br.forEach(b => put(b.s === n.i ? b.t : b.s, 'AI suggested', 'AI ', 3));
      const tag = i => S.hiN.has(i) ? `<span class="t in">In results<br></span>` : S.pvX.has(i) ? `<span class="t ex">Extension<br></span>` : `<span class="t">Filtered<br></span>`;
      const ids = [...rel.keys()].sort((a, b) => (S.hiN.has(b) - S.hiN.has(a)) || (rel.get(a).k - rel.get(b).k) || N[b].deg - N[a].deg);
      const LIM = 14, row = i => { const o = N[i], r = rel.get(i); return `<li><button class="pvn" type="button" data-i="${i}"${canClick(i) ? '' : ' disabled'} title="${esc(o.c)} ${esc(o.te || '')} ${esc(o.tz || '')}"><span class="c"><span class="sw" style="background:${colOf(o)}"></span><b>${esc(o.c)}</b></span><span class="n">${esc(o.tz || o.te || '')}</span><span class="rl">${r.l.map(x => `${x[0]} <span class="zh">${x[1]}</span>`).join('<br>')}</span>${tag(i)}</button></li>`; };
      const head = top ? `${esc(n.c)} · not in these results  · links  ${fmt(ids.length)}` : `Links of ${esc(n.c)}  · ${fmt(ids.length)}`;
      if (!ids.length) return `<div class="pvt${top ? ' pvtop' : ''}"><p class="pvtt">${head}</p><p class="pvmore">No citations recorded </p></div>`;
      return `<div class="pvt${top ? ' pvtop' : ''}"><p class="pvtt">${head}</p><div class="pvth" aria-hidden="true"><span>Code<br></span><span>Title<br></span><span>Relation<br></span><span>Status<br></span></div><ul>${ids.slice(0, LIM).map(row).join('')}</ul>` +
        (ids.length > LIM ? `<p class="pvmore">+${ids.length - LIM} more: Open for the full link view </p>` : '') + `</div>`;
    },
    head(kindHtml, code, en, zh, meta) { ftWide(false); $('pkind').innerHTML = kindHtml; $('pcode').textContent = code; $('pen').textContent = en || ''; $('pzh').textContent = zh || ''; $('pmeta').innerHTML = meta || ''; },
    node(n) {
      const g = GR[n.g], kd = KIND[n.k] || KIND.document;
      const kind = `<span class="sw" style="background:${colOf(n)}"></span><span>${esc(g.en)} <span class="zh">${esc(g.zh)}</span> · ${n.sr ? esc(n.sr) : `${kd[0]} <span class="zh">${kd[1]}</span>`}</span>`;
      const meta = [n.dt && `Date <b>${esc(n.dt)}</b>`, n.st && `Status <b>${esc(n.st)}</b>`, n.iff && `In force <b>${esc(n.iff)}</b>`, n.vd && `${n.bsx ? 'Cited edition' : n.g === 'AD' ? 'Edition' : 'Version'} <b>${esc(n.vd)}</b>`,
        n.efd && `Effective <b>${esc(n.efd)}</b>`, `Citations <b>${n.out.length} out · ${n.inn.length} in</b>`].filter(Boolean).map(s => `<span>${s}</span>`).join('');
      const title = n.te && n.te !== n.c ? n.te : '';
      this.preview(null); this.head(kind, n.c, title, n.tz, meta);
      $('panel').classList.toggle('faded', !!n.fd);
      let h = '';
      if (n.bsx) {
        const b = n.bsx, flag = b.s === 'superseded' || b.s === 'withdrawn' || b.s === 'mixed';
        h += `<div class="${flag ? 'stat' : 'info'}" style="border-left:4px solid ${BSC[b.s]}"><b>${esc(BSW[b.s])}</b>${b.note ? '. ' + esc(b.note) : '. No public non-BSI source has been checked for this standard yet, so its current edition is not shown.'}`
          + (b.src && b.src.length ? `<br><span style="font-size:12px">Checked ${esc(fmtD(b.chk))} against: ${b.src.map(x => `<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])} ↗</a>`).join(' · ')}</span>` : '') + `</div>`;
        if (b.pa && b.pa.length > 1) h += `<div class="info"><b>By citing Approved Document</b>${b.pa.map(r => `<div style="margin-top:6px;border-left:4px solid ${BSC[r[1]]};padding-left:8px"><b>${esc(r[0])}</b> cites ${esc(r[2])}: ${esc(paWord(n, r[1], r[2]))}${r[3] ? `<br><span style="font-size:12px">Title as printed there: ${esc(r[3])}</span>` : ''}</div>`).join('')}</div>`;
        h += `<div class="info">Number, title and edition as printed in the Approved Document (Crown copyright, OGL).${n.ts ? ` The title at the top is as printed in ${esc(n.ts)}.` : ''} The standard itself is a BSI publication and is not reproduced or linked here.</div>`;
      }
      const lk = i => `<a data-i="${i}">${esc(N[i].c)}</a>`, sw = stWord(n);
      if (n.dup != null) h += `<div class="stat">Duplicate of ${lk(n.dup)}: another copy of the same document, kept for reference.<span class="zh"> ${lk(n.dup)} </span></div>`;
      else if (n.sby != null) h += `<div class="stat">${sw && sw[0] === 'Repealed' ? 'Repealed. ' : ''}Superseded by ${lk(n.sby)}${n.sdt ? ` (${esc(n.sdt)})` : ''}<span class="zh"> ${lk(n.sby)} </span></div>`;
      else if (sw && LEGK.has(n.k)) h += `<div class="stat">${sw[0]}.<span class="zh">${sw[1]}</span></div>`;
      else if (sw) h += `<div class="stat">${sw[0]}${n.sdt ? ` on ${esc(n.sdt)}` : ''}. Kept for reference; see the official index for the current position.<span class="zh">${sw[1]}${n.sdt ? `${esc(n.sdt)}` : ''}</span></div>`;
      if (n.se) h += `<p class="sum">${esc(n.se)}</p>`;
      if (n.sz) h += `<p class="sumzh">${esc(n.sz)}</p>`;
      if (n.nt) h += `<p class="sum" style="color:var(--muted);font-size:13px">${esc(n.nt)}</p>`;
      if (n.qt) h += `<div class="warn">Summary from title only. The source text was not available, so this summary is based on the title and the department's index.</div>`;
      else if (n.cf === 'low' || n.cf === 'medium') h += `<div class="warn">Summary confidence: ${n.cf}. The source text was partial or unclear, so read the official document before relying on this.<span class="zh">${n.cf === 'low' ? '' : ''}</span></div>`;
      if (n.ml && n.ml.includes('zh') && !(n.qt && n.ml.includes('en'))) h += `<div class="warn">No Chinese version is published; the Chinese title and summary are ours.</div>`;
      if (n.zv) h += `<div class="warn">${n.zv === 'partial' ? 'The Chinese version covers only part of the document.' : 'A Chinese version is published only for a previous revision.'}<span class="zh">${n.zv === 'partial' ? '' : ''}</span></div>`;
      const info = [];
      if (n.lgs) info.push(`Scope : ${esc(n.lgs)}`);
      if (n.hi) info.push(`Historic: still listed, but it concerns a past event or period.`);
      if (n.cpo != null) info.push(`Counterpart of ${lk(n.cpo)}: a parallel version for another group of practitioners.<span class="zh"> ${lk(n.cpo)} </span>`);
      if (n.cvo != null) info.push(`Chinese version of ${lk(n.cvo)}.<span class="zh"> ${lk(n.cvo)} </span>`);
      if (n.ato != null) info.push(`Attachment to ${lk(n.ato)}.<span class="zh"> ${lk(n.ato)} </span>`);
      if (n.rpc) info.push(`Replaces ${esc(n.rpc.join(', '))}.<span class="zh"> ${esc(n.rpc.join(''))}</span>`);
      h += info.map(x => `<div class="info">${x}</div>`).join('');
      // legislation breadcrumb
      if (n.pa != null) { const chain = []; let m = N[n.pa]; while (m) { chain.unshift(m); m = m.pa != null ? N[m.pa] : null; } h += `<h5>Part of </h5><div class="crumb">${chain.map(m => `<a data-i="${m.i}">${esc(m.c)}</a>`).join(' › ')}</div>`; }
      const chips = [];
      if (n.dm && DOM[n.dm]) chips.push(`<span class="chip dm" style="background:${chipBg(DOM[n.dm].color)}">${esc(DOM[n.dm].en)} <span class="zh">${esc(DOM[n.dm].zh)}</span></span>`);
      (n.sb || []).forEach(s => { const t = SUBJ[s]; if (t) chips.push(`<span class="chip">${esc(t[0])} <span class="zh">${esc(t[1])}</span></span>`); });
      if (chips.length) h += `<h5>Subjects ${n.dmi ? '<span class="n">domain inferred from citing documents </span>' : ''}</h5><div class="chips">${chips.join('')}</div>`;
      // relationships
      const grp = { cites: new Map(), by: new Map(), rel: new Map() };
      const add = (m, o, e, dir) => { let r = m.get(o); if (!r) { r = { o, es: [] }; m.set(o, r); } r.es.push({ e, dir }); };
      n.out.forEach(e => add((e.y === 'c' || e.y === 'r') ? grp.cites : grp.rel, e.t, e, 'out'));
      n.inn.forEach(e => add((e.y === 'c' || e.y === 'r') ? grp.by : grp.rel, e.s, e, 'in'));
      const byImp = (a, b) => (N[b.o].deg - N[a.o].deg);
      h += ftCard(n);
      h += this.group('Cites', '', [...grp.cites.values()].sort(byImp), 'cites');
      h += this.group('Cited by', '', [...grp.by.values()].sort(byImp), 'by');
      h += this.group('Explains / made under / amends', '', [...grp.rel.values()], 'rel');
      if (n.br.length) h += `<h5>AI suggested <span class="zh">AI </span><span class="n">${n.br.length}</span></h5><ul>${n.br.map(b => this.bridgeRow(b, n)).join('')}</ul>`;
      const sib = n.sg ? (SG.get(n.sg) || []).filter(i => i !== n.i) : [];
      if (sib.length) h += this.group('Same-title reissues', '', sib.sort((a, b) => String(N[b].dt || '').localeCompare(String(N[a].dt || ''))).map(i => ({ o: i, es: [] })), 'kids');
      if (n.kids.length) h += this.group('Contains', '', n.kids.map(k => ({ o: k, es: [] })), 'kids');
      if (!n.out.length && !n.inn.length && !n.br.length && !n.kids.length) h += `<h5>Links </h5><p class="note">No quoted citation found in the text yet. </p>`;
      $('pbody').innerHTML = h; $('pbody').scrollTop = 0;
      this.src(n);
      this.bind(); this.open();
    },
    rowsHtml(rows, kind) {
      return rows.map(r => {
        const m = N[r.o]; const t = m.tz || m.te || '';
        let tag = '';
        if (kind === 'rel') tag = r.es.map(x => { const d = REL[x.e.y] || ['Related', '', 'Related', '']; return x.dir === 'out' ? d[0] : d[2]; }).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
        else if (r.m !== undefined) tag = r.m ? `mentions: ${r.m}` : r.m === 0 ? 'tagged' : '';
        else if (kind !== 'kids' && r.es.length > 1) tag = r.es.length + ' quotes';
        const qs = r.es.length ? `<button class="qb" aria-expanded="false">Quote  ▾</button>` : '';
        const body = r.es.length ? `<div class="qs">${r.es.map(x => this.quote(x.e)).join('')}</div>` : '';
        return `<li data-i="${m.i}"${m.fd ? ' class="old"' : ''}><div class="m"><span class="sw" style="background:${colOf(m)}"></span><span class="c">${esc(m.c)}</span><span class="n">${esc(t)}</span><span class="r">${esc(tag)}</span>${qs}</div>${body}</li>`;
      }).join('');
    },
    group(en, zh, rows, kind) {
      if (!rows.length) return '';
      const LIM = 25, first = rows.slice(0, LIM), rest = rows.slice(LIM);
      const id = 'g' + Math.random().toString(36).slice(2, 8);
      this._rest = this._rest || {}; this._rest[id] = { rows: rest, kind };
      return `<h5>${en} <span class="zh">${zh}</span><span class="n">${rows.length}</span></h5><ul id="${id}">${this.rowsHtml(first, kind)}</ul>` + (rest.length ? `<button class="more" data-more="${id}">Show all ${rows.length} </button>` : '');
    },
    quote(e) {
      const pg = [e.src && e.src, e.at && e.at, e.pin && `AD index: ${e.pin.join(', ')}`, e.pr && String(e.pr).startsWith('Table') && `in ${e.pr}`, e.p && `PDF p. ${e.p}`, e.ap && e.src === 'AD text' && `in the AD's standards list (PDF p. ${e.ap})`, e.nv === 's' && 'volume not named; linked to the volume with the same number as the citing AD', e.nv === 'b' && 'volume not named, so both volumes are linked', e.ed && `cited edition ${e.ed}`, e.eo && `this AD also prints ${e.eo}`, e.n > 1 && `${e.n} mentions`, e.b === 'title' && 'cited in the title ', e.b === 'text+title' && 'also in the title ', e.ix && 'index list ', e.f && 'covered by a section-level link '].filter(Boolean).join(' · ');
      return `<blockquote>“${esc(e.q)}”${e.qz ? `<br><span class="zh">${esc(e.qz)}</span>` : ''}${pg ? `<span class="pg">${esc(pg)}</span>` : ''}${ftQ(e)}</blockquote>`;
    },
    bridgeRow(b, n) {
      const o = N[b.s === n.i ? b.t : b.s];
      return `<li data-i="${o.i}"><div class="m"><span class="sw" style="background:${colOf(o)}"></span><span class="c">${esc(o.c)}</span><span class="n">${esc(o.tz || o.te || '')}</span><span class="r">AI${b.cf && b.cf !== 'high' ? ' · ' + esc(b.cf) : ''}</span></div>` +
        `<div class="why">${esc(b.re)}<span class="zh">${esc(b.rz)}</span>${b.es || b.et ? `<div class="ev">Evidence : “${esc((b.s === n.i ? b.es : b.et) || '')}” / “${esc((b.s === n.i ? b.et : b.es) || '')}”</div>` : ''}</div></li>`;
    },
    src(n) {
      const a = [];
      if (n.u) a.push(`<a href="${esc(n.u)}" target="_blank" rel="noopener">Official source  ↗</a>`);
      if (n.uz) a.push(`<a href="${esc(n.uz)}" target="_blank" rel="noopener"> ↗</a>`);
      if (!a.length) a.push(`<span style="flex-basis:auto;font-size:12px">${n.bsx ? 'BSI publication: not linked (BSI’s website terms permit linking to its home page; we do not link deeper)' : 'No official link in our set'}</span>`);
      $('psrc').innerHTML = a.join('') + `<span>Personal hobby project, not a government site · not legal advice · transitional provisions can change which edition applies to a project · data checked ${esc(H.checked_en || H.checked)} · Contains public sector information licensed under the Open Government Licence v3.0</span>`;
    },
    listByDept(rows) {
      const by = {}; rows.forEach(([i, m]) => (by[N[i].g] = by[N[i].g] || []).push({ o: i, es: [], m }));
      let h = '';
      [...Object.keys(GR), 'EXT'].filter((g, k, a) => a.indexOf(g) === k).forEach(g => { if (by[g]) { const gi = GR[g] || { en: 'Other ordinances', zh: '' }; h += this.group(gi.en, gi.zh, by[g], 'kids'); } });
      return h;
    },
    disc() { $('psrc').innerHTML = `<span>Personal hobby project, not a government site · not legal advice · transitional provisions can change which edition applies to a project · data checked ${esc(H.checked_en || H.checked)} · Contains public sector information licensed under the Open Government Licence v3.0</span>`; },
    concept(c, rows) {
      const full = !!HS, tot = rows.reduce((a, r) => a + (r[1] || 0), 0);
      this.head(`<span class="sw" style="background:var(--terra)"></span><span>Concept  · ${fmt(rows.length)} documents </span>`, c[1], c[4].length ? 'also: ' + c[4].join(', ') : '', c[2],
        full ? `<span>Full-text search <b>${esc(c[1])} / ${esc(c[2])}</b></span><span>Mentions <b>${fmt(tot)}</b></span>` : '');
      $('panel').classList.remove('faded');
      const tagged = rows.some(r => r[1] === 0);
      let h = full ? `<p class="note">Full text, English and Chinese, most mentions first.${tagged ? ' "Tagged": topic tagged by AI without the exact words.' : ''} <span class="zh">${tagged ? 'taggedAI ' : ''}</span></p>`
        : `<p class="note">Documents tagged with this concept. </p>`;
      h += this.listByDept(rows);
      this.preview(null); $('pbody').innerHTML = h; $('pbody').scrollTop = 0; this.disc();
      this.bind(); this.open();
    },
    keyword(qs, rows) {
      this.head(`<span class="sw" style="background:var(--muted)"></span><span>Keyword  · ${fmt(rows.length)} results </span>`, `“${qs}”`, 'Found in titles and summaries', '', '');
      $('panel').classList.remove('faded');
      let h = `<p class="note">Matched in titles and summaries. <span class="zh"> refuge floor</span></p>`;
      h += this.listByDept(rows.map(([i, m]) => [i, undefined]));
      this.preview(null); $('pbody').innerHTML = h; $('pbody').scrollTop = 0; this.disc();
      this.bind(); this.open();
    },
    bind() {
      const body = $('pbody');
      body.querySelectorAll('li[data-i] > .m').forEach(m => m.onclick = ev => {
        if (ev.target.closest('.qb')) { const li = m.parentElement; li.classList.toggle('ex'); ev.target.setAttribute('aria-expanded', li.classList.contains('ex')); ev.target.textContent = li.classList.contains('ex') ? 'Quote  ▴' : 'Quote  ▾'; return; }
        const i = +m.parentElement.dataset.i; if (inSearch()) preview(i); else select(i);
      });
      body.querySelectorAll('.crumb a, .stat a, .info a').forEach(a => a.onclick = () => select(+a.dataset.i));
      body.querySelectorAll('button.more').forEach(b => b.onclick = () => { const r = this._rest[b.dataset.more]; $(b.dataset.more).insertAdjacentHTML('beforeend', this.rowsHtml(r.rows, r.kind)); b.remove(); this.bind(); });
    }
  };
  $('px').onclick = clearSel;
  document.querySelector('#panel .grab').onclick = () => { const p = $('panel'); if (p.classList.contains('mini')) Panel.setMini(false); else { p.classList.toggle('full'); sheetVar(); } };
  $('ptab').onclick = () => Panel.setCol(!S.col);
  $('pmin').onclick = e => { e.stopPropagation(); Panel.setMini(!$('panel').classList.contains('mini')); };
  document.querySelector('#panel .hd').addEventListener('click', e => { if ($('panel').classList.contains('mini') && !e.target.closest('button')) Panel.setMini(false); });
  // phones: publish the sheet height so the zoom buttons ride on top of it
  function sheetVar() { const p = $('panel'); document.body.style.setProperty('--sheet', MOBILE && p.classList.contains('open') ? p.offsetHeight + 'px' : '0px'); placePvSoon(); }
  // place the floating preview card: over the map, clear of the legend, the lines key, the zoom buttons,
  // the panel (desktop) or the bottom sheet (phones). Where the legend leaves no room beside it, the
  // legend shrinks to its first rows and the card sits under it.
  function placePv() {
    const box = $('ppv'); if (!box) return;
    if (box.hidden) { document.body.classList.remove('pv-stack'); return; }
    const vis = e => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
    const st = $('stage').getBoundingClientRect(), vw = document.documentElement.clientWidth, p = $('panel');
    let left, top, width = null, bottom = st.bottom - 12;
    if (narrow()) {
      document.body.classList.remove('pv-stack');
      left = 10; top = st.top + 8;
      [document.querySelector('.search'), $('mode')].forEach(e => { const r = vis(e); if (r && r.top < top + 120) top = Math.max(top, r.bottom + 8); });
      if (p.classList.contains('open')) bottom = Math.min(bottom, p.getBoundingClientRect().top - 8);
      [$('side'), document.querySelector('.zoombar')].forEach(e => { const r = vis(e); if (r && r.top > top) bottom = Math.min(bottom, r.top - 8); });
    } else {
      const rail = vis($('prail')), right = (p.classList.contains('open') ? Math.min(p.getBoundingClientRect().left, rail ? rail.left : 1e9) : vw) - 16;
      document.body.classList.remove('pv-stack');
      const sr = vis($('side')), beside = sr ? sr.right + 16 : 16;
      if (right - beside >= 380) { left = beside; top = st.top + 16; }
      else { document.body.classList.add('pv-stack'); const s2 = vis($('side')); left = 16; top = s2 ? s2.bottom + 10 : st.top + 16; }
      width = Math.max(240, Math.min(440, right - left));
      [$('linesbox'), document.querySelector('.zoombar')].forEach(e => { const r = vis(e); if (r && r.left < left + width && r.right > left && r.top > top) bottom = Math.min(bottom, r.top - 10); });
    }
    const mh = Math.floor(bottom - top);
    box.style.left = left + 'px'; box.style.top = top + 'px'; box.style.width = width == null ? '' : width + 'px'; box.style.maxHeight = Math.max(0, mh) + 'px';
    const fold = narrow() && (!!S.pvCol || mh < 150), tg = box.querySelector('.pvtg'); // phones: folded by choice, or when there is too little room
    box.classList.toggle('c', fold);
    if (tg) { tg.textContent = fold ? '▾' : '▴'; tg.setAttribute('aria-expanded', !fold); tg.setAttribute('aria-label', fold ? 'Expand preview ' : 'Fold preview '); }
    box.classList.toggle('off', mh < 40); // no room at all (a full-height sheet): never cover it
  }
  var pvT = 0;
  function placePvSoon() { placePv(); clearTimeout(pvT); pvT = setTimeout(placePv, 420); } // again once the panel or sheet has finished sliding
  window.addEventListener('resize', placePvSoon);
  $('panel').addEventListener('transitionend', e => { if (e.target === $('panel')) placePv(); });
  $('sideh').addEventListener('click', () => setTimeout(placePv, 0));
  if (MOBILE && window.ResizeObserver) new ResizeObserver(sheetVar).observe($('panel'));

  // ---------------- legend + filters ----------------
  const cnt = {}; N.forEach(n => { cnt[n.g] = (cnt[n.g] || 0) + 1; });
  const dcnt = {}; N.forEach(n => { if (n.dm) dcnt[n.dm] = (dcnt[n.dm] || 0) + 1; });
  const legCount = N.filter(n => HIDE_K.has(n.k)).length;
  const SHORT = { LEG: 'Acts and regulations', AD: 'Approved Documents', HSE: 'HSE guidance (L153)', BS: 'British Standards' };
  const SHORTZ = { BD: '', FSD: '', LandsD: '', PlanD: '', LEG: '', EXT: '' };
  const linesKey = () =>
      `<div class="lnk"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#6f8db5" stroke-width="1.6"/></svg><span>Solid: explicit citation in the text</span></div>` +
      `<div class="lnk"><svg width="28" height="8"><circle cx="6" cy="4" r="2" fill="#9fc0e8"/><circle cx="18" cy="4" r="2" fill="#9fc0e8"/></svg><span>Moving dots: the way a citation runs (Act, Regulations, Approved Document, British Standard); red in Edition check</span></div>` +
      `<div class="lnk"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#c4763c" stroke-width="1.6" stroke-dasharray="4 3"/></svg><span>Orange dashed: a quoted citation to a document outside your search results</span></div>` +
      `<div class="lnk"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#8796ad" stroke-width="1.6"/></svg><span>Thin grey, from the Regulations to their Parts: structure, not a citation</span></div>` +
      `<div class="lnk"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#e8eef6" stroke-width="1.6" stroke-dasharray="4 3"/></svg><span>White dashed: AI-suggested link with reason<span class="zh">AI </span></span></div>` +
      Object.entries(BSW).map(([k, t]) => `<div class="lnk"><svg width="28" height="10"><circle cx="14" cy="5" r="4" fill="${BSCD[k]}"/></svg><span>BS dot: ${t}${k === 'not checked' ? ' (on zoom)' : ''}</span></div>`).join('') +
      `<div class="lnk"><svg width="28" height="12"><circle cx="5" cy="6" r="2.2" fill="#8fa3bd"/><circle cx="19" cy="6" r="5.5" fill="#8fa3bd"/></svg><span>Size: number of citations</span></div>` +
      `<div class="lnk" style="color:var(--muted)"><svg width="28" height="12"><circle cx="14" cy="6" r="6" fill="#c4763c" opacity=".18"/></svg><span>Topics are regions and colours, never lines</span></div>`;
  if (!MOBILE) { const lb = document.createElement('aside'); lb.id = 'linesbox'; lb.innerHTML = `<h4>Lines</h4>` + linesKey(); document.body.appendChild(lb); }
  function buildSide() {
    const deptRows = Object.entries(GR).map(([k, g]) => `<div class="row"><label><input type="checkbox" data-dept="${k}" ${S.dept[k] ? 'checked' : ''}><span class="sw ${S.mode === 'dept' ? '' : 'sq'}" style="background:${S.mode === 'dept' ? (k === 'LEG' ? '#5a4c40' : k === 'EXT' ? '#9a8d7e' : g.color) : '#cbbfae'}"></span><span class="t one">${esc(SHORT[k] || g.en)} <span class="zh">${esc(SHORTZ[k] || g.zh)}</span></span></label><span class="ct">${fmt(cnt[k] || 0)}</span></div>`).join('');
    const domOpts = `<option value="all">All domains </option>` + Object.entries(DOM).map(([k, d]) => `<option value="${k}" ${S.dom === k ? 'selected' : ''}>${esc(d.en)} ${esc(d.zh)}</option>`).join('');
    const domRows = S.mode !== 'dept' ? `<h4>Colour = domain<span class="zh"> = </span></h4>` + (S.mode === 'subject' ? `<p class="snote">Regions = subjects, grouped by domain. Legislation with no single subject sits in the middle.<span class="zh"> = </span></p>` : '') + Object.entries(DOM).map(([k, d]) => `<div class="row dom ${S.dom === k ? 'on' : ''}" data-dom="${k}" title="Show only this domain"><span class="sw" style="background:${d.color}"></span><span class="t">${esc(DSHORT[k][0])} <span class="zh">${esc(DSHORT[k][1])}</span></span><span class="ct">${dcnt[k] || 0}</span></div>`).join('') : '';
    $('sideb').innerHTML =
      domRows +
      `<h4>${S.mode === 'dept' ? 'Colour = document type' : 'Document types'}<span class="zh">${S.mode === 'dept' ? ' = ' : ''}</span></h4>${deptRows}` +
      `<h4>Domain</h4><select id="domsel" aria-label="Domain filter">${domOpts}</select>` +
      `<div class="sep"></div>` +
      (legCount ? `<div class="row"><label><input type="checkbox" id="legt" ${S.leg ? 'checked' : ''}><span class="t">Show provisions</span></label><span class="ct">${fmt(legCount)}</span></div>` : '') +
      `<div class="row"><label><input type="checkbox" id="bsall" ${S.bsAll ? 'checked' : ''}><span class="t">Show unchecked standards</span></label><span class="ct">${fmt(N.filter(isNC).length)}</span></div>` +
      `<div class="row"><label><input type="checkbox" id="brt" ${S.bridges ? 'checked' : ''}><span class="t">AI suggested links <span class="zh">AI </span></span></label><span class="ct">${BR.length}</span></div>` +
      (MOBILE ? `<h4>Lines</h4>` + linesKey() : '');
    $('sideb').querySelectorAll('input[data-dept]').forEach(cb => cb.onchange = () => { S.dept[cb.dataset.dept] = cb.checked; filtersChanged(); });
    $('domsel').onchange = e => { S.dom = e.target.value; filtersChanged(); buildSide(); };
    $('sideb').querySelectorAll('.row.dom').forEach(r => r.onclick = () => { S.dom = S.dom === r.dataset.dom ? 'all' : r.dataset.dom; filtersChanged(); buildSide(); });
    if ($('legt')) $('legt').onchange = e => setLeg(e.target.checked);
    $('brt').onchange = e => { S.bridges = e.target.checked; filtersChanged(); };
    $('bsall').onchange = e => { S.bsAll = e.target.checked; filtersChanged(); };
  }
  function filtersChanged() {
    applyFilter();
    if (S.sel != null && !N[S.sel].vis) clearSel();
    else if (S.sel != null) { const i = S.sel; const ns = new Set([i]), ls = new Set(); N[i].adj.forEach(l => { if (l.vis) { ls.add(l); ns.add(l.s0 === i ? l.t0 : l.s0); } }); S.hiN = ns; S.hiL = ls; }
    R.refresh('vis'); updateClusters(); updateCands();
  }
  function setLeg(on) { S.leg = on; filtersChanged(); buildSide(); }
  $('sideh').onclick = () => { const m = $('side').classList.toggle('min'); $('sidet').textContent = m ? '+' : '−'; $('sideh').setAttribute('aria-expanded', String(!m)); };
  $('sideh').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('sideh').click(); } };
  if (MOBILE) { $('side').classList.add('min'); $('sidet').textContent = '+'; }
  $('sideh').setAttribute('aria-expanded', String(!$('side').classList.contains('min')));
  buildSide();

  // ---------------- layout toggle ----------------
  function setMode(m) {
    if (S.mode === m) return;
    S.mode = m; R.stopRot();
    document.querySelectorAll('#mode button').forEach(b => { b.classList.toggle('on', b.dataset.m === m); b.setAttribute('aria-pressed', String(b.dataset.m === m)); });
    clCache.forEach(o => { o.el.remove(); }); clCache.clear();
    buildSide(); R.refresh(); morphTo(m, 2200); R.moved(); updateClusters();
    if (S.sel != null) Panel.node(N[S.sel]);
    onMorphEnd = () => { onMorphEnd = null; if (S.hiN.size) R.flyTo(S.hiN, S.sel); else R.fitAll(1200, m === 'subject' ? .92 : Math.atan2(330, 1150)); };
  }
  document.querySelectorAll('#mode button').forEach(b => b.onclick = () => setMode(b.dataset.m));

  // ---------------- search ----------------
  const IDX = N.map(n => ({ n, k: norm(n.c), a: (n.al || []).map(norm), w: ' ' + String(n.te || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ', t: norm(n.te), z: n.tz || '', s: String(n.se || '').toLowerCase() + ' ' + (n.sz || '') }));
  const CIDX = H.concepts.map((c, ci) => ({ ci, c, k: norm(c[1]), v: c[4].map(norm), z: c[2] }));
  function search(qs) {
    qs = String(qs || '').replace(/\s*:\s*(?:19|20)\d\d(?:\s*\+\s*A\d+(?::\s*(?:19|20)\d\d)?)*\s*$/i, '');
    const v = norm(qs), raw = qs.trim(), rw = raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (!v) return { c: [], n: [] };
    const nh = [];
    for (const o of IDX) {
      let s = 0;
      if (o.k === v || o.a.includes(v)) s = 100; else if (o.k.startsWith(v) || o.a.some(x => x.startsWith(v))) s = 80; else if (o.k.includes(v)) s = 62; else if (v.length > 2 && o.w.includes(' ' + rw)) s = 34; else if (raw && o.z.includes(raw)) s = 34;
      else if ([...raw].length > 2 && o.s.includes(raw.toLowerCase())) s = 18;
      if (s) { s += (s >= 80 ? 0 : Math.min(12, o.n.deg * .05)) + (o.n.k === 'document' ? 4 : 0) - (HIDE_K.has(o.n.k) ? 3 : 0) - (o.n.fd ? 6 : 0); nh.push([s, o.n]); }
    }
    const ch = [];
    for (const o of CIDX) {
      let s = 0;
      if (o.k === v || (raw && o.z === raw) || o.v.includes(v)) s = 95; else if (o.k.startsWith(v)) s = 72; else if (v.length > 2 && o.k.includes(v)) s = 55; else if (v.length > 2 && o.v.some(x => x.includes(v))) s = 50; else if (raw && o.z && o.z.includes(raw)) s = 60;
      const nd = cCount(o.ci);
      if (s && nd) ch.push([s + Math.min(8, nd * .1), o]);
    }
    nh.sort((a, b) => b[0] - a[0] || String(a[1].c).localeCompare(String(b[1].c), 'en', { numeric: true })); ch.sort((a, b) => b[0] - a[0]);
    // keyword row (titles + summaries), offered when no concept matches the words exactly
    const kw = (ch.length && ch[0][0] >= 95) || [...raw].length < 2 ? 0 : kwRows(raw).length;
    return { c: ch.slice(0, 5).map(x => x[1]), n: nh.slice(0, 10).map(x => x[1]), cFirst: !!ch.length && (!nh.length || ch[0][0] >= nh[0][0]), kw, raw };
  }
  const q = $('q'), ul = $('qres'); let hits = [], act = 0;
  // ---- search history (this browser only; the page works without storage) + popular starters ----
  const RK = 'ukmap_recent';
  let recent = (() => { try { const v = JSON.parse(localStorage.getItem(RK) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).slice(0, 8) : []; } catch (e) { return []; } })();
  const saveRecent = () => { try { localStorage.setItem(RK, JSON.stringify(recent)); } catch (e) { } };
  function addRecent(t) { t = String(t || '').trim(); if (!t) return; if (typeof hudLog === 'function') hudLog('map', t); recent = [t, ...recent.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 8); saveRecent(); }
  function delRecent(t) { recent = recent.filter(x => x !== t); saveRecent(); }
  // starter terms; each is kept only if it finds something (they were all checked against search.js when chosen)
  const POPULAR = [['BS 9991', ''], ['Part B', ''], ['AD B Vol 1', ''], ['Building Safety Act', ''], ['BS 7671', ''], ['higher-risk', ''], ['CDM', ''], ['PAS 24', ''], ['AD T', ''], ['Building Regulations 2010', '']]
    .filter(([t]) => { const r = search(t); return r.c.length || r.n.length; });
  const hl = (t, raw) => { const s = String(t), i = raw ? s.toLowerCase().indexOf(raw.toLowerCase()) : -1; return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + raw.length)) + '</mark>' + esc(s.slice(i + raw.length)); };
  const recentRow = (t, k, raw) => `<li data-k="${k}" class="rc"><svg class="ic" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.2l2 1.3"/></svg><span class="c">${hl(t, raw)}</span><button type="button" class="qx" data-x="${esc(t)}" aria-label="Remove ${esc(t)} " title="Remove">×</button></li>`;
  function wireRows() {
    ul.querySelectorAll('li[data-k]').forEach(li => li.onmousedown = e => { e.preventDefault(); pick(+li.dataset.k); });
    ul.querySelectorAll('.qx').forEach(b => b.onmousedown = e => { e.preventDefault(); e.stopPropagation(); delRecent(b.dataset.x); q.value.trim() && typed ? renderHits(search(q.value)) : renderSuggest(); });
    const c = ul.querySelector('.qclr'); if (c) c.onmousedown = e => { e.preventDefault(); e.stopPropagation(); recent = []; saveRecent(); renderSuggest(); };
  }
  function renderSuggest() { // the box is focused and nothing has been typed yet: recent searches, then popular terms
    hits = []; act = -1; let h = '', k = 0;
    if (recent.length) h += `<li class="hd hdr"><span>Recent searches </span><button type="button" class="qclr">Clear </button></li>` + recent.map(t => { hits.push({ t: 's', q: t }); return recentRow(t, k++, ''); }).join('');
    if (POPULAR.length) h += `<li class="hd">Popular </li>` + POPULAR.map(([t, z]) => { hits.push({ t: 's', q: t }); return `<li data-k="${k++}" class="pop"><svg class="ic" width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 10l3.5-3.5 2.5 2.5L12 5"/><path d="M9 5h3v3"/></svg><span class="c">${esc(t)}</span><span class="n zh">${esc(z)}</span></li>`; }).join('');
    ul.innerHTML = h; ul.classList.toggle('open', !!h); mark(); wireRows();
  }
  function renderHits(res) {
    const raw0 = q.value.trim(), rs = raw0 ? recent.filter(t => t.toLowerCase().includes(raw0.toLowerCase()) && t.toLowerCase() !== raw0.toLowerCase()).slice(0, 3) : [];
    const cH = res.c.map(o => ({ t: 'c', o })), nH = res.n.map(n => ({ t: 'n', n })), kH = res.kw ? [{ t: 'k', q: res.raw }] : [];
    hits = [...rs.map(t => ({ t: 's', q: t })), ...(res.cFirst ? [...cH, ...nH, ...kH] : [...nH, ...cH, ...kH])]; act = rs.length < hits.length ? rs.length : 0;
    let h = '', k = 0;
    if (rs.length) h += `<li class="hd">Recent </li>` + rs.map(t => recentRow(t, k++, raw0)).join('');
    const cHtml = () => res.c.length ? `<li class="hd">Concepts </li>` + res.c.map(o => `<li data-k="${k++}"><span class="sw" style="background:var(--terra)"></span><span class="c">${hl(o.c[1], res.raw)}</span><span class="n zh">${esc(o.c[2])}</span><span class="tag">${cCount(o.ci)} doc${cCount(o.ci) === 1 ? '' : 's'}</span></li>`).join('') : '';
    const nHtml = () => res.n.length ? `<li class="hd">Documents &amp; provisions </li>` + res.n.map(n => { const w = n.fd && stWord(n); return `<li data-k="${k++}"${w ? ' class="old"' : ''}><span class="sw" style="background:${colOf(n)}"></span><span class="c">${esc(n.c)}</span><span class="n">${esc(n.te && n.te !== n.c ? n.te : '')} <span class="zh">${esc(n.tz || '')}</span></span>${w ? `<span class="tag o">${esc(w[0])}</span>` : ''}</li>`; }).join('') : '';
    h += res.cFirst ? cHtml() + nHtml() : nHtml() + cHtml();
    if (res.kw) h += `<li class="hd">Keyword </li><li data-k="${k++}"><span class="sw" style="background:var(--muted)"></span><span class="c">“${esc(res.raw)}”</span><span class="n">in titles and summaries </span><span class="tag">${res.kw}</span></li>`;
    if (raw0.length >= 2) { hits.push({ t: 'f', q: raw0 }); h += `<li class="hd">Full text </li><li data-k="${k++}" class="ftsug"><span class="sw" style="background:var(--ink)"></span><span class="c">Search the full text for “${esc(raw0)}”</span><span class="n">Building Regulations 2010 and 24 Approved Documents</span></li>`; }
    if (!hits.length && q.value.trim()) h = `<li class="hd" style="text-transform:none;letter-spacing:0">No match. Try a code (AD B, Part L, SI 2023/909, BS 9991) or a title word (sprinkler). </li>`;
    ul.innerHTML = h; ul.classList.toggle('open', !!h); mark(); wireRows();
  }
  const mark = () => ul.querySelectorAll('li[data-k]').forEach(li => { const on = +li.dataset.k === act; li.classList.toggle('act', on); if (on) li.scrollIntoView({ block: 'nearest' }); });
  function pick(k) {
    const h = hits[k]; if (!h) return;
    if (h.t === 'f') { ul.classList.remove('open'); q.blur(); typed = false; addRecent(h.q); ftSearchView(h.q, '', true); return; }
    if (h.t === 's') { q.value = h.q; typed = true; renderHits(search(h.q)); const j = hits.findIndex(x => x.t !== 's'); if (j >= 0) pick(j); else { addRecent(h.q); ul.classList.remove('open'); } return; }
    ul.classList.remove('open'); q.blur(); typed = false;
    if (h.t === 'c') { q.value = h.o.c[1]; selectConcept(h.o.ci); } else if (h.t === 'k') { selectKeyword(h.q); q.value = h.q; } else { q.value = h.n.c; select(h.n.i); }
    addRecent(q.value); // a search is remembered only once it is chosen or submitted
  }
  let typed = false; // true once the visitor types; until then a focused box offers history and popular terms
  q.addEventListener('input', () => { typed = true; if (q.value.trim()) renderHits(search(q.value)); else renderSuggest(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'Escape') { ul.classList.remove('open'); return; }
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { act = Math.min(act + 1, hits.length - 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); mark(); e.preventDefault(); }
    else if (e.key === 'Enter') { pick(act); e.preventDefault(); }
  });
  let keepSel = false; // a click's mouseup would undo the select-all made on focus
  const openSuggest = () => { typed = false; renderSuggest(); if (q.value) { try { q.select(); } catch (e) { } keepSel = true; } };
  q.addEventListener('mouseup', e => { if (keepSel) { e.preventDefault(); keepSel = false; } });
  q.addEventListener('focus', openSuggest);
  q.addEventListener('click', () => { if (!ul.classList.contains('open')) { if (typed && q.value.trim()) renderHits(search(q.value)); else openSuggest(); } });
  q.addEventListener('blur', () => setTimeout(() => ul.classList.remove('open'), 150));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.activeElement !== q && S.alert) { if (S.pv != null) alertList(); else alertOff(); return; } if (e.key === 'Escape' && document.activeElement !== q && S.hero && S.sel == null) { heroDone(true, document.querySelector('.ttl')); return; } if (e.key === 'Escape' && document.activeElement !== q && S.pv != null) { unpreview(); return; } if (e.key === 'Escape' && document.activeElement !== q && (S.sel != null || S.concept)) clearSel(); if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); } });

  // ---------------- zoom buttons ----------------
  $('zin').onclick = () => R.zoom(MOBILE ? 1.4 : .72);
  $('zout').onclick = () => R.zoom(MOBILE ? 1 / 1.4 : 1.38);
  $('zfit').onclick = () => R.fitAll(700);
  const rb = $('zrot');
  if (rb) {
    if (MOBILE || !R.rotate) rb.remove();
    else {
      const paint = () => { const on = R.rotate(); rb.classList.toggle('on', on); rb.setAttribute('aria-pressed', on); rb.title = on ? 'Auto-rotate: on' : 'Auto-rotate: off'; };
      rb.onclick = () => { R.rotate(!R.rotate()); paint(); }; paint();
    }
  }

  // ================= v2 (10 Nov 2026; QA v2-R1 fixes the same day): first look, edition check, search-first hero, spec check =================
  // Inserted by b4v2_upgrades.py before the "ready" block, so it can use the engine's state (S), select(), setHi(), Panel, search().
  const CHKD = H.checked_en || H.checked;
  const EDRULE = {"AD A": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD C": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD D": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD E": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD G": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD H": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD J": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD K": "When this approved document refers to a named standard or other document, the relevant version is listed in Appendix B (standards). However, if the issuing body has revised or updated the listed version of the standard or document, you may use the new version as guidance if it continues to address the relevant requirements of the Building Regulations.", "AD M Vol 1": "When this approved document refers to a named standard or other document, the relevant version is listed in Appendix B (standards) or Appendix C (other documents). However, if the issuing body has revised or updated the listed version of the standard or document, you may use the new version as guidance if it continues to address the relevant requirements of the Building Regulations.", "AD M Vol 2": "When an Approved Document makes reference to a named standard, the relevant version of the standard to which it refers is the one listed at the end of the publication. However, if this version has been revised or updated by the issuing standards body, the new version may be used as a source of guidance provided it continues to address the relevant requirements of the Regulations.", "AD P": "When this approved document refers to a named standard or other document, the relevant version is listed in Appendix B (standards). However, if the issuing body has revised or updated the listed version of the standard or document, you may use the new version as guidance if it continues to address the relevant requirements of the Building Regulations.", "AD Q": "When this approved document refers to a named standard or other document, the relevant version is listed in Appendix C (documents) or Appendix C (standards). However, if the issuing body has revised or updated the listed version of the standard or document, you may use the new version as guidance if it continues to address the relevant requirements of the Building Regulations.", "AD Reg 7": "When this approved document refers to a named standard or other document, the relevant version is listed in Appendix B. However, if the issuing body has revised or updated the listed version of the standard or document, you may use the new version as guidance if it continues to address the relevant requirements of the Building Regulations."};  // AD code -> that AD's own sentence on the edition it lists (quoted from the cached AD text at build time)
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fmtD = s => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s || '')); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : String(s || ''); };
  const searchEl = document.querySelector('.search'), sHome = searchEl.nextSibling, topBar = searchEl.parentNode;
  const BSN = N.filter(n => n.g === 'BS').length, CHKN = N.filter(n => n.bsx && n.bsx.s !== 'not checked').length;
  const ADN = N.filter(n => n.g === 'AD').length, RULEN = N.filter(n => n.g === 'AD' && EDRULE[n.c]).length;
  const MIX = N.filter(n => n.bsx && n.bsx.s === 'mixed');
  const ALTN = ALT.length;
  const yr = s => (String(s || '').match(/(?:19|20)\d\d/) || [''])[0];
  const ltEd = b => { const t = String(b.lt || ''); const k = t.search(/:(?=(?:19|20)\d\d)/); return k >= 0 ? t.slice(k + 1) : t; };
  // a "newer edition" record whose base edition is the one the AD cites, with only a later amendment (QA v2-R1 V1D-05)
  const amendOnly = n => !!(n.bsx && n.bsx.s === 'superseded' && ltEd(n.bsx) && (n.bsx.pa || []).filter(r => r[1] === 'superseded').every(r => yr(r[2]) === yr(ltEd(n.bsx))));
  // QA v2-R2 V2C-09; QA v2-R3 V3F-03 / V3D-01: judged per AD line: an AD whose printed base edition is the newest found base edition gets "Newer amendment exists"
  const paWord = (n, s, ed) => s === 'superseded' && (amendOnly(n) || (!!ed && !!ltEd(n.bsx) && yr(ed) === yr(ltEd(n.bsx)))) ? 'Newer amendment exists' : BSW[s];
  const statWord = n => n.bsx ? (amendOnly(n) ? 'Newer amendment exists' : BSW[n.bsx.s]) : '';
  function foldSide(on, key) { // fold (on) or restore the desktop legend; key says who folded it, so only that caller restores it
    if (narrow()) return; const min = $('side').classList.contains('min');
    if (on && !min) { S.sideBy = key; $('sideh').click(); } else if (!on && min && S.sideBy === key) { S.sideBy = null; $('sideh').click(); }
  }
  // keyboard focus: when the control that had focus disappears (the start panel closes, the phone pill hides), put focus somewhere useful
  const ttl = document.querySelector('.ttl');
  function refocus(pref) {
    setTimeout(() => {
      const a = document.activeElement; if (!pref && a && a !== document.body && a.offsetParent !== null) return;
      const po = $('panel').classList.contains('open') ? $('pcode') : null;
      const t = [pref, po, $('alttop'), ttl].find(x => x && x.offsetParent !== null); if (!t) return;
      if (t === po && !t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      try { t.focus({ preventScroll: true }); } catch (e) { }
    }, 60);
  }


  // ---- focus guard (QA v2-R2 V2C-01): after any action, focus lands on a control, never on BODY ----
  // It steps in when the key that moved focus was a keyboard key, when the focused control was removed, hidden or made inert, or when the search box gave it up.
  let kbIn = false;
  window.addEventListener('keydown', () => { kbIn = true; }, true); window.addEventListener('pointerdown', () => { kbIn = false; }, true);
  const gone = el => !el || !el.isConnected || !!el.closest('[inert],[hidden]') || (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') || !!$('panel').contains(el) && !$('panel').classList.contains('open');
  document.addEventListener('focusout', e => {
    const from = e.target, wasQ = from === $('q');
    setTimeout(() => {
      const a = document.activeElement; if (a && a !== document.body && a !== document.documentElement) return;
      if (!(kbIn || wasQ || gone(from))) return;
      if (!spec.hidden) { $('spect').focus(); return; }
      const ab = $('about'); if (ab && getComputedStyle(ab).display !== 'none') { const f = ab.querySelector('button'); if (f) { f.focus(); return; } }
      if (S.hero && !$('panel').classList.contains('open')) { refocus(hero); return; }
      refocus();
    }, 90);
  }, true);
  // Tab from the search box goes to the next control, not into the suggestion list that hides on blur (V2C-01 c)
  $('q').addEventListener('keydown', e => { if (e.key === 'Tab') { const u = searchEl.querySelector('ul'); if (u) u.classList.remove('open'); } });
  $('q').addEventListener('input', () => capOff());

  // ---- 1. zoom reveals the unchecked standards (they stay hidden in the overview, like HK's legislation) ----
  // Only the visitor's own zoom (wheel, pinch, + button) reveals them; a camera fly-to after a search does not (QA v2-R1 V1F-03).
  let zT = 0, userZ = -1e9; const markZ = () => { userZ = performance.now(); };
  // on the window, not the stage: a wheel over the header or a label still zooms the map (QA v2-R1 rerun of checker F's F2)
  window.addEventListener('wheel', markZ, { passive: true, capture: true });
  window.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) markZ(); }, { passive: true, capture: true });
  $('zin').addEventListener('click', markZ); $('zout').addEventListener('click', markZ);
  function zoomCheck(now) {
    if (capFor != null && S.sel !== capFor) capOff();
    if (now - zT < 300 || !R.zr) return; zT = now;
    const z = R.zr(), on = S.zoomIn ? z < .62 : z < .5;
    if (on === S.zoomIn) return;
    if (on && now - userZ > 2000) return;
    S.zoomIn = on; applyFilter(); R.refresh('vis'); updateClusters(); updateCands();
  }

  // ---- search lands on a burst: the lit dots grow, and a short caption names what lit up ----
  const cap = $('burstcap'); let capT = 0, capFor = null;
  // the landing: a ring opens on the dot the camera flew to, as the caption names what lit up (QA v2-R2 V2C-11)
  const land = document.createElement('div'); land.id = 'landring'; land.setAttribute('aria-hidden', 'true'); land.innerHTML = '<i></i><i></i>'; document.body.appendChild(land);
  // QA v2-R3 V3C-01: the ring rides on the dot every frame and opens only once the camera has settled (the dot stops moving), so it lands on the result
  let landRaf = 0, landI = null;
  function landAt(i) {
    const n = N[i], pt = { x: 0, y: 0, d: 0 }; if (!n) return;
    cancelAnimationFrame(landRaf); land.classList.remove('go'); landI = i;
    let px = null, py = null, still = 0; const t0 = performance.now();
    const tick = () => {
      if (landI !== i || S.sel !== i) { land.classList.remove('go'); return; }
      const el = performance.now() - t0;
      if (n.vis && n.x != null && R.toScreen(n, pt)) {
        const rc = stage.getBoundingClientRect(), x = Math.round(pt.x + rc.left), y = Math.round(pt.y + rc.top);
        still = px != null && Math.abs(x - px) < 1 && Math.abs(y - py) < 1 ? still + 1 : 0; px = x; py = y;
        land.style.left = x + 'px'; land.style.top = y + 'px';
        if (!land.classList.contains('go') && (still >= 4 || el > 3000)) { void land.offsetWidth; land.classList.add('go'); land.dataset.t = String(Math.round(el)); }
      }
      if (el < 6500) landRaf = requestAnimationFrame(tick); else land.classList.remove('go');
    };
    tick();
  }
  function capOff() { clearTimeout(capT); cap.classList.remove('on'); land.classList.remove('go'); cancelAnimationFrame(landRaf); landI = null; capFor = null; }
  function burstAt(i, delay) {
    const n = N[i]; if (!n) return;
    S.burst = true; S.burstT = performance.now() + delay + (MOBILE ? 700 : 1300); R.moved();
    const k = S.hiN.size - 1, ads = n.g === 'BS' ? [...new Set(citers(n).map(e => N[e.s].c))] : [];
    const st = n.bsx && n.bsx.s !== 'not checked' ? ` · ${statWord(n).charAt(0).toLowerCase() + statWord(n).slice(1)}` : ''; // QA v2-R3 V3D-02
    cap.textContent = ads.length ? `${n.c} · cited by ${ads.length <= 3 ? ads.join(', ') : ads.length + ' Approved Documents'}${st}` : `${n.c} · ${k} document${k === 1 ? '' : 's'} lit`;
    capOff(); capFor = i;
    capT = setTimeout(() => { if (S.sel !== i) return capOff(); placeCap(); cap.classList.add('on'); landAt(i); capT = setTimeout(capOff, 4200); }, delay + (MOBILE ? 500 : 900));
  }
  function placeCap() {
    const pr = $('panel').getBoundingClientRect(), po = $('panel').classList.contains('open') && !narrow();
    const sd = $('side'), sl = !narrow() && !sd.classList.contains('min') && getComputedStyle(sd).display !== 'none' ? sd.getBoundingClientRect().right : 0;
    const x0 = sl, x1 = po ? pr.left : innerWidth; cap.style.left = Math.round((x0 + x1) / 2) + 'px'; cap.style.top = '';
    // clear of the chrome it used to sit on (QA v2-R2 V2C-05): folded legend, tools and pill, mode buttons
    const c = cap.getBoundingClientRect(), w = c.width || 300, L0 = (x0 + x1) / 2 - w / 2, L1 = L0 + w; let top = c.top || 0;
    for (const el of [sd, $('tools'), document.querySelector('.seg'), $('alttop')]) {
      if (!el || getComputedStyle(el).display === 'none' || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
      const r = el.getBoundingClientRect(); if (!r.width || r.right < L0 || r.left > L1) continue;
      if (r.top < top + c.height + 4 && r.bottom > top - 4) top = Math.max(top, r.bottom + 8);
    }
    if (top !== c.top) cap.style.top = Math.round(top) + 'px';
  }

  // ---- 3. search-first hero ----
  const hero = $('hero');
  const CHIPS = [['AD B fire, dwellings', 'AD B Vol 1'], ['BS 9991', 'BS 9991'], ['Gateway 2 and 3', 'Gateway 2'], ['Part B', 'Part B'], ['CDM', 'CDM'], ['BS 7671 wiring', 'BS 7671']]
    .filter(([, t]) => search(t).n.length);
  $('herochips').innerHTML = CHIPS.map(([l, t], k) => `<button type="button" class="chip" data-k="${k}">${esc(l)}</button>`).join('');
  const HUBS = N.filter(n => n.g === 'AD').map(n => [n, n.out.length + n.inn.length]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  $('herohub').innerHTML = `Busiest hubs: ` + HUBS.map(([n, c]) => `<button type="button" class="hubb" data-i="${n.i}">${esc(n.c)} <span>${c} quoted links</span></button>`).join('');
  function runQuery(t) {
    const r = search(t); q.value = t;
    if (r.n[0] && (!r.cFirst || !r.c[0])) select(r.n[0].i); else if (r.c[0]) selectConcept(r.c[0].ci); else if (r.kw) selectKeyword(t); else return false;
    addRecent(t); return true;
  }
  $('herochips').querySelectorAll('.chip').forEach(b => b.onclick = () => runQuery(CHIPS[+b.dataset.k][1]));
  $('herohub').querySelectorAll('.hubb').forEach(b => b.onclick = () => select(+b.dataset.i));
  function heroH() { if (!S.hero) return 0; const r = hero.getBoundingClientRect(), st = stage.getBoundingClientRect(); return Math.max(0, r.bottom - st.top + 8); }
  // phones: the map fits the band under the panel; desktop: the panel docks left and the map is framed in the space to its right
  function heroFit() { if (R.hero) { if (narrow()) R.hero(0, heroH()); else R.hero((hero.getBoundingClientRect().right + 8) / 2, 0); } R.fitAll(0); }
  function heroOpen() {
    if (S.hero) return; S.hero = true; hero.hidden = false; document.body.classList.add('hero-on');
    $('heroslot').appendChild(searchEl); ul.classList.remove('open');
    foldSide(true, 'hero');
    requestAnimationFrame(heroFit);
  }
  let heroOutT = -1e9; hero.addEventListener('focusout', () => { heroOutT = performance.now(); });
  function heroDone(fit, pref) {
    // the search box's own Enter handler may blur it before the selection closes the panel, so a focus that left the panel just now counts too
    if (!S.hero) return; const had = hero.contains(document.activeElement) || ((!document.activeElement || document.activeElement === document.body) && performance.now() - heroOutT < 600);
    S.hero = false; hero.hidden = true; document.body.classList.remove('hero-on');
    topBar.insertBefore(searchEl, sHome); ul.classList.remove('open');
    foldSide(false, 'hero');
    if (R.hero) R.hero(0, 0); if (fit) R.fitAll(700);
    if (had || pref) refocus(pref); // QA v2-R1 V1C-02: focus goes to the panel that opened (or the title), never to BODY
  }
  // closing the panel puts focus on the title (which reopens it), not in the search box, so no suggestion list covers the map (V1C-03)
  $('herox').onclick = () => heroDone(true, ttl);
  $('stage').addEventListener('pointerdown', () => { if (S.hero && narrow()) heroDone(false); }, { passive: true });
  $('stage').addEventListener('wheel', () => { if (S.hero) heroDone(false); }, { passive: true });
  function openFromTitle() {
    if (S.alert) alertOff(); else if (S.sel != null || S.concept) clearSel();
    heroOpen(); setTimeout(() => { try { hero.focus({ preventScroll: true }); } catch (e) { } }, 0);
  }
  ttl.addEventListener('click', openFromTitle);
  ttl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromTitle(); } });
  let heroRT = 0;
  window.addEventListener('resize', () => { if (S.hero) { clearTimeout(heroRT); heroRT = setTimeout(heroFit, 200); } });

  // ---- 2. edition check mode (was "out-of-date alert"; QA v2-R1 V1D-02: a prompt to check, not an alarm) ----
  const altLabel = () => `<span class="dot" aria-hidden="true"></span><span><b>Edition check: ${ALTN} cited standards have a newer edition or amendment, or are withdrawn</b>`
    + `<small class="lg">${MIX.length} more depend on the Approved Document · ${CHKN} of ${BSN} checked so far · a prompt to check, not a ban</small><small class="sh">${CHKN} of ${BSN} checked so far</small></span><span class="onx" aria-hidden="true">On</span>`;
  function alertUi() {
    const on = !!S.alert; document.body.classList.toggle('alert-on', on);
    $('altbtn').innerHTML = altLabel(); $('altbtn').setAttribute('aria-pressed', String(on));
    // the visible words are the accessible name (WCAG 2.5.3); the state is aria-pressed only (V1C-13)
    $('alttop').innerHTML = `<span class="dot" aria-hidden="true"></span><span class="l">Edition check <b>${ALTN}</b></span><span class="onx" aria-hidden="true">on ×</span>`;
    $('alttop').setAttribute('aria-pressed', String(on)); $('alttop').removeAttribute('aria-label');
  }
  function alertOn() {
    if (S.alert) return;
    const fromUi = hero.contains(document.activeElement) || $('tools').contains(document.activeElement);
    heroDone(false); if (S.sel != null || S.concept) clearSel();
    S.alert = true; S.altT = performance.now(); S.concept = { alert: 1 };
    const ns = new Set(), ls = new Set();
    [...ALT, ...MIX].forEach(n => { ns.add(n.i); n.adj.forEach(l => { if (l.kind === 'cite' && l.vis) { ls.add(l); ns.add(l.s0 === n.i ? l.t0 : l.s0); } }); });
    setHi(ns, ls); alertUi(); foldSide(true, 'alert'); alertList(); R.moved(); R.flyTo(ns, null);
    if (fromUi) refocus();
  }
  function alertOff() { if (!S.alert) return; const fromUi = $('panel').contains(document.activeElement) || $('tools').contains(document.activeElement); clearSel(); R.fitAll(900); if (fromUi) refocus($('alttop')); }
  $('altbtn').onclick = () => S.alert ? alertOff() : alertOn();
  $('alttop').onclick = () => S.alert ? alertOff() : alertOn();
  const citers = n => n.inn.filter(e => N[e.s].g === 'AD');
  const ruleNote = () => `<p class="note v2n"><b>What this means.</b> Each Approved Document lists the edition of a standard it refers to. For the standards below, a public source not run by BSI shows that a newer edition or amendment now exists, or that the standard has been withdrawn. That does not make the Approved Document wrong: ${RULEN} of the ${ADN} Approved Documents say the edition they list is the relevant one, and that a newer version may be used as guidance if it still addresses the requirements. The other ${ADN - RULEN}, including AD B, have no such sentence, so for those agree the edition with building control. This list is a prompt to check, not a ban.</p>`;
  function alertList(from) {
    from = from != null && typeof from !== 'object' ? from : S.pv; // the card we came back from, to put focus on its row (QA v2-R2 V2C-01)
    S.pv = null; R.refresh(); updateCands();
    Panel.preview(null);
    Panel.head(`<span class="sw" style="background:${ALC}"></span><span>Edition check · our check of ${CHKD}</span>`, `${ALTN} cited standards`, 'have a newer edition or amendment, or are withdrawn',
      '', `<span>Checked <b>${CHKN} of ${BSN}</b></span><span>Not checked <b>${BSN - CHKN}</b></span>`);
    $('panel').classList.remove('faded');
    const rows = ALT.slice().sort((a, b) => citers(b).length - citers(a).length || String(a.c).localeCompare(String(b.c), 'en', { numeric: true }));
    let h = ruleNote() + `<p class="note v2n">Select one to see the Approved Document's own words, the page, and the source we checked. ${BSN - CHKN} of the ${BSN} standards have not been checked, so their status is unknown, not current.</p>`;
    h += `<h5>Newer edition, amendment or withdrawn <span class="n">${ALTN}</span></h5><ul>` + rows.map(n => {
      const ads = [...new Set(citers(n).map(e => N[e.s].c))];
      return `<li data-i="${n.i}" class="altr"><div class="m"><span class="sw" style="background:${BSC[n.bsx.s]}"></span><span class="c">${esc(n.c)}</span><span class="n">${esc(ads.join(', '))}</span><span class="r">${n.bsx.s === 'withdrawn' ? 'Withdrawn' : amendOnly(n) ? 'Newer amendment' : 'Newer edition'}</span></div></li>`;
    }).join('') + `</ul>`;
    if (MIX.length) h += `<h5>Depends on the citing AD <span class="n">${MIX.length}</span></h5><p class="note v2n">For these, one Approved Document cites an edition that has a newer one and another cites a current one, so they are not counted above. They are shown on the map in their own colour: ${MIX.map(n => `<a data-sel="${n.i}">${esc(n.c)}</a>`).join(', ')}.</p>`;
    h += `<p class="v2b"><button type="button" class="v2btn" id="altoff">Turn off the edition check</button></p>`;
    $('pbody').innerHTML = h; $('pbody').scrollTop = 0; Panel.disc();
    $('pbody').querySelectorAll('li.altr > .m').forEach(m => { m.onclick = () => alertCard(+m.parentElement.dataset.i); m.tabIndex = 0; m.setAttribute('role', 'button');
      m.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); m.click(); } }; });
    $('pbody').querySelectorAll('a[data-sel]').forEach(a => { a.setAttribute('tabindex', '0'); a.setAttribute('role', 'link'); a.onclick = () => select(+a.dataset.sel); a.onkeydown = e => { if (e.key === 'Enter') a.click(); }; });
    $('altoff').onclick = alertOff;
    Panel.open(); if (narrow()) Panel.setMini(false);
    const row = from != null && $('pbody').querySelector(`li.altr[data-i="${from}"] > .m`);
    if (row) { try { row.focus({ preventScroll: false }); } catch (e) { } } else refocus($('pcode'));
  }
  // AD Q's sentence names "Appendix C (standards)"; its standards list is Appendix D. Quoted verbatim with [sic] (QA v2-R2 V2F-07 / V2D-03).
  const SIC = { 'AD Q': ['Appendix C (standards)', "AD Q's own list of standards is Appendix D."] };
  const ruleQ = ad => { const t = esc(EDRULE[ad]), s = SIC[ad]; return s && t.includes(esc(s[0])) ? t.replace(esc(s[0]), esc(s[0]) + ' [sic]') : t; };
  const ruleSic = ad => SIC[ad] && String(EDRULE[ad]).includes(SIC[ad][0]) ? ` <small>(${esc(SIC[ad][1])})</small>` : '';
  function alertCard(i) {
    const n = N[i]; if (!n || !n.alt) return;
    S.pv = i; S.pvX = new Set(); S.pvXL = new Set(); R.refresh(); updateCands();
    const b = n.bsx, ads = [...new Set(citers(n).map(e => N[e.s].c))];
    Panel.head(`<span class="sw" style="background:${BSC[b.s]}"></span><span>Edition check · citation only</span>`, n.c, n.te, '',
      `<span>Cited edition <b>${esc(n.vd || '')}</b></span>${b.lt ? `<span>${b.s === 'withdrawn' ? 'Replacement found' : 'Newest found'} <b>${esc(b.lt)}</b></span>` : ''}`);
    let h = `<p class="v2b"><button type="button" class="v2btn" id="altback">‹ All ${ALTN}</button></p>`;
    h += `<div class="stat" style="border-left:4px solid ${BSC[b.s]}"><b>${esc(statWord(n))}</b>${b.note ? '. ' + esc(b.note) : ''}`
      + (b.src && b.src.length ? `<br><span style="font-size:12px">Checked ${esc(fmtD(b.chk))} against: ${b.src.map(x => `<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])} ↗</a>`).join(' · ')}</span>` : '') + `</div>`;
    // what it means, in the Approved Documents' own words (V1D-02)
    const withR = ads.filter(a => EDRULE[a]), noR = ads.filter(a => !EDRULE[a]);
    h += `<div class="edr"><b>What this means</b><p>${b.s === 'withdrawn' ? 'The edition the Approved Document lists has been withdrawn by its publisher.' : amendOnly(n) ? 'The edition the Approved Document lists has since had an amendment.' : 'A newer edition of the standard exists than the one the Approved Document lists.'} The Approved Document still names the edition it lists. This is a prompt to check, not a ban, and this page cannot tell which edition applies to your project.</p>`
      + (withR.length ? `<p>${esc(withR[0])}, in its own words: <q>${ruleQ(withR[0])}</q>${ruleSic(withR[0])}${withR.length > 1 ? ` ${esc(withR.slice(1).join(', '))} ${withR.length > 2 ? 'say' : 'says'} ${withR.slice(1).every(a => EDRULE[a] === EDRULE[withR[0]]) ? 'the same' : 'much the same, in slightly different words'}.` : ''}</p>` : '')
      + (noR.length ? `<p>${esc(noR.join(', '))} ${noR.length > 1 ? 'have' : 'has'} no general sentence like this about newer versions, so agree the edition with building control.</p>` : '') + `</div>`;
    const pa = b.pa || [];
    h += `<h5>Cited by <span class="n">${citers(n).length}</span></h5>` + citers(n).map(e => {
      const ad = N[e.s].c, rws = pa.filter(r => r[0] === ad);
      return `<div class="altc"><div><b>${esc(ad)}</b> prints <b>${esc(e.ed || '(no edition printed)')}</b>${e.eo ? `; it also prints ${esc(e.eo)}` : ''}</div>`
        + (rws.length ? `<div class="altst">${rws.map(r => `Edition ${esc(r[2])}: ${esc(paWord(n, r[1], r[2]))}`).join(' · ')}</div>` : '')
        + Panel.quote(e) + `</div>`;
    }).join('');
    h += `<div class="info">Number, title and edition as printed in the Approved Document (Crown copyright, OGL). The standard itself is a BSI publication and is not reproduced or linked here.</div>`;
    h += `<p class="v2b"><button type="button" class="v2btn" id="altopen">Open the full link view ›</button></p>`;
    $('pbody').innerHTML = h; $('pbody').scrollTop = 0; Panel.src(n);
    $('altback').onclick = () => alertList(i); $('altopen').onclick = () => { select(i); refocus($('pcode')); };
    Panel.open(); if (narrow()) Panel.setMini(false);
    try { $('altback').focus({ preventScroll: true }); } catch (e) { }
  }

  // ---- 4. check my spec (runs in the browser only) ----
  // Identity = prefix family + number + part (QA v2-R1 V1F-01): BS 845-1 and BS EN 845-1 are different standards and never match each other.
  // The only cross-prefix step is from a bare EN / ISO / IEC number to its UK adoption with the same number (EN 12101-6 -> BS EN 12101-6).
  const SPRE = ['BS EN ISO', 'BS EN IEC', 'BS ISO', 'BS IEC', 'BS EN', 'BS', 'PD', 'PAS', 'DD', 'CP', 'EN ISO', 'EN IEC', 'EN', 'ISO', 'IEC'];
  const ADOPT = { 'EN': x => ['BS EN', ...(/^6/.test(x) ? ['BS EN IEC'] : [])], 'EN ISO': () => ['BS EN ISO'], 'EN IEC': () => ['BS EN IEC'], 'ISO': () => ['BS ISO', 'BS EN ISO'],
    'IEC': x => ['BS IEC', 'BS EN IEC', ...(/^6/.test(x) ? ['BS EN'] : [])] };
  // QA v2-R5a V5AF-01: the part, sub-part and "Part n" groups never backtrack: if a further "-digit", ".digit" or "Part n" follows, it must be read or
  // there is no match, and a letter glued on ("BS 8300-2a", "BS 7671-x") is not a boundary, so a part never falls back to its whole standard.
  // A designation = prefix + number that ends at a boundary (QA v2-R2 V2F-01): "BS9991LA" is not BS 9991, and an amendment year may follow with or without a colon (V2F-02).
  // QA v2-R4 V4F-03: "BS 9999 (2017)" and a yyyy-mm stamp "BS 9991:2015-03" give the year; "Amendment 2:2022", "Amd 2:2022" and "+AMD 1:2010" are amendments.
  const SRE = /(?:^|[^A-Za-z0-9])(BS\s*EN\s*ISO|BS\s*EN\s*IEC|BS\s*ISO|BS\s*IEC|BS\s*EN|BS|PD|PAS|DD|CP|EN\s*ISO|EN\s*IEC|EN|ISO|IEC)\s*[:\-]?\s*(\d{1,6}(?:\s*-\s*\d{1,4})*(?!\s*-\s*\d)(?:\.\d{1,3}(?!\d))?(?!\.(?!(?:19|20)\d\d(?!\d))\d))(?:\s*[:,]?\s*(?:Part|Pt\.?)\s*(\d{1,3}(?:\.\d{1,3}(?!\d))?(?!\.(?!(?:19|20)\d\d(?!\d))\d)))?(?!\s*[:,]?\s*(?:Part|Pt\.?)\s*\d)(?:(?:\s*:\s*|\s+|\s*\(\s*(?=(?:19|20)\d\d\s*\)))((?:19|20)\d\d)(?:-(?:0[1-9]|1[0-2])(?![\d\-]))?(?![\d\-])((?:\s*[+\/]\s*A\d{1,2}(?:\s*:?\s*(?:19|20)\d\d(?!\d))?|\s*\+?\s*\(\s*A\d{1,2}(?:\s*:?\s*(?:19|20)\d\d)?\s*\)|\s*,?\s*(?:incorporating\s+)?(?:amendments?|amd\.?)\s*(?:no\.?\s*)?\d{1,2}(?!\d)(?:\s*:?\s*(?:19|20)\d\d(?!\d))?|\s*\+\s*AMD\.?\s*\d{1,2}(?!\d)(?:\s*:?\s*(?:19|20)\d\d(?!\d))?|\s*\+\s*AMDs?\s*\d{3,6}(?:\s*,\s*\d{3,6})*)*))?(?![A-Za-z0-9]|-(?!(?:19|20)\d\d(?!\d))[A-Za-z0-9])/gi;
  // UK postcodes whose area letters are also a prefix (Bristol BS, Enfield EN, Dundee DD): outward code (1-2 digits, optional letter) + inward code (digit + 2 letters),
  // with or without the space ("BS41 9LA", "BS419LA", "EN1 3XA"). Such a token is never read as a standard (V2F-01, V2F-08).
  const POSTC = /^(?:BS|EN|DD)\s?\d{1,2}[A-Z]?\s*-?\s*\d[ABD-HJLNP-UW-Z]{2}(?![A-Za-z0-9])/i; // QA v2-R3 V3F-05: also with a hyphen
  // QA v2-R4 V4F-02: "BS 65 2nd edition", "BS 41 1st floor" are ordinals, not inward codes: the right suffix for the digit (1st, 2nd, 3rd, 4th to 0th)
  // and either a space between the prefix and the number or a lower-case suffix. "bs8 1th", "BS8 1TH", "BS41 9LA" stay postcodes.
  const ORDN = /^(?:BS|EN|DD)(\s?)\d{1,2}\s+(\d)(st|nd|rd|th)$/i;
  const isPostcode = s => { const m = s.match(POSTC); if (!m) return false; const o = m[0].match(ORDN); if (!o) return true;
    const ok = ({ 1: 'st', 2: 'nd', 3: 'rd' }[o[2]] || 'th') === o[3].toLowerCase(); return !(ok && (o[1] !== '' || o[3] === o[3].toLowerCase())); };
  // joined prefixes ("BSEN", "BSENISO", "BS ENISO", "BSISO", "BSENIEC", "BSIEC") parse to their family (V2F-03)
  const PFX = { BSENISO: 'BS EN ISO', BSENIEC: 'BS EN IEC', BSISO: 'BS ISO', BSIEC: 'BS IEC', BSEN: 'BS EN', BS: 'BS', PD: 'PD', PAS: 'PAS', DD: 'DD', CP: 'CP', ENISO: 'EN ISO', ENIEC: 'EN IEC', EN: 'EN', ISO: 'ISO', IEC: 'IEC' };
  const pfx = s => { const k = s.toUpperCase().replace(/\s+/g, ''); return PFX[k] || s.toUpperCase().replace(/\s+/g, ' ').trim(); };
  const SBY = new Map(); N.forEach(n => { if (n.g === 'BS') SBY.set(n.c.toUpperCase(), n); });
  const SKEYS = [...SBY.keys()];
  const specKeep = cp => (cp >= 0xff01 && cp <= 0xff5e) || (cp >= 0x1d400 && cp <= 0x1d7ff) || (cp >= 0x1fbf0 && cp <= 0x1fbf9) || (cp >= 0xfb00 && cp <= 0xfb06);
  const specMark = ch => (specKeep(ch.codePointAt(0)) || !/[A-Za-z0-9]/.test(ch.normalize('NFKC'))) ? ch : ' ';
  function specParse(text) {
    // zero-width characters and soft hyphens from PDF / Word paste are dropped; "B.S." is read as BS (QA v2-R2 V2F-05)
    // QA v2-R4 V4F-01: superscript and subscript digits (footnote markers) are a boundary, never part of the number, so they go to a space before NFKC
    // QA v2-R5a V5AF-01/02: every other glyph whose NFKC form holds an ASCII letter or digit (circled, parenthesised, dingbat and full-stop digits,
    // fractions, unit squares, superscript and modifier letters) is a marker, so also a boundary; fullwidth, mathematical and segmented digit forms
    // and the Latin ligatures stay what they are.
    const t = String(text || '').replace(/[\u00b9\u00b2\u00b3\u2070-\u2079\u2080-\u2089]/g, ' ').replace(/[^\x00-\x7f]/gu, specMark).normalize('NFKC').replace(/[\u00ad\u200b-\u200d\u2060\ufeff\u200e\u200f]/g, '').replace(/[‐-―−﹘﹣－]/g, '-').replace(/[    ]/g, ' ')
      .replace(/\bB\s?\.\s?S\s?\.?(?=\s*(?:EN\b|ISO\b|IEC\b|\d))/gi, 'BS').replace(/\bBS\s*-\s*EN\b/gi, 'BS EN');
    const out = [], seen = new Set(); let m; SRE.lastIndex = 0;
    while ((m = SRE.exec(t))) {
      const st = m.index + (/^[A-Za-z]/.test(m[0]) ? 0 : 1);
      if (isPostcode(t.slice(st))) continue; // a postcode, not a standard (V2F-01; ordinals V4F-02)
      // QA v2-R3 V3F-02: CP-/DD-/PD-/EN-/ISO-/IEC-/PAS- with a bare hyphen and no edition read like drawing or room references ("CP-102 Rev P02", "EN-26")
      if (/^(?:CP|DD|PD|PAS|EN|ISO|IEC)-\d/i.test(t.slice(st, st + 12)) && !m[4]) continue;
      let p = pfx(m[1]), num = m[2].replace(/\s+/g, ''), ed = m[4] || '';
      if (m[3]) num += '-' + m[3];
      const segs = num.split('-');
      if (!ed && segs.length > 1 && /^(19|20)\d\d$/.test(segs[segs.length - 1])) { ed = segs.pop(); num = segs.join('-'); } // "BS 8300-2009": a hyphen year is an edition
      if (ed && m[5]) ed = normEd(ed + m[5]); // "2014 + A1 2018" is written 2014+A1:2018 (V2F-02)
      const raw = m[0].replace(/^[^A-Za-z]/, '').trim().replace(/\(\s*((?:19|20)\d\d)$/, '($1)'), key = p + ' ' + num;
      // QA v2-R4 V4F-03: a year-like text right after the designation that was still not read is said, so no silent non-comparison
      const unread = !ed && /^\s*[:(\-\/,.\[\u2013]?\s*(?:19|20)\d\d(?!\d)|^\s*:\s*(?:19|20)\d\d\d{1,3}(?!\d)/.test(t.slice(SRE.lastIndex)); /* QA v2-R7a V7AF-04: ':1990117' (a footnote glued to the year) is not read silently */ // V5AF-03: also ", 2015 edition"; QA v2-R6a V6AF-01/02: ".2015", "-1983" after a dotted part, "[2015]"
      if (seen.has(key + '|' + ed)) continue; seen.add(key + '|' + ed);
      out.push({ raw, p, num, key, ed, unread });
    }
    return out;
  }
  const byCode = (a, b) => String(a.c).localeCompare(String(b.c), 'en', { numeric: true });
  function specLook(it) {
    let n = SBY.get(it.key);
    if (n) return { n, how: 'exact' };
    const ad = ADOPT[it.p] ? ADOPT[it.p](it.num) : [];
    for (const p of ad) { n = SBY.get(p + ' ' + it.num); if (n) return { n, how: 'as' }; }
    for (const p of [it.p, ...ad]) { const ks = SKEYS.filter(k => k.startsWith(p + ' ' + it.num + '-')); if (ks.length) return { parts: ks.map(k => SBY.get(k)).sort(byCode), how: 'parts' }; }
    // a part that is not on the map is never matched to the whole standard; we only say what the map does have (V1F-02)
    if (it.num.includes('-')) { const par = it.num.split('-')[0]; for (const p of [it.p, ...ad]) { const w = SBY.get(p + ' ' + par); if (w) return { how: 'none', near: w }; } }
    return { how: 'none' };
  }
  // one key per edition (QA v2-R2 V2F-02 / V2F-04): spaces dropped, "+ AMD 1" = "+A1", "A1 2018" = "A1:2018"; a corrigendum does not change the edition
  const isCorr = s => /corrigend/i.test(String(s || ''));
  // QA v2-R3 V3F-01: "/A1:2018", "(A2:2022)" and "incorporating Amendment No. 1" are amendments (+A1:2018, +A2:2022, +A1); "/AC" is a corrigendum, ignored
  const normEd = s => String(s || '').replace(/(?<!\+\s*)\s*,?\s*(?:incorporating\s+)?(?:amendments?|amd\.?)\s*(?:no\.?\s*)?(\d{1,2})(?!\d)/gi, '+A$1').replace(/\s*\/\s*A(?=\d)/gi, '+A')
    .replace(/\s*\+?\s*\(\s*A(\d{1,2})([^)]*)\)/gi, '+A$1$2').replace(/,?\s*\+?\s*(?:incorporating\s+)?corrigend(?:a|um)\b.*$/i, '').replace(/\s+/g, '').replace(/\+AMD(?=A?\d)/gi, '+A').replace(/\+AA(\d)/gi, '+A$1')
    .replace(/\+A(\d{1,2}?):?((?:19|20)\d\d)(?!\d)/gi, '+A$1:$2').replace(/\+$/, '').toUpperCase();
  const noAy = s => s.replace(/(\+A\d{1,2}):(?:19|20)\d\d/g, '$1');
  const edEq = (a, b) => a === b || (noAy(a) === noAy(b) && (noAy(a) === a || noAy(b) === b)); // QA v2-R3 V3F-07: an amendment printed without its year = the same amendment typed with one
  const eoEds = eo => String(eo || '').split(';').map(s => (s.trim().match(/^((?:19|20)\d\d(?:\s*\+\s*A\d{1,2}(?:\s*:?\s*(?:19|20)\d\d)?)*)/) || [])[1]).filter(Boolean);
  function specRow(it) {
    const L = specLook(it), r = { input: it.raw, yours: it.ed, how: L.how, n: L.n || null, parts: L.parts || null, near: L.near || null };
    if (it.unread) { r.unread = true; if (L.n) r.diff = 'Edition not read: the text after the number looks like a year, but we could not read it as an edition, so no comparison was made.'; }
    if (L.n) {
      const n = L.n, b = n.bsx || { s: 'not checked' };
      r.code = n.c; r.ads = [...new Set(citers(n).map(e => N[e.s].c))];
      // every edition each AD prints, not only the first (QA v2-R1 V1D-03)
      r.eds = citers(n).map(e => ({ ad: N[e.s].c, ed: e.ed || '', eo: e.eo || '', p: e.p || '', pr: [e.ed, ...eoEds(e.eo)].filter(Boolean) }));
      r.status = b.s; r.word = statWord(n) || BSW[b.s]; r.lt = b.lt || ''; r.chk = b.chk || ''; r.src = b.src || [];
      r.pa = (b.pa || []).map(x => `${x[0]} ${x[2]}: ${paWord(n, x[1], x[2])}`);
      if (it.ed) {
        // compared per citing AD (QA v2-R2 V2D-02): a row is "same" only when every citing AD prints your edition; a difference with any of them is flagged.
        // The AD's edition is quoted as printed, never as the comparison key (V2F-02).
        const y = normEd(it.ed), ads = [...new Set(r.eds.map(x => x.ad))];
        const per = ads.map(ad => { const pr = [...new Set(r.eds.filter(x => x.ad === ad).flatMap(x => x.pr))];
          const k = !pr.length ? 'none' : pr.some(v => edEq(normEd(v), y)) ? 'same' : pr.some(v => yr(v) === yr(y)) ? 'amendment' : 'edition';
          return { ad, pr, k, corr: k === 'same' && pr.some(v => edEq(normEd(v), y) && isCorr(v)) }; });
        const say = ks => per.filter(x => ks.includes(x.k)).map(x => `${x.ad} prints ${(x.k === 'amendment' ? x.pr.filter(v => yr(v) === yr(y)) : x.k === 'same' ? x.pr.filter(v => edEq(normEd(v), y)) : x.pr).join(' and ')}`).join('; ');
        const sameAds = per.filter(x => x.k === 'same').map(x => x.ad), has = k => per.some(x => x.k === k);
        r.per = per.map(x => [x.ad, x.k]);
        if (per.every(x => x.k === 'none')) { r.dk = 'edition'; r.diff = `Edition: your text gives ${it.ed}; the Approved Documents print no edition for it.`; }
        else if (per.every(x => x.k === 'same' || x.k === 'none')) { r.dk = 'same'; const c = per.filter(x => x.corr); if (c.length) r.diff = `Same edition: ${say(['same'])}; a corrigendum does not change the edition.`; }
        else {
          r.dk = has('edition') ? 'edition' : 'amendment';
          r.diff = `${r.dk === 'edition' ? 'Edition differs' : 'Amendment differs'}: your text gives ${it.ed}.`
            + (sameAds.length ? ` Matches ${sameAds.join(', ')}.` : '')
            + (has('amendment') ? ` Same base edition, a different amendment: ${say(['amendment'])}.` : '')
            + (has('edition') ? ` A different edition: ${say(['edition'])}.` : '')
            + (has('none') ? ` ${per.filter(x => x.k === 'none').map(x => x.ad).join(', ')} print${per.filter(x => x.k === 'none').length > 1 ? '' : 's'} no edition.` : '')
            + (sameAds.length ? ` (${per.length - sameAds.length} of ${per.length} citing ADs differ.)` : '');
        }
        const ltDes = String(b.lt || '').split(/:(?=(?:19|20)\d\d)/)[0].replace(/\s+/g, ' ').trim().toUpperCase();
        if (r.dk !== 'same' && r.lt && ltDes === String(n.c).toUpperCase() && edEq(normEd(ltEd(b)), y)) r.diff += ' Your edition is the newest one our check found.'; // QA v2-R3 V3F-06: same designation too
      }
    }
    return r;
  }
  function specCheck(text) { return specParse(text).map(specRow); }
  const csvq = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const SPEC_COLS = ['in_your_text', 'your_edition', 'on_the_map', 'standard_on_map', 'cited_by', 'editions_printed', 'status', 'status_by_citing_ad', 'newest_edition_found', 'checked_on', 'sources', 'note'];
  function onMapWord(r) { return r.how === 'exact' ? 'yes' : r.how === 'as' ? 'yes, as its UK adoption' : r.how === 'parts' ? 'only its parts' : 'no'; }
  const NOTAPPLY = 'It cannot tell which edition applies to your project: that depends on the Approved Document in force for your application and its transitional provisions.';
  function specCsv(rows) {
    const lines = [SPEC_COLS.join(',')];
    rows.forEach(r => {
      const note = r.how === 'parts' ? `Not cited as a whole; parts on the map: ${r.parts.map(x => x.c).join('; ')}` : r.how === 'none' ? (r.near ? `Not on the map as cited; the map has ${r.near.c} as a whole, a different designation, not matched` : 'Not cited by any in-force Approved Document in our data') : r.how === 'as' ? `Found as its UK adoption ${r.code}` : '';
      lines.push([r.input, r.yours, onMapWord(r), r.code || '', (r.ads || []).join('; '), (r.eds || []).map(x => `${x.ad}: ${x.ed}${x.eo ? ' (also ' + x.eo + ')' : ''}${x.p ? ' (PDF p. ' + x.p + ')' : ''}`).join('; '),
        r.word || '', (r.pa || []).join('; '), r.lt || '', r.chk || '', (r.src || []).map(s => s[1]).join(' | '), [note, r.diff || ''].filter(Boolean).join(' ')].map(csvq).join(','));
    });
    lines.push(csvq(`Not a compliance check. Editions as printed in the Approved Documents; status only as verified on ${CHKD} from public sources not run by BSI; "Status not checked" means unknown, not current. ${NOTAPPLY} UK Building Regulations Map (England), anzonwong.com/uk-regs-map`));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }
  const SAMPLE = 'Fire strategy to BS 9991:2015. Fire detection and alarm to BS5839-1:2017. Emergency lighting to BS 5266-1. Sprinklers to BS EN 12845. External wall test evidence to BS 8414. Accessible design to BS 8300-2:2018 and BS 8300:2009. Pressure differential smoke control to EN 12101-6. Reaction to fire classification to BS EN 13501-1:2018. Fire resistance to BS 476: Part 22: 1987. Concrete design to BS EN 1992-1-1 and PD 6688-1-1. Steelwork execution to BS EN 1090-2. Electrical installation to BS 7671:2018+A2:2022. Workmanship to BS 8000-0:2014.';
  const spec = $('spec'); let specRows = [], specRet = null;
  let specInert = [];
  function specOpen() { specRet = document.activeElement; specInert = [...document.body.children].filter(el => el !== spec && !el.inert && el.tagName !== 'SCRIPT'); specInert.forEach(el => { el.inert = true; }); spec.hidden = false; document.body.classList.add('spec-on'); setTimeout(() => $('spect').focus(), 0); }
  function specClose() { specInert.forEach(el => { el.inert = false; }); specInert = []; spec.hidden = true; document.body.classList.remove('spec-on'); try { (specRet && specRet.isConnected && specRet.offsetParent ? specRet : $('spectop')).focus(); } catch (e) { } }
  function specRender() {
    specRows = specCheck($('spect').value);
    const c = k => specRows.filter(r => r.status === k).length, nf = specRows.filter(r => !r.n).length, dk = k => specRows.filter(r => r.dk === k).length, ur = specRows.filter(r => r.unread).length;  // QA v2-R7a V7AF-01: rows whose edition was not read are counted too
    $('specsum').textContent = specRows.length ? `${specRows.length} standard${specRows.length === 1 ? '' : 's'} found in your text: ${c('superseded')} newer edition or amendment, ${c('withdrawn')} withdrawn, ${c('mixed')} depends on the AD, ${c('current')} current, ${c('not checked')} not checked, ${nf} not on the map as cited. Against what the Approved Documents print: ${dk('edition')} edition difference${dk('edition') === 1 ? '' : 's'}, ${dk('amendment')} amendment difference${dk('amendment') === 1 ? '' : 's'}${ur ? `, ${ur} edition${ur === 1 ? '' : 's'} not read (not compared)` : ''}.` : 'No standard numbers found. Try forms such as BS 9991:2015, BS EN 13501-1 or BS EN ISO 717-1.';
    $('speccsv').disabled = !specRows.length;
    if (!specRows.length) { $('specout').innerHTML = ''; return; }
    const dn = r => r.diff ? `<br><small class="sd ${r.dk}">${esc(r.diff)}</small>` : '';
    const st = r => r.n ? `<span class="sst" style="border-color:${BSC[r.status]}"><b>${esc(r.word)}</b></span>${r.lt && r.status !== 'not checked' ? `<br>${r.status === 'withdrawn' ? 'Replacement found' : 'Newest found'}: ${esc(r.lt)}` : ''}${r.pa.length > 1 ? `<br><small>${r.pa.map(esc).join('<br>')}</small>` : ''}${dn(r)}`
      : r.how === 'parts' ? '<span class="sst none">Cited only as parts (see the parts)</span>' : '<span class="sst none">Not on the map</span>';
    const onm = r => r.how === 'exact' ? `<button type="button" class="sgo" data-i="${r.n.i}">${esc(r.code)} ›</button>`
      : r.how === 'as' ? `<button type="button" class="sgo" data-i="${r.n.i}">${esc(r.code)} ›</button><br><small>its UK adoption, same number</small>`
      : r.how === 'parts' ? `<small>Not cited as a whole. Parts on the map:</small><br>${r.parts.map(x => `<button type="button" class="sgo" data-i="${x.i}">${esc(x.c)} ›</button>`).join(' ')}`
      : r.near ? `<small>No in-force Approved Document cites this part in our data. The map has ${esc(r.near.c)} as a whole, a different designation, so it is not matched.</small>` : '<small>No in-force Approved Document cites it in our data</small>';
    const eds = r => r.n ? r.eds.map(x => `<b>${esc(x.ad)}</b>: ${esc(x.ed || 'no edition printed')}${x.eo ? ` <small>(also ${esc(x.eo)})</small>` : ''}${x.p ? ` <small>PDF p. ${esc(x.p)}</small>` : ''}`).join('<br>') : '';
    const src = r => r.n && r.src.length ? r.src.map(s => `<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])} ↗</a>`).join('<br>') + `<br><small>checked ${esc(fmtD(r.chk))}</small>` : r.n ? '<small>None: not checked</small>' : '';
    $('specout').innerHTML = `<div class="stw"><table class="stab"><caption class="vh">Spec check results</caption><thead><tr><th scope="col">In your text</th><th scope="col">On the map</th><th scope="col">Cited by and edition printed</th><th scope="col">Status (our check)</th><th scope="col">Source checked</th></tr></thead><tbody>` +
      specRows.map(r => `<tr class="${r.n ? 's-' + r.status.replace(' ', '') : 's-none'}"><td data-l="In your text">${esc(r.input)}</td><td data-l="On the map">${onm(r)}</td><td data-l="Cited by">${eds(r)}</td><td data-l="Status">${st(r)}</td><td data-l="Source">${src(r)}</td></tr>`).join('') + `</tbody></table></div>`;
    $('specout').querySelectorAll('.sgo').forEach(b => b.onclick = () => { specClose(); heroDone(false); select(+b.dataset.i); refocus($('pcode')); });
  }
  function specDownload() {
    if (!specRows.length) return;
    const blob = new Blob([specCsv(specRows)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'uk-regs-map-spec-check.csv'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $('specbtn').onclick = specOpen; $('spectop').onclick = specOpen; $('specx').onclick = specClose;
  $('specgo').onclick = specRender; $('specsample').onclick = () => { $('spect').value = SAMPLE; specRender(); };
  $('specclr').onclick = () => { $('spect').value = ''; specRender(); $('specsum').textContent = ''; $('spect').focus(); };
  $('speccsv').onclick = specDownload;
  $('spect').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); specRender(); } });
  spec.addEventListener('click', e => { if (e.target === spec) specClose(); });
  spec.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); specClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...spec.querySelectorAll('a[href],button:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null); if (!f.length) return;
    const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });

  // ---- start: domain layout, hero open, edition-check button labelled from data ----
  document.querySelectorAll('#mode button').forEach(b => { b.classList.toggle('on', b.dataset.m === S.mode); b.setAttribute('aria-pressed', String(b.dataset.m === S.mode)); });
  alertUi(); buildSide(); applyFilter();
  heroOpen();
  const v2api = { alertOn, alertOff, alertCard, alertList, alertN: () => ALTN, alertIds: () => ALT.map(n => n.i), mixIds: () => MIX.map(n => n.i), specParse, specCheck, normEd, specCsv: t => specCsv(specCheck(t)), specOpen, specClose, specRender, specDownload, sample: () => SAMPLE,
    heroOpen, heroDone, hero: () => !!S.hero, runQuery, chips: () => CHIPS.map(c => c[1]), hubs: () => HUBS.map(([n, c]) => [n.c, c]), zoomIn: () => S.zoomIn, pulse: () => pulseF(), dotColor: i => nodeColor(N[i]), dotSize: i => nodeVal(N[i]), zr: () => R.zr ? R.zr() : null, shownGrey: () => N.filter(n => isNC(n) && n.vis).length,
    // contrast sampler hooks: hide one dot's core but keep its halo, or switch every halo off (planted self-test)
    noCore: (i, on) => { N[i].noCore = !!on; R.refresh(); R.moved(); }, noHaloAll: on => { S.noHaloAll = !!on; R.refresh(); R.moved(); }, halo: i => haloOn(N[i]), burstF: () => burstF(), caption: () => cap.classList.contains('on') ? cap.textContent : '', rule: () => Object.assign({}, EDRULE), amendOnly: () => N.filter(amendOnly).map(n => n.c) };

  // ================= v3 full text (10 Nov 2026): the Building Regulations 2010 and the 24 Approved Documents, readable and searchable =================
  // Inserted by b4v3_fulltext.py after the v2 block. The text is lazy: ft/index.js (search), ft/br2010.js and ft/ad/<slug>.js are each added as a
  // <script> on first use (that works from file:// and from GitHub Pages), never on the first screen. Text is the verified extraction, shown as is.
  const FTM = {"v":"20261111v7a","files":{"ad-a":"ad/ad-a.js","ad-b-vol-1":"ad/ad-b-vol-1.js","ad-b-vol-2":"ad/ad-b-vol-2.js","ad-c":"ad/ad-c.js","ad-d":"ad/ad-d.js","ad-e":"ad/ad-e.js","ad-f-vol-1":"ad/ad-f-vol-1.js","ad-f-vol-2":"ad/ad-f-vol-2.js","ad-g":"ad/ad-g.js","ad-h":"ad/ad-h.js","ad-j":"ad/ad-j.js","ad-k":"ad/ad-k.js","ad-l-vol-1":"ad/ad-l-vol-1.js","ad-l-vol-2":"ad/ad-l-vol-2.js","ad-m-vol-1":"ad/ad-m-vol-1.js","ad-m-vol-2":"ad/ad-m-vol-2.js","ad-o":"ad/ad-o.js","ad-p":"ad/ad-p.js","ad-q":"ad/ad-q.js","ad-r-vol-1":"ad/ad-r-vol-1.js","ad-r-vol-2":"ad/ad-r-vol-2.js","ad-s":"ad/ad-s.js","ad-t":"ad/ad-t.js","ad-reg-7":"ad/ad-reg-7.js","br2010":"br2010.js","index":"index.js","qb":"qb.js"},"docs":[{"slug":"ad-a","code":"AD A","title":"Approved Document A: Structure","edition":"2004 edition incorporating 2010 and 2013 amendments (2013 reprint)","url":"https://assets.publishing.service.gov.uk/media/5a80437640f0b623026927b2/BR_PDF_AD_A_2013.pdf","pages":54,"lig":{"fixed":0,"left":0},"y29":[],"kb":140,"clauses":89,"tables":20,"diagrams":31,"cov":99.533,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[3,4,25]},{"slug":"ad-b-vol-1","code":"AD B Vol 1","title":"Approved Document B: Fire safety, Volume 1 Dwellings","edition":"2019 edition incorporating 2020, 2022, 2025 and 2026 amendments and forthcoming 2029 changes","url":"https://assets.publishing.service.gov.uk/media/6aa3bb335f6e942efe37f150/AD_B1_2026.pdf","pages":200,"lig":{"fixed":289,"left":2},"y29":[149,150,151,152,153,154,155,156,157,158,159,160,161,166,167,168,169],"kb":517,"clauses":490,"tables":70,"diagrams":61,"cov":99.794,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[9,10,11,141]},{"slug":"ad-b-vol-2","code":"AD B Vol 2","title":"Approved Document B: Fire safety, Volume 2 Buildings other than dwellings","edition":"2019 edition incorporating 2020, 2022, 2025 and 2026 amendments and forthcoming 2029 changes","url":"https://assets.publishing.service.gov.uk/media/6aa3bb7492e72b8ac437f145/AD_B2_2026.pdf","pages":224,"lig":{"fixed":345,"left":2},"y29":[164,165,166,167,168,169,170,171,172,173,174,175,176,181,182,183,184],"kb":575,"clauses":505,"tables":76,"diagrams":65,"cov":99.793,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[9,10,11,12]},{"slug":"ad-c","code":"AD C","title":"Approved Document C: Site preparation and resistance to contaminants and moisture","edition":"2004 edition incorporating 2010 and 2013 amendments","url":"https://assets.publishing.service.gov.uk/media/5a8192a0e5274a2e8ab54b5f/BR_PDF_AD_C_2013.pdf","pages":52,"lig":{"fixed":0,"left":0},"y29":[],"kb":185,"clauses":139,"tables":5,"diagrams":14,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[3,4,37,45,46,47]},{"slug":"ad-d","code":"AD D","title":"Approved Document D: Toxic substances","edition":"2015 reprint incorporating 2002, 2010 and 2013 amendments","url":"https://assets.publishing.service.gov.uk/media/5a80eaa440f0b623026963ae/ADD_LOCKED.pdf","pages":10,"lig":{"fixed":0,"left":0},"y29":[],"kb":15,"clauses":2,"tables":1,"diagrams":0,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[]},{"slug":"ad-e","code":"AD E","title":"Approved Document E: Resistance to the passage of sound","edition":"2003 edition incorporating 2004, 2010 and 2013 amendments","url":"https://assets.publishing.service.gov.uk/media/5a809c4fe5274a2e87dbacb9/ADE_LOCKED.pdf","pages":86,"lig":{"fixed":0,"left":0},"y29":[],"kb":295,"clauses":521,"tables":15,"diagrams":80,"cov":99.939,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[3,4,5,6,75,82]},{"slug":"ad-f-vol-1","code":"AD F Vol 1","title":"Approved Document F: Ventilation, Volume 1 Dwellings","edition":"2021 edition","url":"https://assets.publishing.service.gov.uk/media/61deba42d3bf7f054fcc243d/ADF1.pdf","pages":62,"lig":{"fixed":0,"left":0},"y29":[],"kb":157,"clauses":182,"tables":22,"diagrams":4,"cov":99.879,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8]},{"slug":"ad-f-vol-2","code":"AD F Vol 2","title":"Approved Document F: Ventilation, Volume 2 Buildings other than dwellings","edition":"2021 edition","url":"https://assets.publishing.service.gov.uk/media/62a761edd3bf7f03667c667e/ADF2_revised.pdf","pages":48,"lig":{"fixed":0,"left":0},"y29":[],"kb":118,"clauses":93,"tables":8,"diagrams":0,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8]},{"slug":"ad-g","code":"AD G","title":"Approved Document G: Sanitation, hot water safety and water efficiency","edition":"2015 edition with 2016 and 2024 amendments","url":"https://assets.publishing.service.gov.uk/media/66f6c6ce3b919067bb4828cc/ADG_with_2024_amendments.pdf","pages":56,"lig":{"fixed":547,"left":0},"y29":[],"kb":203,"clauses":183,"tables":32,"diagrams":5,"cov":99.233,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[3,4]},{"slug":"ad-h","code":"AD H","title":"Approved Document H: Drainage and waste disposal","edition":"2015 edition","url":"https://assets.publishing.service.gov.uk/media/5a80cf9ded915d74e33fc8ae/BR_PDF_AD_H_2015.pdf","pages":64,"lig":{"fixed":0,"left":0},"y29":[],"kb":231,"clauses":313,"tables":26,"diagrams":19,"cov":99.964,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[3,4,5,22,62]},{"slug":"ad-j","code":"AD J","title":"Approved Document J: Combustion appliances and fuel storage systems","edition":"2010 edition incorporating 2010, 2013 and 2022 amendments","url":"https://assets.publishing.service.gov.uk/media/6336e58be90e0772dc9651a2/ADJ_2022.pdf","pages":89,"lig":{"fixed":0,"left":1},"y29":[],"kb":292,"clauses":248,"tables":37,"diagrams":49,"cov":99.75,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[2,3,4,84,85,86,87]},{"slug":"ad-k","code":"AD K","title":"Approved Document K: Protection from falling, collision and impact","edition":"2013 edition","url":"https://assets.publishing.service.gov.uk/media/60d5bdcde90e07716f516cfd/Approved_Document_K.pdf","pages":68,"lig":{"fixed":0,"left":0},"y29":[],"kb":120,"clauses":91,"tables":12,"diagrams":36,"cov":99.18,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8,9]},{"slug":"ad-l-vol-1","code":"AD L Vol 1","title":"Approved Document L: Conservation of fuel and power, Volume 1 Dwellings","edition":"2021 edition incorporating 2023 amendments","url":"https://assets.publishing.service.gov.uk/media/662a2e3e55e1582b6ca7e592/Approved_Document_L__Conservation_of_fuel_and_power__Volume_1_Dwellings__2021_edition_incorporating_2023_amendments.pdf","pages":104,"lig":{"fixed":0,"left":0},"y29":[],"kb":288,"clauses":246,"tables":25,"diagrams":2,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8,9,10,11]},{"slug":"ad-l-vol-2","code":"AD L Vol 2","title":"Approved Document L: Conservation of fuel and power, Volume 2 Buildings other than dwellings","edition":"2021 edition incorporating 2023 amendments","url":"https://assets.publishing.service.gov.uk/media/63d8edbde90e0773d8af2c98/Approved_Document_L__Conservation_of_fuel_and_power__Volume_2_Buildings_other_than_dwellings__2021_edition_incorporating_2023_amendments.pdf","pages":116,"lig":{"fixed":0,"left":0},"y29":[],"kb":315,"clauses":264,"tables":34,"diagrams":2,"cov":99.997,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8,9,10,11]},{"slug":"ad-m-vol-1","code":"AD M Vol 1","title":"Approved Document M: Access to and use of buildings, Volume 1 Dwellings","edition":"2015 edition incorporating 2016 amendments","url":"https://assets.publishing.service.gov.uk/media/5a7f8a82ed915d74e622b17b/BR_PDF_AD_M1_2015_with_2016_amendments_V3.pdf","pages":69,"lig":{"fixed":0,"left":0},"y29":[],"kb":149,"clauses":108,"tables":35,"diagrams":22,"cov":99.941,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8]},{"slug":"ad-m-vol-2","code":"AD M Vol 2","title":"Approved Document M: Access to and use of buildings, Volume 2 Buildings other than dwellings","edition":"2015 edition incorporating 2020 and 2024 amendments","url":"https://assets.publishing.service.gov.uk/media/66f6c5eec71e42688b65ee11/ADM__V2_with_2024_amendments.pdf","pages":74,"lig":{"fixed":4,"left":1},"y29":[],"kb":236,"clauses":203,"tables":5,"diagrams":24,"cov":99.579,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[3,4,5,72]},{"slug":"ad-o","code":"AD O","title":"Approved Document O: Overheating","edition":"2021 edition","url":"https://assets.publishing.service.gov.uk/media/6218c5aad3bf7f4f0b29b624/ADO.pdf","pages":44,"lig":{"fixed":0,"left":0},"y29":[],"kb":84,"clauses":67,"tables":24,"diagrams":2,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8]},{"slug":"ad-p","code":"AD P","title":"Approved Document P: Electrical safety, dwellings","edition":"2013 edition","url":"https://assets.publishing.service.gov.uk/media/5a802da7ed915d74e622ceed/BR_PDF_AD_P_2013.pdf","pages":22,"lig":{"fixed":0,"left":0},"y29":[],"kb":42,"clauses":32,"tables":5,"diagrams":2,"cov":99.587,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7]},{"slug":"ad-q","code":"AD Q","title":"Approved Document Q: Security, dwellings","edition":"2015 edition","url":"https://assets.publishing.service.gov.uk/media/5a8016a8ed915d74e622c659/BR_PDF_AD_Q_2015.pdf","pages":20,"lig":{"fixed":0,"left":0},"y29":[],"kb":38,"clauses":11,"tables":1,"diagrams":0,"cov":99.825,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,18]},{"slug":"ad-r-vol-1","code":"AD R Vol 1","title":"Approved Document R: Physical infrastructure and network connection for new dwellings, Volume 1","edition":"2022 edition (effective 26 Dec 2022)","url":"https://assets.publishing.service.gov.uk/media/637f356ee90e072342b82d4e/ADR1.pdf","pages":36,"lig":{"fixed":0,"left":0},"y29":[],"kb":84,"clauses":64,"tables":7,"diagrams":6,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7]},{"slug":"ad-r-vol-2","code":"AD R Vol 2","title":"Approved Document R: Physical infrastructure for high-speed electronic communications networks, Volume 2","edition":"2022 edition","url":"https://assets.publishing.service.gov.uk/media/637f357ad3bf7f154043fe68/ADR2.pdf","pages":20,"lig":{"fixed":0,"left":0},"y29":[],"kb":37,"clauses":16,"tables":3,"diagrams":2,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7]},{"slug":"ad-s","code":"AD S","title":"Approved Document S: Infrastructure for the charging of electric vehicles","edition":"2021 edition (effective 15 Jun 2022)","url":"https://assets.publishing.service.gov.uk/media/6218c5d38fa8f54911e22263/AD_S.pdf","pages":47,"lig":{"fixed":0,"left":0},"y29":[],"kb":114,"clauses":60,"tables":9,"diagrams":7,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7,8]},{"slug":"ad-t","code":"AD T","title":"Approved Document T: Toilet accommodation","edition":"2024 edition (effective 1 Oct 2024), revised file 16 Jun 2025","url":"https://assets.publishing.service.gov.uk/media/6901feb971b575684c3cf7c4/ADT_2024_rev16Jun25.pdf","pages":36,"lig":{"fixed":0,"left":0},"y29":[],"kb":80,"clauses":60,"tables":13,"diagrams":8,"cov":99.351,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[9]},{"slug":"ad-reg-7","code":"AD Reg 7","title":"Approved Document 7: Materials and workmanship","edition":"2013 edition incorporating 2018 amendments (effective 21 Dec 2018)","url":"https://assets.publishing.service.gov.uk/media/5cf8d74fe5274a5f115e8778/AD_Regulation_7.pdf","pages":24,"lig":{"fixed":0,"left":0},"y29":[],"kb":44,"clauses":42,"tables":0,"diagrams":0,"cov":100.0,"lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","cp":[7]}],"br":{"title":"The Building Regulations 2010 (S.I. 2010/2214), revised","url":"https://www.legislation.gov.uk/uksi/2010/2214","valid":"2026-11-06","fetched":"2026-11-10","lic":"https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/","kb":1441,"eng":1736,"cov_lines":3420,"wprov":33,"wtop":41,"walt":30,"wlines":19},"cov":99.808,"chars":2669652,"reqt":{"sch1-A1":[["ad-a","165",8,"performance"]],"sch1-A2":[["ad-a","165",8,"performance"]],"sch1-A3":[["ad-a","693",44,"performance"]],"sch1-B1":[["ad-b-vol-1","243",20,"heading"],["ad-b-vol-2","267",20,"heading"]],"sch1-B2":[["ad-b-vol-1","96",8,"heading"],["ad-b-vol-2","95",8,"heading"]],"sch1-B3":[["ad-b-vol-1","893",62,"heading"],["ad-b-vol-2","974",73,"heading"]],"sch1-B4":[["ad-b-vol-1","1281",89,"heading"],["ad-b-vol-2","1414",103,"heading"]],"sch1-B5":[["ad-b-vol-1","1470",110,"heading"],["ad-b-vol-2","1606",122,"heading"]],"sch1-C1":[["ad-c","231",11,"performance"]],"sch1-C2":[["ad-c","236",11,"performance"]],"sch1-D1":[["ad-d","45",8,"heading names it"]],"sch1-E1":[["ad-e","354",14,"performance"]],"sch1-E2":[["ad-e","381",16,"performance"]],"sch1-E3":[["ad-e","383",16,"performance"]],"sch1-E4":[["ad-e","384",16,"performance"]],"sch1-F1":[["ad-f-vol-1","174",13,"heading"],["ad-f-vol-2","173",13,"heading"]],"sch1-G1":[["ad-g","267",15,"performance"]],"sch1-G2":[["ad-g","309",18,"performance"]],"sch1-G3":[["ad-g","358",21,"performance"]],"sch1-G4":[["ad-g","559",31,"performance"]],"sch1-G5":[["ad-g","620",35,"performance"]],"sch1-G6":[["ad-g","644",37,"performance"]],"sch1-H1":[["ad-h","229",8,"performance"]],"sch1-H2":[["ad-h","687",31,"performance"]],"sch1-H3":[["ad-h","872",41,"performance"]],"sch1-H4":[["ad-h","1065",50,"performance"]],"sch1-H5":[["ad-h","1111",53,"performance"]],"sch1-H6":[["ad-h","1131",55,"performance"]],"sch1-J1":[["ad-j","339",19,"performance"]],"sch1-J2":[["ad-j","339",19,"performance"]],"sch1-J3":[["ad-j","339",19,"performance"]],"sch1-J4":[["ad-j","339",19,"performance"]],"sch1-J5":[["ad-j","339",19,"performance"],["ad-j","492",30,"heading names it"]],"sch1-J6":[["ad-j","927",65,"performance"]],"sch1-J7":[["ad-j","927",65,"performance"]],"sch1-K1":[["ad-k","185",13,"heading"]],"sch1-K2":[["ad-k","473",32,"heading"]],"sch1-K3":[["ad-k","526",36,"heading"]],"sch1-K4":[["ad-k","575",40,"heading"]],"sch1-K5-1":[["ad-k","655",45,"heading"]],"sch1-K5-2":[["ad-k","685",48,"heading"]],"sch1-K5-3":[["ad-k","727",51,"heading"]],"sch1-K5-4":[["ad-k","749",53,"heading"]],"sch1-K6":[["ad-k","795",57,"heading"]],"sch1-L1":[["ad-l-vol-1","455",31,"heading"],["ad-l-vol-2","505",31,"heading"]],"sch1-L2":[["ad-l-vol-1","633",43,"heading"],["ad-l-vol-2","626",43,"heading"]],"sch1-M4-1":[["ad-m-vol-1","154",11,"heading"]],"sch1-M4-2":[["ad-m-vol-1","261",18,"performance"]],"sch1-M4-3":[["ad-m-vol-1","438",31,"performance"]],"sch1-M1":[["ad-m-vol-2","198",13,"performance"]],"sch1-M2":[["ad-m-vol-2","198",13,"performance"]],"sch1-M3":[["ad-m-vol-2","198",13,"performance"]],"sch1-O1":[["ad-o","148",12,"heading"]],"sch1-P1":[["ad-p","103",10,"heading"]],"sch1-Q1":[["ad-q","116",10,"heading"]],"sch1-RA1":[["ad-r-vol-1","100",10,"heading"]],"sch1-RA2":[["ad-r-vol-1","174",21,"heading"]],"sch1-R1":[["ad-r-vol-2","91",10,"heading"]],"sch1-S1":[["ad-s","142",11,"heading"]],"sch1-S2":[["ad-s","214",17,"heading"]],"sch1-S3":[["ad-s","237",19,"heading"]],"sch1-S4":[["ad-s","330",25,"heading"]],"sch1-S5":[["ad-s","362",27,"heading"]],"sch1-S6":[["ad-s","406",31,"heading"]],"sch1-T1":[["ad-t","175",14,"heading"]],"reg-7":[["ad-reg-7","0",1,"start"]]},"reqs":{"sch1-partA":[["sch1-A1","A1","Loading"],["sch1-A2","A2","Ground Movement"],["sch1-A3","A3","Disproportionate collapse"]],"sch1-partB":[["sch1-B1","B1","Means of warning and escape"],["sch1-B2","B2","Internal fire spread (linings)"],["sch1-B3","B3","Internal fire spread (structure)"],["sch1-B4","B4","External Fire Spread"],["sch1-B5","B5","Access and facilities for the fire service"]],"sch1-partC":[["sch1-C1","C1","Preparation of site and resistance to contaminants"],["sch1-C2","C2","Resistance to moisture"]],"sch1-partD":[["sch1-D1","D1","Cavity insulation"]],"sch1-partE":[["sch1-E1","E1","Protection against sound from other parts of the building and adjoining buildings"],["sch1-E2","E2","Protection against sound within a dwelling-house etc"],["sch1-E3","E3","Reverberation in common internal parts of buildings containing flats or rooms for residential purposes"],["sch1-E4","E4","Acoustic conditions in schools"]],"sch1-partF":[["sch1-F1","F1","Means of ventilation"]],"sch1-partG":[["sch1-G1","G1","Cold water supply"],["sch1-G2","G2","Water efficiency"],["sch1-G3","G3","Hot water supply and systems"],["sch1-G4","G4","Sanitary conveniences and washing facilities"],["sch1-G5","G5","Bathrooms"],["sch1-G6","G6","Kitchens and food preparation areas"]],"sch1-partH":[["sch1-H1","H1","Foul water drainage"],["sch1-H2","H2","Wastewater treatment systems and cesspools"],["sch1-H3","H3","Rainwater drainage"],["sch1-H4","H4","Building over sewers"],["sch1-H5","H5","Separate systems of drainage"],["sch1-H6","H6","Solid waste storages"]],"sch1-partJ":[["sch1-J1","J1","Air supply"],["sch1-J2","J2","Discharge of products of combustion"],["sch1-J3","J3","Warning of release of carbon monoxide"],["sch1-J4","J4","Protection of building"],["sch1-J5","J5","Provision of information"],["sch1-J6","J6","Protection of liquid fuel storage systems"],["sch1-J7","J7","Protection against pollution"]],"sch1-partK":[["sch1-K1","K1","Stairs, ladders and ramps"],["sch1-K2","K2","Protection from falling"],["sch1-K3","K3","Vehicle barriers and loading bays"],["sch1-K4","K4","Protection against impact with glazing"],["sch1-K5-1","K5.1","Protection from collision with open windows etc."],["sch1-K5-2","K5.2","Manifestation of glazing"],["sch1-K5-3","K5.3","Safe opening and closing of windows etc."],["sch1-K5-4","K5.4","Safe access for cleaning windows etc."],["sch1-K6","K6","Protection against impact from trapping by doors"]],"sch1-partL":[["sch1-L1","L1","Conservation of fuel and power"],["sch1-L2","L2","On-site generation of electricity"]],"sch1-partM":[["sch1-M1","M1","Access to and use of buildings other than dwellings"],["sch1-M2","M2","Access to extensions to buildings other than dwellings"],["sch1-M3","M3","Sanitary conveniences in extensions to buildings other than dwellings"],["sch1-M4-1","M4(1)","Access to and use of dwellings"],["sch1-M4-2","M4(2)","Access to and use of dwellings"],["sch1-M4-3","M4(3)","Access to and use of dwellings"]],"sch1-partO":[["sch1-O1","O1","Overheating mitigation"]],"sch1-partP":[["sch1-P1","P1","Design and installation"]],"sch1-partQ":[["sch1-Q1","Q1","Unauthorised access"]],"sch1-partR":[["sch1-RA1","RA1","Gigabit-ready physical infrastructure"],["sch1-RA2","RA2","Connection to gigabit-capable network"],["sch1-R1","R1","High-speed ready in-building physical infrastructure"]],"sch1-partS":[["sch1-S1","S1","The erection of new residential buildings"],["sch1-S2","S2","Dwellings resulting from a material change of use"],["sch1-S3","S3","Residential buildings undergoing major renovation"],["sch1-S4","S4","Erection of new buildings which are not residential buildings or mixed-use buildings"],["sch1-S5","S5","Buildings undergoing major renovation which are not residential buildings or mixed-use buildings"],["sch1-S6","S6","The erection of new mixed-use buildings and mixed-use buildings undergoing major renovation"]],"sch1-partT":[["sch1-T1","T1","Toilet accommodation"]]},"adPart":{"AD A":["sch1-partA"],"AD B Vol 1":["sch1-partB"],"AD B Vol 2":["sch1-partB"],"AD C":["sch1-partC"],"AD D":["sch1-partD"],"AD E":["sch1-partE"],"AD F Vol 1":["sch1-partF"],"AD F Vol 2":["sch1-partF"],"AD G":["sch1-partG"],"AD H":["sch1-partH"],"AD J":["sch1-partJ"],"AD K":["sch1-partK"],"AD L Vol 1":["sch1-partL"],"AD L Vol 2":["sch1-partL"],"AD M Vol 1":["sch1-partM"],"AD M Vol 2":["sch1-partM"],"AD O":["sch1-partO"],"AD P":["sch1-partP"],"AD Q":["sch1-partQ"],"AD R Vol 1":["sch1-partR"],"AD R Vol 2":["sch1-partR"],"AD S":["sch1-partS"],"AD T":["sch1-partT"],"AD Reg 7":["reg-7"]},"fix":[{"doc":"ad-b-vol-1","block":1938,"number":"B16","how":"split at the printed number","page":137},{"doc":"ad-b-vol-1","block":2107,"number":"B16","how":"split at the printed number","page":151},{"doc":"ad-m-vol-2","block":962,"number":"5.19","how":"split at the printed number","page":59},{"doc":"ad-g","block":788,"number":"A27","how":"marked (read after A28 by both tools)","page":46},{"doc":"ad-e","block":1121,"number":"3.2","how":"number removed (end of a heading, not a paragraph)","page":49},{"doc":"ad-e","block":1246,"number":"3.2","how":"number removed (end of a heading, not a paragraph)","page":54}]};
  const FTD = {}, FTW = {};
  window.__FT = (k, d) => { FTD[k] = d; (FTW[k] || []).forEach(f => f[0](d)); delete FTW[k]; };
  function ftLoad(k) {
    if (FTD[k]) return Promise.resolve(FTD[k]);
    return new Promise((res, rej) => {
      if (FTW[k]) { FTW[k].push([res, rej]); return; }
      FTW[k] = [[res, rej]];
      const s = document.createElement('script'); s.src = `ft/${FTM.files[k]}?v=${FTM.v}`; s.async = true;
      s.onerror = () => { const l = FTW[k] || []; delete FTW[k]; s.remove(); l.forEach(f => f[1](new Error('could not load ' + k))); };
      document.head.appendChild(s);
    });
  }
  const DOC = {}, DOCC = {}; FTM.docs.forEach(d => { DOC[d.slug] = d; DOCC[d.code] = d; });
  const NBYC = new Map(N.map(n => [n.c, n]));
  const FT = { cur: null, last: null, seq: 0, res: null };
  const live = t => { const el = $('ftlive'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = t; }, 30); } };
  const pageLink = (url, pg, txt) => `<a href="${esc(url)}#page=${pg}" target="_blank" rel="noopener">${txt || `PDF p. ${pg}`} ↗</a>`;
  function ftWide(on) {
    const p = $('panel'); if (!p) return; const was = p.classList.contains('ftr');
    p.classList.toggle('ftr', !!on); document.body.classList.toggle('ftr-on', !!on);
    if (was !== !!on && p.classList.contains('open') && R && R.panel) R.panel(!S.col);
  }

  // ---- matching: the same normalisation as b4v3_fulltext.py (letters and digits, lower case, ligatures spelt out, i/l after f dropped) ----
  const LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
  function normIx(s) {
    s = String(s || ''); const t = [], m = [];
    for (let i = 0; i < s.length; i++) for (const ch of (LIG[s[i]] || s[i]).toLowerCase()) {
      if (!/[a-z0-9]/.test(ch)) continue; if ((ch === 'i' || ch === 'l') && t.length && t[t.length - 1] === 'f') continue; t.push(ch); m.push(i);
    }
    return { t: t.join(''), m };
  }
  const blockText = b => [b.x, b.cap, ...(b.rows || []).flat(), ...(b.lines || [])].filter(Boolean).join(' ');
  function qRange(text, q) { // where a citation's quote sits in a block: [start, end) in the block's own text, or null
    const a = normIx(text), qq = normIx(String(q || '').replace(/^[\s….]+|[\s….]+$/g, '')).t; if (!qq || !a.t) return null;
    for (const pr of [qq, qq.slice(0, 60), qq.slice(0, 30), qq.slice(0, 16)]) { // the same probes as b4v3 (a quote that runs on into the next block is lit to the end of this one)
      if (pr.length < 10 && pr !== qq) continue; const p = a.t.indexOf(pr); if (p < 0) continue;
      return [a.m[p], a.m[Math.min(a.t.length, p + qq.length) - 1] + 1];
    }
    const tail = qq.slice(-40), p2 = tail.length >= 10 ? a.t.indexOf(tail) : -1;
    if (p2 >= 0) return [a.m[Math.max(0, p2 + tail.length - qq.length)], a.m[p2 + tail.length - 1] + 1];
    // QA v2-R5a V5AT-04: a quote that starts in the entry before and runs into this block (a list entry printed over two blocks): the longest
    // start of this block (16+ letters and digits) that lies inside the quote is lit
    if (a.t.length >= 10 && a.t.length < 16 && qq.includes(a.t)) return [a.m[0], a.m[a.t.length - 1] + 1]; // a short block wholly inside the quote ("Grey iron BS 437")
    for (let n = a.t.length; n >= 16; n = n > 64 ? Math.floor(n * .8) : n - 4) { if (qq.includes(a.t.slice(0, n))) return [a.m[0], a.m[n - 1] + 1]; }
    return null;
  }
  // a search word matches at a word start; "f" also matches the PDF's lost ligatures ("fre" for "fire") and the ligature glyphs themselves
  const rxq = c => c.replace(/[.*+?^${}()|[\]\\\-]/g, '\\$&');
  const fold = w => normIx(w).t;
  const HY = '[-\u2010\u2011\u00ad\\s]?';  // a hyphenated word also matches with a space or nothing between its parts ("fire-resisting", "U-value")
  // QA v2-R7a (found by b5v8's search sample): the fold drops every i/l after an f, so "fill" folded to "f" and matched every word that starts
  // with f. A query word is matched letter by letter instead; only one "fi" / "fl" (or "ffi", "ffl", "ff") may be a ligature glyph or a lost one.
  const wPat1 = w => { const s = String(w).toLowerCase(); let o = ''; for (let i = 0; i < s.length; i++) { const t3 = s.substr(i, 3), t2 = s.substr(i, 2);
      if (t3 === 'ffi') { o += '(?:ﬃ|fﬁ|ﬀi|ff?i?)'; i += 2; } else if (t3 === 'ffl') { o += '(?:ﬄ|fﬂ|ﬀl|ff?l?)'; i += 2; } else if (t2 === 'fi') { o += '(?:ﬁ|fi?)'; i++; } else if (t2 === 'fl') { o += '(?:ﬂ|fl?)'; i++; }
      else if (t2 === 'ff') { o += '(?:ﬀ|ff?)'; i++; } else if (s[i] === 'f') o += 'f'; else if (/[a-z0-9]/.test(s[i])) o += rxq(s[i]); } return o; };
  const wPat = w => String(w).split(/[-\u2010\u2011]+/).filter(Boolean).map(wPat1).join(HY);
  const STOPW = new Set('the and for that with this are from shall should which have been not any may can its such where when their than other more into also each will them only does must being upon would there these those under over about within between'.split(' '));
  // the query's words: a hyphenated word is one word ("fire-resisting"); a word of 1-2 letters counts only inside a hyphenated word ("U-value")
  const qToks = s => String(s || '').toLowerCase().replace(/[\u00ad]/g, '').match(/[a-z0-9]+(?:[-\u2010\u2011][a-z0-9]+)*/g) || [];
  const qWords = s => [...new Set(qToks(s).filter(w => /[-\u2010\u2011]/.test(w) ? w.split(/[-\u2010\u2011]/).some(x => x.length >= 3 || /\d/.test(x)) : (w.length >= 3 && !STOPW.has(w) && !/^\d+$/.test(w))))];
  // QA v2-R5a V5AT-01: a query that holds a code or number ("Table B1", "requirement B1", "M4(2)", "2.5", "regulation 7") is matched as typed:
  // letters and digits of a code exactly, words as words (with the ligature fold), spaces flexible, punctuation literal, and a number never
  // runs on into more digits ("2.5" is not "2.50", "12.5" or "2.5.1"). The count then is exactly the blocks that contain it.
  const qCodes = s => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter(x => /\d/.test(x));
  function codeRe(s) {
    const ps = String(s || '').trim().match(/[A-Za-z0-9]+|\s+|[^A-Za-z0-9\s]/g) || []; if (!ps.length) return null;
    const body = ps.map(p => /^\s+$/.test(p) ? '\\s+' : /^[A-Za-z0-9]+$/.test(p) ? (/\d/.test(p) || p.length < 3 ? rxq(p) : wPat1(p))
      : /[-\u2010\u2011]/.test(p) ? '[-\u2010\u2011]' : p === '(' ? '\\s*\\(\\s*' : p === ')' ? '\\s*\\)' : rxq(p)).join('');
    const last = ps[ps.length - 1], tail = /\d$/.test(last) ? '(?![0-9]|\\.[0-9])' : /[A-Za-z]$/.test(last) ? '(?![A-Za-z0-9])' : '';
    return new RegExp('(^|[^A-Za-z0-9])' + (/^\d/.test(ps[0]) ? '(?<![0-9]\\.)' : '') + '(' + body + ')' + tail, 'gi');
  }
  // a query that holds a bare number ("regulation 7", "table 2") is matched as a phrase, so the number counts
  const qPhrase = s => { const t = qToks(s); return t.length > 1 && t.some(x => /^\d+$/.test(x)) ? t : null; };
  const phraseRe = t => new RegExp('(^|[^A-Za-z0-9])(' + t.map(x => /^\d+$/.test(x) ? x + '(?![0-9])' : wPat(x)).join('[^A-Za-z0-9]+') + ')', 'gi');
  const wordRe = ws => ws.length ? new RegExp('(^|[^A-Za-z0-9])(' + ws.map(wPat).join('|') + ')', 'gi') : null;
  function hlText(s, re, rg) {
    s = String(s || ''); const br = x => esc(x).replace(/\n/g, '<br>');
    if (rg) return br(s.slice(0, rg[0])) + '<mark class="fq">' + br(s.slice(rg[0], rg[1])) + '</mark>' + br(s.slice(rg[1]));
    if (!re) return br(s);
    let out = '', last = 0, m; re.lastIndex = 0;
    while ((m = re.exec(s))) { const st = m.index + m[1].length; out += br(s.slice(last, st)) + '<mark>' + br(m[2]) + '</mark>'; last = st + m[2].length; if (!m[0].length) re.lastIndex++; }
    return out + br(s.slice(last));
  }

  // ---- the Approved Document reader ----
  // contents pages (5 or more lines ending in a page number, found at build time) give no section context and no back-links
  const CPS = {}; FTM.docs.forEach(d => { CPS[d.slug] = new Set(d.cp || []); });
  const isCP = (slug, b) => b.pg <= 2 || CPS[slug].has(b.pg);
  function adPrep(d, slug) {
    if (d._hd) return; let last = ''; d._hd = []; d._ix = new Map();
    d.b.forEach((b, j) => { d._ix.set(String(b.i), j); if (b.t === 'h' && !b.rh && !isCP(slug, b)) last = b.x; d._hd.push(last); });
  }
  const reqOfHead = x => { const m = /^Requirements?\s+([A-Z]\d+(?:\.\d)?(?:\(\d\))?)/.exec(x || ''); return m && FTM.reqs && Object.values(FTM.reqs).flat().find(r => r[1] === m[1]); };
  // a quote's place in a table: the cells in the order the reader shows them, joined; each cell gets its own part of the range (V4C-05)
  const tabParts = b => [b.cap || '', ...(b.rows || []).filter(r => r.some(Boolean)).flatMap(r => r), ...(b.lines || [])];
  function partRanges(parts, rg) {
    if (!rg) return null; const out = new Map(); let off = 0;
    parts.forEach((x, k) => { const s0 = off, e0 = off + String(x || '').length; if (rg[0] < e0 && rg[1] > s0) out.set(k, [Math.max(0, rg[0] - s0), Math.min(e0, rg[1]) - s0]); off = e0 + 1; });
    return out;
  }
  function adBlock(slug, d, b, o) {
    const k = String(b.i), url = d.s.url, hit = o.key === k, re = hit || o.all ? o.re : null;
    const ext = o.qx && o.qx.get(k), rg = ext || (hit && o.q && b.t !== 'table' ? qRange(b.x, o.q) : null);
    const tp = b.t === 'table' && hit && o.q ? partRanges(tabParts(b), qRange(tabParts(b).join(' '), o.q)) : null;
    let ci = 0; const tc = x => { const r = tp && tp.get(ci); ci++; return hlText(x, r ? null : re, r || null); };
    const t = x => hlText(x, re, null), pg = `<span class="fpg">${b.pgs && b.pgs.length > 1 ? `pp. ${b.pgs[0]}-${b.pgs[b.pgs.length - 1]}` : `p. ${b.pg}`}</span>`;
    let h = '';
    if (b.t === 'h') {
      const lv = Math.min(4, Math.max(1, b.lv || 3)), r = !isCP(slug, b) && reqOfHead(b.x);
      h = `<h${lv + 2} class="fh">${hlText(b.x, re, rg)}</h${lv + 2}>` + (r ? `<button type="button" class="ftl" data-fa="open" data-fd="br2010" data-fk="${esc(r[0])}">Requirement ${esc(r[1])} in the Regulations ›</button>` : '');
    } else if (b.t === 'p') h = `<p>${b.n ? `<b class="fn">${esc(b.n)}</b> ` : ''}${hlText(b.x, re, rg)}</p>`;
    else if (b.t === 'li') h = `<p class="fli${/^\(?[ivx]+[.)]/.test(b.m || '') ? ' l2' : ''}"><span class="fm">${esc(b.m || '•')}</span><span>${hlText(b.x, re, rg)}</span></p>`;
    else if (b.t === 'note') h = `<p class="fnote">${hlText(b.x, re, rg)}</p>`;
    else if (b.t === 'table') {
      const cap = `<figcaption>${b.cap ? tc(b.cap) : (ci++, 'Table')}</figcaption>`;
      if (b.rows && b.rows.length) {
        const cols = b.rows.reduce((m, r) => Math.max(m, r.length), 0), keep = [...Array(cols).keys()].filter(c => b.rows.some(r => r[c]));
        const rows = b.rows.filter(r => r.some(Boolean));
        h = `<figure class="ftb">${cap}<div class="ftw" tabindex="0" role="region" aria-label="${esc(b.cap || 'Table')}, page ${b.pg}"><table>${rows.map(r => { const base = ci; const cells = keep.map(c => { ci = base + c; return `<td>${tc(r[c] || '')}</td>`; }).join(''); ci = base + r.length; return `<tr>${cells}</tr>`; }).join('')}</table></div>`
          + (b.see_pdf ? `<p class="fsp">Cells as the extraction read them; check the layout on ${pageLink(url, b.pg)}</p>` : '') + `</figure>`;
      } else if (b.lines && b.lines.length) h = `<figure class="ftb">${cap}<p class="fsp">This table is not ruled in the PDF, so its text is shown in reading order, not as cells. See the table on ${pageLink(url, b.pg)}</p><div class="ftl">${b.lines.map(tc).join('<br>')}</div></figure>`;
      else h = `<figure class="ftb">${cap}<p class="fsp">Shown as its caption only. See the table on ${pageLink(url, b.pg)}</p></figure>`;
    } else if (b.t === 'diagram') h = `<figure class="fdg"><figcaption>${t(b.cap || (b.k || 'Diagram') + ' ' + (b.n || ''))}</figcaption><p class="fsp">Diagrams are not reproduced here. See it on ${pageLink(url, b.pg)}</p></figure>`;
    else h = `<p>${t(b.x)}</p>`;
    const fx = (b.fx ? `<span class="ffx">${esc(b.fx)}</span>` : '') + (b.qm ? `<span class="ffx">A symbol here is not stored as text in the PDF (shown as ${/\ufffd/.test(blockText(b)) ? '�' : 'a box'}); see ${pageLink(url, b.pg)}.</span>` : '');
    return `<div class="fb fb-${b.t}${hit ? ' fhit' : ''}${ext ? ' fhit2' : ''}${b.y29 === 'from' ? ' f29' : ''}" id="fb-${slug}-${esc(k)}" data-k="${esc(k)}">${h}${pg}${fx}</div>`;
  }
  function srcBox(kind, title, ed, body) { return `<div class="fsrc"><div class="fsk">${kind}</div><b>${esc(title)}</b>${ed ? `<span class="fse">${esc(ed)}</span>` : ''}${body}</div>`; }
  const OGL = u => `Contains public sector information licensed under the <a href="${esc(u || 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/')}" target="_blank" rel="noopener">Open Government Licence v3.0</a>.`;
  function y29Runs(ps) { const r = []; ps.forEach(p => { const l = r[r.length - 1]; if (l && p === l[1] + 1) l[1] = p; else r.push([p, p]); }); return r.map(x => x[0] === x[1] ? x[0] : `${x[0]}-${x[1]}`).join(', '); }
  function quoteRun(d, key, q) { // [block key -> range] for the blocks after the hit block that carry on the quote
    const out = new Map(), j0 = d._ix.get(String(key)); if (j0 == null || !q) return out;
    const qq = normIx(String(q).replace(/^[\s….]+|[\s….]+$/g, '')).t, b0 = d.b[j0], a0 = normIx(blockText(b0)).t;
    let p = a0.indexOf(qq.slice(0, 30)); if (p < 0) return out; let rest = qq.slice(Math.max(0, a0.length - p));
    for (let j = j0 + 1; j < d.b.length && j < j0 + 8 && rest.length >= 6; j++) {
      const b = d.b[j]; if (b.rh || b.fu) continue; if (b.t === 'table' || b.t === 'diagram' || !b.x) break;
      const a = normIx(b.x); const k = Math.min(a.t.length, rest.length); let n = 0; while (n < k && a.t[n] === rest[n]) n++;
      if (n < Math.min(6, k)) break;
      out.set(String(b.i), [0, a.m[n - 1] + 1]); rest = rest.slice(n); if (n < a.t.length) break;
    }
    return out;
  }
  function adHtml(slug, d, o) {
    adPrep(d, slug); const m = DOC[slug]; if (o.q && o.key) o.qx = quoteRun(d, o.key, o.q);
    let h = srcBox('Full text · Approved Document', m.title, m.edition,
      `<p>Source: ${pageLink(m.url, 1, `GOV.UK PDF, ${m.pages} pages`)}. Crown copyright. ${OGL(m.lic)}</p>`
      + `<p class="fwarn">Extracted from the PDF by this site and checked against a second, independent extraction (${m.cov}% of its characters match). The GOV.UK PDF is the official version. Diagrams, and tables that are not ruled, are given as their caption with a link to the PDF page. Every block shows its PDF page. Read the PDF before relying on the text. England only. No British Standard text is reproduced.</p>`
      + (m.lig && (m.lig.fixed || m.lig.left) ? `<p class="fwarn">This PDF's text layer loses some "fi", "fl" and "ff" letters (it stores "fire" as "fre").${m.lig.fixed ? ` ${m.lig.fixed.toLocaleString('en-GB')} such words are repaired here from the PDF's own glyphs.` : ''}${m.lig.left ? ' Some, where the PDF gives no glyph evidence, are shown as stored; search finds them either way.' : ''}</p>` : '')
      + (m.y29 && m.y29.length ? `<p class="fwarn f29w"><b>2029 text.</b> This PDF also prints the text that takes effect on 2 September 2029 (PDF pp. ${y29Runs(m.y29)}). Those pages are marked “2029 text, in force from 2 September 2029”; the pages it will replace are marked “In force until 1 September 2029”.</p>` : ''));
    const sc = FTM.adPart[m.code] || [];
    if (sc.length) h += `<p class="fgo">Gives guidance on ${sc.map(s => `<button type="button" class="ftl" data-fa="open" data-fd="br2010" data-fk="${esc(s)}">${s === 'reg-7' ? 'regulation 7' : 'Part ' + esc(s.slice(9)) + ' of Schedule 1'} in the Regulations ›</button>`).join(' ')}</p>`;
    let toc = d.b.filter(b => b.t === 'h' && !b.rh && !b.fu && (b.lv || 3) <= 2 && !isCP(slug, b) && b.x.length < 140);
    if (toc.length > 120) toc = toc.filter(b => (b.lv || 3) <= 1);
    h += bar(slug, o, toc.length) + (toc.length ? `<nav class="ftoc" id="ftoc" hidden aria-label="Contents of ${esc(m.code)}"><ol>${toc.map(b => `<li class="l${b.lv || 1}"><button type="button" data-fa="jump" data-fk="${esc(String(b.i))}">${esc(b.x)}</button> <span>p. ${b.pg}</span></li>`).join('')}</ol></nav>` : '');
    let pg = 0; h += `<article class="fart" aria-label="Full text of ${esc(m.code)}">`;
    const RH = new Map(); d.b.forEach(b => { if (b.rh && !RH.has(b.pg)) RH.set(b.pg, b.x); });
    for (const b of d.b) {
      if (b.pg !== pg) {
        pg = b.pg; const st = b.y29 === 'from' ? `<span class="f29c">2029 text, in force from 2 September 2029</span>` : b.y29 === 'until' ? `<span class="f29u">In force until 1 September 2029</span>` : '';
        h += `<div class="fpb">${pageLink(m.url, pg, `PDF page ${pg}${b.pp ? ` (printed page ${esc(b.pp)})` : ''}`)}${RH.has(pg) ? `<span class="frh">${esc(RH.get(pg))}</span>` : ''}${st}</div>`;
      }
      if (b.rh || b.fu) continue;  // a running head is shown in the page bar; furniture (barcode digits, empty numbered lines) is left out
      h += adBlock(slug, d, b, o);
    }
    return h + `</article>` + srcBox('Source and licence', m.title, m.edition, `<p>${pageLink(m.url, 1, 'GOV.UK PDF')}. ${OGL(m.lic)}</p>`);
  }
  function bar(doc, o, toc) {
    return `<div class="fbar" role="toolbar" aria-label="Reader">`
      + `<button type="button" class="v2btn" data-fa="links">‹ Links</button>`
      + (FT.last ? `<button type="button" class="v2btn" data-fa="results">‹ Results</button>` : '')
      + (toc ? `<button type="button" class="v2btn" data-fa="toc" aria-expanded="false" aria-controls="ftoc">Contents</button>` : '')
      + `<button type="button" class="v2btn" data-fa="find" data-fd="${esc(doc)}">Search in this text</button></div>`;
  }

  // ---- the Building Regulations 2010 reader (England text) ----
  function brPrep(d) {
    if (d._P) return; const P = new Map(), L = new Map(), en = new Set(d.x.eng);
    d.p.forEach((x, k) => { x._o = k; x._en = en.has(x.id); P.set(x.id, x); });
    d.l.forEach((l, i) => { l._i = i; if (!L.has(l.p)) L.set(l.p, []); L.get(l.p).push(l); });
    // QA v2-R6a V6AD-03: lines are shown in source order. A provision's lines that come after its first shown child in the source
    // (the closing words after a list: reg 4(2) "that work need only comply ...") are its tail, shown right after the child they follow.
    const K = new Map(); d.p.forEach(x => { if (!K.has(x.parent)) K.set(x.parent, []); K.get(x.parent).push(x); });
    const shown = l => l.t && l.x !== 'W';
    const fi = x => { if (x._fi !== undefined) return x._fi; let m = Infinity; if (x._en) (L.get(x.id) || []).forEach(l => { if (shown(l)) m = Math.min(m, l._i); }); (K.get(x.id) || []).forEach(c => { m = Math.min(m, fi(c)); }); return (x._fi = m); };
    const fa = x => { if (x._fa !== undefined) return x._fa; let m = Infinity; (L.get(x.id) || []).forEach(l => { m = Math.min(m, l._i); }); (K.get(x.id) || []).forEach(c => { m = Math.min(m, fa(c)); }); return (x._fa = m); };
    let nx = Infinity; for (let k = d.p.length - 1; k >= 0; k--) { const x = d.p[k]; x._pos = Math.min(fa(x), nx); nx = x._pos; }  // where x starts in the source
    d.p.forEach(x => { const cf = Math.min(Infinity, ...(K.get(x.id) || []).map(fi)), own = L.get(x.id) || [];
      x._lead = own.filter(l => !(shown(l) && l._i > cf)); x._tail = own.filter(l => shown(l) && l._i > cf); });
    const TOPT = new Set(['regulation', 'requirement', 'schedule-part', 'schedule', 'part', 'introduction', 'explanatory-note']);
    const NT = new Map(); d.p.forEach(x => { if (!x._en || !x.notes) return; let y = x; while (y && !TOPT.has(y.type)) y = P.get(y.parent); if (!y) return; if (!NT.has(y.id)) NT.set(y.id, new Set()); x.notes.forEach(k => NT.get(y.id).add(k)); });
    d._P = P; d._L = L; d._NT = NT;
  }
  const brUp = (d, id, f) => { let x = d._P.get(id); while (x) { if (f(x)) return x; x = d._P.get(x.parent); } return null; };
  function brScope(d, id) { const s = brUp(d, id, x => x.id === 'reg-7' || /^sch1-part[A-Z]$/.test(x.id)); return s && (s.id === 'reg-7' || NBYC.get('Part ' + s.id.slice(9))) ? s.id : 'si'; }
  const scopeNode = sc => sc === 'si' ? NBYC.get('SI 2010/2214') : sc === 'reg-7' ? NBYC.get('Reg 7') : NBYC.get('Part ' + sc.slice(9));
  const brScopeOfNode = n => n.c === 'SI 2010/2214' ? 'si' : n.c === 'Reg 7' ? 'reg-7' : n.k === 'part' && /^Part [A-Z]$/.test(n.c) ? 'sch1-part' + n.c.slice(5) : null;
  function effHtml(x) {
    const es = x.effects || []; if (!es.length) return ''; const en = es.filter(e => e.applies_to !== 'W'), w = es.length - en.length;
    const fi = e => (e.in_force || []).map(f => `${fmtD(f.date)}${f.qualification ? ` (${esc(f.qualification)})` : ''}`).join('; ');
    return (en.length ? `<div class="beff"><b>Not yet applied</b> legislation.gov.uk lists ${en.length === 1 ? 'a change' : en.length + ' changes'} to this provision that ${en.length === 1 ? 'is' : 'are'} not yet applied to the text shown here:<ul>`
      + en.map(e => `<li>${esc(String(e.type || '').replace(/^./, c => c.toUpperCase()))} (${esc(e.affected || '')}) by ${e.by_uri ? `<a href="${esc(e.by_uri)}" target="_blank" rel="noopener">${esc(e.by)} ↗</a>` : esc(e.by)}${fi(e) ? `; in force ${fi(e)}` : ''}${e.savings && e.savings.length ? `; subject to savings (${esc(e.savings.join(', '))})` : ''}</li>`).join('') + `</ul></div>` : '')
      + (w ? `<p class="bwl">Plus ${w} listed change${w > 1 ? 's' : ''} for Wales only, not shown (this map covers England).</p>` : '');
  }
  // QA v2-R4 V4D-01: a line that applies only in Wales (x: 'W', from legislation.gov.uk's markings) is left out; a line with words for
  // Wales only shows its England text (te); a line with Wales wording legislation.gov.uk gives no England words for is shown and says so
  const WNOTE = n => `<p class="bwl">${n === 1 ? 'A line that applies' : n + ' lines that apply'} only in Wales ${n === 1 ? 'is' : 'are'} left out here (legislation.gov.uk prints the England and Wales wording side by side).</p>`;
  const lineText = (l, t) => t(l.te || l.t) + (l.te ? ` <span class="bwx">(words that apply only in Wales left out)</span>` : '') + (l.wv ? ` <span class="bwx">(this line includes wording substituted for Wales only; legislation.gov.uk does not give the England words here: check the official text)</span>` : '');
  function brLines(d, x, re, hit, run) {
    const all = d._L.get(x.id) || [], ls = (run || x._lead || all).filter(l => l.x !== 'W'), nw = run ? 0 : all.filter(l => l.x === 'W').length; let h = '', rows = [];
    const t = s => hlText(s, hit ? re : null, null);
    const flush = () => { if (rows.length) { h += `<div class="ftw" tabindex="0" role="region" aria-label="Table"><table>${rows.map(r => `<tr>${(r.c || [r.t]).map(c => `<td>${t(c)}</td>`).join('')}</tr>`).join('')}</table></div>`; rows = []; } };
    ls.forEach(l => { if (l.r === 'row') { rows.push(l); return; } flush(); h += `<p class="bl" style="--d:${Math.min(5, Math.max(0, (l.l || 1) - 1))}">${l.n ? `<b>${esc(l.n)}</b> ` : ''}${lineText(l, t)}</p>`; });
    flush(); return h + (nw ? WNOTE(nw) : '');
  }
  function brItem(d, x, o) {
    const hit = o.key === x.id, re = o.re, id = `br-${esc(x.id)}`, cls = hit ? ' fhit' : '', lab = d.x.lab[x.id] || x.id;
    const lg = `<a class="blg" href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${esc(lab)} on legislation.gov.uk">legislation.gov.uk ↗</a>`;
    const st = x.status ? `<span class="bst">${esc(x.status)}</span>` : '', alt = x.alt ? `<p class="bwl">A different version applies in Wales; the England text is shown.</p>` : '';
    const nt = d._NT.get(x.id), notes = nt && nt.size ? `<details class="bnotes"><summary>Annotations from legislation.gov.uk (${nt.size})</summary><ul>${[...nt].filter(k => d.a[k]).map(k => `<li>${esc(d.a[k])}</li>`).join('')}</ul></details>` : '';
    const hd = s => hlText(s || '', hit ? re : null, null);
    if (x.type === 'regulation') return `<div class="breg${cls}" id="${id}" tabindex="-1"><h5><span class="brn">Regulation ${esc(x.num || '')}</span> ${hd(x.heading)} ${st}</h5>${alt}${brLines(d, x, re, hit)}${effHtml(x)}<div class="bmeta">${lg}</div>${notes}</div>`;
    if (x.type === 'requirement') {
      const la = d._L.get(x.id) || [], ls = (x._lead || la).filter(l => l.x !== 'W'), rq = ls.filter(l => l.r !== 'lim'), lim = ls.filter(l => l.r === 'lim'), t = s => hlText(s, hit ? re : null, null);
      const gd = (FTM.reqt[x.id] || []).map(g => `<button type="button" class="ftl" data-fa="open" data-fd="${esc(g[0])}" data-fk="${esc(g[1])}">${esc(DOC[g[0]].code)}: ${g[3] === 'heading' ? `its section on requirement ${esc(x.num)}` : g[3] === 'performance' ? `where it says how ${esc(x.num)} is met` : g[3] === 'reprint' ? `where it prints requirement ${esc(x.num)}` : `where it names requirement ${esc(x.num)}`} (PDF p. ${g[2]}) ›</button>`).join('');
      const part = brUp(d, x.id, y => y.type === 'schedule-part'), ads = Object.keys(FTM.adPart).filter(c => part && FTM.adPart[c].includes(part.id));
      return `<div class="breq${cls}" id="${id}" tabindex="-1"><h5><span class="brn">${esc(x.num)}</span> ${hd(x.heading)} ${st}</h5>${alt}`
        + `<div class="brq"><div class="brk">Requirement</div>${rq.map(l => `<p class="bl">${lineText(l, t)}</p>`).join('')}</div>`
        + (lim.length ? `<div class="brq lim"><div class="brk">Limits on application</div>${lim.map(l => `<p class="bl">${l.n ? `<b>(${esc(l.n)})</b> ` : ''}${lineText(l, t)}</p>`).join('')}</div>` : '') + (la.some(l => l.x === 'W') ? WNOTE(la.filter(l => l.x === 'W').length) : '')
        + effHtml(x) + `<div class="bgd"><b>Statutory guidance on ${esc(x.num)}</b>${gd || (ads.length ? ads.map(c => `<button type="button" class="ftl" data-fa="read" data-fd="${esc(DOC[DOCC[c].slug].slug)}">${esc(c)} (no section names ${esc(x.num)}; opens at the start) ›</button>`).join('') : '<span>None in the map.</span>')}</div>`
        + `<div class="bmeta">${lg}</div>${notes}</div>`;
    }
    if (['part', 'chapter', 'schedule', 'schedule-part', 'pblock', 'introduction', 'explanatory-note'].includes(x.type))
      return `<div class="bhd bh-${x.type}${cls}" id="${id}" tabindex="-1"><h4>${x.num ? `<span class="brn">${esc(x.num)}</span> ` : ''}${hd(x.heading)} ${st}</h4>${x.ref ? `<p class="bref">${esc(x.ref)}</p>` : ''}${alt}${brLines(d, x, re, hit)}${effHtml(x)}${['schedule', 'schedule-part', 'part'].includes(x.type) ? `<div class="bmeta">${lg}</div>` : ''}${notes}</div>`;
    return `<div class="bpv${cls}" id="${id}" tabindex="-1">${alt}${brLines(d, x, re, hit)}${effHtml(x)}${notes}</div>`;
  }
  function brHtml(d, scope, o) {
    brPrep(d); const B = FTM.br, root = scope === 'si' ? null : d._P.get(scope);
    let h = srcBox('Full text · Building Regulations 2010', B.title, `Revised version valid from ${fmtD(B.valid)}, fetched ${fmtD(B.fetched)}`,
      `<p>Source: <a href="${esc(B.url)}" target="_blank" rel="noopener">legislation.gov.uk ↗</a> (The National Archives). Crown copyright. ${OGL(B.lic)}</p>`
      + `<p class="fwarn">England text only. legislation.gov.uk prints the England and Wales wording side by side; following its own markings of what was made for England and what for Wales, this reader leaves out ${B.wtop} provisions that apply only in Wales (each counted once with everything under it, for example Part 2B with the Welsh dutyholder regulations 11R to 11Z8, and requirement G2A), the Wales versions of ${B.walt} provisions whose England version is shown, and ${B.wlines} Wales-only lines inside provisions that apply in England, and shows the England wording where the two differ inside a line. Changes that legislation.gov.uk lists as not yet applied are flagged where they fall, and are not applied. Every line was checked against legislation.gov.uk's own rendition. Not legal advice; check the official text.</p>`);
    if (scope !== 'si') h += `<p class="fgo"><button type="button" class="ftl" data-fa="read" data-fd="br2010" data-fs="si">The whole of the Building Regulations 2010 ›</button></p>`;
    const inS = x => !root || x === root || !!brUp(d, x.parent, y => y === root);
    const units = d.p.filter(x => x._en && inS(x) && ['part', 'schedule', 'schedule-part', 'requirement', 'regulation'].includes(x.type) && (scope !== 'si' || ['part', 'schedule'].includes(x.type)));
    h += bar('br2010', o, units.length > 1) + (units.length > 1 ? `<nav class="ftoc" id="ftoc" hidden aria-label="Contents"><ol>${units.map(x => `<li class="l${['part', 'schedule', 'schedule-part'].includes(x.type) ? 1 : 2}"><button type="button" data-fa="jump" data-fk="${esc(x.id)}">${esc((x.num ? x.num + ' ' : '') + (x.heading || ''))}</button></li>`).join('')}</ol></nav>` : '');
    h += `<article class="fart fbr" aria-label="Full text of ${esc(root ? (d.x.lab[root.id] || root.id) : 'the Building Regulations 2010')}">`;
    let wn = null, pend = [];
    const tailHtml = upTo => {  // tail lines (of provisions already shown) that come before position upTo, in source order, one block per owner run
      const now = pend.filter(l => l._i < upTo).sort((a, b) => a._i - b._i); pend = pend.filter(l => l._i >= upTo); let out = '';
      for (let j = 0; j < now.length;) { const ow = now[j].p; let e = j; while (e < now.length && now[e].p === ow) e++; const run = now.slice(j, e), y = d._P.get(ow), hit = o.key === ow, t = s => hlText(s, hit ? o.re : null, null);
        out += y.type === 'requirement' ? `<div class="breq btl" data-of="${esc(ow)}"><div class="brq${run.every(l => l.r === 'lim') ? ' lim' : ''}">${run.every(l => l.r === 'lim') ? '<div class="brk">Limits on application</div>' : ''}${run.map(l => `<p class="bl">${l.n ? `<b>(${esc(l.n)})</b> ` : ''}${lineText(l, t)}</p>`).join('')}</div></div>`
          : `<div class="bpv btl" data-of="${esc(ow)}">${brLines(d, y, o.re, hit, run)}</div>`; j = e; }
      return out; };
    for (let k = root ? root._o : 0; k < d.p.length; k++) {
      const x = d.p[k]; if (!inS(x)) { if (root) break; else continue; }
      if (x.type === 'instrument') continue;
      if (pend.length) h += tailHtml(x._pos);
      if (!x._en) { if (!x.id.includes('@') && x.parent !== wn && d._P.get(x.parent) && d._P.get(x.parent)._en) { wn = x.parent; h += `<p class="bwl">Text that applies only in Wales is left out here.</p>`; } continue; }
      h += brItem(d, x, o); if (x._tail && x._tail.length) pend.push(...x._tail);
    }
    h += tailHtml(Infinity);
    return h + `</article>` + srcBox('Source and licence', B.title, `Revised version valid from ${fmtD(B.valid)}`, `<p><a href="${esc(B.url)}" target="_blank" rel="noopener">legislation.gov.uk ↗</a>. ${OGL(B.lic)}</p>`);
  }

  // ---- land a block under the sticky toolbar. The reader's blocks lay out lazily (content-visibility), so the first scroll can land
  // short: it is repeated over the next frames until the block stays put, unless the visitor scrolls first (QA v2-R4 V4C-04) ----
  function barH() { const b = $('pbody').querySelector('.fbar'), h = b ? b.offsetHeight : 0; $('pbody').style.setProperty('--fbarh', (h + 8) + 'px'); return h + 8; }
  let landSeq = 0;
  function ftLand(el) {
    const my = ++landSeq, pb = $('pbody'), t0 = performance.now(); let moved = false, still = 0, n = 0, ro = null;
    const stop = () => { moved = true; if (ro) ro.disconnect(); };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(ev => pb.addEventListener(ev, stop, { once: true, passive: true }));
    const fix = () => {
      if (moved || my !== landSeq || !el.isConnected) { if (ro) ro.disconnect(); return false; }
      const want = barH(), top = el.getBoundingClientRect().top - pb.getBoundingClientRect().top;
      if (Math.abs(top - want) > 2) { pb.scrollTop += top - want; return true; } return false;
    };
    const go = () => { if (fix()) still = 0; else still++; if (still < 3 && ++n < 40) requestAnimationFrame(go); };
    barH(); el.scrollIntoView({ block: 'start', behavior: 'auto' }); requestAnimationFrame(go);
    // the sheet or the text above can still change size after that (phone sheet, lazily laid-out blocks): follow it for 4 s
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { if (performance.now() - t0 > 4000) { ro.disconnect(); return; } fix(); });
      const art = pb.querySelector('.fart'); if (art) ro.observe(art); ro.observe(pb); setTimeout(() => { if (ro) ro.disconnect(); }, 4000);
    }
  }

  // ---- open a reader on its map node, at a block, with the quote or the search words lit ----
  async function ftOpen(o) {
    const isBr = o.doc === 'br2010'; let node, scope = null;
    try {
      if (isBr) { const d = await ftLoad('br2010'); brPrep(d); scope = o.scope || brScope(d, o.key || 'si'); node = scopeNode(scope); }
      else node = DOC[o.doc] && NBYC.get(DOC[o.doc].code);
    } catch (e) { live('The text could not be loaded.'); return; }
    if (!node) return;
    if (S.sel !== node.i) select(node.i); else if (!$('panel').classList.contains('open')) Panel.node(node);
    const my = ++FT.seq; FT.cur = Object.assign({}, o, { node: node.i, scope });
    ftWide(true); if (narrow()) { Panel.setMini(false); $('panel').classList.add('full'); sheetVar(); }
    const m = isBr ? FTM.br : DOC[o.doc];
    $('pbody').innerHTML = `<p class="ftload" role="status">Loading the text of ${esc(isBr ? 'the Building Regulations 2010' : m.code)} (${m.kb} KB)…</p>`;
    let d; try { d = await ftLoad(isBr ? 'br2010' : o.doc); } catch (e) { $('pbody').innerHTML = `<p class="ftload">The text could not be loaded. ${isBr ? '' : pageLink(m.url, 1, 'Open the PDF on GOV.UK')}</p>`; return; }
    if (my !== FT.seq || S.sel !== node.i) return;
    const oo = { key: o.key != null ? String(o.key) : null, q: o.q || '', re: o.phrase ? phraseRe(o.phrase) : o.words && o.words.length ? wordRe(o.words) : null };
    $('pbody').innerHTML = isBr ? brHtml(d, scope, oo) : adHtml(o.doc, d, oo); $('pbody').scrollTop = 0; Panel.src(node);
    let where = '';
    if (oo.key) {
      const el = document.getElementById((isBr ? 'br-' : `fb-${o.doc}-`) + oo.key);
      if (el) {
        el.classList.add('fhit'); el.setAttribute('tabindex', '-1'); ftLand(el);
        setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { } }, 30);
        if (isBr) where = ` at ${d.x.lab[oo.key] || oo.key}`;
        else { const b = d.b[d._ix.get(oo.key)]; where = b ? ` at ${b.n ? 'paragraph ' + b.n : b.c ? 'a block under paragraph ' + b.c : 'page ' + b.pg}, PDF page ${b.pg}` : ''; }
      }
    } else { const t = $('pbody').querySelector('.fsrc'); if (t) { t.setAttribute('tabindex', '-1'); setTimeout(() => { try { t.focus({ preventScroll: true }); } catch (e) { } }, 30); } }
    live(`${isBr ? 'Building Regulations 2010' : m.code} full text opened${where}${o.q ? ($('pbody').querySelector('mark.fq') ? ', quote highlighted' : ', the block that names it is marked; the quote runs on beyond it, see the PDF page') : ''}.`); // QA v2-R5a V5AT-04: say highlighted only when it is
    hudClause(o, isBr ? 'BR 2010' : m.code, where);
  }

  // ---- full-text search: clause numbers, headings and captions, then every block of the documents that contain all the words ----
  const NUMQ = /^(?:(?:para(?:graph)?|clause|reg(?:ulation)?|requirement|req|schedule|sch)\.?\s*)?([A-Z]{0,3}\d+(?:[A-Z]{1,2}\d*)?(?:\.\d+)*[a-z]?(?:\(\d+\))?)$/i; // 2.5, B1, K5.1, M4(2), 2A, 11Z7, B2.13
  const normNum = s => String(s || '').replace(/\s+/g, '').replace(/\.$/, '').toUpperCase();
  let WKF = null;
  // QA v2-R7a: the index lookup folds a lost ligature once ("fire" = "fre", "fill" = "fll"), not every i/l after an f ("fill" had become "f")
  const fold1 = w => String(w || '').toLowerCase().replace(/[ﬀ-ﬆ]/g, c => LIG[c] || c).replace(/[^a-z0-9]/g, '').replace(/f[il]/g, 'f');
  function wordMask(I, w) {
    if (!WKF) { WKF = new Map(); for (const [k, v] of Object.entries(I.w)) { const f = fold1(k); WKF.set(f, (WKF.get(f) || 0) | v); } WKF._k = [...WKF.keys()]; }
    const one = x => { const f = fold1(x); let m = 0; if (String(x).replace(/[^A-Za-z0-9]/g, '').length >= 4) { /* R7a: prefix by the typed length ("fill" folds to 3 letters) */ for (const k of WKF._k) if (k.startsWith(f)) m |= WKF.get(k); } else m = WKF.get(f) || 0; return m; };
    if (!/[-\u2010\u2011]/.test(w)) return one(w);
    const parts = w.split(/[-\u2010\u2011]/).filter(x => x.length >= 3 && !/^\d+$/.test(x));
    return one(w) | (parts.length ? parts.reduce((m, x) => m & one(x), (1 << I.docs.length) - 1) : (1 << I.docs.length) - 1);
  }
  function snip(s, re) {
    s = String(s || ''); re.lastIndex = 0; const m = re.exec(s), i = m ? m.index + m[1].length : 0;
    let a = Math.max(0, i - 70), z = Math.min(s.length, i + 150); if (a > 0) { const sp = s.indexOf(' ', a); if (sp > 0 && sp < i) a = sp + 1; } if (z < s.length) { const sp = s.lastIndexOf(' ', z); if (sp > i) z = sp; }
    return (a > 0 ? '… ' : '') + hlText(s.slice(a, z).replace(/\n/g, ' '), re, null) + (z < s.length ? ' …' : '');
  }
  async function ftRun(qs, only) {
    const my = ++FT.seq, st = $('ftst'), out = $('ftres'); if (!st || !out) return;
    // QA v2-R5a V5AT-09: a pasted soft hyphen or an en dash inside a word is read as a hyphen ("fire\u00adresisting", "fire\u2013resisting")
    const raw = String(qs || '').replace(/(?<=[A-Za-z0-9])[\u00ad\u2012\u2013](?=[A-Za-z0-9])/g, '-').replace(/\u00ad/g, '').trim(); FT.last = { q: raw, only: only || '' }; if (raw) hudLog('text', raw, only);
    if (!raw) { out.innerHTML = ftIntro(); st.textContent = ''; return; }
    st.textContent = 'Loading the search index…'; out.innerHTML = '';
    let I; try { I = await ftLoad('index'); } catch (e) { st.textContent = 'The search index could not be loaded.'; return; }
    if (my !== FT.seq) return;
    const oi = only ? I.docs.indexOf(only) : -1, inD = k => oi < 0 || k === oi;
    const nm = NUMQ.exec(raw), nq = nm ? normNum(nm[1]) : null, brOnly = /^(?:reg(?:ulation)?|requirement|req|schedule|sch)\b/i.test(raw);
    const BRK = I.docs.indexOf('br2010'), isBr = x => x[0] === BRK;
    let num = nq ? I.h.filter(x => inD(x[0]) && x[2] && normNum(x[2]) === nq && (!brOnly || isBr(x))) : [];
    // "B1 2.5": paragraph 2.5 of the Approved Documents that give guidance on requirement B1 (and the requirement itself)
    const cm = !nq && /^([A-Z]{1,2}\d+(?:\.\d)?(?:\(\d\))?)\s*[,;]?\s+((?:[A-Z]{0,2}\d+(?:\.\d+)+|[A-Z]\d+)[a-z]?)$/i.exec(raw);
    let comb = null;
    if (cm) {
      const rq = Object.values(FTM.reqs).flat().find(r => normNum(r[1]) === normNum(cm[1]));
      if (rq) {
        const part = Object.keys(FTM.reqs).find(k => FTM.reqs[k].includes(rq)), sl = new Set((FTM.reqt[rq[0]] || []).map(g => g[0]));
        Object.keys(FTM.adPart).forEach(c => { if (FTM.adPart[c].includes(part) && DOCC[c]) sl.add(DOCC[c].slug); });
        const ks = new Set([...sl].map(x => I.docs.indexOf(x))), n2 = normNum(cm[2]);
        num = I.h.filter(x => (isBr(x) && x[1] === rq[0]) || (ks.has(x[0]) && inD(x[0]) && x[2] && normNum(x[2]) === n2));
        comb = { req: rq[1], para: cm[2], docs: [...sl].map(x => DOC[x].code) };
      }
    }
    num = num.sort((a, b) => isBr(b) - isBr(a)).slice(0, 60);  // the Regulations first, then the documents in index order
    const ph = raw.toLowerCase(), heads = ph.length >= 3 && !nq && !comb ? I.h.filter(x => inD(x[0]) && String(x[3]).toLowerCase().includes(ph)).slice(0, 80) : [];
    const ws = comb ? [] : qWords(raw), cs = comb ? [] : qCodes(raw), pq = comb || !cs.length ? null : qToks(raw); let mask = (1 << I.docs.length) - 1; ws.forEach(w => { mask &= wordMask(I, w); });
    cs.forEach(c => { mask &= (I.c && I.c[c]) || 0; });
    const cand = ws.length || cs.length ? I.docs.map((s, k) => k).filter(k => inD(k) && (mask & (1 << k))) : [];
    let done = 0; st.textContent = cand.length ? `Searching ${cand.length} document${cand.length > 1 ? 's' : ''}…` : '';
    const re = pq ? codeRe(raw) : wordRe(ws), res = [], wres = ws.map(w => new RegExp('(^|[^A-Za-z0-9])' + wPat(w), 'i')), pre = pq ? codeRe(raw) : null;
    const all = s => wres.every(r => r.test(s)) && (!pre || (pre.lastIndex = 0, pre.test(s)));
    try {
      await Promise.all(cand.map(k => ftLoad(I.docs[k]).then(d => {
        if (my !== FT.seq) return; done++; st.textContent = `Searching… ${done} of ${cand.length} documents read`;
        const sl = I.docs[k], g = { k, slug: sl, rows: [] };
        if (sl === 'br2010') { brPrep(d); d.p.forEach(x => { if (!x._en) return; const t = [x.heading || '', ...(d._L.get(x.id) || []).filter(l => l.x !== 'W').map(l => l.te || l.t)].join(' '); if (t.trim() && all(t)) g.rows.push({ key: x.id, t, lab: d.x.lab[x.id] || x.id }); }); }
        else { adPrep(d, sl); d.b.forEach((b, j) => { if (b.rh || b.fu) return; const t = blockText(b); if (t && all(t)) g.rows.push({ key: String(b.i), t, b, hd: d._hd[j] }); }); }
        if (g.rows.length) { const p = ph.length > 4 && ws.length > 1; if (p) g.rows.sort((a, b) => (b.t.toLowerCase().includes(ph) - a.t.toLowerCase().includes(ph))); res.push(g); }
      })));
    } catch (e) { st.textContent = 'Some documents could not be loaded.'; }
    if (my !== FT.seq) return;
    res.sort((a, b) => (b.slug === 'br2010') - (a.slug === 'br2010') || b.rows.length - a.rows.length);
    FT.res = { re, res, I, ws, pq };
    const tot = res.reduce((s, g) => s + g.rows.length, 0);
    let h = '';
    const docName = k => I.docs[k] === 'br2010' ? 'Building Regulations 2010' : DOC[I.docs[k]].code;
    const hrow = x => `<li><button type="button" class="frr" data-fa="open" data-fd="${esc(I.docs[x[0]])}" data-fk="${esc(x[1])}"><span class="frd">${esc(docName(x[0]))}</span><span class="frn">${esc(x[2] || '')}</span><span class="frs">${hlText(x[3], null, null)}</span><span class="frp">${I.docs[x[0]] === 'br2010' ? esc(x[4] || '') : 'PDF p. ' + esc(x[4])}</span>${x[5] ? Y29C : ''}</button></li>`;
    if (num.length) h += `<section class="frg"><h5>${comb ? `Paragraph ${esc(comb.para)} of the guidance on ${esc(comb.req)}` : 'Clause and provision numbers'} <span class="n">${num.length}</span></h5><ul>${num.map(hrow).join('')}</ul></section>`;
    if (heads.length) h += `<section class="frg"><h5>Headings and captions <span class="n">${heads.length}${heads.length === 80 ? '+' : ''}</span></h5><ul>${heads.slice(0, 12).map(hrow).join('')}</ul>${heads.length > 12 ? `<button type="button" class="more" data-fa="hmore">Show all ${heads.length}</button><ul class="fhm" hidden>${heads.slice(12).map(hrow).join('')}</ul>` : ''}</section>`;
    res.forEach((g, gi) => { h += `<section class="frg"><h5>${esc(docName(g.k))} <span class="n">${g.rows.length}</span></h5><ul id="frg${gi}">${g.rows.slice(0, 5).map(r => ftRow(g, r)).join('')}</ul>${g.rows.length > 5 ? `<button type="button" class="more" data-fa="more" data-g="${gi}">Show all ${g.rows.length} in ${esc(docName(g.k))}</button>` : ''}</section>`; });
    if (!h) h = `<p class="note">Nothing found for “${esc(raw)}”${only ? ` in ${esc(only === 'br2010' ? 'the Building Regulations 2010' : DOC[only].code)}` : ''}. Try fewer words, a clause number (2.5, B1, regulation 7) or another spelling.</p>`;
    out.innerHTML = h;
    const sp = [];
    if (ws.length || pq) sp.push(`${tot} block${tot === 1 ? '' : 's'} of text contain${tot === 1 ? 's' : ''} ${pq ? 'the words ' : ws.length > 1 ? 'all of ' : ''}“${raw}”${res.length ? ` in ${res.length} document${res.length > 1 ? 's' : ''}` : ''}`);
    if (num.length) sp.push(comb ? `${num.length} match${num.length > 1 ? 'es' : ''} for paragraph ${comb.para} in the guidance on ${comb.req} (${comb.docs.join(', ')})` : `${num.length} numbered match${num.length > 1 ? 'es' : ''} for “${brOnly ? raw : nq}”${brOnly ? ' in the Regulations' : ''}`);
    if (heads.length) sp.push(`${heads.length}${heads.length === 80 ? '+' : ''} heading${heads.length > 1 ? 's' : ''}`);
    st.textContent = (sp.length ? sp.join('; ') : `Nothing found for “${raw}”`) + '.' + (res.some(g => g.rows.length > 5) ? ' Each document lists its first 5; “Show all” lists the rest.' : '');
    const lit = new Set(); res.forEach(g => { const n = g.slug === 'br2010' ? NBYC.get('SI 2010/2214') : NBYC.get(DOC[g.slug].code); if (n && n.vis) lit.add(n.i); });
    num.forEach(x => { const sl = I.docs[x[0]], n = sl === 'br2010' ? NBYC.get('SI 2010/2214') : DOC[sl] && NBYC.get(DOC[sl].code); if (n && n.vis) lit.add(n.i); });
    if (S.sel == null && !S.alert) setHi(lit, new Set());
  }
  function ftRow(g, r) {
    const { re } = FT.res, br = g.slug === 'br2010', b = r.b || {};
    const lab = br ? r.lab : b.n ? b.n : b.c ? `under ${b.c}` : '', ctx = br ? '' : (b.t === 'table' || b.t === 'diagram') ? (b.cap || '') : r.hd || '';
    return `<li><button type="button" class="frr" data-fa="open" data-fd="${esc(g.slug)}" data-fk="${esc(r.key)}" data-fw="1"><span class="frn">${esc(lab)}</span><span class="frc">${esc(String(ctx).slice(0, 90))}</span>${br ? '' : `<span class="frp">PDF p. ${b.pg}</span>`}${b.y29 === 'from' ? Y29C : ''}<span class="frs">${snip(r.t, re)}</span></button></li>`;
  }
  const Y29C = `<span class="f29c">2029 text</span>`;
  const FTX = ['means of escape', 'B1', 'protected stairway', 'regulation 7', 'sprinkler', 'M4(2)', 'thermal bridging', 'principal designer'];
  const ftIntro = () => `<p class="note v2n">Search every clause of the Building Regulations 2010 (England text) and the 24 Approved Documents in force: ${FTM.docs.reduce((s, d) => s + d.pages, 0).toLocaleString('en-GB')} PDF pages. Type words (all must appear in the same paragraph, list item, table or provision) or a clause number. The text loads only when you search.</p><p class="ftex">${FTX.map(t => `<button type="button" class="chip" data-fa="ex" data-q="${esc(t)}">${esc(t)}</button>`).join('')}</p>`;
  function ftSearchView(qs, only, fromBox) {
    if (S.alert) { S.alert = false; alertUi(); foldSide(false, 'alert'); }
    heroDone(false); capOff(); S.burst = false; S.sel = null; S.concept = null; noPv(); S.rowsM = null; setHi(new Set(), new Set());
    if (S.rev.size) { S.rev = new Set(); applyFilter(); R.refresh('vis'); updateClusters(); }
    navTo({ t: 'f', v: { q: qs || '', only: only || '' } }); FT.view = true;
    Panel.head(`<span class="sw" style="background:var(--ink)"></span><span>Full-text search · ${FTM.docs.length} Approved Documents + Building Regulations 2010</span>`, 'Full-text search', 'The Building Regulations 2010 and the Approved Documents, clause by clause', '', '');
    $('panel').classList.remove('faded');
    const opts = `<option value="">Everywhere: the Regulations and all 24 ADs</option><option value="br2010"${only === 'br2010' ? ' selected' : ''}>Building Regulations 2010</option>` + FTM.docs.map(d => `<option value="${esc(d.slug)}"${only === d.slug ? ' selected' : ''}>${esc(d.code)}</option>`).join('');
    $('pbody').innerHTML = `<form class="ftf" role="search" aria-label="Full-text search"><label for="ftq">Search the full text</label><div class="ftfr"><input id="ftq" type="search" autocomplete="off" spellcheck="false" value="${esc(qs || '')}" placeholder="e.g. protected stairway, B1, 2.5"><button type="submit" class="v2btn pri">Search</button></div>`
      + `<label for="ftonly" class="vh">Where to search</label><select id="ftonly">${opts}</select></form><p id="ftst" class="ftst" role="status" aria-live="polite"></p><div id="ftres"></div>`;
    $('pbody').scrollTop = 0; Panel.disc(); ftWide(true); Panel.open(); if (narrow()) { Panel.setMini(false); $('panel').classList.add('full'); sheetVar(); }
    ftRun(qs, only);
    if (!fromBox || !qs) setTimeout(() => { try { $('ftq').focus({ preventScroll: true }); } catch (e) { } }, 40);
    else setTimeout(() => { try { $('ftst').setAttribute('tabindex', '-1'); $('ftst').focus({ preventScroll: true }); } catch (e) { } }, 40);
  }

  // ---- the full-text card in a node's panel ----
  function ftCard(n) {
    try {
      qbLoad();
      const d = n.g === 'AD' && DOCC[n.c];
      const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
      if (d) return `<div class="ftc"><div class="ftck">Full text</div><p>The whole of ${esc(d.code)} is here: ${pl(d.pages, 'PDF page')}, ${pl(d.clauses, 'numbered paragraph')}${d.tables ? ', ' + pl(d.tables, 'table') : ''}${d.diagrams ? `, ${pl(d.diagrams, 'diagram')} (as captions with a link to the PDF page)` : ''}, searchable with the Regulations and the other Approved Documents.</p>`
        + `<p class="ftcb"><button type="button" class="v2btn pri" data-fa="read" data-fd="${esc(d.slug)}">Read the full text ›</button><button type="button" class="v2btn" data-fa="find" data-fd="${esc(d.slug)}">Search in it</button></p></div>`;
      const sc = brScopeOfNode(n); if (!sc) return '';
      const rq = FTM.reqs[sc] || [];
      return `<div class="ftc"><div class="ftck">Full text · Building Regulations 2010</div>`
        + (sc === 'si' ? `<p>The whole instrument, England text, revised version valid from ${fmtD(FTM.br.valid)}: ${FTM.br.eng.toLocaleString('en-GB')} provisions, with changes not yet applied flagged.</p>` : sc === 'reg-7' ? `<p>Regulation 7 (materials and workmanship) as in force, England text.</p>` : `<p>${esc(n.c)} of Schedule 1, England text: ${rq.length} requirement${rq.length === 1 ? '' : 's'}, each with its limits on application and the Approved Document section that gives guidance on it.</p>`)
        + (rq.length ? `<ul class="ftreq">${rq.map(r => `<li><button type="button" data-fa="open" data-fd="br2010" data-fk="${esc(r[0])}"><b>${esc(r[1])}</b> ${esc(r[2])} ›</button></li>`).join('')}</ul>` : '')
        + `<p class="ftcb"><button type="button" class="v2btn pri" data-fa="read" data-fd="br2010" data-fs="${esc(sc)}">Read ${sc === 'si' ? 'the Regulations' : sc === 'reg-7' ? 'regulation 7' : esc(n.c)} ›</button><button type="button" class="v2btn" data-fa="find" data-fd="br2010">Search the Regulations</button></p></div>`;
    } catch (e) { return ''; }
  }
  // the quote on a link card: jump to it in the Approved Document, highlighted in context. The map from citation line to AD block (ft/qb.js)
  // loads on the first selection; until it arrives a quote carries a hidden placeholder that is swapped for the button.
  let QB = null, qbP = null;
  function qbBtn(k, qp) {
    const v = QB && QB[k]; if (!v) return '';
    const x = v.length === 1 ? v[0] : (v.find(y => String(qp || '').startsWith(y[0]) || y[0].startsWith(String(qp || ''))) || v[0]);
    return `<button type="button" class="rdq" data-fa="open" data-fd="${esc(x[1])}" data-fk="${esc(x[2])}" data-fe="${esc(k)}">Read it in ${esc(DOC[x[1]].code)}, in context${x[3] === 29 ? ' (2029 text, in force from 2 September 2029)' : ''} ›</button>`;
  }
  function qbLoad() {
    if (!qbP) qbP = ftLoad('qb').then(d => { QB = d; document.querySelectorAll('.rdq0').forEach(sp => { sp.outerHTML = qbBtn(sp.dataset.e, sp.dataset.q); }); }).catch(() => { qbP = null; });
    return qbP;
  }
  function ftQ(e) {
    try {
      const k = e.s + '>' + e.t;
      if (!QB) { qbLoad(); return `<span class="rdq0" data-e="${k}" data-q="${esc(String(e.q || '').slice(0, 24))}" hidden></span>`; }
      return qbBtn(k, String(e.q || '').slice(0, 24));
    } catch (x) { return ''; }
  }
  const edgeQ = (s, t) => { const n = N[+s]; const e = n && n.out.find(x => x.t === +t); return e ? e.q : ''; };

  // ---- one click handler for every reader, card and result button in the panel ----
  $('pbody').addEventListener('click', e => {
    const b = e.target.closest('[data-fa]'); if (!b || !$('pbody').contains(b)) return; const a = b.dataset.fa;
    if (a === 'read') ftOpen({ doc: b.dataset.fd, scope: b.dataset.fs || null, key: b.dataset.fs && b.dataset.fs !== 'si' ? b.dataset.fs : null });
    else if (a === 'open') { const fe = b.dataset.fe ? b.dataset.fe.split('>') : null; ftOpen({ doc: b.dataset.fd, key: b.dataset.fk, q: fe ? edgeQ(fe[0], fe[1]) : '', words: b.dataset.fw && FT.res ? FT.res.ws : null, phrase: b.dataset.fw && FT.res ? FT.res.pq : null }); }
    else if (a === 'links') { const n = FT.cur && N[FT.cur.node]; if (n) { Panel.node(n); refocus($('pcode')); } }
    else if (a === 'results') { if (FT.last) ftSearchView(FT.last.q, FT.last.only, true); }
    else if (a === 'toc') { const t = $('ftoc'); if (t) { t.hidden = !t.hidden; b.setAttribute('aria-expanded', String(!t.hidden)); if (!t.hidden) { const f = t.querySelector('button'); if (f) f.focus(); } } }
    else if (a === 'jump') { const pre = FT.cur && FT.cur.doc === 'br2010' ? 'br-' : `fb-${FT.cur && FT.cur.doc}-`, el = document.getElementById(pre + b.dataset.fk); if (el) { const t = $('ftoc'); if (t) { t.hidden = true; const tb = $('pbody').querySelector('[data-fa="toc"]'); if (tb) tb.setAttribute('aria-expanded', 'false'); } el.setAttribute('tabindex', '-1'); ftLand(el); try { el.focus({ preventScroll: true }); } catch (x) { } } }
    else if (a === 'find') ftSearchView('', b.dataset.fd);
    else if (a === 'ex') { $('ftq').value = b.dataset.q; ftRun(b.dataset.q, $('ftonly').value); }
    else if (a === 'more' && FT.res) { const g = FT.res.res[+b.dataset.g], ul = $('frg' + b.dataset.g); if (g && ul) { ul.insertAdjacentHTML('beforeend', g.rows.slice(5).map(r => ftRow(g, r)).join('')); const f = ul.children[5] && ul.children[5].querySelector('button'); b.remove(); if (f) f.focus(); } }
    else if (a === 'hmore') { const u = b.nextElementSibling; if (u) { u.hidden = false; const f = u.querySelector('button'); b.remove(); if (f) f.focus(); } }
  });
  $('pbody').addEventListener('submit', e => { if (!e.target.classList.contains('ftf')) return; e.preventDefault(); const v = $('ftq').value, o = $('ftonly').value; FT.view = true; ftRun(v, o); try { history.replaceState({ hkmap: NAV.stack.length }, ''); } catch (x) { } if (NAV.cur && NAV.cur.t === 'f') NAV.cur.v = { q: v, only: o }; });
  $('pbody').addEventListener('change', e => { if (e.target.id === 'ftonly' && $('ftq').value.trim()) ftRun($('ftq').value, e.target.value); });
  const ftStart = () => { ftSearchView('', ''); };
  (() => { // QA v2-R4 V4C-02: #side's max height leaves room for the (taller) Lines legend below it, whenever either changes
    let last = -1; const fit = () => { const lb = $('linesbox'); if (!lb) return; const h = getComputedStyle(lb).display !== 'none' ? Math.ceil(lb.getBoundingClientRect().height) : 0; if (h && h !== last) { last = h; document.documentElement.style.setProperty('--lbh', h + 'px'); } };
    fit(); window.addEventListener('resize', fit);
    if (window.MutationObserver) { const mo = new MutationObserver(() => requestAnimationFrame(fit)); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); const sd = $('side'); if (sd) mo.observe(sd, { attributes: true, attributeFilter: ['class'] }); }
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => fit()); const lb = $('linesbox'); if (lb) ro.observe(lb); }
  })();
  $('ftbtn').onclick = ftStart; $('fttop').onclick = ftStart;
  // QA v2-R6a V6AC-03: Escape from About or Full text returns focus to the control that opened it (not to Edition check)
  let OPENER = null; ['abtb', 'fttop', 'ftbtn'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', () => { OPENER = b; }); });
  // QA v2-R7a V7AC-03: an opener inside the start panel is gone once the panel closes (Full text closes it); its toolbar twin takes the focus
  const TWIN = { ftbtn: 'fttop', specbtn: 'spectop', altbtn: 'alttop' };
  const opener = () => !OPENER ? undefined : OPENER.offsetParent !== null ? OPENER : ($(TWIN[OPENER.id]) && $(TWIN[OPENER.id]).offsetParent !== null ? $(TWIN[OPENER.id]) : undefined);

  // ---- QA v2-R3 C fixes outside the reader ----
  // V3C-03: Escape after a mouse selection on the canvas left focus on BODY: land it on a control
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const ae = document.activeElement;
    if (FT.view && S.sel == null && !S.alert && $('panel').classList.contains('open') && spec.hidden && !$('about').classList.contains('open') && ae !== q && !(ae && ae.id === 'ftq' && ae.value)) { FT.view = false; clearSel(); }
    [140, 420].forEach(ms => setTimeout(() => { const a = document.activeElement; if ((!a || a === document.body || a === document.documentElement || a.offsetParent === null) && spec.hidden) { refocus(opener()); setTimeout(() => { const b = document.activeElement; if (!b || b === document.body) { const t = [opener(), $('alttop'), $('fttop')].find(x => x && x.offsetParent !== null); if (t) try { t.focus({ preventScroll: true }); } catch (x) { } } }, 60); } }, ms));
  });
  // V3C-04: while About is open, the page behind it is inert (as the spec dialog already was)
  (() => {
    const ab = $('about'); if (!ab || !window.MutationObserver) return; let held = [];
    new MutationObserver(() => {
      const on = ab.classList.contains('open');
      if (on && !held.length) { held = [...document.body.children].filter(el => el !== ab && !el.inert && el.tagName !== 'SCRIPT'); held.forEach(el => { el.inert = true; }); }
      else if (!on && held.length) { held.forEach(el => { el.inert = false; }); held = [];
        // QA v2-R6a V6AC-03: About's close focused its opener while the page was still inert, so focus fell to Edition check; now it is free
        const a = document.activeElement, o = opener() || $('abtb'); if (o && (!a || a === document.body || ab.contains(a))) try { o.focus({ preventScroll: true }); } catch (x) { } }
    }).observe(ab, { attributes: true, attributeFilter: ['class'] });
  })();

  const ftapi = { open: ftOpen, search: ftSearchView, run: ftRun, load: ftLoad, data: k => FTD[k] || null, meta: () => FTM, qRange, normIx, wordRe, blockText,
    view: () => ({ wide: $('panel').classList.contains('ftr'), cur: FT.cur && Object.assign({}, FT.cur), last: FT.last }), results: () => FT.res ? FT.res.res.map(g => ({ slug: g.slug, keys: g.rows.map(r => r.key) })) : null,
    loaded: () => Object.keys(FTD), idx: c => (NBYC.get(c) || {}).i };

  // ================= v4 dark theme (10 Nov 2026): status bar + HUD panels. Inserted by b4v4_dark.py after the v3 block. =================
  // Counts in the status bar are baked at build time from data.js (b4v4 asserts them) and checked against the live data here.
  const DKM = {"nodes": 525, "links": 836, "flags": 52, "ads": 24, "pages": 1625, "heads": 10653, "reqs": 65};
  const HUD = { log: [], cl: [] };
  const hudEsc = s => esc(String(s == null ? '' : s));
  function hudLog(kind, q, only) {
    q = String(q || '').trim(); if (!q) return;
    HUD.log = [{ kind, q, only: only || '', t: new Date() }, ...HUD.log.filter(x => !(x.kind === kind && x.q.toLowerCase() === q.toLowerCase() && x.only === (only || '')))].slice(0, 30);
    hudDraw('log');
  }
  function hudClause(o, doc, where) {
    if (!o || !o.doc) return; const k = o.doc + '|' + (o.key || '') + '|' + (o.scope || '');
    HUD.cl = [{ o: { doc: o.doc, key: o.key || null, scope: o.scope || null }, doc, where: String(where || '').replace(/^ at /, ''), k }, ...HUD.cl.filter(x => x.k !== k)].slice(0, 30);
    hudDraw('cl');
  }
  const hhm = d => d.toTimeString().slice(0, 5);
  function hudDraw(which) {
    const set = (id, cnt, html) => { const c = $('hc-' + id), l = $('hl-' + id); if (c) c.textContent = cnt; if (l) l.innerHTML = html; };
    if (!which || which === 'log') set('log', HUD.log.length, HUD.log.length ? HUD.log.map((x, j) => `<li><button type="button" data-hx="log" data-j="${j}"><span class="m">${hhm(x.t)}</span> <span class="k">${x.kind === 'text' ? 'TEXT' : 'MAP'}</span>${hudEsc(x.q)}${x.only ? ` <span class="m">in ${hudEsc(x.only === 'br2010' ? 'BR 2010' : (DOC[x.only] || {}).code || x.only)}</span>` : ''}</button></li>`).join('') : '<li class="he">Nothing searched yet in this visit.</li>');
    if (!which || which === 'cl') set('cl', HUD.cl.length, HUD.cl.length ? HUD.cl.map((x, j) => `<li><button type="button" data-hx="cl" data-j="${j}"><span class="k">${hudEsc(x.doc)}</span>${hudEsc(x.where || 'start')}</button></li>`).join('') : '<li class="he">Clauses you open in the full text are listed here.</li>');
    if (!which || which === 'ix') {
      const got = Object.keys(FTD).length, tot = Object.keys(FTM.files).length;
      set('ix', `${got}/${tot}`, `<li><span class="k">ADs</span>${FTM.docs.length} · ${DKM.pages.toLocaleString('en-GB')} PDF pages</li><li><span class="k">BR</span>${FTM.br.eng.toLocaleString('en-GB')} England provisions · ${DKM.reqs} requirements</li>`
        + `<li><span class="k">INDEX</span>${DKM.heads.toLocaleString('en-GB')} numbers and headings</li><li><span class="k">LOADED</span>${got} of ${tot} text files (on demand)</li><li><button type="button" data-hx="ft"><span class="k">›</span>Search the full text</button></li>`);
    }
  }
  // QA v2-R5a V5AF-04: each citing AD once (pa has one row per AD and edition); V5AF-05: an amendment-only record is tagged AMD, not NEW
  function hudStatic() {
    const al = [...ALT].sort((a, b) => a.c.localeCompare(b.c, 'en', { numeric: true }));
    $('hc-led').innerHTML = `<span class="hr">${al.length}</span>`;
    $('hl-led').innerHTML = al.map(n => `<li><button type="button" data-hx="led" data-i="${n.i}"><span class="r">${n.bsx.s === 'withdrawn' ? 'WDN' : amendOnly(n) ? 'AMD' : 'NEW'}</span>${hudEsc(n.c)} <span class="m">${hudEsc([...new Set((n.bsx.pa || []).map(r => r[0]))].slice(0, 3).join(', '))}</span></button></li>`).join('');
    const dc = {}; N.forEach(n => { if (n.dm) dc[n.dm] = (dc[n.dm] || 0) + 1; });
    const mx = Math.max(...Object.values(dc));
    $('hc-dom').textContent = Object.keys(dc).length;
    $('hl-dom').innerHTML = Object.entries(dc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span class="bar" style="width:${Math.max(4, Math.round(v / mx * 60))}px;background:${DOM[k].color};color:${DOM[k].color}"></span><b>${v}</b> ${hudEsc(DOM[k].en)}</li>`).join('');
  }
  $('hud').addEventListener('click', e => {
    const b = e.target.closest('[data-hx]'); if (!b) return; const x = b.dataset.hx;
    if (x === 'log') { const r = HUD.log[+b.dataset.j]; if (!r) return; if (r.kind === 'text') ftSearchView(r.q, r.only, true); else runQuery(r.q); }
    else if (x === 'cl') { const r = HUD.cl[+b.dataset.j]; if (r) ftOpen(r.o); }
    else if (x === 'led') { const n = N[+b.dataset.i]; if (n) { if (!n.vis) { S.rev.add(n.i); applyFilter(); R.refresh('vis'); updateClusters(); } select(n.i); } }
    else if (x === 'ft') ftSearchView('', '');
    if (narrow()) hudSheet(false);
  });
  // ---- status bar: live values (shown dots, mode, selection, text files loaded), updated at most once a second and only when changed ----
  let sbLast = '';
  function sbTick() {
    if (document.hidden) return;
    const shown = N.reduce((s, n) => s + (n.vis ? 1 : 0), 0), mode = S.alert ? 'EDITION CHECK' : S.mode === 'dept' ? 'BY TYPE' : 'BY DOMAIN', sel = S.sel != null ? N[S.sel].c : '';
    const v = `${shown}|${mode}|${sel}|${Object.keys(FTD).length}`; if (v === sbLast) return; sbLast = v;
    $('sbshown').innerHTML = `shown <b>${shown}</b>`; $('sbmode').innerHTML = `<b>${hudEsc(mode)}</b>`; $('sbsel').innerHTML = sel ? `sel <b>${hudEsc(sel)}</b>` : ''; $('sbsel').hidden = !sel;
    hudDraw('ix');
  }
  setInterval(sbTick, 1000);
  // ---- HUD layout: on desktop a band above the footer; --foot grows by its height so the map, legend, zoom bar and panel sit above it ----
  let hudOpen = true;
  try { const v = localStorage.getItem('ukmap_hud'); if (v === '0') hudOpen = false; } catch (e) { }
  function hudFit() {
    const hud = $('hud'), ft = document.querySelector('.foot'); if (!hud || !ft) return;
    const de = document.documentElement;
    // QA v2-R6a V6AC-01: on phones and tablets there is no HUD band, but --foot must still be the footer's real height (the dark footer is
    // ~90 px tall there); removing it left the 44 px default, so Legend & filters and zoom "fit" sat under the footer
    if (narrow()) { de.style.removeProperty('--footb'); hud.style.bottom = ''; hud.style.height = ''; const v = Math.ceil(ft.getBoundingClientRect().height) + 'px'; if (de.style.getPropertyValue('--foot') !== v) { de.style.setProperty('--foot', v); if (R && R.resize) R.resize(); } return; }
    const short = window.innerHeight < 700 || window.innerWidth < 1000;
    hud.classList.toggle('compact', !hudOpen || short);
    hud.style.height = (hud.classList.contains('compact') ? 34 : window.innerHeight >= 860 ? 132 : 112) + 'px';
    const fh = ft.offsetHeight; hud.style.bottom = fh + 'px'; de.style.setProperty('--footb', fh + 'px'); // footer only: the start panel may stand over the HUD band (R5, V3C-06)
    const v = (fh + hud.offsetHeight) + 'px';
    if (de.style.getPropertyValue('--foot') !== v) { de.style.setProperty('--foot', v); if (R && R.resize) R.resize(); }
    $('sbhud').setAttribute('aria-expanded', String(!hud.classList.contains('compact')));
    $('sbhud').textContent = hud.classList.contains('compact') ? 'Panels ▴' : 'Panels ▾';
  }
  function hudSheet(on) { const hud = $('hud'); hud.classList.toggle('sheet', !!on); $('sbhud').setAttribute('aria-expanded', String(!!on)); $('sbhud').textContent = on ? 'Panels ×' : 'Panels'; if (on) { const f = hud.querySelector('button'); if (f) f.focus(); } }
  $('sbhud').addEventListener('click', () => {
    if (narrow()) { hudSheet(!$('hud').classList.contains('sheet')); return; }
    hudOpen = $('hud').classList.contains('compact'); try { localStorage.setItem('ukmap_hud', hudOpen ? '1' : '0'); } catch (e) { } hudFit();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && narrow() && $('hud').classList.contains('sheet')) { hudSheet(false); $('sbhud').focus(); } });
  window.addEventListener('resize', () => { hudFit(); if (!narrow()) hudSheet(false), hudFit(); });
  // QA v2-R5a (found while testing V5AC-02): the footer grows when the visit count arrives (and wraps at some widths); the HUD band and --foot
  // were measured once, so the band then stood over the legend and map. Re-fit whenever the footer's size changes.
  if (window.ResizeObserver) { let rq = 0; const ro = new ResizeObserver(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(hudFit); }); const ft = document.querySelector('.foot'); if (ft) ro.observe(ft); }
  // QA v2-R7a V7AC-01: on phones the start panel also ends above the first-visit notice while it shows: --nh = the notice's height (0 hidden)
  // V7AC-02: on desktop the open start panel may stand over the HUD band (R5); the band is inert while the panel overlaps it, so none of its
  // rows is a Tab stop hidden under the panel (1024x768: 1 hidden stop, 14 with the visit count loaded)
  function heroFit() {
    const de = document.documentElement, nt = $('notice'), hero = $('hero'), hud = $('hud');
    const shown = el => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';  // fixed boxes have no offsetParent
    const nh = shown(nt) ? Math.ceil(nt.getBoundingClientRect().height) + 'px' : '0px';
    if (de.style.getPropertyValue('--nh') !== nh) de.style.setProperty('--nh', nh);
    if (!hero || !hud) return;
    let ov = false;
    if (!narrow() && document.body.classList.contains('hero-on') && shown(hero)) {
      const a = hero.getBoundingClientRect(), b = hud.getBoundingClientRect();
      ov = b.height > 0 && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
    }
    if (hud.dataset.heroInert !== String(ov)) { hud.dataset.heroInert = String(ov); hud.inert = ov; }
  }
  if (window.ResizeObserver) { let rq2 = 0; const ro2 = new ResizeObserver(() => { cancelAnimationFrame(rq2); rq2 = requestAnimationFrame(heroFit); }); ['notice', 'hero', 'hud'].forEach(id => { if ($(id)) ro2.observe($(id)); }); }
  if (window.MutationObserver) { const mo = new MutationObserver(() => requestAnimationFrame(heroFit)); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); if ($('notice')) mo.observe($('notice'), { attributes: true, attributeFilter: ['hidden'] }); }
  window.addEventListener('resize', () => requestAnimationFrame(heroFit));
  // the numbers baked into the status bar must equal the live data
  const DK_OK = DKM.nodes === N.length && DKM.links === E.length && DKM.flags === ALT.length && DKM.ads === FTM.docs.length;
  if (!DK_OK) console.warn('status bar counts differ from data');
  // QA v2-R5a V5AC-02: the Lines legend folds to its header. On desktop below 900 px of height it starts folded, so Legend & filters (the only key to
  // the map's colours) keeps its room under the status bar and the HUD band; the visitor's own open / fold choice is kept for the visit.
  let lbUser = null;
  (() => {
    const lb = $('linesbox'), h = lb && lb.querySelector('h4'); if (!h) return;
    const body = document.createElement('div'); body.id = 'lbbody'; while (h.nextSibling) body.appendChild(h.nextSibling); lb.appendChild(body);
    h.classList.add('lbh'); h.innerHTML = '<button type="button" id="lbtog" aria-controls="lbbody" aria-expanded="true">Lines<span class="lbt" aria-hidden="true">−</span></button>';
    const bt = $('lbtog');
    const set = open => { lb.classList.toggle('fold', !open); body.hidden = !open; bt.setAttribute('aria-expanded', String(open)); bt.querySelector('.lbt').textContent = open ? '−' : '+'; };
    const auto = () => set(lbUser !== null ? lbUser : (narrow() || window.innerHeight > 1000));  // QA v2-R6a V6AC-02: folds at 1440x900 too (was >= 900)
    bt.addEventListener('click', () => { lbUser = lb.classList.contains('fold'); auto(); });
    auto(); window.addEventListener('resize', auto);
  })();
  // QA v2-R5a V5AC-03: with the reader or a card open, the tools bar is moved clear of Legend & filters (to its right if there is room before the
  // panel, else just below it), measured after the bar's slide so the +/- toggle is never covered.
  function toolsFit() {
    const t = $('tools'), sd = $('side'), pn = $('panel'); if (!t || !sd) return;
    t.style.left = ''; t.style.right = ''; t.style.top = '';
    if (narrow() || getComputedStyle(t).display === 'none' || getComputedStyle(sd).display === 'none') return;
    const a = t.getBoundingClientRect(), b = sd.getBoundingClientRect();
    if (!b.width || a.left >= b.right + 8 || a.right <= b.left - 8 || a.top >= b.bottom + 8 || a.bottom <= b.top - 8) return;
    const pl = pn && pn.classList.contains('open') ? pn.getBoundingClientRect().left : window.innerWidth;
    if (b.right + 12 + a.width <= pl - 12) { t.style.left = (b.right + 12) + 'px'; t.style.right = 'auto'; }
    else { t.style.left = b.left + 'px'; t.style.right = 'auto'; t.style.top = (b.bottom + 10) + 'px'; }
  }
  let tfT = 0; const toolsSoon = () => { clearTimeout(tfT); tfT = setTimeout(() => requestAnimationFrame(toolsFit), 420); };
  if (window.MutationObserver) { const mo = new MutationObserver(toolsSoon); mo.observe(document.body, { attributes: true, attributeFilter: ['class'] }); if ($('side')) mo.observe($('side'), { attributes: true, attributeFilter: ['class', 'style'] }); }
  window.addEventListener('resize', toolsSoon); if ($('tools')) $('tools').addEventListener('transitionend', () => requestAnimationFrame(toolsFit));
  hudStatic(); hudDraw(); hudFit(); heroFit(); sbTick();
  const dkapi = { log: () => HUD.log.map(x => [x.kind, x.q]), clauses: () => HUD.cl.map(x => [x.doc, x.where]), ok: () => DK_OK, meta: () => DKM, fit: hudFit, toolsFit, lbFold: () => !!($('linesbox') && $('linesbox').classList.contains('fold')), r: () => (R && R.dk ? R.dk() : null),
    scr: i => { const n = N[i], o = {}; if (!n || !R.toScreen(n, o)) return null; const st = stage.getBoundingClientRect(); return [o.x + st.left, o.y + st.top, R.rad ? R.rad(n) : 0, nodeColor(n), !!n.vis]; },
    checked: () => N.filter(n => n.vis && n.bsx && n.bsx.s !== 'not checked' && !n.noCore).map(n => n.i), idleIn: ms => { if (R && R.dkIdle) R.dkIdle(ms); }, set: o => { if (R && R.dkSet) R.dkSet(o); }, rot: on => { if (R && R.rotate) R.rotate(on); } };

  // ---------------- ready ----------------
  updateClusters(); updateCands();
  $('loading').remove();
  const find = x => typeof x === 'number' ? N[x] : BYID.get(x) || BYCODE.get(norm(x));
  window.APP = {
    ready: true, mobile: MOBILE, R, S,
    select: x => { const n = find(x); if (n) select(n.i); return !!n; },
    concept: t => { const r = search(t); if (r.c[0]) { selectConcept(r.c[0].ci); return r.c[0].c[1]; } return null; },
    search: t => search(t), keyword: t => selectKeyword(t), back: () => $('pback').click(), nav: () => ({ cur: NAV.cur, depth: NAV.stack.length }),
    conceptRows: t => { const r = search(t); return r.c[0] ? { name: r.c[0].c[1], zh: r.c[0].c[2], rows: cDocs(r.c[0].ci).map(([i, m]) => [N[i].c, N[i].g, m]) } : null; },
    setMode, setLeg, clear: clearSel,
    preview: x => { const n = find(x); if (n) preview(n.i); return S.pv; }, openPreview, collapse: on => Panel.setCol(on), minimise: on => Panel.setMini(on),
    pv: () => S.pv, hi: () => S.hiN.size, ext: () => [...S.pvX], extL: () => S.pvXL.size, canClick: i => canClick(i), hiList: () => [...S.hiN],
    scr: i => { const n = N[i], o = { x: 0, y: 0, d: 0 }; if (!n || !n.vis || n.x == null || !R.toScreen(n, o)) return null; const rc = stage.getBoundingClientRect(); return { x: o.x + rc.left, y: o.y + rc.top, c: n.c }; },
    fps: () => fpsHist.slice(), counts: () => ({ nodes: N.filter(n => n.vis).length, links: L.filter(l => l.vis).length }), v2: v2api, ft: ftapi, dk: dkapi
  };
})();
