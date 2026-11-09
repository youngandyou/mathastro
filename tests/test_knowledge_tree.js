// Run with: quarto run tests/test_knowledge_tree.js
// These checks read the collection; they never render or change source posts.
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { buildCatalog, orderedPosts, learningStages } from "../assets/knowledge-tree.mjs";

const project = new URL("../", import.meta.url);
const window = {};
runInNewContext(Deno.readTextFileSync(new URL("assets/knowledge-tree-data.js", project)), { window });
const editorial = window.MathAstroKnowledge;

function post(key, categories, date = 1) {
  return { key, categories, date, title: key, href: `/posts/${key}/index.html` };
}

function checkCategoryIdentity() {
  const duplicate = post("shared-post", ["Math > Shared", "Math / Shared", "Math::Shared"]);
  const other = post("other-post", ["Astronomy > Shared"]);
  const multiple = post("two-topics", ["Math > Shared", "Math > Other"]);
  const tree = buildCatalog([duplicate, duplicate, other, multiple], { labels: { Shared: "공통 이름" } });
  const math = tree.get("Math");
  const astronomy = tree.get("Astronomy");
  assert.equal(math.posts.size, 2, "A post with several categories is counted once per root");
  assert.equal(math.children.get("Shared").posts.size, 2);
  assert.equal(math.children.get("Shared").label, "공통 이름");
  assert.equal(astronomy.children.get("Shared").posts.size, 1);
  assert.notEqual(math.children.get("Shared"), astronomy.children.get("Shared"));
  assert.equal(math.children.get("Shared").path, "Math > Shared");
  assert.equal(astronomy.children.get("Shared").path, "Astronomy > Shared");
  assert.deepEqual(new Set(orderedPosts(math).map(item => item.href)),
    new Set([duplicate.href, multiple.href]), "Multiple branches must not duplicate a reading link");
  console.log("PASS: distinct category paths, separator aliases, and duplicate-free articles");
}

function checkReadingOrder() {
  const data = [
    post("advanced", ["Math > Topic"], 1),
    post("newer", ["Math > Topic"], 20),
    post("basics", ["Math > Topic"], 100),
    post("older", ["Math > Topic"], 10),
    post("undated-b", ["Math > Topic"], NaN),
    post("undated-a", ["Math > Topic"], 0)
  ];
  const config = { orders: { Topic: ["basics", "advanced"] } };
  const node = buildCatalog(data).get("Math").children.get("Topic");
  assert.deepEqual(orderedPosts(node, config).map(item => item.key),
    ["basics", "advanced", "older", "newer", "undated-a", "undated-b"]);

  const branches = buildCatalog([
    post("last", ["Math > Topic > Final"]),
    post("first", ["Math > Topic > Intro"])
  ]).get("Math").children.get("Topic");
  assert.deepEqual(orderedPosts(branches, { orders: { Topic: ["Intro", "Final"] } }).map(item => item.key),
    ["first", "last"], "Editorial branch order must win over alphabetical order");
  console.log("PASS: concept order overrides dates; new and undated posts have stable fallbacks");
}

function checkStages() {
  for (const count of [0, 1, 2, 3, 4, 5, 8, 9, 16, 43, 219]) {
    const posts = Array.from({ length: count }, (_, index) => post(`article-${index}`, ["Math"]));
    const stages = learningStages(posts);
    assert.deepEqual(stages.flatMap(stage => stage.posts), posts,
      `Partitioning ${count} articles must preserve every article and its order`);
    assert.ok(stages.every(stage => stage.name && stage.posts.length), "No empty learning branches");
    assert.ok(stages.length <= 3, "The overview stays readable for large collections");
  }
  console.log("PASS: empty, short, and long learning paths preserve every article exactly once");
}

function readPublishedPosts(directory = new URL("posts/", project), relative = "posts") {
  const posts = [];
  for (const entry of Deno.readDirSync(directory)) {
    if (entry.isDirectory) {
      posts.push(...readPublishedPosts(new URL(`${encodeURIComponent(entry.name)}/`, directory), `${relative}/${entry.name}`));
      continue;
    }
    if (!entry.isFile || !entry.name.endsWith(".qmd")) continue;
    const content = Deno.readTextFileSync(new URL(encodeURIComponent(entry.name), directory));
    const metadata = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
    if (!metadata || /^draft:\s*true\s*$/m.test(metadata)) continue;
    const block = metadata.match(/^categories:\s*\n((?:[ \t]+[^\n]*\n?)*)/m)?.[1];
    const inline = metadata.match(/^categories:\s*\[([^\]]*)\]/m)?.[1];
    const categories = block
      ? [...block.matchAll(/^\s*-\s*(.+)$/gm)].map(match => match[1].trim().replace(/^['"]|['"]$/g, ""))
      : inline?.split(",").map(item => item.trim().replace(/^['"]|['"]$/g, "")) || [];
    if (!categories.length) continue;
    const name = entry.name.slice(0, -4);
    posts.push({
      key: name === "index" ? relative.split("/").at(-1) : name,
      href: `${relative}/${name}.html`, title: name, categories, date: 1
    });
  }
  return posts;
}

function checkRealCollection() {
  const posts = readPublishedPosts();
  const expected = JSON.parse(Deno.readTextFileSync(new URL("assets/category-counts.json", project)));
  const tree = buildCatalog(posts, editorial);
  assert.equal(posts.length, expected.totalPosts, "The test fixture must cover the complete published collection");
  const allLinks = new Set();

  function visit(node) {
    const ordered = orderedPosts(node, editorial);
    assert.deepEqual(new Set(ordered.map(item => item.href)), new Set(node.posts.keys()),
      `${node.path}: all descendants must reach the learning map`);
    assert.equal(ordered.length, node.posts.size, `${node.path}: no duplicate map links`);
    const order = editorial.orders[node.key] || [];
    assert.equal(new Set(order).size, order.length, `${node.path}: duplicate editorial token`);
    // New/deleted posts and categories work without editing the suggested paths.
    for (const child of node.children.values()) visit(child);
  }

  for (const [key, root] of tree) {
    assert.equal(root.posts.size, expected.topCategories[key], `${key}: field card count`);
    for (const item of orderedPosts(root, editorial)) allLinks.add(item.href);
    visit(root);
  }
  assert.equal(allLinks.size, posts.length, "Every published article appears in a field's reading tree");
  console.log(`PASS: ${posts.length} published posts, all field counts, every category, and complete reading paths`);
}

checkCategoryIdentity();
checkReadingOrder();
checkStages();
checkRealCollection();
