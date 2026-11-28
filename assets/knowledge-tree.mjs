// The complete Quarto listing is the source of truth, including paginated posts.
const separator = /\s*(?:>|\/|::)\s*/;
const fieldArt = new Map([
  ["Math", { color: "math", symbol: "math" }],
  ["Astronomy", { color: "astro", symbol: "astronomy" }],
  ["Physics", { color: "physics", symbol: "physics" }],
  ["Computer", { color: "cs", symbol: "computer" }]
]);
const defaultArt = { color: "generic", symbol: "generic" };
const topicSymbols = new Map([
  ["Radio Astronomy", "radio-astronomy"],
  ["Radio Software", "radio-software"],
  ["General Relativity", "general-relativity"],
  ["High Energy Astrophysics", "high-energy"],
  ["Relativistic Jets", "relativistic-jets"],
  ["AGN", "agn"],
  ["Calculus", "calculus"],
  ["Linear Algebra", "linear-algebra"],
  ["Matrix Algebra", "matrix-algebra"],
  ["Analysis", "analysis"],
  ["Complex Analysis", "complex-analysis"],
  ["Abstract Algebra", "abstract-algebra"],
  ["Topology", "topology"],
  ["Differential Geometry", "differential-geometry"],
  ["Graph Theory", "graph-theory"],
  ["Numerical Analysis", "numerical-analysis"],
  ["Lemma", "lemma"],
  ["Thermodynamics", "thermodynamics"],
  ["Reinforcement Learning", "reinforcement-learning"],
  ["Machine Learning", "machine-learning"]
]);
const fieldPalettes = new Map([
  ["Math", ["#9ad6ff", "#8ee5e8", "#b5c8ff", "#a2e5cc", "#cde1ff", "#8ec8ff"]],
  ["Astronomy", ["#f2cd8e", "#f7dea8", "#efb99a", "#b8dff7", "#d8c5f7"]],
  ["Physics", ["#88e4dc", "#9ad6ff", "#a9eed1", "#d4e8ff"]],
  ["Computer", ["#cbb8fb", "#9ad6ff", "#a4e6dc", "#e2c5ff"]]
]);

export function currentLang() {
  if (typeof localStorage !== "undefined" && localStorage.getItem("mathastro_lang") === "en") return "en";
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("translated-ltr") || document.body?.classList.contains("translated-ltr")) {
      return "en";
    }
    const match = document.cookie.match(/(?:^|;\s*)googtrans=\/ko\/([a-z]{2})/);
    if (match && match[1] === "en") return "en";
  }
  return "ko";
}

export function getNodeLabel(node, isEn, editorial = {}) {
  if (!isEn) return editorial.labels?.[node.key] || node.label || node.key;
  if (node.key === "Math") return "Mathematics";
  if (node.key === "Computer") return "Computer Science";
  if (node.key === "Radio Software") return "Radio Software";
  return editorial.labelsEn?.[node.key] || node.key;
}

export function buildCatalog(posts, editorial = {}) {
  const roots = new Map();
  for (const post of posts) {
    for (const category of post.categories) {
      const parts = category.split(separator).map(part => part.trim()).filter(Boolean);
      let children = roots;
      let parentNode = null;
      parts.forEach((key, index) => {
        if (!children.has(key)) children.set(key, {
          key, path: parts.slice(0, index + 1).join(" > "),
          label: editorial.labels?.[key] || key,
          parent: parentNode,
          children: new Map(), posts: new Map(), direct: new Map()
        });
        const node = children.get(key);
        node.posts.set(post.href, post);
        if (index === parts.length - 1) node.direct.set(post.href, post);
        parentNode = node;
        children = node.children;
      });
    }
  }
  return roots;
}

function sortChildren(node, editorial) {
  const order = editorial.orders?.[node.key] || [];
  const rank = key => order.includes(key) ? order.indexOf(key) : Infinity;
  return [...node.children.values()].sort((a, b) => rank(a.key) - rank(b.key)
    || a.label.localeCompare(b.label, "ko"));
}

export function orderedPosts(node, editorial = {}) {
  const order = editorial.orders?.[node.key] || [];
  const rank = post => order.includes(post.key) ? order.indexOf(post.key) : Infinity;
  const posts = [...node.direct.values()].sort((a, b) => rank(a) - rank(b)
    || (a.date || Infinity) - (b.date || Infinity) || a.key.localeCompare(b.key, "en", { numeric: true }));
  sortChildren(node, editorial).forEach(child => posts.push(...orderedPosts(child, editorial)));
  return [...new Map(posts.map(post => [post.href, post])).values()];
}

export function learningStages(posts, lang = "ko") {
  const isEn = lang === "en";
  const count = posts.length > 8 ? 3 : posts.length > 3 ? 2 : 1;
  const namesKo = count === 1 ? ["첫 개념부터 차근차근"]
    : count === 2 ? ["기초 다지기", "개념 넓히기"]
      : ["기초 다지기", "개념 연결하기", "심화 탐구하기"];
  const namesEn = count === 1 ? ["From First Principles"]
    : count === 2 ? ["Foundations", "Broadening Concepts"]
      : ["Foundations", "Connecting Concepts", "Advanced Explorations"];
  const names = isEn ? namesEn : namesKo;
  return names.map((name, index) => ({
    name, posts: posts.slice(Math.ceil(posts.length / count) * index,
      Math.ceil(posts.length / count) * (index + 1))
  })).filter(stage => stage.posts.length);
}

export function readPosts(elements) {
  const posts = new Map();
  for (const element of elements) {
    const link = element.querySelector("a.quarto-grid-link, .listing-title a, a.quarto-listing-link");
    const title = element.querySelector(".listing-title")?.textContent.replace(/\s+/g, " ").trim();
    const categories = [...element.querySelectorAll(".listing-category")]
      .map(category => category.textContent.trim()).filter(Boolean);
    if (!link || !title || !categories.length) continue;
    const href = link.getAttribute("href");
    const parts = decodeURIComponent(href.split(/[?#]/)[0]).split("/").filter(Boolean);
    const key = parts.at(-1) === "index.html" ? parts.at(-2) : parts.at(-1).replace(/\.html$/, "");
    posts.set(href, {
      key, href, title, categories,
      description: element.querySelector(".listing-description")?.textContent.replace(/\s+/g, " ").trim() || "",
      date: Number(element.dataset.listingDateSort) || 0
    });
  }
  return [...posts.values()];
}

const i18n = {
  ko: {
    launch: {
      description: "별을 잇듯 개념을 이어 보세요. 관심 있는 별자리에서 나만의 공부 길이 시작됩니다.",
      action: "지식 여행하기",
      illustration: "도서관 입구를 둘러싼 네 별자리: 수학의 좌표 평면, 천문학의 고리 행성, 물리학의 원자, 컴퓨터 과학의 코드 기호."
    },
    exploreDeeper: "조금 더 깊이 들여다볼까요?",
    allFields: "← 전체 분야",
    changeField: "← 분야 다시 고르기",
    changeTopic: "← 주제 다시 고르기",
    pathSuffix: " 추천 학습 경로",
    draftNote: "추천 경로 초안 · 기초에서 심화로 이어지도록 구성했으며, 학습 순서는 계속 다듬어집니다.",
    viewAllPosts: "이 주제의 글 모아보기",
    readFirstPost: "첫 글부터 읽기 ↗",
    statusMap: (label, count) => `${label}, ${count}개의 글을 추천 순서로 표시합니다.`,
    statusTopics: (label, count) => `${label}, ${count}개의 주제를 살펴보세요.`,
    atlasTitle: "지식의 별자리",
    atlasHint: "탐험하고 싶은 별자리를 골라 보세요.",
    topicsHint: "이어진 세부 별자리 가운데 탐험하고 싶은 주제를 골라 보세요.",
    mapHint: "중심 별자리 주위를 떠도는 글에 마우스를 올리거나 클릭해 탐험해 보세요.",
    orderKicker: "운영진 추천",
    orderTitle: "추천 순서",
    hudIdle: "떠다니는 글 별이나 오른쪽 추천 순서에 마우스를 올리면 상세 정보를 볼 수 있습니다.",
    articles: count => `글 ${count}편`
  },
  en: {
    launch: {
      description: "Connect ideas like stars in a constellation. Follow a field that sparks your curiosity.",
      action: "Begin Journey",
      illustration: "Four constellations surround the library entrance: a coordinate plane for mathematics, a ringed planet for astronomy, an atom for physics, and code brackets for computer science."
    },
    exploreDeeper: "Explore deeper into topics",
    allFields: "← All Fields",
    changeField: "← Choose a different field",
    changeTopic: "← Change Topic",
    pathSuffix: " Suggested Learning Path",
    draftNote: "Draft Suggested Path · Structured from foundations to advanced topics, sequence refined continuously.",
    viewAllPosts: "View all posts on this topic",
    readFirstPost: "Read from first article ↗",
    statusMap: (label, count) => `${label}: displaying ${count} articles in recommended sequence.`,
    statusTopics: (label, count) => `${label}: explore ${count} topics.`,
    atlasTitle: "Knowledge Constellations",
    atlasHint: "Choose a constellation to explore.",
    topicsHint: "Choose a connected sub-constellation to explore.",
    mapHint: "Hover or select any star orbiting the center, or follow the curated order on the right.",
    orderKicker: "Curated",
    orderTitle: "Guide",
    hudIdle: "Hover any floating article star or item in the recommended order rail to preview details.",
    articles: count => `${count} ${count === 1 ? "article" : "articles"}`
  }
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function icon(name) {
  const svg = svgEl("svg", { viewBox: "0 0 180 108", "aria-hidden": "true" });
  const use = svgEl("use", { href: new URL("./knowledge-constellations.svg?v=3#" + name, import.meta.url).href });
  svg.append(use);
  return svg;
}

function buildConstellationEdges(points) {
  const count = points.length;
  if (count < 2) return [];
  const dist = (a, b) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);

  // Build an organic Euclidean Minimum Spanning Tree so the constellation adapts cleanly to any grid width.
  const visited = new Set([0]);
  const edges = [];
  const edgeKeys = new Set();
  while (visited.size < count) {
    let best = null;
    for (const u of visited) {
      for (let v = 0; v < count; v++) {
        if (visited.has(v)) continue;
        const length = dist(u, v);
        if (!best || length < best.length) best = { u, v, length };
      }
    }
    if (!best) break;
    visited.add(best.v);
    edges.push({ from: best.u, to: best.v, length: best.length, primary: true });
    edgeKeys.add(Math.min(best.u, best.v) + "-" + Math.max(best.u, best.v));
  }

  // Add a few short secondary star-chart links to evoke closed constellation asterisms.
  if (count >= 4) {
    const sortedLengths = edges.map(edge => edge.length).sort((a, b) => a - b);
    const median = sortedLengths[Math.floor(sortedLengths.length / 2)] || 0;
    const degrees = Array(count).fill(0);
    edges.forEach(edge => { degrees[edge.from]++; degrees[edge.to]++; });

    const candidates = [];
    for (let u = 0; u < count; u++) {
      for (let v = u + 1; v < count; v++) {
        const key = u + "-" + v;
        if (edgeKeys.has(key)) continue;
        const length = dist(u, v);
        if (length <= median * 1.42) candidates.push({ from: u, to: v, length });
      }
    }
    candidates.sort((a, b) => a.length - b.length);
    const maxExtra = Math.min(3, Math.max(1, Math.floor(count / 3)));
    let added = 0;
    for (const candidate of candidates) {
      if (added >= maxExtra) break;
      if (degrees[candidate.from] >= 4 || degrees[candidate.to] >= 4) continue;
      edges.push({ ...candidate, primary: false });
      degrees[candidate.from]++;
      degrees[candidate.to]++;
      added++;
    }
  }
  return edges;
}

// Sample a small, independent loop per star. Only the drawing and its label
// drift; the surrounding button stays in place for touch and keyboard input.
function setDrift(star, scale = 1) {
  const phase = Math.random() * 2 * Math.PI;
  const duration = 32 + Math.random() * 22;
  star.style.setProperty("--drift-duration", duration.toFixed(2) + "s");
  star.style.setProperty("--drift-delay", (-Math.random() * duration).toFixed(2) + "s");
  for (let i = 0; i < 4; i++) {
    const angle = phase + i * Math.PI / 2;
    const x = Math.cos(angle) * (5 + Math.random() * 4) * scale;
    const y = Math.sin(angle) * (6 + Math.random() * 5) * scale;
    star.style.setProperty("--drift-" + i, `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`);
  }
}

function placeRingItems(indices, center, ringSpecs, ringCounts, dense) {
  const result = new Map();
  let cursor = 0;
  ringCounts.forEach((count, ringIndex) => {
    const spec = ringSpecs[ringIndex];
    for (let i = 0; i < count && cursor < indices.length; i++) {
      const globalIdx = indices[cursor++];
      const baseAngle = spec.offset + (2 * Math.PI * i) / Math.max(1, count);
      const angleJitter = Math.sin((globalIdx + 1) * 2.399) * (dense ? 0.032 : 0.055);
      const radialJitter = Math.cos((globalIdx + 1) * 1.732) * (dense ? 0.9 : 1.5);
      const angle = baseAngle + angleJitter;
      const rx = spec.rx + radialJitter;
      const ry = spec.ry + radialJitter * 0.85;
      const x = Math.min(91.5, Math.max(8.5, center.x + Math.cos(angle) * rx));
      const y = Math.min(89, Math.max(11, center.y + Math.sin(angle) * ry));
      result.set(globalIdx, { x, y, ring: ringIndex, parentSubIndex: -1 });
    }
  });
  return result;
}

function fanOutPositions(center, count, baseAngle, spreadRad, rx, ry) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
    const angle = baseAngle + t * spreadRad;
    const x = Math.min(92.5, Math.max(7.5, center.x + Math.cos(angle) * rx));
    const y = Math.min(89, Math.max(11, center.y + Math.sin(angle) * ry));
    out.push({ x, y });
  }
  return out;
}

function layoutTopicConstellation({ directIndices, subBranches, totalPosts, stages }) {
  const articlePos = new Map();
  const subClusters = [];
  const orbits = [];
  let hubPos = { x: 50, y: 50 };

  if (totalPosts === 0) return { hubPos, orbits, articlePos, subClusters };

  // Case 1: No child sub-branches — classic concentric orbits around the centered topic hub.
  if (!subBranches.length) {
    if (totalPosts === 1) {
      orbits.push({ cx: 50, cy: 50, rx: 28, ry: 28 });
      articlePos.set(directIndices[0], { x: 75, y: 44, ring: 0, parentSubIndex: -1 });
      return { hubPos, orbits, articlePos, subClusters };
    }
    let ringSpecs;
    let ringCounts;
    if (totalPosts <= 6) {
      ringSpecs = [{ rx: 34, ry: 35, offset: -Math.PI * 0.72 }];
      ringCounts = [totalPosts];
    } else if (totalPosts <= 14) {
      ringSpecs = [
        { rx: 23.5, ry: 24.5, offset: -Math.PI * 0.72 },
        { rx: 40.5, ry: 39.5, offset: -Math.PI * 0.72 + 0.38 }
      ];
      ringCounts = stages.length === 2
        ? stages.map(s => s.posts.length)
        : [Math.max(4, Math.round(totalPosts * 0.42)), totalPosts - Math.max(4, Math.round(totalPosts * 0.42))];
    } else if (totalPosts <= 24) {
      ringSpecs = [
        { rx: 22.5, ry: 23, offset: -Math.PI * 0.74 },
        { rx: 33.5, ry: 33, offset: -Math.PI * 0.74 + 0.52 },
        { rx: 43.5, ry: 41.5, offset: -Math.PI * 0.74 + 0.24 }
      ];
      ringCounts = stages.length === 3
        ? stages.map(s => s.posts.length)
        : [Math.round(totalPosts * 0.28), Math.round(totalPosts * 0.34), totalPosts - Math.round(totalPosts * 0.28) - Math.round(totalPosts * 0.34)];
    } else {
      ringSpecs = [
        { rx: 19.5, ry: 19.5, offset: -Math.PI * 0.75 },
        { rx: 28.2, ry: 28.2, offset: -Math.PI * 0.75 + 0.32 },
        { rx: 36.8, ry: 36.5, offset: -Math.PI * 0.75 + 0.16 },
        { rx: 44.5, ry: 43.2, offset: -Math.PI * 0.75 + 0.42 }
      ];
      const r0 = Math.max(6, Math.round(totalPosts * 0.16));
      const r1 = Math.max(8, Math.round(totalPosts * 0.23));
      const r2 = Math.max(10, Math.round(totalPosts * 0.28));
      ringCounts = [r0, r1, r2, totalPosts - r0 - r1 - r2];
    }
    ringSpecs.forEach(s => orbits.push({ cx: 50, cy: 50, rx: s.rx, ry: s.ry }));
    const placed = placeRingItems(directIndices, hubPos, ringSpecs, ringCounts, totalPosts > 24);
    placed.forEach((v, k) => articlePos.set(k, v));
    return { hubPos, orbits, articlePos, subClusters };
  }

  // Case 2: Direct posts + 1 child sub-branch (e.g. Radio Astronomy -> 14 direct + Radio Software 4)
  if (subBranches.length === 1) {
    const sub = subBranches[0];
    const hasDirect = directIndices.length > 0;
    hubPos = hasDirect ? { x: 37, y: 50 } : { x: 33, y: 50 };

    if (hasDirect) {
      let ringSpecs;
      let ringCounts;
      if (directIndices.length <= 6) {
        ringSpecs = [{ rx: 24, ry: 31, offset: -Math.PI * 0.75 }];
        ringCounts = [directIndices.length];
      } else {
        ringSpecs = [
          { rx: 17.5, ry: 22.5, offset: -Math.PI * 0.78 },
          { rx: 28.5, ry: 38.5, offset: -Math.PI * 0.78 + 0.39 }
        ];
        const inner = Math.max(5, Math.round(directIndices.length * 0.43));
        ringCounts = [inner, directIndices.length - inner];
      }
      ringSpecs.forEach(s => orbits.push({ cx: hubPos.x, cy: hubPos.y, rx: s.rx, ry: s.ry }));
      const placed = placeRingItems(directIndices, hubPos, ringSpecs, ringCounts, directIndices.length > 16);
      placed.forEach((v, k) => articlePos.set(k, v));
    }

    const subPos = hasDirect ? { x: 77.5, y: 50 } : { x: 64, y: 50 };
    const expanded = sub.postIndices.length <= 8;
    const spread = sub.postIndices.length <= 2 ? Math.PI * 0.65
      : sub.postIndices.length <= 4 ? Math.PI * 1.28 : Math.PI * 1.48;
    const fanRx = hasDirect ? 13.8 : 20;
    const fanRy = hasDirect ? 29.5 : 28;
    if (expanded) {
      const fanPts = fanOutPositions(subPos, sub.postIndices.length, 0, spread, fanRx, fanRy);
      sub.postIndices.forEach((globalIdx, i) => {
        articlePos.set(globalIdx, { x: fanPts[i].x, y: fanPts[i].y, ring: -1, parentSubIndex: 0 });
      });
    }
    subClusters.push({
      node: sub.node,
      x: subPos.x,
      y: subPos.y,
      haloRx: expanded ? (hasDirect ? 17.5 : 23) : 13,
      haloRy: expanded ? 37 : 21,
      postIndices: sub.postIndices,
      expanded
    });
    return { hubPos, orbits, articlePos, subClusters };
  }

  // Case 3: Multiple child sub-branches (e.g. Differential Geometry, Radio Software, Abstract Algebra, Graph Theory)
  const expandChildren = totalPosts <= 16 && directIndices.length <= 4;
  if (directIndices.length > 0) {
    const innerSpec = [{ rx: 16, ry: 18, offset: -Math.PI * 0.72 }];
    orbits.push({ cx: 50, cy: 50, rx: 16, ry: 18 });
    const placed = placeRingItems(directIndices, hubPos, innerSpec, [directIndices.length], false);
    placed.forEach((v, k) => articlePos.set(k, v));
  }

  const subOrbitRx = expandChildren ? 23.5 : 32.5;
  const subOrbitRy = expandChildren ? 23 : 31.5;
  orbits.push({ cx: 50, cy: 50, rx: subOrbitRx, ry: subOrbitRy });

  const count = subBranches.length;
  subBranches.forEach((sub, bIdx) => {
    const angle = (count === 2 ? Math.PI : -Math.PI * 0.68) + (2 * Math.PI * bIdx) / count;
    const sx = Math.min(82, Math.max(18, 50 + Math.cos(angle) * subOrbitRx));
    const sy = Math.min(80, Math.max(20, 50 + Math.sin(angle) * subOrbitRy));
    const expanded = expandChildren && sub.postIndices.length <= 7;
    if (expanded) {
      const spread = sub.postIndices.length <= 2 ? Math.PI * 0.55 : Math.PI * 0.92;
      const fanPts = fanOutPositions({ x: sx, y: sy }, sub.postIndices.length, angle, spread, 15.5, 17.5);
      sub.postIndices.forEach((globalIdx, i) => {
        articlePos.set(globalIdx, { x: fanPts[i].x, y: fanPts[i].y, ring: -1, parentSubIndex: bIdx });
      });
    }
    subClusters.push({
      node: sub.node,
      x: sx,
      y: sy,
      haloRx: expanded ? 18.5 : 13,
      haloRy: expanded ? 22 : 18,
      postIndices: sub.postIndices,
      expanded
    });
  });

  return { hubPos, orbits, articlePos, subClusters };
}

function button(text, className, callback) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", callback);
  return node;
}

function setup() {
  const hero = document.getElementById("knowledge-tree");
  if (!hero) return;
  const editorial = window.MathAstroKnowledge || {};
  const listing = window["quarto-listings"]?.["listing-sample-listings"];
  const elements = listing ? listing.items.map(item => item.elm)
    : document.querySelectorAll("#listing-sample-listings .list > [data-index]");
  const posts = readPosts(elements);
  const catalog = buildCatalog(posts, editorial);
  const additionalKeys = [...catalog.keys()].filter(key => !fieldArt.has(key)).sort();
  const fields = [...fieldArt.keys(), ...additionalKeys].map(key => catalog.get(key)).filter(Boolean);
  const entrance = hero.querySelector(".knowledge-entrance");
  const launch = hero.querySelector(".knowledge-launch");
  const content = hero.querySelector("#knowledge-content");
  const status = hero.querySelector(".knowledge-status");
  let field = null;
  let topic = null;
  let cleanupView = null;

  function topics() {
    const nodes = sortChildren(field, editorial);
    // Keep the existing computer menu's direct access to reinforcement learning.
    return field.key === "Computer" ? nodes.map(node =>
      !node.direct.size && node.children.size === 1 ? [...node.children.values()][0] : node) : nodes;
  }

  function navigate(nextField, nextTopic = null) {
    field = nextField;
    topic = nextTopic;
    render();
    // Leave keyboard users at the beginning of the new panel, not at a removed card.
    content.focus({ preventScroll: true });
    // A long topic list can leave the replacement panel above the mobile viewport.
    if (hero.getBoundingClientRect().top < 80) {
      hero.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  function renderFields(isEn, t) {
    const atlas = el("div", "knowledge-atlas notranslate");
    atlas.translate = false;
    atlas.lang = isEn ? "en" : "ko";
    const header = el("div", "knowledge-atlas-header");
    header.append(el("h2", "knowledge-atlas-title", t.atlasTitle), el("p", "knowledge-atlas-hint", t.atlasHint));

    const sky = el("div", "knowledge-fields");
    for (const item of fields) {
      const art = fieldArt.get(item.key) || defaultArt;
      const target = button("", "knowledge-field knowledge-color-" + art.color,
        () => navigate(item, item.children.size ? null : item));
      target.dataset.field = item.key;
      const star = el("span", "knowledge-field-star");
      setDrift(star);
      star.append(icon(art.symbol), el("span", "knowledge-field-name", getNodeLabel(item, isEn, editorial)),
        el("span", "knowledge-field-count", t.articles(item.posts.size)));
      target.append(star);
      sky.append(target);
    }
    atlas.append(header, sky);
    content.append(atlas);
  }

  function renderTopics(isEn, t) {
    const topicNodes = topics();
    const fieldInfo = fieldArt.get(field.key) || defaultArt;
    const palette = fieldPalettes.get(field.key) || ["#d4c9ff"];

    const atlas = el("div", "knowledge-atlas knowledge-topics-atlas notranslate");
    atlas.translate = false;
    atlas.lang = isEn ? "en" : "ko";

    const header = el("div", "knowledge-atlas-header knowledge-topics-header");
    const heading = el("div", "knowledge-atlas-heading");
    const fieldLabel = getNodeLabel(field, isEn, editorial);
    const hintText = !isEn && editorial.descriptions?.[field.key]
      ? editorial.descriptions[field.key]
      : t.topicsHint;
    heading.append(
      el("p", "knowledge-atlas-eyebrow", t.exploreDeeper),
      el("h2", "knowledge-atlas-title", fieldLabel),
      el("p", "knowledge-atlas-hint", hintText)
    );
    header.append(heading, button(t.changeField, "knowledge-back knowledge-atlas-back", () => navigate(null)));

    const sky = el("div", "knowledge-topics-sky");
    const web = svgEl("svg", { class: "knowledge-constellation-web", "aria-hidden": "true" });
    const cards = el("div", "knowledge-topics");
    const cols = topicNodes.length <= 4 ? Math.max(1, topicNodes.length)
      : topicNodes.length <= 6 ? 3 : 4;
    cards.style.setProperty("--topic-cols", String(cols));
    cards.dataset.count = String(topicNodes.length);

    const buttons = [];
    let activeIndex = -1;

    function syncActiveEdges() {
      web.querySelectorAll("[data-from]").forEach(node => {
        const isHit = activeIndex >= 0 && (Number(node.dataset.from) === activeIndex || Number(node.dataset.to) === activeIndex);
        node.classList.toggle("is-active", isHit);
      });
    }

    topicNodes.forEach((node, index) => {
      const symbol = topicSymbols.get(node.key) || fieldInfo.symbol || "generic";
      const tint = palette[index % palette.length];
      const card = button("", "knowledge-topic", () => navigate(field, node));
      card.dataset.topic = node.path;
      card.style.setProperty("--starlight", tint);
      if (!isEn && editorial.descriptions?.[node.key]) card.title = editorial.descriptions[node.key];

      const star = el("span", "knowledge-field-star knowledge-topic-star");
      setDrift(star);
      const topicName = getNodeLabel(node, isEn, editorial);
      star.append(
        icon(symbol),
        el("span", "knowledge-field-name knowledge-topic-name", topicName),
        el("span", "knowledge-field-count knowledge-topic-count", t.articles(node.posts.size))
      );
      card.append(star);

      const activate = () => { activeIndex = index; syncActiveEdges(); };
      const deactivate = () => { if (activeIndex === index) { activeIndex = -1; syncActiveEdges(); } };
      card.addEventListener("mouseenter", activate);
      card.addEventListener("mouseleave", deactivate);
      card.addEventListener("focus", activate);
      card.addEventListener("blur", deactivate);

      buttons.push(card);
      cards.append(card);
    });

    sky.append(web, cards);
    atlas.append(header, sky);
    content.append(atlas);

    function drawConstellationWeb() {
      const skyRect = sky.getBoundingClientRect();
      if (!skyRect.width || !skyRect.height) return;
      web.setAttribute("viewBox", `0 0 ${skyRect.width.toFixed(1)} ${skyRect.height.toFixed(1)}`);
      web.replaceChildren();

      // Anchor lines to the stationary button frames so gentle star drift never causes jitter.
      const points = buttons.map(btn => {
        const rect = btn.getBoundingClientRect();
        return {
          x: rect.left - skyRect.left + rect.width / 2,
          y: rect.top - skyRect.top + rect.height * 0.42
        };
      });

      if (points.length === 1) {
        const p = points[0];
        const spanX = Math.min(180, skyRect.width * 0.34);
        const spanY = Math.min(82, skyRect.height * 0.28);
        const satellites = [
          { x: p.x - spanX, y: p.y - spanY * 0.65 },
          { x: p.x - spanX * 0.68, y: p.y + spanY * 0.85 },
          { x: p.x + spanX * 0.88, y: p.y - spanY * 0.78 },
          { x: p.x + spanX, y: p.y + spanY * 0.55 }
        ];
        satellites.forEach((sat, idx) => {
          const dx = sat.x - p.x;
          const dy = sat.y - p.y;
          const dist = Math.hypot(dx, dy) || 1;
          const trim = Math.min(44, dist * 0.34);
          web.append(
            svgEl("line", {
              class: "knowledge-constellation-edge" + (idx % 2 ? " is-secondary" : ""),
              "data-from": 0,
              "data-to": -1,
              x1: (p.x + (dx / dist) * trim).toFixed(1),
              y1: (p.y + (dy / dist) * trim).toFixed(1),
              x2: sat.x.toFixed(1),
              y2: sat.y.toFixed(1)
            }),
            svgEl("circle", {
              class: "knowledge-constellation-waypoint",
              "data-from": 0,
              "data-to": -1,
              cx: sat.x.toFixed(1),
              cy: sat.y.toFixed(1),
              r: idx % 2 ? "2.1" : "2.7"
            })
          );
        });
        syncActiveEdges();
        return;
      }

      const edges = buildConstellationEdges(points);
      for (const edge of edges) {
        const a = points[edge.from];
        const b = points[edge.to];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) continue;
        const trim = Math.min(44, dist * 0.27);
        const ux = dx / dist;
        const uy = dy / dist;
        const x1 = a.x + ux * trim;
        const y1 = a.y + uy * trim;
        const x2 = b.x - ux * trim;
        const y2 = b.y - uy * trim;

        web.append(
          svgEl("line", {
            class: "knowledge-constellation-edge" + (edge.primary ? "" : " is-secondary"),
            "data-from": edge.from,
            "data-to": edge.to,
            x1: x1.toFixed(1),
            y1: y1.toFixed(1),
            x2: x2.toFixed(1),
            y2: y2.toFixed(1)
          }),
          svgEl("circle", {
            class: "knowledge-constellation-waypoint",
            "data-from": edge.from,
            "data-to": edge.to,
            cx: x1.toFixed(1),
            cy: y1.toFixed(1),
            r: edge.primary ? "2.2" : "1.6"
          }),
          svgEl("circle", {
            class: "knowledge-constellation-waypoint",
            "data-from": edge.from,
            "data-to": edge.to,
            cx: x2.toFixed(1),
            cy: y2.toFixed(1),
            r: edge.primary ? "2.2" : "1.6"
          })
        );

        if (edge.primary && dist > 190) {
          web.append(svgEl("circle", {
            class: "knowledge-constellation-waypoint is-mid",
            "data-from": edge.from,
            "data-to": edge.to,
            cx: ((x1 + x2) / 2).toFixed(1),
            cy: ((y1 + y2) / 2).toFixed(1),
            r: "1.6"
          }));
        }
      }
      syncActiveEdges();
    }

    let frame = requestAnimationFrame(drawConstellationWeb);
    let observer = null;
    const scheduleDraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(drawConstellationWeb);
    };
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleDraw);
      observer.observe(sky);
    } else {
      window.addEventListener("resize", scheduleDraw);
    }
    cleanupView = () => {
      cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", scheduleDraw);
    };
  }

  function renderMap(isEn, t) {
    const ordered = orderedPosts(topic, editorial);
    const stages = learningStages(ordered, isEn ? "en" : "ko");
    const fieldInfo = fieldArt.get(field.key) || defaultArt;
    const palette = fieldPalettes.get(field.key) || ["#d4c9ff"];
    const topicLabel = getNodeLabel(topic, isEn, editorial);
    const fieldLabel = getNodeLabel(field, isEn, editorial);
    const hubSymbol = topicSymbols.get(topic.key) || fieldInfo.symbol || "generic";

    const atlas = el("div", "knowledge-atlas knowledge-map-atlas notranslate");
    atlas.translate = false;
    atlas.lang = isEn ? "en" : "ko";

    // Header with hierarchical breadcrumb back navigation
    const header = el("div", "knowledge-atlas-header knowledge-map-header");
    const heading = el("div", "knowledge-atlas-heading");
    const parentTopic = topic.parent && topic.parent !== field ? topic.parent : null;
    const parentLabel = parentTopic ? getNodeLabel(parentTopic, isEn, editorial) : fieldLabel;
    const eyebrowText = topic !== field
      ? `${parentLabel} · ${t.articles(ordered.length)}`
      : t.articles(ordered.length);
    const hintText = !isEn && editorial.descriptions?.[topic.key]
      ? editorial.descriptions[topic.key]
      : t.mapHint;
    heading.append(
      el("p", "knowledge-atlas-eyebrow", eyebrowText),
      el("h2", "knowledge-atlas-title", topicLabel),
      el("p", "knowledge-atlas-hint", hintText)
    );

    const nav = el("div", "knowledge-map-nav");
    if (parentTopic) {
      nav.append(button(`← ${parentLabel}`, "knowledge-back knowledge-atlas-back", () => navigate(field, parentTopic)));
    } else if (topic !== field) {
      nav.append(button(t.changeTopic, "knowledge-back knowledge-atlas-back", () => navigate(field)));
    }
    nav.append(button(t.allFields, "knowledge-back knowledge-atlas-back", () => navigate(null)));
    header.append(heading, nav);

    // Build index lookup for direct posts vs. child sub-branches
    const indexByHref = new Map(ordered.map((post, i) => [post.href, i]));
    const childNodes = sortChildren(topic, editorial);
    const subBranches = childNodes.map(child => {
      const childPosts = orderedPosts(child, editorial);
      const postIndices = childPosts
        .map(post => indexByHref.get(post.href))
        .filter(i => i !== undefined);
      return { node: child, postIndices };
    }).filter(branch => branch.postIndices.length > 0);

    const subIndexSet = new Set(subBranches.flatMap(b => b.postIndices));
    const directIndices = ordered
      .map((_, i) => i)
      .filter(i => !subIndexSet.has(i));

    const { hubPos, orbits, articlePos, subClusters } = layoutTopicConstellation({
      directIndices,
      subBranches,
      totalPosts: ordered.length,
      stages
    });

    // 9:1 Horizontal Split workspace (Left 9: cosmic orbital article field, Right 1: editorial recommended order rail)
    const layout = el("div", "knowledge-map-layout");
    layout.setAttribute("role", "region");
    layout.setAttribute("aria-label", topicLabel + t.pathSuffix);
    layout.tabIndex = 0;

    const cosmos = el("div", "knowledge-map-cosmos");
    const visibleStars = articlePos.size + subClusters.length;
    const density = visibleStars > 24 ? "dense" : visibleStars > 10 ? "medium" : "airy";
    const sky = el("div", "knowledge-map-sky");
    sky.dataset.density = density;

    const web = svgEl("svg", { class: "knowledge-map-web", "aria-hidden": "true" });

    // Central topic emblem hub (positioned dynamically by layout)
    const hub = el("div", "knowledge-map-hub");
    hub.setAttribute("aria-hidden", "true");
    hub.style.setProperty("--hub-x", hubPos.x.toFixed(2) + "%");
    hub.style.setProperty("--hub-y", hubPos.y.toFixed(2) + "%");
    const hubCore = el("div", "knowledge-map-hub-core");
    hubCore.append(
      icon(hubSymbol),
      el("span", "knowledge-map-hub-title", topicLabel),
      el("span", "knowledge-map-hub-count", t.articles(ordered.length))
    );
    hub.append(hubCore);

    const articleField = el("div", "knowledge-article-field");

    // Bottom HUD bar inside the left 90% cosmic area
    const hud = el("div", "knowledge-map-hud");
    hud.setAttribute("aria-live", "polite");
    const hudBadge = el("span", "knowledge-hud-badge");
    const hudTitle = el("span", "knowledge-hud-title");
    const hudDesc = el("span", "knowledge-hud-desc");
    hud.append(hudBadge, hudTitle, hudDesc);

    // Right 10% editorial recommended order rail
    const rail = el("aside", "knowledge-order-rail");
    rail.setAttribute("aria-label", t.orderTitle);
    const railScroll = el("div", "knowledge-order-scroll");
    const railHeader = el("div", "knowledge-order-header");
    railHeader.append(
      el("span", "knowledge-order-kicker", t.orderKicker),
      el("strong", "knowledge-order-title", t.orderTitle)
    );
    const railList = el("div", "knowledge-order-list");
    railScroll.append(railHeader, railList);
    rail.append(railScroll);

    const itemsMeta = [];
    const starNodes = new Map();
    const railNodes = [];
    const subNodes = [];
    const postToSubCluster = new Map();

    subClusters.forEach((cluster, subIdx) => {
      cluster.postIndices.forEach(idx => postToSubCluster.set(idx, subIdx));
    });

    // Render sub-constellation cluster nodes (clickable to explore deeper)
    subClusters.forEach((cluster, subIdx) => {
      const subLabel = getNodeLabel(cluster.node, isEn, editorial);
      const subSymbol = topicSymbols.get(cluster.node.key) || hubSymbol || "generic";
      const subTint = palette[(subIdx + 1) % palette.length];
      const subBtn = button("", "knowledge-subcluster-node" + (cluster.expanded ? " is-expanded" : ""),
        () => navigate(field, cluster.node));
      subBtn.dataset.subcluster = String(subIdx);
      subBtn.style.setProperty("--star-x", cluster.x.toFixed(2) + "%");
      subBtn.style.setProperty("--star-y", cluster.y.toFixed(2) + "%");
      subBtn.style.setProperty("--starlight", subTint);
      if (!isEn && editorial.descriptions?.[cluster.node.key]) {
        subBtn.title = editorial.descriptions[cluster.node.key];
      }

      const drift = el("span", "knowledge-field-star knowledge-subcluster-drift");
      setDrift(drift, 0.45);
      drift.append(
        icon(subSymbol),
        el("span", "knowledge-subcluster-name", subLabel),
        el("span", "knowledge-subcluster-meta", `${t.articles(cluster.node.posts.size)} ↗`)
      );
      subBtn.append(drift);
      articleField.append(subBtn);
      subNodes.push(subBtn);
    });

    let number = 0;
    stages.forEach((stage, stageIndex) => {
      const stageColor = palette[stageIndex % palette.length];

      const stageHeader = el("div", "knowledge-order-stage");
      stageHeader.style.setProperty("--stage-color", stageColor);
      stageHeader.append(
        el("span", "knowledge-order-stage-num", String(stageIndex + 1).padStart(2, "0")),
        el("span", "knowledge-order-stage-name", stage.name)
      );
      const stageOl = el("ol", "knowledge-order-items");
      stageOl.start = number + 1;

      stage.posts.forEach(post => {
        const index = number;
        number++;
        const numText = String(number).padStart(2, "0");
        const leaf = post.categories.find(path => path === topic.path || path.startsWith(topic.path + " > "))
          ?.split(separator).at(-1);
        const leafLabel = leaf && leaf !== topic.key
          ? (isEn ? (leaf === "Math" ? "Mathematics" : leaf) : (editorial.labels?.[leaf] || leaf))
          : "";

        const meta = {
          index,
          numText,
          stageIndex,
          stageName: stage.name,
          stageColor,
          title: post.title,
          leafLabel,
          description: post.description || "",
          href: post.href,
          subClusterIndex: postToSubCluster.has(index) ? postToSubCluster.get(index) : -1
        };
        itemsMeta.push(meta);

        // Floating article star in the left 90% cosmic sky (pure star sparkle + title, no number above title)
        const pos = articlePos.get(index);
        if (pos) {
          const starLink = el("a", "knowledge-article-star" + (pos.parentSubIndex >= 0 ? " is-branch-star" : ""));
          starLink.href = post.href;
          starLink.dataset.index = String(index);
          starLink.style.setProperty("--star-x", pos.x.toFixed(2) + "%");
          starLink.style.setProperty("--star-y", pos.y.toFixed(2) + "%");
          const starColor = pos.parentSubIndex >= 0
            ? palette[(pos.parentSubIndex + 1) % palette.length]
            : stageColor;
          starLink.style.setProperty("--starlight", starColor);
          starLink.title = post.description ? `${post.title} — ${post.description}` : post.title;

          const drift = el("span", "knowledge-field-star knowledge-article-drift");
          setDrift(drift, density === "dense" ? 0.45 : 0.6);

          drift.append(
            el("span", "knowledge-article-spark"),
            el("span", "knowledge-article-label", post.title)
          );
          if (leafLabel) drift.append(el("span", "knowledge-article-tag", leafLabel));
          starLink.append(drift);
          articleField.append(starLink);
          starNodes.set(index, starLink);
        }

        // Slim recommendation entry in the right 10% rail (retains recommended order numbers)
        const li = el("li");
        const railLink = el("a", "knowledge-order-item");
        railLink.href = post.href;
        railLink.dataset.index = String(index);
        railLink.style.setProperty("--stage-color", stageColor);
        railLink.title = `${numText}. ${post.title}` + (post.description ? `\n${post.description}` : "");
        const dot = el("span", "knowledge-order-dot");
        dot.setAttribute("aria-hidden", "true");
        railLink.append(
          dot,
          el("span", "knowledge-order-num", numText),
          el("span", "knowledge-order-text", post.title)
        );
        li.append(railLink);
        stageOl.append(li);
        railNodes.push(railLink);
      });

      railList.append(stageHeader, stageOl);
    });

    let activeIndex = -1;
    let activeSub = -1;

    function updateHud(idx, subIdx = -1) {
      if (subIdx >= 0 && subClusters[subIdx]) {
        const cluster = subClusters[subIdx];
        const subLabel = getNodeLabel(cluster.node, isEn, editorial);
        const subTint = palette[(subIdx + 1) % palette.length];
        hud.classList.add("is-preview");
        hud.style.setProperty("--hud-accent", subTint);
        hudBadge.textContent = `${subLabel} · ${t.articles(cluster.node.posts.size)}`;
        hudTitle.textContent = isEn
          ? `Click to explore the ${subLabel} constellation`
          : `${subLabel} 별자리로 더 깊이 들어가기 ↗`;
        hudDesc.textContent = !isEn && editorial.descriptions?.[cluster.node.key]
          ? editorial.descriptions[cluster.node.key]
          : "";
        return;
      }
      if (idx < 0 || !itemsMeta[idx]) {
        hud.classList.remove("is-preview");
        hudBadge.textContent = topicLabel;
        hudTitle.textContent = t.hudIdle;
        hudDesc.textContent = "";
        return;
      }
      const m = itemsMeta[idx];
      hud.classList.add("is-preview");
      hud.style.setProperty("--hud-accent", m.stageColor);
      hudBadge.textContent = `${m.numText} · ${m.stageName}` + (m.leafLabel ? ` · ${m.leafLabel}` : "");
      hudTitle.textContent = m.title;
      hudDesc.textContent = m.description;
    }

    function syncHighlights() {
      const targetSub = activeSub >= 0 ? activeSub
        : (activeIndex >= 0 ? itemsMeta[activeIndex]?.subClusterIndex ?? -1 : -1);

      starNodes.forEach((node, i) => {
        const isHit = i === activeIndex || (activeSub >= 0 && itemsMeta[i]?.subClusterIndex === activeSub);
        node.classList.toggle("is-active", isHit);
      });
      subNodes.forEach((node, sIdx) => {
        node.classList.toggle("is-active", sIdx === targetSub);
      });
      railNodes.forEach((node, i) => {
        const isHit = i === activeIndex || (activeSub >= 0 && itemsMeta[i]?.subClusterIndex === activeSub);
        node.classList.toggle("is-active", isHit);
      });
      web.querySelectorAll("[data-from], [data-sub]").forEach(edge => {
        const byPost = activeIndex >= 0
          && (Number(edge.dataset.from) === activeIndex || Number(edge.dataset.to) === activeIndex);
        const bySub = targetSub >= 0 && Number(edge.dataset.sub) === targetSub;
        edge.classList.toggle("is-active", Boolean(byPost || bySub));
      });
      updateHud(activeIndex, activeSub);
    }

    function setActivePost(idx, source) {
      activeSub = -1;
      activeIndex = idx;
      syncHighlights();
      if (idx >= 0 && source === "sky" && railNodes[idx]) {
        const target = railNodes[idx];
        const listRect = railList.getBoundingClientRect();
        const itemRect = target.getBoundingClientRect();
        if (itemRect.top < listRect.top || itemRect.bottom > listRect.bottom) {
          const offset = target.offsetTop - railList.clientHeight / 2 + target.clientHeight / 2;
          railList.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
        }
      }
    }

    function setActiveSub(subIdx) {
      activeIndex = -1;
      activeSub = subIdx;
      syncHighlights();
    }

    starNodes.forEach((node, i) => {
      node.addEventListener("mouseenter", () => setActivePost(i, "sky"));
      node.addEventListener("mouseleave", () => { if (activeIndex === i) setActivePost(-1, "sky"); });
      node.addEventListener("focus", () => setActivePost(i, "sky"));
      node.addEventListener("blur", () => { if (activeIndex === i) setActivePost(-1, "sky"); });
    });

    subNodes.forEach((node, sIdx) => {
      node.addEventListener("mouseenter", () => setActiveSub(sIdx));
      node.addEventListener("mouseleave", () => { if (activeSub === sIdx) setActiveSub(-1); });
      node.addEventListener("focus", () => setActiveSub(sIdx));
      node.addEventListener("blur", () => { if (activeSub === sIdx) setActiveSub(-1); });
    });

    railNodes.forEach((node, i) => {
      node.addEventListener("mouseenter", () => setActivePost(i, "rail"));
      node.addEventListener("mouseleave", () => { if (activeIndex === i) setActivePost(-1, "rail"); });
      node.addEventListener("focus", () => setActivePost(i, "rail"));
      node.addEventListener("blur", () => { if (activeIndex === i) setActivePost(-1, "rail"); });
    });

    updateHud(-1);

    sky.append(web, hub, articleField);
    cosmos.append(sky, hud);
    layout.append(cosmos, rail);

    // Footer bar inside atlas
    const footer = el("div", "knowledge-map-footer");
    footer.append(el("p", "knowledge-draft-note", t.draftNote));
    const actions = el("div", "knowledge-map-actions");
    const all = el("a", "knowledge-all-posts", t.viewAllPosts);
    all.href = "#category=" + encodeURIComponent(topic.path);
    const start = el("a", "knowledge-start", t.readFirstPost);
    start.href = ordered[0]?.href || all.href;
    actions.append(all, start);
    footer.append(actions);

    atlas.append(header, layout, footer);
    content.append(atlas);

    function drawMapWeb() {
      const skyRect = sky.getBoundingClientRect();
      if (!skyRect.width || !skyRect.height) return;
      web.setAttribute("viewBox", `0 0 ${skyRect.width.toFixed(1)} ${skyRect.height.toFixed(1)}`);
      web.replaceChildren();

      const isOrbital = skyRect.width > 520;
      const hubRect = hub.getBoundingClientRect();
      const hubX = hubRect.left - skyRect.left + hubRect.width / 2;
      const hubY = hubRect.top - skyRect.top + hubRect.height / 2;

      // Delicate concentric celestial orbit rings around the central topic hub
      if (isOrbital) {
        orbits.forEach((orbit, ringIdx) => {
          web.append(svgEl("ellipse", {
            class: "knowledge-orbit-ring",
            cx: ((orbit.cx / 100) * skyRect.width).toFixed(1),
            cy: ((orbit.cy / 100) * skyRect.height).toFixed(1),
            rx: ((orbit.rx / 100) * skyRect.width).toFixed(1),
            ry: ((orbit.ry / 100) * skyRect.height).toFixed(1),
            opacity: (0.16 - ringIdx * 0.02).toFixed(2)
          }));
        });
      }

      // Stationary anchor centers for visible floating article stars
      const starPoint = idx => {
        const node = starNodes.get(idx);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return {
          x: rect.left - skyRect.left + rect.width / 2,
          y: rect.top - skyRect.top + 10
        };
      };

      const subCenters = subNodes.map(node => {
        const rect = node.getBoundingClientRect();
        return {
          x: rect.left - skyRect.left + rect.width / 2,
          y: rect.top - skyRect.top + rect.height * 0.44
        };
      });

      // Draw sub-constellation cluster halos, main-to-sub bridge lines, and outward sub-constellation branches
      subClusters.forEach((cluster, subIdx) => {
        const sc = subCenters[subIdx];
        if (!sc) return;

        if (isOrbital) {
          // Soft enclosing constellation halo grouping the sub-branch together
          web.append(svgEl("ellipse", {
            class: "knowledge-subcluster-halo",
            "data-sub": subIdx,
            cx: sc.x.toFixed(1),
            cy: sc.y.toFixed(1),
            rx: ((cluster.haloRx / 100) * skyRect.width).toFixed(1),
            ry: ((cluster.haloRy / 100) * skyRect.height).toFixed(1)
          }));

          // Luminous bridge line connecting the main hub to this sub-constellation hub
          const dx = sc.x - hubX;
          const dy = sc.y - hubY;
          const dist = Math.hypot(dx, dy);
          if (dist > 40) {
            const ux = dx / dist;
            const uy = dy / dist;
            const t1 = Math.min(68, dist * 0.28);
            const t2 = Math.min(54, dist * 0.24);
            web.append(
              svgEl("line", {
                class: "knowledge-constellation-edge knowledge-subcluster-bridge",
                "data-sub": subIdx,
                x1: (hubX + ux * t1).toFixed(1),
                y1: (hubY + uy * t1).toFixed(1),
                x2: (sc.x - ux * t2).toFixed(1),
                y2: (sc.y - uy * t2).toFixed(1)
              }),
              svgEl("circle", {
                class: "knowledge-constellation-waypoint",
                "data-sub": subIdx,
                cx: ((hubX + sc.x) / 2).toFixed(1),
                cy: ((hubY + sc.y) / 2).toFixed(1),
                r: "2.3"
              })
            );
          }

          // For collapsed large sub-branches, scatter miniature companion stars inside the cluster halo
          if (!cluster.expanded) {
            const dots = Math.min(10, Math.max(3, Math.round(cluster.postIndices.length / 3)));
            const rx = (cluster.haloRx / 100) * skyRect.width * 0.72;
            const ry = (cluster.haloRy / 100) * skyRect.height * 0.72;
            for (let d = 0; d < dots; d++) {
              const a = -Math.PI * 0.5 + (2 * Math.PI * d) / dots + subIdx * 0.5;
              const px = sc.x + Math.cos(a) * rx;
              const py = sc.y + Math.sin(a) * ry;
              web.append(
                svgEl("line", {
                  class: "knowledge-constellation-edge is-secondary",
                  "data-sub": subIdx,
                  x1: sc.x.toFixed(1),
                  y1: sc.y.toFixed(1),
                  x2: px.toFixed(1),
                  y2: py.toFixed(1)
                }),
                svgEl("circle", {
                  class: "knowledge-constellation-waypoint",
                  "data-sub": subIdx,
                  cx: px.toFixed(1),
                  cy: py.toFixed(1),
                  r: d % 2 ? "1.7" : "2.3"
                })
              );
            }
          }
        }

        // Branch outward from the sub-constellation hub to each of its member articles
        if (cluster.expanded) {
          const pts = cluster.postIndices.map(idx => ({ idx, pt: starPoint(idx) })).filter(item => item.pt);
          pts.forEach(({ idx, pt }) => {
            const dx = pt.x - sc.x;
            const dy = pt.y - sc.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 22) return;
            const ux = dx / dist;
            const uy = dy / dist;
            const t1 = Math.min(44, dist * 0.36);
            const t2 = Math.min(12, dist * 0.16);
            web.append(svgEl("line", {
              class: "knowledge-constellation-edge knowledge-subcluster-ray",
              "data-from": idx,
              "data-to": -1,
              "data-sub": subIdx,
              x1: (sc.x + ux * t1).toFixed(1),
              y1: (sc.y + uy * t1).toFixed(1),
              x2: (pt.x - ux * t2).toFixed(1),
              y2: (pt.y - uy * t2).toFixed(1)
            }));
          });
          // Connect the fanned-out member stars along their local constellation arc
          for (let k = 0; k < pts.length - 1; k++) {
            const a = pts[k].pt;
            const b = pts[k + 1].pt;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 14) continue;
            const t = Math.min(12, dist * 0.2);
            web.append(svgEl("line", {
              class: "knowledge-constellation-edge is-secondary",
              "data-from": pts[k].idx,
              "data-to": pts[k + 1].idx,
              "data-sub": subIdx,
              x1: (a.x + (dx / dist) * t).toFixed(1),
              y1: (a.y + (dy / dist) * t).toFixed(1),
              x2: (b.x - (dx / dist) * t).toFixed(1),
              y2: (b.y - (dy / dist) * t).toFixed(1)
            }));
          }
        }
      });

      // Connect direct articles along their recommended constellation trail
      const directPts = directIndices.map(idx => ({ idx, pt: starPoint(idx) })).filter(item => item.pt);
      if (isOrbital && directPts.length > 0) {
        // Connect central hub to the first direct article
        const first = directPts[0];
        const dx = first.pt.x - hubX;
        const dy = first.pt.y - hubY;
        const dist = Math.hypot(dx, dy);
        if (dist > 36) {
          const t1 = Math.min(60, dist * 0.36);
          const t2 = Math.min(14, dist * 0.16);
          web.append(svgEl("line", {
            class: "knowledge-constellation-edge knowledge-hub-spoke",
            "data-from": first.idx,
            "data-to": -1,
            x1: (hubX + (dx / dist) * t1).toFixed(1),
            y1: (hubY + (dy / dist) * t1).toFixed(1),
            x2: (first.pt.x - (dx / dist) * t2).toFixed(1),
            y2: (first.pt.y - (dy / dist) * t2).toFixed(1)
          }));
        }
      }

      for (let i = 0; i < directPts.length - 1; i++) {
        const a = directPts[i].pt;
        const b = directPts[i + 1].pt;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 14) continue;
        const t = Math.min(14, dist * 0.22);
        const sameStage = itemsMeta[directPts[i].idx].stageIndex === itemsMeta[directPts[i + 1].idx].stageIndex;
        web.append(svgEl("line", {
          class: "knowledge-constellation-edge" + (sameStage ? "" : " is-secondary"),
          "data-from": directPts[i].idx,
          "data-to": directPts[i + 1].idx,
          x1: (a.x + (dx / dist) * t).toFixed(1),
          y1: (a.y + (dy / dist) * t).toFixed(1),
          x2: (b.x - (dx / dist) * t).toFixed(1),
          y2: (b.y - (dy / dist) * t).toFixed(1)
        }));
      }

      syncHighlights();
    }

    let frame = requestAnimationFrame(drawMapWeb);
    let observer = null;
    const scheduleDraw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(drawMapWeb);
    };
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleDraw);
      observer.observe(sky);
    } else {
      window.addEventListener("resize", scheduleDraw);
    }
    cleanupView = () => {
      cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", scheduleDraw);
    };
  }

  function updateLaunchTexts() {
    const lang = currentLang();
    const t = i18n[lang].launch;
    entrance.lang = lang;
    entrance.querySelectorAll("[data-launch-text]").forEach(node => {
      node.textContent = t[node.dataset.launchText];
    });
    entrance.querySelector(".knowledge-entrance-scene img").alt = t.illustration;
  }

  function render() {
    cleanupView?.();
    cleanupView = null;
    const isEn = currentLang() === "en";
    const t = i18n[isEn ? "en" : "ko"];
    content.replaceChildren();
    hero.dataset.view = topic ? "map" : field ? "topics" : "fields";
    hero.className = "knowledge-tree" + (field ? " knowledge-color-" + (fieldArt.get(field.key) || defaultArt).color : "");
    if (topic) renderMap(isEn, t);
    else if (field) renderTopics(isEn, t);
    else renderFields(isEn, t);

    const fieldLabel = field ? getNodeLabel(field, isEn, editorial) : "";
    const topicLabel = topic ? getNodeLabel(topic, isEn, editorial) : "";
    status.textContent = topic ? t.statusMap(topicLabel, topic.posts.size)
      : field ? t.statusTopics(fieldLabel, topics().length) : t.atlasHint;
  }

  launch.setAttribute("aria-controls", content.id);
  launch.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
    event.preventDefault();
    entrance.inert = true;
    content.hidden = false;
    navigate(null);
  });

  function updateLanguage() {
    updateLaunchTexts();
    if (!content.hidden) render();
  }
  window.addEventListener("mathastro-lang-changed", updateLanguage);
  window.addEventListener("storage", e => {
    if (e.key === "mathastro_lang") updateLanguage();
  });
  updateLanguage();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
}
