// Run with: quarto run tests/test_preview.js
// Regression checks use temporary projects and never edit the real articles.
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

const project = new URL("../", import.meta.url);
const navbar = Deno.readTextFileSync(new URL("assets/navbar-submenus.html", project));
const scripts = ["update_category_counts.js", "update_category_counts.py"];
const generated = ["_quarto.yml", "index.qmd", "assets/navbar-submenus.html", "assets/category-counts.json"];

async function checkCounts() {
  const dir = Deno.makeTempDirSync({ prefix: "mathastro-counts-" });
  try {
    for (const subdir of ["scripts", "assets", "posts/example", "posts/draft"]) {
      Deno.mkdirSync(`${dir}/${subdir}`, { recursive: true });
    }
    for (const script of scripts) {
      Deno.copyFileSync(new URL(`scripts/${script}`, project), `${dir}/scripts/${script}`);
    }
    for (const file of generated.slice(0, 3)) {
      Deno.copyFileSync(new URL(file, project), `${dir}/${file}`);
    }
    const article = "---\ncategories:\n  - Math > Calculus > Vector Calculus\n---\n\nUnchanged article.\n";
    Deno.writeTextFileSync(`${dir}/posts/example/index.qmd`, article);
    Deno.writeTextFileSync(`${dir}/posts/draft/index.qmd`, article.replace("categories:", "draft: true\ncategories:"));

    async function run(script) {
      const js = script.endsWith(".js");
      const command = js ? Deno.execPath() : "python3";
      const args = js ? ["run", "--no-config", "--no-lock", "--allow-read", "--allow-write", `${dir}/scripts/${script}`]
        : [`${dir}/scripts/${script}`];
      // A different working directory also checks project-root resolution.
      const result = await new Deno.Command(command, {
        args, cwd: `${dir}/posts/example`, stdout: "piped", stderr: "piped",
      }).output();
      assert.equal(result.code, 0, new TextDecoder().decode(result.stderr));
    }

    const readCounts = () => JSON.parse(Deno.readTextFileSync(`${dir}/assets/category-counts.json`));
    for (const script of scripts) {
      // Recover a damaged JSON file, then leave every unchanged file untouched.
      Deno.writeTextFileSync(`${dir}/assets/category-counts.json`, "{broken");
      await run(script);
      assert.equal(readCounts().totalPosts, 1);
      assert.equal(readCounts().counts["Math > Calculus"], 1);
      assert.match(Deno.readTextFileSync(`${dir}/_quarto.yml`), /All Math\) \(1\)/);
      assert.match(Deno.readTextFileSync(`${dir}/assets/navbar-submenus.html`), /key: "Vector Calculus"[^\n]*count: 1/);

      const before = generated.map(file => {
        Deno.utimeSync(`${dir}/${file}`, new Date(0), new Date(0));
        return Deno.readTextFileSync(`${dir}/${file}`);
      });
      // Both implementations must agree, even if JSON key order differs.
      for (const other of scripts) await run(other);
      generated.forEach((file, i) => {
        assert.equal(Deno.readTextFileSync(`${dir}/${file}`), before[i], file);
        assert.equal(Deno.statSync(`${dir}/${file}`).mtime.getTime(), 0, `${file} was rewritten`);
      });

      // Adding and removing a post must still refresh category numbers.
      Deno.writeTextFileSync(`${dir}/posts/added.qmd`, article);
      await run(script);
      assert.equal(readCounts().totalPosts, 2);
      assert.equal(readCounts().counts["Math > Calculus"], 2);
      Deno.removeSync(`${dir}/posts/added.qmd`);
      await run(script);
      assert.equal(readCounts().totalPosts, 1);
      assert.equal(Deno.readTextFileSync(`${dir}/posts/example/index.qmd`), article);
    }
    console.log("PASS: category updates, draft exclusion, unchanged file contents/mtimes, JS/Python parity");
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
}

async function checkUrls() {
  const source = navbar.match(/<script>([\s\S]*?)<\/script>/)[1];
  const cases = [
    ["http://localhost:4782/", "", "http://localhost:4782/assets/category-counts.json"],
    ["http://localhost:4782/posts/Astronomy/SSA/index.html", "../../../", "http://localhost:4782/assets/category-counts.json"],
    ["https://example.test/mathastro/", "./", "https://example.test/mathastro/assets/category-counts.json"],
    ["https://example.test/mathastro/posts/Astronomy/SSA/", "../../../", "https://example.test/mathastro/assets/category-counts.json"],
    ["https://example.test/another-prefix/posts/Math/Abstract_Algebra/Group_Theory/group/index.html", "../../../../../", "https://example.test/another-prefix/assets/category-counts.json"],
  ];
  for (const [page, offset, expected] of cases) {
    for (const ok of [true, false]) {
      const requests = [];
      const counts = { Math: 184, Astronomy: 19 };
      const window = { addEventListener() {} };
      const document = {
        readyState: "complete", baseURI: page,
        querySelector(selector) {
          return selector === 'meta[name="quarto:offset"]' ? { content: offset } : null;
        },
        querySelectorAll(selector) {
          return selector === ".navbar-nav .dropdown-menu a.dropdown-item"
            ? [{ getAttribute: () => "index.html" }] : [];
        },
      };
      runInNewContext(source, {
        window, document, URL,
        fetch: async url => {
          requests.push(url.href);
          return { ok, status: ok ? 200 : 404, json: async () => ({ counts }) };
        },
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.deepEqual(requests, [expected]);
      assert.equal(window.__categoryCounts, ok ? counts : undefined);
    }
  }
  console.log("PASS: one category request per page at root, nested paths, and deployment prefixes; no retry cascade");
}

await checkCounts();
await checkUrls();
