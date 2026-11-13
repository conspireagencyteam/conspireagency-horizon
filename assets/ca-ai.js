/*
 * ca-ai.js: the AI page's particle field (templates/page.ai.json).
 *
 * One WebGL2 canvas is fixed behind the page. It holds a single field of particles
 * that re-forms as the page scrolls: the Breathe sphere, the business brain (three
 * layouts), a store in outline, a lattice, and the sphere again. Every element with
 * [data-ai-scene] is a stop; the stop under the middle of the viewport sets the
 * formation and how far its story has played.
 *
 * No library. Layouts come from a fixed seed, so every load draws the same picture.
 * Everything drawn here is decorative (the canvas and the labels are aria-hidden);
 * the meaning lives in the sections' own copy.
 *
 * Fallbacks: no WebGL2 leaves the dark page and its copy; reduced motion draws one
 * still per stop and skips the enter gate.
 */

const root = document.querySelector('[data-ca-ai]');
if (root) start(root);

function start(root) {
  const canvas = root.querySelector('[data-ai-canvas]');
  const gl = canvas && canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;

  const debug = (window.__caAi = { frames: 0, ms: 0, scene: '', form: '' });
  if (!gl) {
    html.classList.add('ca-ai-static');
    html.classList.remove('ca-ai-gated', 'ca-ai-returning');
    return;
  }
  html.classList.add('ca-ai-live');
  if (reduced) html.classList.add('ca-ai-reduced');

  /* ---------------------------------------------------------------- helpers */

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (v, a = 0, b = 1) => {
    const t = clamp((v - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  const phone = window.matchMedia('(max-width: 749px)').matches;
  const lowPower = (navigator.hardwareConcurrency || 8) < 4;
  const N = phone || lowPower ? 42000 : 120000;
  const POINTER = 511; // state id of the travelling point
  const POINTER_COUNT = 260;
  const STATE_W = 512;

  /* Palette. Brand orange is the theme's accent; the brain's colours are the
     ones the real agency brain uses for its node kinds and link surfaces. */
  const ORANGE = [255, 77, 0];
  const WARM = [255, 232, 214];
  const DUST = [150, 160, 190];
  const GROUP = [
    { label: 'Team', color: [94, 234, 212], centre: [-1.0, 0.72, 0.1] },
    { label: 'Shopify store', color: [251, 191, 36], centre: [1.02, 0.66, -0.15] },
    { label: 'Code', color: [192, 132, 252], centre: [-0.92, -0.74, -0.1] },
    { label: 'Marketing', color: [96, 165, 250], centre: [1.0, -0.7, 0.15] },
  ];
  const SURFACE = [
    [54, 197, 240],
    [234, 67, 53],
    [232, 232, 232],
    [52, 211, 153],
    [163, 113, 247],
  ];

  /* ------------------------------------------------------------- formations */

  function blank() {
    return { pos: new Float32Array(N * 3), col: new Uint8Array(N * 4), meta: new Float32Array(N * 2) };
  }
  function put(f, i, x, y, z, c, a, id, size) {
    f.pos[i * 3] = x;
    f.pos[i * 3 + 1] = y;
    f.pos[i * 3 + 2] = z;
    f.col[i * 4] = c[0];
    f.col[i * 4 + 1] = c[1];
    f.col[i * 4 + 2] = c[2];
    f.col[i * 4 + 3] = Math.round(a * 255);
    f.meta[i * 2] = id;
    f.meta[i * 2 + 1] = size;
  }
  /* The last POINTER_COUNT particles are the travelling point in every formation
     but the sphere: a small bright clump at the origin that a uniform moves. */
  function putPointer(f, r) {
    for (let i = N - POINTER_COUNT; i < N; i++) {
      put(f, i, gauss(r) * 0.018, gauss(r) * 0.018, gauss(r) * 0.018, [255, 255, 255], 0.4, POINTER, i === N - 1 ? 6 : 1.3);
    }
  }

  function buildSphere() {
    const r = rng(11);
    const f = blank();
    for (let i = 0; i < N; i++) {
      // Breathe's distribution: a Gaussian shell with no hard edge.
      const theta = r() * Math.PI * 2;
      const phi = Math.acos(2 * r() - 1);
      const radius = 0.4 + Math.abs(gauss(r)) * 0.35;
      put(
        f,
        i,
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        ORANGE,
        0.8,
        0,
        // Fine grain: most of the cloud is drawn at about a pixel.
        0.42 + r() * 0.5
      );
    }
    return f;
  }

  function buildBrain() {
    const r = rng(23);
    const K = 160;
    const CLUSTERS = 12;
    const nodes = [];
    const centres = [];
    for (let c = 0; c < CLUSTERS; c++) {
      // Fibonacci sphere, slightly flattened.
      const y = 1 - (c + 0.5) * (2 / CLUSTERS);
      const rad = Math.sqrt(1 - y * y);
      const th = c * 2.399963;
      centres.push([Math.cos(th) * rad * 1.25, y * 1.05, Math.sin(th) * rad * 1.25]);
    }
    for (let i = 0; i < K; i++) {
      const group = i % 4;
      const cluster = i < CLUSTERS ? i : Math.floor(r() * CLUSTERS);
      const hub = i < CLUSTERS;
      const w = hub ? 2.3 : 0.6 + r() * r() * 1.3;
      const g = GROUP[group].centre;
      const b1 = [g[0] + gauss(r) * 0.3, g[1] + gauss(r) * 0.24, g[2] + gauss(r) * 0.3];
      const rr = Math.cbrt(r()) * 1.5;
      const t2 = r() * Math.PI * 2;
      const p2 = Math.acos(2 * r() - 1);
      const b2 = [rr * Math.sin(p2) * Math.cos(t2), rr * Math.sin(p2) * Math.sin(t2) * 0.85, rr * Math.cos(p2)];
      const cc = centres[cluster];
      const b3 = hub ? cc.slice() : [cc[0] + gauss(r) * 0.2, cc[1] + gauss(r) * 0.2, cc[2] + gauss(r) * 0.2];
      nodes.push({ group, cluster, hub, w, b1, b2, b3 });
    }

    const edges = [];
    const seen = new Set();
    const link = (a, b) => {
      if (a === b) return;
      const key = a < b ? a + ':' + b : b + ':' + a;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ a, b, intra: nodes[a].group === nodes[b].group, order: r(), surface: Math.floor(r() * SURFACE.length) });
    };
    const byCluster = Array.from({ length: CLUSTERS }, () => []);
    nodes.forEach((n, i) => byCluster[n.cluster].push(i));
    nodes.forEach((n, i) => {
      if (n.hub) return;
      link(i, n.cluster); // every record reaches its topic
      if (r() < 0.5) link(i, byCluster[n.cluster][Math.floor(r() * byCluster[n.cluster].length)]);
    });
    for (let c = 0; c < CLUSTERS; c++) {
      const near = centres
        .map((p, j) => [j, Math.hypot(p[0] - centres[c][0], p[1] - centres[c][1], p[2] - centres[c][2])])
        .filter((e) => e[0] !== c)
        .sort((x, y) => x[1] - y[1]);
      link(c, near[0][0]);
      link(c, near[1][0]);
    }
    // A little wiring inside each source, so the islands of act one are not bare.
    const byGroup = [[], [], [], []];
    nodes.forEach((n, i) => byGroup[n.group].push(i));
    for (let k = 0; k < 44; k++) {
      const g = byGroup[k % 4];
      link(g[Math.floor(r() * g.length)], g[Math.floor(r() * g.length)]);
    }

    const forms = { b1: blank(), b2: blank(), b3: blank() };
    const body = N - POINTER_COUNT;
    const inNodes = Math.floor(body * 0.5);
    const totalW = nodes.reduce((s, n) => s + n.w, 0);
    let i = 0;
    nodes.forEach((n, id) => {
      const count = Math.max(12, Math.floor((inNodes * n.w) / totalW));
      const sigma = 0.02 + 0.022 * n.w;
      const color = GROUP[n.group].color;
      for (let k = 0; k < count && i < inNodes; k++, i++) {
        const core = k === 0;
        const ox = core ? 0 : gauss(r) * sigma;
        const oy = core ? 0 : gauss(r) * sigma;
        const oz = core ? 0 : gauss(r) * sigma;
        const c = core ? color.map((v) => Math.round(v * 0.55 + 255 * 0.45)) : color;
        for (const key of ['b1', 'b2', 'b3']) {
          const p = n[key];
          put(forms[key], i, p[0] + ox, p[1] + oy, p[2] + oz, c, core ? 0.95 : 0.34, id + 1, core ? 4 + 3 * n.w : 1.15);
        }
      }
    });
    for (; i < body; i++) {
      const g = GROUP[Math.floor(r() * 4)].centre;
      put(forms.b1, i, g[0] + gauss(r) * 0.62, g[1] + gauss(r) * 0.5, g[2] + gauss(r) * 0.6, DUST, 0.16, 0, 1);
      const rr = Math.cbrt(r()) * 2.1;
      const t = r() * Math.PI * 2;
      const p = Math.acos(2 * r() - 1);
      put(forms.b2, i, rr * Math.sin(p) * Math.cos(t), rr * Math.sin(p) * Math.sin(t) * 0.8, rr * Math.cos(p), DUST, 0.14, 0, 1);
      const cc = centres[Math.floor(r() * CLUSTERS)];
      put(forms.b3, i, cc[0] + gauss(r) * 0.48, cc[1] + gauss(r) * 0.44, cc[2] + gauss(r) * 0.48, DUST, 0.15, 0, 1);
    }
    putPointer(forms.b1, r);
    putPointer(forms.b2, r);
    putPointer(forms.b3, r);

    // Lines: two vertices per edge, a position set per layout.
    const E = edges.length;
    const lines = { count: E * 2, pos: {}, col: new Uint8Array(E * 8), id: new Float32Array(E * 2) };
    for (const key of ['b1', 'b2', 'b3']) {
      const arr = new Float32Array(E * 6);
      edges.forEach((e, k) => {
        arr.set(nodes[e.a][key], k * 6);
        arr.set(nodes[e.b][key], k * 6 + 3);
      });
      lines.pos[key] = arr;
    }
    edges.forEach((e, k) => {
      const c = SURFACE[e.surface];
      lines.col.set([c[0], c[1], c[2], 110, c[0], c[1], c[2], 110], k * 8);
      lines.id[k * 2] = k;
      lines.id[k * 2 + 1] = k;
    });

    // The retrieval path: from one topic outward to eight records in a few hops.
    const adj = nodes.map(() => []);
    edges.forEach((e, k) => {
      adj[e.a].push([e.b, k]);
      adj[e.b].push([e.a, k]);
    });
    const entry = 3;
    const depth = new Map([[entry, 0]]);
    const parent = new Map();
    const queue = [entry];
    while (queue.length) {
      const a = queue.shift();
      for (const [b, k] of adj[a]) {
        if (depth.has(b)) continue;
        depth.set(b, depth.get(a) + 1);
        parent.set(b, [a, k]);
        queue.push(b);
      }
    }
    const targets = [];
    const perGroup = [0, 0, 0, 0];
    const usedCluster = new Set();
    const candidates = [...depth.entries()].filter(([n, d]) => d >= 2 && d <= 4 && !nodes[n].hub).sort((x, y) => x[1] - y[1] || x[0] - y[0]);
    for (const [n] of candidates) {
      if (targets.length >= 8) break;
      if (perGroup[nodes[n].group] >= 2 || usedCluster.has(nodes[n].cluster)) continue;
      perGroup[nodes[n].group]++;
      usedCluster.add(nodes[n].cluster);
      targets.push(n);
    }
    const pathEdges = new Map(); // edge index -> depth at which it lights
    const pathNodes = new Map([[entry, 0]]);
    let maxDepth = 1;
    for (const t of targets) {
      let n = t;
      while (parent.has(n)) {
        const [a, k] = parent.get(n);
        pathEdges.set(k, depth.get(n));
        pathNodes.set(n, depth.get(n));
        maxDepth = Math.max(maxDepth, depth.get(n));
        n = a;
      }
    }
    const scan = nodes.map((_, k) => k).sort(() => r() - 0.5).slice(0, 46);
    return { forms, nodes, edges, lines, targets, pathEdges, pathNodes, maxDepth, scan, entry };
  }

  /* A store in outline: a desktop window and a phone, each a set of regions the
     story lights in turn. Regions are state ids. */
  const R = { chrome: 1, nav: 2, hero: 3, tileA: 4, tileB: 5, tileC: 6, tileD: 7, cart: 8, checkout: 9, pChrome: 10, pNav: 11, pHero: 12, pTiles: 13, pButton: 14 };
  function buildStore() {
    const r = rng(37);
    const f = blank();
    const segs = [];
    const fills = [];
    const seg = (x1, y1, x2, y2, z, id) => segs.push({ x1, y1, x2, y2, z, id, len: Math.hypot(x2 - x1, y2 - y1) });
    const rect = (x1, y1, x2, y2, z, id, fill) => {
      seg(x1, y1, x2, y1, z, id);
      seg(x2, y1, x2, y2, z, id);
      seg(x2, y2, x1, y2, z, id);
      seg(x1, y2, x1, y1, z, id);
      if (fill) fills.push({ x1, y1, x2, y2, z, id, area: Math.abs((x2 - x1) * (y2 - y1)) * fill });
    };
    // Desktop window.
    rect(-1.15, -0.62, 0.85, 0.62, 0, R.chrome);
    seg(-1.15, 0.5, 0.85, 0.5, 0, R.chrome);
    for (let d = 0; d < 3; d++) rect(-1.09 + d * 0.06, 0.545, -1.065 + d * 0.06, 0.57, 0, R.chrome);
    rect(-0.6, 0.535, 0.3, 0.585, 0, R.chrome);
    rect(-1.05, 0.38, -0.82, 0.44, 0, R.nav, 1);
    for (let d = 0; d < 4; d++) seg(-0.5 + d * 0.22, 0.41, -0.36 + d * 0.22, 0.41, 0, R.nav);
    rect(0.66, 0.38, 0.74, 0.44, 0, R.nav);
    rect(-1.05, -0.04, 0.75, 0.3, 0, R.hero, 0.5);
    seg(-0.95, 0.19, -0.3, 0.19, 0, R.hero);
    seg(-0.95, 0.12, -0.48, 0.12, 0, R.hero);
    rect(-0.95, 0.01, -0.7, 0.07, 0, R.hero, 1);
    const tiles = [R.tileA, R.tileB, R.tileC, R.tileD];
    tiles.forEach((id, k) => {
      const x = -1.05 + k * 0.4625;
      rect(x, -0.5, x + 0.4125, -0.14, 0, id, 0.6);
      seg(x + 0.04, -0.4, x + 0.3, -0.4, 0, id);
      seg(x + 0.04, -0.45, x + 0.18, -0.45, 0, id);
    });
    // Cart drawer and its checkout button: unseen until the walk reaches them.
    rect(0.36, -0.62, 0.85, 0.5, 0.06, R.cart, 0.35);
    for (let d = 0; d < 3; d++) {
      rect(0.41, 0.26 - d * 0.2, 0.52, 0.37 - d * 0.2, 0.06, R.cart, 1);
      seg(0.56, 0.34 - d * 0.2, 0.79, 0.34 - d * 0.2, 0.06, R.cart);
      seg(0.56, 0.29 - d * 0.2, 0.7, 0.29 - d * 0.2, 0.06, R.cart);
    }
    seg(0.41, -0.36, 0.8, -0.36, 0.06, R.cart);
    rect(0.41, -0.56, 0.8, -0.45, 0.06, R.checkout, 1.6);
    // Phone, in front and to the right.
    rect(0.98, -0.82, 1.44, 0.1, 0.3, R.pChrome);
    seg(1.15, 0.06, 1.27, 0.06, 0.3, R.pChrome);
    seg(1.03, -0.02, 1.16, -0.02, 0.3, R.pNav);
    rect(1.34, -0.04, 1.39, 0, 0.3, R.pNav);
    rect(1.03, -0.34, 1.39, -0.08, 0.3, R.pHero, 0.6);
    rect(1.03, -0.62, 1.195, -0.39, 0.3, R.pTiles, 0.6);
    rect(1.225, -0.62, 1.39, -0.39, 0.3, R.pTiles, 0.6);
    rect(1.03, -0.77, 1.39, -0.68, 0.3, R.pButton, 1.6);

    const body = N - POINTER_COUNT;
    const onEdges = Math.floor(body * 0.62);
    const inFills = Math.floor(body * 0.16);
    const totalLen = segs.reduce((s, e) => s + e.len, 0);
    const totalArea = fills.reduce((s, e) => s + e.area, 0);
    let i = 0;
    for (const s of segs) {
      const count = Math.floor((onEdges * s.len) / totalLen);
      for (let k = 0; k < count && i < onEdges; k++, i++) {
        const t = r();
        put(f, i, lerp(s.x1, s.x2, t) + gauss(r) * 0.0035, lerp(s.y1, s.y2, t) + gauss(r) * 0.0035, s.z + gauss(r) * 0.006, WARM, 0.3, s.id, 1.1);
      }
    }
    for (; i < onEdges; i++) put(f, i, gauss(r) * 1.6, gauss(r) * 0.9, -0.5 + gauss(r) * 0.4, DUST, 0.1, 0, 1);
    const fillStart = i;
    for (const s of fills) {
      const count = Math.floor((inFills * s.area) / totalArea);
      for (let k = 0; k < count && i < fillStart + inFills; k++, i++) {
        put(f, i, lerp(s.x1, s.x2, r()), lerp(s.y1, s.y2, r()), s.z + gauss(r) * 0.004, WARM, 0.1, s.id, 1);
      }
    }
    for (; i < body; i++) put(f, i, gauss(r) * 1.7, gauss(r) * 1.0, -0.6 + gauss(r) * 0.55, DUST, 0.1, 0, 1);
    putPointer(f, r);
    const centre = {
      [R.nav]: [-0.5, 0.41, 0],
      [R.hero]: [-0.15, 0.13, 0],
      [R.tileA]: [-0.84, -0.32, 0],
      [R.tileB]: [-0.38, -0.32, 0],
      [R.tileC]: [0.08, -0.32, 0],
      [R.tileD]: [0.54, -0.32, 0],
      [R.cart]: [0.6, 0.1, 0.06],
      [R.checkout]: [0.6, -0.505, 0.06],
    };
    return { form: f, centre };
  }

  /* A lattice: nodes on a grid, particles along every edge. Node ids start at 1,
     edge ids follow. */
  function buildLattice() {
    const r = rng(53);
    const f = blank();
    const NX = 6;
    const NY = 4;
    const NZ = 3;
    const S = 0.5;
    const nodes = [];
    const index = (x, y, z) => x + y * NX + z * NX * NY;
    for (let z = 0; z < NZ; z++) for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) nodes.push([(x - (NX - 1) / 2) * S, (y - (NY - 1) / 2) * S, (z - (NZ - 1) / 2) * S]);
    const edges = [];
    const adj = nodes.map(() => []);
    const link = (a, b) => {
      adj[a].push([b, edges.length]);
      adj[b].push([a, edges.length]);
      edges.push([a, b]);
    };
    for (let z = 0; z < NZ; z++)
      for (let y = 0; y < NY; y++)
        for (let x = 0; x < NX; x++) {
          if (x + 1 < NX) link(index(x, y, z), index(x + 1, y, z));
          if (y + 1 < NY) link(index(x, y, z), index(x, y + 1, z));
          if (z + 1 < NZ) link(index(x, y, z), index(x, y, z + 1));
        }
    const nodeId = (n) => n + 1;
    const edgeId = (e) => nodes.length + 1 + e;
    const body = N - POINTER_COUNT;
    const inNodes = Math.floor(body * 0.2);
    const onEdges = Math.floor(body * 0.52);
    let i = 0;
    const perNode = Math.floor(inNodes / nodes.length);
    nodes.forEach((p, n) => {
      for (let k = 0; k < perNode; k++, i++) {
        const core = k === 0;
        put(f, i, p[0] + (core ? 0 : gauss(r) * 0.028), p[1] + (core ? 0 : gauss(r) * 0.028), p[2] + (core ? 0 : gauss(r) * 0.028), core ? [255, 190, 150] : ORANGE, core ? 0.9 : 0.36, nodeId(n), core ? 7 : 1.15);
      }
    });
    const perEdge = Math.floor(onEdges / edges.length);
    edges.forEach(([a, b], e) => {
      for (let k = 0; k < perEdge; k++, i++) {
        const t = r();
        put(f, i, lerp(nodes[a][0], nodes[b][0], t) + gauss(r) * 0.004, lerp(nodes[a][1], nodes[b][1], t) + gauss(r) * 0.004, lerp(nodes[a][2], nodes[b][2], t) + gauss(r) * 0.004, [255, 150, 96], 0.2, edgeId(e), 1);
      }
    });
    for (; i < body; i++) put(f, i, gauss(r) * 1.7, gauss(r) * 1.1, gauss(r) * 1.0, DUST, 0.1, 0, 1);
    putPointer(f, r);

    const broken = index(3, 2, 1);
    const from = index(0, 0, 0);
    // Shortest way in from a corner.
    const prev = new Map([[from, null]]);
    const dist = new Map([[broken, 0]]);
    let queue = [from];
    while (queue.length) {
      const a = queue.shift();
      for (const [b, e] of adj[a]) {
        if (prev.has(b)) continue;
        prev.set(b, [a, e]);
        queue.push(b);
      }
    }
    const trace = [];
    for (let n = broken; prev.get(n); n = prev.get(n)[0]) trace.unshift({ node: n, edge: prev.get(n)[1], from: prev.get(n)[0] });
    queue = [broken];
    let far = 0;
    while (queue.length) {
      const a = queue.shift();
      for (const [b] of adj[a]) {
        if (dist.has(b)) continue;
        dist.set(b, dist.get(a) + 1);
        far = Math.max(far, dist.get(b));
        queue.push(b);
      }
    }
    return { form: f, nodes, edges, adj, broken, from, trace, dist, far, nodeId, edgeId };
  }

  /* ----------------------------------------------------------------- shaders */

  const XF = `
    vec3 xf(vec3 p, vec4 x, float tilt) {
      float c = cos(x.x), s = sin(x.x);
      p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
      float ct = cos(tilt), st = sin(tilt);
      p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
      p *= x.y;
      p.xy += x.zw;
      return p;
    }`;

  const POINT_VS = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aFrom;
    layout(location=1) in vec3 aTo;
    layout(location=2) in vec4 aColFrom;
    layout(location=3) in vec4 aColTo;
    layout(location=4) in vec2 aMetaFrom;
    layout(location=5) in vec2 aMetaTo;
    layout(location=6) in vec4 aSeed;
    uniform float uT, uStagger, uTime, uBreath, uCamZ, uPx, uDim;
    uniform vec4 uXfFrom, uXfTo;
    uniform float uTiltFrom, uTiltTo;
    uniform vec3 uPtrFrom, uPtrTo;
    uniform sampler2D uStateFrom, uStateTo;
    uniform mat4 uProj;
    out vec4 vCol;
    ${XF}
    vec3 tintOf(float sel) {
      if (sel < 0.5) return vec3(1.0, 0.97, 0.94);
      if (sel < 1.5) return vec3(1.0, 0.22, 0.16);
      if (sel < 2.5) return vec3(0.46, 0.9, 0.56);
      return vec3(1.0, 0.3, 0.0);
    }
    void shade(vec4 col, vec4 s, out vec3 c, out float a, out float grow) {
      c = mix(col.rgb, tintOf(s.a * 255.0), s.b);
      a = col.a * s.r * (1.0 + s.g * 1.3);
      grow = 1.0 + s.g * 0.45;
    }
    void main() {
      float t = clamp((uT - aSeed.y * 0.45 * uStagger) / (1.0 - 0.45 * uStagger), 0.0, 1.0);
      t = t * t * (3.0 - 2.0 * t);
      vec3 a = aFrom;
      vec3 b = aTo;
      if (aMetaFrom.x > 510.5) a += uPtrFrom;
      if (aMetaTo.x > 510.5) b += uPtrTo;
      // A slow private drift keeps every particle alive without moving the shape.
      vec3 drift = vec3(sin(aSeed.x * 6.283 + uTime * 0.21), cos(aSeed.x * 4.1 + uTime * 0.17), sin(aSeed.x * 9.7 - uTime * 0.19)) * 0.006;
      a = xf((a + drift) * uBreath, uXfFrom, uTiltFrom);
      b = xf((b + drift) * uBreath, uXfTo, uTiltTo);
      vec3 p = mix(a, b, t);
      // Between two shapes the field loosens, then gathers again.
      float mid = sin(t * 3.14159);
      vec3 n = vec3(sin(aSeed.x * 12.9898 + uTime * 0.3), cos(aSeed.x * 78.233 + uTime * 0.27), sin(aSeed.x * 37.719 - uTime * 0.21));
      p += n * mid * 0.32 * aSeed.z * uStagger;

      vec3 ca, cb; float aa, ab, ga, gb;
      shade(aColFrom, texelFetch(uStateFrom, ivec2(int(aMetaFrom.x), 0), 0), ca, aa, ga);
      shade(aColTo, texelFetch(uStateTo, ivec2(int(aMetaTo.x), 0), 0), cb, ab, gb);
      vec3 c = mix(ca, cb, t);
      float alpha = mix(aa, ab, t);
      float size = mix(aMetaFrom.y * ga, aMetaTo.y * gb, t);

      vec4 mv = vec4(p.x, p.y, p.z - uCamZ, 1.0);
      gl_Position = uProj * mv;
      float px = size * uPx / -mv.z;
      // A point thinner than a pixel is drawn as one pixel, proportionally fainter.
      alpha *= min(1.0, px * px) * uDim;
      gl_PointSize = max(1.0, px);
      vCol = vec4(c * alpha, alpha);
    }`;

  const POINT_FS = `#version 300 es
    precision mediump float;
    in vec4 vCol;
    out vec4 o;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float a = smoothstep(1.0, 0.0, dot(d, d) * 4.0);
      o = vCol * a;
    }`;

  const LINE_VS = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 aFrom;
    layout(location=1) in vec3 aTo;
    layout(location=2) in vec4 aCol;
    layout(location=3) in float aId;
    uniform float uT, uBreath, uCamZ, uAlpha;
    uniform vec4 uXfFrom, uXfTo;
    uniform float uTiltFrom, uTiltTo;
    uniform sampler2D uState;
    uniform mat4 uProj;
    out vec4 vCol;
    ${XF}
    void main() {
      float t = uT * uT * (3.0 - 2.0 * uT);
      vec3 p = mix(xf(aFrom * uBreath, uXfFrom, uTiltFrom), xf(aTo * uBreath, uXfTo, uTiltTo), t);
      vec4 s = texelFetch(uState, ivec2(int(aId), 0), 0);
      vec3 c = mix(aCol.rgb, vec3(1.0, 0.9, 0.8), s.g);
      float a = aCol.a * s.r * (1.0 + s.g * 1.6) * uAlpha;
      gl_Position = uProj * vec4(p.x, p.y, p.z - uCamZ, 1.0);
      vCol = vec4(c * a, a);
    }`;

  const LINE_FS = `#version 300 es
    precision mediump float;
    in vec4 vCol;
    out vec4 o;
    void main() { o = vCol; }`;

  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [
      [gl.VERTEX_SHADER, vs],
      [gl.FRAGMENT_SHADER, fs],
    ]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  /* -------------------------------------------------------------- GL set-up */

  let points;
  let linesProg;
  try {
    points = program(POINT_VS, POINT_FS);
    linesProg = program(LINE_VS, LINE_FS);
  } catch (error) {
    html.classList.remove('ca-ai-live', 'ca-ai-gated', 'ca-ai-returning');
    html.classList.add('ca-ai-static');
    return;
  }

  const brain = buildBrain();
  const store = buildStore();
  const lattice = buildLattice();
  const FORMS = { sphere: buildSphere(), b1: brain.forms.b1, b2: brain.forms.b2, b3: brain.forms.b3, store: store.form, lattice: lattice.form };

  const buffer = (data, target = gl.ARRAY_BUFFER) => {
    const b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return b;
  };
  const stateTexture = () => {
    const data = new Uint8Array(STATE_W * 4);
    for (let i = 0; i < STATE_W; i++) data[i * 4] = 255; // everything visible until a scene says otherwise
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, STATE_W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return { tex, data };
  };
  const upload = (s) => {
    gl.bindTexture(gl.TEXTURE_2D, s.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, STATE_W, 1, gl.RGBA, gl.UNSIGNED_BYTE, s.data);
  };

  const GLF = {};
  for (const [key, f] of Object.entries(FORMS)) {
    GLF[key] = { pos: buffer(f.pos), col: buffer(f.col), meta: buffer(f.meta), state: stateTexture() };
  }
  // The three brain layouts are one graph, so they share one state.
  GLF.b2.state = GLF.b1.state;
  GLF.b3.state = GLF.b1.state;

  const seed = new Float32Array(N * 4);
  {
    const r = rng(7);
    for (let i = 0; i < N * 4; i++) seed[i] = r();
  }
  const seedBuf = buffer(seed);
  const pointVao = gl.createVertexArray();
  gl.bindVertexArray(pointVao);
  for (let i = 0; i < 7; i++) gl.enableVertexAttribArray(i);
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 0, 0);

  const lineVao = gl.createVertexArray();
  gl.bindVertexArray(lineVao);
  for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
  const lineBuf = { b1: buffer(brain.lines.pos.b1), b2: buffer(brain.lines.pos.b2), b3: buffer(brain.lines.pos.b3) };
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer(brain.lines.col));
  gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer(brain.lines.id));
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
  const linkState = stateTexture();
  gl.bindVertexArray(null);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(13 / 255, 17 / 255, 13 / 255, 1);

  /* ------------------------------------------------------------------ view */

  const CAM_Z = 5;
  const F = 1 / Math.tan((60 * Math.PI) / 360);
  const proj = new Float32Array(16);
  let W = 1;
  let H = 1;
  let aspect = 1;
  let dpr = 1;

  function resize() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    aspect = W / H;
    dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2);
    if (W * H * dpr * dpr > 5200000) dpr = Math.sqrt(5200000 / (W * H));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const near = 0.1;
    const far = 40;
    proj.fill(0);
    proj[0] = F / aspect;
    proj[5] = F;
    proj[10] = (far + near) / (near - far);
    proj[11] = -1;
    proj[14] = (2 * far * near) / (near - far);
  }

  /* Where each formation sits: beside the copy on a wide screen, above it on a
     narrow one. Returns angle, scale, x, y and tilt. */
  function placement(form, time, centred) {
    const halfW = (CAM_Z / F) * aspect;
    const wide = aspect > 0.95;
    if (form === 'sphere') {
      // At the close it rides a little higher, clear of the last statement.
      return { angle: time * 0.117, scale: wide ? (centred ? 1.2 : 1.3) : 1.0, x: 0, y: wide ? (centred ? 0.82 : 0.55) : centred ? 0.9 : 0.75, tilt: 0 };
    }
    // The drawing's own column: the right 56% of a wide screen, the top of a narrow one.
    // Under a chapter title it sits in the middle of the screen instead.
    const cx = wide && !centred ? halfW * 0.4 : 0;
    const cy = wide || centred ? 0 : 0.9;
    const room = wide ? halfW * (centred ? 1.3 : 1.12) : halfW * 1.84;
    if (form === 'store') {
      const scale = Math.min(room / 3.35, 1.8);
      return { angle: -0.2 + Math.sin(time * 0.23) * 0.13, scale, x: cx - 0.145 * scale, y: cy + 0.1 * scale, tilt: -0.05 };
    }
    if (form === 'lattice') {
      return { angle: 0.35 + Math.sin(time * 0.11) * 0.3, scale: Math.min(room / 4.5, 1.25), x: cx, y: cy, tilt: 0.3 };
    }
    return { angle: time * 0.045, scale: Math.min(room / 3.4, 1.18), x: cx, y: cy, tilt: 0.2 };
  }
  function project(local, place, breath) {
    let [x, y, z] = local;
    x *= breath;
    y *= breath;
    z *= breath;
    const c = Math.cos(place.angle);
    const s = Math.sin(place.angle);
    [x, z] = [x * c - z * s, x * s + z * c];
    const ct = Math.cos(place.tilt);
    const st = Math.sin(place.tilt);
    [y, z] = [y * ct - z * st, y * st + z * ct];
    x = x * place.scale + place.x;
    y = y * place.scale + place.y;
    z *= place.scale;
    const d = CAM_Z - z;
    return [((x * F) / aspect / d + 1) * 0.5 * W, (1 - (y * F) / d) * 0.5 * H, d];
  }

  /* ---------------------------------------------------------------- scenes */

  const SCENE_FORM = { open: 'sphere', brain: ['b1', 'b2', 'b3'], manager: ['store'], healing: ['lattice'], close: ['sphere'] };
  let stops = [];
  function measure() {
    stops = [...document.querySelectorAll('[data-ai-scene]')].map((el) => {
      const [name, n] = (el.dataset.aiScene || 'open').split('-');
      // Stop 0 of a chapter is its title card: the chapter's first drawing, at rest, centred.
      const opener = n === '0';
      const index = Math.max(1, parseInt(n || '1', 10));
      const forms = SCENE_FORM[name];
      const form = Array.isArray(forms) ? forms[Math.min(index, forms.length) - 1] : forms || 'sphere';
      const say = el.querySelector('[data-ai-say]');
      const words = say ? splitWords(say) : 0;
      // lead: the statement lights first (55 ms a word, as in the stylesheet), then the story starts.
      return { el, name, act: Math.min(index, 3), form, opener, centred: opener, lead: 0.55 + words * 0.055, inst: el.querySelector('[data-ai-inst]'), chapter: el.closest('[data-ai-chapter]') };
    });
    buildRail();
    bindBars();
  }
  /* A statement becomes one span per word, so each can light in turn. The whole
     sentence stays the heading's accessible name. */
  function splitWords(el) {
    if (el.dataset.aiSplit) return Number(el.dataset.aiSplit);
    if (reduced) return 0;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text || el.children.length) return 0;
    const words = text.split(' ');
    el.dataset.aiSplit = String(words.length);
    el.setAttribute('aria-label', text);
    el.style.setProperty('--n', words.length);
    const act = el.closest('[data-ai-scene]');
    if (act) act.style.setProperty('--n', words.length);
    el.replaceChildren(
      ...words.flatMap((word, i) => {
        const span = document.createElement('span');
        span.className = 'ca-ai-w';
        span.setAttribute('aria-hidden', 'true');
        span.style.setProperty('--i', i);
        span.textContent = word;
        return i ? [' ', span] : [span];
      })
    );
    return words.length;
  }
  /* Positions are read from the viewport each frame, never from a scroll offset:
     on wide screens the theme scrolls .page-wrapper, on phones the window. */
  let pastEnd = false;
  function locate() {
    const mid = window.innerHeight * 0.5;
    let current = 0;
    let rect = null;
    for (let i = 0; i < stops.length; i++) {
      const r = stops[i].el.getBoundingClientRect();
      stops[i].h = r.height;
      if (i === 0 || mid >= r.top) {
        current = i;
        rect = r;
      }
      if (i === stops.length - 1) pastEnd = r.bottom < -40;
    }
    const p = rect ? clamp((mid - rect.top) / Math.max(1, rect.height)) : 0;
    // pin: the share of the stop spent arriving (and again leaving). Between the
    // two its content is pinned to the screen.
    const pin = rect ? Math.min(0.45, (window.innerHeight * 0.5) / Math.max(1, rect.height)) : 0.25;
    // inside: the middle of the screen is still within this stop, not below the last one.
    return { index: current, p, pin, inside: !!rect && mid <= rect.bottom };
  }

  /* State writers. vis and glow are 0 to 1; tint mixes toward white (0), alert
     (1), passed (2) or brand orange (3). */
  const setState = (state, id, vis, glow = 0, tint = 0, sel = 0) => {
    const o = id * 4;
    state.data[o] = Math.round(clamp(vis) * 255);
    state.data[o + 1] = Math.round(clamp(glow) * 255);
    state.data[o + 2] = Math.round(clamp(tint) * 255);
    state.data[o + 3] = sel;
  };
  const fillState = (state, count, vis) => {
    for (let i = 0; i < count; i++) setState(state, i, vis);
    setState(state, POINTER, 0);
  };

  const fmt = new Intl.NumberFormat('en-US');
  const pointer = { b1: [0, 0, 0], b2: [0, 0, 0], b3: [0, 0, 0], store: [0, 0, 0], lattice: [0, 0, 0], sphere: [0, 0, 0] };
  const mixPoint = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const QUESTION = 'Why did checkout conversion dip last week?';
  const ANSWER = 'A release on Tuesday moved the shipping estimate out of view on phones. Support heard about it on Wednesday. Ad spend followed the same product on Thursday.';
  const SOURCE_LABELS = ['Call', 'Slack thread', 'Release', 'Ad change', 'Store metric'];
  const PIPELINE = ['Found', 'Diagnosed', 'Fix written', 'Reviewed', 'Merged', 'Verified'];

  /* Each scene writes the state of its formation for progress u (0 to 1) and
     returns what the overlay should show. */
  const SCENES = {
    open() {
      return {};
    },
    close() {
      return {};
    },

    brain(act, u, time) {
      const s = GLF.b1.state;
      const K = brain.nodes.length;
      fillState(s, K + 1, 1);
      const out = { labels: [], inst: null };
      const E = brain.edges.length;
      // more: { answer, said, sources, cited }: the answer and its sources, and how far each has arrived (0 to 1).
      const ask = (typed, tone, status, more) => ({ kind: 'prompt', typed, tone, status, ...more });
      if (act === 1) {
        brain.edges.forEach((e, k) => setState(linkState, k, e.intra ? 0.5 * smooth(u, 0, 0.3) : 0));
        GROUP.forEach((g, k) => out.labels.push({ key: 'g' + k, at: g.centre, form: 'b1', text: g.label, alpha: smooth(u, 0.05, 0.25), dy: -1 }));
        out.inst = ask(clamp((u - 0.06) / 0.42), u > 0.62 ? 'thin' : u > 0.5 ? 'reading' : '', u > 0.62 ? 'No clear answer. ' + GROUP.length + ' sources, 0 links between them.' : u > 0.5 ? 'Looking' : '');
      } else if (act === 2) {
        const reveal = u / 0.34;
        brain.edges.forEach((e, k) => setState(linkState, k, e.intra ? 0.5 : 0.5 * smooth(reveal, e.order * 0.8, e.order * 0.8 + 0.2)));
        const scan = clamp((u - 0.3) / 0.7);
        const steps = brain.scan.length - 1;
        const at = scan * steps;
        const k = Math.floor(at);
        const f = smooth(at - k, 0.25, 0.75);
        if (u > 0.3) {
          for (let j = 0; j <= k; j++) setState(s, brain.scan[j] + 1, 1, j === k ? 1 - f * 0.6 : 0.12, 0.5, 0);
          const a = brain.nodes[brain.scan[k]].b2;
          const b = brain.nodes[brain.scan[Math.min(steps, k + 1)]].b2;
          pointer.b2 = mixPoint(a, b, f);
          setState(s, POINTER, 1, 0.6);
        }
        // The readout counts what the drawing shows: its links, then its records.
        let joined = 0;
        for (const e of brain.edges) if (e.intra || reveal >= e.order * 0.8 + 0.1) joined++;
        if (u > 0.3) out.link = { at: pointer.b2, alpha: 1 };
        out.inst = ask(1, 'reading', u > 0.3 ? 'Reading everything, in order. ' + fmt.format(Math.min(steps, k) + 1) + ' of ' + fmt.format(K) + ' records.' : 'Connecting. ' + fmt.format(joined) + ' of ' + fmt.format(E) + ' links.');
      } else {
        const q = clamp((u - 0.1) / 0.5);
        const front = q * (brain.maxDepth + 0.6);
        const settle = smooth(u, 0.08, 0.5);
        for (let k = 0; k < E; k++) {
          const d = brain.pathEdges.get(k);
          if (d === undefined) setState(linkState, k, lerp(0.5, 0.16, settle));
          else setState(linkState, k, 0.5 + 0.5 * smooth(front, d - 1, d), smooth(front, d - 1, d));
        }
        for (let n = 0; n < K; n++) {
          const d = brain.pathNodes.get(n);
          if (d === undefined) setState(s, n + 1, lerp(1, 0.34, settle));
          else {
            const hit = smooth(front, d - 0.3, d + 0.3);
            const target = brain.targets.includes(n);
            setState(s, n + 1, 1, hit * (target ? 1 : 0.5), hit * (target ? 0.75 : 0.3), 0);
          }
        }
        setState(s, 0, lerp(1, 0.5, settle));
        brain.targets.slice(0, SOURCE_LABELS.length).forEach((n, k) => {
          const d = brain.pathNodes.get(n);
          out.labels.push({ key: 't' + k, at: brain.nodes[n].b3, form: 'b3', text: SOURCE_LABELS[k], alpha: smooth(front, d, d + 0.5), dy: k % 2 ? 1 : -1 });
        });
        out.link = { at: brain.nodes[brain.entry].b3, alpha: smooth(u, 0.06, 0.16) };
        const found = brain.targets.slice(0, SOURCE_LABELS.length).filter((n) => front >= brain.pathNodes.get(n)).length;
        // The answer is in the readout from the start, unseen, so its room is kept:
        // it arrives a word at a time, then each source after it.
        const answered = u > 0.6;
        const status = answered ? 'Answered from ' + SOURCE_LABELS.length + ' sources.' : u > 0.1 ? 'Going straight to what matters. ' + found + ' of ' + SOURCE_LABELS.length + ' sources.' : 'Filed by meaning.';
        out.inst = ask(1, answered ? 'answer' : 'reading', status, { answer: ANSWER, said: clamp((u - 0.62) / 0.2), sources: SOURCE_LABELS, cited: clamp((u - 0.82) / 0.13) });
      }
      return out;
    },

    manager(act, u, time) {
      const s = GLF.store.state;
      fillState(s, 16, 1);
      const c = store.centre;
      const out = { labels: [] };
      const lit = (id, on, done) => setState(s, id, 1, on * 0.9 + done * 0.12, Math.max(on * 0.8, done * 0.6), on > done ? 0 : 2);
      out.labels.push({ key: 'desk', at: [-0.98, 0.69, 0], form: 'store', text: 'Desktop', alpha: 0.7, dy: 0, quiet: true });
      out.labels.push({ key: 'phone', at: [1.21, 0.17, 0.3], form: 'store', text: 'Phone', alpha: 0.7, dy: 0, quiet: true });
      if (act === 1) {
        const steps = [
          { ids: [R.nav, R.pNav], at: c[R.nav], tag: [-0.93, 0.33, 0], text: 'Home' },
          { ids: [R.hero, R.pHero], at: c[R.hero], tag: [0.3, 0.2, 0], text: 'Collection' },
          { ids: [R.tileB, R.pTiles], at: c[R.tileB], tag: [-0.38, -0.56, 0], text: 'Product' },
          { ids: [R.cart], at: c[R.cart], tag: [0.6, 0.44, 0.06], text: 'Cart' },
          { ids: [R.checkout, R.pButton], at: c[R.checkout], tag: [0.6, -0.4, 0.06], text: 'Checkout' },
        ];
        const at = u * steps.length;
        const k = Math.min(steps.length - 1, Math.floor(at));
        const f = at - k;
        const drawer = smooth(at, 2.7, 3.2);
        setState(s, R.cart, drawer);
        setState(s, R.checkout, drawer);
        // The drawer slides over the last tile.
        setState(s, R.tileD, lerp(1, 0.2, drawer));
        out.inst = { kind: 'rows', layout: 'path', rows: [] };
        steps.forEach((step, j) => {
          const on = j === k && u < 1 ? smooth(f, 0, 0.25) * (1 - smooth(f, 0.75, 1)) : 0;
          const done = j < k || u >= 1 ? 1 : j === k ? smooth(f, 0.75, 1) : 0;
          out.inst.rows.push({ k: step.text, state: done > 0.5 ? 'ok' : j === k && u > 0 ? 'on' : 'idle' });
          for (const id of step.ids) if (id !== R.cart || drawer > 0) lit(id, on, done);
          out.labels.push({ key: 's' + j, at: step.tag, form: 'store', text: step.text + (done > 0.5 ? ', passed' : ''), alpha: Math.max(on, done * 0.85), dy: 0, ok: done > 0.5 });
        });
        const prev = steps[Math.max(0, k - 1)].at;
        pointer.store = mixPoint(k === 0 ? [-1.3, 0.75, 0.2] : prev, steps[k].at, smooth(f, 0, 0.3)).map((v, j) => (j === 2 ? v + 0.05 : v));
        setState(s, POINTER, 1 - smooth(u, 0.94, 1), 0.7);
        out.link = { at: pointer.store, alpha: smooth(u, 0, 0.05) * (1 - smooth(u, 0.94, 1)), row: k };
      } else if (act === 2) {
        const calm = 1 - smooth(u, 0, 0.12);
        for (const id of [R.nav, R.hero, R.tileB, R.pNav, R.pHero, R.pTiles, R.pButton]) lit(id, 0, calm);
        setState(s, R.cart, calm);
        setState(s, R.checkout, calm, calm * 0.12, calm * 0.6, 2);
        const gone = smooth(u, 0.14, 0.3);
        const found = smooth(u, 0.46, 0.52);
        const again = u > 0.56 && u < 0.72 ? 0.5 + 0.5 * Math.sin((u - 0.56) * 78) : 1;
        // It ends reported, not repaired: the outline stays marked.
        const told = smooth(u, 0.8, 0.9);
        const tileVis = lerp(lerp(1, 0.07, gone), 1, found * 0.55 * again);
        setState(s, R.tileD, tileVis, found * lerp(0.8, 0.4, told) * again, found, 1);
        const sweep = smooth(u, 0.3, 0.5);
        pointer.store = [lerp(-1.0, 0.54, sweep), -0.56, 0.05];
        setState(s, POINTER, smooth(u, 0.28, 0.32) * (1 - smooth(u, 0.52, 0.58)), 0.7);
        const text = told > 0.5 ? 'Reported' : u > 0.72 ? 'Confirmed' : u > 0.56 ? 'Checked again' : 'One product is missing';
        out.labels.push({ key: 'fail', at: c[R.tileD], form: 'store', text, alpha: found, dy: 1, alert: true });
        const seen = found > 0.5;
        out.link = { at: c[R.tileD], alpha: found, row: told > 0.5 ? 3 : u > 0.72 ? 2 : u > 0.56 ? 1 : 0, alert: true };
        out.inst = {
          kind: 'rows',
          layout: 'list',
          rows: [
            { k: 'Collection', v: seen ? '3 of 4 products' : u > 0.3 ? 'Checking' : '4 of 4 products', state: seen ? 'alert' : u > 0.3 ? 'on' : 'idle' },
            { k: 'Checked again', v: u > 0.72 ? '3 of 4 products' : '', state: u > 0.72 ? 'alert' : u > 0.56 ? 'on' : 'idle', a: smooth(u, 0.53, 0.58) },
            { k: 'Confirmed', v: '', state: 'done', a: smooth(u, 0.72, 0.76) },
            { k: 'Reported', v: '', state: 'done', a: smooth(u, 0.82, 0.88) },
          ],
        };
      } else {
        // At rest: a slow pass over the page, top to bottom, on its own clock.
        const order = [R.nav, R.hero, R.tileA, R.tileB, R.tileC, R.tileD];
        const beat = (time * 0.22) % 1;
        order.forEach((id, j) => {
          const d = Math.abs(beat * (order.length + 2) - 1 - j);
          setState(s, id, 1, Math.max(0, 0.5 - d * 0.5), Math.max(0, 0.5 - d * 0.5), 0);
        });
        setState(s, R.cart, 0);
        setState(s, R.checkout, 0);
        [
          ['Daily', c[R.hero]],
          ['Twice weekly', c[R.tileB]],
          ['Weekly', c[R.nav]],
        ].forEach(([text, at], j) => out.labels.push({ key: 'c' + j, at, form: 'store', text, alpha: smooth(u, 0.1 + j * 0.12, 0.25 + j * 0.12), dy: j === 2 ? -1 : 1 }));
        out.inst = { kind: 'none' };
      }
      return out;
    },

    healing(act, u, time) {
      const s = GLF.lattice.state;
      const L = lattice;
      fillState(s, L.nodes.length + L.edges.length + 1, 1);
      const out = { labels: [] };
      const b = L.broken;
      const bAt = L.nodes[b];
      const flicker = 0.55 + 0.45 * Math.sin(time * 9) * Math.sin(time * 2.3);
      // done: how many of the six steps are behind us; the next one is under way.
      const pipeline = (done, active) => ({
        kind: 'rows',
        layout: 'pipeline',
        rows: PIPELINE.map((k, j) => ({ k, state: j < done ? (j === PIPELINE.length - 1 ? 'ok' : 'done') : j === done && active ? 'on' : 'idle' })),
      });
      const breakEdges = (amount) => {
        for (const [, e] of L.adj[b]) setState(s, L.edgeId(e), lerp(1, 0.12 + 0.1 * flicker, amount));
      };
      if (act === 1) {
        const hurt = smooth(u, 0.1, 0.32);
        setState(s, L.nodeId(b), 1, hurt * flicker, hurt, 1);
        breakEdges(hurt);
        // The neighbours notice: one ring outward.
        const ring = clamp((u - 0.4) / 0.4) * (L.far + 1);
        L.nodes.forEach((_, n) => {
          if (n === b) return;
          const d = L.dist.get(n);
          const g = Math.max(0, 1 - Math.abs(ring - d)) * (u > 0.4 && u < 0.82 ? 0.5 : 0);
          if (g > 0) setState(s, L.nodeId(n), 1, g, g * 0.6, 0);
        });
        out.labels.push({ key: 'err', at: bAt, form: 'lattice', text: u > 0.5 ? 'Found' : 'Error', alpha: hurt, dy: -1, alert: true });
        out.inst = pipeline(u > 0.5 ? 1 : 0, hurt > 0.3 && u <= 0.5);
        out.link = { at: bAt, alpha: hurt, row: 0, alert: u <= 0.5 };
      } else if (act === 2) {
        const travel = clamp(u / 0.36) * L.trace.length;
        const k = Math.min(L.trace.length - 1, Math.floor(travel));
        const f = travel - k;
        L.trace.forEach((step, j) => {
          const on = j < k ? 1 : j === k ? f : 0;
          if (on > 0) setState(s, L.edgeId(step.edge), 1, on * 0.8 * (1 - smooth(u, 0.8, 1)), on * 0.6, 0);
        });
        const step = L.trace[k];
        pointer.lattice = mixPoint(L.nodes[step.from], L.nodes[step.node], u >= 0.36 ? 1 : f);
        setState(s, POINTER, 1 - smooth(u, 0.4, 0.5), 0.7);
        const rebuilt = smooth(u, 0.44, 0.6);
        const merged = smooth(u, 0.82, 0.94);
        setState(s, L.nodeId(b), 1, lerp(flicker, 1, rebuilt) * (1 - merged * 0.8), lerp(1, 1 - merged, rebuilt), rebuilt > 0.5 ? 0 : 1);
        L.adj[b].forEach(([, e], j) => {
          const back = smooth(u, 0.56 + j * 0.04, 0.62 + j * 0.04);
          setState(s, L.edgeId(e), lerp(0.12 + 0.1 * flicker, 1, back), back * (1 - merged) * 0.6, back * (1 - merged) * 0.6, 0);
        });
        const text = u > 0.86 ? 'Merged' : u > 0.7 ? 'Reviewed' : u > 0.5 ? 'Fix written' : u > 0.36 ? 'Diagnosed' : 'Tracing';
        out.labels.push({ key: 'fix', at: bAt, form: 'lattice', text, alpha: 1, dy: -1 });
        const done = u > 0.86 ? 5 : u > 0.7 ? 4 : u > 0.5 ? 3 : u > 0.36 ? 2 : 1;
        out.inst = pipeline(done, u <= 0.86);
        out.link = { at: bAt, alpha: 1, row: Math.min(done, 4) };
      } else {
        const wave = clamp(u / 0.6) * (L.far + 1.5);
        L.nodes.forEach((_, n) => {
          const d = L.dist.get(n);
          const g = Math.max(0, 1 - Math.abs(wave - d) * 0.8) * (u < 0.7 ? 1 : 1 - smooth(u, 0.7, 0.9));
          if (g > 0) setState(s, L.nodeId(n), 1, g * 0.6, g * 0.85, 2);
        });
        out.labels.push({ key: 'ok', at: bAt, form: 'lattice', text: 'Verified', alpha: smooth(u, 0.05, 0.2), dy: -1, ok: true });
        out.inst = pipeline(u > 0.55 ? 6 : 5, true);
        out.link = { at: bAt, alpha: smooth(u, 0.05, 0.2), row: 5, ok: u > 0.55 };
      }
      return out;
    },
  };

  /* --------------------------------------------------------------- overlay */

  const layer = root.querySelector('[data-ai-labels]');
  const chips = new Map();

  function drawOverlay(out, place, breath, strength) {
    if (!layer) return;
    const used = new Set();
    for (const l of out.labels || []) {
      let el = chips.get(l.key);
      if (!el) {
        el = document.createElement('span');
        el.className = 'ca-ai-chip';
        layer.appendChild(el);
        chips.set(l.key, el);
      }
      used.add(l.key);
      const [x, y] = project(l.at, place, breath);
      if (el.textContent !== l.text) el.textContent = l.text;
      el.classList.toggle('ca-ai-chip--ok', !!l.ok);
      el.classList.toggle('ca-ai-chip--alert', !!l.alert);
      el.classList.toggle('ca-ai-chip--quiet', !!l.quiet);
      el.style.opacity = (l.alpha * strength).toFixed(3);
      el.style.transform = `translate(${x.toFixed(1)}px, ${(y + (l.dy || 0) * 26).toFixed(1)}px) translate(-50%, -50%)`;
    }
    for (const [key, el] of chips) if (!used.has(key)) el.style.opacity = '0';
  }

  /* -------------------------------------------------------------- readouts */

  /* Each act carries a readout beside its statement, driven by the same scene
     state as the drawing. Built once per act, then only touched where it changed. */
  const make = (tag, className, parent) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (parent) parent.appendChild(el);
    return el;
  };
  const write = (el, text) => {
    if (el.textContent !== text) el.textContent = text;
  };
  const mark = (el, key, value) => {
    if (el.dataset[key] !== value) el.dataset[key] = value;
  };
  function drawInst(stop, spec) {
    const host = stop.inst;
    if (!host || !spec) return;
    if (spec.kind === 'none') {
      if (host.firstChild) host.replaceChildren();
      stop.ui = null;
      return;
    }
    let ui = stop.ui;
    if (!ui || ui.kind !== spec.kind || ui.layout !== spec.layout) {
      host.replaceChildren();
      ui = stop.ui = { kind: spec.kind, layout: spec.layout };
      if (spec.kind === 'prompt') {
        ui.box = make('div', 'ca-ai-prompt', host);
        write(make('p', 'ca-ai-prompt__label', ui.box), root.dataset.exampleLabel || 'Example');
        const field = (ui.field = make('p', 'ca-ai-prompt__field', ui.box));
        ui.q = make('span', '', field);
        make('i', 'ca-ai-prompt__caret', field);
        // A div: the theme hides an empty p, and this line has to keep its room while empty.
        ui.status = make('div', 'ca-ai-prompt__status', ui.box);
        ui.answer = make('p', 'ca-ai-prompt__answer', ui.box);
        ui.sources = make('ul', 'ca-ai-prompt__sources', ui.box);
        ui.words = [];
        ui.cites = [];
      } else {
        ui.list = make('ul', 'ca-ai-rows', host);
        ui.list.dataset.layout = spec.layout;
        ui.rows = spec.rows.map(() => {
          const li = make('li', '', ui.list);
          return { li, k: make('span', 'ca-ai-rows__k', li), rule: make('span', 'ca-ai-rows__rule', li), v: make('span', 'ca-ai-rows__v', li), a: -1 };
        });
      }
    }
    if (spec.kind === 'prompt') {
      const chars = Math.round(clamp(spec.typed) * QUESTION.length);
      write(ui.q, QUESTION.slice(0, chars));
      mark(ui.box, 'typed', chars >= QUESTION.length ? 'done' : 'typing');
      // A status that only counts up is rewritten in place. A different one dips
      // out and comes back as the new line, with its marker.
      const status = spec.status || '';
      const phase = (spec.tone || '') + status.replace(/[\d,]+/g, '#');
      const at = performance.now();
      if (ui.phase === undefined || reduced) ui.phase = phase;
      else if (phase !== ui.phase && !ui.swap) {
        ui.swap = at;
        ui.status.classList.add('is-changing');
      }
      if (ui.swap && at - ui.swap > 170) {
        ui.swap = 0;
        ui.phase = phase;
        ui.status.classList.remove('is-changing');
      }
      if (!ui.swap) {
        mark(ui.box, 'tone', spec.tone || '');
        write(ui.status, status);
      }
      // The answer and its sources are in place from the start and only shown
      // in turn, so the readout never changes height.
      const reveal = (key, list, host, items, share, build) => {
        const want = items.join('|');
        if (ui[key + 'Key'] !== want) {
          ui[key + 'Key'] = want;
          ui[key + 'In'] = 0;
          ui[list] = items.map(build);
          host.replaceChildren(...ui[list].flat());
        }
        const n = Math.round(clamp(share || 0) * ui[list].length);
        if (n === ui[key + 'In']) return;
        ui[list].forEach((parts, j) => parts[parts.length - 1].classList.toggle('is-in', j < n));
        ui[key + 'In'] = n;
      };
      const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
      reveal('answer', 'words', ui.answer, spec.answer ? spec.answer.split(' ') : [], spec.said, (word, j) => (j ? [' ', el('span', word)] : [el('span', word)]));
      reveal('source', 'cites', ui.sources, spec.sources || [], spec.cited, (text) => [el('li', text)]);
      return;
    }
    spec.rows.forEach((row, j) => {
      const r = ui.rows[j];
      if (!r) return;
      write(r.k, row.k);
      write(r.v, row.v || '');
      mark(r.li, 'state', row.state || 'idle');
      const alpha = row.a === undefined ? 1 : Math.round(clamp(row.a) * 100) / 100;
      if (r.a !== alpha) {
        r.a = alpha;
        r.li.style.opacity = alpha;
      }
    });
  }

  /* ------------------------------------------------------------------ wire */

  /* One hairline from the readout's live row to the spot in the drawing it is
     describing, so the two halves of the screen read as one thing. Wide screens. */
  const SVG = 'http://www.w3.org/2000/svg';
  const wire = (() => {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'ca-ai-wire');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    const dot = document.createElementNS(SVG, 'circle');
    const ring = document.createElementNS(SVG, 'circle');
    dot.setAttribute('r', '2.5');
    ring.setAttribute('r', '7');
    ring.setAttribute('class', 'ca-ai-wire__ring');
    svg.append(path, dot, ring);
    root.appendChild(svg);
    return { svg, path, dot, ring, alpha: -1 };
  })();
  function drawWire(stop, link, place, breath, strength) {
    let alpha = 0;
    const ui = stop && stop.ui;
    if (link && ui && W >= 990 && strength > 0.01 && link.alpha > 0.01) {
      const from = ui.kind === 'prompt' ? ui.field : ui.layout === 'path' ? ui.list : ui.rows[link.row || 0] && ui.rows[link.row || 0].li;
      if (from) {
        const r = from.getBoundingClientRect();
        const host = stop.inst.getBoundingClientRect();
        const [x, y] = project(link.at, place, breath);
        // Leave from the right-hand end of the row, level with its marker.
        const x0 = host.right + 14;
        const y0 = ui.layout === 'path' ? r.top + 4.5 : ui.kind === 'prompt' ? r.top + r.height / 2 : r.top + Math.min(r.height / 2, 9);
        const x1 = Math.min(x0 + 46, x - 30);
        if (x > x0 + 40) {
          alpha = link.alpha * strength;
          // Stop short of the target: the ring marks it.
          const d = Math.hypot(x - x1, y - y0) || 1;
          const ex = x - ((x - x1) / d) * 7;
          const ey = y - ((y - y0) / d) * 7;
          wire.path.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)}H${x1.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
          wire.dot.setAttribute('cx', x0.toFixed(1));
          wire.dot.setAttribute('cy', y0.toFixed(1));
          wire.ring.setAttribute('cx', x.toFixed(1));
          wire.ring.setAttribute('cy', y.toFixed(1));
          const tone = link.alert ? 'alert' : link.ok ? 'ok' : '';
          if (wire.svg.dataset.tone !== tone) wire.svg.dataset.tone = tone;
        }
      }
    }
    alpha = Math.round(alpha * 100) / 100;
    if (alpha !== wire.alpha) {
      wire.alpha = alpha;
      wire.svg.style.opacity = alpha;
    }
  }

  /* ------------------------------------------------------------------ rail */

  /* One bar per chapter down the left edge; the current one fills as it plays.
     Each is a button that goes to its chapter and names it on hover or focus. */
  let rail = null;
  function buildRail() {
    if (rail) rail.el.remove();
    rail = null;
    const chapters = [...new Set(stops.map((s) => s.chapter).filter((c) => c && c.dataset.name && stops.some((s) => s.chapter === c && s.opener)))];
    if (chapters.length < 2) return;
    const el = make('nav', 'ca-ai-rail', root);
    el.setAttribute('aria-label', root.dataset.railLabel || 'Chapters');
    const list = make('ol', '', el);
    rail = {
      el,
      shown: false,
      items: chapters.map((chapter) => {
        const li = make('li', '', list);
        const button = make('button', '', li);
        button.type = 'button';
        button.setAttribute('aria-label', chapter.dataset.name);
        make('i', 'ca-ai-rail__track', button);
        const name = make('span', 'ca-ai-rail__name', button);
        name.setAttribute('aria-hidden', 'true');
        write(name, chapter.dataset.name);
        const first = stops.findIndex((s) => s.chapter === chapter);
        button.addEventListener('click', () => goTo(first));
        return { li, button, chapter, f: -1, count: stops.filter((s) => s.chapter === chapter).length, first };
      }),
    };
  }
  /* The bars beside an act's eyebrow go to that act (pointer only: they are a
     shortcut, the acts are all reachable by scrolling). */
  function bindBars() {
    stops.forEach((stop) => {
      if (!stop.chapter || stop.opener || !stop.el) return;
      const first = stops.findIndex((s) => s.chapter === stop.chapter && !s.opener);
      stop.el.querySelectorAll('.ca-ai-act__count i').forEach((bar, j) => {
        if (bar.dataset.aiBound) return;
        bar.dataset.aiBound = '1';
        bar.addEventListener('click', () => goTo(first + j));
      });
    });
  }
  function drawRail(index, p) {
    if (!rail) return;
    const stop = stops[index];
    const first = rail.items[0];
    const lastItem = rail.items[rail.items.length - 1];
    const shown = !!stop && index >= first.first && index < lastItem.first + lastItem.count && !(index === first.first && p < 0.12);
    if (shown !== rail.shown) {
      rail.shown = shown;
      rail.el.classList.toggle('is-shown', shown);
    }
    for (const item of rail.items) {
      const f = Math.round(clamp((index - item.first + p) / item.count) * 500) / 500;
      if (f === item.f) continue;
      item.f = f;
      item.li.style.setProperty('--f', f);
      const active = f > 0 && f < 1;
      item.li.classList.toggle('is-active', active);
      item.li.classList.toggle('is-done', f >= 1);
      if (active) item.button.setAttribute('aria-current', 'true');
      else item.button.removeAttribute('aria-current');
    }
  }

  /* ------------------------------------------------------------- autopilot */

  /* How long each act's story takes to play, in seconds. */
  const STORY = { brain: [5.5, 7.5, 8], manager: [6.5, 7, 3.4], healing: [4.5, 7, 4.5] };
  /* The share of each story after which nothing more happens on screen, and how
     long the act then rests before the page moves on (enough to read its last
     line, no longer). */
  const DONE = { brain: [0.64, 1, 0.95], manager: [1, 0.9, 0.75], healing: [0.82, 0.94, 0.9] };
  const REST = { brain: [1.5, 0.6, 1.2], manager: [0.6, 1.1, 1], healing: [0.8, 0.9, 1] };
  let playing = -1;

  /* Scrolling starts things; it does not have to finish them. Two helpers:
     - settle: if the visitor stops between two stops, glide to the one they were
       heading for, so nothing is ever left half-arrived;
     - advance: when an act's story has played and the visitor is idle, carry on
       to the next stop of the same chapter. A chapter ends on its last act and
       waits for a scroll.
     Any wheel, touch or key takes the page back at once. Never under reduced
     motion, in the theme editor or behind the enter gate. */
  const pilotAllowed = !reduced && !(window.Shopify && window.Shopify.designMode);
  const pilot = { on: true, drive: null, moved: 0, dir: 1, top: 0, touching: false };
  try {
    pilot.on = sessionStorage.getItem('ca-ai-auto') !== '0';
  } catch (error) {
    pilot.on = true;
  }
  const scrollerEl = () => {
    const pw = document.querySelector('.page-wrapper');
    return pw && pw.scrollHeight > pw.clientHeight + 5 && getComputedStyle(pw).overflowY !== 'visible' ? pw : null;
  };
  const getTop = (el) => (el ? el.scrollTop : window.scrollY);
  const setTop = (el, y) => (el ? (el.scrollTop = y) : window.scrollTo(0, y));
  /* ms left out: the time follows the distance, about a second a screen. */
  function glide(target, ms) {
    const s = stops[target];
    if (!s || !s.el) return;
    const el = scrollerEl();
    const r = s.el.getBoundingClientRect();
    const from = getTop(el);
    const delta = r.top + r.height * 0.5 - window.innerHeight * 0.5;
    if (Math.abs(delta) < 2) return;
    if (ms == null) ms = clamp(900 + (Math.abs(delta) / window.innerHeight) * 1050, 1100, 2500);
    // The theme scrolls smoothly on its own; this drive supplies the easing itself.
    const style = (el || document.documentElement).style;
    pilot.drive = { el, from, delta, start: performance.now(), ms, style, was: style.scrollBehavior };
    style.scrollBehavior = 'auto';
  }
  /* A click on the rail or on an act's bar: go there. The further it is, the
     longer the glide, within reason. Without the autopilot it is a plain jump. */
  function goTo(index) {
    const s = stops[index];
    if (!s || !s.el) return;
    const r = s.el.getBoundingClientRect();
    const delta = r.top + r.height * 0.5 - window.innerHeight * 0.5;
    if (!pilotAllowed) {
      const el = scrollerEl();
      const style = (el || document.documentElement).style;
      const was = style.scrollBehavior;
      style.scrollBehavior = 'auto';
      setTop(el, getTop(el) + delta);
      style.scrollBehavior = was;
      return;
    }
    release();
    pilot.dir = delta < 0 ? -1 : 1;
    glide(index, clamp(700 + (Math.abs(delta) / window.innerHeight) * 260, 900, 2400));
  }
  function release() {
    if (!pilot.drive) return;
    pilot.drive.style.scrollBehavior = pilot.drive.was;
    pilot.drive = null;
  }
  function steer(now) {
    const d = pilot.drive;
    if (!d) return;
    const k = clamp((now - d.start) / d.ms);
    // A sine: it never rushes the middle, where the drawing is changing shape.
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    setTop(d.el, d.from + d.delta * e);
    if (k >= 1) release();
  }
  function autopilot(now, index, p, pin, stop, doneFor) {
    if (!pilotAllowed || pilot.drive || pilot.touching || pastEnd || html.classList.contains('ca-ai-gated')) return;
    const idle = now - pilot.moved;
    const last = stops.length - 1;
    if (idle > 420) {
      let target = -1;
      if (index === 0) {
        // A nudge down from the first screen is enough to begin.
        if (pilot.dir > 0 && p > 0.6) target = 1;
      } else if (p < pin - 0.004) target = pilot.dir > 0 ? index : index - 1;
      else if (p > 1 - pin + 0.004) target = pilot.dir > 0 ? (index < last ? index + 1 : -1) : index;
      if (target > 0) return glide(target);
    }
    const next = stops[index + 1];
    const rest = stop.opener ? 0 : (REST[stop.name] || [])[stop.act - 1] || 1;
    if (pilot.on && index > 0 && next && next.chapter === stop.chapter && doneFor > rest && idle > 1100 && !document.hidden) glide(index + 1, 2600);
  }
  if (pilotAllowed) {
    const hands = () => {
      release();
      pilot.moved = performance.now();
    };
    window.addEventListener('wheel', hands, { passive: true });
    window.addEventListener('mousedown', hands, { passive: true });
    window.addEventListener('keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Tab'].includes(event.key)) hands();
    });
    window.addEventListener(
      'touchstart',
      () => {
        pilot.touching = true;
        hands();
      },
      { passive: true }
    );
    for (const type of ['touchend', 'touchcancel']) {
      window.addEventListener(
        type,
        () => {
          pilot.touching = false;
          pilot.moved = performance.now();
        },
        { passive: true }
      );
    }
    document.addEventListener(
      'scroll',
      () => {
        const top = getTop(scrollerEl());
        if (!pilot.drive) {
          if (Math.abs(top - pilot.top) > 0.5) pilot.dir = top > pilot.top ? 1 : -1;
          pilot.moved = performance.now();
        }
        pilot.top = top;
      },
      { capture: true, passive: true }
    );
  }

  /* The cue under a chapter's last act: its story has played, the scroll is yours. */
  const cue = root.querySelector('[data-ai-cue]');
  let cueOn = false;
  function drawCue(on) {
    if (!cue || on === cueOn) return;
    cueOn = on;
    cue.classList.toggle('is-shown', on);
  }

  /* ------------------------------------------------------------------ frame */

  let running = false;
  let visible = true;
  let last = 0;
  let clock = 0;
  function bindForm(slotPos, slotCol, slotMeta, f) {
    gl.bindBuffer(gl.ARRAY_BUFFER, f.pos);
    gl.vertexAttribPointer(slotPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, f.col);
    gl.vertexAttribPointer(slotCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, f.meta);
    gl.vertexAttribPointer(slotMeta, 2, gl.FLOAT, false, 0, 0);
  }
  const isBrain = (form) => form === 'b1' || form === 'b2' || form === 'b3';

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!reduced) clock += dt;
    const time = reduced ? 20 : clock;
    const started = performance.now();

    steer(now);
    const { index, p, pin, inside } = locate();
    const stop = stops[index] || { name: 'open', act: 1, form: 'sphere', el: null };
    const next = stops[index + 1];
    if (index !== playing) {
      const old = stops[playing];
      if (old) {
        old.at = null;
        if (old.el) old.el.classList.remove('is-on');
      }
      // Everything further down starts from the beginning when it is reached.
      for (let i = index + 2; i < stops.length; i++) stops[i].u = 0;
      playing = index;
    }
    // A stop's story is not scrubbed by the scroll: once the stop has arrived
    // it plays through on the clock.
    if (stop.el && stop.at == null && p >= pin - 0.05 && p <= 1 - pin + 0.05) {
      stop.at = clock;
      stop.el.classList.add('is-on');
    }
    const since = stop.at == null ? -1 : clock - stop.at;
    const length = (STORY[stop.name] || [])[stop.act - 1] || 0;
    const lead = stop.lead || 0.55;
    const u = stop.opener || !length ? 0 : reduced ? 0.9 : clamp((since - lead) / length);
    stop.u = u;
    // Done: nothing more will happen on screen (a title card: it has been up long enough to read).
    const doneFor = since < 0 ? -1 : stop.opener ? since - 1.9 : length ? since - lead - length * ((DONE[stop.name] || [])[stop.act - 1] || 1) : since - 2;

    /* The drawing changes over the whole stretch between two stops at rest: it
       starts as the one above lets go of its copy and ends as the one below
       takes hold of its own, so the handover is one long move, not a switch at
       the line between them. (a, b) is the pair on screen, T how far along. */
    const half = window.innerHeight * 0.5;
    const pinOf = (s) => Math.min(0.45, half / Math.max(1, s.h || half * 2));
    const exitAt = (s) => (s.opener || s.name === 'open' ? 0.6 : 1 - pinOf(s));
    const enterBy = (s, changes) => (s.opener ? 0.42 : pinOf(s) + (changes ? 0.05 : 0));
    const span = (s) => s.h || half * 2;
    let a = stops[index - 1] || stop;
    let b = stop;
    let T = 1;
    if (reduced) T = p > 0.12 ? 1 : 0;
    else if (next && p > exitAt(stop)) {
      a = stop;
      b = next;
      const d1 = (1 - exitAt(a)) * span(a);
      T = clamp(((p - exitAt(a)) * span(a)) / (d1 + enterBy(b, a.form !== b.form) * span(b)));
    } else if (a !== b) {
      const d1 = (1 - exitAt(a)) * span(a);
      T = clamp((d1 + p * span(b)) / (d1 + enterBy(b, a.form !== b.form) * span(b)));
    }
    // The stop below is at its beginning until the one above starts to leave.
    if (next && a !== stop) next.u = 0;
    const changing = a.form !== b.form;
    // A title card and its first act share a drawing; it only moves aside.
    const moving = changing || a.centred !== b.centred;
    const t = moving ? T : 1;

    // The other half of the pair holds the state it was last seen in. The stop
    // under the middle of the screen writes last: where two stops share a
    // drawing, its state is the one shown.
    const other = a === stop ? b : a;
    if (changing && other !== stop && SCENES[other.name]) {
      SCENES[other.name](other.act, other.u == null ? (other === a ? 1 : 0) : other.u, time);
      if (other.opener) setState(GLF[other.form].state, POINTER, 0);
    }
    const out = (SCENES[stop.name] || SCENES.open)(stop.act, u, time);
    // A title card shows the drawing at rest: nothing walks across it yet.
    if (stop.opener) setState(GLF[stop.form].state, POINTER, 0);
    for (const key of new Set([a.form, b.form])) upload(GLF[key].state);
    upload(linkState);

    const breath = 1 + Math.sin(time * 0.3) * 0.03;
    const from = placement(a.form, time, a.centred || a.name === 'close');
    const to = placement(b.form, time, b.centred || b.name === 'close');
    // Under a chapter title the field steps back.
    const titled = (s, at) => (s && s.opener && !reduced ? smooth(at, 0.08, 0.3) * (1 - smooth(at, 0.74, 0.94)) : 0);
    const title = titled(stop, p);
    const dim = 1 - title * 0.5;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Links belong to the brain alone: they fade with it.
    const brainFrom = isBrain(a.form);
    const brainTo = isBrain(b.form);
    if (brainFrom || brainTo) {
      const la = brainFrom ? a.form : b.form;
      const lb = brainTo ? b.form : a.form;
      const alpha = (brainFrom && brainTo ? 1 : brainTo ? smooth(t, 0.7, 1) : 1 - smooth(t, 0, 0.25)) * dim;
      gl.useProgram(linesProg.p);
      gl.bindVertexArray(lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf[la]);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf[lb]);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      const pa = brainFrom ? from : to;
      const pb = brainTo ? to : from;
      gl.uniform1f(linesProg.u.uT, brainFrom && brainTo ? t : 1);
      gl.uniform1f(linesProg.u.uBreath, breath);
      gl.uniform1f(linesProg.u.uCamZ, CAM_Z);
      gl.uniform1f(linesProg.u.uAlpha, alpha);
      gl.uniform4f(linesProg.u.uXfFrom, pa.angle, pa.scale, pa.x, pa.y);
      gl.uniform4f(linesProg.u.uXfTo, pb.angle, pb.scale, pb.x, pb.y);
      gl.uniform1f(linesProg.u.uTiltFrom, pa.tilt);
      gl.uniform1f(linesProg.u.uTiltTo, pb.tilt);
      gl.uniformMatrix4fv(linesProg.u.uProj, false, proj);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, linkState.tex);
      gl.uniform1i(linesProg.u.uState, 0);
      gl.drawArrays(gl.LINES, 0, brain.lines.count);
    }

    gl.useProgram(points.p);
    gl.bindVertexArray(pointVao);
    bindForm(0, 2, 4, GLF[a.form]);
    bindForm(1, 3, 5, GLF[b.form]);
    const U = points.u;
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uStagger, changing && !(brainFrom && brainTo) ? 1 : 0);
    gl.uniform1f(U.uDim, dim);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uBreath, breath);
    gl.uniform1f(U.uCamZ, CAM_Z);
    gl.uniform1f(U.uPx, (canvas.height / 900) * CAM_Z * (H < 700 ? 900 / Math.max(H, 520) : 1));
    gl.uniform4f(U.uXfFrom, from.angle, from.scale, from.x, from.y);
    gl.uniform4f(U.uXfTo, to.angle, to.scale, to.x, to.y);
    gl.uniform1f(U.uTiltFrom, from.tilt);
    gl.uniform1f(U.uTiltTo, to.tilt);
    gl.uniform3fv(U.uPtrFrom, pointer[a.form]);
    gl.uniform3fv(U.uPtrTo, pointer[b.form]);
    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, GLF[a.form].state.tex);
    gl.uniform1i(U.uStateFrom, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, GLF[b.form].state.tex);
    gl.uniform1i(U.uStateTo, 1);
    gl.drawArrays(gl.POINTS, 0, N);

    // Labels arrive once the shape has, and leave before it does. While the
    // drawing is still moving they follow it.
    const tt = t * t * (3 - 2 * t);
    const own = stop === b ? to : from;
    const at = moving && !changing ? { angle: to.angle, tilt: to.tilt, scale: lerp(from.scale, to.scale, tt), x: lerp(from.x, to.x, tt), y: lerp(from.y, to.y, tt) } : own;
    // The copy lets go as its act unpins and fades over the next third of a
    // screen; the next act's copy is already on its way in by then.
    const leaving = smooth(p, 1 - pin - 0.02, 1 - pin + 0.2);
    // The labels in the drawing go sooner: they belong to a shape that is about to change.
    const strength = stop.opener ? 0 : (changing && stop === b ? smooth(t, 0.85, 1) : 1) * (1 - smooth(p, 1 - pin - 0.02, 1 - pin + 0.08));
    drawOverlay(out, at, breath, strength);
    if (!stop.opener) drawInst(stop, out.inst);
    const copyShow = stop.opener || stop.name === 'open' ? 0 : smooth(p, pin - 0.26, pin - 0.03) * (1 - leaving);
    drawWire(stop, out.link, at, breath, strength * copyShow);
    drawRail(index, p);
    const nextStop = stops[index + 1];
    drawCue(!reduced && !pilot.drive && !stop.opener && stop.name !== 'open' && stop.name !== 'close' && !!nextStop && nextStop.chapter !== stop.chapter && doneFor > 0.6 && leaving < 0.05);
    if (inside) autopilot(now, index, p, pin, stop, doneFor);

    // Each stop's copy follows its place in the scroll: it arrives and it leaves
    // upward. What happens inside it (the statement lighting word by word, the
    // supporting text, the readout) runs on the clock once the stop is on.
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (s.name === 'open') continue;
      const mine = i === index;
      let show = 0;
      let key = '0';
      if (mine && s.opener) {
        show = title;
        key = 'o' + show.toFixed(3) + p.toFixed(3);
      } else if (mine) {
        show = copyShow;
        key = 'a' + p.toFixed(4) + u.toFixed(3);
      }
      if (s.key === key) continue;
      s.key = key;
      const css = s.el.style;
      css.setProperty('--ai-show', show.toFixed(3));
      if (!mine) continue;
      if (s.opener) css.setProperty('--ai-drift', (p - 0.5).toFixed(3));
      else {
        css.setProperty('--ai-shift', (1 - smooth(p, pin - 0.26, pin) - leaving).toFixed(3));
        css.setProperty('--ai-u', u.toFixed(3));
      }
    }

    debug.u = u;
    debug.driving = !!pilot.drive;
    debug.frames++;
    debug.ms = debug.ms * 0.95 + (performance.now() - started) * 0.05;
    debug.scene = stop.name + '-' + stop.act;
    debug.form = stop.form;
    debug.p = p;
    if (pastEnd && !reduced) {
      visible = false;
      running = false;
      return;
    }
    if (!reduced) requestAnimationFrame(frame);
  }

  function play() {
    const should = visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } else if (!should) running = false;
  }
  function still() {
    running = true;
    frame(performance.now());
    running = false;
  }

  measure();
  resize();
  window.addEventListener('resize', () => {
    resize();
    if (reduced) still();
  });
  document.addEventListener('visibilitychange', play);
  // In the theme editor a section is re-rendered on every edit: read the stops again.
  for (const type of ['shopify:section:load', 'shopify:section:unload', 'shopify:section:reorder']) {
    document.addEventListener(type, () =>
      requestAnimationFrame(() => {
        measure();
        if (reduced) still();
      })
    );
  }
  // Scroll does not bubble, and the scroller differs by breakpoint: listen in capture.
  const onScroll = (fn) => document.addEventListener('scroll', fn, { capture: true, passive: true });
  if (reduced) {
    still();
    onScroll(() => requestAnimationFrame(() => still()));
  } else {
    // Past the last stop the page covers the canvas; stop drawing under it.
    onScroll(() => {
      if (running) return;
      const lastStop = stops[stops.length - 1];
      visible = !lastStop || lastStop.el.getBoundingClientRect().bottom >= -40;
      play();
    });
    play();
  }

  /* ---------------------------------------------------------- gate and sound */

  /* The site's floating "Let's Talk" pill shares the corner with the toggles:
     its size is handed to the stylesheet, which moves them beside it. */
  const floatPill = document.querySelector('[data-ca-header-float]');
  if (floatPill) {
    const sizeFloat = () => {
      const w = floatPill.offsetWidth;
      if (!w) return;
      root.style.setProperty('--ca-ai-float-w', w + 'px');
      root.style.setProperty('--ca-ai-float-h', floatPill.offsetHeight + 'px');
    };
    sizeFloat();
    if ('ResizeObserver' in window) new ResizeObserver(sizeFloat).observe(floatPill);
  }

  const sound = createSound(root.dataset.audioSrc);
  const toggle = root.querySelector('[data-ai-sound]');
  const setToggle = (on) => {
    if (!toggle) return;
    toggle.hidden = false;
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.querySelector('[data-ai-sound-label]').textContent = on ? toggle.dataset.on : toggle.dataset.off;
  };
  if (toggle) {
    toggle.addEventListener('click', () => {
      const on = toggle.getAttribute('aria-pressed') !== 'true';
      if (on) sound.on();
      else sound.off();
      // Either way the choice is made: the first screen stops offering it.
      html.classList.remove('ca-ai-returning');
      setToggle(on);
    });
  }

  const autoToggle = root.querySelector('[data-ai-auto]');
  if (autoToggle && pilotAllowed) {
    const show = () => {
      autoToggle.hidden = false;
      autoToggle.setAttribute('aria-pressed', pilot.on ? 'true' : 'false');
      autoToggle.querySelector('[data-ai-auto-label]').textContent = pilot.on ? autoToggle.dataset.on : autoToggle.dataset.off;
    };
    autoToggle.addEventListener('click', () => {
      pilot.on = !pilot.on;
      if (!pilot.on) release();
      try {
        sessionStorage.setItem('ca-ai-auto', pilot.on ? '1' : '0');
      } catch (error) {
        /* private mode: the choice lasts for this page view */
      }
      show();
    });
    show();
  }

  let entered = false;
  try {
    entered = sessionStorage.getItem('ca-ai-entered') === '1';
  } catch (error) {
    entered = false;
  }
  const designMode = !!(window.Shopify && window.Shopify.designMode);
  const gateNeeded = !reduced && !entered && !designMode && root.getBoundingClientRect().top > -40 && !location.hash;
  const enter = (withSound) => {
    html.classList.remove('ca-ai-gated', 'ca-ai-returning');
    html.classList.add('ca-ai-entered');
    try {
      sessionStorage.setItem('ca-ai-entered', '1');
    } catch (error) {
      /* private mode: the gate simply shows again next time */
    }
    if (withSound) sound.on();
    setToggle(!!withSound);
  };
  root.querySelectorAll('[data-ai-enter]').forEach((button) => {
    button.addEventListener('click', () => enter(button.dataset.aiEnter === 'sound'));
  });
  if (gateNeeded) html.classList.add('ca-ai-gated');
  else {
    // No gate (a return visit, or reduced motion): the page is open, and the
    // first screen still offers the sound, which cannot start without a click.
    html.classList.remove('ca-ai-gated');
    html.classList.add('ca-ai-entered');
    html.classList.toggle('ca-ai-returning', !designMode && !!root.dataset.audioSrc);
    setToggle(false);
  }
}

/* The ambient track. Nothing is fetched until the visitor asks for sound. The
   buffer loops with a crossfade, so the join is never heard. */
function createSound(src) {
  const LEVEL = 0.3;
  const CROSS = 3;
  let ctx = null;
  let master = null;
  let buffer = null;
  let loading = null;
  let timer = 0;
  let wanted = false;

  function schedule(at) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + CROSS);
    gain.gain.setValueAtTime(1, at + buffer.duration - CROSS);
    gain.gain.linearRampToValueAtTime(0, at + buffer.duration);
    source.connect(gain).connect(master);
    source.start(at);
    source.stop(at + buffer.duration + 0.1);
    const next = at + buffer.duration - CROSS;
    timer = window.setTimeout(() => schedule(next), Math.max(0, (next - ctx.currentTime - 1.5) * 1000));
  }
  function fade(to, seconds) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(to, now + seconds);
  }
  async function on() {
    wanted = true;
    if (!src) return;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    // Resume inside the click, before anything is awaited.
    ctx.resume();
    if (!buffer) {
      loading =
        loading ||
        fetch(src)
          .then((response) => response.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .catch(() => null);
      buffer = await loading;
      if (!buffer) return;
      schedule(ctx.currentTime + 0.05);
    }
    if (wanted) fade(LEVEL, 2.5);
  }
  function off() {
    wanted = false;
    if (!ctx) return;
    fade(0, 0.6);
    window.setTimeout(() => {
      if (!wanted && ctx.state === 'running') ctx.suspend();
    }, 700);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !wanted) return;
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
  return { on, off };
}
