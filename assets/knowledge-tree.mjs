// The complete Quarto listing is the source of truth, including paginated posts.
const separator = /\s*(?:>|\/|::)\s*/;
const fields = [
  { key: "Math", label: "수학", color: "math", symbol: "math" },
  { key: "Astronomy", label: "천문학", color: "astro", symbol: "astronomy" },
  { key: "Physics", label: "물리학", color: "physics", symbol: "physics" },
  { key: "Computer", label: "컴퓨터 과학", color: "cs", symbol: "computer" }
];

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

export function learningStages(posts) {
  const count = posts.length > 8 ? 3 : posts.length > 3 ? 2 : 1;
  const names = count === 1 ? ["첫 개념부터 차근차근"]
    : count === 2 ? ["기초 다지기", "개념 넓히기"]
    : ["기초 다지기", "개념 연결하기", "심화 탐구하기"];
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

const symbols = {
  math: '<circle cx="40" cy="40" r="27"/><path d="M17 55 40 14 63 55Z M13 40h54 M40 13v54"/><circle cx="40" cy="40" r="3" class="symbol-dot"/>',
  astronomy: '<ellipse cx="40" cy="40" rx="34" ry="13" transform="rotate(-30 40 40)"/><circle cx="40" cy="40" r="20"/><circle cx="63" cy="25" r="4" class="symbol-dot"/><path d="M17 12v10 M12 17h10 M62 57v10 M57 62h10"/>',
  physics: '<ellipse cx="40" cy="40" rx="32" ry="12"/><ellipse cx="40" cy="40" rx="32" ry="12" transform="rotate(60 40 40)"/><ellipse cx="40" cy="40" rx="32" ry="12" transform="rotate(120 40 40)"/><circle cx="40" cy="40" r="4" class="symbol-dot"/>',
  computer: '<path d="m21 24-14 16 14 16 M59 24l14 16-14 16 M46 17 34 63"/><path d="M7 7h15 M7 7v15 M73 58v15H58" opacity=".4"/>'
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const container = el("span", "knowledge-symbol");
  container.setAttribute("aria-hidden", "true");
  container.innerHTML = '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.25">' + symbols[name] + '</svg>';
  return container;
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
  const launch = hero.querySelector(".knowledge-launch");
  const header = hero.querySelector(".knowledge-header");
  const content = hero.querySelector("#knowledge-content");
  const status = hero.querySelector(".knowledge-status");
  let field = null;
  let topic = null;

  function topics() {
    const root = catalog.get(field.key);
    if (!root) return [];
    const nodes = sortChildren(root, editorial);
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

  function renderFields() {
    const cards = el("div", "knowledge-fields");
    fields.forEach(item => {
      const card = button("", "knowledge-field knowledge-color-" + item.color, () => navigate(item));
      card.dataset.field = item.key;
      card.disabled = !catalog.get(item.key)?.posts.size;
      card.append(icon(item.symbol), el("span", "knowledge-field-name", item.label));
      cards.append(card);
    });
    content.append(cards);
  }

  function renderTopics() {
    const toolbar = el("div", "knowledge-topic-toolbar");
    toolbar.append(el("h3", "knowledge-picker-title", "조금 더 깊이 들여다볼까요?"),
      button("← 전체 분야", "knowledge-back", () => navigate(null)));
    const cards = el("div", "knowledge-topics");
    topics().forEach(node => {
      const card = button("", "knowledge-topic", () => navigate(field, node));
      card.dataset.topic = node.path;
      card.append(node.label + " ", el("span", "knowledge-topic-count", "(" + node.posts.size + ")"));
      cards.append(card);
    });
    content.append(toolbar, cards);
  }

  function renderMap() {
    const ordered = orderedPosts(topic, editorial);
    const stages = learningStages(ordered);
    const toolbar = el("div", "knowledge-map-toolbar");
    toolbar.append(button("← 주제 다시 고르기", "knowledge-back", () => navigate(field)),
      button("전체 분야", "knowledge-back", () => navigate(null)));
    content.append(toolbar);

    const map = el("div", "knowledge-map");
    map.setAttribute("role", "region");
    map.setAttribute("aria-label", topic.label + " 추천 학습 경로");
    map.tabIndex = 0;
    const root = el("div", "knowledge-map-root");
    root.append(el("h3", "knowledge-root-title", topic.label));
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
        if (leaf && leaf !== topic.key) body.append(el("span", "knowledge-post-category", editorial.labels?.[leaf] || leaf));
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
    map.append(branches, el("p", "knowledge-draft-note",
      "추천 경로 초안 · 기초에서 심화로 이어지도록 구성했으며, 학습 순서는 계속 다듬어집니다."));
    content.append(map);

    const actions = el("div", "knowledge-map-actions");
    const all = el("a", "knowledge-all-posts", "이 주제의 글 모아보기");
    all.href = "#category=" + encodeURIComponent(topic.path);
    const start = el("a", "knowledge-start", "첫 글부터 읽기 ↗");
    start.href = ordered[0]?.href || all.href;
    actions.append(all, start);
    content.append(actions);
  }

  function render() {
    content.replaceChildren();
    hero.dataset.view = topic ? "map" : field ? "topics" : "fields";
    hero.className = "knowledge-tree" + (field ? " knowledge-color-" + field.color : "");
    if (topic) renderMap();
    else if (field) renderTopics();
    else renderFields();
    status.textContent = topic ? topic.label + ", " + topic.posts.size + "개의 글을 추천 순서로 표시합니다."
      : field ? field.label + ", " + topics().length + "개의 주제를 살펴보세요." : "네 가지 학문 중 관심 있는 학문을 고르세요.";
  }

  launch.addEventListener("click", () => {
    launch.hidden = true;
    header.hidden = true;
    content.hidden = false;
    navigate(null);
  });
  hero.dataset.view = "entry";
  launch.hidden = false;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup);
  else setup();
}
