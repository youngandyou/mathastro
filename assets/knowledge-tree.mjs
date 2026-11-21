// The complete Quarto listing is the source of truth, including paginated posts.
const separator = /\s*(?:>|\/|::)\s*/;
const fieldArt = new Map([
  ["Math", { color: "math", symbol: "math" }],
  ["Astronomy", { color: "astro", symbol: "astronomy" }],
  ["Physics", { color: "physics", symbol: "physics" }],
  ["Computer", { color: "cs", symbol: "computer" }]
]);
const defaultArt = { color: "generic", symbol: "generic" };

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
      parts.forEach((key, index) => {
        if (!children.has(key)) children.set(key, {
          key, path: parts.slice(0, index + 1).join(" > "),
          label: editorial.labels?.[key] || key,
          children: new Map(), posts: new Map(), direct: new Map()
        });
        const node = children.get(key);
        node.posts.set(post.href, post);
        if (index === parts.length - 1) node.direct.set(post.href, post);
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
    changeTopic: "← 주제 다시 고르기",
    pathSuffix: " 추천 학습 경로",
    draftNote: "추천 경로 초안 · 기초에서 심화로 이어지도록 구성했으며, 학습 순서는 계속 다듬어집니다.",
    viewAllPosts: "이 주제의 글 모아보기",
    readFirstPost: "첫 글부터 읽기 ↗",
    statusMap: (label, count) => `${label}, ${count}개의 글을 추천 순서로 표시합니다.`,
    statusTopics: (label, count) => `${label}, ${count}개의 주제를 살펴보세요.`,
    atlasTitle: "지식의 별자리",
    atlasHint: "탐험하고 싶은 별자리를 골라 보세요.",
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
    changeTopic: "← Change Topic",
    pathSuffix: " Suggested Learning Path",
    draftNote: "Draft Suggested Path · Structured from foundations to advanced topics, sequence refined continuously.",
    viewAllPosts: "View all posts on this topic",
    readFirstPost: "Read from first article ↗",
    statusMap: (label, count) => `${label}: displaying ${count} articles in recommended sequence.`,
    statusTopics: (label, count) => `${label}: explore ${count} topics.`,
    atlasTitle: "Knowledge Constellations",
    atlasHint: "Choose a constellation to explore.",
    articles: count => `${count} ${count === 1 ? "article" : "articles"}`
  }
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 180 108");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svgNS, "use");
  use.setAttribute("href", new URL("./knowledge-constellations.svg#" + name, import.meta.url).href);
  svg.append(use);
  return svg;
}

// Sample a small, independent loop per star. Only the drawing and its label
// drift; the surrounding button stays in place for touch and keyboard input.
function setDrift(star) {
  const phase = Math.random() * 2 * Math.PI;
  const duration = 32 + Math.random() * 22;
  star.style.setProperty("--drift-duration", duration.toFixed(2) + "s");
  star.style.setProperty("--drift-delay", (-Math.random() * duration).toFixed(2) + "s");
  for (let i = 0; i < 4; i++) {
    const angle = phase + i * Math.PI / 2;
    const x = Math.cos(angle) * (5 + Math.random() * 4);
    const y = Math.sin(angle) * (6 + Math.random() * 5);
    star.style.setProperty("--drift-" + i, `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`);
  }
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
    const toolbar = el("div", "knowledge-toolbar");
    toolbar.append(el("h3", "knowledge-picker-title", t.exploreDeeper),
      button(t.allFields, "knowledge-back", () => navigate(null)));
    const cards = el("div", "knowledge-topics");
    topics().forEach(node => {
      const card = button("", "knowledge-topic", () => navigate(field, node));
      card.dataset.topic = node.path;
      const topicName = getNodeLabel(node, isEn, editorial);
      card.append(topicName + " ", el("span", "knowledge-topic-count", "(" + node.posts.size + ")"));
      cards.append(card);
    });
    content.append(toolbar, cards);
  }

  function renderMap(isEn, t) {
    const ordered = orderedPosts(topic, editorial);
    const stages = learningStages(ordered, isEn ? "en" : "ko");
    const toolbar = el("div", "knowledge-toolbar");
    if (topic !== field) toolbar.append(button(t.changeTopic, "knowledge-back", () => navigate(field)));
    toolbar.append(button(t.allFields, "knowledge-back", () => navigate(null)));
    content.append(toolbar);

    const topicLabel = getNodeLabel(topic, isEn, editorial);
    const map = el("div", "knowledge-map");
    map.setAttribute("role", "region");
    map.setAttribute("aria-label", topicLabel + t.pathSuffix);
    map.tabIndex = 0;
    const root = el("div", "knowledge-map-root");
    root.append(el("h3", "knowledge-root-title", topicLabel));
    map.append(root);

    const branches = el("div", "knowledge-branches");
    branches.style.setProperty("--branch-count", stages.length);
    let number = 0;
    stages.forEach((stage, stageIndex) => {
      const branch = el("section", "knowledge-branch");
      const heading = el("h4", "knowledge-branch-heading");
      heading.append(el("span", "knowledge-stage-number", String(stageIndex + 1).padStart(2, "0")),
        el("span", "", stage.name));
      const list = el("ol", "knowledge-posts");
      list.start = number + 1;
      stage.posts.forEach(post => {
        number++;
        const li = el("li", "knowledge-post");
        const link = el("a", "knowledge-post-link");
        link.href = post.href;
        const body = el("span", "knowledge-post-body");
        const leaf = post.categories.find(path => path === topic.path || path.startsWith(topic.path + " > "))
          ?.split(separator).at(-1);
        body.append(el("span", "knowledge-post-title", post.title));
        if (leaf && leaf !== topic.key) {
          const leafLabel = isEn ? (leaf === "Math" ? "Mathematics" : leaf) : (editorial.labels?.[leaf] || leaf);
          body.append(el("span", "knowledge-post-category", leafLabel));
        }
        const indicator = el("span", "knowledge-post-number", String(number).padStart(2, "0"));
        indicator.setAttribute("aria-hidden", "true");
        link.append(indicator, body, el("span", "knowledge-post-arrow", "↗"));
        if (post.description) link.title = post.description;
        li.append(link);
        list.append(li);
      });
      branch.append(heading, list);
      branches.append(branch);
    });
    map.append(branches, el("p", "knowledge-draft-note", t.draftNote));
    content.append(map);

    const actions = el("div", "knowledge-map-actions");
    const all = el("a", "knowledge-all-posts", t.viewAllPosts);
    all.href = "#category=" + encodeURIComponent(topic.path);
    const start = el("a", "knowledge-start", t.readFirstPost);
    start.href = ordered[0]?.href || all.href;
    actions.append(all, start);
    content.append(actions);
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
