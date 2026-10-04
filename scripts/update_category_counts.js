// scripts/update_category_counts.js
// Automatically scans posts/ to count articles per category and updates:
// 1. assets/category-counts.json
// 2. _quarto.yml navbar counts
// 3. assets/navbar-submenus.html subcategory counts
// 4. index.qmd archive card counts
//
// Can be run with: quarto run scripts/update_category_counts.js

import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

const ROOT_DIR = Deno.cwd();
const POSTS_DIR = path.join(ROOT_DIR, "posts");
const QUARTO_YML = path.join(ROOT_DIR, "_quarto.yml");
const NAVBAR_SUBMENUS = path.join(ROOT_DIR, "assets", "navbar-submenus.html");
const CATEGORY_JSON = path.join(ROOT_DIR, "assets", "category-counts.json");
const INDEX_QMD = path.join(ROOT_DIR, "index.qmd");

function findQmdFiles(dir) {
  let files = [];
  for (const entry of Deno.readDirSync(dir)) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory) {
      files = files.concat(findQmdFiles(fullPath));
    } else if (entry.isFile && entry.name.endsWith(".qmd")) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFrontmatterCategories(content) {
  // Extract YAML frontmatter
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];

  const frontmatter = match[1];
  
  // Check if draft
  if (/^draft:\s*true/m.test(frontmatter)) {
    return [];
  }

  const categories = [];
  const lines = frontmatter.split(/\r?\n/);
  let inCategories = false;
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^categories:\s*$/.test(line)) {
      inCategories = true;
      continue;
    }

    // Single-line array syntax: categories: [A, B]
    const singleArrMatch = line.match(/^categories:\s*\[(.*?)\]/);
    if (singleArrMatch) {
      const items = singleArrMatch[1].split(",").map(s => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      categories.push(...items);
      continue;
    }

    if (inCategories) {
      const itemMatch = line.match(/^\s*-\s*(.+)$/);
      if (itemMatch) {
        categories.push(itemMatch[1].trim().replace(/^['"]|['"]$/g, ""));
      } else if (/^\S/.test(line)) {
        inCategories = false;
      }
    }
  }

  return categories;
}

function countPosts() {
  const qmdFiles = findQmdFiles(POSTS_DIR);
  const pathCounts = {};
  const leafCounts = {};
  let totalPosts = 0;

  for (const file of qmdFiles) {
    const content = Deno.readTextFileSync(file);
    const rawCategories = parseFrontmatterCategories(content);
    if (rawCategories.length === 0) continue;

    totalPosts++;
    const countedPathsForPost = new Set();

    for (const rawCat of rawCategories) {
      // Split by ' > ', ' / ', '::'
      const parts = rawCat.split(/\s*(?:>|\/|::)\s*/).map(p => p.trim()).filter(Boolean);
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        currentPath = currentPath ? `${currentPath} > ${parts[i]}` : parts[i];
        countedPathsForPost.add(currentPath);
      }
    }

    for (const p of countedPathsForPost) {
      pathCounts[p] = (pathCounts[p] || 0) + 1;
      const parts = p.split(" > ");
      const leaf = parts[parts.length - 1];
      leafCounts[leaf] = (leafCounts[leaf] || 0) + 1;
      leafCounts[leaf.toLowerCase()] = (leafCounts[leaf.toLowerCase()] || 0) + 1;
    }
  }

  return { totalPosts, pathCounts, leafCounts };
}

function updateQuartoYml(pathCounts, leafCounts) {
  if (!tryExists(QUARTO_YML)) return;
  let content = Deno.readTextFileSync(QUARTO_YML);

  // Mapping from category URL parameter to lookup paths or keys
  const categoryMap = {
    "Math": ["Math"],
    "Calculus": ["Math > Calculus", "Calculus"],
    "Abstract Algebra": ["Math > Abstract Algebra", "Abstract Algebra"],
    "Linear Algebra": ["Math > Linear Algebra", "Linear Algebra"],
    "Matrix Algebra": ["Math > Matrix Algebra", "Matrix Algebra"],
    "Complex Analysis": ["Math > Complex Analysis", "Complex Analysis"],
    "Analysis": ["Math > Analysis", "Analysis"],
    "Topology": ["Math > Topology", "Topology"],
    "Differential Geometry": ["Math > Differential Geometry", "Differential Geometry"],
    "Graph Theory": ["Math > Graph Theory", "Graph Theory"],
    "Numerical Analysis": ["Math > Numerical Analysis", "Numerical Analysis"],
    "Astronomy": ["Astronomy"],
    "Radio Astronomy": ["Astronomy > Radio Astronomy", "Radio Astronomy"],
    "General Relativity": ["Astronomy > General Relativity", "General Relativity"],
    "High Energy": ["Astronomy > High Energy Astrophysics", "High Energy Astrophysics", "High Energy"],
    "Relativistic Jets": ["Astronomy > Relativistic Jets", "Relativistic Jets"],
    "Physics": ["Physics"],
    "Thermodynamics": ["Physics > Thermodynamics", "Thermodynamics"],
    "Computer": ["Computer"],
    "Reinforcement Learning": ["Computer > Machine Learning > Reinforcement Learning", "Reinforcement Learning"]
  };

  // Replace count in menu items:
  // e.g. - href: index.qmd#category=Abstract%20Algebra
  //        text: "추상대수학 (Abstract Algebra) (38)"
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hrefMatch = line.match(/href:\s*index\.qmd#category=([^#\s]+)/);
    if (hrefMatch && i + 1 < lines.length) {
      const rawCatKey = decodeURIComponent(hrefMatch[1]).trim();
      const lookups = categoryMap[rawCatKey] || [rawCatKey];
      let count = 0;
      for (const k of lookups) {
        if (pathCounts[k] !== undefined) {
          count = pathCounts[k];
          break;
        } else if (leafCounts[k] !== undefined) {
          count = leafCounts[k];
          break;
        }
      }

      const nextLine = lines[i + 1];
      if (/text:\s*"?[^"]*\(\d+\)"?/.test(nextLine)) {
        lines[i + 1] = nextLine.replace(/\(\d+\)/, `(${count})`);
      }
    }
  }

  Deno.writeTextFileSync(QUARTO_YML, lines.join("\n"));
  console.log("✓ Updated _quarto.yml navbar counts");
}

function updateNavbarSubmenus(pathCounts) {
  if (!tryExists(NAVBAR_SUBMENUS)) return;
  let content = Deno.readTextFileSync(NAVBAR_SUBMENUS);

  // Update counts in navSubmenuData
  const subcatLookups = {
    "Group Theory": "Math > Abstract Algebra > Group Theory",
    "Ring Theory": "Math > Abstract Algebra > Ring Theory",
    "Binary Algebraic Structure": "Math > Abstract Algebra > Binary Algebraic Structure",
    "Field Theory": "Math > Abstract Algebra > Field Theory",
    "Vector Calculus": "Math > Calculus > Vector Calculus",
    "Multivariable": "Math > Analysis > Multivariable",
    "Curve Theory": "Math > Differential Geometry > Curve Theory",
    "Graph": "Math > Graph Theory > Graph",
    "Network Analysis": "Math > Graph Theory > Network Analysis",
    "Algorithm": "Math > Graph Theory > Algorithm",
    "Tree": "Math > Graph Theory > Tree",
    "Radio Software": "Astronomy > Radio Astronomy > Radio Software",
    "AIPS": "Astronomy > Radio Astronomy > Radio Software > AIPS",
    "resolve": "Astronomy > Radio Astronomy > Radio Software > resolve",
    "Equivalence Principle": "Astronomy > General Relativity > Equivalence Principle"
  };

  for (const [key, p] of Object.entries(subcatLookups)) {
    const count = pathCounts[p] || 0;
    // Regex to match: key: "Group Theory", ... count: \d+
    const reg = new RegExp(`(key:\\s*["']${escapeRegex(key)}["'][\\s\\S]*?count:\\s*)\\d+`, "g");
    content = content.replace(reg, `$1${count}`);
  }

  Deno.writeTextFileSync(NAVBAR_SUBMENUS, content);
  console.log("✓ Updated assets/navbar-submenus.html counts");
}

function updateIndexQmd(pathCounts) {
  if (!tryExists(INDEX_QMD)) return;
  let content = Deno.readTextFileSync(INDEX_QMD);

  const mathCount = pathCounts["Math"] || 0;
  const astroCount = pathCounts["Astronomy"] || 0;

  // Update cards e.g. "174편", "16편"
  content = content.replace(/(Mathematics\s*\(수학\)\s*<\/div>\s*<div[^>]*>)\d+편/, `$1${mathCount}편`);
  content = content.replace(/(Astronomy\s*\(천문학\)\s*<\/div>\s*<div[^>]*>)\d+편/, `$1${astroCount}편`);

  Deno.writeTextFileSync(INDEX_QMD, content);
  console.log(`✓ Updated index.qmd archive cards (Math: ${mathCount}편, Astronomy: ${astroCount}편)`);
}

function writeCategoryJson(data) {
  const output = {
    updatedAt: new Date().toISOString(),
    totalPosts: data.totalPosts,
    counts: data.pathCounts,
    leafCounts: data.leafCounts,
    topCategories: {
      "Math": data.pathCounts["Math"] || 0,
      "Astronomy": data.pathCounts["Astronomy"] || 0,
      "Physics": data.pathCounts["Physics"] || 0,
      "Computer": data.pathCounts["Computer"] || 0,
    }
  };

  Deno.writeTextFileSync(CATEGORY_JSON, JSON.stringify(output, null, 2));
  console.log(`✓ Saved ${CATEGORY_JSON} (Total: ${data.totalPosts} posts)`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryExists(p) {
  try {
    Deno.statSync(p);
    return true;
  } catch {
    return false;
  }
}

// Main execution
console.log("Scanning posts and updating category counts...");
const data = countPosts();
console.log(`Found ${data.totalPosts} posts.`);
updateQuartoYml(data.pathCounts, data.leafCounts);
updateNavbarSubmenus(data.pathCounts);
updateIndexQmd(data.pathCounts);
writeCategoryJson(data);
console.log("Category counts successfully updated!");
