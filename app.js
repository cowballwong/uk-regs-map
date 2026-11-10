/* UK Building Regulations Map (England), v1. Forked from the HK Building Regulations Map engine (S7). AW Design.
   Classic script (works from file://): libraries come in by dynamic import() from cdn.jsdelivr.net.
   Desktop: 3d-force-graph (three.js). Phones (<= 768px): force-graph 2D canvas. Same data, same panel. */
(async function () {
  'use strict';
  const H = window.HKMAP;
  if (!H) { document.getElementById('loading').textContent = 'data.js did not load'; return; }
  const N = H.nodes, E = H.solid, BR = H.dashed, GR = H.groups, DOM = H.domains, SUBJ = H.subjects;
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
  const S = { mode: 'dept', leg: false, bridges: true, dept: Object.fromEntries(Object.keys(GR).map(k => [k, true])), dom: 'all', sel: null, concept: null, hiN: new Set(), hiL: new Set(), pv: null, pvX: new Set(), pvXL: new Set(), rowsM: null, col: false };
  const shownN = n => S.dept[n.g] && (S.dom === 'all' || n.dm === S.dom) && (S.leg || !HIDE_K.has(n.k));
  function applyFilter() {
    N.forEach(n => { n.vis = shownN(n); });
    L.forEach(l => {
      const a = N[l.s0], b = N[l.t0];
      l.vis = a.vis && b.vis && (l.kind === 'roll' ? !S.leg : l.kind === 'bridge' ? S.bridges : true);
    });
    const vn = N.reduce((s, n) => s + (n.vis ? 1 : 0), 0);
    $('stats').textContent = `${fmt(vn)} of ${fmt(N.length)} shown · ${fmt(E.length)} quoted citations · ${BR.length} AI links`;
  }
  applyFilter();

  // ---------------- colours + sizes ----------------
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const _lum = c => { const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4)); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const chipBg = c => { let x = c; for (let k = 0; k < 30 && 1.05 / (_lum(x) + .05) < 4.6; k++) x = '#' + [1, 3, 5].map(i => Math.round(parseInt(x.slice(i, i + 2), 16) * .93).toString(16).padStart(2, '0')).join(''); return x; };
  const BSC = { superseded: '#d55e00', withdrawn: '#7b3f98', mixed: '#8c6d00', current: '#0072b2', 'not checked': '#a8a196' };
  const BSW = { superseded: 'Newer edition exists', withdrawn: 'Cited edition withdrawn', mixed: 'Depends on citing AD', current: 'Cited edition current', 'not checked': 'Status not checked' };
  const LEGCOL = { ordinance: '#3f332a', regulation: '#5a4c40', part: '#8d7f70', schedule: '#8d7f70', division: '#a99c8c', section: '#afa293', schedule_section: '#b8ac9e' };
  N.forEach(n => {
    let cd, cm;
    if (LEGCOL[n.k]) cd = cm = LEGCOL[n.k];
    else if (n.k === 'external_ordinance') cd = cm = '#9a8d7e';
    else { cd = GR[n.g].color; cm = (DOM[n.dm] || {}).color || '#8b7355'; if (n.k === 'document_stub') { cd = mix(cd, '#f5ede4', .5); cm = mix(cm, '#f5ede4', .5); } }
    if (n.fd) { cd = mix(cd, '#f5ede4', .58); cm = mix(cm, '#f5ede4', .58); }
    n.cD = cd; n.cM = cm;
    if (n.bsx) { n.cD = n.cM = BSC[n.bsx.s] || BSC['not checked']; }
    const d = n.deg || 0;
    n.v0 = (n.fd ? .55 : 1) * Math.min(90, { ordinance: 70, regulation: 9 + d * .25, part: 1.4 + d * .2, schedule: 1.4 + d * .2, division: .6, section: .35 + d * .18, schedule_section: .35 + d * .18, external_ordinance: .9 + d * .3, document_stub: .5 + d * .25 }[n.k] ?? (1.8 + d * .42));
  });
  const colOf = n => S.mode === 'dept' ? n.cD : n.cM;
  const DIM = '#efe7dc';
  const softC = new Map(); // a colour washed halfway to the dim tone, for the extension neighbours of a previewed dot
  const soft = c => { let v = softC.get(c); if (!v) { const a = hex(c), d = hex(DIM); v = '#' + a.map((x, k) => Math.round(x * .5 + d[k] * .5).toString(16).padStart(2, '0')).join(''); softC.set(c, v); } return v; };
  const nodeColor = n => n.i === S.pv ? colOf(n) : S.pvX.has(n.i) ? soft(colOf(n)) : (S.hiN.size && !S.hiN.has(n.i)) ? DIM : colOf(n);
  const nodeVal = n => n.i === S.pv ? n.v0 * 1.7 + 5 : S.pvX.has(n.i) ? n.v0 * .7 + 1.2 : S.hiN.size ? (n.i === S.sel ? n.v0 * 2.2 + 6 : S.hiN.has(n.i) ? n.v0 * 1.25 : n.v0 * .05) : n.v0;
  const tip = n => { const w = n.bsx ? [BSW[n.bsx.s], ''] : n.fd && stWord(n); return `<div class="tip"><b>${esc(n.c)}</b>${w ? ` <span class="z">· ${esc(w[0])}</span>` : ''}<br>${esc(n.te || '')}${n.bsx && n.bsx.pa && n.bsx.pa.length > 1 ? `<div class="z">${esc(n.bsx.pa.map(r => `${r[0]} ${r[2]}: ${BSW[r[1]]}`).join(' · '))}</div>` : n.vd && n.bsx ? `<div class="z">${esc(n.vd)}</div>` : ''}</div>`; };
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
  applyLayout('dept');
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
    const W = () => stage.clientWidth, Hh = () => stage.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W(), Hh()); renderer.setClearColor('#f5ede4');
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
    const hiBrMat = new LM.LineMaterial({ color: 0x1a1410, linewidth: 1.6, dashed: true, dashSize: 3.2, gapSize: 2.4, transparent: true, depthWrite: false });
    const hiLines = new LS2.LineSegments2(new LSG.LineSegmentsGeometry(), hiMat); hiLines.frustumCulled = false; scene.add(hiLines);
    const hiBr = new LS2.LineSegments2(new LSG.LineSegmentsGeometry(), hiBrMat); hiBr.frustumCulled = false; scene.add(hiBr);
    // extension lines: a previewed dot's links that lead outside the search set, dashed and faint
    const xMat = new LM.LineMaterial({ color: 0xc4763c, linewidth: 1.3, dashed: true, dashSize: 4, gapSize: 3, transparent: true, opacity: .55, depthWrite: false });
    const xLn = new LS2.LineSegments2(new LSG.LineSegmentsGeometry(), xMat); xLn.frustumCulled = false; xLn.visible = false; scene.add(xLn);
    hiMat.resolution.set(W(), Hh()); hiBrMat.resolution.set(W(), Hh()); xMat.resolution.set(W(), Hh());
    let hiList = [], hiBrList = [], xList = [];
    const LC = {
      cite: ['#a38a70', .24], roll: ['#a38a70', .22], faint: ['#b9a792', .09], tree: ['#8f8171', .38], bridge: ['#2f2520', .8],
      dim: ['#cdbfae', .07], dimBr: ['#8b7355', .12]
    };
    const rgba = {}; Object.entries(LC).forEach(([k, [c, a]]) => { col.set(c); rgba[k] = [col.r, col.g, col.b, a]; });
    const HI = { cite: new THREE.Color('#c4763c'), tree: new THREE.Color('#6f5c48') };

    function writeState() {
      const hi = S.hiN.size > 0;
      N.forEach(n => { inst.setColorAt(n.i, col.set(nodeColor(n))); n.cv = n.vis ? Math.cbrt(nodeVal(n)) * REL : 0; });
      inst.instanceColor.needsUpdate = true;
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
      hiList.forEach((l, j) => { const c = l.kind === 'tree' ? HI.tree : HI.cite; for (let k = 0; k < 2; k++) { hc[j * 6 + k * 3] = c.r; hc[j * 6 + k * 3 + 1] = c.g; hc[j * 6 + k * 3 + 2] = c.b; } });
      hiLines.geometry.dispose(); hiLines.geometry = new LSG.LineSegmentsGeometry();
      if (hiList.length) { hiLines.geometry.setPositions(new Float32Array(hiList.length * 6)); hiLines.geometry.setColors(hc); }
      hiBr.geometry.dispose(); hiBr.geometry = new LSG.LineSegmentsGeometry();
      if (hiBrList.length) hiBr.geometry.setPositions(new Float32Array(hiBrList.length * 6));
      hiLines.visible = hiList.length > 0; hiBr.visible = hiBrList.length > 0;
      xList = [...S.pvXL].filter(l => l.vis); xLn.geometry.dispose(); xLn.geometry = new LSG.LineSegmentsGeometry(); xLn.visible = xList.length > 0;
    }
    const seg = (arr, list) => list.forEach((l, j) => { const a = N[l.s0], b = N[l.t0], o = j * 6; arr[o] = a.x; arr[o + 1] = a.y; arr[o + 2] = a.z; arr[o + 3] = b.x; arr[o + 4] = b.y; arr[o + 5] = b.z; });
    function writePositions() {
      for (const n of N) { const o = n.i * 16, r = n.cv; mArr[o] = r; mArr[o + 5] = r; mArr[o + 10] = r; mArr[o + 12] = n.x; mArr[o + 13] = n.y; mArr[o + 14] = n.z; mArr[o + 15] = 1; }
      inst.instanceMatrix.needsUpdate = true;
      seg(bLines.geometry.attributes.position.array, baseL); bLines.geometry.attributes.position.needsUpdate = true;
      seg(dLines.geometry.attributes.position.array, brL); dLines.geometry.attributes.position.needsUpdate = true; dLines.computeLineDistances();
      if (hiList.length) { const a = new Float32Array(hiList.length * 6); seg(a, hiList); hiLines.geometry.setPositions(a); }
      if (hiBrList.length) { const a = new Float32Array(hiBrList.length * 6); seg(a, hiBrList); hiBr.geometry.setPositions(a); hiBr.computeLineDistances(); }
      if (xList.length) { const a = new Float32Array(xList.length * 6); seg(a, xList); xLn.geometry.setPositions(a); xLn.computeLineDistances(); }
    }
    // setPositions on LineSegmentsGeometry resets colours, so colours are re-applied after each position write
    const _wp = writePositions;
    const writeAll = () => { _wp(); if (hiList.length) { const hc = new Float32Array(hiList.length * 6); hiList.forEach((l, j) => { const c = l.kind === 'tree' ? HI.tree : HI.cite; for (let k = 0; k < 2; k++) { hc[j * 6 + k * 3] = c.r; hc[j * 6 + k * 3 + 1] = c.g; hc[j * 6 + k * 3 + 2] = c.b; } }); hiLines.geometry.setColors(hc); } };

    // ---- regions ----
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv); const regions = new Map();
    function syncRegions() {
      const keep = new Set();
      clusters.forEach(c => {
        keep.add(c.k); let sp = regions.get(c.k);
        if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.renderOrder = -1; scene.add(sp); regions.set(c.k, sp); }
        sp.material.color.set(c.info.color); sp.material.opacity = S.hiN.size ? .06 : .16;
        sp.position.set(c.x, c.y, c.z); const s = c.r * 2.9 + 40; sp.scale.set(s, s, 1); sp.visible = true;
      });
      regions.forEach((sp, k) => { if (!keep.has(k)) sp.visible = false; });
    }

    // ---- camera moves ----
    let tween = null, panelShift = 0;
    const V = new THREE.Vector3();
    function flyCam(p, t, ms) { tween = { t0: performance.now(), ms: Math.max(1, ms), p0: cam.position.clone(), p1: new THREE.Vector3(p.x, p.y, p.z), q0: controls.target.clone(), q1: new THREE.Vector3(t.x, t.y, t.z) }; }
    function stepTween() { const k = Math.min(1, (performance.now() - tween.t0) / tween.ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; cam.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.q0, tween.q1, e); if (k >= 1) tween = null; }
    const legendShift = () => $('side').classList.contains('min') ? 0 : -165;
    function applyOffset() { const s = panelShift + legendShift(); if (s) cam.setViewOffset(W(), Hh(), s, 0, W(), Hh()); else cam.clearViewOffset(); cam.updateProjectionMatrix(); }
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
      const fov = cam.fov * Math.PI / 180, aspect = W() / Hh();
      const dist = r / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * aspect)) / 2) * (tight ? 1.05 : elev != null && elev > .6 ? .8 : .7) + 20;
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

    // ---- loop ----
    let dirtyState = true, dirtyPos = true;
    function loop() {
      requestAnimationFrame(loop);
      if (stepMorph()) { dirtyPos = true; syncRegions(); }
      if (tween) stepTween();
      controls.autoRotate = rotOn && !tween && !dragging && performance.now() - rotIdle > 3000;
      controls.autoRotateSpeed = S.sel != null ? .6 : .45;
      controls.update();
      // clip whatever sits in the front part of the way to the focus, so a close-up is never hidden behind other nodes
      const near = Math.max(1, cam.position.distanceTo(controls.target) * (S.hiN.size ? .42 : .08));
      if (Math.abs(near - cam.near) > .5) { cam.near = near; cam.updateProjectionMatrix(); }
      if (dirtyState) { writeState(); dirtyState = false; dirtyPos = true; }
      if (dirtyPos) { writeAll(); dirtyPos = false; }
      renderer.render(scene, cam);
    }
    updateClusters(); syncRegions(); frameSet(N.filter(n => n.vis), null, 0, false);
    requestAnimationFrame(loop);
    return {
      controls, stopRot,
      rotate(on) { if (on == null) return rotOn; rotOn = !!on; if (on) rotIdle = -1e9; else { controls.autoRotate = false; controls.enableDamping = false; controls.update(); controls.enableDamping = true; } try { localStorage.setItem('ukmap_rotate', on ? '1' : '0'); } catch (e) { } return rotOn; },
      target: () => ({ x: controls.target.x, y: controls.target.y, z: controls.target.z }), camPos: () => ({ x: cam.position.x, y: cam.position.y, z: cam.position.z }),
      refresh() { dirtyState = true; syncRegions(); },
      moved() { dirtyPos = true; syncRegions(); },
      toScreen(n, out) { V.set(n.x, n.y, n.z).project(cam); if (V.z > 1 || V.z < -1) return false; out.x = (V.x + 1) / 2 * W(); out.y = (1 - V.y) / 2 * Hh(); out.d = V.z; return true; },
      clusterScreen(c, out) {
        V.set(GC.x, GC.y, GC.z).project(cam); out.gx = (V.x + 1) / 2 * W(); out.gy = (1 - V.y) / 2 * Hh();
        V.set(c.x, c.y, c.z).project(cam); if (V.z > 1) return false; out.x = (V.x + 1) / 2 * W(); out.y = (1 - V.y) / 2 * Hh();
        out.r = c.r * (Hh() / 2 / Math.tan(cam.fov * Math.PI / 360)) / cam.position.distanceTo(V.set(c.x, c.y, c.z)); return true;
      },
      panel(open) { panelShift = open ? 214 : 0; applyOffset(); },
      flyTo(ids, focus) { stopRot(); frameSet([...ids].map(i => N[i]).filter(n => n.vis), focus != null ? N[focus] : null, 1500, true); },
      fitAll(ms = 800, elev) { frameSet(N.filter(n => n.vis), null, ms, false, elev); },
      zoom(f) { stopRot(); const t = controls.target, p = cam.position; flyCam({ x: t.x + (p.x - t.x) * f, y: t.y + (p.y - t.y) * f, z: t.z + (p.z - t.z) * f }, t.clone(), 350); },
      resize() { renderer.setSize(W(), Hh()); cam.aspect = W() / Hh(); applyOffset(); hiMat.resolution.set(W(), Hh()); hiBrMat.resolution.set(W(), Hh()); xMat.resolution.set(W(), Hh()); },
      info: () => renderer.info.render
    };
  }

  async function make2D() {
    const FG = (await import('https://cdn.jsdelivr.net/npm/force-graph@1.51.4/+esm')).default;
    const linkCol = l => {
      if (S.pvXL.has(l)) return 'rgba(196,118,60,.6)';
      if (S.hiN.size) { if (!S.hiL.has(l)) return 'rgba(216,203,187,.12)'; return l.kind === 'bridge' ? '#1a1410' : l.kind === 'tree' ? 'rgba(111,92,72,.8)' : 'rgba(196,118,60,.95)'; }
      return l.kind === 'bridge' ? 'rgba(47,37,32,.8)' : l.kind === 'tree' ? 'rgba(143,129,113,.4)' : l.faint ? 'rgba(185,167,146,.14)' : 'rgba(163,138,112,.32)';
    };
    const G = new FG(stage)
      .backgroundColor('#f5ede4').nodeId('i').nodeRelSize(2.1)
      .nodeVal(nodeVal).nodeColor(nodeColor).nodeVisibility(n => n.vis).nodeLabel(null)
      .linkVisibility(l => l.vis).linkColor(linkCol).linkWidth(l => S.hiL.has(l) ? 1.3 : S.pvXL.has(l) ? 1 : .45).linkLineDash(l => S.pvXL.has(l) ? [4, 3] : l.kind === 'bridge' ? [3, 2.4] : null)
      .enableNodeDrag(false)
      // in a search view grey dots have no hit area, and lines never do, so neither reacts to a hover or a click
      .nodePointerAreaPaint((n, c, ctx) => { if (!canClick(n.i)) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(n.x, n.y, Math.sqrt(Math.max(0, nodeVal(n))) * 2.1 + 1, 0, 2 * Math.PI); ctx.fill(); })
      .linkPointerAreaPaint(() => { })
      .onNodeClick(n => { if (canClick(n.i)) nodeClick(n.i); }).onBackgroundClick(ev => { const n = ev && pick2(ev, true); if (n) nodeClick(n.i); else if (!(ev && pick2(ev, false))) bgClick(); })
      .onRenderFramePre((ctx, k) => {
        if (!stepMorph() && G.autoPauseRedraw && !G.autoPauseRedraw()) G.autoPauseRedraw(true);
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
    updateClusters(); setTimeout(() => G.zoomToFit(0, 18, n => n.vis), 30);
    const sheetH = () => $('panel').classList.contains('open') ? $('panel').offsetHeight : 0;
    return {
      G, stopRot() { },
      refresh(what) { G.nodeColor(G.nodeColor()).nodeVal(G.nodeVal()).linkColor(G.linkColor()).linkWidth(G.linkWidth()).linkLineDash(G.linkLineDash()).nodePointerAreaPaint(G.nodePointerAreaPaint()); if (what === 'vis') G.nodeVisibility(G.nodeVisibility()).linkVisibility(G.linkVisibility()); },
      moved() { G.autoPauseRedraw(false); },
      toScreen(n, out) { const p = G.graph2ScreenCoords(n.x, n.y); out.x = p.x; out.y = p.y; out.d = 0; return true; },
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
      fitAll(ms = 600) { G.zoomToFit(ms, 18, n => n.vis); },
      zoom(f) { G.zoom(G.zoom() * f, 300); },
      resize() { G.width(stage.clientWidth).height(stage.clientHeight); }
    };
  }
  function Hh0() { return stage.clientHeight; }

  // ---------------- labels overlay (HTML, decluttered each frame) ----------------
  const LB = $('labels'); const lbCache = new Map(); const clCache = new Map();
  function lbEl(n) {
    let o = lbCache.get(n.i);
    if (!o) { const el = document.createElement('div'); el.className = 'lb'; el.innerHTML = `<b>${esc(n.c)}</b>${shortZh(n) ? `<span>${esc(shortZh(n))}</span>` : ''}`; el.style.display = 'none'; LB.appendChild(el); o = { el, w: 0, h: 0, on: false }; lbCache.set(n.i, o); }
    return o;
  }
  function clEl(c) {
    let o = clCache.get(S.mode + c.k);
    if (!o) { const el = document.createElement('div'); el.className = c.info.sub ? 'cl sj' : 'cl'; if (c.info.sub) el.style.color = mix(c.info.color, '#1a1410', .38); el.innerHTML = `<b>${esc(c.info.en)}</b><span>${esc(c.info.zh)}</span>`; el.style.display = 'none'; LB.appendChild(el); o = { el, w: 0, h: 0, on: false }; clCache.set(S.mode + c.k, o); }
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
    const W = stage.clientWidth, Hs = stage.clientHeight, placed = [];
    const hit = (x, y, w, h) => { for (const p of placed) if (x < p[0] + p[2] && x + w > p[0] && y < p[1] + p[3] && y + h > p[1]) return true; return false; };
    if (S.pv != null && N[S.pv].x != null && R.toScreen(N[S.pv], pt)) { ring.style.transform = `translate(${(pt.x - 17) | 0}px,${(pt.y - 17) | 0}px)`; if (!ringOn) { ring.style.display = 'block'; ringOn = true; } }
    else if (ringOn) { ring.style.display = 'none'; ringOn = false; }
    const rightEdge = (!MOBILE && $('panel').classList.contains('open') && !S.col) ? W - 440 : W;
    const leftEdge = (!MOBILE && !$('side').classList.contains('min')) ? 290 : 0;
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
      const x = pt.x - o.w / 2, y = pt.y + (n.i === S.sel ? 12 : 7);
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
    try { if (st.t === 'n') select(st.v); else if (st.t === 'c') selectConcept(st.v); else if (st.t === 'k') selectKeyword(st.v); } finally { NAV.restoring = false; }
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
    navTo({ t: 'n', v: i });
    let changed = false;
    if (HIDE_K.has(n.k) && !S.leg) { S.leg = true; changed = true; }
    if (!S.dept[n.g]) { S.dept[n.g] = true; changed = true; }
    if (S.dom !== 'all' && n.dm !== S.dom) { S.dom = 'all'; changed = true; }
    if (changed) { applyFilter(); R.refresh('vis'); buildSide(); updateClusters(); }
    S.sel = i; S.concept = null; noPv(); S.rowsM = null;
    const ns = new Set([i]), ls = new Set();
    n.adj.forEach(l => { if (!l.vis) return; ls.add(l); ns.add(l.s0 === i ? l.t0 : l.s0); });
    setHi(ns, ls);
    Panel.node(n); if (document.activeElement !== $('q')) $('q').value = n.c;
    if (fly) setTimeout(() => R.flyTo(ns, i), changed ? 900 : 0);
  }
  function lightSet(rows) { // rows: [[node, mentions], ...]
    S.sel = null; noPv(); S.rowsM = new Map(rows);
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
  function clearSel() { S.sel = null; S.concept = null; noPv(); S.rowsM = null; setHi(new Set(), new Set()); Panel.close(); navReset(); }
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
  function nodeClick(i) { if (inSearch()) preview(i); else select(i); }
  function bgClick() { if (S.pv != null) unpreview(); else if (S.sel != null || S.concept) clearSel(); }
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
    close() { this.preview(null); $('panel').classList.remove('open', 'full', 'faded', 'mini'); $('q').value = ''; document.body.classList.remove('panel-open'), $('panel').inert = true; this.setCol(false); R.panel(false); sheetVar(); },
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
    head(kindHtml, code, en, zh, meta) { $('pkind').innerHTML = kindHtml; $('pcode').textContent = code; $('pen').textContent = en || ''; $('pzh').textContent = zh || ''; $('pmeta').innerHTML = meta || ''; },
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
          + (b.src && b.src.length ? `<br><span style="font-size:12px">Checked ${esc(b.chk)} against: ${b.src.map(x => `<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[0])} ↗</a>`).join(' · ')}</span>` : '') + `</div>`;
        if (b.pa && b.pa.length > 1) h += `<div class="info"><b>By citing Approved Document</b>${b.pa.map(r => `<div style="margin-top:6px;border-left:4px solid ${BSC[r[1]]};padding-left:8px"><b>${esc(r[0])}</b> cites ${esc(r[2])}: ${esc(BSW[r[1]])}${r[3] ? `<br><span style="font-size:12px">Title as printed there: ${esc(r[3])}</span>` : ''}</div>`).join('')}</div>`;
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
      return `<blockquote>“${esc(e.q)}”${e.qz ? `<br><span class="zh">${esc(e.qz)}</span>` : ''}${pg ? `<span class="pg">${esc(pg)}</span>` : ''}</blockquote>`;
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
  const dcnt = {}; N.forEach(n => { if (n.k === 'document') dcnt[n.dm] = (dcnt[n.dm] || 0) + 1; });
  const legCount = N.filter(n => HIDE_K.has(n.k)).length;
  const SHORT = { LEG: 'Acts and regulations', AD: 'Approved Documents', HSE: 'HSE guidance (L153)', BS: 'British Standards' };
  const SHORTZ = { BD: '', FSD: '', LandsD: '', PlanD: '', LEG: '', EXT: '' };
  const linesKey = () =>
      `<div class="lnk"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#a38a70" stroke-width="1.6"/></svg><span>Solid: explicit citation in the text</span></div>` +
      `<div class="lnk"><svg width="28" height="8"><line x1="0" y1="4" x2="28" y2="4" stroke="#2f2520" stroke-width="1.6" stroke-dasharray="4 3"/></svg><span>Dashed: AI-suggested link with reason<span class="zh">AI </span></span></div>` +
      Object.entries(BSW).map(([k, t]) => `<div class="lnk"><svg width="28" height="10"><circle cx="14" cy="5" r="4" fill="${BSC[k]}"/></svg><span>BS dot: ${t}</span></div>`).join('') +
      `<div class="lnk"><svg width="28" height="12"><circle cx="5" cy="6" r="2.2" fill="#8b7355"/><circle cx="19" cy="6" r="5.5" fill="#8b7355"/></svg><span>Size: number of citations</span></div>` +
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
      `<div class="row"><label><input type="checkbox" id="brt" ${S.bridges ? 'checked' : ''}><span class="t">AI suggested links <span class="zh">AI </span></span></label><span class="ct">${BR.length}</span></div>` +
      (MOBILE ? `<h4>Lines</h4>` + linesKey() : '');
    $('sideb').querySelectorAll('input[data-dept]').forEach(cb => cb.onchange = () => { S.dept[cb.dataset.dept] = cb.checked; filtersChanged(); });
    $('domsel').onchange = e => { S.dom = e.target.value; filtersChanged(); buildSide(); };
    $('sideb').querySelectorAll('.row.dom').forEach(r => r.onclick = () => { S.dom = S.dom === r.dataset.dom ? 'all' : r.dataset.dom; filtersChanged(); buildSide(); });
    if ($('legt')) $('legt').onchange = e => setLeg(e.target.checked);
    $('brt').onchange = e => { S.bridges = e.target.checked; filtersChanged(); };
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
  function addRecent(t) { t = String(t || '').trim(); if (!t) return; recent = [t, ...recent.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 8); saveRecent(); }
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
    if (!hits.length && q.value.trim()) h = `<li class="hd" style="text-transform:none;letter-spacing:0">No match. Try a code (AD B, Part L, SI 2023/909, BS 9991) or a title word (sprinkler). </li>`;
    ul.innerHTML = h; ul.classList.toggle('open', !!h); mark(); wireRows();
  }
  const mark = () => ul.querySelectorAll('li[data-k]').forEach(li => { const on = +li.dataset.k === act; li.classList.toggle('act', on); if (on) li.scrollIntoView({ block: 'nearest' }); });
  function pick(k) {
    const h = hits[k]; if (!h) return;
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.activeElement !== q && S.pv != null) { unpreview(); return; } if (e.key === 'Escape' && document.activeElement !== q && (S.sel != null || S.concept)) clearSel(); if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); } });

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
    fps: () => fpsHist.slice(), counts: () => ({ nodes: N.filter(n => n.vis).length, links: L.filter(l => l.vis).length })
  };
})();
